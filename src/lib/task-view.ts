import type {
  CompletionSpec,
  OfficialLink,
  Recurrence,
  TaskArchetype,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";
import type { GeneratedDoc } from "@/lib/documents/generators";
import type { LegalBasis } from "@/lib/content/legal-basis";
import type { ReviewAge } from "@/lib/staleness";

/** Serializable bundle the server page hands to the client TaskExperience. */
export interface TaskView {
  taskDbId: string;
  templateId: string;
  archetype: TaskArchetype;
  title: string;
  categoryTitle: string;
  categoryIcon: string;
  priority: TaskPriority;
  status: TaskStatus;

  why: string;
  steps: string[];
  /** indices of `steps` the user has ticked as done (live per-step progress). */
  stepsDone: number[];
  guide?: string;
  pitfalls: string[];
  /** What happens after you submit — the real bureaucratic follow-up. */
  afterSubmit: string | null;

  /** statutory = a real legal deadline; recommended = a suggestion. */
  basis: "statutory" | "recommended";
  /**
   * What kind of obligation this is — the answer to "who says I have to?".
   * Distinct from `basis` above, which is about the DATE: a task can be a
   * statutory duty with no statutory deadline (a company's annual fee), or
   * carry a recommended date for something no law requires at all.
   */
  legalBasis: LegalBasis;
  /** How old this template's legal review is. Drives the staleness notice. */
  reviewAge: ReviewAge;
  /** The single source the content was written from, when one is recorded. */
  sourceUrl: string | null;
  dueDate: string | null;
  obligation: {
    dueDate: string;
    periodLabel: string | null;
    ruleText: string;
    sourceUrl: string | null;
  } | null;
  recurrence: Recurrence;

  completion: CompletionSpec;
  completionData: Record<string, string>;
  completedAt: string | null;
  waitingFor: string | null;
  followUpDate: string | null;

  docsNeeded: string[];
  estCost?: string;
  estTime?: string;
  officialLinks: OfficialLink[];
  /** The single most important external link — the primary CTA target. */
  primaryLink: OfficialLink | null;

  offers: {
    id: string;
    title: string;
    description: string;
    ctaLabel: string;
    url: string | null;
    couponCode: string | null;
  }[];
  checklist: { id: string; label: string; done: boolean }[];
  notes: string;

  pro: boolean;
  /**
   * False for a viewer. The database blocks their writes either way (migration
   * 022), but a UI that offers a control which is guaranteed to fail is worse
   * than one that explains why it is absent.
   */
  canEdit: boolean;
  /** Shown when canEdit is false, so the absence is explained rather than odd. */
  readOnlyReason: string | null;
  businessName: string;
  dealerNumber: string | null;
  /** Titles of tasks this one unlocks — shown as a reward on completion. */
  unlocks: string[];

  // archetype-specific extras
  generator: { id: string; title: string; description: string; category: string } | null;
  generatedDoc: GeneratedDoc | null;
  /** osek-patur ceiling for the calculator archetype. */
  ceiling: number | null;
}
