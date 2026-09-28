// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";

import babyBirthEvent from "@/data/importable-dynamic-forms/baby_birth_event.json";
import { previewJorgUnits, previewServiceLocations } from "@/lib/mois-runtime/mock-data/jorg-lookups";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/*
 * Baby Birth Event's two "..." lookups as the webform runs them (MOIS window
 * 1700, 2026-09-28 captures): the JORG List fills Health Authority / HSDA /
 * Branch / SDL; a service location with no JORG unit empties all four.
 */

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "FindCodeSelect", "index.jsx"), "utf8");

type ActiveTuple = [any, (updater: any) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => {}]);
const combos = new Map<string, Record<string, any>>();

function loadFindCodeSelect(sourceData: Record<string, unknown>): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React", "Fluent", "useActiveData", "useSourceData", "useCodeList", "useTheme", "produce", "LayoutItem",
    `${compiled};\nreturn { FindCodeSelect };`
  );
  const Fluent = {
    ComboBox: (props: Record<string, any>) => {
      combos.set(props.id, props);
      return null;
    },
  };
  const LayoutItem = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  return factory(
    React, Fluent, () => React.useContext(ActiveDataContext), () => sourceData, () => [],
    () => ({ mois: { requiredBackground: "#fff4ce" } }), produce, LayoutItem,
  ).FindCodeSelect;
}

const fieldProps = (id: string) => (babyBirthEvent.builderFields as Array<{ id: string; componentProps?: Record<string, unknown> }>)
  .find((field) => field.id === id)!.componentProps!;
const HA = "s1701_str_field_99001";
const LOCATION = "s1701_str_field_27017";
const JORG_FIELDS = [HA, "s1701_str_field_99002", "s1701_str_field_99003", "s1701_str_field_99004"];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  combos.clear();
});

function renderLookups() {
  const FindCodeSelect = loadFindCodeSelect({ jorg: previewJorgUnits, serviceLocations: previewServiceLocations });
  let current: any = null;
  const Harness = () => {
    const [state, setState] = React.useState({ field: { data: {}, status: {}, history: [] } });
    current = state;
    const setter = (updater: any) => setState((previous) => (typeof updater === "function" ? updater(previous) : updater));
    return React.createElement(ActiveDataContext.Provider, { value: [state, setter] },
      React.createElement(FindCodeSelect, fieldProps(LOCATION)),
      React.createElement(FindCodeSelect, fieldProps(HA)));
  };
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root!.render(React.createElement(Harness)));
  const pick = (id: string, match: RegExp) => {
    const option = combos.get(id)!.options.find((entry: { text: string }) => match.test(entry.text));
    act(() => combos.get(id)!.onChange(null, option));
  };
  const values = () => [LOCATION, ...JORG_FIELDS].map((id) => current.field.data[id]);
  return { pick, values };
}

describe("Baby Birth Event JORG and service location lookups", () => {
  it("lists the preview rows and fills the four JORG fields from a pick", () => {
    const { pick, values } = renderLookups();
    expect(combos.get(HA)!.options).toHaveLength(previewJorgUnits.length);
    expect(combos.get(HA)!.allowFreeform).toBe(false);
    pick(HA, /MACKENZIE \/ MACKENZIE/);
    expect(values()).toEqual([undefined, "NORTHERN HEALTH", "NORTHERN INTERIOR", "MACKENZIE", "MACKENZIE"]);
    // Health Authority keeps only the authority, yet still shows the row picked
    expect(combos.get(HA)!.selectedKey).toBe("NORTHERN HEALTH|NORTHERN INTERIOR|MACKENZIE|MACKENZIE");
  });

  it("empties the JORG fields when a location with no JORG unit is chosen", () => {
    const { pick, values } = renderLookups();
    pick(HA, /QUESNEL \/ QUESNEL/);
    pick(LOCATION, /RENAL-BULKLEY/);
    expect(values()).toEqual(["RENAL-BULKLEY KCC - AC", "", "", "", ""]);
    // null, not undefined: Fluent keeps an uncontrolled pick on screen
    expect(combos.get(HA)!.selectedKey).toBeNull();
    expect(combos.get(LOCATION)!.selectedKey).toBe("RENAL-BULKLEY KCC - AC");
  });
});
