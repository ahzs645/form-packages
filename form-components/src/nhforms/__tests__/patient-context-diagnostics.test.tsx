// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { buildPatientContextDiagnosticsProps } from "@/lib/patient-context-diagnostics";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const source = fs.readFileSync(path.resolve("packages/form-components/src/nhforms/PatientContextDiagnostics/index.jsx"), "utf8");
const compiled = Babel.transform(source, { presets: ["react"] }).code!;
let root: Root | undefined;
let container: HTMLDivElement;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  container?.remove();
});

function mount(initial: Record<string, unknown>, props = buildPatientContextDiagnosticsProps()) {
  let sourceData = initial;
  // Only source reads are injected; any attempt to mutate chart/form state fails.
  const Component = new Function("React", "useSourceData", `${compiled}; return PatientContextDiagnostics;`)(React, () => sourceData);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const render = () => act(() => root!.render(<Component {...props} />));
  render();
  return (next: Record<string, unknown>) => { sourceData = next; render(); };
}

describe("PatientContextDiagnostics", () => {
  it("separates empty, missing, malformed, and locally available non-query collections", () => {
    mount({ patient: { patientId: 1, observations: [], allergies: {}, dynamicForms: [{ title: "Local only" }], unknownRecords: [1] } });
    const row = (key: string) => container.querySelector(`[data-collection="${key}"]`)!.textContent;
    expect(row("observations")).toContain("Read + write");
    expect(row("observations")).toContain("Empty0");
    expect(row("conditions")).toContain("Unavailable—");
    expect(row("allergies")).toContain("Invalid: expected array");
    expect(row("dynamicForms")).toContain("Not queried");
    expect(row("dynamicForms")).toContain("Available1");
    expect(row("unknownRecords")).toContain("Unclassified");
  });

  it("uses the real queryResult shape and refreshes on patient switching without retaining prior samples", () => {
    const update = mount({ queryResult: { patient: [{ patientId: 1, name: { text: "First patient" }, observations: [{ value: "first sample" }] }] } });
    expect(container.textContent).toContain("queryResult.patient[0]");
    expect(container.textContent).toContain("first sample");
    update({ patient: { patientId: 2, name: { text: "Second patient" }, observations: [] } });
    expect(container.textContent).toContain("Second patient");
    expect(container.textContent).not.toContain("first sample");
    expect(container.textContent).not.toContain("First patient");
    update({});
    expect(container.textContent).toContain("No active patient context");
  });

  it("bounds samples and escapes record text, including circular records", () => {
    const circular: Record<string, unknown> = { text: "<script>bad()</script>", long: "x".repeat(1000) };
    circular.self = circular;
    mount({ patient: { observations: [circular, { value: "second" }, { value: "third" }, { value: "fourth omitted" }] } });
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>bad()</script>");
    expect(container.textContent).toContain("[circular reference]");
    expect(container.textContent).toContain("[truncated]");
    expect(container.textContent).not.toContain("fourth omitted");
  });
});
