import { redirect } from "next/navigation";
import { PassportView } from "@/components/passport/passport-view";
import { loadPassport } from "@/lib/passport-data";

export default async function PassportPage() {
  const d = await loadPassport();
  if (!d) redirect("/login");
  return <PassportView d={d} />;
}
