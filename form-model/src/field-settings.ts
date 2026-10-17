/**
 * Neutral field settings (neutral form model).
 *
 * Presentation and format settings every target understands, stored once in
 * neutral terms. Older forms, and the product settings an import keeps, spell
 * the same intent other ways; each reader below takes every spelling, and
 * each writer stores the neutral key with the one legacy mirror older readers
 * (and older builds of this app) still use. A reader trusts the neutral key
 * only while its mirror agrees: when they disagree, an editor that only knew
 * the legacy key changed it after the neutral key was saved, and the legacy
 * key wins (the rule defaults.ts and bindings.ts follow). A field with no
 * legacy key at all was written with the neutral key alone, which stands.
 *
 * | Concept | Neutral key | Legacy spellings read | Mirror written |
 * | --- | --- | --- | --- |
 * | Decimal places | `numberConfig.decimalPlaces` (a number answer); the calculated value's `precision` (a computed field, see below) | `cernerConfig.dta.definition.numericMap.decimalPlaces` (a set numeric map), `alayaCareConfig.scoreDecimals` | none on a number; both formula stores' `precision` on a computed field |
 * | Answer display order | `optionDisplayOrder` | `shuffleOptions: true` (shuffled), `cernerConfig.sortAlphabetic: true` (alphabetic) | `shuffleOptions`; `cernerConfig.sortAlphabetic` on a field that has a `cernerConfig` |
 * | Help position | `helpPosition` (now also `left_of_field`, `right_of_input`) | `cernerConfig.helpTextPosition` (`above`, `below`, `left`, `right`; `source` keeps the imported note where it was) | `cernerConfig.helpTextPosition` on a field that has a `cernerConfig` |
 * | Label position | `labelPosition` | `textareaConfig.labelPosition` | none: the textarea key is no longer written, and a write removes it |
 * | Choice answer layout | `choiceLayout` (`arrangement`, `order`, `density`) | `choiceAnswerLayout`, `choiceAnswerOrder`, `moisOptionSize` | all three |
 * | MOIS keyboard shortcuts | `moisConfig.autoHotKey`; per answer `moisConfig.hotKey`, `moisConfig.order` | top-level `autoHotKey`; an answer's `hotKey`, `order` | the top-level keys |
 *
 * A computed field keeps its decimal places as the calculated value's
 * `precision` (`computedConfig` and `calculatedValue`, resolved by
 * lib/computed-field-config.ts): those are the calculated-field settings, not
 * a product's, and a `numberConfig` on a computed field would make it look
 * like a typed number answer to the code that checks for one. The reader and
 * writer here treat both field kinds as one setting.
 *
 * `moisSize` (a MOIS control's width) stays where it is: the other targets
 * have no comparable control size (AlayaCare, FHIR and Cerner size answers
 * by the layout's width, which `width` already holds), so there is no
 * neutral meaning to store it under yet.
 *
 * This module has type imports only, so a kit generator can inline it.
 */
import type { BuilderChoiceOption, HelpPosition } from "./index";

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/** A key that is stored: present and not undefined (adapters spread `key: undefined`). */
const isStored = (value: AnyRecord, key: string) => hasOwn(value, key) && value[key] !== undefined;

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

/** The changed keys between two shallow copies, as a patch: removed keys are `undefined`. */
function patchBetween<T extends object>(before: T, after: T): Partial<T> {
  const left = before as unknown as AnyRecord;
  const right = after as unknown as AnyRecord;
  const patch: AnyRecord = {};
  const keys = Object.keys(left).concat(Object.keys(right).filter((key) => !hasOwn(left, key)));
  for (const key of keys) {
    if (stableJson(left[key]) === stableJson(right[key]) && hasOwn(left, key) === hasOwn(right, key)) continue;
    patch[key] = hasOwn(right, key) ? right[key] : undefined;
  }
  return patch as Partial<T>;
}

/** `record` without `key`, or the record itself when it has none; null when nothing is left. */
function withoutKey(record: AnyRecord, key: string): AnyRecord | null {
  if (!hasOwn(record, key)) return record;
  const { [key]: _removed, ...rest } = record;
  return Object.keys(rest).length ? rest : null;
}

// ---------------------------------------------------------------------------
// Decimal places
// ---------------------------------------------------------------------------

/** How many digits after the decimal point a number answer or a calculated result keeps. */
export interface NumberFormat {
  decimalPlaces?: number;
}

/** Where a field's decimal places were read from. */
export type NumberFormatSource =
  /** `numberConfig.decimalPlaces`, the neutral key on a number answer. */
  | "numberConfig"
  /** A computed field's calculated-value `precision`. */
  | "precision"
  /** `alayaCareConfig.scoreDecimals`, an AlayaCare score's own setting. */
  | "alayaCareScore"
  /** The bound Cerner DTA's numeric map (`cernerConfig.dta.definition.numericMap`). */
  | "cernerNumericMap";

export interface NumberFormatReading extends NumberFormat {
  source?: NumberFormatSource;
}

/** The most decimal places any target is asked to keep. */
export const MAX_DECIMAL_PLACES = 12;

/** A usable decimal-places value: a finite number of at least 0, rounded to a whole number, at most 12. */
export function decimalPlacesValue(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.min(MAX_DECIMAL_PLACES, Math.round(value));
}

function isComputedLike(field: AnyRecord): boolean {
  if (field.type === "computed") return true;
  return field.type === undefined && (isRecord(field.computedConfig) || isRecord(field.calculatedValue));
}

/** The calculated value's precision: calculatedValue's when usable, else computedConfig's (lib/computed-field-config.ts). */
function computedPrecision(field: AnyRecord): number | undefined {
  const value = isRecord(field.calculatedValue) ? decimalPlacesValue(field.calculatedValue.precision) : undefined;
  if (value !== undefined) return value;
  return isRecord(field.computedConfig) ? decimalPlacesValue(field.computedConfig.precision) : undefined;
}

/** A DTA numeric map's decimals, when the map is set (an all-zero map is the DTA Wizard's unset one). */
function cernerNumericMapDecimals(field: AnyRecord): number | undefined {
  const cerner = isRecord(field.cernerConfig) ? field.cernerConfig : null;
  const dta = cerner && isRecord(cerner.dta) ? cerner.dta : null;
  const definition = dta && isRecord(dta.definition) ? dta.definition : null;
  const map = definition && isRecord(definition.numericMap) ? definition.numericMap : null;
  if (!map) return undefined;
  if (map.maxDigits === 0 && !map.minDigits && !map.decimalPlaces) return undefined;
  const decimals = map.decimalPlaces;
  return typeof decimals === "number" && Number.isInteger(decimals) && decimals >= 0 ? decimals : undefined;
}

function alayaCareScoreDecimals(field: AnyRecord): number | undefined {
  return isRecord(field.alayaCareConfig) ? decimalPlacesValue(field.alayaCareConfig.scoreDecimals) : undefined;
}

/**
 * A field's decimal places, from the neutral key or any legacy spelling (see
 * the table at the top of this file). Empty when the field sets none.
 *
 * - A computed field: its calculated value's `precision`, else an AlayaCare
 *   score's `scoreDecimals`.
 * - A number answer: `numberConfig.decimalPlaces`, else the numeric map of
 *   the Cerner DTA it is bound to.
 *
 * Explicit product options still win for their own target: the AlayaCare
 * export prefers `scoreDecimals`, and a Cerner DTA the form does not define
 * keeps its own numeric map.
 */
export function readNumberFormat(fieldLike: unknown): NumberFormatReading {
  if (!isRecord(fieldLike)) return {};
  if (isComputedLike(fieldLike)) {
    const precision = computedPrecision(fieldLike);
    if (precision !== undefined) return { decimalPlaces: precision, source: "precision" };
    const score = alayaCareScoreDecimals(fieldLike);
    return score !== undefined ? { decimalPlaces: score, source: "alayaCareScore" } : {};
  }
  const own = isRecord(fieldLike.numberConfig) ? decimalPlacesValue(fieldLike.numberConfig.decimalPlaces) : undefined;
  if (own !== undefined) return { decimalPlaces: own, source: "numberConfig" };
  const map = cernerNumericMapDecimals(fieldLike);
  return map !== undefined ? { decimalPlaces: map, source: "cernerNumericMap" } : {};
}

/**
 * A copy of `fieldLike` with its decimal places set (or cleared with an
 * empty format): `numberConfig.decimalPlaces` on a number answer, both
 * formula stores' `precision` on a computed field. An AlayaCare
 * `scoreDecimals` is removed, since the neutral setting now says it.
 */
export function writeNumberFormat<T extends object>(fieldLike: T, format: NumberFormat | null | undefined): T {
  const original = fieldLike as unknown as AnyRecord;
  const decimals = decimalPlacesValue(format?.decimalPlaces);
  const next: AnyRecord = { ...original };
  if (isComputedLike(original)) {
    for (const key of ["computedConfig", "calculatedValue"]) {
      const store = original[key];
      if (!isRecord(store)) {
        if (key === "computedConfig" && decimals !== undefined) next.computedConfig = { expression: "", precision: decimals };
        continue;
      }
      const copy: AnyRecord = { ...store };
      if (decimals !== undefined) copy.precision = decimals;
      else delete copy.precision;
      next[key] = copy;
    }
  } else {
    const config = isRecord(original.numberConfig) ? { ...original.numberConfig } : null;
    if (decimals !== undefined) next.numberConfig = { ...(config ?? { typeNumber: decimals > 0 ? "decimal" : "number" }), decimalPlaces: decimals };
    else if (config) {
      delete config.decimalPlaces;
      next.numberConfig = config;
    }
  }
  if (isRecord(original.alayaCareConfig) && hasOwn(original.alayaCareConfig, "scoreDecimals")) {
    next.alayaCareConfig = withoutKey(original.alayaCareConfig, "scoreDecimals");
  }
  return next as unknown as T;
}

/** `writeNumberFormat` as a patch of changed keys, for editors that merge patches. */
export function numberFormatPatch<T extends object>(fieldLike: T, format: NumberFormat | null | undefined): Partial<T> {
  return patchBetween(fieldLike, writeNumberFormat(fieldLike, format));
}

/** `value` rounded to `decimalPlaces` (half away from zero), or unchanged when none are set. */
export function roundToDecimalPlaces(value: number, decimalPlaces: number | null | undefined): number {
  const decimals = decimalPlacesValue(decimalPlaces);
  if (decimals === undefined || !Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
}

// ---------------------------------------------------------------------------
// Answer display order
// ---------------------------------------------------------------------------

/**
 * The order a question shows its answers in: as authored, A to Z by label,
 * or shuffled for each person filling the form. Display only: answer
 * identities, stored values and the authored list never change.
 */
export type OptionDisplayOrder = "authored" | "alphabetic" | "shuffled";

export const OPTION_DISPLAY_ORDERS = ["authored", "alphabetic", "shuffled"] as const satisfies readonly OptionDisplayOrder[];

export function isOptionDisplayOrder(value: unknown): value is OptionDisplayOrder {
  return typeof value === "string" && (OPTION_DISPLAY_ORDERS as readonly string[]).includes(value);
}

function legacyDisplayOrder(field: AnyRecord): OptionDisplayOrder {
  if (field.shuffleOptions === true) return "shuffled";
  if (isRecord(field.cernerConfig) && field.cernerConfig.sortAlphabetic === true) return "alphabetic";
  return "authored";
}

function hasLegacyDisplayOrderKey(field: AnyRecord): boolean {
  return isStored(field, "shuffleOptions") || (isRecord(field.cernerConfig) && isStored(field.cernerConfig, "sortAlphabetic"));
}

/** What the legacy keys say once `order` is mirrored into them (see `writeOptionDisplayOrder`). */
function mirroredDisplayOrder(field: AnyRecord, order: OptionDisplayOrder): OptionDisplayOrder {
  const cerner = isRecord(field.cernerConfig);
  if (order === "shuffled") return "shuffled";
  if (order === "alphabetic") return cerner ? "alphabetic" : "authored";
  return "authored";
}

/**
 * A question's answer display order, from `optionDisplayOrder` or the
 * legacy keys (`shuffleOptions`, a Cerner `sortAlphabetic`). "authored" when
 * nothing says otherwise.
 */
export function readOptionDisplayOrder(fieldLike: unknown): OptionDisplayOrder {
  if (!isRecord(fieldLike)) return "authored";
  const legacy = legacyDisplayOrder(fieldLike);
  const stored = isOptionDisplayOrder(fieldLike.optionDisplayOrder) ? fieldLike.optionDisplayOrder : null;
  if (!stored) return legacy;
  if (!hasLegacyDisplayOrderKey(fieldLike)) return stored;
  return mirroredDisplayOrder(fieldLike, stored) === legacy ? stored : legacy;
}

/**
 * A copy of `fieldLike` with its answer display order: `optionDisplayOrder`
 * ("authored" removes it), mirrored as `shuffleOptions` (kept only where the
 * field already has the key or the order is shuffled) and, on a field with a
 * `cernerConfig`, as `cernerConfig.sortAlphabetic`.
 */
export function writeOptionDisplayOrder<T extends object>(fieldLike: T, order: OptionDisplayOrder | null | undefined): T {
  const original = fieldLike as unknown as AnyRecord;
  const value: OptionDisplayOrder = isOptionDisplayOrder(order) ? order : "authored";
  const next: AnyRecord = { ...original };
  if (value === "authored") delete next.optionDisplayOrder;
  else next.optionDisplayOrder = value;
  if (value === "shuffled") next.shuffleOptions = true;
  else if (hasOwn(original, "shuffleOptions")) next.shuffleOptions = false;
  if (isRecord(original.cernerConfig)) {
    const cerner: AnyRecord = { ...original.cernerConfig };
    if (value === "alphabetic") cerner.sortAlphabetic = true;
    else if (hasOwn(cerner, "sortAlphabetic")) cerner.sortAlphabetic = false;
    next.cernerConfig = cerner;
  }
  return next as unknown as T;
}

/** `writeOptionDisplayOrder` as a patch of changed keys. */
export function optionDisplayOrderPatch<T extends object>(fieldLike: T, order: OptionDisplayOrder | null | undefined): Partial<T> {
  return patchBetween(fieldLike, writeOptionDisplayOrder(fieldLike, order));
}

function optionLabelOf(option: BuilderChoiceOption): string {
  if (typeof option === "string") return option;
  if (isRecord(option)) {
    const label = (option as AnyRecord).label;
    if (typeof label === "string") return label;
    const value = (option as AnyRecord).value;
    if (typeof value === "string") return value;
  }
  return "";
}

/**
 * The answers in the order to show them: unchanged for "authored" and
 * "shuffled" (a shuffle happens where the form is filled, see
 * `shuffleForDisplay`), A to Z by label for "alphabetic" (a stable sort, so
 * equal labels keep their authored order).
 */
export function optionsInDisplayOrder<T extends BuilderChoiceOption>(options: readonly T[], order: OptionDisplayOrder): T[] {
  if (order !== "alphabetic") return [...options];
  return options
    .map((option, index) => ({ option, index, label: optionLabelOf(option) }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true }) || left.index - right.index)
    .map((entry) => entry.option);
}

/** A shuffled copy (Fisher–Yates) using `random` (defaults to Math.random). */
export function shuffleForDisplay<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Help position
// ---------------------------------------------------------------------------

export const HELP_POSITIONS = ["above_input", "below_input", "left_of_field", "right_of_input"] as const satisfies readonly HelpPosition[];

/** Cerner's help-note placements (`cernerConfig.helpTextPosition`), without `source`. */
export type CernerHelpPlacement = "above" | "below" | "left" | "right";

const CERNER_HELP_TO_NEUTRAL: Record<CernerHelpPlacement, HelpPosition> = {
  above: "above_input",
  below: "below_input",
  left: "left_of_field",
  right: "right_of_input",
};

const NEUTRAL_HELP_TO_CERNER: Record<HelpPosition, CernerHelpPlacement> = {
  above_input: "above",
  below_input: "below",
  left_of_field: "left",
  right_of_input: "right",
};

export function isHelpPosition(value: unknown): value is HelpPosition {
  return typeof value === "string" && (HELP_POSITIONS as readonly string[]).includes(value);
}

/** The Cerner placement for a neutral help position. */
export function cernerHelpPlacementFor(position: HelpPosition): CernerHelpPlacement {
  return NEUTRAL_HELP_TO_CERNER[position];
}

function cernerHelpKey(field: AnyRecord): unknown {
  return isRecord(field.cernerConfig) ? field.cernerConfig.helpTextPosition : undefined;
}

/**
 * Where a field's help text sits relative to it: `helpPosition`, or the
 * Cerner help-note placement when that is the newer edit. Below the input
 * when nothing says otherwise. A Cerner `source` placement (the imported
 * note stays where PowerForms had it) says nothing neutral, so
 * `helpPosition` decides.
 */
export function readHelpPosition(fieldLike: unknown): HelpPosition {
  if (!isRecord(fieldLike)) return "below_input";
  const stored = isHelpPosition(fieldLike.helpPosition) ? fieldLike.helpPosition : null;
  const cerner = cernerHelpKey(fieldLike);
  const legacy = typeof cerner === "string" && hasOwn(CERNER_HELP_TO_NEUTRAL, cerner) ? CERNER_HELP_TO_NEUTRAL[cerner as CernerHelpPlacement] : null;
  if (legacy && (!stored || NEUTRAL_HELP_TO_CERNER[stored] !== cerner)) return legacy;
  return stored ?? "below_input";
}

/**
 * A copy of `fieldLike` with its help position: `helpPosition`, mirrored as
 * `cernerConfig.helpTextPosition` on a field that has a `cernerConfig`
 * (which then leaves the imported note's source position).
 */
export function writeHelpPosition<T extends object>(fieldLike: T, position: HelpPosition): T {
  const original = fieldLike as unknown as AnyRecord;
  const value = isHelpPosition(position) ? position : "below_input";
  const next: AnyRecord = { ...original, helpPosition: value };
  if (isRecord(original.cernerConfig)) next.cernerConfig = { ...original.cernerConfig, helpTextPosition: NEUTRAL_HELP_TO_CERNER[value] };
  return next as unknown as T;
}

/** `writeHelpPosition` as a patch of changed keys. */
export function helpPositionPatch<T extends object>(fieldLike: T, position: HelpPosition): Partial<T> {
  return patchBetween(fieldLike, writeHelpPosition(fieldLike, position));
}

// ---------------------------------------------------------------------------
// Label position
// ---------------------------------------------------------------------------

export type FieldLabelPosition = "top" | "left" | "none";

const isLabelPosition = (value: unknown): value is FieldLabelPosition => value === "top" || value === "left" || value === "none";

/**
 * A field's own label position: `labelPosition`, or on a long-text answer
 * the retired `textareaConfig.labelPosition`, which the MOIS export has
 * always preferred (so it still wins while it is stored). Undefined when the
 * field follows the form's default.
 */
export function readLabelPosition(fieldLike: unknown): FieldLabelPosition | undefined {
  if (!isRecord(fieldLike)) return undefined;
  const textarea = isRecord(fieldLike.textareaConfig) ? fieldLike.textareaConfig.labelPosition : undefined;
  if (isLabelPosition(textarea)) return textarea;
  return isLabelPosition(fieldLike.labelPosition) ? fieldLike.labelPosition : undefined;
}

/**
 * A copy of `fieldLike` with its own label position (undefined follows the
 * form's default), with the retired `textareaConfig.labelPosition` removed.
 */
export function writeLabelPosition<T extends object>(fieldLike: T, position: FieldLabelPosition | null | undefined): T {
  const original = fieldLike as unknown as AnyRecord;
  const next: AnyRecord = { ...original };
  if (isLabelPosition(position)) next.labelPosition = position;
  else delete next.labelPosition;
  if (isRecord(original.textareaConfig) && hasOwn(original.textareaConfig, "labelPosition")) {
    const { labelPosition: _retired, ...rest } = original.textareaConfig;
    next.textareaConfig = rest;
  }
  return next as unknown as T;
}

/** `writeLabelPosition` as a patch of changed keys. */
export function labelPositionPatch<T extends object>(fieldLike: T, position: FieldLabelPosition | null | undefined): Partial<T> {
  return patchBetween(fieldLike, writeLabelPosition(fieldLike, position));
}

// ---------------------------------------------------------------------------
// Choice answer layout
// ---------------------------------------------------------------------------

/** How a radio or checkbox list lays out its answers. */
export type ChoiceArrangement = "vertical" | "responsive" | "inline" | "columns-2" | "columns-3" | "columns-4" | "columns-5" | "columns-6";
/** How answers fill a fixed-column grid. */
export type ChoiceAnswerFillOrder = "row-first" | "column-first";
/** The space around each answer, in the words the section question spacing uses. */
export type ChoiceDensity = "compact" | "standard" | "comfortable" | "spacious";

export interface BuilderChoiceLayout {
  arrangement?: ChoiceArrangement;
  order?: ChoiceAnswerFillOrder;
  density?: ChoiceDensity;
}

export const CHOICE_ARRANGEMENTS = ["vertical", "responsive", "inline", "columns-2", "columns-3", "columns-4", "columns-5", "columns-6"] as const satisfies readonly ChoiceArrangement[];
export const CHOICE_DENSITIES = ["compact", "standard", "comfortable", "spacious"] as const satisfies readonly ChoiceDensity[];

const isArrangement = (value: unknown): value is ChoiceArrangement => typeof value === "string" && (CHOICE_ARRANGEMENTS as readonly string[]).includes(value);
const isFillOrder = (value: unknown): value is ChoiceAnswerFillOrder => value === "row-first" || value === "column-first";
const isDensity = (value: unknown): value is ChoiceDensity => typeof value === "string" && (CHOICE_DENSITIES as readonly string[]).includes(value);

/**
 * MOIS answer sizes (`optionSize` on SimpleCodeChecklist, the theme's widths)
 * and the density each one reads as. MOIS draws "medium" when none is set.
 */
const MOIS_OPTION_SIZE_DENSITY: Record<string, ChoiceDensity> = {
  min: "compact",
  tiny: "compact",
  small: "compact",
  medium: "standard",
  large: "comfortable",
  max: "spacious",
};

/** The MOIS answer size a density is drawn with; standard is MOIS's own default (no size written). */
const DENSITY_MOIS_OPTION_SIZE: Record<ChoiceDensity, string | undefined> = {
  compact: "small",
  standard: undefined,
  comfortable: "large",
  spacious: "max",
};

/** The density a MOIS answer size reads as (undefined for an unknown size). */
export function densityForMoisOptionSize(size: unknown): ChoiceDensity | undefined {
  return typeof size === "string" ? MOIS_OPTION_SIZE_DENSITY[size.trim()] : undefined;
}

/** The MOIS answer size for a density (undefined: MOIS's default, medium). */
export function moisOptionSizeForDensity(density: ChoiceDensity | null | undefined): string | undefined {
  return density ? DENSITY_MOIS_OPTION_SIZE[density] : undefined;
}

function storedChoiceLayout(field: AnyRecord): BuilderChoiceLayout | null {
  const value = field.choiceLayout;
  if (!isRecord(value)) return null;
  const out: BuilderChoiceLayout = {};
  if (isArrangement(value.arrangement)) out.arrangement = value.arrangement;
  if (isFillOrder(value.order)) out.order = value.order;
  if (isDensity(value.density)) out.density = value.density;
  return out;
}

const trimmedString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/**
 * A choice's answer layout, from `choiceLayout` or the legacy keys
 * (`choiceAnswerLayout`, `choiceAnswerOrder`, `moisOptionSize`), part by
 * part: each part's legacy key wins when it disagrees with the neutral part
 * (an older editor changed it). Parts nothing sets are absent: the target's
 * default applies (responsive, across rows, standard).
 */
export function readChoiceLayout(fieldLike: unknown): BuilderChoiceLayout {
  if (!isRecord(fieldLike)) return {};
  const stored = storedChoiceLayout(fieldLike) ?? {};
  const out: BuilderChoiceLayout = {};
  const arrangement = isArrangement(fieldLike.choiceAnswerLayout) ? fieldLike.choiceAnswerLayout : undefined;
  const chosenArrangement = isStored(fieldLike, "choiceAnswerLayout") ? arrangement : stored.arrangement;
  if (chosenArrangement) out.arrangement = chosenArrangement;
  const order = isFillOrder(fieldLike.choiceAnswerOrder) ? fieldLike.choiceAnswerOrder : undefined;
  const chosenOrder = isStored(fieldLike, "choiceAnswerOrder") ? order : stored.order;
  if (chosenOrder) out.order = chosenOrder;
  const size = trimmedString(fieldLike.moisOptionSize);
  const sizeDensity = densityForMoisOptionSize(size);
  // A MOIS size reads as the stored density whenever it is that density's
  // size or one the same density covers (min and tiny are compact too).
  const density = size === undefined ? stored.density : stored.density && sizeDensity === stored.density ? stored.density : sizeDensity;
  if (density) out.density = density;
  return out;
}

/**
 * A copy of `fieldLike` with its answer layout: `choiceLayout` (parts left
 * undefined are removed), mirrored as `choiceAnswerLayout`,
 * `choiceAnswerOrder` and `moisOptionSize`. A MOIS size the density already
 * covers (a compact `min`) is kept as MOIS's exact size; otherwise the
 * density's MOIS size is written.
 */
export function writeChoiceLayout<T extends object>(fieldLike: T, layout: BuilderChoiceLayout | null | undefined): T {
  const original = fieldLike as unknown as AnyRecord;
  const next: AnyRecord = { ...original };
  const value: BuilderChoiceLayout = {};
  if (isArrangement(layout?.arrangement)) value.arrangement = layout!.arrangement;
  if (isFillOrder(layout?.order)) value.order = layout!.order;
  if (isDensity(layout?.density)) value.density = layout!.density;
  if (Object.keys(value).length) next.choiceLayout = value;
  else delete next.choiceLayout;
  if (value.arrangement) next.choiceAnswerLayout = value.arrangement;
  else delete next.choiceAnswerLayout;
  if (value.order) next.choiceAnswerOrder = value.order;
  else delete next.choiceAnswerOrder;
  const existingSize = trimmedString(original.moisOptionSize);
  if (value.density && existingSize && densityForMoisOptionSize(existingSize) === value.density) {
    next.moisOptionSize = existingSize;
  } else {
    const size = moisOptionSizeForDensity(value.density);
    if (size) next.moisOptionSize = size;
    else delete next.moisOptionSize;
  }
  return next as unknown as T;
}

/** `writeChoiceLayout` as a patch of changed keys. */
export function choiceLayoutPatch<T extends object>(fieldLike: T, layout: BuilderChoiceLayout | null | undefined): Partial<T> {
  return patchBetween(fieldLike, writeChoiceLayout(fieldLike, layout));
}

/**
 * The MOIS answer size to draw: the stored `moisOptionSize` (MOIS's exact
 * size, which wins for MOIS), else the density's size. Undefined leaves
 * MOIS's default.
 */
export function moisOptionSizeOf(fieldLike: unknown): string | undefined {
  if (!isRecord(fieldLike)) return undefined;
  return trimmedString(fieldLike.moisOptionSize) ?? moisOptionSizeForDensity(readChoiceLayout(fieldLike).density);
}

// ---------------------------------------------------------------------------
// MOIS keyboard shortcuts
// ---------------------------------------------------------------------------

/** A choice's MOIS keyboard shortcuts: one per answer (autoHotKey), or the answers' own keys and order. */
export interface MoisHotKeys {
  autoHotKey: boolean;
}

/** One answer's MOIS key and position (SimpleCodeSelect / SimpleCodeChecklist `hotKey`, `order`). */
export interface MoisOptionHotKey {
  hotKey?: string;
  order?: number;
}

function moisConfigOf(value: AnyRecord): AnyRecord | null {
  return isRecord(value.moisConfig) ? value.moisConfig : null;
}

/**
 * Whether MOIS gives each answer a key shortcut: `moisConfig.autoHotKey`, or
 * the top-level `autoHotKey` older forms store (which wins when the two
 * disagree, as the newer edit).
 */
export function readMoisHotKeys(fieldLike: unknown): MoisHotKeys {
  if (!isRecord(fieldLike)) return { autoHotKey: false };
  const config = moisConfigOf(fieldLike);
  if (isStored(fieldLike, "autoHotKey")) return { autoHotKey: fieldLike.autoHotKey === true };
  return { autoHotKey: config?.autoHotKey === true };
}

/** A copy of `fieldLike` with MOIS keyboard shortcuts on or off: `moisConfig.autoHotKey`, mirrored as `autoHotKey`. */
export function writeMoisHotKeys<T extends object>(fieldLike: T, hotKeys: MoisHotKeys): T {
  const original = fieldLike as unknown as AnyRecord;
  const next: AnyRecord = { ...original };
  const config: AnyRecord = { ...(moisConfigOf(original) ?? {}) };
  if (hotKeys.autoHotKey) {
    config.autoHotKey = true;
    next.autoHotKey = true;
  } else {
    delete config.autoHotKey;
    if (hasOwn(original, "autoHotKey")) next.autoHotKey = false;
  }
  if (Object.keys(config).length) next.moisConfig = config;
  else if (moisConfigOf(original)) next.moisConfig = null;
  return next as unknown as T;
}

/** `writeMoisHotKeys` as a patch of changed keys. */
export function moisHotKeysPatch<T extends object>(fieldLike: T, hotKeys: MoisHotKeys): Partial<T> {
  return patchBetween(fieldLike, writeMoisHotKeys(fieldLike, hotKeys));
}

/**
 * An answer's MOIS key and order: `moisConfig.hotKey` / `moisConfig.order`,
 * or the answer's top-level `hotKey` / `order` older forms store (each wins
 * when present, as the newer edit). The key is one character.
 */
export function readMoisOptionHotKey(option: unknown): MoisOptionHotKey {
  if (!isRecord(option)) return {};
  const config = moisConfigOf(option);
  const keySource = isStored(option, "hotKey") ? option.hotKey : config?.hotKey;
  const orderSource = isStored(option, "order") ? option.order : config?.order;
  const out: MoisOptionHotKey = {};
  const key = trimmedString(keySource);
  if (key) out.hotKey = key.slice(0, 1);
  if (typeof orderSource === "number" && Number.isFinite(orderSource)) out.order = orderSource;
  return out;
}

/**
 * A copy of an answer with its MOIS key and order: `moisConfig.hotKey` /
 * `moisConfig.order`, mirrored as the top-level `hotKey` / `order`. A string
 * answer becomes an object answer only when a key or order is set.
 */
export function writeMoisOptionHotKey<T extends BuilderChoiceOption>(option: T, value: MoisOptionHotKey): T {
  const key = trimmedString(value.hotKey)?.slice(0, 1);
  const order = typeof value.order === "number" && Number.isFinite(value.order) ? value.order : undefined;
  if (typeof option === "string") {
    if (key === undefined && order === undefined) return option;
    return writeMoisOptionHotKey({ label: option } as unknown as T, value);
  }
  if (!isRecord(option)) return option;
  const next: AnyRecord = { ...(option as AnyRecord) };
  const config: AnyRecord = { ...(moisConfigOf(next) ?? {}) };
  if (key !== undefined) {
    config.hotKey = key;
    next.hotKey = key;
  } else {
    delete config.hotKey;
    delete next.hotKey;
  }
  if (order !== undefined) {
    config.order = order;
    next.order = order;
  } else {
    delete config.order;
    delete next.order;
  }
  if (Object.keys(config).length) next.moisConfig = config;
  else delete next.moisConfig;
  return next as unknown as T;
}
