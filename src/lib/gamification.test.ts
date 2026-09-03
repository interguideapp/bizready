import { describe, expect, it } from "vitest";
import { TEMPLATES_BY_ID } from "@/lib/content";
import {
  computeStreak,
  computeXp,
  computeWins,
  levelFromXp,
  type GamiTask,
} from "./gamification";

function t(template_id: string, status: GamiTask["status"], completed_at?: string): GamiTask {
  return { template_id, status, is_relevant: true, completed_at };
}

describe("xp + levels", () => {
  it("awards XP by priority weight for done relevant tasks only", () => {
    // open-vat-file is critical (weight 3 → 30xp); a todo earns nothing
    const xp = computeXp(
      [t("open-vat-file", "done"), t("choose-accountant", "todo")],
      TEMPLATES_BY_ID
    );
    expect(xp).toBe(30);
  });

  it("ignores not-relevant tasks", () => {
    const xp = computeXp(
      [{ template_id: "open-vat-file", status: "done", is_relevant: false }],
      TEMPLATES_BY_ID
    );
    expect(xp).toBe(0);
  });

  it("maps xp to a named level with progress to next", () => {
    const lvl = levelFromXp(120);
    expect(lvl.level).toBe(2);
    expect(lvl.nextAt).toBe(160);
    expect(lvl.progress).toBeCloseTo(0.6, 5);
    expect(lvl.nextTitle).toBeTruthy();
  });

  it("caps at the top level", () => {
    const lvl = levelFromXp(9999);
    expect(lvl.nextAt).toBeNull();
    expect(lvl.progress).toBe(1);
  });
});

describe("streak", () => {
  it("counts consecutive weeks with a completion", () => {
    const today = new Date("2026-09-20T12:00:00Z");
    const events = [
      { kind: "completed", created_at: "2026-09-18" }, // this week
      { kind: "completed", created_at: "2026-09-10" }, // last week
      { kind: "completed", created_at: "2026-09-03" }, // 2 weeks ago
      { kind: "note", created_at: "2026-08-01" }, // ignored kind
    ];
    expect(computeStreak(events, today)).toBe(3);
  });

  it("is 0 when the last completion is too old", () => {
    const today = new Date("2026-09-20T12:00:00Z");
    expect(computeStreak([{ kind: "completed", created_at: "2026-07-01" }], today)).toBe(0);
  });
});

describe("wins", () => {
  it("lists done missions newest-first", () => {
    const wins = computeWins(
      [t("open-vat-file", "done", "2026-08-01"), t("choose-accountant", "done", "2026-08-10")],
      TEMPLATES_BY_ID
    );
    expect(wins).toHaveLength(2);
    expect(wins[0].templateId).toBe("choose-accountant");
  });
});
