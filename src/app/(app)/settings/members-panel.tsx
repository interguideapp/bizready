"use client";

import { useState, useTransition } from "react";
import { Copy, Check, UserPlus, Users, X } from "lucide-react";
import { inviteMember, revokeMember } from "@/lib/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FormMessage, Input, Select } from "@/components/form";
import { Button } from "@/components/primitives";
import { Card } from "@/components/ui";
import {
  MEMBER_STATE_LABEL,
  ROLE_EXPLAINER,
  ROLE_LABEL,
  memberState,
  type MemberRole,
  type MemberRow,
} from "@/lib/members";

/**
 * Who else can see this business.
 *
 * The accountant is the most important collaborator in Israeli compliance and
 * the product had no way to admit one, so the realistic alternative to this
 * panel is users sharing their password — which grants strictly more access
 * than any role here, with no record of who used it.
 */
export function MembersPanel({ members }: { members: MemberRow[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("accountant");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<MemberRow | null>(null);
  const [pending, startTransition] = useTransition();

  function invite() {
    setError(null);
    setInviteUrl(null);
    startTransition(async () => {
      const result = await inviteMember(email, role);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setInviteUrl(result.inviteUrl);
      setEmail("");
    });
  }

  function doRevoke() {
    const target = revoking;
    if (!target) return;
    startTransition(async () => {
      const result = await revokeMember(target.id);
      if (!result.ok) setError(result.error ?? "ההסרה נכשלה.");
      setRevoking(null);
    });
  }

  const live = members.filter((m) => memberState(m) !== "revoked");

  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-section text-ink">
        <Users className="h-4.5 w-4.5 text-brand-400" aria-hidden />
        גישה לרואה חשבון ולשותפים
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-ink-muted">
        אפשר לתת לרו״ח או ליועץ המס גישה לתיק בלי למסור סיסמה. הם יראו את
        המשימות והמועדים ויוכלו לסמן מה בוצע — בלי גישה למנוי או לפרטי הבנק.
      </p>

      {error && (
        <div className="mb-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}

      {/* The link is shown rather than mailed. A half-working mail path that
          silently drops invitations would be worse than handing the owner a
          link they can see, verify and pass on themselves. */}
      {inviteUrl && (
        <div className="mb-3 rounded-2xl border border-status-done/30 bg-status-done-bg/40 p-4">
          <p className="mb-2 text-sm font-semibold text-ink">
            ההזמנה נוצרה — שלחו את הקישור הזה
          </p>
          <div className="flex items-center gap-2">
            <code
              dir="ltr"
              className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-ink-soft"
            >
              {inviteUrl}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              aria-label="העתקת קישור ההזמנה"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-brand-strong"
            >
              {copied ? (
                <Check className="h-4 w-4 text-status-done" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            הקישור הוא האישור — מי שמחזיק בו יכול לאשר את הגישה, אז שלחו אותו רק
            למי שהתכוונתם.
          </p>
        </div>
      )}

      {/* ---- current access ---- */}
      {live.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {live.map((m) => {
            const state = memberState(m);
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border border-edge p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" dir="ltr">
                    {m.invited_email}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {ROLE_LABEL[m.role]} · {MEMBER_STATE_LABEL[state]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRevoking(m)}
                  aria-label={`הסרת הגישה של ${m.invited_email}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-status-overdue"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---- invite ---- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="אימייל" className="sm:flex-1">
          <Input
            type="email"
            value={email}
            dir="ltr"
            autoComplete="off"
            placeholder="cpa@example.com"
            onChange={(e) => setEmail(e.target.value)}
            className="text-start"
          />
        </Field>
        <Field label="תפקיד" className="sm:w-52" description={ROLE_EXPLAINER[role]}>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            options={[
              { value: "accountant", label: ROLE_LABEL.accountant },
              { value: "viewer", label: ROLE_LABEL.viewer },
            ]}
          />
        </Field>
        <Button
          onClick={invite}
          loading={pending}
          disabled={!email.trim()}
          icon={<UserPlus className="h-4 w-4" aria-hidden />}
        >
          הזמנה
        </Button>
      </div>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="להסיר את הגישה?"
        body={
          revoking
            ? `${revoking.invited_email} לא יראה יותר את תיק העסק. הרשומה נשמרת בהיסטוריה כדי שיישאר תיעוד של מי הייתה לו גישה ומתי.`
            : ""
        }
        confirmLabel="הסרה"
        destructive
        pending={pending}
        onConfirm={doRevoke}
      />
    </Card>
  );
}
