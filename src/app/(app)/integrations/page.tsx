import { PageTitle } from "@/components/ui";
import { getBusiness, getConnections } from "@/lib/data";
import { IntegrationsManager } from "./manager";

export default async function IntegrationsPage() {
  const business = (await getBusiness())!;
  const connections = await getConnections(business.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div>
      <PageTitle
        title="אינטגרציות"
        subtitle="מחברים את המערכות של העסק — והנתונים מתיישבים לבד במקום הנכון"
      />
      <IntegrationsManager connections={connections} appUrl={appUrl} />
    </div>
  );
}
