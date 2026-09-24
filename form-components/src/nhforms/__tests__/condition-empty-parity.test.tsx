// @vitest-environment happy-dom
// "is empty" / "is filled" parity across every place a condition is evaluated:
// @webforms/form-model (builder preview, page-flow TS), the ConditionalGroup
// NHForm (exported visibility + field behaviour), FormLogicKit (exported page
// flow + validation) and the exporter's inline cross-field helper. Tables are
// the reason this exists: a table answer is an array of rows (or { rows }) and
// "has items" means at least one row holds a real, non-meta answer.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React from "react";

import {
  evaluateConditionGroup,
  evaluateFieldCondition,
  isConditionValueEmpty,
  type BuilderField,
  type FieldLinkRule,
} from "@webforms/form-model";
import { renderJsxForPreview } from "@/lib/mois-export";

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

function load<T>(sources: string[], names: string[], scope: Record<string, unknown> = {}): T {
  const compiled = Babel.transform(sources.join("\n"), { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const keys = Object.keys(scope);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(...keys, `${compiled};\nreturn { ${names.join(", ")} };`);
  return factory(...keys.map((key) => scope[key])) as T;
}

const { FormLogicKit } = load<{
  FormLogicKit: {
    evaluateGroup: (group: unknown, getValue: unknown) => boolean;
    isEmptyValue: (value: unknown) => boolean;
    hasMeaningfulValue: (value: unknown) => boolean;
  };
}>([read("FormLogicKit")], ["FormLogicKit"]);

const ConditionalGroup = load<{
  evaluateConditionEntries: (entries: unknown[], match: string, get: (id: string) => unknown) => boolean;
  isConditionAnswerEmpty: (value: unknown) => boolean;
  checkMeaningfulAnswer: (value: unknown) => boolean;
}>([read("ConditionalGroup")], ["evaluateConditionEntries", "isConditionAnswerEmpty", "checkMeaningfulAnswer"], { React, Fluent: {} });

const META = { _rowId: "r1", _sourceKey: "src-1", _sourceRemoved: false, _complete: true, _rowStatus: "new", _sourceLabel: "Metformin", _formulaOverrides: { total: 3 } };

/** [description, value, expected empty]. One list, asserted against every evaluator. */
const EMPTY_VECTORS: Array<[string, unknown, boolean]> = [
  ["undefined", undefined, true],
  ["null", null, true],
  ["blank string", "", true],
  ["whitespace", "   ", true],
  ["text", "x", false],
  ["zero (scalar)", 0, false],
  ["false (scalar boolean answer)", false, false],
  ["true", true, false],
  ["coded object", { code: "A", display: "Alpha" }, false],
  ["coded object with blank code", { code: "", display: "" }, true],
  ["empty object", {}, true],
  ["table: no rows", [], true],
  ["table: meta-only row", [{ _rowId: "r1" }], true],
  ["table: every meta key", [META], true],
  ["table: blank cell", [{ _rowId: "r1", drug: "" }], true],
  ["table: whitespace + unchecked checkbox", [{ _rowId: "r1", drug: "  " }, { _rowId: "r2", given: false }], true],
  ["table: NaN cell", [{ _rowId: "r1", dose: Number.NaN }], true],
  ["table: empty list cell", [{ _rowId: "r1", tags: [] }], true],
  ["table: empty object cell", [{ _rowId: "r1", route: {} }], true],
  ["table: null cells", [{ _rowId: "r1", drug: null, dose: undefined }], true],
  ["table: checked checkbox", [{ _rowId: "r1", given: true }], false],
  ["table: zero", [{ _rowId: "r1", dose: 0 }], false],
  ["table: text", [{ _rowId: "r1", drug: "Metformin" }], false],
  ["table: answered second row", [{ _rowId: "r1", drug: "" }, { ...META, _rowId: "r2", drug: "Aspirin" }], false],
  ["table: list cell", [{ _rowId: "r1", tags: ["a"] }], false],
  ["table: coded cell", [{ _rowId: "r1", route: { code: "PO", display: "Oral" } }], false],
  // Cells follow EditableTable's rule: any non-empty object is an answer.
  ["table: non-empty object cell", [{ _rowId: "r1", route: { code: "" } }], false],
  ["multi-select: blank coded item", [{ code: "" }], true],
  ["rows object: none", { rows: [] }, true],
  ["rows object: meta-only", { rows: [{ _rowId: "r1", _complete: true }] }, true],
  ["rows object: answered", { rows: [{ _rowId: "r1", drug: "x" }] }, false],
  ["multi-select: items", ["a"], false],
  ["multi-select: coded items", [{ code: "opioid" }], false],
  ["multi-select: blank item", [""], true],
  ["multi-select: null item", [null], true],
];

// Pull the exporter's inline cross-field evaluator out of generated JSX once.
const crossField = (() => {
  const fields = [
    { id: "meds", label: "Medications", type: "table", tableConfig: { columns: [{ id: "drug", label: "Drug", type: "text" }] } },
    { id: "note", label: "Note", type: "text" },
  ] as unknown as BuilderField[];
  const rules = [
    { id: "has", controllerFieldId: "meds", condition: { type: "filled" }, targetFieldIds: ["note"], action: "invalid", validationMessage: "has" },
    { id: "none", controllerFieldId: "meds", condition: { type: "empty" }, targetFieldIds: ["note"], action: "invalid", validationMessage: "none" },
  ] as FieldLinkRule[];
  const jsx = renderJsxForPreview({
    builderName: "Meds", groups: [], fields: [], layoutDrafts: [], branchingRules: {}, fieldLinkRules: rules,
    paginationEnabled: false, pageCount: 1, groupPageAssignments: {}, builderFields: fields,
  } as never);
  const rulesMatch = /const crossFieldValidationRules = (\[[\s\S]*?\]);/.exec(jsx);
  const helperStart = jsx.indexOf("const crossFieldValueOf");
  const helperEnd = jsx.indexOf("const evaluateCrossFieldConditions");
  const helperTail = jsx.slice(helperEnd, jsx.indexOf("};", jsx.indexOf("return rule.match")) + 2);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const evaluate = new Function("rules", "data", `${jsx.slice(helperStart, helperEnd)}${helperTail}\nreturn rules.filter((rule) => evaluateCrossFieldConditions(rule, data)).map((rule) => rule.message);`) as (
    rules: unknown,
    data: Record<string, unknown>,
  ) => string[];
  const compiled = JSON.parse(rulesMatch?.[1] ?? "[]");
  return (value: unknown) => evaluate(compiled, { meds: value });
})();

describe("condition emptiness parity (shared vectors)", () => {
  it.each(EMPTY_VECTORS)("%s", (_label, value, expectedEmpty) => {
    const get = (id: string) => (id === "t" ? value : undefined);
    const leaf = (type: "filled" | "empty") => ({ match: "all" as const, conditions: [{ controllerFieldId: "t", condition: { type } }] });
    const compiled = (type: "filled" | "empty") => [{ controllerFieldId: "t", type }];

    // @webforms/form-model
    expect(isConditionValueEmpty(value)).toBe(expectedEmpty);
    expect(evaluateFieldCondition({ type: "empty" }, value)).toBe(expectedEmpty);
    expect(evaluateFieldCondition({ type: "filled" }, value)).toBe(!expectedEmpty);
    expect(evaluateConditionGroup(leaf("filled"), () => undefined, { t: value })).toBe(!expectedEmpty);

    // ConditionalGroup NHForm (visibility, required/copy "is empty").
    expect(ConditionalGroup.isConditionAnswerEmpty(value)).toBe(expectedEmpty);
    expect(ConditionalGroup.checkMeaningfulAnswer(value)).toBe(!expectedEmpty);
    expect(ConditionalGroup.evaluateConditionEntries(compiled("filled"), "all", get)).toBe(!expectedEmpty);
    expect(ConditionalGroup.evaluateConditionEntries(compiled("empty"), "all", get)).toBe(expectedEmpty);

    // FormLogicKit (page flow, form validation), both group shapes.
    expect(FormLogicKit.isEmptyValue(value)).toBe(expectedEmpty);
    expect(FormLogicKit.hasMeaningfulValue(value)).toBe(!expectedEmpty);
    expect(FormLogicKit.evaluateGroup(leaf("filled"), get)).toBe(!expectedEmpty);
    expect(FormLogicKit.evaluateGroup({ match: "all", conditions: compiled("empty") }, get)).toBe(expectedEmpty);

    // Exporter's inline cross-field ("invalid" rule) evaluator.
    expect(crossField(value)).toEqual([expectedEmpty ? "none" : "has"]);
  });
});
