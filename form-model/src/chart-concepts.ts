/**
 * Chart concepts: a named clinical idea — DIABETES, CHF, ACEI, HGBA1C — and
 * the rules that decide which chart records belong to it
 * (docs/.../architecture/chart-concepts.md).
 *
 * The rules are MOIS Concept Mapping's (Administration ▸ Designer Section),
 * read from a site's Export Concepts file; the app's catalog is the TRAINING
 * export (lib/mois-concepts.ts). A concept is data about the chart, not about
 * the form, so the form stores only the concept's name — as the chart fact
 * `chart:patient.concept.<NAME>` (chart-facts.ts) — and an export embeds the
 * rules of the concepts it uses, because no MOIS API returns them.
 *
 * MATCHING — one rule set, three implementations kept in step:
 * this file, the NHForms FormLogicKit (parity test
 * lib/__tests__/form-logic-kit-chart-facts-parity.test.ts) and the MOIS
 * emulator (hosts/mois-classic/src/data/concepts.ts). A concept matches a
 * record when any one of its rules does.
 *   CODE  `code` against the field `codeField` names: the record's own code
 *         (MOIS), its ATC code (str_atc_code) or its measure class
 *         (str_class). A trailing `*` is a prefix wildcard, otherwise the
 *         whole code must match; case and ICD-9's dot are ignored (MOIS writes
 *         2899 for 289.9). A rule naming a code system only matches a record
 *         in that system when the record says which system it is in.
 *   TEXT  the record's description contains `include1` and, when set,
 *         `include2`, and does not contain `exclude` — case-blind substrings,
 *         spaces kept ("ACQUI " is not "ACQUIRED"); a string of only spaces
 *         counts as blank, and a rule with no include string matches nothing.
 *         A text rule's code system is not a filter.
 */

export type ChartConceptRuleType = "CODE" | "TEXT";

export interface ChartConceptRule {
  ruleType: ChartConceptRuleType;
  /** What a code rule's code is compared with: "MOIS" (the record's code), "str_atc_code", "str_class". */
  codeField: string;
  codeSystem?: string;
  code?: string;
  include1?: string;
  include2?: string;
  exclude?: string;
  /** The code's term, as MOIS shows it. */
  note?: string;
}

export interface ChartConceptDefinition {
  name: string;
  /** HEALTH ISSUE, MEDICATION, MEASURE, … */
  group: string;
  /** GRP (a group), SYM (a system concept), SYN (a synonym). */
  type?: string;
  description?: string;
  /** A Health Maintenance concept. */
  hm?: boolean;
  rules: ReadonlyArray<ChartConceptRule>;
}

/** What a chart record offers a rule. */
export interface ChartConceptTarget {
  code?: string | null;
  codeSystem?: string | null;
  atc?: string | null;
  measureClass?: string | null;
  description?: string | null;
}

const norm = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value).trim().toUpperCase() : "");
const systemKey = (value: unknown) => norm(value).replace(/[^A-Z0-9]/g, "");
const codeKey = (code: string, system: unknown) => (systemKey(system).startsWith("ICD") ? code.replace(/\./g, "") : code);
const filled = (value: string | undefined): value is string => typeof value === "string" && value.trim() !== "";

function codeMatches(pattern: string, value: string, system: unknown): boolean {
  const p = codeKey(norm(pattern), system);
  const v = codeKey(norm(value), system);
  if (!p || !v) return false;
  return p.endsWith("*") ? v.startsWith(p.slice(0, -1)) : v === p;
}

export function chartConceptRuleMatches(rule: ChartConceptRule, target: ChartConceptTarget): boolean {
  if (rule.ruleType === "TEXT") {
    const text = norm(target.description);
    const includes = [rule.include1, rule.include2].filter(filled).map((value) => value.toUpperCase());
    if (!text || includes.length === 0) return false;
    if (!includes.every((value) => text.includes(value))) return false;
    return !(filled(rule.exclude) && text.includes(rule.exclude.toUpperCase()));
  }
  const value = rule.codeField === "str_atc_code" ? target.atc : rule.codeField === "str_class" ? target.measureClass : target.code;
  if (!rule.code || !value) return false;
  if (rule.codeField === "MOIS" && rule.codeSystem && target.codeSystem && systemKey(rule.codeSystem) !== systemKey(target.codeSystem)) return false;
  return codeMatches(rule.code, value, rule.codeSystem ?? target.codeSystem ?? "");
}

export function chartConceptMatches(concept: Pick<ChartConceptDefinition, "rules">, target: ChartConceptTarget): boolean {
  return concept.rules.some((rule) => chartConceptRuleMatches(rule, target));
}

/* --- concepts as chart facts ------------------------------------------------ */

export const CHART_FACT_CONCEPT_PREFIX = "chart:patient.concept.";

/** The groups a condition can ask about, with the chart list each is read from. */
export const CHART_CONCEPT_FACT_GROUPS = {
  "HEALTH ISSUE": { list: "conditions", noun: "health issue", verb: "has" },
  MEDICATION: { list: "longTermMedications", noun: "medication", verb: "takes" },
} as const;

export type ChartConceptFactGroup = keyof typeof CHART_CONCEPT_FACT_GROUPS;

export const isChartConceptFactGroup = (group: unknown): group is ChartConceptFactGroup =>
  typeof group === "string" && Object.prototype.hasOwnProperty.call(CHART_CONCEPT_FACT_GROUPS, group);

/** `chart:patient.concept.DIABETES` — the concept's name as MOIS spells it, trimmed. */
export function chartConceptFactId(name: string): `chart:patient.concept.${string}` {
  return `${CHART_FACT_CONCEPT_PREFIX}${name.trim()}`;
}

export function isChartConceptFactId(id: unknown): id is `chart:patient.concept.${string}` {
  return typeof id === "string" && id.startsWith(CHART_FACT_CONCEPT_PREFIX) && id.length > CHART_FACT_CONCEPT_PREFIX.length;
}

/** The concept name a fact id reads, or undefined for any other id. */
export function chartConceptNameOf(id: unknown): string | undefined {
  return isChartConceptFactId(id) ? id.slice(CHART_FACT_CONCEPT_PREFIX.length) : undefined;
}

/** A concept by the name a fact carries (MOIS names can end in a space). */
export function findChartConcept(concepts: ReadonlyArray<ChartConceptDefinition>, name: string): ChartConceptDefinition | undefined {
  const key = name.trim().toUpperCase();
  return concepts.find((concept) => isChartConceptFactGroup(concept.group) && concept.name.trim().toUpperCase() === key)
    ?? concepts.find((concept) => concept.name.trim().toUpperCase() === key);
}

/** The label a concept fact shows in rule editors: "Patient has DIABETES (health issue, from the chart)". */
export function chartConceptFactLabel(name: string, group?: string): string {
  const kind = isChartConceptFactGroup(group) ? CHART_CONCEPT_FACT_GROUPS[group] : undefined;
  return kind ? `Patient ${kind.verb} ${name.trim()} (${kind.noun}, from the chart)` : `Patient's chart has ${name.trim()}`;
}

/**
 * The chart lists a concept fact reads, as MOIS returns them in
 * `patient { conditions longTermMedications }` (both in Mois.Query's full
 * chart selection). A plain `{ code, system, display }` record works too.
 */
export interface ChartConceptPatient {
  conditions?: ReadonlyArray<unknown> | null;
  longTermMedications?: ReadonlyArray<unknown> | null;
}

type Coded = { code?: unknown; system?: unknown; display?: unknown };
const coding = (value: unknown): Coded => (value && typeof value === "object" ? (value as Coded) : {});
const text = (value: unknown) => (typeof value === "string" ? value : value && typeof value === "object" ? String((value as Coded).display ?? (value as Coded).code ?? "") : "");

function dateOf(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value.trim().replace(/^(\d{4})\.(\d{2})\.(\d{2})/, "$1-$2-$3"));
  return Number.isFinite(date.getTime()) ? date : undefined;
}

/** A record still in force at `asOf`: no end date, or one after it. */
const current = (end: unknown, asOf: Date) => {
  const date = dateOf(end);
  return !date || date > asOf;
};

/**
 * The records a concept group is matched against: the chart's unresolved
 * health issues, or its current long-term medications. Undefined when the
 * chart does not carry the list at all (a fact the chart lacks).
 */
export function chartConceptTargets(group: string, patient: ChartConceptPatient | null | undefined, asOf: Date = new Date()): ChartConceptTarget[] | undefined {
  if (!patient || !isChartConceptFactGroup(group)) return undefined;
  if (group === "HEALTH ISSUE") {
    if (!Array.isArray(patient.conditions)) return undefined;
    return patient.conditions
      .filter((record): record is Record<string, unknown> => !!record && typeof record === "object")
      .filter((record) => current(record.resolveDate, asOf))
      .map((record) => {
        const own = record.condition && typeof record.condition === "object" ? coding(record.condition) : coding(record);
        return { code: text(own.code), codeSystem: text(own.system), description: text(own.display) || text(record.condition) };
      });
  }
  if (!Array.isArray(patient.longTermMedications)) return undefined;
  return patient.longTermMedications
    .filter((record): record is Record<string, unknown> => !!record && typeof record === "object")
    .filter((record) => current(record.endDate, asOf))
    .map((record) => ({
      code: text(coding(record.cdicCode).code ?? record.cdicCode),
      atc: text(coding(record.atcCode).code ?? record.atcCode),
      description: [text(record.medication), text(record.genericName)].filter(Boolean).join(" "),
    }));
}

/** "yes" when a current record on the chart belongs to the concept, "no" when none does, undefined when the chart lacks the list. */
export function chartConceptAnswer(concept: ChartConceptDefinition, patient: ChartConceptPatient | null | undefined, asOf: Date = new Date()): "yes" | "no" | undefined {
  const targets = chartConceptTargets(concept.group, patient, asOf);
  if (!targets) return undefined;
  return targets.some((target) => chartConceptMatches(concept, target)) ? "yes" : "no";
}
