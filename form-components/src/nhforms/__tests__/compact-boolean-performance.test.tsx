// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("reuses Fluent styles and skips unchanged buttons on sibling edits, while updating linked answers and theme", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "packages/form-components/src/nhforms/CompactBooleanField/index.jsx"), "utf8");
  const compiled = Babel.transform(source, { presets: ["react"] }).code ?? "";
  const Context = React.createContext<any>(null);
  const useActiveData = () => {
    const context = React.useContext(Context);
    return [{ ...context.state, setFormData: context.set }, context.set];
  };
  let buttonRenders = 0;
  const labelStyles: unknown[] = [];
  const Stack = ({ children, horizontal }: React.PropsWithChildren<{ horizontal?: boolean }>) => {
    if (horizontal) buttonRenders++;
    return <div>{children}</div>;
  };
  const Label = ({ children, styles }: React.PropsWithChildren<{ styles: unknown }>) => {
    labelStyles.push(styles);
    return <label>{children}</label>;
  };
  let theme = { isInverted: false, mois: { defaultCommonControlStyle: { minLabelWidth: 120 } } };
  const Component = new Function("React", "Fluent", "produce", "useActiveData", "useTheme", `${compiled}; return CompactBooleanField;`)(
    React, { Stack, Label, Text: Stack, Checkbox: Stack }, produce, useActiveData, () => theme,
  ) as React.ComponentType<any>;
  let setAnswers: (updater: any) => void;
  let latest: any;
  let disabled = false;
  const Harness = () => {
    const [state, set] = React.useState({ field: { data: { answer: null, sibling: "", pdf_answer: null } } });
    latest = state;
    setAnswers = React.useCallback((updater: any) => set(previous => produce(previous, updater)), []);
    return <Context.Provider value={{ state, set: setAnswers }}>
      <Component fieldId="answer" label="Answer" linkedFieldIds={["pdf_answer"]} disabled={disabled} />
    </Context.Provider>;
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    act(() => root.render(<Harness />));
    const initialButtons = buttonRenders;
    const initialStyle = labelStyles.at(-1);
    for (let index = 0; index < 10; index++) {
      act(() => setAnswers((draft: any) => { draft.field.data.sibling = String(index); }));
      expect(labelStyles.at(-1)).toBe(initialStyle);
    }
    expect(buttonRenders).toBe(initialButtons);
    act(() => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(latest.field.data.answer).toBe(true);
    expect(latest.field.data.pdf_answer).toBe(true);
    expect(container.querySelector("button")?.getAttribute("aria-pressed")).toBe("true");

    disabled = true;
    theme = { isInverted: true, mois: { defaultCommonControlStyle: { minLabelWidth: 180 } } };
    act(() => root.render(<Harness />));
    expect(labelStyles.at(-1)).not.toBe(initialStyle);
    expect(labelStyles.at(-1)).toMatchObject({ root: { minWidth: 180 } });
    expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
  } finally {
    act(() => root.unmount());
  }
});
