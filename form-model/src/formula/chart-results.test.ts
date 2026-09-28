import { describe, expect, it } from "vitest";
import {
  chartRecordReader,
  checkFormula,
  evaluateFormula,
  formulaEnvFromValues,
  inferFormulaType,
  latestFormulaNode,
  latestTermProblems,
  missingChartResults,
  parseFormulaOrThrow,
  printFormula,
  readLatestTerm,
  selectLatestResult,
  type FormulaNode,
} from "./index";
import * as kit from "./kit";

const now = new Date(2026, 8, 26, 10, 30);
const chart = [
  { observationCode: "22732", loincCode: "29463-7", value: "72.5", units: "kg", collectedDateTime: "2026-09-25T08:00:00" },
];

describe("latest(): the patient's latest charted result", () => {
  it("prints and parses back to the same tree, keys in a fixed order", () => {
    const node = latestFormulaNode({
      observation: { dta: "Weight Dosing", unit: "kg", loinc: "29463-7" },
      withinMinutes: 120,
      statuses: ["final"],
      fallback: { kind: "number", value: 0 },
    });
    const text = printFormula(node);
    expect(text).toBe('latest({"loinc": "29463-7", "dta": "Weight Dosing", "unit": "kg"}, {"withinMinutes": 120, "statuses": ["final"], "fallback": 0})');
    expect(parseFormulaOrThrow(text).expr).toEqual(node);
    expect(printFormula(latestFormulaNode({ observation: { dta: "RASS Score" } }))).toBe('latest({"dta": "RASS Score"})');
    expect(printFormula(latestFormulaNode({ observation: { loinc: "1-1" }, required: false }))).toBe('latest({"loinc": "1-1"}, {"required": false})');
  });

  it("reads a term: codings in preference order, required unless there is a fallback", () => {
    const term = readLatestTerm(parseFormulaOrThrow('latest({"dta": "X", "loinc": "1-1", "system": "urn:s", "code": "c"}, {"aheadMinutes": 5})').expr);
    expect(term?.observation.codings.map((coding) => coding.system)).toEqual(["http://loinc.org", "urn:webforms:cerner:dta", "urn:s"]);
    expect(term?.aheadMinutes).toBe(5);
    expect(term?.required).toBe(true);
    expect(readLatestTerm(parseFormulaOrThrow('latest({"loinc": "1"}, {"fallback": 0, "required": true})').expr)?.required).toBe(false);
    expect(readLatestTerm(parseFormulaOrThrow('latest({"loinc": "1"}, {"required": false})').expr)?.required).toBe(false);
    expect(readLatestTerm(parseFormulaOrThrow("latest([a])").expr)).toBeNull();
  });

  it("checks its arguments", () => {
    const errors = (text: string) => checkFormula(parseFormulaOrThrow(text)).filter((entry) => entry.code === "latest-argument").map((entry) => entry.message);
    expect(errors('latest({"loinc": "1-1"}, {"withinMinutes": 60, "statuses": ["final"]})')).toEqual([]);
    expect(errors("latest(5)")[0]).toMatch(/observation first/);
    expect(errors('latest({"snomed": "1"})')[0]).toMatch(/observation first/);
    expect(errors('latest({"loinc": "1", "snomed": "2"})')[0]).toMatch(/does not know the observation key "snomed"/);
    expect(errors('latest({"system": "urn:s"})').length).toBeGreaterThan(0);
    expect(errors('latest({"loinc": "1"}, {"within": 5})')[0]).toMatch(/does not know the option "within"/);
    expect(errors('latest({"loinc": "1"}, {"statuses": ["done"]})')[0]).toMatch(/result statuses/);
    expect(errors('latest({"loinc": "1"}, {"required": "yes"})')[0]).toMatch(/true or false/);
    expect(latestTermProblems({ kind: "call", fn: "latest", args: [] })).toHaveLength(1);
  });

  it("takes its type from the fallback, else is unknown", () => {
    expect(inferFormulaType(parseFormulaOrThrow('latest({"loinc": "1"}, {"fallback": 0})'))).toBe("number");
    expect(inferFormulaType(parseFormulaOrThrow('latest({"loinc": "1"})'))).toBe("unknown");
    expect(checkFormula(parseFormulaOrThrow('latest({"loinc": "1"}) * 2'))).toEqual([]);
  });

  it("counts a required result that is missing as an incomplete input", () => {
    const formula = parseFormulaOrThrow('latest({"loinc": "29463-7"}, {"withinMinutes": 60}) + latest({"loinc": "0000-0"}, {"fallback": 1})');
    const observations = chartRecordReader(chart);
    expect(missingChartResults(formula, { observations, now }).map((term) => term.withinMinutes)).toEqual([60]);
    expect(missingChartResults(parseFormulaOrThrow('latest({"loinc": "29463-7"})'), { observations, now })).toEqual([]);
    expect(kit.hasAllReferencedValues(formula, {}, { observations: chart, now })).toBe(false);
    expect(kit.hasAllReferencedValues('latest({"loinc": "29463-7"}) + [a]', { a: 1 }, { observations: chart, now })).toBe(true);
    expect(kit.hasAllReferencedValues('latest({"loinc": "29463-7"}) + [a]', {}, { observations: chart, now })).toBe(false);
    expect(kit.latestTerms('latest({"loinc": "1"}) + latest({"mois": "2"})')).toHaveLength(2);
  });

  it("takes the latest dated result, an undated one only when nothing dated counts", () => {
    const term = { observation: { codings: [] } };
    const at = now.getTime();
    expect(selectLatestResult([{ value: 1 }, { value: 2, date: "2026-09-01" }], term, at)?.value).toBe(2);
    expect(selectLatestResult([{ value: 1 }], term, at)?.value).toBe(1);
    expect(selectLatestResult([{ value: 1 }], { ...term, withinMinutes: 10 }, at)).toBeUndefined();
    expect(selectLatestResult([{ value: "" , date: "2026-09-26" }, { value: 3, date: "2026-09-20" }], term, at)?.value).toBe(3);
    expect(selectLatestResult([{ value: 4, date: new Date(2026, 8, 26, 10) }], { ...term, withinMinutes: 31 }, at)?.value).toBe(4);
  });

  it("never throws when the host's chart does", () => {
    const formula = parseFormulaOrThrow('latest({"loinc": "1"}, {"fallback": 7})');
    const env = formulaEnvFromValues({}, { observations: () => { throw new Error("offline"); } });
    expect(evaluateFormula(formula, env)).toBe(7);
  });

  it("walks like any call: the fallback's field references are references", () => {
    const node: FormulaNode = latestFormulaNode({ observation: { loinc: "1" }, fallback: { kind: "ref", id: "w" } });
    expect(kit.references({ v: 1, expr: node })).toEqual(["w"]);
  });
});
