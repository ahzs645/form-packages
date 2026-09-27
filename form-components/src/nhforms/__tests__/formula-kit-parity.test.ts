import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";

import * as kit from "@/packages/form-model/src/formula/kit";
import { FORMULA_SEMANTIC_CASES, formulaCaseNow, type FormulaSemanticCase } from "@/packages/form-model/src/formula/semantic-cases";
// @ts-expect-error -- plain .mjs build script, no type declarations
import { renderFormulaKitSource as renderFormulaKitSourceUntyped } from "@/scripts/generate-formula-kit.mjs";

const renderFormulaKitSource = renderFormulaKitSourceUntyped as () => Promise<{ source: string; exportedNames: string[] }>;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kitSource = fs.readFileSync(path.join(NH, "FormulaKit", "index.jsx"), "utf8");

type Kit = typeof kit;

// Same bare-global contract the injected NHForms runtime uses.
function loadFormulaKit(): Kit {
  const compiled = Babel.transform(kitSource, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`${compiled};\nreturn FormulaKit;`)() as Kit;
}

const FormulaKit = loadFormulaKit();

function runCase(engine: Kit, entry: FormulaSemanticCase): unknown {
  const kinds = entry.fieldKinds ?? {};
  const params = entry.params ?? {};
  const parsed = engine.parse(entry.formula, {
    dialect: entry.dialect,
    fieldType: entry.fieldKinds ? (id: string) => kinds[id] : undefined,
  });
  if (!parsed.formula) throw new Error(`${entry.formula}: ${parsed.errors.map((error) => error.message).join(" ")}`);
  return engine.evaluateTree(parsed.formula, entry.values ?? {}, {
    now: formulaCaseNow(),
    scoreMaps: entry.scoreMaps,
    fieldKinds: kinds,
    getParam: (name: string) => params[name],
    incomplete: entry.incomplete,
  });
}

describe("FormulaKit parity with the form-model formula module", () => {
  it("exports the kit module's API", () => {
    expect(Object.keys(FormulaKit).sort()).toEqual(Object.keys(kit).sort());
  });

  it.each(FORMULA_SEMANTIC_CASES.map((entry, index) => [index, entry.formula, entry] as const))("#%i %s", (_index, _formula, entry) => {
    const result = runCase(FormulaKit, entry);
    if (entry.approx && typeof entry.expected === "number") {
      expect(result as number).toBeCloseTo(entry.expected, 10);
    } else {
      expect(result).toEqual(entry.expected);
    }
    expect(result).toEqual(runCase(kit, entry));
  });

  it("compiles no code at run time", () => {
    expect(kitSource).not.toMatch(/\bnew Function\b|\bFunction\(|\beval\(/);
  });

  it("is generated from the current formula module", async () => {
    const { source } = await renderFormulaKitSource();
    expect(kitSource, "run `pnpm generate:nhforms` after editing packages/form-model/src/formula or values.ts").toBe(source);
  });
});

describe("FormulaKit's older names run on the reference engine", () => {
  it("evaluate reads formula text and blanks a self-reference", () => {
    expect(FormulaKit.evaluate("[a] + [b]", { a: "5", b: "3" })).toBe(8);
    expect(FormulaKit.evaluate("a + b", { a: "5", b: "3" })).toBe(8);
    expect(FormulaKit.evaluate("[a] + [total]", { a: 1, total: 2 }, "total")).toBeNull();
    expect(FormulaKit.evaluate("[a] % 2", { a: 3 })).toBe(1);
    expect(FormulaKit.evaluate('contains("xxabcxx", "abc")', {})).toBe(true);
    expect(FormulaKit.evaluate("[m]", { m: ["a", "b"] })).toBeNull();
    expect(FormulaKit.evaluate("[a] +", { a: 1 })).toBeNull();
    expect(FormulaKit.evaluate("", {})).toBeNull();
  });

  it("evaluate takes the incomplete mode", () => {
    expect(FormulaKit.evaluate("[a] + [b]", { a: 2 })).toBeNull();
    expect(FormulaKit.evaluate("[a] + [b]", { a: 2 }, null, { incomplete: "compute-anyway" })).toBe(2);
  });

  it("evaluateTree accepts a lookup function and field kinds", () => {
    const { formula } = FormulaKit.parse("score([chk], 2) + [n]");
    expect(FormulaKit.evaluateTree(formula, (id: string) => (id === "n" ? 1 : undefined), { fieldKinds: { chk: "booleanSingle" } })).toBe(1);
    expect(FormulaKit.evaluateTree(formula, { n: 1 }, { fieldKind: () => undefined })).toBeNull();
    expect(FormulaKit.evaluateTree(formula, { n: 1, chk: true }, { selfId: "n" })).toBeNull();
    expect(FormulaKit.evaluateTree(null, {})).toBeNull();
    expect(FormulaKit.evaluateTree("[a]", { a: 1 })).toBeNull();
  });

  it("hasAllReferencedValues uses the formula's blank rule", () => {
    expect(FormulaKit.hasAllReferencedValues("[a] + [b]", { a: 0, b: false })).toBe(true);
    expect(FormulaKit.hasAllReferencedValues("[a] + [b]", { a: 1, b: "  " })).toBe(false);
    expect(FormulaKit.hasAllReferencedValues("[s]", { s: { selectedKey: null, value: null, response: null } })).toBe(false);
    expect(FormulaKit.hasAllReferencedValues("[chk]", {}, { fieldKinds: { chk: "booleanSingle" } })).toBe(true);
    expect(FormulaKit.hasAllReferencedValues("1 + 2", {})).toBe(true);
  });

  it("reads single answers the way formulas do", () => {
    expect(FormulaKit.toNumericValue("4.5")).toBe(4.5);
    expect(FormulaKit.toNumericValue({ code: "3", display: "Three" })).toBe(3);
    expect(FormulaKit.toNumericValue("abc")).toBeNull();
    expect(FormulaKit.toComparableValue({ code: "Y", display: "Yes" })).toBe("Y");
    expect(FormulaKit.toComparableValue(undefined)).toBe("");
    expect(FormulaKit.hasValue("  ")).toBe(false);
    expect(FormulaKit.hasValue(0)).toBe(true);
    expect(FormulaKit.extractReferences("score([q1]) + [q2] * 2")).toEqual(["q1", "q2"]);
  });

  it("roundValue applies a precision like round()", () => {
    expect(FormulaKit.roundValue(1.005, 2)).toBe(1.01);
    expect(FormulaKit.roundValue(22.857, 1)).toBe(22.9);
    expect(FormulaKit.roundValue(22.857, undefined)).toBe(22.857);
    expect(FormulaKit.roundValue("LOW", 1)).toBe("LOW");
    expect(FormulaKit.roundValue(Number.NaN, 1)).toBeNull();
    expect(FormulaKit.roundValue(null, 1)).toBeNull();
  });
});
