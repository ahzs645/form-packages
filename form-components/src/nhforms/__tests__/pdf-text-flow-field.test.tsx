// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "PdfTextFlowField", "index.jsx"), "utf8");

// The Adult Bowel Care Orders "additional orders" lines, as the exporter emits them.
const SLOTS = [
  { fieldId: "ffdnet_textbox_0_12", width: 387.5, fontSize: 10 },
  { fieldId: "ffdnet_textbox_0_10", width: 531.9, fontSize: 10 },
  { fieldId: "ffdnet_textbox_0_17", width: 531.2, fontSize: 10 },
];

function loadComponent(formData: Record<string, unknown>): React.ComponentType<any> {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // The runtime evaluates this same self-contained source in the injected MOIS scope.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function("React", "Fluent", "TextArea", "useActiveData", "useSection", `${compiled};\nreturn PdfTextFlowField;`);
  return factory(
    React,
    { mergeStyles: () => "print-hidden" },
    (props: { fieldId: string; label: string }) => React.createElement("textarea", { "aria-label": props.label, "data-field": props.fieldId }),
    () => [formData, () => {}],
    () => ({ activeSelector: "section" }),
  );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function render(formData: Record<string, unknown>, props: Record<string, unknown>) {
  const Component = loadComponent(formData);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(React.createElement(Component, { fieldId: "flow", label: "Additional orders", multiline: true, ...props })));
  return container.textContent ?? "";
}

describe("PdfTextFlowField", () => {
  it("shows the PDF capacity before anything is typed and passes TextArea props through", () => {
    const text = render({}, { textFlowSlots: SLOTS });
    expect(text).toMatch(/Prints on 3 PDF lines, about \d+ characters\./);
    expect(container!.querySelector("textarea")!.getAttribute("data-field")).toBe("flow");
  });

  it("counts down while the answer fits and blocks once it is too long", () => {
    expect(render({ flow: "Senna 8.6 mg 2 tabs PO at bedtime." }, { textFlowSlots: SLOTS })).toMatch(/Fits the PDF: 1 of 3 lines used, about \d+ characters left\./);
    act(() => root!.unmount());
    const long = "Reassess symptoms and continue the regimen. ".repeat(10);
    expect(render({ flow: long }, { textFlowSlots: SLOTS })).toMatch(/About \d+ characters too long for the PDF's 3 lines\. Shorten the answer/);
  });

  it("warns what will not print under the truncate policy and previews the printed lines", () => {
    const long = "Reassess symptoms and continue the regimen. ".repeat(10);
    const text = render({ flow: long }, { textFlowSlots: SLOTS, textFlowOverflow: "truncate" });
    expect(text).toMatch(/About \d+ characters won't print/);
    const toggle = Array.from(container!.querySelectorAll("button")).find((button) => button.textContent === "Show PDF lines")!;
    act(() => toggle.click());
    expect(container!.textContent).toContain("Line 3");
    expect(container!.textContent).toContain("…");
    expect(container!.textContent).toContain("Won't print:");
  });

  it("falls back to a plain TextArea without PDF geometry", () => {
    expect(render({ flow: "x" }, {})).toBe("");
    expect(container!.querySelector("textarea")).not.toBeNull();
  });
});
