// @vitest-environment happy-dom
/**
 * A question's show-when rule on one chart fact — the MOIS export writes it
 * as <ConditionalField mode='controller' controllerFieldId='chart:patient.…'
 * operator='equals' compareValue=…> — reads the fact from the chart the form
 * root registered with FormLogicKit, as the multi-condition path does: the
 * patient's sex, or whether a health issue on the chart belongs to a MOIS
 * concept (chart:patient.concept.DIABETES).
 *
 * The component sources are transpiled and run the way MOIS runs them.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compile = (name: string) =>
  Babel.transform(fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8"), { presets: ["react"], filename: "index.jsx" }).code ?? "";

type Tuple = [{ field: { data: Record<string, unknown>; status: Record<string, unknown> } }, (next: unknown) => void];
const ActiveData = React.createContext<Tuple>([{ field: { data: {}, status: {} } }, () => undefined]);

// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
const loaded = new Function(
  "React", "Fluent", "useActiveData", "useSourceData", "produce",
  `${compile("ValueKit")};\n${compile("FormLogicKit")};\n${compile("ConditionalGroup")};\nreturn { ConditionalField, FormLogicKit };`,
)(React, new Proxy({}, { get: () => () => null }), () => React.useContext(ActiveData), () => ({}), produce) as {
  ConditionalField: React.ComponentType<Record<string, unknown>>;
  FormLogicKit: { setChartSource: (sd: unknown) => void; setChartConcepts: (concepts: unknown[]) => void };
};

const DIABETES = {
  name: "DIABETES",
  group: "HEALTH ISSUE",
  rules: [
    { ruleType: "TEXT", codeField: "MOIS", codeSystem: "ICD-9", include1: "DIABETES", exclude: "GESTA" },
    { ruleType: "TEXT", codeField: "MOIS", codeSystem: "ICD-9", include1: "DM" },
  ],
};
const patient = (display: string) => ({
  administrativeGender: { code: "F" },
  birthDate: "1970-01-01",
  conditions: [{ condition: { system: "ICD-9", code: "250", display }, resolveDate: null }],
});

describe("a show-when rule on one chart fact", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    loaded.FormLogicKit.setChartSource(null);
    loaded.FormLogicKit.setChartConcepts([]);
  });

  const shows = (controllerFieldId: string, compareValue: string, sd: unknown) => {
    loaded.FormLogicKit.setChartConcepts([DIABETES]);
    loaded.FormLogicKit.setChartSource(sd);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(React.createElement(
      ActiveData.Provider,
      { value: [{ field: { data: {}, status: {} } }, () => undefined] },
      React.createElement(loaded.ConditionalField, { fieldId: "footExam", mode: "controller", controllerFieldId, operator: "equals", compareValue },
        React.createElement("span", { "data-question": "" }, "Foot exam")),
    )));
    const shown = container.querySelector("[data-question]") !== null;
    act(() => root?.unmount());
    root = null;
    return shown;
  };

  it("reads a concept fact from the registered chart", () => {
    expect(shows("chart:patient.concept.DIABETES", "yes", { patient: patient("TYPE 2 DIABETES MELLITUS") })).toBe(true);
    expect(shows("chart:patient.concept.DIABETES", "yes", { patient: patient("GESTATIONAL DIABETES") })).toBe(false);
  });

  it("matches a rule saved with the answer's label", () => {
    expect(shows("chart:patient.concept.DIABETES", "Yes", { patient: patient("TYPE 2 DIABETES MELLITUS") })).toBe(true);
    expect(shows("chart:patient.sex", "Female", { patient: patient("ASTHMA") })).toBe(true);
  });

  it("reads the patient's sex the same way", () => {
    expect(shows("chart:patient.sex", "female", { patient: patient("ASTHMA") })).toBe(true);
    expect(shows("chart:patient.sex", "male", { patient: patient("ASTHMA") })).toBe(false);
  });
});
