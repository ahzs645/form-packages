// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { compileFieldBehavior } from "@/lib/offline-authoring/field-behavior";
import { evaluateConditionGroup, type FieldConditionGroup, type FieldConditionLeaf, type FieldLinkCondition, type FieldLinkRule, type ParsedField } from "@webforms/form-model";
import { compileFieldLinkConditionGroup } from "@webforms/form-model";
import { countRepeatItems } from "@/lib/page-flow";

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

function load<T>(sources: string[], names: string[], scope: Record<string, unknown> = {}): T {
  const compiled = Babel.transform(sources.join("\n"), { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const keys = Object.keys(scope);
  // Same bare-global contract used by the injected NHForms runtime.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(...keys, `${compiled};\nreturn { ${names.join(", ")} };`);
  return factory(...keys.map((key) => scope[key])) as T;
}

type Kit = {
  evaluateGroup: (group: unknown, getValue: unknown) => boolean;
  isFieldHidden: (config: unknown, getValue: unknown) => boolean;
  validate: (configs: unknown[], values: Record<string, unknown>, options?: Record<string, unknown>) => Array<Record<string, unknown>>;
  formats: Record<string, unknown>;
  focusField: (fieldId: string, label?: string) => boolean;
  hasMeaningfulValue: (value: unknown) => boolean;
  repeatItemCount: (values: Record<string, unknown>, repeatFor: unknown) => number;
};

const { FormLogicKit } = load<{ FormLogicKit: Kit }>([read("FormLogicKit")], ["FormLogicKit"]);
const { validateFieldBehaviors } = load<{
  validateFieldBehaviors: (configs: unknown[], values: Record<string, unknown>) => Array<{ id: string; message: string }>;
}>([read("ConditionalGroup")], ["validateFieldBehaviors"], { React, Fluent: {} });

const leaf = (controllerFieldId: string, condition: FieldLinkCondition): FieldConditionLeaf => ({ controllerFieldId, condition });

const GROUPS: FieldConditionGroup[] = [
  { match: "all", conditions: [leaf("smoker", { type: "boolean-yes" })] },
  { match: "any", conditions: [leaf("pain", { type: "number-gte", value: 7 }), leaf("meds", { type: "choice-selected", optionValues: ["opioid"] })] },
  {
    match: "all",
    conditions: [
      leaf("discharge", { type: "number-lt", compareFieldId: "admit" }),
      { match: "any", conditions: [leaf("note", { type: "filled" }), leaf("smoker", { type: "boolean-no" })] },
    ],
  },
];

const VALUE_SETS: Array<Record<string, unknown>> = [
  {},
  { smoker: "yes", pain: "3", meds: ["opioid"], note: "x", admit: "2026-01-05", discharge: "2026-01-02" },
  { smoker: { code: "N", display: "No" }, pain: 9, meds: [{ code: "nsaid" }], admit: "2026-01-05", discharge: "2026-01-09" },
  { smoker: true, pain: "", meds: "opioid", note: " ", admit: "", discharge: "2026-01-01" },
];

describe("FormLogicKit.evaluateGroup", () => {
  it("matches @webforms/form-model for builder-shape and compiled groups", () => {
    for (const group of GROUPS) {
      const compiled = compileFieldLinkConditionGroup({ controllerFieldId: "", condition: { type: "filled" }, conditionGroup: group });
      for (const values of VALUE_SETS) {
        const expected = evaluateConditionGroup(group, () => undefined, values);
        expect(FormLogicKit.evaluateGroup(group, values), JSON.stringify({ group, values })).toBe(expected);
        expect(FormLogicKit.evaluateGroup(compiled, (id: string) => values[id])).toBe(expected);
      }
    }
  });

  it("treats a missing or empty group as no match", () => {
    expect(FormLogicKit.evaluateGroup(null, {})).toBe(false);
    expect(FormLogicKit.evaluateGroup({ match: "all", conditions: [] }, {})).toBe(false);
  });
});

describe("FormLogicKit.validate", () => {
  const fields: ParsedField[] = [
    { id: "smoker", label: "Smoker", kind: "boolean", rawType: "boolean" } as ParsedField,
    { id: "packs", label: "Packs per day", kind: "number", rawType: "number", required: true } as ParsedField,
    { id: "name", label: "Name", kind: "text", rawType: "text", required: true } as ParsedField,
    {
      id: "age", label: "Age", kind: "number", rawType: "number",
      behavior: { validations: [{ id: "v1", message: "Age must be 18+", validWhen: { match: "all", conditions: [leaf("age", { type: "number-gte", value: 18 })] } }] },
    } as unknown as ParsedField,
  ];
  const rules: FieldLinkRule[] = [
    { id: "r1", controllerFieldId: "smoker", condition: { type: "boolean-yes" }, targetFieldIds: ["packs"], action: "show" },
  ];
  const configs = fields.map((field) => ({ ...compileFieldBehavior(field, rules), pageIndex: field.id === "name" ? 1 : 0 }));

  it("reports the same problems as ConditionalGroup's validateFieldBehaviors", () => {
    for (const values of [{}, { smoker: "yes" }, { smoker: "no", name: "A", age: "12" }, { smoker: "yes", packs: 2, name: "B", age: 40 }]) {
      const legacy = validateFieldBehaviors(configs, values).map(({ id, message }) => ({ id, message }));
      const issues = FormLogicKit.validate(configs, values).map((issue) => ({ id: issue.fieldId, message: issue.message }));
      expect(issues, JSON.stringify(values)).toEqual(legacy);
    }
  });

  it("returns FormValidationIssue objects with kind and page index", () => {
    const issues = FormLogicKit.validate(configs, { smoker: "yes", age: 3 });
    expect(issues).toEqual([
      { fieldId: "packs", label: "Packs per day", message: "Packs per day is required", pageIndex: 0, kind: "required" },
      { fieldId: "name", label: "Name", message: "Name is required", pageIndex: 1, kind: "required" },
      { fieldId: "age", label: "Age", message: "Age must be 18+", pageIndex: 0, kind: "rule" },
    ]);
  });

  it("scopes to one page and skips inactive pages", () => {
    const values = { smoker: "yes" };
    expect(FormLogicKit.validate(configs, values, { pageIndex: 1 }).map((issue) => issue.fieldId)).toEqual(["name"]);
    expect(FormLogicKit.validate(configs, values, { inactivePages: [1] }).map((issue) => issue.fieldId)).toEqual(["packs"]);
  });

  it("skips rule-hidden fields and exposes isFieldHidden", () => {
    const packs = configs.find((config) => config.fieldId === "packs");
    expect(FormLogicKit.isFieldHidden(packs, { smoker: "no" })).toBe(true);
    expect(FormLogicKit.isFieldHidden(packs, { smoker: "yes" })).toBe(false);
  });

  it("ships the value formats (parity with lib/validation/formats.ts is in value-formats.test.ts)", () => {
    expect(Object.keys(FormLogicKit.formats).sort()).toEqual(["bc-phn", "ca-postal", "money"]);
  });
});

describe("FormLogicKit.repeatItemCount", () => {
  const repeatFor = {
    sourceFieldId: "meds",
    filter: { match: "all", conditions: [leaf("status", { type: "choice-selected", optionValues: ["active"] })] },
  };
  it("matches countRepeatItems in lib/page-flow for the page-skip option", () => {
    const sets: Array<Record<string, unknown>> = [
      {},
      { meds: [] },
      { meds: { rows: [{ _rowId: "a", drug: "Metformin", status: "active" }] } },
      { meds: [{ _rowId: "a", drug: "Metformin", status: { code: "active", display: "Active" } }, { _rowId: "b", drug: "", status: "" }] },
      { meds: [{ _rowId: "a", drug: "Metformin", status: "stopped" }, { _rowId: "b", drug: "Insulin", status: "active" }] },
      { page: { meds: [{ _rowId: "a", status: "active", prn: false }] } },
    ];
    for (const values of sets) {
      expect(FormLogicKit.repeatItemCount(values, repeatFor), JSON.stringify(values)).toBe(countRepeatItems(values, repeatFor as never));
      expect(FormLogicKit.repeatItemCount(values, { sourceFieldId: "meds", keyColumnId: "drug" })).toBe(countRepeatItems(values, { sourceFieldId: "meds", keyColumnId: "drug" }));
    }
  });
});

describe("FormLogicKit.focusField", () => {
  it("focuses by id, then the first control inside a data-field-id wrapper", () => {
    document.body.innerHTML = `<input id="direct" /><div data-field-id="wrapped"><span>Label</span><input id="inner" /></div>`;
    expect(FormLogicKit.focusField("direct")).toBe(true);
    expect(document.activeElement?.id).toBe("direct");
    expect(FormLogicKit.focusField("wrapped")).toBe(true);
    expect(document.activeElement?.id).toBe("inner");
    expect(FormLogicKit.focusField("missing")).toBe(false);
  });

  it("finds real-MOIS controls, which carry generated ids: radios by name, the control beside the label, repeat tables", () => {
    // DOM shapes captured from the SMOIS FormTester (TextArea -> id="TextField27",
    // OptionChoice radios -> name=fieldId, LayoutItem -> <div><label/>...control</div>).
    document.body.innerHTML = `
      <section><div><div><label>Current medications</label></div></div></section>
      <div><label>First name</label><div><div><input type="text" id="TextField27" /></div></div></div>
      <div><label>Sex</label><div role="radiogroup"><input id="sex-F" type="radio" name="sex" /><input id="sex-M" type="radio" name="sex" checked /></div></div>
      <div data-repeat-for-table="adherence"><table><tr><td><input id="label-cell" disabled /></td><td><input id="missed" /></td></tr></table></div>
      <div><label>Current medications</label><table><tr><td><input id="med-name" /></td></tr></table></div>`;
    expect(FormLogicKit.focusField("first_name")).toBe(false);
    expect(FormLogicKit.focusField("first_name", "First name")).toBe(true);
    expect(document.activeElement?.id).toBe("TextField27");
    expect(FormLogicKit.focusField("sex", "Sex")).toBe(true);
    expect(document.activeElement?.id).toBe("sex-M");
    expect(FormLogicKit.focusField("adherence", "Medication adherence")).toBe(true);
    expect(document.activeElement?.id).toBe("missed");
    // The section heading with the same text has no control; the table label does.
    expect(FormLogicKit.focusField("medications", "Current medications *")).toBe(true);
    expect(document.activeElement?.id).toBe("med-name");
  });
});

describe("Phase 0 flow component stubs", () => {
  it("FormFlow exposes its static parts (behaviour: form-flow.test.tsx)", () => {
    const { FormFlow } = load<{ FormFlow: Record<string, React.ComponentType<Record<string, unknown>>> & React.ComponentType<Record<string, unknown>> }>(
      [read("FormFlow")], ["FormFlow"], { React },
    );
    for (const part of ["Nav", "Page", "Steps", "Review", "Finish", "Confirmation"]) {
      expect(typeof FormFlow[part]).toBe("function");
    }
  });

  it("FormErrorSummary renders nothing while there are no errors (behaviour: form-error-summary.test.tsx; RepeatForEachTable: repeat-for-each-table.test.tsx)", () => {
    const useActiveData = () => [{ field: { data: {} }, uiState: {} }, () => undefined];
    const { FormErrorSummary } = load<{ FormErrorSummary: React.ComponentType }>([read("FormErrorSummary")], ["FormErrorSummary"], { React, useActiveData });
    expect(renderToStaticMarkup(React.createElement(FormErrorSummary))).toBe("");
  });
});
