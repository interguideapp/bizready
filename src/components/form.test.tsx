// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "./form";

afterEach(cleanup);

/**
 * The form primitives, verified as RENDERED OUTPUT.
 *
 * These screens sit behind a login, so the browser pane could only ever check
 * the marketing page — which meant the accessibility claims about this layer
 * were assertions about source code rather than about what a screen reader
 * actually receives. Rendering the components closes that gap: every test here
 * queries the accessibility tree the way assistive technology does, by
 * accessible name and role.
 *
 * The defect being guarded is specific: business-card.tsx rendered 11 fields
 * for the user's VAT file, income-tax file, national-insurance file and BANK
 * ACCOUNT with labels that were bare <span>s — no htmlFor, no id. A screen
 * reader announced eleven unlabelled text boxes.
 */

describe("Field gives every control an accessible name", () => {
  it("wires the label to the input, so it is findable by name", () => {
    render(
      <Field label="מספר חשבון">
        <Input defaultValue="12345" />
      </Field>
    );
    // getByLabelText is the query that would have failed on the old markup.
    const input = screen.getByLabelText("מספר חשבון");
    expect(input).toBeDefined();
    expect(input.tagName).toBe("INPUT");
    expect((input as HTMLInputElement).value).toBe("12345");
  });

  it("works for a textarea and a select too", () => {
    render(
      <>
        <Field label="הערות">
          <Textarea />
        </Field>
        <Field label="תדירות">
          <Select options={[{ value: "monthly", label: "חודשי" }]} />
        </Field>
      </>
    );
    expect(screen.getByLabelText("הערות").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("תדירות").tagName).toBe("SELECT");
  });

  it("marks a required field for assistive tech, not just visually", () => {
    render(
      <Field label="מספר העוסק" required>
        <Input />
      </Field>
    );
    // The asterisk is aria-hidden; the words are what gets announced.
    expect(screen.getByText("(שדה חובה)")).toBeDefined();
  });

  it("links a description with aria-describedby", () => {
    render(
      <Field label="אימייל" description="לכאן יישלחו התזכורות">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText("אימייל");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const description = document.getElementById(describedBy!.split(" ")[0]);
    expect(description?.textContent).toBe("לכאן יישלחו התזכורות");
  });
});

describe("errors are announced, not just coloured", () => {
  it("announces the error and marks the field invalid", () => {
    render(
      <Field label="מספר חשבון" error="המספר לא תקין">
        <Input />
      </Field>
    );
    // role="alert" is what makes a screen reader speak it immediately. The app
    // previously had zero aria-live regions of any kind.
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("המספר לא תקין");

    const input = screen.getByLabelText("מספר חשבון");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(
      alert.getAttribute("id")!
    );
  });

  it("is not invalid, and announces nothing, when there is no error", () => {
    render(
      <Field label="מספר חשבון">
        <Input />
      </Field>
    );
    expect(screen.getByLabelText("מספר חשבון").getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByRole("alert")?.textContent ?? "").toBe("");
  });
});

describe("Checkbox is a real checkbox", () => {
  it("is reachable by role and name, with its state exposed", () => {
    // Two of the four previous checkbox implementations were divs, so a
    // keyboard user could not reach them and a screen reader was told nothing
    // about their state.
    render(<Checkbox label="קיבלתי את האישור" checked onChange={() => {}} />);
    const box = screen.getByRole("checkbox", { name: "קיבלתי את האישור" });
    expect((box as HTMLInputElement).checked).toBe(true);
  });

  it("exposes the unchecked state too", () => {
    render(<Checkbox label="מסכים" checked={false} onChange={() => {}} />);
    expect(
      (screen.getByRole("checkbox", { name: "מסכים" }) as HTMLInputElement).checked
    ).toBe(false);
  });
});

describe("FormMessage", () => {
  it("uses alert for a failure, so a failed save is spoken", () => {
    render(<FormMessage tone="error">השמירה לא עברה</FormMessage>);
    expect(screen.getByRole("alert").textContent).toContain("השמירה לא עברה");
  });

  it("uses status for a success, which is announced politely", () => {
    render(<FormMessage tone="success">נשמר</FormMessage>);
    expect(screen.getByRole("status").textContent).toContain("נשמר");
  });
});
