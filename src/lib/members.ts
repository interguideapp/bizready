/**
 * Collaborators on a business — in practice, the accountant.
 *
 * The product had one `businesses` row per owner, no roles and no invitations.
 * The accountant is the single most important collaborator in Israeli
 * compliance: they file the מע"מ returns, they hold the books, the deadlines
 * are functionally theirs. With no way to give them access, users share their
 * password — which is a worse outcome than any access model we could design.
 *
 * Roles, and the reasoning behind the split:
 *
 *   owner       signed up, owns the data, controls billing and the member list.
 *               Represented by `businesses.owner_id`, deliberately NOT by a
 *               membership row, so ownership cannot be revoked by deleting one.
 *   accountant  read everything, complete tasks, upload evidence. The person
 *               actually doing the filing needs to be able to record that it
 *               was filed.
 *   viewer      read only. A partner, a spouse, a prospective buyer.
 *
 * What no collaborator can do, enforced in the database rather than here:
 * change subscription state (migration 019's trigger blocks every session), or
 * edit the business card — which holds the bank account, and is the owner's.
 */

export type MemberRole = "accountant" | "viewer";

/** Includes the implicit owner, which is why it is a superset of MemberRole. */
export type EffectiveRole = "owner" | MemberRole;

export const ROLE_LABEL: Record<EffectiveRole, string> = {
  owner: "בעל העסק",
  accountant: 'רו"ח / יועץ מס',
  viewer: "צפייה בלבד",
};

export const ROLE_EXPLAINER: Record<MemberRole, string> = {
  accountant:
    "רואה הכול, יכול לסמן משימות כבוצעו ולהעלות אסמכתאות. לא יכול לשנות את כרטיס העסק, את פרטי הבנק או את המנוי.",
  viewer: "רואה הכול ולא משנה כלום. מתאים לשותף, לבן/בת זוג או לבדיקת נאותות.",
};

export interface MemberRow {
  id: string;
  business_id: string;
  user_id: string | null;
  invited_email: string;
  role: MemberRole;
  invited_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

/** What a member row currently is, for display. */
export type MemberState = "invited" | "active" | "revoked";

export function memberState(row: MemberRow): MemberState {
  if (row.revoked_at) return "revoked";
  return row.accepted_at ? "active" : "invited";
}

export const MEMBER_STATE_LABEL: Record<MemberState, string> = {
  invited: "הוזמן — ממתין לאישור",
  active: "פעיל",
  revoked: "הוסר",
};

/**
 * What a given role may do. The single place this is decided in application
 * code; the database enforces the same split independently, so a bug here
 * cannot become a data breach.
 */
export interface Capabilities {
  read: boolean;
  /** Complete tasks, upload evidence, tick checklist items. */
  completeTasks: boolean;
  /** Edit the business card: tax file numbers, bank details, accountant contact. */
  editBusinessCard: boolean;
  /** Change answers and recalibrate the plan. */
  recalibrate: boolean;
  /** Invite, revoke, change roles. */
  manageMembers: boolean;
  /** Subscribe, cancel, see invoices. */
  manageBilling: boolean;
  /** Export everything, delete the account. */
  managePrivacy: boolean;
}

export function capabilitiesFor(role: EffectiveRole): Capabilities {
  switch (role) {
    case "owner":
      return {
        read: true,
        completeTasks: true,
        editBusinessCard: true,
        recalibrate: true,
        manageMembers: true,
        manageBilling: true,
        managePrivacy: true,
      };
    case "accountant":
      return {
        read: true,
        completeTasks: true,
        // The business card holds the bank account. An accountant reads it —
        // they need it — but changing it is the owner's decision.
        editBusinessCard: false,
        // Recalibrating rewrites the whole plan. That is a decision about the
        // business, not a filing action.
        recalibrate: false,
        manageMembers: false,
        manageBilling: false,
        // Exporting everything and deleting the account are rights of the data
        // subject, not services an advisor performs on their behalf.
        managePrivacy: false,
      };
    case "viewer":
      return {
        read: true,
        completeTasks: false,
        editBusinessCard: false,
        recalibrate: false,
        manageMembers: false,
        manageBilling: false,
        managePrivacy: false,
      };
  }
}

/**
 * Normalises an invited email for comparison and for the uniqueness index.
 *
 * Lowercased and trimmed only. Deliberately NOT stripping dots or +suffixes:
 * those are provider-specific conventions, and treating a+b@gmail.com as
 * a@gmail.com would silently redirect an invitation to a different inbox than
 * the owner typed.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Shape check for an invited address. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(email));
}
