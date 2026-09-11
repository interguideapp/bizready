"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A real table.
 *
 * `grep "<table>"` over this codebase returned ZERO. Every list of tabular data
 * — products with prices, recurring costs, documents with dates — was
 * `divide-y` divs with no column headers, no sort, and no relationship between
 * a value and what it means. To a screen reader that is a flat run of text: it
 * cannot say "price, ₪250" because nothing marks ₪250 as a price.
 *
 * What this provides that the div lists could not:
 *
 * - `<th scope="col">` on every column, so each cell is announced with its
 *   header.
 * - A `<caption>`, so the table has a name rather than being an unlabelled
 *   region. Visually hidden by default — it is for orientation, not decoration.
 * - `aria-sort` on the sorted column, which is the only way a non-visual user
 *   learns the order changed. The audit found `aria-current` used zero times
 *   app-wide; sort state had the same problem.
 * - An `overflow-x: auto` wrapper, so a wide table scrolls inside itself
 *   instead of making the whole page scroll sideways — which is what the RTL
 *   test now forbids for the body.
 *
 * Sorting is optional and client-side. That is honest for the volumes here
 * (products, costs — tens of rows); anything that needs server-side ordering
 * should page instead, as `getDocuments` now does.
 */

export interface Column<T> {
  /** Stable key, also used as the sort key. */
  id: string;
  header: string;
  /** The cell contents. */
  cell: (row: T) => ReactNode;
  /**
   * Supply to make the column sortable. Returns a comparable primitive — not a
   * comparator, so the sort direction is handled in one place rather than by
   * every column getting it right.
   */
  sortValue?: (row: T) => string | number;
  /** Right-align numerics. In RTL this is the start edge, hence the logical name. */
  numeric?: boolean;
  /** Hide the header text visually while keeping it for assistive tech. */
  headerHidden?: boolean;
  className?: string;
}

export function Table<T>({
  caption,
  captionVisible = false,
  columns,
  rows,
  rowKey,
  empty,
  className,
}: {
  /** Required: a table with no name is an unlabelled region. */
  caption: string;
  captionVisible?: boolean;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Shown instead of an empty table body. */
  empty?: ReactNode;
  className?: string;
}) {
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return rows;
    const get = column.sortValue;
    // Copy before sorting: mutating the caller's array would reorder whatever
    // else holds a reference to it.
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : // he-IL collation, so Hebrew sorts the way a Hebrew reader expects
            // rather than by code point.
            String(av).localeCompare(String(bv), "he");
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    // Wide content scrolls inside its own container, never the page body.
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <caption
          className={cn(
            "text-start text-sm text-ink-muted",
            captionVisible ? "mb-2" : "sr-only"
          )}
        >
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-edge">
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue);
              const active = sort?.id === column.id;
              return (
                <th
                  key={column.id}
                  scope="col"
                  // The only way a non-visual user learns the order changed.
                  aria-sort={
                    active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={cn(
                    "px-3 py-2 text-xs font-semibold text-ink-muted",
                    column.numeric ? "text-end" : "text-start",
                    column.className
                  )}
                >
                  {column.headerHidden ? (
                    <span className="sr-only">{column.header}</span>
                  ) : sortable ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((current) =>
                          current?.id === column.id
                            ? { id: column.id, dir: current.dir === "asc" ? "desc" : "asc" }
                            : { id: column.id, dir: "asc" }
                        )
                      }
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-xs font-semibold text-ink-muted transition hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-edge"
                    >
                      {column.header}
                      {active ? (
                        sort!.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="border-b border-edge-soft last:border-0">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    "px-3 py-2.5 text-ink-soft",
                    column.numeric ? "tnum text-end" : "text-start",
                    column.className
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
