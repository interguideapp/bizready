import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // send new users to onboarding, returning users to the dashboard
      const { data: business } = await supabase
        .from("businesses")
        .select("id, onboarding_completed_at")
        .maybeSingle();
      const target = business?.onboarding_completed_at
        ? "/dashboard"
        : "/onboarding";
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
