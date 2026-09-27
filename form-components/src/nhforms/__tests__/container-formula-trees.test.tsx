// @vitest-environment happy-dom
/**
 * Nested-container formulas evaluated through FormulaKit's tree API
 * (neutral form model F1/F2): EditableTable and RepeatForEachTable formula
 * columns, LayoutTable computed cells, SubformScoring data-entry calculations
 * and scoring totals, and ScoringModule totals.
 *
 * Each container reads the exported `formulaTree` when present (it wins over
 * the text), else parses its text with FormulaKit.parse in its own dialect,
 * and keeps its legacy evaluator when the kit has no tree support.
 */
import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  containerFormulaTree,
  scoringTotalFormulaScope,
  subformCalculationFormulaScope,
  tableColumnFormulaScope,
} from "@/lib/container-formulas";
import { parseFormulaOrThrow, type StoredFormula } from "@/packages/form-model/src/formula";
import { readNhformsSource, recordingKit, withTreeSupport, withoutTreeSupport, type FormulaKitLike } from "./formula-kit-trees";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = Record<string, unknown>;
type Column = Record<string, unknown> & { id: string };
type AnyRecord = Record<string, unknown>;

const treeKit = withTreeSupport();
const legacyKit = withoutTreeSupport();

const compile = (names: string[]) =>
  Babel.transform(`var EditableTable;\n${names.map(readNhformsSource).join("\n")}`, { presets: ["react"], filename: "index.jsx" }).code ?? "";

// ---------------------------------------------------------------------------
// EditableTable and RepeatForEachTable formula columns
// ---------------------------------------------------------------------------

interface TableRuntime {
  compute(row: Row, column: Column, columns: Column[]): string;
  applyComputed(row: Row, columns: Column[]): Row;
  repeatApply(row: Row, columns: Column[]): Row;
}

function loadTables(kit: FormulaKitLike): TableRuntime {
  const compiled = compile(["ValueKit", "FormLogicKit", "EditableTable", "RepeatForEachTable"]);
  const scope: AnyRecord = {
    window: {},
    React,
    Fluent: {},
    produce,
    FormulaKit: kit,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const loaded = new Function(...Object.keys(scope), `${compiled};
return { compute: _computeFormulaCellValue, applyComputed: _applyComputedColumns, helpers: RepeatForEachTable.helpers };`)(
    ...Object.values(scope),
  ) as { compute: TableRuntime["compute"]; applyComputed: TableRuntime["applyComputed"]; helpers: { applyComputed(row: Row, columns: Column[]): Row } };
  return {
    compute: loaded.compute,
    applyComputed: loaded.applyComputed,
    repeatApply: (row, columns) => loaded.helpers.applyComputed(row, columns),
  };
}

const formulaColumn = (id: string, expression: string, extra: AnyRecord = {}): Column => ({
  id,
  type: "number",
  computedValue: { mode: "formula", expression, ...extra },
});

describe("EditableTable and RepeatForEachTable formula columns", () => {
  const columns: Column[] = [
    { id: "a", type: "number" },
    { id: "b", type: "number", dataPath: "bee" },
    {
      id: "level",
      type: "dropdown",
      options: [
        { label: "Mild", value: "mild", score: 1 },
        { label: "Severe", value: "severe", score: 3 },
      ],
    },
    { id: "done", type: "checkbox" },
    formulaColumn("total", "[a] + [bee]"),
  ];

  it("evaluates the text through the kit's tree API, by column id and by save key", () => {
    const kit = recordingKit(treeKit);
    const tables = loadTables(kit);
    const row = { a: "5", bee: "3" };
    expect(tables.compute(row, columns[4], columns)).toBe("8");
    // The reference semantics: numeric text adds (FormulaKit.evaluate joined "5" + "3").
    expect(kit.calls.parse.length).toBeGreaterThan(0);
    expect(kit.calls.evaluateTree.length).toBe(1);
    expect(tables.repeatApply({ ...row }, columns)).toMatchObject({ total: "8" });
  });

  it("uses the stored tree over the text", () => {
    const tree = containerFormulaTree("tableColumn", "[a] * 10", tableColumnFormulaScope(columns, "total"));
    const withTree = columns.map((column) =>
      column.id === "total" ? formulaColumn("total", "[a] + [bee]", { formulaTree: tree }) : column,
    );
    const kit = recordingKit(treeKit);
    const tables = loadTables(kit);
    expect(tables.compute({ a: 2, bee: 3 }, withTree[4], withTree)).toBe("20");
    expect(kit.calls.parse).toHaveLength(0);
    expect(tables.repeatApply({ a: 2, bee: 3 }, withTree)).toMatchObject({ total: "20" });
  });

  it("stays blank until every referenced cell is filled, unless compute-anyway", () => {
    const tables = loadTables(treeKit);
    expect(tables.compute({ a: 2 }, columns[4], columns)).toBe("");
    const anyway = formulaColumn("total", "coalesce([bee], 0) + [a]", { incompleteBehavior: "compute-anyway" });
    expect(tables.compute({ a: 2 }, anyway, [...columns.slice(0, 4), anyway])).toBe("2");
  });

  it("scores a choice column from its options and reads a tick box as yes/no", () => {
    const tables = loadTables(treeKit);
    const scored = formulaColumn("points", "score([level]) + iif([done], 10, 0)");
    const scoredColumns = [...columns.slice(0, 4), scored];
    expect(tables.compute({ level: "severe", done: true }, scored, scoredColumns)).toBe("13");
    expect(tables.compute({ level: { code: "mild", display: "Mild" }, done: "No" }, scored, scoredColumns)).toBe("1");
  });

  it("keeps the legacy text engine when the kit has no tree support", () => {
    const tables = loadTables(legacyKit);
    const days = formulaColumn("days", "weekdaysBetween([from], [to])");
    const dayColumns: Column[] = [{ id: "from", type: "date" }, { id: "to", type: "date" }, days];
    expect(tables.compute({ from: "2026-09-21", to: "2026-09-25" }, days, dayColumns)).toBe("5");
    expect(loadTables(treeKit).compute({ from: "2026-09-21", to: "2026-09-25" }, days, dayColumns)).toBe("5");
  });

  it("lets RepeatForEachTable's label column read its own save key", () => {
    const tables = loadTables(treeKit);
    const label: Column = {
      id: "__label",
      type: "text",
      dataPath: "_sourceLabel",
      computedValue: { mode: "formula", expression: "[_sourceLabel]", calculationPolicy: "always-calculated" },
    };
    expect(tables.repeatApply({ _sourceLabel: "Metformin" }, [label])).toMatchObject({ _sourceLabel: "Metformin" });
  });
});

// ---------------------------------------------------------------------------
// LayoutTable computed cells
// ---------------------------------------------------------------------------

function loadLayoutCells(kit: FormulaKitLike) {
  const compiled = Babel.transform(`${readNhformsSource("ValueKit")}\n${readNhformsSource("LayoutTable")}`, {
    presets: ["react"],
    filename: "index.jsx",
  }).code ?? "";
  const scope: AnyRecord = { React, Fluent: { Checkbox: () => null }, FormulaKit: kit };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compiled};
return { compute: computeLayoutTableCellValue, types: collectLayoutTableFormulaFieldTypes };`)(...Object.values(scope)) as {
    compute(cell: AnyRecord, data: AnyRecord, fieldTypes?: Record<string, string>): string;
    types(rows: AnyRecord[]): Record<string, string>;
  };
}

describe("LayoutTable computed cells", () => {
  it("parses the LayoutTable dialect: bare hyphenated ids, a missing answer counts as 0", () => {
    const kit = recordingKit(treeKit);
    const cells = loadLayoutCells(kit);
    const shorthand = { kind: "computed", fieldId: "total", formula: "sum(q-1, q-2, [q-3])" };
    expect(cells.compute(shorthand, { "q-1": 1, "q-2": "2", "q-3": 4 })).toBe("7");
    expect(cells.compute(shorthand, { "q-1": 1 })).toBe("1");
    expect(kit.calls.parse[0]?.[1]).toEqual({ dialect: "layoutTable" });
    const arithmetic = { kind: "computed", fieldId: "weighted", formula: "a + [b-1] * 2" };
    expect(cells.compute(arithmetic, { a: 1, "b-1": "3" })).toBe("7");
    expect(cells.compute(arithmetic, { a: 1 })).toBe("1");
  });

  it("uses the stored tree over the text and keeps precision and blankWhenEmpty", () => {
    const cells = loadLayoutCells(treeKit);
    const formulaTree = parseFormulaOrThrow("a / 3", { dialect: "layoutTable" });
    const cell = { kind: "computed", fieldId: "avg", formula: "a + b", formulaTree, precision: 2, blankWhenEmpty: true };
    expect(cells.compute(cell, { a: 10, b: 5 })).toBe("3.33");
    expect(cells.compute(cell, {})).toBe("");
  });

  it("reads the table's yes/no answers as yes/no", () => {
    const cells = loadLayoutCells(treeKit);
    const rows = [{ cells: [{ kind: "field", fieldId: "smoker", inputType: "booleanYesNo" }] }];
    const cell = { kind: "computed", fieldId: "points", formula: "smoker * 2" };
    expect(cells.compute(cell, { smoker: { code: "Y", display: "Yes" } }, cells.types(rows))).toBe("2");
  });

  it("keeps its own evaluator when the kit has no tree support", () => {
    const cells = loadLayoutCells(legacyKit);
    expect(cells.compute({ kind: "computed", fieldId: "t", formula: "sum(a, b)" }, { a: 1, b: "2" })).toBe("3");
  });
});

// ---------------------------------------------------------------------------
// SubformScoring: data-entry calculations and scoring totals
// ---------------------------------------------------------------------------

type Session = { field: { data: AnyRecord; status: AnyRecord; history: unknown[] }; setFormData?: (updater: unknown) => void };
type Completion = {
  calculatedExpressions: Record<string, unknown>;
  calculatedTotals: Record<string, { score: number | null; isComplete: boolean }>;
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

function loadSubform(kit: FormulaKitLike) {
  const compiled = Babel.transform(["ValueKit", "FieldKit", "DialogKit", "SubformScoring"].map(readNhformsSource).join("\n"), {
    presets: ["react"],
    filename: "SubformScoring/index.jsx",
  }).code ?? "";
  const Box = ({ children }: React.PropsWithChildren) => React.createElement("div", null, children);
  const Button = ({ text, onClick }: { text?: string; onClick?: () => void }) =>
    React.createElement("button", { type: "button", onClick }, text);
  const Dialog = ({ hidden, children }: React.PropsWithChildren<{ hidden?: boolean }>) =>
    hidden ? null : React.createElement("div", null, children);
  const state: { session: Session; source: AnyRecord } = {
    session: { field: { data: {}, status: {}, history: [] } },
    source: {},
  };
  const update = (updater: unknown) => {
    if (typeof updater === "function") {
      const result = (updater as (current: Session) => Session | void)(state.session);
      if (result) state.session = result;
    }
  };
  const scope: AnyRecord = {
    React,
    Fluent: { Stack: Box, Label: Box, Text: Box, PrimaryButton: Button, DefaultButton: Button, Dialog, DialogType: {}, Toggle: () => null },
    useActiveData: () => [state.session, update],
    useSourceData: () => state.source,
    useMutation: () => [async () => undefined],
    useTheme: () => ({ isInverted: false }),
    produce,
    getDateTimeString: () => "2026-09-26 10:00:00",
    ScoringModule: () => null,
    // Field controls (FieldKit's included): not under test, drawn as nothing.
    ...Object.fromEntries(
      [
        "ComputedField", "DateSelect", "TimeSelect", "ScaleField", "HotspotMapField", "FindCodeSelect", "ConversionField",
        "TextArea", "Numeric", "DateTimeSelect", "SimpleCodeSelect", "SimpleCodeChecklist", "CompactBooleanField", "YesNoButtons",
      ].map((name) => [
        name,
        () => null,
      ]),
    ),
    // The MOIS SubForm DialogKit draws on, and its button bar.
    SubForm: ({ hidden, children }: React.PropsWithChildren<{ hidden?: boolean }>) =>
      hidden ? null : React.createElement("div", null, children),
    ButtonBar: Box,
    FormulaKit: kit,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const Inner = new Function(...Object.keys(scope), `${compiled}; return SubformScoringInner;`)(...Object.values(scope)) as React.ComponentType<AnyRecord>;

  return (props: AnyRecord, data: AnyRecord = {}, source: AnyRecord = {}): Completion => {
    state.session = { field: { data: JSON.parse(JSON.stringify(data)), status: {}, history: [] } };
    state.source = source;
    const captured: { completion?: Completion } = {};
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(React.createElement(Inner, {
        id: "subform",
        isOpen: true,
        hideTriggerButton: true,
        showSummary: false,
        observationOutputs: [],
        formDataOutputs: [],
        onComplete: (payload: Completion) => {
          captured.completion = payload;
          return false;
        },
        ...props,
      }));
    });
    const done = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Done");
    act(() => done?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => root!.unmount());
    root = null;
    container.remove();
    container = null;
    if (!captured.completion) throw new Error("SubformScoring did not complete");
    return captured.completion;
  };
}

describe("SubformScoring data-entry calculations", () => {
  const fields = [
    { id: "swollen", label: "Swollen", type: "hotspotMap" },
    { id: "tender", label: "Tender", type: "number" },
    { id: "pain", label: "Pain", type: "choice", options: [{ label: "None", value: "none", score: 0 }, { label: "Bad", value: "bad", score: 4 }] },
    { id: "extra", label: "Extra", type: "number", emptyValue: 0 },
  ];

  it("evaluates the exported tree and keeps hotspot counts and emptyValue", () => {
    const calculations = [
      { id: "cdai", label: "CDAI", expression: "swollen + tender + extra", incompleteBehavior: "compute-anyway" },
      { id: "withPain", label: "With pain", expression: "[cdai] + score([pain])", incompleteBehavior: "compute-anyway" },
    ].map((calculation, index, all) => ({
      ...calculation,
      formulaTree: containerFormulaTree(
        "subformCalculation",
        calculation.expression,
        subformCalculationFormulaScope(fields, all.slice(0, index), calculation.id),
      ),
    }));
    expect(calculations.every((calculation) => calculation.formulaTree)).toBe(true);
    const run = loadSubform(treeKit);
    const result = run(
      { mode: "data-entry", dataEntryConfig: { fields, calculations } },
      { swollen: { selectedIds: ["a", "b", "c"], selectedCount: 3 }, tender: "4", pain: { selectedKey: "bad", value: "bad", response: "Bad" } },
    );
    // 3 + 4 + 0, then an earlier calculation plus the choice's score.
    expect(result.calculatedExpressions).toMatchObject({ cdai: 7, withPain: 11 });
  });

  it("parses the text when there is no tree, and the tree wins over the text", () => {
    const kit = recordingKit(treeKit);
    const run = loadSubform(kit);
    const formulaTree = parseFormulaOrThrow("[tender] * 100");
    const result = run(
      {
        mode: "data-entry",
        dataEntryConfig: {
          fields,
          calculations: [
            { id: "fromText", expression: "max(tender, extra)", incompleteBehavior: "compute-anyway", precision: 1 },
            { id: "fromTree", expression: "tender", formulaTree },
          ],
        },
      },
      { tender: "2.25" },
    );
    expect(result.calculatedExpressions).toMatchObject({ fromText: 2.3, fromTree: 225 });
    expect(kit.calls.parse.map((call) => call[0])).toEqual(["max(tender, extra)"]);
  });

  it("leaves a calculation blank until its inputs are answered unless compute-anyway", () => {
    const run = loadSubform(treeKit);
    const result = run(
      {
        mode: "data-entry",
        dataEntryConfig: {
          fields,
          calculations: [
            { id: "strict", expression: "max(tender, swollen)", incompleteBehavior: "show-text" },
            { id: "anyway", expression: "max(tender, swollen)", incompleteBehavior: "compute-anyway" },
          ],
        },
      },
      { tender: 5 },
    );
    expect(result.calculatedExpressions).toMatchObject({ strict: null, anyway: 5 });
  });

  it("keeps _evaluateExpression when the kit has no tree support", () => {
    const run = loadSubform(legacyKit);
    const result = run(
      { mode: "data-entry", dataEntryConfig: { fields, calculations: [{ id: "c", expression: "swollen + tender" }] } },
      { swollen: { selectedIds: ["a"], selectedCount: 1 }, tender: "5 kg" },
    );
    // The legacy engine extracted the number from "5 kg".
    expect(result.calculatedExpressions).toMatchObject({ c: 6 });
  });
});

describe("SubformScoring scoring totals", () => {
  const questions = [
    { id: "q1", fieldId: "q1", childFieldIds: ["q1"], options: [{ key: "0", score: 0, text: "No" }, { key: "1", score: 2, text: "Yes" }] },
    { id: "q2", fieldId: "q2", childFieldIds: ["q2"], emptyScore: 1, options: [{ key: "0", score: 0, text: "No" }, { key: "1", score: 5, text: "Yes" }] },
  ];

  it("reads each question's score (emptyScore when unanswered) through score([question])", () => {
    const total = { id: "t", label: "T", expression: "(q1 + q2) * 10 + male", precision: 0, terms: [], contextVariables: [{ id: "male", sourcePath: "patient.gender", equals: ["M"], trueValue: 1, falseValue: 0 }] };
    const formulaTree = containerFormulaTree("scoringTotal", total.expression, scoringTotalFormulaScope(questions, total.contextVariables));
    expect(JSON.stringify(formulaTree)).toContain('"fn":"score"');
    const run = loadSubform(treeKit);
    const result = run(
      { config: { questions, totals: [{ ...total, formulaTree }] } },
      { q1: { selectedKey: "1", value: "1", response: "Yes" } },
      { patient: { gender: { code: "M", display: "Male" } } },
    );
    expect(result.calculatedTotals.t).toEqual({ score: 31, isComplete: true });
  });

  it("parses the text in the runtime and stays incomplete while a question has no score", () => {
    const run = loadSubform(treeKit);
    const totals = [{ id: "t", label: "T", expression: "q1 + q2", terms: [{ questionId: "q1", weight: 1 }] }];
    expect(run({ config: { questions, totals } }, {}).calculatedTotals.t).toEqual({ score: null, isComplete: false });
    expect(run({ config: { questions, totals } }, { q1: "1" }).calculatedTotals.t).toEqual({ score: 3, isComplete: true });
  });

  it("keeps the legacy evaluator when the kit has no tree support", () => {
    const run = loadSubform(legacyKit);
    const totals = [{ id: "t", label: "T", expression: "q1 * 3 + q2", terms: [] }];
    expect(run({ config: { questions, totals } }, { q1: "1", q2: "0" }).calculatedTotals.t).toEqual({ score: 6, isComplete: true });
  });
});

// ---------------------------------------------------------------------------
// ScoringModule totals
// ---------------------------------------------------------------------------

function renderScoringModule(kit: FormulaKitLike | undefined, config: AnyRecord, data: AnyRecord): AnyRecord {
  const compiled = Babel.transform(`${readNhformsSource("ValueKit")}\n${readNhformsSource("ScoringModule")}`, {
    presets: ["react"],
    filename: "ScoringModule/index.jsx",
  }).code ?? "";
  const Box = ({ children }: React.PropsWithChildren) => React.createElement("div", null, children);
  const state = { fd: { field: { data: { ...data }, status: {}, history: [] } } as { field: { data: AnyRecord } } };
  const useFormSessionData = (selector?: (fd: AnyRecord) => unknown) => {
    const [, force] = React.useState(0);
    const setFd = (updater: unknown) => {
      state.fd = typeof updater === "function" ? produce(state.fd, updater as (draft: AnyRecord) => void) : (updater as typeof state.fd);
      force((value) => value + 1);
    };
    return [selector ? selector(state.fd) : state.fd, setFd];
  };
  const scope: AnyRecord = {
    React,
    Fluent: new Proxy({}, { get: () => Box }),
    useFormSessionData,
    useTheme: () => ({}),
    useSourceData: () => ({}),
    FormulaKit: kit,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const ScoringModule = new Function(...Object.keys(scope), `${compiled}; return ScoringModule;`)(...Object.values(scope)) as React.ComponentType<AnyRecord>;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(React.createElement(ScoringModule, { config, showProgress: false })));
  return state.fd.field.data;
}

describe("ScoringModule totals", () => {
  const questions = [
    { id: "a", fieldId: "a", childFieldIds: ["a"], options: [{ key: "0", score: 0, text: "Never" }, { key: "1", score: 3, text: "Often" }] },
    { id: "b", fieldId: "b", childFieldIds: ["b"], options: [{ key: "0", score: 0, text: "Never" }, { key: "1", score: 3, text: "Often" }] },
  ];
  const answers = {
    a: { selectedKey: "1", value: "1", response: "Often" },
    b: { selectedKey: "0", value: "0", response: "Never" },
  };

  it("honours an authored expression instead of the weighted sum", () => {
    const totals = [
      { id: "mean", label: "Mean", expression: "(a + b) / 2", precision: 1, terms: [{ questionId: "a", weight: 1 }, { questionId: "b", weight: 1 }], targetFieldId: "mean_out", ranges: [] },
      { id: "sum", label: "Sum", terms: [{ questionId: "a", weight: 2 }, { questionId: "b", weight: 1 }], targetFieldId: "sum_out", ranges: [] },
    ];
    const data = renderScoringModule(treeKit, { questions, totals }, answers);
    expect(data).toMatchObject({ mean_out: 1.5, sum_out: 6 });
  });

  it("uses the exported tree over the text", () => {
    const formulaTree = containerFormulaTree("scoringTotal", "a * 10", scoringTotalFormulaScope(questions)) as StoredFormula;
    const totals = [{ id: "t", label: "T", expression: "a + b", formulaTree, terms: [], targetFieldId: "out", ranges: [] }];
    expect(renderScoringModule(treeKit, { questions, totals }, answers)).toMatchObject({ out: 30 });
  });

  it("falls back to the weighted terms without a tree-capable kit", () => {
    const totals = [{ id: "t", label: "T", expression: "a * 100", terms: [{ questionId: "a", weight: 1 }], targetFieldId: "out", ranges: [] }];
    expect(renderScoringModule(legacyKit, { questions, totals }, answers)).toMatchObject({ out: 3 });
  });
});
