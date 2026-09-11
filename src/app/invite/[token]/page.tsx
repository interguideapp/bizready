import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvite } from "./accept-invite";

/**
 * Where an invitation link lands.
 *
 * Deliberately does NOT accept the invitation on page load. A GET that changes
 * state is accepted by link previewers, mail scanners and prefetchers — so the
 * invitation could be "accepted" by a spam filter before the accountant ever
 * saw it. The page shows what is being offered and waits for a click.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in: keep the token in the return path so it survives the round
  // trip through login, rather than losing the invitation at the door.
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  // Read it for display only. RLS lets the invitee see their own invitation row
  // via the member-read policy once accepted, and the token lookup is what
  // authorises this read before then.
  const { data: invite } = await supabase
    .from("business_members")
    .select("role, invited_email, accepted_at, revoked_at, business_id")
    .eq("invite_token", token)
    .maybeSingle();

  let businessName: string | null = null;
  if (invite?.business_id) {
    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", invite.business_id as string)
      .maybeSingle();
    businessName = (business?.name as string) ?? null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-10">
      <AcceptInvite
        token={token}
        businessName={businessName}
        role={(invite?.role as "accountant" | "viewer" | undefined) ?? null}
        invitedEmail={(invite?.invited_email as string | undefined) ?? null}
        alreadyAccepted={Boolean(invite?.accepted_at)}
        revoked={Boolean(invite?.revoked_at)}
        found={Boolean(invite)}
      />
    </main>
  );
}
