import { aheadLabel, lapsedLabel, lateLabel } from "@/lib/he-distance";
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
  ShieldAlert,
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

export function ObligationRow({
  ob,
  canEdit = false,
}: {
  ob: Obligation;
  canEdit?: boolean;
}) {
  const meta = KIND_META[ob.kind];
  // STYLED BY BASIS, NOT ONLY BY BEING PAST DUE.
  //
  // A row went red the moment its date passed, whatever kind of date it was —
  // so an expired insurance policy wore the same alarm as a missed VAT period,
  // right underneath copy explaining that no interest is accruing on it. The
  // consequence differs, so the colour and the wording do too.
  const pastDue = ob.daysUntil < 0;
  const overdue = pastDue && ob.basis === "statutory";
  const lapsed = pastDue && ob.basis !== "statutory";
  const soon = ob.daysUntil >= 0 && ob.daysUntil <= 7;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            overdue
              ? "bg-status-overdue-bg text-status-overdue"
              : lapsed
                ? "bg-status-progress-bg text-status-progress"
                : "bg-brand-tint text-brand-strong"
          }`}
        >
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          {/* THE ROW LEADS SOMEWHERE.
              This page lists everything the business owes and not one row was
              clickable: the title was a <p>. So the screen that tells you what
              is late offered no way to go and do it — you had to find the task
              yourself in a different list. /insights already linked its rows
              this way; the board, which is the page that matters most, did not.
              An expiry has no task, so that row stays plain rather than
              pretending to be a link. */}
          {ob.templateId ? (
            <Link
              href={`/tasks/${ob.templateId}?from=calendar`}
              className="text-sm font-medium leading-snug text-ink hover:text-brand-strong hover:underline"
            >
              {ob.title}
            </Link>
          ) : (
            <p className="text-sm font-medium leading-snug text-ink">{ob.title}</p>
          )}
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
              overdue
                ? "text-status-overdue"
                : lapsed || soon
                  ? "text-status-progress"
                  : "text-ink-muted"
            }`}
          >
            {overdue ? (
              <span className="inline-flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {lateLabel(-ob.daysUntil)}
              </span>
            ) : lapsed ? (
              <span className="inline-flex items-center gap-0.5">
                <ShieldAlert className="h-3 w-3" aria-hidden />
                {lapsedLabel(-ob.daysUntil)}
              </span>
            ) : (
              aheadLabel(ob.daysUntil)
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

/**
 * Cover that has run out.
 *
 * Split out of OverdueSection, which says "איחור בדיווח או בתשלום צובר ריבית
 * והצמדה מהיום הראשון". That is true of a VAT period and false of an expired
 * professional-liability policy: no authority charges interest on it, and for
 * most professions it is not a legal duty at all. Overclaiming legal
 * consequence is the one thing this product must never do.
 *
 * The real consequence is stated instead — there is no cover, and a client or
 * an authority asking for a valid certificate cannot be given one — and it is
 * still placed high, because an uninsured day is not a small thing either.
 */
export function LapsedSection({ lapsed }: { lapsed: Obligation[] }) {
  if (lapsed.length === 0) return null;
  return (
    <div className="mb-5 rounded-2xl border border-status-progress/40 bg-status-progress/5 p-4">
      <h2 className="mb-1 flex items-start gap-2 text-section text-status-progress">
        <ShieldAlert className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden />
        {lapsed.length === 1 ? "תוקף אחד פג" : `${lapsed.length} תוקפים פגו`}
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-ink-soft">
        אין כאן קנס וריבית — אבל גם אין כיסוי. כל יום עד החידוש הוא יום שבו לא
        תוכלו להציג אישור בתוקף, ואם יקרה משהו, אין מי שיכסה אותו.
      </p>
      <Card className="divide-y divide-edge-soft">
        {lapsed.map((ob) => (
          <ObligationRow key={ob.id} ob={ob} />
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
