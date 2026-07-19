import { Store } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { OfferCard } from "@/components/offer-card";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { CATEGORIES, TEMPLATES_BY_ID } from "@/lib/content";
import { getActiveOffers, getBusiness, getBusinessTasks } from "@/lib/data";

export default async function ShopPage() {
  const business = (await getBusiness())!;
  const [offers, tasks] = await Promise.all([
    getActiveOffers(),
    getBusinessTasks(business.id),
  ]);

  // profile filter: an offer tied to a task only shows if that task is relevant
  const relevantTemplateIds = new Set(
    tasks.filter((t) => t.is_relevant).map((t) => t.template_id)
  );
  const visible = offers.filter(
    (o) => !o.template_id || relevantTemplateIds.has(o.template_id)
  );

  // group by the category of the offer (via its template or its own category)
  const byCategory = new Map<string, typeof visible>();
  for (const o of visible) {
    const categoryId =
      o.category_id ??
      (o.template_id ? TEMPLATES_BY_ID.get(o.template_id)?.category_id : null) ??
      "other";
    const list = byCategory.get(categoryId) ?? [];
    list.push(o);
    byCategory.set(categoryId, list);
  }

  return (
    <div>
      <PageTitle
        title="החנות"
        subtitle="שירותים ומוצרים שיקדמו את העסק — מותאמים לשלב שאתם בו"
      />

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Store className="h-6 w-6" aria-hidden />}
            title="החנות בהרצה"
            subtitle="בקרוב נוסיף כאן הצעות ומוצרים נבחרים — עיצוב לוגו, כרטיסי NFC לביקורות, כלים לעסק ועוד. כל הצעה תסומן בבירור כהצעת שותף."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {CATEGORIES.filter((c) => byCategory.has(c.id)).map((category) => (
            <section key={category.id}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <CategoryIcon name={category.icon} className="h-4 w-4" />
                </div>
                <h2 className="font-bold text-slate-900">{category.title}</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {byCategory.get(category.id)!.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>
            </section>
          ))}
          {byCategory.has("other") && (
            <section>
              <h2 className="mb-2.5 font-bold text-slate-900">כללי</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {byCategory.get("other")!.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-slate-400">
        BizReady עשויה לקבל עמלה על הצעות שותפים. ההמלצות המקצועיות והמדריכים
        באפליקציה תמיד זמינים בחינם וללא תלות בהצעות.
      </p>
    </div>
  );
}
