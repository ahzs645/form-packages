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
const source = fs.readFileSync(path.join(NH, "ObservationEntryGrid", "index.jsx"), "utf8");

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{ field: { data: {}, status: {}, history: [] } }, () => {}]);

let dropdownProps: Record<string, any> | null = null;
let textFieldProps: Record<string, any> | null = null;

const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
const buttonStub = (props: Record<string, any>) =>
  React.createElement("button", { type: "button", onClick: props.onClick, disabled: props.disabled }, props.text);
const stackStub: any = passthrough;
stackStub.Item = passthrough;
const FluentStub = {
  Stack: stackStub,
  Label: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
  TextField: (props: Record<string, any>) => {
    textFieldProps = props;
    return React.createElement("input", { value: props.value ?? "", readOnly: true });
  },
  Dropdown: (props: Record<string, any>) => {
    dropdownProps = props;
    return React.createElement("div", { "data-dropdown": "true" }, String(props.selectedKey ?? ""));
  },
  DefaultButton: buttonStub,
  PrimaryButton: buttonStub,
};

function loadGrid(sourceData: Record<string, unknown>): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // Same bare-global contract used by the injected NHForms runtime.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useSourceData",
    "useActiveData",
    "produce",
    "getDateTimeString",
    `${compiled};\nreturn { ObservationEntryGrid };`
  );
  const useActiveData = () => React.useContext(ActiveDataContext);
  return factory(
    React,
    FluentStub,
    () => sourceData,
    useActiveData,
    produce,
    (date: Date) => date.toISOString()
  ).ObservationEntryGrid;
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const OBSERVATIONS = [
  {
    observationId: 5001,
    observationCode: "22732",
    description: "WEIGHT",
    value: "180",
    units: "kg",
    collectedDateTime: daysAgo(10),
    abnormalFlag: { code: "H", display: "High", system: "MOIS-ABNORMALFLAG" },
  },
  {
    observationId: 5002,
    observationCode: "951",
    description: "BODY MASS INDEX",
    value: "18.3",
    collectedDateTime: daysAgo(5),
    rangeNormalLow: "18.5",
    rangeNormalHigh: "24.9",
    rangeVeryLow: "14",
  },
  { observationId: 5003, observationCode: "2010", description: "TEMPERATURE", value: "37.5", collectedDateTime: daysAgo(400) },
];

function renderGrid(props: Record<string, unknown>, options?: { observations?: unknown[] }) {
  dropdownProps = null;
  textFieldProps = null;
  const ObservationEntryGrid = loadGrid({
    patient: { observations: options?.observations ?? OBSERVATIONS },
    userProfile: { identity: { fullName: "WARKENTIN, LISA" } },
  });

  let latestState: any = null;
  const Harness: React.FC = () => {
    const [state, setState] = React.useState<any>({ field: { data: {}, status: {}, history: [] } });
    latestState = state;
    const setter = (updater: any) =>
      setState((previous: any) => (typeof updater === "function" ? updater(previous) : updater));
    return React.createElement(
      ActiveDataContext.Provider,
      { value: [state, setter] },
      React.createElement(ObservationEntryGrid, { fieldId: "measurements", ...props })
    );
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  return { container, root, getState: () => latestState };
}

const clickButton = (container: HTMLElement, text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find((entry) => entry.textContent === text);
  expect(button, `button "${text}"`).toBeTruthy();
  act(() => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const CODES = [
  { code: "22732", label: "Weight", units: "kg" },
  { code: "951", label: "BMI" },
];

describe("ObservationEntryGrid", () => {
  it("lists chart observations for the configured codes with explicit and range-derived flags", () => {
    const harness = renderGrid({ codes: CODES });

    expect(harness.container.textContent).toContain("WEIGHT");
    expect(harness.container.textContent).toContain("180 kg");
    expect(harness.container.textContent).toContain("H");
    // 18.3 is below rangeNormalLow 18.5 but above rangeVeryLow 14 -> L.
    expect(harness.container.textContent).toContain("18.3");
    expect(harness.container.textContent).toContain("L");
    // 2010 TEMPERATURE is not a configured code.
    expect(harness.container.textContent).not.toContain("TEMPERATURE");
    act(() => harness.root.unmount());
  });

  it("applies the lookback window to browsed rows", () => {
    const harness = renderGrid({ codes: [{ code: "2010", label: "Temperature" }], lookback: { amount: 6, unit: "months" } });
    expect(harness.container.textContent).toContain("No measurements found.");

    const openHarness = renderGrid({ codes: [{ code: "2010", label: "Temperature" }] });
    expect(openHarness.container.textContent).toContain("37.5");
    act(() => harness.root.unmount());
    act(() => openHarness.root.unmount());
  });

  it("stages new entries as DCO observation updates with computed abnormal flags", () => {
    const harness = renderGrid({ codes: CODES });

    clickButton(harness.container, "New");
    act(() => {
      dropdownProps?.onChange?.(null, { key: "951" });
    });
    act(() => {
      textFieldProps?.onChange?.(null, "12");
    });
    clickButton(harness.container, "Add");

    const data = harness.getState()?.field?.data ?? {};
    const entries = data.measurements_entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ code: "951", value: "12", description: "BMI" });

    const payload = data.__componentPayloads?.dcoUpdatesByComponent?.measurements;
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      observationId: 0,
      observationCode: "951",
      observationClass: "DCOBS",
      value: "12",
      valueType: "NUMERIC",
      status: "F",
      orderedBy: "WARKENTIN, LISA",
      // 12 < rangeVeryLow 14 from the chart's most recent ranged BMI row -> LL.
      abnormalFlag: { code: "LL", display: "Critical low", system: "MOIS-ABNORMALFLAG" },
    });
    // The staged row also renders in the grid.
    expect(harness.container.textContent).toContain("12");
    act(() => harness.root.unmount());
  });

  it("deletes in-form rows and clears their staged payload", () => {
    const harness = renderGrid({ codes: CODES });

    clickButton(harness.container, "New");
    act(() => {
      dropdownProps?.onChange?.(null, { key: "22732" });
    });
    act(() => {
      textFieldProps?.onChange?.(null, "82");
    });
    clickButton(harness.container, "Add");
    expect(harness.getState()?.field?.data?.measurements_entries).toHaveLength(1);

    clickButton(harness.container, "Delete");
    expect(harness.getState()?.field?.data?.measurements_entries).toHaveLength(0);
    expect(harness.getState()?.field?.data?.__componentPayloads?.dcoUpdatesByComponent?.measurements).toBeUndefined();
    act(() => harness.root.unmount());
  });

  it("renders quick-entry reminder buttons that prefill the editor", () => {
    const harness = renderGrid({ codes: CODES });

    expect(harness.container.textContent).toContain("REMINDER");
    clickButton(harness.container, "Weight");
    expect(dropdownProps?.selectedKey).toBe("22732");
    act(() => harness.root.unmount());
  });

  it("stages chart corrections as status-C updates and supports undo", () => {
    const harness = renderGrid({ codes: CODES, allowChartEdits: true });

    // First chart row (newest) is BMI 5002; correct its value.
    clickButton(harness.container, "Edit");
    act(() => {
      textFieldProps?.onChange?.(null, "25");
    });
    clickButton(harness.container, "Save correction");

    const edits = harness.getState()?.field?.data?.measurements_edits;
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ observationId: 5002, action: "correct", value: "25" });

    const payload = harness.getState()?.field?.data?.__componentPayloads?.dcoUpdatesByComponent?.measurements;
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      observationId: 5002,
      observationCode: "951",
      status: "C",
      value: "25",
      valueType: "NUMERIC",
    });
    // Corrected display shows old value struck plus new value.
    expect(harness.container.textContent).toContain("18.3");
    expect(harness.container.textContent).toContain("25");

    clickButton(harness.container, "Undo");
    expect(harness.getState()?.field?.data?.measurements_edits).toHaveLength(0);
    expect(harness.getState()?.field?.data?.__componentPayloads?.dcoUpdatesByComponent?.measurements).toBeUndefined();
    act(() => harness.root.unmount());
  });

  it("stages chart deletions as negative observation ids", () => {
    const harness = renderGrid({ codes: CODES, allowChartEdits: true });

    clickButton(harness.container, "Delete");
    const payload = harness.getState()?.field?.data?.__componentPayloads?.dcoUpdatesByComponent?.measurements;
    expect(payload).toEqual([{ observationId: -5002 }]);
    // Pending delete offers undo instead of further actions.
    expect(Array.from(harness.container.querySelectorAll("button")).some((entry) => entry.textContent === "Undo")).toBe(true);
    act(() => harness.root.unmount());
  });

  it("hides chart edit affordances unless allowChartEdits is enabled", () => {
    const harness = renderGrid({ codes: CODES });
    const buttonTexts = Array.from(harness.container.querySelectorAll("button")).map((entry) => entry.textContent);
    expect(buttonTexts).not.toContain("Edit");
    // Chart rows expose no Delete without the option (no in-form rows exist).
    expect(buttonTexts).not.toContain("Delete");
    act(() => harness.root.unmount());
  });

  it("opens a prefilled entry from a ctrl+key hotkey and captions the reminder button", () => {
    const harness = renderGrid({
      codes: [
        { code: "22732", label: "Weight", units: "kg", hotkey: "w" },
        { code: "951", label: "BMI" },
      ],
    });

    expect(harness.container.textContent).toContain("(ctrl + w)");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", ctrlKey: true }));
    });
    expect(dropdownProps?.selectedKey).toBe("22732");

    // Unmatched keys and bare keypresses do not open the editor.
    const idleHarness = renderGrid({ codes: [{ code: "951", label: "BMI", hotkey: "i" }] });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "i" }));
    });
    expect(idleHarness.container.querySelector('[data-dropdown="true"]')).toBeNull();
    act(() => harness.root.unmount());
    act(() => idleHarness.root.unmount());
  });

  it("keeps the range band strip when the selected row has no ranges, so the pane height stays stable", () => {
    // 2010 TEMPERATURE carries no range fields; the detail pane must still
    // render the LL/L/NORMAL RANGE/H/HH strip (empty boxes, like MOIS).
    const harness = renderGrid({ codes: [{ code: "2010", label: "Temperature" }] });
    expect(harness.container.textContent).toContain("Ref. Ranges:");
    expect(harness.container.textContent).toContain("NORMAL RANGE");
    expect(harness.container.textContent).not.toContain("No reference range on record.");
    act(() => harness.root.unmount());
  });

  it("hides all entry affordances when readOnly", () => {
    const harness = renderGrid({ codes: CODES, readOnly: true });

    const buttonTexts = Array.from(harness.container.querySelectorAll("button")).map((entry) => entry.textContent);
    expect(buttonTexts).not.toContain("New");
    expect(buttonTexts).not.toContain("Weight");
    expect(harness.container.textContent).not.toContain("REMINDER");
    act(() => harness.root.unmount());
  });
});
