/**
 * Required and validation in the neutral form model
 * (docs/.../proposals/neutral-form-model.md, "Required and validation").
 *
 * A field's checks are saved in several places: `required` (or, for a
 * Cerner-imported field, only `cernerConfig.preferences.required`), the
 * Logic tab's "set required" and "clear required" rules, `validation.format`,
 * `validation.rules` (Form.io and FHIR imports), the type's own format (email,
 * phone, web address), length and number settings on the type's config, date
 * limits on `dateConfig`, an allow or block list, cross-field rules in
 * `behavior.validations` and Logic-tab `invalid` rules. `readFieldValidation`
 * reads all of them into one `NeutralFieldValidation`; converters and the
 * documents target read that instead of the stores.
 *
 * `validateAnswer` is the reference check, pure TypeScript with no DOM. It
 * follows `FormLogicKit.validate` in the exported MOIS form: a hidden field is
 * never checked, an empty answer only meets the required check (and Logic-tab
 * `invalid` rules, which fire whatever the answer), and every other check
 * runs on a non-empty answer. The shared cases are in `validation.cases.ts`.
 */
import type {
  BuilderDateValidationUnit,
  BuilderField,
  BuilderRelativeDateConstraint,
  BuilderValidationRule,
  FieldConditionGroup,
  FieldLinkRule,
} from "./index";
import {
  DEFAULT_CROSS_FIELD_VALIDATION_MESSAGE,
  evaluateConditionGroup,
  getFieldLinkConditionGroup,
  isConditionValueEmpty,
  visibilityRuleToFieldLinkConditions,
  type FieldConditionMetadataLookup,
} from "./conditions";
import { FIELD_TYPE_PROFILES, neutralAnswerTypeOf, type FieldTypeProfile } from "./field-types";
import { readDate } from "./values";

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/**
 * Value formats. `email`, `phone` and `url` come from the field type (or an
 * imported `validation.rules` entry); the others from `validation.format`.
 */
export const NEUTRAL_VALUE_FORMATS = ["email", "phone", "url", "bc-phn", "ca-postal", "money"] as const;
export type NeutralValueFormat = (typeof NEUTRAL_VALUE_FORMATS)[number];

/** Where a field's default required state was read from. */
export type NeutralRequiredSource =
  /** `required` on the field (true or an explicit false). */
  | "field"
  /** `requiredWhenVisible`, the legacy table-column alias of `required`. */
  | "legacy-alias"
  /** A `validation.rules` entry of type "required". */
  | "validation-rule"
  /** `cernerConfig.preferences.required`, kept from a PowerForm or iView import. */
  | "cerner-preference"
  /** `fhirConfig.questionnaireItem.required`, kept from a FHIR Questionnaire import. */
  | "fhir-item";

/** A Logic-tab rule that changes whether the field is required while its condition holds. */
export interface NeutralRequiredWhen {
  ruleId: string;
  /** `set`: required while the condition holds; `clear`: not required while it holds. */
  effect: "set" | "clear";
  when: FieldConditionGroup;
}

export interface NeutralFormatCheck {
  format: NeutralValueFormat;
  /** The author's message; absent means the format's default message. */
  message?: string;
  source: "type" | "validation.format" | "validation.rules";
}

export interface NeutralLengthLimit {
  min?: number;
  max?: number;
  messages?: { min?: string; max?: string };
  /** The stores the limits came from, e.g. `validation.rules`, `textConfig.maxCharLimit`. */
  sources: string[];
}

export interface NeutralNumberLimit {
  min?: number;
  max?: number;
  /** Whole numbers only (a number field's default "number" type, a year, a rating). */
  wholeNumber?: boolean;
  /** A four-digit year, 1900 to 2099 (the MOIS year check). */
  year?: boolean;
  messages?: { min?: string; max?: string };
  sources: string[];
}

/** One end of a date range: a fixed day, or a day counted from today. */
export type NeutralDateBound =
  | { kind: "date"; date: string }
  | { kind: "today"; direction: "before" | "after" | "exact"; value: number; unit: BuilderDateValidationUnit };

export interface NeutralDateLimit {
  /** The answer must be on or after every one of these. */
  earliest: NeutralDateBound[];
  /** The answer must be on or before every one of these. */
  latest: NeutralDateBound[];
  sources: string[];
}

export interface NeutralPatternCheck {
  /** A regular expression the whole answer must match. */
  pattern: string;
  message?: string;
}

export interface NeutralListCheck {
  mode: "allow" | "deny";
  /** What is compared: the whole answer, or an email's domain or full address. */
  match: "value" | "email-domain" | "email-address";
  /** Lower-cased entries. */
  values: string[];
  message?: string;
}

export interface NeutralCrossFieldCheck {
  id: string;
  source: "behavior" | "logic-rule";
  /**
   * `valid-when`: the answer is valid only while the condition holds
   * (`behavior.validations`). `invalid-when`: the condition describes what is
   * wrong (a Logic-tab `invalid` rule).
   */
  kind: "valid-when" | "invalid-when";
  condition: FieldConditionGroup;
  message: string;
  translations?: Record<string, string>;
}

export interface NeutralFieldValidation {
  fieldId: string;
  label: string;
  /** Required before any Logic-tab rule applies. */
  required: boolean;
  requiredSource: NeutralRequiredSource | null;
  requiredMessage?: string;
  requiredWhen: NeutralRequiredWhen[];
  formats: NeutralFormatCheck[];
  length: NeutralLengthLimit | null;
  number: NeutralNumberLimit | null;
  date: NeutralDateLimit | null;
  patterns: NeutralPatternCheck[];
  list: NeutralListCheck | null;
  crossField: NeutralCrossFieldCheck[];
  /** `validation.customError`: the allow or block list's message. */
  customError?: string;
  /** Saved rules no reader can apply: converters report them as losses. */
  unsupported: Array<{ rule: BuilderValidationRule; reason: string }>;
}

export interface ReadFieldValidationContext {
  /** The form's Logic-tab rules; the ones targeting this field add required-when and cross-field checks. */
  fieldLinkRules?: ReadonlyArray<FieldLinkRule> | null;
}

/** Any field-like object: a `BuilderField`, or a nested field projected by its adapter. */
export type ValidationFieldInput = Pick<BuilderField, "id" | "type"> & Partial<BuilderField> & {
  /** Legacy table-column alias of `required`. */
  requiredWhenVisible?: boolean;
  /** Table-column row-save message. */
  requiredMessage?: string;
};

// ---------------------------------------------------------------------------
// Default messages
// ---------------------------------------------------------------------------

/**
 * Messages used when the author wrote none. The email, phone, whole-number and
 * year wording matches the exported MOIS checks; the PHN, postal-code and
 * money wording matches `FORMAT_DEFINITIONS` in lib/validation/formats.ts
 * (a parity test keeps them equal).
 */
export const DEFAULT_FORMAT_MESSAGES: Readonly<Record<NeutralValueFormat, string>> = {
  email: "Please enter a valid email address",
  phone: "Please enter a valid phone number",
  url: "Please enter a valid web address",
  "bc-phn": "Enter a valid 10-digit BC Personal Health Number (it starts with 9)",
  "ca-postal": "Enter a valid Canadian postal code, like A1A 1A1",
  money: "Enter an amount in dollars and cents, like 12.50",
};

export function defaultRequiredMessage(label: string): string {
  return `${label || "This field"} is required`;
}

function defaultListMessage(list: Pick<NeutralListCheck, "mode" | "match">): string {
  if (list.match === "email-address") {
    return list.mode === "allow" ? "Please use an approved email address" : "This email address is not allowed";
  }
  if (list.match === "email-domain") {
    return list.mode === "allow" ? "Please use an approved email domain" : "This email domain is not allowed";
  }
  return list.mode === "allow" ? "Choose one of the allowed answers" : "This answer is not allowed";
}

// ---------------------------------------------------------------------------
// Reading the stores
// ---------------------------------------------------------------------------

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function positiveLimit(value: unknown): number | undefined {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

const CERNER_TRUE = new Set(["true", "1"]);

function readRequired(field: ValidationFieldInput): { required: boolean; source: NeutralRequiredSource | null } {
  if (field.required === true) return { required: true, source: "field" };
  // Same meaning as `required` (isTableColumnRequired reads either).
  if (field.requiredWhenVisible === true) return { required: true, source: "legacy-alias" };
  // An explicit false overrides imported defaults (cernerFieldRequired).
  if (field.required === false) return { required: false, source: "field" };
  if ((field.validation?.rules ?? []).some((rule) => rule?.type === "required")) {
    return { required: true, source: "validation-rule" };
  }
  const preference = field.cernerConfig?.preferences?.required;
  if (typeof preference === "string") return { required: CERNER_TRUE.has(preference), source: "cerner-preference" };
  // Forms imported from FHIR before the importer wrote `required` keep it only
  // on the imported item; read it so those forms stay required everywhere.
  const fhirItemRequired = (field.fhirConfig?.questionnaireItem as { required?: unknown } | undefined)?.required;
  if (typeof fhirItemRequired === "boolean") return { required: fhirItemRequired, source: "fhir-item" };
  return { required: false, source: null };
}

function rulesTargeting(field: ValidationFieldInput, rules: ReadonlyArray<FieldLinkRule> | null | undefined): FieldLinkRule[] {
  return (rules ?? []).filter((rule) => Array.isArray(rule?.targetFieldIds) && rule.targetFieldIds.includes(field.id));
}

function profileOf(field: ValidationFieldInput): FieldTypeProfile | undefined {
  return (FIELD_TYPE_PROFILES as Record<string, FieldTypeProfile>)[field.type];
}

const RULE_FORMATS: Partial<Record<BuilderValidationRule["type"], NeutralValueFormat>> = { email: "email", url: "url" };
const VALUE_FORMAT_SETTINGS = new Set<string>(["bc-phn", "ca-postal", "money"]);

function readFormats(field: ValidationFieldInput): NeutralFormatCheck[] {
  const checks: NeutralFormatCheck[] = [];
  const add = (check: NeutralFormatCheck) => {
    const existing = checks.find((entry) => entry.format === check.format);
    if (!existing) checks.push(check);
    else if (!existing.message && check.message) existing.message = check.message;
  };
  const rules = field.validation?.rules ?? [];
  const ruleMessage = (format: NeutralValueFormat) =>
    nonEmptyText(rules.find((rule) => RULE_FORMATS[rule?.type] === format)?.message);
  const textFormat = profileOf(field)?.textFormat;
  if (textFormat === "email" || textFormat === "phone" || textFormat === "url") {
    const message = ruleMessage(textFormat);
    add({ format: textFormat, source: "type", ...(message ? { message } : {}) });
  }
  for (const rule of rules) {
    const format = rule ? RULE_FORMATS[rule.type] : undefined;
    if (!format) continue;
    const message = nonEmptyText(rule.message);
    add({ format, source: "validation.rules", ...(message ? { message } : {}) });
  }
  const setting = field.validation?.format;
  if (typeof setting === "string" && VALUE_FORMAT_SETTINGS.has(setting)) {
    const message = nonEmptyText(field.validation?.formatMessage);
    add({ format: setting as NeutralValueFormat, source: "validation.format", ...(message ? { message } : {}) });
  }
  return checks;
}

function ruleBound(rules: BuilderValidationRule[], type: BuilderValidationRule["type"]) {
  const rule = rules.find((entry) => entry?.type === type && finiteNumber(entry.value) !== undefined);
  return rule ? { value: finiteNumber(rule.value)!, message: nonEmptyText(rule.message) } : undefined;
}

function readLength(field: ValidationFieldInput, rules: BuilderValidationRule[]): NeutralLengthLimit | null {
  const sources: string[] = [];
  const limit: NeutralLengthLimit = { sources };
  const messages: NonNullable<NeutralLengthLimit["messages"]> = {};
  const minRule = ruleBound(rules, "minLength");
  const maxRule = ruleBound(rules, "maxLength");
  if (minRule && minRule.value > 0) {
    limit.min = minRule.value;
    if (minRule.message) messages.min = minRule.message;
    sources.push("validation.rules");
  }
  // The character limit the editors change wins over an imported maxLength
  // rule, which no editor shows: a FHIR import writes both, and only the
  // character limit follows the author's later edits.
  const config = field.type === "textarea" ? field.textareaConfig : field.textConfig;
  const characterLimit = positiveLimit(config?.maxCharLimit);
  if (characterLimit !== undefined) {
    limit.max = characterLimit;
    sources.push(field.type === "textarea" ? "textareaConfig.maxCharLimit" : "textConfig.maxCharLimit");
  } else if (maxRule && maxRule.value > 0) {
    limit.max = maxRule.value;
    if (maxRule.message) messages.max = maxRule.message;
    if (!sources.includes("validation.rules")) sources.push("validation.rules");
  }
  if (messages.min || messages.max) limit.messages = messages;
  return limit.min !== undefined || limit.max !== undefined ? limit : null;
}

/**
 * Number limits of a number, slider, rating or numeric scale field (a labeled
 * scale stores option keys, which may be codes). Null when the field sets no
 * limit: that the answer is a number at all belongs to the answer type, which
 * each target's control or coercion already checks.
 *
 * A number field's `numberConfig.spinButtonProps` range is a hard limit only
 * with stepper buttons (`buttonControls`), the one mode in which the MOIS
 * Numeric applies it. Without them the stored range is the answer's expected
 * range, not a limit: LOINC and DTA definitions and subform entries write it
 * that way, like Cerner's feasible range, which questions a value outside it
 * rather than refusing it. So it is not read here, and no target converter
 * sends it as a minimum or maximum (every converter reads number limits from
 * here only).
 */
function readNumber(field: ValidationFieldInput, rules: BuilderValidationRule[]): NeutralNumberLimit | null {
  if (neutralAnswerTypeOf(field) === "scale" && field.scaleConfig?.style === "labeled") return null;
  if (field.type !== "number" && field.type !== "slider" && field.type !== "rating" && field.type !== "scale") return null;
  const sources: string[] = [];
  const limit: NeutralNumberLimit = { sources };
  const setRange = (min: unknown, max: unknown, source: string) => {
    const low = finiteNumber(min);
    const high = finiteNumber(max);
    if (low !== undefined) limit.min = low;
    if (high !== undefined) limit.max = high;
    if (low !== undefined || high !== undefined) sources.push(source);
  };
  if (field.type === "number") {
    const typeNumber = field.numberConfig?.typeNumber ?? "number";
    if (typeNumber === "number" || typeNumber === "year") {
      limit.wholeNumber = true;
      sources.push("numberConfig.typeNumber");
    }
    if (typeNumber === "year") limit.year = true;
    // A limit only with stepper buttons (see above): the stored range of a
    // LOINC or DTA definition or a subform entry questions, it doesn't refuse.
    if (field.numberConfig?.buttonControls) {
      setRange(field.numberConfig.spinButtonProps?.min, field.numberConfig.spinButtonProps?.max, "numberConfig.spinButtonProps");
    }
  } else if (field.type === "slider" && field.sliderConfig) {
    setRange(field.sliderConfig.min, field.sliderConfig.max, "sliderConfig");
  } else if (field.type === "rating") {
    limit.wholeNumber = true;
    setRange(1, positiveLimit(field.ratingConfig?.maxStars) ?? 5, "ratingConfig");
  } else if (field.type === "scale" && field.scaleConfig && field.scaleConfig.style !== "labeled") {
    setRange(field.scaleConfig.min, field.scaleConfig.max, "scaleConfig");
  }
  const messages: NonNullable<NeutralNumberLimit["messages"]> = {};
  const minRule = ruleBound(rules, "min");
  const maxRule = ruleBound(rules, "max");
  // Imported min/max rules (Form.io, FHIR) fill the bounds the control does
  // not set; a range the author edits on the control wins.
  let fromRules = false;
  if (minRule && limit.min === undefined) {
    limit.min = minRule.value;
    if (minRule.message) messages.min = minRule.message;
    fromRules = true;
  }
  if (maxRule && limit.max === undefined) {
    limit.max = maxRule.value;
    if (maxRule.message) messages.max = maxRule.message;
    fromRules = true;
  }
  if (fromRules) sources.push("validation.rules");
  if (messages.min || messages.max) limit.messages = messages;
  return limit.min !== undefined || limit.max !== undefined || limit.wholeNumber ? limit : null;
}

function relativeBound(constraint: BuilderRelativeDateConstraint | null | undefined): NeutralDateBound | null {
  if (!constraint || constraint.anchor !== "today") return null;
  const direction = constraint.direction ?? "exact";
  const value = finiteNumber(constraint.value) ?? 0;
  if (direction === "exact" || value === 0) return { kind: "today", direction: "exact", value: 0, unit: "days" };
  return { kind: "today", direction, value: Math.abs(value), unit: constraint.unit ?? "days" };
}

const TODAY: NeutralDateBound = { kind: "today", direction: "exact", value: 0, unit: "days" };

function readDateLimit(field: ValidationFieldInput): NeutralDateLimit | null {
  const answer = neutralAnswerTypeOf(field);
  if (answer !== "date" && answer !== "dateTime") return null;
  const config = field.dateConfig;
  if (!config) return null;
  const earliest: NeutralDateBound[] = [];
  const latest: NeutralDateBound[] = [];
  const sources = new Set<string>();
  if (nonEmptyText(config.minDate) && readDate(config.minDate)) {
    earliest.push({ kind: "date", date: config.minDate!.trim() });
    sources.add("dateConfig.minDate");
  }
  if (nonEmptyText(config.maxDate) && readDate(config.maxDate)) {
    latest.push({ kind: "date", date: config.maxDate!.trim() });
    sources.add("dateConfig.maxDate");
  }
  if (config.disablePastDates) {
    earliest.push(TODAY);
    sources.add("dateConfig.disablePastDates");
  }
  if (config.disableFutureDates) {
    latest.push(TODAY);
    sources.add("dateConfig.disableFutureDates");
  }
  const relativeMin = relativeBound(config.relativeMinDate);
  if (relativeMin) {
    earliest.push(relativeMin);
    sources.add("dateConfig.relativeMinDate");
  }
  const relativeMax = relativeBound(config.relativeMaxDate);
  if (relativeMax) {
    latest.push(relativeMax);
    sources.add("dateConfig.relativeMaxDate");
  }
  return earliest.length || latest.length ? { earliest, latest, sources: [...sources] } : null;
}

function compilePattern(pattern: string): RegExp | null {
  try {
    return new RegExp(`^(?:${pattern})$`);
  } catch {
    return null;
  }
}

function readList(field: ValidationFieldInput): NeutralListCheck | null {
  const validation = field.validation;
  const mode = validation?.listMode === "allowlist" ? "allow" : validation?.listMode === "denylist" ? "deny" : null;
  if (!mode) return null;
  const values = (validation?.listValues ?? [])
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter(Boolean);
  if (!values.length) return null;
  const email = profileOf(field)?.textFormat === "email";
  const match = email ? (validation?.listMatch === "address" ? "email-address" : "email-domain") : "value";
  const message = nonEmptyText(validation?.customError);
  return { mode, match, values, ...(message ? { message } : {}) };
}

/**
 * Every check saved on one field, whatever store holds it. Pass the form's
 * Logic-tab rules to include required-when and `invalid` rules.
 */
export function readFieldValidation(
  field: ValidationFieldInput,
  context: ReadFieldValidationContext = {},
): NeutralFieldValidation {
  const rules = (field.validation?.rules ?? []).filter((rule): rule is BuilderValidationRule => Boolean(rule && typeof rule === "object"));
  const { required, source } = readRequired(field);
  const targeting = rulesTargeting(field, context.fieldLinkRules);
  const unsupported: NeutralFieldValidation["unsupported"] = [];

  const patterns: NeutralPatternCheck[] = [];
  for (const rule of rules) {
    if (rule.type === "pattern") {
      const pattern = typeof rule.value === "string" ? rule.value : "";
      if (!pattern || !compilePattern(pattern)) {
        unsupported.push({ rule, reason: "The pattern is not a valid regular expression." });
        continue;
      }
      const message = nonEmptyText(rule.message);
      patterns.push({ pattern, ...(message ? { message } : {}) });
    } else if (rule.type === "custom") {
      unsupported.push({ rule, reason: "A custom rule is kept as written and not run." });
    } else if ((rule.type === "min" || rule.type === "max" || rule.type === "minLength" || rule.type === "maxLength") && finiteNumber(rule.value) === undefined) {
      unsupported.push({ rule, reason: "The limit is not a number." });
    }
  }

  const crossField: NeutralCrossFieldCheck[] = [];
  for (const entry of field.behavior?.validations ?? []) {
    if (!entry?.validWhen) continue;
    crossField.push({
      id: entry.id,
      source: "behavior",
      kind: "valid-when",
      condition: entry.validWhen,
      message: nonEmptyText(entry.message) ?? DEFAULT_CROSS_FIELD_VALIDATION_MESSAGE,
      ...(entry.translations && Object.keys(entry.translations).length ? { translations: entry.translations } : {}),
    });
  }
  for (const rule of targeting) {
    if (rule.action !== "invalid") continue;
    crossField.push({
      id: rule.id,
      source: "logic-rule",
      kind: "invalid-when",
      condition: getFieldLinkConditionGroup(rule),
      message: nonEmptyText(rule.validationMessage) ?? DEFAULT_CROSS_FIELD_VALIDATION_MESSAGE,
    });
  }

  const requiredMessage = nonEmptyText(field.requiredMessage);
  const customError = nonEmptyText(field.validation?.customError);
  return {
    fieldId: field.id,
    label: typeof field.label === "string" ? field.label : field.id,
    required,
    requiredSource: source,
    ...(requiredMessage ? { requiredMessage } : {}),
    requiredWhen: targeting
      .filter((rule) => rule.action === "set-required" || rule.action === "clear-required")
      .map((rule) => ({
        ruleId: rule.id,
        effect: rule.action === "set-required" ? "set" as const : "clear" as const,
        when: getFieldLinkConditionGroup(rule),
      })),
    formats: readFormats(field),
    length: readLength(field, rules),
    number: readNumber(field, rules),
    date: readDateLimit(field),
    patterns,
    list: readList(field),
    crossField,
    ...(customError ? { customError } : {}),
    unsupported,
  };
}

/** Whether the field holds any check at all (required, conditional required, or a value check). */
export function hasFieldValidation(validation: NeutralFieldValidation): boolean {
  return validation.required
    || validation.requiredWhen.length > 0
    || validation.formats.length > 0
    || validation.length !== null
    || validation.number !== null
    || validation.date !== null
    || validation.patterns.length > 0
    || validation.list !== null
    || validation.crossField.length > 0;
}

// ---------------------------------------------------------------------------
// Checking an answer
// ---------------------------------------------------------------------------

export type NeutralValidationProblemKind =
  | "required"
  | "format"
  | "length"
  | "number"
  | "date"
  | "pattern"
  | "list"
  | "cross-field";

export interface NeutralValidationProblem {
  fieldId: string;
  kind: NeutralValidationProblemKind;
  message: string;
  /** Cross-field problems: the rule or `behavior.validations` entry that raised it. */
  ruleId?: string;
  /** Format problems: the format that failed. */
  format?: NeutralValueFormat;
}

export interface ValidateAnswerContext {
  /** Every answer on the form, keyed by field id; required-when and cross-field rules read it. */
  values?: Record<string, unknown>;
  /** The field is not shown right now (see `isFieldHiddenByLogic`); a hidden field is never checked. */
  hidden?: boolean;
  /** Yes/No labels of controllers, for conditions. */
  metadata?: FieldConditionMetadataLookup;
  /** "Today" for date limits counted from today. Default: the current local date. */
  today?: Date;
  /** Language for translated cross-field messages. */
  locale?: string;
}

const NO_METADATA: FieldConditionMetadataLookup = () => undefined;

/**
 * Whether the field is required for these answers: its default, then each
 * Logic-tab required rule in order, the last one whose condition holds
 * winning (FormLogicKit.validate).
 */
export function resolveFieldRequired(
  validation: Pick<NeutralFieldValidation, "required" | "requiredWhen">,
  values: Record<string, unknown> = {},
  metadata: FieldConditionMetadataLookup = NO_METADATA,
): boolean {
  let required = validation.required;
  for (const rule of validation.requiredWhen) {
    if (evaluateConditionGroup(rule.when, metadata, values)) required = rule.effect === "set";
  }
  return required;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
const URL_PATTERN = /^(?:https?:\/\/)?[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/i;
const CA_POSTAL_PATTERN = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/;
const MONEY_PATTERN = /^\$?\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;
const PHN_WEIGHTS = [2, 4, 8, 5, 10, 9, 7, 3] as const;

function scalarText(value: unknown): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "string") return value.trim();
  return null;
}

/**
 * Whether `value` has the format. Only text and number answers are checked;
 * other shapes (coded objects, lists) pass. Same checks as the exported MOIS
 * form (FormLogicKit.formats and the inline onValidate sources).
 */
export function matchesValueFormat(format: NeutralValueFormat, value: unknown): boolean {
  switch (format) {
    case "bc-phn": {
      const text = scalarText(value);
      if (text === null) return false;
      const digits = text.replace(/[\s-]/g, "");
      if (!/^9\d{9}$/.test(digits)) return false;
      let sum = 0;
      for (let index = 0; index < PHN_WEIGHTS.length; index += 1) {
        sum += (Number(digits[index + 1]) * PHN_WEIGHTS[index]) % 11;
      }
      return 11 - (sum % 11) === Number(digits[9]);
    }
    case "ca-postal":
      return typeof value === "string" && CA_POSTAL_PATTERN.test(value.trim().toUpperCase());
    case "money":
      if (typeof value === "number") {
        return Number.isFinite(value) && value >= 0 && Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
      }
      return typeof value === "string" && MONEY_PATTERN.test(value.trim());
    case "email":
    case "phone":
    case "url": {
      const text = scalarText(value);
      if (text === null) return true;
      const pattern = format === "email" ? EMAIL_PATTERN : format === "phone" ? PHONE_PATTERN : URL_PATTERN;
      return pattern.test(text);
    }
  }
}

function checkedText(value: unknown): string | null {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readNumberAnswer(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[$,\s]/g, "");
  if (!cleaned || !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addCalendar(date: Date, amount: number, unit: BuilderDateValidationUnit): Date {
  if (unit === "days" || unit === "weeks") {
    const result = new Date(date);
    result.setDate(result.getDate() + amount * (unit === "weeks" ? 7 : 1));
    return result;
  }
  const months = unit === "years" ? amount * 12 : amount;
  const target = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

/** A date bound as a local calendar day, or null when it cannot be read. */
export function resolveDateBound(bound: NeutralDateBound, today: Date = new Date()): Date | null {
  if (bound.kind === "date") {
    const date = readDate(bound.date);
    return date ? startOfDay(date) : null;
  }
  const anchor = startOfDay(today);
  if (bound.direction === "exact" || bound.value === 0) return anchor;
  return addCalendar(anchor, bound.direction === "before" ? -bound.value : bound.value, bound.unit);
}

function isoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The problems with one answer, in a fixed order: required, format, length,
 * number, date, pattern, list, cross-field. Nothing for a hidden field; for an
 * empty answer only the required check and Logic-tab `invalid` rules.
 */
export function validateAnswer(
  validation: NeutralFieldValidation,
  value: unknown,
  context: ValidateAnswerContext = {},
): NeutralValidationProblem[] {
  if (context.hidden) return [];
  const metadata = context.metadata ?? NO_METADATA;
  const values = { ...(context.values ?? {}), [validation.fieldId]: value };
  const problems: NeutralValidationProblem[] = [];
  const add = (kind: NeutralValidationProblemKind, message: string, extra: Partial<NeutralValidationProblem> = {}) =>
    problems.push({ fieldId: validation.fieldId, kind, message, ...extra });
  const crossField = (kinds: ReadonlyArray<NeutralCrossFieldCheck["kind"]>) => {
    for (const check of validation.crossField) {
      if (!kinds.includes(check.kind)) continue;
      const holds = evaluateConditionGroup(check.condition, metadata, values);
      const failed = check.kind === "valid-when" ? !holds : holds;
      if (!failed) continue;
      const translated = context.locale ? nonEmptyText(check.translations?.[context.locale]) : undefined;
      add("cross-field", translated ?? check.message, { ruleId: check.id });
    }
  };

  if (isConditionValueEmpty(value)) {
    if (resolveFieldRequired(validation, values, metadata)) {
      add("required", validation.requiredMessage ?? defaultRequiredMessage(validation.label));
    }
    crossField(["invalid-when"]);
    return problems;
  }

  let formatFailed = false;
  for (const check of validation.formats) {
    if (matchesValueFormat(check.format, value)) continue;
    formatFailed = true;
    add("format", check.message ?? DEFAULT_FORMAT_MESSAGES[check.format], { format: check.format });
  }

  const text = checkedText(value);
  if (validation.length && text !== null) {
    const { min, max, messages } = validation.length;
    if (min !== undefined && text.length < min) add("length", messages?.min ?? `Enter at least ${min} characters`);
    if (max !== undefined && text.length > max) add("length", messages?.max ?? `Enter at most ${max} characters`);
  }

  if (validation.number && (typeof value === "number" || typeof value === "string")) {
    const limit = validation.number;
    const number = readNumberAnswer(value);
    if (number === null) {
      add("number", "Please enter a number");
    } else {
      if (limit.year && !(Number.isInteger(number) && number >= 1900 && number <= 2099)) {
        add("number", "Please enter a 4-digit year");
      } else if (limit.wholeNumber && !Number.isInteger(number)) {
        add("number", "Please enter a whole number");
      }
      if (limit.min !== undefined && number < limit.min) add("number", limit.messages?.min ?? `Enter a number of at least ${limit.min}`);
      if (limit.max !== undefined && number > limit.max) add("number", limit.messages?.max ?? `Enter a number of at most ${limit.max}`);
    }
  }

  if (validation.date) {
    const date = readDate(value);
    if (!date) {
      add("date", "Please enter a valid date");
    } else {
      const day = startOfDay(date).getTime();
      const today = context.today ?? new Date();
      for (const bound of validation.date.earliest) {
        const resolved = resolveDateBound(bound, today);
        if (resolved && day < resolved.getTime()) add("date", `Enter a date on or after ${isoDay(resolved)}`);
      }
      for (const bound of validation.date.latest) {
        const resolved = resolveDateBound(bound, today);
        if (resolved && day > resolved.getTime()) add("date", `Enter a date on or before ${isoDay(resolved)}`);
      }
    }
  }

  if (text !== null) {
    for (const check of validation.patterns) {
      const pattern = compilePattern(check.pattern);
      if (pattern && !pattern.test(text)) add("pattern", check.message ?? "Enter the answer in the expected format");
    }
  }

  // An answer that is not an email at all only gets the format message (the
  // MOIS email check does the same).
  if (validation.list && text !== null && !formatFailed) {
    const list = validation.list;
    const normalized = text.toLowerCase();
    const candidate = list.match === "email-domain" ? normalized.split("@")[1] ?? "" : normalized;
    const listed = list.values.includes(candidate);
    if (list.mode === "allow" ? !listed : listed) add("list", list.message ?? defaultListMessage(list));
  }

  crossField(["valid-when", "invalid-when"]);
  return problems;
}

// ---------------------------------------------------------------------------
// Form level
// ---------------------------------------------------------------------------

export interface FieldLogicContext {
  /** The form's Logic-tab rules. */
  fieldLinkRules?: ReadonlyArray<FieldLinkRule> | null;
  /** The form's fields: show-when controllers' kinds and Yes/No labels come from them. */
  fields?: ReadonlyArray<ValidationFieldInput>;
}

function controllerKindLookup(fields: ReadonlyArray<ValidationFieldInput> | undefined) {
  const byId = new Map((fields ?? []).map((field) => [field.id, field]));
  return (controllerId: string): string | undefined => {
    const field = byId.get(controllerId);
    if (!field) return undefined;
    const answer = neutralAnswerTypeOf(field);
    if (answer === "yesNo" || answer === "boolean") return "boolean";
    if (answer === "singleChoice" || answer === "multipleChoice") return "choice";
    if (answer === "number" || answer === "scale" || answer === "computed") return "number";
    return "text";
  };
}

/** Yes/No labels of the form's fields, for conditions. */
export function conditionMetadataFor(fields: ReadonlyArray<ValidationFieldInput> | undefined): FieldConditionMetadataLookup {
  const byId = new Map((fields ?? []).map((field) => [field.id, field]));
  return (fieldId) => {
    const labels = byId.get(fieldId)?.booleanLabels;
    return labels ? { booleanLabels: labels } : undefined;
  };
}

/**
 * Whether the field is hidden for these answers: its own Hidden setting, a
 * Logic-tab Show rule that does not hold or Hide rule that does (the
 * semantics of FormLogicKit.isFieldHidden), or, when no Logic-tab Show or
 * Hide rule targets it, its own show-when rule (the MOIS export's rule). Uses
 * only the shared converter and evaluator in conditions.ts. Section gates
 * and a hidden parent are the caller's to add.
 */
export function isFieldHiddenByLogic(
  field: ValidationFieldInput,
  values: Record<string, unknown> = {},
  context: FieldLogicContext = {},
): boolean {
  if (field.hidden === true) return true;
  const metadata = conditionMetadataFor(context.fields);
  const targeting = rulesTargeting(field, context.fieldLinkRules);
  const holds = (rule: FieldLinkRule) => evaluateConditionGroup(getFieldLinkConditionGroup(rule), metadata, values);
  const show = targeting.filter((rule) => rule.action === "show");
  const hide = targeting.filter((rule) => rule.action === "hide");
  if (show.length || hide.length) {
    return (show.length > 0 && !show.some(holds)) || hide.some(holds);
  }
  const conditions = visibilityRuleToFieldLinkConditions(field.visibility, controllerKindLookup(context.fields));
  if (!conditions) return false;
  return !evaluateConditionGroup(getFieldLinkConditionGroup(conditions), metadata, values);
}
