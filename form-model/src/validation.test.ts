import { describe, expect, it } from "vitest";

import type { FieldLinkRule } from "./index";
import { readDate } from "./values";
import {
  hasFieldValidation,
  isFieldHiddenByLogic,
  readFieldValidation,
  resolveDateBound,
  resolveFieldRequired,
  validateAnswer,
  type ValidationFieldInput,
} from "./validation";
import { REQUIRED_SHAPE_CASES, VALIDATION_ANSWER_CASES, type ValidationAnswerCase } from "./validation.cases";

function run(testCase: ValidationAnswerCase) {
  const validation = readFieldValidation(testCase.field, { fieldLinkRules: testCase.fieldLinkRules });
  return validateAnswer(validation, testCase.value, {
    values: testCase.values,
    hidden: testCase.hidden,
    today: testCase.today ? readDate(testCase.today)! : undefined,
    locale: testCase.locale,
  });
}

describe("readFieldValidation: required", () => {
  it.each(REQUIRED_SHAPE_CASES.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    const validation = readFieldValidation(testCase.field);
    expect(validation.required).toBe(testCase.expected.required);
    expect(validation.requiredSource).toBe(testCase.expected.source);
    expect(validation.requiredMessage).toBe(testCase.expected.requiredMessage);
  });

  it("reads set-required and clear-required rules targeting the field, in order", () => {
    const rules: FieldLinkRule[] = [
      { id: "r1", controllerFieldId: "x", condition: { type: "filled" }, targetFieldIds: ["a", "b"], action: "set-required" },
      { id: "r2", controllerFieldId: "x", condition: { type: "empty" }, targetFieldIds: ["b"], action: "clear-required" },
      { id: "r3", controllerFieldId: "y", condition: { type: "boolean-yes" }, additionalConditions: [{ controllerFieldId: "z", condition: { type: "filled" } }], conditionMatch: "any", targetFieldIds: ["a"], action: "clear-required" },
      { id: "r4", controllerFieldId: "x", condition: { type: "filled" }, targetFieldIds: ["a"], action: "show" },
    ];
    const validation = readFieldValidation({ id: "a", type: "text" }, { fieldLinkRules: rules });
    expect(validation.requiredWhen).toEqual([
      { ruleId: "r1", effect: "set", when: { match: "all", conditions: [{ controllerFieldId: "x", condition: { type: "filled" } }] } },
      {
        ruleId: "r3",
        effect: "clear",
        when: {
          match: "any",
          conditions: [
            { controllerFieldId: "y", condition: { type: "boolean-yes" } },
            { controllerFieldId: "z", condition: { type: "filled" } },
          ],
        },
      },
    ]);
    expect(resolveFieldRequired(validation, { x: "1" })).toBe(true);
    expect(resolveFieldRequired(validation, { x: "1", z: "2" })).toBe(false);
    expect(resolveFieldRequired(validation, {})).toBe(false);
  });
});

describe("readFieldValidation: checks", () => {
  it("records every store it read, with provenance", () => {
    const validation = readFieldValidation({
      id: "a",
      label: "Code",
      type: "text",
      textConfig: { maxCharLimit: 12 },
      validation: {
        format: "ca-postal",
        formatMessage: "Postal code, please",
        rules: [{ type: "minLength", value: 6 }, { type: "pattern", value: "[A-Z0-9 ]+" }, { type: "custom", value: "x > 1" }],
        listMode: "denylist",
        listValues: [" H0H 0H0 "],
        customError: "Not that one",
      },
    });
    expect(validation.formats).toEqual([{ format: "ca-postal", source: "validation.format", message: "Postal code, please" }]);
    expect(validation.length).toEqual({ min: 6, max: 12, sources: ["validation.rules", "textConfig.maxCharLimit"] });
    expect(readFieldValidation({ id: "b", type: "textarea", textareaConfig: { rows: 3, maxCharLimit: 40 }, validation: { rules: [{ type: "maxLength", value: 20 }] } }).length)
      .toEqual({ max: 40, sources: ["textareaConfig.maxCharLimit"] });
    expect(validation.patterns).toEqual([{ pattern: "[A-Z0-9 ]+" }]);
    expect(validation.list).toEqual({ mode: "deny", match: "value", values: ["h0h 0h0"], message: "Not that one" });
    expect(validation.customError).toBe("Not that one");
    expect(validation.unsupported).toEqual([{ rule: { type: "custom", value: "x > 1" }, reason: "A custom rule is kept as written and not run." }]);
    expect(hasFieldValidation(validation)).toBe(true);
  });

  it("gives the type's format first and merges an imported rule's message into it", () => {
    const validation = readFieldValidation({ id: "e", type: "email", validation: { rules: [{ type: "email", message: "Work email" }] } });
    expect(validation.formats).toEqual([{ format: "email", source: "type", message: "Work email" }]);
  });

  it("reads number, rating, slider and scale ranges from their own configs", () => {
    expect(readFieldValidation({ id: "n", type: "number", numberConfig: { typeNumber: "year" } }).number).toEqual({ wholeNumber: true, year: true, sources: ["numberConfig.typeNumber"] });
    // Being a number at all is the answer type's check, not a limit.
    expect(readFieldValidation({ id: "n", type: "number", numberConfig: { typeNumber: "decimal" } }).number).toBeNull();
    expect(readFieldValidation({ id: "t", type: "text" }).number).toBeNull();
    expect(readFieldValidation({ id: "r", type: "rating" }).number).toEqual({ wholeNumber: true, min: 1, max: 5, sources: ["ratingConfig"] });
    expect(readFieldValidation({ id: "s", type: "scale", scaleConfig: { min: 0, max: 4, step: 1, style: "labeled" } }).number).toBeNull();
    expect(readFieldValidation({ id: "s", type: "scale", scaleConfig: { min: 0, max: 4, step: 1 } }).number).toEqual({ min: 0, max: 4, sources: ["scaleConfig"] });
  });

  it("collects date limits from fixed, past/future and relative settings", () => {
    const validation = readFieldValidation({
      id: "d",
      type: "date",
      dateConfig: { minDate: "2020-01-01", disableFutureDates: true, relativeMinDate: { anchor: "today", direction: "before", value: 120, unit: "years" } },
    });
    expect(validation.date).toEqual({
      earliest: [{ kind: "date", date: "2020-01-01" }, { kind: "today", direction: "before", value: 120, unit: "years" }],
      latest: [{ kind: "today", direction: "exact", value: 0, unit: "days" }],
      sources: ["dateConfig.minDate", "dateConfig.disableFutureDates", "dateConfig.relativeMinDate"],
    });
    expect(readFieldValidation({ id: "t", type: "text", dateConfig: { minDate: "2020-01-01" } }).date).toBeNull();
  });

  it("keeps behavior.validations and Logic-tab invalid rules as one cross-field list", () => {
    const validation = readFieldValidation(
      {
        id: "a",
        type: "text",
        behavior: { validations: [{ id: "v1", validWhen: { match: "all", conditions: [{ controllerFieldId: "b", condition: { type: "filled" } }] }, message: " " }] },
      },
      { fieldLinkRules: [{ id: "r1", controllerFieldId: "b", condition: { type: "empty" }, targetFieldIds: ["a"], action: "invalid", validationMessage: "Fill B first." }] },
    );
    expect(validation.crossField.map(({ id, source, kind, message }) => ({ id, source, kind, message }))).toEqual([
      { id: "v1", source: "behavior", kind: "valid-when", message: "This answer conflicts with another answer." },
      { id: "r1", source: "logic-rule", kind: "invalid-when", message: "Fill B first." },
    ]);
  });

  it("finds nothing on a plain optional field", () => {
    expect(hasFieldValidation(readFieldValidation({ id: "a", type: "text" }))).toBe(false);
  });
});

describe("validateAnswer", () => {
  it.each(VALIDATION_ANSWER_CASES.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    const problems = run(testCase);
    expect(problems.map((problem) => problem.kind)).toEqual(testCase.expected);
    if (testCase.message !== undefined) expect(problems[0]?.message).toBe(testCase.message);
    for (const problem of problems) expect(problem.fieldId).toBe(testCase.field.id);
  });

  it("names the rule behind a cross-field problem and the format behind a format problem", () => {
    const validation = readFieldValidation(
      { id: "a", type: "email" },
      { fieldLinkRules: [{ id: "rule-1", controllerFieldId: "a", condition: { type: "filled" }, targetFieldIds: ["a"], action: "invalid" }] },
    );
    expect(validateAnswer(validation, "nope")).toEqual([
      { fieldId: "a", kind: "format", message: "Please enter a valid email address", format: "email" },
      { fieldId: "a", kind: "cross-field", message: "This answer conflicts with another answer.", ruleId: "rule-1" },
    ]);
  });

  it("counts months and years from today without rolling past the month's end", () => {
    const today = new Date(2026, 2, 31);
    expect(resolveDateBound({ kind: "today", direction: "before", value: 1, unit: "months" }, today)).toEqual(new Date(2026, 1, 28));
    expect(resolveDateBound({ kind: "today", direction: "after", value: 2, unit: "weeks" }, today)).toEqual(new Date(2026, 3, 14));
    expect(resolveDateBound({ kind: "date", date: "2026-02-30" }, today)).toBeNull();
  });
});

describe("isFieldHiddenByLogic", () => {
  const fields: ValidationFieldInput[] = [
    { id: "smoker", type: "booleanYesNo" },
    { id: "kind", type: "choice", options: ["Cigarettes", "Vape"] },
    { id: "packs", type: "number", visibility: { type: "equals", controllerId: "smoker", value: "Yes" } },
    { id: "brand", type: "text", visibility: { type: "equals", controllerId: "kind", value: "Cigarettes" } },
  ];
  const byId = (id: string) => fields.find((field) => field.id === id)!;

  it("honours the field's own Hidden setting", () => {
    expect(isFieldHiddenByLogic({ id: "a", type: "text", hidden: true })).toBe(true);
    expect(isFieldHiddenByLogic({ id: "a", type: "text" })).toBe(false);
  });

  it("reads show-when rules on Yes/No and choice controllers through the shared converter", () => {
    expect(isFieldHiddenByLogic(byId("packs"), { smoker: true }, { fields })).toBe(false);
    expect(isFieldHiddenByLogic(byId("packs"), { smoker: false }, { fields })).toBe(true);
    expect(isFieldHiddenByLogic(byId("packs"), {}, { fields })).toBe(true);
    expect(isFieldHiddenByLogic(byId("brand"), { kind: { code: "Cigarettes", display: "Cigarettes" } }, { fields })).toBe(false);
    expect(isFieldHiddenByLogic(byId("brand"), { kind: "Vape" }, { fields })).toBe(true);
  });

  it("lets a Logic-tab Show or Hide rule replace the field's own show-when rule", () => {
    const show: FieldLinkRule = { id: "s", controllerFieldId: "kind", condition: { type: "choice-selected", optionValues: ["Vape"] }, targetFieldIds: ["brand"], action: "show" };
    expect(isFieldHiddenByLogic(byId("brand"), { kind: "Vape" }, { fields, fieldLinkRules: [show] })).toBe(false);
    expect(isFieldHiddenByLogic(byId("brand"), { kind: "Cigarettes" }, { fields, fieldLinkRules: [show] })).toBe(true);
    const hide: FieldLinkRule = { id: "h", controllerFieldId: "smoker", condition: { type: "boolean-no" }, targetFieldIds: ["brand"], action: "hide" };
    expect(isFieldHiddenByLogic(byId("brand"), { smoker: false, kind: "Cigarettes" }, { fields, fieldLinkRules: [hide] })).toBe(true);
    expect(isFieldHiddenByLogic(byId("brand"), { smoker: true, kind: "Vape" }, { fields, fieldLinkRules: [hide] })).toBe(false);
  });

  it("ignores rules with other actions", () => {
    const required: FieldLinkRule = { id: "r", controllerFieldId: "smoker", condition: { type: "boolean-yes" }, targetFieldIds: ["packs"], action: "set-required" };
    expect(isFieldHiddenByLogic(byId("packs"), { smoker: true }, { fields, fieldLinkRules: [required] })).toBe(false);
  });
});
