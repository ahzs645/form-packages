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
import { produce } from "immer";

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "ConditionalGroup", "index.jsx"), "utf8");

const FluentStub = new Proxy(
  {},
  {
    get: () => (props: { children?: React.ReactNode }) => React.createElement("div", null, props.children),
  }
);

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => {}]);

function loadConditionalField(): React.ComponentType<any> {
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
  return factory(React, FluentStub, useActiveData, () => ({}), produce).ConditionalField;
}

function makeInitialState() {
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

function renderHarness(ConditionalField: React.ComponentType<any>) {
  let currentState: any = null;
  let setter: ((updater: any) => void) | null = null;

  const Harness: React.FC = () => {
    const [state, setState] = React.useState(makeInitialState);
    currentState = state;
    // Real MOIS hands back the RAW React setter; components produce()-wrap recipes.
    setter = (updater: any) => setState((prev: any) => (typeof updater === "function" ? updater(prev) : updater));
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
    root,
    getState: () => currentState,
    setActiveData: (updater: any) => act(() => setter!(updater)),
  };
}

describe("ConditionalField staged-payload withdrawal", () => {
  it("keeps the child and payload while the controller matches", () => {
    const ConditionalField = loadConditionalField();
    const harness = renderHarness(ConditionalField);

    expect(harness.container.querySelector("[data-testid='gated-child']")).not.toBeNull();
    expect(harness.getState().field.data.__componentPayloads.dcoUpdatesByComponent.veteranServiceCategory).toBeTruthy();
    harness.root.unmount();
  });

  it("clears ONLY the hidden field's staged payload when the controller flips", () => {
    const ConditionalField = loadConditionalField();
    const harness = renderHarness(ConditionalField);

    harness.setActiveData(
      produce((draft: any) => {
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
    harness.root.unmount();
  });

  it("does not loop or crash when hidden with nothing staged", () => {
    const ConditionalField = loadConditionalField();
    const harness = renderHarness(ConditionalField);

    harness.setActiveData(
      produce((draft: any) => {
        draft.field.data.veteranStatus = { code: "N" };
      })
    );
    // Second unrelated update while still hidden — effect must stay a no-op.
    harness.setActiveData(
      produce((draft: any) => {
        draft.field.data.somethingElse = "x";
      })
    );
    const payloads = harness.getState().field.data.__componentPayloads.dcoUpdatesByComponent;
    expect(payloads.veteranServiceCategory).toBeUndefined();
    expect(harness.getState().field.data.somethingElse).toBe("x");
    harness.root.unmount();
  });
});
