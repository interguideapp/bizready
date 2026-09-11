"use client";

import { useState, useTransition } from "react";
import { Download, Trash2, TriangleAlert } from "lucide-react";
import { deleteMyAccount } from "@/lib/actions";
import { Field, FormMessage, Input } from "@/components/form";
import { Button } from "@/components/primitives";
import { Card } from "@/components/ui";

/**
 * The user's own privacy rights: take your data, or delete the account.
 *
 * The product teaches these rights in a critical, statute-backed task about
 * תיקון 13 and implemented neither. Putting them in settings — not buried in a
 * help page — is the point: a right you cannot find is not a right.
 */
export function PrivacyControls({ email }: { email: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      // On success this redirects and never returns.
      const result = await deleteMyAccount(typed);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-section text-ink">הנתונים שלכם</h2>
      <p className="mb-4 text-sm leading-relaxed text-ink-muted">
        אלה הזכויות שאנחנו מסבירים לכם לתת ללקוחות שלכם — אז הן קיימות גם כאן,
        בלי לפנות לתמיכה.
      </p>

      <div className="flex flex-col gap-3">
        {/* ---- export ---- */}
        <div className="rounded-2xl border border-edge p-4">
          <p className="mb-1 text-sm font-semibold text-ink">ייצוא כל הנתונים</p>
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">
            קובץ JSON עם כל מה ששמור אצלנו: פרטי העסק ומספרי התיקים, המשימות
            וההיסטוריה שלהן, המסמכים, העלויות, וגם נתוני הלקוחות שסונכרנו מתוכנת
            החשבוניות — אתם בעלי השליטה בהם. פרטי התחברות לספקים לא מיוצאים; הם
            נשמרים מוצפנים.
          </p>
          {/* A real navigation, not a scripted download: the route sets
              Content-Disposition and the browser handles it. */}
          <a
            href="/api/privacy/export"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge bg-card px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand-edge hover:text-brand-strong"
          >
            <Download className="h-4 w-4" aria-hidden />
            הורדת הנתונים
          </a>
        </div>

        {/* ---- deletion ---- */}
        <div className="rounded-2xl border border-status-overdue/30 bg-status-overdue-bg/30 p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
            <TriangleAlert className="h-4 w-4 shrink-0 text-status-overdue" aria-hidden />
            מחיקת החשבון
          </p>
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">
            מוחק לצמיתות את החשבון, התכנית, ההיסטוריה, ההתראות וכל הקבצים
            שהעליתם — כולל אישורים ומסמכים שסרקתם. אין ביטול ואין שחזור. שווה
            להוריד קודם את הנתונים.
          </p>

          {!confirming ? (
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
              onClick={() => setConfirming(true)}
            >
              אני רוצה למחוק את החשבון
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              {error && <FormMessage tone="error">{error}</FormMessage>}
              {/* Typing the account's own email is the gate. A Server Action is
                  a public POST endpoint, and this destroys uploaded tax
                  documents with no undo — one stray request must not be enough. */}
              <Field
                label="לאישור, הקלידו את כתובת האימייל של החשבון"
                description={email ? `הכתובת של החשבון: ${email}` : undefined}
                error={error ? " " : null}
              >
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  dir="ltr"
                  autoComplete="off"
                  placeholder="you@example.com"
                  className="text-start"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  loading={pending}
                  disabled={!typed.trim()}
                  icon={<Trash2 className="h-4 w-4" aria-hidden />}
                  onClick={remove}
                >
                  מחיקה לצמיתות
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setConfirming(false);
                    setTyped("");
                    setError(null);
                  }}
                >
                  ביטול
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
