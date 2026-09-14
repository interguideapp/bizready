import { describe, expect, it } from "vitest";
import { mergeAttention } from "@/lib/live-attention";
import { computeReminders, type NotificationDraft } from "@/lib/reminders";
import { TEMPLATES_BY_ID } from "@/lib/content";

/**
 * THE ALERTS LIST COULD NOT ORDER ITSELF BY URGENCY.
 *
 * mergeAttention sorted by type and then by recency, and a draft carried
 * neither a date nor a legal basis. Two consequences, both invisible from
 * reading the sort:
 *
 *   An expired DOCUMENT emits type "overdue" — the top rank —
 *   indistinguishable from a missed statutory filing with penalty and interest
 *   accruing. The obligations board separates those deliberately
 *   (OverdueSection versus LapsedSection, "a lapsed cover is not an
 *   interest-bearing debt") and this list ranked them as the same thing.
 *
 *   Within "deadline" there was NO order at all. Every derived item has a null
 *   created_at, so the comparator fell through to 0 and the list came out in
 *   whatever order computeReminders happened to emit — a recommendation seven
 *   days out could sit above a VAT filing twenty days out.
 *
 * /home hit exactly this and was fixed with rankByExposure: "a harmless task
 * due today outranked a VAT filing that had been accruing a penalty for a
 * week." The screen whose entire job is that nothing gets missed kept ranking
 * by type and insertion order.
 */
const draft = (over: Partial<NotificationDraft>): NotificationDraft => ({
  type: "deadline",
  title: "t",
  body: null,
  template_id: "vat-reporting",
  dedupe_key: "k" + Math.random(),
  days_until: 10,
  ...over,
});

const titles = (drafts: NotificationDraft[]) =>
  mergeAttention([], drafts).map((i) => i.title);

describe("consequence beats kind-of-date inside one type", () => {
  it("puts a missed statutory filing above an expired document", () => {
    // Both are type "overdue". One accrues penalties; the other is the user's
    // own record of a certificate.
    const order = titles([
      draft({
        type: "overdue",
        title: "פג תוקף: תעודת ביטוח",
        template_id: "",
        days_until: -40,
      }),
      draft({ type: "overdue", title: "באיחור: דיווח מע״מ", days_until: -3 }),
    ]);
    expect(order[0]).toBe("באיחור: דיווח מע״מ");
  });

  it("does so even when the document expired much longer ago", () => {
    // A pure date sort would invert this, which is why consequence is tested
    // before nearness.
    const order = titles([
      draft({ type: "overdue", title: "מסמך", template_id: "", days_until: -400 }),
      draft({ type: "overdue", title: "מע״מ", days_until: -1 }),
    ]);
    expect(order[0]).toBe("מע״מ");
  });

  it("puts a statutory filing above a recommendation inside 'deadline'", () => {
    const order = titles([
      draft({ title: "המלצה", template_id: "professional-liability-insurance", days_until: 7 }),
      draft({ title: "מע״מ", template_id: "vat-reporting", days_until: 20 }),
    ]);
    expect(order).toEqual(["מע״מ", "המלצה"]);
  });
});

describe("nearness orders what is otherwise equal", () => {
  it("sorts two statutory deadlines by how close they are", () => {
    // The comparator returned 0 for this pair, so the order was whatever the
    // engine emitted.
    const order = titles([
      draft({ title: "רחוק", days_until: 30 }),
      draft({ title: "קרוב", days_until: 1 }),
      draft({ title: "בינוני", days_until: 14 }),
    ]);
    expect(order).toEqual(["קרוב", "בינוני", "רחוק"]);
  });

  it("sorts the most overdue first among equal consequence", () => {
    const order = titles([
      draft({ type: "overdue", title: "שבוע", days_until: -7 }),
      draft({ type: "overdue", title: "חודשיים", days_until: -60 }),
    ]);
    expect(order).toEqual(["חודשיים", "שבוע"]);
  });

  it("puts an item with no date last among its equals, not first", () => {
    // A sync failure has no date. Nulls must not read as "zero days away".
    const order = titles([
      draft({ type: "deadline", title: "ללא תאריך", days_until: null }),
      draft({ type: "deadline", title: "בעוד יומיים", days_until: 2 }),
    ]);
    expect(order).toEqual(["בעוד יומיים", "ללא תאריך"]);
  });
});

describe("the type ranking still wins, because it is the coarsest truth", () => {
  it("an overdue recommendation is not promoted above a due filing", () => {
    // Type first: being late is the headline, whatever it is late for. The
    // consequence rank then orders within that.
    const order = titles([
      draft({ type: "deadline", title: "מע״מ בעוד יום", days_until: 1 }),
      draft({ type: "overdue", title: "באיחור", days_until: -1 }),
    ]);
    expect(order[0]).toBe("באיחור");
  });

  it("a sync failure stays at the bottom", () => {
    const order = titles([
      draft({ type: "sync", title: "סנכרון", template_id: "", days_until: null }),
      draft({ type: "recurring", title: "תקופה חדשה", days_until: 0 }),
    ]);
    expect(order).toEqual(["תקופה חדשה", "סנכרון"]);
  });
});

describe("an overdue filing carries a NEGATIVE days_until", () => {
  it("is not reported as the most distant future item", () => {
    /*
     * My own first version wrote `days_until: -daysLate`, and daysLate is
     * already days-until — daysBetween returns negative for a past date, which
     * is why that branch tests `daysLate < 0`. Negating it turned every
     * overdue filing into a large positive number: the exact inversion of its
     * urgency, inside the fix for an ordering bug.
     */
    const order = titles([
      draft({ type: "overdue", title: "באיחור 3 ימים", days_until: -3 }),
      draft({ type: "overdue", title: "באיחור 30 ימים", days_until: -30 }),
    ]);
    expect(order).toEqual(["באיחור 30 ימים", "באיחור 3 ימים"]);
  });
});

describe("the engine produces the sign the comparator expects", () => {
  /**
   * THE BLIND SPOT IN EVERYTHING ABOVE, found by planting the bug I had
   * actually made and watching all nine tests pass.
   *
   * Those cases construct drafts by hand, so they prove the comparator handles
   * a negative days_until — and prove nothing about whether computeReminders
   * ever emits one. My first version wrote `days_until: -daysLate`, and
   * daysLate is ALREADY days-until: daysBetween returns negative for a past
   * date, which is why that branch tests `daysLate < 0`. Negating it turned
   * every overdue filing into a large positive number, sorting it as the most
   * distant future item on the list — the exact inversion of its urgency,
   * inside the fix for an ordering bug.
   *
   * A guard that cannot observe the defect it guards is worse than none,
   * because it certifies the bug. So this one runs the engine.
   */
  const LATE = new Date("2026-10-01T09:00:00Z"); // 16 days past 15 September

  function overdueVatTasks() {
    return [
      {
        id: "a",
        template_id: "open-vat-file",
        status: "done" as const,
        is_relevant: true,
        due_date: null,
        completed_at: "2026-01-05T09:00:00Z",
        completion_data: null,
      },
      {
        id: "b",
        template_id: "vat-reporting",
        status: "todo" as const,
        is_relevant: true,
        due_date: "2026-09-15",
        completed_at: null,
        completion_data: null,
      },
    ];
  }

  it("the premise: this fixture really does produce an overdue draft", () => {
    const { notifications } = computeReminders(
      overdueVatTasks(),
      TEMPLATES_BY_ID,
      LATE,
      true,
      { vatFrequency: "bimonthly" }
    );
    expect(notifications.some((n) => n.type === "overdue")).toBe(true);
  });

  it("gives an overdue filing a NEGATIVE days_until", () => {
    const { notifications } = computeReminders(
      overdueVatTasks(),
      TEMPLATES_BY_ID,
      LATE,
      true,
      { vatFrequency: "bimonthly" }
    );
    for (const n of notifications.filter((d) => d.type === "overdue")) {
      expect(n.days_until, n.title).not.toBeNull();
      expect(n.days_until!, n.title).toBeLessThan(0);
    }
  });

  it("and the magnitude is how late it actually is", () => {
    // Not just the sign: a swapped subtraction would keep the sign and lose
    // the distance, which is what orders two overdue filings against one
    // another.
    const { notifications } = computeReminders(
      overdueVatTasks(),
      TEMPLATES_BY_ID,
      LATE,
      true,
      { vatFrequency: "bimonthly" }
    );
    const late = notifications.find((d) => d.type === "overdue")!;
    expect(late.days_until).toBe(-16);
  });

  it("gives an approaching filing a positive days_until", () => {
    // The other half of the sign, so a single inverted subtraction cannot pass
    // by being wrong in both directions at once.
    const { notifications } = computeReminders(
      overdueVatTasks(),
      TEMPLATES_BY_ID,
      new Date("2026-09-08T09:00:00Z"),
      true,
      { vatFrequency: "bimonthly" }
    );
    const ahead = notifications.filter((d) => d.type === "deadline");
    expect(ahead.length).toBeGreaterThan(0);
    for (const n of ahead) expect(n.days_until!, n.title).toBeGreaterThan(0);
  });
});
