import { PageTitle } from "@/components/ui";
import { getBusiness } from "@/lib/data";
import { BusinessCard } from "./business-card";

export default async function BusinessPage() {
  const business = (await getBusiness())!;
  return (
    <div>
      <PageTitle
        title="כרטיס העסק"
        subtitle="כל הפרטים והמספרים החשובים — זמינים בקליק כשמבקשים"
      />
      <BusinessCard business={business} />
    </div>
  );
}
