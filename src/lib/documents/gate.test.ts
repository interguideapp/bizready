import { describe, expect, it } from "vitest";
import { gateDocument, type GeneratedDoc } from "./generators";

/**
 * The paywall has to be a decision about what the server SENDS.
 *
 * Before this, the generator built the whole document regardless of tier and
 * shipped it in the RSC payload; the client component then did
 * `doc.sections.slice(0, 1)` for display. So every Pro-only clause of a client
 * agreement or a privacy policy was in the page source of a free account, one
 * devtools panel away — and, with no `inert` or `aria-hidden`, fully available
 * to a screen reader too.
 */

const doc: GeneratedDoc = {
  title: "הסכם התקשרות",
  intro: "מבוא",
  sections: [
    { heading: "הצדדים", paragraphs: ["פתיח חופשי"] },
    { heading: "תנאי תשלום", paragraphs: ["שוטף + 30"] },
    { heading: "קניין רוחני", paragraphs: ["כל הזכויות"] },
    { heading: "סיום ההתקשרות", paragraphs: ["הודעה מוקדמת"] },
  ],
  disclaimer: "אינו ייעוץ משפטי",
  updatedLabel: "עודכן: 11.09.2026",
};

describe("gateDocument", () => {
  it("gives a Pro account the whole document, untouched", () => {
    expect(gateDocument(doc, true)).toBe(doc);
  });

  it("withholds the gated sections entirely — not just hides them", () => {
    const gated = gateDocument(doc, false);
    expect(gated.sections).toHaveLength(1);
    expect(gated.sections[0].heading).toBe("הצדדים");
  });

  it("leaves no trace of the withheld content anywhere in the payload", () => {
    // This is the actual regression test: serialise the gated document and
    // confirm the paywalled text is simply not in it. The old implementation
    // would have failed this while looking correct on screen.
    const serialised = JSON.stringify(gateDocument(doc, false));
    expect(serialised).not.toContain("קניין רוחני");
    expect(serialised).not.toContain("שוטף + 30");
    expect(serialised).not.toContain("הודעה מוקדמת");
    expect(serialised).not.toContain("כל הזכויות");
  });

  it("reports how many sections were withheld, so the UI can be honest", () => {
    // The count is the only thing about the hidden sections that may reach the
    // browser — enough to say "3 more with Pro", not enough to read them.
    expect(gateDocument(doc, false).gatedSectionCount).toBe(3);
  });

  it("keeps the title, intro and disclaimer — the preview is still a preview", () => {
    const gated = gateDocument(doc, false);
    expect(gated.title).toBe(doc.title);
    expect(gated.intro).toBe(doc.intro);
    expect(gated.disclaimer).toBe(doc.disclaimer);
    expect(gated.updatedLabel).toBe(doc.updatedLabel);
  });

  it("reports zero withheld for a single-section document", () => {
    const single: GeneratedDoc = { ...doc, sections: [doc.sections[0]] };
    const gated = gateDocument(single, false);
    expect(gated.sections).toHaveLength(1);
    expect(gated.gatedSectionCount).toBe(0);
  });

  it("never reports a negative count for an empty document", () => {
    const empty: GeneratedDoc = { ...doc, sections: [] };
    expect(gateDocument(empty, false).gatedSectionCount).toBe(0);
  });
});
