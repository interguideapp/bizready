import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AA_BODY,
  AA_LARGE,
  MIN_TEXT_PX,
  compositeStack,
  contrastRatio,
  parseColor,
  readTokens,
} from "./contrast";

/**
 * Contrast is now arithmetic, so it can be a test.
 *
 * The app ships a `critical`, statute-backed task titled
 * "נגישות האתר — תקן ישראלי 5568 (WCAG AA)" telling business owners that an
 * inaccessible site invites lawsuits — while failing that same standard itself.
 * Measured against `.os-ambient` at its brightest, `--ink-faint` came out at
 * 2.18:1 and `--ink-muted` at 4.54:1.
 *
 * These tests read the real token values out of globals.css rather than
 * duplicating them, so they track the source of truth and fail if someone
 * lightens a token or makes a card translucent again.
 */

const CSS = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

const light = readTokens(CSS, ":root {");
const dark = readTokens(CSS, ".dark {");

/**
 * The worst case a reader can encounter on a glass card: the opaque base, plus
 * the card's own white sheen at its strongest. The sheen runs
 * `rgba(255,255,255,0.12)` at the top-left corner of `.os-card`, which lifts the
 * background luminance and therefore REDUCES contrast for light text — so that
 * corner, not the card's average, is what has to pass.
 */
const SHEEN_PEAK = "rgba(255, 255, 255, 0.12)";

function worstCase(tokens: Record<string, string>) {
  const base = parseColor(tokens["--glass-base"]);
  expect(
    base.alpha,
    "--glass-base must be fully opaque: a translucent card over the animated " +
      ".os-ambient gradient has no fixed contrast ratio, so no token value can " +
      "be proven accessible on it"
  ).toBe(1);
  return compositeStack([SHEEN_PEAK], base.rgb);
}

const THEMES: [string, Record<string, string>][] = [
  ["dark", dark],
  ["light", light],
];

describe("text on glass cards meets WCAG AA", () => {
  it.each(THEMES)("%s: --glass-base is opaque", (_name, tokens) => {
    worstCase(tokens);
  });

  // --ink-faint is included deliberately. It appears 94 times, 39 of them at
  // 12px or smaller — including the legal disclaimer. If it cannot clear AA it
  // has no business carrying text.
  const BODY_TOKENS = ["--ink", "--ink-soft", "--ink-muted", "--ink-faint"];

  for (const [themeName, tokens] of THEMES) {
    describe(themeName, () => {
      it.each(BODY_TOKENS)(`%s clears ${AA_BODY}:1 on the worst-case card`, (token) => {
        const bg = worstCase(tokens);
        const fg = parseColor(tokens[token]);
        expect(fg.alpha, `${token} must be opaque`).toBe(1);
        const ratio = contrastRatio(fg.rgb, bg);
        expect(
          ratio,
          `${themeName} ${token} = ${tokens[token]} is ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(AA_BODY);
      });

      it("the ink scale is ordered — each step is dimmer than the last", () => {
        // Three greys that all have to clear AA on one background cannot be very
        // far apart, but they must still be distinguishable and correctly
        // ordered, or the tokens stop meaning anything.
        const bg = worstCase(tokens);
        const ratios = BODY_TOKENS.map((t) => contrastRatio(parseColor(tokens[t]).rgb, bg));
        for (let i = 1; i < ratios.length; i++) {
          expect(ratios[i], `${BODY_TOKENS[i]} should be dimmer than ${BODY_TOKENS[i - 1]}`)
            .toBeLessThan(ratios[i - 1]);
        }
      });

      it("status colours are legible on their own tinted backgrounds", () => {
        const bg = worstCase(tokens);
        for (const status of ["done", "progress", "overdue", "todo"]) {
          const tint = tokens[`--status-${status}-bg`];
          const composited = compositeStack([tint, SHEEN_PEAK], parseColor(tokens["--glass-base"]).rgb);
          const fg = parseColor(tokens[`--status-${status}`]);
          const ratio = contrastRatio(fg.rgb, composited);
          // Status text is a short label in a chip — AA large-text/UI applies,
          // but it must at least be clearly visible.
          expect(ratio, `--status-${status} on its tint is ${ratio.toFixed(2)}:1`)
            .toBeGreaterThanOrEqual(AA_LARGE);
          expect(bg).toBeTruthy();
        }
      });

      it("the brand link colour is readable, not just decorative", () => {
        const bg = worstCase(tokens);
        const ratio = contrastRatio(parseColor(tokens["--brand-strong"]).rgb, bg);
        expect(ratio, `--brand-strong is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_BODY);
      });

      it("borders are visible enough to read as boundaries", () => {
        // Not a text requirement, but an edge nobody can see is not an edge.
        const baseRgb = parseColor(tokens["--glass-base"]).rgb;
        const edge = compositeStack([tokens["--edge-strong"]], baseRgb);
        expect(contrastRatio(edge, baseRgb)).toBeGreaterThan(1.1);
      });
    });
  }
});

describe("no text is rendered below the legible floor", () => {
  const SRC_DIR = path.join(process.cwd(), "src");

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return /\.(tsx|ts|css)$/.test(e.name) && !e.name.includes(".test.") ? [full] : [];
    });
  }

  it(`no arbitrary font size under ${MIN_TEXT_PX}px`, () => {
    // The app had eleven arbitrary sizes across 45 occurrences, including
    // text-[10.5px] and text-[11.5px] — half-pixel values are the signature of
    // eyeballing, and at that size a passing contrast ratio still is not
    // readable.
    const offenders: string[] = [];
    for (const file of walk(SRC_DIR)) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (Number(m[1]) < MIN_TEXT_PX) {
          offenders.push(`${path.relative(process.cwd(), file)}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no arbitrary font size at all — the scale is the scale", () => {
    // There were 11 arbitrary sizes across 45 occurrences, six of them inside a
    // 3.5px band, including text-[10.5px], text-[11.5px] and text-[13.5px].
    // Half-pixel values are the signature of eyeballing rather than a scale,
    // and a type scale with 22 steps is not a scale.
    const offenders: string[] = [];
    for (const file of walk(SRC_DIR)) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/text-\[[\d.]+(?:px|rem)\]/g)) {
        offenders.push(`${path.relative(process.cwd(), file)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the focus ring traces the shape it focuses", () => {
    // :focus-visible hardcoded border-radius: 6px, so on all 59 rounded-full
    // controls the ring was a near-rectangle around a circle.
    const focusBlock = CSS.slice(CSS.indexOf(":focus-visible"));
    const block = focusBlock.slice(0, focusBlock.indexOf("}"));
    expect(block).toContain("border-radius: inherit");
  });

  it(`no CSS rule sets a font-size under ${MIN_TEXT_PX}px`, () => {
    // .eyebrow hardcoded 0.66rem (10.56px) and was used 25 times, six of them
    // inside .os-card.
    const offenders: string[] = [];
    for (const m of CSS.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)) {
      const px = m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
      if (px < MIN_TEXT_PX) offenders.push(`${m[0]} (${px}px)`);
    }
    expect(offenders).toEqual([]);
  });
});
