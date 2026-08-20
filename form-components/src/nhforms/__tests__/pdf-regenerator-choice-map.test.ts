import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import * as PDFLib from "pdf-lib";

const NHFORMS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NHFORMS, "PdfRegenerator", "index.jsx"), "utf8");

function loadHelpers() {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "PdfRegenerator/index.jsx" }).code ?? "";
  // Same bare-global contract as the MOIS runtime. The component itself is not
  // rendered here; this exposes the self-contained mapping helpers for a
  // focused PDF round-trip regression test.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    `${compiled};\nreturn { _resolveChoiceComponentValue, _drawGeometryOverlays };`,
  );
  return factory(
    { useMemo: () => undefined, useState: () => undefined, useCallback: () => undefined },
    {},
  ) as {
    _resolveChoiceComponentValue: (
      formData: Record<string, unknown>,
      entry: Record<string, unknown>,
      rawValue: unknown,
    ) => unknown;
    _drawGeometryOverlays: (input: Record<string, unknown>) => Promise<{
      filledFieldCount: number;
      skippedFieldCount: number;
    }>;
  };
}

describe("PdfRegenerator checklist component mapping", () => {
  it("maps selected options plus custom Other text back to independent PDF widgets", () => {
    const { _resolveChoiceComponentValue } = loadHelpers();
    const knownOptions = [
      { fieldId: "Example_1", role: "option", optionValue: "Example_1", optionLabel: "Makes careless mistakes" },
      { fieldId: "Example_2", role: "option", optionValue: "Example_2", optionLabel: "Works slowly" },
    ];
    const formData = {
      adult_examples: [
        { code: "Example_1", display: "Makes careless mistakes" },
        { code: "More context", display: "More context" },
      ],
    };
    const entry = (component: Record<string, unknown>) => ({
      sourceFieldId: "adult_examples",
      component,
      knownOptions,
    });

    expect(_resolveChoiceComponentValue(formData, entry(knownOptions[0]!), undefined)).toBe(true);
    expect(_resolveChoiceComponentValue(formData, entry(knownOptions[1]!), undefined)).toBe(false);
    expect(_resolveChoiceComponentValue(formData, entry({ fieldId: "Example_8", role: "other" }), undefined)).toBe(true);
    expect(_resolveChoiceComponentValue(formData, entry({ fieldId: "Example_9", role: "otherText" }), undefined)).toBe("More context");
  });

  it("stamps text, checkbox, and radio answers over an image-projection page", async () => {
    const { _drawGeometryOverlays } = loadHelpers();
    const doc = await PDFLib.PDFDocument.create();
    const page = doc.addPage([200, 300]);
    const before = await doc.save();
    const warnings: string[] = [];

    const result = await _drawGeometryOverlays({
      doc,
      formData: {
        patient_name: "Ada Lovelace",
        consent: true,
        visit_type: "Follow-up",
      },
      geometryOverlayFields: [
        {
          id: "patient_name",
          page: 1,
          kind: "text",
          bbox: { x: 20, y: 250, width: 120, height: 18 },
          widgets: [{ page: 1, bbox: { x: 20, y: 250, width: 120, height: 18 } }],
        },
        {
          id: "consent",
          page: 1,
          kind: "boolean",
          bbox: { x: 20, y: 220, width: 12, height: 12 },
          widgets: [{ page: 1, bbox: { x: 20, y: 220, width: 12, height: 12 } }],
        },
        {
          id: "visit_type",
          page: 1,
          kind: "choice",
          choiceStyle: "radio",
          bbox: { x: 20, y: 190, width: 12, height: 12 },
          widgets: [
            { page: 1, bbox: { x: 20, y: 190, width: 12, height: 12 }, optionValue: "Initial" },
            { page: 1, bbox: { x: 50, y: 190, width: 12, height: 12 }, optionValue: "Follow-up" },
          ],
        },
      ],
      includeSet: null,
      warnings,
      PDFLib,
    });

    const after = await doc.save();
    expect(result).toEqual({ filledFieldCount: 3, skippedFieldCount: 0 });
    expect(warnings).toEqual([]);
    expect(after.byteLength).toBeGreaterThan(before.byteLength);
    expect(page.node.Contents()).toBeTruthy();
  });
});
