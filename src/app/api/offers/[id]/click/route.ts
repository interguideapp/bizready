import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Records an offer click, then redirects to the offer's destination.
 * Keeps affiliate/redirect logic in one place and lets us measure conversions.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select("url")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (!offer?.url) {
    return NextResponse.redirect(new URL("/shop", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let businessId: string | null = null;
  if (user) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    businessId = business?.id ?? null;
  }

  await supabase.from("offer_clicks").insert({ offer_id: id, business_id: businessId });

  return NextResponse.redirect(offer.url);
}
