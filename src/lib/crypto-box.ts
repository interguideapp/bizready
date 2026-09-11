import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for integration credentials.
 *
 * These rows hold live, write-capable access to a business's invoicing system —
 * Green Invoice api_key/api_secret and, for iCount, a full account username and
 * PASSWORD. They were stored as plaintext jsonb, so a single DB read (a leaked
 * service-role key, a backup, a support path) yielded every tenant's
 * credentials. The integrations screen also promised the user
 * "טוקנים מאובטחים, לא סיסמאות", which was not true.
 *
 * AES-256-GCM with a key held outside the database in CREDENTIALS_KEY
 * (64 hex chars = 32 bytes). Stored shape: { v, iv, tag, ct }.
 *
 * Fails CLOSED on write: with no key configured, connecting errors out rather
 * than silently persisting plaintext. Reads stay tolerant of legacy plaintext
 * rows so an existing install keeps working while it is migrated.
 */

const VERSION = 1;

export class CredentialKeyMissingError extends Error {
  constructor() {
    super("CREDENTIALS_KEY is not configured");
    this.name = "CredentialKeyMissingError";
  }
}

function loadKey(): Buffer {
  const raw = process.env.CREDENTIALS_KEY;
  if (!raw) throw new CredentialKeyMissingError();
  const key = Buffer.from(raw.trim(), "hex");
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_KEY must be 64 hex characters (32 bytes)");
  }
  return key;
}

/** True when the stored value is one of our sealed envelopes. */
export function isSealed(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.v === VERSION && typeof v.iv === "string" && typeof v.tag === "string" && typeof v.ct === "string";
}

/** Encrypt a credentials object for storage. Throws if no key is configured. */
export function seal(secrets: Record<string, string>): Record<string, unknown> {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([
    cipher.update(JSON.stringify(secrets), "utf8"),
    cipher.final(),
  ]);
  return {
    v: VERSION,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
  };
}

/**
 * Decrypt stored credentials. A plain (legacy, unencrypted) object is returned
 * as-is so existing connections keep working; that is logged so the drift is
 * visible rather than silent.
 */
export function open(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  if (!isSealed(value)) {
    if (Object.keys(value as object).length > 0) {
      console.warn("[crypto-box] reading UNENCRYPTED credentials — re-save this connection to seal it");
    }
    return value as Record<string, string>;
  }
  const v = value as { iv: string; tag: string; ct: string };
  const decipher = createDecipheriv("aes-256-gcm", loadKey(), Buffer.from(v.iv, "base64"));
  decipher.setAuthTag(Buffer.from(v.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(v.ct, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plain) as Record<string, string>;
}

/** Is credential encryption available in this environment? */
export function sealingAvailable(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}
