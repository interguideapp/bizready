import { beforeAll, describe, expect, it } from "vitest";
import { seal, open, isSealed, sealingAvailable } from "./crypto-box";

const KEY = "a".repeat(64); // 32 bytes of 0xaa

describe("crypto-box", () => {
  beforeAll(() => {
    process.env.CREDENTIALS_KEY = KEY;
  });

  it("round-trips a credentials object", () => {
    const secrets = { api_key: "k-123", api_secret: "s-456", password: "hunter2" };
    const sealed = seal(secrets);
    expect(isSealed(sealed)).toBe(true);
    expect(open(sealed)).toEqual(secrets);
  });

  it("never leaves the secret readable in the stored envelope", () => {
    const sealed = seal({ password: "hunter2" });
    expect(JSON.stringify(sealed)).not.toContain("hunter2");
    expect(JSON.stringify(sealed)).not.toContain("password");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = JSON.stringify(seal({ api_key: "same" }));
    const b = JSON.stringify(seal({ api_key: "same" }));
    expect(a).not.toBe(b);
  });

  it("rejects a tampered ciphertext rather than returning garbage", () => {
    const sealed = seal({ api_key: "k-123" }) as Record<string, string>;
    const tampered = { ...sealed, ct: Buffer.from("not-the-real-ciphertext").toString("base64") };
    expect(() => open(tampered)).toThrow();
  });

  it("reads a legacy plaintext object unchanged", () => {
    expect(open({ api_key: "legacy" })).toEqual({ api_key: "legacy" });
    expect(isSealed({ api_key: "legacy" })).toBe(false);
  });

  it("treats empty/missing values as no credentials", () => {
    expect(open(null)).toEqual({});
    expect(open({})).toEqual({});
  });

  it("fails closed on write when no key is configured", () => {
    const saved = process.env.CREDENTIALS_KEY;
    delete process.env.CREDENTIALS_KEY;
    expect(sealingAvailable()).toBe(false);
    expect(() => seal({ api_key: "x" })).toThrow(/CREDENTIALS_KEY/);
    process.env.CREDENTIALS_KEY = saved;
  });

  it("rejects a key of the wrong length", () => {
    const saved = process.env.CREDENTIALS_KEY;
    process.env.CREDENTIALS_KEY = "abcd";
    expect(() => seal({ a: "b" })).toThrow(/64 hex/);
    process.env.CREDENTIALS_KEY = saved;
  });
});
