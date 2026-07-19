"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Pencil, X } from "lucide-react";
import { updateBusinessCard } from "@/lib/actions";
import { Card } from "@/components/ui";
import type { BusinessRow } from "@/lib/data";

interface FieldDef {
  key: keyof EditableFields;
  label: string;
  dir?: "ltr";
}

type EditableFields = {
  name: string;
  dealer_number: string;
  vat_file: string;
  income_tax_file: string;
  bituach_leumi_file: string;
  bank_name: string;
  bank_branch: string;
  bank_account: string;
  accountant_name: string;
  accountant_phone: string;
  accountant_email: string;
};

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "פרטי העסק",
    fields: [
      { key: "name", label: "שם העסק" },
      { key: "dealer_number", label: "מספר עוסק", dir: "ltr" },
    ],
  },
  {
    title: "תיקים ברשויות",
    fields: [
      { key: "vat_file", label: "תיק מע\"מ", dir: "ltr" },
      { key: "income_tax_file", label: "תיק מס הכנסה", dir: "ltr" },
      { key: "bituach_leumi_file", label: "תיק ביטוח לאומי", dir: "ltr" },
    ],
  },
  {
    title: "בנק",
    fields: [
      { key: "bank_name", label: "בנק" },
      { key: "bank_branch", label: "סניף", dir: "ltr" },
      { key: "bank_account", label: "מספר חשבון", dir: "ltr" },
    ],
  },
  {
    title: "רו\"ח / יועץ מס",
    fields: [
      { key: "accountant_name", label: "שם" },
      { key: "accountant_phone", label: "טלפון", dir: "ltr" },
      { key: "accountant_email", label: "אימייל", dir: "ltr" },
    ],
  },
];

export function BusinessCard({ business }: { business: BusinessRow }) {
  const initial: EditableFields = {
    name: business.name ?? "",
    dealer_number: business.dealer_number ?? "",
    vat_file: business.vat_file ?? "",
    income_tax_file: business.income_tax_file ?? "",
    bituach_leumi_file: business.bituach_leumi_file ?? "",
    bank_name: business.bank_name ?? "",
    bank_branch: business.bank_branch ?? "",
    bank_account: business.bank_account ?? "",
    accountant_name: business.accountant_name ?? "",
    accountant_phone: business.accountant_phone ?? "",
    accountant_email: business.accountant_email ?? "",
  };

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateBusinessCard(values);
      setEditing(false);
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setValues(initial);
                setEditing(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
              ביטול
            </button>
            <button
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
              שמירה
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-card px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-brand-strong"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            עריכת פרטים
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {SECTIONS.map((section) => (
          <Card key={section.title} className="overflow-hidden">
            <h2 className="border-b border-edge-soft bg-surface/60 px-5 py-3 text-sm font-bold text-ink-soft">
              {section.title}
            </h2>
            <div className="divide-y divide-edge-soft">
              {section.fields.map((field) => (
                <FieldRow
                  key={field.key}
                  label={field.label}
                  dir={field.dir}
                  value={values[field.key]}
                  editing={editing}
                  onChange={(v) =>
                    setValues((prev) => ({ ...prev, [field.key]: v }))
                  }
                />
              ))}
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-ink-faint">
        טיפ: אחרי שפותחים תיק ברשות — חוזרים לכאן ומזינים את מספר התיק. ככה
        כשהבנק, הרו"ח או לקוח מבקשים פרט — הוא אצלכם בקליק.
      </p>
    </div>
  );
}

function FieldRow({
  label,
  value,
  dir,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  dir?: "ltr";
  editing: boolean;
  onChange: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="w-32 shrink-0 text-sm text-ink-muted">{label}</span>
      {editing ? (
        <input
          value={value}
          dir={dir}
          onChange={(e) => onChange(e.target.value)}
          className={`min-w-0 flex-1 rounded-lg border border-edge px-3 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge ${dir === "ltr" ? "text-left" : ""}`}
        />
      ) : (
        <>
          <span
            dir={dir}
            className={`min-w-0 flex-1 truncate text-sm font-medium ${
              value ? "text-ink" : "text-ink-faint"
            } ${dir === "ltr" ? "text-left" : ""}`}
          >
            {value || "—"}
          </span>
          {value && (
            <button
              onClick={copy}
              aria-label={`העתקת ${label}`}
              className="shrink-0 rounded-lg p-1.5 text-ink-faint transition hover:bg-surface-2 hover:text-brand-strong"
            >
              {copied ? (
                <Check className="h-4 w-4 text-status-done" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
