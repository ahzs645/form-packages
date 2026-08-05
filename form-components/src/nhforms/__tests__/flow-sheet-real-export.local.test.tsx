// @vitest-environment happy-dom
// Local-only harness: renders the FlowSheet against the real MOIS_REF_10000076
// chart export in ~/Downloads when present; skips silently everywhere else.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { parseMoisTestChartDocuments } from "@/lib/mois-runtime/mock-data/test-chart-import";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const EXPORT_XML = path.join(os.homedir(), "Downloads", "MOIS_REF_10000076", "0001.xml");

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "FlowSheet", "index.jsx"), "utf8");
// FlowSheet depends on the ObservationKit helper module (shared engine scope
// at runtime); concatenate it ahead of the component source like the export
// bundle does.
const kitSource = fs.readFileSync(path.join(NH, "ObservationKit", "index.jsx"), "utf8");

const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
const FluentStub = {
  Stack: passthrough,
  Label: passthrough,
  Text: passthrough,
  PrimaryButton: ({ text }: { text?: string }) => React.createElement("button", null, text),
  Dialog: passthrough,
  DialogType: { largeHeader: 1 },
  DialogFooter: passthrough,
};

describe.skipIf(!fs.existsSync(EXPORT_XML))("FlowSheet against MOIS_REF_10000076", () => {
  it("renders BETTY COMPLEX's chart into the flow sheet grid", () => {
    const xml = fs.readFileSync(EXPORT_XML, "utf16le");
    const parsed = parseMoisTestChartDocuments([{ path: "0001.xml", text: xml, format: "xml" }], "MOIS_REF_10000076");
    const patient: any = parsed.scenario.patient;
    expect(patient.observations.length).toBeGreaterThan(100);
    expect(patient.longTermMedications.length).toBeGreaterThan(10);

    const compiled = Babel.transform(`${kitSource}\n${source}`, { presets: ["react"], filename: "index.jsx" }).code ?? "";
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const factory = new Function("React", "Fluent", "useSourceData", `${compiled};\nreturn { FlowSheet };`);
    const FlowSheet = factory(React, FluentStub, () => ({ patient })).FlowSheet;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        React.createElement(FlowSheet, {
          title: "Diabetes Flow Sheet",
          rows: [
            { code: "128", loincCode: "4548-4", label: "HGBA1C" },
            { code: "1950", label: "Blood Pressure", units: "mm Hg" },
            { code: "----" },
            { code: "951", label: "BMI" },
            { code: "22732", label: "Weight", units: "kg" },
            { code: "1988", label: "Cardiac Risk (Framingham)", units: "%" },
          ],
          maxColumns: 12,
        })
      )
    );

    const text = container.textContent ?? "";
    // Real chart values: BP series and the Framingham score exist in the export.
    expect(text).toContain("Blood Pressure (mm Hg)");
    expect(text).toMatch(/\d+\/\d+/);
    expect(text).toContain("LONG TERM MEDICATIONS");
    expect(text).toMatch(/WARFARIN|METFORMIN|FUROSEMIDE/);
    expect(text).toContain("========")
    act(() => root.unmount());
  });
});
