import { redirect } from "next/navigation";

// "בית" is the single overview / one-truth surface now. The old command-deck
// dashboard is folded into it; this route just forwards there.
export default function DashboardPage() {
  redirect("/home");
}
