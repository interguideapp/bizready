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

      const digestKey = `digest:${today.toISOString().slice(0, 10)}`;
      const digest: OutboundDigest = {
        businessName: biz.name,
        items: urgent.map((n) => ({ title: n.title, body: n.body })),
        appUrl,
      };

      // email
      if (biz.notify_email && emailConfigured() && !(await alreadySent(supabase, biz.id, "email", digestKey))) {
        const { data: userRes } = await supabase.auth.admin.getUserById(biz.owner_id);
        const email = userRes?.user?.email;
        if (email) {
          const res = await sendEmailDigest(email, digest);
          if (res.ok) {
            await logSent(supabase, biz.id, "email", digestKey);
            emailsSent++;
          }
        }
      }

      // push — one message per registered device
      if (
        biz.notify_push &&
        pushConfigured() &&
        !(await alreadySent(supabase, biz.id, "push", digestKey))
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
        if (anyDelivered) {
          await logSent(supabase, biz.id, "push", digestKey);
          pushSent++;
        }
      }

      // whatsapp
      if (
        biz.notify_whatsapp &&
        biz.whatsapp_phone &&
        whatsappConfigured() &&
        !(await alreadySent(supabase, biz.id, "whatsapp", digestKey))
      ) {
        const res = await sendWhatsappDigest(biz.whatsapp_phone, digest);
        if (res.ok) {
          await logSent(supabase, biz.id, "whatsapp", digestKey);
          whatsappSent++;
        }
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
    ok: fanOutSucceeded(businesses.length, failedBusinesses),
    businesses: businesses.length,
    failedBusinesses,
    failures,
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

async function alreadySent(
  supabase: Admin,
  businessId: string,
  channel: string,
  dedupeKey: string
): Promise<boolean> {
  const { data } = await supabase
    .from("reminder_log")
    .select("id")
    .eq("business_id", businessId)
    .eq("channel", channel)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  return Boolean(data);
}

async function logSent(
  supabase: Admin,
  businessId: string,
  channel: string,
  dedupeKey: string
): Promise<void> {
  await supabase
    .from("reminder_log")
    .insert({ business_id: businessId, channel, dedupe_key: dedupeKey });
}
