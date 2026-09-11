/**
 * WCAG contrast maths, so the design system can be tested instead of eyeballed.
 *
 * The product ships a `critical`, statute-backed task titled
 * "נגישות האתר — תקן ישראלי 5568 (WCAG AA)" warning that an inaccessible site
 * invites lawsuits, and the app itself failed that standard: `--ink-faint`
 * computed to 1.63:1 on the home cards — effectively invisible — and
 * `--ink-muted` to 3.68:1, both well under the 4.5:1 AA threshold for body text.
 *
 * The cause was structural rather than a bad colour choice. `.os-card` was only
 * ~35% opaque over an animated 22s/26s gradient, so the luminance behind text
 * OSCILLATED. No static token value can guarantee a ratio against a moving
 * background, which is why this could never have been fixed by nudging a hex
 * code. The fix is an opaque base under the glass; these helpers are what let a
 * test prove it stayed fixed.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses #rgb, #rrggbb, or rgba(r, g, b, a). Returns alpha separately. */
export function parseColor(input: string): { rgb: Rgb; alpha: number } {
  const value = input.trim();

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    return {
      rgb: {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
      },
      alpha: 1,
    };
  }

  const rgba = value.match(
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i
  );
  if (rgba) {
    return {
      rgb: { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) },
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }

  throw new Error(`cannot parse colour: ${input}`);
}

/** Alpha-composites `fg` over `bg`. Both fully resolved, no alpha on the result. */
export function composite(fg: string, bg: Rgb): Rgb {
  const { rgb, alpha } = parseColor(fg);
  return {
    r: alpha * rgb.r + (1 - alpha) * bg.r,
    g: alpha * rgb.g + (1 - alpha) * bg.g,
    b: alpha * rgb.b + (1 - alpha) * bg.b,
  };
}

/** Composites a stack of layers, first entry closest to the viewer. */
export function compositeStack(layers: string[], base: Rgb): Rgb {
  let out = base;
  for (const layer of [...layers].reverse()) out = composite(layer, out);
  return out;
}

/** WCAG 2.x relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two opaque colours, 1:1 to 21:1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** AA for body text. */
export const AA_BODY = 4.5;
/** AA for large text (>=18.66px bold or >=24px) and for UI component boundaries. */
export const AA_LARGE = 3;
/**
 * The smallest font size allowed for text carrying meaning. Below this, a
 * passing contrast ratio still is not readable — and the app had 39 uses of
 * `text-ink-faint` at 12px or smaller, including the legal disclaimer.
 */
export const MIN_TEXT_PX = 12;

/** Pulls `--name: value;` custom properties out of a CSS source string. */
export function readTokens(css: string, selector: string): Record<string, string> {
  // Find the selector's block. Deliberately simple: the token blocks in
  // globals.css are flat `:root { ... }` / `.dark { ... }` declarations.
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  if (open < 0 || close < 0) throw new Error(`malformed block for ${selector}`);

  const body = css.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
