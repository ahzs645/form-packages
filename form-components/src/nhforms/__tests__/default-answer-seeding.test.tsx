// @vitest-environment happy-dom
/**
 * The NHForms containers seed default answers through DefaultsKit: a new
 * EditableTable / RepeatForEachTable row, a SubformScoring entry opened empty,
 * and a LayoutTable cell the section has never saved. A default never
 * overwrites an answer.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");
const compile = (names: string[], prefix = "") =>
  Babel.transform(`${prefix}${names.map(read).join("\n")}`, { presets: ["react"], filename: "index.jsx" }).code ?? "";

type AnyRecord = Record<string, unknown>;
const h = React.createElement;

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // 27 September 2026, 14:05 local time.
  vi.setSystemTime(new Date(2026, 8, 27, 14, 5, 30));
});
afterAll(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// EditableTable and RepeatForEachTable
// ---------------------------------------------------------------------------

type TableRuntime = {
  defaultCell: (column: AnyRecord) => unknown;
  makeEmptyRow: (columns: AnyRecord[], index?: number) => AnyRecord;
  applyDefaults: (row: AnyRecord, fields: AnyRecord[], context?: AnyRecord) => AnyRecord;
  isRowEmpty: (row: AnyRecord, columns: AnyRecord[]) => boolean;
  subformField: (column: AnyRecord) => AnyRecord;
  repeatHelpers: AnyRecord & { syncRows: (source: AnyRecord[], target: AnyRecord[], options: AnyRecord) => AnyRecord[] };
};

function loadTables(withKit: boolean): TableRuntime {
  const names = ["ValueKit", ...(withKit ? ["DefaultsKit"] : []), "FormulaKit", "FormLogicKit", "EditableTable", "RepeatForEachTable"];
  const Stub = () => null;
  const scope: AnyRecord = {
    window: {}, React, produce,
    Fluent: { Stack: Stub, Label: Stub, Text: Stub, IconButton: Stub, DefaultButton: Stub, PrimaryButton: Stub, Dialog: Stub, DialogType: {}, Checkbox: Stub, ChoiceGroup: Stub },
    useActiveData: () => [{}, () => undefined], useTheme: () => ({}), useSourceData: () => ({}), useSection: () => null,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compile(names, "var EditableTable;\n")};
return { defaultCell: _getDefaultCellValue, makeEmptyRow: _makeEmptyRow, applyDefaults: _applyDefaultValuesToRow,
  isRowEmpty: _isRowEmpty, subformField: _buildSubformFieldFromColumn, repeatHelpers: RepeatForEachTable.helpers };`)(...Object.values(scope)) as TableRuntime;
}

describe("EditableTable new rows", () => {
  const tables = loadTables(true);

  it("seeds each column's default answer in every saved shape", () => {
    const columns = [
      { id: "hours", type: "number", prefill: 7.5 },
      { id: "given", type: "date", prefill: { kind: "today" } },
      { id: "seen", type: "date", dateConfig: { prefillToday: true } },
      { id: "at", type: "date", withTime: true, defaultAnswer: { kind: "now" } },
      { id: "site", type: "text", defaultAnswer: { kind: "literal", value: "Clinic" }, prefill: "Clinic" },
      { id: "done", type: "checkbox", prefill: true },
      { id: "note", type: "text" },
      // A chart or observation default has no reader in a table row yet.
      { id: "weight", type: "number", defaultAnswer: { kind: "lastObservation", code: "WEIGHT" } },
    ];
    const row = tables.makeEmptyRow(columns, 0);
    expect(row).toMatchObject({
      hours: "7.5",
      given: "2026-09-27",
      seen: "2026-09-27",
      at: "2026-09-27T14:05",
      site: "Clinic",
      done: true,
      note: "",
      weight: "",
    });
  });

  it("counts an untouched default as no answer", () => {
    const columns = [{ id: "given", type: "date", prefill: { kind: "today" } }, { id: "note", type: "text" }];
    expect(tables.isRowEmpty(tables.makeEmptyRow(columns), columns)).toBe(true);
    expect(tables.isRowEmpty({ given: "2026-09-01", note: "" }, columns)).toBe(false);
  });

  it("fills only empty row-editor fields, resolving every default shape", () => {
    const fields = [
      { id: "seen", type: "date", defaultValue: "__today" },
      { id: "at", type: "datetime", defaultValue: "__now" },
      { id: "kind", type: "choice", defaultValue: { kind: "today" } },
      { id: "next", type: "date", defaultValue: { kind: "nextDateAfterLastRow", sourceColumn: "Date" } },
      { id: "site", type: "text", defaultValue: "Home" },
    ];
    const row = tables.applyDefaults({ site: "Clinic" }, fields, { currentRows: [{ Date: "2026-09-01" }] });
    expect(row).toEqual({
      seen: "2026-09-27",
      at: "2026-09-27T14:05",
      kind: "2026-09-27",
      next: "2026-09-02",
      // Never over an answer.
      site: "Clinic",
    });
  });

  it("passes a checkbox column's default to the row editor", () => {
    expect(tables.subformField({ id: "done", type: "checkbox", defaultAnswer: { kind: "literal", value: true }, prefill: true }).defaultValue).toBe(true);
    expect(tables.subformField({ id: "done", type: "checkbox" }).defaultValue).toBeUndefined();
  });

  it("keeps the prefill-only reading without the kit", () => {
    const legacy = loadTables(false);
    expect(legacy.defaultCell({ id: "hours", type: "number", prefill: 7.5 })).toBe("7.5");
    expect(legacy.defaultCell({ id: "given", type: "date", prefill: { kind: "today" } })).toBe("");
  });
});

describe("RepeatForEachTable new rows", () => {
  it("seeds a repeated row's cells with the column defaults", () => {
    const { repeatHelpers } = loadTables(true);
    const columns = [
      { id: "med", type: "text" },
      { id: "reviewed", type: "date", prefill: { kind: "today" } },
      { id: "taken", type: "checkbox", prefill: true },
    ];
    const rows = repeatHelpers.syncRows(
      [{ _rowId: "m1", name: "Metformin" }],
      [],
      { repeatFor: { sourceFieldId: "meds", keyColumnId: "name", labelColumnId: "name" }, columns, makeRowId: () => "r1" },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reviewed: "2026-09-27", taken: true });
  });
});

// ---------------------------------------------------------------------------
// SubformScoring
// ---------------------------------------------------------------------------

type SubformRuntime = { resolve: (field: AnyRecord, sd: AnyRecord, bringForward?: boolean) => unknown };

function loadSubform(): SubformRuntime {
  const Stub = () => null;
  const scope: AnyRecord = {
    React, produce,
    Fluent: { Stack: Stub, Label: Stub, Text: Stub, PrimaryButton: Stub, DefaultButton: Stub, Dialog: Stub, DialogType: {}, Toggle: Stub },
    useActiveData: () => [{}, () => undefined], useSourceData: () => ({}), useMutation: () => [async () => undefined],
    useTheme: () => ({}), getDateTimeString: () => "", ScoringModule: Stub,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compile(["ValueKit", "DefaultsKit", "SubformScoring"])};
return { resolve: _resolveFieldDefaultValue };`)(...Object.values(scope)) as SubformRuntime;
}

describe("SubformScoring entry defaults", () => {
  const subform = loadSubform();
  const sd = {
    patient: {
      observations: [
        { observationCode: "CRP", value: 12, collectedDateTime: "2026-09-20T08:00:00" },
        { observationCode: "CRP", value: 30, collectedDateTime: "2026-01-02T08:00:00" },
        { observationCode: "ESR", value: 40, collectedDateTime: "2025-01-02T08:00:00" },
      ],
    },
  };

  it("resolves the date tokens and a stored descriptor", () => {
    expect(subform.resolve({ id: "d", type: "date", defaultValue: "__today" }, {})).toBe("2026-09-27");
    expect(subform.resolve({ id: "d", type: "datetime", defaultValue: "__now" }, {})).toBe("2026-09-27T14:05");
    expect(subform.resolve({ id: "d", type: "date", defaultValue: "__today", defaultAnswer: { kind: "today" } }, {})).toBe("2026-09-27");
    expect(subform.resolve({ id: "t", type: "text", defaultValue: "x", defaultAnswer: { kind: "literal", value: "x" } }, {})).toBe("x");
  });

  it("fills from the latest observation, within the look-back", () => {
    expect(subform.resolve({ id: "crp", type: "number", defaultFromObservation: { observationCode: "CRP" } }, sd)).toBe(12);
    expect(subform.resolve({ id: "esr", type: "number", defaultFromObservation: { observationCode: "ESR", lookbackDays: 30 } }, sd)).toBeUndefined();
    expect(subform.resolve({
      id: "esr", type: "number", defaultAnswer: { kind: "lastObservation", code: "ESR", lookbackDays: 1000 },
      defaultFromObservation: { observationCode: "ESR", lookbackDays: 1000 },
    }, sd)).toBe(40);
  });

  it("falls back to the entry's other default, and honours bringForward off", () => {
    const field = { id: "esr", type: "number", defaultValue: 5, defaultFromObservation: { observationCode: "ESR", lookbackDays: 30 } };
    expect(subform.resolve(field, sd)).toBe(5);
    expect(subform.resolve({ id: "crp", type: "number", defaultValue: 5, defaultFromObservation: { observationCode: "CRP" } }, sd, false)).toBe(5);
    expect(subform.resolve({ id: "crp", type: "number", defaultFromObservation: { observationCode: "CRP" } }, sd, false)).toBeUndefined();
  });

  it("stores a yes/no default as the matching option", () => {
    const field = { id: "smoker", type: "booleanYesNo", options: [{ value: "Y", label: "Yes" }, { value: "N", label: "No" }], defaultValue: "N" };
    expect(subform.resolve(field, {})).toMatchObject({ selectedKey: "N" });
    expect(subform.resolve({ ...field, defaultValue: "N", defaultAnswer: { kind: "literal", value: false } }, {})).toMatchObject({ selectedKey: "N" });
  });
});

// ---------------------------------------------------------------------------
// LayoutTable
// ---------------------------------------------------------------------------

type ActiveTuple = [AnyRecord, (updater: unknown) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => undefined]);

function loadLayoutTable(): React.ComponentType<AnyRecord> {
  const Control = (props: { fieldId?: string }) => h("span", { "data-control": props.fieldId });
  const scope: AnyRecord = {
    React,
    Fluent: { Checkbox: Control },
    useSection: () => null,
    useActiveData: () => React.useContext(ActiveDataContext),
    useSourceData: () => ({}),
    Numeric: Control, DateSelect: Control, TimeSelect: Control, SimpleCodeSelect: Control,
    SimpleCodeChecklist: Control, TextArea: Control, FieldStampButton: Control,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compile(["ValueKit", "DefaultsKit", "LayoutTable"])};
return LayoutTable;`)(...Object.values(scope)) as React.ComponentType<AnyRecord>;
}

describe("LayoutTable cell defaults", () => {
  const LayoutTable = loadLayoutTable();
  let root: Root | null = null;
  let container: HTMLElement | null = null;
  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    container?.remove();
    root = null;
  });

  async function render(rows: AnyRecord[], saved: AnyRecord, props: AnyRecord = {}) {
    let state: AnyRecord = saved;
    const Harness = () => {
      const [current, set] = React.useState<AnyRecord>(saved);
      state = current;
      // Real MOIS useActiveData(selector) merges a partial object into the
      // section (SMOIS main.a75cc6b1.chunk.js, module 10); replacing it would
      // drop saved answers and re-seed them forever.
      const setState = (updater: unknown) =>
        set((previous) => (typeof updater === "function" ? produce(previous, updater as (draft: AnyRecord) => void) : { ...previous, ...(updater as AnyRecord) }));
      return h(ActiveDataContext.Provider, { value: [current, setState] }, h(LayoutTable, { id: "t", rows, ...props }));
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(h(Harness)));
    return () => state;
  }

  const rows = [{
    id: "r1",
    cells: [
      { id: "c1", kind: "field", fieldId: "site", inputType: "text", defaultValue: "Clinic" },
      { id: "c2", kind: "field", fieldId: "seen", inputType: "date", dateConfig: { prefillToday: true } },
      { id: "c3", kind: "field", fieldId: "consent", inputType: "choice", optionList: [{ code: "Y", display: "Yes" }, { code: "N", display: "No" }], prefill: "yes" },
      { id: "c4", kind: "field", fieldId: "chart", inputType: "booleanYesNo", defaultAnswer: { kind: "literal", value: true }, prefill: true },
      {
        id: "c5",
        kind: "fieldList",
        fields: [{ id: "n", fieldId: "count", inputType: "number", prefill: "3" }],
      },
      { id: "c6", kind: "text", text: "Static", defaultValue: "N/A" },
    ],
  }];

  it("seeds each unsaved answer cell in the shape its control saves", async () => {
    const data = await render(rows, {});
    expect(data()).toEqual({
      site: "Clinic",
      seen: "2026-09-27",
      consent: { code: "Y", display: "Yes" },
      chart: { code: "Y", display: "Yes", system: "MOIS-YESNO" },
      count: 3,
    });
  });

  it("never overwrites a saved answer, even a cleared one", async () => {
    const data = await render(rows, { site: "", seen: "2026-01-01" });
    expect(data()).toMatchObject({ site: "", seen: "2026-01-01", count: 3 });
  });

  it("leaves a read-only (locked) table as saved", async () => {
    const data = await render(rows, { site: "Home" }, { readOnly: true });
    expect(data()).toEqual({ site: "Home" });
  });
});
