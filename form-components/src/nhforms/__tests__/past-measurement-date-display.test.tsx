// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "PastMeasurementField", "index.jsx"), "utf8");

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => {}]);
let textFieldProps: Record<string, any> | null = null;

const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
const FluentStub = {
  Stack: passthrough,
  StackItem: passthrough,
  Label: passthrough,
  Link: passthrough,
  Text: passthrough,
  TextField: (props: Record<string, any>) => {
    textFieldProps = props;
    return React.createElement("input", { value: props.value, readOnly: true });
  },
};

function loadPastMeasurementField(sourceData: Record<string, unknown>): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // Same bare-global contract used by the injected NHForms runtime.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useActiveData",
    "useSourceData",
    "produce",
    "getDateTimeString",
    `${compiled};\nreturn { PastMeasurementField };`
  );
  const useActiveData = () => React.useContext(ActiveDataContext);
  return factory(
    React,
    FluentStub,
    useActiveData,
    () => sourceData,
    produce,
    (date: Date) => date.toISOString()
  ).PastMeasurementField;
}

function renderField(props: Record<string, unknown>) {
  textFieldProps = null;
  const PastMeasurementField = loadPastMeasurementField({
    patient: {
      observations: [
        {
          observationCode: "22732",
          value: 72.4,
          units: "kg",
          collectedDateTime: "2026-04-21T09:00:00",
        },
      ],
    },
  });

  const Harness: React.FC = () => {
    const [state, setState] = React.useState({ field: { data: {}, status: {}, history: [] } });
    const setter = (updater: any) => setState((previous) => (
      typeof updater === "function" ? updater(previous) : updater
    ));
    return React.createElement(
      ActiveDataContext.Provider,
      { value: [state, setter] },
      React.createElement(PastMeasurementField, {
        fieldId: "weightHistory",
        observationCode: "22732",
        historySourcePath: "patient.observations",
        autoFillFromHistory: true,
        persistenceMode: "formOnly",
        readOnly: true,
        showHistory: false,
        maxHistory: 1,
        ...props,
      })
    );
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  return { root };
}

describe("PastMeasurementField date-aspect display", () => {
  it("formats collectedDateTime and does not borrow the observation units", () => {
    const harness = renderField({
      valuePath: "collectedDateTime",
      datePath: "collectedDateTime",
      displayFormat: "date",
      showUnits: false,
    });

    expect(textFieldProps?.value).toBe("2026.04.21");
    expect(textFieldProps?.suffix).toBeUndefined();
    act(() => harness.root.unmount());
  });

  it("keeps units on measurement-value fields", () => {
    const harness = renderField({ valuePath: "value", datePath: "collectedDateTime" });

    expect(textFieldProps?.value).toBe("72.4");
    expect(textFieldProps?.suffix).toBe("kg");
    act(() => harness.root.unmount());
  });
});
