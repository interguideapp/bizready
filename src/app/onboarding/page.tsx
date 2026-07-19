import { redirect } from "next/navigation";
import { getBusiness } from "@/lib/data";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const business = await getBusiness();
  if (business?.onboarding_completed_at) redirect("/dashboard");
  return <OnboardingWizard />;
}
