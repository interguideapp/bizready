"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, Plus, Sparkles } from "lucide-react";
import { createOffer, setOfferActive } from "@/lib/actions";
import type { OfferRow } from "@/lib/data";

const field =
  "w-full rounded-xl border border-edge bg-card px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-edge";

export function OfferManager({
  offers,
  templateIds,
  categoryIds,
}: {
  offers: OfferRow[];
  templateIds: string[];
  categoryIds: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-section text-ink">הצעות שותפים ({offers.length})</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 px-3 py-2 text-sm font-semibold text-white shadow-e-brand transition hover:opacity-95"
        >
          <Plus className="h-4 w-4" aria-hidden />
          הצעה חדשה
        </button>
      </div>

      {open && <NewOfferForm templateIds={templateIds} categoryIds={categoryIds} onDone={() => setOpen(false)} />}

      <div className="mt-3 flex flex-col gap-2">
        {offers.length === 0 && <p className="text-sm text-ink-muted">אין עדיין הצעות. צרו את הראשונה.</p>}
        {offers.map((o) => <OfferItem key={o.id} offer={o} />)}
      </div>
    </div>
  );
}

function OfferItem({ offer }: { offer: OfferRow }) {
  const [pending, start] = useTransition();
  const active = offer.is_active !== false;
  return (
    <div className={`panel flex items-center justify-between gap-3 rounded-card p-3 ${!active ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-ink">{offer.title}</p>
          {offer.is_featured && <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-strong" aria-hidden />}
        </div>
        <p className="tnum truncate text-[11px] text-ink-muted" dir="ltr">
          {offer.template_id ?? offer.category_id ?? "כללי"} · {offer.commission_type ?? "—"}
        </p>
      </div>
      <button
        onClick={() => start(() => setOfferActive(offer.id, !active))}
        disabled={pending}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
          active ? "bg-status-done-bg text-status-done" : "bg-surface-2 text-ink-muted"
        }`}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : active ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
        {active ? "פעיל" : "מוסתר"}
      </button>
    </div>
  );
}

function NewOfferForm({
  templateIds,
  categoryIds,
  onDone,
}: {
  templateIds: string[];
  categoryIds: string[];
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [featured, setFeatured] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await createOffer({
        title: String(f.get("title") ?? ""),
        description: String(f.get("description") ?? ""),
        ctaLabel: String(f.get("ctaLabel") ?? ""),
        url: String(f.get("url") ?? ""),
        couponCode: String(f.get("couponCode") ?? ""),
        templateId: String(f.get("templateId") ?? ""),
        categoryId: String(f.get("categoryId") ?? ""),
        commissionType: String(f.get("commissionType") ?? ""),
        isFeatured: featured,
        isActive: true,
      });
      if (res.ok) onDone();
      else setError(res.error ?? "שמירה נכשלה.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="panel rounded-card p-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input name="title" required placeholder="כותרת *" className={field} />
        <input name="ctaLabel" placeholder="טקסט כפתור (לפרטים)" className={field} />
        <input name="description" placeholder="תיאור קצר" className={`${field} sm:col-span-2`} />
        <input name="url" dir="ltr" placeholder="https://… קישור עם מעקב" className={field} />
        <input name="couponCode" dir="ltr" placeholder="קוד קופון" className={field} />
        <select name="templateId" defaultValue="" className={field}>
          <option value="">— משימה (אופציונלי) —</option>
          {templateIds.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="categoryId" defaultValue="" className={field}>
          <option value="">— קטגוריה (אופציונלי) —</option>
          {categoryIds.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="commissionType" defaultValue="" className={field}>
          <option value="">— סוג עמלה —</option>
          <option value="referral">referral</option>
          <option value="cpa">cpa</option>
          <option value="lead">lead</option>
          <option value="own_product">own_product</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 rounded" />
          מודגש (מיקום בולט)
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-status-overdue">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl bg-status-done px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          יצירה ופרסום
        </button>
        <button type="button" onClick={onDone} className="rounded-xl px-3 py-2 text-sm text-ink-muted hover:text-ink">ביטול</button>
      </div>
    </form>
  );
}
