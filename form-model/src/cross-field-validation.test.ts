import { describe, expect, it } from "vitest";
import type { FieldLinkRule } from "./index";
import {
  DEFAULT_CROSS_FIELD_VALIDATION_MESSAGE,
  evaluateCrossFieldValidation,
  evaluateFieldLinkRuleCondition,
} from "./conditions";

const rule = (overrides: Partial<FieldLinkRule> & { id: string }): FieldLinkRule =>
  ({
    controllerFieldId: "a",
    condition: { type: "filled" },
    targetFieldIds: ["a"],
    action: "invalid",
    ...overrides,
  }) as FieldLinkRule;

describe("cross-field validation", () => {
  // The three cases the review named as impossible to author before this.
  it("catches a discharge date before admission", () => {
    const rules = [
      rule({
        id: "discharge-order",
        controllerFieldId: "discharge_date",
        condition: { type: "number-lt", compareFieldId: "admission_date" },
        targetFieldIds: ["discharge_date"],
        validationMessage: "Discharge cannot be before admission.",
      }),
    ];

    expect(
      evaluateCrossFieldValidation(rules, { admission_date: "2026-03-10", discharge_date: "2026-03-04" }),
    ).toEqual([
      { fieldId: "discharge_date", ruleId: "discharge-order", message: "Discharge cannot be before admission." },
    ]);

    expect(
      evaluateCrossFieldValidation(rules, { admission_date: "2026-03-10", discharge_date: "2026-03-12" }),
    ).toEqual([]);
    // Same day is not before.
    expect(
      evaluateCrossFieldValidation(rules, { admission_date: "2026-03-10", discharge_date: "2026-03-10" }),
    ).toEqual([]);
  });

  it("catches a diastolic at or above the systolic", () => {
    const rules = [
      rule({
        id: "bp-order",
        controllerFieldId: "diastolic",
        condition: { type: "number-gte", compareFieldId: "systolic" },
        targetFieldIds: ["diastolic"],
        validationMessage: "Diastolic must be below systolic.",
      }),
    ];

    expect(evaluateCrossFieldValidation(rules, { systolic: 120, diastolic: 130 })).toHaveLength(1);
    expect(evaluateCrossFieldValidation(rules, { systolic: 120, diastolic: 120 })).toHaveLength(1);
    expect(evaluateCrossFieldValidation(rules, { systolic: 120, diastolic: 80 })).toEqual([]);
  });

  it("catches a dose above a calculated maximum", () => {
    const rules = [
      rule({
        id: "dose-max",
        controllerFieldId: "dose_mg",
        condition: { type: "number-gt", compareFieldId: "max_dose_mg" },
        targetFieldIds: ["dose_mg"],
        validationMessage: "Dose exceeds the calculated maximum.",
      }),
    ];
    expect(evaluateCrossFieldValidation(rules, { max_dose_mg: 500, dose_mg: 750 })).toHaveLength(1);
    expect(evaluateCrossFieldValidation(rules, { max_dose_mg: 500, dose_mg: 500 })).toEqual([]);
  });

  it("stays quiet while the other answer is still blank", () => {
    // A half-filled form must not accuse someone of a conflict with a question
    // they have not reached yet.
    const rules = [
      rule({
        id: "discharge-order",
        controllerFieldId: "discharge_date",
        condition: { type: "number-lt", compareFieldId: "admission_date" },
        targetFieldIds: ["discharge_date"],
      }),
    ];
    expect(evaluateCrossFieldValidation(rules, { discharge_date: "2026-03-04" })).toEqual([]);
    expect(evaluateCrossFieldValidation(rules, { discharge_date: "2026-03-04", admission_date: "" })).toEqual([]);
    expect(evaluateCrossFieldValidation(rules, { admission_date: "2026-03-10" })).toEqual([]);
  });

  it("still compares against a literal when no compare field is named", () => {
    const rules = [
      rule({
        id: "over-limit",
        controllerFieldId: "count",
        condition: { type: "number-gt", value: 10 },
        targetFieldIds: ["count"],
      }),
    ];
    expect(evaluateCrossFieldValidation(rules, { count: 11 })).toHaveLength(1);
    expect(evaluateCrossFieldValidation(rules, { count: 9 })).toEqual([]);
  });

  it("combines several conditions and reports on every target", () => {
    const rules = [
      rule({
        id: "multi",
        controllerFieldId: "end_date",
        condition: { type: "number-lt", compareFieldId: "start_date" },
        additionalConditions: [{ controllerFieldId: "confirmed", condition: { type: "boolean-yes" } }],
        conditionMatch: "all",
        targetFieldIds: ["start_date", "end_date"],
        validationMessage: "Confirmed stays cannot end before they start.",
      }),
    ];

    expect(
      evaluateCrossFieldValidation(rules, { start_date: "2026-05-10", end_date: "2026-05-01", confirmed: true }),
    ).toEqual([
      { fieldId: "start_date", ruleId: "multi", message: "Confirmed stays cannot end before they start." },
      { fieldId: "end_date", ruleId: "multi", message: "Confirmed stays cannot end before they start." },
    ]);

    // Not confirmed, so the pair is allowed to be out of order for now.
    expect(
      evaluateCrossFieldValidation(rules, { start_date: "2026-05-10", end_date: "2026-05-01", confirmed: false }),
    ).toEqual([]);
  });

  it("falls back to a generic message when the author wrote none", () => {
    const errors = evaluateCrossFieldValidation(
      [rule({ id: "bare", controllerFieldId: "x", condition: { type: "filled" }, targetFieldIds: ["x"] })],
      { x: "anything" },
    );
    expect(errors[0].message).toBe(DEFAULT_CROSS_FIELD_VALIDATION_MESSAGE);
  });

  it("ignores rules that are not error rules", () => {
    const errors = evaluateCrossFieldValidation(
      [rule({ id: "vis", action: "hide", controllerFieldId: "x", condition: { type: "filled" }, targetFieldIds: ["y"] })],
      { x: "anything" },
    );
    expect(errors).toEqual([]);
  });

  it("leaves the existing visibility path working with a compare field", () => {
    // The same condition shape drives show/hide, so it has to keep evaluating
    // there too rather than only inside the validation entry point.
    const visibility = rule({
      id: "vis",
      action: "show",
      controllerFieldId: "weight_now",
      condition: { type: "number-lt", compareFieldId: "weight_before" },
      targetFieldIds: ["weight_loss_notes"],
    });
    expect(
      evaluateFieldLinkRuleCondition(visibility, () => undefined, { weight_before: 80, weight_now: 72 }),
    ).toBe(true);
    expect(
      evaluateFieldLinkRuleCondition(visibility, () => undefined, { weight_before: 80, weight_now: 85 }),
    ).toBe(false);
  });
});
