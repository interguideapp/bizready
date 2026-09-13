import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SETASIDE_ESTIMATE_NOTE,
  SETASIDE_HIGH,
  SETASIDE_LOW,
  computeSetAside,
} from "@/lib/finance/setaside";

/**
 * The set-aside figure is a rule of thumb, and its module says so:
 *
 *   "Everything that consumes this must label it הערכה — לאימות מול רו״ח."
 *
 * That is a contract written in a docstring, which is the same shape as the
 * product promising "המערכת תזכיר לכם לפני שהוא פג" and never sending it. A
 * docstring enforces nothing, so this does.
 *
 * It matters because the number looks authoritative: 25–35% of revenue is a
 * four- or five-figure shekel amount, and an owner who reads it as their actual
 * tax bill will under- or over-reserve by thousands. The estimate word is what
 * stops it being read as a calculation.
 */
const root = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

function basename(file: string): string {
  return file.split("\\").join("/").split("/").pop() ?? file;
}

/** Files that turn the figure into something a person reads. */
function consumerFiles(): string[] {
  return walk(join(root, "src")).filter((f) => {
    const name = basename(f);
    if (name.startsWith("setaside")) return false;
    if (/\.test\.tsx?$/.test(name)) return false;
    return readFileSync(f, "utf8").includes("computeSetAside");
  });
}

describe("every surface that shows the set-aside carries the caveat", () => {
  it("finds the consumers at all, so the check cannot pass vacuously", () => {
    expect(consumerFiles().length).toBeGreaterThan(0);
  });

  /**
   * Asserted through the shared CONSTANT, not by searching for words.
   *
   * My first two attempts both failed as guards. Searching whole files passed
   * vacuously, because home-os.tsx mentions רו״ח on an unrelated line about
   * company tax. Narrowing to the line that prints the figure then produced a
   * false positive on finance-panels.tsx, where the caveat sits immediately
   * below in the same card — perfectly visible to a reader. A line window
   * would have reintroduced the first problem, since that company-tax line is
   * two lines away.
   *
   * Single-sourcing the sentence removes the ambiguity: either a surface uses
   * the constant, or it does not.
   */
  it("uses the shared constant rather than its own paraphrase", () => {
    const surfaces = [
      "src/components/home/home-os.tsx",
      "src/components/finance/finance-panels.tsx",
    ];
    const offenders = surfaces.filter(
      // The JSX USAGE, not the mere presence of the name: my third attempt
      // matched the leftover import line after the usage had been replaced by a
      // paraphrase, and passed.
      (f) => !readFileSync(join(root, f), "utf8").includes("{SETASIDE_ESTIMATE_NOTE}")
    );
    expect(offenders).toEqual([]);
  });

  it("keeps both halves of the contract in that constant", () => {
    // What the number is, and who confirms it.
    expect(SETASIDE_ESTIMATE_NOTE).toMatch(/הערכה/);
    expect(SETASIDE_ESTIMATE_NOTE).toMatch(/רו״ח|רו״ח/);
  });
});

describe("the figure itself stays a conservative band", () => {
  it("is a range, not a single number", () => {
    const { low, high } = computeSetAside(100_000);
    expect(high).toBeGreaterThan(low);
  });

  it("keeps the declared 25-35% band", () => {
    expect(SETASIDE_LOW).toBe(0.25);
    expect(SETASIDE_HIGH).toBe(0.35);
    expect(computeSetAside(100_000)).toEqual({ low: 25_000, high: 35_000 });
  });

  it("never suggests setting aside from negative or absent revenue", () => {
    expect(computeSetAside(-5_000)).toEqual({ low: 0, high: 0 });
  });
});
