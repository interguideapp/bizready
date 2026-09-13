"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * What is left of the integrations action module.
 *
 * It used to hold a SECOND implementation of the connection lifecycle —
 * createConnection, disconnectConnection, syncNow, importCsv — reachable only
 * from an orphaned manager component. The audit named it and asked for its
 * deletion: "delete the dead duplicate pair so the secret-setting path is the
 * only path." It was not deleted, and the live UI has been calling the copies
 * in lib/actions.ts all along.
 *
 * Two createConnections is not merely untidy. It is a security-relevant path —
 * it seals credentials and mints the webhook signing secret — and the next
 * person to change it had even odds of editing the copy nobody runs. Checked
 * before removing: the live path in actions.ts does seal credentials, does set
 * webhook_secret, and /api/hooks/[token] now rejects any connection without
 * one, so nothing here was load-bearing.
 *
 * resolveSyncError survives because errors-list.tsx genuinely calls it — and
 * those sync errors now also surface in the attention list, so a user finds
 * out without opening the integrations screen at all.
 */

async function requireBusiness() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");
  return { supabase, businessId: business.id };
}

/** Mark a sync error as dealt with, so it stops being reported as open. */
export async function resolveSyncError(errorId: string) {
  const { supabase } = await requireBusiness();
  await supabase
    .from("sync_errors")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", errorId);
  revalidatePath("/insights");
  // The attention list derives an item from open sync errors, so resolving one
  // has to refresh the surfaces that count it.
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
