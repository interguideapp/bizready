// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gateDocument, type GeneratedDoc } from "@/lib/documents/generators";

vi.mock("@/lib/actions", () => ({ addDocument: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

afterEach(cleanup);

/**
 * The paywall, verified against the rendered DOM.
 *
 * gate.test.ts already proves the gated sections are absent from the
 * SERIALISED document. This proves the other half: that the component renders
 * only what it was given and does not reintroduce the gated content into the
 * page. The original defect was exactly that split — the server sent
 * everything and the client cropped it with `.slice(0, 1)`, so the full
 * document sat in the page source of a free account.
 *
 * Checking `container.innerHTML` rather than a query is deliberate: the point
 * is that the text is nowhere in the DOM at all, not merely that it is hidden.
 */
const doc: GeneratedDoc = {
  title: "הסכם התקשרות",
  intro: "מבוא",
  sections: [
    { heading: "הצדדים", paragraphs: ["פתיח גלוי"] },
    { heading: "תנאי תשלום", paragraphs: ["שוטף פלוס שלושים"] },
    { heading: "קניין רוחני", paragraphs: ["כל הזכויות שמורות"] },
  ],
  disclaimer: "אינו ייעוץ משפטי",
  updatedLabel: "עודכן: 11.09.2026",
};

async function renderDoc(pro: boolean) {
  const { DocumentGenerator } = await import("./document-generator");
  return render(
    <DocumentGenerator
      doc={gateDocument(doc, pro)}
      businessName="עסק לדוגמה"
      generatorId="client-agreement"
      title="הסכם התקשרות"
      description="הסכם מוכן מפרטי העסק"
      category="agreements"
      taskId="task-1"
      isPro={pro}
    />
  );
}

describe("gated sections are not in the DOM at all", () => {
  it("a free account gets the first section and nothing past it", async () => {
    const { container } = await renderDoc(false);
    expect(container.innerHTML).toContain("פתיח גלוי");
    // Not hidden — absent.
    expect(container.innerHTML).not.toContain("שוטף פלוס שלושים");
    expect(container.innerHTML).not.toContain("כל הזכויות שמורות");
    expect(container.innerHTML).not.toContain("קניין רוחני");
  });

  it("and is told how much more there is, without being shown it", async () => {
    const { container } = await renderDoc(false);
    expect(container.textContent).toContain("עוד 2 סעיפים");
  });

  it("a Pro account gets the whole document", async () => {
    const { container } = await renderDoc(true);
    expect(container.innerHTML).toContain("פתיח גלוי");
    expect(container.innerHTML).toContain("שוטף פלוס שלושים");
    expect(container.innerHTML).toContain("כל הזכויות שמורות");
  });

  it("the preview still carries the title and the disclaimer", async () => {
    // A paywall should crop the content, not hide what the document IS.
    const { container } = await renderDoc(false);
    expect(container.textContent).toContain("הסכם התקשרות");
    expect(container.textContent).toContain("אינו ייעוץ משפטי");
  });
});
