/**
 * Reading stored answers and option definitions, whatever shape they were
 * saved in.
 *
 * The neutral model's canonical shapes are: an option `{ code, display,
 * system?, score? }`, a Coding for a coded answer, a boolean for yes/no and a
 * local calendar date for a date. Saved forms and runtimes hold many older
 * shapes (see values.test.ts for the full case table); these helpers accept
 * all of them so readers never need their own normalizer.
 *
 * This file must stay self-contained (no imports): scripts/generate-value-kit.mjs
 * bundles it into the NHForms ValueKit helper module, so the MOIS runtime and
 * the builder read values with the same code.
 */

export interface NormalizedOption {
  /** Stored value. Never empty unless the option had neither code nor label. */
  code: string;
  /** Label shown to the person filling the form. */
  display: string;
  system?: string;
  /** Numeric value used by score formulas and scales. */
  score?: number;
}

export interface ChoiceValue {
  code: string;
  display?: string;
  system?: string;
}

export interface BooleanLabels {
  on?: string | null;
  off?: string | null;
}

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

/** A scalar as text; blank strings, non-finite numbers and non-scalars are missing. */
function scalarText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value === "boolean") return String(value);
  return undefined;
}

function firstText(record: AnyRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const text = scalarText(record[key]);
    if (text !== undefined) return text;
  }
  return undefined;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

// FHIR answerOption carries its score in an ordinalValue (or itemWeight) extension.
const FHIR_SCORE_EXTENSION = /\/(ordinalValue|itemWeight)$/;

function fhirExtensionScore(extensions: unknown): number | undefined {
  if (!Array.isArray(extensions)) return undefined;
  for (const extension of extensions) {
    if (!isRecord(extension) || typeof extension.url !== "string" || !FHIR_SCORE_EXTENSION.test(extension.url)) continue;
    const score = finiteNumber(extension.valueDecimal ?? extension.valueInteger);
    if (score !== undefined) return score;
  }
  return undefined;
}

const FHIR_ANSWER_KEYS = ["valueCoding", "valueString", "valueInteger", "valueDecimal", "valueDate", "valueTime"] as const;

function fhirAnswerValue(record: AnyRecord): unknown {
  for (const key of FHIR_ANSWER_KEYS) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

// Stored value first, then the coded-list spellings, then the dform "state".
const OPTION_CODE_KEYS = ["value", "code", "key", "id", "state"] as const;
// A numeric `value` on an option is its ordinal score (scale and scoring
// options), so the stored code comes from the other keys first.
const ORDINAL_OPTION_CODE_KEYS = ["code", "key", "id", "state", "value"] as const;
const OPTION_DISPLAY_KEYS = ["label", "display", "text"] as const;

function withOptional(option: NormalizedOption, system: string | undefined, score: number | undefined): NormalizedOption {
  if (system !== undefined) option.system = system;
  if (score !== undefined) option.score = score;
  return option;
}

/**
 * Normalize any option definition: a bare string or number, builder
 * `{ label, value, score }`, coded `{ code, display, system }` and
 * `{ key, text }`, subform `{ id, key, label, value, system }`, scoring
 * `{ id, label, score }` and dform `{ label, state, score }`, scale
 * `{ value: number, label, key? }`, and FHIR answerOption `{ valueCoding }`.
 *
 * code ← value ?? code ?? key ?? id ?? state (a numeric value is the score, so
 * it comes last), display ← label ?? display ?? text. Blank strings count as
 * missing, and each side falls back to the other.
 */
export function normalizeOption(raw: unknown): NormalizedOption {
  if (raw === null || raw === undefined) return { code: "", display: "" };
  if (!isRecord(raw)) {
    const text = scalarText(raw) ?? "";
    return { code: text, display: text };
  }

  const fhirValue = fhirAnswerValue(raw);
  if (fhirValue !== undefined && raw.value === undefined && raw.code === undefined && raw.label === undefined) {
    const inner = normalizeOption(fhirValue);
    return withOptional({ code: inner.code, display: inner.display }, inner.system, inner.score ?? fhirExtensionScore(raw.extension));
  }

  const ordinal = typeof raw.value === "number" && Number.isFinite(raw.value) ? raw.value : undefined;
  const code = firstText(raw, ordinal === undefined ? OPTION_CODE_KEYS : ORDINAL_OPTION_CODE_KEYS);
  const display = firstText(raw, OPTION_DISPLAY_KEYS);
  return withOptional(
    { code: code ?? display ?? "", display: display ?? code ?? "" },
    scalarText(raw.system),
    finiteNumber(raw.score) ?? ordinal,
  );
}

const BOOLEAN_TRUE_TEXT = ["true", "t", "yes", "y", "on", "1", "checked", "selected", "x"];
const BOOLEAN_FALSE_TEXT = ["false", "f", "no", "n", "off", "0", "unchecked", "unselected"];
// Where a stored object keeps its answer: Codings, subform selections, option-like wrappers.
const BOOLEAN_OBJECT_KEYS = ["code", "selectedKey", "value", "key", "display", "response", "text", "label"] as const;

function normalizedLabel(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * A stored yes/no or tick-box answer as true/false, or null when it is
 * unanswered or not a yes/no value. Reads booleans, 1/0, "true"/"false",
 * "yes"/"no", "y"/"n", "on"/"off", "checked"/"unchecked", MOIS-YESNO Codings
 * (code Y/N), subform selections (`{ selectedKey: "true", response: "Checked" }`),
 * `{ value }` wrappers and one-element arrays. `labels` adds the field's own
 * on/off labels ("Present"/"Absent").
 */
export function readBoolean(value: unknown, labels?: BooleanLabels | null): boolean | null {
  if (value === true || value === false) return value;
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (!text) return null;
    const on = normalizedLabel(labels?.on);
    const off = normalizedLabel(labels?.off);
    if (on && text === on) return true;
    if (off && text === off) return false;
    if (BOOLEAN_TRUE_TEXT.includes(text)) return true;
    if (BOOLEAN_FALSE_TEXT.includes(text)) return false;
    return null;
  }
  if (Array.isArray(value)) return value.length === 1 ? readBoolean(value[0], labels) : null;
  if (isRecord(value)) {
    for (const key of BOOLEAN_OBJECT_KEYS) {
      const result = readBoolean(value[key], labels);
      if (result !== null) return result;
    }
  }
  return null;
}

const CHOICE_CODE_KEYS = ["code", "value", "key", "id"] as const;
const CHOICE_DISPLAY_KEYS = ["display", "response", "label", "text"] as const;

function choiceValue(code: string, display: string | undefined, system: string | undefined): ChoiceValue {
  const entry: ChoiceValue = { code };
  if (display !== undefined) entry.display = display;
  if (system !== undefined) entry.system = system;
  return entry;
}

function readChoiceEntries(value: unknown): ChoiceValue[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(readChoiceEntries);
  if (!isRecord(value)) {
    const code = scalarText(value);
    return code === undefined ? [] : [{ code }];
  }
  // A FHIR CodeableConcept is one answer: its first coding.
  if (Array.isArray(value.coding)) return readChoiceEntries(value.coding[0]);
  if (isRecord(value.valueCoding)) return readChoiceEntries(value.valueCoding);
  // FindCodeSelect selections: { selectedItems: [...] } (multiple) and
  // { selectedItem } (one), each item a Coding or a code-list entry.
  if (Array.isArray(value.selectedItems)) return value.selectedItems.flatMap(readChoiceEntries);
  if ("selectedItem" in value) return readChoiceEntries(value.selectedItem);
  // Subform and scale selections: { selectedKey, value, response }.
  if ("selectedKey" in value) {
    const code = scalarText(value.selectedKey);
    if (code === undefined) return [];
    return [choiceValue(code, firstText(value, ["response", "display", "text", "label"]), scalarText(value.system))];
  }
  // Subform multiple selections: { selectedIds, selectedLabels }, matched by
  // position; a selection with only a label reads the label as its code.
  if (Array.isArray(value.selectedIds) || Array.isArray(value.selectedLabels)) {
    const ids = Array.isArray(value.selectedIds) ? value.selectedIds : [];
    const labels = Array.isArray(value.selectedLabels) ? value.selectedLabels : [];
    const entries: ChoiceValue[] = [];
    for (let index = 0; index < Math.max(ids.length, labels.length); index += 1) {
      const label = scalarText(labels[index]);
      const code = scalarText(ids[index]) ?? label;
      if (code !== undefined) entries.push(choiceValue(code, label, undefined));
    }
    return entries;
  }
  // { value } wrappers around a Coding or a list.
  if (value.value !== null && typeof value.value === "object") return readChoiceEntries(value.value);
  const display = firstText(value, CHOICE_DISPLAY_KEYS);
  const code = firstText(value, CHOICE_CODE_KEYS) ?? display;
  return code === undefined ? [] : [choiceValue(code, display, scalarText(value.system))];
}

function sameText(left: string | undefined, right: string | undefined): boolean {
  return left !== undefined && right !== undefined && left.trim().toLowerCase() === right.trim().toLowerCase();
}

function resolveAgainstOptions(entry: ChoiceValue, options: NormalizedOption[]): ChoiceValue {
  const match =
    options.find((option) => option.code === entry.code) ??
    options.find((option) => sameText(option.code, entry.code)) ??
    options.find((option) => sameText(option.display, entry.code) || sameText(option.display, entry.display));
  if (!match) return entry;
  return choiceValue(match.code, match.display, entry.system ?? match.system);
}

/**
 * A stored choice answer as a list of coded values (empty when unanswered).
 * Reads bare codes, Codings, arrays of either, FHIR CodeableConcepts, subform
 * selections (`{ selectedKey, value, response }`, `{ selectedIds,
 * selectedLabels }`), FindCodeSelect selections (`{ selectedItems }`,
 * `{ selectedItem }`), option-shaped objects and `{ value }` wrappers. With
 * `options`, each value is matched to its option by code and then by label, so
 * answers saved as label strings read back as the option's code.
 */
export function readChoice(value: unknown, options?: readonly unknown[] | null): ChoiceValue[] {
  const entries = readChoiceEntries(value);
  if (!Array.isArray(options) || options.length === 0 || entries.length === 0) return entries;
  const normalized = options.map(normalizeOption).filter((option) => option.code !== "" || option.display !== "");
  return entries.map((entry) => resolveAgainstOptions(entry, normalized));
}

// DateSelect stores its formatted display string, so every builder dateFormat
// parses explicitly. After a two-digit day or month, slashes are day-first and
// dashes month-first; ISO leads with a four-digit year, so it cannot collide
// with MM-dd-yyyy. A time may follow any of them.
const DATE_FORMATS: ReadonlyArray<{ pattern: RegExp; order: readonly [number, number, number] }> = [
  { pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})/, order: [1, 2, 3] }, // yyyy-MM-dd
  { pattern: /^(\d{4})\.(\d{1,2})\.(\d{1,2})/, order: [1, 2, 3] }, // yyyy.MM.dd (DateSelect default)
  { pattern: /^(\d{4})\/(\d{1,2})\/(\d{1,2})/, order: [1, 2, 3] }, // yyyy/MM/dd
  { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, order: [3, 2, 1] }, // dd/MM/yyyy
  { pattern: /^(\d{1,2})-(\d{1,2})-(\d{4})/, order: [3, 1, 2] }, // MM-dd-yyyy
];
const TIME_SUFFIX = /^(?:[T ]|\s+)(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

export interface DateTimeValue {
  /** Local midnight for a date-only value. */
  date: Date;
  /** True when the stored value named a calendar day without a time. */
  dateOnly: boolean;
}

/**
 * Date or date-and-time text. Date-only text is a local calendar date; a time
 * without a zone is local time, one with `Z` or an offset is exact. Rolled-over
 * dates (31/04) and any other text are null: text is never handed to
 * `new Date(text)`, whose reading differs between engines.
 */
function parseDateText(text: string): DateTimeValue | null {
  const trimmed = text.trim();
  for (const format of DATE_FORMATS) {
    const match = format.pattern.exec(trimmed);
    if (!match) continue;
    const [year, month, day] = format.order.map((index) => Number(match[index]));
    const midnight = new Date(year, month - 1, day);
    if (midnight.getFullYear() !== year || midnight.getMonth() !== month - 1 || midnight.getDate() !== day) return null;
    const rest = trimmed.slice(match[0].length);
    if (rest === "") return { date: midnight, dateOnly: true };
    const time = TIME_SUFFIX.exec(rest);
    if (!time) return null;
    const hours = Number(time[1]);
    const minutes = Number(time[2]);
    const seconds = time[3] ? Number(time[3]) : 0;
    const millis = time[4] ? Number(time[4].slice(0, 3).padEnd(3, "0")) : 0;
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    if (!time[5]) return { date: new Date(year, month - 1, day, hours, minutes, seconds, millis), dateOnly: false };
    const zone = time[5].toUpperCase();
    let offsetMinutes = 0;
    if (zone !== "Z") {
      const digits = zone.replace(":", "");
      offsetMinutes = (Number(digits.slice(1, 3)) * 60 + Number(digits.slice(3, 5))) * (digits[0] === "-" ? -1 : 1);
    }
    return { date: new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, millis) - offsetMinutes * 60_000), dateOnly: false };
  }
  return null;
}

const DATE_OBJECT_KEYS = ["value", "date", "text", "display"] as const;

/**
 * A stored date or date-and-time with whether it names a calendar day only,
 * or null when blank or unreadable. Reads the same shapes as `readDate`; the
 * formula evaluator uses it to count whole days between date-only values.
 */
export function readDateTime(value: unknown): DateTimeValue | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? { date: new Date(value.getTime()), dateOnly: false } : null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? { date, dateOnly: false } : null;
  }
  if (typeof value === "string") return value.trim() ? parseDateText(value) : null;
  if (isRecord(value)) {
    for (const key of DATE_OBJECT_KEYS) {
      const date = readDateTime(value[key]);
      if (date) return date;
    }
  }
  return null;
}

/**
 * A stored date as a Date, or null when blank or unreadable. Date-only
 * strings (yyyy-MM-dd, yyyy.MM.dd, yyyy/MM/dd, dd/MM/yyyy, MM-dd-yyyy) are
 * local calendar dates at midnight, not UTC midnight, so local getters read
 * the saved day. The same formats followed by a time (ISO 8601 date-times
 * included), epoch milliseconds, Date objects and `{ value | date | text |
 * display }` wrappers are read too; other text is not a date.
 */
export function readDate(value: unknown): Date | null {
  return readDateTime(value)?.date ?? null;
}
