// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

type Row = Record<string, unknown>;
type Column = Record<string, unknown> & { id: string };
type SyncOptions = { repeatFor?: Record<string, unknown> | null; rowCompletion?: Record<string, unknown> | null; columns: Column[]; makeRowId?: () => string };
type Helpers = {
  syncRows(source: Row[], target: Row[], options: SyncOptions): Row[];
  signature(rows: Row[]): string;
  buildColumns(columns: Column[], repeatFor: unknown, completion: unknown, modal: boolean, translate?: unknown): Column[];
};
type Kit = { validate: (configs: unknown[], values: Record<string, unknown>, options?: Record<string, unknown>) => Array<Record<string, unknown>> };

// ---------------------------------------------------------------------------
// Minimal engine scope: Fluent + MOIS controls as plain DOM elements.
// ---------------------------------------------------------------------------
const h = React.createElement;
const Box = ({ children }: { children?: React.ReactNode }) => h("div", null, children);
const Text = ({ children, role }: { children?: React.ReactNode; role?: string }) => h("span", { role }, children);
const Button = ({ text, onClick, title, ariaLabel }: { text?: string; onClick?: () => void; title?: string; ariaLabel?: string }) =>
  h("button", { type: "button", onClick, title, "aria-label": ariaLabel ?? title ?? text }, text ?? title);
const Dialog = ({ hidden, dialogContentProps, children }: { hidden?: boolean; dialogContentProps?: { title?: string; subText?: string }; children?: React.ReactNode }) =>
  hidden ? null : h("div", { role: "dialog" }, h("h2", null, dialogContentProps?.title), h("p", null, dialogContentProps?.subText), children);
const Field = (props: { value?: unknown; readOnly?: boolean; onChange?: (...args: unknown[]) => void }) =>
  h("input", {
    value: props.value == null ? "" : String(props.value),
    readOnly: props.readOnly,
    "data-readonly": props.readOnly ? "true" : "false",
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChange?.(event, event.target.value),
  });
// SimpleCodeSelect reports (coding, codings).
const CodeField = (props: { value?: { code?: string } | null; readOnly?: boolean; onChange?: (...args: unknown[]) => void }) =>
  h("input", {
    value: props.value?.code ?? "",
    readOnly: props.readOnly,
    "data-readonly": props.readOnly ? "true" : "false",
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChange?.({ code: event.target.value }, []),
  });
const Fluent = {
  Stack: Box, Label: Text, Text, IconButton: Button, DefaultButton: Button, PrimaryButton: Button,
  Dialog, DialogType: { normal: 0, largeHeader: 1 }, DialogFooter: Box, TooltipHost: Box,
};

type ActiveTuple = [Record<string, unknown>, (updater: unknown) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => undefined]);
const useActiveData = () => {
  const [state, setState] = React.useContext(ActiveDataContext);
  return [{ ...state, setFormData: setState }, setState];
};

function loadRuntime() {
  const source = ["FormulaKit", "FormLogicKit", "EditableTable", "RepeatForEachTable"].map(read).join("\n");
  const compiled = Babel.transform(`var EditableTable;\n${source}`, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const scope: Record<string, unknown> = {
    window: {},
    React,
    Fluent,
    produce,
    useActiveData,
    useTheme: () => ({}),
    useSourceData: () => ({}),
    useSection: () => null,
    TextArea: Field, Numeric: Field, DateSelect: Field, DateTimeSelect: Field, TimeSelect: Field,
    SimpleCodeSelect: CodeField, OptionChoice: Field,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compiled};\nreturn { EditableTable, RepeatForEachTable, FormLogicKit };`)(
    ...Object.values(scope),
  ) as {
    EditableTable: React.ComponentType<Record<string, unknown>>;
    RepeatForEachTable: React.ComponentType<Record<string, unknown>> & { helpers: Helpers };
    FormLogicKit: Kit;
  };
}

const runtime = loadRuntime();
const helpers = runtime.RepeatForEachTable.helpers;

// ---------------------------------------------------------------------------
// Fixtures: a medication list and an adherence table repeating for it.
// ---------------------------------------------------------------------------
const adherenceColumns: Column[] = [
  { id: "taking", title: "Taking as prescribed?", type: "dropdown", options: ["Yes", "No"] },
  { id: "missed", title: "Missed doses (last week)", type: "number" },
];
const repeatFor = {
  sourceFieldId: "meds",
  labelColumnId: "name",
  labelTitle: "Medication",
  filter: { match: "all", conditions: [{ controllerFieldId: "status", condition: { type: "choice-selected", optionValues: ["active"] } }] },
  orphanPolicy: "remove-if-unanswered",
  allowManualRows: false,
};
const med = (rowId: string, name: string, status = "active") => ({ _rowId: rowId, name, dose: "", status });
let ids = 0;
const sync = (source: Row[], target: Row[], extra: Partial<SyncOptions> = {}) =>
  helpers.syncRows(source, target, { repeatFor, columns: adherenceColumns, makeRowId: () => `new_${(ids += 1)}`, ...extra });

describe("RepeatForEachTable.helpers.syncRows", () => {
  it("seeds one row per matching source row, keyed by the source _rowId, with a label", () => {
    const rows = sync([med("m1", "Metformin"), med("m2", "Ramipril", "stopped"), med("m3", "Atorvastatin"), { _rowId: "blank", name: "", status: "" }], []);
    expect(rows.map((row) => [row._sourceKey, row._sourceLabel])).toEqual([["m1", "Metformin"], ["m3", "Atorvastatin"]]);
    expect(rows[0]).toMatchObject({ taking: "", missed: "" });
    expect(typeof rows[0]._rowId).toBe("string");
  });

  it("is idempotent (the _rowId-insensitive signature is stable)", () => {
    const source = [med("m1", "Metformin"), med("m3", "Atorvastatin")];
    const once = sync(source, []);
    const twice = sync(source, once);
    expect(helpers.signature(twice)).toBe(helpers.signature(once));
    expect(twice.map((row) => row._rowId)).toEqual(once.map((row) => row._rowId));
  });

  it("keeps answers when the source row is renamed and follows source order", () => {
    const first = sync([med("m1", "Metformin"), med("m3", "Atorvastatin")], []);
    first[1].taking = "Yes";
    const next = sync([med("m3", "Atorvastatin 20 mg"), med("m1", "Metformin")], first);
    expect(next.map((row) => row._sourceLabel)).toEqual(["Atorvastatin 20 mg", "Metformin"]);
    expect(next[0]).toMatchObject({ _sourceKey: "m3", taking: "Yes" });
  });

  it("removes an unanswered orphan and keeps an answered one flagged", () => {
    const first = sync([med("m1", "Metformin"), med("m3", "Atorvastatin")], []);
    first[0].missed = 2;
    // m1 stopped (filtered out), m3 deleted: m1 answered -> kept + flagged; m3 unanswered -> removed.
    const next = sync([med("m1", "Metformin", "stopped")], first);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ _sourceKey: "m1", _sourceRemoved: true, missed: 2, _rowStatus: "No longer listed" });
    // Back to active: the same row returns, unflagged.
    const back = sync([med("m1", "Metformin")], next);
    expect(back[0]._sourceRemoved).toBeUndefined();
    expect(back[0]._rowId).toBe(next[0]._rowId);
  });

  it("applies the keep-flagged and remove orphan policies", () => {
    const first = sync([med("m1", "Metformin")], []);
    expect(sync([], first, { repeatFor: { ...repeatFor, orphanPolicy: "keep-flagged" } })[0]._sourceRemoved).toBe(true);
    first[0].taking = "No";
    expect(sync([], first, { repeatFor: { ...repeatFor, orphanPolicy: "remove" } })).toEqual([]);
  });

  it("keys by a source column when asked, suffixing duplicates", () => {
    const rows = sync([med("a", "Metformin"), med("b", "Metformin")], [], { repeatFor: { ...repeatFor, keyColumnId: "name" } });
    expect(rows.map((row) => row._sourceKey)).toEqual(["Metformin", "Metformin#2"]);
  });

  it("drops unanswered manual rows unless manual rows are allowed", () => {
    const manual = { _rowId: "x", taking: "", missed: "" };
    expect(sync([med("m1", "Metformin")], [manual])).toHaveLength(1);
    expect(sync([med("m1", "Metformin")], [manual], { repeatFor: { ...repeatFor, allowManualRows: true } })).toHaveLength(2);
    // Answers are never discarded.
    expect(sync([med("m1", "Metformin")], [{ ...manual, taking: "Yes" }])).toHaveLength(2);
  });

  it("copies the label into a target column when configured", () => {
    const columns = [{ id: "medName", title: "Medication", type: "text" }, ...adherenceColumns];
    const rows = sync([med("m1", "Metformin")], [], { columns, repeatFor: { ...repeatFor, labelTargetColumnId: "medName" } });
    expect(rows[0].medName).toBe("Metformin");
  });

  it("computes _complete and the status from the required columns", () => {
    const rowCompletion = { enabled: true, requiredColumnIds: ["taking"] };
    const first = sync([med("m1", "Metformin"), med("m3", "Atorvastatin")], [], { rowCompletion });
    expect(first.map((row) => [row._complete, row._rowStatus])).toEqual([[false, "Incomplete"], [false, "Incomplete"]]);
    first[0].taking = "Yes";
    const next = sync([med("m1", "Metformin"), med("m3", "Atorvastatin")], first, { rowCompletion });
    expect(next.map((row) => [row._complete, row._rowStatus])).toEqual([[true, "Complete"], [false, "Incomplete"]]);
  });

  it("builds read-only formula display columns inline and template columns in modal mode", () => {
    const inline = helpers.buildColumns(adherenceColumns, repeatFor, { enabled: true, statusLabel: "Done?" }, false);
    expect(inline.map((column) => column.id)).toEqual(["__repeatLabel", "taking", "missed", "__repeatStatus"]);
    expect(inline[0]).toMatchObject({ title: "Medication", dataPath: "_sourceLabel", computedValue: { mode: "formula", expression: "[_sourceLabel]", calculationPolicy: "always-calculated" } });
    expect(inline[3]).toMatchObject({ title: "Done?", computedValue: { mode: "formula" } });
    const modal = helpers.buildColumns(adherenceColumns, repeatFor, null, true);
    expect(modal[0]).toMatchObject({ computedValue: { mode: "template", template: "{_sourceLabel}" }, showInModal: false });
  });
});

// ---------------------------------------------------------------------------
// Rendered behaviour through the real EditableTable.
// ---------------------------------------------------------------------------
let root: Root | null = null;
let container: HTMLElement | null = null;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function mount(element: (state: Record<string, unknown>) => React.ReactElement, data: Record<string, unknown>) {
  let state: Record<string, unknown> = { field: { data, status: {}, history: [] } };
  let setState: (updater: unknown) => void = () => undefined;
  let dispatches = 0;
  const Harness = () => {
    const [current, set] = React.useState(state);
    state = current;
    setState = (updater: unknown) => {
      dispatches += 1;
      set((previous) => (typeof updater === "function" ? produce(previous, updater as (draft: unknown) => void) : (updater as typeof previous)));
    };
    return h(ActiveDataContext.Provider, { value: [current, setState] }, element(current));
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(h(Harness)));
  return {
    data: () => (state.field as { data: Record<string, unknown> }).data,
    dispatches: () => dispatches,
    update: async (recipe: (data: Record<string, unknown>) => void) => {
      await act(async () => setState((draft: { field: { data: Record<string, unknown> } }) => recipe(draft.field.data)));
    },
    click: async (element: Element) => {
      await act(async () => (element as HTMLElement).click());
    },
    type: async (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
  };
}

const adherenceProps = {
  id: "adherence",
  label: "Adherence",
  columns: adherenceColumns,
  mode: "inline",
  maxRows: 10,
  initialRows: 1,
  allowAddRows: true,
  allowEditRows: true,
  allowDeleteRows: true,
  allowDeleteNonEmpty: true,
  repeatFor,
  rowCompletion: { enabled: true, requiredColumnIds: ["taking"], requireAllComplete: true },
};

describe("RepeatForEachTable (rendered)", () => {
  it("seeds rows once, never seeds EditableTable's blank row, and settles without an update loop", async () => {
    const view = await mount(() => h(runtime.RepeatForEachTable, adherenceProps), {
      meds: [med("m1", "Metformin"), med("m2", "Ramipril", "stopped"), med("m3", "Atorvastatin")],
    });
    const rows = view.data().adherence as Row[];
    expect(rows.map((row) => row._sourceLabel)).toEqual(["Metformin", "Atorvastatin"]);
    expect(rows.every((row) => row._sourceKey)).toBe(true);
    expect(view.dispatches()).toBeLessThanOrEqual(2);
    // The label and status cells render read-only; the answers are editable.
    const labelCells = Array.from(container!.querySelectorAll("tbody input")).filter((input) => (input as HTMLInputElement).value === "Metformin");
    expect(labelCells[0]?.getAttribute("data-readonly")).toBe("true");
    // No "+ Add Row" without manual rows.
    expect(container!.textContent).not.toContain("+ Add Row");
  });

  it("follows source edits: new active meds add rows, answered stopped meds stay flagged", async () => {
    const view = await mount(() => h(runtime.RepeatForEachTable, adherenceProps), {
      meds: [med("m1", "Metformin"), med("m3", "Atorvastatin")],
    });
    await view.update((data) => {
      (data.adherence as Row[])[0].taking = "Yes";
    });
    await view.update((data) => {
      const meds = data.meds as Row[];
      meds[0].status = "stopped";
      meds.push(med("m4", "Insulin"));
    });
    const before = view.dispatches();
    const rows = view.data().adherence as Row[];
    expect(rows.map((row) => [row._sourceLabel, row._sourceRemoved ?? false, row._rowStatus])).toEqual([
      ["Atorvastatin", false, "Incomplete"],
      ["Insulin", false, "Incomplete"],
      ["Metformin", true, "No longer listed"],
    ]);
    // Settled: re-rendering does not write again.
    await view.update(() => undefined);
    expect(view.dispatches() - before).toBe(1);
  });

  it("does not let a source-driven row be deleted", async () => {
    const view = await mount(() => h(runtime.RepeatForEachTable, adherenceProps), {
      meds: [med("m1", "Metformin"), med("m3", "Atorvastatin")],
    });
    const remove = container!.querySelector("button[title='Remove row']");
    expect(remove).not.toBeNull();
    await view.click(remove!);
    expect((view.data().adherence as Row[]).map((row) => row._sourceLabel)).toEqual(["Metformin", "Atorvastatin"]);
    expect(container!.querySelector("[role='status']")?.textContent).toMatch(/follows the table/);
  });

  it("asks before deleting a manual row when confirmDelete is on", async () => {
    const props = {
      ...adherenceProps,
      repeatFor: { ...repeatFor, allowManualRows: true },
      confirmDelete: true,
    };
    const view = await mount(() => h(runtime.RepeatForEachTable, props), { meds: [med("m1", "Metformin")] });
    await view.click(Array.from(container!.querySelectorAll("button")).find((button) => button.textContent === "+ Add Row")!);
    expect(view.data().adherence as Row[]).toHaveLength(2);
    const manualRemove = container!.querySelectorAll("button[title='Remove row']");
    await view.click(manualRemove[manualRemove.length - 1]);
    // Still there until confirmed.
    expect(view.data().adherence as Row[]).toHaveLength(2);
    const dialog = container!.querySelector("[role='dialog']");
    expect(dialog?.textContent).toContain("Delete this row?");
    await view.click(Array.from(dialog!.querySelectorAll("button")).find((button) => button.textContent === "Cancel")!);
    expect(view.data().adherence as Row[]).toHaveLength(2);
    const again = container!.querySelectorAll("button[title='Remove row']");
    await view.click(again[again.length - 1]);
    await view.click(Array.from(container!.querySelector("[role='dialog']")!.querySelectorAll("button")).find((button) => button.textContent === "Delete")!);
    expect((view.data().adherence as Row[]).map((row) => row._sourceLabel)).toEqual(["Metformin"]);
  });

  it("marks rows complete as the filler answers", async () => {
    const view = await mount(() => h(runtime.RepeatForEachTable, adherenceProps), { meds: [med("m1", "Metformin")] });
    const answer = container!.querySelectorAll("tbody input")[1] as HTMLInputElement;
    await view.type(answer, "Yes");
    const [row] = view.data().adherence as Row[];
    expect(row).toMatchObject({ taking: "Yes", _complete: true, _rowStatus: "Complete" });
  });
});

describe("EditableTable modal mode (create-on-first-save)", () => {
  it("adds no row until the dialog is saved, and none on cancel", async () => {
    const props = { id: "contacts", columns: [{ id: "name", title: "Name", type: "text" }], mode: "modal", maxRows: 5, allowAddRows: true };
    const view = await mount(() => h(runtime.EditableTable, props), {});
    expect(view.data().contacts).toEqual([]);
    const addButton = () => Array.from(container!.querySelectorAll("button")).find((button) => button.textContent === "+ Add Row")!;
    await view.click(addButton());
    expect(container!.querySelector("[role='dialog']")).not.toBeNull();
    expect(view.data().contacts).toEqual([]);
    await view.click(Array.from(container!.querySelectorAll("button")).find((button) => button.textContent === "Cancel")!);
    expect(view.data().contacts).toEqual([]);
    // Saving an untouched draft stores an empty row, but the summary hides it.
    await view.click(addButton());
    await view.type(container!.querySelector("[role='dialog'] input") as HTMLInputElement, "Ada");
    await view.click(Array.from(container!.querySelectorAll("button")).find((button) => button.textContent === "Save")!);
    expect((view.data().contacts as Row[]).map((row) => row.name)).toEqual(["Ada"]);
  });
});

describe("FormLogicKit.validate table rows", () => {
  const config = {
    fieldId: "adherence", label: "Adherence", required: false, requiredCapable: true, hidden: false,
    rules: [], validations: [], optionRules: [], pageIndex: 3,
    table: { requiredColumnIds: ["taking"], requireAllComplete: true },
  };

  it("reports one row-incomplete issue per unfinished seeded row", () => {
    const values = {
      adherence: [
        { _rowId: "a", _sourceKey: "m1", _sourceLabel: "Metformin", taking: "Yes" },
        { _rowId: "b", _sourceKey: "m3", _sourceLabel: "Atorvastatin", taking: "" },
        { _rowId: "c", _sourceKey: "m9", _sourceLabel: "Old", _sourceRemoved: true, taking: "" },
        { _rowId: "d", taking: "", missed: "" },
      ],
    };
    expect(runtime.FormLogicKit.validate([config], values)).toEqual([
      { fieldId: "adherence", label: "Adherence", message: "Adherence: complete Atorvastatin", pageIndex: 3, kind: "row-incomplete" },
    ]);
  });

  it("names every incomplete row in one issue for the table", () => {
    const values = {
      adherence: [
        { _rowId: "a", _sourceKey: "m1", _sourceLabel: "Metformin", taking: "" },
        { _rowId: "b", _sourceKey: "m2", _sourceLabel: "Ramipril", taking: "Yes" },
        { _rowId: "c", _sourceKey: "m3", _sourceLabel: "Atorvastatin", taking: "" },
        { _rowId: "d", _sourceKey: "m4", _sourceLabel: "Levothyroxine", taking: "" },
        { _rowId: "e", taking: "", missed: 2 },
      ],
    };
    expect(runtime.FormLogicKit.validate([config], values)).toEqual([
      { fieldId: "adherence", label: "Adherence", message: "Adherence: complete Metformin, Atorvastatin, Levothyroxine and row 5", pageIndex: 3, kind: "row-incomplete" },
    ]);
  });

  it("counts started manual rows, names them by position, and only blocks when asked", () => {
    const values = { adherence: [{ _rowId: "d", taking: "", missed: 3 }] };
    expect(runtime.FormLogicKit.validate([config], values)[0]?.message).toBe("Adherence: complete row 1");
    expect(runtime.FormLogicKit.validate([{ ...config, table: { ...config.table, requireAllComplete: false } }], values)).toEqual([]);
  });

  it("treats a table without rows as unanswered for required", () => {
    expect(runtime.FormLogicKit.validate([{ ...config, required: true }], { adherence: [] })[0]).toMatchObject({ kind: "required" });
    expect(runtime.FormLogicKit.validate([config], { adherence: [] })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Off-page sync (FormFlow Next / review, submit) + empty state + item count.
// ---------------------------------------------------------------------------
type SyncStatics = {
  syncFormData(values: Record<string, unknown>, tables: unknown[]): Record<string, unknown> | null;
  syncActiveData(fd: unknown, tables: unknown[], synced?: Record<string, unknown> | null): void;
  syncSubmitPayload(payload: { formData?: Record<string, unknown> }, fd: unknown, tables: unknown[]): void;
};
const statics = runtime.RepeatForEachTable as unknown as SyncStatics;
const repeatItemCount = (runtime.FormLogicKit as unknown as { repeatItemCount(values: unknown, repeatFor: unknown): number }).repeatItemCount;

describe("RepeatForEachTable off-page sync", () => {
  const spec = {
    id: "adherence",
    repeatFor,
    rowCompletion: { enabled: true, requiredColumnIds: ["taking"], requireAllComplete: true },
    columns: adherenceColumns,
  };
  // A follower of the follower (chains settle in one call).
  const notes = {
    id: "notes",
    repeatFor: { sourceFieldId: "adherence", labelColumnId: "_sourceLabel", orphanPolicy: "remove" },
    columns: [{ id: "note", type: "text" }],
  };

  it("seeds a never-shown follower and returns null once current (converges)", () => {
    const values = { meds: [med("m1", "Metformin"), med("m2", "Ramipril", "stopped")] };
    const synced = statics.syncFormData(values, [spec])!;
    expect(values).not.toHaveProperty("adherence"); // pure
    expect((synced.adherence as Row[]).map((row) => [row._sourceLabel, row._rowStatus])).toEqual([["Metformin", "Incomplete"]]);
    expect(statics.syncFormData(synced, [spec])).toBeNull();
    // Nothing to seed and nothing stored: stays absent.
    expect(statics.syncFormData({ meds: [] }, [spec])).toBeNull();
  });

  it("adds a row for a medication added after the follower was synced, keeping answers", () => {
    const first = statics.syncFormData({ meds: [med("m1", "Metformin")] }, [spec])!;
    (first.adherence as Row[])[0].taking = "Yes";
    (first.meds as Row[]).push(med("m4", "Insulin"));
    const second = statics.syncFormData(first, [spec])!;
    expect((second.adherence as Row[]).map((row) => [row._sourceLabel, row.taking, row._complete])).toEqual([
      ["Metformin", "Yes", true],
      ["Insulin", "", false],
    ]);
    const issues = runtime.FormLogicKit.validate([
      { fieldId: "adherence", label: "Adherence", required: false, requiredCapable: true, hidden: false, rules: [], validations: [], optionRules: [], table: { requiredColumnIds: ["taking"], requireAllComplete: true } },
    ], second);
    expect(issues).toEqual([expect.objectContaining({ kind: "row-incomplete", message: "Adherence: complete Insulin" })]);
  });

  it("settles a follower of a follower whatever the spec order", () => {
    // Adherence rows only count as source rows for "notes" once answered.
    const first = statics.syncFormData({ meds: [med("m1", "Metformin")] }, [notes, spec])!;
    expect(first).not.toHaveProperty("notes");
    (first.adherence as Row[])[0].taking = "Yes";
    const second = statics.syncFormData(first, [notes, spec])!;
    expect((second.notes as Row[]).map((row) => row._sourceLabel)).toEqual(["Metformin"]);
    expect(statics.syncFormData(second, [notes, spec])).toBeNull();
  });

  it("writes the same rows (ids included) into ActiveData and the submit payload", () => {
    let state: Record<string, unknown> = { field: { data: { meds: [med("m1", "Metformin")] } } };
    const fd = { setFormData: (update: (previous: typeof state) => typeof state) => { state = update(state); } };
    const payload = { formData: { meds: [med("m1", "Metformin")] } as Record<string, unknown> };
    statics.syncSubmitPayload(payload, fd, [spec]);
    const submitted = payload.formData.adherence as Row[];
    const stored = (state.field as { data: Record<string, unknown> }).data.adherence as Row[];
    expect(submitted).toHaveLength(1);
    expect(stored.map((row) => row._rowId)).toEqual(submitted.map((row) => row._rowId));
    // Already current: the payload is left as it is.
    const again = { formData: payload.formData };
    statics.syncSubmitPayload(again, fd, [spec]);
    expect(again.formData).toBe(payload.formData);
  });

  it("never syncs a read-only spec", () => {
    expect(statics.syncFormData({ meds: [med("m1", "Metformin")] }, [{ ...spec, readOnly: true }])).toBeNull();
  });
});

describe("RepeatForEachTable empty state", () => {
  it("shows a message instead of an empty grid when no source row matches", async () => {
    await mount(() => h(runtime.RepeatForEachTable, adherenceProps), { meds: [med("m2", "Ramipril", "stopped")] });
    expect(container!.textContent).toContain("No matching medication — nothing to answer here.");
    expect(container!.querySelector("table")).toBeNull();
  });

  it("uses the configured message and keeps the grid when people may add rows", async () => {
    const props = { ...adherenceProps, repeatFor: { ...repeatFor, allowManualRows: true, emptyMessage: "No active medications." } };
    await mount(() => h(runtime.RepeatForEachTable, props), { meds: [] });
    expect(container!.textContent).toContain("No active medications.");
    expect(container!.textContent).toContain("+ Add Row");
  });

  it("shows no message once a row matches", async () => {
    await mount(() => h(runtime.RepeatForEachTable, adherenceProps), { meds: [med("m1", "Metformin")] });
    expect(container!.textContent).not.toContain("nothing to answer here");
  });
});

describe("FormLogicKit.repeatItemCount", () => {
  it("counts exactly the source rows syncRows seeds", () => {
    const cases: Row[][] = [
      [],
      [med("m1", "Metformin"), med("m2", "Ramipril", "stopped"), { _rowId: "blank", name: "", status: "" }],
      [med("m1", "Metformin"), med("m3", "Atorvastatin")],
      [{ _rowId: "x", name: "", status: "active" }],
    ];
    for (const source of cases) {
      const seeded = sync(source, []).filter((row) => row._sourceKey && !row._sourceRemoved).length;
      expect(repeatItemCount({ meds: source }, repeatFor)).toBe(seeded);
    }
    // Key column: rows without a key are not items.
    const keyed = { ...repeatFor, keyColumnId: "name", filter: null };
    expect(repeatItemCount({ meds: [med("a", ""), med("b", "Insulin")] }, keyed)).toBe(sync([med("a", ""), med("b", "Insulin")], [], { repeatFor: keyed }).length);
    expect(repeatItemCount({}, repeatFor)).toBe(0);
    expect(repeatItemCount({ meds: [med("m1", "Metformin")] }, null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// "One card per item" presentation (repeatFor.presentation = "cards").
// ---------------------------------------------------------------------------
describe("RepeatForEachTable cards presentation", () => {
  const cardsFor = { ...repeatFor, presentation: "cards" };
  const cardsProps = { ...adherenceProps, repeatFor: cardsFor };
  const cards = () => Array.from(container!.querySelectorAll("[data-repeat-for-card]"));

  it("renders one card per item, headed by its label, with the table's questions stacked", async () => {
    const view = await mount(() => h(runtime.RepeatForEachTable, cardsProps), {
      meds: [med("m1", "Metformin"), med("m2", "Ramipril", "stopped"), med("m3", "Atorvastatin")],
    });
    expect(container!.querySelector("table")).toBeNull();
    expect(container!.querySelector("[data-repeat-for-presentation='cards']")).not.toBeNull();
    expect(cards().map((card) => card.getAttribute("aria-label"))).toEqual(["Metformin", "Atorvastatin"]);
    const first = cards()[0];
    expect(Array.from(first.querySelectorAll("[data-repeat-for-question]")).map((node) => node.getAttribute("data-repeat-for-question"))).toEqual(["taking", "missed"]);
    expect(first.textContent).toContain("Taking as prescribed?");
    expect(first.textContent).toContain("Status: Incomplete");
    // Same data shape as the grid: the rows array, synced the same way.
    const rows = view.data().adherence as Row[];
    expect(rows.map((row) => [row._sourceLabel, row._complete, row._rowStatus])).toEqual([
      ["Metformin", false, "Incomplete"],
      ["Atorvastatin", false, "Incomplete"],
    ]);
    expect(helpers.signature(rows)).toBe(helpers.signature(sync([med("m1", "Metformin"), med("m2", "Ramipril", "stopped"), med("m3", "Atorvastatin")], [], { rowCompletion: adherenceProps.rowCompletion })));
    expect(view.dispatches()).toBeLessThanOrEqual(2);
  });

  it("writes answers into the row and updates its completion", async () => {
    const view = await mount(() => h(runtime.RepeatForEachTable, cardsProps), { meds: [med("m1", "Metformin"), med("m3", "Atorvastatin")] });
    const [taking, missed] = Array.from(cards()[1].querySelectorAll("input")) as HTMLInputElement[];
    await view.type(taking, "Yes");
    await view.type(missed, "2");
    const rows = view.data().adherence as Row[];
    expect(rows[1]).toMatchObject({ _sourceLabel: "Atorvastatin", taking: "Yes", missed: 2, _complete: true, _rowStatus: "Complete" });
    expect(rows[0]).toMatchObject({ _complete: false, taking: "" });
    expect(cards()[1].textContent).toContain("Status: Complete");
    expect(cards()[0].textContent).toContain("Status: Incomplete");
  });

  it("flags a kept orphan, offers to remove it and never offers to remove a listed item", async () => {
    const view = await mount(() => h(runtime.RepeatForEachTable, cardsProps), { meds: [med("m1", "Metformin"), med("m3", "Atorvastatin")] });
    await view.type(cards()[0].querySelector("input") as HTMLInputElement, "No");
    await view.update((data) => {
      (data.meds as Row[])[0].status = "stopped";
    });
    const [listed, orphan] = cards();
    expect(listed.getAttribute("aria-label")).toBe("Atorvastatin");
    expect(orphan.getAttribute("aria-label")).toBe("Metformin");
    expect(orphan.hasAttribute("data-repeat-for-orphan")).toBe(true);
    expect(orphan.textContent).toContain("No longer listed");
    expect(listed.hasAttribute("data-repeat-for-orphan")).toBe(false);
    expect(listed.querySelector("button[aria-label='Remove']")).toBeNull();
    await view.click(orphan.querySelector("button[aria-label='Remove']")!);
    expect((view.data().adherence as Row[]).map((row) => row._sourceLabel)).toEqual(["Atorvastatin"]);
  });

  it("adds manual items as cards when people may add rows, asking before delete", async () => {
    const props = { ...cardsProps, repeatFor: { ...cardsFor, allowManualRows: true }, confirmDelete: true };
    const view = await mount(() => h(runtime.RepeatForEachTable, props), { meds: [med("m1", "Metformin")] });
    await view.click(Array.from(container!.querySelectorAll("button")).find((button) => button.textContent === "+ Add Row")!);
    expect(cards().map((card) => card.getAttribute("aria-label"))).toEqual(["Metformin", "Added item 2"]);
    await view.click(cards()[1].querySelector("button[aria-label='Remove']")!);
    expect(view.data().adherence as Row[]).toHaveLength(2);
    await view.click(Array.from(container!.querySelector("[role='dialog']")!.querySelectorAll("button")).find((button) => button.textContent === "Delete")!);
    expect((view.data().adherence as Row[]).map((row) => row._sourceLabel)).toEqual(["Metformin"]);
  });

  it("keeps the grid for tables with a stamp column", async () => {
    const props = { ...cardsProps, columns: [...adherenceColumns, { id: "initials", title: "Initials", type: "stampButton" }] };
    await mount(() => h(runtime.RepeatForEachTable, props), { meds: [med("m1", "Metformin")] });
    expect(container!.querySelector("table")).not.toBeNull();
    expect(cards()).toHaveLength(0);
  });

  it("recalculates formula columns on a card write, shown read-only", async () => {
    const columns: Column[] = [
      { id: "missed", title: "Missed", type: "number" },
      { id: "doubled", title: "Doubled", type: "number", computedValue: { mode: "formula", expression: "[missed] * 2", calculationPolicy: "always-calculated" } },
    ];
    const view = await mount(() => h(runtime.RepeatForEachTable, { ...cardsProps, columns, rowCompletion: null }), { meds: [med("m1", "Metformin")] });
    const inputs = Array.from(cards()[0].querySelectorAll("input")) as HTMLInputElement[];
    expect(inputs).toHaveLength(1);
    await view.type(inputs[0], "3");
    expect((view.data().adherence as Row[])[0]).toMatchObject({ missed: 3, doubled: "6" });
    expect(cards()[0].textContent).toContain("6");
  });
});

// ---------------------------------------------------------------------------
// Translation (the form's translateFormText, handed over as `translate`).
// ---------------------------------------------------------------------------
describe("RepeatForEachTable translation", () => {
  const french: Record<string, string> = {
    Medication: "Médicament",
    Status: "Statut",
    Complete: "Terminé",
    Incomplete: "Incomplet",
    "No longer listed": "Plus sur la liste",
    "No matching {items} — nothing to answer here.": "Aucun {items} — rien à répondre.",
  };
  const translate = (source: string) => french[source] ?? source;

  it("formats text through translate and fills placeholders afterwards", () => {
    const format = (helpers as unknown as { formatText(t: unknown, s: string, v?: Record<string, unknown>): string }).formatText;
    expect(format(translate, "No matching {items} — nothing to answer here.", { items: "médicament" })).toBe("Aucun médicament — rien à répondre.");
    expect(format(undefined, "Step {n} of {m}", { n: 1, m: 3 })).toBe("Step 1 of 3");
  });

  it("translates the grid's headings and status cells but stores the English status", async () => {
    const view = await mount(() => h(runtime.RepeatForEachTable, { ...adherenceProps, translate }), { meds: [med("m1", "Metformin")] });
    expect(container!.querySelector("thead")?.textContent).toContain("Médicament");
    expect(container!.querySelector("thead")?.textContent).toContain("Statut");
    const values = Array.from(container!.querySelectorAll("tbody input")).map((input) => (input as HTMLInputElement).value);
    expect(values).toContain("Incomplet");
    const [row] = view.data().adherence as Row[];
    expect(row).toMatchObject({ _rowStatus: "Incomplete", _rowStatusText: "Incomplet" });
    expect(view.dispatches()).toBeLessThanOrEqual(2);
    // The off-page sync (no translate) agrees with the mounted rows.
    expect(statics.syncFormData(view.data(), [{ id: "adherence", repeatFor, rowCompletion: adherenceProps.rowCompletion, columns: adherenceColumns }])).toBeNull();
    // Modal mode shows the translated status through its template column.
    const modal = helpers.buildColumns(adherenceColumns, repeatFor, { enabled: true }, true, translate as never);
    expect(modal[modal.length - 1]).toMatchObject({ title: "Statut", computedValue: { template: "{_rowStatusText}" } });
  });

  it("translates the cards' status line, orphan flag and empty message", async () => {
    const props = { ...adherenceProps, repeatFor: { ...repeatFor, presentation: "cards" }, translate };
    const view = await mount(() => h(runtime.RepeatForEachTable, props), { meds: [med("m1", "Metformin")] });
    expect(container!.textContent).toContain("Statut: Incomplet");
    await view.type(container!.querySelector("[data-repeat-for-card] input") as HTMLInputElement, "Yes");
    expect(container!.textContent).toContain("Statut: Terminé");
    await view.update((data) => {
      (data.meds as Row[])[0].status = "stopped";
    });
    expect(container!.textContent).toContain("Plus sur la liste");
    expect(container!.textContent).toContain("Aucun médicament — rien à répondre.");
  });
});
