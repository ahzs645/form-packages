// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "FlowSheet", "index.jsx"), "utf8");
// FlowSheet depends on the ObservationKit helper module (shared engine scope
// at runtime); concatenate it ahead of the component source like the export
// bundle does.
const kitSource = fs.readFileSync(path.join(NH, "ObservationKit", "index.jsx"), "utf8");

const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
const FluentStub = {
  Stack: passthrough,
  Label: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("span", { "data-label": "true" }, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
  PrimaryButton: ({ text, onClick }: { text?: string; onClick?: () => void }) =>
    React.createElement("button", { onClick }, text),
  Dialog: ({ hidden, children }: { hidden?: boolean; children?: React.ReactNode }) =>
    hidden ? null : React.createElement("div", { "data-dialog": "true" }, children),
  DialogType: { largeHeader: 1 },
  DialogFooter: passthrough,
};

function loadFlowSheet(sourceData: Record<string, unknown>): React.ComponentType<any> {
  const compiled = Babel.transform(`${kitSource}\n${source}`, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // Same bare-global contract used by the injected NHForms runtime.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function("React", "Fluent", "useSourceData", `${compiled};\nreturn { FlowSheet };`);
  return factory(React, FluentStub, () => sourceData).FlowSheet;
}

const OBSERVATIONS = [
  { observationCode: "1950", value: "120/80", collectedDateTime: "2024-08-12T10:00", description: "BLOOD PRESSURE" },
  { observationCode: "1950", value: "129/85", collectedDateTime: "2024-11-01T09:00", description: "BLOOD PRESSURE" },
  {
    observationCode: "951",
    value: "185.2",
    collectedDateTime: "2024-11-01T09:05",
    rangeNormalHigh: "25",
    rangeAbsurdHigh: "50",
  },
  { observationCode: "128", loincCode: "4548-4", value: "6.9", units: "%", collectedDateTime: "2023-05-05" },
];

const MEDICATIONS = [
  {
    medication: "APO-WARFARIN 1 MG TABLET",
    doseFrequency: "1 TAB ORAL DAILY",
    startDate: "2024-07-31",
    endDate: "2024-08-26",
  },
  { medication: "Berberine 500mg", startDate: "2024-01-01" },
  { medication: "OLD COURSE 10MG", startDate: "2010-01-01", endDate: "2010-06-01" },
  {
    medication: { code: "LISINOPRIL", display: "Lisinopril 10mg", system: "MOIS-MEDICATION" },
    genericName: "Lisinopril",
    atcCode: { code: "C09AA03", display: "ACE inhibitors", system: "ATC" },
    dose: "10mg",
    route: "PO",
    frequency: "Daily",
    startDate: "2024-01-01",
    stopDate: null,
  },
];

function renderFlowSheet(props: Record<string, unknown>, sourceOverrides?: Record<string, unknown>) {
  const FlowSheet = loadFlowSheet({
    patient: { observations: OBSERVATIONS, longTermMedications: MEDICATIONS, ...(sourceOverrides ?? {}) },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(FlowSheet, props)));
  return { container, root };
}

const BASE_ROWS = [
  { code: "1950", label: "Blood Pressure", units: "mm Hg" },
  { code: "----" },
  { code: "951", label: "BMI" },
  { code: "HGBA1C", label: "HGBA1C", loincCode: "4548-4" },
];

describe("FlowSheet", () => {
  it("transposes observations into element rows and date columns", () => {
    const harness = renderFlowSheet({ rows: BASE_ROWS });
    const text = harness.container.textContent ?? "";

    // Dates render MOIS-style (dotted), oldest -> newest.
    expect(text).toContain("2023.05.05");
    expect(text).toContain("2024.08.12");
    expect(text).toContain("2024.11.01");
    expect(text.indexOf("2023.05.05")).toBeLessThan(text.indexOf("2024.11.01"));
    // Units fold into the row label, values stay bare.
    expect(text).toContain("Blood Pressure (mm Hg)");
    expect(text).toContain("120/80");
    expect(text).toContain("129/85");
    // LOINC alias matching pulls MOIS code 128 through 4548-4.
    expect(text).toContain("6.9");
    // Range-derived critical flag for BMI 185.2 > absurd high 50.
    expect(text).toContain("185.2 HH");
    act(() => harness.root.unmount());
  });

  it("renders separator rows and the long-term medication bars", () => {
    const harness = renderFlowSheet({ rows: BASE_ROWS });
    const text = harness.container.textContent ?? "";

    expect(text).toContain("----");
    expect(text).toContain("LONG TERM MEDICATIONS");
    expect(text).toContain("APO-WARFARIN 1 MG TABLET");
    expect(text).toContain("BERBERINE 500MG");
    // A course that ended before every column draws no bar but keeps its row.
    expect(text).toContain("OLD COURSE 10MG");

    const rows = Array.from(harness.container.querySelectorAll("tbody tr"));
    const rowText = (row: Element) => row.querySelector("td")?.textContent ?? "";
    const warfarin = rows.find((row) => rowText(row).includes("APO-WARFARIN"));
    const berberine = rows.find((row) => rowText(row).includes("BERBERINE"));
    const oldCourse = rows.find((row) => rowText(row).includes("OLD COURSE"));
    // Columns: 2023-05-05, 2024-08-12, 2024-11-01. Warfarin (07-31..08-26) covers only 2024-08-12.
    expect(warfarin?.textContent?.match(/========/g)).toHaveLength(1);
    // Berberine has no end date: active for both 2024 columns.
    expect(berberine?.textContent?.match(/========/g)).toHaveLength(2);
    expect(oldCourse?.textContent).not.toContain("========");
    act(() => harness.root.unmount());
  });

  it("hides medications when showMedications is false", () => {
    const harness = renderFlowSheet({ rows: BASE_ROWS, showMedications: false });
    expect(harness.container.textContent).not.toContain("LONG TERM MEDICATIONS");
    expect(harness.container.textContent).not.toContain("APO-WARFARIN");
    act(() => harness.root.unmount());
  });

  it("limits columns to the most recent maxColumns dates", () => {
    const harness = renderFlowSheet({ rows: BASE_ROWS, maxColumns: 2 });
    const text = harness.container.textContent ?? "";
    expect(text).not.toContain("2023.05.05");
    expect(text).toContain("2024.08.12");
    expect(text).toContain("2024.11.01");
    expect(text).toContain("DATE RANGE: 2024.08.12 TO 2024.11.01");
    act(() => harness.root.unmount());
  });

  it("opens the submodal from the button when openInModal is set", () => {
    const harness = renderFlowSheet({ rows: BASE_ROWS, openInModal: true, modalButtonText: "Open Flow Sheet" });

    expect(harness.container.querySelector('[data-dialog="true"]')).toBeNull();
    // Inline body is replaced by the launch button.
    expect(harness.container.textContent).not.toContain("120/80");
    const button = Array.from(harness.container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === "Open Flow Sheet"
    );
    expect(button).toBeTruthy();
    act(() => button!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(harness.container.querySelector('[data-dialog="true"]')).not.toBeNull();
    expect(harness.container.textContent).toContain("120/80");
    act(() => harness.root.unmount());
  });

  it("renders placed medication rows in element order with one row per matched course", () => {
    const harness = renderFlowSheet({
      rows: [
        { kind: "medication", match: "WARFARIN", label: "Warfarin" },
        { code: "1950", label: "Blood Pressure" },
      ],
      medicationsMode: "selected",
    });
    const bodyRows = Array.from(harness.container.querySelectorAll("tbody tr"));
    const labels = bodyRows.map((row) => row.querySelector("td")?.textContent ?? "");

    // Placed medication row renders before the BP row, labeled per config.
    expect(labels[0]).toBe("Warfarin");
    expect(labels[1]).toContain("Blood Pressure");
    expect(bodyRows[0].textContent).toContain("========");
    // Selected mode: no auto bottom section, unmatched meds stay hidden.
    expect(harness.container.textContent).not.toContain("LONG TERM MEDICATIONS");
    expect(harness.container.textContent).not.toContain("BERBERINE");
    act(() => harness.root.unmount());
  });

  it("keeps unmatched placed medication rows visible as empty recall rows", () => {
    const harness = renderFlowSheet({
      rows: [
        { kind: "medication", match: "INSULIN", label: "Insulin" },
        { code: "1950", label: "Blood Pressure" },
      ],
      medicationsMode: "selected",
    });
    const firstRow = harness.container.querySelector("tbody tr");
    expect(firstRow?.textContent).toContain("Insulin");
    expect(firstRow?.textContent).not.toContain("========");
    act(() => harness.root.unmount());
  });

  it("does not repeat courses matched by placed rows in the all-medications section", () => {
    const harness = renderFlowSheet({
      rows: [
        { kind: "medication", match: "WARFARIN", label: "Warfarin" },
        { code: "1950", label: "Blood Pressure" },
      ],
      medicationsMode: "all",
    });
    const text = harness.container.textContent ?? "";
    // Bottom section still lists the others...
    expect(text).toContain("LONG TERM MEDICATIONS");
    expect(text).toContain("BERBERINE 500MG");
    // ...but the matched warfarin course only appears as the placed row.
    expect(text).not.toContain("APO-WARFARIN 1 MG TABLET");
    expect(text).toContain("Warfarin");
    act(() => harness.root.unmount());
  });

  it("matches coded ATC prefixes and composes dose from dose/route/frequency", () => {
    const harness = renderFlowSheet({
      rows: [
        { kind: "medication", match: "C09", label: "ACE Inhibitor" },
        { code: "1950", label: "Blood Pressure" },
      ],
      medicationsMode: "selected",
      showMedicationDose: true,
    });
    const firstRow = harness.container.querySelector("tbody tr");
    // atcCode {code: "C09AA03"} matches the C09 prefix even though the display
    // text is "ACE inhibitors"; dose falls back to dose+route+frequency.
    expect(firstRow?.textContent).toContain("ACE Inhibitor — 10mg PO Daily");
    expect(firstRow?.textContent).toContain("========");
    act(() => harness.root.unmount());
  });

  it("appends dose frequency to medication labels when showMedicationDose is set", () => {
    const harness = renderFlowSheet({
      rows: [{ kind: "medication", match: "WARFARIN", label: "Warfarin" }],
      medicationsMode: "selected",
      showMedicationDose: true,
    });
    expect(harness.container.textContent).toContain("Warfarin — 1 TAB ORAL DAILY");
    act(() => harness.root.unmount());
  });

  it("prompts for configuration when no rows are set and meds are hidden", () => {
    const harness = renderFlowSheet({ rows: [], showMedications: false });
    expect(harness.container.textContent).toContain("No flow sheet rows configured yet.");
    act(() => harness.root.unmount());
  });
});
