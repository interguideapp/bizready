"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, Mail, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  isValidUsername,
  normalizeUsername,
  usernameToInternalEmail,
} from "@/lib/auth/username";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [passwordState, setPasswordState] = useState<"idle" | "submitting">("idle");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setErrorMsg(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  async function submitUsernamePassword(e: React.FormEvent) {
    e.preventDefault();
    const normalizedUsername = normalizeUsername(username);
    if (!isValidUsername(normalizedUsername)) {
      setErrorMsg("שם המשתמש צריך להכיל 3–30 תווים באנגלית, מספרים, מקף או קו תחתון.");
      setState("error");
      return;
    }
    if (password.length < 12) {
      setErrorMsg("הסיסמה חייבת להכיל לפחות 12 תווים.");
      setState("error");
      return;
    }

    setPasswordState("submitting");
    setState("idle");
    setErrorMsg("");
    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/username-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: normalizedUsername, password }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not create this account.");
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToInternalEmail(normalizedUsername),
        password,
      });
      if (error) throw new Error("שם המשתמש או הסיסמה שגויים.");
      // The protected app layout sends first-time users to onboarding while
      // returning users continue to their dashboard.
      location.assign("/dashboard");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "משהו השתבש. נסו שוב.");
      setState("error");
    } finally {
      setPasswordState("idle");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <Link href="/" className="mb-8 text-2xl font-bold text-brand-700">
        BizReady
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
        {state === "sent" ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-status-done-bg text-status-done">
              <MailCheck className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="text-lg font-bold text-slate-900">בדקו את המייל</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              שלחנו קישור כניסה אל <span className="font-medium">{email}</span>.
              לחצו עליו וניכנס ישר לעניינים.
            </p>
            <button
              onClick={() => setState("idle")}
              className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              שליחה לכתובת אחרת
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-center text-lg font-bold text-slate-900">
              כניסה או הרשמה
            </h1>
            <p className="mt-1 text-center text-sm text-slate-500">
              בלי סיסמאות — קישור קסם למייל
            </p>

            <form onSubmit={sendMagicLink} className="mt-6 flex flex-col gap-3">
              <label className="sr-only" htmlFor="email">
                כתובת אימייל
              </label>
              <input
                id="email"
                type="email"
                required
                dir="ltr"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {state === "sending" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Mail className="h-4 w-4" aria-hidden />
                )}
                שלחו לי קישור כניסה
              </button>
              {state === "error" && (
                <p className="text-center text-sm text-status-overdue">
                  משהו השתבש: {errorMsg}
                </p>
              )}
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              או
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
                <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-md px-2 py-1.5 ${mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>כניסה עם סיסמה</button>
                <button type="button" onClick={() => setMode("register")} className={`flex-1 rounded-md px-2 py-1.5 ${mode === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>הרשמה</button>
              </div>
              <form onSubmit={submitUsernamePassword} className="flex flex-col gap-3">
                <input type="text" required minLength={3} maxLength={30} autoComplete="username" dir="ltr" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                <input type="password" required minLength={12} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="סיסמה (12 תווים לפחות)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                <button type="submit" disabled={passwordState === "submitting"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60">
                  {passwordState === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
                  {mode === "register" ? "יצירת חשבון" : "כניסה"}
                </button>
              </form>
              <p className="mt-3 text-center text-xs text-slate-500">לא נדרשת כתובת אימייל או אימות במייל.</p>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              או
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              onClick={signInWithGoogle}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              המשך עם Google
            </button>
          </>
        )}
      </div>

      <p className="mt-6 max-w-xs text-center text-xs text-slate-400">
        בהרשמה אתם מסכימים לקבל מיילים תפעוליים על החשבון שלכם בלבד
      </p>
    </div>
  );
}
