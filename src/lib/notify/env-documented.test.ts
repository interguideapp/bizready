import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY ENVIRONMENT VARIABLE THE OUTBOUND PATH READS IS DOCUMENTED.
 *
 * .env.local.example listed NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
 * — and pushConfigured() reads neither of the first and requires two more:
 * VAPID_PUBLIC_KEY and VAPID_SUBJECT. So someone setting up push by following
 * this file exactly configured nothing, got no error, and had nowhere to look:
 * a missing provider leaves reminder_log EMPTY rather than full of failures.
 * REMINDER_FROM_EMAIL was missing the same way, and email needs both.
 *
 * Derived from the source rather than from a list I retype here, because a
 * hand-kept list is the thing that drifted in the first place. Any new
 * process.env read under lib/notify has to be documented or this fails.
 */
const root = process.cwd();

/** Comments stripped, so a variable named only in an explanation does not count. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const SOURCES = [
  "src/lib/notify/push.ts",
  "src/lib/notify/channels.ts",
];

function varsReadBy(rel: string): string[] {
  const src = stripComments(readFileSync(join(root, rel), "utf8"));
  return [...src.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
}

/**
 * "Documented" means an assignment line, not a mention.
 *
 * The first version of this guard asked whether the file CONTAINED the name,
 * and it passed with the defect planted back — because the prose I had just
 * written to explain the fix quotes the correct name ("the code reads
 * WHATSAPP_PHONE_NUMBER_ID"), so the substring was present while the line
 * someone actually uncomments still said WHATSAPP_PHONE_ID.
 *
 * A guard matching its own explanation is the specific failure this codebase
 * has hit repeatedly, and it certifies the bug rather than catching it. What
 * counts is the form a person edits: an optional comment marker, the name, an
 * equals sign.
 */
function documents(example: string, name: string): boolean {
  return new RegExp("^\\s*#?\\s*" + name + "\\s*=", "m").test(example);
}

describe("the example env file documents what the senders actually read", () => {
  const example = readFileSync(join(root, ".env.local.example"), "utf8");

  it("recognises an assignment line and ignores a passing mention", () => {
    // The premise, asserted, because this helper is the whole guard.
    expect(documents("# FOO=", "FOO")).toBe(true);
    expect(documents("BAR=1", "BAR")).toBe(true);
    expect(documents("# the code reads FOO instead", "FOO")).toBe(false);
  });

  it("reads at least one variable per channel, or the test proves nothing", () => {
    // The premise. A regex that matches nothing would make every assertion
    // below vacuously true — the shape of guard that has passed with the
    // defect planted more than once in this codebase.
    for (const rel of SOURCES) {
      expect(varsReadBy(rel).length).toBeGreaterThan(0);
    }
  });

  it("names every variable the outbound senders read", () => {
    const read = [...new Set(SOURCES.flatMap(varsReadBy))];
    const undocumented = read.filter((name) => !documents(example, name));
    expect(undocumented).toEqual([]);
  });

  it("names the client variable that gates the subscribe button", () => {
    // Not read by the sender at all, and without it no browser can ever
    // subscribe — so push is "configured" and reaches nobody, for ever.
    const toggleGate = stripComments(
      readFileSync(join(root, "src/app/(app)/settings/page.tsx"), "utf8")
    );
    expect(toggleGate).toContain("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
    expect(documents(example, "NEXT_PUBLIC_VAPID_PUBLIC_KEY")).toBe(true);
  });
});

describe("a channel counts as configured only when it can deliver a reminder", () => {
  /**
   * WhatsApp is the case where "the API accepted it" and "the user got it" come
   * apart, and the product was reading the first as the second.
   *
   * Asserted at the source because no runtime observation available here can
   * distinguish them: Meta returns 200 either way, and the difference shows up
   * only as a message that never arrives.
   */
  it("requires the approved template, not just the token and phone id", () => {
    const channels = stripComments(
      readFileSync(join(root, "src/lib/notify/channels.ts"), "utf8")
    );
    // Walk to the end of the function rather than slicing a fixed window: a
    // comment growing above the code has broken that trick here before.
    const at = channels.indexOf("export function whatsappConfigured");
    expect(at).toBeGreaterThan(-1);
    const body = channels.slice(at, channels.indexOf("}", channels.indexOf("return", at)));
    expect(body).toContain("WHATSAPP_TOKEN");
    expect(body).toContain("WHATSAPP_PHONE_NUMBER_ID");
    expect(body).toContain("WHATSAPP_TEMPLATE_NAME");
  });

  it("still requires both halves of the email pair", () => {
    // A key with no from-address returns "email not configured" before it
    // attempts anything, which is what left reminder_log empty in production.
    const channels = stripComments(
      readFileSync(join(root, "src/lib/notify/channels.ts"), "utf8")
    );
    const at = channels.indexOf("export function emailConfigured");
    const body = channels.slice(at, channels.indexOf("}", channels.indexOf("return", at)));
    expect(body).toContain("RESEND_API_KEY");
    expect(body).toContain("REMINDER_FROM_EMAIL");
  });

  it("requires all three push variables the sender dereferences", () => {
    // setVapidDetails is called with non-null assertions on all three, so a
    // partial set would throw inside the send rather than skip the channel.
    const push = stripComments(readFileSync(join(root, "src/lib/notify/push.ts"), "utf8"));
    const at = push.indexOf("export function pushConfigured");
    const body = push.slice(at, push.indexOf("}", push.indexOf("return", at)));
    for (const name of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]) {
      expect(body).toContain(name);
    }
  });
});

describe("the example file exists in the repository at all", () => {
  /**
   * IT DID NOT, AND THAT IS WHY THIS TEST IS HERE.
   *
   * .gitignore's ".env*" matched .env.local.example, so the one file whose
   * entire purpose is to be read by the next person was never committed. The
   * audit's remedy for the fail-open cron routes was, verbatim, "require
   * CRON_SECRET at boot (fail fast) and document it in .env.local.example" —
   * and that documentation existed on exactly one machine. Every variable
   * above could have been correct in a file nobody else would ever see.
   *
   * Reading it is the assertion. A fresh clone missing the file fails here
   * with a sentence rather than an unexplained ENOENT during collection.
   */
  it("is present and readable, not just present on one developer's disk", () => {
    let text = "";
    try {
      text = readFileSync(join(root, ".env.local.example"), "utf8");
    } catch {
      throw new Error(
        ".env.local.example is missing. It is the only documentation of the " +
          "environment this app needs, and .gitignore's .env* rule has hidden " +
          "it from the repository before — .gitignore must keep the " +
          "!.env.local.example negation."
      );
    }
    expect(text.length).toBeGreaterThan(0);
  });

  it("documents the variable without which every cron call is rejected", () => {
    // The audit item that was lost with the file. cronAuthorized fails closed,
    // so an operator who never sees this line has a silently dead scheduler.
    const example = readFileSync(join(root, ".env.local.example"), "utf8");
    expect(documents(example, "CRON_SECRET")).toBe(true);
  });

  it("keeps no real value, because the repository is public", () => {
    // A tracked env file is only safe while it is placeholders. Anything that
    // looks like a live credential fails the build instead of being pushed.
    const example = readFileSync(join(root, ".env.local.example"), "utf8");
    const suspicious = example
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .filter((line) => /^[A-Z0-9_]+=.+/.test(line))
      .map((line) => line.split("=").slice(1).join("=").trim())
      .filter((value) => {
        // A placeholder says so in words. "https://YOUR-PROJECT.supabase.co"
        // tripped the length rule on the first run, which is the useful kind
        // of false positive: the rule has to know what a placeholder looks
        // like before it can accuse anything.
        const placeholder =
          /YOUR|GENERATE|EXAMPLE|CHARACTERS|HEX|REPLACE|CHANGE|TODO|xxx/i.test(value);
        if (placeholder) return false;
        // Live-key prefixes from the providers this app actually uses.
        if (/^(sk_|rk_|pk_live|price_|whsec_|eyJ|re_)/.test(value)) return true;
        // Otherwise: long, and not the SHOUTY-PLACEHOLDER shape.
        return value.length >= 24 && !/^[A-Z0-9_-]+$/.test(value);
      });
    expect(suspicious).toEqual([]);
  });
});
