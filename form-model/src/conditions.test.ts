import { describe, expect, it } from "vitest";
import {
  BUILDER_FIELD_DEFINITIONS,
  BUILDER_FIELD_TYPES,
  compileFieldLinkConditionGroup,
  compileFieldLinkProtectionRule,
  compileFieldLinkVisibilityRule,
  evaluateFieldCondition,
  evaluateFieldLinkRuleCondition,
  type FieldLinkRule,
} from "./index";
import { parseBuilderFields } from "./schemas";

describe("form-model condition kernel", () => {
  it("normalizes coded choices, numbers, and SMOIS runtime boolean values", () => {
    expect(evaluateFieldCondition(
      { type: "choice-selected", optionValues: ["A"] },
      { code: "A", display: "Alpha" },
    )).toBe(true);
    expect(evaluateFieldCondition({ type: "number-gte", value: 10 }, "10")).toBe(true);
    expect(evaluateFieldCondition(
      { type: "boolean-yes" },
      { code: "Y", display: "Yes" },
    )).toBe(true);
    expect(evaluateFieldCondition(
      { type: "boolean-yes" },
      "Present",
      { booleanLabels: { on: "Present", off: "Absent" } },
    )).toBe(false);
  });

  it("combines primary and additional conditions consistently", () => {
    const rule: FieldLinkRule = {
      id: "rule",
      controllerFieldId: "a",
      condition: { type: "filled" },
      additionalConditions: [
        { controllerFieldId: "b", condition: { type: "equals", value: "yes" } },
      ],
      conditionMatch: "all",
      targetFieldIds: ["target"],
      action: "show",
    };
    expect(evaluateFieldLinkRuleCondition(rule, () => undefined, { a: "value", b: "yes" })).toBe(true);
    expect(evaluateFieldLinkRuleCondition(rule, () => undefined, { a: "value", b: "no" })).toBe(false);
  });

  it("compiles the stable NHForms condition contract without changing evaluation", () => {
    const rule: FieldLinkRule = {
      id: "rule",
      controllerFieldId: "choice",
      condition: { type: "choice-selected", optionValues: ["A", "B"] },
      additionalConditions: [
        { controllerFieldId: "score", condition: { type: "number-gte", value: 10 } },
        { controllerFieldId: "empty", condition: { type: "empty", value: null } },
      ],
      conditionMatch: "any",
      targetFieldIds: ["target"],
      action: "hide",
    };

    expect(compileFieldLinkConditionGroup(rule)).toEqual({
      conditions: [
        { controllerFieldId: "choice", type: "choice-selected", optionValues: ["A", "B"] },
        { controllerFieldId: "score", type: "number-gte", value: 10 },
        { controllerFieldId: "empty", type: "empty" },
      ],
      match: "any",
    });
    expect(compileFieldLinkVisibilityRule(rule).invertMatch).toBe(true);
    expect(evaluateFieldLinkRuleCondition(rule, () => undefined, {
      choice: "C",
      score: 10,
      empty: "not empty",
    })).toBe(true);
    expect(() => compileFieldLinkVisibilityRule({ ...rule, action: "copy-value" }))
      .toThrow(/Cannot compile copy-value/);
  });

  it("compiles protection defaults and rejects unrelated actions", () => {
    const rule: FieldLinkRule = {
      id: "rule",
      controllerFieldId: "ready",
      condition: { type: "boolean-yes" },
      targetFieldIds: ["target"],
      action: "set-readonly",
    };
    expect(compileFieldLinkProtectionRule(rule)).toEqual({
      conditions: [{ controllerFieldId: "ready", type: "boolean-yes" }],
      match: "all",
      action: "set-readonly",
      protectionMode: "both",
    });
    expect(() => compileFieldLinkProtectionRule({ ...rule, action: "show" }))
      .toThrow(/Cannot compile show/);
  });
});

describe("builder persistence schemas", () => {
  it("accepts valid fields and rejects unknown field kinds", () => {
    expect(parseBuilderFields([{ id: "name", label: "Name", type: "text" }])).toHaveLength(1);
    expect(() => parseBuilderFields([{ id: "name", label: "Name", type: "mystery" }]))
      .toThrow(/Invalid builder fields/);
  });

  it("defines metadata for every supported field type", () => {
    expect(BUILDER_FIELD_DEFINITIONS.map((definition) => definition.type).sort())
      .toEqual([...BUILDER_FIELD_TYPES].sort());
  });
});
