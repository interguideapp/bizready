import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, ImageIcon, Tags } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { LogoUploader } from "@/components/logo-uploader";
import { PriceList } from "@/components/price-list";
import { Card, PageTitle } from "@/components/ui";
import { getBusiness, getDocuments, getProducts } from "@/lib/data";
import { computeProfileCompleteness } from "@/lib/profile-score";
import { createClient } from "@/lib/supabase/server";
import { BusinessCard } from "./business-card";

export default async function BusinessPage() {
  const business = (await getBusiness())!;
  const [products, documents] = await Promise.all([
    getProducts(business.id),
    getDocuments(business.id),
  ]);

  const completeness = computeProfileCompleteness(business, {
    products: products.length,
    documents: documents.length,
  });

  let logoUrl: string | null = null;
  if (business.logo_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(business.logo_path, 3600);
    logoUrl = data?.signedUrl ?? null;
  }

  const missing = completeness.checks.filter((c) => !c.done);

  return (
    <div>
      <PageTitle
        title="הפרופיל העסקי"
        subtitle="ככל שהפרופיל מלא יותר — העסק שלך מסודר, מקצועי וזמין יותר"
      />

      {/* completeness hero */}
      <Card className="flex flex-col items-center gap-6 p-6 md:flex-row md:items-start md:px-8">
        <ScoreRing score={completeness.percent} size={140} label="פרופיל מלא" />
        <div className="w-full flex-1">
          <h2 className="mb-3 font-bold text-ink">
            {completeness.percent === 100
              ? "פרופיל מושלם — כל הפרטים במקום 🎉"
              : "מה חסר ל-100%?"}
          </h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {completeness.checks.map((check) =>
              check.done ? (
                <li key={check.id} className="flex items-center gap-2 text-sm text-ink-muted">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-status-done" aria-hidden />
                  <span className="line-through decoration-edge">{check.label}</span>
                </li>
              ) : (
                <li key={check.id}>
                  <Link
                    href={check.href}
                    className="group flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-brand-strong"
                  >
                    <Circle className="h-4 w-4 shrink-0 text-ink-faint group-hover:text-brand-500" aria-hidden />
                    {check.label}
                    <ArrowLeft className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" aria-hidden />
                  </Link>
                </li>
              )
            )}
          </ul>
          {missing.length > 0 && (
            <p className="mt-3 text-xs text-ink-muted">
              לחיצה על פריט חסר תיקח אתכם ישר למקום שבו משלימים אותו
            </p>
          )}
        </div>
      </Card>

      {/* logo */}
      <Card className="mt-5 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
          <ImageIcon className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          הלוגו שלי
        </h2>
        <LogoUploader currentLogoUrl={logoUrl} />
      </Card>

      {/* price list */}
      <Card className="mt-5 p-5">
        <h2 className="mb-1 flex items-center gap-2 font-bold text-ink">
          <Tags className="h-4.5 w-4.5 text-brand-500" aria-hidden />
          המחירון שלי
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          השירותים והמוצרים של העסק עם מחירים — הבסיס להצעות מחיר מסודרות
        </p>
        <PriceList products={products} />
      </Card>

      {/* registration & contact details */}
      <div className="mt-5">
        <BusinessCard business={business} />
      </div>
    </div>
  );
}
