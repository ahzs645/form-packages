// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "FindCodeSelect", "index.jsx"), "utf8");

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => {}]);

let comboBoxProps: Record<string, any> | null = null;

const FluentStub = {
  ComboBox: (props: Record<string, any>) => {
    comboBoxProps = props;
    return React.createElement("div", { "data-testid": "combo-box" });
  },
};

function loadFindCodeSelect(codeList: unknown[] = []): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React", "Fluent", "useActiveData", "useSourceData", "useCodeList", "produce", "LayoutItem",
    `${compiled};\nreturn { FindCodeSelect };`
  );
  const useActiveData = () => React.useContext(ActiveDataContext);
  const LayoutItem = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return factory(React, FluentStub, useActiveData, () => ({}), () => codeList, produce, LayoutItem).FindCodeSelect;
}

// The four LOINC LL520-8 answers, shaped as field-renderer emits them for a
// panel choice field: an inline optionList and no codeSystem.
const SENSORY_OPTIONS = [
  { code: "1", display: "Completely limited" },
  { code: "2", display: "Very limited" },
  { code: "3", display: "Slightly limited" },
  { code: "4", display: "No impairment" },
];

function renderHarness(props: Record<string, unknown>, data: Record<string, unknown> = {}, codeList: unknown[] = []) {
  comboBoxProps = null;
  let currentState: any = null;
  const FindCodeSelect = loadFindCodeSelect(codeList);

  const Harness: React.FC = () => {
    const [state, setState] = React.useState({
      field: { data: { unrelated: "keep me", ...data }, status: {}, history: [] },
    });
    currentState = state;
    const setter = (updater: any) =>
      setState((previous) => (typeof updater === "function" ? updater(previous) : previous));
    return React.createElement(
      ActiveDataContext.Provider,
      { value: [state, setter] },
      React.createElement(FindCodeSelect, props)
    );
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  return { root, getData: () => currentState.field.data };
}

describe("FindCodeSelect field binding", () => {
  it("persists an inline-option selection to form data", () => {
    const harness = renderHarness({
      fieldId: "loinc-38222-6",
      label: "Sensory perception Braden Scale",
      optionList: SENSORY_OPTIONS,
      openOnFocus: true,
    });

    act(() => {
      comboBoxProps?.onChange?.(null, { data: { item: SENSORY_OPTIONS[2] } });
    });

    // A computed `score([id])` reads the display; the MOIS payload reads the
    // code. Both must survive, so the saved answer is the full coding.
    expect(harness.getData()).toMatchObject({
      "loinc-38222-6": { code: "3", display: "Slightly limited", system: "" },
      unrelated: "keep me",
    });
    act(() => harness.root.unmount());
  });

  it("clears the stored answer when the selection is emptied", () => {
    const harness = renderHarness(
      { fieldId: "loinc-38222-6", optionList: SENSORY_OPTIONS },
      { "loinc-38222-6": { code: "3", display: "Slightly limited", system: "" } }
    );

    act(() => {
      comboBoxProps?.onChange?.(null, null, null, "");
    });

    expect(harness.getData()).toMatchObject({ "loinc-38222-6": "", unrelated: "keep me" });
    act(() => harness.root.unmount());
  });

  it("selects a stored answer saved as a plain code or display string", () => {
    renderHarness(
      { fieldId: "loinc-38222-6", optionList: SENSORY_OPTIONS },
      { "loinc-38222-6": "Slightly limited" }
    );
    expect(comboBoxProps?.selectedKey).toBe("3");
  });

  it("persists multi-select answers as an array", () => {
    const harness = renderHarness({
      fieldId: "multi",
      optionList: SENSORY_OPTIONS,
      selectionType: "multiple",
    });

    act(() => {
      comboBoxProps?.onChange?.(null, { data: { item: SENSORY_OPTIONS[0] }, selected: true });
    });
    act(() => {
      comboBoxProps?.onChange?.(null, { data: { item: SENSORY_OPTIONS[3] }, selected: true });
    });

    expect(harness.getData().multi).toMatchObject([
      { code: "1", display: "Completely limited" },
      { code: "4", display: "No impairment" },
    ]);
    act(() => harness.root.unmount());
  });

  it("persists code-list-backed selections too", () => {
    const harness = renderHarness(
      { fieldId: "coded", codeSystem: "MOIS-EXAMPLE" },
      {},
      [{ code: "A", display: "Alpha" }]
    );

    act(() => {
      comboBoxProps?.onChange?.(null, { data: { item: { code: "A", display: "Alpha" } } });
    });

    expect(harness.getData().coded).toMatchObject({ code: "A", display: "Alpha", system: "MOIS-EXAMPLE" });
    act(() => harness.root.unmount());
  });
});
