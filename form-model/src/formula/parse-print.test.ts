import { describe, expect, it } from "vitest";
import {
  bindFormulaParams,
  formulaFunctions,
  formulaParams,
  formulaReferences,
  parseFormula,
  parseFormulaOrThrow,
  printFormula,
  renameFormulaReferences,
  type FormulaBinaryOp,
  type FormulaNode,
  type StoredFormula,
} from "./index";
import { FORMULA_SEMANTIC_CASES } from "./semantic-cases";

function roundTrip(text: string, options: Parameters<typeof parseFormula>[1] = {}): { first: StoredFormula; printed: string } {
  const first = parseFormulaOrThrow(text, options);
  const printed = printFormula(first);
  const second = parseFormula(printed);
  expect(second.errors, `${text} → ${printed}`).toEqual([]);
  expect(second.formula).toEqual(first);
  expect(printFormula(second.formula!)).toBe(printed);
  return { first, printed };
}

describe("canonical printing", () => {
  const cases: Array<[input: string, canonical: string]> = [
    ["(((a + b) + c) + d)", "[a] + [b] + [c] + [d]"],
    ["[a] - ([b] - [c])", "[a] - ([b] - [c])"],
    ["([a] - [b]) - [c]", "[a] - [b] - [c]"],
    ["[a] + ([b] + [c])", "[a] + ([b] + [c])"],
    ["[a] * ([b] + [c])", "[a] * ([b] + [c])"],
    ["-2 ^ 2", "-2 ^ 2"],
    ["(-2) ^ 2", "(-2) ^ 2"],
    ["2 ^ -1", "2 ^ -1"],
    ["(2 ^ 3) ^ 2", "(2 ^ 3) ^ 2"],
    ["2 ^ 3 ^ 2", "2 ^ 3 ^ 2"],
    ["-([a] + 1)", "-([a] + 1)"],
    ["[a] - -3", "[a] - -3"],
    ["!([a] && [b])", "!([a] && [b])"],
    ["[a] || [b] && [c]", "[a] || [b] && [c]"],
    ["([a] || [b]) && [c]", "([a] || [b]) && [c]"],
    ["[a] ? 1 : [b] ? 2 : 3", "iif([a], 1, iif([b], 2, 3))"],
    ["iif([a], 1)", "iif([a], 1, null)"],
    ['[a] === "x" && [b] !== 1', '[a] == "x" && [b] != 1'],
    ["[a] = 1 AND [b] <> 2", "[a] == 1 && [b] != 2"],
    ["not [a] or [b]", "![a] || [b]"],
    ["Math.round(Math.max([a], 2))", "round(max([a], 2))"],
    ["SQR([a]) + Log([b]) + Log10([c])", "sqrt([a]) + ln([b]) + log10([c])"],
    ["2 ** 8", "2 ^ 8"],
    ["[ a ]", "[a]"],
    ["[q1-a.b::c]", "[q1-a.b::c]"],
    ["[a\\ b]", "[a\\ b]"],
    ["[a\\]b]", "[a\\]b]"],
    ['score([q], {Yes: 2, "No": 0})', 'score([q], {"Yes": 2, "No": 0})'],
    ["[1]", "[1]"],
    ["[[1]]", "[[1]]"],
    ["[(1)]", "[(1)]"],
    ["[(-1)]", "[(-1)]"],
    ["[1, 2]", "[1, 2]"],
    ['["a"]', '["a"]'],
    ["[]", "[]"],
    ["{}", "{}"],
    ["{weight} / {height}", "{weight} / {height}"],
    ["{0} + {1}", "{0} + {1}"],
    ["'tab\\there'", '"tab\\there"'],
    ['"\\u00e9"', '"é"'],
    ["1e21 + 1e-7", "1e+21 + 1e-7"],
    ["-0", "0"],
    ["+5", "5"],
    ["undefined", "null"],
  ];

  it.each(cases)("%s → %s", (input, canonical) => {
    const parsed = parseFormula(input);
    expect(parsed.errors).toEqual([]);
    expect(printFormula(parsed.formula!)).toBe(canonical);
    roundTrip(input);
  });

  it("joins adjacent string literals as text", () => {
    expect(printFormula(parseFormulaOrThrow("'it' + 's'"))).toBe('concat("it", "s")');
  });

  it("prints the legacy text join as concat()", () => {
    const { printed } = roundTrip('"Values from " + [location] + "."');
    expect(printed).toBe('concat("Values from ", [location], ".")');
  });
});

describe("round trip", () => {
  it.each(FORMULA_SEMANTIC_CASES.map((entry) => [entry.formula, entry] as const))("%s", (formula, entry) => {
    roundTrip(formula, { dialect: entry.dialect });
  });

  it("round-trips 2,000 random trees", () => {
    let seed = 1234567;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const binaryOps: FormulaBinaryOp[] = ["+", "-", "*", "/", "%", "^", "==", "!=", "<", "<=", ">", ">=", "&&", "||"];
    const functions = ["round", "coalesce", "power", "max", "durationBetween", "score", "concat", "mod", "contains"];
    const ids = ["a", "q1-b", "x.y", "c::d", "1", "weird id", "brace}", "ü"];
    const tree = (depth: number): FormulaNode => {
      const leaf = depth <= 0 || random() < 0.25;
      if (leaf) {
        const kind = pick(["number", "negative", "text", "boolean", "null", "ref", "param"] as const);
        if (kind === "number") return { kind: "number", value: pick([0, 1, 2.5, 1e21, 1e-7, 100]) };
        if (kind === "negative") return { kind: "number", value: -pick([1, 2.5, 3e-9]) };
        if (kind === "text") return { kind: "text", value: pick(["", "Yes", 'say "hi"', "a\nb", "é", "[x]"]) };
        if (kind === "boolean") return { kind: "boolean", value: random() < 0.5 };
        if (kind === "null") return { kind: "null" };
        if (kind === "param") return { kind: "param", name: pick(["weight", "0", "patient.name.first"]) };
        return { kind: "ref", id: pick(ids) };
      }
      const shape = pick(["unary", "binary", "binary", "binary", "if", "call", "list", "map"] as const);
      if (shape === "unary") {
        const operand = tree(depth - 1);
        const op = pick(["-", "+", "!"] as const);
        // Signed literals are stored as numbers, never as negate(literal).
        if (op !== "!" && operand.kind === "number") return { kind: "unary", op: "!", operand };
        return { kind: "unary", op, operand };
      }
      if (shape === "binary") return { kind: "binary", op: pick(binaryOps), left: tree(depth - 1), right: tree(depth - 1) };
      if (shape === "if") return { kind: "if", test: tree(depth - 1), then: tree(depth - 1), else: tree(depth - 1) };
      if (shape === "list") return { kind: "list", items: Array.from({ length: Math.floor(random() * 3) }, () => tree(depth - 1)) };
      if (shape === "map") {
        const keys = ["Yes", "No", "a b"].slice(0, 1 + Math.floor(random() * 3));
        return { kind: "map", entries: keys.map((key) => ({ key, value: tree(depth - 1) })) };
      }
      return { kind: "call", fn: pick(functions), args: [tree(depth - 1), tree(depth - 1)] };
    };
    for (let index = 0; index < 2000; index += 1) {
      const formula: StoredFormula = { v: 1, expr: tree(4) };
      const printed = printFormula(formula);
      const parsed = parseFormula(printed);
      if (!parsed.formula) throw new Error(`${printed}: ${parsed.errors[0]?.message}`);
      // The text-join rule reads `"a" + x` as concat(); compare only trees without it.
      if (printed.includes(" + ") && JSON.stringify(parsed.formula) !== JSON.stringify(formula)) {
        expect(parsed.warnings.some((warning) => warning.code === "text-join")).toBe(true);
        continue;
      }
      expect(parsed.formula, printed).toEqual(formula);
    }
  });
});

describe("dialects", () => {
  it("reads bare identifiers as fields, against fieldIds when given", () => {
    const loose = parseFormula("phq_q1 + phq_q2");
    expect(loose.formula?.expr).toEqual({ kind: "binary", op: "+", left: { kind: "ref", id: "phq_q1" }, right: { kind: "ref", id: "phq_q2" } });
    expect(loose.warnings.map((warning) => warning.code)).toEqual(["bare-reference"]);
    const strict = parseFormula("phq_q1 + phq_q2", { fieldIds: ["phq_q1", "phq_q2"] });
    expect(strict.warnings).toEqual([]);
    const unknown = parseFormula("phq_q1 + phq_q3", { fieldIds: ["phq_q1", "phq_q2"] });
    expect(unknown.formula).toBeNull();
    expect(unknown.errors[0]).toMatchObject({ code: "unknown-reference", start: 9, end: 15 });
  });

  it("reads Cerner Equation Tool infix", () => {
    const parsed = parseFormulaOrThrow("SQR(a) ^ 2 / Log10(b) * (a = 1 AND b >= 2 OR c > 0)", { fieldIds: ["a", "b", "c"] });
    expect(printFormula(parsed)).toBe("sqrt([a]) ^ 2 / log10([b]) * ([a] == 1 && [b] >= 2 || [c] > 0)");
    expect(printFormula(parseFormulaOrThrow("a OR b", { fieldIds: ["a", "b"] }))).toBe("coalesce([a], [b])");
    expect(printFormula(parseFormulaOrThrow("a > 1 OR b", { fieldIds: ["a", "b"] }))).toBe("[a] > 1 || [b]");
  });

  it("reads LayoutTable's sum shorthand and missing-as-zero", () => {
    const parsed = parseFormula("sum(q1-a, q1-b, [q1-c])", { dialect: "layoutTable" });
    expect(printFormula(parsed.formula!)).toBe("sum([q1-a], [q1-b], [q1-c])");
    const known = parseFormula("sum(q1-a, q1-b)", { fieldIds: ["q1-a", "q1-b"] });
    expect(printFormula(known.formula!)).toBe("sum([q1-a], [q1-b])");
    // Without the dialect or known ids, `q1-a` is subtraction.
    expect(printFormula(parseFormulaOrThrow("sum(q1-a)"))).toBe("sum([q1] - [a])");
    const wrapped = parseFormula("MHSUX38 + Math.max(MHSUX37, 1)", { dialect: "layoutTable" });
    expect(printFormula(wrapped.formula!)).toBe("coalesce([MHSUX38], 0) + max(coalesce([MHSUX37], 0), 1)");
    expect(wrapped.warnings.map((warning) => warning.code)).toContain("missing-as-zero");
  });

  it("reads chart value formulas with {path} slots as text", () => {
    const parsed = parseFormulaOrThrow('{patient.name.first} + " " + {patient.name.family}', { dialect: "chartValue" });
    expect(printFormula(parsed)).toBe('concat({patient.name.first}, " ", {patient.name.family})');
    expect(printFormula(parseFormulaOrThrow("{a} + {b}", { dialect: "chartValue" }))).toBe("concat({a}, {b})");
    expect(printFormula(parseFormulaOrThrow("{a} + {b}"))).toBe("{a} + {b}");
  });

  it("stores the resultType option", () => {
    expect(parseFormulaOrThrow("[a] + 1", { resultType: "number" })).toEqual({
      v: 1,
      expr: { kind: "binary", op: "+", left: { kind: "ref", id: "a" }, right: { kind: "number", value: 1 } },
      resultType: "number",
    });
  });
});

describe("parse errors", () => {
  const errors: Array<[text: string, code: string]> = [
    ["", "empty"],
    ["   ", "empty"],
    ["foo([a])", "unknown-function"],
    ["Math.random()", "unknown-function"],
    ["round()", "arity"],
    ["hasValue([a], [b])", "arity"],
    ['"unterminated', "syntax"],
    ["[a] +", "syntax"],
    ["([a] + 1", "syntax"],
    ["[a] + 1)", "syntax"],
    ["[a]; [b]", "syntax"],
    ["[a] & [b]", "syntax"],
    ["2x", "syntax"],
    ["1e999", "syntax"],
    ["[a] ? 1", "syntax"],
    ["{a: }", "syntax"],
    ["[1, 2", "syntax"],
    ["today", "syntax"],
    ["#", "syntax"],
  ];
  it.each(errors)("%j → %s", (text, code) => {
    const result = parseFormula(text);
    expect(result.formula).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe(code);
    expect(result.errors[0].severity).toBe("error");
  });

  it("reports positions", () => {
    expect(parseFormula("[a] + foo(1)").errors[0]).toMatchObject({ start: 6, end: 9 });
    expect(parseFormula("[a] + )").errors[0]).toMatchObject({ start: 6, end: 7 });
  });

  it("names a function used without parentheses", () => {
    expect(parseFormula("today + 1", { fieldIds: ["a"] }).errors[0].message).toContain("today(…)");
  });
});

describe("tree helpers", () => {
  const formula = parseFormulaOrThrow("score([q1]) + iif(hasValue([q2]), {w} * [q1], 0)");

  it("lists references, slots and functions", () => {
    expect(formulaReferences(formula)).toEqual(["q1", "q2"]);
    expect(formulaParams(formula)).toEqual(["w"]);
    expect(formulaFunctions(formula)).toEqual(["score", "iif", "hasValue"]);
  });

  it("renames references structurally", () => {
    expect(printFormula(renameFormulaReferences(formula, { q1: "phq-1" }))).toBe("score([phq-1]) + iif(hasValue([q2]), {w} * [phq-1], 0)");
  });

  it("binds template slots to fields or nodes", () => {
    expect(printFormula(bindFormulaParams(formula, { w: "weight" }))).toBe("score([q1]) + iif(hasValue([q2]), [weight] * [q1], 0)");
    expect(printFormula(bindFormulaParams(formula, { w: { kind: "number", value: 2 } }))).toBe("score([q1]) + iif(hasValue([q2]), 2 * [q1], 0)");
  });
});
