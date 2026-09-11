"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Pencil, X } from "lucide-react";
import { updateBusinessCard } from "@/lib/actions";
import { toast } from "@/components/toaster";
import { Card } from "@/components/ui";
import { Field, FormMessage, Input } from "@/components/form";
import { Button } from "@/components/primitives";
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setSaveError(null);
    startTransition(async () => {
      // These are tax-file and bank identifiers. "It looked like it saved" is
      // not an acceptable outcome, so the result is checked and surfaced.
      const result = await updateBusinessCard(values);
      if (!result?.ok) {
        setSaveError(result?.error ?? "השמירה לא עברה. נסו שוב.");
        return;
      }
      setEditing(false);
      toast.success("הפרטים נשמרו");
    });
  }

  return (
    <div>
      {/* The failure message belongs next to the form, not in a toast that has
          already faded. These are tax-file and bank identifiers. */}
      {saveError && (
        <div className="mb-4">
          <FormMessage tone="error">{saveError}</FormMessage>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              icon={<X className="h-4 w-4" aria-hidden />}
              onClick={() => {
                setValues(initial);
                setSaveError(null);
                setEditing(false);
              }}
            >
              ביטול
            </Button>
            <Button
              onClick={save}
              loading={pending}
              icon={<Check className="h-4 w-4" aria-hidden />}
            >
              שמירה
            </Button>
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

  // In edit mode this is a real labelled input. It used to be a bare <span>
  // beside a bare <input>, with no htmlFor and no id — eleven unlabelled text
  // boxes for the user's VAT file, income-tax file, national-insurance file and
  // bank account.
  if (editing) {
    return (
      <div className="px-5 py-3">
        <Field label={label} className="sm:flex-row sm:items-center sm:gap-3">
          <Input
            value={value}
            dir={dir}
            onChange={(e) => onChange(e.target.value)}
            // Logical property, so the alignment follows the field's own
            // direction instead of hardcoding "left".
            className={dir === "ltr" ? "text-start" : undefined}
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="w-32 shrink-0 text-sm text-ink-muted">{label}</span>
      <span
        dir={dir}
        // text-start, not text-left: the value follows its own direction rather
        // than being pinned to a physical side.
        className={`min-w-0 flex-1 truncate text-sm font-medium ${
          value ? "text-ink" : "text-ink-muted"
        } ${dir === "ltr" ? "text-start" : ""}`}
      >
        {value || "—"}
      </span>
      {value && (
        <button
          onClick={copy}
          aria-label={`העתקת ${label}`}
          // 44px minimum hit area: this was a 26px target, one of ~35 controls
          // in the app that were under the minimum.
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-brand-strong"
        >
          {copied ? (
            <Check className="h-4 w-4 text-status-done" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
