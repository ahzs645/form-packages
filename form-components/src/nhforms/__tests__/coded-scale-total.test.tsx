// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NHFORMS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NHFORMS_DIR, "ComputedField", "index.jsx"), "utf8");

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => undefined]);

function loadComputedField(): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const TextArea = (props: { fieldId: string; value?: unknown }) => React.createElement("input", {
    "data-field-id": props.fieldId,
    value: props.value == null ? "" : String(props.value),
    readOnly: true,
  });
  const useActiveData = () => React.useContext(ActiveDataContext);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function("React", "TextArea", "useActiveData", `${compiled};\nreturn { ComputedField };`);
  return factory(React, TextArea, useActiveData).ComputedField;
}

const IDS = ["a1", "a2", "a3", "a4", "a5", "a6"];

/**
 * The six Braden subscale answers a nurse would select, in both stored shapes:
 * ScaleField writes `{ selectedKey, value, response }` with the ordinal in
 * `value`; FindCodeSelect writes the coding, leaving the score to be resolved
 * through the option map compiled into the expression.
 */
const ANSWERS = [
  { code: "3", display: "Slightly limited", score: 3 },
  { code: "2", display: "Very moist", score: 2 },
  { code: "2", display: "Chairfast", score: 2 },
  { code: "2", display: "Very limited", score: 2 },
  { code: "2", display: "Probably inadequate", score: 2 },
  { code: "1", display: "Problem", score: 1 },
];
const EXPECTED_TOTAL = 12;

const scaleData = Object.fromEntries(IDS.map((id, index) => [id, {
  selectedKey: ANSWERS[index].code,
  value: ANSWERS[index].score,
  response: ANSWERS[index].display,
  detailResponse: ANSWERS[index].display,
}]));
const choiceData = Object.fromEntries(IDS.map((id, index) => [id, {
  code: ANSWERS[index].code,
  display: ANSWERS[index].display,
  system: "",
}]));

/** What buildLoincPanelFields emits for a scale-rendered panel. */
const SCALE_EXPRESSION = IDS.map((id) => `[${id}]`).join(" + ");
/** What it emits for a dropdown-rendered panel, after score maps are compiled in. */
const CHOICE_EXPRESSION = IDS.map((id, index) => {
  const map = Object.fromEntries([
    [ANSWERS[index].code, ANSWERS[index].score],
    [ANSWERS[index].display, ANSWERS[index].score],
  ]);
  return `score([${id}], ${JSON.stringify(map)})`;
}).join(" + ");

function render(expression: string, data: Record<string, unknown>) {
  const ComputedField = loadComputedField();
  let state: any = null;
  const Harness = () => {
    const [current, setCurrent] = React.useState({
      field: { data: { ...data, total: null }, status: {}, history: [] },
    });
    state = current;
    const update = (updater: any) =>
      setCurrent((previous) => (typeof updater === "function" ? produce(previous, updater) : updater));
    return React.createElement(
      ActiveDataContext.Provider,
      { value: [current, update] },
      React.createElement(ComputedField, {
        fieldId: "total",
        label: "Braden Scale Total Score",
        expression,
        precision: 0,
        calculationPolicy: "always-calculated",
        incompleteBehavior: "show-text",
        incompleteText: "Complete all questions to calculate",
      })
    );
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  const rendered = container.querySelector("input")?.getAttribute("value") ?? null;
  const stored = state.field.data.total;
  act(() => root.unmount());
  return { rendered, stored };
}

describe("coded ordinal totals under both renderings", () => {
  it("sums scale answers through plain references", () => {
    expect(render(SCALE_EXPRESSION, scaleData)).toEqual({
      rendered: String(EXPECTED_TOTAL),
      stored: EXPECTED_TOTAL,
    });
  });

  it("sums dropdown answers through compiled option scores", () => {
    expect(render(CHOICE_EXPRESSION, choiceData)).toEqual({
      rendered: String(EXPECTED_TOTAL),
      stored: EXPECTED_TOTAL,
    });
  });

  it("treats an untouched scale as incomplete rather than zero", () => {
    // ScaleField seeds this shape before the user picks an answer. A partial
    // total must not render or persist.
    const partial = { ...scaleData, a6: { selectedKey: null, value: null } };
    expect(render(SCALE_EXPRESSION, partial)).toEqual({
      rendered: "Complete all questions to calculate",
      stored: null,
    });
  });

  it("counts a legitimate zero answer as answered", () => {
    // A 0-scored option (HoNOS "No problem") is an answer, not a blank.
    const withZero = { ...scaleData, a6: { selectedKey: "0", value: 0, response: "No problem" } };
    expect(render(SCALE_EXPRESSION, withZero)).toEqual({
      rendered: String(EXPECTED_TOTAL - 1),
      stored: EXPECTED_TOTAL - 1,
    });
  });
});
