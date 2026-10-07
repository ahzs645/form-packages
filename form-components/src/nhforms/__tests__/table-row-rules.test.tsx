// @vitest-environment happy-dom
// Table row rules shared by EditableTable, RepeatForEachTable and
// FormLogicKit: per-row column visibility (BuilderVisibilityRule through
// FormLogicKit), required-while-shown columns checked on row Save, hidden
// answers (clear / preserve), the subform row editor's field contract and
// value shapes, and row completion that skips hidden columns.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

type Row = Record<string, unknown>;
type Column = Record<string, unknown> & { id: string };
type AnyProps = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------------------------------------------------------------------------
// Minimal engine scope: Fluent + MOIS controls as plain DOM elements that
// expose the props under test (required, placeholder) as attributes.
// ---------------------------------------------------------------------------
const h = React.createElement;
const Box = ({ children }: { children?: React.ReactNode }) => h("div", null, children);
const Text = ({ children, role }: { children?: React.ReactNode; role?: string }) => h("span", { role }, children);
const Label = ({ children, required }: { children?: React.ReactNode; required?: boolean }) =>
  h("label", { "data-required": required ? "true" : "false" }, children);
const Button = ({ text, onClick, title }: { text?: string; onClick?: () => void; title?: string }) =>
  h("button", { type: "button", onClick, title }, text ?? title);
const Dialog = ({ hidden, dialogContentProps, children }: { hidden?: boolean; dialogContentProps?: { title?: string }; children?: React.ReactNode }) =>
  hidden ? null : h("div", { role: "dialog" }, h("h2", null, dialogContentProps?.title), children);
// MOIS controls draw their own label (LayoutItem) unless labelPosition is "none".
const ownLabel = (props: AnyProps) =>
  props.label && props.labelPosition !== "none"
    ? h("label", { "data-required": props.required ? "true" : "false" }, props.label)
    : null;
const Field = (props: AnyProps) =>
  h(React.Fragment, null, ownLabel(props), h("input", {
    value: props.value == null ? "" : String(props.value),
    placeholder: props.placeholder,
    "data-required": props.required ? "true" : "false",
    readOnly: props.readOnly,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChange?.(event, event.target.value),
  }));
// SimpleCodeChecklist, as the engine draws it: bound to its section's store
// (section.activeSelector(fd)[fieldId]); a single choice is a radio group, a
// multiple choice pushes into / filters the list it reads.
const Checklist = (props: AnyProps) => {
  const [fd, setFd] = useActiveData() as [Record<string, unknown>, (updater: unknown) => void];
  const read = () => props.section.activeSelector(fd)[props.fieldId];
  const multiple = props.selectionType === "multiple";
  const current = read();
  const selected: string[] = multiple ? (current || []).map((entry: AnyProps) => entry.code) : current?.code ? [current.code] : [];
  return h("div", { role: multiple ? "group" : "radiogroup", "data-required": props.required ? "true" : "false" },
    (props.optionList as Array<{ key: string; text: string }>).map((option) =>
      h("label", { key: option.key },
        h("input", {
          type: multiple ? "checkbox" : "radio",
          checked: selected.includes(option.key),
          onChange: () => setFd((draft: unknown) => {
            const target = props.section.activeSelector(draft);
            if (!multiple) {
              target[props.fieldId] = { code: option.key, display: option.text };
              return;
            }
            if (!target[props.fieldId]) target[props.fieldId] = [];
            if (selected.includes(option.key)) {
              target[props.fieldId] = target[props.fieldId].filter((entry: AnyProps) => entry.code !== option.key);
            } else {
              target[props.fieldId].push({ code: option.key, display: option.text });
            }
          }),
        }),
        option.text)));
};
// The MOIS SubForm DialogKit draws on: a dialog titled by its label.
const SubForm = ({ hidden, label, children }: AnyProps) =>
  hidden ? null : h("div", { role: "dialog" }, h("h2", null, label), children);
const CodeField = (props: AnyProps) =>
  h("input", {
    value: props.value?.code ?? "",
    "data-required": props.required ? "true" : "false",
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChange?.({ code: event.target.value }, []),
  });
const ChoiceGroup = (props: AnyProps) =>
  h("div", { role: "radiogroup", "data-required": props.required ? "true" : "false" },
    (props.options as Array<{ key: string; text: string }>).map((option) =>
      h("label", { key: option.key },
        h("input", { type: "radio", checked: props.selectedKey === option.key, onChange: () => props.onChange?.({}, option) }),
        option.text)));
const Checkbox = (props: AnyProps) =>
  h("label", null,
    h("input", { type: "checkbox", checked: !!props.checked, onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChange?.(event, event.target.checked) }),
    props.label);
const Fluent = {
  Stack: Box, Label, Text, IconButton: Button, DefaultButton: Button, PrimaryButton: Button,
  Dialog, DialogType: { normal: 0, largeHeader: 1 }, DialogFooter: Box, TooltipHost: Box, ChoiceGroup, Checkbox,
};

// SubformScoring stand-in: records the props EditableTable hands its row editor.
let subform: AnyProps | null = null;
const SubformScoring = (props: AnyProps) => {
  subform = props;
  return h("div", { role: "dialog", "data-subform": "", "data-error": props.errorMessage ?? "", "data-readonly": String(!!props.readOnly) },
    h("button", { type: "button", onClick: () => props.onComplete?.({}) }, props.completeButtonText || "Save"));
};

type ActiveTuple = [Record<string, unknown>, (updater: unknown) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => undefined]);
const useActiveData = () => {
  const [state, setState] = React.useContext(ActiveDataContext);
  return [{ ...state, setFormData: setState }, setState];
};

type Runtime = {
  EditableTable: React.ComponentType<AnyProps>;
  RepeatForEachTable: React.ComponentType<AnyProps> & { helpers: AnyProps };
  FormLogicKit: AnyProps;
  visible: (column: Column, row: Row, columns?: Column[], formData?: Row) => boolean;
  validateRow: (row: Row, config: unknown, columns: Column[], formData?: Row) => string | null;
  clearHidden: (row: Row, columns: Column[], formData?: Row) => Row;
  subformField: (column: Column) => AnyProps;
  subformCellValue: (value: unknown, column: Column) => unknown;
};

let runtimeSourceData: AnyProps = {};

function loadRuntime(onSourceRows?: () => void): Runtime {
  let source = ["ValueKit", "FormulaKit", "FormLogicKit", "FieldKit", "DialogKit", "EditableTable", "RepeatForEachTable"].map(read).join("\n");
  if (onSourceRows) {
    source = source.replace("const _buildRowsFromSourceFields = (", "const __uncachedSourceRows = (")
      .replace("const _normalizeUniqueToken =", "const _buildRowsFromSourceFields = (...args) => { onSourceRows(); return __uncachedSourceRows(...args) };\nconst _normalizeUniqueToken =");
  }
  const compiled = Babel.transform(`var EditableTable;\n${source}`, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const scope: Record<string, unknown> = {
    window: {}, React, Fluent, produce, useActiveData, SubformScoring, onSourceRows,
    useTheme: () => ({}), useSourceData: () => runtimeSourceData, useSection: () => null,
    TextArea: Field, Numeric: Field, DateSelect: Field, DateTimeSelect: Field, TimeSelect: Field,
    SimpleCodeSelect: CodeField, OptionChoice: Field, SimpleCodeChecklist: Checklist,
    SubForm, ButtonBar: Box,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compiled};
return { EditableTable, RepeatForEachTable, FormLogicKit,
  visible: _evaluateColumnVisibility, validateRow: _validateRowWithConfig, clearHidden: _clearHiddenColumnAnswers,
  subformField: _buildSubformFieldFromColumn, subformCellValue: _subformCellValue };`)(...Object.values(scope)) as Runtime;
}

const runtime = loadRuntime();

let root: Root | null = null;
let container: HTMLElement | null = null;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  subform = null;
  runtimeSourceData = {};
});

async function mount(element: () => React.ReactElement, data: Record<string, unknown>) {
  let state: Record<string, unknown> = { field: { data, status: {}, history: [] } };
  let update: (updater: unknown) => void;
  const Harness = () => {
    const [current, set] = React.useState(state);
    state = current;
    const setState = (updater: unknown) =>
      set((previous) => (typeof updater === "function" ? produce(previous, updater as (draft: unknown) => void) : (updater as typeof previous)));
    update = setState;
    return h(ActiveDataContext.Provider, { value: [current, setState] }, element());
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(h(Harness)));
  const button = (text: string) => Array.from(container!.querySelectorAll("button")).find((entry) => entry.textContent === text)!;
  return {
    data: () => (state.field as { data: Record<string, unknown> }).data,
    update: async (updater: (draft: any) => void) => act(async () => update(updater)),
    rerender: async () => act(async () => root!.render(h(Harness))),
    run: async (fn: () => void) => act(async () => fn()),
    click: async (element: Element) => act(async () => (element as HTMLElement).click()),
    button,
    type: async (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
  };
}

describe("EditableTable source hydration caching", () => {
  it("skips unrelated edits and fresh config literals, but reads changed mapped answers and config", async () => {
    const buildRows = vi.fn();
    const { EditableTable } = loadRuntime(buildRows);
    let title = "Note";
    let mappedId = "pdf_note";
    const view = await mount(() => h(EditableTable, {
      id: "records", mode: "modal", columns: [{ id: "note", title, type: "text" }],
      sourceFieldIdsByRow: { 0: { note: mappedId, detail: "pdf_detail" } },
    }), { pdf_note: "saved", pdf_detail: "modal-only", pdf_other: "other" });
    expect(view.data().records).toEqual([expect.objectContaining({ note: "saved", detail: "modal-only" })]);
    const initialBuilds = buildRows.mock.calls.length;
    await view.update(draft => { draft.field.data.unrelated = "changed"; });
    await view.rerender();
    expect(buildRows).toHaveBeenCalledTimes(initialBuilds);

    await view.update(draft => { draft.field.data.pdf_detail = "updated modal-only"; });
    expect(buildRows).toHaveBeenCalledTimes(initialBuilds + 1);
    await view.update(draft => { draft.field.data.pdf_note = "updated"; });
    expect(buildRows).toHaveBeenCalledTimes(initialBuilds + 2);
    title = "Changed label";
    await view.rerender();
    expect(buildRows).toHaveBeenCalledTimes(initialBuilds + 3);
    mappedId = "pdf_other";
    await view.rerender();
    expect(buildRows).toHaveBeenCalledTimes(initialBuilds + 4);
    // Source hydration must not overwrite an already meaningful edited row.
    expect(view.data().records).toEqual([expect.objectContaining({ note: "saved", detail: "modal-only" })]);
  });
});

// ---------------------------------------------------------------------------
// Column visibility
// ---------------------------------------------------------------------------
const medColumns: Column[] = [
  { id: "given", title: "Given", type: "checkbox" },
  { id: "route", title: "Route", type: "dropdown", options: [{ code: "po", display: "Oral" }, { code: "iv", display: "IV" }], choiceStyle: "multiselect" },
  { id: "dose", title: "Dose", type: "number", dataPath: "amount.dose" },
  { id: "note", title: "Note", type: "text" },
];
const withRule = (visibility: Record<string, unknown>): Column => ({ id: "target", title: "Target", type: "text", visibility });

describe("EditableTable column visibility (FormLogicKit)", () => {
  const row: Row = { given: true, route: ["iv"], amount: { dose: 12 }, note: "" };

  it("supports every rule type, naming sibling columns by row path", () => {
    const cases: Array<[Record<string, unknown>, boolean]> = [
      [{ type: "always" }, true],
      [{ type: "not-equals", controllerId: "note", value: "x" }, false], // empty never equals, not even "not equals"
      [{ type: "not-filled", controllerId: "note" }, true],
      [{ type: "filled", controllerId: "note" }, false],
      [{ type: "gte", controllerId: "amount.dose", value: "12" }, true],
      [{ type: "gt", controllerId: "amount.dose", value: "12" }, false],
      [{ type: "lte", controllerId: "amount.dose", value: "12" }, true],
      [{ type: "lt", controllerId: "dose", value: "20" }, true], // by column id too
      [{ type: "equals", controllerId: "given", value: "Yes" }, true], // checkbox = boolean controller
      [{ type: "equals", controllerId: "given", value: "false" }, false],
      [{ type: "not-equals", controllerId: "given", value: "Yes" }, false],
      [{ type: "equals", controllerId: "route", value: "iv" }, true], // choice: multi-select membership
      [{ type: "not-equals", controllerId: "route", value: "po" }, true],
      [{ type: "equals", controllerId: "route", value: "po", match: "any", additionalConditions: [{ type: "filled", controllerId: "note" }] }, false],
      [{ type: "equals", controllerId: "route", value: "po", match: "any", additionalConditions: [{ type: "gt", controllerId: "amount.dose", value: "10" }] }, true],
    ];
    for (const [rule, expected] of cases) {
      expect(runtime.visible(withRule(rule), row, medColumns), JSON.stringify(rule)).toBe(expected);
    }
  });

  it("looks a non-column controller up in the row, then in the form's answers", () => {
    const rule = { type: "equals", controllerId: "unit", value: "ward" };
    expect(runtime.visible(withRule(rule), { unit: "ward" }, medColumns, { unit: "clinic" })).toBe(true);
    expect(runtime.visible(withRule(rule), {}, medColumns, { unit: "ward" })).toBe(true);
    expect(runtime.visible(withRule(rule), {}, medColumns, { unit: "clinic" })).toBe(false);
    // A sibling column never falls back to a form answer of the same name.
    expect(runtime.visible(withRule({ type: "filled", controllerId: "note" }), { note: "" }, medColumns, { note: "form" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Required columns on row Save
// ---------------------------------------------------------------------------
describe("EditableTable required columns (row Save)", () => {
  const columns: Column[] = [
    { id: "taking", title: "Taking", type: "dropdown", options: ["Yes", "No"] },
    { id: "reason", title: "Reason", type: "text", requiredWhenVisible: true, visibility: { type: "equals", controllerId: "taking", value: "No" } },
    { id: "dose", title: "Dose", type: "number", required: true, requiredMessage: "Enter the dose." },
    { id: "hiddenInModal", title: "Summary", type: "text", required: true, showInModal: false },
  ];

  it("enforces required columns without a validationConfig", () => {
    expect(runtime.validateRow({ taking: "Yes", dose: "" }, null, columns)).toBe("Enter the dose.");
    expect(runtime.validateRow({ taking: "Yes", dose: 2 }, null, columns)).toBeNull();
    expect(runtime.validateRow({ taking: "No", dose: 2, reason: " " }, null, columns)).toBe("Reason is required.");
    expect(runtime.validateRow({ taking: "No", dose: 2, reason: "Nausea" }, null, columns)).toBeNull();
  });

  it("names every missing column at once", () => {
    expect(runtime.validateRow({ taking: "No", dose: "", reason: "" }, null, columns)).toBe("Reason and Dose are required.");
    const three = [...columns, { id: "time", title: "Time", type: "time", required: true }];
    expect(runtime.validateRow({ taking: "No" }, undefined, three)).toBe("Reason, Dose and Time are required.");
  });

  it("keeps the legacy validationConfig checks first", () => {
    const config = { requiredPaths: [{ path: "taking", message: "Choose one." }], requireAnyGroups: [] };
    expect(runtime.validateRow({ dose: "" }, config, columns)).toBe("Choose one.");
    expect(runtime.validateRow({ taking: "Yes", dose: "" }, config, columns)).toBe("Enter the dose.");
  });
});

// ---------------------------------------------------------------------------
// Hidden answers
// ---------------------------------------------------------------------------
describe("EditableTable hidden answers", () => {
  const chain: Column[] = [
    { id: "a", type: "checkbox" },
    { id: "b", type: "text", visibility: { type: "equals", controllerId: "a", value: "Yes", hiddenAnswerPolicy: "clear" } },
    { id: "c", type: "text", visibility: { type: "filled", controllerId: "b", hiddenAnswerPolicy: "clear" }, choiceBooleanTargets: { x: "c_x" } },
    { id: "kept", type: "text", visibility: { type: "equals", controllerId: "a", value: "Yes", hiddenAnswerPolicy: "keep" } },
    { id: "preserved", type: "text", visibility: { type: "equals", controllerId: "a", value: "Yes", hiddenAnswerPolicy: "preserve" } },
    { id: "defaulted", type: "text", visibility: { type: "equals", controllerId: "a", value: "Yes" } },
  ];

  it("clears answers of hidden 'clear' columns, following chains, and keeps the rest", () => {
    const row = runtime.clearHidden({ a: false, b: "x", c: "y", c_x: true, kept: "k", preserved: "p", defaulted: "d" }, chain);
    expect(row).toEqual({ a: false, b: "", c: "", c_x: false, kept: "k", preserved: "p", defaulted: "d" });
  });

  it("leaves visible columns alone", () => {
    const row = runtime.clearHidden({ a: true, b: "x", c: "y" }, chain);
    expect(row).toMatchObject({ b: "x", c: "y" });
  });
});

// ---------------------------------------------------------------------------
// Subform row editor contract
// ---------------------------------------------------------------------------
describe("EditableTable subform row editor fields", () => {
  it("carries required, message, help, placeholder and visibility through", () => {
    const visibility = { type: "equals", controllerId: "given", value: "Yes" };
    const field = runtime.subformField({
      id: "dose", title: "Dose", type: "number", requiredWhenVisible: true, requiredMessage: "Enter the dose.",
      helpText: "mg per dose", placeholder: "0", visibility,
    });
    expect(field).toMatchObject({ id: "dose", type: "number", required: true, requiredMessage: "Enter the dose.", helpText: "mg per dose", placeholder: "0", visibility });
    expect(runtime.subformField({ id: "n", type: "text" })).toMatchObject({ required: false, helpText: undefined });
  });

  it("gives checkbox columns true/false options and a boolean prefill", () => {
    const field = runtime.subformField({ id: "given", title: "Given", type: "checkbox", prefill: true, useToggleSwitch: true, booleanLabels: { on: "Yes", off: "No" } });
    expect(field).toMatchObject({ type: "booleanYesNo", renderStyle: "checkbox", useToggleSwitch: true, defaultValue: true });
    expect(field.options).toEqual([{ key: "true", value: 1, text: "Yes" }, { key: "false", value: 0, text: "No" }]);
  });

  it("stores what the inline cells store", () => {
    const checkbox = { id: "given", type: "checkbox", booleanLabels: { on: "Given" } };
    expect(runtime.subformCellValue({ selectedKey: "true", value: 1, response: "Given" }, checkbox)).toBe(true);
    expect(runtime.subformCellValue({ selectedKey: "false", value: 0 }, checkbox)).toBe(false);
    expect(runtime.subformCellValue("Checked", checkbox)).toBe(true);
    expect(runtime.subformCellValue("Given", checkbox)).toBe(true);
    expect(runtime.subformCellValue(null, checkbox)).toBe(false);
    const choice = { id: "route", type: "dropdown" };
    expect(runtime.subformCellValue({ selectedKey: "iv", response: "IV" }, choice)).toBe("iv");
    expect(runtime.subformCellValue(["po", { selectedKey: "iv" }], choice)).toEqual(["po", "iv"]);
    expect(runtime.subformCellValue("text", { id: "t", type: "text" })).toBe("text");
  });
});

describe("EditableTable modal mode with the subform row editor (rendered)", () => {
  it("initializes seeded and new rows from the active user, preserving saved and manual initials", async () => {
    runtimeSourceData = { userProfile: { identity: { initials: "JD" } } };
    const initialsColumns = [{ id: "allergen", title: "Allergen", type: "text" },
      { id: "initials", title: "Initials", type: "text", initialReadPaths: ["userProfile.identity.initials"] }];
    const view = await mount(() => h(runtime.EditableTable, { id: "allergies", mode: "modal", columns: initialsColumns,
      maxRows: 10, initialRows: 1, modalEditorConfig: { seedInitialRows: true } }), {});
    await view.click(view.button("+ Add Row"));
    expect(subform!.dataEntryValueRoot.initials).toBe("JD");
    await view.run(() => subform!.onDataEntryValueChange("allergen", "Peanut"));
    await view.run(() => subform!.onDataEntryValueChange("initials", "ZZ"));
    await view.click(container!.querySelector("[data-subform] button")!);
    runtimeSourceData = { userProfile: { identity: { initials: "NM" } } };
    await view.rerender();
    await view.click(view.button("+ Add Row"));
    expect(subform!.dataEntryValueRoot.initials).toBe("NM");
    expect((view.data().allergies as Row[])[0].initials).toBe("ZZ");
    await view.run(() => subform!.onDataEntryValueChange("allergen", "Latex"));
    await view.click(container!.querySelector("[data-subform] button")!);
    expect(view.data().allergies).toMatchObject([{ allergen: "Peanut", initials: "ZZ" }, { allergen: "Latex", initials: "NM" }]);
    await view.click(container!.querySelector('button[title="Edit"]')!);
    expect(subform!.dataEntryValueRoot.initials).toBe("ZZ");
  });

  const columns: Column[] = [
    { id: "given", title: "Given", type: "checkbox", booleanLabels: { on: "Given" } },
    { id: "dose", title: "Dose", type: "number", requiredWhenVisible: true, visibility: { type: "equals", controllerId: "given", value: "Yes" } },
  ];
  const props = { id: "meds", mode: "modal", columns, maxRows: 5, modalEditorConfig: {} };

  it("shows a failed Save inside the dialog, stores checkbox answers as booleans and saves once valid", async () => {
    const view = await mount(() => h(runtime.EditableTable, props), {});
    await view.click(view.button("+ Add Row"));
    expect(subform).not.toBeNull();
    expect(subform!.readOnly).toBe(false);
    expect(subform!.errorMessage).toBeNull();
    expect(subform!.dataEntryConfig.fields.map((field: AnyProps) => [field.id, field.required])).toEqual([["given", false], ["dose", true]]);

    await view.run(() => subform!.onDataEntryValueChange("given", { selectedKey: "true", value: 1, response: "Given" }));
    expect(subform!.dataEntryValueRoot.given).toBe(true);

    await view.click(container!.querySelector("[data-subform] button")!);
    expect(container!.querySelector("[data-subform]")?.getAttribute("data-error")).toBe("Dose is required.");
    expect(view.data().meds).toEqual([]);

    await view.run(() => subform!.onDataEntryValueChange("dose", 5));
    await view.click(container!.querySelector("[data-subform] button")!);
    expect(container!.querySelector("[data-subform]")).toBeNull();
    expect(view.data().meds).toMatchObject([{ given: true, dose: 5 }]);
  });

  it("never opens the row editor of a read-only table", async () => {
    await mount(() => h(runtime.EditableTable, { ...props, readOnly: true }), { meds: [{ _rowId: "r1", given: true, dose: 1 }] });
    expect(subform).toBeNull();
    expect(container!.textContent).not.toContain("+ Add Row");
  });
});

describe("EditableTable row Dialog (no subform editor)", () => {
  it("marks required labels, shows help text and blocks Save with the column's message", async () => {
    const columns = [{ id: "name", title: "Name", type: "text", required: true, requiredMessage: "Enter a name.", helpText: "As on the card" }];
    const view = await mount(() => h(runtime.EditableTable, { id: "contacts", mode: "modal", columns, maxRows: 5 }), {});
    await view.click(view.button("+ Add Row"));
    const dialog = container!.querySelector("[role='dialog']")!;
    expect(dialog.querySelector("label")?.getAttribute("data-required")).toBe("true");
    expect(dialog.textContent).toContain("As on the card");
    expect(dialog.querySelector("input")?.getAttribute("data-required")).toBe("true");
    await view.click(view.button("Save"));
    expect(container!.querySelector("[role='dialog']")?.textContent).toContain("Enter a name.");
    expect(view.data().contacts).toEqual([]);
    await view.type(container!.querySelector("[role='dialog'] input") as HTMLInputElement, "Ada");
    await view.click(view.button("Save"));
    expect((view.data().contacts as Row[]).map((row) => row.name)).toEqual(["Ada"]);
  });
});

describe("EditableTable inline rows", () => {
  const columns = [
    { id: "taking", title: "Taking", type: "dropdown", options: ["Yes", "No"] },
    { id: "reason", title: "Reason", type: "text", required: true, helpText: "Why not?", placeholder: "Reason", visibility: { type: "equals", controllerId: "taking", value: "No" } },
    { id: "dose", title: "Dose", type: "number", placeholder: "mg" },
  ];

  it("hides a column's cell in rows where its rule hides it and marks required cells", async () => {
    await mount(() => h(runtime.EditableTable, { id: "meds", columns, mode: "inline" }), {
      meds: [{ _rowId: "r1", taking: "No", reason: "", dose: "" }, { _rowId: "r2", taking: "Yes", reason: "", dose: "" }],
    });
    const [first, second] = Array.from(container!.querySelectorAll("tbody tr"));
    expect(first.querySelector("input[placeholder='Reason']")?.getAttribute("data-required")).toBe("true");
    expect(second.querySelector("input[placeholder='Reason']")).toBeNull();
    expect(first.querySelector("input[placeholder='mg']")?.getAttribute("data-required")).toBe("false");
    const heading = Array.from(container!.querySelectorAll("th")).find((cell) => cell.textContent?.startsWith("Reason"))!;
    expect(heading.textContent).toContain("*");
    expect(heading.textContent).toContain("Why not?");
  });
});

// ---------------------------------------------------------------------------
// Row completion skips hidden columns
// ---------------------------------------------------------------------------
describe("row completion skips columns hidden in the row", () => {
  const columns: Column[] = [
    { id: "taking", title: "Taking", type: "dropdown", options: ["Yes", "No"] },
    { id: "reason", title: "Reason", type: "text", visibility: { type: "equals", controllerId: "taking", value: "No" } },
  ];
  const rowCompletion = { enabled: true, requiredColumnIds: ["taking", "reason"], requireAllComplete: true };

  it("RepeatForEachTable marks a row complete when its only missing column is hidden", () => {
    const rows = runtime.RepeatForEachTable.helpers.syncRows([], [
      { _rowId: "a", taking: "Yes", reason: "" },
      { _rowId: "b", taking: "No", reason: "" },
      { _rowId: "c", taking: "No", reason: "Cost" },
    ], { repeatFor: null, rowCompletion, columns });
    expect(rows.map((row: Row) => row._complete)).toEqual([true, false, true]);
  });

  it("reads a form answer for a controller outside the row", () => {
    const formColumns = [columns[0], { ...columns[1], visibility: { type: "equals", controllerId: "askReasons", value: "yes" } }];
    const sync = (formData: Row) => runtime.RepeatForEachTable.helpers.syncRows([], [{ _rowId: "a", taking: "Yes", reason: "" }], { repeatFor: null, rowCompletion, columns: formColumns, formData });
    expect(sync({ askReasons: "no" })[0]._complete).toBe(true);
    expect(sync({ askReasons: "yes" })[0]._complete).toBe(false);
  });

  it("FormLogicKit.validate only names rows missing a shown required column", () => {
    const config = {
      fieldId: "adherence", label: "Adherence", required: false, requiredCapable: true, hidden: false,
      rules: [], validations: [], optionRules: [],
      table: { requiredColumnIds: ["taking", "reason"], requireAllComplete: true, columns },
    };
    const values = { adherence: [
      { _rowId: "a", _sourceKey: "m1", _sourceLabel: "Metformin", taking: "Yes", reason: "" },
      { _rowId: "b", _sourceKey: "m2", _sourceLabel: "Ramipril", taking: "No", reason: "" },
    ] };
    expect(runtime.FormLogicKit.validate([config], values).map((issue: AnyProps) => issue.message)).toEqual(["Adherence: complete Ramipril"]);
    // Without the columns (older exports) every listed column stays required.
    const legacy = { ...config, table: { requiredColumnIds: ["taking", "reason"], requireAllComplete: true } };
    expect(runtime.FormLogicKit.validate([legacy], values).map((issue: AnyProps) => issue.message)).toEqual(["Adherence: complete Metformin and Ramipril"]);
  });
});

// ---------------------------------------------------------------------------
// RepeatForEachTable cards
// ---------------------------------------------------------------------------
describe("RepeatForEachTable cards: choice styles, visibility, required and help", () => {
  const columns = [
    { id: "taking", title: "Taking as prescribed?", type: "dropdown", choiceStyle: "radio", options: ["Yes", "No"] },
    { id: "why", title: "Why not?", type: "dropdown", choiceStyle: "checkbox", options: ["Cost", "Side effects"], requiredWhenVisible: true, helpText: "Pick all that apply",
      visibility: { type: "equals", controllerId: "taking", value: "No", hiddenAnswerPolicy: "clear" } },
  ];
  const props = {
    id: "adherence", columns, mode: "inline", maxRows: 10,
    repeatFor: { sourceFieldId: "meds", labelColumnId: "name", presentation: "cards", allowManualRows: false },
    rowCompletion: { enabled: true, requireAllComplete: true },
  };
  const card = () => container!.querySelector("[data-repeat-for-card]")!;

  it("keeps radio and checkbox-list styles, shows only questions visible in the row and clears hidden answers", async () => {
    const view = await mount(() => h(runtime.RepeatForEachTable, props), { meds: [{ _rowId: "m1", name: "Metformin" }] });
    expect(card().querySelector("[role='radiogroup']")).not.toBeNull();
    // Nothing answered yet: an empty answer never equals "No".
    expect(card().querySelector("[data-repeat-for-question='why']")).toBeNull();

    await view.click(Array.from(card().querySelectorAll("input[type='radio']"))[1]); // No
    expect((view.data().adherence as Row[])[0].taking).toBe("No");
    const why = card().querySelector("[data-repeat-for-question='why']")!;
    expect(why.querySelector("label")?.getAttribute("data-required")).toBe("true");
    expect(why.textContent).toContain("Pick all that apply");
    expect((view.data().adherence as Row[])[0]._complete).toBe(false);

    await view.click(why.querySelectorAll("input[type='checkbox']")[1]);
    await view.click(card().querySelector("[data-repeat-for-question='why']")!.querySelectorAll("input[type='checkbox']")[0]);
    expect((view.data().adherence as Row[])[0]).toMatchObject({ why: ["Cost", "Side effects"], _complete: true });

    await view.click(Array.from(card().querySelectorAll("input[type='radio']"))[0]); // Yes
    expect((view.data().adherence as Row[])[0]).toMatchObject({ taking: "Yes", why: "", _complete: true });
    expect(card().querySelector("[data-repeat-for-question='why']")).toBeNull();
  });
});
