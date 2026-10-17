/**
 * Shared case table for conditions.ts: what a condition means, held against
 * every engine that evaluates one. The reference (evaluateConditionTree,
 * evaluateVisibilityRule, isLayoutRowVisible and the option-rule readers)
 * and the generated MOIS runtime (FormLogicKit, built from this package) run
 * every case; a target simulator can run them too.
 *
 * Groups come in both stored shapes: the builder's ({ controllerFieldId,
 * condition: {...} }) and the flat compiled contract the exporters emit
 * ({ controllerFieldId, type, optionValues?, value?, compareFieldId? }).
 * `expected` is the intended meaning, not whatever an engine happens to do.
 */

export interface ConditionGroupCase {
  name: string;
  group: unknown;
  values: Record<string, unknown>;
  expected: boolean;
}

export interface VisibilityRuleCase {
  name: string;
  rule: unknown;
  /** The controllers' kinds ("boolean", "checkbox", "choice", "number", "text"); missing = unknown. */
  kinds: Record<string, string>;
  values: Record<string, unknown>;
  expected: boolean;
}

export interface LayoutRowCase {
  name: string;
  visibleWhen: unknown;
  values: Record<string, unknown>;
  expected: boolean;
}

export interface OptionRuleCase {
  name: string;
  /** Stored option rules ({ value, showWhen?, disableWhen? }). */
  rules: unknown[];
  values: Record<string, unknown>;
  /** The answer's state for each value. */
  states: Record<string, "available" | "disabled" | "hidden">;
  /** A stored answer, and whether it includes an answer not offered now. */
  answer?: { value: unknown; unavailable: boolean };
}

const leaf = (controllerFieldId: string, condition: Record<string, unknown>) => ({ controllerFieldId, condition });
const flat = (controllerFieldId: string, condition: Record<string, unknown>) => ({ controllerFieldId, ...condition });
const all = (...conditions: unknown[]) => ({ match: "all", conditions });
const any = (...conditions: unknown[]) => ({ match: "any", conditions });

export const CONDITION_GROUP_CASES: ConditionGroupCase[] = [
  // Structure
  { name: "a group with no conditions never holds", group: all(), values: {}, expected: false },
  { name: "a missing group never holds", group: null, values: {}, expected: false },
  { name: "match all needs every condition", group: all(leaf("a", { type: "filled" }), leaf("b", { type: "filled" })), values: { a: "x" }, expected: false },
  { name: "match any needs one condition", group: any(leaf("a", { type: "filled" }), leaf("b", { type: "filled" })), values: { a: "x" }, expected: true },
  { name: "nested groups", group: all(leaf("a", { type: "filled" }), any(leaf("b", { type: "filled" }), leaf("c", { type: "filled" }))), values: { a: "x", c: "y" }, expected: true },
  { name: "the flat compiled shape reads the same", group: all(flat("a", { type: "equals", value: "x" })), values: { a: "x" }, expected: true },
  { name: "an entry without a controller is no match", group: all(flat("", { type: "empty" })), values: {}, expected: false },
  { name: "an entry without an operator is no match", group: all({ controllerFieldId: "a" }), values: { a: "x" }, expected: false },

  // Yes/No
  { name: "boolean-yes: true", group: all(leaf("a", { type: "boolean-yes" })), values: { a: true }, expected: true },
  { name: "boolean-yes: the code Y", group: all(leaf("a", { type: "boolean-yes" })), values: { a: "Y" }, expected: true },
  { name: "boolean-yes: a MOIS-YESNO coding", group: all(leaf("a", { type: "boolean-yes" })), values: { a: { code: "Y", display: "Yes" } }, expected: true },
  { name: "boolean-yes: 1", group: all(leaf("a", { type: "boolean-yes" })), values: { a: 1 }, expected: true },
  { name: "boolean-yes: stored text \"true\" (table cells, older subform rows)", group: all(leaf("a", { type: "boolean-yes" })), values: { a: "true" }, expected: true },
  { name: "boolean-yes: a ticked box saved as \"Checked\"", group: all(leaf("a", { type: "boolean-yes" })), values: { a: "Checked" }, expected: true },
  { name: "boolean-yes: a subform selection", group: all(leaf("a", { type: "boolean-yes" })), values: { a: { selectedKey: "true", response: "Checked" } }, expected: true },
  { name: "boolean-yes: unanswered", group: all(leaf("a", { type: "boolean-yes" })), values: {}, expected: false },
  { name: "boolean-yes: false", group: all(leaf("a", { type: "boolean-yes" })), values: { a: false }, expected: false },
  { name: "boolean-no: false", group: all(leaf("a", { type: "boolean-no" })), values: { a: false }, expected: true },
  { name: "boolean-no: the code N", group: all(leaf("a", { type: "boolean-no" })), values: { a: "N" }, expected: true },
  { name: "boolean-no: stored text \"no\"", group: all(leaf("a", { type: "boolean-no" })), values: { a: "No" }, expected: true },
  { name: "boolean-no: unanswered Yes/No is not a no", group: all(leaf("a", { type: "boolean-no" })), values: {}, expected: false },
  { name: "boolean-no on a single checkbox: untouched is unticked", group: all(leaf("a", { type: "boolean-no", emptyIsNo: true })), values: {}, expected: true },
  { name: "boolean-no on a single checkbox: ticked", group: all(leaf("a", { type: "boolean-no", emptyIsNo: true })), values: { a: true }, expected: false },

  // Choices
  { name: "choice-selected: a plain value", group: all(leaf("a", { type: "choice-selected", optionValues: ["2"] })), values: { a: "2" }, expected: true },
  { name: "choice-selected: a coding by code", group: all(leaf("a", { type: "choice-selected", optionValues: ["Y"] })), values: { a: { code: "Y", display: "Yes" } }, expected: true },
  { name: "choice-selected: a coding by wording", group: all(leaf("a", { type: "choice-selected", optionValues: ["Yes"] })), values: { a: { code: "Y", display: "Yes" } }, expected: true },
  { name: "choice-selected: one of several selected", group: all(leaf("a", { type: "choice-selected", optionValues: ["b"] })), values: { a: ["a", "b"] }, expected: true },
  { name: "choice-selected: unanswered", group: all(leaf("a", { type: "choice-selected", optionValues: ["b"] })), values: {}, expected: false },
  { name: "choice-selected with no options is no match", group: all(leaf("a", { type: "choice-selected", optionValues: [] })), values: { a: "b" }, expected: false },
  { name: "choice-not-selected: unanswered", group: all(leaf("a", { type: "choice-not-selected", optionValues: ["b"] })), values: {}, expected: true },
  { name: "choice-not-selected: the option is selected", group: all(leaf("a", { type: "choice-not-selected", optionValues: ["b"] })), values: { a: ["b"] }, expected: false },
  { name: "choice-not-selected with no options holds", group: all(leaf("a", { type: "choice-not-selected", optionValues: [] })), values: { a: "b" }, expected: true },

  // Equality reads a coding by its code first
  { name: "equals: a coding compares by its code", group: all(leaf("a", { type: "equals", value: "Y" })), values: { a: { code: "Y", value: "Yes" } }, expected: true },
  { name: "equals: a coding's value is not its code", group: all(leaf("a", { type: "equals", value: "Yes" })), values: { a: { code: "Y", value: "Yes" } }, expected: false },
  { name: "equals: unanswered is no match", group: all(leaf("a", { type: "equals", value: "" })), values: {}, expected: false },
  { name: "not-equals: unanswered is no match", group: all(leaf("a", { type: "not-equals", value: "x" })), values: {}, expected: false },
  { name: "not-equals: another answer", group: all(leaf("a", { type: "not-equals", value: "x" })), values: { a: "y" }, expected: true },
  { name: "equals: a number answer against text", group: all(leaf("a", { type: "equals", value: "3" })), values: { a: 3 }, expected: true },

  // Ordered comparisons: numbers, else dates
  { name: "number-gt: numeric text", group: all(leaf("a", { type: "number-gt", value: 3 })), values: { a: "5" }, expected: true },
  { name: "number-lte: equal", group: all(leaf("a", { type: "number-lte", value: "5" })), values: { a: 5 }, expected: true },
  { name: "number-lt: dates", group: all(leaf("a", { type: "number-lt", value: "2026-01-02" })), values: { a: "2026-01-01" }, expected: true },
  { name: "number-gt: unanswered", group: all(leaf("a", { type: "number-gt", value: 3 })), values: {}, expected: false },
  { name: "number-gt: no value to compare with", group: all(leaf("a", { type: "number-gt", value: "" })), values: { a: 5 }, expected: false },
  { name: "number-gt: not a number or a date", group: all(leaf("a", { type: "number-gt", value: 3 })), values: { a: "many" }, expected: false },
  { name: "number-equals", group: all(leaf("a", { type: "number-equals", value: "4.0" })), values: { a: 4 }, expected: true },

  // Comparing two answers
  { name: "compare field: discharge before admission", group: all(leaf("discharge", { type: "number-lt", compareFieldId: "admission" })), values: { discharge: "2026-01-01", admission: "2026-01-05" }, expected: true },
  { name: "compare field: the other answer is not given yet", group: all(leaf("discharge", { type: "number-lt", compareFieldId: "admission" })), values: { discharge: "2026-01-01" }, expected: false },
  { name: "compare field: codings compare by code", group: all(leaf("a", { type: "equals", compareFieldId: "b" })), values: { a: { code: "Y" }, b: { code: "Y", display: "Yes" } }, expected: true },
  { name: "compare field in the flat shape (valueFieldId)", group: all(flat("dia", { type: "number-gt", valueFieldId: "sys" })), values: { dia: 120, sys: 90 }, expected: true },

  // Filled and empty
  { name: "filled: text", group: all(leaf("a", { type: "filled" })), values: { a: "x" }, expected: true },
  { name: "filled: zero is an answer", group: all(leaf("a", { type: "filled" })), values: { a: 0 }, expected: true },
  { name: "filled: false is an answer", group: all(leaf("a", { type: "filled" })), values: { a: false }, expected: true },
  { name: "empty: blank text", group: all(leaf("a", { type: "empty" })), values: { a: "  " }, expected: true },
  { name: "empty: no selection", group: all(leaf("a", { type: "empty" })), values: { a: [] }, expected: true },
  { name: "empty: a table whose only row holds bookkeeping", group: all(leaf("a", { type: "empty" })), values: { a: [{ _rowId: "r1", _complete: false }] }, expected: true },
  { name: "empty: a table row with an unticked box only", group: all(leaf("a", { type: "empty" })), values: { a: { rows: [{ done: false }] } }, expected: true },
  { name: "filled: a table row with an answer", group: all(leaf("a", { type: "filled" })), values: { a: { rows: [{ _rowId: "r1", dose: "5 mg" }] } }, expected: true },
  { name: "filled: a coding", group: all(leaf("a", { type: "filled" })), values: { a: { code: "Y" } }, expected: true },
  { name: "empty: a coding with no code or wording", group: all(leaf("a", { type: "empty" })), values: { a: { code: "" } }, expected: true },

  // Chart facts
  { name: "chart fact: a rule saved with the answer's label", group: all(leaf("chart:patient.sex", { type: "choice-selected", optionValues: ["Female"] })), values: { "chart:patient.sex": "female" }, expected: true },
  { name: "chart fact: an age", group: all(leaf("chart:patient.ageYears", { type: "number-gte", value: 65 })), values: { "chart:patient.ageYears": 70 }, expected: true },
  { name: "chart fact: a concept", group: all(leaf("chart:patient.concept.DIABETES", { type: "equals", value: "Yes" })), values: { "chart:patient.concept.DIABETES": "yes" }, expected: true },
];

export const VISIBILITY_RULE_CASES: VisibilityRuleCase[] = [
  { name: "no rule: shown", rule: null, kinds: {}, values: {}, expected: true },
  { name: "always: shown", rule: { type: "always" }, kinds: {}, values: {}, expected: true },
  { name: "no controller: shown", rule: { type: "equals", value: "x" }, kinds: {}, values: {}, expected: true },
  { name: "filled", rule: { type: "filled", controllerId: "a" }, kinds: {}, values: { a: "x" }, expected: true },
  { name: "not-filled", rule: { type: "not-filled", controllerId: "a" }, kinds: {}, values: {}, expected: true },
  { name: "equals on unknown controller compares the text", rule: { type: "equals", controllerId: "a", value: "x" }, kinds: {}, values: { a: "x" }, expected: true },
  { name: "Yes/No equals Yes: true", rule: { type: "equals", controllerId: "a", value: "Yes" }, kinds: { a: "boolean" }, values: { a: true }, expected: true },
  { name: "Yes/No equals Yes: the code Y", rule: { type: "equals", controllerId: "a", value: "Yes" }, kinds: { a: "boolean" }, values: { a: "Y" }, expected: true },
  { name: "Yes/No equals Yes: stored text \"true\"", rule: { type: "equals", controllerId: "a", value: "Yes" }, kinds: { a: "boolean" }, values: { a: "true" }, expected: true },
  { name: "Yes/No equals Yes: false", rule: { type: "equals", controllerId: "a", value: "Yes" }, kinds: { a: "boolean" }, values: { a: false }, expected: false },
  { name: "Yes/No equals No: false", rule: { type: "equals", controllerId: "a", value: "No" }, kinds: { a: "boolean" }, values: { a: false }, expected: true },
  { name: "Yes/No equals No: unanswered", rule: { type: "equals", controllerId: "a", value: "No" }, kinds: { a: "boolean" }, values: {}, expected: false },
  { name: "Yes/No not-equals Yes: unanswered", rule: { type: "not-equals", controllerId: "a", value: "Yes" }, kinds: { a: "boolean" }, values: {}, expected: false },
  { name: "single checkbox equals No: untouched is unticked", rule: { type: "equals", controllerId: "a", value: "No" }, kinds: { a: "checkbox" }, values: {}, expected: true },
  { name: "single checkbox equals Yes: ticked", rule: { type: "equals", controllerId: "a", value: "Yes" }, kinds: { a: "checkbox" }, values: { a: true }, expected: true },
  { name: "single checkbox not-equals Yes: untouched", rule: { type: "not-equals", controllerId: "a", value: "Yes" }, kinds: { a: "checkbox" }, values: {}, expected: true },
  { name: "choice equals: one of several selected", rule: { type: "equals", controllerId: "a", value: "b" }, kinds: { a: "choice" }, values: { a: ["a", "b"] }, expected: true },
  { name: "choice equals: a coding", rule: { type: "equals", controllerId: "a", value: "Y" }, kinds: { a: "choice" }, values: { a: { code: "Y", display: "Yes" } }, expected: true },
  { name: "choice not-equals: unanswered", rule: { type: "not-equals", controllerId: "a", value: "b" }, kinds: { a: "choice" }, values: {}, expected: true },
  { name: "gt on numeric text", rule: { type: "gt", controllerId: "a", value: 5 }, kinds: { a: "number" }, values: { a: "7" }, expected: true },
  { name: "lte", rule: { type: "lte", controllerId: "a", value: 5 }, kinds: { a: "number" }, values: { a: 6 }, expected: false },
  {
    name: "additional conditions, match all",
    rule: { type: "filled", controllerId: "a", additionalConditions: [{ type: "equals", controllerId: "b", value: "x" }] },
    kinds: {},
    values: { a: "1", b: "y" },
    expected: false,
  },
  {
    name: "additional conditions, match any",
    rule: { type: "filled", controllerId: "a", match: "any", additionalConditions: [{ type: "equals", controllerId: "b", value: "x" }] },
    kinds: {},
    values: { b: "x" },
    expected: true,
  },
  {
    name: "an additional condition without a controller is ignored",
    rule: { type: "filled", controllerId: "a", additionalConditions: [{ type: "equals", value: "x" }] },
    kinds: {},
    values: { a: "1" },
    expected: true,
  },
  { name: "an unknown rule type means answered", rule: { type: "future-type", controllerId: "a" }, kinds: {}, values: { a: "x" }, expected: true },
];

export const LAYOUT_ROW_CASES: LayoutRowCase[] = [
  { name: "no controller: shown", visibleWhen: null, values: {}, expected: true },
  { name: "truthy: answered", visibleWhen: { fieldId: "a" }, values: { a: "x" }, expected: true },
  { name: "truthy: a no is not truthy", visibleWhen: { fieldId: "a" }, values: { a: false }, expected: false },
  { name: "truthy: unanswered", visibleWhen: { fieldId: "a" }, values: {}, expected: false },
  { name: "yes: a Yes coding", visibleWhen: { fieldId: "a", operator: "yes" }, values: { a: { code: "Y" } }, expected: true },
  { name: "equals: by wording", visibleWhen: { fieldId: "a", operator: "equals", value: "Other" }, values: { a: { code: "OTH", display: "Other" } }, expected: true },
  { name: "equals: a boolean value as yes/no", visibleWhen: { fieldId: "a", operator: "equals", value: true }, values: { a: "Y" }, expected: true },
  { name: "notEquals", visibleWhen: { fieldId: "a", operator: "notEquals", value: "OTH" }, values: { a: { code: "OTH" } }, expected: false },
];

const showWhenFilled = (controllerFieldId: string) => all(leaf(controllerFieldId, { type: "filled" }));

export const OPTION_RULE_CASES: OptionRuleCase[] = [
  {
    name: "no rules: every answer is offered",
    rules: [],
    values: {},
    states: { a: "available", b: "available" },
    answer: { value: "a", unavailable: false },
  },
  {
    name: "show-when that fails hides the answer",
    rules: [{ value: "b", showWhen: showWhenFilled("x") }],
    values: {},
    states: { a: "available", b: "hidden" },
    answer: { value: ["a", "b"], unavailable: true },
  },
  {
    name: "show-when that holds offers the answer",
    rules: [{ value: "b", showWhen: showWhenFilled("x") }],
    values: { x: "1" },
    states: { b: "available" },
    answer: { value: { code: "b" }, unavailable: false },
  },
  {
    name: "disable-when that holds disables the answer",
    rules: [{ value: "b", disableWhen: showWhenFilled("x") }],
    values: { x: "1" },
    states: { a: "available", b: "disabled" },
    answer: { value: { selectedKey: "b" }, unavailable: true },
  },
  {
    name: "a rule still being written (no conditions) is no rule",
    rules: [{ value: "b", showWhen: all() }],
    values: {},
    states: { b: "available" },
    answer: { value: "b", unavailable: false },
  },
];
