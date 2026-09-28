// @vitest-environment happy-dom
/**
 * Answer conditions on a form question (ConditionalFieldBehavior): rules that
 * only offer or hide answers keep the question's own MOIS control (a
 * checklist here) with the filtered list; only a "grey out when" rule, which
 * the faithful controls cannot draw, falls back to a list with disabled
 * answers. Conditions read chart facts through FormLogicKit.
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
  `${compile("ValueKit")};\n${compile("FormLogicKit")};\n${compile("ConditionalGroup")};\nreturn { ConditionalFieldBehavior, FormLogicKit };`,
)(React, new Proxy({}, { get: () => () => null }), () => React.useContext(ActiveData), () => ({}), produce) as {
  ConditionalFieldBehavior: React.ComponentType<Record<string, unknown>>;
  FormLogicKit: { setChartSource: (sd: unknown) => void };
};

/** Stands in for the MOIS checklist: draws the answers it is given. */
function Checklist({ optionList }: { fieldId: string; optionList: Array<{ key: string; text: string }> }) {
  return React.createElement("ul", { "data-checklist": "" }, optionList.map((option) => React.createElement("li", { key: option.key }, option.text)));
}

const adults = { match: "all", conditions: [{ controllerFieldId: "chart:patient.ageYears", type: "number-gte", value: 18 }] };
const children = { match: "all", conditions: [{ controllerFieldId: "chart:patient.ageYears", type: "number-lt", value: 18 }] };
const options = [{ key: "spouse", text: "Spouse/Partner" }, { key: "parent", text: "Parent" }, { key: "friend", text: "Friend" }];

describe("answer conditions on a MOIS form question", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    loaded.FormLogicKit.setChartSource(null);
  });

  const render = (optionRules: unknown[], birthDate: string) => {
    loaded.FormLogicKit.setChartSource({ patient: { birthDate } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(React.createElement(
      ActiveData.Provider,
      { value: [{ field: { data: {}, status: {} } }, () => undefined] },
      React.createElement(loaded.ConditionalFieldBehavior, { fieldId: "accompanied", optionRules },
        React.createElement(Checklist, { fieldId: "accompanied", optionList: options })),
    )));
    return container;
  };

  it("keeps the checklist and offers an adult and a child their own answers", () => {
    const rules = [{ value: "spouse", showWhen: adults }, { value: "parent", showWhen: children }];
    const adult = render(rules, "1990-01-01");
    expect(adult.querySelector("select")).toBeNull();
    expect([...adult.querySelectorAll("[data-checklist] li")].map((item) => item.textContent)).toEqual(["Spouse/Partner", "Friend"]);
    act(() => root?.unmount());
    const child = render(rules, "2015-01-01");
    expect([...child.querySelectorAll("[data-checklist] li")].map((item) => item.textContent)).toEqual(["Parent", "Friend"]);
  });

  it("falls back to a list with a disabled answer only for a grey-out rule", () => {
    const view = render([{ value: "friend", disableWhen: adults }], "1990-01-01");
    expect(view.querySelector("[data-checklist]")).toBeNull();
    expect(view.querySelector<HTMLOptionElement>('option[value="friend"]')?.disabled).toBe(true);
  });
});
