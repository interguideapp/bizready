import { createClient } from "@/lib/supabase/server";
import { buildDataExport } from "@/lib/privacy";

/**
 * Machine-readable export of everything we hold for the signed-in account.
 *
 * The product ships a `critical`, statute-backed task telling the user to give
 * THEIR customers access to their data, and had no way for the user to get
 * their own. This is the other half of that promise.
 *
 * Reads through the caller's own session, so RLS scopes it — an export is a
 * read of your own data and should not need the service role.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const payload = await buildDataExport(
    supabase as unknown as Parameters<typeof buildDataExport>[0],
    { userId: user.id, email: user.email ?? null, businessId: business?.id ?? null }
  );

  const filename = `bizready-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // This file contains tax file numbers, a bank account and the user's own
      // customers' names. It must not sit in a proxy cache or be indexed.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
