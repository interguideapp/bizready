import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidUsername,
  normalizeUsername,
  usernameToInternalEmail,
} from "@/lib/auth/username";
import { check, clientIp } from "@/lib/rate-limit";

const MINIMUM_PASSWORD_LENGTH = 12;
// account creation is expensive and abusable — keep it tight
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Password account creation — by username (internal identifier) OR by a real
 * email. Both are created confirmed via the admin API, so no confirmation mail
 * is needed. Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(request: Request) {
  const limit = check(`register:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "יותר מדי נסיונות הרשמה. נסו שוב מאוחר יותר." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 415 });
  }

  let body: { username?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.password !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.password.length < MINIMUM_PASSWORD_LENGTH || body.password.length > 128) {
    return NextResponse.json(
      { error: "הסיסמה חייבת להכיל בין 12 ל-128 תווים." },
      { status: 400 }
    );
  }

  // resolve the auth email + optional username from either identifier
  let email: string;
  let username: string | null = null;
  if (typeof body.email === "string" && body.email.trim()) {
    email = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "כתובת אימייל לא תקינה." }, { status: 400 });
    }
  } else if (typeof body.username === "string") {
    username = normalizeUsername(body.username);
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: "שם המשתמש צריך 3–30 תווים באנגלית, מספרים, מקף או קו תחתון." },
        { status: 400 }
      );
    }
    email = usernameToInternalEmail(username);
  } else {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // the service-role key isn't configured yet
    return NextResponse.json(
      { error: "הרשמה אינה זמינה כרגע — חסרה הגדרת שרת. נסו שוב מאוחר יותר." },
      { status: 503 }
    );
  }

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: username ? { username } : {},
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "לא ניתן ליצור את החשבון. ייתכן שהוא כבר קיים." },
        { status: 400 }
      );
    }

    if (username) {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .update({ username })
        .eq("id", data.user.id)
        .select("id")
        .maybeSingle();
      if (profileError || !profile) {
        await admin.auth.admin.deleteUser(data.user.id);
        return NextResponse.json({ error: "לא ניתן ליצור את החשבון." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "לא ניתן ליצור את החשבון." }, { status: 500 });
  }
}
