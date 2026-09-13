import { todayInIsrael } from "@/lib/dates";
import { NextResponse } from "next/server";
import { fanOutSucceeded } from "@/lib/cron/outcome";
import { fetchAllPages } from "@/lib/supabase/page-all";
import { cronAuthorized } from "@/lib/cron-auth";
import { TEMPLATES_BY_ID } from "@/lib/content";
import {
  emailConfigured,
  sendEmailDigest,
  sendWhatsappDigest,
  whatsappConfigured,
  type OutboundDigest,
} from "@/lib/notify/channels";
import { pushConfigured, sendPush } from "@/lib/notify/push";
import { computeReminders, type ReminderTask } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";
import { beginCronRun, endCronRun } from "@/lib/cron-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily reminder sweep. Wired to Vercel Cron (see vercel.json).
 * Requires CRON_SECRET (fails closed if unset) — it runs with the service role.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runRemindersSweep();
}

/**
 * The work, separated from the HTTP guard.
 *
 * Extracted so it can be run by something other than a cron trigger. With
 * CRON_SECRET unset every /api/cron/* call is rejected — correctly — which
 * meant there was NO way to run the sweep at all, not even for the owner,
 * and the dispatcher's own comment claimed these routes were how a single
 * job gets re-run by hand. They were not. An admin can now run it from
 * /admin, authorized by their session, which is a stronger check than a
 * shared secret rather than a weaker one.
 */
export async function runRemindersSweep(): Promise<Response> {
  const supabase = createAdminClient();
  // Heartbeat: this sweep is what sends every reminder, so its silence has to
  // be observable. See lib/heartbeat.ts.
  const run = await beginCronRun(supabase, "reminders");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bizready.app";
  const today = new Date();

  // Paged, and ORDERED so the pages cannot overlap or skip.
  //
  // This was one unbounded select. PostgREST caps a response at its configured
  // max-rows — a value that lives in a dashboard setting this code never
  // states and cannot read — so past that cap the sweep processed a subset,
  // reported it as the whole set, and without an ORDER BY would not even have
  // processed the same subset twice. In the one job whose silence costs a user
  // money. Two onboarded businesses today, so nothing was broken; this removes
  // the dependency rather than waiting to discover the number.
  const {
    rows: businesses,
    error: pageError,
    pages,
  } = await fetchAllPages((from, to) =>
    supabase
      .from("businesses")
      .select(
        "id, owner_id, name, entity_type, onboarding_answers, notify_email, notify_whatsapp, whatsapp_phone, notify_push, subscription_tier, subscription_until"
      )
      .not("onboarding_completed_at", "is", null)
      .order("id")
      .range(from, to)
  );
  if (pageError) {
    // A partial read is not a success. Recorded as a failure so the heartbeat
    // says so and jobsDue keeps the job due.
    await endCronRun(supabase, run, false, {
      error: pageError,
      businessesRead: businesses.length,
    });
    return NextResponse.json({ error: pageError }, { status: 500 });
  }

  let notificationsCreated = 0;
  let recurringReset = 0;
  let emailsSent = 0;
  let whatsappSent = 0;
  let pushSent = 0;

  /*
   * PER-BUSINESS ISOLATION.
   *
   * There was no try/catch anywhere in this route. One business that threw —
   * a malformed onboarding_answers, a template id no longer in content, a
   * date that will not parse — propagated out of this loop, and every business
   * after it got nothing. endCronRun was never reached either, so the run
   * stayed unfinished and jobsDue kept it due, which meant the next sweep hit
   * the same row and starved the same tenants again.
   *
   * Ordering the fan-out by id made that deterministic rather than random,
   * which is better for pagination and worse here: the same businesses would
   * be starved every night. So the two changes belong together.
   *
   * One tenant's bad data must not decide whether anybody else is reminded.
   */
  let failedBusinesses = 0;
  /*
   * Claims that could not be taken for a reason OTHER than "already sent",
   * and how many were attempted at all.
   *
   * Counted because a systematic claim failure stops outbound entirely while
   * every tenant still succeeds — see claimSend. Both numbers, because the
   * question is the same one fanOutSucceeded already answers: some failing is
   * a tenant problem, all of them failing is the mechanism.
   */
  let claimsUnavailable = 0;
  let claimsAttempted = 0;
  const failures: { businessId: string; error: string }[] = [];

  for (const biz of businesses) {
    try {
      const { data: tasks } = await supabase
        .from("business_tasks")
        .select(
          "id, template_id, status, is_relevant, dismissal, due_date, personal_due_date, completed_at, completion_data, follow_up_date, waiting_for"
        )
        .eq("business_id", biz.id);

      // The filing ledger (030), which decides whether a reporting period has
      // actually been filed. Without it the cycle decision falls back to the
      // stored deadline and can only ever see one period — and worse, the sweep
      // would then reach a different conclusion from the screens, which read the
      // ledger. Selected here for the same reason `dismissal` is: the gate is
      // only as good as the data handed to it.
      const { data: filings } = await supabase
        .from("task_filings")
        .select("template_id, period_key")
        .eq("business_id", biz.id);
      const filedByTemplate = new Map<string, string[]>();
      for (const row of filings ?? []) {
        const list = filedByTemplate.get(row.template_id);
        if (list) list.push(row.period_key);
        else filedByTemplate.set(row.template_id, [row.period_key]);
      }

      const { data: docs } = await supabase
        .from("documents")
        .select("name, expires_at")
        .eq("business_id", biz.id)
        .not("expires_at", "is", null);

      const isPro =
        biz.subscription_tier === "pro" &&
        (!biz.subscription_until || new Date(biz.subscription_until) > today);
      const answers = (biz.onboarding_answers ?? {}) as {
        vat_frequency?: "monthly" | "bimonthly";
      };
      const { notifications, recurringResets } = computeReminders(
        ((tasks ?? []) as ReminderTask[]).map((t) => ({
          ...t,
          filed_periods: filedByTemplate.get(t.template_id),
        })),
        TEMPLATES_BY_ID,
        today,
        isPro,
        { entityType: biz.entity_type, vatFrequency: answers.vat_frequency },
        // The archive, for the expiry watch. Omitting it here would leave the
        // screens announcing an expiry the email never mentions — the same split
        // this whole pass exists to close.
        (docs ?? []).map((d) => ({ name: d.name, expires_at: d.expires_at }))
      );

      // reset recurring tasks that came due again
      for (const reset of recurringResets) {
        await supabase
          .from("business_tasks")
          .update({ status: "todo", completed_at: null, due_date: reset.newDueDate })
          .eq("id", reset.taskId);
        recurringReset++;
      }

      // insert notifications, ignoring ones that already exist (dedupe_key unique)
      if (notifications.length > 0) {
        const { data: inserted } = await supabase
          .from("notifications")
          .upsert(
            notifications.map((n) => ({ ...n, business_id: biz.id })),
            { onConflict: "business_id,dedupe_key", ignoreDuplicates: true }
          )
          .select("id");
        notificationsCreated += inserted?.length ?? 0;
      }

      // outbound digest: today's unsent urgent items
      const urgent = notifications.filter(
        (n) => n.type === "overdue" || n.type === "deadline" || n.type === "recurring"
      );
      if (urgent.length === 0) continue;

      /*
       * Keyed on the ISRAELI day, not the UTC one.
       *
       * This was today.toISOString().slice(0, 10) — the A10 pattern this
       * product replaced everywhere else. Israel is UTC+2/+3, so between local
       * midnight and 02:00/03:00 the UTC date is still YESTERDAY, and the key
       * was therefore yesterday's. alreadySent then found yesterday's digest
       * and skipped, which is right for the row it found and wrong for the day
       * it was in.
       *
       * With the lazy sweep as the trigger that can cost a whole day: if the
       * only visit on a given day falls in that window, the key resolves to
       * the previous day, the send is skipped as a duplicate, and nobody gets
       * a digest at all. The engine already reasons in Israeli days; this is
       * the one place the bookkeeping did not.
       */
      const digestKey = `digest:${todayInIsrael(today)}`;
      /** Claim, and count the one outcome that means the mechanism is broken. */
      const claim = async (channel: string) => {
        claimsAttempted++;
        const result = await claimSend(supabase, biz.id, channel, digestKey);
        if (result === "unavailable") claimsUnavailable++;
        return result === "claimed";
      };
      const digest: OutboundDigest = {
        businessName: biz.name,
        items: urgent.map((n) => ({ title: n.title, body: n.body })),
        appUrl,
      };

      // email — claimed before sending, released if the send fails
      if (
        biz.notify_email &&
        emailConfigured() &&
        (await claim("email"))
      ) {
        const { data: userRes } = await supabase.auth.admin.getUserById(biz.owner_id);
        const email = userRes?.user?.email;
        const res = email ? await sendEmailDigest(email, digest) : { ok: false };
        if (res.ok) emailsSent++;
        // No address on the account is not a delivered message either, so the
        // claim goes back and a later sweep can try again.
        else await releaseSend(supabase, biz.id, "email", digestKey);
      }

      // push — one message per registered device
      if (
        biz.notify_push &&
        pushConfigured() &&
        (await claim("push"))
      ) {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("business_id", biz.id);

        let anyDelivered = false;
        for (const sub of subs ?? []) {
          const result = await sendPush(sub, {
            title: `BizReady · ${urgent.length} דברים לטיפול`,
            body: urgent
              .slice(0, 3)
              .map((n) => n.title)
              .join(" · "),
            url: "/home",
            tag: digestKey,
          });
          if (result.ok) anyDelivered = true;
          if (result.gone) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
        }
        if (anyDelivered) pushSent++;
        // Every device gone or erroring is not a delivered push, so the claim
        // goes back rather than marking the day done.
        else await releaseSend(supabase, biz.id, "push", digestKey);
      }

      // whatsapp
      if (
        biz.notify_whatsapp &&
        biz.whatsapp_phone &&
        whatsappConfigured() &&
        (await claim("whatsapp"))
      ) {
        const res = await sendWhatsappDigest(biz.whatsapp_phone, digest);
        if (res.ok) whatsappSent++;
        // Billed per message, so this is the channel where a duplicate costs
        // real money and the claim-first order matters most.
        else await releaseSend(supabase, biz.id, "whatsapp", digestKey);
      }
    } catch (e) {
      // Counted and named, never swallowed: a tenant whose reminders fail
      // every night must be visible to an operator even though the sweep
      // itself completed for everyone else.
      failedBusinesses++;
      const message = e instanceof Error ? e.message : String(e);
      if (failures.length < 20) failures.push({ businessId: biz.id, error: message });
      console.error(`[cron/reminders] business ${biz.id} threw`, e);
    }
  }

  const summary = {
    // Not false when a few tenants threw — a red heartbeat would tell EVERY
    // user that delivery is down because one other account has bad data, and
    // would keep the job due so it retried the same failure all night. But not
    // true when the loop achieved nothing for anyone either: see
    // fanOutSucceeded, which both fan-out sweeps now share.
    /*
     * AN INCONSISTENCY I INTRODUCED one commit ago and am fixing here.
     *
     * This read `claimsUnavailable === 0`, so ONE business with an odd claim
     * error failed the whole run — which sets `failing`, which makes
     * jobIsDown true, which tells EVERY user that delivery is down. That is
     * exactly the trade-off I reasoned about for per-business throws one commit
     * earlier and deliberately refused, and then took the opposite side of in
     * the same expression.
     *
     * The rule is the same either way, so it is the same function: some claims
     * failing is a tenant problem, all of them failing is the mechanism.
     */
    ok:
      fanOutSucceeded(businesses.length, failedBusinesses) &&
      fanOutSucceeded(claimsAttempted, claimsUnavailable),
    businesses: businesses.length,
    failedBusinesses,
    failures,
    claimsUnavailable,
    claimsAttempted,
    // In the summary so a future truncation is visible in cron_runs rather
    // than only in its absence.
    pages,
    notificationsCreated,
    recurringReset,
    emailsSent,
    whatsappSent,
    pushSent,
  };
  // The recorded outcome must be the one the summary states, or the heartbeat
  // and the row disagree about the same run. retention already did this.
  await endCronRun(supabase, run, summary.ok, summary);
  return NextResponse.json(summary);
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Claim the right to send, atomically, before sending.
 *
 * This replaces a check-then-send pair that failed open in both directions.
 * alreadySent discarded the query's error, so a database hiccup read as "not
 * sent yet" and the digest went out again; logSent never checked its insert,
 * so a failed write left a delivered message unrecorded and the next sweep
 * sent it a second time. Two concurrent sweeps could also both read "not
 * sent" and both send.
 *
 * That mattered much more after two changes made earlier today. The lazy sweep
 * now runs whenever reminders are DUE rather than waiting for stale, and a run
 * where every tenant failed is now recorded as failed — which correctly leaves
 * the job due, so it retries hourly. Each retry was another chance to
 * duplicate, and WhatsApp is billed per message.
 *
 * reminder_log carries UNIQUE (business_id, channel, dedupe_key), so the insert
 * IS the lock: whoever lands the row owns the send, and everyone else is told
 * no. Failing to claim — for any reason, including an error — means not
 * sending, which is the safe direction: the in-app alert is derived on every
 * page load and cannot fail, so a skipped digest costs a nudge and never the
 * information itself.
 */
/**
 * Postgres unique_violation. The EXPECTED way to fail a claim: somebody
 * already sent this digest.
 */
const UNIQUE_VIOLATION = "23505";

export type ClaimResult = "claimed" | "already-sent" | "unavailable";

async function claimSend(
  supabase: Admin,
  businessId: string,
  channel: string,
  dedupeKey: string
): Promise<ClaimResult> {
  const { error } = await supabase
    .from("reminder_log")
    .insert({ business_id: businessId, channel, dedupe_key: dedupeKey });
  if (!error) return "claimed";
  /*
   * A BLIND SPOT I OPENED, and closed in the same hour.
   *
   * The first version of this returned !error, so "already sent" and "the
   * insert is broken" were the same answer: skip. Skipping is the right
   * behaviour for both — see the note above about failing closed — but they
   * are not the same NEWS. If claims failed systematically, because a policy
   * changed or the table moved, outbound would stop entirely while every
   * business still succeeded: no tenant throws, emailsSent is simply 0, and
   * fanOutSucceeded would call the run healthy. Silent total stoppage reported
   * as a good night is the exact failure this session has been removing.
   */
  return error.code === UNIQUE_VIOLATION ? "already-sent" : "unavailable";
}

/**
 * Give the claim back when the send itself failed.
 *
 * Without this, claiming first would turn a transient provider error into a
 * silently skipped day — the opposite failure, and the one this product cares
 * about more. A crash between the claim and the release still leaves the row,
 * which errs toward not duplicating, and costs one nudge.
 */
async function releaseSend(
  supabase: Admin,
  businessId: string,
  channel: string,
  dedupeKey: string
): Promise<void> {
  await supabase
    .from("reminder_log")
    .delete()
    .eq("business_id", businessId)
    .eq("channel", channel)
    .eq("dedupe_key", dedupeKey);
}
