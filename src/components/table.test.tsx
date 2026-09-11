// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Table, type Column } from "./table";

afterEach(cleanup);

/**
 * `grep "<table>"` over this codebase returned ZERO before this component. All
 * tabular data was divide-y divs, which to a screen reader is a flat run of
 * text — it cannot say "price, ₪250" because nothing marked ₪250 as a price.
 *
 * These tests check the relationships, not the styling: that a cell is
 * announced with its header, that the table has a name, and that a sort the
 * user triggers is exposed rather than only drawn.
 */

interface Row {
  id: string;
  name: string;
  price: number;
}

const rows: Row[] = [
  { id: "b", name: "טיפול פנים", price: 250 },
  { id: "a", name: "איפור", price: 400 },
  { id: "c", name: "עיצוב גבות", price: 120 },
];

const columns: Column<Row>[] = [
  { id: "name", header: "שירות", cell: (r) => r.name, sortValue: (r) => r.name },
  {
    id: "price",
    header: "מחיר",
    cell: (r) => `₪${r.price}`,
    sortValue: (r) => r.price,
    numeric: true,
  },
];

function renderTable(over: Partial<Parameters<typeof Table<Row>>[0]> = {}) {
  return render(
    <Table<Row>
      caption="מחירון השירותים"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      {...over}
    />
  );
}

describe("cells are announced with their column", () => {
  it("every column is a real th with a column scope", () => {
    renderTable();
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    for (const header of headers) {
      expect(header.getAttribute("scope")).toBe("col");
    }
  });

  it("the table has an accessible name", () => {
    // A table with no caption is an unlabelled region. It is visually hidden by
    // default because it is for orientation, not decoration.
    renderTable();
    expect(screen.getByRole("table", { name: "מחירון השירותים" })).toBeDefined();
  });

  it("renders one row per record, plus the header row", () => {
    renderTable();
    expect(screen.getAllByRole("row")).toHaveLength(rows.length + 1);
  });

  it("can show the caption visibly when it is the section's heading", () => {
    renderTable({ captionVisible: true });
    const caption = screen.getByText("מחירון השירותים");
    expect(caption.className).not.toContain("sr-only");
  });
});

describe("sort state is exposed, not just drawn", () => {
  it("no column claims a sort before the user asks for one", () => {
    renderTable();
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header.getAttribute("aria-sort")).toBeNull();
    }
  });

  it("sets aria-sort on the sorted column — the only signal a screen reader gets", () => {
    // aria-current appeared zero times app-wide before this pass; sort state
    // had exactly the same problem.
    renderTable();
    return userEvent.click(screen.getByRole("button", { name: /שירות/ })).then(() => {
      const [name, price] = screen.getAllByRole("columnheader");
      expect(name.getAttribute("aria-sort")).toBe("ascending");
      expect(price.getAttribute("aria-sort")).toBeNull();
    });
  });

  it("toggles direction on a second click", async () => {
    renderTable();
    const button = screen.getByRole("button", { name: /מחיר/ });
    await userEvent.click(button);
    expect(screen.getAllByRole("columnheader")[1].getAttribute("aria-sort")).toBe(
      "ascending"
    );
    await userEvent.click(button);
    expect(screen.getAllByRole("columnheader")[1].getAttribute("aria-sort")).toBe(
      "descending"
    );
  });

  it("actually reorders the rows", async () => {
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: /מחיר/ }));
    const cells = screen.getAllByRole("cell").map((c) => c.textContent);
    // ascending by price: 120, 250, 400
    expect(cells).toEqual(["עיצוב גבות", "₪120", "טיפול פנים", "₪250", "איפור", "₪400"]);
  });

  it("sorts Hebrew by collation, not by code point", async () => {
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: /שירות/ }));
    const names = screen
      .getAllByRole("cell")
      .map((c) => c.textContent)
      .filter((t) => !t?.startsWith("₪"));
    expect(names).toEqual(["איפור", "טיפול פנים", "עיצוב גבות"]);
  });

  it("does not mutate the caller's array", async () => {
    const original = [...rows];
    renderTable();
    await userEvent.click(screen.getByRole("button", { name: /מחיר/ }));
    // Reordering the array a caller still holds would reorder it everywhere.
    expect(rows).toEqual(original);
  });

  it("offers no sort control for a column that cannot be sorted", () => {
    render(
      <Table<Row>
        caption="ללא מיון"
        columns={[{ id: "name", header: "שירות", cell: (r) => r.name }]}
        rows={rows}
        rowKey={(r) => r.id}
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("empty state", () => {
  it("renders the fallback instead of an empty table", () => {
    // An empty table with headers reads as "there should be something here and
    // it failed to load".
    renderTable({ rows: [], empty: <p>אין עדיין שירותים</p> });
    expect(screen.getByText("אין עדיין שירותים")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("still renders the table when no fallback is supplied", () => {
    renderTable({ rows: [] });
    expect(screen.getByRole("table")).toBeDefined();
  });
});
