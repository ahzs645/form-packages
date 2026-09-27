// @vitest-environment happy-dom
/**
 * DialogKit (RowDialog / ConfirmDialog on the MOIS SubForm and the dialog
 * width rule) and ActionButtonGroup, its simplest consumer: FieldKit draws the
 * action's fields with the exporter's controls, and OK discards the values
 * exactly like Cancel (undecided; see OK_DISCARDS_VALUES).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");
type AnyProps = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const h = React.createElement;
const Box = ({ children }: AnyProps) => h("div", null, children);
const Button = ({ text, onClick, disabled }: AnyProps) => h("button", { type: "button", onClick, disabled }, text);
// SubForm as the engine draws it for these props; records what it was given.
let subFormRenders: AnyProps[] = [];
const SubForm = (props: AnyProps) => {
  subFormRenders.push(props);
  return props.hidden ? null : h("div", { role: "dialog", "data-min-width": props.minWidth, "data-max-width": props.maxWidth },
    h("h2", null, props.label), props.children);
};
let controls: Array<{ control: string; props: AnyProps }> = [];
const control = (name: string) => (props: AnyProps) => {
  controls.push({ control: name, props });
  return h("input", {
    "data-control": name,
    value: props.value == null ? "" : typeof props.value === "object" ? props.value.code ?? "" : String(props.value),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      name === "SimpleCodeSelect" || name === "FindCodeSelect"
        ? props.onChange?.({ code: event.target.value, display: event.target.value })
        : props.onChange?.(event, event.target.value),
  });
};

function load(): AnyProps {
  const compiled = Babel.transform(["ValueKit", "FieldKit", "DialogKit", "ActionButtonGroup"].map(read).join("\n"), {
    presets: ["react"],
    filename: "index.jsx",
  }).code ?? "";
  const scope: AnyProps = {
    React,
    Fluent: { DefaultButton: Button, PrimaryButton: Button, Text: ({ children }: AnyProps) => h("p", null, children), Label: Box },
    SubForm,
    ButtonBar: Box,
    TextArea: control("TextArea"),
    DateSelect: control("DateSelect"),
    SimpleCodeSelect: control("SimpleCodeSelect"),
    FindCodeSelect: control("FindCodeSelect"),
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...Object.keys(scope), `${compiled};\nreturn { DialogKit, ActionButtonGroup };`)(...Object.values(scope));
}

const runtime = load();
let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  subFormRenders = [];
  controls = [];
});

function mount(element: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(element));
}
const button = (text: string) => Array.from(container!.querySelectorAll("button")).find((entry) => entry.textContent === text)!;
const click = (element: HTMLElement) => act(() => element.click());
const type = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("DialogKit", () => {
  it("applies one width rule, capped to the viewport", () => {
    expect(runtime.DialogKit.width(640)).toBe("min(640px, calc(100vw - 48px))");
    expect(runtime.DialogKit.width(undefined, 440)).toBe("min(440px, calc(100vw - 48px))");
    expect(runtime.DialogKit.maxWidth).toBe("calc(100vw - 48px)");
  });

  it("draws a RowDialog on SubForm: title, width, error, save actions and a read-only body", () => {
    const onSave = vi.fn();
    const extra = vi.fn();
    const { RowDialog } = runtime.DialogKit;
    mount(h(RowDialog, { title: "Edit row", width: 700, onSave, onCancel: () => undefined, errorMessage: "Dose is required.", extraActions: [{ text: "Save & Add Next", onClick: extra }] },
      h("input", { "data-body": "" })));
    const dialog = container!.querySelector("[role=dialog]")!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Edit row");
    expect(dialog.getAttribute("data-min-width")).toBe("min(700px, calc(100vw - 48px))");
    // No modalProps override: the SubForm's own blocking modal applies.
    expect(subFormRenders.filter((props) => props.label === "Edit row").at(-1)).not.toHaveProperty("modalProps");
    expect(dialog.querySelector("[role=alert]")?.textContent).toBe("Dose is required.");
    click(button("Save & Add Next"));
    click(button("Save"));
    expect(extra).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);

    act(() => root!.render(h(RowDialog, { title: "Edit row", onSave, readOnly: true, lockPolicy: { name: "rowLock" } }, h("input", { "data-body": "" }))));
    expect(container!.querySelector("fieldset")!.disabled).toBe(true);
    expect(button("Save").disabled).toBe(true);
    expect(button("Cancel").disabled).toBeFalsy();
    // A read-only dialog holds no lock.
    expect(subFormRenders.filter((props) => props.label === "Edit row").at(-1)?.lockPolicy).toBeNull();
  });

  it("confirms with a ConfirmDialog, extra actions and a busy state", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { ConfirmDialog } = runtime.DialogKit;
    mount(h(ConfirmDialog, { title: "Delete this row?", message: "It will be removed.", confirmText: "Delete", onConfirm, onCancel }));
    expect(container!.textContent).toContain("It will be removed.");
    click(button("Delete"));
    click(button("Cancel"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);

    act(() => root!.render(h(ConfirmDialog, { title: "Sign", confirmText: "Sign", busy: true, onConfirm, onCancel })));
    expect(button("Sign").disabled).toBe(true);
    expect(button("Cancel").disabled).toBe(true);
  });
});

describe("ActionButtonGroup", () => {
  const actions = [
    {
      label: "Record visit",
      dialogTitle: "Visit details",
      fields: [
        { id: "kind", label: "Kind", type: "dropdown", options: [{ key: "home", text: "Home" }, { key: "clinic", text: "Clinic" }] },
        { id: "site", label: "Site", type: "combo", options: ["North", "South"] },
        { id: "on", label: "On", type: "date" },
        { id: "note", label: "Note", type: "textarea", value: "Seeded" },
      ],
    },
  ];

  it("draws the action's fields with the exporter's controls in a RowDialog", () => {
    mount(h(runtime.ActionButtonGroup, { actions }));
    click(button("Record visit"));
    const dialog = container!.querySelector("[role=dialog]")!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Visit details");
    expect(dialog.getAttribute("data-min-width")).toBe("min(760px, calc(100vw - 48px))");
    const drawn = (id: string) => controls.filter((entry) => entry.props.label === id).at(-1)!;
    expect(drawn("Kind")).toMatchObject({ control: "SimpleCodeSelect", props: { labelPosition: "top", selectionType: "single" } });
    expect(drawn("Site")).toMatchObject({ control: "FindCodeSelect", props: { showOtherOption: true } });
    expect(drawn("On").control).toBe("DateSelect");
    expect(drawn("Note")).toMatchObject({ control: "TextArea", props: { multiline: true, value: "Seeded" } });
  });

  it("OK closes and discards what was typed, exactly like Cancel", () => {
    mount(h(runtime.ActionButtonGroup, { actions }));
    click(button("Record visit"));
    type(container!.querySelector("input[data-control=TextArea]") as HTMLInputElement, "Changed");
    expect((container!.querySelector("input[data-control=TextArea]") as HTMLInputElement).value).toBe("Changed");
    click(button("Ok"));
    expect(container!.querySelector("[role=dialog]")).toBeNull();
    click(button("Record visit"));
    expect((container!.querySelector("input[data-control=TextArea]") as HTMLInputElement).value).toBe("Seeded");
  });
});
