import { NextResponse } from "next/server";
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

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily reminder sweep. Wired to Vercel Cron (see vercel.json).
 * Protected by CRON_SECRET so it can't be triggered by the public.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bizready.app";
  const today = new Date();

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select(
      "id, owner_id, name, notify_email, notify_whatsapp, whatsapp_phone, notify_push"
    )
    .not("onboarding_completed_at", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let notificationsCreated = 0;
  let recurringReset = 0;
  let emailsSent = 0;
  let whatsappSent = 0;
  let pushSent = 0;

  for (const biz of businesses ?? []) {
    const { data: tasks } = await supabase
      .from("business_tasks")
      .select(
        "id, template_id, status, is_relevant, due_date, completed_at, follow_up_date, waiting_for"
      )
      .eq("business_id", biz.id);

    const { notifications, recurringResets } = computeReminders(
      (tasks ?? []) as ReminderTask[],
      TEMPLATES_BY_ID,
      today
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
          url: "/dashboard",
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
  }

  return NextResponse.json({
    ok: true,
    businesses: businesses?.length ?? 0,
    notificationsCreated,
    recurringReset,
    emailsSent,
    whatsappSent,
    pushSent,
  });
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
