/**
 * תיק העסק — the business passport. A single, complete snapshot of the business
 * (identity, file numbers, readiness, obligations/dates, documents, costs, price
 * list) for external use (bank, accountant) and for always being on time.
 * `renderPassportHtml` produces a self-contained, print-ready (light) document.
 */

export interface PassportData {
  businessName: string;
  entityLabel: string;
  generatedAt: string; // he date
  identity: { label: string; value: string }[];
  levelTitle: string;
  levelNumber: number;
  score: number;
  completedCount: number;
  totalCount: number;
  badges: string[];
  categories: { title: string; score: number; done: number; total: number }[];
  obligations: { title: string; date: string; period: string | null }[];
  documents: { name: string; category: string; date: string; expires: string | null }[];
  costs: { name: string; amount: string; cadence: string }[];
  monthlyCost: string | null;
  annualCost: string | null;
  products: { name: string; price: string; unit: string }[];
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  return `<tr><td class="k">${esc(label)}</td><td class="v">${esc(value)}</td></tr>`;
}

function section(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
}

export function renderPassportHtml(d: PassportData): string {
  const identity = d.identity.length
    ? `<table class="kv">${d.identity.map((i) => row(i.label, i.value)).join("")}</table>`
    : "";

  const readiness = `
    <div class="readiness">
      <div class="lvl"><span class="lvl-n">${d.levelNumber}</span><span class="lvl-t">${esc(d.levelTitle)}</span></div>
      <div class="score">ציון מוכנות: <b>${d.score}</b> · משימות שהושלמו: <b>${d.completedCount}/${d.totalCount}</b></div>
      ${d.badges.length ? `<div class="badges">${d.badges.map((b) => `<span class="badge">${esc(b)}</span>`).join("")}</div>` : ""}
    </div>
    <table class="kv">${d.categories.map((c) => row(c.title, `${c.score}% · ${c.done}/${c.total}`)).join("")}</table>`;

  const obligations = d.obligations.length
    ? `<table class="grid"><thead><tr><th>חובה</th><th>מועד</th><th>תקופה</th></tr></thead><tbody>${d.obligations
        .map((o) => `<tr><td>${esc(o.title)}</td><td>${esc(o.date)}</td><td>${esc(o.period ?? "")}</td></tr>`)
        .join("")}</tbody></table>`
    : "";

  const documents = d.documents.length
    ? `<table class="grid"><thead><tr><th>מסמך</th><th>קטגוריה</th><th>נוצר</th><th>בתוקף עד</th></tr></thead><tbody>${d.documents
        .map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.category)}</td><td>${esc(x.date)}</td><td>${esc(x.expires ?? "—")}</td></tr>`)
        .join("")}</tbody></table>`
    : "";

  const costs = d.costs.length
    ? `<table class="grid"><thead><tr><th>פריט</th><th>סכום</th><th>תדירות</th></tr></thead><tbody>${d.costs
        .map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.amount)}</td><td>${esc(c.cadence)}</td></tr>`)
        .join("")}</tbody></table>${
        d.monthlyCost ? `<p class="total">סה"כ חודשי: <b>${esc(d.monthlyCost)}</b> · שנתי: <b>${esc(d.annualCost ?? "")}</b></p>` : ""
      }`
    : "";

  const products = d.products.length
    ? `<table class="grid"><thead><tr><th>שירות / מוצר</th><th>מחיר</th><th>יחידה</th></tr></thead><tbody>${d.products
        .map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.price)}</td><td>${esc(p.unit)}</td></tr>`)
        .join("")}</tbody></table>`
    : "";

  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>תיק העסק — ${esc(d.businessName)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#111827;line-height:1.6;max-width:820px;margin:0 auto;padding:44px 34px;background:#fff}
  header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #4f46e5;padding-bottom:14px;margin-bottom:8px}
  h1{font-size:26px;margin:0}
  .sub{color:#6b7280;font-size:13px}
  .gen{color:#9ca3af;font-size:12px}
  section{margin-top:26px;break-inside:avoid}
  h2{font-size:16px;color:#4338ca;border-bottom:1px solid #e5e7eb;padding-bottom:5px;margin:0 0 10px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  table.kv td{padding:5px 4px;border-bottom:1px solid #f3f4f6}
  td.k{color:#6b7280;width:42%}
  td.v{font-weight:600;direction:ltr;text-align:right}
  table.grid th{text-align:right;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;padding:6px 4px}
  table.grid td{padding:6px 4px;border-bottom:1px solid #f3f4f6}
  .readiness{background:#f5f6ff;border:1px solid #e0e7ff;border-radius:12px;padding:14px;margin-bottom:12px}
  .lvl{display:flex;align-items:center;gap:10px}
  .lvl-n{width:36px;height:36px;border-radius:50%;background:#4f46e5;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800}
  .lvl-t{font-weight:800;font-size:18px}
  .score{color:#374151;font-size:13px;margin-top:6px}
  .badges{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
  .badge{background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600}
  .total{margin-top:8px;font-size:13px}
  .disclaimer{margin-top:30px;padding:12px 14px;border:1px solid #e5e7eb;background:#fafafa;color:#6b7280;font-size:11px;border-radius:8px}
  @media print{body{padding:0}.no-print{display:none}}
</style></head>
<body>
<header><div><h1>תיק העסק</h1><div class="sub">${esc(d.businessName)} · ${esc(d.entityLabel)}</div></div><div class="gen">הופק: ${esc(d.generatedAt)}</div></header>
${section("פרטי העסק ותיקים ברשויות", identity)}
${section("מצב מוכנות", readiness)}
${section("מועדי חובה קרובים", obligations)}
${section("מסמכים בארכיון", documents)}
${section("עלויות קבועות", costs)}
${section("מחירון", products)}
<div class="disclaimer">מסמך זה הופק אוטומטית ב-BizReady כתמונת מצב של העסק. הפרטים כפי שהוזנו על ידכם. אינו מהווה ייעוץ משפטי/מיסויי/פיננסי.</div>
</body></html>`;
}
