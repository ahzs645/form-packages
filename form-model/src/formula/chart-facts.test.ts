import { describe, expect, it } from "vitest";
import { chartFactValues, CHART_FACT_BIRTH_DATE_ID, chartFactControllerFields } from "../chart-facts";
import { formulaRequiredReferences } from "./ast";
import { formulaChartFactKind, isFormulaChartFactRef } from "./chart-facts";
import * as kit from "./kit";
import { parseFormula } from "./parse";
import { checkFormula, inferFormulaType } from "./types";

/** Chart facts as formula references (formula/chart-facts.ts, docs/.../architecture/chart-facts.md). */
describe("chart facts in formulas", () => {
  it("are references the parser and checker accept on any form, typed by the fact", () => {
    const parsed = parseFormula('dateAdd([chart:patient.birthDate], 18, "years") <= today() && [chart:patient.sex] == "female"', { fieldIds: ["a"] });
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(checkFormula(parsed.formula!, { fieldIds: ["a"] })).toEqual([]);
    expect(checkFormula(parseFormula("[nope]").formula!, { fieldIds: ["a"] }).map((entry) => entry.code)).toEqual(["unknown-reference"]);
    expect(inferFormulaType({ kind: "ref", id: "chart:patient.birthDate" })).toBe("date");
    expect(inferFormulaType({ kind: "ref", id: "chart:patient.ageYears" })).toBe("number");
    expect(formulaChartFactKind("chart:patient.concept.DIABETES")).toBe("text");
    expect(isFormulaChartFactRef("chart:patient.")).toBe(false);
  });

  it("include the birth date as a calendar day, which is not a condition controller", () => {
    expect(chartFactValues({ sex: "F", birthDate: "1980-05-17T00:00:00" }, new Date(2026, 8, 30))).toMatchObject({
      [CHART_FACT_BIRTH_DATE_ID]: "1980-05-17",
      "chart:patient.sex": "female",
      "chart:patient.ageYears": 46,
    });
    expect(chartFactControllerFields().some((field) => field.id === CHART_FACT_BIRTH_DATE_ID)).toBe(false);
  });

  it("evaluate from the values the host supplies", () => {
    const values = { h: 172, d: "2026-09-01", "chart:patient.birthDate": "2000-01-01" };
    const formula = parseFormula('iif(hasValue([h]) && [d] > dateAdd([chart:patient.birthDate], 18, "years"), [h], null)', { fieldType: (id) => (id === "d" ? "date" : undefined) }).formula!;
    expect(kit.evaluateTree(formula, values, { fieldKinds: { d: "date" } })).toBe(172);
    expect(kit.evaluateTree(formula, { ...values, "chart:patient.birthDate": "2010-01-01" }, { fieldKinds: { d: "date" } })).toBeNull();
  });
});

describe("incomplete: a reference the formula checks itself is not required", () => {
  it("leaves out references the formula answers for itself: hasValue(), coalesce(), ifPresent(), a branch its test guards", () => {
    const formula = parseFormula('round([w] / power(iif(hasValue([h]), [h], latest({"loinc": "8302-2"}, {"required": false})) / 100, 2), 1)').formula!;
    expect(formulaRequiredReferences(formula)).toEqual(["w"]);
    expect(formulaRequiredReferences(parseFormula("coalesce([a], 0) + [b]").formula!)).toEqual(["b"]);
    expect(formulaRequiredReferences(parseFormula('ifPresent([a], [a] + [b], "")').formula!)).toEqual(["b"]);
    expect(formulaRequiredReferences(parseFormula("[a] + [b]").formula!)).toEqual(["a", "b"]);
    // A test that does not require each answered guards nothing.
    expect(formulaRequiredReferences(parseFormula("iif(hasValue([a]) || hasValue([b]), [a] + [b], null)").formula!)).toEqual(["a", "b"]);
    expect(formulaRequiredReferences(parseFormula('iif(coalesce(hasValue([w]) && [d] > today(), false), [w], latest({"loinc": "29463-7"}))').formula!)).toEqual([]);
  });

  it("so a fallback to the chart is complete without the form's answer", () => {
    const chart = [{ loincCode: "8302-2", value: 170, collectedDateTime: "2026-09-01T09:00:00" }];
    const bmi = 'round([w] / power(iif(hasValue([h]), [h], latest({"loinc": "8302-2"}, {"required": false})) / 100, 2), 1)';
    expect(kit.hasAllReferencedValues(bmi, { w: 80 }, { observations: chart })).toBe(true);
    expect(kit.evaluateTree(kit.parse(bmi).formula, { w: 80 }, { observations: chart })).toBe(27.7);
    expect(kit.hasAllReferencedValues(bmi, { h: 180 }, { observations: chart })).toBe(false);
    // A score total still waits for every answer.
    expect(kit.hasAllReferencedValues("score([q1]) + score([q2])", { q1: "a" })).toBe(false);
  });
});
