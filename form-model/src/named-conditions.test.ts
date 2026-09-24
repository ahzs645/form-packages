import { describe, expect, it } from "vitest";
import {
  collectDirectConditionRefs,
  createConditionRefGroup,
  evaluateConditionGroupWithLibrary,
  findNamedConditionCycles,
  materializeConditionRefs,
  type BuilderNamedCondition,
  type FieldConditionGroup,
} from "./index";
import { BuilderDocumentSchema, FieldConditionGroupSchema, FieldLinkRuleSchema } from "./schemas";

const leaf = (controllerFieldId: string, type: "filled" | "empty" | "boolean-yes" = "filled") => ({
  controllerFieldId,
  condition: { type },
});

const named = (id: string, group: FieldConditionGroup, name = id.toUpperCase()): BuilderNamedCondition => ({ id, name, group });

describe("named condition references", () => {
  const female = named("cond_f", { match: "all", conditions: [{ controllerFieldId: "sex", condition: { type: "choice-selected", optionValues: ["F"] } }] });
  const adult = named("cond_a", { match: "all", conditions: [{ controllerFieldId: "age", condition: { type: "number-gte", value: 12 } }] });
  const pregnancyPossible = named("cond_p", {
    match: "all",
    conditions: [createConditionRefGroup(female), createConditionRefGroup(adult)],
  });

  it("refreshes a stale copy, keeping the ref id", () => {
    const stale: FieldConditionGroup = { match: "any", conditionRef: "cond_f", conditions: [leaf("old")] };
    const result = materializeConditionRefs(stale, [female]);
    expect(result.changed).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.group).toEqual({ ...female.group, conditionRef: "cond_f" });
  });

  it("returns the same object when every copy is current", () => {
    const group: FieldConditionGroup = { match: "all", conditions: [leaf("x"), createConditionRefGroup(female)] };
    const result = materializeConditionRefs(group, [female]);
    expect(result.group).toBe(group);
    expect(result.changed).toBe(false);
  });

  it("materializes nested refs inside a definition", () => {
    const staleInner = named("cond_p", { match: "all", conditions: [{ match: "all", conditionRef: "cond_f", conditions: [leaf("old")] }, createConditionRefGroup(adult)] });
    const ref = createConditionRefGroup(staleInner);
    const result = materializeConditionRefs(ref, [female, adult, staleInner]);
    expect(result.issues).toEqual([]);
    expect(result.group.conditions[0]).toEqual({ ...female.group, conditionRef: "cond_f" });
    expect(result.group.conditionRef).toBe("cond_p");
  });

  it("keeps the stale copy for a missing ref and reports it", () => {
    const stale: FieldConditionGroup = { match: "all", conditions: [{ match: "all", conditionRef: "gone", conditions: [leaf("kept")] }] };
    const result = materializeConditionRefs(stale, [female]);
    expect(result.group).toBe(stale);
    expect(result.issues).toEqual([{ kind: "missing", ref: "gone", path: ["gone"] }]);
  });

  it("never follows cycles and keeps the cached copy", () => {
    const a = named("a", { match: "all", conditions: [leaf("x"), { match: "all", conditionRef: "b", conditions: [leaf("cached-b")] }] });
    const b = named("b", { match: "all", conditions: [{ match: "all", conditionRef: "a", conditions: [leaf("cached-a")] }] });
    const ref: FieldConditionGroup = { match: "all", conditionRef: "a", conditions: [leaf("cached-top")] };
    const result = materializeConditionRefs(ref, [a, b]);
    expect(result.group).toBe(ref);
    expect(result.issues.some((issue) => issue.kind === "cycle" && issue.path.join(">") === "a>b>a")).toBe(true);
    expect(findNamedConditionCycles([a, b])).toEqual([["a", "b", "a"]]);
    const self = named("s", { match: "all", conditions: [{ match: "all", conditionRef: "s", conditions: [leaf("x")] }] });
    expect(findNamedConditionCycles([self])).toEqual([["s", "s"]]);
    expect(findNamedConditionCycles([female, adult, pregnancyPossible])).toEqual([]);
  });

  it("reports depth and empty definitions without emptying the group", () => {
    const chain = Array.from({ length: 5 }, (_, index) =>
      named(`c${index}`, index === 4
        ? { match: "all", conditions: [leaf("end")] }
        : { match: "all", conditions: [{ match: "all", conditionRef: `c${index + 1}`, conditions: [leaf("stale")] }] }),
    );
    const deep = materializeConditionRefs(createConditionRefGroup(chain[0]), chain, { maxDepth: 3 });
    expect(deep.issues.map((issue) => issue.kind)).toEqual(["depth"]);
    const empty = named("e", { match: "all", conditions: [] });
    const stale: FieldConditionGroup = { match: "all", conditionRef: "e", conditions: [leaf("kept")] };
    const result = materializeConditionRefs(stale, [empty]);
    expect(result.group).toBe(stale);
    expect(result.issues).toEqual([{ kind: "empty", ref: "e", path: ["e"] }]);
  });

  it("collects direct refs without descending into copies", () => {
    expect(collectDirectConditionRefs(pregnancyPossible.group)).toEqual(["cond_f", "cond_a"]);
    expect(collectDirectConditionRefs(createConditionRefGroup(pregnancyPossible))).toEqual(["cond_p"]);
  });

  it("evaluates with the library (fresh definition wins over a stale copy)", () => {
    const stale: FieldConditionGroup = { match: "all", conditionRef: "cond_p", conditions: [leaf("never")] };
    const library = [female, adult, pregnancyPossible];
    expect(evaluateConditionGroupWithLibrary(stale, library, () => undefined, { sex: "F", age: 30 })).toBe(true);
    expect(evaluateConditionGroupWithLibrary(stale, library, () => undefined, { sex: "F", age: 8 })).toBe(false);
    expect(evaluateConditionGroupWithLibrary(stale, library, () => undefined, { sex: "M", age: 30 })).toBe(false);
  });

  it("round-trips refs through the zod schemas", () => {
    const ref = materializeConditionRefs(createConditionRefGroup(pregnancyPossible), [female, adult, pregnancyPossible]).group;
    expect(FieldConditionGroupSchema.parse(ref)).toEqual(ref);
    const rule = { id: "r", controllerFieldId: "sex", condition: { type: "filled" }, targetFieldIds: ["t"], action: "show", conditionGroup: ref };
    expect(FieldLinkRuleSchema.parse(rule).conditionGroup).toEqual(ref);
    const document = {
      name: "Doc", fields: [], design: {}, identityType: "TESTFORM", identityCode: "", drafts: [], branchingRules: {},
      paginationEnabled: false, pageCount: 1, pageAssignments: {},
      conditions: [female, adult, pregnancyPossible, named("draft", { match: "all", conditions: [] })],
    };
    expect(BuilderDocumentSchema.parse(document).conditions).toEqual(document.conditions);
  });
});
