import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  FileClock,
  HelpCircle,
  Hourglass,
  Landmark,
  Receipt,
  RefreshCw,
  Users,
} from "lucide-react";
import { MarkPeriodFiled } from "@/components/mark-period-filed";
import { Card, InfoPopover } from "@/components/ui";
import type { Obligation, ObligationKind } from "@/lib/compliance";

/**
 * The obligations board, as presentation.
 *
 * Extracted from the page so it can be rendered and asserted. These sections
 * carry the decisions that matter most on this screen — what is late, what has
 * not started, and what the user set for themselves — and while they lived
 * inline in a server component the only way to check any of it was to read the
 * source and hope.
 *
 * Everything here takes resolved data. No queries, no engines: the page decides
 * what is true and these decide how it reads.
 */

const KIND_META: Record<ObligationKind, { label: string; icon: React.ReactNode }> = {
  vat: { label: "דיווח מע\"מ", icon: <Receipt className="h-4 w-4" aria-hidden /> },
  advances: { label: "מקדמות מס", icon: <Landmark className="h-4 w-4" aria-hidden /> },
  annual_report: { label: "דוח שנתי", icon: <Landmark className="h-4 w-4" aria-hidden /> },
  employer_deductions: { label: "ניכויים (102)", icon: <Users className="h-4 w-4" aria-hidden /> },
  registrar_fee: { label: "אגרה שנתית", icon: <Landmark className="h-4 w-4" aria-hidden /> },
  renewal: { label: "חידוש", icon: <RefreshCw className="h-4 w-4" aria-hidden /> },
  document_expiry: { label: "תפוגת מסמך", icon: <FileClock className="h-4 w-4" aria-hidden /> },
};

/**
 * How late, in words a person would use.
 *
 * "עבר המועד" was the same string whether a filing was five days late or a
 * hundred and sixty-five, which read as equally urgent and is not. Past a
 * couple of months the day count stops being meaningful and the month count
 * starts, so it switches.
 */
function lateLabel(days: number): string {
  if (days <= 1) return "באיחור יום";
  // Hebrew has a dual form, and "2 ימים" / "כ-2 חודשים" is exactly the
  // translated-from-English texture the product has been clearing out.
  if (days === 2) return "באיחור יומיים";
  if (days < 60) return `באיחור ${days} ימים`;
  const months = Math.floor(days / 30);
  if (months >= 12) return "באיחור למעלה משנה";
  if (months === 2) return "באיחור כחודשיים";
  return `באיחור כ-${months} חודשים`;
}

export function ObligationRow({
  ob,
  canEdit = false,
}: {
  ob: Obligation;
  canEdit?: boolean;
}) {
  const meta = KIND_META[ob.kind];
  const overdue = ob.daysUntil < 0;
  const soon = ob.daysUntil >= 0 && ob.daysUntil <= 7;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            overdue ? "bg-status-overdue-bg text-status-overdue" : "bg-brand-tint text-brand-strong"
          }`}
        >
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-ink">{ob.title}</p>
          <p className="text-xs text-ink-muted">
            {meta.label}
            {ob.periodLabel && (
              <>
                {" · "}
                <span className="text-ink-soft">{ob.periodLabel}</span>
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-sm font-semibold text-ink">
            {new Date(ob.dueDate + "T00:00:00").toLocaleDateString("he-IL")}
          </p>
          <p
            className={`text-xs font-medium ${
              overdue ? "text-status-overdue" : soon ? "text-status-progress" : "text-ink-muted"
            }`}
          >
            {overdue ? (
              <span className="inline-flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {lateLabel(-ob.daysUntil)}
              </span>
            ) : ob.daysUntil === 0 ? (
              "היום"
            ) : (
              `בעוד ${ob.daysUntil} ימים`
            )}
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-3 ps-12">
        {/* Why is this the date? The product's whole claim is that the
            reasoning is visible, so it travels with every row. */}
        <InfoPopover
          trigger={
            <button className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-muted outline-none transition hover:text-brand-strong">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
              למה התאריך הזה?
            </button>
          }
        >
          {ob.ruleText}
          {ob.sourceUrl && (
            <a
              href={ob.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-1 mt-2 inline-flex items-center gap-0.5 font-medium text-brand-strong hover:underline"
            >
              מקור רשמי
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </InfoPopover>

        {/* A named missed period has to be clearable, or it is an alarm with no
            off switch. Only offered where the database will accept the write. */}
        {canEdit && ob.periodKey && ob.templateId && (
          <span className="rounded-lg border border-edge bg-surface/60">
            <MarkPeriodFiled
              templateId={ob.templateId}
              periodKey={ob.periodKey}
              periodLabel={ob.periodLabel}
            />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * What is already late.
 *
 * First on the page and never behind the paywall. Being late is not a premium
 * feature, and grouping these into the month timeline buried the one thing here
 * that costs money every day it is ignored.
 */
export function OverdueSection({
  overdue,
  canEdit,
}: {
  overdue: Obligation[];
  canEdit: boolean;
}) {
  if (overdue.length === 0) return null;
  return (
    <div className="mb-5 rounded-2xl border border-status-overdue/40 bg-status-overdue/5 p-4">
      <h2 className="mb-1 flex items-center gap-2 text-section text-status-overdue">
        <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
        {overdue.length === 1
          ? "חובה אחת עברה את המועד"
          : `${overdue.length} חובות עברו את המועד`}
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-ink-soft">
        איחור בדיווח או בתשלום צובר ריבית והצמדה מהיום הראשון. כדאי לטפל בזה
        לפני כל השאר.
      </p>
      <Card className="divide-y divide-edge-soft">
        {overdue.map((ob) => (
          <ObligationRow key={ob.id} ob={ob} canEdit={canEdit} />
        ))}
      </Card>
    </div>
  );
}

export interface PendingFilingView {
  templateId: string;
  title: string;
  awaitingId: string;
  awaitingTitle: string;
}

/**
 * Duties that exist but have not started.
 *
 * Named without a date, because there is no honest date to give until the
 * prerequisite is done. Without this section the board could show nothing at
 * all to a new עוסק and read as "you have no obligations" — the single most
 * consequential thing this product could fail to say.
 */
export function PendingFilingsSection({ pending }: { pending: PendingFilingView[] }) {
  if (pending.length === 0) return null;
  return (
    <Card className="mb-5 p-4">
      <h2 className="mb-1 flex items-center gap-2 text-section text-ink">
        <Hourglass className="h-4.5 w-4.5 text-brand-400" aria-hidden />
        חובות שיתחילו בהמשך
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-ink-soft">
        אלה חובות חוקיות שחלות על העסק שלכם, אבל טרם התחילו — ולכן אין להן עדיין
        תאריך. ברגע שתסיימו את המשימה שפותחת אותן, הן יופיעו כאן עם מועד מדויק.
      </p>
      <ul className="flex flex-col gap-2">
        {pending.map((f) => (
          <li key={f.templateId} className="text-sm">
            <Link
              href={`/tasks/${f.templateId}?from=calendar`}
              className="font-medium text-ink hover:text-brand-strong"
            >
              {f.title}
            </Link>
            <span className="text-ink-muted">
              {" — ממתין ל"}
              <Link
                href={`/tasks/${f.awaitingId}?from=calendar`}
                className="font-medium text-brand-strong hover:underline"
              >
                {f.awaitingTitle}
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export interface PersonalTargetView {
  templateId: string;
  title: string;
  date: string;
}

/**
 * The dates the user set for themselves.
 *
 * Kept visibly separate from the statutory rows, because a target you chose and
 * a date the law fixed are not the same kind of fact and must never read as one.
 */
export function PersonalTargetsSection({ targets }: { targets: PersonalTargetView[] }) {
  if (targets.length === 0) return null;
  return (
    <Card className="mb-5 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-section text-ink">
        <CalendarClock className="h-4.5 w-4.5 text-brand-400" aria-hidden />
        היעדים שקבעתם לעצמכם
      </h2>
      <ul className="flex flex-col gap-1.5">
        {targets.map((t) => (
          <li
            key={t.templateId}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <Link
              href={`/tasks/${t.templateId}?from=calendar`}
              className="truncate font-medium text-ink hover:text-brand-strong"
            >
              {t.title}
            </Link>
            <span className="tnum shrink-0 text-xs text-ink-muted">
              {new Date(t.date + "T00:00:00").toLocaleDateString("he-IL")}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
