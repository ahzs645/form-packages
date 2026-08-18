// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NHFORMS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NHFORMS_DIR, "ObservationValueDisplay", "index.jsx"), "utf8");

const primitive = (tag: string) => ({
  children,
  horizontal: _horizontal,
  verticalAlign: _verticalAlign,
  tokens: _tokens,
  styles: _styles,
  variant: _variant,
  ...props
}: Record<string, any>) => React.createElement(tag, props, children);

function loadObservationValueDisplay(sourceData: Record<string, unknown>): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const Fluent = {
    Stack: primitive("div"),
    Label: primitive("label"),
    Text: primitive("span"),
    Link: primitive("a"),
  };
  const useSourceData = () => sourceData;
  const ObservationKit = {
    toText: (value: unknown) => value == null ? "" : String(value),
    cutoffDate: () => null,
    getPath: (value: any) => value?.patient?.observations ?? [],
    matchesCode: (entry: any, candidate: any) => String(entry.code) === String(candidate.code),
    parseDate: (value: unknown) => new Date(String(value)),
    dateKey: (value: unknown) => String(value),
    displayDate: (value: string) => value.slice(0, 10).replaceAll("-", "."),
    extractValue: (entry: any) => String(entry.value ?? ""),
    classifyFlag: () => "",
    flagCellStyle: () => ({}),
    lookbackLabel: () => "",
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useSourceData",
    "ObservationKit",
    `${compiled};\nreturn { ObservationValueDisplay };`,
  );
  return factory(React, Fluent, useSourceData, ObservationKit).ObservationValueDisplay;
}

async function renderHistory(observations: unknown[]) {
  const ObservationValueDisplay = loadObservationValueDisplay({ patient: { observations } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(ObservationValueDisplay, {
      labelPosition: "none",
      observationCode: "951",
      units: "kg/m2",
      graphLinkText: "Graph",
      presentation: "measurement-summary",
    }));
  });
  return { container, root };
}

describe("ObservationValueDisplay measurement summary", () => {
  it("matches the PastMeasurementField Graph, date, value, and units order", async () => {
    const { container, root } = await renderHistory([
      { code: "951", value: 24.6, units: "kg/m2", collectedDateTime: "2026-04-21" },
    ]);
    const text = container.textContent ?? "";
    expect(text.indexOf("Graph")).toBeLessThan(text.indexOf("2026.04.21"));
    expect(text).toContain("2026.04.21   24.6   (kg/m2)");
    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps Graph first when no prior observation exists", async () => {
    const { container, root } = await renderHistory([]);
    expect(container.textContent).toBe("GraphNo past measurement available");
    await act(async () => root.unmount());
    container.remove();
  });
});
