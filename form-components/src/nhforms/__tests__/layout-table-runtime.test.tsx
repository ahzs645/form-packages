// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Pin a zone west of UTC so the local-vs-UTC date bugs are observable on any
// machine (forks pool: the assignment applies to this file's process).
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Vancouver";
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

type Data = Record<string, unknown>;
type Cell = Record<string, unknown>;
type Helpers = {
  evaluateLayoutTableFormula: (expression: string, data: Data, currentFieldId?: string) => number | null;
  extractLayoutTableFormulaRefs: (expression: string) => string[];
  computeLayoutTableCellValue: (cell: Cell, data: Data) => string;
  formatLayoutTableFieldDisplayValue: (cell: Cell, data: Data) => string;
  resolveLayoutTableSourceValue: (cell: Cell, data: Data, sourceData: Data) => unknown;
  isCheckedValue: (value: unknown) => boolean;
  LayoutTable: React.ComponentType<Record<string, unknown>>;
};

// ---------------------------------------------------------------------------
// Minimal engine scope: MOIS controls as plain DOM elements.
// ---------------------------------------------------------------------------
const h = React.createElement;
const Control = (props: { fieldId?: string; label?: string }) =>
  h("span", { "data-control": props.fieldId }, props.label ?? props.fieldId);
const Checkbox = (props: { checked?: boolean; ariaLabel?: string }) =>
  h("input", { type: "checkbox", readOnly: true, checked: Boolean(props.checked), "aria-label": props.ariaLabel });

type ActiveTuple = [Data, (updater: unknown) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => undefined]);

const NO_KIT = Symbol("no-kit");
function loadLayoutTable(kit: "real" | typeof NO_KIT | Record<string, unknown>): Helpers {
  const sources = kit === "real" ? [read("FormLogicKit"), read("LayoutTable")] : [read("LayoutTable")];
  const compiled = Babel.transform(sources.join("\n"), { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const scope: Record<string, unknown> = {
    React,
    Fluent: { Checkbox },
    useSection: () => null,
    useActiveData: () => React.useContext(ActiveDataContext),
    useSourceData: () => ({}),
    Numeric: Control,
    DateSelect: Control,
    TimeSelect: Control,
    SimpleCodeSelect: Control,
    SimpleCodeChecklist: Control,
    TextArea: Control,
    FieldStampButton: Control,
  };
  // A stub (or an explicitly absent kit) is injected as a scope binding; the
  // real kit is concatenated ahead of the component like the export bundle.
  if (kit !== "real") scope.FormLogicKit = kit === NO_KIT ? undefined : kit;
  const names = [
    "evaluateLayoutTableFormula",
    "extractLayoutTableFormulaRefs",
    "computeLayoutTableCellValue",
    "formatLayoutTableFieldDisplayValue",
    "resolveLayoutTableSourceValue",
    "isCheckedValue",
    "LayoutTable",
  ];
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compiled};\nreturn { ${names.join(", ")} };`)(
    ...Object.values(scope),
  ) as Helpers;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

function renderTable(runtime: Helpers, props: Record<string, unknown>, initialData: Data) {
  let setOuter: (data: Data) => void = () => undefined;
  const Host = () => {
    const [data, setData] = React.useState<Data>(initialData);
    setOuter = setData;
    const update = (updater: unknown) =>
      setData((current) => (typeof updater === "function" ? produce(current, updater as (draft: Data) => void) : (updater as Data)));
    return h(ActiveDataContext.Provider, { value: [data, update] }, h(runtime.LayoutTable, props));
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(h(Host)));
  return {
    container,
    setData: (data: Data) => act(() => setOuter(data)),
  };
}

const runtime = loadLayoutTable(NO_KIT);

describe("LayoutTable formulas", () => {
  const data = { a: 2, b: "3", "field-1": 1 };

  it("evaluates bracketed and bare identifier-safe ids (single-pass rewrite)", () => {
    expect(runtime.evaluateLayoutTableFormula("[a] + [b]", data)).toBe(5);
    expect(runtime.evaluateLayoutTableFormula("[a]*2", data)).toBe(4);
    expect(runtime.evaluateLayoutTableFormula("a + b", data)).toBe(5);
    expect(runtime.evaluateLayoutTableFormula("a * 2 + [field-1]", data)).toBe(5);
    expect(runtime.evaluateLayoutTableFormula("([a] + b) / 5", data)).toBe(1);
  });

  it("treats missing answers as 0 and rejects self references and unsafe input", () => {
    expect(runtime.evaluateLayoutTableFormula("[a] + [missing]", data)).toBe(2);
    expect(runtime.evaluateLayoutTableFormula("a + b", data, "a")).toBeNull();
    expect(runtime.evaluateLayoutTableFormula("a; globalThis", data)).toBeNull();
  });

  it("defines min, max and sum() inside expressions", () => {
    expect(runtime.evaluateLayoutTableFormula("min(a, b)", data)).toBe(2);
    expect(runtime.evaluateLayoutTableFormula("max([a], b, [field-1])", data)).toBe(3);
    expect(runtime.evaluateLayoutTableFormula("sum(a, b) * 2", data)).toBe(10);
    expect(runtime.evaluateLayoutTableFormula("Math.round(a / 3)", data)).toBe(1);
  });

  it("keeps the sum(...) id-list shorthand, now accepting bracketed ids", () => {
    expect(runtime.evaluateLayoutTableFormula("sum(a, b, field-1)", data)).toBe(6);
    expect(runtime.evaluateLayoutTableFormula("sum([a], [field-1])", data)).toBe(3);
  });

  it("reads refs without mistaking builtins or Math properties for fields", () => {
    expect(runtime.extractLayoutTableFormulaRefs("[a] + b + Math.round(c) + min(d, 1)")).toEqual(["a", "b", "c", "d"]);
    expect(runtime.extractLayoutTableFormulaRefs("sum(field-1, [field-2])")).toEqual(["field-1", "field-2"]);
  });

  it("blankWhenEmpty sees hyphenated sum ids, then computes once one is answered", () => {
    const cell = { kind: "computed", fieldId: "total", formula: "sum(field-1, field-2)", blankWhenEmpty: true };
    expect(runtime.computeLayoutTableCellValue(cell, {})).toBe("");
    expect(runtime.computeLayoutTableCellValue(cell, { "field-2": "4" })).toBe("4");
  });
});

describe("LayoutTable system.currentDate", () => {
  it("uses the local calendar date, not the UTC one, late in the day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 22, 30)); // 22:30 Pacific = 05:30Z on the 26th
    expect(new Date().getTimezoneOffset()).toBeGreaterThan(0); // west of UTC
    const cell = { kind: "field", fieldId: "dateCreated", sourcePaths: ["system.currentDate"] };
    expect(runtime.resolveLayoutTableSourceValue({ ...cell, sourceFormat: "text" }, {}, {})).toBe("2026-09-25");
    expect(runtime.resolveLayoutTableSourceValue({ ...cell, sourceFormat: "date" }, {}, {})).toBe("2026.09.25");
  });
});

describe("LayoutTable read-only yes/no display", () => {
  const yesNo = { kind: "field", fieldId: "consent", inputType: "booleanYesNo" };
  const single = { kind: "field", fieldId: "consent", inputType: "booleanSingle" };

  it("unwraps a stored Coding", () => {
    expect(runtime.formatLayoutTableFieldDisplayValue(yesNo, { consent: { code: "Y", display: "Yes", system: "MOIS-YESNO" } })).toBe("Yes");
    expect(runtime.formatLayoutTableFieldDisplayValue(yesNo, { consent: { code: "N", display: "No" } })).toBe("No");
    expect(runtime.formatLayoutTableFieldDisplayValue(single, { consent: { code: "Y", display: "Yes" } })).toBe("Yes");
    expect(runtime.isCheckedValue({ code: "Y" })).toBe(true);
  });

  it("handles scalars, empty codings and other codes", () => {
    expect(runtime.formatLayoutTableFieldDisplayValue(single, { consent: true })).toBe("Yes");
    expect(runtime.formatLayoutTableFieldDisplayValue(single, { consent: false })).toBe("No");
    expect(runtime.formatLayoutTableFieldDisplayValue(yesNo, { consent: "Y" })).toBe("Yes");
    expect(runtime.formatLayoutTableFieldDisplayValue(yesNo, { consent: { code: null, display: null } })).toBe("");
    expect(runtime.formatLayoutTableFieldDisplayValue(yesNo, { consent: { code: "U", display: "Unknown" } })).toBe("Unknown");
  });

  it("renders Yes for a stored Coding in a read-only table", () => {
    const view = renderTable(
      runtime,
      { rows: [{ id: "r1", cells: [{ id: "c1", ...yesNo, labelPosition: "none" }] }], readOnly: true },
      { consent: { code: "Y", display: "Yes" } },
    );
    expect(view.container.querySelector('[data-field-id="consent"]')?.textContent).toBe("Yes");
  });
});

describe("LayoutTable cell visibility", () => {
  const rows = [
    {
      id: "r1",
      cells: [
        { id: "ctrl-cell", kind: "field", fieldId: "ctrl", inputType: "booleanYesNo", label: "Controller" },
        { id: "gated", kind: "text", text: "Shown when yes", visibility: { type: "equals", controllerId: "ctrl", value: "Y" } },
        {
          id: "list",
          kind: "fieldList",
          fields: [
            { fieldId: "always", label: "Always" },
            { fieldId: "gatedField", label: "Gated field", visibility: { type: "filled", controllerId: "ctrl" } },
          ],
        },
      ],
    },
  ];

  it("evaluates cell and fieldList-field rules through FormLogicKit.evaluateVisibilityRule", () => {
    const calls: Array<{ rule: Record<string, unknown>; kind: unknown }> = [];
    const kit = {
      evaluateVisibilityRule: (
        rule: { type: string; controllerId: string; value?: string },
        getValue: (id: string) => unknown,
        options?: { controllerKind?: (id: string) => unknown },
      ) => {
        calls.push({ rule, kind: options?.controllerKind?.(rule.controllerId) });
        const value = getValue(rule.controllerId) as { code?: string } | undefined;
        if (rule.type === "filled") return value != null;
        return value?.code === rule.value;
      },
    };
    const stubbed = loadLayoutTable(kit);
    const view = renderTable(stubbed, { rows }, { ctrl: { code: "Y", display: "Yes" } });
    const cells = () => Array.from(view.container.querySelectorAll("td"));

    expect(cells()).toHaveLength(3);
    expect(cells()[1].textContent).toBe("Shown when yes");
    expect(view.container.querySelector('[data-control="gatedField"]')).not.toBeNull();
    expect(calls.map((call) => call.kind)).toContain("boolean");

    view.setData({});
    // The hidden cell keeps its <td> for the grid geometry but renders nothing.
    expect(cells()).toHaveLength(3);
    expect(cells()[1].textContent).toBe("");
    expect(view.container.querySelector('[data-control="gatedField"]')).toBeNull();
    expect(view.container.querySelector('[data-control="always"]')).not.toBeNull();
  });

  it("keeps every cell visible when the kit is absent", () => {
    const view = renderTable(runtime, { rows }, {});
    expect(Array.from(view.container.querySelectorAll("td"))[1].textContent).toBe("Shown when yes");
    expect(view.container.querySelector('[data-control="gatedField"]')).not.toBeNull();
  });

  it("keeps every cell visible with a kit that predates evaluateVisibilityRule", () => {
    const view = renderTable(loadLayoutTable({ evaluateGroup: () => false }), { rows }, {});
    expect(Array.from(view.container.querySelectorAll("td"))[1].textContent).toBe("Shown when yes");
  });

  const realKit = loadLayoutTable("real");
  const realKitHasRule = (() => {
    const compiled = Babel.transform(read("FormLogicKit"), { presets: ["react"], filename: "index.jsx" }).code ?? "";
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const kit = new Function("React", `${compiled};\nreturn FormLogicKit;`)(React) as Record<string, unknown>;
    return typeof kit.evaluateVisibilityRule === "function";
  })();

  it.skipIf(!realKitHasRule)("hides a cell with the real FormLogicKit", () => {
    const view = renderTable(realKit, { rows }, { ctrl: { code: "Y", display: "Yes" } });
    expect(Array.from(view.container.querySelectorAll("td"))[1].textContent).toBe("Shown when yes");
    view.setData({ ctrl: { code: "N", display: "No" } });
    expect(Array.from(view.container.querySelectorAll("td"))[1].textContent).toBe("");
  });
});
