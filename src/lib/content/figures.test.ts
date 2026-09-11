import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TASK_TEMPLATES } from "@/lib/content";
import {
  FIGURES,
  formatFigure,
  figureTokensIn,
  interpolateFigures,
  type FigureKey,
} from "./figures";

/** Every user-facing string a template can put on screen. */
function proseOf(t: (typeof TASK_TEMPLATES)[number]): string[] {
  return [
    t.title,
    t.why,
    t.steps,
    t.guide ?? "",
    t.after_submit ?? "",
    t.est_cost ?? "",
    t.est_time ?? "",
    ...(t.pitfalls ?? []),
    ...t.docs_needed,
    ...(t.variants ?? []).flatMap((v) => [v.steps, v.why ?? ""]),
  ];
}

describe("figure interpolation", () => {
  it("replaces a known token with the formatted value", () => {
    expect(interpolateFigures("מחזור עד {{osekPaturCeiling}} בשנה")).toBe(
      `מחזור עד ${formatFigure("osekPaturCeiling")} בשנה`
    );
    expect(interpolateFigures("מס חברות {{corporateTaxRate}}")).toBe(
      `מס חברות ${FIGURES.corporateTaxRate.value}%`
    );
  });

  it("formats shekels with he-IL grouping and percentages without a currency sign", () => {
    expect(formatFigure("osekPaturCeiling")).toBe("₪122,833");
    expect(formatFigure("corporateTaxRate")).toBe("23%");
  });

  it("leaves an unknown token visible rather than blanking the amount", () => {
    // A visible {{typo}} is an obvious bug someone fixes. A silently empty
    // sentence where an amount belongs — "the reduced fee is  until 31 March" —
    // is a compliance statement with the number quietly removed.
    expect(interpolateFigures("האגרה היא {{noSuchFigure}} בשנה")).toBe(
      "האגרה היא {{noSuchFigure}} בשנה"
    );
  });

  it("replaces every occurrence, not just the first", () => {
    const out = interpolateFigures("{{corporateTaxRate}} ואז {{corporateTaxRate}}");
    expect(out).toBe("23% ואז 23%");
  });

  it("leaves text with no tokens untouched", () => {
    expect(interpolateFigures("אין כאן מספרים")).toBe("אין כאן מספרים");
  });
});

describe("no figure is hardcoded in content prose", () => {
  it("every {{token}} used in content resolves to a real figure", () => {
    // An unresolvable token renders literally, so this test is what keeps a
    // typo from shipping as "{{registrarAnnualFee}}" on a task page.
    const bad: string[] = [];
    for (const t of TASK_TEMPLATES) {
      for (const text of proseOf(t)) {
        for (const token of figureTokensIn(text)) {
          if (!(token in FIGURES)) bad.push(`${t.id}: {{${token}}}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("no figure value appears as a literal in template prose", () => {
    // This is the test that prevents the original defect from returning: the
    // numbers were typed into Hebrew prose, so updating the config changed
    // nothing a user could read. If you are adding content, write
    // {{osekPaturCeiling}} rather than ₪122,833.
    const bad: string[] = [];
    for (const t of TASK_TEMPLATES) {
      const prose = proseOf(t).join("\n");
      for (const key of Object.keys(FIGURES) as FigureKey[]) {
        const formatted = formatFigure(key);
        if (prose.includes(formatted)) bad.push(`${t.id}: "${formatted}" — use {{${key}}}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("no figure value appears as a literal in the content source files", () => {
    // Catches amounts written in a form the template-object scan above cannot
    // see — a comment, or prose assembled at render time.
    const dir = path.join(process.cwd(), "src/lib/content");
    const bad: string[] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.startsWith("tasks-"))) {
      const src = fs.readFileSync(path.join(dir, file), "utf8");
      for (const key of Object.keys(FIGURES) as FigureKey[]) {
        const f = FIGURES[key];
        // Only amounts are distinctive enough to match on. A bare "23" would
        // fire on step numbers and dates; "₪1,338" and "23%" would not.
        const literal =
          f.kind === "percent"
            ? `${f.value}%`
            : `₪${f.value.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
        if (src.includes(literal)) bad.push(`${file}: "${literal}" — use {{${key}}}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every figure carries a year and an official source", () => {
    const bad: string[] = [];
    for (const [key, f] of Object.entries(FIGURES)) {
      if (!Number.isInteger(f.year) || f.year < 2020) bad.push(`${key}: year ${f.year}`);
      if (!f.source.startsWith("https://")) bad.push(`${key}: source ${f.source}`);
      if (!f.label.trim()) bad.push(`${key}: no label`);
    }
    expect(bad).toEqual([]);
  });

  it("every figure is reachable — none is dead config", () => {
    // The original defect in one line: eleven of thirteen figures had no reader
    // at all. A figure that nothing uses is a number nobody maintains.
    const used = new Set<string>();
    for (const t of TASK_TEMPLATES) {
      for (const text of proseOf(t)) for (const token of figureTokensIn(text)) used.add(token);
    }
    // These two are consumed by engine code (the ceiling meter and the
    // allocation-number check), not by prose, so they are legitimately absent
    // from template text.
    const usedByCode = new Set(["osekPaturCeiling", "invoiceAllocationThreshold"]);
    const dead = (Object.keys(FIGURES) as FigureKey[]).filter(
      (k) => !used.has(k) && !usedByCode.has(k)
    );
    expect(dead).toEqual([]);
  });
});
