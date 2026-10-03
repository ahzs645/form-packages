// @vitest-environment happy-dom
/**
 * AnswerChoiceField: the choice control for what the faithful MOIS controls
 * cannot do. Rendered with real Fluent parts and FormLogicKit, bound to form
 * data the way MOIS runs it (bare React/Fluent/useActiveData/produce globals).
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import * as Fluent from "@fluentui/react";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compile = (name: string) =>
  Babel.transform(fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8"), { presets: ["react"], filename: "index.jsx" }).code ?? "";

type Data = Record<string, unknown>;
type State = { field: { data: Data; status: Record<string, unknown> } };
const Store = React.createContext<[State, (update: unknown) => void]>([{ field: { data: {}, status: {} } }, () => undefined]);
const Source = React.createContext<unknown>({});

// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
const { AnswerChoiceField } = new Function(
  "React", "Fluent", "useActiveData", "useSourceData", "produce",
  `${compile("ValueKit")};\n${compile("FormLogicKit")};\n${compile("AnswerChoiceField")};\nreturn { AnswerChoiceField };`,
)(React, Fluent, () => React.useContext(Store), () => React.useContext(Source), produce) as {
  AnswerChoiceField: React.ComponentType<Record<string, unknown>>;
};

const answers = [
  { code: "unable", display: "Unable to obtain", exclusive: true },
  { code: "self", display: "Self" },
  { code: "spouse", display: "Spouse/Partner" },
  { code: "parent", display: "Parent" },
];
const adults = { match: "all", conditions: [{ controllerFieldId: "chart:patient.ageYears", type: "number-gte", value: 18 }] };
const children = { match: "all", conditions: [{ controllerFieldId: "chart:patient.ageYears", type: "number-lt", value: 18 }] };

describe("AnswerChoiceField", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let data: Data = {};
  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    data = {};
  });

  function Harness(props: Record<string, unknown> & { patient?: unknown }) {
    const [state, setState] = React.useState<State>({ field: { data, status: {} } });
    data = state.field.data;
    const set = (update: unknown) => setState((current) => (typeof update === "function" ? (update as (s: State) => State)(current) : (update as State)));
    return React.createElement(Store.Provider, { value: [state, set] },
      React.createElement(Source.Provider, { value: { patient: props.patient } }, React.createElement(AnswerChoiceField, props)));
  }
  const mount = (props: Record<string, unknown>) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(React.createElement(Harness, props)));
    return container;
  };
  const box = (name: string) => {
    const text = [...container!.querySelectorAll(".ms-Checkbox-text")].find((entry) => entry.textContent?.trim() === name);
    return text?.parentElement?.parentElement?.querySelector("input") as HTMLInputElement;
  };
  const labels = () => [...container!.querySelectorAll(".ms-Checkbox-text")].map((entry) => entry.textContent?.trim());

  it("clears an optional dropdown answer without using an empty-code option", () => {
    data = { mark: { code: "O", display: "O" } };
    mount({ fieldId: "mark", label: "Hour mark", presentation: "dropdown", allowClear: true, answers: [{ code: "O", display: "O" }, { code: "✓", display: "✓" }, { code: "X", display: "X" }] });
    const clear = container!.querySelector<HTMLButtonElement>('button[aria-label="Clear answer"]');
    expect(clear).not.toBeNull();
    act(() => clear!.click());
    expect(data.mark).toBeNull();
    expect(container!.querySelector('button[aria-label="Clear answer"]')).toBeNull();
  });

  it("clears the others when an exclusive answer is chosen, and clears it when another is", () => {
    mount({ fieldId: "given", label: "Information Given By", selectionType: "multiple", answers });
    act(() => box("Self").click());
    act(() => box("Spouse/Partner").click());
    expect(data.given).toEqual([
      { code: "self", display: "Self", system: undefined },
      { code: "spouse", display: "Spouse/Partner", system: undefined },
    ]);
    act(() => box("Unable to obtain").click());
    expect(data.given).toEqual([{ code: "unable", display: "Unable to obtain", system: undefined }]);
    act(() => box("Parent").click());
    expect((data.given as Array<{ code: string }>).map((entry) => entry.code)).toEqual(["parent"]);
  });

  it("offers each patient their own answers from the chart, and greys out a disabled one", () => {
    const optionRules = [{ value: "spouse", showWhen: adults }, { value: "parent", showWhen: children }, { value: "self", disableWhen: children }];
    mount({ fieldId: "given", label: "Given by", selectionType: "multiple", answers, optionRules, patient: { birthDate: "1990-01-01" } });
    expect(labels()).toEqual(["Unable to obtain", "Self", "Spouse/Partner"]);
    act(() => root?.unmount());
    mount({ fieldId: "given", label: "Given by", selectionType: "multiple", answers, optionRules, patient: { birthDate: "2015-01-01" } });
    expect(labels()).toEqual(["Unable to obtain", "Self", "Parent"]);
    expect(box("Self").disabled).toBe(true);
  });

  it("flags a chosen answer that is no longer offered instead of clearing it", () => {
    data = { given: [{ code: "spouse", display: "Spouse/Partner" }] };
    mount({ fieldId: "given", label: "Given by", selectionType: "multiple", answers, optionRules: [{ value: "spouse", showWhen: adults }], patient: { birthDate: "2015-01-01" } });
    expect(container!.querySelector('[role="alert"]')?.textContent).toContain("Spouse/Partner is not offered for this patient");
    expect(data.given).toEqual([{ code: "spouse", display: "Spouse/Partner" }]);
  });

  it("saves free text as MOIS does: a coding whose code is the text", () => {
    mount({ fieldId: "given", label: "Given by", selectionType: "multiple", answers, showOtherOption: true });
    act(() => box("Self").click());
    act(() => box("Other").click());
    const input = container!.querySelector<HTMLInputElement>('input[type="text"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Neighbour");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => { input.focus(); input.blur(); });
    expect((data.given as Array<{ code: string }>).map((entry) => entry.code)).toEqual(["self", "Neighbour"]);
  });

  it("draws one answer as radios, and hands the answer to a container when controlled", () => {
    let emitted: unknown = "unset";
    mount({ fieldId: "cell", label: "Route", selectionType: "single", answers: ["Oral", "IV"], value: null, onChange: (next: unknown) => { emitted = next; } });
    const radio = [...container!.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find((input) => input.value === "IV" || input.id.endsWith("IV"))
      ?? container!.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1];
    act(() => radio.click());
    expect(emitted).toEqual({ code: "IV", display: "IV", system: undefined });
    expect(data.cell).toBeUndefined();
  });
});
