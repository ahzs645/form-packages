import type { BuilderField } from "./index";
import { getOptionLabel } from "./choice-options";
import { tableColumnsOf } from "./field-group";

/**
 * A question matrix, read as neutral intent (neutral form model, "Structure
 * and repetition"): several questions asked once, each drawn as a row with
 * its answers across. A PowerChart Discrete Grid, the builder's Matrix field,
 * a FHIR answer table (itemControl `table`).
 *
 * Two stored shapes read as one:
 *
 * - a `matrix` field: each `matrixConfig.rows` entry is a question and every
 *   question takes the `matrixConfig.columns` answers (several when
 *   `multiplePerRow`). Its rows answer to `<id>__matrix_q<n>`, numbered over
 *   the non-blank rows, as the MOIS export writes them.
 * - a table in matrix presentation (`tableConfig.presentation === "matrix"`;
 *   a table imported as a Cerner Discrete Grid before that setting existed
 *   reads the same through `cernerConfig.grid.family === "discrete"`): each
 *   column is one question, with its own answers and answer type, and the
 *   table holds exactly one row of answers.
 *
 * A row's answers may differ from the others' (58 of the 444 Discrete Grids in
 * the T1978A Large Pull): `answers` is every row's answers in first-seen
 * order (the headings across), and each row keeps its own list, so a
 * converter can tell which headings a row offers.
 */

export type QuestionMatrixRowKind = "choice" | "boolean" | "text" | "number" | "date" | "time";

export interface QuestionMatrixRow {
  /** The row's member id: a column's `<tableId>::tableColumn::<columnId>`, or a matrix field's `<id>__matrix_q<n>`. */
  id: string;
  /** Its id in the stored shape: the column id, or the matrix row's index (0-based, as a string). */
  storedId: string;
  label: string;
  kind: QuestionMatrixRowKind;
  /** The answers the row offers, for a choice or yes/no row; empty otherwise. */
  answers: string[];
  /** The row takes several answers. */
  multiple: boolean;
}

export interface QuestionMatrix {
  fieldId: string;
  label: string;
  source: "matrix-field" | "table";
  /** The headings across: every row's answers, in first-seen order. */
  answers: string[];
  rows: QuestionMatrixRow[];
  /** Every row is a single- or multi-answer choice over exactly `answers`: a plain answer grid. */
  shared: boolean;
}

/** Table columns' member ids, as packages/form-model/src/structure.ts builds them. */
const TABLE_COLUMN_FIELD_MARKER = "::tableColumn::";

/** A table's columns are questions asked once, drawn as rows (see `readQuestionMatrix`). */
export function isQuestionMatrixTable(field: Pick<BuilderField, "type" | "tableConfig" | "cernerConfig">): boolean {
  if (field.type !== "table" || !field.tableConfig) return false;
  if (field.tableConfig.presentation === "matrix") return true;
  // Legacy read: a Discrete Grid imported before `presentation` was stored.
  return field.tableConfig.presentation === undefined && field.cernerConfig?.grid?.family === "discrete";
}

/** The id a `matrix` field's row answers to (renderQuestionnaireMatrixField). */
export function matrixFieldRowId(fieldId: string, index: number): string {
  return `${fieldId}__matrix_q${index + 1}`;
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
}

/** The field read as a question matrix, or null when it is not one. */
export function readQuestionMatrix(field: BuilderField): QuestionMatrix | null {
  const label = field.label?.trim() || field.id;
  if (field.type === "matrix") {
    const clean = (values: string[] | undefined) => (values ?? []).map((value) => String(value ?? "").trim()).filter(Boolean);
    const answers = uniqueInOrder(clean(field.matrixConfig?.columns));
    const multiple = field.matrixConfig?.multiplePerRow === true;
    const rows = clean(field.matrixConfig?.rows).map((row, index): QuestionMatrixRow => ({
      id: matrixFieldRowId(field.id, index),
      storedId: String(index),
      label: row,
      kind: "choice",
      answers,
      multiple,
    }));
    return { fieldId: field.id, label, source: "matrix-field", answers, rows, shared: true };
  }
  if (!isQuestionMatrixTable(field)) return null;
  const rows = tableColumnsOf(field.tableConfig).map((column): QuestionMatrixRow => {
    const base = { id: `${field.id}${TABLE_COLUMN_FIELD_MARKER}${column.id}`, storedId: column.id, label: column.label?.trim() || column.id };
    if (column.type === "choice") {
      const multiple = column.choiceStyle === "checkbox" || column.choiceStyle === "multiselect";
      return { ...base, kind: "choice", answers: uniqueInOrder((column.options ?? []).map((option) => getOptionLabel(option)).filter(Boolean)), multiple };
    }
    if (column.type === "booleanYesNo") return { ...base, kind: "boolean", answers: [column.booleanLabels?.on ?? "Yes", column.booleanLabels?.off ?? "No"], multiple: false };
    if (column.type === "checkbox") return { ...base, kind: "boolean", answers: [column.booleanLabels?.on ?? "Yes"], multiple: false };
    const kind: QuestionMatrixRowKind = column.type === "number" ? "number" : column.type === "date" ? "date" : column.type === "time" ? "time" : "text";
    return { ...base, kind, answers: [], multiple: false };
  });
  const answers = uniqueInOrder(rows.flatMap((row) => row.answers));
  const shared = rows.length > 0 && rows.every((row) => row.kind === "choice" && row.answers.length === answers.length && row.answers.every((answer, index) => answers[index] === answer));
  return { fieldId: field.id, label, source: "table", answers, rows, shared };
}
