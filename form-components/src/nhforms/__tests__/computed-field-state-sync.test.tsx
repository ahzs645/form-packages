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
  const factory = new Function(
    "React",
    "TextArea",
    "useActiveData",
    `${compiled};\nreturn { ComputedField };`
  );
  return factory(React, TextArea, useActiveData).ComputedField;
}

function renderComputedField(calculationPolicy: string) {
  const ComputedField = loadComputedField();
  let currentState: any = null;
  let updateState: ((updater: any) => void) | null = null;

  const Harness = () => {
    const [state, setState] = React.useState({
      field: {
        data: { source: 10, result: null },
        status: {},
        history: [],
      },
    });
    currentState = state;
    updateState = (updater: any) => setState((previous) => (
      typeof updater === "function" ? produce(previous, updater) : updater
    ));
    return React.createElement(
      ActiveDataContext.Provider,
      { value: [state, updateState] },
      React.createElement(ComputedField, {
        fieldId: "result",
        label: "Result",
        expression: "source * 2",
        calculationPolicy,
      })
    );
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  return {
    root,
    render: async () => {
      await act(async () => root.render(React.createElement(Harness)));
    },
    getState: () => currentState,
    replaceStoredValue: async (value: unknown) => {
      await act(async () => updateState!((draft: any) => {
        draft.field.data.result = value;
      }));
    },
    setOverridden: async (overridden: boolean) => {
      await act(async () => updateState!((draft: any) => {
        draft.field.data.__computedFieldState.result.overridden = overridden;
      }));
    },
    unmount: async () => {
      await act(async () => root.unmount());
    },
  };
}

describe("ComputedField stored-value synchronization", () => {
  it("repairs a late InitialData/sourceFormData overwrite for owned calculations", async () => {
    const harness = renderComputedField("always-calculated");
    await harness.render();
    expect(harness.getState().field.data.result).toBe(20);

    await harness.replaceStoredValue(null);
    expect(harness.getState().field.data.result).toBe(20);
    await harness.unmount();
  });

  it("repairs a late seed until the user has overridden the calculation", async () => {
    const harness = renderComputedField("calculated-until-overridden");
    await harness.render();
    expect(harness.getState().field.data.result).toBe(20);

    await harness.replaceStoredValue(null);
    expect(harness.getState().field.data.result).toBe(20);

    await harness.setOverridden(true);
    await harness.replaceStoredValue(99);
    expect(harness.getState().field.data.result).toBe(99);
    await harness.unmount();
  });

  it("does not populate a suggested calculation automatically", async () => {
    const harness = renderComputedField("suggested-calculation");
    await harness.render();
    expect(harness.getState().field.data.result).toBeNull();
    await harness.unmount();
  });
});
