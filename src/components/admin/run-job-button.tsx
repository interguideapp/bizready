"use client";

import { useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { runScheduledJobNow } from "@/lib/actions";
import { toast } from "@/components/toaster";

/**
 * Run a scheduled job now.
 *
 * With CRON_SECRET unset every /api/cron/* call is rejected — correctly — and
 * that left NO way to run the sweep at all, not even for the owner. Reminders
 * could not be sent even deliberately, which is worse than a broken schedule:
 * a schedule can be fixed tomorrow, a dead capability cannot be worked around.
 *
 * Authorized by the admin session, so nothing about the cron guard is relaxed.
 * The jobs dedupe by key, so pressing it twice does not double-send.
 */
export function RunJobButton({ job, label }: { job: "reminders" | "sync" | "retention" | "source-watch"; label: string }) {
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      const res = await runScheduledJobNow(job);
      setDetail(res.detail);
      // What it DID, not that a button was pressed. An operator running a sweep
      // by hand needs the counts to know whether it actually sent anything.
      if (res.ok) toast.success(`${label}: הריצה הסתיימה`);
      else toast.error(`${label}: הריצה נכשלה`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={pending}
        aria-label={`הרצה עכשיו: ${label}`}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-edge px-3 text-xs font-medium text-brand-strong transition hover:border-brand-300 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Play className="h-3.5 w-3.5" aria-hidden />
        )}
        הרצה עכשיו
      </button>
      {detail && (
        // The raw summary the job returned. An operator checking whether a
        // manual run sent anything needs the counts, not a green tick.
        <output className="max-w-[18rem] break-all text-start text-xs text-ink-faint">{detail}</output>
      )}
    </div>
  );
}
