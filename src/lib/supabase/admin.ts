import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Only ever imported from server-only code
 * (cron routes). Never expose the service role key to the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}
