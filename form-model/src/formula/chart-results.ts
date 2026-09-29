/**
 * The patient's latest charted result as a formula term:
 *
 *   latest({"loinc": "29463-7"})
 *   latest({"dta": "Weight Dosing", "unit": "kg"}, {"withinMinutes": 1440, "fallback": 0})
 *
 * A registry function (`latest`) over two literal maps, so the grammar, the
 * printer and every tree walker need nothing new. The first map names the
 * observation with the identity chart bindings use (bindings.ts,
 * docs/.../architecture/chart-bindings.md): a concept, a LOINC or MOIS
 * observation code, a Cerner DTA (which a target resolves through the
 * reviewed Cerner ↔ MOIS ↔ LOINC crosswalk), or a code in another system,
 * and optionally the unit a result must be in. The second says which result
 * counts and what a missing one means.
 *
 * | Observation key | Coding |
 * | --- | --- |
 * | `loinc` | `http://loinc.org` |
 * | `mois` | `urn:mois:observation` (a MOIS observation code) |
 * | `dta` | `urn:webforms:cerner:dta` (a Cerner DTA mnemonic) |
 * | `system` + `code` | any other code system |
 * | `concept` | a concept catalog id (`vital.weight`), resolved by the host |
 * | `unit` | not an identity: a result in another unit does not count |
 *
 * | Option | Meaning |
 * | --- | --- |
 * | `withinMinutes` | Only results charted at most this long before now count (no limit when absent). |
 * | `aheadMinutes` | Results up to this long after now count too (a Cerner look-ahead; 0 when absent). |
 * | `statuses` | Result statuses that count (FHIR ObservationStatus codes: `preliminary`, `final`, `amended`, `corrected`). A result that carries no status counts. When absent, every result counts except `entered-in-error` and `cancelled`. |
 * | `fallback` | The value when no result counts (any formula). |
 * | `required` | Whether the formula needs a result: true unless a fallback is given. |
 *
 * Missing: no result and no fallback reads like an unanswered field (blank,
 * or 0 under the compute-anyway policy), and a required result that is
 * missing makes the formula incomplete (`missingChartResults`, used by
 * `FormulaKit.hasAllReferencedValues`).
 *
 * Self-contained (type imports only): scripts/generate-formula-kit.mjs
 * bundles it into the NHForms FormulaKit with the evaluator.
 */

import type { FormulaMapEntry, FormulaNode } from "./ast";

export const FORMULA_LOINC_SYSTEM = "http://loinc.org";
export const FORMULA_MOIS_OBSERVATION_SYSTEM = "urn:mois:observation";
/** A Cerner DTA by its mnemonic (the key the reviewed crosswalk and Equation Tool components use). */
export const FORMULA_CERNER_DTA_SYSTEM = "urn:webforms:cerner:dta";

/** The observation keys that are code systems, in the order they are written. */
export const LATEST_OBSERVATION_SYSTEMS: Readonly<Record<"loinc" | "mois" | "dta", string>> = {
  loinc: FORMULA_LOINC_SYSTEM,
  mois: FORMULA_MOIS_OBSERVATION_SYSTEM,
  dta: FORMULA_CERNER_DTA_SYSTEM,
};

const OBSERVATION_KEYS = ["concept", "loinc", "mois", "dta", "system", "code", "unit"] as const;
/** Keys that may name several codes of one reading. */
const CODE_LIST_KEYS = ["loinc", "mois", "dta"] as const;
const OPTION_KEYS = ["withinMinutes", "aheadMinutes", "statuses", "required", "fallback"] as const;

/** FHIR ObservationStatus codes a `statuses` option may list. */
export const LATEST_RESULT_STATUSES = ["registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"] as const;
/** Results that never count unless `statuses` names them. */
const NEVER_COUNTED = new Set(["entered-in-error", "cancelled"]);

export interface FormulaObservationCoding {
  system: string;
  code: string;
}

/** Which observation a `latest()` term reads. */
export interface FormulaObservation {
  /** Every coding the term names, in preference order (LOINC, MOIS, Cerner DTA, other). */
  codings: FormulaObservationCoding[];
  concept?: string;
  /** Results must be in this unit (compared without case or spaces) when they carry one. */
  unit?: string;
}

/** A `latest()` term, read from its call node. */
export interface LatestTerm {
  observation: FormulaObservation;
  withinMinutes?: number;
  aheadMinutes?: number;
  statuses?: string[];
  /** The value when no result counts. */
  fallback?: FormulaNode;
  /** A missing result makes the formula incomplete: true unless a fallback is given or `required: false`. */
  required: boolean;
}

/** One result the host found for an observation. */
export interface FormulaChartResult {
  value: unknown;
  /** When it was charted (clinically): ISO text, epoch milliseconds or a Date. */
  date?: string | number | Date | null;
  status?: string | null;
  unit?: string | null;
}

/** The host's chart: every result it has for an observation (any order). */
export type FormulaObservationReader = (observation: FormulaObservation) => ReadonlyArray<FormulaChartResult> | null | undefined;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function literalText(node: FormulaNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.kind === "text") return node.value.trim() || undefined;
  if (node.kind === "number" && Number.isFinite(node.value)) return String(node.value);
  return undefined;
}

function literalNumber(node: FormulaNode | undefined): number | undefined {
  if (!node) return undefined;
  if (node.kind === "number") return Number.isFinite(node.value) ? node.value : undefined;
  if (node.kind === "text" && /^\s*\d+(?:\.\d+)?\s*$/.test(node.value)) return Number(node.value);
  return undefined;
}

/** A literal, or each literal of a list. */
function literalTexts(node: FormulaNode | undefined): string[] {
  if (node?.kind === "list") return node.items.map(literalText).filter((code): code is string => Boolean(code));
  const one = literalText(node);
  return one ? [one] : [];
}

function mapEntry(node: FormulaNode | undefined, key: string): FormulaNode | undefined {
  if (!node || node.kind !== "map") return undefined;
  return node.entries.find((entry) => entry.key === key)?.value;
}

/** Codings from an observation map, in the order LOINC, MOIS, DTA, other. */
function observationOf(node: FormulaNode | undefined): FormulaObservation | null {
  if (!node) return null;
  if (node.kind === "text") {
    // `latest("http://loinc.org|29463-7")`: the FHIR token form, accepted when read.
    const bar = node.value.indexOf("|");
    if (bar <= 0 || bar === node.value.length - 1) return null;
    return { codings: [{ system: node.value.slice(0, bar).trim(), code: node.value.slice(bar + 1).trim() }] };
  }
  if (node.kind !== "map") return null;
  const codings: FormulaObservationCoding[] = [];
  for (const key of ["loinc", "mois", "dta"] as const) {
    // One code, or a list of codes that are the same reading (MOIS's HGBA1C
    // is 128, 10487, 10488 … — lib/mois-concepts.ts); a result under any counts.
    for (const code of literalTexts(mapEntry(node, key))) {
      if (!codings.some((coding) => coding.system === LATEST_OBSERVATION_SYSTEMS[key] && coding.code === code)) {
        codings.push({ system: LATEST_OBSERVATION_SYSTEMS[key], code });
      }
    }
  }
  const system = literalText(mapEntry(node, "system"));
  const code = literalText(mapEntry(node, "code"));
  if (system && code && !codings.some((coding) => coding.system === system && coding.code === code)) codings.push({ system, code });
  const concept = literalText(mapEntry(node, "concept"));
  const unit = literalText(mapEntry(node, "unit"));
  if (codings.length === 0 && !concept) return null;
  return { codings, ...(concept ? { concept } : {}), ...(unit ? { unit } : {}) };
}

/** The `latest()` term a call node holds, or null when it is not one (or is malformed). */
export function readLatestTerm(node: FormulaNode): LatestTerm | null {
  if (node.kind !== "call" || node.fn !== "latest" || node.args.length < 1 || node.args.length > 2) return null;
  const observation = observationOf(node.args[0]);
  if (!observation) return null;
  const options = node.args[1];
  if (options && options.kind !== "map") return null;
  const term: LatestTerm = { observation, required: true };
  const within = literalNumber(mapEntry(options, "withinMinutes"));
  if (within !== undefined && within > 0) term.withinMinutes = within;
  const ahead = literalNumber(mapEntry(options, "aheadMinutes"));
  if (ahead !== undefined && ahead > 0) term.aheadMinutes = ahead;
  const statuses = mapEntry(options, "statuses");
  if (statuses) {
    const list = statuses.kind === "list" ? statuses.items : [statuses];
    const codes = list.map(literalText).filter((code): code is string => Boolean(code)).map((code) => code.toLowerCase());
    if (codes.length > 0) term.statuses = codes;
  }
  const fallback = mapEntry(options, "fallback");
  if (fallback && fallback.kind !== "null") term.fallback = fallback;
  const required = mapEntry(options, "required");
  term.required = required && required.kind === "boolean" ? required.value && !term.fallback : !term.fallback;
  return term;
}

/** Problems with a `latest()` call's arguments, worded for authors; empty when it is well formed. */
export function latestTermProblems(node: Extract<FormulaNode, { kind: "call" }>): string[] {
  const problems: string[] = [];
  const [observation, options] = node.args;
  if (!observation || !observationOf(observation)) {
    problems.push('latest() needs the observation first, such as {"loinc": "29463-7"} or {"dta": "Weight Dosing"}.');
  } else if (observation.kind === "map") {
    for (const entry of observation.entries) {
      if (!(OBSERVATION_KEYS as readonly string[]).includes(entry.key)) problems.push(`latest() does not know the observation key "${entry.key}"; use ${OBSERVATION_KEYS.join(", ")}.`);
      else if (entry.value.kind === "list" && (CODE_LIST_KEYS as readonly string[]).includes(entry.key)) {
        if (entry.value.items.length === 0 || entry.value.items.some((item) => literalText(item) === undefined)) problems.push(`latest()'s "${entry.key}" list must hold codes written as text.`);
      } else if (literalText(entry.value) === undefined) problems.push(`latest()'s "${entry.key}" must be written as text.`);
    }
    const hasSystem = observation.entries.some((entry) => entry.key === "system");
    const hasCode = observation.entries.some((entry) => entry.key === "code");
    if (hasSystem !== hasCode) problems.push('latest() needs "system" and "code" together.');
  }
  if (options) {
    if (options.kind !== "map") problems.push('latest()\'s options are a map, such as {"withinMinutes": 1440}.');
    else {
      for (const entry of options.entries) {
        if (!(OPTION_KEYS as readonly string[]).includes(entry.key)) {
          problems.push(`latest() does not know the option "${entry.key}"; use ${OPTION_KEYS.join(", ")}.`);
          continue;
        }
        if ((entry.key === "withinMinutes" || entry.key === "aheadMinutes") && (literalNumber(entry.value) === undefined || literalNumber(entry.value)! < 0)) {
          problems.push(`latest()'s "${entry.key}" must be a number of minutes, 0 or more.`);
        }
        if (entry.key === "required" && entry.value.kind !== "boolean") problems.push('latest()\'s "required" must be true or false.');
        if (entry.key === "statuses") {
          const list = entry.value.kind === "list" ? entry.value.items : [entry.value];
          const unknown = list.map(literalText).filter((code) => !code || !(LATEST_RESULT_STATUSES as readonly string[]).includes(code.toLowerCase()));
          if (unknown.length) problems.push(`latest()'s "statuses" are result statuses: ${LATEST_RESULT_STATUSES.join(", ")}.`);
        }
      }
    }
  }
  return problems;
}

function entry(key: string, value: FormulaNode): FormulaMapEntry {
  return { key, value };
}

/**
 * The call node for a term: keys in a fixed order, options only when they
 * say something, so a term written twice prints the same.
 */
export function latestFormulaNode(term: {
  /** `mois` may list every code of one reading, the preferred first. */
  observation: { loinc?: string; mois?: string | readonly string[]; dta?: string; system?: string; code?: string; concept?: string; unit?: string };
  withinMinutes?: number;
  aheadMinutes?: number;
  statuses?: readonly string[];
  fallback?: FormulaNode;
  required?: boolean;
}): FormulaNode {
  const text = (value: string): FormulaNode => ({ kind: "text", value });
  const observation: FormulaMapEntry[] = [];
  for (const key of ["concept", "loinc", "mois", "dta", "system", "code", "unit"] as const) {
    const raw = term.observation[key];
    const values = (Array.isArray(raw) ? raw : [raw]).map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean);
    const unique = [...new Set(values)];
    if (unique.length > 1) observation.push(entry(key, { kind: "list", items: unique.map((value) => text(value)) }));
    else if (unique.length === 1) observation.push(entry(key, text(unique[0]!)));
  }
  const options: FormulaMapEntry[] = [];
  if (isFiniteNumber(term.withinMinutes) && term.withinMinutes > 0) options.push(entry("withinMinutes", { kind: "number", value: term.withinMinutes }));
  if (isFiniteNumber(term.aheadMinutes) && term.aheadMinutes > 0) options.push(entry("aheadMinutes", { kind: "number", value: term.aheadMinutes }));
  if (term.statuses?.length) options.push(entry("statuses", { kind: "list", items: term.statuses.map((status) => text(status)) }));
  if (term.fallback && term.fallback.kind !== "null") options.push(entry("fallback", term.fallback));
  // Required is the default without a fallback; only its opposite is written.
  if (term.required === false && !(term.fallback && term.fallback.kind !== "null")) options.push(entry("required", { kind: "boolean", value: false }));
  const args: FormulaNode[] = [{ kind: "map", entries: observation }];
  if (options.length) args.push({ kind: "map", entries: options });
  return { kind: "call", fn: "latest", args };
}

/** The observation map of a term as plain keys (`loinc`, `mois`, `dta`, `system`/`code`, `concept`, `unit`). */
export function latestObservationKeys(observation: FormulaObservation): { loinc?: string; mois?: string; dta?: string; system?: string; code?: string; concept?: string; unit?: string } {
  const out: { loinc?: string; mois?: string; dta?: string; system?: string; code?: string; concept?: string; unit?: string } = {};
  for (const coding of observation.codings) {
    if (coding.system === FORMULA_LOINC_SYSTEM && !out.loinc) out.loinc = coding.code;
    else if (coding.system === FORMULA_MOIS_OBSERVATION_SYSTEM && !out.mois) out.mois = coding.code;
    else if (coding.system === FORMULA_CERNER_DTA_SYSTEM && !out.dta) out.dta = coding.code;
    else if (!out.system) {
      out.system = coding.system;
      out.code = coding.code;
    }
  }
  if (observation.concept) out.concept = observation.concept;
  if (observation.unit) out.unit = observation.unit;
  return out;
}

/** The code a term names in one system, if any. */
export function latestCode(observation: FormulaObservation, system: string): string | undefined {
  return observation.codings.find((coding) => coding.system === system)?.code;
}

function timeOf(value: FormulaChartResult["date"]): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  // Date-only text is a local calendar day; text with a time and no zone is local time.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])).getTime();
  const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(text);
  if (local) {
    const [, y, mo, d, h, mi, s = "0", ms = "0"] = local;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(ms.slice(0, 3).padEnd(3, "0"))).getTime();
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

const unitKey = (unit: unknown) => (typeof unit === "string" ? unit.replace(/\s+/g, "").toLowerCase() : "");

const hasValue = (value: unknown) => !(value === null || value === undefined || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0));

/**
 * The result a term takes from the host's results: the latest one (by
 * charted time; an undated result only when no dated one counts) inside the
 * window around `nowMs`, with a counted status and the term's unit, that has
 * a value. Undefined when none counts.
 */
export function selectLatestResult(results: ReadonlyArray<FormulaChartResult> | null | undefined, term: Pick<LatestTerm, "observation" | "withinMinutes" | "aheadMinutes" | "statuses">, nowMs: number): FormulaChartResult | undefined {
  if (!results || results.length === 0) return undefined;
  const earliest = term.withinMinutes ? nowMs - term.withinMinutes * 60_000 : -Infinity;
  const latest = nowMs + (term.aheadMinutes ?? 0) * 60_000;
  const wantedUnit = unitKey(term.observation.unit);
  const statuses = term.statuses?.map((status) => status.toLowerCase());
  let best: FormulaChartResult | undefined;
  let bestTime = -Infinity;
  let undated: FormulaChartResult | undefined;
  for (const result of results) {
    if (!result || !hasValue(result.value)) continue;
    const status = typeof result.status === "string" ? result.status.trim().toLowerCase() : "";
    if (status && (statuses ? !statuses.includes(status) : NEVER_COUNTED.has(status))) continue;
    if (wantedUnit && unitKey(result.unit) && unitKey(result.unit) !== wantedUnit) continue;
    const time = timeOf(result.date);
    if (time === null) {
      // A result with no time can't be placed in a window.
      if (!term.withinMinutes && !undated) undated = result;
      continue;
    }
    if (time < earliest || time > latest) continue;
    if (time >= bestTime) {
      best = result;
      bestTime = time;
    }
  }
  return best ?? undated;
}

/** Plain records a host can hand over as its chart (MOIS observations, FHIR-style chart records, test data). */
export interface FormulaChartRecord {
  value?: unknown;
  /** MOIS observation code. */
  observationCode?: unknown;
  loincCode?: unknown;
  /** Codings of the record (a FHIR-style chart). */
  codes?: ReadonlyArray<{ system?: unknown; code?: unknown }> | null;
  /** The record's display name; a Cerner DTA is also matched by it (the host's alias policy). */
  label?: unknown;
  date?: unknown;
  collectedDateTime?: unknown;
  status?: unknown;
  unit?: unknown;
  units?: unknown;
  kind?: unknown;
}

const lower = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value).trim().toLowerCase() : "");

/** Whether a record is a result of the observation: any coding matches (MOIS and LOINC by the record's own codes too). */
export function chartRecordMatches(record: FormulaChartRecord, observation: FormulaObservation): boolean {
  if (!record || typeof record !== "object") return false;
  if (record.kind !== undefined && record.kind !== "Observation") return false;
  const moisCode = lower(record.observationCode);
  const loincCode = lower(record.loincCode);
  const label = lower(record.label);
  for (const coding of observation.codings) {
    const code = lower(coding.code);
    if (!code) continue;
    if (coding.system === FORMULA_MOIS_OBSERVATION_SYSTEM && moisCode === code) return true;
    if (coding.system === FORMULA_LOINC_SYSTEM && loincCode === code) return true;
    if (coding.system === FORMULA_CERNER_DTA_SYSTEM && label === code) return true;
    for (const own of record.codes ?? []) {
      if (!own) continue;
      const system = typeof own.system === "string" ? own.system : "";
      if (lower(own.code) !== code) continue;
      if (system === coding.system) return true;
      // A domain-scoped DTA coding (`urn:webforms:cerner:T1978A:dta`) names the same DTA.
      if (coding.system === FORMULA_CERNER_DTA_SYSTEM && /^urn:webforms:cerner:[^:]+:dta$/.test(system)) return true;
    }
  }
  return false;
}

/** A reader over plain chart records (MOIS `patient.observations`, a FHIR-style chart's records). */
export function chartRecordReader(records: ReadonlyArray<FormulaChartRecord> | null | undefined): FormulaObservationReader {
  const list = Array.isArray(records) ? records : [];
  return (observation) =>
    list
      .filter((record) => chartRecordMatches(record, observation))
      .map((record) => ({
        value: record.value,
        date: (record.date ?? record.collectedDateTime ?? null) as FormulaChartResult["date"],
        status: typeof record.status === "string" ? record.status : null,
        unit: typeof record.unit === "string" ? record.unit : typeof record.units === "string" ? record.units : null,
      }));
}
