import { describe, expect, it } from "vitest";
import type { BuilderField } from "./index";
import { isQuestionMatrixTable, readQuestionMatrix } from "./matrix";
import { readFormStructure, structureGroups } from "./structure";

const table = (extra: Partial<NonNullable<BuilderField["tableConfig"]>> = {}, cerner?: BuilderField["cernerConfig"]): BuilderField => ({
  id: "grid",
  label: "Grid",
  type: "table",
  tableConfig: {
    initialRows: 1,
    maxRows: 1,
    allowAddRows: false,
    allowRemoveRows: false,
    columns: [
      { id: "a", label: "Pain", type: "choice", options: ["None", "Mild"] },
      { id: "b", label: "Nausea", type: "choice", options: ["None", { label: "Mild", score: 1 }], choiceStyle: "checkbox" },
      { id: "c", label: "Seen", type: "booleanYesNo" },
    ],
    ...extra,
  },
  ...(cerner ? { cernerConfig: cerner } : {}),
});

describe("readQuestionMatrix", () => {
  it("reads a Matrix field's non-blank rows over its shared columns", () => {
    const matrix = readQuestionMatrix({ id: "m", label: "M", type: "matrix", matrixConfig: { rows: ["One", " ", "Two"], columns: ["Yes", "No"], multiplePerRow: true } });
    expect(matrix).toMatchObject({ source: "matrix-field", answers: ["Yes", "No"], shared: true });
    expect(matrix?.rows.map((row) => [row.id, row.label, row.multiple])).toEqual([["m__matrix_q1", "One", true], ["m__matrix_q2", "Two", true]]);
  });

  it("reads a matrix table's columns as rows, each with its own answers", () => {
    const matrix = readQuestionMatrix(table({ presentation: "matrix" }))!;
    expect(matrix.rows.map((row) => [row.id, row.kind, row.answers, row.multiple])).toEqual([
      ["grid::tableColumn::a", "choice", ["None", "Mild"], false],
      ["grid::tableColumn::b", "choice", ["None", "Mild"], true],
      ["grid::tableColumn::c", "boolean", ["Yes", "No"], false],
    ]);
    expect(matrix.answers).toEqual(["None", "Mild", "Yes", "No"]);
    expect(matrix.shared).toBe(false);
  });

  it("reads a Discrete Grid imported before the presentation was stored, and nothing else", () => {
    const discrete = { version: 1, sourceKind: "powerform", formName: "", sectionName: "", inputType: 14, inputRefSeq: 0, preferences: {}, importStatus: "exact", grid: { family: "discrete", view: "detail" } } as NonNullable<BuilderField["cernerConfig"]>;
    expect(isQuestionMatrixTable(table({}, discrete))).toBe(true);
    expect(isQuestionMatrixTable(table())).toBe(false);
    expect(readQuestionMatrix(table())).toBeNull();
    expect(readQuestionMatrix({ id: "t", label: "T", type: "text" })).toBeNull();
  });

  it("gives the structure reader a matrix group that does not repeat", () => {
    const [group] = structureGroups(readFormStructure({ fields: [table({ presentation: "matrix" })] }));
    expect(group.presentation).toBe("matrix");
    expect(group.repeat).toBeUndefined();
    expect(group.members.map((member) => member.storedId)).toEqual(["a", "b", "c"]);
  });

  it("names an UltraGrid's fixed rows by its second DTA axis", () => {
    const ultra = { version: 1, sourceKind: "powerform", formName: "", sectionName: "", inputType: 19, inputRefSeq: 0, preferences: {}, importStatus: "exact", grid: { family: "ultra", view: "grid", rows: [{ id: "r1", label: "Left" }, { id: "r2", label: "Right" }] } } as NonNullable<BuilderField["cernerConfig"]>;
    const [group] = structureGroups(readFormStructure({ fields: [table({ initialRows: 2, maxRows: 2 }, ultra)] }));
    expect(group.presentation).toBe("fixed-grid");
    expect(group.rowLabels).toEqual(["Left", "Right"]);
  });
});
