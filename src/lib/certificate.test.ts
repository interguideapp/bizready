import { describe, expect, it } from "vitest";
import { buildCertificate, type CertificateTask } from "@/lib/certificate";
import { TASK_TEMPLATES, TEMPLATES_BY_ID } from "@/lib/content";
import { completionSpecOf } from "@/lib/types";
import type { TaskTemplate } from "@/lib/types";

/**
 * THE CARD COULD NOT SHOW WHAT THE BUSINESS HAD DONE.
 *
 * Measured across the content: 73 templates, 33 capture an artefact on
 * completion, and only SEVEN reach the business card — those are the ones with
 * a `writesTo`. So a business that had opened its VAT file, registered a
 * domain, bought professional-liability cover and set up a pension could show
 * a card with a VAT number and no sign of the other three.
 *
 * The artefacts were already stored: every completion field lands in
 * business_tasks.completion_data. The certificate derives from them rather
 * than copying them into sixty new columns, so the task's own evidence stays
 * the single source.
 */
const template = (over: Partial<TaskTemplate>): TaskTemplate =>
  ({
    id: "t1",
    category_id: "tax",
    title: "משימה",
    why: "",
    steps: "",
    official_links: [],
    docs_needed: [],
    applies_when: {},
    depends_on: [],
    priority: "critical",
    last_reviewed: "2026-09-01",
    sort_order: 1,
    ...over,
  }) as TaskTemplate;

const task = (over: Partial<CertificateTask>): CertificateTask => ({
  template_id: "t1",
  status: "done",
  completed_at: "2026-09-10T09:00:00Z",
  completion_data: null,
  is_relevant: true,
  ...over,
});

describe("what reaches the certificate", () => {
  const templates = new Map([
    [
      "t1",
      template({
        id: "t1",
        title: "פתיחת תיק עוסק במע״מ",
        completion: {
          confirm: "פתחתי",
          fields: [
            { key: "dealer_number", label: "מספר העוסק שקיבלת", writesTo: "dealer_number" },
            { key: "vat_file", label: "מספר תיק מע״מ" },
          ],
        },
      }),
    ],
  ]);

  it("uses the label the user was asked for, not the stored key", () => {
    const cert = buildCertificate(
      [task({ completion_data: { dealer_number: "123456789" } })],
      templates
    );
    expect(cert.entries[0].items[0].label).toBe("מספר העוסק שקיבלת");
    expect(cert.entries[0].items[0].value).toBe("123456789");
  });

  it("counts every artefact, which is what filling the card means", () => {
    const cert = buildCertificate(
      [task({ completion_data: { dealer_number: "123456789", vat_file: "998877" } })],
      templates
    );
    expect(cert.recorded).toBe(2);
  });

  it("keeps the order the fields were asked in", () => {
    const cert = buildCertificate(
      [task({ completion_data: { vat_file: "998877", dealer_number: "123456789" } })],
      templates
    );
    expect(cert.entries[0].items.map((i) => i.key)).toEqual(["dealer_number", "vat_file"]);
  });

  it("carries the field type, so a URL can render as a link and a date as a date", () => {
    const withTypes = new Map([
      [
        "t1",
        template({
          completion: {
            confirm: "c",
            fields: [{ key: "site", label: "כתובת האתר", type: "url" }],
          },
        }),
      ],
    ]);
    const cert = buildCertificate(
      [task({ completion_data: { site: "https://example.co.il" } })],
      withTypes
    );
    expect(cert.entries[0].items[0].type).toBe("url");
  });
});

/**
 * ONE NUMBER, ONE PLACE IT COMES FROM.
 *
 * Seven completion fields declare `writesTo`, which means the same value is
 * ALSO an editable row on the business card, on the same page. Read the stored
 * answer and the moment someone fixes a typo on the card the certificate keeps
 * showing the old number — two sources for one fact, which is the failure this
 * module was written to remove, reintroduced two inches lower on the screen.
 */
describe("a field that writes to the card reads back from the card", () => {
  const templates = new Map([
    [
      "t1",
      template({
        completion: {
          confirm: "c",
          fields: [
            { key: "dealer_number", label: "מספר העוסק", writesTo: "dealer_number" },
            { key: "note", label: "הערה" },
          ],
        },
      }),
    ],
  ]);
  const stored = { dealer_number: "111111111", note: "כלום" };

  it("shows the corrected card value, not the answer given at completion", () => {
    const cert = buildCertificate([task({ completion_data: stored })], templates, {
      dealer_number: "999999999",
    });
    const item = cert.entries[0].items.find((i) => i.key === "dealer_number")!;
    expect(item.value).toBe("999999999");
    expect(item.live).toBe(true);
  });

  it("falls back to the stored answer when the column is empty", () => {
    for (const column of [null, undefined, "", "   "]) {
      const cert = buildCertificate([task({ completion_data: stored })], templates, {
        dealer_number: column,
      });
      const item = cert.entries[0].items.find((i) => i.key === "dealer_number")!;
      expect(item.value, String(column)).toBe("111111111");
      expect(item.live, String(column)).toBe(false);
    }
  });

  /**
   * The declared `writesTo` decides, not the key's name.
   *
   * Content really does have field keys named after card columns —
   * `vat_file`, `bank_name`, `bank_account`, `accountant_name` — so matching a
   * card column by key would work most of the time and then attribute the
   * card's bank account to a task that never asked for it.
   */
  it("leaves a field with no writesTo alone, even when its key names a card column", () => {
    const byKey = new Map([
      [
        "t1",
        template({
          completion: {
            confirm: "c",
            fields: [{ key: "bank_account", label: "לאיזה חשבון הועבר" }],
          },
        }),
      ],
    ]);
    const cert = buildCertificate(
      [task({ completion_data: { bank_account: "12-345-6789" } })],
      byKey,
      { bank_account: "99-999-9999" }
    );
    const item = cert.entries[0].items[0];
    expect(item.value).toBe("12-345-6789");
    expect(item.live).toBe(false);
  });

  it("works with no business row at all, so a caller without one is not forced to fake it", () => {
    const cert = buildCertificate([task({ completion_data: stored })], templates);
    expect(cert.entries[0].items.map((i) => i.value)).toEqual(["111111111", "כלום"]);
  });
});

describe("what must never reach it", () => {
  const templates = new Map([["t1", template({ id: "t1" })]]);

  it("ignores the machine-proposed evidence a webhook wrote", () => {
    const cert = buildCertificate(
      [task({ completion_data: { __proposed_evidence: { note: "x" } } })],
      templates
    );
    expect(cert.entries).toEqual([]);
    expect(cert.captureless.map((c) => c.templateId)).toEqual(["t1"]);
  });

  /**
   * Excluded by the `__` prefix, not by happening to hold an object.
   *
   * Both internal keys that exist today — `__steps_done` and
   * `__proposed_evidence` — store an array and an object, so the
   * non-string rule alone hides them and the prefix rule is invisible.
   * Removing it would pass every other test here and then leak the first
   * internal key someone stores as a string onto the certificate.
   */
  it("excludes an internal key by its prefix even when it holds a string", () => {
    const cert = buildCertificate(
      [task({ completion_data: { __internal_note: "machine text", real: "v" } })],
      templates
    );
    expect(cert.entries[0].items.map((i) => i.key)).toEqual(["real"]);
  });

  it("ignores a non-string value rather than printing [object Object]", () => {
    const cert = buildCertificate(
      [task({ completion_data: { odd: { a: 1 }, fine: "yes" } })],
      templates
    );
    expect(cert.entries[0].items.map((i) => i.key)).toEqual(["fine"]);
  });

  it("ignores a blank answer", () => {
    const cert = buildCertificate(
      [task({ completion_data: { a: "   ", b: "real" } })],
      templates
    );
    expect(cert.entries[0].items.map((i) => i.key)).toEqual(["b"]);
  });

  it("includes nothing from a task that is not done", () => {
    for (const status of ["todo", "in_progress", "waiting", "not_applicable"]) {
      const cert = buildCertificate(
        [task({ status, completion_data: { dealer_number: "1" } })],
        templates
      );
      expect(cert.entries, status).toEqual([]);
      expect(cert.captureless, status).toEqual([]);
    }
  });

  it("includes nothing from a task whose rule no longer applies", () => {
    const cert = buildCertificate(
      [task({ is_relevant: false, completion_data: { dealer_number: "1" } })],
      templates
    );
    expect(cert.entries).toEqual([]);
  });

  it("ignores a row whose template is gone from the content", () => {
    const cert = buildCertificate(
      [task({ template_id: "deleted-template", completion_data: { a: "1" } })],
      templates
    );
    expect(cert.entries).toEqual([]);
    expect(cert.captureless).toEqual([]);
  });
});

/**
 * A TEMPLATE WITH NO BESPOKE SPEC STILL ASKS A QUESTION.
 *
 * Forty of the 73 templates declare no completion fields, and the flow falls
 * back to DEFAULT_COMPLETION — a required free-text "מה עשית בפועל?". That is
 * what is actually in the database: the live row for business-name-check holds
 * `{note: "בדקתי אונליין"}`.
 *
 * Reading `template.completion` directly finds no spec for those, so the
 * answer came out labelled `note` — a column name printed on a page that
 * calls itself a certificate. The fallback has to be resolved the same way the
 * flow resolves it, which is why there is now one function that does it.
 */
describe("the fallback question is resolved the way the flow resolves it", () => {
  const templates = new Map([["t1", template({ id: "t1" })]]);

  it("labels the default note with its question, never with the key", () => {
    const cert = buildCertificate(
      [task({ completion_data: { note: "בדקתי אונליין" } })],
      templates
    );
    const item = cert.entries[0].items[0];
    expect(item.value).toBe("בדקתי אונליין");
    expect(item.label).not.toBe("note");
    expect(item.label).toContain("מה עשית");
    expect(item.fromSpec).toBe(true);
  });

  it("agrees with the spec the completion flow would have shown", () => {
    // The premise, stated against the shared resolver rather than a copy of
    // its result: a template with no completion still has a field to answer.
    const spec = completionSpecOf(template({ id: "t1" }));
    expect(spec.fields?.map((f) => f.key)).toEqual(["note"]);
  });
});

describe("a stored key the spec no longer asks for is shown, not hidden", () => {
  const templates = new Map([
    [
      "t1",
      template({
        completion: { confirm: "c", fields: [{ key: "current", label: "שדה נוכחי" }] },
      }),
    ],
  ]);

  it("keeps the value under its raw key and marks it unrecognised", () => {
    const cert = buildCertificate(
      [task({ completion_data: { current: "a", legacy_field: "b" } })],
      templates
    );
    const legacy = cert.entries[0].items.find((i) => i.key === "legacy_field")!;
    expect(legacy.value).toBe("b");
    expect(legacy.label).toBe("legacy_field");
    expect(legacy.fromSpec).toBe(false);
  });

  it("and sorts it after the fields still asked for", () => {
    const cert = buildCertificate(
      [task({ completion_data: { legacy_field: "b", current: "a" } })],
      templates
    );
    expect(cert.entries[0].items.map((i) => i.key)).toEqual(["current", "legacy_field"]);
  });
});

describe("the completed tasks that leave no trace are named", () => {
  const templates = new Map([
    [
      "t1",
      template({
        title: "עם ראיה",
        completion: { confirm: "c", fields: [{ key: "k", label: "l" }] },
      }),
    ],
    ["t2", template({ id: "t2", title: "בלי ראיה" })],
  ]);

  it("separates them from the entries instead of dropping them", () => {
    const cert = buildCertificate(
      [
        task({ template_id: "t1", completion_data: { k: "v" } }),
        task({ template_id: "t2" }),
      ],
      templates
    );
    expect(cert.entries.map((e) => e.templateId)).toEqual(["t1"]);
    expect(cert.captureless.map((c) => c.title)).toEqual(["בלי ראיה"]);
  });
});

describe("ordering", () => {
  const templates = new Map([
    [
      "t1",
      template({ title: "א", completion: { confirm: "c", fields: [{ key: "k", label: "l" }] } }),
    ],
    [
      "t2",
      template({
        id: "t2",
        title: "ב",
        completion: { confirm: "c", fields: [{ key: "k", label: "l" }] },
      }),
    ],
  ]);

  it("puts the most recent work first", () => {
    const cert = buildCertificate(
      [
        task({ template_id: "t1", completed_at: "2026-01-01T09:00:00Z", completion_data: { k: "v" } }),
        task({ template_id: "t2", completed_at: "2026-09-01T09:00:00Z", completion_data: { k: "v" } }),
      ],
      templates
    );
    expect(cert.entries.map((e) => e.templateId)).toEqual(["t2", "t1"]);
  });

  it("sorts a row with no date last, so it cannot displace this week's work", () => {
    const cert = buildCertificate(
      [
        task({ template_id: "t1", completed_at: null, completion_data: { k: "v" } }),
        task({ template_id: "t2", completed_at: "2026-09-01T09:00:00Z", completion_data: { k: "v" } }),
      ],
      templates
    );
    expect(cert.entries.map((e) => e.templateId)).toEqual(["t2", "t1"]);
  });
});

describe("against the real content", () => {
  it("the premise: templates really do declare completion fields", () => {
    const withFields = TASK_TEMPLATES.filter((t) => (t.completion?.fields?.length ?? 0) > 0);
    expect(withFields.length).toBeGreaterThan(20);
  });

  it("a real VAT completion produces a readable certificate line", () => {
    const cert = buildCertificate(
      [
        {
          template_id: "open-vat-file",
          status: "done",
          completed_at: "2026-09-10T09:00:00Z",
          is_relevant: true,
          completion_data: { dealer_number: "123456789" },
        },
      ],
      TEMPLATES_BY_ID
    );
    expect(cert.entries).toHaveLength(1);
    expect(cert.entries[0].items).toHaveLength(1);
    const item = cert.entries[0].items[0];
    expect(item.fromSpec).toBe(true);
    expect(item.label).not.toBe("dealer_number");
    expect(item.label.length).toBeGreaterThan(3);
    expect(item.value).toBe("123456789");
  });

  it("the step-tracker's own bookkeeping never shows up as evidence", () => {
    const cert = buildCertificate(
      [
        {
          template_id: "open-vat-file",
          status: "done",
          completed_at: "2026-09-10T09:00:00Z",
          is_relevant: true,
          completion_data: { __steps_done: ["0", "1"], dealer_number: "123456789" },
        },
      ],
      TEMPLATES_BY_ID
    );
    expect(cert.entries[0].items.map((i) => i.key)).toEqual(["dealer_number"]);
  });
});
