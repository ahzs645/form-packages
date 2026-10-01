/**
 * The NHForms `FormulaKit` API, implemented on the reference evaluator.
 *
 * scripts/generate-formula-kit.mjs bundles this module (with the parser,
 * printer, evaluator and ../values) into
 * packages/form-components/src/nhforms/FormulaKit/index.jsx; every export
 * here becomes a member of the `FormulaKit` namespace, so the exported MOIS
 * form computes exactly what the builder does. Keep it plain ECMAScript: no
 * Node or DOM APIs and no `eval` / `new Function`.
 *
 * - `evaluateTree(formula, getValue, options)` evaluates a stored formula
 *   tree (the exporter emits one per calculation).
 * - `parse(text, options)` reads formula text in any repo dialect.
 * - `evaluate`, `extractReferences`, `hasAllReferencedValues`,
 *   `toNumericValue`, `toComparableValue`, `hasValue` and `roundValue` keep
 *   the names the NHForms components used before the kit was generated; they
 *   now run on the same engine.
 */

import { formulaReferences, formulaRequiredReferences, isStoredFormula, walkFormula, type FormulaDiagnostic, type FormulaNode, type StoredFormula } from "./ast";
import { chartRecordReader, readLatestTerm, type FormulaChartRecord, type FormulaObservationReader, type LatestTerm } from "./chart-results";
import {
  evaluateFormula,
  formulaAnswerNumber,
  formulaAnswerOutput,
  isBlankFormulaAnswer,
  missingChartResults,
  roundFormulaNumber,
  type FormulaEnv,
  type FormulaIncompleteMode,
} from "./evaluate";
import { parseFormula, type ParseFormulaOptions } from "./parse";
import { printFormula } from "./print";

/** Answers: a lookup function or a plain record by field id. */
export type FormulaKitValues = ((fieldId: string) => unknown) | Readonly<Record<string, unknown>> | null | undefined;

export interface FormulaKitOptions {
  /** Option score maps by field id, for `score([id])` without a map. */
  scoreMaps?: FormulaEnv["scoreMaps"];
  /** The clock for today() and now(). */
  now?: Date;
  /** The time the answer is documented for, which `latest()` windows count from; `now` when omitted. */
  referenceTime?: Date;
  /** `blank` (default): a missing input blanks the result; `compute-anyway`: it counts as 0. */
  incomplete?: FormulaIncompleteMode;
  /** The builder field type of a referenced field (dates, yes/no, single checkboxes). */
  fieldKind?(fieldId: string): string | undefined;
  /** The same as a record, as the MOIS exporter emits it; used when `fieldKind` is omitted. */
  fieldKinds?: Readonly<Record<string, string>> | null;
  /** Host functions such as zScore. */
  functions?: FormulaEnv["functions"];
  /** Template slots and chart paths. */
  getParam?(name: string): unknown;
  /** The field that owns the formula: a formula that reads it is blank. */
  selfId?: string | null;
  /** The patient's chart for `latest()`: a reader, or plain records (MOIS `patient.observations`). */
  observations?: FormulaObservationReader | ReadonlyArray<FormulaChartRecord> | null;
}

export interface FormulaKitParseResult {
  formula: StoredFormula | null;
  errors: FormulaDiagnostic[];
  warnings: FormulaDiagnostic[];
}

const isNode = (value: unknown): value is FormulaNode =>
  Boolean(value && typeof value === "object" && typeof (value as { kind?: unknown }).kind === "string");

function valueGetter(values: FormulaKitValues): (fieldId: string) => unknown {
  if (typeof values === "function") return values;
  if (!values || typeof values !== "object") return () => undefined;
  return (fieldId) => (Object.prototype.hasOwnProperty.call(values, fieldId) ? values[fieldId] : undefined);
}

function kindGetter(options: FormulaKitOptions): ((fieldId: string) => string | undefined) | undefined {
  if (typeof options.fieldKind === "function") return options.fieldKind;
  const kinds = options.fieldKinds;
  if (!kinds || typeof kinds !== "object") return undefined;
  return (fieldId) => (Object.prototype.hasOwnProperty.call(kinds, fieldId) ? kinds[fieldId] : undefined);
}

// Formula text re-renders on every keystroke of the form; parse each text once.
const PARSE_CACHE = new Map<string, FormulaKitParseResult>();
const PARSE_CACHE_LIMIT = 500;

/** Parse formula text (any repo dialect) into a stored formula. Never throws. */
export function parse(text: string, options?: ParseFormulaOptions): FormulaKitParseResult {
  const source = typeof text === "string" ? text : "";
  if (options) return parseFormula(source, options);
  const cached = PARSE_CACHE.get(source);
  if (cached) return cached;
  const result = parseFormula(source);
  if (PARSE_CACHE.size >= PARSE_CACHE_LIMIT) PARSE_CACHE.clear();
  PARSE_CACHE.set(source, result);
  return result;
}

/** A stored formula from a tree, a bare node or formula text; null when there is none. */
function toFormula(formula: unknown): StoredFormula | FormulaNode | null {
  if (isStoredFormula(formula) || isNode(formula)) return formula;
  if (typeof formula === "string") return parse(formula).formula;
  return null;
}

/** Canonical text for a stored formula. */
export function print(formula: StoredFormula | FormulaNode): string {
  return printFormula(formula);
}

/** Field ids a formula (tree or text) reads, in first-use order. */
export function references(formula: unknown): string[] {
  const resolved = toFormula(formula);
  return resolved ? formulaReferences(resolved) : [];
}

/**
 * Evaluate a stored formula tree over the form's answers. Returns plain
 * values (numbers, text, booleans, dates as `YYYY-MM-DD`, lists as arrays)
 * and null for a blank result. Never throws.
 */
export function evaluateTree(formula: unknown, getValue: FormulaKitValues, options: FormulaKitOptions = {}): unknown {
  const resolved = isStoredFormula(formula) || isNode(formula) ? formula : null;
  if (!resolved) return null;
  if (options.selfId && formulaReferences(resolved).includes(options.selfId)) return null;
  return evaluateFormula(resolved, {
    getValue: valueGetter(getValue),
    getParam: options.getParam,
    scoreMaps: options.scoreMaps,
    now: options.now,
    referenceTime: options.referenceTime,
    fieldKind: kindGetter(options),
    functions: options.functions,
    incomplete: options.incomplete,
    observations: observationReader(options.observations),
  });
}

/** A chart reader from a reader or plain records; undefined when there is no chart. */
function observationReader(observations: FormulaKitOptions["observations"]): FormulaObservationReader | undefined {
  if (typeof observations === "function") return observations;
  if (Array.isArray(observations)) return chartRecordReader(observations);
  return undefined;
}

/**
 * Whether every input the formula needs has a value (the "incomplete" test):
 * every field it reads where a blank one blanks it (`formulaRequiredReferences`:
 * not where the formula says what a blank one means, with hasValue(),
 * coalesce() or ifPresent()), and
 * every required `latest()` result.
 */
export function hasAllReferencedValues(formula: unknown, values: FormulaKitValues, options: FormulaKitOptions = {}): boolean {
  const get = valueGetter(values);
  const kind = kindGetter(options);
  const resolved = toFormula(formula);
  const needed = resolved ? formulaRequiredReferences(resolved) : [];
  if (!needed.every((fieldId) => !isBlankFormulaAnswer(get(fieldId), kind?.(fieldId)))) return false;
  if (!resolved || latestTerms(resolved).length === 0) return true;
  return missingChartResults(resolved, { observations: observationReader(options.observations), now: options.now, referenceTime: options.referenceTime }).length === 0;
}

/** The `latest()` terms a formula (tree or text) reads: a form needs the patient's chart for them. */
export function latestTerms(formula: unknown): LatestTerm[] {
  const resolved = toFormula(formula);
  const terms: LatestTerm[] = [];
  if (!resolved) return terms;
  walkFormula(resolved, (node) => {
    const term = node.kind === "call" && node.fn === "latest" ? readLatestTerm(node) : null;
    if (term) terms.push(term);
  });
  return terms;
}

/** A chart reader over plain records: MOIS observations (`observationCode`, `loincCode`, `collectedDateTime`) or FHIR-style chart records. */
export function chartReader(records: ReadonlyArray<FormulaChartRecord> | null | undefined): FormulaObservationReader {
  return chartRecordReader(records);
}

// ── The names NHForms components used before the kit was generated ─────────

/**
 * Evaluate formula text (or a tree) over answers by field id. Blank when the
 * formula reads `currentFieldId`, and for results other than a number, text
 * or yes/no, which a computed answer cannot store.
 */
export function evaluate(
  expression: unknown,
  valuesByFieldId: FormulaKitValues,
  currentFieldId?: string | null,
  options: FormulaKitOptions = {},
): unknown {
  const formula = toFormula(expression);
  if (!formula) return null;
  const result = evaluateTree(formula, valuesByFieldId, { ...options, selfId: currentFieldId ?? options.selfId });
  if (typeof result === "number") return Number.isFinite(result) ? result : null;
  return typeof result === "string" || typeof result === "boolean" ? result : null;
}

/** Field ids a formula reads. */
export function extractReferences(formula: unknown): string[] {
  return references(formula);
}

/** A stored answer as a number, the way arithmetic reads it; null when it is not one. */
export function toNumericValue(value: unknown): number | null {
  return formulaAnswerNumber(value);
}

/** A stored answer as a plain value (a choice as its code), or "" when blank. */
export function toComparableValue(value: unknown): unknown {
  return formulaAnswerOutput(value) ?? "";
}

/** Whether a stored answer counts as answered (whitespace-only text and empty lists do not). */
export function hasValue(value: unknown): boolean {
  return !isBlankFormulaAnswer(value);
}

/**
 * Apply a field's precision: numbers round like `round(value, precision)`,
 * text and yes/no pass through, anything else is blank. A missing or
 * negative precision leaves the number as it is.
 */
export function roundValue(value: unknown, precision?: unknown): unknown {
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (typeof precision !== "number" || !Number.isFinite(precision) || precision < 0) return value;
  return roundFormulaNumber(value, Math.round(precision));
}
