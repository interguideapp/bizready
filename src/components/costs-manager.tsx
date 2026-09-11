"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { addCost, deleteCost } from "@/lib/actions";
import { toast } from "@/components/toaster";
import { Button, Card } from "@/components/ui";
import { Table, type Column } from "@/components/table";
import { CADENCE_LABEL, monthlyTotal, annualTotal, type CostRow, type Cadence } from "@/lib/costs";
import { formatIlsRounded } from "@/lib/money";

// One formatter for the whole app — see lib/money.ts. Rounded here because
// these are aggregates and chart labels, where agorot are noise.
const nis = formatIlsRounded;

export function CostsManager({ costs }: { costs: CostRow[] }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [pending, startTransition] = useTransition();

  const monthly = monthlyTotal(costs);
  const annual = annualTotal(costs);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const a = Number(amount);
    if (!n || !a) return;
    startTransition(async () => {
      try {
        await addCost({ name: n, amount: a, cadence });
        setName("");
        setAmount("");
        toast.success("העלות נוספה");
      } catch (err) {
        console.error("addCost failed", err);
        toast.error("לא הצלחנו להוסיף את העלות. נסו שוב בעוד רגע.");
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-section text-ink">
          <Wallet className="h-4.5 w-4.5 text-brand-400" aria-hidden />
          כמה אתם משלמים
        </h2>
        {costs.length > 0 && (
          <span className="tnum text-sm text-ink-muted">
            <b className="text-ink">{nis(monthly)}</b>/חודש · <b className="text-ink">{nis(annual)}</b>/שנה
          </span>
        )}
      </div>

      {costs.length > 0 && (
        <div className="mb-4">
          {/* Real columns: the cadence was previously appended to the name as
              "· לחודש", so nothing distinguished a monthly cost from an annual
              one except reading the sentence. */}
          <Table<CostRow>
            caption="העלויות הקבועות של העסק"
            columns={[
              {
                id: "name",
                header: "על מה",
                sortValue: (c) => c.name,
                cell: (c) => <span className="text-ink-soft">{c.name}</span>,
              },
              {
                id: "cadence",
                header: "תדירות",
                sortValue: (c) => CADENCE_LABEL[c.cadence],
                cell: (c) => (
                  <span className="text-xs text-ink-muted">{CADENCE_LABEL[c.cadence]}</span>
                ),
              },
              {
                id: "amount",
                header: "סכום",
                numeric: true,
                sortValue: (c) => c.amount,
                cell: (c) => <span className="font-semibold text-ink">{nis(c.amount)}</span>,
              },
              {
                id: "actions",
                header: "פעולות",
                headerHidden: true,
                className: "w-14",
                cell: (c) => (
                  <button
                    onClick={() => startTransition(() => deleteCost(c.id))}
                    aria-label={`מחיקת ${c.name}`}
                    // 44px target, up from 26px, on a destructive control.
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-status-overdue"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ),
              },
            ]}
            rows={costs}
            rowKey={(c) => c.id}
          />
        </div>
      )}

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-muted">על מה (כלי / שירות)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="תוכנת חשבוניות"
            className="w-full rounded-xl border border-edge bg-card px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />
        </label>
        <label className="w-24">
          <span className="mb-1 block text-xs font-medium text-ink-muted">₪</span>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="49"
            className="w-full rounded-xl border border-edge bg-card px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-xs font-medium text-ink-muted">תדירות</span>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as Cadence)}
            className="w-full rounded-xl border border-edge bg-card px-2 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
          >
            <option value="monthly">חודשי</option>
            <option value="yearly">שנתי</option>
            <option value="one_time">חד-פעמי</option>
          </select>
        </label>
        <Button type="submit" size="sm" loading={pending} icon={<Plus className="h-4 w-4" aria-hidden />}>
          הוספה
        </Button>
      </form>

      {costs.length === 0 && (
        <p className="mt-2 text-xs text-ink-faint">
          רשמו כל כלי/שירות שאתם משלמים עליו — הכל יסתכם כאן ובתיק העסק.
        </p>
      )}
    </Card>
  );
}
