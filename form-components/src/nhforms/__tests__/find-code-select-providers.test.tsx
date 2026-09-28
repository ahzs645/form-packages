// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";

/**
 * FindCodeSelect's provider-directory mode, the MOIS side of the neutral
 * provider answer type: the options are the engine's provider directory
 * (`useSourceData().useAppSettings().providers`, filtered by providerType as
 * MOIS's own Provider control filters it), and the saved answer is the
 * Coding the engine uses for a provider default.
 */

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

const PROVIDERS = [
  { providerId: 500045, name: "SMITH, JOHN", providerType: "PROVIDER" },
  { providerId: 700001, name: "NORTHERN CLINIC", providerType: "ORGANIZATION" },
  // The preview's sample list states no type; it is kept.
  { providerId: 500046, name: "JONES, MARY" },
];

function load(providers: unknown[]): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React", "Fluent", "useActiveData", "useSourceData", "useCodeList", "useTheme", "produce", "LayoutItem",
    `${compiled};\nreturn { FindCodeSelect };`
  );
  const useActiveData = () => React.useContext(ActiveDataContext);
  const LayoutItem = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  const sourceData = { useAppSettings: () => ({ providers }) };
  return factory(
    React,
    FluentStub,
    useActiveData,
    () => sourceData,
    () => [],
    () => ({ mois: { requiredBackground: "#fff4ce" } }),
    produce,
    LayoutItem
  ).FindCodeSelect;
}

function render(props: Record<string, unknown>, data: Record<string, unknown> = {}) {
  comboBoxProps = null;
  let current: any = null;
  const FindCodeSelect = load(PROVIDERS);
  const Harness: React.FC = () => {
    const [state, setState] = React.useState({ field: { data: { ...data }, status: {}, history: [] } });
    current = state;
    const setter = (updater: any) => setState((previous) => (typeof updater === "function" ? updater(previous) : previous));
    return React.createElement(ActiveDataContext.Provider, { value: [state, setter] }, React.createElement(FindCodeSelect, props));
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  return { root, data: () => current.field.data };
}

describe("FindCodeSelect provider directory", () => {
  it("offers the engine's providers of the requested type", () => {
    const harness = render({ fieldId: "attending", label: "Attending", providerType: "PROVIDER" });
    const texts = (comboBoxProps?.options ?? []).map((option: { text: string }) => option.text);
    expect(texts).toEqual(["SMITH, JOHN", "JONES, MARY"]);
    expect(comboBoxProps?.placeholder).toBe("Search for a provider");
    act(() => harness.root.unmount());
  });

  it("saves the provider as { code: providerId, display: name, system: MOIS-PROVIDERS }", () => {
    const harness = render({ fieldId: "attending", label: "Attending", providerType: "PROVIDER" });
    const option = comboBoxProps?.options.find((entry: { text: string }) => entry.text === "SMITH, JOHN");
    act(() => comboBoxProps?.onChange?.(null, option));
    expect(harness.data().attending).toEqual({ code: "500045", display: "SMITH, JOHN", system: "MOIS-PROVIDERS" });
    act(() => harness.root.unmount());
  });

  it("shows a saved provider as selected", () => {
    const harness = render(
      { fieldId: "attending", providerType: "PROVIDER" },
      { attending: { code: "500046", display: "JONES, MARY", system: "MOIS-PROVIDERS" } }
    );
    expect(comboBoxProps?.selectedKey).toBe("500046");
    act(() => harness.root.unmount());
  });
});
