/**
 * The one place that maps answer types between vocabularies.
 *
 * The builder stores `BuilderField.type` (BUILDER_FIELD_TYPES below). Nested
 * containers store their own type names (table columns, layout-table cells,
 * subform data-entry fields), and every importer and exporter speaks another
 * (FHIR item types, AlayaCare field types, the MOIS EditableTable runtime,
 * Form.io components, the parsed-field kinds the MOIS exporter reads). Each of
 * those used to carry its own mapping table and they disagreed; the tables
 * here pick the mapping that preserves the answer's meaning, and
 * `docs/.../proposals/neutral-form-model.md` ("Answer types and presentation")
 * describes the direction.
 *
 * Conventions:
 * - `null` means "this vocabulary has no way to hold that type"; a converter
 *   reports it as dropped (or asks for an export decision).
 * - A `*_LOSSES` table lists mappings that keep the answer but lose part of
 *   its meaning (a format check, the time of day, …); a converter reports those
 *   as approximated. Mappings missing from a loss table are exact.
 * - Every table is `satisfies Record<Union, …>`, so adding a member to any
 *   union fails the type-check until every table covers it.
 *
 * Choice presentation uses a neutral vocabulary (dropdown, radio, checklist,
 * searchable) plus single/multiple selection. The stored `choiceStyle` values
 * (`simpleCodeSelect`, `findCode`, …) are MOIS control names; they are read
 * and written here only for compatibility with saved forms.
 */

import type { ComponentKind } from "./document";
import type {
  BuilderLayoutTableCellInputType,
  BuilderTableColumnType,
} from "./index";

export const BUILDER_FIELD_TYPES = [
  "text",
  "number",
  "computed",
  "booleanYesNo",
  "booleanSingle",
  "date",
  "datetime",
  "choice",
  "table",
  "layoutTable",
  "component",
  "email",
  "phone",
  "url",
  "hyperlink",
  "textarea",
  "time",
  "rating",
  "slider",
  "signature",
  "file",
  "password",
  "richText",
  "scale",
  "matrix",
  "barcode",
  "provider",
  "section",
  "heading",
] as const;

/** Same union as `BuilderFieldType` in ./index (kept local to avoid an import cycle). */
type FieldType = (typeof BUILDER_FIELD_TYPES)[number];

/**
 * Checks at compile time that `list` names every member of `U` (and nothing
 * else), so runtime member lists cannot silently fall behind a union declared
 * elsewhere.
 */
function unionMembers<U extends string>() {
  return <const T extends readonly U[]>(
    list: T & ([Exclude<U, T[number]>] extends [never] ? unknown : { missing: Exclude<U, T[number]> }),
  ): T => list;
}

// ---------------------------------------------------------------------------
// Neutral answer types
// ---------------------------------------------------------------------------

/** What an answer means, independent of any product's control. */
export const NEUTRAL_ANSWER_TYPES = [
  "text",
  "longText",
  "number",
  "date",
  "dateTime",
  "time",
  /** A yes/no question: answered yes, answered no, or unanswered. */
  "yesNo",
  /** A single tick box: ticked or not (unticked reads as false). */
  "boolean",
  "singleChoice",
  "multipleChoice",
  /** Ordered answers with numeric values (0–4, HoNOS, a pain scale). */
  "scale",
  "signature",
  "attachment",
  /** Derived from other answers by a formula. */
  "computed",
  /**
   * A clinician chosen from the organisation's provider directory. Stored as
   * a Coding: the provider's identifier as `code`, their name as `display`
   * and the directory as `system` (see ./providers.ts). Every EMR target has
   * a native equivalent (Cerner PROVIDER, MOIS Provider, a FHIR reference to
   * a Practitioner), so it is an answer type rather than a text hint.
   */
  "provider",
] as const;
export type NeutralAnswerType = (typeof NEUTRAL_ANSWER_TYPES)[number];

/** What a builder item is for. Only `answer` items store a value of their own. */
export const FIELD_ROLES = ["answer", "display", "container", "structure"] as const;
export type FieldRole = (typeof FIELD_ROLES)[number];

/** Qualifiers on a text answer (validation, keyboard, masking), not separate answer types. */
export const TEXT_FORMATS = ["email", "phone", "url", "secret", "barcode"] as const;
export type TextFormat = (typeof TEXT_FORMATS)[number];

export interface FieldTypeProfile {
  role: FieldRole;
  /** The answer type when the item collects one; null for display, container and structure items. */
  answer: NeutralAnswerType | null;
  textFormat?: TextFormat;
  /** Older builder types kept for saved forms; the palette no longer offers them. */
  legacy?: true;
}

export const FIELD_TYPE_PROFILES = {
  text: { role: "answer", answer: "text" },
  number: { role: "answer", answer: "number" },
  computed: { role: "answer", answer: "computed" },
  booleanYesNo: { role: "answer", answer: "yesNo" },
  booleanSingle: { role: "answer", answer: "boolean" },
  date: { role: "answer", answer: "date" },
  datetime: { role: "answer", answer: "dateTime" },
  // Multiple selection is a choiceStyle setting; see neutralAnswerTypeOf.
  choice: { role: "answer", answer: "singleChoice" },
  table: { role: "container", answer: null },
  layoutTable: { role: "container", answer: null },
  component: { role: "container", answer: null },
  email: { role: "answer", answer: "text", textFormat: "email" },
  phone: { role: "answer", answer: "text", textFormat: "phone" },
  url: { role: "answer", answer: "text", textFormat: "url" },
  hyperlink: { role: "display", answer: null },
  textarea: { role: "answer", answer: "longText" },
  time: { role: "answer", answer: "time" },
  rating: { role: "answer", answer: "number", legacy: true },
  slider: { role: "answer", answer: "number", legacy: true },
  signature: { role: "answer", answer: "signature" },
  file: { role: "answer", answer: "attachment" },
  password: { role: "answer", answer: "text", textFormat: "secret" },
  // Read-only by default (richTextConfig.readOnly ?? true); editable rich text is long text.
  richText: { role: "display", answer: null },
  scale: { role: "answer", answer: "scale" },
  matrix: { role: "container", answer: null },
  barcode: { role: "answer", answer: "text", textFormat: "barcode" },
  provider: { role: "answer", answer: "provider" },
  section: { role: "structure", answer: null },
  heading: { role: "structure", answer: null },
} as const satisfies Record<FieldType, FieldTypeProfile>;

/** The builder type an answer of each neutral type is stored as. */
export const NEUTRAL_ANSWER_TYPE_TO_FIELD_TYPE = {
  text: "text",
  longText: "textarea",
  number: "number",
  date: "date",
  dateTime: "datetime",
  time: "time",
  yesNo: "booleanYesNo",
  boolean: "booleanSingle",
  singleChoice: "choice",
  multipleChoice: "choice",
  scale: "scale",
  signature: "signature",
  attachment: "file",
  computed: "computed",
  provider: "provider",
} as const satisfies Record<NeutralAnswerType, FieldType>;

/** The settings that refine a builder type's meaning. Any field-like object fits. */
export interface FieldTypeInput {
  type: FieldType;
  choiceStyle?: string | null;
  dateConfig?: { withTime?: boolean } | null;
  richTextConfig?: { readOnly?: boolean } | null;
}

/** A field's neutral answer type, or null when it stores no answer of its own. */
export function neutralAnswerTypeOf(field: FieldTypeInput): NeutralAnswerType | null {
  if (field.type === "choice") {
    return choiceDisplayOf(field.choiceStyle).selection === "multiple" ? "multipleChoice" : "singleChoice";
  }
  if (field.type === "date" && field.dateConfig?.withTime === true) return "dateTime";
  if (field.type === "richText") return field.richTextConfig?.readOnly === false ? "longText" : null;
  const profile: FieldTypeProfile | undefined = FIELD_TYPE_PROFILES[field.type];
  return profile?.answer ?? null;
}

// ---------------------------------------------------------------------------
// Choice presentation
// ---------------------------------------------------------------------------

/** Stored `choiceStyle` values. The same union as `BuilderField["choiceStyle"]`. */
export const CHOICE_STYLES = [
  "dropdown",
  "radio",
  "multiselect",
  "checkbox",
  "simpleCodeSelect",
  "findCode",
] as const;
export type ChoiceStyle = (typeof CHOICE_STYLES)[number];

/** Neutral presentation hints for a choice. */
export const CHOICE_PRESENTATIONS = ["dropdown", "radio", "checklist", "searchable"] as const;
export type ChoicePresentation = (typeof CHOICE_PRESENTATIONS)[number];
export type ChoiceSelection = "single" | "multiple";

export interface ChoiceDisplay {
  presentation: ChoicePresentation;
  selection: ChoiceSelection;
}

/**
 * What each stored style means. `simpleCodeSelect` and `dropdown` draw the
 * same control; `findCode` is a searchable single select and `multiselect` a
 * searchable multiple select (MOIS FindCodeSelect with selectionType multiple).
 */
export const CHOICE_STYLE_DISPLAY = {
  dropdown: { presentation: "dropdown", selection: "single" },
  simpleCodeSelect: { presentation: "dropdown", selection: "single" },
  radio: { presentation: "radio", selection: "single" },
  findCode: { presentation: "searchable", selection: "single" },
  checkbox: { presentation: "checklist", selection: "multiple" },
  multiselect: { presentation: "searchable", selection: "multiple" },
} as const satisfies Record<ChoiceStyle, ChoiceDisplay>;

/**
 * The stored style for each presentation and selection. A single-select
 * checklist is a radio list; a multiple-select dropdown is the searchable
 * multiple select and a multiple-select radio list is a checklist (both
 * approximations, listed in CHOICE_DISPLAY_STYLE_LOSSES).
 */
export const CHOICE_DISPLAY_STYLE = {
  single: { dropdown: "dropdown", radio: "radio", checklist: "radio", searchable: "findCode" },
  multiple: { dropdown: "multiselect", radio: "checkbox", checklist: "checkbox", searchable: "multiselect" },
} as const satisfies Record<ChoiceSelection, Record<ChoicePresentation, ChoiceStyle>>;

export const CHOICE_DISPLAY_STYLE_LOSSES: Partial<Record<ChoiceSelection, Partial<Record<ChoicePresentation, string>>>> = {
  multiple: {
    dropdown: "No multiple-select dropdown; drawn as a searchable multiple select.",
    radio: "Radio buttons allow one answer; drawn as a checklist.",
  },
};

/** Where a choice with no stored style lives; each context has always defaulted differently. */
export type ChoiceStyleContext = "field" | "tableColumn" | "layoutCell" | "subformEntry";

/**
 * The style each context uses when `choiceStyle` is unset: a builder field is
 * a searchable select (builder-parsed-field, ChoiceEditor), a table column,
 * subform entry or layout cell a plain dropdown (TableEditor, the subform
 * adapter, the LayoutTable runtime).
 */
export const DEFAULT_CHOICE_STYLE = {
  field: "findCode",
  tableColumn: "dropdown",
  layoutCell: "dropdown",
  subformEntry: "dropdown",
} as const satisfies Record<ChoiceStyleContext, ChoiceStyle>;

export function isChoiceStyle(value: unknown): value is ChoiceStyle {
  return typeof value === "string" && (CHOICE_STYLES as readonly string[]).includes(value);
}

/** Presentation and selection for a stored style (unknown or unset styles use the context default). */
export function choiceDisplayOf(
  choiceStyle: string | null | undefined,
  context: ChoiceStyleContext = "field",
): ChoiceDisplay {
  const style = isChoiceStyle(choiceStyle) ? choiceStyle : DEFAULT_CHOICE_STYLE[context];
  return CHOICE_STYLE_DISPLAY[style];
}

/** The stored style that draws a presentation with the given selection. */
export function choiceStyleFor(display: ChoiceDisplay): ChoiceStyle {
  return CHOICE_DISPLAY_STYLE[display.selection][display.presentation];
}

export function isMultipleChoiceStyle(choiceStyle: string | null | undefined): boolean {
  return isChoiceStyle(choiceStyle) && CHOICE_STYLE_DISPLAY[choiceStyle].selection === "multiple";
}

// ---------------------------------------------------------------------------
// Table columns (BuilderTableColumnType)
// ---------------------------------------------------------------------------

export const TABLE_COLUMN_TYPES = unionMembers<BuilderTableColumnType>()([
  "text",
  "number",
  "date",
  "time",
  "choice",
  "booleanYesNo",
  "checkbox",
  "stampButton",
  "signature",
]);

/**
 * The column type a field becomes inside a table. A long-text field is a text
 * column with `textareaConfig.multiline`, a date-time field a date column with
 * `withTime`, and a multiple choice keeps its `choiceStyle`; those settings
 * carry the rest of the meaning.
 */
export const FIELD_TYPE_TO_TABLE_COLUMN_TYPE = {
  text: "text",
  number: "number",
  computed: null,
  booleanYesNo: "booleanYesNo",
  booleanSingle: "checkbox",
  date: "date",
  datetime: "date",
  choice: "choice",
  table: null,
  layoutTable: null,
  component: null,
  email: "text",
  phone: "text",
  url: "text",
  hyperlink: null,
  textarea: "text",
  time: "time",
  rating: null,
  slider: null,
  signature: "signature",
  file: null,
  password: null,
  richText: null,
  scale: null,
  matrix: null,
  barcode: null,
  provider: null,
  section: null,
  heading: null,
} as const satisfies Record<FieldType, BuilderTableColumnType | null>;

export const FIELD_TYPE_TO_TABLE_COLUMN_TYPE_LOSSES: Partial<Record<FieldType, string>> = {
  email: "Columns do not check email addresses.",
  phone: "Columns do not format phone numbers.",
  url: "Columns do not check web addresses.",
};

/**
 * The field type a column is edited as. A text column with
 * `textareaConfig.multiline` is long text, and a stamp button stores the
 * stamped text.
 */
export const TABLE_COLUMN_TYPE_TO_FIELD_TYPE = {
  text: "text",
  number: "number",
  date: "date",
  time: "time",
  choice: "choice",
  booleanYesNo: "booleanYesNo",
  checkbox: "booleanSingle",
  stampButton: "text",
  signature: "signature",
} as const satisfies Record<BuilderTableColumnType, FieldType>;

// ---------------------------------------------------------------------------
// Layout-table cells (BuilderLayoutTableCellInputType)
// ---------------------------------------------------------------------------

export const LAYOUT_CELL_INPUT_TYPES = unionMembers<BuilderLayoutTableCellInputType>()([
  "text",
  "textarea",
  "number",
  "date",
  "time",
  "choice",
  "choiceMulti",
  "booleanYesNo",
  "booleanSingle",
  "signature",
]);

/** A multiple choice becomes `choiceMulti` (see layoutCellInputTypeForField). */
export const FIELD_TYPE_TO_LAYOUT_CELL_INPUT_TYPE = {
  text: "text",
  number: "number",
  computed: null,
  booleanYesNo: "booleanYesNo",
  booleanSingle: "booleanSingle",
  date: "date",
  datetime: "date",
  choice: "choice",
  table: null,
  layoutTable: null,
  component: null,
  email: "text",
  phone: "text",
  url: "text",
  hyperlink: null,
  textarea: "textarea",
  time: "time",
  rating: null,
  slider: null,
  signature: "signature",
  file: null,
  password: null,
  richText: null,
  scale: null,
  matrix: null,
  barcode: null,
  provider: null,
  section: null,
  heading: null,
} as const satisfies Record<FieldType, BuilderLayoutTableCellInputType | null>;

export const FIELD_TYPE_TO_LAYOUT_CELL_INPUT_TYPE_LOSSES: Partial<Record<FieldType, string>> = {
  email: "Layout cells do not check email addresses.",
  phone: "Layout cells do not format phone numbers.",
  url: "Layout cells do not check web addresses.",
  datetime: "Layout cells have no date-time input; the time of day is dropped.",
};

export const LAYOUT_CELL_INPUT_TYPE_TO_FIELD_TYPE = {
  text: "text",
  textarea: "textarea",
  number: "number",
  date: "date",
  time: "time",
  choice: "choice",
  choiceMulti: "choice",
  booleanYesNo: "booleanYesNo",
  booleanSingle: "booleanSingle",
  signature: "signature",
} as const satisfies Record<BuilderLayoutTableCellInputType, FieldType>;

/**
 * How the LayoutTable runtime draws each choice input: `choice` is a single
 * dropdown and `choiceMulti` a multiple-select checklist, whatever
 * `choiceStyle` the cell stores.
 */
export const LAYOUT_CELL_CHOICE_DISPLAY = {
  choice: { presentation: "dropdown", selection: "single" },
  choiceMulti: { presentation: "checklist", selection: "multiple" },
} as const satisfies Partial<Record<BuilderLayoutTableCellInputType, ChoiceDisplay>>;

/** The cell input for a field, or null when a layout cell cannot hold it. */
export function layoutCellInputTypeForField(
  field: Pick<FieldTypeInput, "type" | "choiceStyle">,
): BuilderLayoutTableCellInputType | null {
  const input = FIELD_TYPE_TO_LAYOUT_CELL_INPUT_TYPE[field.type];
  if (input === "choice" && isMultipleChoiceStyle(field.choiceStyle)) return "choiceMulti";
  return input;
}

// ---------------------------------------------------------------------------
// Subform data-entry fields (lib/subform-data-entry.ts SubformDataEntryFieldType)
// ---------------------------------------------------------------------------

export const SUBFORM_ENTRY_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "time",
  "choice",
  "booleanYesNo",
  "heading",
  "scale",
] as const;
export type SubformEntryType = (typeof SUBFORM_ENTRY_TYPES)[number];

/**
 * A computed field becomes a subform calculation, not an entry. Containers,
 * attachments and signatures have no entry type.
 */
export const FIELD_TYPE_TO_SUBFORM_ENTRY_TYPE = {
  text: "text",
  number: "number",
  computed: null,
  booleanYesNo: "booleanYesNo",
  booleanSingle: "booleanYesNo",
  date: "date",
  datetime: "datetime",
  choice: "choice",
  table: null,
  layoutTable: null,
  component: null,
  email: "text",
  phone: "text",
  url: "text",
  hyperlink: null,
  textarea: "textarea",
  time: "time",
  rating: "number",
  slider: "number",
  signature: null,
  file: null,
  password: "text",
  richText: null,
  scale: "scale",
  matrix: null,
  barcode: "text",
  provider: null,
  section: null,
  heading: "heading",
} as const satisfies Record<FieldType, SubformEntryType | null>;

export const FIELD_TYPE_TO_SUBFORM_ENTRY_TYPE_LOSSES: Partial<Record<FieldType, string>> = {
  booleanSingle: "Subform entries have no single tick box; stored as a yes/no answer drawn as a checkbox.",
  email: "Subform entries do not check email addresses.",
  phone: "Subform entries do not format phone numbers.",
  url: "Subform entries do not check web addresses.",
  password: "Subform entries do not mask text.",
  barcode: "Subform entries do not scan barcodes.",
  rating: "Drawn as a number, not stars.",
  slider: "Drawn as a number, not a slider.",
};

/** Subform choices are single-select only (their compact choiceStyle is radio or dropdown). */
export const SUBFORM_ENTRY_CHOICE_STYLES = ["radio", "dropdown"] as const satisfies readonly ChoiceStyle[];

export const SUBFORM_ENTRY_TYPE_TO_FIELD_TYPE = {
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
} as const satisfies Record<SubformEntryType, FieldType>;

// ---------------------------------------------------------------------------
// MOIS EditableTable runtime columns (MOIS converter detail)
// ---------------------------------------------------------------------------

/** Column types the EditableTable runtime draws (NHForms EditableTable). */
export const EDITABLE_TABLE_COLUMN_TYPES = [
  "text",
  "number",
  "date",
  "time",
  "dropdown",
  "checkbox",
  "stampButton",
  "signature",
] as const;
export type EditableTableColumnType = (typeof EDITABLE_TABLE_COLUMN_TYPES)[number];

export const TABLE_COLUMN_TYPE_TO_EDITABLE_TABLE_COLUMN_TYPE = {
  text: "text",
  number: "number",
  date: "date",
  time: "time",
  choice: "dropdown",
  booleanYesNo: "checkbox",
  checkbox: "checkbox",
  stampButton: "stampButton",
  signature: "signature",
} as const satisfies Record<BuilderTableColumnType, EditableTableColumnType>;

export const TABLE_COLUMN_TYPE_TO_EDITABLE_TABLE_COLUMN_TYPE_LOSSES: Partial<Record<BuilderTableColumnType, string>> = {
  booleanYesNo: "EditableTable has no yes/no column; drawn as a tick box, so unanswered reads as No.",
};

export const EDITABLE_TABLE_COLUMN_TYPE_TO_TABLE_COLUMN_TYPE = {
  text: "text",
  number: "number",
  date: "date",
  time: "time",
  dropdown: "choice",
  checkbox: "checkbox",
  stampButton: "stampButton",
  signature: "signature",
} as const satisfies Record<EditableTableColumnType, BuilderTableColumnType>;

// ---------------------------------------------------------------------------
// FHIR Questionnaire item types (lib/fhir/questionnaire.ts)
// ---------------------------------------------------------------------------

export const FHIR_ITEM_TYPES = [
  "group",
  "display",
  "boolean",
  "decimal",
  "integer",
  "date",
  "dateTime",
  "time",
  "string",
  "text",
  "url",
  "choice",
  "open-choice",
  "coding",
  "reference",
  "attachment",
  "quantity",
] as const;
export type FhirItemType = (typeof FHIR_ITEM_TYPES)[number];

/**
 * Item type per builder type. A number is `decimal` when
 * `numberConfig.typeNumber` is "decimal", and a computed field `string` when
 * its result is text (see fhirItemTypeForField). A scale is a choice whose
 * options carry ordinal values, so its labels and scores survive; editable
 * rich text is `text`.
 */
export const FIELD_TYPE_TO_FHIR_ITEM_TYPE = {
  text: "string",
  number: "integer",
  computed: "decimal",
  booleanYesNo: "boolean",
  booleanSingle: "boolean",
  date: "date",
  datetime: "dateTime",
  choice: "choice",
  table: "group",
  layoutTable: "group",
  component: "group",
  email: "string",
  phone: "string",
  url: "url",
  hyperlink: "display",
  textarea: "text",
  time: "time",
  rating: "integer",
  slider: "integer",
  signature: "attachment",
  file: "attachment",
  password: "string",
  richText: "display",
  scale: "choice",
  matrix: "group",
  barcode: "string",
  // A reference to a Practitioner (questionnaire-referenceResource), with the
  // directory search left to the form filler (lib/fhir/questionnaire-providers.ts).
  provider: "reference",
  section: "group",
  heading: "display",
} as const satisfies Record<FieldType, FhirItemType>;

export const FIELD_TYPE_TO_FHIR_ITEM_TYPE_LOSSES: Partial<Record<FieldType, string>> = {
  email: "FHIR has no email item type; exported as string.",
  phone: "FHIR has no phone item type; exported as string.",
  password: "FHIR does not mask answers.",
  barcode: "FHIR has no barcode item type; exported as string.",
  rating: "Exported as an integer; star presentation dropped.",
  slider: "Exported as an integer unless a slider itemControl is kept.",
  signature: "Exported as an attachment.",
  layoutTable: "Exported as a group; cell layout dropped.",
  matrix: "Exported as a group of questions.",
  component: "Exported as a group; the component's own behaviour is dropped.",
};

export interface FhirItemTypeInput extends FieldTypeInput {
  numberConfig?: { typeNumber?: string } | null;
  computedConfig?: { resultType?: string } | null;
  calculatedValue?: { resultType?: string } | null;
}

/** FHIR item type for a field, applying the settings that refine its builder type. */
export function fhirItemTypeForField(field: FhirItemTypeInput): FhirItemType {
  if (field.type === "number") return field.numberConfig?.typeNumber === "decimal" ? "decimal" : "integer";
  if (field.type === "computed") {
    const resultType = field.calculatedValue?.resultType ?? field.computedConfig?.resultType;
    if (resultType === "text") return "string";
    return field.numberConfig?.typeNumber === "number" ? "integer" : "decimal";
  }
  if (field.type === "date" && field.dateConfig?.withTime === true) return "dateTime";
  if (field.type === "richText" && field.richTextConfig?.readOnly === false) return "text";
  return FIELD_TYPE_TO_FHIR_ITEM_TYPE[field.type];
}

export const FHIR_ITEM_TYPE_TO_FIELD_TYPE = {
  group: "section",
  display: "heading",
  boolean: "booleanYesNo",
  decimal: "number",
  integer: "number",
  date: "date",
  dateTime: "datetime",
  time: "time",
  string: "text",
  text: "textarea",
  url: "url",
  choice: "choice",
  "open-choice": "choice",
  coding: "choice",
  // A reference with answer options or a value set is a choice.
  reference: "text",
  attachment: "file",
  quantity: "number",
} as const satisfies Record<FhirItemType, FieldType>;

export const TABLE_COLUMN_TYPE_TO_FHIR_ITEM_TYPE = {
  text: "string",
  number: "integer",
  date: "date",
  time: "time",
  choice: "choice",
  booleanYesNo: "boolean",
  checkbox: "boolean",
  stampButton: "string",
  // The signature image as a PNG attachment (like a signature field).
  signature: "attachment",
} as const satisfies Record<BuilderTableColumnType, FhirItemType>;

/** A date item with a time part becomes a date column with `withTime`. */
export const FHIR_ITEM_TYPE_TO_TABLE_COLUMN_TYPE = {
  group: null,
  display: null,
  boolean: "booleanYesNo",
  decimal: "number",
  integer: "number",
  date: "date",
  dateTime: "date",
  time: "time",
  string: "text",
  text: "text",
  url: "text",
  choice: "choice",
  "open-choice": "choice",
  coding: "choice",
  reference: "choice",
  attachment: null,
  quantity: "number",
} as const satisfies Record<FhirItemType, BuilderTableColumnType | null>;

/** FHIR `questionnaire-item-control` codes for each presentation. */
export const CHOICE_PRESENTATION_TO_FHIR_ITEM_CONTROL = {
  dropdown: "drop-down",
  radio: "radio-button",
  checklist: "check-box",
  searchable: "autocomplete",
} as const satisfies Record<ChoicePresentation, string>;

/** Presentation for FHIR item-control codes; selection follows `item.repeats`. */
export const FHIR_ITEM_CONTROL_TO_CHOICE_PRESENTATION: Readonly<Record<string, ChoicePresentation>> = {
  "drop-down": "dropdown",
  "radio-button": "radio",
  "check-box": "checklist",
  autocomplete: "searchable",
  lookup: "searchable",
};

// ---------------------------------------------------------------------------
// AlayaCare field types (lib/alayacare-export.ts AlayaCareFieldType)
// ---------------------------------------------------------------------------

export const ALAYACARE_FIELD_TYPES = [
  "section",
  "text",
  "textarea",
  "number",
  "checkbox",
  "list",
  "list_multiple",
  "date",
  "time",
  "signature",
  "risk",
  "demographics",
  "vital",
  "medication20",
  "progress_notes",
  "care_plan",
  "drawing",
  "hyperlink",
  "information",
  "medical_history",
  "medication",
  "oasis_autocomplete",
  "picture",
  "score",
  "subform",
  "subsection",
  "wound_healing",
] as const;
export type AlayaCareFieldTypeName = (typeof ALAYACARE_FIELD_TYPES)[number];

/**
 * AlayaCare's default type per builder type, before explicit
 * `alayaCareConfig.fieldType` overrides and chart bindings (demographics,
 * vital) are applied. A multiple choice is `list_multiple`; a url with a known
 * address is `hyperlink`; a computed field is `score` only when its formula is
 * a numeric score sum (resolveEffectiveAlayaCareFieldTypeDetails decides).
 */
export const FIELD_TYPE_TO_ALAYACARE_FIELD_TYPE = {
  text: "text",
  number: "number",
  computed: "score",
  booleanYesNo: "list",
  booleanSingle: "checkbox",
  date: "date",
  datetime: null,
  choice: "list",
  table: null,
  layoutTable: null,
  component: null,
  email: "text",
  phone: "text",
  url: "text",
  hyperlink: "hyperlink",
  textarea: "textarea",
  time: "time",
  rating: "number",
  slider: "number",
  signature: "signature",
  file: "picture",
  password: "text",
  richText: "information",
  scale: "list",
  matrix: null,
  barcode: "text",
  provider: "text",
  section: "section",
  heading: null,
} as const satisfies Record<FieldType, AlayaCareFieldTypeName | null>;

export const FIELD_TYPE_TO_ALAYACARE_FIELD_TYPE_LOSSES: Partial<Record<FieldType, string>> = {
  computed: "AlayaCare scores only sum option scores; other formulas are dropped.",
  booleanYesNo: "AlayaCare has no yes/no type; exported as a two-answer list.",
  email: "AlayaCare text does not check email addresses.",
  phone: "AlayaCare text does not format phone numbers.",
  url: "Exported as text unless the field has a web address.",
  rating: "Exported as a number; star presentation dropped.",
  slider: "Exported as a number; slider presentation dropped.",
  file: "AlayaCare pictures accept images only.",
  password: "AlayaCare text does not mask answers.",
  scale: "AlayaCare has no scale; exported as a list carrying each option's score.",
  barcode: "Exported as text; scanning dropped.",
  provider: "AlayaCare has no provider or employee search on a form; exported as text holding the provider's name, without their identifier.",
};

/**
 * Builder type for each AlayaCare type on import. Types with no builder
 * equivalent (OASIS autocomplete, subforms) are target-only elements: null.
 */
export const ALAYACARE_FIELD_TYPE_TO_FIELD_TYPE = {
  section: "section",
  text: "text",
  textarea: "textarea",
  number: "number",
  checkbox: "booleanSingle",
  list: "choice",
  list_multiple: "choice",
  date: "date",
  time: "time",
  signature: "signature",
  risk: "choice",
  demographics: "text",
  vital: "number",
  medication20: "textarea",
  progress_notes: "textarea",
  care_plan: "textarea",
  drawing: "signature",
  hyperlink: "hyperlink",
  information: "richText",
  medical_history: "textarea",
  medication: "textarea",
  oasis_autocomplete: null,
  picture: "file",
  score: "computed",
  subform: null,
  subsection: "section",
  wound_healing: "textarea",
} as const satisfies Record<AlayaCareFieldTypeName, FieldType | null>;

// ---------------------------------------------------------------------------
// Form.io components (lib/formio/import.ts)
// ---------------------------------------------------------------------------

export const FORMIO_COMPONENT_TYPES = [
  "textfield",
  "textarea",
  "email",
  "phoneNumber",
  "number",
  "datetime",
  "day",
  "time",
  "checkbox",
  "radio",
  "select",
  "selectboxes",
  "file",
  "signature",
  "content",
  "htmlelement",
  "hidden",
  "datagrid",
  "editgrid",
  "panel",
  "fieldset",
  "well",
  "container",
  "columns",
  "button",
] as const;
export type FormioComponentType = (typeof FORMIO_COMPONENT_TYPES)[number];

/**
 * Builder type per Form.io component. A textfield with a calendar widget is a
 * date (or date-time), a datetime with `enableTime: false` a date. Columns are
 * flattened into their children and buttons are workflow, not answers.
 */
export const FORMIO_COMPONENT_TYPE_TO_FIELD_TYPE = {
  textfield: "text",
  textarea: "textarea",
  email: "email",
  phoneNumber: "phone",
  number: "number",
  datetime: "datetime",
  day: "date",
  time: "time",
  checkbox: "booleanSingle",
  radio: "choice",
  select: "choice",
  selectboxes: "choice",
  file: "file",
  signature: "signature",
  content: "richText",
  htmlelement: "richText",
  hidden: "text",
  datagrid: "table",
  editgrid: "table",
  panel: "section",
  fieldset: "section",
  well: "section",
  container: "section",
  columns: null,
  button: null,
} as const satisfies Record<FormioComponentType, FieldType | null>;

/** Column type for a Form.io component inside a data grid; a datetime column keeps `withTime`. */
export const FORMIO_COMPONENT_TYPE_TO_TABLE_COLUMN_TYPE = {
  textfield: "text",
  textarea: "text",
  email: "text",
  phoneNumber: "text",
  number: "number",
  datetime: "date",
  day: "date",
  time: "time",
  checkbox: "checkbox",
  radio: "choice",
  select: "choice",
  selectboxes: "choice",
  file: null,
  signature: "signature",
  content: null,
  htmlelement: null,
  hidden: null,
  datagrid: null,
  editgrid: null,
  panel: null,
  fieldset: null,
  well: null,
  container: null,
  columns: null,
  button: null,
} as const satisfies Record<FormioComponentType, BuilderTableColumnType | null>;

/** A select with `multiple: true` is a multiple-select dropdown. */
export const FORMIO_CHOICE_DISPLAY = {
  radio: { presentation: "radio", selection: "single" },
  select: { presentation: "dropdown", selection: "single" },
  selectboxes: { presentation: "checklist", selection: "multiple" },
} as const satisfies Partial<Record<FormioComponentType, ChoiceDisplay>>;

// ---------------------------------------------------------------------------
// Parsed-field kinds (ParsedField.kind in ./document; read by the MOIS exporter)
// ---------------------------------------------------------------------------

export const PARSED_FIELD_KINDS = unionMembers<ComponentKind>()([
  "text",
  "number",
  "boolean",
  "choice",
  "date",
  "time",
  "table",
  "layoutTable",
  "component",
  "rating",
  "slider",
  "scale",
  "matrix",
  "barcode",
  "file",
  "signature",
  "section",
  "heading",
]);

/**
 * The kind lib/builder-parsed-field.ts gives each builder type. `rawType`
 * keeps the builder type; a computed field is `text` when its result is text.
 */
export const FIELD_TYPE_TO_PARSED_KIND = {
  text: "text",
  number: "number",
  computed: "number",
  booleanYesNo: "boolean",
  booleanSingle: "boolean",
  date: "date",
  datetime: "date",
  choice: "choice",
  table: "table",
  layoutTable: "layoutTable",
  component: "component",
  email: "text",
  phone: "text",
  url: "text",
  hyperlink: "text",
  textarea: "text",
  time: "time",
  rating: "number",
  slider: "number",
  signature: "text",
  file: "text",
  password: "text",
  richText: "text",
  scale: "number",
  matrix: "matrix",
  barcode: "text",
  // The MOIS exporter draws it by rawType (FindCodeSelect over the provider directory).
  provider: "text",
  section: "section",
  heading: "heading",
} as const satisfies Record<FieldType, ComponentKind>;

/** The kind a layout-table answer gets (lib/mois-export/contract.ts). */
export const LAYOUT_CELL_INPUT_TYPE_TO_PARSED_KIND = {
  text: "text",
  textarea: "text",
  number: "number",
  date: "date",
  time: "time",
  choice: "choice",
  choiceMulti: "choice",
  booleanYesNo: "boolean",
  booleanSingle: "boolean",
  signature: "signature",
} as const satisfies Record<BuilderLayoutTableCellInputType, ComponentKind>;

/**
 * The builder type for a parsed kind (PDF/upload imports, agent form fill).
 * A boolean is a single tick box unless `booleanStyle` is "yesNo"; see
 * fieldTypeForParsedField for the settings that refine text and date kinds.
 */
export const PARSED_KIND_TO_FIELD_TYPE = {
  text: "text",
  number: "number",
  boolean: "booleanSingle",
  choice: "choice",
  date: "date",
  time: "time",
  table: "table",
  layoutTable: "layoutTable",
  component: "component",
  rating: "rating",
  slider: "slider",
  scale: "scale",
  matrix: "matrix",
  barcode: "barcode",
  file: "file",
  signature: "signature",
  section: "section",
  heading: "heading",
} as const satisfies Record<ComponentKind, FieldType>;

export interface ParsedFieldTypeInput {
  kind: ComponentKind;
  rawType?: string | null;
  booleanStyle?: "single" | "yesNo" | null;
}

/** The builder type a parsed field becomes, keeping its builder `rawType` when it has one. */
export function fieldTypeForParsedField(field: ParsedFieldTypeInput): FieldType {
  if (field.rawType && (BUILDER_FIELD_TYPES as readonly string[]).includes(field.rawType)) {
    const rawType = field.rawType as FieldType;
    if (FIELD_TYPE_TO_PARSED_KIND[rawType] === field.kind) return rawType;
    if (rawType === "computed" && field.kind === "text") return rawType;
  }
  if (field.kind === "boolean") return field.booleanStyle === "yesNo" ? "booleanYesNo" : "booleanSingle";
  return PARSED_KIND_TO_FIELD_TYPE[field.kind];
}
