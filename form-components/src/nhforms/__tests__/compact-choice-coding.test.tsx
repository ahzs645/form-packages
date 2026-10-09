// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Answer buttons (a builder choice with choiceStyle "buttons") save the coding
// SimpleCodeChecklist's radio list saves, so readers see the same answer.
it("saves answer buttons as a coding and reads one back", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "packages/form-components/src/nhforms/CompactBooleanField/index.jsx"), "utf8");
  const compiled = Babel.transform(source, { presets: ["react"] }).code ?? "";
  const Context = React.createContext<any>(null);
  const useActiveData = () => {
    const context = React.useContext(Context);
    return [{ ...context.state, setFormData: context.set }, context.set];
  };
  const Plain = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const Label = ({ children }: React.PropsWithChildren) => <label>{children}</label>;
  const Component = new Function("React", "Fluent", "produce", "useActiveData", "useTheme", `${compiled}; return CompactChoiceField;`)(
    React, { Stack: Plain, Label, Text: Plain, Checkbox: Plain }, produce, useActiveData, () => ({ isInverted: false }),
  ) as React.ComponentType<any>;
  let latest: any;
  const Harness = ({ allowDeselect }: { allowDeselect?: boolean }) => {
    const [state, set] = React.useState({ field: { data: { result: { code: "defect", display: "Defect" } } } });
    latest = state;
    const setAnswers = React.useCallback((updater: any) => set((previous) => produce(previous, updater)), []);
    return <Context.Provider value={{ state, set: setAnswers }}>
      <Component fieldId="result" label="Result" valueShape="coding" codeSystem="NH-RESULT" allowDeselect={allowDeselect}
        optionList={[{ key: "pass", text: "Pass" }, { key: "defect", text: "Defect" }]} />
    </Context.Provider>;
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("button")];
  try {
    act(() => root.render(<Harness />));
    // A saved coding is selected by its code.
    expect(buttons().map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
    act(() => buttons()[0].click());
    expect(latest.field.data.result).toEqual({ code: "pass", display: "Pass", system: "NH-RESULT" });
    expect(buttons()[0].getAttribute("aria-pressed")).toBe("true");
    // Pressing the chosen answer again clears it back to blank, as a Yes/No does.
    act(() => buttons()[0].click());
    expect(latest.field.data.result).toBeNull();
  } finally {
    act(() => root.unmount());
  }
});
