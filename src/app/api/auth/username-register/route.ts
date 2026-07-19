import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidUsername,
  normalizeUsername,
  usernameToInternalEmail,
} from "@/lib/auth/username";

const MINIMUM_PASSWORD_LENGTH = 12;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 415 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = normalizeUsername(body.username);
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Username must be 3–30 characters and use letters, numbers, _ or -." },
      { status: 400 }
    );
  }
  if (body.password.length < MINIMUM_PASSWORD_LENGTH || body.password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 12 and 128 characters." },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: usernameToInternalEmail(username),
      password: body.password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (error || !data.user) {
      // Do not distinguish account-existence errors from other auth failures.
      return NextResponse.json(
        { error: "Could not create this account. Try a different username." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .update({ username })
      .eq("id", data.user.id)
      .select("id")
      .maybeSingle();

    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: "Could not create this account." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create this account." }, { status: 500 });
  }
}
