import type { BusinessRow } from "@/lib/data";

export interface ProfileCheck {
  id: string;
  label: string;
  done: boolean;
  /** Where to complete it. */
  href: string;
}

export interface ProfileCompleteness {
  percent: number; // 0-100
  checks: ProfileCheck[];
}

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

/**
 * "דף עסקי מושלם" — how complete the business profile is.
 * Pure so it's testable; every check links to the place it gets fixed.
 */
export function computeProfileCompleteness(
  business: Pick<
    BusinessRow,
    | "name"
    | "dealer_number"
    | "vat_file"
    | "income_tax_file"
    | "bituach_leumi_file"
    | "bank_name"
    | "bank_account"
    | "accountant_name"
    | "accountant_phone"
    | "logo_path"
  >,
  counts: { products: number; documents: number }
): ProfileCompleteness {
  const checks: ProfileCheck[] = [
    /*
     * SEVEN OF THESE TEN POINTED AT "/business" -- the page the card itself is
     * on. So clicking them navigated to the URL already in the address bar and
     * nothing happened, under a line that promises "לחיצה על פריט חסר תיקח
     * אתכם ישר למקום שבו משלימים אותו".
     *
     * Reported by the user, who could see it immediately: "כשלוחצים על רובם לא
     * נפתח כלום". The three that worked were the ones pointing somewhere else.
     *
     * Each now addresses the field that completes it. business-card.tsx gives
     * every row that id, and reads the hash to open the card in edit mode with
     * that input focused -- otherwise the link would land you on a read-only
     * row and the promise still would not be kept.
     */
    { id: "name", label: "שם העסק", done: filled(business.name), href: "/business#field-name" },
    { id: "dealer", label: "מספר עוסק", done: filled(business.dealer_number), href: "/business#field-dealer_number" },
    { id: "vat", label: "תיק מע״מ", done: filled(business.vat_file), href: "/business#field-vat_file" },
    { id: "income-tax", label: "תיק מס הכנסה", done: filled(business.income_tax_file), href: "/business#field-income_tax_file" },
    { id: "bituach", label: "תיק ביטוח לאומי", done: filled(business.bituach_leumi_file), href: "/business#field-bituach_leumi_file" },
    {
      id: "bank",
      label: "פרטי בנק",
      done: filled(business.bank_name) && filled(business.bank_account),
      // The check needs both; the link lands on the first of the pair.
      href: "/business#field-bank_name",
    },
    {
      id: "accountant",
      label: "איש מקצוע מלווה (רו״ח / יועץ)",
      done: filled(business.accountant_name) || filled(business.accountant_phone),
      href: "/business#field-accountant_name",
    },
    { id: "logo", label: "לוגו", done: filled(business.logo_path), href: "/tasks/basic-branding" },
    { id: "pricing", label: "מחירון (לפחות פריט אחד)", done: counts.products > 0, href: "/tasks/pricing" },
    { id: "documents", label: "מסמך ראשון בארכיון", done: counts.documents > 0, href: "/documents" },
  ];

  const done = checks.filter((c) => c.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    checks,
  };
}
