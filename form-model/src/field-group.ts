/**
 * Field groups: the one stored shape for the fields inside a container.
 *
 * A table asks a group of fields once per row; a data-entry subform asks one
 * once, in a dialog. Both store those fields the same way: a
 * `BuilderFieldGroup`, a list of regular `BuilderField`s. Each member keeps
 * the settings it shares with any field (label, answers, required, help,
 * defaults, show-when rule, binding …) under the field's own keys, and the
 * settings only its container uses (a column's save key and where it shows,
 * a formula column, a stamp; a subform entry's heading style, scale or
 * calculation) in `container`.
 *
 * Inside a group, a member names a sibling (in a show-when rule, an answer
 * condition or a formula) by the sibling's save key: a table column's
 * `container.table.dataPath` or its id, a subform entry's id.
 *
 * The runtimes and exporters read containers in their own shapes: a table's
 * columns (`tableColumnsOf`) and a subform's compact entries
 * (`subformDataEntryOf`). Those are views converted from the group, never a
 * second store. Both conversions are exact in both directions, so a form
 * stored in the old shapes converts on load without changing what it exports.
 *
 * Contract: docs/starlight/src/content/docs/architecture/nested-fields-and-shared-logic.md
 */
import type { BuilderField, BuilderTableColumn, BuilderTableColumnType } from "./index";
import type {
  GroupLayoutDraft,
  ModuleConfig,
  SubformDataEntryCalculationConfig,
  SubformDataEntryConfig,
  SubformDataEntryFieldConfig,
} from "./layout";

type UnknownRecord = Record<string, unknown>;

/** Column-only settings of a table member, stored as the column stores them. */
export type BuilderTableMemberSettings = Partial<Omit<BuilderTableColumn, TableFieldKey | "id" | "label" | "type">> & {
  /** The column type when the member's field type alone doesn't give it (a stamp button). */
  columnType?: BuilderTableColumnType;
  [key: string]: unknown;
};

/** Entry-only settings of a subform member, stored as the subform entry (or calculation) stores them. */
export type BuilderSubformMemberSettings = {
  /** A calculation (worked out from the other answers) rather than an entry. */
  role?: "calculation";
  /** The entry type when the member's field type alone doesn't give it (a hotspot map, a conversion). */
  entryType?: string;
  [key: string]: unknown;
};

export interface BuilderGroupMemberContainer {
  table?: BuilderTableMemberSettings;
  subform?: BuilderSubformMemberSettings;
}

/** A field inside a table row or a subform. */
export type BuilderGroupField = BuilderField & { container?: BuilderGroupMemberContainer };

export interface BuilderFieldGroup {
  fields: BuilderGroupField[];
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/**
 * Column keys that mean the same on a column and on a regular field; a
 * member stores them as the field does. Every other column key is
 * column-only and lives in `container.table`.
 */
export const TABLE_FIELD_KEYS = [
  "fhirConfig",
  "alayaCareConfig",
  "width",
  "moisSize",
  "booleanLabels",
  "prefill",
  "defaultAnswer",
  "dateConfig",
  "textareaConfig",
  "textConfig",
  "useToggleSwitch",
  "numberConfig",
  "options",
  "choiceStyle",
  "codeSystem",
  "showOtherOption",
  "required",
  "helpText",
  "placeholder",
  "visibility",
  "binding",
  "documentBinding",
] as const;
type TableFieldKey = (typeof TABLE_FIELD_KEYS)[number];
const TABLE_FIELD_KEY_SET = new Set<string>(TABLE_FIELD_KEYS);

const COLUMN_TO_FIELD_TYPE: Record<BuilderTableColumnType, BuilderField["type"]> = {
  text: "text",
  number: "number",
  date: "date",
  time: "time",
  choice: "choice",
  booleanYesNo: "booleanYesNo",
  checkbox: "booleanSingle",
  // A stamp button stores the stamped text.
  stampButton: "text",
  // A drawn signature image, as a signature field stores it.
  signature: "signature",
};

const FIELD_TO_COLUMN_TYPE: Partial<Record<BuilderField["type"], BuilderTableColumnType>> = {
  text: "text",
  textarea: "text",
  number: "number",
  date: "date",
  time: "time",
  choice: "choice",
  booleanYesNo: "booleanYesNo",
  booleanSingle: "checkbox",
  signature: "signature",
};

function memberTypeForColumn(column: BuilderTableColumn): BuilderField["type"] {
  const base = COLUMN_TO_FIELD_TYPE[column.type] ?? "text";
  return base === "text" && column.type === "text" && column.textareaConfig?.multiline === true ? "textarea" : base;
}

/** One column as a group member. */
export function tableColumnToGroupField(column: BuilderTableColumn): BuilderGroupField {
  const type = memberTypeForColumn(column);
  const member: UnknownRecord = { id: column.id, label: column.label, type };
  const table: UnknownRecord = {};
  if (FIELD_TO_COLUMN_TYPE[type] !== column.type) table.columnType = column.type;
  for (const key of Object.keys(column)) {
    if (key === "id" || key === "label" || key === "type") continue;
    if (TABLE_FIELD_KEY_SET.has(key)) member[key] = (column as unknown as UnknownRecord)[key];
    else table[key] = (column as unknown as UnknownRecord)[key];
  }
  if (Object.keys(table).length > 0) member.container = { table };
  return member as unknown as BuilderGroupField;
}

/** One group member as the column the table runtime and exporters read. */
export function groupFieldToTableColumn(member: BuilderGroupField): BuilderTableColumn {
  const table = member.container?.table ?? {};
  const { columnType, ...columnOnly } = table;
  const column: UnknownRecord = {
    id: member.id,
    label: member.label,
    type: columnType ?? FIELD_TO_COLUMN_TYPE[member.type] ?? "text",
  };
  for (const key of TABLE_FIELD_KEYS) {
    if (hasOwn(member, key)) column[key] = (member as unknown as UnknownRecord)[key];
  }
  for (const [key, value] of Object.entries(columnOnly)) column[key] = value;
  return column as unknown as BuilderTableColumn;
}

export function tableColumnsToGroup(columns: readonly BuilderTableColumn[]): BuilderFieldGroup {
  return { fields: columns.map(tableColumnToGroupField) };
}

const columnViews = new WeakMap<BuilderFieldGroup, BuilderTableColumn[]>();

/** A table config as stored, or as an older form (or a test) wrote it. */
export type TableConfigInput = { group?: BuilderFieldGroup | null; columns?: readonly BuilderTableColumn[] | null };

/**
 * A table's columns, as its runtime and exporters read them. Converted from
 * the stored group (the same array for the same group); a config still in
 * the old shape gives its columns.
 */
export function tableColumnsOf(config: TableConfigInput | null | undefined): BuilderTableColumn[] {
  if (!config) return [];
  // An old-shape `columns` list wins over a group, as on load: an older writer edited it last.
  if (Array.isArray(config.columns)) return config.columns as BuilderTableColumn[];
  const group = config.group;
  if (group && Array.isArray(group.fields)) {
    let view = columnViews.get(group);
    if (!view) {
      view = group.fields.map(groupFieldToTableColumn);
      columnViews.set(group, view);
    }
    return view;
  }
  return [];
}

/** The table config with these columns stored as its group (any old `columns` key goes). */
export function withTableColumns<T extends TableConfigInput>(
  config: T,
  columns: readonly BuilderTableColumn[],
): Omit<T, "columns"> & { group: BuilderFieldGroup } {
  const { columns: _legacy, ...rest } = config;
  const group = tableColumnsToGroup(columns);
  // Column projections do not expose every field setting (for example native
  // clinical controls). Keep that intent when editing the projected columns.
  const originals = new Map(config.group?.fields.map(field => [field.id, field]) ?? []);
  group.fields = group.fields.map(member => {
    const original = originals.get(member.id);
    if (!original) return member;
    const retained = Object.fromEntries(Object.entries(original).filter(([key]) =>
      !TABLE_FIELD_KEY_SET.has(key) && !["id", "label", "type", "container"].includes(key)));
    const projectedOriginal = groupFieldToTableColumn(original);
    const type = original.type !== memberTypeForColumn(projectedOriginal) &&
      member.type === memberTypeForColumn(projectedOriginal) &&
      projectedOriginal.type === groupFieldToTableColumn(member).type ? original.type : member.type;
    const { table: _oldTable, ...otherContainers } = original.container ?? {};
    const container = { ...otherContainers, ...member.container };
    return { ...retained, ...member, type,
      ...(Object.keys(container).length ? { container } : {}) };
  });
  return { ...rest, group };
}

/** A stored table config. */
export type BuilderTableConfig = NonNullable<BuilderField["tableConfig"]>;

/** A table config written with its columns (an importer, a preset, a test): `storedTableConfig` stores it. */
export type BuilderTableConfigInput = Omit<BuilderTableConfig, "group"> & { columns: readonly BuilderTableColumn[] };

/** The stored table config for a config written with its columns. */
export function storedTableConfig(input: BuilderTableConfigInput): BuilderTableConfig {
  const { columns, ...rest } = input;
  return { ...rest, group: tableColumnsToGroup(columns) };
}

/** A table config in the stored shape: an old `columns` list becomes the group. Unchanged (same object) when already stored. */
export function normalizeTableConfig<T extends TableConfigInput>(config: T): T {
  if (!Array.isArray(config.columns)) return config;
  // A config holding both keeps the columns: an older writer edited them last.
  return withTableColumns(config, config.columns) as unknown as T;
}

/** Whether a table config still uses the old `columns` shape. */
export function isLegacyTableConfig(config: TableConfigInput | null | undefined): boolean {
  return Boolean(config && Array.isArray(config.columns));
}

// ---------------------------------------------------------------------------
// Subforms
// ---------------------------------------------------------------------------

/** Entry keys that mean the same on a subform entry and on a regular field. */
export const SUBFORM_FIELD_KEYS = [
  "required",
  "placeholder",
  "helpText",
  "codeSystem",
  "showOtherOption",
  "choiceStyle",
  "defaultAnswer",
  "visibility",
  "hidden",
] as const;
const SUBFORM_FIELD_KEY_SET = new Set<string>(SUBFORM_FIELD_KEYS);

const ENTRY_TO_FIELD_TYPE: Record<string, BuilderField["type"]> = {
  text: "text",
  textarea: "textarea",
  number: "number",
  date: "date",
  datetime: "datetime",
  time: "time",
  choice: "choice",
  booleanYesNo: "booleanYesNo",
  heading: "heading",
  scale: "scale",
};

/** One subform entry as a group member. */
export function subformEntryToGroupField(entry: SubformDataEntryFieldConfig): BuilderGroupField {
  const type = ENTRY_TO_FIELD_TYPE[entry.type] ?? "text";
  const member: UnknownRecord = { id: entry.id, label: entry.label, type };
  const subform: UnknownRecord = {};
  if (type !== entry.type) subform.entryType = entry.type;
  for (const key of Object.keys(entry)) {
    if (key === "id" || key === "label" || key === "type") continue;
    if (SUBFORM_FIELD_KEY_SET.has(key)) member[key] = (entry as unknown as UnknownRecord)[key];
    else subform[key] = (entry as unknown as UnknownRecord)[key];
  }
  if (Object.keys(subform).length > 0) member.container = { subform };
  return member as unknown as BuilderGroupField;
}

/** One subform calculation as a group member (a computed field). */
export function subformCalculationToGroupField(calculation: SubformDataEntryCalculationConfig): BuilderGroupField {
  const { id, label, ...rest } = calculation as unknown as UnknownRecord & { id: string; label: string };
  return {
    id,
    label,
    type: "computed",
    container: { subform: { role: "calculation", ...rest } },
  } as BuilderGroupField;
}

export function isSubformCalculationMember(member: BuilderGroupField): boolean {
  return member.container?.subform?.role === "calculation";
}

/** One group member as the compact entry the SubformScoring runtime reads. */
export function groupFieldToSubformEntry(member: BuilderGroupField): SubformDataEntryFieldConfig {
  const { entryType, role: _role, ...entryOnly } = member.container?.subform ?? {};
  const entry: UnknownRecord = { id: member.id, label: member.label, type: entryType ?? member.type };
  for (const key of SUBFORM_FIELD_KEYS) {
    if (hasOwn(member, key)) entry[key] = (member as unknown as UnknownRecord)[key];
  }
  for (const [key, value] of Object.entries(entryOnly)) entry[key] = value;
  return entry as unknown as SubformDataEntryFieldConfig;
}

/** One calculation member as the compact calculation the runtime reads. */
export function groupFieldToSubformCalculation(member: BuilderGroupField): SubformDataEntryCalculationConfig {
  const { role: _role, ...rest } = member.container?.subform ?? {};
  return { id: member.id, label: member.label, ...rest } as unknown as SubformDataEntryCalculationConfig;
}

/** A data-entry subform as stored: its fields and calculations are one group. */
export type BuilderSubformDataEntry = Omit<SubformDataEntryConfig, "fields" | "calculations" | "calculatedValues"> & {
  group: BuilderFieldGroup;
};

/** A subform config as stored, or as an older form wrote it. */
export type SubformDataEntryInput = Omit<SubformDataEntryConfig, "fields"> & {
  group?: BuilderFieldGroup | null;
  fields?: SubformDataEntryConfig["fields"] | null;
};

export function subformEntriesToGroup(
  fields: readonly SubformDataEntryFieldConfig[],
  calculations: readonly SubformDataEntryCalculationConfig[] = [],
): BuilderFieldGroup {
  return { fields: [...fields.map(subformEntryToGroupField), ...calculations.map(subformCalculationToGroupField)] };
}

const subformViews = new WeakMap<object, SubformDataEntryConfig>();

/**
 * A subform's compact config (fields, calculations and everything else), as
 * the SubformScoring runtime and exporters read it. Converted from the stored
 * group (the same object for the same stored config); a config still in the
 * old shape is returned as it is.
 */
export function subformDataEntryOf(config: SubformDataEntryInput | BuilderSubformDataEntry | null | undefined): SubformDataEntryConfig | null {
  if (!config) return null;
  const group = (config as { group?: BuilderFieldGroup | null }).group;
  if (!group || !Array.isArray(group.fields)) {
    const legacy = config as SubformDataEntryConfig;
    return Array.isArray(legacy.fields) ? legacy : { ...legacy, fields: [] };
  }
  // Compact lists written over a stored config win, as on load: an older writer edited them last.
  if (isLegacySubformDataEntry(config)) {
    const normalized = normalizeSubformDataEntry(config) as BuilderSubformDataEntry;
    return normalized === config ? null : subformDataEntryOf(normalized);
  }
  const cached = subformViews.get(config);
  if (cached) return cached;
  const view = compactFromGroup(config as BuilderSubformDataEntry);
  subformViews.set(config, view);
  return view;
}

/** The compact config converted from a stored config's group (other keys as stored). */
function compactFromGroup(config: BuilderSubformDataEntry): SubformDataEntryConfig {
  const { group, ...rest } = config;
  const calculations = group.fields.filter(isSubformCalculationMember).map(groupFieldToSubformCalculation);
  return {
    ...rest,
    fields: group.fields.filter((member) => !isSubformCalculationMember(member)).map(groupFieldToSubformEntry),
    ...(calculations.length > 0 ? { calculations } : {}),
  };
}

/**
 * A subform config in the stored shape from its compact form: fields and
 * calculations become the group; the `calculatedValues` mirror is dropped
 * (the exporter derives what the runtime needs from the calculations).
 */
export function withSubformDataEntry(config: SubformDataEntryConfig | SubformDataEntryInput): BuilderSubformDataEntry {
  const { fields, calculations, calculatedValues: _mirror, group: _group, ...rest } = config as SubformDataEntryConfig & {
    group?: BuilderFieldGroup | null;
  };
  return { ...rest, group: subformEntriesToGroup(fields ?? [], calculations ?? []) };
}

/** Whether a subform config still uses (or an older writer added) the compact `fields` / `calculations` lists. */
export function isLegacySubformDataEntry(config: unknown): boolean {
  return isRecord(config) && (Array.isArray(config.fields) || Array.isArray(config.calculations));
}

/**
 * A subform config in the stored shape. Unchanged (same object) when already
 * stored. A config holding both keeps the compact lists (an older writer
 * edited them last); a list it leaves out comes from the group.
 */
export function normalizeSubformDataEntry<T>(config: T): T {
  if (!isLegacySubformDataEntry(config)) return config;
  const record = config as unknown as SubformDataEntryConfig & { group?: BuilderFieldGroup | null };
  const stored = record.group && Array.isArray(record.group.fields) ? compactFromGroup(record as unknown as BuilderSubformDataEntry) : null;
  return withSubformDataEntry({
    ...record,
    fields: Array.isArray(record.fields) ? record.fields : stored?.fields ?? [],
    calculations: Array.isArray(record.calculations) ? record.calculations : stored?.calculations,
  }) as unknown as T;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** A field with any old-shape table config stored as a group. Unchanged (same object) when already stored. */
export function normalizeFieldGroupsInField<T extends Pick<BuilderField, "tableConfig">>(field: T): T {
  const config = field.tableConfig as TableConfigInput | null | undefined;
  if (!config || !isLegacyTableConfig(config)) return field;
  return { ...field, tableConfig: normalizeTableConfig(config) } as T;
}

/** Fields with old-shape tables converted. The same array when nothing changed. */
export function normalizeFieldGroupsInFields<T extends Pick<BuilderField, "tableConfig">>(fields: readonly T[]): T[] {
  let changed = false;
  const next = fields.map((field) => {
    const normalized = normalizeFieldGroupsInField(field);
    if (normalized !== field) changed = true;
    return normalized;
  });
  return changed ? next : (fields as T[]);
}

/** A section module (and the extra subforms it carries) with old-shape subforms converted. Same object when unchanged. */
export function normalizeFieldGroupsInModule<T extends ModuleConfig | null | undefined>(module: T): T {
  if (!module) return module;
  const dataEntry = normalizeSubformDataEntry(module.subformDataEntry);
  const extras = module.additionalSubformModules;
  let extrasChanged = false;
  const nextExtras = extras?.map((extra) => {
    const normalized = normalizeFieldGroupsInModule(extra);
    if (normalized !== extra) extrasChanged = true;
    return normalized;
  });
  if (dataEntry === module.subformDataEntry && !extrasChanged) return module;
  return {
    ...module,
    ...(dataEntry !== module.subformDataEntry ? { subformDataEntry: dataEntry } : {}),
    ...(extrasChanged ? { additionalSubformModules: nextExtras } : {}),
  };
}

/** Drafts with old-shape subforms converted. The same array when nothing changed. */
export function normalizeFieldGroupsInDrafts<T extends Pick<GroupLayoutDraft, "moduleConfig">>(drafts: readonly T[]): T[] {
  let changed = false;
  const next = drafts.map((draft) => {
    const moduleConfig = normalizeFieldGroupsInModule(draft.moduleConfig);
    if (moduleConfig === draft.moduleConfig) return draft;
    changed = true;
    return { ...draft, moduleConfig };
  });
  return changed ? next : (drafts as T[]);
}

type FieldGroupDocumentPart = {
  fields?: readonly Pick<BuilderField, "tableConfig">[];
  drafts?: readonly Pick<GroupLayoutDraft, "moduleConfig">[];
};

/**
 * A document with every table and subform in the stored field-group shape,
 * its saved versions (`variants`) included. Run on every load path (editor,
 * workspace, share link, preset, package); the same object when nothing
 * needed converting.
 */
export function normalizeFieldGroupsInDocument<T extends FieldGroupDocumentPart & { variants?: readonly unknown[] }>(document: T): T {
  const fields = document.fields ? normalizeFieldGroupsInFields(document.fields) : document.fields;
  const drafts = document.drafts ? normalizeFieldGroupsInDrafts(document.drafts) : document.drafts;
  let variantsChanged = false;
  const variants = Array.isArray(document.variants)
    ? document.variants.map((variant) => {
        if (!isRecord(variant)) return variant;
        const normalized = normalizeFieldGroupsInDocument(variant as FieldGroupDocumentPart);
        if (normalized !== variant) variantsChanged = true;
        return normalized;
      })
    : document.variants;
  if (fields === document.fields && drafts === document.drafts && !variantsChanged) return document;
  return { ...document, fields, drafts, ...(variantsChanged ? { variants } : {}) };
}
