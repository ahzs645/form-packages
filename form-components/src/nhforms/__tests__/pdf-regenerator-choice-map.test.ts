import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";

const NHFORMS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NHFORMS, "PdfRegenerator", "index.jsx"), "utf8");

function loadChoiceHelpers() {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "PdfRegenerator/index.jsx" }).code ?? "";
  // Same bare-global contract as the MOIS runtime. The component itself is not
  // rendered here; this exposes the self-contained mapping helpers for a
  // focused PDF round-trip regression test.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    `${compiled};\nreturn { _resolveChoiceComponentValue };`,
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
  };
}

describe("PdfRegenerator checklist component mapping", () => {
  it("maps selected options plus custom Other text back to independent PDF widgets", () => {
    const { _resolveChoiceComponentValue } = loadChoiceHelpers();
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
});
