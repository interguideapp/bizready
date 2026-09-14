import { describe, expect, it } from "vitest";
import { DOCUMENT_EXPIRY_HREF, SYNC_ERROR_HREF } from "@/lib/destinations";
import { attentionHref } from "@/lib/live-attention";

/**
 * ONE ITEM, ONE DESTINATION, WHICHEVER SCREEN SHOWS IT.
 *
 * A document expiry appears on the obligations board and in the alerts list.
 * The alerts list sent it to /documents. The board sent it nowhere: its rows
 * became links, and the expiry was deliberately left as plain text with the
 * reasoning "an expiry has no task" — true about tasks, and the wrong question.
 * An expiring certificate is replaced on /documents.
 *
 * So the row warning that cover lapses in five days was the only dead end on
 * that screen, while the identical item one tab over was actionable. Not a
 * wrong fact: a surface that stops being worth pressing.
 *
 * The two still decide from their own shapes — an Obligation has a kind, an
 * attention item has a dedupe key — but the ANSWER is one constant, so they
 * cannot come to disagree again.
 */
describe("the alerts list routes through the shared constants", () => {
  it("sends a document expiry to the documents screen", () => {
    expect(attentionHref({ templateId: null, dedupeKey: "doc-expiry:insurance:2026-10-01" })).toBe(
      DOCUMENT_EXPIRY_HREF
    );
  });

  it("sends an already-expired document to the same place", () => {
    // Two dedupe prefixes, one destination: replacing the document is the
    // action either way.
    expect(attentionHref({ templateId: null, dedupeKey: "doc-expired:insurance:2026-08-01" })).toBe(
      DOCUMENT_EXPIRY_HREF
    );
  });

  it("sends a broken sync to the connection screen", () => {
    expect(attentionHref({ templateId: null, dedupeKey: "sync:2026-09-14T10:00:00Z" })).toBe(
      SYNC_ERROR_HREF
    );
  });

  it("prefers the task when there is one", () => {
    expect(attentionHref({ templateId: "vat-reporting", dedupeKey: "deadline:x" })).toBe(
      "/tasks/vat-reporting?from=notifications"
    );
  });

  it("returns null when there is genuinely nowhere to go", () => {
    // Which is what keeps the link meaningful on the surfaces that use it.
    expect(attentionHref({ templateId: null, dedupeKey: "cycle:vat:2026-07..2026-08" })).toBeNull();
  });
});

describe("the constants carry no query string", () => {
  it("is a bare path, because /documents reads no searchParams", () => {
    // My first version of the board's link was "/documents?from=calendar",
    // which made one destination look like two while changing nothing: that
    // page does not read searchParams at all.
    expect(DOCUMENT_EXPIRY_HREF).toBe("/documents");
    expect(DOCUMENT_EXPIRY_HREF).not.toContain("?");
    expect(SYNC_ERROR_HREF).not.toContain("?");
  });
});
