// @vitest-environment happy-dom
/**
 * ConditionalField must withdraw a hidden field's STAGED chart writes.
 *
 * Observation-writing components stage payloads under
 * fd.field.data.__componentPayloads.dcoUpdatesByComponent[<fieldId>]; when a
 * link rule hides the field the child unmounts and can no longer clear its
 * own entry, so the (still-mounted) ConditionalField wrapper deletes it.
 * Legacy parity: homecare_admission only wrote the veteran-category obs when
 * veteranStatus === "Y" at submit (makeObsUpdatesFromVs condition arg).
 *
 * The component source is transpiled and executed the same way MOIS runs it
 * (bare React/Fluent/useActiveData/produce globals).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce, type Draft } from "immer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "ConditionalGroup", "index.jsx"), "utf8");

const FluentStub = new Proxy(
  {},
  {
    get: () => (props: { children?: React.ReactNode }) => React.createElement("div", null, props.children),
  }
);

interface CodeAnswer {
  code: string;
  display?: string;
  system?: string;
}

interface ChartPayload {
  observationCode: string;
  value: string;
  description?: string;
}

interface ComponentPayloads {
  dcoUpdatesByComponent: Record<string, ChartPayload[]>;
  webformUpdatesByComponent?: Record<string, unknown>;
}

interface FieldData extends Record<string, unknown> {
  veteranStatus?: CodeAnswer;
  veteranServiceCategory?: CodeAnswer;
  somethingElse?: string;
  __componentPayloads: ComponentPayloads;
}

interface ActiveData {
  field: {
    data: FieldData;
    status: Record<string, unknown>;
    history: unknown[];
  };
}

type ActiveTuple = [ActiveData, React.Dispatch<React.SetStateAction<ActiveData>>];

interface ConditionalFieldProps {
  fieldId?: string;
  mode?: string;
  controllerFieldId?: string;
  optionValues?: string[];
  hiddenAnswerPolicy?: "preserve" | "clear";
  children?: React.ReactNode;
}

const ActiveDataContext = React.createContext<ActiveTuple>([makeInitialState(), () => undefined]);

function loadConditionalField(): React.ComponentType<ConditionalFieldProps> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // Same bare-global contract as the MOIS runtime: React/Fluent/useActiveData/produce.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useActiveData",
    "useSourceData",
    "produce",
    `${compiled};\nreturn { ConditionalField };`
  );
  const useActiveData = () => React.useContext(ActiveDataContext);
  const loaded = factory(React, FluentStub, useActiveData, () => ({}), produce) as {
    ConditionalField: React.ComponentType<ConditionalFieldProps>;
  };
  return loaded.ConditionalField;
}

function makeInitialState(): ActiveData {
  return {
    field: {
      data: {
        veteranStatus: { code: "Y", display: "Yes", system: "VALUESET:YES.NO.NOTASKED" },
        veteranServiceCategory: { code: "B", display: "Category B" },
        __componentPayloads: {
          dcoUpdatesByComponent: {
            veteranServiceCategory: [
              { observationCode: "84706", value: "B", description: "Veteran Status Category" },
            ],
            unrelatedField: [{ observationCode: "99999", value: "X" }],
          },
        },
      },
      status: {},
      history: [],
    },
  };
}

function renderHarness(
  ConditionalField: React.ComponentType<ConditionalFieldProps>,
  hiddenAnswerPolicy: ConditionalFieldProps["hiddenAnswerPolicy"] = "preserve"
) {
  let currentState: ActiveData | null = null;
  let setter: React.Dispatch<React.SetStateAction<ActiveData>> | null = null;

  const Harness: React.FC = () => {
    const [state, setState] = React.useState(makeInitialState);
    currentState = state;
    // Real MOIS hands back the RAW React setter; components produce()-wrap recipes.
    setter = setState;
    return React.createElement(
      ActiveDataContext.Provider,
      { value: [state, setter] },
      React.createElement(
        ConditionalField,
        {
          fieldId: "veteranServiceCategory",
          mode: "controller",
          controllerFieldId: "veteranStatus",
          optionValues: ["Y"],
          hiddenAnswerPolicy,
        },
        React.createElement("span", { "data-testid": "gated-child" }, "Category picker")
      )
    );
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(React.createElement(Harness));
  });
  return {
    container,
    unmount: () => act(() => root.unmount()),
    getState: () => {
      if (!currentState) throw new Error("Harness did not render");
      return currentState;
    },
    setActiveData: (updater: React.SetStateAction<ActiveData>) => act(() => setter!(updater)),
  };
}

describe("ConditionalField hidden-field handling", () => {
  it("keeps the child and payload while the controller matches", () => {
    const ConditionalField = loadConditionalField();
    const harness = renderHarness(ConditionalField);

    expect(harness.container.querySelector("[data-testid='gated-child']")).not.toBeNull();
    expect(harness.getState().field.data.__componentPayloads.dcoUpdatesByComponent.veteranServiceCategory).toBeTruthy();
    harness.unmount();
  });

  it("clears ONLY the hidden field's staged payload when the controller flips", () => {
    const ConditionalField = loadConditionalField();
    const harness = renderHarness(ConditionalField);

    harness.setActiveData(
      produce((draft: Draft<ActiveData>) => {
        draft.field.data.veteranStatus = { code: "N", display: "No", system: "VALUESET:YES.NO.NOTASKED" };
      })
    );

    // Child unmounted…
    expect(harness.container.querySelector("[data-testid='gated-child']")).toBeNull();
    const payloads = harness.getState().field.data.__componentPayloads.dcoUpdatesByComponent;
    // …its staged obs write withdrawn…
    expect(payloads.veteranServiceCategory).toBeUndefined();
    // …other components' staged writes untouched (page-parity guarantee).
    expect(payloads.unrelatedField).toEqual([{ observationCode: "99999", value: "X" }]);
    // The field VALUE survives (legacy kept formdata too; only the write is withdrawn).
    expect(harness.getState().field.data.veteranServiceCategory).toEqual({ code: "B", display: "Category B" });
    harness.unmount();
  });

  it("clears the hidden field value when the clear policy is selected", () => {
    const ConditionalField = loadConditionalField();
    const harness = renderHarness(ConditionalField, "clear");

    harness.setActiveData(
      produce((draft: Draft<ActiveData>) => {
        draft.field.data.veteranStatus = { code: "N", display: "No", system: "VALUESET:YES.NO.NOTASKED" };
      })
    );

    expect(harness.getState().field.data.veteranServiceCategory).toBeUndefined();
    expect(harness.getState().field.data.__componentPayloads.dcoUpdatesByComponent.unrelatedField).toEqual([
      { observationCode: "99999", value: "X" },
    ]);
    harness.unmount();
  });

  it("does not loop or crash when hidden with nothing staged", () => {
    const ConditionalField = loadConditionalField();
    const harness = renderHarness(ConditionalField);

    harness.setActiveData(
      produce((draft: Draft<ActiveData>) => {
        draft.field.data.veteranStatus = { code: "N" };
      })
    );
    // Second unrelated update while still hidden — effect must stay a no-op.
    harness.setActiveData(
      produce((draft: Draft<ActiveData>) => {
        draft.field.data.somethingElse = "x";
      })
    );
    const payloads = harness.getState().field.data.__componentPayloads.dcoUpdatesByComponent;
    expect(payloads.veteranServiceCategory).toBeUndefined();
    expect(harness.getState().field.data.somethingElse).toBe("x");
    harness.unmount();
  });
});
