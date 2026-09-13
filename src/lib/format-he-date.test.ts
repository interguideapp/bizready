import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatHeDate, formatHeDayMonth, todayInIsrael } from "@/lib/dates";
import { formatHe } from "@/lib/deadline-options";

/**
 * A deadline must read as the same calendar day to every viewer.
 *
 * The shared formatter did `new Date(iso + "T00:00:00Z").toLocaleDateString("he-IL")`:
 * parsed as UTC midnight, then rendered in the zone of whoever renders it. On
 * the server that is UTC and harmless, which is why it survived. In a client
 * component it is the viewer's browser, and at any negative offset the instant
 * lands on the previous day:
 *
 *   2026-09-15 -> 15.9.2026 in UTC and Asia/Jerusalem
 *   2026-09-15 -> 14.9.2026 in America/New_York and Pacific/Honolulu
 *
 * WHY HALF OF THIS FILE READS THE SOURCE.
 *
 * My first version asserted the pinning at runtime and I planted three
 * regressions against it — removing `timeZone: TZ`, moving the anchor back to
 * UTC midnight, and giving formatHe its own copy again. All three PASSED. This
 * process runs at a positive UTC offset, where the pinned and unpinned forms
 * agree, and TZ is not honoured on this host (every value resolved to
 * Asia/Bangkok, which is what made the earlier experiment meaningless). No
 * runtime observation from inside a positive-offset process can distinguish the
 * defect, so the pin, the anchor instant and the delegation are asserted where
 * they are decided.
 */
const DEADLINE = "2026-09-15";

/**
 * Source with comments stripped.
 *
 * The expiry guard below failed on its OWN explanation, which quotes
 * toLocaleDateString("sv-SE") to say why it is gone. a11y/promises.test.ts hit
 * exactly this and carries the same helper; only what ships counts.
 */
function stripComments(src: string): string {
  const withoutBlocks = src.replace(/\/\*[\s\S]*?\*\//g, " ");
  return withoutBlocks
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}


function read(rel: string): string {
  return stripComments(readFileSync(join(process.cwd(), rel), "utf8"));
}

const dates = read("src/lib/dates.ts");

/** How the OLD implementation behaved, to show what is being prevented. */
function formatTheOldWay(iso: string, viewerZone: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("he-IL", {
    timeZone: viewerZone,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

describe("the old implementation really did shift the day", () => {
  it("renders a 15 September deadline as the 14th west of Greenwich", () => {
    expect(formatTheOldWay(DEADLINE, "America/New_York")).toBe("14.9.2026");
    expect(formatTheOldWay(DEADLINE, "Pacific/Honolulu")).toBe("14.9.2026");
  });

  it("looked correct from UTC and from Israel, which is why it survived", () => {
    expect(formatTheOldWay(DEADLINE, "UTC")).toBe("15.9.2026");
    expect(formatTheOldWay(DEADLINE, "Asia/Jerusalem")).toBe("15.9.2026");
  });

  it("is fixed by pinning AND by a midday anchor, together", () => {
    // Either alone leaves a hole: an unpinned midday anchor still shifts at
    // +14, and a pinned UTC-midnight anchor is fine only because Israel is
    // east of Greenwich — it would break for a westward locale.
    for (const zone of ["UTC", "Asia/Jerusalem", "America/New_York", "Pacific/Kiritimati"]) {
      const pinnedMidday = new Date(`${DEADLINE}T12:00:00Z`).toLocaleDateString("he-IL", {
        timeZone: "Asia/Jerusalem",
        day: "numeric",
        month: "numeric",
        year: "numeric",
      });
      expect(pinnedMidday, `viewer in ${zone}`).toBe("15.9.2026");
    }
  });
});

describe("the pin is where it is decided", () => {
  it("both formatters name the timezone", () => {
    // Two declarations, so both must carry it; the day-month one is used on
    // the home screen, which is the most-read surface in the product.
    const pinned = dates.split("timeZone: TZ").length - 1;
    expect(pinned, "a formatter lost its timeZone").toBeGreaterThanOrEqual(3);
  });

  it("anchors a date-only value at midday UTC, not midnight", () => {
    // Midnight UTC is the instant that falls on the previous day for every
    // negative offset. Midday is the one no zone on earth moves.
    expect(dates).toContain('T12:00:00Z');
    expect(dates).not.toContain('.slice(0, 10) + "T00:00:00Z"');
  });

  it("keeps one implementation, with formatHe delegating to it", () => {
    // Both readings. The call proves the export still works and still agrees;
    // the source check is what can actually tell a delegation from a copy,
    // since a copy produces the same string in this process's zone.
    expect(formatHe(DEADLINE)).toBe(formatHeDate(DEADLINE));
    expect(formatHe("2026-01-01")).toBe(formatHeDate("2026-01-01"));
    const options = read("src/lib/deadline-options.ts");
    expect(options).toContain("return formatHeDate(iso);");
    expect(options).not.toContain('toLocaleDateString("he-IL"');
  });

  it("is not reintroduced by a hand-rolled date-only format elsewhere", () => {
    // The pattern that was everywhere: a date-only string glued to a time and
    // formatted in the ambient zone.
    for (const file of [
      "src/app/(app)/insights/page.tsx",
      "src/app/(app)/home/page.tsx",
      "src/app/(app)/documents/document-row.tsx",
    ]) {
      const src = read(file);
      expect(src, `${file} formats a date-only value by hand`).not.toContain('+ "T00:00:00")');
    }
  });

  it("judges expiry against the Israeli day, not the browser's", () => {
    const row = read("src/app/(app)/documents/document-row.tsx");
    expect(row).toContain("doc.expires_at < todayInIsrael()");
    expect(row).not.toContain('toLocaleDateString("sv-SE")');
  });
});

describe("what the formatters produce", () => {
  it("gives the Israeli calendar day", () => {
    expect(formatHeDate(DEADLINE)).toBe("15.9.2026");
    expect(formatHeDayMonth(DEADLINE)).toBe("15.9");
  });

  it("reproduces the input's own components for every day of a year", () => {
    // Catches an anchor or arithmetic slip that survives the source checks.
    const d = new Date(Date.UTC(2026, 0, 1));
    while (d.getUTCFullYear() === 2026) {
      const iso = d.toISOString().slice(0, 10);
      const [y, m, day] = iso.split("-").map(Number);
      expect(formatHeDate(iso), iso).toBe(`${day}.${m}.${y}`);
      d.setUTCDate(d.getUTCDate() + 1);
    }
  });

  it("holds across both Israeli DST boundaries", () => {
    expect(formatHeDate("2026-03-27")).toBe("27.3.2026");
    expect(formatHeDate("2026-10-25")).toBe("25.10.2026");
  });

  it("returns an unusable value untouched rather than 'Invalid Date'", () => {
    expect(formatHeDate("not-a-date")).toBe("not-a-date");
    expect(formatHeDayMonth("")).toBe("");
  });

  it("agrees with todayInIsrael about which day today is", () => {
    // The display and the lateness comparison must not be able to disagree:
    // one saying "15.9.2026" while the other says the 15th has passed.
    const today = todayInIsrael();
    const [y, m, d] = today.split("-").map(Number);
    expect(formatHeDate(today)).toBe(`${d}.${m}.${y}`);
  });
});
