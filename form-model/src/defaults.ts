/**
 * Default answers (neutral form model).
 *
 * One descriptor says what a field starts with on a new form or a new row:
 * a fixed value, today, now, a chart value, or the patient's latest
 * observation. It is stored as `defaultAnswer` on regular fields, table
 * columns, layout cells (and fields inside a field-list cell) and subform
 * data-entry entries.
 *
 * Older forms spell the same intent seven other ways, each read by a
 * different subset of targets:
 *
 * | Legacy store | Where | Reads as |
 * | --- | --- | --- |
 * | `prefill` | fields, table columns, layout cells | `literal` |
 * | `dateConfig.prefillToday` (a parsed field's `prefillToday`) | date and date-time answers | `today`, or `now` for a date-time |
 * | `defaultValue` `"__today"` / `"__now"` / a value | subform entries | `today` / `now` / `literal` |
 * | `defaultFromObservation` (off when the module's `bringForward` is false) | subform entries | `lastObservation` |
 * | `{ kind: "today" }` in `prefill` or a data-entry `defaultValue` | table columns, row editors | `today` |
 * | `sourcePaths` naming only `system.currentDate` with `sourceMode: "initial"` | layout cells | `today` |
 * | `defaultValue` on a field cell | layout cells | `literal` (a static text cell's `defaultValue` is display text, not a default) |
 *
 * `readDefaultAnswer` reads every one of them; `writeDefaultAnswer` stores the
 * descriptor together with the legacy mirror older readers still use; and
 * `resolveDefaultAnswer` turns a descriptor into the value to seed. A default
 * never overwrites an answer: callers seed it only into an empty answer on a
 * new form or a new row, never into a reopened draft.
 *
 * This file is also the source of the NHForms `DefaultsKit`
 * (scripts/generate-defaults-kit.mjs), so it must stay self-contained: type
 * imports only, no runtime imports.
 */
import type { FieldPrefillValue } from "./document";

export type BuilderDefaultAnswer =
  | { kind: "literal"; value: FieldPrefillValue }
  | { kind: "today" }
  | { kind: "now" }
  | { kind: "chart"; concept?: string; paths?: string[] }
  | { kind: "lastObservation"; code: string; system?: string; lookbackDays?: number };

export type DefaultAnswerKind = BuilderDefaultAnswer["kind"];

export const DEFAULT_ANSWER_KINDS = ["literal", "today", "now", "chart", "lastObservation"] as const;

/**
 * Where a default is stored, which decides the legacy spellings read and
 * written. Inferred from the object when not given (`inferDefaultAnswerShape`).
 */
export type DefaultAnswerShape = "field" | "tableColumn" | "layoutCell" | "subformEntry";

export interface ReadDefaultAnswerOptions {
  shape?: DefaultAnswerShape;
  /**
   * The subform module's `bringForward` setting: `false` turns observation
   * defaults off (the entry's other default, if any, still applies).
   */
  bringForward?: boolean;
}

export interface WriteDefaultAnswerOptions {
  shape?: DefaultAnswerShape;
}

/** A calendar value kind, or null for answers that are not dates or times. */
export type DefaultAnswerTemporalKind = "date" | "dateTime" | "time";

export interface DefaultAnswerContext {
  /** The moment the form (or row) is opened. */
  now: Date;
  /** The answer's kind ("date", "dateTime" or "datetime", "time", or any other type). */
  fieldType?: string | null;
  /** A chart value by clinical concept or by product paths. */
  readChart?: (target: { concept?: string; paths?: string[] }) => unknown;
  /** The latest observation with this code (within `lookbackDays` when set). */
  readLastObservation?: (code: string, system: string | undefined, lookbackDays: number | undefined) => unknown;
}

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasOwn = (value: AnyRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as unknown as T;
  if (isRecord(value)) {
    const out: AnyRecord = {};
    for (const key of Object.keys(value)) out[key] = cloneValue(value[key]);
    return out as T;
  }
  return value;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return value === undefined ? "null" : JSON.stringify(value);
}

/** An answer that holds nothing: absent, blank text, an empty list or an empty object. */
export function isBlankAnswer(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.keys(value).length === 0;
  return false;
}

// A stored default with nothing in it (the builder clears a default this way).
const isBlankStoredDefault = (value: unknown) =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/** Whether a value is a well-formed default-answer descriptor. */
export function isDefaultAnswer(value: unknown): value is BuilderDefaultAnswer {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case "literal":
      return hasOwn(value, "value") && value.value !== undefined;
    case "today":
    case "now":
      return true;
    case "chart":
      return Boolean(nonEmptyString(value.concept))
        || (Array.isArray(value.paths) && value.paths.some((path) => Boolean(nonEmptyString(path))));
    case "lastObservation":
      return Boolean(nonEmptyString(value.code))
        && (value.system === undefined || typeof value.system === "string")
        && (value.lookbackDays === undefined || (typeof value.lookbackDays === "number" && Number.isFinite(value.lookbackDays)));
    default:
      return false;
  }
}

/** The descriptor with only its own keys, trimmed; null when it describes no default. */
function normalizeDefaultAnswer(value: unknown): BuilderDefaultAnswer | null {
  if (!isDefaultAnswer(value)) return null;
  switch (value.kind) {
    case "literal":
      return isBlankStoredDefault(value.value) ? null : { kind: "literal", value: cloneValue(value.value) };
    case "today":
      return { kind: "today" };
    case "now":
      return { kind: "now" };
    case "chart": {
      const concept = nonEmptyString(value.concept);
      const paths = (value.paths ?? []).map((path) => nonEmptyString(path)).filter((path): path is string => Boolean(path));
      return { kind: "chart", ...(concept ? { concept } : {}), ...(paths.length ? { paths } : {}) };
    }
    case "lastObservation": {
      const system = nonEmptyString(value.system);
      const lookbackDays = typeof value.lookbackDays === "number" && value.lookbackDays > 0 ? value.lookbackDays : undefined;
      return {
        kind: "lastObservation",
        code: nonEmptyString(value.code) as string,
        ...(system ? { system } : {}),
        ...(lookbackDays !== undefined ? { lookbackDays } : {}),
      };
    }
  }
}

/** Whether two descriptors (or two absent defaults) say the same thing. */
export function sameDefaultAnswer(left: BuilderDefaultAnswer | null | undefined, right: BuilderDefaultAnswer | null | undefined): boolean {
  return stableJson(normalizeDefaultAnswer(left) ?? null) === stableJson(normalizeDefaultAnswer(right) ?? null);
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

const TABLE_COLUMN_ONLY_TYPES = ["checkbox", "stampButton"];
const LAYOUT_DISPLAY_CELL_KINDS = ["text", "resources", "computed", "stampButton", "fieldList"];

/** The store a field-like object is: a regular (or parsed) field, table column, layout cell or subform entry. */
export function inferDefaultAnswerShape(fieldLike: unknown): DefaultAnswerShape {
  if (!isRecord(fieldLike)) return "field";
  if (hasOwn(fieldLike, "defaultFromObservation") || hasOwn(fieldLike, "default_from_observation") || hasOwn(fieldLike, "builderField")) {
    return "subformEntry";
  }
  if (typeof fieldLike.type === "string") {
    if (!hasOwn(fieldLike, "prefill") && (hasOwn(fieldLike, "defaultValue") || hasOwn(fieldLike, "default_value"))) return "subformEntry";
    if (
      TABLE_COLUMN_ONLY_TYPES.includes(fieldLike.type)
      || hasOwn(fieldLike, "dataPath")
      || hasOwn(fieldLike, "showInTable")
      || hasOwn(fieldLike, "withTime")
    ) return "tableColumn";
    return "field";
  }
  // A parsed field has `rawType` and a field kind; a layout cell has neither a type nor a rawType.
  if (typeof fieldLike.rawType === "string") return "field";
  if (hasOwn(fieldLike, "inputType") || hasOwn(fieldLike, "fieldId") || typeof fieldLike.kind === "string") return "layoutCell";
  return "field";
}

/**
 * A layout cell that shows something rather than asking for an answer (static
 * text, links, a computed result, a stamp button, a field list). Its
 * `defaultValue` is display text or a fallback, never a default answer.
 */
function isLayoutDisplayCell(cell: AnyRecord): boolean {
  return typeof cell.kind === "string" && LAYOUT_DISPLAY_CELL_KINDS.includes(cell.kind);
}

const DISPLAY_FIELD_TYPES = ["richText", "heading", "section", "hyperlink"];

/**
 * A field whose `prefill` is its content (read-only rich text, a heading, a
 * section or a link), not an answer it starts with.
 */
function isDisplayField(field: AnyRecord): boolean {
  const type = typeof field.type === "string" ? field.type : typeof field.rawType === "string" ? field.rawType : "";
  if (type === "richText") return !(isRecord(field.richTextConfig) && field.richTextConfig.readOnly === false);
  return DISPLAY_FIELD_TYPES.includes(type);
}

/** Whether an answer is a date, a date and time, or a time, across every stored shape. */
export function temporalKindOf(fieldLike: unknown): DefaultAnswerTemporalKind | null {
  if (!isRecord(fieldLike)) return null;
  const type = typeof fieldLike.type === "string" ? fieldLike.type : "";
  const inputType = typeof fieldLike.inputType === "string" ? fieldLike.inputType : "";
  const rawType = typeof fieldLike.rawType === "string" ? fieldLike.rawType : "";
  if (type === "datetime" || rawType === "datetime") return "dateTime";
  if (type === "time" || inputType === "time" || rawType === "time") return "time";
  if (type === "date" || inputType === "date" || rawType === "date") {
    const dateConfig = isRecord(fieldLike.dateConfig) ? fieldLike.dateConfig : null;
    return fieldLike.withTime === true || dateConfig?.withTime === true || fieldLike.dateWithTime === true ? "dateTime" : "date";
  }
  return null;
}

function normalizeTemporalKind(fieldType: string | null | undefined): DefaultAnswerTemporalKind | null {
  if (fieldType === "date") return "date";
  if (fieldType === "dateTime" || fieldType === "datetime") return "dateTime";
  if (fieldType === "time") return "time";
  return null;
}

// ---------------------------------------------------------------------------
// Legacy spellings
// ---------------------------------------------------------------------------

/** `{ kind: … }` objects older stores use as tokens rather than values. */
const TOKEN_KINDS = ["today", "now", "nextDateAfterLastRow"];

const TODAY_SOURCE_PATHS = ["system.currentDate", "system.currentDateTime"];

function sourcePathsOf(cell: AnyRecord): string[] {
  const paths = [cell.sourcePath, ...(Array.isArray(cell.sourcePaths) ? cell.sourcePaths : [])]
    .map((path) => nonEmptyString(path))
    .filter((path): path is string => Boolean(path));
  return paths.filter((path, index) => paths.indexOf(path) === index);
}

/** A layout cell filled once with the current date: every source path is the clock, in initial mode. */
function todayBindingOf(cell: AnyRecord): BuilderDefaultAnswer | null {
  const paths = sourcePathsOf(cell);
  if (paths.length === 0 || cell.sourceMode !== "initial") return null;
  if (!paths.every((path) => TODAY_SOURCE_PATHS.includes(path))) return null;
  return paths[0] === "system.currentDateTime" ? { kind: "now" } : { kind: "today" };
}

function hasTodayFlag(fieldLike: AnyRecord): boolean {
  const dateConfig = isRecord(fieldLike.dateConfig) ? fieldLike.dateConfig : null;
  return dateConfig?.prefillToday === true || fieldLike.prefillToday === true;
}

function yesNoOptionTokens(entry: AnyRecord): [unknown, unknown] {
  const options = Array.isArray(entry.options) && entry.options.length > 0 ? entry.options : ["Yes", "No"];
  return [options[0], options[1]];
}

function optionTokens(option: unknown): string[] {
  if (option === undefined || option === null) return [];
  if (!isRecord(option)) return [String(option)];
  return [option.value, option.key, option.id, option.code, option.label, option.text, option.display]
    .filter((token) => token !== undefined && token !== null)
    .map((token) => String(token));
}

/** The token a subform yes/no entry stores for an option: its value, key, id or label. */
function optionStoredToken(option: unknown): FieldPrefillValue {
  if (!isRecord(option)) return option === undefined || option === null ? null : (option as FieldPrefillValue);
  const token = option.value ?? option.key ?? option.id ?? option.label ?? option.text;
  return token === undefined || token === null ? null : (token as FieldPrefillValue);
}

const sameToken = (left: unknown, right: string) => String(left).trim().toLowerCase() === right.trim().toLowerCase();

/**
 * A stored default value read as a descriptor: blank is none, the date tokens
 * are today/now, a row-relative token (`nextDateAfterLastRow`) is left to the
 * runtime that owns it, anything else is a fixed value.
 */
function descriptorFromStoredValue(
  value: unknown,
  { underscoreTokens, entry }: { underscoreTokens: boolean; entry?: AnyRecord },
): BuilderDefaultAnswer | null {
  if (isBlankStoredDefault(value)) return null;
  if (underscoreTokens && value === "__today") return { kind: "today" };
  if (underscoreTokens && value === "__now") return { kind: "now" };
  if (isRecord(value) && typeof value.kind === "string" && TOKEN_KINDS.includes(value.kind)) {
    if (value.kind === "today") return { kind: "today" };
    if (value.kind === "now") return { kind: "now" };
    return null;
  }
  if (entry && entry.type === "booleanYesNo" && (typeof value === "string" || typeof value === "number")) {
    const [on, off] = yesNoOptionTokens(entry);
    if (optionTokens(on).some((token) => sameToken(value, token))) return { kind: "literal", value: true };
    if (optionTokens(off).some((token) => sameToken(value, token))) return { kind: "literal", value: false };
  }
  return { kind: "literal", value: cloneValue(value as FieldPrefillValue) };
}

function observationBindingOf(entry: AnyRecord): BuilderDefaultAnswer | null {
  const binding = entry.defaultFromObservation ?? entry.default_from_observation;
  if (!isRecord(binding)) return null;
  const code = nonEmptyString(binding.observationCode ?? binding.observation_code ?? binding.code);
  if (!code) return null;
  const system = nonEmptyString(binding.system);
  const lookbackDays = typeof binding.lookbackDays === "number" && Number.isFinite(binding.lookbackDays) && binding.lookbackDays > 0
    ? binding.lookbackDays
    : undefined;
  return {
    kind: "lastObservation",
    code,
    ...(system ? { system } : {}),
    ...(lookbackDays !== undefined ? { lookbackDays } : {}),
  };
}

/** What the legacy stores alone say, ignoring `defaultAnswer`. */
function readLegacyDefault(fieldLike: AnyRecord, shape: DefaultAnswerShape, bringForward: boolean | undefined): BuilderDefaultAnswer | null {
  if (shape === "subformEntry") {
    if (bringForward !== false) {
      const observation = observationBindingOf(fieldLike);
      if (observation) return observation;
    }
    const stored = hasOwn(fieldLike, "defaultValue") ? fieldLike.defaultValue : fieldLike.default_value;
    return descriptorFromStoredValue(stored, { underscoreTokens: true, entry: fieldLike });
  }

  if (!isBlankStoredDefault(fieldLike.prefill)) {
    return descriptorFromStoredValue(fieldLike.prefill, { underscoreTokens: false });
  }
  if (hasTodayFlag(fieldLike)) {
    const temporal = temporalKindOf(fieldLike);
    if (temporal === "date") return { kind: "today" };
    if (temporal === "dateTime") return { kind: "now" };
  }
  if (shape === "layoutCell") {
    // A bound cell is filled from its source; its defaultValue is only the
    // fallback. The one binding that is a default is the clock.
    if (sourcePathsOf(fieldLike).length > 0) return todayBindingOf(fieldLike);
    return descriptorFromStoredValue(fieldLike.defaultValue, { underscoreTokens: false });
  }
  return null;
}

/**
 * Whether the object carries any legacy default key for its shape, even an
 * emptied one (`prefill: null`, `prefillToday: false`). A writer that only
 * knows the legacy stores leaves such a key behind; an object with none of
 * them was written with the descriptor alone.
 */
function hasLegacyDefaultKey(fieldLike: AnyRecord, shape: DefaultAnswerShape): boolean {
  // A key holding undefined is absent: it does not survive saving as JSON.
  const present = (record: AnyRecord, key: string) => record[key] !== undefined;
  if (shape === "subformEntry") {
    return ["defaultValue", "default_value", "defaultFromObservation", "default_from_observation"].some((key) => present(fieldLike, key));
  }
  if (present(fieldLike, "prefill") || present(fieldLike, "prefillToday")) return true;
  if (isRecord(fieldLike.dateConfig) && present(fieldLike.dateConfig, "prefillToday")) return true;
  if (shape === "layoutCell") {
    if (todayBindingOf(fieldLike)) return true;
    if (sourcePathsOf(fieldLike).length === 0 && present(fieldLike, "defaultValue")) return true;
  }
  return false;
}

/** A copy without any legacy default spelling for its shape. */
function withoutLegacyDefault<T extends AnyRecord>(fieldLike: T, shape: DefaultAnswerShape): T {
  const next: AnyRecord = { ...fieldLike };
  if (shape === "subformEntry") {
    delete next.defaultValue;
    delete next.default_value;
    delete next.defaultFromObservation;
    delete next.default_from_observation;
    return next as T;
  }
  delete next.prefill;
  delete next.prefillToday;
  if (isRecord(next.dateConfig) && hasOwn(next.dateConfig, "prefillToday")) {
    const { prefillToday: _prefillToday, ...dateConfig } = next.dateConfig;
    next.dateConfig = dateConfig;
  }
  if (shape === "layoutCell" && !isLayoutDisplayCell(next)) {
    // The clock binding is a default; any other binding stays, with its
    // fallback (defaultValue).
    if (todayBindingOf(next)) {
      delete next.sourcePath;
      delete next.sourcePaths;
      delete next.sourceMode;
      delete next.sourceFormat;
      delete next.sourceFallback;
      delete next.defaultValue;
    } else if (sourcePathsOf(next).length === 0) {
      delete next.defaultValue;
    }
  }
  return next as T;
}

/** Writes the legacy spelling of `answer` onto a copy that has none (see withoutLegacyDefault). */
function applyLegacyMirror(next: AnyRecord, answer: BuilderDefaultAnswer | null, shape: DefaultAnswerShape, original: AnyRecord) {
  if (!answer) return;
  if (shape === "subformEntry") {
    if (answer.kind === "literal") {
      if (next.type === "booleanYesNo" && typeof answer.value === "boolean") {
        const [on, off] = yesNoOptionTokens(next);
        next.defaultValue = optionStoredToken(answer.value ? on : off);
      } else {
        next.defaultValue = cloneValue(answer.value);
      }
    } else if (answer.kind === "today") {
      next.defaultValue = "__today";
    } else if (answer.kind === "now") {
      next.defaultValue = "__now";
    } else if (answer.kind === "lastObservation") {
      const previous = original.defaultFromObservation ?? original.default_from_observation;
      const aspect = isRecord(previous)
        && nonEmptyString(previous.observationCode ?? previous.observation_code) === answer.code
        && typeof previous.aspect === "string"
        ? previous.aspect
        : undefined;
      next.defaultFromObservation = {
        observationCode: answer.code,
        ...(answer.system ? { system: answer.system } : {}),
        ...(answer.lookbackDays !== undefined ? { lookbackDays: answer.lookbackDays } : {}),
        ...(aspect ? { aspect } : {}),
      };
    }
    return;
  }
  if (answer.kind === "literal") {
    next.prefill = cloneValue(answer.value);
  } else if (answer.kind === "today" || answer.kind === "now") {
    const temporal = temporalKindOf(original);
    if (temporal === "date" || temporal === "dateTime") {
      next.dateConfig = { ...(isRecord(next.dateConfig) ? next.dateConfig : {}), prefillToday: true };
    }
  }
}

// ---------------------------------------------------------------------------
// Read, write, resolve
// ---------------------------------------------------------------------------

/**
 * The default answer a field-like object describes, from `defaultAnswer` or
 * any legacy spelling (see the table at the top of this file); null when it
 * has none.
 *
 * When a writer that only knew a legacy store changed or cleared it after
 * `defaultAnswer` was saved, the two disagree; the legacy store is then the
 * newer edit and wins, the way an edited formula text wins over a stale tree.
 * An object with no legacy key at all was written with the descriptor alone,
 * which then stands.
 */
export function readDefaultAnswer(fieldLike: unknown, options: ReadDefaultAnswerOptions = {}): BuilderDefaultAnswer | null {
  if (!isRecord(fieldLike)) return null;
  const shape = options.shape ?? inferDefaultAnswerShape(fieldLike);
  if (shape === "layoutCell" && isLayoutDisplayCell(fieldLike)) return null;
  if (shape === "field" && isDisplayField(fieldLike)) return null;

  const legacy = readLegacyDefault(fieldLike, shape, options.bringForward);
  const stored = normalizeDefaultAnswer(fieldLike.defaultAnswer);
  let answer = legacy;
  if (stored && !hasLegacyDefaultKey(fieldLike, shape)) {
    answer = stored;
  } else if (stored) {
    const mirrored = withoutLegacyDefault(fieldLike, shape);
    applyLegacyMirror(mirrored, stored, shape, fieldLike);
    const expected = readLegacyDefault(mirrored, shape, options.bringForward);
    if (sameDefaultAnswer(expected, legacy)) answer = stored;
  }
  if (answer && answer.kind === "lastObservation" && options.bringForward === false) {
    answer = readLegacyDefault(fieldLike, shape, false);
  }
  return answer ? cloneValue(answer) : null;
}

/**
 * A copy of `fieldLike` with `answer` stored as `defaultAnswer` and in the
 * legacy spelling older readers use (`prefill` for a fixed value,
 * `dateConfig.prefillToday` for today or now on a date; for a subform entry
 * `defaultValue` or `defaultFromObservation`). Every other legacy spelling is
 * removed. A null answer clears the default.
 */
export function writeDefaultAnswer<T extends object>(
  fieldLike: T,
  answer: BuilderDefaultAnswer | null | undefined,
  options: WriteDefaultAnswerOptions = {},
): T {
  const original = fieldLike as unknown as AnyRecord;
  const shape = options.shape ?? inferDefaultAnswerShape(original);
  const normalized = normalizeDefaultAnswer(answer);
  const next = withoutLegacyDefault(original, shape);
  applyLegacyMirror(next, normalized, shape, original);
  if (normalized) next.defaultAnswer = normalized;
  else delete next.defaultAnswer;
  return next as unknown as T;
}

/**
 * The same write as a patch of changed keys, for editors that merge patches
 * (`{ ...field, ...patch }`). Removed `prefill` and `defaultAnswer` are null,
 * other removed keys undefined.
 */
export function defaultAnswerPatch<T extends object>(
  fieldLike: T,
  answer: BuilderDefaultAnswer | null | undefined,
  options: WriteDefaultAnswerOptions = {},
): Partial<T> {
  const before = fieldLike as unknown as AnyRecord;
  const after = writeDefaultAnswer(fieldLike, answer, options) as unknown as AnyRecord;
  const patch: AnyRecord = {};
  const keys = Object.keys(before).concat(Object.keys(after).filter((key) => !hasOwn(before, key)));
  for (const key of keys) {
    if (stableJson(before[key]) === stableJson(after[key]) && hasOwn(before, key) === hasOwn(after, key)) continue;
    if (hasOwn(after, key)) patch[key] = after[key];
    else patch[key] = key === "prefill" || key === "defaultAnswer" ? null : undefined;
  }
  return patch as Partial<T>;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** The local calendar day (YYYY-MM-DD); toISOString would be UTC. */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** The local date and time a date-time control stores (YYYY-MM-DDTHH:mm). */
export function formatLocalDateTime(date: Date): string {
  return `${formatLocalDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * The value to seed for a default, or undefined when there is nothing to seed
 * (no default, a chart or observation reader that is missing or found nothing,
 * or "today" on a time answer). Today is a date (YYYY-MM-DD); now is a date
 * and time (YYYY-MM-DDTHH:mm), a date on a date answer and HH:mm on a time.
 */
export function resolveDefaultAnswer(answer: BuilderDefaultAnswer | null | undefined, context: DefaultAnswerContext): unknown {
  const normalized = normalizeDefaultAnswer(answer);
  if (!normalized) return undefined;
  const now = context && context.now instanceof Date && !Number.isNaN(context.now.getTime()) ? context.now : new Date();
  const temporal = normalizeTemporalKind(context?.fieldType ?? null);
  switch (normalized.kind) {
    case "literal":
      return cloneValue(normalized.value);
    case "today":
      return temporal === "time" ? undefined : formatLocalDate(now);
    case "now":
      if (temporal === "date") return formatLocalDate(now);
      if (temporal === "time") return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      return formatLocalDateTime(now);
    case "chart": {
      if (typeof context?.readChart !== "function") return undefined;
      const value = context.readChart({
        ...(normalized.concept ? { concept: normalized.concept } : {}),
        ...(normalized.paths ? { paths: [...normalized.paths] } : {}),
      });
      return isBlankAnswer(value) ? undefined : value;
    }
    case "lastObservation": {
      if (typeof context?.readLastObservation !== "function") return undefined;
      const value = context.readLastObservation(normalized.code, normalized.system, normalized.lookbackDays);
      return isBlankAnswer(value) ? undefined : value;
    }
  }
  return undefined;
}
