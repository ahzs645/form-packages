/**
 * Shared case table for validation.ts. Every saved shape of "required" found
 * in data/ fixtures and the Cerner presets has a case in REQUIRED_SHAPE_CASES,
 * and every check has pass and fail cases in VALIDATION_ANSWER_CASES. A
 * runtime twin (FormLogicKit.validate) can be held to the answer cases too.
 */
import type { FieldLinkRule } from "./index";
import type { NeutralRequiredSource, NeutralValidationProblemKind, ValidationFieldInput } from "./validation";

export interface RequiredShapeCase {
  name: string;
  field: ValidationFieldInput;
  expected: { required: boolean; source: NeutralRequiredSource | null; requiredMessage?: string };
}

/** Where each shape was found is in the name. */
export const REQUIRED_SHAPE_CASES: RequiredShapeCase[] = [
  { name: "builder field required: true", field: { id: "a", type: "text", required: true }, expected: { required: true, source: "field" } },
  { name: "builder field required: false (document presets write false)", field: { id: "a", type: "text", required: false, validation: null }, expected: { required: false, source: "field" } },
  { name: "no required key", field: { id: "a", type: "text" }, expected: { required: false, source: null } },
  {
    name: "Cerner PowerForm preference \"true\", required unset",
    field: { id: "a", type: "text", cernerConfig: { sourceKind: "powerform", preferences: { required: "true" } } as never },
    expected: { required: true, source: "cerner-preference" },
  },
  {
    name: "Cerner iView preference \"1\"",
    field: { id: "a", type: "number", cernerConfig: { sourceKind: "iview", preferences: { required: "1" } } as never },
    expected: { required: true, source: "cerner-preference" },
  },
  {
    name: "FHIR import kept required only on the imported item",
    field: { id: "a", type: "text", fhirConfig: { linkId: "a", questionnaireItem: { linkId: "a", type: "string", required: true } } as never },
    expected: { required: true, source: "fhir-item" },
  },
  {
    name: "explicit required false wins over the imported FHIR item",
    field: { id: "a", type: "text", required: false, fhirConfig: { linkId: "a", questionnaireItem: { linkId: "a", type: "string", required: true } } as never },
    expected: { required: false, source: "field" },
  },
  {
    name: "Cerner preference \"0\"",
    field: { id: "a", type: "number", cernerConfig: { sourceKind: "iview", preferences: { required: "0" } } as never },
    expected: { required: false, source: "cerner-preference" },
  },
  {
    name: "builder edit false wins over an imported Cerner \"true\"",
    field: { id: "a", type: "text", required: false, cernerConfig: { sourceKind: "powerform", preferences: { required: "true" } } as never },
    expected: { required: false, source: "field" },
  },
  {
    name: "builder edit true wins over an imported Cerner \"0\"",
    field: { id: "a", type: "text", required: true, cernerConfig: { sourceKind: "powerform", preferences: { required: "0" } } as never },
    expected: { required: true, source: "field" },
  },
  {
    name: "table column legacy requiredWhenVisible",
    field: { id: "col", type: "text", requiredWhenVisible: true },
    expected: { required: true, source: "legacy-alias" },
  },
  {
    name: "table column: either store makes it required (isTableColumnRequired)",
    field: { id: "col", type: "text", required: false, requiredWhenVisible: true },
    expected: { required: true, source: "legacy-alias" },
  },
  {
    name: "table column row-save message",
    field: { id: "col", type: "text", required: true, requiredMessage: "Enter the dose." },
    expected: { required: true, source: "field", requiredMessage: "Enter the dose." },
  },
  {
    name: "validation.rules required entry",
    field: { id: "a", type: "text", validation: { rules: [{ type: "required" }] } },
    expected: { required: true, source: "validation-rule" },
  },
  {
    name: "layout-table answer cell (projected) required",
    field: { id: "cell", type: "booleanSingle", required: true },
    expected: { required: true, source: "field" },
  },
  {
    name: "subform data-entry field (projected) required",
    field: { id: "systolic", type: "number", required: true, numberConfig: { typeNumber: "number" } },
    expected: { required: true, source: "field" },
  },
];

export interface ValidationAnswerCase {
  name: string;
  field: ValidationFieldInput;
  fieldLinkRules?: FieldLinkRule[];
  value: unknown;
  /** Other answers on the form. */
  values?: Record<string, unknown>;
  hidden?: boolean;
  /** yyyy-MM-dd; "today" for date limits. */
  today?: string;
  locale?: string;
  /** Problem kinds, in the order validateAnswer reports them. */
  expected: NeutralValidationProblemKind[];
  /** The first problem's message, when the case pins it. */
  message?: string;
}

const text = (extra: Partial<ValidationFieldInput> = {}): ValidationFieldInput => ({ id: "a", label: "Answer", type: "text", ...extra });
const number = (extra: Partial<ValidationFieldInput> = {}): ValidationFieldInput => ({ id: "n", label: "Count", type: "number", ...extra });
const date = (extra: Partial<ValidationFieldInput> = {}): ValidationFieldInput => ({ id: "d", label: "Date", type: "date", ...extra });
const rule = (overrides: Partial<FieldLinkRule> & Pick<FieldLinkRule, "id" | "action">): FieldLinkRule => ({
  controllerFieldId: "flag",
  condition: { type: "boolean-yes" },
  targetFieldIds: ["a"],
  ...overrides,
});

export const REQUIRED_ANSWER_CASES: ValidationAnswerCase[] = [
  { name: "required and empty", field: text({ required: true }), value: "", expected: ["required"], message: "Answer is required" },
  { name: "required and blank text", field: text({ required: true }), value: "   ", expected: ["required"] },
  { name: "required and null", field: text({ required: true }), value: null, expected: ["required"] },
  { name: "required and answered", field: text({ required: true }), value: "x", expected: [] },
  { name: "required tick box answered false (an answer, as in FormLogicKit)", field: { id: "t", label: "Agree", type: "booleanSingle", required: true }, value: false, expected: [] },
  { name: "required multi-select with nothing chosen", field: { id: "c", label: "Pick", type: "choice", choiceStyle: "checkbox", required: true }, value: [], expected: ["required"] },
  { name: "required table whose only row is blank", field: { id: "t", label: "Rows", type: "table", required: true }, value: [{ _rowId: "1", name: "" }], expected: ["required"] },
  { name: "optional and empty", field: text(), value: "", expected: [] },
  { name: "hidden and required: never checked", field: text({ required: true }), value: "", hidden: true, expected: [] },
  { name: "custom required message", field: text({ required: true, requiredMessage: "Enter the dose." }), value: "", expected: ["required"], message: "Enter the dose." },
  { name: "Cerner-imported required", field: text({ cernerConfig: { sourceKind: "powerform", preferences: { required: "true" } } as never }), value: "", expected: ["required"] },
  {
    name: "set-required rule holds",
    field: text(),
    fieldLinkRules: [rule({ id: "r1", action: "set-required" })],
    value: "",
    values: { flag: true },
    expected: ["required"],
  },
  {
    name: "set-required rule does not hold",
    field: text(),
    fieldLinkRules: [rule({ id: "r1", action: "set-required" })],
    value: "",
    values: { flag: false },
    expected: [],
  },
  {
    name: "clear-required rule holds on a required field",
    field: text({ required: true }),
    fieldLinkRules: [rule({ id: "r1", action: "clear-required" })],
    value: "",
    values: { flag: "Y" },
    expected: [],
  },
  {
    name: "last matching required rule wins",
    field: text(),
    fieldLinkRules: [rule({ id: "r1", action: "set-required" }), rule({ id: "r2", action: "clear-required" })],
    value: "",
    values: { flag: true },
    expected: [],
  },
  {
    name: "a rule for another field does not apply",
    field: text(),
    fieldLinkRules: [rule({ id: "r1", action: "set-required", targetFieldIds: ["other"] })],
    value: "",
    values: { flag: true },
    expected: [],
  },
];

export const FORMAT_ANSWER_CASES: ValidationAnswerCase[] = [
  { name: "email type, valid", field: { id: "e", label: "Email", type: "email" }, value: "nurse@example.com", expected: [] },
  { name: "email type, invalid", field: { id: "e", label: "Email", type: "email" }, value: "nurse at example", expected: ["format"], message: "Please enter a valid email address" },
  {
    name: "email type, the imported rule's message",
    field: { id: "e", label: "Email", type: "email", validation: { rules: [{ type: "email", message: "Use a work email" }] } },
    value: "nope",
    expected: ["format"],
    message: "Use a work email",
  },
  { name: "email rule on a text field", field: text({ validation: { rules: [{ type: "email" }] } }), value: "nope", expected: ["format"] },
  { name: "phone, dashes", field: { id: "p", label: "Phone", type: "phone" }, value: "604-555-1234", expected: [] },
  { name: "phone, brackets", field: { id: "p", label: "Phone", type: "phone" }, value: "(604) 555-1234", expected: [] },
  { name: "phone, words", field: { id: "p", label: "Phone", type: "phone" }, value: "call the front desk", expected: ["format"], message: "Please enter a valid phone number" },
  { name: "web address with scheme", field: { id: "u", label: "Site", type: "url" }, value: "https://example.com/a?b=1", expected: [] },
  { name: "web address without scheme", field: { id: "u", label: "Site", type: "url" }, value: "example.com", expected: [] },
  { name: "web address with spaces", field: { id: "u", label: "Site", type: "url" }, value: "not a site", expected: ["format"] },
  { name: "BC PHN valid", field: text({ validation: { format: "bc-phn" } }), value: "9698 658 215", expected: [] },
  { name: "BC PHN wrong check digit", field: text({ validation: { format: "bc-phn" } }), value: "9698658216", expected: ["format"] },
  { name: "BC PHN custom message", field: text({ validation: { format: "bc-phn", formatMessage: "Check the PHN" } }), value: "123", expected: ["format"], message: "Check the PHN" },
  { name: "postal code valid", field: text({ validation: { format: "ca-postal" } }), value: "v2n4z9", expected: [] },
  { name: "postal code invalid", field: text({ validation: { format: "ca-postal" } }), value: "12345", expected: ["format"] },
  { name: "money valid text", field: text({ validation: { format: "money" } }), value: "$1,250.00", expected: [] },
  { name: "money valid number", field: text({ validation: { format: "money" } }), value: 12.5, expected: [] },
  { name: "money three decimals", field: text({ validation: { format: "money" } }), value: "12.345", expected: ["format"] },
];

export const LIMIT_ANSWER_CASES: ValidationAnswerCase[] = [
  { name: "text over its character limit", field: text({ textConfig: { maxCharLimit: 5 } }), value: "abcdef", expected: ["length"], message: "Enter at most 5 characters" },
  { name: "text at its character limit", field: text({ textConfig: { maxCharLimit: 5 } }), value: "abcde", expected: [] },
  { name: "long text over its limit", field: { id: "l", label: "Notes", type: "textarea", textareaConfig: { rows: 3, maxCharLimit: 3 } }, value: "abcd", expected: ["length"] },
  { name: "minLength rule with message", field: text({ validation: { rules: [{ type: "minLength", value: 3, message: "Too short" }] } }), value: "ab", expected: ["length"], message: "Too short" },
  { name: "the edited character limit wins over an imported maxLength rule", field: text({ textConfig: { maxCharLimit: 10 }, validation: { rules: [{ type: "maxLength", value: 2 }] } }), value: "abcdef", expected: [] },
  { name: "imported maxLength rule alone", field: text({ validation: { rules: [{ type: "maxLength", value: 2, message: "Two at most" }] } }), value: "abc", expected: ["length"], message: "Two at most" },
  { name: "number field defaults to whole numbers", field: number(), value: 2.5, expected: ["number"], message: "Please enter a whole number" },
  { name: "decimal number", field: number({ numberConfig: { typeNumber: "decimal" } }), value: "2.5", expected: [] },
  { name: "year out of range", field: number({ numberConfig: { typeNumber: "year" } }), value: 1899, expected: ["number"], message: "Please enter a 4-digit year" },
  { name: "year as text", field: number({ numberConfig: { typeNumber: "year" } }), value: "2026", expected: [] },
  { name: "not a number, on a field with a limit", field: number(), value: "abc", expected: ["number"], message: "Please enter a number" },
  { name: "a decimal field with no limit has no number check", field: number({ numberConfig: { typeNumber: "decimal" } }), value: "abc", expected: [] },
  { name: "stepper maximum", field: number({ numberConfig: { typeNumber: "number", buttonControls: true, spinButtonProps: { min: 0, max: 10 } } }), value: 11, expected: ["number"], message: "Enter a number of at most 10" },
  { name: "stepper bounds ignored without the stepper", field: number({ numberConfig: { typeNumber: "number", spinButtonProps: { min: 0, max: 10 } } }), value: 11, expected: [] },
  { name: "slider range", field: { id: "s", label: "Pain", type: "slider", sliderConfig: { min: 0, max: 10, step: 1 } }, value: 12, expected: ["number"] },
  { name: "rating above its stars", field: { id: "r", label: "Stars", type: "rating", ratingConfig: { maxStars: 5 } }, value: 6, expected: ["number"] },
  { name: "imported min rule with message", field: number({ numberConfig: { typeNumber: "decimal" }, validation: { rules: [{ type: "min", value: 18, message: "Adults only" }] } }), value: 17, expected: ["number"], message: "Adults only" },
  {
    name: "the stepper's edited range wins over an imported rule (Form.io writes both)",
    field: number({ numberConfig: { typeNumber: "number", buttonControls: true, spinButtonProps: { min: 0, max: 20 } }, validation: { rules: [{ type: "max", value: 10 }] } }),
    value: 15,
    expected: [],
  },
  { name: "whole number and below the minimum", field: number({ validation: { rules: [{ type: "min", value: 5 }] } }), value: 2.5, expected: ["number", "number"] },
  { name: "earliest fixed date", field: date({ dateConfig: { minDate: "2026-01-01" } }), value: "2025-12-31", expected: ["date"], message: "Enter a date on or after 2026-01-01" },
  { name: "earliest fixed date, same day", field: date({ dateConfig: { minDate: "2026-01-01" } }), value: "2026-01-01", expected: [] },
  { name: "no future dates", field: date({ dateConfig: { disableFutureDates: true } }), value: "2026-09-28", today: "2026-09-27", expected: ["date"], message: "Enter a date on or before 2026-09-27" },
  { name: "no past dates", field: date({ dateConfig: { disablePastDates: true } }), value: "2026-09-26", today: "2026-09-27", expected: ["date"] },
  {
    name: "age gate: today minus 18 years",
    field: date({ dateConfig: { relativeMaxDate: { anchor: "today", direction: "before", value: 18, unit: "years" } } }),
    value: "2010-01-01",
    today: "2026-09-27",
    expected: ["date"],
    message: "Enter a date on or before 2008-09-27",
  },
  { name: "unreadable date", field: date({ dateConfig: { minDate: "2026-01-01" } }), value: "31/04/2026", expected: ["date"], message: "Please enter a valid date" },
  { name: "date and time on today's date", field: { id: "dt", label: "When", type: "datetime", dateConfig: { disableFutureDates: true } }, value: "2026-09-27T10:00", today: "2026-09-27", expected: [] },
  { name: "pattern matches the whole answer", field: text({ validation: { rules: [{ type: "pattern", value: "[A-Z]{3}" }] } }), value: "ABC", expected: [] },
  { name: "pattern is anchored", field: text({ validation: { rules: [{ type: "pattern", value: "[A-Z]{3}", message: "Three capitals" }] } }), value: "ABCD", expected: ["pattern"], message: "Three capitals" },
  { name: "invalid pattern is not applied", field: text({ validation: { rules: [{ type: "pattern", value: "([" }] } }), value: "anything", expected: [] },
];

const emailList = (listMode: "allowlist" | "denylist", listMatch: "domain" | "address", listValues: string[], customError?: string): ValidationFieldInput => ({
  id: "e",
  label: "Email",
  type: "email",
  validation: { listMode, listMatch, listValues, ...(customError ? { customError } : {}) },
});

export const LIST_ANSWER_CASES: ValidationAnswerCase[] = [
  { name: "allowed email domain", field: emailList("allowlist", "domain", ["Example.com"]), value: "a@example.com", expected: [] },
  { name: "email domain not on the allow list", field: emailList("allowlist", "domain", ["example.com"], "Use your clinic email"), value: "a@other.com", expected: ["list"], message: "Use your clinic email" },
  { name: "blocked email address", field: emailList("denylist", "address", ["spam@example.com"]), value: "Spam@example.com", expected: ["list"], message: "This email address is not allowed" },
  { name: "not an email: only the format message", field: emailList("allowlist", "domain", ["example.com"]), value: "nope", expected: ["format"] },
  { name: "allow list on a text answer", field: text({ validation: { listMode: "allowlist", listValues: ["red", "green"] } }), value: "Blue", expected: ["list"] },
];

const admissionOrder: FieldLinkRule = {
  id: "discharge-order",
  controllerFieldId: "a",
  condition: { type: "number-lt", compareFieldId: "admitted" },
  targetFieldIds: ["a"],
  action: "invalid",
  validationMessage: "Discharge cannot be before admission.",
};

export const CROSS_FIELD_ANSWER_CASES: ValidationAnswerCase[] = [
  {
    name: "behavior.validations fails",
    field: text({
      behavior: {
        validations: [{
          id: "v1",
          validWhen: { match: "all", conditions: [{ controllerFieldId: "a", condition: { type: "number-gte", compareFieldId: "admitted" } }] },
          message: "Check the dates.",
          translations: { "fr-CA": "Vérifiez les dates." },
        }],
      },
    }),
    value: "2026-03-04",
    values: { admitted: "2026-03-10" },
    expected: ["cross-field"],
    message: "Check the dates.",
  },
  {
    name: "behavior.validations message in the form's language",
    field: text({
      behavior: {
        validations: [{
          id: "v1",
          validWhen: { match: "all", conditions: [{ controllerFieldId: "a", condition: { type: "number-gte", compareFieldId: "admitted" } }] },
          message: "Check the dates.",
          translations: { "fr-CA": "Vérifiez les dates." },
        }],
      },
    }),
    value: "2026-03-04",
    values: { admitted: "2026-03-10" },
    locale: "fr-CA",
    expected: ["cross-field"],
    message: "Vérifiez les dates.",
  },
  {
    name: "behavior.validations passes",
    field: text({
      behavior: {
        validations: [{
          id: "v1",
          validWhen: { match: "all", conditions: [{ controllerFieldId: "a", condition: { type: "number-gte", compareFieldId: "admitted" } }] },
          message: "Check the dates.",
        }],
      },
    }),
    value: "2026-03-12",
    values: { admitted: "2026-03-10" },
    expected: [],
  },
  {
    name: "behavior.validations do not run on an empty answer",
    field: text({
      behavior: { validations: [{ id: "v1", validWhen: { match: "all", conditions: [{ controllerFieldId: "a", condition: { type: "filled" } }] }, message: "x" }] },
    }),
    value: "",
    expected: [],
  },
  { name: "Logic-tab invalid rule fires", field: text(), fieldLinkRules: [admissionOrder], value: "2026-03-04", values: { admitted: "2026-03-10" }, expected: ["cross-field"], message: "Discharge cannot be before admission." },
  { name: "Logic-tab invalid rule stays quiet while the other answer is blank", field: text(), fieldLinkRules: [admissionOrder], value: "2026-03-04", values: {}, expected: [] },
  {
    name: "Logic-tab invalid rule fires on an empty answer",
    field: text(),
    fieldLinkRules: [{ id: "need-a", controllerFieldId: "flag", condition: { type: "boolean-yes" }, additionalConditions: [{ controllerFieldId: "a", condition: { type: "empty" } }], targetFieldIds: ["a"], action: "invalid" }],
    value: "",
    values: { flag: true },
    expected: ["cross-field"],
    message: "This answer conflicts with another answer.",
  },
  {
    name: "problems come in a fixed order",
    field: text({ required: true, validation: { format: "ca-postal", rules: [{ type: "maxLength", value: 3 }] } }),
    fieldLinkRules: [{ id: "x", controllerFieldId: "a", condition: { type: "filled" }, targetFieldIds: ["a"], action: "invalid" }],
    value: "12345",
    expected: ["format", "length", "cross-field"],
  },
];

export const VALIDATION_ANSWER_CASES: ValidationAnswerCase[] = [
  ...REQUIRED_ANSWER_CASES,
  ...FORMAT_ANSWER_CASES,
  ...LIMIT_ANSWER_CASES,
  ...LIST_ANSWER_CASES,
  ...CROSS_FIELD_ANSWER_CASES,
];
