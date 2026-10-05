import type {
  BuilderDocument,
  BuilderField,
  BuilderLayoutTableCell,
  BuilderLayoutTableCellField,
  BuilderRepeatOrphanPolicy,
  BuilderTableColumn,
  BuilderVisibilityRule,
} from "./index";
import type {
  ModuleConfig,
  SubformDataEntryCalculationConfig,
  SubformDataEntryConfig,
  SubformDataEntryFieldConfig,
} from "./layout";
import {
  LAYOUT_CELL_INPUT_TYPE_TO_FIELD_TYPE,
  SUBFORM_ENTRY_TYPE_TO_FIELD_TYPE,
  TABLE_COLUMN_TYPE_TO_FIELD_TYPE,
} from "./field-types";
import { isQuestionMatrixTable } from "./matrix";
import { subformDataEntryOf, tableColumnsOf, withSubformDataEntry } from "./field-group";

/**
 * Structure and repetition, read as neutral intent (neutral form model,
 * contract S1; docs/.../proposals/neutral-form-model.md, "Structure and
 * repetition").
 *
 * A form is pages → sections → subgroups → items, and an item is a field or a
 * **group**: a set of member fields held by one container, that may repeat.
 * Today each container stores its fields its own way (a table's columns, a
 * layout table's cells, a subform module in a section draft, a subform
 * component's props, a follow-up table's `repeatFor`). `readFormStructure`
 * reads all of them into one tree without changing how anything is stored,
 * so a converter can decide what a target does with "a repeating group shown
 * as a row dialog" instead of with each container's shape.
 *
 * The walk is the canonical one (`lib/field-traversal.ts`, "Export traversal
 * semantics"): a section's `childFieldIds` decide membership and order, a
 * field no section claims stays at the top level in array order, and each
 * field is placed once. This module cannot import the app, so the member
 * projections come from `context` (the regular adapters, wired in
 * `lib/form-structure.ts`); without them each member is a minimal field
 * built from the neutral type maps, with the same ids.
 */

/** How a group is drawn in the authoring runtime (MOIS). */
export const STRUCTURE_GROUP_PRESENTATIONS = [
  "inline-table",
  "row-dialog",
  "cards",
  "fixed-grid",
  "matrix",
  "modal-subform",
  "section",
] as const;
export type StructureGroupPresentation = (typeof STRUCTURE_GROUP_PRESENTATIONS)[number];

/**
 * How a group repeats. Tables follow the EditableTable runtime's defaults: a
 * stored `maxRows` of null or 0 means no limit, an absent one 10 rows; rows
 * can be added unless `allowAddRows` is false and removed only when
 * `allowRemoveRows` is true; a new form starts with `initialRows` (default 1),
 * which is also the most a table holds when rows can't be added. A follow-up
 * table has as many rows as the table it follows allows.
 */
export interface StructureRepeat {
  /** Fewest rows a submitted form must hold. Absent: none (no container requires a row today). */
  min?: number;
  /** Most rows. Absent: no limit. */
  max?: number;
  addable: boolean;
  removable: boolean;
  /** Rows a new form starts with. Absent when rows come from another group (repeat for each). */
  initial?: number;
}

/** A follow-up group whose rows are seeded from another group's rows ("repeat for each"). */
export interface StructureRepeatFor {
  /** The group whose rows seed this one (its table field id). */
  sourceGroupId: string;
  /** Source column (stored id) giving row identity; null: the source row id. */
  keyMemberId: string | null;
  /** Source column (stored id) shown as the read-only row label. */
  labelMemberId: string | null;
  labelTitle: string | null;
  /** Only some source rows are followed up (a condition over the source row). */
  filtered: boolean;
  orphanPolicy: BuilderRepeatOrphanPolicy;
  /** Rows can also be added by hand. */
  allowManualRows: boolean;
}

export type SubformModuleKind = "subform-scoring" | "subform-data-entry" | "subform-calculator";

/** Which stored container a group was read from. */
export type StructureGroupSource =
  | { kind: "table"; fieldId: string }
  | { kind: "layoutTable"; fieldId: string }
  | {
      kind: "subformModule";
      /** Host section, or null for a draft with no matching section. */
      sectionId: string | null;
      draftIndex: number;
      /** 0 = the draft's `moduleConfig`, n = its n-th `additionalSubformModules` entry. */
      moduleIndex: number;
      moduleKind: SubformModuleKind;
    }
  | { kind: "component"; fieldId: string; componentKey: string }
  | { kind: "section"; sectionId: string; collectionId: string | null };

/**
 * - `answer`: the person filling the form types or picks it.
 * - `computed`: worked out (a formula column, a subform calculation or total, a computed layout cell).
 * - `action`: a button that fills it (a stamp column or cell).
 * - `display`: shows text only (a subform heading).
 */
export type StructureMemberRole = "answer" | "computed" | "action" | "display";

export interface StructureMember {
  /**
   * The member's field id: a table column's synthetic id
   * (`<tableId>::tableColumn::<columnId>`, as the inspector uses), a layout
   * cell's or subform entry's own field id.
   */
  id: string;
  /** Its id inside the container's stored shape (column id, cell id, entry or calculation id). */
  storedId: string;
  /** The member as a regular field, projected through the container's adapter. */
  field: BuilderField;
  role: StructureMemberRole;
  /** False when the container never shows it (a column in neither the table nor the row dialog, a hidden subform entry). */
  shown: boolean;
  /**
   * An ordinary field of the form the group asks (a scoring subform's
   * question answered through a builder field), not stored in the container.
   */
  documentField: boolean;
  /**
   * A hidden yes/no column that mirrors one option of a choice column
   * (`choiceBooleanTargets`): true exactly when that option is picked.
   */
  mirrors?: { memberId: string; option: string };
}

export interface StructureFieldItem {
  kind: "field";
  id: string;
  field: BuilderField;
}

export interface StructureGroup {
  kind: "group";
  /** The container field's id; for a subform module, its host section id (`#n` for the n-th extra module). */
  id: string;
  label: string;
  /** The container field (table, layout table, component); null for a subform module or a repeating section. */
  field: BuilderField | null;
  presentation: StructureGroupPresentation;
  /** Absent for a group that does not repeat (a question matrix, a layout table, a subform). */
  repeat?: StructureRepeat;
  repeatFor?: StructureRepeatFor;
  /**
   * The headings of a fixed grid's rows, one per row, when its rows are named
   * rather than numbered (a Cerner UltraGrid's second DTA axis,
   * `cernerConfig.grid.rows`).
   */
  rowLabels?: string[];
  members: StructureMember[];
  source: StructureGroupSource;
}

export interface StructureSubgroup {
  kind: "subgroup";
  id: string;
  name: string;
  layout: "table" | "grid" | "list" | null;
  /** The subgroup's show-when rule (`SectionSubgroup.visibility`); absent when it always shows. */
  visibility?: BuilderVisibilityRule;
  children: StructureNode[];
}

export interface StructureSection {
  kind: "section";
  /** The section field's id; null for fields no section claims. */
  id: string | null;
  label: string;
  field: BuilderField | null;
  /** 0-based page. */
  page: number;
  children: StructureNode[];
}

export type StructureItem = StructureFieldItem | StructureGroup;
export type StructureNode = StructureItem | StructureSubgroup | StructureSection;

export interface StructurePage {
  /** 0-based. */
  index: number;
  name: string | null;
  /** Top-level sections on the page, in form order (a nested section stays inside its parent). */
  sections: StructureSection[];
}

export interface NeutralStructure {
  pages: StructurePage[];
}

type TableColumn = BuilderTableColumn;
type LayoutAnswerSource = BuilderLayoutTableCell | BuilderLayoutTableCellField;

/**
 * The regular adapters, supplied by the app (`lib/form-structure.ts`). Each is
 * optional; a missing one falls back to a minimal projection.
 */
export interface FormStructureContext {
  /** lib/tables/table-column-fields.ts `tableColumnToBuilderField`. */
  projectTableColumn?: (table: BuilderField, column: TableColumn) => BuilderField;
  /** lib/layout-table-answer-fields.ts `layoutTableAnswerToBuilderField`. */
  projectLayoutAnswer?: (source: LayoutAnswerSource) => BuilderField;
  /** lib/subform-data-entry.ts `subformDataEntryFieldToBuilderField`. */
  projectSubformEntry?: (entry: SubformDataEntryFieldConfig) => BuilderField;
  /** lib/subform-data-entry.ts `subformCalculationToBuilderField`. */
  projectSubformCalculation?: (calculation: SubformDataEntryCalculationConfig) => BuilderField;
  /** lib/form-builder/subform-module-utils.ts `buildLegacySubformModuleFromField` (resolves library subforms). */
  componentSubformModule?: (field: BuilderField) => ModuleConfig | null;
}

/** What the reader needs from a document. */
export type FormStructureDocument = Pick<BuilderDocument, "fields"> &
  Partial<Pick<BuilderDocument, "drafts" | "paginationEnabled" | "pageCount" | "pageNames" | "pageAssignments" | "formPresentation">>;

const TABLE_COLUMN_FIELD_MARKER = "::tableColumn::";
const SECTION_DRAFT_PREFIX = "builder-section-";
/** EditableTable's `maxRows` when the table stores none. */
const DEFAULT_TABLE_MAX_ROWS = 10;

/** A table column's field id, as the inspector and the column adapter use it. */
export function structureTableColumnId(tableId: string, columnId: string): string {
  return `${tableId}${TABLE_COLUMN_FIELD_MARKER}${columnId}`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Minimal projections (used when the context supplies no adapter)
// ---------------------------------------------------------------------------

function fallbackColumnField(table: BuilderField, column: TableColumn): BuilderField {
  const type = column.type === "text" && column.textareaConfig?.multiline ? "textarea" : TABLE_COLUMN_TYPE_TO_FIELD_TYPE[column.type] ?? "text";
  return {
    id: structureTableColumnId(table.id, column.id),
    label: column.label || column.id,
    type,
    ...(column.options != null ? { options: column.options } : {}),
    ...(column.choiceStyle ? { choiceStyle: column.choiceStyle } : {}),
    ...(column.required || column.requiredWhenVisible ? { required: true } : {}),
  };
}

function fallbackLayoutField(source: LayoutAnswerSource): BuilderField {
  const options = (source.optionList ?? []).map((option) =>
    typeof option === "string" ? option : { label: option.text ?? option.display ?? option.key ?? option.code ?? "", value: option.key ?? option.code ?? option.text ?? "" }
  );
  return {
    id: source.fieldId ?? source.id ?? "layout-field",
    label: text(source.label) || source.fieldId || "Field",
    type: LAYOUT_CELL_INPUT_TYPE_TO_FIELD_TYPE[source.inputType ?? "text"] ?? "text",
    ...(options.length ? { options } : {}),
  };
}

function fallbackEntryField(entry: SubformDataEntryFieldConfig): BuilderField {
  const type = entry.type === "hotspotMap" ? "component" : SUBFORM_ENTRY_TYPE_TO_FIELD_TYPE[entry.type] ?? "text";
  return {
    ...(entry.builderField ?? {}),
    id: entry.id,
    label: text(entry.label) || entry.id,
    type,
  } as BuilderField;
}

function fallbackCalculationField(calculation: SubformDataEntryCalculationConfig): BuilderField {
  return {
    ...(calculation.builderField ?? {}),
    id: calculation.id,
    label: text(calculation.label) || calculation.id,
    type: "computed",
  } as BuilderField;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

/** EditableTable's row limit: null or 0 is no limit, absent the runtime's default. */
function tableMaxRows(config: NonNullable<BuilderField["tableConfig"]>): number | undefined {
  if (config.maxRows === null || config.maxRows === 0) return undefined;
  return typeof config.maxRows === "number" && config.maxRows > 0 ? config.maxRows : DEFAULT_TABLE_MAX_ROWS;
}

function tableGroup(field: BuilderField, fieldById: ReadonlyMap<string, BuilderField>, context: FormStructureContext): StructureGroup {
  const config = field.tableConfig ?? { group: { fields: [] } };
  const columns = tableColumnsOf(config);
  const seed = config.repeatFor?.sourceFieldId ? config.repeatFor : null;
  const repeatFor: StructureRepeatFor | undefined = seed
    ? {
        sourceGroupId: seed.sourceFieldId,
        keyMemberId: seed.keyColumnId ?? null,
        labelMemberId: seed.labelColumnId ?? null,
        labelTitle: text(seed.labelTitle) || null,
        filtered: Boolean(seed.filter?.conditions?.length),
        orphanPolicy: seed.orphanPolicy ?? "remove-if-unanswered",
        allowManualRows: seed.allowManualRows === true,
      }
    : undefined;

  // RepeatForEachTable: rows follow the source; hand-added rows only when allowed.
  const addable = repeatFor ? repeatFor.allowManualRows && config.allowAddRows !== false : config.allowAddRows !== false;
  const removable = config.allowRemoveRows === true && (!repeatFor || repeatFor.allowManualRows || repeatFor.orphanPolicy !== "remove");
  const source = repeatFor ? fieldById.get(repeatFor.sourceGroupId) : undefined;
  const initial = typeof config.initialRows === "number" && config.initialRows >= 0 ? Math.floor(config.initialRows) : 1;
  const limit = repeatFor && source?.tableConfig ? tableMaxRows(source.tableConfig) : tableMaxRows(config);
  // Rows that can't be added are the rows a new form starts with.
  const max = !repeatFor && !addable ? Math.min(initial, limit ?? initial) : limit;
  const repeat: StructureRepeat = {
    ...(max !== undefined ? { max } : {}),
    addable,
    removable,
    ...(repeatFor ? {} : { initial }),
  };

  // A question matrix is asked once: its columns are the rows people answer.
  const matrix = !repeatFor && isQuestionMatrixTable(field);
  const presentation: StructureGroupPresentation =
    matrix
      ? "matrix"
      : seed?.presentation === "cards"
        ? "cards"
        : config.mode === "modal"
          ? "row-dialog"
          : !repeatFor && !addable && !removable
            ? "fixed-grid"
            : "inline-table";
  // A fixed grid whose rows are named: a Cerner UltraGrid's second DTA axis.
  const axis = field.cernerConfig?.grid?.family === "ultra" ? field.cernerConfig.grid.rows ?? [] : [];
  const rowLabels = presentation === "fixed-grid" && axis.length > 0 && axis.length === repeat.max ? axis.map((row) => text(row.label) || row.id) : undefined;

  // Hidden yes/no columns an option of a choice column fills (choiceBooleanTargets).
  const pathOf = (column: TableColumn) => text(column.dataPath) || column.id;
  const columnByPath = new Map(columns.map((column) => [pathOf(column), column]));
  const mirrors = new Map<string, { memberId: string; option: string }>();
  columns.forEach((column) => {
    Object.entries(column.choiceBooleanTargets ?? {}).forEach(([option, path]) => {
      const target = columnByPath.get(text(path));
      if (target && target.id !== column.id && !mirrors.has(target.id)) {
        mirrors.set(target.id, { memberId: structureTableColumnId(field.id, column.id), option });
      }
    });
  });

  const members = columns.map((column): StructureMember => {
    const mirror = mirrors.get(column.id);
    return {
      id: structureTableColumnId(field.id, column.id),
      storedId: column.id,
      field: context.projectTableColumn?.(field, column) ?? fallbackColumnField(field, column),
      role: column.type === "stampButton" ? "action" : column.computedValue ? "computed" : "answer",
      shown: column.showInTable !== false || column.showInModal !== false,
      documentField: false,
      ...(mirror ? { mirrors: mirror } : {}),
    };
  });

  return {
    kind: "group",
    id: field.id,
    label: text(field.label) || field.id,
    field,
    presentation,
    ...(matrix ? {} : { repeat }),
    ...(repeatFor ? { repeatFor } : {}),
    ...(rowLabels ? { rowLabels } : {}),
    members,
    source: { kind: "table", fieldId: field.id },
  };
}

function layoutTableGroup(field: BuilderField, context: FormStructureContext): StructureGroup {
  const members: StructureMember[] = [];
  const answer = (source: LayoutAnswerSource, storedId: string) => {
    const projected = context.projectLayoutAnswer?.(source) ?? fallbackLayoutField(source);
    members.push({
      id: projected.id,
      storedId,
      field: projected,
      role: "answer",
      shown: source.hidden !== true,
      documentField: false,
    });
  };
  for (const row of field.layoutTableConfig?.rows ?? []) {
    for (const cell of row.cells ?? []) {
      if (cell.kind === "field" && cell.fieldId) answer(cell, cell.id);
      if (cell.kind === "fieldList") {
        for (const nested of cell.fields ?? []) {
          if (nested.fieldId) answer(nested, `${cell.id}/${nested.id ?? nested.fieldId}`);
        }
      }
      if (cell.kind === "computed" && cell.fieldId) {
        members.push({
          id: cell.fieldId,
          storedId: cell.id,
          field: { id: cell.fieldId, label: text(cell.label) || cell.fieldId, type: "computed" },
          role: "computed",
          shown: cell.hidden !== true,
          documentField: false,
        });
      }
      if (cell.kind === "stampButton" && cell.stampFieldId) {
        members.push({
          id: cell.stampFieldId,
          storedId: cell.id,
          field: { id: cell.stampFieldId, label: text(cell.label) || cell.stampFieldId, type: "text" },
          role: "action",
          shown: cell.hidden !== true,
          documentField: false,
        });
      }
    }
  }
  return {
    kind: "group",
    id: field.id,
    label: text(field.label) || field.id,
    field,
    presentation: "fixed-grid",
    members,
    source: { kind: "layoutTable", fieldId: field.id },
  };
}

function subformModuleKind(subformModule: ModuleConfig): SubformModuleKind | null {
  if (subformModule.kind === "subform-scoring" || subformModule.kind === "subform-data-entry" || subformModule.kind === "subform-calculator") {
    // An imported calculator keeps "subform-data-entry" with a calculator attached.
    if (subformModule.kind === "subform-data-entry" && subformModule.subformDataEntry?.calculatorConfig?.rows?.length) return "subform-calculator";
    return subformModule.kind;
  }
  return null;
}

/** The members a subform module asks: its data-entry fields and calculations, or its scoring questions and totals. */
function subformMembers(
  subformModule: ModuleConfig,
  fieldById: ReadonlyMap<string, BuilderField>,
  context: FormStructureContext
): StructureMember[] {
  const members: StructureMember[] = [];
  const seen = new Set<string>();
  const push = (member: StructureMember) => {
    if (seen.has(member.id)) return;
    seen.add(member.id);
    members.push(member);
  };
  const dataEntry = subformDataEntryOf(subformModule.subformDataEntry);
  (dataEntry?.fields ?? []).forEach((entry) => {
    if (!entry?.id) return;
    push({
      id: entry.id,
      storedId: entry.id,
      field: context.projectSubformEntry?.(entry) ?? fallbackEntryField(entry),
      role: entry.type === "heading" ? "display" : "answer",
      shown: entry.hidden !== true,
      documentField: false,
    });
  });
  (dataEntry?.calculations ?? []).forEach((calculation) => {
    if (!calculation?.id) return;
    push({
      id: calculation.id,
      storedId: calculation.id,
      field: context.projectSubformCalculation?.(calculation) ?? fallbackCalculationField(calculation),
      role: "computed",
      shown: true,
      documentField: false,
    });
  });
  const scoring = subformModule.scoring;
  (scoring?.questions ?? []).forEach((question) => {
    const answerIds = [question.fieldId, ...(question.childFieldIds ?? [])].filter((id) => text(id) && fieldById.has(id));
    if (answerIds.length) {
      answerIds.forEach((id) => push({ id, storedId: question.id, field: fieldById.get(id)!, role: "answer", shown: true, documentField: true }));
      return;
    }
    const fieldId = text(question.fieldId);
    if (!fieldId) return;
    const options = question.options?.length ? question.options : scoring?.sharedOptions ?? [];
    push({
      id: fieldId,
      storedId: question.id,
      field: {
        id: fieldId,
        label: text(question.label) || fieldId,
        type: "choice",
        choiceStyle: "radio",
        options: options.map((option) => {
          // Library subforms store `{ key, text, score }`; designed ones `{ id, label, state, score }`.
          const loose = option as unknown as Record<string, unknown>;
          const label = text(option.label) || text(loose.text) || text(loose.key) || text(option.id);
          return { label, value: text(option.state) || text(loose.key) || label, score: option.score };
        }),
      },
      role: "answer",
      shown: true,
      documentField: false,
    });
  });
  (scoring?.totals ?? []).forEach((total) => {
    const targetId = text(total.targetFieldId) || text(total.targetFieldIds?.[0]);
    if (!targetId) return;
    const existing = fieldById.get(targetId);
    push({
      id: targetId,
      storedId: total.id,
      field: existing ?? { id: targetId, label: text(total.label) || targetId, type: "computed" },
      role: "computed",
      shown: true,
      documentField: Boolean(existing),
    });
  });
  return members;
}

/** The legacy component's module without the app's library resolver: its own props only. */
function fallbackComponentModule(field: BuilderField): ModuleConfig | null {
  const props = isRecord(field.componentProps) ? field.componentProps : null;
  if (!props) return null;
  const dataEntry = isRecord(props.dataEntryConfig) ? props.dataEntryConfig : null;
  const scoring = isRecord(props.config) ? props.config : isRecord(props.scoring) ? props.scoring : null;
  const title = text(props.title) || text(field.componentTitle) || text(field.label) || field.id;
  if (dataEntry && Array.isArray(dataEntry.fields)) {
    return { enabled: true, title, context: "", kind: "subform-data-entry", subformDataEntry: withSubformDataEntry(dataEntry as unknown as SubformDataEntryConfig) };
  }
  if (scoring && Array.isArray(scoring.questions)) {
    return { enabled: true, title, context: "", kind: "subform-scoring", scoring: scoring as unknown as ModuleConfig["scoring"] };
  }
  return null;
}

/** A `SubformScoring` component placed as a field (lib/form-builder/subform-module-utils.ts `isLegacySubformComponentField`). */
function isSubformComponent(field: BuilderField): boolean {
  if (field.type !== "component") return false;
  return field.componentKey === "SubformScoring" || (isRecord(field.componentProps) && field.componentProps.nhformsExport === "SubformScoring");
}

function componentGroup(field: BuilderField, fieldById: ReadonlyMap<string, BuilderField>, context: FormStructureContext): StructureGroup {
  const subformModule = context.componentSubformModule ? context.componentSubformModule(field) : fallbackComponentModule(field);
  return {
    kind: "group",
    id: field.id,
    label: text(subformModule?.title) || text(field.componentTitle) || text(field.label) || field.id,
    field,
    presentation: "modal-subform",
    members: subformModule ? subformMembers(subformModule, fieldById, context) : [],
    source: { kind: "component", fieldId: field.id, componentKey: field.componentKey ?? "" },
  };
}

/** Does the module draw instead of its section's own fields (the MOIS section renderer's rule)? */
function moduleReplacesFields(subformModule: ModuleConfig): boolean {
  if (subformModule.replaceFields === false) return false;
  if (subformModule.kind === "subform-scoring") return Boolean(subformModule.subformScoring?.replaceFields);
  if (subformModule.kind === "subform-data-entry" || subformModule.kind === "subform-calculator") {
    return Boolean(subformModule.subformDataEntry?.replaceFields);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Drafts: subform modules, subgroups and item order per section
// ---------------------------------------------------------------------------

interface DraftLike {
  key?: unknown;
  moduleConfig?: ModuleConfig | null;
  subgroups?: Array<{ id: string; name?: string; parentId?: string | null; layoutType?: string; visibility?: BuilderVisibilityRule | null }>;
  fieldOverrides?: Record<string, { subgroupId?: string | null } | undefined>;
  autoFillMode?: string;
  autoFillCollectionId?: string | null;
}

interface SectionDraft {
  draft: DraftLike;
  index: number;
  modules: StructureGroup[];
}

/** A subgroup's stored show-when rule, or null when it always shows. */
function subgroupVisibility(value: unknown): BuilderVisibilityRule | null {
  if (!isRecord(value)) return null;
  const rule = value as unknown as BuilderVisibilityRule;
  return rule.type && rule.type !== "always" && rule.controllerId ? rule : null;
}

function draftSectionId(draft: DraftLike): string {
  const key = text(draft.key);
  return key.startsWith(SECTION_DRAFT_PREFIX) ? key.slice(SECTION_DRAFT_PREFIX.length) : key;
}

function draftModuleGroups(
  draft: DraftLike,
  draftIndex: number,
  host: BuilderField | null,
  fieldById: ReadonlyMap<string, BuilderField>,
  context: FormStructureContext
): StructureGroup[] {
  const primary = draft.moduleConfig;
  if (!isRecord(primary)) return [];
  const sectionId = draftSectionId(draft);
  const baseId = host?.id ?? (sectionId || `draft-${draftIndex}`);
  const groups: StructureGroup[] = [];
  [primary, ...(primary.additionalSubformModules ?? [])].forEach((subformModule, moduleIndex) => {
    const moduleKind = isRecord(subformModule) ? subformModuleKind(subformModule) : null;
    if (!moduleKind || subformModule.enabled === false) return;
    groups.push({
      kind: "group",
      id: moduleIndex === 0 ? baseId : `${baseId}#${moduleIndex + 1}`,
      label: text(subformModule.title) || text(host?.sectionConfig?.title) || text(host?.label) || "Subform",
      field: null,
      presentation: "modal-subform",
      members: subformMembers(subformModule, fieldById, context),
      source: { kind: "subformModule", sectionId: host?.id ?? null, draftIndex, moduleIndex, moduleKind },
    });
  });
  return groups;
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

function isContainerField(field: BuilderField): boolean {
  return field.type === "table" || field.type === "layoutTable" || isSubformComponent(field);
}

/**
 * Read a form's structure: pages → sections → subgroups → items, where an
 * item is a field or a group. Pure; never changes the document.
 */
export function readFormStructure(document: FormStructureDocument, context: FormStructureContext = {}): NeutralStructure {
  const fields = document.fields ?? [];
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const sections = fields.filter((field) => field.type === "section");
  const sectionIds = new Set(sections.map((section) => section.id));

  // Drafts per section, with their subform modules. A draft with no section
  // (`builder-preview` on a form without sections) holds the form's own.
  const draftBySection = new Map<string, SectionDraft>();
  const orphanModules: StructureGroup[] = [];
  // Ordinary fields a replacing subform module asks live inside its group.
  const claimedByModule = new Set<string>();
  (document.drafts ?? []).forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const draft = raw as DraftLike;
    const sectionId = draftSectionId(draft);
    const host = sectionIds.has(sectionId) ? fieldById.get(sectionId)! : null;
    if (host && draftBySection.has(sectionId)) return;
    const modules = draftModuleGroups(draft, index, host, fieldById, context);
    const moduleConfigs = [draft.moduleConfig!, ...(draft.moduleConfig?.additionalSubformModules ?? [])];
    modules.forEach((group) => {
      const source = group.source as Extract<StructureGroupSource, { kind: "subformModule" }>;
      if (!moduleReplacesFields(moduleConfigs[source.moduleIndex])) return;
      group.members.filter((member) => member.documentField).forEach((member) => claimedByModule.add(member.id));
    });
    if (host) draftBySection.set(sectionId, { draft, index, modules });
    else orphanModules.push(...modules);
  });

  // Pages.
  const paged = document.paginationEnabled === true && document.formPresentation !== "investigation";
  const pageCount = paged ? Math.max(1, Math.floor(document.pageCount ?? 1)) : 1;
  const assignments = document.pageAssignments ?? {};
  const pageOf = (groupKey: string) => {
    if (!paged) return 0;
    const assigned = assignments[groupKey];
    return typeof assigned === "number" ? Math.min(Math.max(assigned - 1, 0), pageCount - 1) : 0;
  };

  const claimed = new Set<string>();
  sections.forEach((section) => (section.sectionConfig?.childFieldIds ?? []).forEach((id) => claimed.add(id)));
  const visited = new Set<string>();

  const itemFor = (field: BuilderField): StructureItem => {
    if (field.type === "table") return tableGroup(field, fieldById, context);
    if (field.type === "layoutTable") return layoutTableGroup(field, context);
    if (isContainerField(field)) return componentGroup(field, fieldById, context);
    return { kind: "field", id: field.id, field };
  };

  const buildSection = (section: BuilderField, page: number): StructureSection => {
    visited.add(section.id);
    const config = section.sectionConfig;
    const sectionDraft = draftBySection.get(section.id);
    const draft = sectionDraft?.draft;

    // Children in `childFieldIds` order, each placed once; a nested section is
    // walked where it is reached (pre-order, so it keeps what it claims first).
    const childFields: BuilderField[] = [];
    const nestedSections = new Map<string, StructureSection>();
    (config?.childFieldIds ?? []).forEach((childId) => {
      const child = fieldById.get(childId);
      if (!child || visited.has(child.id)) return;
      visited.add(child.id);
      if (claimedByModule.has(child.id)) return;
      childFields.push(child);
      if (child.type === "section") nestedSections.set(child.id, buildSection(child, page));
    });

    // Subgroups: the section's own, else its draft's.
    const ownSubgroups = config?.subgroups?.length ? config.subgroups : null;
    const subgroupDefs: Array<{ id: string; name: string; parentId: string | null; layoutType: string | null; visibility: BuilderVisibilityRule | null }> = (
      ownSubgroups ?? draft?.subgroups ?? []
    )
      .filter((subgroup) => isRecord(subgroup) && text(subgroup.id))
      .map((subgroup) => ({
        id: subgroup.id,
        name: text(subgroup.name),
        parentId: text(subgroup.parentId) || null,
        layoutType: text(subgroup.layoutType) || null,
        visibility: subgroupVisibility(subgroup.visibility),
      }));
    const subgroupIds = new Set(subgroupDefs.map((subgroup) => subgroup.id));
    const subgroupOf = (fieldId: string): string | null => {
      const assigned = ownSubgroups ? config?.fieldSubgroupMap?.[fieldId] : draft?.fieldOverrides?.[fieldId]?.subgroupId;
      return assigned && subgroupIds.has(assigned) ? assigned : null;
    };

    const nodeFor = (field: BuilderField): StructureNode => nestedSections.get(field.id) ?? itemFor(field);
    const indexOf = new Map(childFields.map((field, index) => [field.id, index]));
    const byParent = new Map<string | null, typeof subgroupDefs>();
    subgroupDefs.forEach((subgroup) => {
      const parent = subgroup.parentId && subgroupIds.has(subgroup.parentId) && subgroup.parentId !== subgroup.id ? subgroup.parentId : null;
      byParent.set(parent, [...(byParent.get(parent) ?? []), subgroup]);
    });
    const membersOf = (subgroupId: string | null) => childFields.filter((field) => subgroupOf(field.id) === subgroupId);

    // Anchors: a subgroup sits where its first member (or a nested member) is.
    const anchorMemo = new Map<string, number>();
    const anchorOf = (subgroupId: string, trail: Set<string> = new Set()): number => {
      if (anchorMemo.has(subgroupId)) return anchorMemo.get(subgroupId)!;
      if (trail.has(subgroupId)) return Infinity;
      trail.add(subgroupId);
      const own = membersOf(subgroupId).map((field) => indexOf.get(field.id) ?? Infinity);
      const nested = (byParent.get(subgroupId) ?? []).map((child) => anchorOf(child.id, trail));
      const anchor = Math.min(Infinity, ...own, ...nested);
      anchorMemo.set(subgroupId, anchor);
      return anchor;
    };

    const buildLevel = (parentId: string | null, trail: Set<string>): Array<{ token: string; anchor: number; node: StructureNode }> => {
      const entries: Array<{ token: string; anchor: number; node: StructureNode }> = membersOf(parentId).map((field) => ({
        token: `field:${field.id}`,
        anchor: indexOf.get(field.id) ?? Infinity,
        node: nodeFor(field),
      }));
      (byParent.get(parentId) ?? []).forEach((subgroup) => {
        if (trail.has(subgroup.id)) return;
        const nextTrail = new Set(trail).add(subgroup.id);
        entries.push({
          token: `subgroup:${subgroup.id}`,
          anchor: anchorOf(subgroup.id),
          node: {
            kind: "subgroup",
            id: subgroup.id,
            name: text(subgroup.name) || subgroup.id,
            layout: subgroup.layoutType === "table" || subgroup.layoutType === "grid" || subgroup.layoutType === "list" ? subgroup.layoutType : null,
            ...(subgroup.visibility ? { visibility: subgroup.visibility } : {}),
            children: sortEntries(buildLevel(subgroup.id, nextTrail), []).map((entry) => entry.node),
          },
        });
      });
      return entries;
    };

    // The section's root: modules first by default (as the MOIS canvas and
    // export draw them), then fields and subgroups by position; a stored
    // `itemOrder` (`module:n`, `field:<id>`, `subgroup:<id>`) wins.
    const moduleEntries = (sectionDraft?.modules ?? []).map((group, position) => ({
      token: `module:${(group.source as Extract<StructureGroupSource, { kind: "subformModule" }>).moduleIndex}`,
      anchor: -1 - (sectionDraft!.modules.length - position),
      node: group as StructureNode,
    }));
    const rootEntries = [...moduleEntries, ...buildLevel(null, new Set())];
    let children = sortEntries(rootEntries, draft?.moduleConfig?.itemOrder ?? []).map((entry) => entry.node);

    // A section filled from a MOIS collection repeats once per record.
    const collection = config?.autoFillMode === "collection" || draft?.autoFillMode === "collection";
    if (collection) {
      const members = flattenFields(children).map((field): StructureMember => ({
        id: field.id,
        storedId: field.id,
        field,
        role: field.type === "computed" ? "computed" : "answer",
        shown: field.hidden !== true,
        documentField: true,
      }));
      children = [
        {
          kind: "group",
          id: section.id,
          label: text(config?.title) || text(section.label) || section.id,
          field: null,
          presentation: "section",
          repeat: { addable: false, removable: false },
          members,
          source: { kind: "section", sectionId: section.id, collectionId: text(config?.autoFillCollectionId) || text(draft?.autoFillCollectionId) || null },
        },
      ];
    }

    return {
      kind: "section",
      id: section.id,
      label: text(config?.title) || text(section.label) || section.id,
      field: section,
      page,
      children,
    };
  };

  // Top level: fields no section claims, in array order; runs of plain
  // fields form an unnamed section.
  const topLevel: StructureSection[] = [];
  const looseSectionPage = sections.length > 0 ? 0 : pageOf("builder-preview");
  let loose: StructureSection | null = null;
  const addLoose = (field: BuilderField) => {
    if (!loose) {
      loose = { kind: "section", id: null, label: "", field: null, page: looseSectionPage, children: [] };
      topLevel.push(loose);
    }
    loose.children.push(itemFor(field));
  };
  const visitTop = (field: BuilderField) => {
    if (visited.has(field.id)) return;
    if (field.type === "section") {
      loose = null;
      topLevel.push(buildSection(field, pageOf(`${SECTION_DRAFT_PREFIX}${field.id}`)));
      return;
    }
    visited.add(field.id);
    if (claimedByModule.has(field.id)) return;
    addLoose(field);
  };
  fields.filter((field) => !claimed.has(field.id)).forEach(visitTop);
  // Fields claimed only by unreachable sections (or a cycle) are still placed.
  fields.forEach(visitTop);
  if (orphanModules.length) {
    // On a form without sections the modules lead its one unnamed section, as
    // they lead a section; otherwise they close the form.
    const host = sections.length === 0 ? topLevel.find((section) => section.id === null) : undefined;
    if (host) host.children.unshift(...orphanModules);
    else topLevel.push({ kind: "section", id: null, label: "", field: null, page: looseSectionPage, children: orphanModules });
  }

  const pages: StructurePage[] = Array.from({ length: pageCount }, (_, index) => ({
    index,
    name: paged ? text(document.pageNames?.[index]) || null : null,
    sections: topLevel.filter((section) => section.page === index),
  }));
  return { pages };
}

function sortEntries<T extends { token: string; anchor: number }>(entries: T[], order: readonly string[]): T[] {
  const byToken = new Map(entries.map((entry) => [entry.token, entry]));
  const first = order.filter((token, index) => byToken.has(token) && order.indexOf(token) === index).map((token) => byToken.get(token)!);
  const placed = new Set(first);
  const rest = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !placed.has(entry))
    .sort((a, b) => a.entry.anchor - b.entry.anchor || a.index - b.index)
    .map(({ entry }) => entry);
  return [...first, ...rest];
}

/** Every field a node holds, groups' container fields included, members excluded. */
function flattenFields(nodes: readonly StructureNode[]): BuilderField[] {
  return nodes.flatMap((node) => {
    if (node.kind === "field") return [node.field];
    if (node.kind === "group") return node.field ? [node.field] : [];
    return flattenFields(node.children);
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Every node, depth first, in form order. */
export function walkStructure(structure: NeutralStructure, visit: (node: StructureNode, section: StructureSection) => void): void {
  const walk = (nodes: readonly StructureNode[], section: StructureSection) => {
    nodes.forEach((node) => {
      visit(node, section);
      if (node.kind === "section") walk(node.children, node);
      else if (node.kind === "subgroup") walk(node.children, section);
    });
  };
  structure.pages.forEach((page) =>
    page.sections.forEach((section) => {
      visit(section, section);
      walk(section.children, section);
    })
  );
}

/** Every group, in form order. */
export function structureGroups(structure: NeutralStructure): StructureGroup[] {
  const groups: StructureGroup[] = [];
  walkStructure(structure, (node) => {
    if (node.kind === "group") groups.push(node);
  });
  return groups;
}

/** Groups that repeat (tables, follow-up tables, repeating sections). */
export function repeatingStructureGroups(structure: NeutralStructure): StructureGroup[] {
  return structureGroups(structure).filter((group) => group.repeat !== undefined);
}

export function findStructureGroup(structure: NeutralStructure, id: string): StructureGroup | null {
  return structureGroups(structure).find((group) => group.id === id) ?? null;
}

/** The section (innermost) each field item or group sits in. */
export function structureSectionOf(structure: NeutralStructure, id: string): StructureSection | null {
  let found: StructureSection | null = null;
  walkStructure(structure, (node, section) => {
    if (found || node.kind === "section" || node.kind === "subgroup") return;
    if (node.id === id) found = section;
  });
  return found;
}
