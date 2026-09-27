import { describe, expect, it } from "vitest";
import {
  FORMULA_FUNCTIONS,
  FORMULA_TARGETS,
  checkFormula,
  findFormulaFunction,
  formulaValueTypeForFieldType,
  inferFormulaType,
  parseFormulaOrThrow,
  type FormulaNode,
  type FormulaTypeEnv,
} from "./index";

const fieldTypes: Record<string, string> = {
  weight: "number",
  height: "number",
  name: "text",
  dob: "date",
  seen: "datetime",
  start: "time",
  smoker: "booleanYesNo",
  pain: "choice",
  symptoms: "multiselect",
  total: "computed",
};
const env: FormulaTypeEnv = { fieldType: (id) => fieldTypes[id], fieldIds: Object.keys(fieldTypes), selfId: "total" };

const typeOf = (text: string) => inferFormulaType(parseFormulaOrThrow(text), env);
const codes = (text: string, overrides: FormulaTypeEnv = env) => checkFormula(parseFormulaOrThrow(text), overrides).map((entry) => `${entry.severity}:${entry.code}`);

describe("inferFormulaType", () => {
  it.each([
    ["[weight] / power([height] / 100, 2)", "number"],
    ['concat("Hi ", [name])', "text"],
    ["[weight] > 70", "boolean"],
    ["hasValue([name])", "boolean"],
    ["today()", "date"],
    ["now()", "datetime"],
    ['durationBetween([dob], today(), "years")', "duration"],
    ['durationText([dob], today(), "years")', "text"],
    ['iif([smoker], "Yes", "No")', "text"],
    ['iif([smoker], 1, null)', "number"],
    ['iif([smoker], 1, "none")', "unknown"],
    ["coalesce([weight], 0)", "number"],
    ['coalesce([dob], now())', "datetime"],
    ['ifPresent([name], [name], "anonymous")', "text"],
    ["[pain]", "coded"],
    ["[symptoms]", "list"],
    ["[total]", "unknown"],
    ["[unknownField]", "unknown"],
    ["score([pain])", "number"],
    ["[1, 2]", "list"],
    ["!(1)", "boolean"],
    ["-[weight]", "number"],
    ["null", "unknown"],
  ])("%s is %s", (text, expected) => {
    expect(typeOf(text)).toBe(expected);
  });

  it("maps builder field types", () => {
    expect(formulaValueTypeForFieldType("slider")).toBe("number");
    expect(formulaValueTypeForFieldType("booleanSingle")).toBe("boolean");
    expect(formulaValueTypeForFieldType("scale")).toBe("coded");
    expect(formulaValueTypeForFieldType("table")).toBe("unknown");
    expect(formulaValueTypeForFieldType("duration")).toBe("duration");
    expect(formulaValueTypeForFieldType(undefined)).toBe("unknown");
  });

  it("types template slots through paramType", () => {
    expect(inferFormulaType(parseFormulaOrThrow("{w} * 2"), { paramType: () => "number" })).toBe("number");
    expect(inferFormulaType(parseFormulaOrThrow("{w}"), { paramType: () => "text" })).toBe("text");
  });
});

describe("checkFormula", () => {
  it("accepts well-typed formulas", () => {
    expect(codes("[weight] / power([height] / 100, 2)")).toEqual([]);
    expect(codes('iif(hasValue([dob]), floor(durationBetween([dob], today(), "years")), null)')).toEqual([]);
    expect(codes('score([pain]) + countTrue([smoker]) + iif(contains([symptoms], "cough"), 1, 0)')).toEqual([]);
    expect(codes('concat([name], " (", text([dob]), ")")')).toEqual([]);
  });

  it("reports unknown functions and wrong arity on programmatic trees", () => {
    const tree = (fn: string, args: FormulaNode[]): FormulaNode => ({ kind: "call", fn, args });
    expect(checkFormula(tree("median", [{ kind: "number", value: 1 }]))).toMatchObject([{ severity: "error", code: "unknown-function", fn: "median" }]);
    expect(checkFormula(tree("round", []))).toMatchObject([{ severity: "error", code: "arity", fn: "round" }]);
    expect(checkFormula(tree("today", [{ kind: "number", value: 1 }]))[0].message).toBe("today() takes 0 arguments, not 1.");
  });

  it("reports text and dates in arithmetic", () => {
    const addText: FormulaNode = { kind: "binary", op: "+", left: { kind: "text", value: "abc" }, right: { kind: "number", value: 1 } };
    expect(checkFormula(addText).map((entry) => `${entry.severity}:${entry.code}`)).toEqual(["error:text-arithmetic"]);
    expect(codes('[weight] * "2"')).toEqual([]);
    expect(codes("[name] * 2")).toEqual(["warning:text-arithmetic"]);
    expect(codes("[dob] + 1")).toEqual(["error:date-arithmetic"]);
    expect(codes("today() - [dob]")).toEqual(["error:date-arithmetic"]);
    expect(codes("[symptoms] + 1")).toEqual(["warning:list-arithmetic"]);
  });

  it("reads + over a time as arithmetic, not a text join", () => {
    const parse = (text: string) => parseFormulaOrThrow(text, { fieldType: env.fieldType });
    // `[start] + 30` stays arithmetic (a time is not a number), never "14:3030".
    expect(parse("[start] + 30").expr).toMatchObject({ kind: "binary", op: "+" });
    expect(checkFormula(parse("[start] + 30"), env).map((entry) => `${entry.severity}:${entry.code}`)).toEqual(["error:date-arithmetic"]);
    expect(codes("[start] - [start]")).toEqual(["error:date-arithmetic"]);
    // A text operand on the other side still joins text.
    expect(parse('"At " + [start]').expr).toMatchObject({ kind: "call", fn: "concat" });
    expect(parse("[name] + [start]").expr).toMatchObject({ kind: "call", fn: "concat" });
    expect(typeOf("[start]")).toBe("text");
    expect(codes("[pain] * 2")).toEqual(["warning:coded-arithmetic"]);
  });

  it("reports impossible comparisons and conditions", () => {
    expect(codes("[dob] > 5")).toEqual(["error:compare-types"]);
    expect(codes("[dob] > today()")).toEqual([]);
    expect(codes("[smoker] > 0")).toEqual(["warning:compare-types"]);
    expect(codes('iif([name], "a", "b")')).toEqual(["warning:condition-type"]);
    expect(codes("[dob] && [smoker]")).toEqual(["warning:condition-type"]);
  });

  it("checks function arguments", () => {
    expect(codes('durationBetween([weight], today(), "years")')).toEqual(["error:argument-type"]);
    expect(codes('durationBetween([dob], today(), "fortnights")')).toEqual(["error:unit"]);
    expect(codes('durationText([dob], today(), "years, weeks")')).toEqual([]);
    expect(codes('durationText([dob], today(), "years, eons")')).toEqual(["error:unit"]);
    expect(codes("round([dob])")).toEqual(["error:argument-type"]);
    expect(codes('round("abc")')).toEqual(["error:argument-type"]);
    expect(codes("round([symptoms])")).toEqual(["warning:argument-type"]);
    expect(codes("sum([symptoms], 1)")).toEqual([]);
    expect(codes('score([pain], "x")')).toEqual(["error:argument-type"]);
    expect(codes("score([weight])")).toEqual(["warning:score-argument"]);
  });

  it("reports unknown fields, self references and unbound slots", () => {
    expect(codes("[weight] + [bogus]")).toEqual(["error:unknown-reference"]);
    expect(codes("[total] + 1")).toEqual(["error:self-reference"]);
    expect(codes("{w} * 2")).toEqual(["warning:unbound-param"]);
    expect(codes("[anything]", {})).toEqual([]);
  });
});

describe("function registry", () => {
  it("names every helper of every legacy engine", () => {
    const names = new Set(FORMULA_FUNCTIONS.flatMap((spec) => [spec.name, ...spec.aliases]));
    const legacy = {
      "lib/expressions": ["today", "daysBetween", "monthsBetween", "durationBetween", "durationText", "weekdaysBetween", "hasValue", "iif", "floor", "round", "power", "ln", "exp", "coalesce", "text", "score", "contains", "bmi", "zScore"],
      FormulaKit: ["iif", "score", "contains", "hasValue", "countTrue", "daysSince", "monthsSince", "today", "durationBetween", "durationText", "weekdaysBetween", "floor", "mod", "round", "power", "ln", "exp", "coalesce", "text", "min", "max"],
      SubformScoring: ["round", "floor", "ceil", "min", "max", "abs", "mod", "iif"],
      LayoutTable: ["sum", "min", "max", "Math.round", "Math.floor", "Math.ceil", "Math.abs", "Math.min", "Math.max", "Math.pow", "Math.sqrt", "Math.exp", "Math.log", "Math.log10", "Math.trunc"],
      cernerEquation: ["SQR", "LOG", "LOG10"],
      chartValue: ["ifPresent"],
    };
    for (const [engine, helpers] of Object.entries(legacy)) {
      for (const helper of helpers) expect(names.has(helper), `${engine}: ${helper}`).toBe(true);
    }
  });

  it("gives every function a complete, consistent entry", () => {
    const seen = new Set<string>();
    for (const spec of FORMULA_FUNCTIONS) {
      expect(seen.has(spec.name), spec.name).toBe(false);
      seen.add(spec.name);
      expect(Object.keys(spec.targets).sort()).toEqual([...FORMULA_TARGETS].sort());
      expect(spec.description.length).toBeGreaterThan(10);
      expect(spec.minArgs).toBeLessThanOrEqual(spec.maxArgs ?? Number.POSITIVE_INFINITY);
      const required = spec.params.filter((param) => !param.optional && !param.rest).length;
      expect(required, spec.name).toBeLessThanOrEqual(spec.minArgs);
      if (spec.maxArgs !== null) expect(spec.params.length, spec.name).toBe(spec.maxArgs);
      else expect(spec.params.some((param) => param.rest), spec.name).toBe(true);
    }
  });

  it("resolves aliases exactly, then case-insensitively", () => {
    expect(findFormulaFunction("Math.round")?.name).toBe("round");
    expect(findFormulaFunction("SQR")?.name).toBe("sqrt");
    expect(findFormulaFunction("Sqr")?.name).toBe("sqrt");
    expect(findFormulaFunction("Log")?.name).toBe("ln");
    expect(findFormulaFunction("Log10")?.name).toBe("log10");
    expect(findFormulaFunction("IIF")?.name).toBe("iif");
    expect(findFormulaFunction("Math.random")).toBeUndefined();
  });

  it("marks every function native for MOIS except the host-supplied zScore (FormulaKit is generated from this evaluator)", () => {
    for (const spec of FORMULA_FUNCTIONS) {
      expect(spec.targets.mois, spec.name).toBe(spec.name === "zScore" ? "unsupported" : "native");
    }
  });
});
