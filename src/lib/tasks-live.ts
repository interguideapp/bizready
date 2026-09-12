import { cache } from "react";
import { TEMPLATES_BY_ID } from "@/lib/content";
import { projectCycles, type OpenCycle } from "@/lib/cycles";
import { getBusinessTasks, getFiledPeriods, type BusinessRow } from "@/lib/data";
import type { ComplianceProfile } from "@/lib/compliance";
import type { BusinessTask, OnboardingAnswers } from "@/lib/types";

export type LiveTask = BusinessTask & { cycle?: OpenCycle };

/**
 * The business's tasks as they actually stand right now.
 *
 * One loader, for the same reason loadAttention is one loader: every surface
 * has to be looking at the same tasks. `business_tasks` holds what was last
 * written, and for a recurring duty that is not the same as what is true — a
 * VAT report filed for Jul–Aug stayed `done` until the nightly sweep decided
 * otherwise, so with the sweep not running the task list said "בוצע" while the
 * obligations board (which computes dates itself) showed the next period. Two
 * answers about one penalty-bearing duty.
 *
 * cycles.ts decides; this only supplies it with the ledger and the business's
 * real reporting frequency. Nothing is written back: the sweep persists the
 * identical conclusion when it runs, because it calls the same function.
 *
 * Memoised per request on top of two already-memoised reads, so a layout and
 * the page under it cost one pair of queries between them.
 */
export const loadLiveTasks = cache(async function loadLiveTasks(
  business: BusinessRow
): Promise<LiveTask[]> {
  const [tasks, filedPeriods] = await Promise.all([
    getBusinessTasks(business.id),
    getFiledPeriods(business.id),
  ]);
  return projectCycles(tasks, {
    templates: TEMPLATES_BY_ID,
    today: new Date(),
    profile: profileOf(business),
    filedPeriods,
  });
});

/** The facts the cycle decision needs about the business. */
export function profileOf(business: BusinessRow): ComplianceProfile {
  const answers = business.onboarding_answers as OnboardingAnswers | null;
  return {
    entityType: business.entity_type,
    vatFrequency: answers?.vat_frequency,
    hasAccountant: Boolean(business.accountant_name),
  };
}
