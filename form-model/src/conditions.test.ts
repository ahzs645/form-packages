import { describe, expect, it } from "vitest";
import {
  BUILDER_FIELD_DEFINITIONS,
  BUILDER_FIELD_TYPES,
  compileFieldLinkConditionGroup,
  compileFieldLinkProtectionRule,
  compileFieldLinkVisibilityRule,
  conditionControllerKindOf,
  evaluateFieldCondition,
  evaluateFieldLinkRuleCondition,
  CONDITION_NO_ANSWER_TEXT,
  hiddenAnswerPolicyOf,
  isLayoutRowVisible,
  lockWhenToConditionGroup,
  readLockCondition,
  shouldClearHiddenAnswer,
  shouldDropHiddenAnswer,
  visibilityRuleToFieldLinkConditions,
  writeLockCondition,
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

describe("single checkbox controllers", () => {
  const kinds: Record<string, { type: string }> = { declined: { type: "booleanSingle" }, smoker: { type: "booleanYesNo" } };
  const kind = (id: string) => conditionControllerKindOf(kinds[id]);
  const visible = (controllerId: string, value: unknown) =>
    evaluateFieldLinkRuleCondition(visibilityRuleToFieldLinkConditions({ type: "equals", controllerId, value: "false" }, kind)!, () => undefined, value === undefined ? {} : { [controllerId]: value });

  it("treat a box nobody touched as unticked", () => {
    expect([visible("declined", undefined), visible("declined", false), visible("declined", true)]).toEqual([true, true, false]);
    expect(compileFieldLinkConditionGroup(visibilityRuleToFieldLinkConditions({ type: "equals", controllerId: "declined", value: "false" }, kind)!).conditions)
      .toEqual([{ controllerFieldId: "declined", type: "boolean-no", emptyIsNo: true }]);
  });

  it("keep an unanswered Yes/No question unanswered", () => {
    expect([visible("smoker", undefined), visible("smoker", false), visible("smoker", true)]).toEqual([false, true, false]);
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

describe("lock conditions (readLockCondition / writeLockCondition)", () => {
  it("converts legacy lockWhen rules into condition groups", () => {
    expect(lockWhenToConditionGroup({ field: "consent", operator: "truthy" }, () => "boolean")).toEqual({
      match: "all",
      conditions: [{ controllerFieldId: "consent", condition: { type: "boolean-yes" } }],
    });
    expect(lockWhenToConditionGroup({ field: "reason", operator: "truthy" })).toEqual({
      match: "all",
      conditions: [
        { controllerFieldId: "reason", condition: { type: "filled" } },
        { controllerFieldId: "reason", condition: { type: "choice-not-selected", optionValues: [...CONDITION_NO_ANSWER_TEXT] } },
      ],
    });
    // The old editor's default (`equals true`) is a yes/no comparison.
    expect(lockWhenToConditionGroup({ field: "done" })).toEqual({
      match: "all",
      conditions: [{ controllerFieldId: "done", condition: { type: "boolean-yes" } }],
    });
    expect(lockWhenToConditionGroup({ field: "site", operator: "notEquals", value: "Home" }, () => "choice")).toEqual({
      match: "all",
      conditions: [{ controllerFieldId: "site", condition: { type: "choice-not-selected", optionValues: ["Home"] } }],
    });
    expect(lockWhenToConditionGroup({ field: "note", operator: "equals", value: "x" }, () => "text")).toEqual({
      match: "all",
      conditions: [{ controllerFieldId: "note", condition: { type: "equals", value: "x" } }],
    });
    expect(lockWhenToConditionGroup({ field: "" })).toBeNull();
    expect(lockWhenToConditionGroup(null)).toBeNull();
  });

  it("writes lockCondition only and clears a legacy lockWhen", () => {
    const group = { match: "all" as const, conditions: [{ controllerFieldId: "a", condition: { type: "filled" as const } }] };
    expect(writeLockCondition({}, group)).toEqual({ lockCondition: group });
    expect(writeLockCondition({ lockWhen: { field: "a" } }, group)).toEqual({ lockCondition: group, lockWhen: null });
    expect(writeLockCondition({ lockCondition: group }, null)).toEqual({ lockCondition: null });
    expect(writeLockCondition({}, { match: "all", conditions: [] })).toEqual({ lockCondition: null });
    expect(readLockCondition({ ...writeLockCondition({ lockWhen: { field: "a" } }, null), lockWhen: null })).toBeNull();
  });
});

describe("hidden answers", () => {
  it("clears only for a show/hide rule (or a page) set to clear, when the field becomes hidden, with something stored", () => {
    expect(hiddenAnswerPolicyOf([])).toBe("preserve");
    expect(hiddenAnswerPolicyOf([{ action: "show" }, { action: "hide", hiddenAnswerPolicy: "clear" }])).toBe("clear");
    expect(hiddenAnswerPolicyOf([{ action: "copy-value", hiddenAnswerPolicy: "clear" }])).toBe("preserve");
    expect(hiddenAnswerPolicyOf([{ hiddenAnswerPolicy: "clear" }])).toBe("clear");
    expect(shouldClearHiddenAnswer("clear", true, "x", false)).toBe(true);
    expect(shouldClearHiddenAnswer("clear", true, false, false)).toBe(true);
    expect(shouldClearHiddenAnswer("clear", true, "", false)).toBe(false);
    expect(shouldClearHiddenAnswer("clear", false, "x", false)).toBe(false);
    expect(shouldClearHiddenAnswer("preserve", true, "x", false)).toBe(false);
  });

  it("never clears on load: a field already hidden, or whose previous state is unknown, keeps its answer", () => {
    expect(shouldClearHiddenAnswer("clear", true, "x", true)).toBe(false);
    expect(shouldClearHiddenAnswer("clear", true, "x", undefined)).toBe(false);
    expect(shouldClearHiddenAnswer("clear", true, "x", null)).toBe(false);
    expect(shouldClearHiddenAnswer("clear", true, "x")).toBe(false);
  });

  it("drops a hidden answer from the saved answers whenever the field is hidden, also when it opened hidden", () => {
    expect(shouldDropHiddenAnswer("clear", true, "x")).toBe(true);
    expect(shouldDropHiddenAnswer("clear", true, false)).toBe(true);
    expect(shouldDropHiddenAnswer("clear", true, "")).toBe(false);
    expect(shouldDropHiddenAnswer("clear", false, "x")).toBe(false);
    expect(shouldDropHiddenAnswer("preserve", true, "x")).toBe(false);
  });
});

describe("layout-table row visibility", () => {
  it("reads answers the way LayoutTable's rowIsVisible does", () => {
    const shown = (visibleWhen: Parameters<typeof isLayoutRowVisible>[0], value: unknown) =>
      isLayoutRowVisible(visibleWhen, () => value);
    expect(shown(undefined, undefined)).toBe(true);
    expect(shown({ fieldId: "c" }, { code: "N", display: "No" })).toBe(false);
    expect(shown({ fieldId: "c" }, "Heel")).toBe(true);
    expect(shown({ fieldId: "c", operator: "yes" }, "TRUE")).toBe(true);
    expect(shown({ fieldId: "c", operator: "equals", value: "Home" }, { code: "H", display: "Home" })).toBe(true);
    expect(shown({ fieldId: "c", operator: "notEquals", value: "Home" }, undefined)).toBe(true);
  });
});
