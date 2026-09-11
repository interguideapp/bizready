"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Error boundary for the whole authenticated app.
 *
 * The critical rule: when we cannot read the user's data we must NOT imply
 * everything is fine. Before this existed, a failed read returned an empty
 * list and every screen rendered "you're all clear" — or, where a page
 * asserted the business row was non-null, Next's default English LTR error
 * page appeared inside a Hebrew product.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error:", error.message, error.digest ?? "");
  }, [error]);

  const isDataUnavailable = error.name === "DataUnavailableError";

  return (
    <div dir="rtl" className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="panel rounded-card w-full p-8">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-overdue-bg text-status-overdue">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </span>

        <h1 className="text-title text-ink">
          {isDataUnavailable ? "לא הצלחנו לאמת את המצב שלכם" : "לא הצלחנו לטעון את הדף"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {isDataUnavailable ? (
            <>
              הנתונים שלכם לא נטענו כרגע, ולכן <b className="text-ink">אנחנו לא יכולים להגיד לכם שהכול תקין</b>.
              זו תקלה טכנית אצלנו — לא שינוי במצב העסק שלכם. נסו לרענן; אם זה חוזר, המידע שלכם נשמר במקומו.
            </>
          ) : (
            <>נתקלנו בתקלה בהצגת המסך הזה. הנתונים שלכם לא נפגעו.</>
          )}
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          לנסות שוב
        </button>
      </div>
    </div>
  );
}
