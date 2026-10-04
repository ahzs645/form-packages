// @vitest-environment happy-dom
/**
 * ConversionField inside a container (a SubformScoring entry, a table row
 * editor) reads only the values the container passes as valueRoot: an
 * unanswered entry is blank, never the outer form's answer with the same id,
 * and Clear and convert-on-blur act on the entry's values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = Babel.transform(fs.readFileSync(path.join(NH, "ConversionField", "index.jsx"), "utf8"), {
  presets: ["react"],
  filename: "index.jsx",
}).code;

type AnyRecord = Record<string, unknown>;
const h = React.createElement;

const TextField = ({ id, value, onChange, onBlur }: { id: string; value: string; onChange: (e: unknown, v: string) => void; onBlur: () => void }) =>
  h("input", { id, value, onChange: (event: { target: { value: string } }) => onChange(event, event.target.value), onBlur });
const DefaultButton = ({ text, disabled, onClick }: { text: string; disabled: boolean; onClick: () => void }) =>
  h("button", { disabled, onClick }, text);

// The outer form already answers the same ids the subform entry uses.
const outerForm = { field: { data: { glucoseMmol: "9.9", glucoseMg: "178" } } };

function load() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function("React", "Fluent", "useActiveData", `${source}; return ConversionField;`)(
    React,
    { TextField, DefaultButton },
    () => [outerForm, () => { throw new Error("wrote to the outer form"); }],
  ) as React.ComponentType<AnyRecord>;
}

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function render(valueRoot: AnyRecord) {
  const ConversionField = load();
  const writes: AnyRecord = {};
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(ConversionField, {
    id: "glucose",
    label: "Glucose",
    conversions: [{ fromFieldId: "glucoseMmol", toFieldId: "glucoseMg", fromUnit: "mmol/L", toUnit: "mg/dL", factor: 18, precision: 0 }],
    valueRoot,
    onValueChange: (fieldId: string, value: unknown) => { writes[fieldId] = value; },
  })));
  return writes;
}

const input = (id: string) => host!.querySelector(`#${id}`) as HTMLInputElement;
const clear = () => Array.from(host!.querySelectorAll("button")).find((button) => button.textContent === "Clear") as HTMLButtonElement;

describe("ConversionField with a container's values", () => {
  it("shows an unanswered entry as blank, not the outer form's answer", () => {
    render({});
    expect(input("glucoseMmol").value).toBe("");
    expect(input("glucoseMg").value).toBe("");
    expect(clear().disabled).toBe(true);
  });

  it("shows and converts the entry's own values", () => {
    const writes = render({ glucoseMmol: "5", glucoseMg: null });
    expect(input("glucoseMmol").value).toBe("5");
    expect(input("glucoseMg").value).toBe("");
    act(() => { input("glucoseMmol").dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(writes).toMatchObject({ glucoseMg: "90" });
  });
});
