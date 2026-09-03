import type {
  CompletionSpec,
  OfficialLink,
  Recurrence,
  TaskArchetype,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";
import type { GeneratedDoc } from "@/lib/documents/generators";

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
  guide?: string;
  pitfalls: string[];

  /** statutory = a real legal deadline; recommended = a suggestion. */
  basis: "statutory" | "recommended";
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
