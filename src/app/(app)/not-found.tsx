import Link from "next/link";
import { Compass } from "lucide-react";

/** Hebrew/RTL 404 — replaces Next's default English LTR page. */
export default function AppNotFound() {
  return (
    <div dir="rtl" className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="panel rounded-card w-full p-8">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-tint text-brand-strong">
          <Compass className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-title text-ink">הדף הזה לא קיים</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          ייתכן שהקישור שגוי, או שהמשימה שחיפשתם לא רלוונטית לעסק שלכם.
        </p>
        <Link
          href="/home"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          חזרה למסך הבית
        </Link>
      </div>
    </div>
  );
}
