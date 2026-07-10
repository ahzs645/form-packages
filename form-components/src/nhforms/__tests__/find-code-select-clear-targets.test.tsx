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
const source = fs.readFileSync(path.join(NH, "FindCodeSelect", "index.jsx"), "utf8");

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => {}]);

let comboBoxProps: Record<string, any> | null = null;

const FluentStub = {
  ComboBox: (props: Record<string, any>) => {
    comboBoxProps = props;
    return React.createElement("div", { "data-testid": "combo-box" });
  },
};

function loadFindCodeSelect(sourceData: Record<string, unknown>): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // Same bare-global contract as the MOIS runtime.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useActiveData",
    "useSourceData",
    "useCodeList",
    "produce",
    "LayoutItem",
    `${compiled};\nreturn { FindCodeSelect };`
  );
  const useActiveData = () => React.useContext(ActiveDataContext);
  const LayoutItem = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  return factory(
    React,
    FluentStub,
    useActiveData,
    () => sourceData,
    () => [],
    produce,
    LayoutItem
  ).FindCodeSelect;
}

function renderHarness() {
  comboBoxProps = null;
  let currentState: any = null;
  const FindCodeSelect = loadFindCodeSelect({
    serviceLocations: [
      { code: "clinic-a", display: "Clinic A", healthAuthority: "Northern Health" },
    ],
  });

  const Harness: React.FC = () => {
    const [state, setState] = React.useState({
      field: {
        data: {
          location: "Old clinic",
          authority: "Old authority",
          dependentNote: "Old note",
          unrelated: "Keep me",
        },
        status: {},
        history: [],
      },
    });
    currentState = state;
    const setter = (updater: any) => setState((previous) => (
      typeof updater === "function" ? updater(previous) : updater
    ));
    return React.createElement(
      ActiveDataContext.Provider,
      { value: [state, setter] },
      React.createElement(FindCodeSelect, {
        fieldId: "location",
        lookupType: "servicelocation",
        targetFieldIds: ["location", "authority"],
        clearTargetFieldIds: ["dependentNote"],
        targetLabels: { authority: "Health Authority" },
      })
    );
  };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  return { root, getState: () => currentState };
}

describe("FindCodeSelect lookup clear targets", () => {
  it("keeps additional clear targets while selecting a lookup result", () => {
    const harness = renderHarness();

    act(() => {
      comboBoxProps?.onChange?.(null, {
        data: {
          item: { code: "clinic-a", display: "Clinic A", healthAuthority: "Northern Health" },
        },
      });
    });

    expect(harness.getState().field.data).toMatchObject({
      location: "Clinic A",
      authority: "Northern Health",
      dependentNote: "Old note",
      unrelated: "Keep me",
    });
    act(() => harness.root.unmount());
  });

  it("clears lookup and configured dependent targets on an empty selection", () => {
    const harness = renderHarness();

    act(() => {
      comboBoxProps?.onChange?.(null, null, null, "");
    });

    expect(harness.getState().field.data).toMatchObject({
      location: "",
      authority: "",
      dependentNote: "",
      unrelated: "Keep me",
    });
    act(() => harness.root.unmount());
  });
});
