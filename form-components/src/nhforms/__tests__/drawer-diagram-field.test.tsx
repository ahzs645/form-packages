// @vitest-environment happy-dom
// DrawerDiagramField loaded through the engine's Function(...) contract with
// a stub Fluent and form-data hooks: clicks and keys on the drawing's markers
// and legend rows store answers and write-backs; image mode and signed
// records stay read-only.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { produce } from "immer";
import scene from "../../../../../vendor/drawer/public/samples/diorama/skin-assessment-library.scene.json";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const source = Babel.transform(
  readFileSync("packages/form-components/src/nhforms/DrawerDiagramField/index.jsx", "utf8"),
  { presets: ["react"] },
).code;

type State = { field: { data: Record<string, unknown> } };
const button = ({ text, onClick, disabled, ...rest }: { text: string; onClick?: () => void; disabled?: boolean; "aria-pressed"?: boolean }) =>
  React.createElement("button", { onClick, disabled, "aria-pressed": rest["aria-pressed"] }, text);
const Fluent = {
  Label: ({ children }: { children: React.ReactNode }) => React.createElement("label", null, children),
  PrimaryButton: button,
  DefaultButton: button,
  Checkbox: ({ checked, onChange, ariaLabel, disabled }: { checked: boolean; onChange: (e: unknown, c: boolean) => void; ariaLabel: string; disabled: boolean }) =>
    React.createElement("input", { type: "checkbox", checked, disabled, "aria-label": ariaLabel, onChange: (e: { target: { checked: boolean } }) => onChange(e, e.target.checked) }),
  Dropdown: () => null,
  Dialog: ({ hidden, children }: { hidden: boolean; children: React.ReactNode }) => (hidden ? null : React.createElement("div", { role: "dialog" }, children)),
  DialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
};
const DialogKit = { width: () => "960px", maxWidth: "100vw" };

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function mount(props: Record<string, unknown>, options: { signed?: boolean } = {}) {
  const ref: { state: State } = { state: { field: { data: {} } } };
  const useActiveData = () => [ref.state, (update: (s: State) => State) => { ref.state = update(ref.state); render(); }];
  const useSourceData = () => ({ webform: { recordState: options.signed ? "SIGNED" : "DRAFT" } });
  const Component = new Function("React", "Fluent", "useActiveData", "useSourceData", "produce", "DialogKit",
    `${source}; return DrawerDiagramField;`)(React, Fluent, useActiveData, useSourceData, produce, DialogKit);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const render = () => act(() => root!.render(React.createElement(Component, { fieldId: "skin", drawerDocument: scene, ...props })));
  render();
  return ref;
}

const click = (selector: string) => {
  const element = host!.querySelector(selector);
  if (!element) throw new Error(`missing ${selector}`);
  act(() => { element.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
};

describe("DrawerDiagramField", () => {
  it("marks a site from either of its markers or its legend row, with write-backs", () => {
    const ref = mount({
      siteFieldIds: { "site-06": "sacrum_marked" },
      selectedCountFieldId: "count",
      summaryFieldId: "summary",
    });
    expect(host!.querySelectorAll('[data-site-id][role="button"]').length).toBe(27 + 22);
    click('[data-callout-id="callout-seated-06"] .drawer-hit');
    expect(ref.state.field.data.skin).toMatchObject({ selectedSiteIds: ["site-06"], byFieldKey: { "skin.sacrum": true } });
    expect(ref.state.field.data.sacrum_marked).toBe(true);
    expect(ref.state.field.data.count).toBe(1);
    // the standing-pose marker of the same site now shows it as selected
    expect(host!.querySelector('[data-callout-id="callout-standing-06"]')!.getAttribute("data-selected")).toBe("true");
    click('.site-legend-row[data-site-id="site-09"]');
    expect(ref.state.field.data.summary).toBe("Sacrum; Heel");
    expect(host!.querySelector("[data-drawer-summary]")!.textContent).toContain("2 selected");
    // keyboard: Enter on a focused marker toggles it off
    const marker = host!.querySelector('[data-callout-id="callout-standing-06"]')!;
    act(() => { marker.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(ref.state.field.data.sacrum_marked).toBe(false);
    expect(ref.state.field.data.skin).toMatchObject({ selectedSiteIds: ["site-09"] });
  });

  it("single-site mode replaces the previous site", () => {
    const ref = mount({ multiple: false });
    click('.site-legend-row[data-site-id="site-01"]');
    click('.site-legend-row[data-site-id="site-02"]');
    expect(ref.state.field.data.skin).toMatchObject({ selectedSiteIds: ["site-02"] });
  });

  it("choice mode: pick a value for the clicked site", () => {
    const ref = mount({
      mode: "choice",
      valueOptions: [{ value: "stage_1", label: "Stage 1", color: "#ca8a04" }, { value: "stage_2", label: "Stage 2", color: "#ea580c" }],
      siteFieldIds: { "site-06": "sacrum_stage" },
      viewId: "field-values",
    });
    click('[data-callout-id="callout-standing-06"]');
    const picker = host!.querySelector('[data-drawer-picker="site-06"]')!;
    const stage2 = Array.from(picker.querySelectorAll("button")).find((b) => b.textContent === "Stage 2")!;
    act(() => { stage2.click(); });
    expect(ref.state.field.data.sacrum_stage).toBe("stage_2");
    expect(ref.state.field.data.skin).toMatchObject({ summary: "Sacrum (Stage 2)" });
    expect(host!.innerHTML).toMatch(/6\. Sacrum<tspan[^>]*> — Stage 2<\/tspan>/);
    expect(host!.innerHTML).toContain('stroke="#ea580c"');
    const clear = Array.from(host!.querySelectorAll('[data-drawer-picker] button')).find((b) => b.textContent === "Clear")!;
    act(() => { (clear as HTMLButtonElement).click(); });
    expect(ref.state.field.data.skin).toBeNull();
    expect(ref.state.field.data.sacrum_stage).toBe("");
  });

  it("image mode is a picture: no focus targets, nothing stored", () => {
    const ref = mount({ mode: "image", imageAlt: "Reference figure" });
    expect(host!.querySelector('[role="img"][aria-label="Reference figure"]')).not.toBeNull();
    expect(host!.querySelector('[role="button"]')).toBeNull();
    expect(host!.querySelector("[data-drawer-summary]")).toBeNull();
    expect(ref.state.field.data).toEqual({});
  });

  it("a signed record shows answers but cannot change them", () => {
    const ref = mount({ showSiteTable: true }, { signed: true });
    expect(host!.querySelector('[role="button"]')).toBeNull();
    const box = host!.querySelector('input[aria-label="Mark Sacrum"]') as HTMLInputElement;
    expect(box.disabled).toBe(true);
    expect(ref.state.field.data).toEqual({});
  });

  it("explains a missing or unreadable drawing", () => {
    mount({ drawerDocument: null });
    expect(host!.textContent).toContain("No Drawer drawing selected");
    act(() => root!.unmount());
    root = null;
    host!.remove();
    mount({ drawerDocument: { format: "drawer-scene", version: 1, id: "x" } });
    expect(host!.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("named parts of the artwork are areas: clicking the real outline selects it, groups count it", () => {
    const project = {
      format: "drawer-project",
      version: 1,
      doc: {
        id: "parts",
        name: "Hand",
        base: { inner: "", viewBox: { x: 0, y: 0, w: 200, h: 200 }, contentBox: { x: 0, y: 0, w: 200, h: 200 }, targetBoxes: {} },
        images: [{
          id: "hand", name: "Hand", x: 0, y: 0, width: 200, height: 200, rotation: 0,
          drawing: {
            inner: '<g id="fingers"><path id="thumb" d="M10 10 L40 10 L40 60 Z"/><path id="index" d="M60 10 L90 10 L90 60 Z"/></g>',
            viewBox: { x: 0, y: 0, w: 200, h: 200 }, contentBox: { x: 0, y: 0, w: 200, h: 200 },
            targetBoxes: { thumb: { x: 10, y: 10, w: 30, h: 50 }, index: { x: 60, y: 10, w: 30, h: 50 } },
          },
        }],
        anchors: [], callouts: [], views: [{ id: "v", name: "V", labelMode: "names", overrides: {} }], activeViewId: "v",
        areas: [
          { id: "thumb", label: "Thumb", imageId: "hand", shape: { kind: "part", targetId: "thumb" } },
          { id: "index", label: "Index finger", imageId: "hand", shape: { kind: "part", targetId: "index" } },
        ],
        groups: [{ id: "digits", label: "Digits", areaIds: ["thumb", "index"], siteIds: [] }],
        textAnnotations: [], drawingElements: [],
      },
    };
    const ref = mount({ drawerDocument: project, areaFieldIds: { thumb: "thumb_flag" } });
    const thumb = host!.querySelector('path#thumb[data-area-id="thumb"][role="button"]')!;
    expect(thumb).not.toBeNull();
    act(() => { thumb.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(ref.state.field.data.skin).toMatchObject({ selectedIds: ["thumb"], countsByGroup: { digits: 1 }, labelsByGroup: { digits: ["Thumb"] } });
    expect(ref.state.field.data.thumb_flag).toBe(true);
    expect(host!.querySelector("path#thumb")!.getAttribute("data-selected")).toBe("true");
    expect(host!.textContent).toContain("Digits: 1");
  });
});
