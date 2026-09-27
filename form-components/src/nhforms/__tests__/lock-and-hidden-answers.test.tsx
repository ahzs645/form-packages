// @vitest-environment happy-dom
/**
 * Lock conditions and the one hidden-answer rule, held to the TypeScript
 * reference in @webforms/form-model (conditions.ts):
 *
 * - A field's lock condition (`readLockCondition`, which converts a legacy
 *   `lockWhen`) is compiled to the flat condition contract and evaluated by
 *   FormLogicKit.evaluateGroup, exactly as the exported readOnly expression
 *   does; the results match evaluateConditionGroup, and the two legacy bugs
 *   (a truthy rule locking on a coded "No", equals never matching a coded
 *   answer) are gone.
 * - FormLogicKit.hiddenAnswerPolicyOf / shouldClearHiddenAnswer /
 *   shouldDropHiddenAnswer match the reference. ConditionalField clears a
 *   "clear" answer when the field becomes hidden and never when a saved draft
 *   opens with it hidden; FormLogicKit.dropHiddenAnswers leaves it out of the
 *   saved answers instead.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { produce } from "immer";
import {
  compileFieldLinkConditionGroup,
  evaluateConditionGroup,
  hiddenAnswerPolicyOf,
  readLockCondition,
  shouldClearHiddenAnswer,
  shouldDropHiddenAnswer,
  type BuilderLockWhenRule,
} from "@webforms/form-model";
import { buildLockConditionExpression } from "@/lib/mois-export/renderers/field-renderer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

function load<T>(names: string[], exports: string[], scope: Record<string, unknown> = {}): T {
  const compiled = Babel.transform(names.map(read).join("\n"), { presets: ["react"], filename: "index.jsx" }).code ?? "";
  const keys = Object.keys(scope);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(...keys, `${compiled};\nreturn { ${exports.join(", ")} };`);
  return factory(...keys.map((key) => scope[key])) as T;
}

type Kit = {
  evaluateGroup: (group: unknown, values: unknown) => boolean;
  hiddenAnswerPolicyOf: (rules: unknown) => string;
  shouldClearHiddenAnswer: (policy: unknown, hidden: boolean, value: unknown, wasHidden?: boolean | null) => boolean;
  shouldDropHiddenAnswer: (policy: unknown, hidden: boolean, value: unknown) => boolean;
  clearHiddenAnswers: (data: Record<string, unknown>, ids: string[]) => string[];
  dropHiddenAnswers: (data: Record<string, unknown>, entries: unknown[]) => Record<string, unknown>;
};

const { FormLogicKit } = load<{ FormLogicKit: Kit }>(["ValueKit", "FormLogicKit"], ["FormLogicKit"]);

const ANSWERS: unknown[] = [
  undefined, null, "", true, false, 0, 1, "Y", "N", "No", "yes", "Home",
  { code: "Y", display: "Yes" }, { code: "N", display: "No" }, { code: "H", display: "Home" }, ["H"], [],
];

const RULES: Array<[string, BuilderLockWhenRule, string | undefined]> = [
  ["truthy on a Yes/No field", { field: "ctrl", operator: "truthy" }, "boolean"],
  ["truthy on a choice", { field: "ctrl", operator: "truthy" }, "choice"],
  ["truthy, kind unknown", { field: "ctrl", operator: "truthy" }, undefined],
  ["the old default equals true", { field: "ctrl", operator: "equals", value: true }, undefined],
  ["equals Yes on a Yes/No field", { field: "ctrl", operator: "equals", value: "Yes" }, "boolean"],
  ["equals Home on a choice", { field: "ctrl", operator: "equals", value: "Home" }, "choice"],
  ["notEquals Home on a choice", { field: "ctrl", operator: "notEquals", value: "Home" }, "choice"],
  ["equals Home on text", { field: "ctrl", operator: "equals", value: "Home" }, "text"],
];

/** Evaluate the readOnly expression the MOIS export emits for a lock condition. */
function exportedLock(field: Parameters<typeof buildLockConditionExpression>[0], data: Record<string, unknown>): boolean {
  const expression = buildLockConditionExpression(field);
  if (!expression) return false;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function("FormLogicKit", "fd", `return ${expression};`)(FormLogicKit, { field: { data } }) as boolean;
}

describe("lock conditions", () => {
  it.each(RULES)("%s: the exported lock agrees with the reference evaluator", (_name, lockWhen, kind) => {
    const group = readLockCondition({ lockWhen }, () => kind);
    expect(group).not.toBeNull();
    const compiled = compileFieldLinkConditionGroup({ controllerFieldId: "", condition: { type: "filled" }, conditionGroup: group! });
    for (const value of ANSWERS) {
      const data = value === undefined ? {} : { ctrl: value };
      const expected = evaluateConditionGroup(group!, () => undefined, data);
      expect([value, FormLogicKit.evaluateGroup(compiled, data)]).toEqual([value, expected]);
      expect([value, exportedLock({ lockCondition: group }, data)]).toEqual([value, expected]);
    }
  });

  it("no longer locks a truthy rule on a coded No, or on false / 0 / an empty list", () => {
    for (const kind of ["boolean", "choice", undefined]) {
      const group = readLockCondition({ lockWhen: { field: "ctrl", operator: "truthy" } }, () => kind);
      const locks = (value: unknown) => evaluateConditionGroup(group!, () => undefined, { ctrl: value });
      expect([kind, locks({ code: "N", display: "No" })]).toEqual([kind, false]);
      expect([kind, locks(false)]).toEqual([kind, false]);
      expect([kind, locks({ code: "Y", display: "Yes" })]).toEqual([kind, true]);
      expect([kind, locks(true)]).toEqual([kind, true]);
    }
    const unknownKind = readLockCondition({ lockWhen: { field: "ctrl", operator: "truthy" } });
    expect(evaluateConditionGroup(unknownKind!, () => undefined, { ctrl: [] })).toBe(false);
    expect(evaluateConditionGroup(unknownKind!, () => undefined, { ctrl: 0 })).toBe(false);
    expect(evaluateConditionGroup(unknownKind!, () => undefined, { ctrl: "Home" })).toBe(true);
  });

  it("matches a coded answer on equals (by code or wording) and a Yes/No answer as yes/no", () => {
    const choice = readLockCondition({ lockWhen: { field: "ctrl", operator: "equals", value: "Home" } }, () => "choice");
    expect(evaluateConditionGroup(choice!, () => undefined, { ctrl: { code: "H", display: "Home" } })).toBe(true);
    const yes = readLockCondition({ lockWhen: { field: "ctrl", operator: "equals", value: "Yes" } }, () => "boolean");
    expect(evaluateConditionGroup(yes!, () => undefined, { ctrl: { code: "Y", display: "Yes" } })).toBe(true);
    expect(evaluateConditionGroup(yes!, () => undefined, { ctrl: true })).toBe(true);
    const legacyDefault = readLockCondition({ lockWhen: { field: "ctrl", operator: "equals", value: true } });
    expect(evaluateConditionGroup(legacyDefault!, () => undefined, { ctrl: { code: "Y" } })).toBe(true);
    expect(evaluateConditionGroup(legacyDefault!, () => undefined, { ctrl: "true" })).toBe(false);
  });

  it("prefers a stored lockCondition over a legacy lockWhen, and has no lock without either", () => {
    const lockCondition = { match: "all" as const, conditions: [{ controllerFieldId: "b", condition: { type: "filled" as const } }] };
    expect(readLockCondition({ lockCondition, lockWhen: { field: "a", operator: "truthy" } })).toBe(lockCondition);
    expect(readLockCondition({ lockCondition: { match: "all", conditions: [] } })).toBeNull();
    expect(readLockCondition({ lockWhen: { field: " " } })).toBeNull();
    expect(readLockCondition({})).toBeNull();
    expect(buildLockConditionExpression({})).toBeNull();
  });
});

describe("the hidden-answer rule", () => {
  const RULE_SETS: unknown[][] = [
    [],
    [{ action: "show", hiddenAnswerPolicy: "clear" }],
    [{ action: "hide", hiddenAnswerPolicy: "preserve" }],
    [{ action: "show" }, { action: "hide", hiddenAnswerPolicy: "clear" }],
    [{ action: "set-required", hiddenAnswerPolicy: "clear" }],
    [{ hiddenAnswerPolicy: "clear" }],
    [{ hiddenAnswerPolicy: "keep" }],
  ];

  it("FormLogicKit matches @webforms/form-model", () => {
    for (const rules of RULE_SETS) {
      const policy = hiddenAnswerPolicyOf(rules as never);
      expect([rules, FormLogicKit.hiddenAnswerPolicyOf(rules)]).toEqual([rules, policy]);
      for (const hidden of [true, false]) {
        for (const value of ANSWERS) {
          for (const wasHidden of [false, true, undefined, null]) {
            expect(FormLogicKit.shouldClearHiddenAnswer(policy, hidden, value, wasHidden)).toBe(shouldClearHiddenAnswer(policy, hidden, value, wasHidden));
          }
          expect(FormLogicKit.shouldClearHiddenAnswer(policy, hidden, value)).toBe(shouldClearHiddenAnswer(policy, hidden, value));
          expect(FormLogicKit.shouldDropHiddenAnswer(policy, hidden, value)).toBe(shouldDropHiddenAnswer(policy, hidden, value));
        }
      }
    }
    const data: Record<string, unknown> = { a: "x", b: "", c: false };
    expect(FormLogicKit.clearHiddenAnswers(data, ["a", "b", "c", "d"])).toEqual(["a", "c"]);
    expect(data).toEqual({ b: "" });
  });

  it("dropHiddenAnswers leaves hidden clear answers out of the saved answers, cascading, without mutating", () => {
    const yes = (id: string) => ({ match: "all", conditions: [{ controllerFieldId: id, condition: { type: "boolean-yes" } }] });
    const entries = [
      // detail shows when consent is yes; clear.
      { fieldId: "detail", rules: [{ action: "show", ...yes("consent"), hiddenAnswerPolicy: "clear" }] },
      // more shows when detail is filled; clear (hidden once detail is dropped).
      { fieldId: "more", rules: [{ action: "show", match: "all", conditions: [{ controllerFieldId: "detail", condition: { type: "filled" } }], hiddenAnswerPolicy: "clear" }] },
      // kept: preserve policy.
      { fieldId: "note", rules: [{ action: "show", ...yes("consent") }] },
    ];
    const data = { consent: false, detail: "old", more: "x", note: "n" };
    const saved = FormLogicKit.dropHiddenAnswers(data, entries);
    expect(saved).toEqual({ consent: false, note: "n" });
    expect(data).toEqual({ consent: false, detail: "old", more: "x", note: "n" });
    const shown = { consent: true, detail: "old", more: "x" };
    expect(FormLogicKit.dropHiddenAnswers(shown, entries)).toBe(shown);
  });
});

describe("ConditionalField applies the rule on change, never on load", () => {
  type Data = Record<string, unknown>;
  type Active = [{ field: { data: Data } }, (next: unknown) => void];
  const ActiveData = React.createContext<Active>([{ field: { data: {} } }, () => undefined]);
  const { ConditionalField } = load<{ ConditionalField: React.ComponentType<Record<string, unknown>> }>(
    ["ValueKit", "FormLogicKit", "ConditionalGroup"],
    ["ConditionalField"],
    // Same bare globals as the MOIS runtime.
    { React, Fluent: new Proxy({}, { get: () => () => null }), useActiveData: () => React.useContext(ActiveData), useSourceData: () => ({}), produce }
  );

  function render(policy: "clear" | "preserve", initial: Data) {
    let state: Active[0] = { field: { data: initial } };
    let update: (recipe: (draft: Data) => void) => void = () => undefined;
    const Updater = () => {
      const [, setValue] = React.useContext(ActiveData);
      update = (recipe) => setValue((previous: Active[0]) => produce(previous, (draft: Active[0]) => recipe(draft.field.data)));
      return null;
    };
    const Harness = () => {
      const [value, setValue] = React.useState(state);
      state = value;
      return (
        <ActiveData.Provider value={[value, setValue as (next: unknown) => void]}>
          <Updater />
          <ConditionalField fieldId="detail" mode="controller" controllerFieldId="consent" showWhen="yes" hiddenAnswerPolicy={policy}>
            <span>Detail</span>
          </ConditionalField>
        </ActiveData.Provider>
      );
    };
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<Harness />));
    return {
      data: () => state.field.data,
      set: (recipe: (draft: Data) => void) => act(() => update(recipe)),
      unmount: () => act(() => root.unmount()),
    };
  }

  it("keeps a saved answer on a field that opens hidden, also with the clear policy", () => {
    const harness = render("clear", { consent: false, detail: "old answer" });
    expect(harness.data().detail).toBe("old answer");
    expect(harness.data().consent).toBe(false);
    // Unrelated edits while it stays hidden do not clear it either.
    harness.set((data) => { data.other = "x"; });
    expect(harness.data().detail).toBe("old answer");
    harness.unmount();
  });

  it("clears the answer when the field becomes hidden with the clear policy", () => {
    const harness = render("clear", { consent: true, detail: "answer" });
    harness.set((data) => { data.consent = false; });
    expect(harness.data().detail).toBeUndefined();
    // Shown again and answered, then hidden again: cleared again.
    harness.set((data) => { data.consent = true; data.detail = "again"; });
    expect(harness.data().detail).toBe("again");
    harness.set((data) => { data.consent = false; });
    expect(harness.data().detail).toBeUndefined();
    harness.unmount();
  });

  it("a field that opened hidden and is shown, then hidden again, is cleared", () => {
    const harness = render("clear", { consent: false, detail: "old answer" });
    harness.set((data) => { data.consent = true; });
    expect(harness.data().detail).toBe("old answer");
    harness.set((data) => { data.consent = false; });
    expect(harness.data().detail).toBeUndefined();
    harness.unmount();
  });

  it("keeps it by default", () => {
    const harness = render("preserve", { consent: true, detail: "old answer" });
    harness.set((data) => { data.consent = false; });
    expect(harness.data().detail).toBe("old answer");
    harness.unmount();
  });

  it("keeps the answer while the field is shown", () => {
    const harness = render("clear", { consent: true, detail: "kept" });
    expect(harness.data().detail).toBe("kept");
    harness.unmount();
  });
});
