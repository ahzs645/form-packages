/**
 * Reference evaluator for stored formulas.
 *
 * Plain ECMAScript on purpose: no Node or DOM APIs, no `eval` /
 * `new Function`, and runtime imports only from ../values (which is
 * self-contained). scripts/generate-formula-kit.mjs bundles this file into
 * the NHForms `FormulaKit`, so anything added here must stay portable.
 *
 * Stored answers are read with the same helpers as the rest of the model
 * (`readBoolean`, `readChoice`, `readDateTime` in ../values), so formulas,
 * conditions and exporters agree on yes/no words, option codes and dates.
 *
 * The semantics (missing values, coded answers, dates, rounding) are
 * specified in docs/starlight/src/content/docs/architecture/formula-semantics.md;
 * change both together.
 */

import { readBoolean, readChoice, readDateTime, type ChoiceValue } from "../values";
import type { FormulaNode, StoredFormula } from "./ast";

/**
 * What a calculation does with an unanswered input.
 *
 * - `blank` (the reference semantics): a missing input leaves the result
 *   blank unless the formula says otherwise (`coalesce`, `hasValue`, …).
 * - `compute-anyway`: a missing field answer counts as 0 wherever a number is
 *   needed (arithmetic, ordering against a number, `score()`, a condition,
 *   where it is false), and aggregates skip it, so a score total grows as
 *   questions are answered. Dates, text and equality still read it as blank.
 *   This is the computed field's "Calculate from what is answered" setting.
 */
export type FormulaIncompleteMode = "blank" | "compute-anyway";

export interface FormulaEnv {
  /** The stored answer of a field, in any shape a container saves. */
  getValue(fieldId: string): unknown;
  /** Template slots and chart paths (`{name}` nodes). Blank when omitted. */
  getParam?(name: string): unknown;
  /** Option score maps by field id, dual-keyed by code and label, for `score([id])`. */
  scoreMaps?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** The clock for today() and now(); the real clock when omitted. */
  now?: Date;
  /**
   * The builder field type (or a formula value type) of a field. Lets a
   * formula read date fields as dates and yes/no fields as booleans.
   */
  fieldKind?(fieldId: string): string | undefined;
  /** Host-supplied functions the reference evaluator cannot compute itself (zScore). */
  functions?: Readonly<Record<string, (...args: unknown[]) => unknown>>;
  /** How unanswered field inputs read; `blank` when omitted. */
  incomplete?: FormulaIncompleteMode;
}

// ── Runtime values ──────────────────────────────────────────────────────────

interface DateValue {
  $date: true;
  /** Epoch milliseconds; local midnight for a date-only value. */
  ms: number;
  dateOnly: boolean;
}

interface CodedValue {
  $coded: true;
  code?: string;
  value?: string | number | boolean;
  display?: string;
}

interface MapValue {
  $map: Record<string, Value>;
}

/**
 * An unanswered field input under `incomplete: "compute-anyway"`: blank for
 * everything except numbers (0), ordering against a number (0) and truth
 * (false). Only field references produce it.
 */
interface MissingInput {
  $missing: true;
}

type Value = null | MissingInput | number | string | boolean | DateValue | CodedValue | MapValue | Value[];

const MISSING_INPUT: MissingInput = { $missing: true };

const MS_PER_DAY = 86_400_000;
const MAX_DEPTH = 400;

const DURATION_UNITS: Record<string, "days" | "weeks" | "months" | "years"> = {
  day: "days",
  days: "days",
  week: "weeks",
  weeks: "weeks",
  month: "months",
  months: "months",
  year: "years",
  years: "years",
};

const isDate = (value: Value): value is DateValue => Boolean(value && typeof value === "object" && (value as DateValue).$date === true);
const isCoded = (value: Value): value is CodedValue => Boolean(value && typeof value === "object" && (value as CodedValue).$coded === true);
const isMap = (value: Value): value is MapValue => Boolean(value && typeof value === "object" && !Array.isArray(value) && "$map" in value);
const isList = (value: Value): value is Value[] => Array.isArray(value);

/** Blank: null, empty or whitespace-only text, an empty list, a missing input. */
function isMissing(value: Value): boolean {
  if (value === null || value === MISSING_INPUT) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// ── Reading stored answers ───────────────────────────────────────────────────

const DATE_KINDS = new Set(["date"]);
const DATETIME_KINDS = new Set(["datetime", "dateTime"]);
const BOOLEAN_KINDS = new Set(["boolean", "booleanYesNo", "booleanSingle"]);
// Keys that make an object a coded answer rather than a `{ value }` wrapper.
const CODED_KEYS = ["code", "key", "id", "display", "response", "label", "text"] as const;
// Keys of any stored answer shape; an object with none of them is data (a map).
const ANSWER_KEYS = [
  ...CODED_KEYS, "value", "selectedKey", "selectedIds", "selectedLabels", "coding", "valueCoding", "system", "date", "detailResponse",
] as const;
// FHIR QuestionnaireResponse answer values read as the value they carry.
const FHIR_VALUE_KEYS = ["valueString", "valueInteger", "valueDecimal", "valueBoolean", "valueDate", "valueDateTime", "valueTime"] as const;

function scalarOf(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  return undefined;
}

/** Yes/no reading of a scalar, with values.ts's word list (Y/Yes/true/1/on/checked…). */
function yesNoWord(value: unknown): boolean | undefined {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return undefined;
  return readBoolean(value) ?? undefined;
}

const codedOf = (entry: ChoiceValue, value: string | number | boolean | undefined): CodedValue => {
  const coded: CodedValue = { $coded: true, code: entry.code.trim() };
  if (value !== undefined) coded.value = value;
  if (entry.display !== undefined) coded.display = entry.display.trim();
  return coded;
};

/** Normalise a stored answer to a runtime value. `kind` is the field type when known. */
function readStored(raw: unknown, kind: string | undefined): Value {
  // A single checkbox is never blank: unchecked (or never touched) means no.
  if (kind === "booleanSingle" && (raw === undefined || raw === null || raw === "")) return false;
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (kind && (DATE_KINDS.has(kind) || DATETIME_KINDS.has(kind))) {
      const date = parseDateText(trimmed);
      if (date) return DATE_KINDS.has(kind) ? asDateOnly(date) : date;
    }
    if (kind && BOOLEAN_KINDS.has(kind)) {
      const yesNo = yesNoWord(trimmed);
      if (yesNo !== undefined) return yesNo;
    }
    return trimmed;
  }
  if (raw instanceof Date) {
    const date = dateValueOf(readDateTime(raw));
    if (!date) return null;
    return kind && DATE_KINDS.has(kind) ? asDateOnly(date) : date;
  }
  if (Array.isArray(raw)) {
    const items = raw.map((item) => readStored(item, kind)).filter((item) => !isMissing(item));
    return items.length > 0 ? items : null;
  }
  if (typeof raw === "object") return readRecord(raw as Record<string, unknown>, kind);
  return null;
}

/**
 * A stored object. Codes and labels come from values.ts `readChoice`: the
 * code is `selectedKey` for subform and scale selections, else `code`,
 * `value`, `key`, `id` in that order; the label is `display`, `response`,
 * `label`, `text`. A scalar `value` beside the code is kept as a further
 * match key (ScaleField `{ selectedKey: "9", value: 0 }`).
 */
function readRecord(record: Record<string, unknown>, kind: string | undefined): Value {
  // FindCodeSelect selections: { selectedItems } is a list, { selectedItem } its one item.
  if (Array.isArray(record.selectedItems)) return readStored(record.selectedItems, kind);
  if ("selectedItem" in record) return readStored(record.selectedItem, kind);
  // Checklist answers { selectedIds, selectedLabels } are always a list.
  if (Array.isArray(record.selectedIds) || Array.isArray(record.selectedLabels)) {
    const items: Value[] = readChoice(record).map((entry) => codedOf(entry, undefined));
    return items.length > 0 ? items : null;
  }
  const selection = "selectedKey" in record || Array.isArray(record.coding) || Boolean(record.valueCoding && typeof record.valueCoding === "object");
  if (!ANSWER_KEYS.some((key) => key in record)) {
    if (Object.keys(record).length === 0) return null;
    const fhirKey = FHIR_VALUE_KEYS.find((key) => record[key] !== undefined && record[key] !== null);
    if (fhirKey) return readStored(record[fhirKey], kind);
    // Not an answer: plain data such as a growth-reference table handed to a host function.
    const map: Record<string, Value> = {};
    for (const key of Object.keys(record)) map[key] = readStored(record[key], undefined);
    return { $map: map };
  }
  if (!selection) {
    // `{ value }` wrappers (a measurement `{ value: 72, unit: "kg" }`, a list
    // or a Coding under `value`) read as the value they wrap.
    if (record.value !== null && typeof record.value === "object") return readStored(record.value, kind);
    if (scalarOf(record.value) !== undefined && !CODED_KEYS.some((key) => scalarOf(record[key]) !== undefined)) {
      return readStored(record.value, kind);
    }
  }
  const [entry] = readChoice(record);
  if (!entry) {
    if (!selection && record.date !== undefined) return readStored(record.date, kind && DATETIME_KINDS.has(kind) ? kind : "date");
    return null;
  }
  if (kind && (DATE_KINDS.has(kind) || DATETIME_KINDS.has(kind))) {
    const date = dateValueOf(readDateTime(record));
    if (date) return DATE_KINDS.has(kind) ? asDateOnly(date) : date;
  }
  if (kind && BOOLEAN_KINDS.has(kind)) {
    const yesNo = readBoolean(record);
    if (yesNo !== null) return yesNo;
  }
  return codedOf(entry, scalarOf(record.value));
}

// ── Dates ───────────────────────────────────────────────────────────────────

function dateValueOf(reading: { date: Date; dateOnly: boolean } | null): DateValue | null {
  if (!reading) return null;
  const ms = reading.date.getTime();
  return Number.isFinite(ms) ? { $date: true, ms, dateOnly: reading.dateOnly } : null;
}

/**
 * Date or date-and-time text, read by values.ts `readDateTime`: every builder
 * date format, date-only as a local calendar date, a time without a zone as
 * local time and one with a zone as exact. Numbers are never dates here.
 */
function parseDateText(text: string): DateValue | null {
  return dateValueOf(readDateTime(text));
}

function asDateOnly(date: DateValue): DateValue {
  if (date.dateOnly) return date;
  const local = new Date(date.ms);
  return { $date: true, ms: new Date(local.getFullYear(), local.getMonth(), local.getDate()).getTime(), dateOnly: true };
}

function toDate(value: Value): DateValue | null {
  if (value === null) return null;
  if (isDate(value)) return value;
  if (typeof value === "string") return parseDateText(value);
  if (isCoded(value)) {
    for (const candidate of [value.value, value.display, value.code]) {
      if (typeof candidate === "string") {
        const date = parseDateText(candidate);
        if (date) return date;
      }
    }
    return null;
  }
  if (isList(value) && value.length === 1) return toDate(value[0]);
  return null;
}

const partsOf = (date: DateValue) => {
  const local = new Date(date.ms);
  return {
    year: local.getFullYear(),
    month: local.getMonth(),
    day: local.getDate(),
    hours: local.getHours(),
    minutes: local.getMinutes(),
    seconds: local.getSeconds(),
    millis: local.getMilliseconds(),
    weekday: local.getDay(),
  };
};

/** Local wall-clock time projected onto UTC, so day arithmetic ignores DST shifts. */
const wallClock = (date: DateValue): number => {
  const p = partsOf(date);
  return Date.UTC(p.year, p.month, p.day, p.hours, p.minutes, p.seconds, p.millis);
};
const dayNumber = (date: DateValue): number => {
  const p = partsOf(date);
  return Date.UTC(p.year, p.month, p.day) / MS_PER_DAY;
};

const calendarDays = (from: DateValue, to: DateValue): number => dayNumber(to) - dayNumber(from);
/** Whole calendar days for date-only inputs, exact (fractional) days when either side has a time. */
const elapsedDays = (from: DateValue, to: DateValue): number =>
  from.dateOnly && to.dateOnly ? calendarDays(from, to) : (wallClock(to) - wallClock(from)) / MS_PER_DAY;

function wholeMonths(from: DateValue, to: DateValue): number {
  const a = partsOf(from);
  const b = partsOf(to);
  let months = (b.year - a.year) * 12 + (b.month - a.month);
  if (b.day < a.day) months -= 1;
  return months;
}

/** Month arithmetic clamps to the target month's last day (Jan 31 + 1 month = Feb 28/29). */
function addMonthsClamped(date: DateValue, months: number): DateValue {
  const p = partsOf(date);
  const monthIndex = p.month + months;
  const lastDay = new Date(p.year, monthIndex + 1, 0).getDate();
  const ms = new Date(p.year, monthIndex, Math.min(p.day, lastDay), p.hours, p.minutes, p.seconds, p.millis).getTime();
  return { $date: true, ms, dateOnly: date.dateOnly };
}

function addDays(date: DateValue, days: number): DateValue {
  const p = partsOf(date);
  const ms = new Date(p.year, p.month, p.day + days, p.hours, p.minutes, p.seconds, p.millis).getTime();
  return { $date: true, ms, dateOnly: date.dateOnly };
}

function fractionalMonths(from: DateValue, to: DateValue): number {
  const whole = wholeMonths(from, to);
  const anchor = addMonthsClamped(from, whole);
  const next = addMonthsClamped(from, whole + 1);
  const monthLength = elapsedDays(anchor, next);
  return whole + (monthLength > 0 ? elapsedDays(anchor, to) / monthLength : 0);
}

function todayValue(env: FormulaEnv): DateValue {
  return asDateOnly(nowValue(env));
}

function nowValue(env: FormulaEnv): DateValue {
  const now = env.now instanceof Date && Number.isFinite(env.now.getTime()) ? env.now : new Date();
  return { $date: true, ms: now.getTime(), dateOnly: false };
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

function formatDate(date: DateValue): string {
  if (!date.dateOnly) return new Date(date.ms).toISOString();
  const p = partsOf(date);
  return `${pad(p.year, 4)}-${pad(p.month + 1)}-${pad(p.day)}`;
}

function normalizeUnit(value: Value): "days" | "weeks" | "months" | "years" | null {
  const text = typeof value === "string" ? value : isCoded(value) ? value.code : undefined;
  return text ? DURATION_UNITS[text.trim().toLowerCase()] ?? null : null;
}

// ── Coercions ───────────────────────────────────────────────────────────────

const NUMERIC_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function numberFromText(text: string): number | null {
  const trimmed = text.trim();
  if (!NUMERIC_TEXT.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Numbers, numeric text, yes/no as 1/0, a choice's code then value then label. */
function toNumber(value: Value): number | null {
  if (value === null) return null;
  if (value === MISSING_INPUT) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return numberFromText(value);
  if (isCoded(value)) {
    for (const candidate of [value.code, value.value, value.display]) {
      if (candidate === undefined) continue;
      const numeric = typeof candidate === "number" ? candidate : typeof candidate === "boolean" ? null : numberFromText(candidate);
      if (numeric !== null) return numeric;
    }
    return null;
  }
  if (isList(value) && value.length === 1) return toNumber(value[0]);
  return null;
}

/** Text reading: a choice shows its label, a date YYYY-MM-DD, a list its items joined with ", ". */
function toText(value: Value): string {
  if (value === null || value === MISSING_INPUT) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (isDate(value)) return formatDate(value);
  if (isCoded(value)) return value.display ?? value.code ?? (value.value === undefined ? "" : String(value.value));
  if (isList(value)) return value.map(toText).filter((text) => text !== "").join(", ");
  return "";
}

/** Three-valued truth: null when blank; a missing input under compute-anyway is false. */
function truth(value: Value): boolean | null {
  if (value === MISSING_INPUT) return false;
  if (isMissing(value)) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return yesNoWord(value) ?? true;
  if (isCoded(value)) return yesNoWord(value.code) ?? yesNoWord(value.value) ?? yesNoWord(value.display) ?? true;
  return true;
}

/** Strict yes for countTrue: true, 1, true / Y / Yes text or codes. */
function isYes(value: Value): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") return yesNoWord(value) === true;
  if (isCoded(value)) return [value.code, value.value, value.display].some((candidate) => candidate !== undefined && isYes(candidate));
  return false;
}

/** The strings a value can match by: a choice by code, value and label; a scalar by itself. */
function matchKeys(value: Value): Array<string | number | boolean> {
  if (isCoded(value)) {
    return [value.code, value.value, value.display].filter((candidate): candidate is string | number | boolean => candidate !== undefined);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [value];
  return [];
}

function scalarEquals(left: string | number | boolean, right: string | number | boolean): boolean {
  if (typeof left === "boolean" || typeof right === "boolean") {
    const a = typeof left === "boolean" ? left : yesNoWord(left);
    const b = typeof right === "boolean" ? right : yesNoWord(right);
    return a !== undefined && a === b;
  }
  if (typeof left === "number" || typeof right === "number") {
    const a = typeof left === "number" ? left : numberFromText(left);
    const b = typeof right === "number" ? right : numberFromText(right);
    return a !== null && a === b;
  }
  return left === right;
}

function equals(left: Value, right: Value): boolean {
  const leftMissing = isMissing(left);
  const rightMissing = isMissing(right);
  if (leftMissing || rightMissing) return leftMissing && rightMissing;
  if (isList(left) || isList(right)) {
    if (isList(left) && isList(right)) {
      return left.every((item) => right.some((other) => equals(item, other)))
        && right.every((item) => left.some((other) => equals(item, other)));
    }
    const list = (isList(left) ? left : right) as Value[];
    const other = isList(left) ? right : left;
    return list.length === 1 && equals(list[0], other);
  }
  if (isMap(left) || isMap(right)) return false;
  if (isDate(left) || isDate(right)) {
    const a = toDate(left);
    const b = toDate(right);
    if (!a || !b) return false;
    return a.dateOnly || b.dateOnly ? dayNumber(a) === dayNumber(b) : a.ms === b.ms;
  }
  if (isCoded(left) && isCoded(right) && left.code !== undefined && right.code !== undefined) return left.code === right.code;
  const leftKeys = matchKeys(left);
  const rightKeys = matchKeys(right);
  return leftKeys.some((a) => rightKeys.some((b) => scalarEquals(a, b)));
}

/** Ordering: numbers, then dates, then text; null when a side is blank or they cannot be ordered. */
function compare(left: Value, right: Value): number | null {
  if (left === MISSING_INPUT || right === MISSING_INPUT) {
    // compute-anyway: an unanswered input orders as 0 against a number.
    const a = toNumber(left);
    const b = toNumber(right);
    return a === null || b === null ? null : a - b;
  }
  if (isMissing(left) || isMissing(right)) return null;
  if (isDate(left) || isDate(right)) {
    const a = toDate(left);
    const b = toDate(right);
    if (!a || !b) return null;
    return a.dateOnly || b.dateOnly ? dayNumber(a) - dayNumber(b) : a.ms - b.ms;
  }
  const a = toNumber(left);
  const b = toNumber(right);
  if (a !== null && b !== null) return a - b;
  if (typeof left === "string" && typeof right === "string") {
    const leftDate = parseDateText(left);
    const rightDate = parseDateText(right);
    if (leftDate && rightDate) return compare(leftDate, rightDate);
    return left < right ? -1 : left > right ? 1 : 0;
  }
  return null;
}

/** Finite numbers only; -0 reads as 0. */
const finite = (value: number): number | null => (Number.isFinite(value) ? (value === 0 ? 0 : value) : null);

/** Decimal-exact rounding (1.005 → 1.01), halves towards +∞ like Math.round. */
function roundTo(value: number, digits: number): number | null {
  const places = Math.round(digits);
  if (!Number.isFinite(places) || Math.abs(places) > 100) return null;
  const shifted = Math.round(Number(`${value}e${places}`));
  if (!Number.isFinite(shifted)) return finite(Math.round(value * 10 ** places) / 10 ** places);
  return finite(Number(`${shifted}e${-places}`));
}

function flatten(values: Value[]): Value[] {
  const out: Value[] = [];
  for (const value of values) {
    if (isList(value)) out.push(...flatten(value));
    else out.push(value);
  }
  return out;
}

/** Answered numbers for sum/min/max; `undefined` when an answered value is not numeric. */
function answeredNumbers(values: Value[]): number[] | undefined {
  const numbers: number[] = [];
  for (const value of flatten(values)) {
    if (isMissing(value)) continue;
    const numeric = toNumber(value);
    if (numeric === null) return undefined;
    numbers.push(numeric);
  }
  return numbers;
}

// ── Output ──────────────────────────────────────────────────────────────────

function toOutput(value: Value): unknown {
  if (value === null || value === MISSING_INPUT) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (isDate(value)) return formatDate(value);
  if (isCoded(value)) return value.code ?? value.value ?? value.display ?? null;
  if (isList(value)) return value.map(toOutput);
  if (isMap(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value.$map)) out[key] = toOutput(value.$map[key]);
    return out;
  }
  return null;
}

// ── Evaluation ──────────────────────────────────────────────────────────────

type Lazy = () => Value;

interface Scope {
  env: FormulaEnv;
  depth: number;
}

function evaluateNode(node: FormulaNode, scope: Scope): Value {
  if (scope.depth > MAX_DEPTH) return null;
  const inner: Scope = { env: scope.env, depth: scope.depth + 1 };
  switch (node.kind) {
    case "number":
      return Number.isFinite(node.value) ? node.value : null;
    case "text":
      return node.value;
    case "boolean":
      return node.value;
    case "null":
      return null;
    case "ref": {
      const value = readStored(scope.env.getValue(node.id), scope.env.fieldKind?.(node.id));
      return value === null && scope.env.incomplete === "compute-anyway" ? MISSING_INPUT : value;
    }
    case "param":
      return readStored(scope.env.getParam ? scope.env.getParam(node.name) : undefined, undefined);
    case "list": {
      const items = node.items.map((item) => evaluateNode(item, inner)).filter((item) => !isMissing(item));
      return items.length > 0 ? items : null;
    }
    case "map": {
      const map: Record<string, Value> = {};
      for (const entry of node.entries) map[entry.key] = evaluateNode(entry.value, inner);
      return { $map: map };
    }
    case "unary":
      return evaluateUnary(node.op, evaluateNode(node.operand, inner));
    case "binary":
      return evaluateBinary(node, inner);
    case "if": {
      const test = truth(evaluateNode(node.test, inner));
      if (test === null) return null;
      return evaluateNode(test ? node.then : node.else, inner);
    }
    case "call":
      return evaluateCall(node, inner);
    default:
      return null;
  }
}

function evaluateUnary(op: string, operand: Value): Value {
  if (op === "!") {
    const value = truth(operand);
    return value === null ? null : !value;
  }
  const numeric = toNumber(operand);
  if (numeric === null) return null;
  return op === "-" ? finite(-numeric || 0) : numeric;
}

function arithmetic(op: string, left: number, right: number): number | null {
  switch (op) {
    case "+":
      return finite(left + right);
    case "-":
      return finite(left - right);
    case "*":
      return finite(left * right);
    case "/":
      return right === 0 ? null : finite(left / right);
    case "%":
      return right === 0 ? null : finite(left % right);
    case "^":
      return finite(left ** right);
    default:
      return null;
  }
}

function evaluateBinary(node: Extract<FormulaNode, { kind: "binary" }>, scope: Scope): Value {
  if (node.op === "&&" || node.op === "||") {
    const stop = node.op === "||";
    const left = truth(evaluateNode(node.left, scope));
    if (left === stop) return stop;
    const right = truth(evaluateNode(node.right, scope));
    if (right === stop) return stop;
    return left === null || right === null ? null : !stop;
  }
  const left = evaluateNode(node.left, scope);
  const right = evaluateNode(node.right, scope);
  switch (node.op) {
    case "==":
      return equals(left, right);
    case "!=":
      return !equals(left, right);
    case "<":
    case "<=":
    case ">":
    case ">=": {
      const order = compare(left, right);
      if (order === null) return null;
      return node.op === "<" ? order < 0 : node.op === "<=" ? order <= 0 : node.op === ">" ? order > 0 : order >= 0;
    }
    default: {
      const a = toNumber(left);
      const b = toNumber(right);
      if (a === null || b === null) return null;
      return arithmetic(node.op, a, b);
    }
  }
}

function numberArg(args: Lazy[], index: number): number | null {
  return index < args.length ? toNumber(args[index]()) : null;
}

function mathFunction(args: Lazy[], apply: (value: number) => number | null): Value {
  const value = numberArg(args, 0);
  if (value === null) return null;
  const result = apply(value);
  return result === null ? null : finite(result);
}

/** The end date argument: omitted → default; given but blank → `blank` (a default, or null). */
function endDate(args: Lazy[], index: number, fallback: () => DateValue, blank: "default" | "null"): DateValue | null {
  if (index >= args.length) return fallback();
  const value = args[index]();
  if (isMissing(value)) return blank === "default" ? fallback() : null;
  return toDate(value);
}

function scoreOf(answer: Value, scores: Value, fieldMap: Readonly<Record<string, number>> | undefined): number | null {
  if (answer === MISSING_INPUT) return 0;
  if (isMissing(answer)) return null;
  if (isList(answer)) {
    let total = 0;
    for (const item of answer) {
      const itemScore = scoreOf(item, scores, fieldMap);
      if (itemScore !== null) total += itemScore;
    }
    return total;
  }
  if (typeof scores === "number") {
    const checked = truth(answer);
    return checked ? scores : 0;
  }
  const map: Record<string, unknown> | undefined = isMap(scores) ? scores.$map : fieldMap;
  if (map) {
    const keys = matchKeys(answer).map(String);
    if (typeof answer === "boolean") keys.push(answer ? "Yes" : "No", answer ? "Y" : "N");
    const lookup = (key: string): number | null => {
      if (!Object.prototype.hasOwnProperty.call(map, key)) return null;
      const entry = map[key] as Value | number;
      return typeof entry === "number" ? finite(entry) : toNumber(entry as Value);
    };
    for (const key of keys) {
      const found = lookup(key);
      if (found !== null) return found;
    }
    const lowered = keys.map((key) => key.trim().toLowerCase());
    for (const mapKey of Object.keys(map)) {
      if (!lowered.includes(mapKey.trim().toLowerCase())) continue;
      const found = lookup(mapKey);
      if (found !== null) return found;
    }
  }
  if (typeof answer === "boolean") return answer ? 1 : 0;
  return toNumber(answer) ?? 0;
}

function contains(collection: Value, needle: Value): boolean {
  if (isMissing(collection) || isMissing(needle)) return false;
  if (isList(needle)) return needle.some((item) => contains(collection, item));
  if (isList(collection)) return collection.some((item) => equals(item, needle));
  if (isMap(collection)) {
    return matchKeys(needle).some((key) => Object.prototype.hasOwnProperty.call(collection.$map, String(key)));
  }
  if (typeof collection === "string") return collection.toLowerCase().includes(toText(needle).toLowerCase());
  return equals(collection, needle);
}

function durationText(from: DateValue, to: DateValue, units: Value): string {
  const ordered: Array<"days" | "weeks" | "months" | "years"> = [];
  for (const part of toText(units).split(",")) {
    const unit = DURATION_UNITS[part.trim().toLowerCase()];
    if (unit && !ordered.includes(unit)) ordered.push(unit);
  }
  if (ordered.length === 0) return "";
  // Ages never read as negative: an end before the start collapses to zero.
  const end = elapsedDays(from, to) < 0 ? from : to;
  let cursor = from;
  const parts = ordered.map((unit) => {
    let amount = 0;
    if (unit === "years" || unit === "months") {
      const months = Math.max(0, wholeMonths(cursor, end));
      amount = unit === "years" ? Math.floor(months / 12) : months;
      cursor = addMonthsClamped(cursor, unit === "years" ? amount * 12 : amount);
    } else {
      const days = Math.max(0, elapsedDays(cursor, end));
      amount = Math.floor(unit === "weeks" ? days / 7 : days);
      cursor = addDays(cursor, unit === "weeks" ? amount * 7 : amount);
    }
    return { unit, amount };
  });
  const nonZero = parts.filter((part) => part.amount > 0);
  const shown = nonZero.length > 0 ? nonZero : [parts[parts.length - 1]];
  return shown.map((part) => `${part.amount} ${part.amount === 1 ? part.unit.slice(0, -1) : part.unit}`).join(", ");
}

function skippedDates(value: Value): DateValue[] {
  const items: Value[] = isList(value) ? flatten(value) : typeof value === "string" ? value.split(/[,;\n]/) : [value];
  const dates: DateValue[] = [];
  for (const item of items) {
    if (isMissing(item)) continue;
    const date = toDate(typeof item === "string" ? item.trim() : item);
    if (date) dates.push(date);
  }
  return dates;
}

function weekdaysBetween(from: DateValue, to: DateValue, skip: Value): number | null {
  const first = dayNumber(from);
  const last = dayNumber(to);
  const days = last - first;
  if (days < 0) return null;
  const startWeekday = partsOf(from).weekday;
  let count = Math.floor((days + 1) / 7) * 5;
  for (let offset = 0; offset < (days + 1) % 7; offset += 1) {
    const weekday = (startWeekday + offset) % 7;
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  const skipped = new Set<number>();
  for (const date of skippedDates(skip)) {
    const day = dayNumber(date);
    const weekday = partsOf(date).weekday;
    if (day >= first && day <= last && weekday !== 0 && weekday !== 6) skipped.add(day);
  }
  return count - skipped.size;
}

function hostFunction(name: string, args: Lazy[], env: FormulaEnv): Value {
  const implementation = env.functions?.[name];
  if (typeof implementation !== "function") return null;
  try {
    return readStored(implementation(...args.map((arg) => toOutput(arg()))), undefined);
  } catch {
    return null;
  }
}

function evaluateCall(node: Extract<FormulaNode, { kind: "call" }>, scope: Scope): Value {
  const env = scope.env;
  const cache = new Map<number, Value>();
  const args: Lazy[] = node.args.map((arg, index) => () => {
    if (!cache.has(index)) cache.set(index, evaluateNode(arg, scope));
    return cache.get(index)!;
  });
  const all = () => args.map((arg) => arg());
  switch (node.fn) {
    // Logic and missing values
    case "iif": {
      if (args.length < 2) return null;
      const test = truth(args[0]());
      if (test === null) return null;
      return test ? args[1]() : args.length > 2 ? args[2]() : null;
    }
    case "coalesce": {
      for (const arg of args) {
        const value = arg();
        if (!isMissing(value)) return value;
      }
      return null;
    }
    case "hasValue":
      return args.length > 0 && !isMissing(args[0]());
    case "ifPresent": {
      if (args.length < 2) return null;
      if (!isMissing(args[0]())) return args[1]();
      return args.length > 2 ? args[2]() : null;
    }
    case "countTrue":
      return flatten(all()).filter(isYes).length;

    // Choices
    case "score": {
      if (args.length === 0) return null;
      const first = node.args[0];
      const fieldMap = args.length < 2 && first.kind === "ref" ? env.scoreMaps?.[first.id] : undefined;
      let answer = args[0]();
      if (isMap(answer)) answer = readStored(toOutput(answer), undefined);
      return scoreOf(answer, args.length > 1 ? args[1]() : null, fieldMap);
    }
    case "contains":
      return args.length < 2 ? false : contains(args[0](), args[1]());

    // Aggregates
    case "sum": {
      const numbers = answeredNumbers(all());
      if (!numbers || numbers.length === 0) return null;
      return finite(numbers.reduce((total, value) => total + value, 0));
    }
    case "min":
    case "max": {
      const numbers = answeredNumbers(all());
      if (!numbers || numbers.length === 0) return null;
      return node.fn === "min" ? Math.min(...numbers) : Math.max(...numbers);
    }

    // Numbers
    case "round": {
      const value = numberArg(args, 0);
      if (value === null) return null;
      const digits = args.length > 1 ? numberArg(args, 1) : 0;
      return digits === null ? null : roundTo(value, digits);
    }
    case "floor":
      return mathFunction(args, Math.floor);
    case "ceil":
      return mathFunction(args, Math.ceil);
    case "trunc":
      return mathFunction(args, (value) => Math.trunc(value) || 0);
    case "abs":
      return mathFunction(args, Math.abs);
    case "mod": {
      const value = numberArg(args, 0);
      const divisor = numberArg(args, 1);
      return value === null || divisor === null ? null : arithmetic("%", value, divisor);
    }
    case "power": {
      const base = numberArg(args, 0);
      const exponent = numberArg(args, 1);
      return base === null || exponent === null ? null : arithmetic("^", base, exponent);
    }
    case "sqrt":
      return mathFunction(args, (value) => (value < 0 ? null : Math.sqrt(value)));
    case "ln":
      return mathFunction(args, (value) => (value <= 0 ? null : finite(Math.log(value))));
    case "log10":
      return mathFunction(args, (value) => (value <= 0 ? null : finite(Math.log10(value))));
    case "exp":
      return mathFunction(args, (value) => finite(Math.exp(value)));
    case "number":
      return args.length > 0 ? toNumber(args[0]()) : null;

    // Text
    case "text":
      return args.length > 0 ? toText(args[0]()) : "";
    case "concat": {
      // Answers arrive trimmed, so a whitespace string here is a literal separator: keep it.
      const values = all();
      if (values.every(isMissing)) return null;
      return values.map((value) => (value === null ? "" : toText(value))).join("");
    }

    // Dates
    case "today":
      return todayValue(env);
    case "now":
      return nowValue(env);
    case "durationBetween": {
      const from = args.length > 0 ? toDate(args[0]()) : null;
      if (!from) return null;
      const to = endDate(args, 1, () => todayValue(env), "default");
      if (!to) return null;
      const unit = args.length > 2 ? normalizeUnit(args[2]()) : "days";
      if (!unit) return null;
      const days = elapsedDays(from, to);
      if (unit === "days") return days;
      if (unit === "weeks") return days / 7;
      const months = fractionalMonths(from, to);
      return unit === "months" ? months : months / 12;
    }
    case "durationText": {
      const from = args.length > 0 ? toDate(args[0]()) : null;
      if (!from) return "";
      const to = endDate(args, 1, () => todayValue(env), "default");
      if (!to) return "";
      return durationText(from, to, args.length > 2 ? args[2]() : "years,months");
    }
    case "daysBetween":
    case "monthsBetween": {
      const from = args.length > 0 ? toDate(args[0]()) : null;
      if (!from) return null;
      const to = endDate(args, 1, () => todayValue(env), "null");
      if (!to) return null;
      return node.fn === "daysBetween" ? calendarDays(from, to) : wholeMonths(from, to);
    }
    case "daysSince":
    case "monthsSince": {
      const date = args.length > 0 ? toDate(args[0]()) : null;
      if (!date) return null;
      const reference = endDate(args, 1, () => nowValue(env), "null");
      if (!reference) return null;
      if (node.fn === "monthsSince") return wholeMonths(date, reference);
      return date.dateOnly && reference.dateOnly
        ? calendarDays(date, reference)
        : Math.floor((wallClock(reference) - wallClock(date)) / MS_PER_DAY);
    }
    case "weekdaysBetween": {
      const from = args.length > 0 ? toDate(args[0]()) : null;
      const to = args.length > 1 ? toDate(args[1]()) : null;
      if (!from || !to) return null;
      return weekdaysBetween(from, to, args.length > 2 ? args[2]() : null);
    }
    case "ageYears": {
      const birth = args.length > 0 ? toDate(args[0]()) : null;
      if (!birth) return null;
      const asOf = endDate(args, 1, () => todayValue(env), "default");
      if (!asOf) return null;
      return Math.floor(wholeMonths(birth, asOf) / 12);
    }

    // Clinical
    case "bmi": {
      const weight = numberArg(args, 0);
      const height = numberArg(args, 1);
      if (weight === null || height === null || weight <= 0 || height <= 0) return null;
      return finite(weight / (height / 100) ** 2);
    }
    default:
      return hostFunction(node.fn, args, env);
  }
}

/**
 * Evaluate a stored formula (or a bare node). Returns plain values: numbers,
 * text, booleans, dates as `YYYY-MM-DD` (date-and-time as ISO 8601 UTC),
 * choices as their code, lists as arrays, and `null` for a blank result.
 * Never throws.
 */
export function evaluateFormula(formula: StoredFormula | FormulaNode, env: FormulaEnv): unknown {
  const expr =
    formula && typeof formula === "object" && (formula as StoredFormula).v === 1 && (formula as StoredFormula).expr
      ? (formula as StoredFormula).expr
      : (formula as FormulaNode);
  try {
    return toOutput(evaluateNode(expr, { env, depth: 0 }));
  } catch {
    return null;
  }
}

// ── Reading single answers the way formulas do ──────────────────────────────

/** Whether a stored answer is blank to a formula (`hasValue` is its negation). */
export function isBlankFormulaAnswer(raw: unknown, fieldKind?: string): boolean {
  return isMissing(readStored(raw, fieldKind));
}

/** A stored answer as a formula number (numeric text, yes/no as 1/0, a choice's numeric code), or null. */
export function formulaAnswerNumber(raw: unknown, fieldKind?: string): number | null {
  return toNumber(readStored(raw, fieldKind));
}

/**
 * A stored answer as a formula result would give it: a choice as its code,
 * a date as `YYYY-MM-DD`, a list as an array, blank as null.
 */
export function formulaAnswerOutput(raw: unknown, fieldKind?: string): unknown {
  return toOutput(readStored(raw, fieldKind));
}

/** A stored answer as text, the way `text()` shows it (a choice's label, a date as YYYY-MM-DD). */
export function formulaAnswerText(raw: unknown, fieldKind?: string): string {
  return toText(readStored(raw, fieldKind));
}

/**
 * Round like `round(value, digits)`: decimal-exact, halves towards +∞. Null
 * for a non-finite value or digits. The computed field's precision uses it.
 */
export function roundFormulaNumber(value: number, digits: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(digits)) return null;
  return roundTo(value, digits);
}

/** Build an environment over a plain answers record. */
export function formulaEnvFromValues(
  values: Readonly<Record<string, unknown>>,
  options: Omit<FormulaEnv, "getValue"> = {},
): FormulaEnv {
  return {
    ...options,
    getValue: (fieldId) => (Object.prototype.hasOwnProperty.call(values, fieldId) ? values[fieldId] : undefined),
  };
}
