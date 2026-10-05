import { describe, expect, it } from "vitest";
import type { BuilderField } from "./index";
import type { ModuleConfig } from "./layout";
import { storedTableConfig, withSubformDataEntry } from "./field-group";
import {
  findStructureGroup,
  readFormStructure,
  repeatingStructureGroups,
  structureGroups,
  structureSectionOf,
  structureTableColumnId,
  walkStructure,
  type NeutralStructure,
  type StructureNode,
} from "./structure";

function field(partial: Partial<BuilderField> & Pick<BuilderField, "id" | "type">): BuilderField {
  return { label: partial.id, ...partial } as BuilderField;
}

function section(id: string, childFieldIds: string[], extra: Partial<NonNullable<BuilderField["sectionConfig"]>> = {}): BuilderField {
  return field({ id, type: "section", label: id.toUpperCase(), sectionConfig: { title: id.toUpperCase(), childFieldIds, ...extra } });
}

/** A readable outline: `section(child, subgroup[child], group{members})`. */
function outline(nodes: readonly StructureNode[]): string[] {
  return nodes.map((node) => {
    if (node.kind === "field") return node.id;
    if (node.kind === "group") return `${node.id}{${node.presentation}}`;
    if (node.kind === "subgroup") return `[${node.id}: ${outline(node.children).join(", ")}]`;
    return `${node.id ?? "(loose)"}(${outline(node.children).join(", ")})`;
  });
}

function pageOutline(structure: NeutralStructure): string[][] {
  return structure.pages.map((page) => outline(page.sections));
}

describe("readFormStructure: pages, sections and the canonical walk", () => {
  it("keeps childFieldIds order, places each field once and gathers loose fields into unnamed sections", () => {
    // The export-traversal adversarial fixture (docs: Export traversal semantics).
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
    const structure = readFormStructure({ fields });
    expect(pageOutline(structure)).toEqual([
      ["(loose)(orphanTop)", "s1(b, a, shared)", "s2(s3(c))", "empty()", "(loose)(orphanTail)"],
    ]);
  });

  it("walks a nested section where it is reached, so it keeps what it claims first", () => {
    const fields = [section("outer", ["inner", "x"]), section("inner", ["x"]), field({ id: "x", type: "text" })];
    expect(pageOutline(readFormStructure({ fields }))).toEqual([["outer(inner(x))"]]);
  });

  it("puts sections on their assigned pages when pagination is on", () => {
    const fields = [section("one", ["q1"]), field({ id: "q1", type: "text" }), section("two", ["q2"]), field({ id: "q2", type: "text" })];
    const paged = readFormStructure({
      fields,
      paginationEnabled: true,
      pageCount: 3,
      pageNames: ["Start", "Middle"],
      pageAssignments: { "builder-section-two": 2 },
    });
    expect(paged.pages.map((page) => [page.name, outline(page.sections)])).toEqual([
      ["Start", ["one(q1)"]],
      ["Middle", ["two(q2)"]],
      [null, []],
    ]);
    // Pagination off (or an investigation form): one page.
    expect(readFormStructure({ fields, paginationEnabled: false, pageCount: 3 }).pages).toHaveLength(1);
    expect(readFormStructure({ fields, paginationEnabled: true, pageCount: 3, formPresentation: "investigation" }).pages).toHaveLength(1);
  });

  it("puts the fields of a form without sections on the page of its one group", () => {
    const fields = [field({ id: "q1", type: "text" })];
    const structure = readFormStructure({ fields, paginationEnabled: true, pageCount: 2, pageAssignments: { "builder-preview": 2 } });
    expect(pageOutline(structure)).toEqual([[], ["(loose)(q1)"]]);
  });
});

describe("readFormStructure: subgroups and item order", () => {
  it("nests subgroups where their first member is, from the section's own subgroups", () => {
    const fields = [
      section("s", ["a", "b", "c", "d"], {
        subgroups: [
          { id: "g1", name: "G1" },
          { id: "g2", name: "G2", parentId: "g1" },
        ],
        fieldSubgroupMap: { b: "g1", c: "g2" },
      }),
      ...["a", "b", "c", "d"].map((id) => field({ id, type: "text" })),
    ];
    expect(pageOutline(readFormStructure({ fields }))).toEqual([["s(a, [g1: b, [g2: c]], d)"]]);
  });

  it("falls back to the section draft's subgroups and honours a stored item order", () => {
    const fields = [section("s", ["a", "b"]), field({ id: "a", type: "text" }), field({ id: "b", type: "text" })];
    const drafts = [
      {
        key: "builder-section-s",
        subgroups: [{ id: "g", name: "G", parentId: null, layoutType: "grid" }],
        fieldOverrides: { a: { subgroupId: "g" } },
        moduleConfig: { enabled: false, title: "", context: "", itemOrder: ["field:b"] },
      },
    ];
    const structure = readFormStructure({ fields, drafts });
    expect(pageOutline(structure)).toEqual([["s(b, [g: a])"]]);
    const subgroup = structure.pages[0].sections[0].children[1];
    expect(subgroup).toMatchObject({ kind: "subgroup", name: "G", layout: "grid" });
  });
});

describe("readFormStructure: tables", () => {
  const allergy = field({
    id: "allergies",
    type: "table",
    label: "Allergies",
    tableConfig: storedTableConfig({
      mode: "modal",
      maxRows: 10,
      initialRows: 1,
      allowRemoveRows: true,
      columns: [
        { id: "allergen", label: "Allergen", type: "text", required: true },
        {
          id: "reactions",
          label: "Reactions",
          type: "choice",
          choiceStyle: "multiselect",
          options: [{ label: "Other", value: "other" }],
          choiceBooleanTargets: { other: "reaction_other" },
          showInTable: false,
        },
        { id: "reaction_other", label: "Other reaction", type: "checkbox", showInTable: false, showInModal: false },
        { id: "summary", label: "Summary", type: "text", computedValue: { mode: "template", template: "{allergen}" } },
        { id: "initials", label: "Initials", type: "stampButton" },
      ],
    }),
  });

  it("reads a modal table as a repeating row-dialog group with its columns as members", () => {
    const structure = readFormStructure({ fields: [allergy] });
    const [group] = structureGroups(structure);
    expect(group).toMatchObject({
      id: "allergies",
      label: "Allergies",
      presentation: "row-dialog",
      repeat: { max: 10, addable: true, removable: true, initial: 1 },
      source: { kind: "table", fieldId: "allergies" },
    });
    expect(group.members.map((member) => [member.storedId, member.role, member.shown])).toEqual([
      ["allergen", "answer", true],
      ["reactions", "answer", true],
      ["reaction_other", "answer", false],
      ["summary", "computed", true],
      ["initials", "action", true],
    ]);
    expect(group.members[0].id).toBe(structureTableColumnId("allergies", "allergen"));
    expect(group.members[0].field).toMatchObject({ type: "text", required: true, label: "Allergen" });
    // The hidden checkbox mirrors the choice's "other" option.
    expect(group.members[2].mirrors).toEqual({ memberId: structureTableColumnId("allergies", "reactions"), option: "other" });
  });

  it("uses the context's column adapter when it has one", () => {
    const structure = readFormStructure(
      { fields: [allergy] },
      { projectTableColumn: (table, column) => ({ id: `${table.id}/${column.id}`, label: `adapted ${column.label}`, type: "text" }) }
    );
    expect(structureGroups(structure)[0].members[0].field.label).toBe("adapted Allergen");
  });

  it("follows the runtime's row defaults: 10 rows unless null or 0, fixed rows as a fixed grid", () => {
    const table = (tableConfig: Partial<NonNullable<BuilderField["tableConfig"]>>) =>
      field({ id: "t", type: "table", tableConfig: storedTableConfig({ columns: [{ id: "c", label: "C", type: "text" }], ...tableConfig }) });
    const read = (tableConfig: Partial<NonNullable<BuilderField["tableConfig"]>>) => structureGroups(readFormStructure({ fields: [table(tableConfig)] }))[0];
    expect(read({})).toMatchObject({ presentation: "inline-table", repeat: { max: 10, addable: true, removable: false, initial: 1 } });
    expect(read({ maxRows: null }).repeat).toEqual({ addable: true, removable: false, initial: 1 });
    expect(read({ maxRows: 0 }).repeat?.max).toBeUndefined();
    expect(read({ allowAddRows: false, initialRows: 3 })).toMatchObject({
      presentation: "fixed-grid",
      repeat: { max: 3, addable: false, removable: false, initial: 3 },
    });
    expect(read({ allowAddRows: false, maxRows: 1, initialRows: 1 }).repeat?.max).toBe(1);
  });

  it("reads a follow-up table's link to the table it follows", () => {
    const fields = [
      field({ id: "meds", type: "table", tableConfig: storedTableConfig({ maxRows: 6, columns: [{ id: "name", label: "Name", type: "text" }] }) }),
      field({
        id: "adherence",
        type: "table",
        tableConfig: storedTableConfig({
          columns: [{ id: "taking", label: "Taking", type: "booleanYesNo" }],
          repeatFor: { sourceFieldId: "meds", labelColumnId: "name", labelTitle: "Medication", presentation: "cards" },
        }),
      }),
    ];
    const group = findStructureGroup(readFormStructure({ fields }), "adherence");
    expect(group).toMatchObject({
      presentation: "cards",
      repeat: { max: 6, addable: false, removable: false },
      repeatFor: {
        sourceGroupId: "meds",
        keyMemberId: null,
        labelMemberId: "name",
        labelTitle: "Medication",
        filtered: false,
        orphanPolicy: "remove-if-unanswered",
        allowManualRows: false,
      },
    });
    expect(group?.repeat?.initial).toBeUndefined();
  });
});

describe("readFormStructure: layout tables, subforms and repeating sections", () => {
  it("reads a layout table as a fixed grid of its answer cells", () => {
    const layout = field({
      id: "grid",
      type: "layoutTable",
      layoutTableConfig: {
        rows: [
          {
            id: "r1",
            cells: [
              { id: "h", kind: "text", text: "Heading" },
              { id: "c1", kind: "field", fieldId: "grid_a", label: "A", inputType: "number" },
              { id: "c2", kind: "fieldList", fields: [{ fieldId: "grid_b", label: "B", inputType: "booleanYesNo" }] },
              { id: "c3", kind: "computed", fieldId: "grid_total", formula: "grid_a" },
            ],
          },
        ],
      },
    });
    const [group] = structureGroups(readFormStructure({ fields: [layout] }));
    expect(group).toMatchObject({ presentation: "fixed-grid", source: { kind: "layoutTable", fieldId: "grid" } });
    expect(group.repeat).toBeUndefined();
    expect(group.members.map((member) => [member.id, member.storedId, member.role, member.field.type])).toEqual([
      ["grid_a", "c1", "answer", "number"],
      ["grid_b", "c2/grid_b", "answer", "booleanYesNo"],
      ["grid_total", "c3", "computed", "computed"],
    ]);
  });

  const scoring: ModuleConfig = {
    enabled: true,
    title: "Exam",
    context: "",
    kind: "subform-scoring",
    subformScoring: { replaceFields: true },
    scoring: {
      questions: [
        { id: "q1", label: "Q1", fieldId: "exam_q1", childFieldIds: ["exam_q1"], valueByFieldId: {} },
        { id: "q2", label: "Q2", fieldId: "owned_q2", childFieldIds: [], valueByFieldId: {}, options: [{ id: "y", label: "Yes", score: 1, state: "Y" }] },
      ],
      totals: [{ id: "t", label: "Total", targetFieldId: "exam_total", terms: [], ranges: [] }],
      pdfSnippets: [],
    },
  };
  const dataEntry: ModuleConfig = {
    enabled: true,
    title: "Vitals",
    context: "",
    kind: "subform-data-entry",
    subformDataEntry: withSubformDataEntry({
      fields: [
        { id: "v_head", label: "Seated", type: "heading" },
        { id: "v_sys", label: "Systolic", type: "number", hidden: true },
      ],
      calculations: [{ id: "v_calc", label: "Calc", expression: "v_sys" }],
    }),
  };

  it("reads section subform modules as modal-subform groups, first in their section", () => {
    const fields = [section("exam", ["exam_q1", "note"]), field({ id: "exam_q1", type: "choice" }), field({ id: "note", type: "text" })];
    const drafts = [{ key: "builder-section-exam", moduleConfig: { ...scoring, additionalSubformModules: [dataEntry] } }];
    const structure = readFormStructure({ fields, drafts });
    // The replacing scoring module asks exam_q1, so it lives in the group, not the section.
    expect(pageOutline(structure)).toEqual([["exam(exam{modal-subform}, exam#2{modal-subform}, note)"]]);
    const [exam, vitals] = structureGroups(structure);
    expect(exam.source).toEqual({ kind: "subformModule", sectionId: "exam", draftIndex: 0, moduleIndex: 0, moduleKind: "subform-scoring" });
    expect(exam.members.map((member) => [member.id, member.role, member.documentField])).toEqual([
      ["exam_q1", "answer", true],
      ["owned_q2", "answer", false],
      ["exam_total", "computed", false],
    ]);
    expect(exam.members[1].field).toMatchObject({ type: "choice", options: [{ label: "Yes", value: "Y", score: 1 }] });
    expect(vitals.members.map((member) => [member.id, member.role, member.shown])).toEqual([
      ["v_head", "display", true],
      ["v_sys", "answer", false],
      ["v_calc", "computed", true],
    ]);
    expect(structureSectionOf(structure, "exam#2")?.id).toBe("exam");
  });

  it("reads a SubformScoring component as a modal-subform group of its own entries", () => {
    const component = field({
      id: "phq",
      type: "component",
      componentKey: "SubformScoring",
      componentTitle: "PHQ-2",
      componentProps: { dataEntryConfig: { fields: [{ id: "phq_q1", label: "Interest", type: "choice" }], calculations: [] } },
    });
    const [group] = structureGroups(readFormStructure({ fields: [component] }));
    expect(group).toMatchObject({ id: "phq", label: "PHQ-2", presentation: "modal-subform", source: { kind: "component", componentKey: "SubformScoring" } });
    expect(group.members.map((member) => member.id)).toEqual(["phq_q1"]);
  });

  it("reads a section filled from a MOIS collection as a repeating section group", () => {
    const fields = [section("visits", ["when"], { autoFillMode: "collection", autoFillCollectionId: "visits" }), field({ id: "when", type: "date" })];
    const structure = readFormStructure({ fields });
    expect(repeatingStructureGroups(structure)).toEqual([
      expect.objectContaining({
        id: "visits",
        presentation: "section",
        repeat: { addable: false, removable: false },
        source: { kind: "section", sectionId: "visits", collectionId: "visits" },
      }),
    ]);
    expect(structureGroups(structure)[0].members.map((member) => member.id)).toEqual(["when"]);
  });

  it("never changes the document", () => {
    const fields = [section("s", ["t"]), field({ id: "t", type: "table", tableConfig: storedTableConfig({ columns: [{ id: "c", label: "C", type: "text" }] }) })];
    const drafts = [{ key: "builder-section-s", moduleConfig: dataEntry }];
    const before = structuredClone({ fields, drafts });
    readFormStructure({ fields, drafts });
    expect({ fields, drafts }).toEqual(before);
    let visited = 0;
    walkStructure(readFormStructure({ fields, drafts }), () => (visited += 1));
    expect(visited).toBe(3);
  });
});
