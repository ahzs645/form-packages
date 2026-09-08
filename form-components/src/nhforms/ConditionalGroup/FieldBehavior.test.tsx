// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { produce } from "immer";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileFieldLinkConditionGroup,
  evaluateFieldLinkRuleCondition,
  type FieldLinkRule,
} from "@webforms/form-model";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const context = React.createContext<any>(null);
const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "packages/form-components/src/nhforms/ConditionalGroup/index.jsx",
  ),
  "utf8",
);
const compiled = Babel.transform(source, { presets: ["react"] }).code;
const runtime = new Function(
  "React",
  "Fluent",
  "useActiveData",
  "produce",
  `${compiled}; return { ConditionalFieldBehavior, ConditionalField, FormBehaviorRuntime, resolveFieldCopies, validateFieldBehaviors, evaluateConditionEntries };`,
)(
  React,
  new Proxy({}, { get: () => () => null }),
  () => React.useContext(context),
  produce,
);
const group = {
  match: "all",
  conditions: [{ controllerFieldId: "age", type: "number-gte", value: 18 }],
};
const config = (rules: any[] = []) => ({
  fieldId: "note",
  label: "Note",
  required: false,
  rules,
  validations: [],
  optionRules: [],
});
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  document.body.innerHTML = "";
});
function mount(
  component: React.ReactNode,
  data: Record<string, unknown>,
  locale = "",
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  let set!: React.Dispatch<any>;
  let current: any;
  function Host() {
    const [state, setter] = React.useState({
      field: { data, status: { __formLocale: locale } },
    });
    set = setter;
    current = state;
    return (
      <context.Provider value={[state, setter]}>{component}</context.Provider>
    );
  }
  act(() => root.render(<Host />));
  return {
    container,
    values: () => current.field.data,
    update: (patch: Record<string, unknown>) =>
      act(() =>
        set(
          produce((draft: any) => {
            Object.assign(draft.field.data, patch);
          }),
        ),
      ),
  };
}

describe("offline field extensions in shipped NHForms source", () => {
  it.each(["compareFieldId", "valueFieldId"])("preserves nested date comparisons using %s", (property) => {
    const rule: FieldLinkRule = {
      id: "date-order", action: "invalid", controllerFieldId: "end",
      condition: { type: "filled" }, targetFieldIds: ["end"],
      conditionGroup: { match: "all", conditions: [
        { match: "any", conditions: [{ controllerFieldId: "end", condition: { type: "number-lt", [property]: "start" } }] },
      ] },
    };
    const group = compileFieldLinkConditionGroup(rule);
    for (const [values, expected] of [
      [{ start: "2026-09-08", end: "2026-09-07" }, true],
      [{ start: "2026-09-08", end: "2026-09-09" }, false],
      [{ end: "2026-09-07" }, false],
    ] as const) {
      expect(evaluateFieldLinkRuleCondition(rule, () => undefined, values)).toBe(expected);
      expect(runtime.evaluateConditionEntries(group.conditions, group.match, (id: string) => (values as Record<string, unknown>)[id])).toBe(expected);
    }
  });

  it("matches nested group and comparison-field evaluation with canonical model", () => {
    const rule: FieldLinkRule = {
      id: "nested",
      action: "show",
      controllerFieldId: "age",
      condition: { type: "filled" },
      targetFieldIds: ["note"],
      conditionGroup: {
        match: "all",
        conditions: [
          {
            controllerFieldId: "age",
            condition: { type: "number-gte", valueFieldId: "minimum" },
          },
          {
            match: "any",
            conditions: [
              {
                controllerFieldId: "choice",
                condition: { type: "choice-selected", optionValues: ["A"] },
              },
              { controllerFieldId: "note", condition: { type: "filled" } },
            ],
          },
        ],
      },
    };
    const compiled = compileFieldLinkConditionGroup(rule);
    for (const values of [
      { age: 18, minimum: { value: 18 }, choice: { code: "A" } },
      { age: 17, minimum: 18, note: "Text" },
      { age: 20, minimum: 18, choice: "B", note: "Text" },
    ]) {
      expect(
        runtime.evaluateConditionEntries(
          compiled.conditions,
          compiled.match,
          (id: string) => (values as any)[id],
        ),
      ).toBe(evaluateFieldLinkRuleCondition(rule, () => undefined, values));
    }
  });
  it("combines multiple show rules as OR and gives hide rules precedence", () => {
    const Field = runtime.ConditionalField;
    const h = mount(
      <Field
        visibilityRules={[
          { ...group, action: "show" },
          {
            match: "all",
            conditions: [{ controllerFieldId: "other", type: "filled" }],
            action: "show",
          },
          {
            match: "all",
            conditions: [{ controllerFieldId: "hide", type: "boolean-yes" }],
            action: "hide",
          },
        ]}
      >
        <span>Visible field</span>
      </Field>,
      { age: 19 },
    );
    expect(h.container.textContent).toContain("Visible field");
    h.update({ hide: true });
    expect(h.container.textContent).toBe("");
    h.update({ hide: false, age: 10, other: "yes" });
    expect(h.container.textContent).toContain("Visible field");
  });
  it("copies across unmounted pages until edited, preserves other answers, and respects locks", () => {
    const Runtime = runtime.FormBehaviorRuntime;
    const h = mount(
      <Runtime
        configs={[
          config([
            {
              ...group,
              action: "copy-value",
              copyFromFieldId: "source",
              copyPolicy: "until-edited",
            },
          ]),
        ]}
      />,
      { age: 19, source: "First", other: "Keep" },
    );
    expect(h.values().note).toBe("First");
    h.update({ source: "Second" });
    expect(h.values().note).toBe("Second");
    h.update({ note: "My edit", source: "Third" });
    expect(h.values().note).toBe("My edit");
    h.update({ note: "", source: "Fourth" });
    expect(h.values().note).toBe("");
    expect(h.values().other).toBe("Keep");
    expect(
      runtime.resolveFieldCopies(
        [
          config([
            {
              ...group,
              action: "copy-value",
              copyFromFieldId: "source",
              copyPolicy: "always",
            },
          ]),
        ],
        { age: 19, source: "New", note: "Original" },
        { note: true },
      ).values.note,
    ).toBe("Original");
  });
  it("validates required and cross-field errors without mounted inputs, with translated messages", () => {
    const c = {
      ...config([{ ...group, action: "set-required" }]),
      validations: [
        {
          id: "same",
          validWhen: {
            match: "all",
            conditions: [
              {
                controllerFieldId: "note",
                type: "equals",
                valueFieldId: "source",
              },
            ],
          },
          message: "Must match",
          translations: { fr: "Doit correspondre" },
        },
      ],
    };
    expect(runtime.validateFieldBehaviors([c], { age: 19 })).toEqual([
      { id: "note", message: "Note is required" },
    ]);
    expect(runtime.validateFieldBehaviors([c], { age: 10 })).toEqual([]);
    expect(runtime.validateFieldBehaviors([{ ...c, gates: [{ match: "all", conditions: [{ controllerFieldId: "gate", type: "boolean-yes" }] }] }], { age: 19, gate: false })).toEqual([]);
    expect(
      runtime.validateFieldBehaviors(
        [c],
        { age: 19, note: "A", source: "B" },
        "fr",
      ),
    ).toEqual([{ id: "note", message: "Doit correspondre" }]);
    expect(
      runtime.validateFieldBehaviors(
        [{ ...c, rules: [...c.rules, { ...group, action: "hide" }] }],
        { age: 19 },
      ),
    ).toEqual([]);
  });
  it("translates choices without changing codes and disables individual options", () => {
    const Behavior = runtime.ConditionalFieldBehavior;
    const DummyChoice = (_props: any) => null;
    const h = mount(
      <Behavior
        fieldId="choice"
        translations={{
          fr: { label: "Choix", options: { A: "Alpha français" } },
        }}
        baseText={{ label: "Choice" }}
        optionRules={[{ value: "A", disableWhen: group }]}
      >
        <DummyChoice
          fieldId="choice"
          label="Choice"
          optionList={[
            { key: "A", text: "Alpha" },
            { key: "B", text: "Beta" },
          ]}
        />
      </Behavior>,
      { age: 19 },
      "fr",
    );
    const a = h.container.querySelector(
      'option[value="A"]',
    ) as HTMLOptionElement;
    expect(a.text).toBe("Alpha français");
    expect(a.disabled).toBe(true);
    expect(h.container.textContent).toContain("Choix");
    h.update({ age: 10 });
    expect(
      (h.container.querySelector('option[value="A"]') as HTMLOptionElement)
        .disabled,
    ).toBe(false);
    const select = h.container.querySelector("select")!;
    act(() => {
      select.value = "A";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(h.values().choice.code).toBe("A");
  });
});
