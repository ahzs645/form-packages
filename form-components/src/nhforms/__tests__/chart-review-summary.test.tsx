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
// ChartReviewSummary depends on the ObservationKit helper module (shared engine
// scope at runtime), so the harness concatenates it ahead of the component.
const kitSource = fs.readFileSync(path.join(NH, "ObservationKit", "index.jsx"), "utf8");
const source = fs.readFileSync(path.join(NH, "ChartReviewSummary", "index.jsx"), "utf8");

const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
const stackStub: any = passthrough;
stackStub.Item = passthrough;
const FluentStub = {
  Stack: stackStub,
  Label: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
};

function loadComponent(sourceData: Record<string, unknown>): React.ComponentType<any> {
  const compiled = Babel.transform(`${kitSource}\n${source}`, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function("React", "Fluent", "useSourceData", `${compiled};\nreturn { ChartReviewSummary };`);
  return factory(React, FluentStub, () => sourceData).ChartReviewSummary;
}

const PATIENT = {
  birthDate: "1928-11-17",
  administrativeGender: { code: "M", display: "Male", system: "MOIS-GENDER" },
  conditions: [
    { conditionId: 1, condition: { code: "DM2", display: "Type 2 Diabetes" }, startDate: "2019-06-01", resolveDate: null },
    { conditionId: 2, condition: { code: "PNA", display: "Pneumonia" }, startDate: "2023-02-10", resolveDate: "2023-03-15" },
  ],
  longTermMedications: [
    { medication: { code: "METFORMIN", display: "Metformin 500mg" }, dose: "500mg", frequency: "BID", route: "PO", startDate: "2019-06-15", stopDate: null },
    { medication: "VITAMIN D 1000IU", doseFrequency: "1 TAB ORAL DAILY", startDate: "2019-07-18", endDate: "2020-06-10" },
  ],
  observations: [
    { observationId: 1, observationCode: "128", loincCode: "4548-4", description: "HbA1c", value: "6.8", units: "%", collectedDateTime: "2026-03-11T08:30:00", abnormalFlag: "H" },
    { observationId: 2, observationCode: "PNEUMOCOCCAL", description: "Pneumococcal vaccine", value: "", collectedDateTime: "2024-11-15T10:00:00" },
  ],
};

function renderSummary(props: Record<string, unknown>, patient: Record<string, unknown> = PATIENT) {
  const ChartReviewSummary = loadComponent({ patient });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(ChartReviewSummary, props)));
  return { container, root };
}

describe("ChartReviewSummary", () => {
  it("renders demographics, active problems, active medications, and latest values", () => {
    const harness = renderSummary({
      codes: [
        { code: "128", loincCode: "4548-4", label: "HGBA1C" },
        { code: "2089-1", label: "LDL" },
      ],
    });
    const text = harness.container.textContent ?? "";

    expect(text).toContain("Age = ");
    expect(text).toContain("SEX = MALE");
    expect(text).toContain("CURRENT PROBLEM LIST");
    expect(text).toContain("TYPE 2 DIABETES");
    // Resolved problems stay hidden by default.
    expect(text).not.toContain("PNEUMONIA");
    expect(text).toContain("CURRENT ACTIVE MEDICATIONS");
    expect(text).toContain("METFORMIN 500MG");
    expect(text).toContain("[ 500mg PO BID ]");
    // Stopped medication (2020 end date) is not "current".
    expect(text).not.toContain("VITAMIN D");
    // Latest observation with value, MOIS date format, and flag bracket.
    expect(text).toContain("HGBA1C - 2026.03.11 - 6.8 %");
    expect(text).toContain("[ H ]");
    // Missing observation renders the red recall line.
    expect(text).toContain("LDL Not Found");
    act(() => harness.root.unmount());
  });

  it("lists resolved problems when includeResolvedProblems is on", () => {
    const harness = renderSummary({ includeResolvedProblems: true, codes: [] });
    expect(harness.container.textContent).toContain("PNEUMONIA");
    act(() => harness.root.unmount());
  });

  it("renders date-only records as label - date without a flag bracket", () => {
    const harness = renderSummary({
      codes: [{ code: "PNEUMOCOCCAL", label: "PNEUMOCOCCAL VACCINE" }],
    });
    const text = harness.container.textContent ?? "";
    expect(text).toContain("PNEUMOCOCCAL VACCINE - 2024.11.15");
    expect(text).not.toContain("PNEUMOCOCCAL VACCINE - 2024.11.15 -");
    expect(text).not.toContain("PNEUMOCOCCAL VACCINE Not Found");
    act(() => harness.root.unmount());
  });

  it("hides sections via their toggles", () => {
    const harness = renderSummary({
      showDemographics: false,
      showProblems: false,
      showMedications: false,
      codes: [],
    });
    const text = harness.container.textContent ?? "";
    expect(text).not.toContain("Age = ");
    expect(text).not.toContain("CURRENT PROBLEM LIST");
    expect(text).not.toContain("CURRENT ACTIVE MEDICATIONS");
    act(() => harness.root.unmount());
  });
});
