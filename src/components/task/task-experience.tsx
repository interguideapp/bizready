"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Lightbulb,
  Paperclip,
} from "lucide-react";
import {
  Button,
  Card,
  Chip,
  ProgressRing,
  SegmentedControl,
} from "@/components/ui";
import { CategoryIcon } from "@/components/category-icon";
import { PriorityBadge } from "@/components/badges";
import { DueDateControl } from "@/components/due-date-editor";
import { StatusPicker, NotesEditor } from "@/components/task-controls";
import { TaskChecklist } from "@/components/task-checklist";
import { DocumentUpload } from "@/components/document-upload";
import { OfferCard } from "@/components/offer-card";
import { fadeUp, spring } from "@/lib/motion";
import type { TaskView } from "@/lib/task-view";
import { ArchetypeAction, archetypePrimaryCta } from "@/components/task/archetype-action";

export type Phase = "understand" | "act" | "finish";

const PHASE_LABELS: Record<Phase, string> = {
  understand: "להבין",
  act: "לפעול",
  finish: "לסגור",
};

export function TaskExperience({
  view,
  attachedDocs,
  docCategory,
}: {
  view: TaskView;
  attachedDocs: { id: string; name: string; url?: string }[];
  docCategory: string;
}) {
  const done = view.status === "done";
  const [phase, setPhase] = useState<Phase>(done ? "finish" : "understand");

  // progress: understanding is free; acting is half; done is full
  const progress =
    view.status === "done"
      ? 1
      : view.status === "in_progress" || view.status === "waiting"
        ? 0.5
        : phase === "act"
          ? 0.25
          : 0.08;

  const cta = archetypePrimaryCta(view);

  return (
    <div className="pb-24 md:pb-8">
      <Link
        href="/tasks"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-muted transition hover:text-ink"
      >
        <ArrowRight className="h-4 w-4" aria-hidden />
        כל המשימות
      </Link>

      {/* ---------- hero ---------- */}
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mb-5 flex items-start gap-4"
      >
        <ProgressRing value={progress} size={56} stroke={5}>
          {done ? (
            <Check className="h-5 w-5 text-status-done" aria-hidden />
          ) : (
            `${Math.round(progress * 100)}%`
          )}
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <CategoryIcon name={view.categoryIcon} className="h-3.5 w-3.5" />
            {view.categoryTitle}
          </div>
          <h1 className="text-title text-ink">{view.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={view.priority} />
            {!done && (
              <DueDateControl
                taskId={view.taskDbId}
                dueDate={view.obligation ? view.obligation.dueDate : view.dueDate}
                basis={view.basis}
              />
            )}
            {view.recurrence && (
              <Chip tone="neutral">
                {view.recurrence === "monthly"
                  ? "חודשי"
                  : view.recurrence === "bimonthly"
                    ? "דו-חודשי"
                    : "שנתי"}
              </Chip>
            )}
          </div>
        </div>
      </motion.header>

      {/* ---------- primary action ---------- */}
      {!done && (
        <div className="mb-5">
          {cta.href ? (
            <a href={cta.href} target="_blank" rel="noopener noreferrer">
              <Button size="lg" fullWidth icon={<ExternalLink className="h-4.5 w-4.5" aria-hidden />}>
                {cta.label}
              </Button>
            </a>
          ) : (
            <Button
              size="lg"
              fullWidth
              onClick={() => setPhase(cta.goTo ?? "act")}
              icon={<ArrowRight className="h-4.5 w-4.5" aria-hidden />}
            >
              {cta.label}
            </Button>
          )}
        </div>
      )}

      {/* ---------- phase switcher ---------- */}
      <div className="mb-4">
        <SegmentedControl<Phase>
          value={phase}
          onChange={setPhase}
          options={(["understand", "act", "finish"] as Phase[]).map((p) => ({
            value: p,
            label: PHASE_LABELS[p],
          }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {phase === "understand" && <UnderstandPhase view={view} />}
            {phase === "act" && (
              <ArchetypeAction
                view={view}
                attachedDocs={attachedDocs}
                docCategory={docCategory}
              />
            )}
            {phase === "finish" && <FinishPhase view={view} />}
          </motion.div>
        </div>

        {/* ---------- rail (desktop) / stacked (mobile) ---------- */}
        <aside className="flex flex-col gap-4">
          {(view.estCost || view.estTime) && (
            <Card className="p-4">
              {view.estCost && (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  <Banknote className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                  <span>
                    <b>עלות:</b> {view.estCost}
                  </span>
                </p>
              )}
              {view.estTime && (
                <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-soft">
                  <Clock className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                  <span>
                    <b>זמן:</b> {view.estTime}
                  </span>
                </p>
              )}
            </Card>
          )}

          {view.officialLinks.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 text-sm font-bold text-ink-soft">קישורים רשמיים</p>
              <div className="flex flex-col gap-1.5">
                {view.officialLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center justify-between gap-2 text-sm font-medium text-brand-strong hover:underline"
                  >
                    <span className="truncate">{link.label}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-faint group-hover:text-brand-500" aria-hidden />
                  </a>
                ))}
              </div>
            </Card>
          )}

          {view.offers.length > 0 && (
            <div className="flex flex-col gap-3">
              {view.offers.map((o) => (
                <OfferCard
                  key={o.id}
                  offer={{
                    id: o.id,
                    title: o.title,
                    description: o.description,
                    cta_label: o.ctaLabel,
                    url: o.url,
                    coupon_code: o.couponCode,
                    template_id: view.templateId,
                    category_id: null,
                    commission_type: null,
                    sort_order: 0,
                  }}
                />
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ---------- notes ---------- */}
      <section className="mt-8">
        <h2 className="mb-3 text-section text-ink">הערות שלי</h2>
        <NotesEditor taskId={view.taskDbId} initialNotes={view.notes} />
      </section>
    </div>
  );
}

// ---------- understand phase ----------

function UnderstandPhase({ view }: { view: TaskView }) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-section text-ink">
          <Lightbulb className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          למה זה חשוב
        </h2>
        <p className="leading-relaxed text-ink-soft">{view.why}</p>
      </section>

      {view.obligation && (
        <Card className="border-brand-edge bg-brand-tint/40 p-4">
          <p className="text-sm font-semibold text-ink">
            מועד חוקי הבא:{" "}
            {new Date(view.obligation.dueDate + "T00:00:00").toLocaleDateString("he-IL")}
            {view.obligation.periodLabel && (
              <span className="font-normal text-ink-muted"> · {view.obligation.periodLabel}</span>
            )}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{view.obligation.ruleText}</p>
          {view.obligation.sourceUrl && (
            <a
              href={view.obligation.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
            >
              מקור רשמי — רשות המסים
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </Card>
      )}

      {view.docsNeeded.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-section text-ink">
            <FileText className="h-4.5 w-4.5 text-brand-500" aria-hidden />
            מה להכין
          </h2>
          <Card className="divide-y divide-edge-soft">
            {view.docsNeeded.map((d) => (
              <p key={d} className="flex items-start gap-2.5 px-4 py-2.5 text-sm text-ink-soft">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                {d}
              </p>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

// ---------- finish phase ----------

function FinishPhase({ view }: { view: TaskView }) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4">
        <StatusPicker
          taskId={view.taskDbId}
          status={view.status}
          steps={view.steps}
          completion={view.completion}
          waitingFor={view.waitingFor}
          followUpDate={view.followUpDate}
        />
      </Card>

      {view.status === "done" && Object.keys(view.completionData).length > 0 && (
        <Card className="border-status-done/30 bg-status-done-bg/40 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-status-done">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            מה תועד בסיום
          </p>
          <dl className="grid gap-1.5 text-sm">
            {Object.entries(view.completionData).map(([k, v]) =>
              v ? (
                <div key={k} className="flex gap-2">
                  <dt className="text-ink-muted">
                    {view.completion.fields?.find((f) => f.key === k)?.label ?? k}:
                  </dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ) : null
            )}
          </dl>
          {view.completedAt && (
            <p className="mt-2 text-xs text-ink-muted">
              הושלם ב-{new Date(view.completedAt).toLocaleDateString("he-IL")}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
