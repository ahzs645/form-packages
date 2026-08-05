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
const source = fs.readFileSync(path.join(NH, "ObservationQuery", "index.jsx"), "utf8");
// ObservationQuery depends on the ObservationKit helper module (shared engine
// scope at runtime); concatenate it ahead of the component source like the
// export bundle does.
const kitSource = fs.readFileSync(path.join(NH, "ObservationKit", "index.jsx"), "utf8");

const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
const FluentStub = {
  Stack: passthrough,
  Label: ({ children }: { children?: React.ReactNode }) => React.createElement("span", { "data-label": "true" }, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
};

let chartProps: Record<string, any> | null = null;
const ObservationChartStub = (props: Record<string, any>) => {
  chartProps = props;
  return React.createElement("div", { "data-chart": "true" });
};

function loadObservationQuery(
  sourceData: Record<string, unknown>,
  options?: { withChart?: boolean }
): React.ComponentType<any> {
  const compiled = Babel.transform(`${kitSource}\n${source}`, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // Same bare-global contract used by the injected NHForms runtime.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useSourceData",
    ...(options?.withChart ? ["ObservationChart"] : []),
    `${compiled};\nreturn { ObservationQuery };`
  );
  const args: unknown[] = [React, FluentStub, () => sourceData];
  if (options?.withChart) args.push(ObservationChartStub);
  return factory(...args).ObservationQuery;
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const OBSERVATIONS = [
  { observationCode: "4548-4", value: "6.9", units: "%", collectedDateTime: daysAgo(30) },
  { observationCode: "4548-4", value: "8.2", units: "%", collectedDateTime: daysAgo(500) },
  {
    observationCode: "22732",
    value: "180",
    units: "kg",
    collectedDateTime: daysAgo(10),
    abnormalFlag: { code: "H", display: "High", system: "MOIS-ABNORMALFLAG" },
  },
  { observationCode: "951", value: "12", collectedDateTime: daysAgo(5), rangeNormalLow: "18.5", rangeVeryLow: "14" },
];

function renderQuery(props: Record<string, unknown>, options?: { withChart?: boolean; observations?: unknown[] }) {
  chartProps = null;
  const ObservationQuery = loadObservationQuery(
    { patient: { observations: options?.observations ?? OBSERVATIONS } },
    options
  );
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(ObservationQuery, props)));
  return { container, root };
}

describe("ObservationQuery", () => {
  it("filters observations outside the lookback window in table mode", () => {
    const harness = renderQuery({
      display: "table",
      codes: [{ code: "4548-4", label: "HbA1c" }],
      lookback: { amount: 12, unit: "months" },
    });

    expect(harness.container.textContent).toContain("6.9 %");
    expect(harness.container.textContent).not.toContain("8.2");
    expect(harness.container.textContent).toContain("Last 12 months");
    act(() => harness.root.unmount());
  });

  it("includes full history when no lookback is set and respects maxRows", () => {
    const harness = renderQuery({
      display: "table",
      codes: [{ code: "4548-4", label: "HbA1c" }],
      maxRows: 1,
    });

    // Only the most recent date row survives the row cap.
    expect(harness.container.textContent).toContain("6.9 %");
    expect(harness.container.textContent).not.toContain("8.2");

    const fullHarness = renderQuery({
      display: "table",
      codes: [{ code: "4548-4", label: "HbA1c" }],
      maxRows: 10,
    });
    expect(fullHarness.container.textContent).toContain("8.2");
    act(() => harness.root.unmount());
    act(() => fullHarness.root.unmount());
  });

  it("matches entries through the LOINC code alias", () => {
    const harness = renderQuery({
      display: "table",
      codes: [{ code: "HGBA1C", label: "HbA1c", loincCode: "4548-4" }],
    });

    expect(harness.container.textContent).toContain("6.9 %");
    act(() => harness.root.unmount());
  });

  it("shows explicit and range-derived abnormal flags", () => {
    const harness = renderQuery({
      display: "table",
      codes: [
        { code: "22732", label: "Weight" },
        { code: "951", label: "BMI" },
      ],
    });

    // 22732 carries an explicit MOIS abnormalFlag; 951 falls below rangeVeryLow -> LL.
    expect(harness.container.textContent).toContain("H");
    expect(harness.container.textContent).toContain("LL");
    act(() => harness.root.unmount());
  });

  it("renders latest values with Not Found for missing codes", () => {
    const harness = renderQuery({
      display: "latest",
      codes: [
        { code: "4548-4", label: "HGBA1C" },
        { code: "2093-3", label: "CHOLESTEROL" },
      ],
    });

    expect(harness.container.textContent).toContain("6.9 %");
    expect(harness.container.textContent).toContain("CHOLESTEROL Not Found");
    expect(harness.container.textContent).not.toContain("8.2");
    act(() => harness.root.unmount());
  });

  it("delegates chart mode to ObservationChart with per-code series and filtered rows", () => {
    const harness = renderQuery(
      {
        display: "chart",
        codes: [{ code: "4548-4", label: "HbA1c" }],
        lookback: { amount: 12, unit: "months" },
        maxRows: 20,
      },
      { withChart: true }
    );

    expect(harness.container.querySelector('[data-chart="true"]')).not.toBeNull();
    expect(chartProps?.series).toEqual([{ label: "HbA1c", dataKey: "c0", parser: "number" }]);
    expect(chartProps?.maxPoints).toBe(20);
    expect(chartProps?.data).toHaveLength(1);
    expect(chartProps?.data?.[0]?.c0).toBe("6.9");
    act(() => harness.root.unmount());
  });

  it("falls back gracefully in chart mode when ObservationChart is unavailable", () => {
    const harness = renderQuery({
      display: "chart",
      codes: [{ code: "4548-4", label: "HbA1c" }],
    });

    expect(harness.container.textContent).toContain("Chart display requires the ObservationChart component.");
    act(() => harness.root.unmount());
  });

  it("prompts for configuration when no codes are set", () => {
    const harness = renderQuery({ display: "table", codes: [] });

    expect(harness.container.textContent).toContain("No observations selected");
    act(() => harness.root.unmount());
  });
});
