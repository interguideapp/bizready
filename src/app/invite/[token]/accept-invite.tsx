"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { acceptInvite } from "@/lib/actions";
import { FormMessage } from "@/components/form";
import { Button } from "@/components/primitives";
import { Card } from "@/components/ui";
import { ROLE_EXPLAINER, ROLE_LABEL, type MemberRole } from "@/lib/members";

export function AcceptInvite({
  token,
  businessName,
  role,
  invitedEmail,
  alreadyAccepted,
  revoked,
  found,
}: {
  token: string;
  businessName: string | null;
  role: MemberRole | null;
  invitedEmail: string | null;
  alreadyAccepted: boolean;
  revoked: boolean;
  found: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(token);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.businessName);
      router.push("/home");
    });
  }

  if (!found || revoked) {
    return (
      <Card className="p-6 text-center">
        <XCircle className="mx-auto mb-3 h-10 w-10 text-status-overdue" aria-hidden />
        <h1 className="text-title text-ink">ההזמנה לא בתוקף</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {revoked
            ? "ההזמנה בוטלה על ידי בעל העסק."
            : "לא מצאנו את ההזמנה. אפשר לבקש מבעל העסק לשלוח קישור חדש."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-tint text-brand-strong">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-title text-ink">הוזמנתם לתיק העסק</h1>
          {businessName && (
            <p className="truncate text-sm text-ink-muted">{businessName}</p>
          )}
        </div>
      </div>

      {/* What they are being given, before they accept it. An invitation that
          does not say what access it grants is not informed consent. */}
      {role && (
        <div className="mb-4 rounded-2xl border border-edge bg-surface-2 p-4">
          <p className="mb-1 text-sm font-semibold text-ink">{ROLE_LABEL[role]}</p>
          <p className="text-xs leading-relaxed text-ink-muted">{ROLE_EXPLAINER[role]}</p>
        </div>
      )}

      {invitedEmail && (
        <p className="mb-4 text-xs leading-relaxed text-ink-muted">
          ההזמנה נשלחה ל-<span dir="ltr">{invitedEmail}</span>. אפשר לאשר אותה גם
          מחשבון אחר — הקישור עצמו הוא האישור.
        </p>
      )}

      {error && (
        <div className="mb-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      {done && (
        <div className="mb-3">
          <FormMessage tone="success">{`יש לכם עכשיו גישה ל${done}.`}</FormMessage>
        </div>
      )}

      <Button
        onClick={accept}
        loading={pending}
        fullWidth
        icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
      >
        {alreadyAccepted ? "כבר אישרתם — להיכנס לתיק" : "אישור הגישה"}
      </Button>
    </Card>
  );
}
