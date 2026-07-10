import { describe, expect, it } from "vitest";
import {
  BUILDER_FIELD_DEFINITIONS,
  BUILDER_FIELD_TYPES,
  evaluateFieldCondition,
  evaluateFieldLinkRuleCondition,
  type FieldLinkRule,
} from "./index";
import { parseBuilderFields } from "./schemas";

describe("form-model condition kernel", () => {
  it("normalizes coded choices, numbers, and custom boolean labels", () => {
    expect(evaluateFieldCondition(
      { type: "choice-selected", optionValues: ["A"] },
      { code: "A", display: "Alpha" },
    )).toBe(true);
    expect(evaluateFieldCondition({ type: "number-gte", value: 10 }, "10")).toBe(true);
    expect(evaluateFieldCondition(
      { type: "boolean-yes" },
      "Present",
      { booleanLabels: { on: "Present", off: "Absent" } },
    )).toBe(true);
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
