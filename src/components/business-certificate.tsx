import Link from "next/link";
import { ArrowLeft, BadgeCheck, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui";
import { formatHeMoment } from "@/lib/dates";
import { TASK_FORMS, countLabel } from "@/lib/he-distance";
import type { Certificate } from "@/lib/certificate";

/**
 * THE BUSINESS CARD AS A CERTIFICATE.
 *
 * Every artefact the business recorded when it closed a task, under the words
 * it was asked for, newest first — derived from the tasks' own
 * `completion_data`, never a second copy of it (see lib/certificate.ts).
 *
 * The tasks that recorded nothing are named rather than hidden, because a
 * certificate that silently omitted most of the work would read as complete
 * while proving very little.
 */
export function BusinessCertificate({ certificate }: { certificate: Certificate }) {
  const { entries, captureless, recorded } = certificate;

  if (entries.length === 0 && captureless.length === 0) return null;

  return (
    <Card className="mt-5 p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold text-ink">
        <BadgeCheck className="h-4.5 w-4.5 text-brand-500" aria-hidden />
        מה שכבר הושג
      </h2>
      <p className="mb-4 text-sm text-ink-muted">
        {recorded > 0
          ? "כל פרט שרשמתם בסיום משימה — מספרי תיקים, אישורים, כתובות ותאריכים — נאסף לכאן אוטומטית"
          : "כאן ייאספו הפרטים שתרשמו בסיום משימות — מספרי תיקים, אישורים וכתובות"}
      </p>

      {entries.length > 0 && (
        <ul className="grid gap-3">
          {entries.map((entry) => (
            <li key={entry.templateId} className="rounded-lg border border-edge bg-card p-3.5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link
                  href={"/tasks/" + entry.templateId}
                  className="group flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-brand-strong"
                >
                  {entry.title}
                  <ArrowLeft
                    className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
                {entry.completedAt && (
                  <span className="text-xs text-ink-muted">
                    הושלם ב־{formatHeMoment(entry.completedAt)}
                  </span>
                )}
              </div>
              <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {entry.items.map((item) => (
                  <div key={item.key} className="min-w-0">
                    <dt className="text-xs text-ink-muted">{item.label}</dt>
                    <dd className="text-sm font-medium text-ink">
                      {item.type === "url" ? (
                        <a
                          href={item.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="ltr"
                          className="inline-flex items-center gap-1 break-all text-brand-strong hover:underline"
                        >
                          {item.value}
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                        </a>
                      ) : (
                        // A Latin-digit reference inside an RTL line reorders
                        // as it renders, so identifiers and dates are LTR —
                        // the same rule the business card already follows.
                        <span dir={item.type && item.type !== "text" ? "ltr" : undefined} className="break-all">
                          {item.value}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}

      {captureless.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-ink-muted hover:text-ink-soft">
            {captureless.length === 1
              ? countLabel(1, TASK_FORMS) + " הושלמה בלי פרט שנרשם"
              : countLabel(captureless.length, TASK_FORMS) + " הושלמו בלי פרט שנרשם"}
          </summary>
          <ul className="mt-2 grid gap-1">
            {captureless.map((c) => (
              <li key={c.templateId}>
                <Link
                  href={"/tasks/" + c.templateId}
                  className="text-ink-soft hover:text-brand-strong"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
