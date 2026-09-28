import { describe, expect, it } from "vitest";
import { chartRecordReader, evaluateFormula, formulaEnvFromValues, parseFormula, parseFormulaOrThrow } from "./index";
import { FORMULA_SEMANTIC_CASES, formulaCaseNow, type FormulaSemanticCase } from "./semantic-cases";

function runCase(entry: FormulaSemanticCase): unknown {
  const kinds = entry.fieldKinds ?? {};
  const parsed = parseFormula(entry.formula, {
    dialect: entry.dialect,
    fieldType: entry.fieldKinds ? (id) => kinds[id] : undefined,
  });
  if (!parsed.formula) throw new Error(`${entry.formula}: ${parsed.errors.map((error) => error.message).join(" ")}`);
  const params = entry.params ?? {};
  return evaluateFormula(
    parsed.formula,
    formulaEnvFromValues(entry.values ?? {}, {
      now: formulaCaseNow(),
      scoreMaps: entry.scoreMaps,
      fieldKind: (id) => kinds[id],
      getParam: (name) => params[name],
      incomplete: entry.incomplete,
      ...(entry.observations ? { observations: chartRecordReader(entry.observations) } : {}),
    }),
  );
}

describe("formula semantics case table", () => {
  it("has at least 150 cases and covers every probe row", () => {
    expect(FORMULA_SEMANTIC_CASES.length).toBeGreaterThanOrEqual(150);
    expect(FORMULA_SEMANTIC_CASES.filter((entry) => entry.probe).map((entry) => entry.formula)).toEqual([
      "a + b",
      'contains("xxabcxx", "abc")',
      'hasValue("  ")',
      "score(true, 5)",
      'score({ value: "Y" }, { Y: 2 })',
      'durationBetween("2026-01-01", "2026-01-02T12:00", "days")',
      "[a] % 2",
      "min(1, 2)",
    ]);
  });

  it.each(FORMULA_SEMANTIC_CASES.map((entry, index) => [index, entry.formula, entry] as const))(
    "#%i %s",
    (_index, _formula, entry) => {
      const result = runCase(entry);
      if (entry.approx && typeof entry.expected === "number") {
        expect(typeof result).toBe("number");
        expect(result as number).toBeCloseTo(entry.expected, 10);
      } else {
        expect(result).toEqual(entry.expected);
      }
    },
  );
});

describe("formula evaluator environment", () => {
  it("calls host functions for zScore and blanks their failures", () => {
    const formula = parseFormulaOrThrow('zScore({"measure": "weight", "value": [w]})');
    const env = formulaEnvFromValues({ w: 12 }, {
      functions: {
        zScore: (input) => ((input as { value: number }).value === 12 ? 1.25 : null),
      },
    });
    expect(evaluateFormula(formula, env)).toBe(1.25);
    expect(evaluateFormula(formula, { ...env, functions: { zScore: () => { throw new Error("no tables"); } } })).toBeNull();
  });

  it("uses the real clock when env.now is omitted", () => {
    const formula = parseFormulaOrThrow("text(today())");
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(evaluateFormula(formula, formulaEnvFromValues({}))).toBe(expected);
  });

  it("returns date-and-time results as ISO 8601", () => {
    const now = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(evaluateFormula(parseFormulaOrThrow("now()"), formulaEnvFromValues({}, { now }))).toBe("2026-01-02T03:04:05.000Z");
  });

  it("never throws on malformed trees", () => {
    const broken = { v: 1, expr: { kind: "call", fn: "round", args: [null] } } as never;
    expect(evaluateFormula(broken, formulaEnvFromValues({}))).toBeNull();
    const deep = { kind: "unary", op: "-", operand: { kind: "number", value: 1 } } as { kind: string; op?: string; operand?: unknown; value?: number };
    let node: unknown = deep;
    for (let depth = 0; depth < 1000; depth += 1) node = { kind: "unary", op: "-", operand: node };
    expect(evaluateFormula(node as never, formulaEnvFromValues({}))).toBeNull();
  });

  it("does not copy values into the tree or mutate answers", () => {
    const values = { a: ["x", "y"] };
    const formula = parseFormulaOrThrow('contains([a], "x")');
    const before = JSON.stringify(formula);
    expect(evaluateFormula(formula, formulaEnvFromValues(values))).toBe(true);
    expect(JSON.stringify(formula)).toBe(before);
    expect(values.a).toEqual(["x", "y"]);
  });
});
