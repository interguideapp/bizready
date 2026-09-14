// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BusinessCertificate } from "./business-certificate";
import { buildCertificate, type Certificate } from "@/lib/certificate";
import { LOGO_TEMPLATE_ID, TEMPLATES_BY_ID } from "@/lib/content";

/**
 * WHAT THE CERTIFICATE ACTUALLY PUTS ON THE SCREEN.
 *
 * lib/certificate.ts is tested as a function; this is the half that can be
 * wrong while every one of those tests passes — a value derived correctly and
 * then rendered under its column name, an https address printed as text, or a
 * timestamp formatted in the server's zone (which is UTC on Vercel, so for two
 * to three hours each evening it shows the previous Israeli day — the defect
 * he-moment.test.ts exists to catch, and it caught this component's first
 * version).
 */
afterEach(cleanup);

const cert = (over: Partial<Certificate> = {}): Certificate => ({
  entries: [],
  captureless: [],
  recorded: 0,
  ...over,
});

describe("nothing to show", () => {
  it("renders nothing at all rather than an empty heading", () => {
    const { container } = render(<BusinessCertificate certificate={cert()} />);
    expect(container.textContent).toBe("");
  });
});

describe("an artefact on the screen", () => {
  const one = cert({
    entries: [
      {
        templateId: "open-vat-file",
        title: "פתיחת תיק עוסק במע״מ",
        categoryId: "tax",
        completedAt: "2026-09-10T08:00:00Z",
        items: [
          {
            key: "dealer_number",
            label: "מספר העוסק שקיבלת",
            value: "123456789",
            fromSpec: true,
            live: true,
          },
        ],
      },
    ],
    recorded: 1,
  });

  it("shows the value under the words the user was asked, not the column name", () => {
    render(<BusinessCertificate certificate={one} />);
    expect(screen.getByText("מספר העוסק שקיבלת")).toBeTruthy();
    expect(screen.getByText("123456789")).toBeTruthy();
    expect(document.body.textContent).not.toContain("dealer_number");
  });

  it("links to the task that produced it, so the evidence is one click away", () => {
    render(<BusinessCertificate certificate={one} />);
    const link = screen.getByRole("link", { name: /פתיחת תיק עוסק/ });
    expect(link.getAttribute("href")).toBe("/tasks/open-vat-file");
  });

  it("shows when it was done", () => {
    render(<BusinessCertificate certificate={one} />);
    expect(document.body.textContent).toContain("10.9.2026");
  });

  /**
   * RUN AS THE SERVER RUNS, or this assertion certifies the bug.
   *
   * 22:30 UTC on the 10th is 01:30 on the 11th in Israel. This host resolves
   * to Asia/Bangkok (UTC+7), where `toLocaleDateString` ALSO says the 11th —
   * so the first version of this test passed with the raw formatter planted
   * back in, which is worse than having no test. Vercel runs UTC, where the
   * raw formatter says the 10th: a filing recorded a day early, every evening.
   *
   * So the process zone is pinned to UTC for the duration, and restored, since
   * that is the only zone where the right answer and the wrong one differ.
   */
  it("dates the completion in Israel even when the server is on UTC", () => {
    const original = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      const evening = cert({
        entries: [{ ...one.entries[0], completedAt: "2026-09-10T22:30:00Z" }],
      });
      // The premise: in this zone the two formatters genuinely disagree.
      expect(new Date("2026-09-10T22:30:00Z").toLocaleDateString("he-IL")).toBe("10.9.2026");

      render(<BusinessCertificate certificate={evening} />);
      expect(document.body.textContent).toContain("11.9.2026");
      expect(document.body.textContent).not.toContain("10.9.2026");
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("the kind of value decides how it reads", () => {
  const item = (over: object) => ({
    key: "k",
    label: "l",
    value: "v",
    fromSpec: true,
    live: false,
    ...over,
  });
  const withItem = (over: object) =>
    cert({
      entries: [
        {
          templateId: "t",
          title: "משימה",
          categoryId: "c",
          completedAt: null,
          items: [item(over) as never],
        },
      ],
      recorded: 1,
    });

  it("makes a website address an opening link, not a string to retype", () => {
    render(
      <BusinessCertificate
        certificate={withItem({ type: "url", value: "https://mybiz.co.il" })}
      />
    );
    const link = screen.getByRole("link", { name: /mybiz\.co\.il/ });
    expect(link.getAttribute("href")).toBe("https://mybiz.co.il");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("renders an identifier LTR, so its digits do not reorder inside the Hebrew line", () => {
    render(<BusinessCertificate certificate={withItem({ type: "reference", value: "A-1234/26" })} />);
    expect(screen.getByText("A-1234/26").getAttribute("dir")).toBe("ltr");
  });

  it("writes a date out, since nobody reads a certificate in 2026-09-10", () => {
    render(<BusinessCertificate certificate={withItem({ type: "date", value: "2026-09-10" })} />);
    const text = document.body.textContent ?? "";
    expect(text).toContain("10.9.2026");
    expect(text).not.toContain("2026-09-10");
  });

  it("leaves Hebrew free text in the page direction", () => {
    render(<BusinessCertificate certificate={withItem({ type: "text", value: "רואה חשבון כהן" })} />);
    expect(screen.getByText("רואה חשבון כהן").getAttribute("dir")).toBeNull();
  });

  it("and leaves an untyped field alone too, since most of them hold Hebrew", () => {
    render(<BusinessCertificate certificate={withItem({ value: "בדקתי אונליין" })} />);
    expect(screen.getByText("בדקתי אונליין").getAttribute("dir")).toBeNull();
  });
});

/**
 * THE LOGO IS THE BRANDING TASK'S ARTEFACT, AND IT IS A FILE.
 *
 * Everything else here arrives through completion_data. The logo cannot: it is
 * an image in Storage under businesses.logo_path, uploaded further down the
 * same page. So "מיתוג בסיסי" was a task that could be complete while the card
 * showed no logo, and the logo could exist while the task read undone — two
 * rows about one fact that never referred to each other.
 */
describe("the logo belongs to the task that produced it", () => {
  const branding = (items = 1) =>
    cert({
      entries: [
        {
          templateId: LOGO_TEMPLATE_ID,
          title: "מיתוג בסיסי",
          categoryId: "marketing",
          completedAt: "2026-09-10T08:00:00Z",
          items: Array.from({ length: items }, (_, i) => ({
            key: "brand_name" + i,
            label: "השם המסחרי",
            value: "העסק שלי",
            fromSpec: true,
            live: false,
          })),
        },
      ],
      recorded: items,
    });

  it("shows the uploaded logo inside that entry", () => {
    render(<BusinessCertificate certificate={branding()} logoUrl="https://signed.example/logo.png" />);
    const img = screen.getByAltText("הלוגו של העסק") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://signed.example/logo.png");
  });

  it("says the logo is missing, and links to where it is uploaded", () => {
    render(<BusinessCertificate certificate={branding()} logoUrl={null} />);
    expect(screen.queryByAltText("הלוגו של העסק")).toBeNull();
    const link = screen.getByRole("link", { name: /חסר הלוגו/ });
    expect(link.getAttribute("href")).toBe("#logo");
  });

  it("does not put the logo on any other task's entry", () => {
    const other = cert({
      entries: [
        {
          templateId: "buy-domain",
          title: "רכישת דומיין",
          categoryId: "digital",
          completedAt: null,
          items: [
            { key: "domain", label: "הדומיין", value: "mybiz.co.il", fromSpec: true, live: false },
          ],
        },
      ],
      recorded: 1,
    });
    render(<BusinessCertificate certificate={other} logoUrl="https://signed.example/logo.png" />);
    expect(screen.queryByAltText("הלוגו של העסק")).toBeNull();
    expect(document.body.textContent).not.toContain("חסר הלוגו");
  });

  it("the premise: that template id is a real one and the branding task", () => {
    const template = TEMPLATES_BY_ID.get(LOGO_TEMPLATE_ID);
    expect(template, LOGO_TEMPLATE_ID + " is not a template any more").toBeTruthy();
    expect(template!.title).toContain("לוגו");
  });
});

describe("the completed tasks that recorded nothing", () => {
  it("are named, in a Hebrew count that reads right at one, two and three", () => {
    const names = ["רכישת דומיין", "בניית אתר", "וואטסאפ ביזנס"];
    for (const [n, expected] of [
      [1, "משימה אחת הושלמה"],
      [2, "שתי משימות הושלמו"],
      [3, "3 משימות הושלמו"],
    ] as const) {
      cleanup();
      render(
        <BusinessCertificate
          certificate={cert({
            captureless: names.slice(0, n).map((title, i) => ({ templateId: "t" + i, title })),
          })}
        />
      );
      const text = document.body.textContent ?? "";
      expect(text, String(n)).toContain(expected);
      // A numeral 1 or 2 beside a plural is the seventh instance of the same
      // mistake in this codebase; he-plural.test.ts sweeps for the shape.
      expect(text, String(n)).not.toMatch(/[12] משימות/);
      expect(screen.getByRole("link", { name: names[n - 1] })).toBeTruthy();
    }
  });
});

describe("end to end, over the real content", () => {
  it("a business that opened its VAT file sees its number and nothing invented", () => {
    const certificate = buildCertificate(
      [
        {
          template_id: "open-vat-file",
          status: "done",
          completed_at: "2026-09-10T08:00:00Z",
          is_relevant: true,
          completion_data: { dealer_number: "123456789" },
        },
        {
          template_id: "buy-domain",
          status: "done",
          completed_at: "2026-09-08T04:17:01Z",
          is_relevant: true,
          completion_data: {},
        },
      ],
      TEMPLATES_BY_ID,
      { dealer_number: "123456789" }
    );

    render(<BusinessCertificate certificate={certificate} />);
    const text = document.body.textContent ?? "";
    expect(text).toContain("123456789");
    expect(text).toContain("משימה אחת הושלמה");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("[object Object]");
  });
});
