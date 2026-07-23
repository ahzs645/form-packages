/**
 * UI-independent authoring model shared by the builder, persistence codecs,
 * previews, and exporters. Keep this package free of app/component imports.
 */

import { BUILDER_FIELD_TYPES } from "./field-types";
import type { BoundingBox, FieldPrefillValue, WidgetGeometry } from "./document";
import type { BuilderInvestigationTab } from "./investigation-tabs";

export { BUILDER_FIELD_TYPES } from "./field-types";

export interface MoisNavigationTarget {
  moisModule: string;
  objectIdSourcePath?: string | null;
}

export interface MoisCalculatedObservationConfig {
  enabled: boolean;
  observationCode?: string;
  loincCode?: string;
  system?: string;
  labCode?: string;
  status?: string;
  description?: string;
  valueType?: "NUMERIC" | "TEXT";
  units?: string;
  reportFieldId?: string;
  reportedByFieldId?: string;
  reportedDateFieldId?: string;
}

export interface CalculatedValueRange {
  label: string;
  min: number;
  max: number | null;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  description?: string;
}

export interface ScoreTotalTerm {
  answerFieldId: string;
  weight: number;
}

export type CalculatedValuePolicy =
  | "always-calculated"
  | "calculated-until-overridden"
  | "suggested-calculation";

export interface CalculatedValueConfig {
  id: string;
  label: string;
  expression: string;
  precision?: number;
  resultType?: "number" | "text";
  /** Controls whether the runtime owns the value, yields after a user edit, or only offers a suggestion. */
  calculationPolicy?: CalculatedValuePolicy;
  showInterpretation?: boolean;
  ranges?: CalculatedValueRange[];
  sourceKind?: "computed-field" | "data-entry-calculation" | "scoring-total";
  sourceId?: string;
  terms?: ScoreTotalTerm[];
  targetFieldId?: string | null;
  targetFieldIds?: string[];
  moisCalculated?: MoisCalculatedObservationConfig | null;
}

export interface FhirPrimitiveElement {
  id?: string;
  extension?: FhirExtension[];
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
  text?: string;
  _display?: FhirPrimitiveElement;
}

export interface FhirExpression {
  name?: string;
  language?: string;
  expression?: string;
}

export interface FhirExtension {
  url: string;
  extension?: FhirExtension[];
  modifierExtension?: FhirExtension[];
  valueString?: string;
  valueCode?: string;
  valueUrl?: string;
  valueUri?: string;
  valueDecimal?: number;
  valueInteger?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueDateTime?: string;
  valueTime?: string;
  valueCodeableConcept?: { text?: string; coding?: FhirCoding[] };
  valueCoding?: FhirCoding;
  valueExpression?: FhirExpression;
  valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
}

export interface FhirQuestionnaireAnswerOption {
  id?: string;
  extension?: FhirExtension[];
  modifierExtension?: FhirExtension[];
  initialSelected?: boolean;
  valueDecimal?: number;
  valueInteger?: number;
  valueDate?: string;
  valueDateTime?: string;
  valueTime?: string;
  valueString?: string;
  valueUri?: string;
  valueCoding?: FhirCoding;
  valueReference?: { reference?: string; display?: string };
}

export interface FhirQuestionnaireEnableWhen {
  question: string;
  operator: "exists" | "=" | "!=" | ">" | "<" | ">=" | "<=";
  answerBoolean?: boolean;
  answerString?: string;
  answerInteger?: number;
  answerDecimal?: number;
  answerDate?: string;
  answerDateTime?: string;
  answerTime?: string;
  answerCoding?: FhirCoding;
  answerQuantity?: { value?: number; unit?: string; system?: string; code?: string };
  answerUri?: string;
  answerReference?: { reference?: string; display?: string };
}

export interface FhirQuestionnaireInitialValue {
  valueBoolean?: boolean;
  valueDecimal?: number;
  valueInteger?: number;
  valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
  valueDate?: string;
  valueDateTime?: string;
  valueTime?: string;
  valueString?: string;
  valueUri?: string;
  valueCoding?: FhirCoding;
  valueAttachment?: { id?: string; contentType?: string; url?: string; title?: string; data?: string };
  valueReference?: { reference?: string; display?: string };
}

export interface FhirValueSetExpansionContains {
  system?: string;
  code?: string;
  display?: string;
  abstract?: boolean;
  contains?: FhirValueSetExpansionContains[];
}

export interface FhirValueSet {
  resourceType: "ValueSet";
  id?: string;
  url?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  compose?: { include?: Array<{ system?: string; concept?: Array<{ code: string; display?: string }> }> };
  expansion?: { contains?: FhirValueSetExpansionContains[] };
}

export type WorkflowStep = "review" | "layout" | "pagination" | "branching" | "preview";

export type LlmProvider = "google" | "openai" | "anthropic" | "local-codex";

export interface GroupPageStats {
  primaryPage: number | null;
  details: Array<{ page: number; count: number }>;
}

export interface ParseMeta {
  title: string;
  sizeKB: number;
  pageCount: number;
  sourceArchiveName?: string | null;
  sourceArchiveType?: "zip" | "7z" | null;
}

export type BuilderWorkflowSupportStatus = "implemented" | "partial" | "unsupported";
export type BuilderWorkflowSuggestionStatus = "suggested" | "accepted" | "dismissed";

export interface BuilderWorkflowSourceEvidence {
  path: string;
  line?: number;
  excerpt?: string;
}

export interface BuilderWorkflowBaseDefinition {
  id: string;
  title: string;
  /** Disabled definitions remain editable/exportable but do not execute at runtime. Omitted means enabled. */
  enabled?: boolean;
  description?: string;
  sourceEvidence?: BuilderWorkflowSourceEvidence[];
  supportStatus?: BuilderWorkflowSupportStatus;
}

export type BuilderWorkflowReportKind = "fieldList" | "template" | "sectionNarrative" | "tableSummary";

export interface BuilderWorkflowReportDefinition extends BuilderWorkflowBaseDefinition {
  kind: BuilderWorkflowReportKind;
  outputFieldId?: string;
  template?: string;
  sections?: Array<{
    title: string;
    fieldIds: string[];
    /** "major" (default, ==== underline) or "sub" (---- underline). A titled section with no fields renders as a heading-only banner. */
    level?: "major" | "sub";
  }>;
  fieldIds?: string[];
  /** Prompt text per line: the field's label (default) or its raw fieldId. */
  labelSource?: "label" | "fieldId";
  /** Placeholder emitted for unanswered prompts (e.g. "<<<Nothing specified>>>"). */
  emptyText?: string;
  /** Section title presentation: plain line (default) or title + ===== underline (legacy MSE style). */
  headerStyle?: "plain" | "underlined";
  /** Blank line between sections ("spaced", legacy style) or none ("compact", default). */
  sectionSpacing?: "compact" | "spaced";
  /** Prompt layout: "inline" = `Label: value` (default); "indented" = label line, value indented on the next line, blank line after (legacy MSE style; multi-selects render as `- item` bullets). */
  valueLayout?: "inline" | "indented";
}

export type BuilderWorkflowOutputKind =
  | "dcoObservation"
  | "documentUpdate"
  | "documentComment"
  | "webformUpdate"
  | "calculatedObservation"
  | "panelUpdate"
  | "httpJson"
  | "customMutation"
  | "moisMutation";

export type BuilderWorkflowValueType = "TEXT" | "NUMERIC" | "VALUESET";

/**
 * Stored workflow JSON (hand-written or legacy-imported) carries both cases;
 * every consumer normalizes through here instead of ad-hoc `.toUpperCase()`.
 */
export function normalizeWorkflowValueType(
  value: unknown,
  fallback: BuilderWorkflowValueType = "TEXT"
): BuilderWorkflowValueType {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  return upper === "TEXT" || upper === "NUMERIC" || upper === "VALUESET" ? upper : fallback;
}

export interface BuilderWorkflowPanelRowBinding {
  fieldId?: string;
  observationCode?: string;
  description?: string;
  loincCode?: string;
  valueType?: "TEXT" | "NUMERIC" | "VALUESET" | "numeric" | "text";
  system?: string;
  panelSequenceNumber?: number;
  units?: string;
  rangeNormalLow?: string;
  rangeNormalHigh?: string;
  rangeAbsurdLow?: string;
  rangeAbsurdHigh?: string;
  referenceRangeText?: string;
  dictionaryMetadata?: BuilderClinicalDictionaryMetadata;
}

export interface BuilderWorkflowPanelUpdatePayload {
  panelName?: {
    code?: string;
    display?: string;
    system?: string;
  };
  rowBindings?: BuilderWorkflowPanelRowBinding[];
  /** Preserve a row-binding entry even when its source field is empty. */
  includeEmptyRows?: boolean;
}

export interface BuilderWorkflowOutputCondition {
  fieldId: string;
  operator?: "truthy" | "equals" | "notEquals" | "yes" | "no" | "in" | "notIn";
  value?: string | number | boolean | null;
  /** For in/notIn: the value set (matched against code-aware values). */
  values?: Array<string | number>;
}

/** Fields every output kind shares: identity, enablement, and the submit-time gate. */
export interface BuilderWorkflowOutputBase extends BuilderWorkflowBaseDefinition {
  condition?: BuilderWorkflowOutputCondition;
}

/** Chart observation write, keyed by observation code (update-or-create). */
export interface BuilderWorkflowDcoObservationOutput extends BuilderWorkflowOutputBase {
  kind: "dcoObservation";
  observationCode?: string;
  loincCode?: string;
  system?: string;
  labCode?: string;
  status?: string;
  dictionaryMetadata?: BuilderClinicalDictionaryMetadata;
  value?: string;
  valueFieldId?: string;
  valueType?: "TEXT" | "NUMERIC" | "VALUESET" | "numeric" | "text";
  valueSource?: "display" | "code";
  reportFromDisplay?: boolean;
  /** The attached workflow report saved as the observation's report text. */
  reportId?: string;
  reportFieldId?: string;
  units?: string;
  unitsFieldId?: string;
  unitsInline?: boolean;
  rangeAbsurdLow?: string;
  rangeNormalLow?: string;
  rangeNormalHigh?: string;
  rangeAbsurdHigh?: string;
  updateExisting?: boolean;
  deleteWhenFalse?: boolean;
}

/** Conditional line appended to the encounter document. */
export interface BuilderWorkflowDocumentCommentOutput extends BuilderWorkflowOutputBase {
  kind: "documentComment";
  /** Comment template; tokens {value}, {label}, {fieldId}, {data.otherFieldId}. */
  value?: string;
  valueFieldId?: string;
}

/** The submit payload's single calculatedUpdate (computed score observation). */
export interface BuilderWorkflowCalculatedObservationOutput extends BuilderWorkflowOutputBase {
  kind: "calculatedObservation";
  observationCode?: string;
  loincCode?: string;
  system?: string;
  labCode?: string;
  status?: string;
  dictionaryMetadata?: BuilderClinicalDictionaryMetadata;
  valueFieldId?: string;
  valueType?: "TEXT" | "NUMERIC" | "VALUESET" | "numeric" | "text";
  units?: string;
  reportFieldId?: string;
}

/** Observation panel (flowsheet) upsert. valueFieldId is the rows-array field when rowBindings are not used. */
export interface BuilderWorkflowPanelUpdateOutput extends BuilderWorkflowOutputBase {
  kind: "panelUpdate";
  valueFieldId?: string;
  payload?: Record<string, unknown> & BuilderWorkflowPanelUpdatePayload;
  /** Header value bindings: notes/orderedBy/facility field ids. */
  payloadFields?: Record<string, string>;
}

/** Submit-time POST/PUT to an HTTP JSON listener such as Mirth. */
export interface BuilderWorkflowHttpJsonOutput extends BuilderWorkflowOutputBase {
  kind: "httpJson";
  endpointUrl?: string;
  httpMethod?: "POST" | "PUT";
  httpHeaders?: Record<string, string>;
  payloadMode?: "mirthNotification" | "envelope" | "formData" | "submitPayload";
  /** Safe Mirth notifications default to afterSubmit; legacy HTTP modes default to beforeSubmit. */
  deliveryPhase?: "beforeSubmit" | "afterSubmit";
  eventName?: string;
  requestTimeoutMs?: number;
  /** The attached workflow report: MDM document body (safe mode) or the envelope's highlighted report. */
  reportId?: string;
  /** Safe Mirth notification routing hints. Clinical content is retrieved downstream, never embedded here. */
  mirthRouting?: {
    /** genericDocument uses Mirth's environment-owned general-document route; documentLoinc uses the form's explicit code. */
    documentMode?: "genericDocument" | "documentLoinc";
    messageType?: string;
    loincCode?: string;
    loincDisplay?: string;
    loincSystem?: string;
    loincVersion?: string;
  };
  includeFormParams?: boolean;
  includeFormData?: boolean;
  includeReports?: boolean;
  includeSubmitPayload?: boolean;
  includePatientContext?: boolean;
  includeUserContext?: boolean;
  /** Optional form-data field that receives the structured HTTP response/error before MOIS save. */
  responseFieldId?: string;
  failOnError?: boolean;
}

/** Direct MOIS module mutation (only encounterNote.changeEncounterNote executes today). */
export interface BuilderWorkflowMoisMutationOutput extends BuilderWorkflowOutputBase {
  kind: "moisMutation";
  resource?: string;
  mutation?: string;
  patientIdPath?: string;
  payloadFieldId?: string;
  payloadFields?: Record<string, string>;
  payloadDefaults?: Record<string, unknown>;
  note?: string;
}

/** Definition-only kinds carried by legacy imports; audited but never executed. */
export interface BuilderWorkflowLegacyOutput extends BuilderWorkflowOutputBase {
  kind: "documentUpdate" | "webformUpdate" | "customMutation";
}

export type BuilderWorkflowOutputDefinition =
  | BuilderWorkflowDcoObservationOutput
  | BuilderWorkflowDocumentCommentOutput
  | BuilderWorkflowCalculatedObservationOutput
  | BuilderWorkflowPanelUpdateOutput
  | BuilderWorkflowHttpJsonOutput
  | BuilderWorkflowMoisMutationOutput
  | BuilderWorkflowLegacyOutput;

export type BuilderWorkflowActionKind =
  | "saveDraft"
  | "saveSubmit"
  | "signSubmit"
  | "validate"
  | "composePayload"
  | "runOutputs"
  | "openDialog"
  | "close"
  | "print"
  | "refresh";

export interface BuilderWorkflowActionDefinition extends BuilderWorkflowBaseDefinition {
  kind: BuilderWorkflowActionKind;
  note?: string;
  outputIds?: string[];
  dialogId?: string;
  closeOnSuccess?: boolean;
  autoSign?: boolean;
  steps?: Array<{
    kind: BuilderWorkflowActionKind;
    targetId?: string;
  }>;
}

export interface BuilderWorkflowRuntimeHookDefinition extends BuilderWorkflowBaseDefinition {
  kind: "onLoad" | "onRefresh" | "onUnload";
  mappings: Array<{
    targetFieldId: string;
    sourcePath: string;
    mode?: "copy" | "copyIfEmpty";
    valueTransform?: "none" | "string";
  }>;
}

export interface BuilderWorkflowDialogDefinition extends BuilderWorkflowBaseDefinition {
  kind: "confirm" | "choice" | "unsavedChanges" | "saveSignDiscardCancel";
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  actionIds?: string[];
}

export interface BuilderWorkflowSourceListDefinition extends BuilderWorkflowBaseDefinition {
  kind: "sourceList";
  sourcePath?: string;
  queryFragment?: string;
  targetFieldId?: string;
  selectionMode?: "single" | "multiple";
  columns?: Array<{ id: string; label: string; path?: string }>;
  filter?: string;
  sort?: string;
}

export type BuilderWorkflowSuggestionKind =
  | "report"
  | "output"
  | "action"
  | "runtimeHook"
  | "dialog"
  | "sourceList";

export interface BuilderWorkflowSuggestion extends BuilderWorkflowBaseDefinition {
  kind: BuilderWorkflowSuggestionKind;
  status: BuilderWorkflowSuggestionStatus;
  targetId?: string;
  targetKind?: BuilderWorkflowSuggestionKind;
}

export interface BuilderMirthSemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

/** Immutable builder mapping captured when an integration version is published. */
export interface BuilderMirthVersionSnapshot {
  version: BuilderMirthSemanticVersion;
  publishedAt: string;
  /** Disabled historical routes remain in the package for audit but are rejected by the Mirth router. */
  enabled?: boolean;
  fields: BuilderField[];
  reports: BuilderWorkflowReportDefinition[];
  outputs: BuilderWorkflowOutputDefinition[];
}

export interface BuilderMirthVersioningConfig {
  currentVersion: BuilderMirthSemanticVersion;
  versions: BuilderMirthVersionSnapshot[];
}

export interface BuilderWorkflowConfig {
  reports?: BuilderWorkflowReportDefinition[];
  outputs?: BuilderWorkflowOutputDefinition[];
  actions?: BuilderWorkflowActionDefinition[];
  runtimeHooks?: BuilderWorkflowRuntimeHookDefinition[];
  dialogs?: BuilderWorkflowDialogDefinition[];
  sourceLists?: BuilderWorkflowSourceListDefinition[];
  suggestions?: BuilderWorkflowSuggestion[];
  mirthVersioning?: BuilderMirthVersioningConfig;
}

export const EMPTY_BUILDER_WORKFLOW_CONFIG: BuilderWorkflowConfig = {
  reports: [],
  outputs: [],
  actions: [],
  runtimeHooks: [],
  dialogs: [],
  sourceLists: [],
  suggestions: [],
  mirthVersioning: { currentVersion: { major: 1, minor: 0, patch: 0 }, versions: [] },
};

export type BuilderFieldType = (typeof BUILDER_FIELD_TYPES)[number];

// Non-input block types
export type BuilderBlockType =
  | "textBlock"
  | "pageBreak"
  | "divider"
  | "imageBlock"
  | "videoBlock"
  | "codeBlock"
  // Layout blocks
  | "columns"
  | "tabs"
  | "panel"
  | "fieldset"
  | "well";

// Combined type for all builder items
export type BuilderItemType = BuilderFieldType | BuilderBlockType;

// Field width options
export type FieldWidth = "auto" | "full" | "1/2" | "1/3" | "2/3" | "1/4" | "3/4";

// Help text position
export type HelpPosition = "above_input" | "below_input";

export type BuilderTableColumnType = "text" | "number" | "date" | "time" | "choice" | "booleanYesNo" | "checkbox" | "stampButton";
export type BuilderTableMode = "inline" | "modal";
export type BuilderLayoutTableCellKind = "text" | "field" | "fieldList" | "resources" | "computed" | "stampButton";
export type BuilderLayoutTableCellInputType = "text" | "textarea" | "number" | "date" | "time" | "choice" | "choiceMulti" | "booleanYesNo" | "booleanSingle";
export type BuilderLayoutTableSourceFormat = "text" | "date" | "dateTime" | "visitCode";

export interface BuilderLayoutTableStampTarget {
  fieldId: string;
  sourcePath?: string;
  value?: string | number | boolean | null;
  fallback?: string | number | boolean | null;
}

export interface BuilderLayoutTableCellField {
  id?: string;
  fieldId: string;
  label?: string;
  name?: string;
  inputType?: BuilderLayoutTableCellInputType;
  optionList?: string[] | Array<{ key?: string; text?: string; code?: string; display?: string }>;
  codeSystem?: string;
}

export interface BuilderLayoutTableCell {
  id: string;
  kind: BuilderLayoutTableCellKind;
  text?: string;
  sourcePath?: string;
  sourcePaths?: string[];
  sourceFormat?: BuilderLayoutTableSourceFormat;
  sourceFallback?: string | number | boolean | null;
  defaultValue?: string | number | boolean | null;
  fieldId?: string;
  label?: string;
  readOnly?: boolean;
  fields?: BuilderLayoutTableCellField[];
  inputType?: BuilderLayoutTableCellInputType;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  formula?: string;
  blankWhenEmpty?: boolean;
  precision?: number;
  resultType?: "number" | "text";
  sourceFieldIds?: string[];
  optionList?: string[] | Array<{ key?: string; text?: string; code?: string; display?: string }>;
  codeSystem?: string;
  resources?: Array<{ label: string; url: string }>;
  resourceListStyle?: "disc" | "none";
  targets?: BuilderLayoutTableStampTarget[];
  stampFieldId?: string;
  signedLabel?: string;
  clearLabel?: string;
  buttonType?: "primary" | "default";
  allowResign?: boolean;
  showClear?: boolean;
  showStatus?: boolean;
  statusTemplate?: string;
  colSpan?: number;
  rowSpan?: number;
  width?: string;
  header?: boolean;
  backgroundColor?: string;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
}

export interface BuilderLayoutTableRow {
  id: string;
  cells: BuilderLayoutTableCell[];
  visibleWhen?: {
    fieldId: string;
    operator?: "truthy" | "yes" | "equals" | "notEquals";
    value?: string | number | boolean | null;
  };
}

export interface BuilderLayoutTableConfig {
  presetId?: string;
  rows: BuilderLayoutTableRow[];
  showLabel?: boolean;
  bordered?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  cellPadding?: number;
  borderColor?: string;
  pageBreakInsideAvoid?: boolean;
  quickNavTarget?: string;
}

export type BuilderVisibilityType = "always" | "filled" | "equals" | "gt" | "lt";
export type BuilderValidationRuleType =
  | "required"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "min"
  | "max"
  | "email"
  | "url"
  | "custom";
export type BuilderValidationListMode = "allowlist" | "denylist";
export type BuilderValidationListMatch = "domain" | "address";

export interface BuilderVisibilityRule {
  type: BuilderVisibilityType;
  controllerId?: string;
  value?: string;
}

export interface BuilderValidationRule {
  type: BuilderValidationRuleType;
  value?: string | number;
  message?: string;
}

export interface BuilderValidationConfig {
  rules?: BuilderValidationRule[];
  customError?: string;
  listMode?: BuilderValidationListMode;
  listValues?: string[];
  listMatch?: BuilderValidationListMatch;
}

export interface BuilderLockWhenRule {
  field: string;
  operator?: "truthy" | "equals" | "notEquals";
  value?: string | number | boolean | null;
}

/** "dcoObservation" is a legacy fixture alias of "observation" — normalized at export. */
export type BuilderMoisOutputKind = "observation" | "documentComment" | "dcoObservation";
export type BuilderMoisObservationValueType = "TEXT" | "NUMERIC" | "VALUESET" | "numeric" | "text";

/** Snapshot of dictionary defaults, retained so authored overrides remain explicit. */
export interface BuilderClinicalDictionaryMetadata {
  label?: string;
  description?: string;
  category?: string;
  units?: string;
}

export interface BuilderMoisOutputMapping {
  enabled?: boolean;
  kind: BuilderMoisOutputKind;
  observationCode?: string;
  /** Standard LOINC code and dictionary metadata selected with the observation. */
  loincCode?: string;
  system?: string;
  labCode?: string;
  status?: string;
  dictionaryMetadata?: BuilderClinicalDictionaryMetadata;
  description?: string;
  valueType?: BuilderMoisObservationValueType;
  valueSource?: "display" | "code";
  reportFromDisplay?: boolean;
  deleteWhenFalse?: boolean;
  /** Persisted value override ("See report" pattern); field value gates the write. */
  valueTemplate?: string;
  reportFieldId?: string;
  /** Static units from the selected MOIS measure; unitsFieldId wins when populated. */
  units?: string;
  unitsFieldId?: string;
  unitsInline?: boolean;
  conditionalFieldId?: string;
  /** When set, the conditionalFieldId gate becomes "value in this set"
   *  (code-aware) instead of a bare truthy check. */
  conditionalValues?: string[];
  condition?: BuilderWorkflowOutputDefinition["condition"];
  commentTemplate?: string;
  rangeNormalLow?: string;
  rangeNormalHigh?: string;
  rangeAbsurdLow?: string;
  rangeAbsurdHigh?: string;
  referenceRangeText?: string;
}

export type BuilderAlayaCareFieldType =
  | "risk"
  | "demographics"
  | "vital"
  | "medication20"
  | "progress_notes"
  | "care_plan"
  | "drawing"
  | "hyperlink"
  | "information"
  | "medical_history"
  | "medication"
  | "oasis_autocomplete"
  | "picture"
  | "score"
  | "subform"
  | "subsection"
  | "wound_healing";

export interface BuilderAlayaCareConfig {
  /**
   * Optional explicit AlayaCare field type override. Useful for specialized
   * AlayaCare-native fields that do not map 1:1 to generic builder types.
   */
  fieldType?: BuilderAlayaCareFieldType | null;
  /** Original numeric field ID retained when importing an AlayaCare form. */
  sourceFieldId?: number | null;
  /** Original rank retained for lossless import/edit/export ordering. */
  sourceRank?: number | null;
  /** Original instructions value, preserving the distinction between null and an empty string. */
  sourceInstructions?: string | null;
  /** Optional exported field_tag value. */
  fieldTag?: string | null;
  /** Optional exported task_field value. */
  taskField?: boolean;
  /** AlayaCare demographics setting: field_name */
  demographicsFieldName?: string | null;
  /** AlayaCare demographics setting: input_type */
  demographicsInputType?: string | null;
  /** AlayaCare vital setting: vital */
  vitalType?: string | null;
  /** AlayaCare hyperlink setting: url */
  hyperlinkUrl?: string | null;
  /** AlayaCare hyperlink setting: link_label */
  hyperlinkLabel?: string | null;
  /** AlayaCare care plan setting: section */
  carePlanSection?: string | null;
  /** AlayaCare medical history setting: section */
  medicalHistorySection?: string | null;
  /** AlayaCare score setting: expanded_formula */
  scoreExpandedFormula?: string | null;
  /** AlayaCare score setting: decimals */
  scoreDecimals?: number | null;
  /** AlayaCare drawing setting: imageType */
  drawingImageType?: string | null;
  /** AlayaCare progress notes setting: progress_note_type */
  progressNoteType?: string | null;
  /** Unmodeled AlayaCare settings retained for lossless import/edit/export. */
  rawSettings?: Record<string, unknown> | null;
  /** Original AlayaCare JSON Logic retained when it cannot be represented by the simple builder visibility editor. */
  rawJsonLogic?: Record<string, unknown> | null;
  /** Docmosis image placeholder variable used in LibreOffice templates. */
  docmosisImageVariable?: string | null;
  /** Docmosis collection path for generating repeating table rows, for example comments or service_tasks. */
  docmosisRepeatPath?: string | null;
  /** Table behavior for LibreOffice Docmosis templates. */
  docmosisTableMode?: "static" | "comments" | "manual" | "none" | null;
  /** Docmosis expression override used for computed/template-only output. */
  docmosisExpression?: string | null;
  /** Optional Docmosis numFormat pattern, for example '#.00' or '$###0.00'. */
  docmosisNumberFormat?: string | null;
  /** Optional manual Docmosis visibility expression, without surrounding cs_/cr_ tags. */
  docmosisVisibilityCondition?: string | null;
  /**
   * Render this source-backed value only in the AlayaCare custom template instead
   * of exporting it as a question in the AlayaCare form definition.
   */
  templateOnly?: boolean;
  /**
   * AlayaCare/Docmosis data path for a template-only value, for example
   * `client.last_name` or the flat system value `date_of_birth`.
   */
  docmosisDataPath?: string | null;
  /** Imported from AlayaCare as read-only because editing support is limited. */
  importReadOnly?: boolean;
  /** Human-readable reason shown in the inspector when importReadOnly is true. */
  importReadOnlyReason?: string | null;
}

export interface BuilderFhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface BuilderFhirObservationHistoryConfig {
  enabled?: boolean;
  display?: "chart" | "table" | "both";
  /** Other local/FHIR codes that represent the same clinical series. */
  equivalentCodes?: BuilderFhirCoding[];
  /** Unit used to normalize compatible numeric observations for display. */
  canonicalUnit?: BuilderFhirCoding;
  aggregation?: "none" | "day" | "week" | "month" | "quarter" | "year";
}

export interface BuilderLoincPanelMetadata {
  releaseVersion?: string;
  rootCode: string;
  parentCode?: string;
  sequence?: number;
  observationId?: string;
  observationRequired?: string;
  entryType?: string;
  skipLogicHelpText?: string;
  conditionForInclusion?: string;
  allowableAlternative?: string;
  context?: string;
  consistencyChecks?: string;
  relevanceEquation?: string;
  codingInstructions?: string;
  questionCardinality?: string;
  answerCardinality?: string;
  answerListId?: string;
  answerListType?: string;
  externalCopyrightNotice?: string;
}

export interface BuilderFhirConfig {
  /** Original FHIR Questionnaire.item.linkId before local builder id normalization. */
  linkId?: string;
  /** Original FHIR Questionnaire.item.type. */
  itemType?: string;
  /** Original FHIR Questionnaire.item.definition canonical element URL. */
  definition?: string;
  /** FHIR Questionnaire.item.code values such as LOINC question or score codes. */
  code?: BuilderFhirCoding[];
  /** FHIR answerValueSet URI when options are externally defined. */
  answerValueSet?: string;
  /** FHIR itemControl code such as gtable, slider, check-box, or radio-button. */
  itemControl?: string;
  /** SDC/FHIRPath calculated expression, if present. */
  calculatedExpression?: string;
  /** Local builder computed expression preserved in FHIR via a custom extension.
   *  This is intentionally separate from SDC calculatedExpression because the
   *  builder expression language is not guaranteed to be valid FHIRPath. */
  builderCalculatedExpression?: string;
  /** SDC/FHIRPath initial expression, if present. */
  initialExpression?: string;
  /** SDC/FHIRPath answer expression, if present. */
  answerExpression?: string;
  /** SDC/FHIRPath enableWhen expression, if present. */
  enableWhenExpression?: string;
  /** FHIR entryFormat display hint. */
  entryFormat?: string;
  /** FHIR answerConstraint code, for example optionsOnly. */
  answerConstraint?: string;
  /** Preferred terminology server URI for terminology-backed answers. */
  preferredTerminologyServer?: string;
  /** Full FHIR Questionnaire.item.enableWhen clauses preserved on import. */
  enableWhen?: FhirQuestionnaireEnableWhen[];
  /** Full FHIR Questionnaire.item.enableBehavior preserved on import. */
  enableBehavior?: "all" | "any";
  /** Unit choices for quantity-like items. */
  unitOptions?: BuilderFhirCoding[];
  /** Single display/unit coding for quantity-like items. */
  unit?: BuilderFhirCoding;
  /** Author explicitly accepted a valid but non-recommended LOINC/UCUM unit. */
  unitOverrideAcknowledged?: boolean;
  unitOverrideReason?: string;
  /** SDC extraction flags are explicit; a LOINC coding alone never implies extraction. */
  observationExtract?: boolean;
  observationLinkPeriod?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  /** Optional history/flowsheet presentation fed from the same clinical binding. */
  history?: BuilderFhirObservationHistoryConfig;
  /** Original FHIR answerOption array, including non-Coding value[x] options. */
  answerOption?: FhirQuestionnaireAnswerOption[];
  /** Full FHIR Questionnaire.item.initial array preserved on import for lossless
   *  round-trip of complex default values (coding with system, quantity, etc.).
   *  The editable scalar default lives on BuilderField.prefill. */
  initial?: FhirQuestionnaireInitialValue[];
  /** Resolved canonical URL or `#fragment` of a contained ValueSet whose concepts
   *  were expanded into the field's options on import. Kept so export can rebind
   *  answerValueSet and round-trip the contained resource. */
  answerValueSetBinding?: string;
  /** Expanded/materialized ValueSet used to populate static builder/MOIS options.
   *  Stored on the field so persisted builder JSON can re-export a self-contained
   *  FHIR Questionnaire even after the original import WeakMap is gone. */
  answerValueSetExpansion?: FhirValueSet;
  /** Original FHIR prefix, for example "1.". */
  prefix?: string;
  /** Preserved extension URLs that do not yet map to a native builder setting. */
  extensionUrls?: string[];
  /** Full imported item extensions. Controlled extensions are regenerated from
   *  editable settings; all other payloads are retained losslessly. */
  preservedExtensions?: Array<{ url: string; [key: string]: unknown }>;
  /** Serialized Questionnaire-level metadata, stored on the first imported
   *  root field so it survives ordinary builder JSON/share persistence. */
  questionnaireRoot?: Record<string, unknown>;
}

/**
 * Per-language translation overrides for a single field. Keys mirror the field's
 * authoring surface; `options` is keyed by the option's stored value/code so a
 * label rename never detaches its translation. Serialized to FHIR via the
 * standard `translation` extension on the element's `_text`/`_display` sibling.
 */
export interface BuilderFieldTranslation {
  label?: string;
  helpText?: string;
  placeholder?: string;
  /** Map of option stored-value/code → translated display text. */
  options?: Record<string, string>;
}

export type BuilderDateValidationUnit = "days" | "weeks" | "months" | "years";

/**
 * A date bound expressed relative to "today", e.g. "today − 18 years" for an
 * age gate or "today" for a no-future-date limit. Serialized to FHIR as a
 * minValue/maxValue extension carrying a `text/fhirpath` valueExpression
 * (the SDC/Helse-Norge convention Phoenix uses), e.g. `today() - 18 years`.
 */
export interface BuilderRelativeDateConstraint {
  /** Anchor for the computation. Only "today" is supported today. */
  anchor: "today";
  /** Direction of the offset; omit (or use "exact") for exactly the anchor. */
  direction?: "before" | "after" | "exact";
  /** Magnitude of the offset. Ignored when direction is "exact". */
  value?: number;
  /** Calendar unit of the offset. Ignored when direction is "exact". */
  unit?: BuilderDateValidationUnit;
}

/**
 * A choice option. Historically options were stored as bare label strings; they
 * may now also be objects carrying a per-option `score` (and optional distinct
 * stored `value`). Both shapes coexist in the same array — always read through
 * the helpers in form-builder/shared/choice-options.ts rather than assuming a
 * string, so the score stays co-located with its label (no parallel drift).
 */
export interface BuilderChoiceOptionObject {
  label: string;
  /** Stored value, when it differs from the label. Defaults to the label. */
  value?: string;
  /** Numeric score used by computed `score([id])` formulas. */
  score?: number;
  /** Optional helper text shown in option editors. */
  description?: string;
}

export type BuilderChoiceOption = string | BuilderChoiceOptionObject;

export interface BuilderLegacySourceIdentity {
  formId: string;
  subformId?: string;
  fieldName: string;
  fid: string;
  /** MOIS picker window that produced the filled tdt_dform_data row. */
  dformWindowId?: string;
  /** Runtime str_field_code observed in filled tdt_dform_data rows. */
  dformFieldCode?: string;
  /** Runtime data type observed for the field in filled dform instances. */
  dformDataType?: string;
}

export interface BuilderFieldSourceContract {
  version: 1;
  origin: "legacy-dform" | "fixture-layout" | "generated-enrichment";
  identity: BuilderLegacySourceIdentity | null;
  /** Helper columns/actions absorbed into this composite field during materialization. */
  consolidatedSources?: Array<{
    fieldName: string;
    subformId?: string;
    role: "history-value" | "history-date" | "history-other" | "graph";
    tags: Record<string, string>;
  }>;
  storedOptions?: Array<{
    label: string;
    value: string | number | boolean;
    targetFieldId?: string;
    offValue?: string | number | boolean;
    identity?: BuilderLegacySourceIdentity;
  }>;
  visibility: {
    default: "always" | "hidden" | "field-rule" | "unspecified";
    asTarget: Array<{
      ruleId: string;
      controllerFieldId: string;
      action: string;
    }>;
    asController: Array<{
      ruleId: string;
      targetFieldIds: string[];
      action: string;
    }>;
    /** Original DataWindow tags retained even when their behavior is unresolved. */
    legacyTags?: Record<string, string>;
  };
  read: {
    source: "none" | "patient-chart" | "observation-history" | "form-history" | "mois-lookup";
    patientPath?: string;
    observationCode?: string;
    legacyFieldId?: string;
    lookupType?: string;
    valuePath?: string;
    aspect?: string;
  };
  write: {
    /** What the materialized Webforms runtime currently writes. */
    destination:
      | "none"
      | "form-data"
      | "observation"
      | "observation-and-form-data"
      | "multi-target-form-data";
    fieldId?: string;
    observationCode?: string;
    targetFieldIds?: string[];
    /** Destination declared by the original dump mapping, when one was present. */
    sourceDestination?: "form-data" | "observation" | "chart-update" | "unresolved";
    sourceObject?: string;
    sourceColumn?: string;
  };
  /** Known source behavior that is retained as evidence but not yet executable. */
  unresolved: string[];
}

export interface BuilderField {
  id: string;
  label: string;
  type: BuilderFieldType;
  /**
   * Stable concept ID from the curated MOIS ↔ AlayaCare mapping catalog.
   * Native exporter settings remain in moisOutput/layout contracts and
   * alayaCareConfig; this ID records why those two bindings belong together.
   */
  crossPlatformMappingId?: string | null;
  /** Stable identity retained from a legacy Dynamic Form column. */
  legacySource?: BuilderLegacySourceIdentity | null;
  /** Self-contained provenance/read/write/visibility contract for imported fields. */
  sourceContract?: BuilderFieldSourceContract | null;

  // AlayaCare-specific export metadata
  alayaCareConfig?: BuilderAlayaCareConfig | null;

  // FHIR Questionnaire import/export metadata
  fhirConfig?: BuilderFhirConfig | null;

  /** Instance metadata when this field was created from LOINC Panels and Forms. */
  loincPanel?: BuilderLoincPanelMetadata | null;

  /**
   * Per-language translations, keyed by BCP-47 language code (e.g. "fr-CA").
   * Round-trips through FHIR `translation` extensions on item.text / option
   * display. The untranslated base text stays on label/helpText/options.
   */
  translations?: Record<string, BuilderFieldTranslation> | null;

  // Common field settings
  required?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  lockWhenSectionComplete?: boolean;
  lockWhen?: BuilderLockWhenRule | null;
  width?: FieldWidth;
  labelPosition?: "top" | "left" | "none";
  placeholder?: string;
  helpText?: string;
  helpPosition?: HelpPosition;
  prefill?: FieldPrefillValue;
  pdfFieldAliases?: string[];
  page?: number;
  bbox?: BoundingBox;
  widgets?: WidgetGeometry[];
  /** Selection-assistant answer sync group for repeated fields across sections/pages. */
  linkedAnswerGroupId?: string | null;
  /** Field IDs that should receive the same answer as this visible field. */
  linkedAnswerFieldIds?: string[];

  // Choice field settings
  // Options accept either a bare label string (legacy) or a structured object
  // carrying a per-option score. The two shapes are interchangeable everywhere
  // via the helpers in form-builder/shared/choice-options.ts — keep reads going
  // through those (getOptionLabel/getOptionScore) so the union stays transparent.
  options?: BuilderChoiceOption[] | null;
  choiceStyle?:
    | "dropdown"
    | "radio"
    | "multiselect"
    | "checkbox"
    | "simpleCodeSelect"
    | "findCode";
  /** Layout of radio/checklist answers inside a SimpleCodeChecklist field. */
  choiceAnswerLayout?: "vertical" | "responsive" | "columns-2" | "columns-3" | "columns-4";
  /** MOIS control density for coded selection controls. */
  moisSize?: string;
  /** MOIS per-answer density for radio/checklist controls. */
  moisOptionSize?: string;
  codeSystem?: string | null; // MOIS code system (e.g., "MOIS-MARITALSTATUS")
  showOtherOption?: boolean; // Allow "Other" option with custom input
  /** MOIS keyboard shortcuts (autoHotKey) on coded selects/checklists. */
  autoHotKey?: boolean;
  allowCreation?: boolean; // Allow users to add new options
  shuffleOptions?: boolean; // Randomize option order
  minSelection?: number; // Min selections for multiselect
  maxSelection?: number; // Max selections for multiselect

  // Component field settings
  componentKey?: string | null;
  componentTitle?: string | null;
  componentDescription?: string | null;
  componentProps?: {
    nhformsExport?: string;
    showLegend?: boolean;
    showInlineLabels?: boolean;
    scaleOptions?: Array<{
      value: number;
      label: string;
      description?: string;
    }>;
    [key: string]: unknown;
  } | null;

  // Boolean field settings
  booleanLabels?: { on: string; off: string } | null;
  booleanNeutralMode?: "cycle" | "initial" | "none";
  useToggleSwitch?: boolean;

  // Visibility/logic settings
  visibility?: BuilderVisibilityRule | null;

  // Direct MOIS submit/export mapping. This makes legacy getSaveData/signSubmit
  // observation behavior editable without requiring a custom component wrapper.
  moisOutput?: BuilderMoisOutputMapping | null;

  // Table field config
  tableConfig?: {
    columns: Array<{
      id: string;
      label: string;
      type: BuilderTableColumnType;
      booleanLabels?: { on: string; off: string } | null;
      prefill?: FieldPrefillValue;
      useToggleSwitch?: boolean;
      numberConfig?: {
        typeNumber: "number" | "decimal" | "year";
        suffix?: string;
        buttonControls?: boolean;
        storeAsNumber?: boolean;
        spinButtonProps?: {
          min?: number;
          max?: number;
          step?: number;
        };
      } | null;
      options?: BuilderChoiceOption[] | null;
      choiceStyle?:
        | "dropdown"
        | "radio"
        | "multiselect"
        | "checkbox"
        | "simpleCodeSelect"
        | "findCode";
      codeSystem?: string | null;
      showOtherOption?: boolean;
      dataPath?: string | null;
      showInTable?: boolean;
      showInModal?: boolean;
      computedValue?: {
        mode: "template";
        template: string;
        sourcePaths?: string[];
        emptyBehavior?: "omit" | "blank";
        parts?: Array<
          | { id?: string; kind: "text"; text: string }
          | { id?: string; kind: "answer"; path: string }
        >;
      } | null;
      visibility?: BuilderVisibilityRule | null;
      moisTargetId?: string | null;
      stampConfig?: {
        sourcePath?: string;
        value?: string | number | boolean | null;
        fallback?: string | number | boolean | null;
        signedAtPath?: string | null;
        buttonLabel?: string;
        signedLabel?: string;
        allowResign?: boolean;
        showStatus?: boolean;
        lockRowUntilPersisted?: boolean;
      } | null;
    }>;
    mode?: BuilderTableMode;
    orientation?: "horizontal" | "vertical";
    allowAddRows?: boolean;
    allowRemoveRows?: boolean;
    allowEditRows?: boolean;
    maxRows?: number | null;
    initialRows?: number;
    addButtonText?: string;
    modalTitle?: string;
    uniqueBy?: string[];
    sourceFieldIds?: Record<string, string>;
    sourceFieldIdsByRow?: Record<number, Record<string, string>>;
    modalEditorPresetId?: string;
    modalEditorConfig?: Record<string, unknown> | null;
  } | null;

  // Static legacy layout table config. This controls exact printable table
  // cells and can embed simple field controls inside cells.
  layoutTableConfig?: BuilderLayoutTableConfig | null;

  // Rating field config
  ratingConfig?: {
    maxStars: number;
  } | null;

  // Number field config
  numberConfig?: {
    /** Type of number validation: 'number' (integer), 'decimal', or 'year' */
    typeNumber: "number" | "decimal" | "year";
    /** Optional unit suffix rendered inside the input (for example: cm, bpm, %) */
    suffix?: string;
    /** Show spin button controls */
    buttonControls?: boolean;
    /** Store value as number instead of string */
    storeAsNumber?: boolean;
    /** SpinButton props for min, max, step */
    spinButtonProps?: {
      min?: number;
      max?: number;
      step?: number;
    };
  } | null;

  // Computed/formula field config
  calculatedValue?: CalculatedValueConfig | null;
  computedConfig?: {
    /** Arithmetic expression using field IDs, e.g. score_a + score_b or [field-1] / 2 */
    expression: string;
    /** Optional decimal precision applied to the computed result */
    precision?: number;
    /** Whether the computed value is stored/rendered as a number or formatted text */
    resultType?: "number" | "text";
    /** Defaults to always-calculated for backward compatibility. */
    calculationPolicy?: CalculatedValuePolicy;
    /** Show a score interpretation after referenced fields have values */
    showInterpretation?: boolean;
    /** Score interpretation ranges or thresholds */
    interpretation?: {
      label?: string;
      ranges: Array<{
        min?: number;
        max?: number;
        label: string;
        description?: string;
      }>;
    } | null;
    /** Persist this value as the MOIS calculated observation on submit. */
    moisCalculated?: MoisCalculatedObservationConfig | null;
  } | null;

  // Slider field config
  sliderConfig?: {
    min: number;
    max: number;
    step: number;
  } | null;

  // Scale field config (similar to slider but different UI)
  scaleConfig?: {
    min: number;
    max: number;
    step: number;
    minLabel?: string;
    maxLabel?: string;
    /** Style of scale: 'numeric' for simple min/max, 'labeled' for HoNOS-style with options */
    style?: "numeric" | "labeled";
    /** Show legend row above the scale */
    showLegend?: boolean;
    /** Show option labels next to the radio buttons */
    showInlineLabels?: boolean;
    /** Show option descriptions in a tooltip */
    showTooltip?: boolean;
    /** Show only the hovered option description or the full scale definition list */
    tooltipMode?: "option" | "all";
    /** Custom scale options with labels and descriptions (for labeled style) */
    options?: Array<{
      value: number;
      label: string;
      description?: string;
    }>;
  } | null;

  // Textarea field config
  textareaConfig?: {
    rows: number;
    maxCharLimit?: number;
    showCharLimit?: boolean;
    multiline?: boolean;
    borderless?: boolean;
    resizable?: boolean;
    labelPosition?: "top" | "left" | "none";
  } | null;

  // File upload config
  fileConfig?: {
    accept: string[];
    maxSize?: number; // in MB
    multiple?: boolean;
    cameraUpload?: boolean;
  } | null;

  // Time field config
  timeConfig?: {
    format: "12h" | "24h";
  } | null;

  // Date field config
  dateConfig?: {
    withTime?: boolean;
    dateRange?: boolean;
    dateFormat?: "yyyy.MM.dd" | "dd/MM/yyyy" | "MM-dd-yyyy" | "yyyy-MM-dd";
    disablePastDates?: boolean;
    disableFutureDates?: boolean;
    prefillToday?: boolean;
    minDate?: string;
    maxDate?: string;
    /** Earliest allowed date expressed relative to today (FHIRPath minValue). */
    relativeMinDate?: BuilderRelativeDateConstraint | null;
    /** Latest allowed date expressed relative to today (FHIRPath maxValue). */
    relativeMaxDate?: BuilderRelativeDateConstraint | null;
    borderless?: boolean;
    buttonControls?: boolean;
    showAge?: boolean;
    vertical?: boolean;
  } | null;

  // Phone field config
  phoneConfig?: {
    useSimpleInput?: boolean;
    defaultCountry?: string;
    excludeCountries?: string[];
    allowExtension?: boolean;
    extensionPlaceholder?: string;
    extensionFieldId?: string;
  } | null;

  // Hyperlink field config
  hyperlinkConfig?: {
    href?: string;
    label?: string;
    target?: "_blank" | "_self" | "_parent" | "_top";
    displayStyle?: "button" | "inline";
  } | null;

  // Matrix field config
  matrixConfig?: {
    rows: string[];
    columns: string[];
    multiplePerRow?: boolean;
    autoNumberRows?: boolean;
    rowLabelStyle?: "numbers" | "letters";
  } | null;

  // Barcode field config
  barcodeConfig?: {
    decoders: Array<"qr" | "ean" | "ean8" | "upc" | "upc_e" | "code128" | "code39">;
  } | null;

  // Section config (for grouping fields)
  sectionConfig?: SectionConfig | null;

  // Heading config (less prominent than section subtitle, groups child fields)
  headingConfig?: {
    /** Child field IDs rendered indented below the heading */
    childFieldIds: string[];
    /** Optional MOIS windows client module link */
    navigationTarget?: MoisNavigationTarget | null;
    /** @deprecated Prefer navigationTarget */
    moisModule?: string | null;
  } | null;

  // Text field config (for text, email, url, password)
  textConfig?: {
    maxCharLimit?: number;
    showCharLimit?: boolean;
    /** Optional unit suffix rendered inside the input (for example: cm) */
    suffix?: string;
    secretInput?: boolean; // Hide with asterisks
  } | null;

  // Rich text / markdown field config
  richTextConfig?: {
    source?: string | null;
    readOnly?: boolean;
    borderless?: boolean;
    startingMode?: "edit" | "preview" | "default";
    height?: number | null;
  } | null;

  // Validation rules
  validation?: BuilderValidationConfig | null;
}

/** Subgroup within a section (simplified for form builder) */
export interface SectionSubgroup {
  id: string;
  name: string;
  showHeading?: boolean;
  /** Layout type for subgroup rendering (aligned with group-layout) */
  layoutType?: "table" | "grid" | "list";
  /** Parent subgroup id when nesting is used */
  parentId?: string | null;
  /** Render subgroup with card styling */
  showCard?: boolean;
  /** Created by assistant (used for UI badges) */
  createdByAssistant?: boolean;
}

export interface AuthorshipPolicyConfig {
  enabled?: boolean;
  granularity?: "field" | "row";
  lockOn?: "save" | "sign" | "submit";
  editableWindowHours?: number;
  showStatusColumn?: boolean;
}

/** Section configuration for grouping fields */
export interface SectionConfig {
  title?: string;
  description?: string;
  /** Optional CSS background for the section subtitle bar. Supports colors and gradients. */
  subtitleBackground?: string;
  /** Optional CSS border for the section subtitle bar. */
  subtitleBorder?: string;
  /** Optional CSS padding for the section subtitle bar. */
  subtitlePadding?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  childFieldIds: string[];
  /** Layout type: "grid" for side-by-side fields, "stacked" for vertical column */
  layoutType?: "grid" | "stacked";
  /** Number of columns per row when in grid layout (1-4, default 2) */
  gridColumns?: 1 | 2 | 3 | 4;
  /** Optional section override; omitted inherits the form-wide question spacing. */
  questionSpacing?: FormQuestionSpacing;
  /** Show a shared scale legend at the top of the section */
  showScaleLegend?: boolean;
  /** Scale legend options (if not provided, uses first scale field's options) */
  scaleLegendOptions?: Array<{
    value: number;
    label: string;
    description?: string;
  }>;
  /** Preset scale type for the legend */
  scaleLegendPreset?: "honos" | "likert5" | "likert7" | "nrs" | "frequency" | "satisfaction" | "severity" | "custom";
  /** Subgroups within this section for visual grouping */
  subgroups?: SectionSubgroup[];
  /** Map of fieldId → subgroupId for assigning fields to subgroups */
  fieldSubgroupMap?: Record<string, string>;
  /** Optional multi-author locking policy for fields in this section */
  authorshipPolicy?: AuthorshipPolicyConfig;
  /** Optional MOIS windows client module link rendered in the section subtitle */
  navigationTarget?: MoisNavigationTarget | null;
  /** @deprecated Prefer navigationTarget */
  moisModule?: string | null;
}

// Column configuration for layout
export interface ColumnConfig {
  id: string;
  width: "1/2" | "1/3" | "1/4" | "2/3" | "3/4" | "auto";
  fieldIds: string[]; // IDs of fields in this column
}

// Tab configuration for tabs layout
export interface TabConfig {
  id: string;
  label: string;
  fieldIds: string[]; // IDs of fields in this tab
}

// Non-input block interface
export interface BuilderBlock {
  id: string;
  type: BuilderBlockType;

  // Text block settings
  content?: string;

  // Image block settings
  imageUrl?: string;
  imageAlt?: string;

  // Video block settings
  videoUrl?: string;
  videoType?: "youtube" | "vimeo" | "mp4";

  // Code block settings
  code?: string;

  // Page break settings
  nextButtonText?: string;
  previousButtonText?: string;

  // Common block settings
  width?: FieldWidth;
  alignment?: "left" | "center" | "right";

  // Layout block settings
  // Columns
  columns?: ColumnConfig[];
  columnGap?: "none" | "small" | "medium" | "large";

  // Tabs
  tabs?: TabConfig[];
  tabStyle?: "underline" | "pills" | "boxed";

  // Panel
  panelTitle?: string;
  panelDescription?: string;
  panelCollapsible?: boolean;
  panelDefaultCollapsed?: boolean;
  panelStyle?: "default" | "bordered" | "elevated" | "filled";
  fieldIds?: string[]; // Fields inside the panel/fieldset/well

  // Fieldset
  fieldsetLegend?: string;

  // Well (simple container)
  wellStyle?: "light" | "dark" | "bordered";
}

export type FieldVisibilityMode = "inherit" | "always" | "controller";

export interface FieldVisibilityRule {
  mode: FieldVisibilityMode;
  controllerFieldId?: string;
  showWhen?: "yes" | "no";
}

/**
 * Behavior when toggling a logic gate would hide fields that contain data
 * - 'allow': No warning, changes happen immediately (data preserved but hidden)
 * - 'warn': Show confirmation dialog before hiding fields with data
 * - 'prevent': Block the change until affected fields are cleared
 */
export type GateChangeWarningMode = "allow" | "warn" | "prevent";

export interface BranchingRule {
  controllerFieldId: string;
  showWhen: "yes" | "no";
  fieldRules?: Record<string, FieldVisibilityRule>;
  /** If set, indicates this rule was cascaded from a parent subgroup */
  inheritedFromParent?: string;
  /** How to handle toggling this gate when child fields have data. Default: 'warn' */
  onDataConflict?: GateChangeWarningMode;
}

/**
 * Condition types for field linking rules
 */
export type FieldLinkConditionType =
  | "boolean-yes"       // Boolean field is checked/yes
  | "boolean-no"        // Boolean field is unchecked/no
  | "choice-selected"   // Specific choice option is selected
  | "choice-not-selected" // Specific choice option is NOT selected
  | "number-gt"
  | "number-gte"
  | "number-lt"
  | "number-lte"
  | "number-equals"
  | "equals"
  | "not-equals"
  | "filled"            // Field has any value
  | "empty";            // Field is empty/undefined

export interface FieldLinkCondition {
  type: FieldLinkConditionType;
  /** For choice conditions, which option value(s) to check */
  optionValues?: string[];
  /** For numeric and equality conditions. */
  value?: string | number | boolean | null;
}

/**
 * Actions that can be taken when a field link condition is met
 */
export type FieldLinkAction =
  | "show"
  | "hide"
  | "copy-value"
  | "set-required"
  | "clear-required"
  | "set-readonly"
  | "clear-readonly";

/**
 * A rule that links one field's value to another field's visibility or value
 * Example: "When 'No Allergies' is checked, hide 'List Allergies'"
 * Example: "When 'Same as Partner' is checked, hide 'Bio Father Surname'"
 * Example: "When 'ART Specify' has 'IVF' selected, show 'IVF Details'"
 */
export interface FieldLinkRule {
  id: string;
  /** The field whose value triggers the rule */
  controllerFieldId: string;
  /** The condition that triggers the action */
  condition: FieldLinkCondition;
  /** Additional conditions evaluated together with the primary pair. */
  additionalConditions?: Array<{ controllerFieldId: string; condition: FieldLinkCondition }>;
  /** How the primary + additional conditions combine. Default "all". */
  conditionMatch?: "all" | "any";
  /** The field(s) affected by this rule */
  targetFieldIds: string[];
  /** What happens when condition is met */
  action: FieldLinkAction;
  /**
   * How read-only actions are applied to exported controls. "both" is the
   * generic default because MOIS components vary in which prop they honor.
   */
  protectionMode?: "readOnly" | "disabled" | "both";
  /** For copy-value action, the source field to copy from */
  copyFromFieldId?: string;
  /** Optional description for UI display */
  description?: string;
}

export type MoisFormType =
  | "ATTACHMENT"
  | "CALCULATOR"
  | "FLOWSHEET"
  | "WEBCLIENT"
  | "TEST";

export const MOIS_FORM_TYPE_OPTIONS: Array<{ value: MoisFormType; label: string }> = [
  { value: "ATTACHMENT", label: "Attachment" },
  { value: "CALCULATOR", label: "Calculator" },
  { value: "FLOWSHEET", label: "Flowsheet" },
  { value: "WEBCLIENT", label: "Web client" },
  { value: "TEST", label: "Test" }
];

export const DEFAULT_MOIS_FORM_TYPE: MoisFormType = "ATTACHMENT";

export const starterBuilderFields: BuilderField[] = [
  {
    id: "section-1",
    label: "Patient Information",
    type: "section",
    sectionConfig: {
      title: "Patient Information",
      description: "Basic patient details",
      collapsible: true,
      defaultCollapsed: false,
      childFieldIds: ["field-1", "field-2", "field-3", "field-4"]
    }
  },
  { id: "field-1", label: "Patient Full Name", type: "text" },
  { id: "field-2", label: "PHN", type: "number" },
  { id: "field-3", label: "EDD (weeks)", type: "date" },
  { id: "field-4", label: "Has allergies?", type: "booleanYesNo", booleanLabels: { on: "Yes", off: "No" } }
];

export const defaultBuilderFields: BuilderField[] = [
  {
    id: "section-default",
    label: "Form Details",
    type: "section",
    sectionConfig: {
      title: "Form Details",
      description: "Default section for fields added to a new blank form.",
      collapsible: true,
      defaultCollapsed: false,
      childFieldIds: [],
      subgroups: [],
      fieldSubgroupMap: {},
    },
  },
];

// Form Design / Styling types
export type FormTheme = "default" | "minimal" | "bordered" | "shadowed" | "notion" | "transparent";
export type FormDarkMode = "auto" | "light" | "dark";
export type FormInputSize = "sm" | "md" | "lg";
export type FormBorderRadius = "none" | "small" | "full";
export type FormLabelPosition = "top" | "left" | "floating";
export type FormWidth = "centered" | "full";
export type FormQuestionSpacing = "compact" | "standard" | "comfortable" | "spacious";
export type FormPresentationStyle = "classic" | "focused";
export type BuilderFormPresentation = "standard" | "investigation";
export type CaptchaProvider = "recaptcha" | "hcaptcha" | "none";

export const DEFAULT_BUILDER_FORM_PRESENTATION: BuilderFormPresentation = "standard";

export interface FormDesign {
  // Appearance
  theme: FormTheme;
  accentColor: string;
  darkMode: FormDarkMode;
  inputSize: FormInputSize;
  borderRadius: FormBorderRadius;
  labelPosition: FormLabelPosition;
  showProgressBar: boolean;

  // Layout
  formWidth: FormWidth;
  /** Vertical spacing between questions. Standard matches the native MOIS 8px field margin. */
  questionSpacing?: FormQuestionSpacing;
  rtlLayout: boolean;
  uppercaseLabels: boolean;

  // Typography
  fontFamily?: string; // Google Fonts name

  // Branding
  logoPicture?: string;
  coverPicture?: string;
  noBranding?: boolean;

  // Presentation
  presentationStyle: FormPresentationStyle;
  showNavigationArrows?: boolean; // For focused mode
}

export interface FormSettings {
  // Submission behavior
  submitButtonText: string;
  nextButtonText?: string; // For focused mode
  redirectUrl?: string;
  successMessage: string;
  allowResubmit: boolean;
  resubmitButtonText?: string;

  // Security & access
  password?: string;
  closesAt?: string; // ISO date
  closedMessage?: string;
  maxSubmissions?: number;
  maxSubmissionsMessage?: string;
  useCaptcha: boolean;
  captchaProvider: CaptchaProvider;

  // Advanced
  autoSave: boolean;
  editableSubmissions: boolean;
  editSubmissionButtonText?: string;
  enablePartialSubmissions?: boolean;
  enableIpTracking?: boolean;

  // SEO
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;

  // Custom code
  customCss?: string;
  customJs?: string;
}

export const defaultFormDesign: FormDesign = {
  theme: "default",
  accentColor: "#3B82F6",
  darkMode: "auto",
  inputSize: "md",
  borderRadius: "small",
  labelPosition: "top",
  showProgressBar: false,
  formWidth: "centered",
  questionSpacing: "standard",
  rtlLayout: false,
  uppercaseLabels: false,
  presentationStyle: "classic",
};

export const defaultFormSettings: FormSettings = {
  submitButtonText: "Submit",
  successMessage: "Thank you for your submission!",
  allowResubmit: false,
  useCaptcha: false,
  captchaProvider: "none",
  autoSave: false,
  editableSubmissions: false,
};

/** Canonical builder document; UI layers supply their concrete layout-draft type. */
export interface BuilderDocument<TLayoutDraft = unknown> {
  name: string;
  fields: BuilderField[];
  design: FormDesign;
  identityType: MoisFormType;
  identityCode: string;
  formPresentation?: BuilderFormPresentation;
  investigationTabs?: BuilderInvestigationTab[];
  investigationTabAssignments?: Record<string, string | null>;
  variants?: BuilderVariant<TLayoutDraft>[];
  activeVariantId?: string | null;
  variantSelector?: BuilderVariantSelectorConfig;
  drafts: TLayoutDraft[];
  branchingRules: Record<string, BranchingRule>;
  paginationEnabled: boolean;
  pageCount: number;
  pageNames?: string[];
  pageAssignments: Record<string, number | null>;
  workflow?: BuilderWorkflowConfig;
}

/**
 * Canonical persistence document. Transport-specific envelopes (session ZIPs,
 * share tokens, local storage, fixtures) should migrate to this shape before
 * application code consumes them.
 */
export interface WorkspaceDocumentV3<TLayoutDraft = unknown, TPreviewSettings = unknown> {
  version: 3;
  document: BuilderDocument<TLayoutDraft>;
  fieldLinkRules: FieldLinkRule[];
  preview?: TPreviewSettings;
  /** Namespaced compatibility data that is not part of the authoring domain. */
  extensions?: Record<string, unknown>;
}

export interface BuilderVariant<TLayoutDraft = unknown> {
  id: string;
  label: string;
  fields: BuilderField[];
  drafts: TLayoutDraft[];
  branchingRules: Record<string, BranchingRule>;
  paginationEnabled: boolean;
  pageCount: number;
  pageNames?: string[];
  pageAssignments: Record<string, number | null>;
  investigationTabs?: BuilderInvestigationTab[];
  investigationTabAssignments?: Record<string, string | null>;
}

export interface BuilderVariantSelectorConfig {
  label: string;
  style: "dropdown" | "buttons";
  displayMode?: "inline" | "changeButton";
}

export {
  compileFieldLinkConditionGroup,
  compileFieldLinkProtectionRule,
  compileFieldLinkVisibilityRule,
  evaluateFieldCondition,
  evaluateFieldLinkRuleCondition,
  isConditionValueEmpty,
  normalizeConditionBoolean,
  normalizeConditionChoiceValues,
  normalizeConditionComparable,
  type CompiledFieldLinkConditionGroup,
  type CompiledFieldLinkProtectionRule,
  type CompiledFieldLinkVisibilityRule,
  type FieldConditionMetadata,
  type FieldConditionMetadataLookup,
  type SerializedFieldLinkCondition,
} from "./conditions";

export {
  BUILDER_FIELD_DEFINITIONS,
  getBuilderFieldDefinition,
  type BuilderFieldCategory,
  type BuilderFieldDefinition,
  type BuilderFieldPalette,
} from "./field-definitions";

export * from "./choice-options";
export * from "./document";
export {
  DEFAULT_INVESTIGATION_FORM_TABS,
  INVESTIGATION_FORM_TAB_NAMES,
  createDefaultInvestigationTabs,
  createInvestigationTabId,
  normalizeInvestigationTabAssignments,
  normalizeInvestigationTabs,
  type BuilderInvestigationTab,
} from "./investigation-tabs";
export * from "./grouping";
export * from "./layout";
export { backfillOptionScoresFromFormula } from "./score-backfill";
export {
  type SessionFooterButtonConfig,
  type SessionPayload,
  type SessionPdfPayload,
  type SessionPreviewSettings,
  type SessionWorkflowSnapshot,
  type SessionXmlAttachment,
} from "./session";
