import { describe, expect, it } from "vitest";
import { defaultFormDesign, type BuilderDocument, type BuilderField, type FieldLinkRule } from "./index";
import { answerListOf, portableAnswerOptions, yesNoAnswerOptions } from "./answer-list";
import { visibilityRuleToFieldLinkConditions } from "./conditions";
import { controllerKindLookupOf, controllerKindOf } from "./controller-kind";
import { analyzeForm, readFieldRules, resolvedFieldOrder, storedFieldRules } from "./resolved-form";
import { inferContiguousFieldSubgroupMap, readFormStructure, structureSectionBlocks } from "./structure";

function field(partial: Partial<BuilderField> & Pick<BuilderField, "id" | "type">): BuilderField {
  return { label: partial.id, ...partial } as BuilderField;
}

function section(id: string, childFieldIds: string[], extra: Partial<NonNullable<BuilderField["sectionConfig"]>> = {}): BuilderField {
  return field({ id, type: "section", sectionConfig: { title: id, childFieldIds, ...extra } });
}

function documentOf(fields: BuilderField[], extra: Partial<BuilderDocument> = {}): BuilderDocument {
  return {
    name: "Resolved",
    fields,
    design: { ...defaultFormDesign },
    identityType: "ATTACHMENT",
    identityCode: "",
    drafts: [],
    branchingRules: {},
    paginationEnabled: false,
    pageCount: 1,
    pageAssignments: {},
    ...extra,
  };
}

describe("controllerKindOf: one controller-kind reading", () => {
  it.each([
    [{ type: "booleanYesNo" }, "boolean"],
    [{ type: "booleanSingle" }, "checkbox"],
    [{ type: "checkbox" }, "checkbox"], // a table column's tick box
    [{ type: "choice" }, "choice"],
    [{ type: "choice", choiceStyle: "checkbox" }, "choice"],
    [{ type: "matrix" }, "choice"],
    [{ type: "number" }, "number"],
    [{ type: "computed" }, "number"],
    [{ type: "scale" }, "number"],
    [{ type: "rating" }, "number"],
    [{ type: "date" }, "date"],
    [{ type: "date", dateConfig: { withTime: true } }, "datetime"],
    [{ type: "datetime" }, "datetime"],
    [{ type: "time" }, "time"],
    [{ type: "text" }, "text"],
    [{ type: "textarea" }, "text"],
    [{ type: "email" }, "text"],
    [{ type: "provider" }, "text"],
    [{ type: "table" }, "table"],
    [{ type: "section" }, undefined],
    [{ type: "heading" }, undefined],
    [{ type: "component" }, undefined],
    // Lowered and parsed fields (lib/mois-export/lower-field.ts) say it with `kind`.
    [{ kind: "boolean", booleanStyle: "yesNo" }, "boolean"],
    [{ kind: "boolean", booleanStyle: "single" }, "checkbox"],
    [{ kind: "boolean" }, "boolean"],
    [{ kind: "choice" }, "choice"],
    [{ kind: "matrix" }, "choice"],
    [{ kind: "number" }, "number"],
    [{ kind: "date" }, "date"],
    [{ kind: "section" }, undefined],
  ] as const)("%j → %s", (input, expected) => {
    expect(controllerKindOf(input)).toBe(expected);
  });

  it("keeps a single checkbox distinct from a Yes/No, so 'is No' also holds while the box is untouched", () => {
    const kinds = controllerKindLookupOf([field({ id: "box", type: "booleanSingle" }), field({ id: "yn", type: "booleanYesNo" })]);
    expect(visibilityRuleToFieldLinkConditions({ type: "equals", controllerId: "box", value: "No" }, kinds)?.condition).toEqual({ type: "boolean-no", emptyIsNo: true });
    expect(visibilityRuleToFieldLinkConditions({ type: "equals", controllerId: "yn", value: "No" }, kinds)?.condition).toEqual({ type: "boolean-no" });
  });

  it("looks up the first field with an id", () => {
    const kinds = controllerKindLookupOf([field({ id: "a", type: "choice" }), field({ id: "a", type: "text" })]);
    expect(kinds("a")).toBe("choice");
    expect(kinds("missing")).toBeUndefined();
  });
});

describe("answerListOf: one reading of the answers a field offers", () => {
  it("reads a Yes/No's labels, or Yes and No", () => {
    expect(answerListOf(field({ id: "a", type: "booleanYesNo" }))).toEqual({ kind: "yesNo", options: ["Yes", "No"], labels: ["Yes", "No"], defaultLabels: true });
    expect(answerListOf(field({ id: "a", type: "booleanYesNo", booleanLabels: { on: "Present", off: "Absent" } }))?.labels).toEqual(["Present", "Absent"]);
    expect(yesNoAnswerOptions({ on: "Si" })).toEqual(["Si", "No"]);
  });

  it("reads a single checkbox as one ticked answer, noting when the author named it", () => {
    expect(answerListOf(field({ id: "a", type: "booleanSingle" }))).toEqual({ kind: "checkbox", options: ["Yes"], labels: ["Yes"], defaultLabels: true });
    expect(answerListOf(field({ id: "a", type: "booleanSingle", booleanLabels: { on: "Consents", off: "" } }))?.defaultLabels).toBe(false);
  });

  it("reads a choice's options, narrowed to a portable answer range unless asked for all", () => {
    const choice = field({ id: "c", type: "choice", options: ["A", { label: "B", value: "b" }, "C"], answerSetPortableRange: { name: "AB", answerLabels: ["B", "A"] } });
    expect(answerListOf(choice)?.labels).toEqual(["B", "A"]);
    expect(portableAnswerOptions(choice)).toEqual([{ label: "B", value: "b" }, "A"]);
    expect(answerListOf(choice, { allOptions: true })?.labels).toEqual(["A", "B", "C"]);
  });

  it("reads a scale's points with the key stored and the number as the score", () => {
    const scale = field({ id: "s", type: "scale", scaleConfig: { options: [{ value: 0, label: "None" }, { value: 1, label: "Some", key: "some" }] } as BuilderField["scaleConfig"] });
    expect(answerListOf(scale)?.options).toEqual([{ label: "None", value: "0", score: 0 }, { label: "Some", value: "some", score: 1 }]);
  });

  it("offers nothing for a field that is not picked from answers", () => {
    expect(answerListOf(field({ id: "t", type: "text" }))).toBeNull();
  });
});

describe("rules from the three stores", () => {
  const fields = [
    field({ id: "box", type: "booleanSingle" }),
    field({ id: "detail", type: "text", visibility: { type: "equals", controllerId: "box", value: "No" } }),
    field({ id: "locked", type: "text", lockWhen: { field: "box", operator: "truthy" } }),
  ];

  it("reads show-when rules and lock conditions as field-link rules, a Logic-tab rule with the same id winning", () => {
    const stored = storedFieldRules(fields);
    expect(stored.map((rule) => rule.id)).toEqual(["field-visibility:detail", "lock-condition:locked"]);
    expect(stored[0].condition).toEqual({ type: "boolean-no", emptyIsNo: true });
    expect(stored[1]).toMatchObject({ action: "set-readonly", protectionMode: "both", conditionGroup: { conditions: [{ controllerFieldId: "box", condition: { type: "boolean-yes" } }] } });
    const replaced: FieldLinkRule = { id: "field-visibility:detail", controllerFieldId: "box", condition: { type: "boolean-yes" }, targetFieldIds: ["detail"], action: "show" };
    expect(storedFieldRules(fields, [replaced]).map((rule) => rule.id)).toEqual(["lock-condition:locked"]);
  });

  it("says what decides whether a field shows: its Logic-tab Show and Hide rules, else its own rule", () => {
    const kinds = controllerKindLookupOf(fields);
    expect(readFieldRules(fields[1], [], kinds)).toMatchObject({ visibilitySource: "field", visibility: [{ id: "field-visibility:detail" }] });
    const hide: FieldLinkRule = { id: "hide", controllerFieldId: "box", condition: { type: "boolean-yes" }, targetFieldIds: ["detail"], action: "hide" };
    const require: FieldLinkRule = { id: "req", controllerFieldId: "box", condition: { type: "boolean-yes" }, targetFieldIds: ["detail"], action: "set-required" };
    const rules = readFieldRules(fields[1], [hide, require], kinds);
    expect(rules.visibilitySource).toBe("logic-tab");
    expect(rules.visibility.map((rule) => rule.id)).toEqual(["hide"]);
    expect(rules.ownVisibility?.id).toBe("field-visibility:detail");
    expect(rules.actions.map((rule) => rule.id)).toEqual(["req"]);
    expect(readFieldRules(fields[2], [], kinds).lock?.id).toBe("lock-condition:locked");
  });
});

describe("structureSectionBlocks and the subgroup gap fill", () => {
  // The adversarial fixture of "Export traversal semantics".
  const fields = [
    field({ id: "orphanTop", type: "text" }),
    section("s1", ["b", "a", "shared"]),
    field({ id: "a", type: "text" }),
    field({ id: "b", type: "text" }),
    field({ id: "shared", type: "text" }),
    section("s2", ["shared", "s3"]),
    section("s3", ["c"]),
    field({ id: "c", type: "text" }),
    section("empty", []),
    field({ id: "orphanTail", type: "text" }),
  ];

  it("lists each section once, pre-order, with the fields it holds directly", () => {
    const blocks = structureSectionBlocks(readFormStructure({ fields }));
    expect(blocks.map((block) => [block.section?.id ?? null, block.parentId, block.fields.map((entry) => entry.id)])).toEqual([
      [null, null, ["orphanTop"]],
      ["s1", null, ["b", "a", "shared"]],
      ["s2", null, []],
      ["s3", "s2", ["c"]],
      ["empty", null, []],
      [null, null, ["orphanTail"]],
    ]);
  });

  it("puts an unassigned field between two members of a subgroup in that subgroup, as MOIS draws it", () => {
    expect(inferContiguousFieldSubgroupMap(["a", "gap", "b", "after"], { a: "g", b: "g" })).toEqual({ a: "g", gap: "g", b: "g" });
    const subgrouped = [
      section("s", ["x", "a", "gap", "b", "y"], { subgroups: [{ id: "g", name: "G" }], fieldSubgroupMap: { a: "g", b: "g" } } as never),
      ...["x", "a", "gap", "b", "y"].map((id) => field({ id, type: "text" })),
    ];
    const [block] = structureSectionBlocks(readFormStructure({ fields: subgrouped }));
    expect(block.fields.map((entry) => entry.id)).toEqual(["x", "a", "gap", "b", "y"]);
  });
});

describe("analyzeForm", () => {
  const fields = [
    section("intro", ["consent", "score", "detail"]),
    field({ id: "consent", type: "booleanYesNo", required: true }),
    field({ id: "score", type: "computed", computedConfig: { expression: "1 + 2" } as BuilderField["computedConfig"] }),
    field({ id: "detail", type: "text", visibility: { type: "equals", controllerId: "consent", value: "Yes" }, defaultAnswer: { kind: "literal", value: "n/a" } as BuilderField["defaultAnswer"] }),
    field({ id: "loose", type: "choice", options: ["A", "B"] }),
  ];
  const rules: FieldLinkRule[] = [];
  const document = documentOf(fields, {
    workflow: { outputs: [{ id: "note", title: "Note", kind: "moisMutation", resource: "encounterNote", mutation: "createEncounterNote", payloadFields: { note: "detail" } }] } as unknown as BuilderDocument["workflow"],
  });

  it("reads every field once, with each neutral reading", () => {
    const resolved = analyzeForm({ document, fieldLinkRules: rules });
    expect([...resolved.fields.keys()]).toEqual(["intro", "consent", "score", "detail", "loose"]);
    const consent = resolved.field("consent")!;
    expect(consent).toMatchObject({ role: "answer", answerType: "yesNo", controllerKind: "boolean", answerList: { kind: "yesNo" } });
    expect(consent.validation.required).toBe(true);
    expect(consent.placement).toEqual({ page: 0, sectionId: "intro", subgroupId: null });
    expect(resolved.field("loose")!.placement?.sectionId).toBeNull();
    expect(resolved.field("score")!.formula).not.toBeNull();
    expect(resolved.field("detail")!.defaultAnswer).toMatchObject({ kind: "literal" });
    expect(resolved.field("detail")!.rules.visibilitySource).toBe("field");
    expect(resolved.storedRules.map((rule) => rule.id)).toEqual(["field-visibility:detail"]);
    expect(resolved.submitActions.map((action) => action.kind)).toEqual(["note"]);
    expect(resolvedFieldOrder(resolved).map((entry) => entry.id)).toEqual(["consent", "score", "detail", "loose"]);
  });

  it("is cached by the document, the rule list and the context", () => {
    const first = analyzeForm({ document, fieldLinkRules: rules });
    expect(analyzeForm({ document, fieldLinkRules: rules })).toBe(first);
    expect(analyzeForm({ document, fieldLinkRules: [] })).not.toBe(first);
    expect(analyzeForm({ document: { ...document }, fieldLinkRules: rules })).not.toBe(first);
  });

  it("never changes the document", () => {
    const before = JSON.stringify(document);
    const resolved = analyzeForm({ document });
    void [resolved.structure, resolved.rules, resolved.submitActions, resolved.lifecycle, resolved.translations, ...[...resolved.fields.values()].map((entry) => [entry.validation, entry.binding, entry.optionRules, entry.formula])];
    expect(JSON.stringify(document)).toBe(before);
  });
});
