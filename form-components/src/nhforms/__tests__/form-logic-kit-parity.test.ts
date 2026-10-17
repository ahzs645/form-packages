import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as runtimeLogic from "@/packages/form-model/src/runtime-logic";
import { evaluateConditionTree, evaluateVisibilityRule, isLayoutRowVisible } from "@/packages/form-model/src/conditions";
import { optionState as builderOptionState, readOptionRules } from "@/packages/form-model/src/option-rules";
import {
  CONDITION_GROUP_CASES,
  LAYOUT_ROW_CASES,
  OPTION_RULE_CASES,
  VISIBILITY_RULE_CASES,
} from "@/packages/form-model/src/conditions.cases";
// @ts-expect-error -- plain .mjs build script, no type declarations
import { renderFormLogicKitSource as renderFormLogicKitSourceUntyped } from "@/scripts/generate-form-logic-kit.mjs";

import { FORM_LOGIC_KIT_SOURCE, loadFormLogicKit } from "./form-logic-kit-source";

const renderFormLogicKitSource = renderFormLogicKitSourceUntyped as () => Promise<{ source: string; exportedNames: string[] }>;
const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Same bare-global contract the injected NHForms runtime uses.
const FormLogicKit = loadFormLogicKit();

describe("FormLogicKit is generated from @webforms/form-model", () => {
  it("is current (run pnpm generate:nhforms)", async () => {
    const { source } = await renderFormLogicKitSource();
    expect(fs.readFileSync(path.join(NH, "FormLogicKit", "index.jsx"), "utf8")).toBe(source);
    expect(FORM_LOGIC_KIT_SOURCE).toBe(source);
  });

  it("exports the runtime module plus the DOM helpers", () => {
    expect(Object.keys(FormLogicKit).sort()).toEqual([...Object.keys(runtimeLogic), "focusField", "locateField"].sort());
  });
});

describe("conditions: shared cases (conditions.cases.ts)", () => {
  it.each(CONDITION_GROUP_CASES.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    expect(evaluateConditionTree(testCase.group as never, (id) => testCase.values[id])).toBe(testCase.expected);
    expect(FormLogicKit.evaluateGroup(testCase.group, testCase.values)).toBe(testCase.expected);
    expect(FormLogicKit.evaluateGroup(testCase.group, (id: string) => testCase.values[id])).toBe(testCase.expected);
  });
});

describe("show-when rules: shared cases", () => {
  it.each(VISIBILITY_RULE_CASES.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    const kind = (id: string) => testCase.kinds[id];
    expect(evaluateVisibilityRule(testCase.rule as never, (id) => testCase.values[id], kind)).toBe(testCase.expected);
    expect(FormLogicKit.evaluateVisibilityRule(testCase.rule, testCase.values, { controllerKind: kind })).toBe(testCase.expected);
  });
});

describe("layout-table rows: shared cases", () => {
  it.each(LAYOUT_ROW_CASES.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    expect(isLayoutRowVisible(testCase.visibleWhen as never, (id) => testCase.values[id])).toBe(testCase.expected);
    expect(FormLogicKit.isLayoutRowVisible(testCase.visibleWhen, testCase.values)).toBe(testCase.expected);
  });
});

describe("answer conditions: shared cases", () => {
  it.each(OPTION_RULE_CASES.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    const builderRules = readOptionRules({ optionRules: testCase.rules });
    for (const [value, expected] of Object.entries(testCase.states)) {
      expect(builderOptionState(value, builderRules, testCase.values), value).toBe(expected);
      expect(FormLogicKit.optionState(value, testCase.rules, testCase.values), value).toBe(expected);
    }
    if (testCase.answer) {
      expect(FormLogicKit.hasUnavailableAnswer(testCase.answer.value, testCase.rules, testCase.values)).toBe(testCase.answer.unavailable);
    }
  });
});

// validation.cases.ts runs against the kit in lib/__tests__/form-logic-kit-validation-parity.test.ts.
