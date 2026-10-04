// @vitest-environment happy-dom
// HotspotMapField moved onto the Drawer selection surface. The legacy runtime
// (kept as lib/__tests__/fixtures/hotspot-map-field-legacy.jsx) and the new
// one are driven with the same clicks on the real homunculus joint map; the
// stored value and every write-back must match, so the CDAI/SDAI formulas
// ({{joints.countsByGroup.CDAI_SDAI}}) and saved forms keep working.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";
import homunculus from "../../../../../data/hotspot-map-library/homunculus_joint_selection.json";
import fieldFillMap from "../../../../../data/hotspot-map-library/hotspot_map_field.json";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const compile = (path: string) => Babel.transform(readFileSync(path, "utf8"), { presets: ["react"] }).code!;
const legacySource = compile("lib/__tests__/fixtures/hotspot-map-field-legacy.jsx");
const drawerSource = compile("packages/form-components/src/nhforms/DrawerDiagramField/index.jsx");
const hotspotSource = compile("packages/form-components/src/nhforms/HotspotMapField/index.jsx");

type Data = Record<string, unknown>;
type State = { field: { data: Data } };
const button = ({ text, onClick, disabled }: { text: string; onClick?: () => void; disabled?: boolean }) =>
  React.createElement("button", { onClick, disabled }, text);
const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
const Fluent = {
  Label: passthrough, Stack: passthrough, Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
  PrimaryButton: button, DefaultButton: button, Checkbox: () => null, Dropdown: () => null,
  Dialog: ({ hidden, children }: { hidden: boolean; children: React.ReactNode }) => (hidden ? null : React.createElement("div", { role: "dialog" }, children)),
  DialogFooter: passthrough, DialogType: { largeHeader: 1 },
};
const DialogKit = { width: () => "760px", maxWidth: "100vw" };

let roots: Array<{ root: Root; host: HTMLElement }> = [];
afterEach(() => {
  for (const { root, host } of roots) {
    act(() => root.unmount());
    host.remove();
  }
  roots = [];
});

function mount(which: "legacy" | "drawer", props: Record<string, unknown>, initial: Data = {}) {
  const ref: { state: State } = { state: { field: { data: structuredClone(initial) } } };
  let render = () => {};
  const setFormData = (update: (s: State) => State) => { ref.state = update(ref.state); render(); };
  const useActiveData = () => [{ ...ref.state, setFormData }, setFormData];
  const useSourceData = () => ({ webform: { recordState: "DRAFT" } });
  const useTheme = () => ({ isInverted: false });
  let Component: React.ComponentType<Record<string, unknown>>;
  if (which === "legacy") {
    Component = new Function("React", "Fluent", "useActiveData", "useTheme", "produce", "DialogKit",
      `${legacySource};\nreturn HotspotMapField;`)(
      React, Fluent, useActiveData, useTheme, produce, DialogKit);
  } else {
    Component = new Function("React", "Fluent", "useActiveData", "useSourceData", "useTheme", "produce", "DialogKit",
      `${drawerSource};\n${hotspotSource};\nreturn HotspotMapField;`)(React, Fluent, useActiveData, useSourceData, useTheme, produce, DialogKit);
  }
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push({ root, host });
  render = () => act(() => root.render(React.createElement(Component, { fieldId: "joints", ...props })));
  render();
  return { ref, host };
}

const settings = homunculus.settings as unknown as Record<string, unknown> & { hotspots: Array<{ id: string; label: string }> };
const baseProps = {
  ...settings,
  label: "Swollen joints",
  totalCountFieldId: "joint_total",
  selectedIdsFieldId: "joint_ids",
  selectedLabelsFieldId: "joint_labels",
  hotspots: settings.hotspots.map((h, i) => (i < 3 ? { ...h, fieldId: `flag_${h.id}` } : h)),
};

function clickLegacy(host: HTMLElement, label: string) {
  const g = [...host.querySelectorAll('g[role="button"]')].find((el) => el.querySelector("title")?.textContent === label);
  if (!g) throw new Error(`legacy hotspot ${label} not found`);
  act(() => { g.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}
function clickDrawer(host: HTMLElement, id: string) {
  const el = host.querySelector(`[data-area-id="${id}"][role="button"]`);
  if (!el) throw new Error(`hotspot area ${id} not found`);
  act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}
const withoutTime = (data: Data) => {
  const copy = structuredClone(data);
  if (copy.joints && typeof copy.joints === "object") delete (copy.joints as Data).updatedAt;
  return copy;
};

describe("HotspotMapField on the Drawer surface matches the legacy runtime", () => {
  const picks = [settings.hotspots[0], settings.hotspots[5], settings.hotspots[20], settings.hotspots[40], settings.hotspots[2]];

  it("same stored value, CDAI counts and write-backs for a click sequence (multi-select)", () => {
    const legacy = mount("legacy", baseProps);
    const drawer = mount("drawer", baseProps);
    const sequence = [...picks, picks[1]]; // the last click deselects
    for (const h of sequence) {
      clickLegacy(legacy.host, h.label);
      clickDrawer(drawer.host, h.id);
      expect(withoutTime(drawer.ref.state.field.data)).toEqual(withoutTime(legacy.ref.state.field.data));
    }
    const value = drawer.ref.state.field.data.joints as { countsByGroup: Record<string, number>; selectedCount: number };
    expect(value.selectedCount).toBe(4);
    expect(Object.keys(value.countsByGroup)).toEqual(["CDAI_SDAI"]);
  });

  it("single select replaces, and a repeat click clears to an unanswered field", () => {
    const props = { ...baseProps, allowMultiSelect: false };
    const legacy = mount("legacy", props);
    const drawer = mount("drawer", props);
    for (const h of [picks[0], picks[1], picks[1]]) {
      clickLegacy(legacy.host, h.label);
      clickDrawer(drawer.host, h.id);
      expect(withoutTime(drawer.ref.state.field.data)).toEqual(withoutTime(legacy.ref.state.field.data));
    }
    expect(drawer.ref.state.field.data.joints).toBeNull();
  });

  it("reopens a value saved by the legacy runtime and keeps editing it the same way", () => {
    const legacy = mount("legacy", baseProps);
    for (const h of picks) clickLegacy(legacy.host, h.label);
    const saved = structuredClone(legacy.ref.state.field.data);
    const drawer = mount("drawer", baseProps, saved);
    expect([...drawer.host.querySelectorAll('[data-area-id][data-selected="true"]')].map((el) => el.getAttribute("data-area-id")).sort())
      .toEqual(picks.map((h) => h.id).sort());
    clickLegacy(legacy.host, picks[3].label);
    clickDrawer(drawer.host, picks[3].id);
    expect(withoutTime(drawer.ref.state.field.data)).toEqual(withoutTime(legacy.ref.state.field.data));
  });

  it("keeps annotations saved by the legacy runtime (percent coordinates) when they are edited", () => {
    const annotations = [
      { id: "a1", type: "symbol", x: 40, y: 30, symbol: "triangle", color: "#ef4444", size: 2.2 },
      { id: "a2", type: "stroke", points: [{ x: 10, y: 10 }, { x: 20, y: 25 }, { x: 30, y: 20 }], color: "#2563eb", size: 3 },
      { id: "a3", type: "symbol", x: 70, y: 80, symbol: "x", color: "#ef4444", size: 2.2 },
    ];
    const props = { ...baseProps, interactionMode: "symbol_draw" };
    const drawer = mount("drawer", props, { joints: { selectedIds: [], annotations, annotationCount: 3 } });
    expect(drawer.host.querySelectorAll(".drawer-mark")).toHaveLength(3);
    const undo = [...drawer.host.querySelectorAll("button")].find((b) => b.textContent === "Undo mark")!;
    act(() => { undo.click(); });
    const stored = drawer.ref.state.field.data.joints as { annotations: Array<Record<string, unknown>>; annotationCount: number; selectedCount: number };
    expect(stored.annotationCount).toBe(2);
    expect(stored.selectedCount).toBe(0);
    for (const [i, a] of stored.annotations.entries()) {
      const original = annotations[i] as Record<string, unknown>;
      expect(a.type).toBe(original.type);
      expect(a.size).toBeCloseTo(original.size as number, 6);
      if (a.type === "symbol") {
        expect(a.x).toBeCloseTo(original.x as number, 6);
        expect(a.y).toBeCloseTo(original.y as number, 6);
      } else {
        (a.points as Array<{ x: number; y: number }>).forEach((p, k) => {
          const o = (original.points as Array<{ x: number; y: number }>)[k];
          expect(p.x).toBeCloseTo(o.x, 6);
          expect(p.y).toBeCloseTo(o.y, 6);
        });
      }
    }
  });

  it("renders the Illustrator artwork with its stylesheet fills inlined", () => {
    const drawer = mount("drawer", baseProps);
    const svg = drawer.host.querySelector("[data-drawer-diagram] svg")!.outerHTML;
    expect(svg).not.toMatch(/<style>\s*\.cls/);
    expect(svg).toMatch(/style="[^"]*fill: ?(#fff|rgb\(255, 255, 255\)|white)/i);
  });

  it("field-fill maps: number boxes write the same values and fill the picture's text layers", () => {
    const props: Record<string, unknown> = { ...(fieldFillMap.settings as Record<string, unknown>), label: "Pain scores" };
    const fields = (props.numberFields as Array<{ id: string; fieldId: string }>);
    const legacy = mount("legacy", props);
    const drawer = mount("drawer", props);
    const type = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    const legacyInputs = [...legacy.host.querySelectorAll("input")] as HTMLInputElement[];
    expect(legacyInputs).toHaveLength(fields.length);
    for (const [i, nf] of fields.slice(0, 3).entries()) {
      type(legacyInputs[i], String(i + 4));
      type(drawer.host.querySelector(`[data-drawer-input="${nf.id}"] input`) as HTMLInputElement, String(i + 4));
    }
    expect(drawer.ref.state.field.data).toEqual(legacy.ref.state.field.data);
    const svg = drawer.host.querySelector("[data-drawer-diagram] svg")!.innerHTML;
    for (const [i, nf] of fields.slice(0, 3).entries()) {
      expect(svg).toMatch(new RegExp(`id="${nf.id}"[^>]*>(?:<tspan[^>]*>)?${i + 4}<`));
    }
    // untouched layers show the placeholder, as before
    expect(svg).toMatch(new RegExp(`id="${fields[5].id}"[^>]*>(?:<tspan[^>]*>)?#<`));
  });
});
