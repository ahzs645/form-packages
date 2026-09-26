// FormLogicKit.evaluateVisibilityRule (exported tables: EditableTable,
// RepeatForEachTable, subform fields) must agree with the builder's own
// evaluation of a BuilderVisibilityRule: lib/logic/unified-rule converts the
// rule to a field-link rule (visibilityRuleToFieldLinkConditions in
// packages/form-model/src/conditions.ts, controller kind aware) and
// @webforms/form-model evaluates it. One case table, asserted against both.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";

import {
  evaluateFieldLinkRuleCondition,
  type BuilderField,
  type BuilderVisibilityRule,
} from "@webforms/form-model";
import { buildFieldVisibilityRules } from "@/lib/logic/unified-rule";
import type { LogicField, LogicFieldKind } from "@/lib/logic/field-adapter";

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "FormLogicKit", "index.jsx"), "utf8");
const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
type Kind = "boolean" | "choice" | "number" | "text" | undefined;
// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
const FormLogicKit = new Function(`${compiled};\nreturn FormLogicKit;`)() as {
  evaluateVisibilityRule: (
    rule: unknown,
    getValue: unknown,
    options?: { controllerKind?: (id: string) => Kind },
  ) => boolean;
};

// Controllers and the kind each would have in the builder / as a table column.
const KINDS: Record<string, Exclude<Kind, undefined>> = {
  flag: "boolean",
  pick: "choice",
  score: "number",
  note: "text",
};

function builderVisible(rule: BuilderVisibilityRule, values: Record<string, unknown>): boolean {
  const fieldById = new Map<string, LogicField>(
    Object.entries(KINDS).map(([id, kind]) => [id, { id, label: id, kind: kind as LogicFieldKind }]),
  );
  const [entry] = buildFieldVisibilityRules([{ id: "target", label: "Target", type: "text", visibility: rule } as BuilderField], fieldById);
  if (!entry) return true; // no rule ("always" / no controller): shown
  return evaluateFieldLinkRuleCondition(entry.rule, () => undefined, values);
}

const kitVisible = (rule: BuilderVisibilityRule, values: Record<string, unknown>) =>
  FormLogicKit.evaluateVisibilityRule(rule, (id: string) => values[id], { controllerKind: (id) => KINDS[id] });

const RULES: Array<[string, BuilderVisibilityRule]> = [
  ["always", { type: "always" }],
  ["no controller", { type: "equals", value: "x" }],
  ["filled", { type: "filled", controllerId: "note" }],
  ["not-filled", { type: "not-filled", controllerId: "note" }],
  ["text equals", { type: "equals", controllerId: "note", value: "hello" }],
  ["text not-equals", { type: "not-equals", controllerId: "note", value: "hello" }],
  ["gt", { type: "gt", controllerId: "score", value: "5" }],
  ["gte", { type: "gte", controllerId: "score", value: "5" }],
  ["lt", { type: "lt", controllerId: "score", value: "5" }],
  ["lte", { type: "lte", controllerId: "score", value: "5" }],
  ["number equals", { type: "equals", controllerId: "score", value: "5" }],
  ["gt with blank value", { type: "gt", controllerId: "score", value: "" }],
  ["boolean equals Yes", { type: "equals", controllerId: "flag", value: "Yes" }],
  ["boolean equals true", { type: "equals", controllerId: "flag", value: "true" }],
  ["boolean equals No", { type: "equals", controllerId: "flag", value: "No" }],
  ["boolean equals false", { type: "equals", controllerId: "flag", value: "false" }],
  ["boolean not-equals Yes", { type: "not-equals", controllerId: "flag", value: "Yes" }],
  ["boolean not-equals unchecked", { type: "not-equals", controllerId: "flag", value: "unchecked" }],
  ["choice equals", { type: "equals", controllerId: "pick", value: "a" }],
  ["choice equals display", { type: "equals", controllerId: "pick", value: "Alpha" }],
  ["choice not-equals", { type: "not-equals", controllerId: "pick", value: "a" }],
  ["choice equals blank", { type: "equals", controllerId: "pick", value: "" }],
  ["all of two", { type: "equals", controllerId: "pick", value: "a", additionalConditions: [{ type: "gte", controllerId: "score", value: "5" }] }],
  ["any of two", { type: "equals", controllerId: "pick", value: "a", match: "any", additionalConditions: [{ type: "gte", controllerId: "score", value: "5" }] }],
  ["any of three", {
    type: "equals", controllerId: "flag", value: "Yes", match: "any",
    additionalConditions: [{ type: "not-filled", controllerId: "note" }, { type: "lt", controllerId: "score", value: "0" }],
  }],
];

const VALUE_SETS: Array<[string, Record<string, unknown>]> = [
  ["nothing answered", {}],
  ["blank strings", { flag: "", pick: "", score: "", note: "" }],
  ["whitespace", { note: "   ", score: " " }],
  ["scalar answers", { flag: true, pick: "a", score: 7, note: "hello" }],
  ["string number, unchecked", { flag: false, pick: "b", score: "5", note: "other" }],
  ["yes/no text", { flag: "yes", score: "4.5", note: "HELLO" }],
  ["Y / N codes", { flag: "Y", pick: "a", score: 5 }],
  ["N", { flag: "N", score: -1 }],
  ["numeric boolean", { flag: 1, score: "12" }],
  ["numeric boolean off", { flag: 0, score: "abc" }],
  ["coded answers", { flag: { code: "Y", display: "Yes" }, pick: { code: "a", display: "Alpha" }, note: { code: "hello", display: "Hello" } }],
  ["coded no", { flag: { code: "N", display: "No" }, pick: { code: "b", display: "Beta" } }],
  ["multi-select", { pick: ["b", "a"] }],
  ["multi-select coded", { pick: [{ code: "c", display: "Alpha" }] }],
  ["empty multi-select", { pick: [] }],
  ["dates as numbers", { score: "2026-01-05" }],
];

describe("FormLogicKit.evaluateVisibilityRule parity with the builder (form-model)", () => {
  it("compares against a reference that really hides things", () => {
    expect(builderVisible({ type: "gt", controllerId: "score", value: "5" }, { score: 7 })).toBe(true);
    expect(builderVisible({ type: "gt", controllerId: "score", value: "5" }, { score: 3 })).toBe(false);
    expect(builderVisible({ type: "equals", controllerId: "flag", value: "Yes" }, { flag: true })).toBe(true);
    expect(builderVisible({ type: "equals", controllerId: "flag", value: "Yes" }, { flag: false })).toBe(false);
  });

  for (const [ruleLabel, rule] of RULES) {
    it.each(VALUE_SETS)(`${ruleLabel} — %s`, (_label, values) => {
      expect(kitVisible(rule, values)).toBe(builderVisible(rule, values));
    });
  }
});

describe("FormLogicKit.evaluateVisibilityRule", () => {
  const rule = (extra: Partial<BuilderVisibilityRule>) => ({ type: "equals", controllerId: "flag", value: "Yes", ...extra }) as BuilderVisibilityRule;

  it("shows the target for a missing rule, 'always' or a rule without a controller", () => {
    expect(FormLogicKit.evaluateVisibilityRule(null, {})).toBe(true);
    expect(FormLogicKit.evaluateVisibilityRule({ type: "always" }, {})).toBe(true);
    expect(FormLogicKit.evaluateVisibilityRule({ type: "equals", value: "x" }, {})).toBe(true);
  });

  it("never matches an empty answer with equals or not-equals (no controller kind)", () => {
    const get = () => "";
    expect(FormLogicKit.evaluateVisibilityRule({ type: "equals", controllerId: "x", value: "" }, get)).toBe(false);
    expect(FormLogicKit.evaluateVisibilityRule({ type: "not-equals", controllerId: "x", value: "y" }, get)).toBe(false);
  });

  it("reads stored boolean text on a boolean controller: true/'true'/'yes'/'y'/1 and code Y", () => {
    const boolean = { controllerKind: () => "boolean" as const };
    for (const value of [true, "true", "TRUE", "yes", "y", "Y", 1, "Checked", { code: "Y" }, { code: "y", display: "Yes" }]) {
      expect(FormLogicKit.evaluateVisibilityRule(rule({}), () => value, boolean), JSON.stringify(value)).toBe(true);
      expect(FormLogicKit.evaluateVisibilityRule(rule({ value: "No" }), () => value, boolean)).toBe(false);
    }
    for (const value of [false, "false", "no", "n", 0, "Unchecked", { code: "N" }]) {
      expect(FormLogicKit.evaluateVisibilityRule(rule({}), () => value, boolean), JSON.stringify(value)).toBe(false);
      expect(FormLogicKit.evaluateVisibilityRule(rule({ value: "false" }), () => value, boolean)).toBe(true);
    }
    // Neither yes nor no: both comparisons fail.
    for (const value of [undefined, "", "maybe", 2]) {
      expect(FormLogicKit.evaluateVisibilityRule(rule({}), () => value, boolean)).toBe(false);
      expect(FormLogicKit.evaluateVisibilityRule(rule({ value: "No" }), () => value, boolean)).toBe(false);
    }
  });

  it("compares a coded answer by code, then display", () => {
    const coded = () => ({ code: "a", display: "Alpha" });
    expect(FormLogicKit.evaluateVisibilityRule({ type: "equals", controllerId: "x", value: "a" }, coded)).toBe(true);
    expect(FormLogicKit.evaluateVisibilityRule({ type: "equals", controllerId: "x", value: "Alpha" }, coded)).toBe(false);
    expect(FormLogicKit.evaluateVisibilityRule({ type: "equals", controllerId: "x", value: "Alpha" }, () => ({ display: "Alpha" }))).toBe(true);
    // A choice controller matches either.
    const choice = { controllerKind: () => "choice" as const };
    expect(FormLogicKit.evaluateVisibilityRule({ type: "equals", controllerId: "x", value: "Alpha" }, coded, choice)).toBe(true);
  });

  it("ignores an additional condition that has no controller yet", () => {
    const values = { flag: true };
    const withBlank = rule({ additionalConditions: [{ type: "filled", controllerId: "" }] });
    expect(FormLogicKit.evaluateVisibilityRule(withBlank, values, { controllerKind: () => "boolean" })).toBe(true);
  });

  it("accepts a values object as well as a getter", () => {
    expect(FormLogicKit.evaluateVisibilityRule({ type: "gte", controllerId: "score", value: "3" }, { score: 3 })).toBe(true);
    expect(FormLogicKit.evaluateVisibilityRule({ type: "gte", controllerId: "score", value: "3" }, { score: 2 })).toBe(false);
  });
});
