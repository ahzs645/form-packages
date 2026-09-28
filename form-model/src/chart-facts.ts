import type { BuilderField } from "./index";

/**
 * Chart facts: patient attributes a condition can read straight from the
 * chart, with no hidden field on the form (docs/.../architecture/chart-facts.md).
 *
 * A condition names one by a reserved controller id (`chart:patient.sex`,
 * `chart:patient.ageYears` …) wherever it would name a field: show-when rules,
 * required-when, validations, and the rules that show or disable a choice's
 * answers (`behavior.optionRules`). Every evaluator reads condition values
 * from a record keyed by controller id, so a runtime supports chart facts by
 * adding `chartFactValues(patient)` to that record (in NHForms,
 * `FormLogicKit.withChartFacts`). Nothing is written to the form's answers:
 * a chart fact is read when the rule runs, never saved.
 *
 * Ages count completed units from the birth date to the time the form is
 * filled in (`asOf`), so a band "from 13 to 18 years" is `ageYears >= 13` and
 * `ageYears < 18`. Sex uses FHIR AdministrativeGender codes.
 */

export const CHART_FACT_PREFIX = "chart:";

export type ChartFactSex = "female" | "male" | "other" | "unknown";
export type ChartFactAgeUnit = "years" | "months" | "weeks" | "days" | "hours";

export const CHART_FACT_AGE_IDS = {
  years: "chart:patient.ageYears",
  months: "chart:patient.ageMonths",
  weeks: "chart:patient.ageWeeks",
  days: "chart:patient.ageDays",
  hours: "chart:patient.ageHours",
} as const satisfies Record<ChartFactAgeUnit, string>;

export const CHART_FACT_SEX_ID = "chart:patient.sex";

export type ChartFactId = typeof CHART_FACT_SEX_ID | (typeof CHART_FACT_AGE_IDS)[ChartFactAgeUnit];

export interface ChartFactDefinition {
  id: ChartFactId;
  label: string;
  kind: "choice" | "number";
  options?: ReadonlyArray<{ value: ChartFactSex; label: string }>;
}

export const CHART_FACT_SEX_OPTIONS: ReadonlyArray<{ value: ChartFactSex; label: string }> = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

export const CHART_FACTS: readonly ChartFactDefinition[] = [
  { id: CHART_FACT_SEX_ID, label: "Patient's sex (from the chart)", kind: "choice", options: CHART_FACT_SEX_OPTIONS },
  { id: CHART_FACT_AGE_IDS.years, label: "Patient's age in years (from the chart)", kind: "number" },
  { id: CHART_FACT_AGE_IDS.months, label: "Patient's age in months (from the chart)", kind: "number" },
  { id: CHART_FACT_AGE_IDS.weeks, label: "Patient's age in weeks (from the chart)", kind: "number" },
  { id: CHART_FACT_AGE_IDS.days, label: "Patient's age in days (from the chart)", kind: "number" },
  { id: CHART_FACT_AGE_IDS.hours, label: "Patient's age in hours (from the chart)", kind: "number" },
];

const FACT_BY_ID = new Map<string, ChartFactDefinition>(CHART_FACTS.map((fact) => [fact.id, fact]));

/** Whether a controller id names a chart fact rather than a field. */
export function isChartFactId(id: unknown): id is ChartFactId {
  return typeof id === "string" && FACT_BY_ID.has(id);
}

export function chartFactDefinition(id: string): ChartFactDefinition | undefined {
  return FACT_BY_ID.get(id);
}

/** The patient a chart fact is read from. */
export interface ChartFactPatient {
  /** Any spelling: "F", "female", a coding `{ code: "F" }`. */
  sex?: unknown;
  /** A calendar date (YYYY-MM-DD) or a date-time. */
  birthDate?: unknown;
}

/** A sex in any spelling, as an AdministrativeGender code. */
export function chartFactSex(raw: unknown): ChartFactSex | undefined {
  const value = raw && typeof raw === "object"
    ? (raw as { code?: unknown; value?: unknown; display?: unknown }).code ?? (raw as { value?: unknown }).value ?? (raw as { display?: unknown }).display
    : raw;
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!key) return undefined;
  if (key.startsWith("f")) return "female";
  if (key.startsWith("m")) return "male";
  // Undifferentiated (Cerner, HL7 v2 "A") is AdministrativeGender "other".
  if (key.startsWith("o") || key.startsWith("und") || key === "a") return "other";
  if (key.startsWith("u")) return "unknown";
  return undefined;
}

/** A birth date as a local calendar day (a date-only string is not UTC midnight). */
function birthDateOf(raw: unknown): Date | undefined {
  const value = raw && typeof raw === "object" && !(raw instanceof Date)
    ? (raw as { value?: unknown }).value ?? (raw as { code?: unknown }).code
    : raw;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const match = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(value.trim());
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

/** Completed calendar months from `from` to `to`. */
function completedMonths(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

/** The patient's age in completed units at `asOf` (default now); undefined without a birth date. */
export function chartFactAge(birthDate: unknown, unit: ChartFactAgeUnit, asOf: Date = new Date()): number | undefined {
  const birth = birthDateOf(birthDate);
  if (!birth || asOf < birth) return undefined;
  switch (unit) {
    case "years": return Math.floor(completedMonths(birth, asOf) / 12);
    case "months": return completedMonths(birth, asOf);
    case "weeks": return Math.floor((asOf.getTime() - birth.getTime()) / (7 * 86_400_000));
    case "days": return Math.floor((asOf.getTime() - birth.getTime()) / 86_400_000);
    case "hours": return Math.floor((asOf.getTime() - birth.getTime()) / 3_600_000);
  }
}

/** Every chart fact's value for a patient, keyed by controller id; a fact the chart lacks is left out. */
export function chartFactValues(patient: ChartFactPatient | null | undefined, asOf: Date = new Date()): Partial<Record<ChartFactId, string | number>> {
  const values: Partial<Record<ChartFactId, string | number>> = {};
  const sex = chartFactSex(patient?.sex);
  if (sex) values[CHART_FACT_SEX_ID] = sex;
  for (const unit of Object.keys(CHART_FACT_AGE_IDS) as ChartFactAgeUnit[]) {
    const age = chartFactAge(patient?.birthDate, unit, asOf);
    if (age !== undefined) values[CHART_FACT_AGE_IDS[unit]] = age;
  }
  return values;
}

/**
 * The chart facts as condition controllers for the rule editors: a choice
 * for sex and numbers for age. They are offered beside the form's fields and
 * are never added to the form.
 */
export function chartFactControllerFields(): BuilderField[] {
  return CHART_FACTS.map((fact) => ({
    id: fact.id,
    label: fact.label,
    type: fact.kind === "choice" ? "choice" : "number",
    ...(fact.options ? { options: fact.options.map((option) => ({ label: option.label, value: option.value })) } : {}),
  }) as BuilderField);
}

/** The chart facts a condition group (or several) reads. */
export function chartFactsInConditions(value: unknown): ChartFactId[] {
  const found = new Set<ChartFactId>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    for (const [key, entry] of Object.entries(node as Record<string, unknown>)) {
      if ((key === "controllerFieldId" || key === "controllerId" || key === "compareFieldId" || key === "valueFieldId") && isChartFactId(entry)) found.add(entry);
      else if (entry && typeof entry === "object") visit(entry);
    }
  };
  visit(value);
  return [...found];
}
