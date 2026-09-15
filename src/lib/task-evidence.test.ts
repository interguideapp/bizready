import { describe, expect, it } from "vitest";
import { ALREADY_DONE_OPTIONS, TEMPLATES_BY_ID } from "@/lib/content";
import { cardWritesFor, primaryArtefactOf } from "@/lib/task-evidence";
import { completionSpecOf } from "@/lib/types";
import { sanitizeAlreadyDoneEvidence } from "@/lib/validate-answers";

/**
 * A NEW USER'S FIRST SCREEN CONTRADICTED ITSELF FOUR WAYS.
 *
 * The registration wizard's last step asks "מה כבר יש?" and closes every task
 * the owner ticks. It recorded nothing. Measured across the content: all 17
 * options close a task whose spec declares a required answer, and 13 of them
 * declare a `writesTo` that would have filled a business-card column.
 *
 * So someone who truthfully ticked "פתחתי תיק עוסק במע״מ" landed on a card
 * where the task read done, `dealer_number` was empty, "מה חסר ל-100%?" said
 * the number was missing and linked to it, and the certificate said the task
 * had been completed with nothing recorded. One fact, four surfaces, four
 * different stories — and not one of them was reachable by fixing a screen,
 * because the fact had never been collected.
 */

describe("the one answer to ask for when someone says it is already done", () => {
  it("is the template's first required field", () => {
    const field = primaryArtefactOf("open-vat-file");
    expect(field?.key).toBe("dealer_number");
    expect(field?.required).toBe(true);
  });

  it("prefers the required field over an earlier optional one", () => {
    // open-vat-file cannot show this: its required field is also its first,
    // so "first required" and "first" agree there. professional-certification
    // asks an optional `authority` before the required `renewal`, and its
    // expiry is what the renewal cycle runs on — ask for the wrong one and
    // the cycle falls back to guessing a year from the tick.
    const field = primaryArtefactOf("professional-certification");
    expect(field?.key).toBe("renewal");
    const fields = completionSpecOf(TEMPLATES_BY_ID.get("professional-certification")!).fields ?? [];
    expect(fields[0].key).toBe("authority");
  });

  it("falls back to the first field when nothing is required", () => {
    // Derived, not listed, so a template whose fields change cannot leave a
    // stale second list behind saying otherwise.
    const id = "open-vat-file";
    const fields = completionSpecOf(TEMPLATES_BY_ID.get(id)!).fields ?? [];
    expect(primaryArtefactOf(id)).toBe(fields.find((f) => f.required) ?? fields[0]);
  });

  it("is null for an id that is not a template, rather than throwing", () => {
    expect(primaryArtefactOf("no-such-template")).toBeNull();
  });

  /**
   * THE INVARIANT THAT CLOSES THE REGISTRATION HOLE.
   *
   * Every option the wizard offers must have an artefact to ask for. Without
   * this, adding an option to ALREADY_DONE_OPTIONS silently reintroduces
   * exactly the defect above for that one task — and it would look fine,
   * because the plan and the status would both be right.
   */
  it("exists for every option the wizard offers", () => {
    const without = ALREADY_DONE_OPTIONS.filter((o) => !primaryArtefactOf(o.id)).map((o) => o.id);
    expect(without).toEqual([]);
  });

  it("the premise: there really are options to check", () => {
    expect(ALREADY_DONE_OPTIONS.length).toBeGreaterThan(10);
  });
});

describe("which answer may reach which card column", () => {
  it("maps by the declared writesTo, not by the field's name", () => {
    const writes = cardWritesFor("open-vat-file", { dealer_number: "123456789" });
    expect(writes).toEqual({ dealer_number: "123456789" });
  });

  /**
   * The real content cannot show this.
   *
   * Every `writesTo` field shipped today is spelled exactly like its column —
   * dealer_number to dealer_number, bank_name to bank_name — so keying the
   * output by the field's own name produces identical results and every
   * assertion above still passes. A guard that cannot see the defect certifies
   * it, so this one supplies a template where the two genuinely differ.
   */
  it("really reads the declaration, with a template whose key differs from its column", () => {
    const templates = new Map([
      [
        "t1",
        {
          id: "t1",
          completion: {
            confirm: "c",
            fields: [{ key: "the_number_they_gave_me", label: "l", writesTo: "dealer_number" }],
          },
        } as never,
      ],
    ]);
    const writes = cardWritesFor("t1", { the_number_they_gave_me: "123456789" }, templates);
    expect(writes).toEqual({ dealer_number: "123456789" });
    expect(Object.keys(writes)).not.toContain("the_number_they_gave_me");
  });

  it("ignores an answer whose field declares no writesTo", () => {
    // buy-domain records a domain, and no card column holds one.
    expect(cardWritesFor("buy-domain", { domain: "mybiz.co.il" })).toEqual({});
  });

  it("ignores a key the template never asks for", () => {
    expect(cardWritesFor("open-vat-file", { bank_account: "12-345-6789" })).toEqual({});
  });

  /**
   * The reason this function exists rather than a client-supplied map.
   *
   * completeTask used to receive the answer-to-column mapping as a SEPARATE
   * argument built in the browser, and the server checked only that the column
   * was one the template may write. So a caller could put the domain name into
   * `dealer_number` and the server would store it there — and any key at all
   * could be attempted, which is the mass-assignment shape the audit found
   * (`subscription_tier: "pro"` being the one that mattered).
   */
  it("cannot be talked into a column the template does not declare", () => {
    const writes = cardWritesFor("open-vat-file", {
      dealer_number: "123456789",
      subscription_tier: "pro",
      owner_id: "someone-else",
      bank_account: "12-345-6789",
    });
    expect(Object.keys(writes)).toEqual(["dealer_number"]);
  });

  it("drops a blank answer, so it cannot erase a value already on the card", () => {
    for (const blank of ["", "   ", "\t"]) {
      expect(cardWritesFor("open-vat-file", { dealer_number: blank }), JSON.stringify(blank)).toEqual({});
    }
  });

  it("drops a non-string answer rather than storing an object", () => {
    expect(cardWritesFor("open-vat-file", { dealer_number: { a: 1 } })).toEqual({});
    expect(cardWritesFor("open-vat-file", { dealer_number: 123456789 })).toEqual({});
  });

  it("trims, since a copied file number arrives with whitespace", () => {
    expect(cardWritesFor("open-vat-file", { dealer_number: "  123456789 " })).toEqual({
      dealer_number: "123456789",
    });
  });

  it("returns nothing for a template that no longer exists", () => {
    expect(cardWritesFor("no-such-template", { anything: "x" })).toEqual({});
  });

  it("carries every declared column when every answer is given", () => {
    // company-bank-account declares two, which is what stopped a company's
    // card from filling in where a sole trader's did.
    expect(cardWritesFor("company-bank-account", { bank_name: "פועלים", bank_account: "12-345" })).toEqual(
      { bank_name: "פועלים", bank_account: "12-345" }
    );
  });
});

describe("what the server accepts from the wizard", () => {
  it("resolves the answer under the key that template asks for", () => {
    const clean = sanitizeAlreadyDoneEvidence(
      { "open-vat-file": "123456789" },
      ["open-vat-file"]
    );
    expect(clean).toEqual({ "open-vat-file": { dealer_number: "123456789" } });
  });

  /**
   * An artefact cannot smuggle in a completion.
   *
   * buildPlan closes what `already_done` names, and only that. Evidence for a
   * task nobody asserted would be a recorded detail about work the product
   * does not believe was done — and on the certificate it would read as proof.
   */
  it("refuses an artefact for a task that was not ticked", () => {
    expect(sanitizeAlreadyDoneEvidence({ "open-vat-file": "123456789" }, [])).toEqual({});
    expect(
      sanitizeAlreadyDoneEvidence({ "open-vat-file": "1" }, ["open-income-tax-file"])
    ).toEqual({});
  });

  it("refuses an id the wizard does not offer, even if the client claims it was ticked", () => {
    // vat-reporting is a statutory filing: accepting it here would be the
    // already_done hole again, one indirection along.
    expect(sanitizeAlreadyDoneEvidence({ "vat-reporting": "x" }, ["vat-reporting"])).toEqual({});
    expect(sanitizeAlreadyDoneEvidence({ nonsense: "x" }, ["nonsense"])).toEqual({});
  });

  it("refuses a non-string or blank answer", () => {
    for (const bad of [null, 5, true, {}, [], "", "   "]) {
      expect(
        sanitizeAlreadyDoneEvidence({ "open-vat-file": bad }, ["open-vat-file"]),
        JSON.stringify(bad)
      ).toEqual({});
    }
  });

  it("caps the length, since this is stored and then rendered", () => {
    const clean = sanitizeAlreadyDoneEvidence(
      { "open-vat-file": "9".repeat(5000) },
      ["open-vat-file"]
    );
    expect(clean["open-vat-file"].dealer_number.length).toBe(200);
  });

  it("survives a payload that is not an object at all", () => {
    for (const junk of [null, undefined, "x", 5, []]) {
      expect(sanitizeAlreadyDoneEvidence(junk, ["open-vat-file"]), JSON.stringify(junk)).toEqual({});
    }
  });

  /**
   * The caller cannot choose the key, so it cannot store evidence under a
   * name the template does not use — which the certificate would then print
   * under that raw name.
   */
  it("ignores a key the client invented and uses the template's own", () => {
    const clean = sanitizeAlreadyDoneEvidence({ "open-vat-file": "123456789" }, ["open-vat-file"]);
    expect(Object.keys(clean["open-vat-file"])).toEqual(["dealer_number"]);
  });

  /**
   * The value is a STRING, and a nested object is not a shortcut around that.
   *
   * The test above sends a string, so it cannot see a sanitizer that passes a
   * `{key: value}` payload straight through — and passing one through is the
   * whole hole: the caller would then choose the key, storing evidence under a
   * name the template never asked for (which the certificate prints under that
   * raw name) and, worse, one that maps to a card column on a different task.
   */
  it("refuses a nested object, which would let the caller choose the key", () => {
    const clean = sanitizeAlreadyDoneEvidence(
      { "open-vat-file": { subscription_tier: "pro", bank_account: "12-345" } },
      ["open-vat-file"]
    );
    expect(clean).toEqual({});
  });
});

/**
 * END TO END OVER THE REAL CONTENT: ticking a box and answering it must leave
 * the card filled, for every option that has a column to fill.
 *
 * This is the assertion the four contradicting surfaces reduce to. If it
 * holds, the task list, the card, the completeness checklist and the
 * certificate are all reading the same fact.
 */
describe("registration fills the card for every option that can fill it", () => {
  const withColumns = ALREADY_DONE_OPTIONS.filter((o) => {
    const fields = completionSpecOf(TEMPLATES_BY_ID.get(o.id)!).fields ?? [];
    return fields.some((f) => f.writesTo);
  });

  it("the premise: most options do have a column to fill", () => {
    expect(withColumns.length).toBeGreaterThan(5);
  });

  it("the primary artefact of each one lands in a card column", () => {
    const silent: string[] = [];
    for (const o of withColumns) {
      const field = primaryArtefactOf(o.id)!;
      // Only meaningful where the PRIMARY field is the one with the column;
      // an option whose first required field has no writesTo still fills
      // nothing from the wizard, and that is the state worth naming.
      const clean = sanitizeAlreadyDoneEvidence({ [o.id]: "ANSWER" }, [o.id]);
      const writes = cardWritesFor(o.id, clean[o.id] ?? {});
      if (!field.writesTo || Object.keys(writes).length === 0) silent.push(o.id + "." + field.key);
    }
    expect(silent).toEqual([]);
  });
});
