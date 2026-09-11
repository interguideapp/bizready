"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addProduct, deleteProduct } from "@/lib/actions";
import { Table, type Column } from "@/components/table";
import { formatIls } from "@/lib/money";
import type { ProductRow } from "@/lib/data";

const UNIT_LABELS: Record<string, string> = {
  unit: "ליחידה",
  hour: "לשעה",
  month: "לחודש",
  project: "לפרויקט",
};

/** Build & manage the business price list — services/products with prices. */
export function PriceList({ products }: { products: ProductRow[] }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("unit");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const parsed = price.trim() === "" ? null : Number(price);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setError("מחיר לא תקין");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await addProduct({ name, price: parsed, unit });
        setName("");
        setPrice("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "השמירה נכשלה");
      }
    });
  }

  return (
    <div>
      {products.length > 0 && (
        <div className="mb-4">
          <Table<ProductRow>
            caption="המחירון — שירותים ומוצרים עם מחירים"
            columns={PRICE_COLUMNS}
            rows={products}
            rowKey={(p) => p.id}
          />
        </div>
      )}

      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שירות או מוצר (למשל: טיפול פנים)"
          className="min-w-0 flex-1 rounded-xl border border-edge px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          dir="ltr"
          placeholder="₪"
          className="w-24 rounded-xl border border-edge px-3 py-2.5 text-end text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="rounded-xl border border-edge bg-card px-2.5 py-2.5 text-sm outline-none"
        >
          {Object.entries(UNIT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          הוספה
        </button>
      </form>
      {error && <p className="mt-1.5 text-xs text-status-overdue">{error}</p>}
      {products.length === 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          עוד אין פריטים — הוסיפו את השירות הראשון שלכם ותראו את המחירון נבנה
        </p>
      )}
    </div>
  );
}

/**
 * Real columns, so a price is announced as a price.
 *
 * Sortable by name and by price: a price list is exactly the thing someone
 * wants ordered cheapest-first, and it was previously stuck in insertion order
 * with no way to change it.
 */
const PRICE_COLUMNS: Column<ProductRow>[] = [
  {
    id: "name",
    header: "שירות או מוצר",
    sortValue: (p) => p.name,
    cell: (p) => <span className="font-medium text-ink">{p.name}</span>,
  },
  {
    id: "price",
    header: "מחיר",
    numeric: true,
    // Nulls sort last rather than as zero — "no price set" is not free.
    sortValue: (p) => (p.price == null ? Number.MAX_SAFE_INTEGER : Number(p.price)),
    cell: (p) => (
      <>
        {formatIls(p.price == null ? null : Number(p.price))}
        <span className="ms-1 text-xs text-ink-muted">{UNIT_LABELS[p.unit] ?? ""}</span>
      </>
    ),
  },
  {
    id: "actions",
    header: "פעולות",
    headerHidden: true,
    className: "w-14",
    cell: (p) => <DeleteProduct product={p} />,
  },
];

function DeleteProduct({ product }: { product: ProductRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => deleteProduct(product.id))}
      disabled={pending}
      aria-label={`מחיקת ${product.name}`}
      // 44px target: destructive, and previously a 26px hit area.
      className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-status-overdue"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
