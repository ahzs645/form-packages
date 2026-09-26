// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

type FormData = { field: { data: Record<string, any>; status: Record<string, unknown>; history: unknown[] } };

// ---------------------------------------------------------------------------
// Engine scope: Fluent stubs. ScaleField destructures ChoiceGroup at load, so
// the stub records each render's props in a shared list the test reads back.
// ---------------------------------------------------------------------------
const h = React.createElement;
const passthrough = ({ children }: { children?: React.ReactNode }) => h("div", null, children);
let choiceRenders: Array<Record<string, any>> = [];
const Fluent = {
  Stack: passthrough,
  StackItem: passthrough,
  Label: passthrough,
  Text: passthrough,
  Separator: () => null,
  TooltipHost: passthrough,
  Dropdown: () => null,
  TextField: () => null,
  ChoiceGroup: (props: Record<string, any>) => {
    choiceRenders.push(props);
    return h("div", { "data-selected": props.selectedKey ?? "" });
  },
};

type ActiveTuple = [FormData, (updater: unknown) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{ field: { data: {}, status: {}, history: [] } }, () => undefined]);

// Kit, ScaleField, the grid (and the legacy alias) each evaluate in their own
// module scope — they all declare `const { useEffect } = React` — and later
// modules see earlier ones as bare globals, like the engine's shared scope.
function loadComponent(component: "PanelEntryGrid" | "ObservationPanelEditor"): React.ComponentType<any> {
  const names = ["ObservationValueKit", "ScaleField", "PanelEntryGrid", ...(component === "ObservationPanelEditor" ? [component] : [])];
  const scope: Record<string, unknown> = {
    window: {},
    React,
    Fluent,
    produce,
    useSourceData: () => ({ userProfile: { identity: { fullName: "Dr Test" } } }),
    useSection: () => null,
    useTheme: () => ({ semanticColors: { bodyBackground: "white", bodySubtext: "gray" } }),
    // ScaleField reads fd.field.data through a selector; PanelEntryGrid reads fd.
    useActiveData: (selector?: (fd: FormData) => unknown) => {
      const [fd, setFd] = React.useContext(ActiveDataContext);
      return [selector ? selector(fd) : fd, setFd];
    },
  };
  for (const name of names) {
    const compiled = Babel.transform(read(name), { presets: ["react"], filename: "index.jsx" }).code ?? "";
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    scope[name] = new Function(...Object.keys(scope), `${compiled};\nreturn ${name};`)(...Object.values(scope));
  }
  return scope[component] as React.ComponentType<any>;
}

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  choiceRenders = [];
});

function renderGrid(Component: React.ComponentType<any>, props: Record<string, unknown>, initial: Record<string, any> = {}) {
  let latest: FormData = { field: { data: initial, status: {}, history: [] } };
  const Host = () => {
    const [fd, setFd] = React.useState<FormData>(latest);
    latest = fd;
    const update = (updater: unknown) =>
      setFd((current) => {
        if (typeof updater === "function") return (updater as (value: FormData) => FormData)(current);
        // An uncontrolled ScaleField merges a partial field-data patch.
        return { ...current, field: { ...current.field, data: { ...current.field.data, ...(updater as object) } } };
      });
    return h(ActiveDataContext.Provider, { value: [fd, update] }, h(Component, props));
  };
  root = createRoot(document.createElement("div"));
  act(() => root!.render(h(Host)));
  return { current: () => latest };
}

const rows = [
  {
    id: "mood",
    label: "Mood",
    type: "scale",
    observationCode: "MOOD",
    options: [
      { value: 0, label: "None" },
      { value: 1, label: "Some" },
      { value: 2, label: "Lots" },
    ],
  },
  {
    id: "sleep",
    label: "Sleep",
    type: "scale",
    observationCode: "SLEEP",
    options: [
      { value: 0, label: "Good" },
      { value: 3, label: "Poor" },
    ],
  },
];
const props = {
  id: "panel",
  fieldId: "panel",
  title: "Wellbeing",
  panelCode: "WELL",
  rows,
  totals: [{ id: "total", label: "Total", sourceRowIds: ["mood", "sleep"] }],
};

// The latest render's ChoiceGroups, one per scale row in row order.
const pick = (rowIndex: number, key: string) => {
  const groups = choiceRenders.slice(-rows.length);
  act(() => groups[rowIndex].onChange({}, { key }));
};

describe("PanelEntryGrid scale rows", () => {
  for (const component of ["PanelEntryGrid", "ObservationPanelEditor"] as const) {
    it(`${component}: an unanswered scale row saves into the grid, totals and panel payload`, () => {
      const view = renderGrid(loadComponent(component), props);

      // Controlled from the first render: ScaleField writes no flat keys.
      expect(view.current().field.data).not.toHaveProperty("panel_mood");
      expect(view.current().field.data).not.toHaveProperty("panel_sleep");

      pick(0, "2");
      pick(1, "3");

      const data = view.current().field.data;
      expect(data.panel.mood).toMatchObject({ selectedKey: "2", value: 2, response: "Lots" });
      expect(data.panel.sleep).toMatchObject({ selectedKey: "3", value: 3, response: "Poor" });
      expect(data).not.toHaveProperty("panel_mood");
      expect(choiceRenders.slice(-rows.length).map((group) => group.selectedKey)).toEqual(["2", "3"]);

      const panelUpdate = data.__componentPayloads.webformUpdatesByComponent.panel.panelUpdates[0];
      expect(panelUpdate.panelName.code).toBe("WELL");
      expect(
        panelUpdate.observations.map((observation: any) => [observation.observationCode, observation.codedValue?.code ?? observation.value]),
      ).toEqual([
        ["MOOD", "2"],
        ["SLEEP", "3"],
        [undefined, 5],
      ]);
      if (component === "ObservationPanelEditor") {
        expect(data.__componentPayloads.dcoUpdatesByComponent.panel.map((update: any) => update.observationCode)).toEqual(["MOOD", "SLEEP"]);
      }
    });
  }

  it("adopts a pre-fix answer left in ScaleField's flat key without overwriting a nested one", () => {
    const view = renderGrid(loadComponent("PanelEntryGrid"), props, {
      panel_mood: { selectedKey: "1", value: 1, response: "Some" },
      panel_sleep: { selectedKey: "3", value: 3, response: "Poor" },
      panel: { sleep: { selectedKey: "0", value: 0, response: "Good" } },
    });
    const data = view.current().field.data;
    expect(data.panel.mood).toMatchObject({ selectedKey: "1", value: 1 });
    expect(data.panel.sleep).toMatchObject({ selectedKey: "0", value: 0 });
    expect(data.__componentPayloads.webformUpdatesByComponent.panel.panelUpdates[0].observations).toHaveLength(3);
  });

  it("does not adopt ScaleField's empty placeholder", () => {
    const view = renderGrid(loadComponent("PanelEntryGrid"), props, {
      panel_mood: { selectedKey: null, value: null, response: null },
    });
    expect(view.current().field.data.panel).toBeUndefined();
  });
});
