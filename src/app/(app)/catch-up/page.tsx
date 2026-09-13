import { ClipboardCheck, Lock } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { requireBusiness, getBusinessTasks } from "@/lib/data";
import { CATEGORIES, TEMPLATES_BY_ID } from "@/lib/content";
import { catchUpItems, statutoryHeldBack } from "@/lib/catch-up";
import { CatchUpForm } from "./catch-up-form";

/**
 * ריענון התכנית — "what does the business already have?", asked again.
 *
 * Onboarding asks this once, from a curated list of eighteen options, and
 * `already_done` is then read exactly once: at plan-build time. After that
 * there was no catch-up pass at all, so a business that existed before signing
 * up, or an owner who spent three months getting things done without opening
 * the app, had to walk the plan task by task — while the readiness score, the
 * exposure ranking and every alert were computed from a picture the product
 * knew was stale.
 *
 * Statutory filings are listed but not offerable, and the page says why. Hiding
 * them would read as "these do not apply to you", which is the opposite of
 * true, and offering them would let a tick silence a penalty-bearing alarm for
 * a filing nobody made.
 */
export default async function CatchUpPage() {
  const business = await requireBusiness();
  const tasks = await getBusinessTasks(business.id);

  const items = catchUpItems(tasks, TEMPLATES_BY_ID);
  const held = statutoryHeldBack(tasks, TEMPLATES_BY_ID);

  // Grouped in the product's own category order, so the list reads like the
  // plan rather than like a database dump.
  const groups = CATEGORIES.map((category) => ({
    categoryId: category.id,
    title: category.title,
    items: items.filter((i) => i.categoryId === category.id),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <PageTitle
        eyebrow="ריענון"
        title="מה כבר קיים בעסק?"
        subtitle="סמנו מה שכבר טופל — התכנית, הציון וההתראות יחושבו מחדש לפי המצב האמיתי"
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" aria-hidden />}
            title="אין מה לרענן כרגע"
            subtitle="כל המשימות שאפשר לסמן כאן כבר סגורות או סומנו כלא רלוונטיות. חובות ההגשה עצמן נסגרות במסך המשימה, עם הראיות."
          />
        </Card>
      ) : (
        <CatchUpForm groups={groups} />
      )}

      {held.length > 0 && (
        <Card className="mt-5 p-4">
          <h2 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-ink-soft">
            <Lock className="h-4 w-4 text-ink-faint" aria-hidden />
            {held.length === 1 ? "חובת הגשה אחת לא מופיעה כאן" : `${held.length} חובות הגשה לא מופיעות כאן`}
          </h2>
          <p className="mb-2.5 text-xs leading-relaxed text-ink-muted">
            {/*
              Said rather than hidden. An omission reads as "does not apply to
              you", and these carry penalties — so the reason is stated, and it
              is a real reason: closing one records evidence into the audit
              trail, which a tick on a list cannot do.
            */}
            דיווח והגשה נסגרים במסך המשימה עצמה, כדי שהאישור או האסמכתא יישמרו
            בתיק. סימון מכאן היה מכבה התראת איחור בלי שום ראיה מאחוריה.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {held.map((h) => (
              <li
                key={h.templateId}
                className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-ink-muted"
              >
                {h.title}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
