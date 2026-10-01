/**
 * Chart facts in formulas: a field reference may name a chart fact
 * (../chart-facts.ts, docs/.../architecture/chart-facts.md) by its reserved
 * controller id, as conditions do:
 *
 *   [chart:patient.sex] == "female"
 *   dateAdd([chart:patient.birthDate], 18, "years") <= today()
 *   [chart:patient.ageYears] >= 65
 *   [chart:patient.concept.DIABETES] == "yes"
 *
 * The evaluator reads every reference through the host's `getValue`, so a
 * host supports these by answering chart-fact ids from the chart (NHForms:
 * `FormLogicKit.withChartFacts`; elsewhere `chartFactValues(patient)` merged
 * into the answers). Nothing is written to the form's answers. Such a
 * reference is never "a field that is not on the form".
 *
 * Self-contained (no imports): scripts/generate-formula-kit.mjs bundles it
 * into the NHForms FormulaKit with the evaluator.
 */

export const FORMULA_CHART_FACT_PREFIX = "chart:patient.";

/** Whether a reference names a chart fact rather than a field. */
export function isFormulaChartFactRef(id: unknown): id is string {
  return typeof id === "string" && id.startsWith(FORMULA_CHART_FACT_PREFIX) && id.length > FORMULA_CHART_FACT_PREFIX.length;
}

/**
 * The value type a chart fact holds, as a builder field type: the birth date
 * is a date, ages are numbers, sex and concept facts are codes
 * (`female`, `yes`). Undefined for anything else.
 */
export function formulaChartFactKind(id: string): "date" | "number" | "text" | undefined {
  if (!isFormulaChartFactRef(id)) return undefined;
  const name = id.slice(FORMULA_CHART_FACT_PREFIX.length);
  if (name === "birthDate") return "date";
  if (/^age(?:Years|Months|Weeks|Days|Hours)$/.test(name)) return "number";
  if (name === "sex" || name.startsWith("concept.")) return "text";
  return undefined;
}
