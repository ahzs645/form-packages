// @vitest-environment happy-dom
// Signature cells: SignaturePad's controlled and cell presentations, drawn by
// EditableTable (through FieldKit) and LayoutTable. An inline cell shows Sign
// (a thumbnail once signed) and opens a pad-only DialogKit dialog; the modal
// row dialog draws the pad; summaries, print mirrors and read-only cells show
// the image. The answer is { dataUrl, isEmpty: false }, null when cleared.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import { produce } from "immer";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");
type AnyProps = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKAAAAAASUVORK5CYII=";
const SIGNED = { dataUrl: PNG, isEmpty: false };

// happy-dom has no 2D canvas: a context whose every method is a no-op, and a
// canvas that exports the test PNG.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
beforeAll(() => {
  const context = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, property) => (property in target ? target[property] : () => undefined),
    set: (target, property, value) => {
      target[property] = value;
      return true;
    },
  });
  HTMLCanvasElement.prototype.getContext = (() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = () => PNG;
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
});

// ---------------------------------------------------------------------------
// Minimal engine scope
// ---------------------------------------------------------------------------
const h = React.createElement;
const Box = ({ children }: AnyProps) => h("div", null, children);
const Text = ({ children }: AnyProps) => h("span", null, children);
const Label = ({ children }: AnyProps) => h("label", null, children);
const Button = ({ text, onClick, disabled, title, ariaLabel }: AnyProps) =>
  h("button", { type: "button", onClick, disabled, title, "aria-label": ariaLabel }, text ?? title);
const Field = (props: AnyProps) => h("input", { value: props.value == null ? "" : String(props.value), readOnly: true, "data-field": props.label });
const SubForm = ({ hidden, label, children }: AnyProps) => (hidden ? null : h("div", { role: "dialog" }, h("h2", null, label), children));
const Fluent = {
  Stack: Box, Label, Text, IconButton: Button, DefaultButton: Button, PrimaryButton: Button,
  TooltipHost: Box, Checkbox: Field,
};

type ActiveTuple = [Record<string, unknown>, (updater: unknown) => void];
const ActiveDataContext = React.createContext<ActiveTuple>([{}, () => undefined]);

// The export wraps each component in its own scope; SignaturePad's own React
// destructure would otherwise collide with EditableTable's.
const source = (name: string) => name === "SignaturePad"
  ? `var SignaturePad = (() => {\n${read(name)}\nreturn SignaturePad\n})();`
  : read(name);

function loadRuntime(names: string[], useActiveData: () => unknown, exports: string) {
  const compiled = Babel.transform(`var EditableTable;\n${names.map(source).join("\n")}`, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const scope: Record<string, unknown> = {
    window, React, Fluent, produce, useActiveData,
    useTheme: () => ({}), useSourceData: () => ({}), useSection: () => null,
    TextArea: Field, Numeric: Field, DateSelect: Field, DateTimeSelect: Field, TimeSelect: Field,
    SimpleCodeSelect: Field, SimpleCodeChecklist: Field, OptionChoice: Field,
    SubForm, ButtonBar: Box,
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compiled};\nreturn { ${exports} };`)(...Object.values(scope)) as AnyProps;
}

// EditableTable writes the whole form data through fd.setFormData (a recipe).
const tableRuntime = loadRuntime(
  ["ValueKit", "FormulaKit", "FormLogicKit", "FieldKit", "DialogKit", "SignaturePad", "EditableTable"],
  () => {
    const [state, setState] = React.useContext(ActiveDataContext);
    return [{ ...state, setFormData: setState }, setState];
  },
  "EditableTable, SignaturePad",
);
// LayoutTable writes one answer as a partial object, as the real engine's setter.
const layoutRuntime = loadRuntime(
  ["ValueKit", "FormLogicKit", "DialogKit", "SignaturePad", "LayoutTable"],
  () => React.useContext(ActiveDataContext),
  "LayoutTable",
);

let root: Root | null = null;
let container: HTMLElement | null = null;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function mount(element: () => React.ReactElement, initial: Record<string, unknown>, shape: "form" | "section") {
  let state: Record<string, unknown> = shape === "form" ? { field: { data: initial, status: {}, history: [] } } : initial;
  const Harness = () => {
    const [current, set] = React.useState(state);
    state = current;
    const setState = (updater: unknown) => set((previous) => {
      if (typeof updater === "function") return produce(previous, updater as (draft: unknown) => void);
      return shape === "section" ? { ...previous, ...(updater as object) } : (updater as typeof previous);
    });
    return h(ActiveDataContext.Provider, { value: [current, setState] }, element());
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(h(Harness)));
  const buttons = () => Array.from(container!.querySelectorAll("button"));
  return {
    data: () => (shape === "form" ? (state.field as { data: Record<string, unknown> }).data : state),
    button: (text: string) => buttons().find((entry) => entry.textContent === text || entry.getAttribute("aria-label") === text),
    dialog: () => container!.querySelector("[role=dialog]"),
    click: async (element: Element | null | undefined) => {
      expect(element).toBeTruthy();
      await act(async () => (element as HTMLElement).click());
    },
    // One stroke on the dialog's (or form's) pad: pointer down, move, up.
    draw: async () => {
      const canvas = container!.querySelector("canvas");
      expect(canvas).toBeTruthy();
      const init = { bubbles: true, cancelable: true, isPrimary: true, buttons: 1, button: 0, pointerId: 1, pointerType: "mouse" };
      await act(async () => {
        canvas!.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: 5, clientY: 5 }));
        window.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: 40, clientY: 20 }));
        window.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0, clientX: 60, clientY: 25 }));
      });
    },
  };
}

const COLUMNS = [
  { id: "name", title: "Clinician", type: "text" },
  { id: "signedBy", title: "Signature", type: "signature" },
];

describe("EditableTable signature columns", () => {
  it("signs an inline cell in a pad-only dialog: Cancel keeps the cell, Save stores the image, Clear stores null", async () => {
    const view = await mount(() => h(tableRuntime.EditableTable, { id: "visits", mode: "inline", columns: COLUMNS, maxRows: 5, initialRows: 1 }), {
      visits: [{ _rowId: "r1", name: "Dr. Lee", signedBy: null }],
    }, "form");
    expect(view.dialog()).toBeNull();

    await view.click(view.button("Sign"));
    const dialog = view.dialog()!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Signature");
    expect(Array.from(dialog.querySelectorAll("button")).map((button) => button.textContent)).toEqual(["Save", "Clear", "Cancel"]);
    expect(dialog.querySelectorAll("canvas")).toHaveLength(1);
    // Only the pad: no other question is drawn in the signature dialog.
    expect(dialog.querySelectorAll("input")).toHaveLength(0);

    await view.draw();
    await view.click(view.button("Cancel"));
    expect(view.dialog()).toBeNull();
    expect((view.data().visits as AnyProps[])[0].signedBy).toBeNull();

    await view.click(view.button("Sign"));
    await view.draw();
    await view.click(view.button("Save"));
    expect(view.dialog()).toBeNull();
    expect((view.data().visits as AnyProps[])[0].signedBy).toEqual(SIGNED);
    // Signed: the cell shows the thumbnail, and its print mirror the image.
    expect(container!.querySelector("[data-signature-thumbnail]")?.getAttribute("src")).toBe(PNG);
    expect(container!.querySelector(".showonprint [data-signature-image]")?.getAttribute("src")).toBe(PNG);

    await view.click(view.button("Change signature"));
    await view.click(view.button("Clear"));
    await view.click(view.button("Save"));
    expect((view.data().visits as AnyProps[])[0].signedBy).toBeNull();
    expect(view.button("Sign")).toBeTruthy();
  });

  it("draws the pad in the modal row dialog (not the subform editor) and the image in the summary", async () => {
    const view = await mount(() => h(tableRuntime.EditableTable, { id: "visits", mode: "modal", columns: COLUMNS, maxRows: 5, modalEditorConfig: {} }), {
      visits: [{ _rowId: "r1", name: "Dr. Lee", signedBy: SIGNED }],
    }, "form");
    const summaryImage = container!.querySelector("td [data-signature-image]");
    expect(summaryImage?.getAttribute("src")).toBe(PNG);
    expect(container!.textContent).not.toContain("[object Object]");

    await view.click(view.button("+ Add Row"));
    const dialog = view.dialog()!;
    expect(dialog.querySelector("[data-table-dialog-question=signedBy] canvas")).toBeTruthy();
    expect(dialog.querySelector("[data-table-dialog-question=signedBy] label")?.textContent).toBe("Signature");
    await view.draw();
    await view.click(view.button("Save"));
    expect(view.dialog()).toBeNull();
    expect((view.data().visits as AnyProps[]).map((row) => row.signedBy)).toEqual([SIGNED, SIGNED]);
  });

  it("shows a read-only table's signature as its image", async () => {
    await mount(() => h(tableRuntime.EditableTable, { id: "visits", mode: "inline", columns: COLUMNS, readOnly: true }), {
      visits: [{ _rowId: "r1", name: "Dr. Lee", signedBy: SIGNED }],
    }, "form");
    expect(container!.querySelector("[data-signature-image]")?.getAttribute("src")).toBe(PNG);
    expect(container!.querySelector("canvas")).toBeNull();
  });

  it("reads every stored signature shape", () => {
    const { dataUrlOf, storedValue } = tableRuntime.SignaturePad.helpers;
    expect(dataUrlOf(SIGNED)).toBe(PNG);
    expect(dataUrlOf(PNG)).toBe(PNG);
    expect(dataUrlOf({ dataUrl: null, isEmpty: true })).toBeNull();
    expect(dataUrlOf(null)).toBeNull();
    expect(storedValue(PNG)).toEqual(SIGNED);
    expect(storedValue(null)).toBeNull();
  });
});

describe("LayoutTable signature cells", () => {
  const rows = [{ id: "r1", cells: [{ id: "c1", kind: "field", fieldId: "witness", label: "Witness", inputType: "signature", labelPosition: "top" }] }];

  it("signs a cell through the pad-only dialog and stores the answer under its field id", async () => {
    const view = await mount(() => h(layoutRuntime.LayoutTable, { rows }), {}, "section");
    expect(container!.querySelector("label")?.textContent).toBe("Witness");
    await view.click(view.button("Sign"));
    expect(view.dialog()?.querySelector("h2")?.textContent).toBe("Witness");
    await view.draw();
    await view.click(view.button("Save"));
    expect(view.data().witness).toEqual(SIGNED);
    expect(container!.querySelector("[data-signature-thumbnail]")?.getAttribute("src")).toBe(PNG);
  });

  it("shows a read-only cell's signature as its image", async () => {
    await mount(() => h(layoutRuntime.LayoutTable, { rows, readOnly: true }), { witness: SIGNED }, "section");
    expect(container!.querySelector("[data-signature-image]")?.getAttribute("src")).toBe(PNG);
    expect(container!.querySelector("button")).toBeNull();
  });
});
