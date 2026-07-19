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
    { id: "name", label: "שם העסק", done: filled(business.name), href: "/business" },
    { id: "dealer", label: "מספר עוסק", done: filled(business.dealer_number), href: "/business" },
    { id: "vat", label: "תיק מע\"מ", done: filled(business.vat_file), href: "/business" },
    { id: "income-tax", label: "תיק מס הכנסה", done: filled(business.income_tax_file), href: "/business" },
    { id: "bituach", label: "תיק ביטוח לאומי", done: filled(business.bituach_leumi_file), href: "/business" },
    {
      id: "bank",
      label: "פרטי בנק",
      done: filled(business.bank_name) && filled(business.bank_account),
      href: "/business",
    },
    {
      id: "accountant",
      label: "איש מקצוע מלווה (רו\"ח / יועץ)",
      done: filled(business.accountant_name) || filled(business.accountant_phone),
      href: "/business",
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
