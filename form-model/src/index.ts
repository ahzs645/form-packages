import type { SmartTemplateDefinition, SmartTemplateLink } from "./smart-template";
export type { SmartTemplateLink } from "./smart-template";
export type { SmartTemplateDefinition, SmartTemplateComponent, SmartTemplateSelection, SmartTemplateLayout, SmartTemplateKind } from "./smart-template";
export type * from "./offline-authoring";
export * from "./subgroup-design";
export { resolveRichTextContent, resolveRichTextField } from "./rich-text-targets";
export type { RichTextTarget, RichTextContent, RichTextOverrides } from "./rich-text-targets";
/**
 * UI-independent authoring model shared by the builder, persistence codecs,
 * previews, and exporters. Keep this package free of app/component imports.
 */

import { BUILDER_FIELD_TYPES } from "./field-types";
import type { BoundingBox, FieldPrefillValue, WidgetGeometry } from "./document";
import type { BuilderInvestigationTab } from "./investigation-tabs";
import type { ReportItemFormat } from "./report-formats";

export { BUILDER_FIELD_TYPES } from "./field-types";
export {
  REPORT_ITEM_FORMATS,
  REPORT_ITEM_FORMAT_IDS,
  isReportItemFormat,
  resolveReportItemFormat,
} from "./report-formats";
export type { ReportItemFormat, ReportItemFormatSpec } from "./report-formats";

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
  /** Display matching prior chart observations without copying them into the computed answer. */
  showHistory?: boolean;
  /** Number of newest matching observations shown beneath the computed value. */
  historyMaxRows?: number;
  /** Label for the optional chart-history navigation affordance. Defaults to "Graph". */
  graphLinkText?: string;
  /** Optional MOIS/chart URL used by the Graph link. Text is still shown when this is empty. */
  graphHref?: string;
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

export type CalculatedValueDisplayStyle = "field" | "compact" | "prominent";

/**
 * What a calculation does before every referenced input has a value.
 *
 * Legacy MOIS calculators (BPI Severity/Interference/Relief, PEG, DLQI) paired
 * `IF (IsNull(...), 'Incomplete', '')` with mirrored visible expressions so a
 * partial total neither displayed nor persisted. "compute-anyway" is the
 * default because it is the behaviour every existing form already relies on.
 */
export type IncompleteCalculationBehavior =
  | "compute-anyway"
  | "show-text"
  | "hide";

export interface CalculatedValueConfig {
  id: string;
  label: string;
  expression: string;
  precision?: number;
  resultType?: "number" | "text";
  /** Visual presentation shared by regular computed fields and subform totals. */
  displayStyle?: CalculatedValueDisplayStyle;
  /** Whether to render displaySuffix beside the calculated value. */
  showDisplaySuffix?: boolean;
  /** Presentation-only units/text; never appended to the stored calculated value. */
  displaySuffix?: string;
  /** Controls whether the runtime owns the value, yields after a user edit, or only offers a suggestion. */
  calculationPolicy?: CalculatedValuePolicy;
  /** What to do before every referenced input has a value. Defaults to "compute-anyway". */
  incompleteBehavior?: IncompleteCalculationBehavior;
  /** Text shown in place of the total when incompleteBehavior is "show-text". */
  incompleteText?: string;
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
  valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
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
  answerAttachment?: { id?: string; contentType?: string; url?: string; title?: string; data?: string };
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

export type LlmProvider =
  | "openrouter"
  | "local-codex"
  | "local-claude"
  | "local-gemini";

export interface GroupPageStats {
  primaryPage: number | null;
  details: Array<{ page: number; count: number }>;
}

export interface SourceArchiveIdentity {
  path: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  depth: number;
}

export interface ParseMeta {
  title: string;
  sizeKB: number;
  pageCount: number;
  sourceArchiveName?: string | null;
  sourceArchiveType?: "zip" | "7z" | null;
  sourceArchiveIdentity?: SourceArchiveIdentity | null;
  sourceArchiveChain?: SourceArchiveIdentity[] | null;
  sourceDocumentSha256?: string | null;
  /** Saved OSCAR import review evidence so queues survive session reopen. */
  oscarCompatibility?: {
    backgroundPages: Array<{
      pageNumber: number;
      strategy: "packaged-image" | "generated-blank" | "html-native" | "html-native-rendered" | "user-supplied";
      projectionReady: boolean;
      reason?: string;
    }>;
    scriptReview: {
      classification: "standard-script-review" | "complex-manual-conversion";
      items: Array<{
        category: "already-supported" | "reconstructable" | "host-integration" | "clinically-sensitive" | "unsupported-obsolete";
        behavior: string;
        disposition: "supported" | "rebuild" | "host-adapter" | "clinical-review" | "do-not-port";
        evidence: string;
        implementationStatus?: "native" | "reviewable-rebuild" | "host-contract" | "clinical-gate" | "retired";
        targetCapability?: string;
      }>;
      reconstructionPlans?: Array<{
        id: string;
        kind: "native-date" | "checkbox-targets" | "dynamic-required";
        status: "converted" | "author-review";
        triggerControlId: string;
        targetControlIds: string[];
        evidence: string;
      }>;
    };
    diagnosticCodes: string[];
  } | null;
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
  /** Optional report-only prompt overrides keyed by field id. */
  fieldLabels?: Record<string, string>;
  /** Placeholder emitted for unanswered prompts (e.g. "<<<Nothing specified>>>"). */
  emptyText?: string;
  /** Section title presentation: plain line (default) or title + ===== underline (legacy MSE style). */
  headerStyle?: "plain" | "underlined";
  /** Blank line between sections ("spaced", legacy style) or none ("compact", default). */
  sectionSpacing?: "compact" | "spaced";
  /** Prompt layout: "inline" = `Label: value` (default); "indented" = label line, value indented on the next line, blank line after (legacy MSE style; multi-selects render as `- item` bullets). */
  valueLayout?: "inline" | "indented";
  /**
   * Shape of each inline prompt line — the same formats a subform observation
   * output offers, so a report and a subform can emit identical bodies.
   * Defaults to `promptAnswer` (`Prompt: value`). Ignored when
   * `valueLayout` is "indented", which has its own two-line shape.
   */
  itemFormat?: ReportItemFormat;
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
  /** Recursive submit-time gate (may carry a named-condition ref). Emitter support pending. */
  conditionGroup?: FieldConditionGroup;
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

/** Image owned by a rich-text field and referenced from Markdown by id. */
export interface BuilderRichTextImageAsset {
  id: string;
  src: string;
  alt: string;
  title?: string | null;
  widthPercent?: number | null;
  alignment?: "left" | "center" | "right";
}

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

/**
 * A table column calculated from the same row's cells (EditableTable, via the
 * FormulaKit engine that ComputedField uses): `[columnId]` reads that row's
 * cell, e.g. `weekdaysBetween([from], [to]) * [hoursPerShift]`.
 */
export interface BuilderTableFormulaColumn {
  mode: "formula";
  expression: string;
  /** Default "calculated-until-overridden": the filler may type over it; a reset icon restores it. */
  calculationPolicy?: "always-calculated" | "calculated-until-overridden" | "suggested-calculation";
  /** Decimal places (default 2). */
  precision?: number;
  /** Default: blank until every referenced cell has a value. */
  incompleteBehavior?: "compute-anyway";
}
export type BuilderLayoutTableCellKind = "text" | "field" | "fieldList" | "resources" | "computed" | "stampButton";
export type BuilderLayoutTableCellInputType = "text" | "textarea" | "number" | "date" | "time" | "choice" | "choiceMulti" | "booleanYesNo" | "booleanSingle";
export type BuilderLayoutTableSourceFormat = "text" | "date" | "dateTime" | "visitCode" | "coding";
export type BuilderLayoutTableSourceMode = "live" | "initial";

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
  /** Ordinary field metadata, stored on the nested answer instead of the layout container. */
  fhirConfig?: BuilderFhirConfig | null;
  moisOutput?: BuilderMoisOutputMapping | null;
  translations?: Record<string, BuilderFieldTranslation> | null;
  required?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  labelPosition?: "top" | "left" | "none";
  placeholder?: string;
  helpText?: string;
  helpPosition?: HelpPosition;
  /**
   * The field came from another product's control whose rendering here is
   * not decided yet (a PowerForm grid, a chart template PowerChart fills
   * from the chart). Targets that cannot draw the source control show a
   * placeholder in its place; the source target keeps drawing it natively.
   */
  pendingConversion?: { source: string; reason: string } | null;
  prefill?: FieldPrefillValue;
  choiceStyle?: BuilderField["choiceStyle"];
  choiceAnswerLayout?: BuilderField["choiceAnswerLayout"];
  showOtherOption?: boolean;
  autoHotKey?: boolean;
  allowCreation?: boolean;
  shuffleOptions?: boolean;
  minSelection?: number;
  maxSelection?: number;
  booleanLabels?: { on: string; off: string } | null;
  booleanNeutralMode?: "cycle" | "initial" | "none";
  useToggleSwitch?: boolean;
  visibility?: BuilderVisibilityRule | null;
  validation?: BuilderValidationConfig | null;
  numberConfig?: BuilderField["numberConfig"];
  dateConfig?: BuilderField["dateConfig"];
  textConfig?: BuilderField["textConfig"];
  textareaConfig?: BuilderField["textareaConfig"];
  pdfFieldAliases?: string[];
}

export interface BuilderLayoutTableCell {
  id: string;
  kind: BuilderLayoutTableCellKind;
  text?: string;
  sourcePath?: string;
  sourcePaths?: string[];
  sourceFormat?: BuilderLayoutTableSourceFormat;
  /** Keep the source synchronized, or use it only to seed a new saved value. */
  sourceMode?: BuilderLayoutTableSourceMode;
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
  /** Ordinary field metadata, stored on the nested answer instead of the layout container. */
  fhirConfig?: BuilderFhirConfig | null;
  moisOutput?: BuilderMoisOutputMapping | null;
  translations?: Record<string, BuilderFieldTranslation> | null;
  hidden?: boolean;
  disabled?: boolean;
  labelPosition?: "top" | "left" | "none";
  placeholder?: string;
  helpText?: string;
  helpPosition?: HelpPosition;
  /**
   * The field came from another product's control whose rendering here is
   * not decided yet (a PowerForm grid, a chart template PowerChart fills
   * from the chart). Targets that cannot draw the source control show a
   * placeholder in its place; the source target keeps drawing it natively.
   */
  pendingConversion?: { source: string; reason: string } | null;
  prefill?: FieldPrefillValue;
  choiceStyle?: BuilderField["choiceStyle"];
  choiceAnswerLayout?: BuilderField["choiceAnswerLayout"];
  showOtherOption?: boolean;
  autoHotKey?: boolean;
  allowCreation?: boolean;
  shuffleOptions?: boolean;
  minSelection?: number;
  maxSelection?: number;
  booleanLabels?: { on: string; off: string } | null;
  booleanNeutralMode?: "cycle" | "initial" | "none";
  useToggleSwitch?: boolean;
  visibility?: BuilderVisibilityRule | null;
  validation?: BuilderValidationConfig | null;
  numberConfig?: BuilderField["numberConfig"];
  dateConfig?: BuilderField["dateConfig"];
  textConfig?: BuilderField["textConfig"];
  textareaConfig?: BuilderField["textareaConfig"];
  pdfFieldAliases?: string[];
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

export type BuilderVisibilityType =
  | "always"
  | "filled"
  | "not-filled"
  | "equals"
  | "not-equals"
  | "gt"
  | "gte"
  | "lt"
  | "lte";
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

export interface BuilderVisibilityCondition {
  type: Exclude<BuilderVisibilityType, "always">;
  controllerId: string;
  value?: string;
}

/**
 * How an existing answer is handled when its visibility rule hides the field.
 * - 'preserve': Keep the answer while the field is hidden
 * - 'clear': Remove the answer when the field becomes hidden
 * Future warn/prevent variants would govern the visibility change itself, not
 * the hidden field's data.
 */
export type HiddenAnswerPolicy = "preserve" | "clear";

export interface BuilderVisibilityRule {
  type: BuilderVisibilityType;
  controllerId?: string;
  value?: string;
  /** How the primary + additional conditions combine. Default "all". */
  match?: "all" | "any";
  /** Extra conditions beyond the primary one (flat, no nesting). */
  additionalConditions?: BuilderVisibilityCondition[];
  /** How to handle an existing answer when this rule hides the field. Default: 'preserve'. */
  hiddenAnswerPolicy?: HiddenAnswerPolicy;
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
  /** Structured value format checked on entry and at submit. */
  format?: BuilderValueFormat | null;
  /** Overrides the format's default message. */
  formatMessage?: string;
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
  /**
   * Raw Docmosis template snippet (tags, literals and `cs_` sections) emitted as-is.
   * Compiled from a chart value formula; takes precedence over `docmosisExpression`.
   */
  docmosisTemplate?: string | null;
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
  /**
   * Opt a library-bound chart value back into being asked on the form. A field
   * attached to a reviewed Patient-profile concept defaults to a template-only
   * read of the client record, since AlayaCare already holds the value; set this
   * when the form is the thing that captures it, and the preview prefills the
   * question from the client record instead of printing over it.
   */
  exportAsQuestion?: boolean;
  /** Imported from AlayaCare as read-only because editing support is limited. */
  importReadOnly?: boolean;
  /** Human-readable reason shown in the inspector when importReadOnly is true. */
  importReadOnlyReason?: string | null;
}

export type BuilderFormioImportStatus = "exact" | "lossy" | "unsupported";

/**
 * Source metadata retained when a field is imported from a Form.io definition.
 * Imported executable snippets are provenance only: runtimes must never execute
 * raw Form.io JavaScript from this contract.
 */
export interface BuilderFormioConfig {
  version: 1;
  /** User-facing source name. Omitted for generic Form.io JSON imports. */
  sourceLabel?: string;
  /** Stable Form.io component key used in submission.data. */
  sourceKey: string;
  /** Original Form.io component type. */
  sourceType: string;
  /** Component-tree path used for diagnostics and deterministic round-trips. */
  sourcePath: string;
  /** Submission data path. Containers do not add path segments; datagrids do. */
  dataPath?: string[];
  /** Codec required to translate Form.io's stored answer shape. */
  answerCodec?: "identity" | "selectboxes-boolean-map" | "datagrid-rows" | "day-date";
  /** Complete source component, retained without executing embedded code. */
  rawComponent: Record<string, unknown>;
  /** Questionnaire/FHIR annotations used by the Health BC eForms runtime. */
  fhirElement?: string;
  fhirResource?: string;
  formioResource?: string;
  questionnaireElement?: string;
  /** Import fidelity for the editable canonical representation. */
  importStatus: BuilderFormioImportStatus;
  importNotes?: string[];
  /**
   * Complete source form metadata, stored on the first imported field so it
   * survives existing builder/session/share persistence paths.
   */
  formRoot?: Record<string, unknown>;
}

/** Import fidelity for a field brought in from a Cerner PowerForm export. */
export type BuilderCernerImportStatus = "exact" | "lossy" | "unsupported";

/** One STATE row of a Cerner interpretation table: in `state`, if `input` equals `value`, go to `next` (or yield `result`). */
export interface BuilderCernerInterpRow {
  state: number;
  /** DTA mnemonic of the input tested. */
  input: string;
  value: string;
  nomenId?: string;
  next: number;
  result?: string;
  resultNomenId?: string;
  resultValue?: string;
  inputDtaCd?: string;
  inputTaskAssayUid?: string;
  /**
   * A numeric contributor's range (STATE FLAGS=1, NUMERIC_LOW..NUMERIC_HIGH,
   * both inclusive); `value` is then empty. 23 of the T1978A domain's states
   * are ranges, e.g. PHQ-9 Score 0–4, 5–9, … 20–27.
   */
  numeric?: { low: number; high: number };
  /** RESULT_PRINCIPLE_TYPE_CD / _MEAN when not ALPHA RESPON (one BERG outcome is OTHER, 1262). */
  resultPrincipleType?: { cd: string; mean: string };
}

/**
 * A Cerner interpretation (decision table) kept verbatim so it can be both
 * compiled into a builder expression and written back on export.
 */
export interface BuilderCernerInterp {
  targetMnemonic: string;
  targetDtaCd?: string;
  dcpInterpId?: string;
  dcpInterpUid?: string;
  taskAssayUid?: string;
  ageToMinutes?: string;
  /** AGE_FROM_MINUTES; the table applies from this age (0 when absent). */
  ageFromMinutes?: string;
  /** Unit the author reads the age range in; INTERP XML stores minutes only. */
  ageUnit?: "years" | "months" | "weeks" | "days";
  /** SEX_CD / SEX_DISP / SEX_MEAN: a sex-specific table (2 in T1978A, AUDIT-C male and female). */
  sex?: { cd?: string; display: string; meaning: string; cduid?: string };
  /** SERVICE_RESOURCE: the performing department the table is limited to. */
  serviceResource?: { cd?: string; display: string; cduid?: string };
  /**
   * Bedrock Interpretations wizard settings that the INTERP XML does not
   * carry (MX25.3 guide step 7). Listed in DEPLOYMENT.md for the analyst.
   */
  bedrock?: { lookBackMinutes?: number; lookForwardMinutes?: number; initialLookDirection?: "back" | "forward" };
  /** Positions this table held in the source INTERP_OBJ_LIST, so a rebuilt one is written back in place. */
  listingIndexes?: number[];
  /** COMPONENT FLAGS=1 marks a numeric contributor ("Numeric" in the Component Selection dialog). */
  components?: Array<{ mnemonic: string; description?: string; taskAssayUid?: string; dtaCd?: string; numeric?: boolean }>;
  componentMnemonics: string[];
  /** Distinct outcome strings the table can produce. */
  outcomes: string[];
  stateCount: number;
  rows?: BuilderCernerInterpRow[];
}

/**
 * Source metadata retained when a field is imported from a Cerner PowerForm
 * export (the DCP_FORMS_REF XML bundle: PF, PF-DTA, PF-INTERP, PF-NOMEN).
 * Everything here is provenance for round-tripping and analyst review; the
 * runtime never reads it.
 */
export interface BuilderCernerInputModule {
  name: string;
  value: string;
  sequence: number;
  mergeName?: string;
  mergeId?: string;
  dtaMnemonic?: string;
  dtaDescription?: string;
  taskAssayGuid?: string;
  activityType?: string;
  eventCodeDisplay?: string;
  eventCodeUid?: string;
  codeSet?: number;
  codeValueDisplay?: string;
  codeValueMeaning?: string;
  condSectionDescription?: string;
  condSectionDefinition?: string;
  condSectionGuid?: string;
  /** Any other non-empty MODULE leaf, by tag, for verbatim replay. */
  leaves?: Record<string, string>;
}

/**
 * What DTA Wizard asks for when a discrete task assay is built, for a DTA
 * authored in the builder (mirrors the C3I Cerner build guide, DTA Wizard
 * steps 4–14). Everything but `eventSetPlacement` is written into the
 * exported DTA_OBJ; the placement is a Core Event Manager step no DCP file
 * carries, so it goes into RESOLUTION.md as a build instruction.
 */
export type BuilderCernerAgeUnit = "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS";

/** The limits one reference band sets (DTA Wizard's Numeric Details). */
export interface BuilderCernerRangeLimits {
  defaultResult?: number;
  units?: string;
  normalLow?: number;
  normalHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  feasibleLow?: number;
  feasibleHigh?: number;
}

/**
 * One row of DTA Wizard's Reference Ranges spreadsheet beyond the default
 * band: who it applies to (sex, gestation, an age span) and the limits for
 * them. `minsBack` is the delta-check window to the previous result.
 */
export interface BuilderCernerReferenceBand extends BuilderCernerRangeLimits {
  sex?: "FEMALE" | "MALE" | "UNDIFFERENTIATED" | "";
  gestational?: boolean;
  ageFrom?: number;
  ageFromUnits?: BuilderCernerAgeUnit;
  ageTo?: number;
  ageToUnits?: BuilderCernerAgeUnit;
  minsBack?: number;
  /**
   * Answers selected specifically for this range; empty means no responses.
   * `truthState` is the TRUTH_STATE_MEAN ("UNK", or "" for none), `category`
   * the ALPHA_CATEGORY it is listed under, `conceptCki` DTA Wizard's per-answer
   * Concept CKI (no DCP leaf; reported for the analyst).
   */
  answers?: Array<{ display: string; nomenclatureId?: string; resultValue?: string; isDefault?: boolean; gridDisplay?: 0 | 1 | 2; truthState?: string; category?: string; conceptCki?: string }>;
  /** DTA Wizard's Alpha Categorization for this range (ALPHA_CATEGORY_LIST). */
  categories?: Array<{ name: string; displaySeq?: number; expand?: boolean; categoryId?: string }>;
}

/**
 * One Equation Tool component (Define Components tab). A DTA component reads
 * a result; for an ALPHA/MULTI DTA that is the chosen responses' result
 * values (summed for multi-select). `constant` makes it the Constant radio.
 */
export interface BuilderCernerEquationComponent {
  name: string;
  fieldId?: string;
  mnemonic: string;
  activityType: string;
  resultType: string;
  taskAssayId?: string;
  taskAssayGuid?: string;
  /** Value Unit (UNITS_CD_DISPLAY). */
  units?: string;
  /** Constant instead of a DTA (COMPONENT_FLAG 3, CONSTANT_VALUE). */
  constant?: number;
  /** Required Value › Optional (RESULT_REQ_FLAG 0). */
  optional?: boolean;
  /** The Optional box: used when no result is found. No DCP tag carries it; preview only. */
  defaultValue?: number;
  /** Result › Look Ahead First; Look Back First when absent. No DCP tag carries it. */
  lookAheadFirst?: boolean;
  /** Look Ahead Minutes (TIME_WINDOW_MINUTES) and Look Back Minutes (TIME_WINDOW_BACK_MINUTES). */
  lookAheadMinutes?: number;
  lookBackMinutes?: number;
  /** RESULT_STATUS_DISPLAY the component reads (Performed when absent; "" for none). */
  resultStatus?: string;
}

/**
 * Define Equation tab: who an equation applies to. Ages are kept in minutes
 * (AGE_FROM_MINUTES / AGE_TO_MINUTES) with the unit the tool displays them
 * in, as the EQUATION export writes them. Absent: 0 minutes to 150 years,
 * all genders and species, a default equation, active.
 */
export interface BuilderCernerEquationApplicability {
  ageFromMinutes?: number;
  ageFromUnits?: string;
  ageToMinutes?: number;
  ageToUnits?: string;
  /** Gender (SEX_CODE_DISPLAY), e.g. "Female"; empty for all. */
  sex?: string;
  species?: string;
  serviceResource?: string;
  unknownAge?: boolean;
  isDefault?: boolean;
  /** Status › Inactive. No DCP tag carries it; an inactive variant is not exported. */
  inactive?: boolean;
}

export interface BuilderCernerConditionalEquation {
  components: BuilderCernerEquationComponent[];
  /** Used when none of the ordered conditions match; blank means no result. */
  expression: string;
  conditions: Array<{ condition: string; expression: string }>;
  applicability?: BuilderCernerEquationApplicability;
  /** Further equations on the same Calculation DTA, chosen by patient ("1 of n" in Equation Tool). */
  variants?: BuilderCernerConditionalEquation[];
  /** Native EQUATION_ID this equation was imported from, reused on export. */
  equationId?: string;
}

export interface BuilderCernerDtaDefinition {
  equation?: BuilderCernerConditionalEquation;
  defaultType?: 0 | 1 | 2 | 3;
  defaultTemplate?: string;
  relatedResultLookBackMinutes?: number;
  bmdiLookBackMinutes?: number;
  bmdiLookForwardMinutes?: number;
  eventDescription?: string;
  eventDefinition?: string;
  /** Numeric Map: digits and decimals a NUMERIC result may have. */
  numericMap?: { minDigits?: number; maxDigits?: number; decimalPlaces?: number } | null;
  /** The default reference-range band (0 minutes to 150 years, both sexes). */
  range?: BuilderCernerRangeLimits | null;
  /** Further bands by sex, gestation or age, written after the default one. */
  bands?: BuilderCernerReferenceBand[] | null;
  /** The listed bands are the complete range table; do not add an all-patient default. */
  bandsOnly?: boolean;
  witnessRequired?: boolean;
  /**
   * DTA Wizard "First Alpha Single Select" (`SINGLE_SELECT_IND`). A DTA-level
   * flag, independent of a PowerForm control's `exclude_first_ar`
   * (`firstResponseExclusive`): the domain has each without the other.
   */
  singleSelect?: boolean;
  /** Intake and Output: 0 neither, 1 intake, 2 output; documented option 3 requires workflow review. */
  ioFlag?: 0 | 1 | 2 | 3;
  /**
   * `new`: DTA Wizard's "Build a New Event Code" — an event code named like
   * the mnemonic (the default). `existing`: `eventCodeDisplay` names an event
   * code the domain already has.
   */
  eventCodeMode?: "new" | "existing";
  /** Where the event code should sit in Core Event Manager: a working-view section and, optionally, the parent event set under it. */
  eventSetPlacement?: { section: string; parent?: string; note?: string } | null;
}

/**
 * The domain build steps that no DCP file carries: the package the form came
 * from, the note type used for textual rendition, the Order Task Tool task and
 * its form/task link, ad hoc folders, MPage quick links, the rules or pages
 * that launch the form, and the task servers to cycle. Mirrors the analyst
 * "New PowerForm Build Instructions" documents; the export writes it into
 * DEPLOYMENT.md as a per-form checklist.
 */
export interface CernerPowerFormBuildRecord {
  /** Content package the form was added from, e.g. "680767 - Oracle Health EHR: Perioperative Services Content (January 2026)". */
  package?: string;
  /** Event set names added to the ESH beyond the DTA event codes. */
  eventSets?: { form?: string; textRendition?: string };
  /** Note type selected under Form › Customize for textual rendition. */
  noteType?: string;
  /** Order Task Tool › Tasks definition. Timeframes are kept as written ("7 Days", "72 Hours"). */
  task?: {
    description?: string;
    indicators?: string[];
    taskType?: string;
    taskActivity?: string;
    overdueTime?: string;
    retentionTimeframe?: string;
    rescheduleTimeframe?: string;
    gracePeriod?: string;
    positionsToChart?: string[];
  };
  /** Order Task Tool › Form/Task Link. */
  formTaskLink?: { chartingAgent?: string; taskName?: string };
  /** Alternate Task Selection Tool folders the task was copied into. */
  adHocFolders?: string[];
  /** Bedrock MPage Setup quick links: the component (and filter) the form was added to, per MPage. */
  mpageQuickLinks?: { component?: string; filter?: string; mpages: string[] }[];
  /** Rules, alert templates or pages that launch this form, by the alias they expect. */
  launchReferences?: { kind: "rule" | "alert" | "mpage" | "other"; name: string; alias?: string; note?: string }[];
  /** Task servers cycled after the build, e.g. ["80", "120", "121"]. */
  taskServers?: string[];
  notes?: string;
  /** Where the values came from when prefilled from a build-instructions document. */
  source?: { fileName?: string; formName?: string; paragraphCount?: number; unparsed?: string[] };
}

export interface BuilderCernerConfig {
  /** One authoring component, two independently bound native BP results. */
  bloodPressure?: { systolic: BuilderField; diastolic: BuilderField };
  /** One measurement result with a native read-only unit-conversion display. */
  unitConversion?: { input: BuilderField; display: BuilderField; displayFirst?: boolean; displayFirstInSection?: boolean };
  /** Authored Smart Template content; native references remain separate. */
  smartTemplate?: SmartTemplateDefinition;
  smartTemplateLink?: SmartTemplateLink;
  /** References only: never executed as clinical rules. */
  discernRuleIds?: string[];
  version: 1;
  /** Oracle build-report provenance. Geometry is reconstructed, not native XML. */
  workbookSource?: { name: string; sheet: string; row: number; sourcePosition?: string; sourceFont?: string; sourceValues?: Record<string, string>; layout?: { basis: "neighbouring-labels" | "fallback" | "reference-template"; standard?: string; profile?: string; answerRows?: number; answerColumnWidth?: number; answerDisplay?: "short-string"; labelOverride?: { sourceLabel: string; caption: string }; note: string } };
  /** Native `exclude_first_ar`: choosing the first answer clears the others, and vice versa. Multi-select lists only. */
  firstResponseExclusive?: boolean;
  /** Native `sort_alphabetic`: answers are shown A→Z; the DTA's stored response order is unchanged. */
  sortAlphabetic?: boolean;
  /**
   * The control's Default Type tab. Native `default`: absent = none, 1 =
   * reference, 2 = any-encounter, 3 = interpretation, 4 = encounter
   * (lib/cerner-powerforms/default-policy.ts has the evidence). `template` is
   * the builder's chart-template source, not a Default Type radio.
   */
  defaultPolicy?: {
    source: "none" | "reference" | "encounter" | "any-encounter" | "interpretation" | "template";
    /** Preview only: PowerForms has no control-level look-back (only the DTA's "Look Back Minutes for Related Results"). */
    lookBackMinutes?: number;
    /** Display the previous-data indicator outside the input's top-right edge. */
    showImportIcon?: boolean;
  };
  resultOptions?: { allowComments?: boolean; suppress?: boolean; suppressChart?: boolean; suppressText?: boolean; commentFieldId?: string; commentForFieldId?: string };
  /**
   * Calculated control's Date/Time Calculation (`date_calc="1"`): the absolute
   * time between two date fields (equation A1-B1), or between one and the
   * form's Performed on date/time (equation A1), rounded down to `units`.
   */
  dateCalculation?: { startFieldId: string; endFieldId?: string; units: "minutes" | "hours" | "days" | "weeks" | "months" | "years" };
  /** Date/Time control Type tab › Date/Time/Time Zone (a DATETIMETIMEZONE DTA). */
  withTimeZone?: boolean;
  /** Date offset from another date field. Native `datecalc_cntrl` encodes days, weeks and months; minutes and hours are preview-only. */
  dateOffset?: { sourceFieldId: string; amount: number; units: "minutes" | "hours" | "days" | "weeks" | "months" };
  grid?: {
    family: "power" | "discrete" | "ultra";
    /** Source GRIDITEMLIST leaves, retained verbatim for imported grids. */
    nativeItems?: Array<Record<string, string>>;
    /** Authored UltraGrid intersection destinations, keyed by stable axis ids. */
    intersections?: Array<{ rowId: string; columnId: string; eventDisplay: string; eventCode?: string; eventUid?: string; eventCki?: string }>;
    view: "grid" | "row" | "detail";
    rowComments?: boolean;
    /** Discrete-grid "Other" column heading (native `other_title`); an empty string is a column without a heading. */
    otherColumnLabel?: string;
    /** Native `show_other_column`: the Other column's width in grid units; 0 hides the column. */
    nativeOtherWidth?: number;
    /** Full column definitions for workbook demographic projection and details. */
    columnFields?: Record<string, BuilderField>;
    /** Native source units, deliberately independent of preview pixels. */
    nativeRowHeight?: number;
    nativeCommentWidth?: number;
    autoSizeRows?: boolean;
    /** Preview pixels only; native grid units must not be guessed from images. */
    previewLayout?: {
      fitWidth: boolean;
      rowHeight: number;
      rowLabelWidth: number;
      commentWidth: number;
      /** Display-only discrete-grid headings, keyed by the original answer. */
      responseColumns?: Record<string, { label: string; width: number }>;
    };
    gridEvent?: { display: string; uid?: string };
    rowEvent?: { display: string; uid?: string };
    columns?: Record<string, { mnemonic?: string; taskAssayId?: string; taskAssayGuid?: string; eventCodeDisplay?: string; eventCodeUid?: string; required?: boolean; width?: number; dta?: BuilderCernerConfig["dta"]; alphaResponses?: BuilderCernerConfig["alphaResponses"] }>;
    rows?: Array<{ id: string; label: string; mnemonic?: string; taskAssayId?: string; taskAssayGuid?: string; dta?: BuilderCernerConfig["dta"]; alphaResponses?: BuilderCernerConfig["alphaResponses"] }>;
  };
  /**
   * `powerform` — imported from a DCP export, so the coordinates, preferences
   * and absorbed labels here are Cerner's own and are replayed verbatim.
   * `authored` — bound in the builder's Data Binding panel; only the DTA
   * identity is meaningful and the export lays the input out itself.
   */
  sourceKind: "powerform" | "iview" | "authored";
  /** FORM_DESCRIPTION of the PowerForm this field came from. */
  formName: string;
  /** SECTION_DESCRIPTION of the containing section. */
  sectionName: string;
  /** Raw INPUT_TYPE (1 label, 4 alpha, 6 freetext, 9 alpha list, 18 provider, …). */
  inputType: number;
  inputRefSeq: number;
  /** Position in the section's INPUT_LIST, which is not INPUT_REF_SEQ order; the export keeps both. */
  inputIndex?: number;
  /** INPUT_DESCRIPTION — the input's own name, independent of its DTA's. */
  inputDescription?: string;
  /** PowerForm designer coordinates, `x1,y1,x2,y2` in form pixels. */
  position?: { x1: number; y1: number; x2: number; y2: number } | null;
  /**
   * An authored Image control (INPUT_TYPE 12) with no position yet: its size
   * in form pixels. The export places it below the controls before it.
   */
  imageSize?: { width: number; height: number } | null;
  /** Every PVC_NAME → PVC_VALUE preference on the input, verbatim. */
  preferences: Record<string, string>;
  /**
   * Every MODULE of the input in document order, with the merge it carries
   * (a DTA, a code value such as a unit, an event code, a conditional
   * section) and every other non-empty leaf, so the export can replay the
   * input exactly. Absent on fields authored here.
   */
  modules?: BuilderCernerInputModule[];
  /** The discrete task assay the input writes, when it has one. */
  dta?: {
    mnemonic: string;
    description: string;
    taskAssayId?: string;
    taskAssayGuid?: string;
    eventCodeDisplay?: string;
    eventCodeUid?: string;
    eventSetName?: string;
    activityType?: string;
    /** DEFAULT_RESULT_TYPE_DISP_KEY: ALPHA, MULTIALPHA, FREETEXT, PROVIDER, INTERP, … */
    resultType?: string;
    conceptCki?: string;
    /** REF_TEXT_FILES — the chart-guide reference text attached to the DTA. */
    refTextFiles?: string;
    /** DTA Wizard values for a task assay defined here rather than picked from the domain. */
    definition?: BuilderCernerDtaDefinition | null;
    /** Explicit provenance: missing domain IDs never imply local authorship. */
    /** Compiled catalog snapshot retained for review; not a native DCP record. */
    catalogDefinition?: unknown;
    /** Complete native DTA_OBJ retained from the catalog export. */
    nativeRecord?: unknown;
    /** Library definitions are pinned snapshots. Form copies own a new identity. */
    authoring?: {
      mode: "library" | "form";
      revision?: number;
      derivedFrom?: { mnemonic: string; taskAssayId?: string; taskAssayGuid?: string; domain?: string; revision?: number };
      mappingReviewRequired?: boolean;
    };
    provenance?: { kind: "catalog" | "draft"; domain?: string; generatedAt?: string; revision?: number };
  } | null;
  /** Alpha responses with the nomenclature ids the domain expects back. */
  alphaResponses?: Array<{
    display: string;
    nomenclatureId?: string;
    resultValue?: string;
    sequence?: number;
    isDefault?: boolean;
    mnemonic?: string;
    vocabulary?: string;
    shortString?: string;
    sourceIdentifier?: string;
    /** DTA Wizard's per-answer Concept CKI; kept and reported, not written (no DCP leaf). */
    conceptCki?: string;
  }>;
  /** A Cerner interpretation (decision table) that computes this field's value. */
  interp?: BuilderCernerInterp | null;
  /**
   * Interpretation tables authored (or rebuilt) here that set this alpha
   * list / combo box when its Default Type is "Use interpretation". Imported
   * tables the author has not touched stay verbatim in the DCP provenance.
   */
  defaultInterps?: BuilderCernerInterp[];
  /**
   * Label inputs absorbed into this field (its question label, the chips
   * beside it) or into a section (its title bar and marker), kept verbatim
   * so the export replays them at their original coordinates.
   */
  absorbedInputs?: Array<{
    seq: number;
    /** Position in the section's INPUT_LIST. */
    index?: number;
    description: string;
    type: number;
    prefs: Record<string, string>;
    /** What this input became: the field's label, its help text, or section chrome. */
    role?: "label" | "chip" | "help";
    /** Preserve complete native modules when a reference note becomes help text. */
    modules?: BuilderCernerInputModule[];
  }>;
  /** Native help-note placement; omitted keeps imported coordinates unchanged. */
  helpTextPosition?: "source" | "left" | "right" | "above" | "below";
  /** Omitted preserves each imported help note's native font weight. */
  helpTextBold?: boolean;
  importStatus: BuilderCernerImportStatus;
  importNotes?: string[];
  /**
   * Form-level metadata, stored on the first imported field so it survives
   * builder/session/share persistence: everything the export needs to write
   * the same PowerForm back.
   */
  formRoot?: Record<string, unknown>;
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
  /**
   * The published LOINC name, kept when the imported label dropped a phrase the
   * whole panel repeated ("Sensory perception Braden Scale" → "Sensory
   * perception"). Absent when the label is the published one.
   */
  publishedName?: string;
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
  /** First FHIR Questionnaire.item.definition URL, retained for older callers and the single-value editor. */
  definition?: string;
  /** All definition URLs. R6 permits more than one; R4/R4B/R5 permit at most one. */
  definitions?: string[];
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
  answerConstraint?: "optionsOnly" | "optionsOrType" | "optionsOrString";
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
  /** Full imported item used to preserve release- and profile-specific fields. */
  questionnaireItem?: Record<string, unknown>;
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
/** What a source-document field stores; see `BuilderField.documentBinding`. */
export type BuilderDocumentValueKind = "text" | "number" | "date" | "boolean" | "choice";

export interface BuilderDocumentBinding {
  source: "xfa";
  /** Data path in the document, e.g. /form1[1]/Page1[1]/Union[1]. */
  path: string;
  valueKind: BuilderDocumentValueKind;
  /** Choice fields: the document accepts several values. */
  multiSelect?: boolean;
  /** Choice fields: the values the document stores, in document order. */
  optionValues?: string[];
}

export interface BuilderChoiceOptionObject {
  label: string;
  /** Stored value, when it differs from the label. Defaults to the label. */
  value?: string;
  /** Numeric score used by computed `score([id])` formulas. */
  score?: number;
  /** Optional helper text shown in option editors. */
  description?: string;
  /**
   * Presentation-only nesting inferred from an imported flat option list.
   * This never implies answer selection or clinical parent/child semantics.
   */
  presentationDepth?: number;
  /** Stored value of the preceding visual parent, for rendering/auditing only. */
  presentationParentValue?: string;
  /**
   * Cerner nomenclature id for this answer. Cerner stores an answer as a coded
   * concept, not a string, and the same concept is shared across a form (every
   * "Yes" is one id). Unset exports as 0 and lands in RESOLUTION.md.
   */
  cernerNomenclatureId?: string;
  /** Cerner concept CKI for this answer (DTA Wizard Alpha Details); reported for the analyst. */
  cernerConceptCki?: string;
}

export type BuilderChoiceOption = string | BuilderChoiceOptionObject;

/** Reviewed, portable answer-set equivalence. Each form carries a snapshot;
 * updates to the reusable library never silently change an existing form. */
export interface BuilderAnswerSetEquivalence {
  version: 1;
  id: string;
  name: string;
  revision: number;
  cerner: {
    dta: NonNullable<BuilderCernerConfig["dta"]>;
    alphaResponses: NonNullable<BuilderCernerConfig["alphaResponses"]>;
  };
  mois: { codeSystem: string; options: Array<{ code: string; display: string }> };
  answers: Array<{ cernerDisplay: string; moisCode: string }>;
}

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
    /** `date-part`: a legacy Month/Day/Year column folded into one date field. */
    role: "history-value" | "history-date" | "history-other" | "graph" | "date-part";
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

/** How a source-bound field's value is coerced before it lands in formData. */
export type BuilderFieldSourceFormat =
  | "text"
  | "date"
  | "dateTime"
  | "coding"
  | "oscarAllergies"
  | "oscarConditions"
  | "oscarMedications";

/**
 * "initial" seeds the value once and keeps any saved/edited answer;
 * "sync" reapplies the source value on every load/refresh.
 */
export type BuilderFieldSourceMode = "initial" | "sync";

/**
 * Field-level MOIS source-data binding (see BuilderField.sourceConfig).
 * Mirrors the layout-table cell vocabulary so the two stay interchangeable.
 */
export interface BuilderFieldSourceConfig {
  /** MOIS source-data paths tried in order; the first meaningful value wins. */
  paths: string[];
  format?: BuilderFieldSourceFormat;
  /** Defaults to "initial". */
  mode?: BuilderFieldSourceMode;
  /** Static value used when no path resolves (e.g. preview environments). */
  fallback?: string | number | boolean | null;
  /** Portable chart query; native host compilation is a separate capability. */
  chartQuery?: BuilderChartQuery;
  /**
   * How the filled field appears: "editable" (default) renders it on the form,
   * "backing" keeps the value in runtime data, save payloads and PDF fills but
   * hides the input. Mirrors the layout contract's read-binding presentation.
   */
  presentation?: BuilderFieldSourcePresentation;
  /** Engine-side reshaping of the raw source value before formatting. */
  valueTransform?: BuilderFieldSourceValueTransform;
}

export type BuilderFieldSourcePresentation = "editable" | "backing";
export type BuilderFieldSourceValueTransform = "exists" | "address" | "insurance" | "telecom";

/**
 * Field-level MOIS chart interactions beyond reading a value: the saved-data
 * key, an explicit chart mutation on submit, and a chart-module link. With
 * `sourceConfig` (read) and `moisOutput` (observation) this is the field's
 * whole MOIS story; the layout draft's `moisContract` is derived from it.
 */
export interface BuilderFieldMoisConfig {
  /** Saved-data key when it must differ from the field id (legacy slots). */
  localWrite?: { targetId: string } | null;
  /** Engine-verified chart mutation run on submit. */
  writeBinding?: {
    targetId: string;
    payloadField: string;
    contextIdPath?: string | null;
  } | null;
  /** Chart-module link rendered beside the field. */
  navigation?: MoisNavigationTarget | null;
}

export interface BuilderChartQuery {
  kind: "Observation";
  system: string;
  code: string;
  unit: string;
  unitSystem?: string;
  encounter: "any" | "selected";
  lookBackDays?: number;
  statuses?: ("final" | "amended" | "corrected")[];
  specimen?: { system: string; code: string };
}

export type BuilderOscarImportMappingStatus =
  | "mapped"
  | "partial"
  | "unresolved"
  | "measurement-review";

export type BuilderOscarImportDecision =
  | "suggested"
  | "custom"
  | "review"
  | "response-only"
  | "ignored";

/**
 * Reviewable provenance retained when a field is imported from an OSCAR
 * eForm. The live MOIS binding remains in sourceConfig/measurementConfig;
 * this record explains the source suggestion and the author's decision.
 */
export interface BuilderOscarImportMapping {
  version: 1;
  oscarDb: string;
  catalogStatus: BuilderOscarImportMappingStatus;
  catalogMappingId?: string;
  suggestedSourceConfig?: BuilderFieldSourceConfig | null;
  decision: BuilderOscarImportDecision;
  note?: string;
  measurementType?: string;
  measurementProperty?: string;
  /** Stable row in the explicitly reviewed OSCAR → MOIS measurement catalog. */
  measurementCrosswalkId?: string;
  measurementReviewStatus?: "pending" | "approved" | "rejected" | "ambiguous";
  /** The author's explicit observation choice; never inferred from an abbreviation. */
  measurementSelection?: {
    observationCode: string;
    /** Universal clinical concept selected with the local MOIS observation. */
    loincCode?: string;
    loincDisplay?: string;
    description?: string;
    units?: string;
    valueType?: "TEXT" | "NUMERIC";
    basis: "author-selected" | "approved-crosswalk";
  } | null;
}

export interface BuilderFieldBehavior {
  validations?: Array<{ id: string; validWhen: FieldConditionGroup; message: string; translations?: Record<string, string> }>;
  optionRules?: Array<{ value: string; showWhen?: FieldConditionGroup; disableWhen?: FieldConditionGroup }>;
}

/** A pinned library definition travels with the form; edits never mutate its source. */
export interface BuilderLibraryDefinition {
  version: 1;
  mode: "library" | "local";
  source: {
    kind: "loinc" | "cerner-dta";
    id: string;
    display: string;
    library: string;
    revision?: string;
    /** LOINC's published properties, retained for offline inspection. */
    loinc?: { scale: string; units: string; property?: string; system?: string; method?: string };
  };
  numeric: {
    type: "number" | "decimal" | "year";
    suffix: string;
    storeAsNumber: boolean;
    min?: number;
    max?: number;
    step?: number;
    /** Native numeric semantics that have no equivalent in a plain number control. */
    dta?: Pick<BuilderCernerDtaDefinition, "numericMap" | "range" | "bands" | "bandsOnly"> & { description?: string; activityType?: string };
  };
}

export interface BuilderField {
  fieldDefinition?: BuilderLibraryDefinition | null;
  behavior?: BuilderFieldBehavior;

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

  // Form.io import provenance and loss/round-trip metadata
  formioConfig?: BuilderFormioConfig | null;

  cernerConfig?: BuilderCernerConfig | null;
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
  /** Lock once the MOIS record is SIGNED. Defaults on; set false to opt out. */
  lockWhenSigned?: boolean;
  lockWhen?: BuilderLockWhenRule | null;
  width?: FieldWidth;
  labelPosition?: "top" | "left" | "none";
  placeholder?: string;
  helpText?: string;
  helpPosition?: HelpPosition;
  /**
   * The field came from another product's control whose rendering here is
   * not decided yet (a PowerForm grid, a chart template PowerChart fills
   * from the chart). Targets that cannot draw the source control show a
   * placeholder in its place; the source target keeps drawing it natively.
   */
  pendingConversion?: { source: string; reason: string } | null;
  prefill?: FieldPrefillValue;
  /**
   * MOIS source-data binding for this field's value — the field-level
   * equivalent of a layout-table cell's sourcePaths/sourceMode/sourceFallback.
   * Exports into the generated auto-fill pipeline: the value is resolved
   * against `sd` at load/refresh and written into formData (so it saves like
   * a filled answer, matching the legacy FormCreationHistory contract).
   */
  sourceConfig?: BuilderFieldSourceConfig | null;
  /**
   * Field-level MOIS save key, chart mutation and module link. Together with
   * sourceConfig and moisOutput this is the single authoring model; layout
   * drafts mirror it (lib/editor-sdk/mois-binding-reconciliation.ts).
   */
  moisConfig?: BuilderFieldMoisConfig | null;
  /** OSCAR import provenance and the user's mapping-review decision. */
  oscarImport?: BuilderOscarImportMapping | null;
  /**
   * Set when an imported source document (an XFA PDF today) stores this
   * field's answer. Derived from the document on load, never trusted from the
   * saved workspace: presentation stays editable, but the stored value kind,
   * choice values and single/multi selection must keep matching the document.
   */
  documentBinding?: BuilderDocumentBinding | null;
  pdfFieldAliases?: string[];
  page?: number;
  bbox?: BoundingBox;
  widgets?: WidgetGeometry[];
  /** Selection-assistant answer sync group for repeated fields across sections/pages. */
  linkedAnswerGroupId?: string | null;
  /** Field IDs that should receive the same answer as this visible field. */
  linkedAnswerFieldIds?: string[];
  /**
   * Editor-suggestion ids the author dismissed on this field (see
   * form-builder/editors/choice-suggestions.ts). A dismissal is a decision
   * about *this* field — "no, this numeric checklist really is a checklist" —
   * so it saves with the form rather than living in browser storage, and it
   * survives reopen/duplicate/share. Authoring metadata only: nothing
   * downstream of the builder reads it, and a dismissed suggestion stays
   * applicable — the selection assistant can still run it.
   */
  dismissedSuggestionIds?: string[] | null;

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
  choiceAnswerLayout?: "vertical" | "responsive" | "inline" | "columns-2" | "columns-3" | "columns-4";
  /** MOIS control density for coded selection controls. */
  moisSize?: string;
  /** MOIS per-answer density for radio/checklist controls. */
  moisOptionSize?: string;
  codeSystem?: string | null; // MOIS code system (e.g., "MOIS-MARITALSTATUS")
  answerSetEquivalence?: BuilderAnswerSetEquivalence | null;
  /** Explicit fixed list for targets that do not implement native DTA ranges. */
  answerSetPortableRange?: { name: string; answerLabels: string[] } | null;
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
      /** Original FHIR Questionnaire child item for lossless group/table round-trips. */
      fhirConfig?: BuilderFhirConfig | null;
      booleanLabels?: { on: string; off: string } | null;
      prefill?: FieldPrefillValue;
      /** Date columns only: pair the date picker with a time input (DateTimeSelect). */
      withTime?: boolean;
      dateConfig?: BuilderField["dateConfig"];
      textareaConfig?: BuilderField["textareaConfig"];
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
      /** For a single choice backed by separate PDF checkbox fields, map each option key to its row path. */
      choiceBooleanTargets?: Record<string, string> | null;
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
      } | BuilderTableFormulaColumn | null;
      visibility?: BuilderVisibilityRule | null;
      moisTargetId?: string | null;
      /** Row-1 cell of `tableConfig.documentRowPath` (derived on load, never trusted from a package). */
      documentBinding?: BuilderDocumentBinding | null;
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
    /** Modal row dialog width in px (default 640; narrower screens clamp it). */
    modalWidth?: number;
    uniqueBy?: string[];
    sourceFieldIds?: Record<string, string>;
    sourceFieldIdsByRow?: Record<number, Record<string, string>>;
    /** Original answer definitions used by document export for mapped repeating rows. */
    documentFields?: BuilderField[];
    /**
     * XFA repeating row this table fills, without its ordinal (e.g.
     * `/form1[1]/Page1[1]/Excluded[1]/Table1[1]/ExcludedStandardRepeating`).
     * Each column's `documentBinding.path` names its cell in row 1
     * (`…Repeating[1]/From1[1]`); table row n writes to `…Repeating[n]/…`.
     */
    documentRowPath?: string;
    /** Optional nested ActiveData path holding the rows array (defaults to the field id). */
    rowsPath?: string;
    /** Optional nested ActiveData path mirrored to the current row count. */
    countPath?: string;
    modalEditorPresetId?: string;
    modalEditorConfig?: Record<string, unknown> | null;
    /** Seed one row per row of another table (repeat-for-each). */
    repeatFor?: BuilderTableRepeatFor | null;
    rowCompletion?: BuilderTableRowCompletion | null;
    /** Ask before deleting a row. */
    confirmDelete?: boolean;
    /** What happens to rows beyond the PDF's printed row capacity. */
    pdfOverflow?: BuilderTablePdfOverflow | null;
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
    /** Visual presentation shared by regular computed fields and subform totals. */
    displayStyle?: CalculatedValueDisplayStyle;
    /** Whether to render displaySuffix beside the calculated value. */
    showDisplaySuffix?: boolean;
    /** Presentation-only units/text; never appended to the stored calculated value. */
    displaySuffix?: string;
    /** Defaults to always-calculated for backward compatibility. */
    calculationPolicy?: CalculatedValuePolicy;
    /** What to do before every referenced input has a value. Defaults to "compute-anyway". */
    incompleteBehavior?: IncompleteCalculationBehavior;
    /** Text shown in place of the total when incompleteBehavior is "show-text". */
    incompleteText?: string;
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
      /**
       * Stored answer key when it must differ from the numeric score — HoNOS
       * "9" (Unknown) stores key "9" but scores 0, and a coded scale built from
       * a terminology answer list stores the answer code while scoring its
       * ordinal value. Defaults to `String(value)`.
       */
      key?: string;
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
    /** Format used when writing the answer into the original PDF or Word document. */
    documentOutputFormat?: "stored" | "yyyy-MM-dd" | "yyyy.MM.dd" | "dd/MM/yyyy" | "MM/dd/yyyy" | "dd/MMM/yyyy" | "ddMMMyyyy" | "MMMM d, yyyy";
    disablePastDates?: boolean;
    disableFutureDates?: boolean;
    prefillToday?: boolean;
    /** Set an empty date to today when its calendar icon opens the picker. */
    fillTodayOnCalendarOpen?: boolean;
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
  /**
   * How this field's label is drawn, independent of the export target.
   *
   * MOIS renders it through the label's own styles, Terra through the
   * label element's attributes, and the Cerner PowerForm writer through the
   * `forecolor` / `backcolor` / `fonteffects` preferences of the label input
   * beside the answer. A rich-text block has no label, so a `highlight` set
   * on one paints the block itself — which is how an imported PowerForm
   * legend bar keeps its colour on every target.
   */
  labelStyle?: BuilderLabelStyle | null;

  /** Shared text remains in richTextConfig/componentProps; omitted targets inherit it. */
  richTextOverrides?: import("./rich-text-targets").RichTextOverrides;
  richTextConfig?: {
    source?: string | null;
    /** Managed images referenced as `#mois-rich-image:<id>` from source. */
    images?: BuilderRichTextImageAsset[];
    readOnly?: boolean;
    borderless?: boolean;
    startingMode?: "edit" | "preview" | "default";
    height?: number | null;
  } | null;

  // Validation rules
  validation?: BuilderValidationConfig | null;
}

/** Target-neutral label styling. Colours are `#rrggbb`. */
export interface BuilderLabelStyle {
  /** Text colour. Omitted means the target's own default. */
  color?: string | null;
  /** Background behind the label (or, for a rich-text block, behind the block). */
  highlight?: string | null;
  bold?: boolean;
}

/** Subgroup within a section (simplified for form builder) */
export interface SectionSubgroup {
  id: string;
  design?: import("./subgroup-design").SubgroupDesign;
  name: string;
  showHeading?: boolean;
  /** Omit to inherit the form design's label position. */
  headingPosition?: "top" | "left";
  /** Layout type for subgroup rendering (aligned with group-layout) */
  layoutType?: "table" | "grid" | "list";
  /** Parent subgroup id when nesting is used */
  parentId?: string | null;
  /** Render subgroup with card styling */
  showCard?: boolean;
  /** Created by assistant (used for UI badges) */
  createdByAssistant?: boolean;
}

/**
 * Provenance link recorded on a section that was inserted from a library
 * preset. Editing the section never removes the link; consumers compare the
 * fingerprints to report divergence instead.
 */
export interface SectionPresetLink {
  /** Importable preset key the section was inserted from (e.g. "mse-stamp"). */
  presetKey: string;
  /** Preset label at insert time, shown without loading the fixture chunk. */
  presetLabel?: string;
  /** Zero-based index of this section among the preset's top-level sections. */
  sectionIndex: number;
  /**
   * Fingerprint of the library preset's normalized section block at insert
   * time. Compare against the current library preset to detect upstream
   * changes.
   */
  fingerprint: string;
  /**
   * Fingerprint of the section block as it landed in this document (insert
   * applies builder defaults, so this differs from `fingerprint`). Compare
   * against the current document to detect local edits.
   */
  insertedFingerprint: string;
  /**
   * Normalized snapshot (ordinal field ids) of the preset's section block at
   * insert time, kept so divergence can still be explained after the library
   * preset itself changes.
   */
  snapshot: BuilderField[];
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
  /** Heading appearance only; sections remain siblings on their page. */
  headingStyle?: "main" | "subheading" | "none";
  description?: string;
  /** Optional CSS background for the section subtitle bar. Supports colors and gradients. */
  subtitleBackground?: string;
  /** Optional CSS border for the section subtitle bar. */
  subtitleBorder?: string;
  /** Optional CSS padding for the section subtitle bar. */
  subtitlePadding?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Draw no subtitle bar for this section; the title stays for the builder and navigation. */
  hideTitle?: boolean;
  childFieldIds: string[];
  /** Layout type: "grid" for side-by-side fields, "stacked" for vertical column */
  layoutType?: "grid" | "stacked";
  /** Number of columns per row when in grid layout (1-4, default 2) */
  gridColumns?: 1 | 2 | 3 | 4;
  /** Draw a MOIS-style separator line between grid rows */
  rowSeparators?: boolean;
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
  /** Fill behavior: "collection" repeats the section per MOIS collection record at runtime. */
  autoFillMode?: "manual" | "collection";
  /** Optional MOIS collection id backing collection auto-fill. */
  autoFillCollectionId?: string | null;
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
  /** Provenance of the library preset this section was inserted from. */
  presetLink?: SectionPresetLink | null;
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
  /** Compare against another answer instead of a literal. */
  valueFieldId?: string;
  type: FieldLinkConditionType;
  /** For choice conditions, which option value(s) to check */
  optionValues?: string[];
  /** For numeric and equality conditions. */
  value?: string | number | boolean | null;
  /**
   * Compare against another field's answer instead of `value`. This is what
   * makes a rule cross-field: "discharge date is before admission date" needs
   * the right-hand side to be a field, not a constant. Takes precedence over
   * `value` when set; if the named field is empty the condition is false, so a
   * half-filled form does not raise errors about answers nobody has given yet.
   */
  compareFieldId?: string;
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
  | "clear-readonly"
  /**
   * The condition describes what is *wrong*: when it holds, the target fields
   * carry a blocking validation error. Per-field rules cannot express this,
   * because the fault lies in the relationship between two answers.
   */
  | "invalid";

/**
 * A rule that links one field's value to another field's visibility or value
 * Example: "When 'No Allergies' is checked, hide 'List Allergies'"
 * Example: "When 'Same as Partner' is checked, hide 'Bio Father Surname'"
 * Example: "When 'ART Specify' has 'IVF' selected, show 'IVF Details'"
 */
// ---------- Conditions: leaf alias + named references ----------
export type FieldConditionLeaf = { controllerFieldId: string; condition: FieldLinkCondition };

export interface FieldConditionGroup {
  match: "all" | "any";
  conditions: Array<FieldConditionGroup | FieldConditionLeaf>;
  /**
   * Reference to BuilderDocument.conditions[].id. When set, `match`/`conditions`
   * are a MATERIALIZED copy of that named condition (refreshed by
   * materializeConditionRefs). Every existing consumer (MOIS, FHIR, Cerner,
   * RuleTestPanel) keeps reading the copy unchanged; only authoring UIs treat
   * the group as a single named chip.
   */
  conditionRef?: string;
}

/** Document-level reusable condition (Logic tab "Conditions" library). */
export interface BuilderNamedCondition {
  /** Stable, never reused (e.g. "cond_k3j9"). */
  id: string;
  /** Author-facing, used in pickers and rule sentences. */
  name: string;
  description?: string;
  /** May nest other refs; cycles are reported, never followed. */
  group: FieldConditionGroup;
}

// ---------- Page flow ----------
/** 0-based page index, or the synthetic review page. */
export type BuilderPageFlowTarget = number | "review";
export interface BuilderPageFlowBranch {
  id: string;
  /** Evaluated on Next, in order; first match wins. */
  when: FieldConditionGroup;
  /** An inactive target falls through to the next active page after it. */
  goTo: BuilderPageFlowTarget;
  label?: string;
}
export interface BuilderPageFlowPage {
  /** Absent = always active; ignored on page 0. */
  activeWhen?: FieldConditionGroup | null;
  /** For answers on the page while it is inactive; default "preserve". */
  hiddenAnswerPolicy?: HiddenAnswerPolicy;
  branches?: BuilderPageFlowBranch[];
  /** Absent = next active page in order. */
  defaultNext?: BuilderPageFlowTarget | null;
  /** Overrides BuilderPageFlowConfig.validateOnNext. */
  validateOnNext?: boolean;
  /**
   * `skipWhenNoItems` — "Skip this page when there are no items".
   * Field id of a repeat-for-each (follow-up) table, normally one on this page.
   * The page is inactive while that table's SOURCE has no rows passing its
   * `tableConfig.repeatFor.filter` (counted from the source, because the
   * follower itself may not be synced yet). ANDed with `activeWhen`; ignored
   * on page 0 and when the id does not name a repeating table. Answers on the
   * skipped page follow `hiddenAnswerPolicy` like any inactive page.
   */
  skipWhenNoItems?: string | null;
}
export interface BuilderPageFlowLandmark {
  enabled: boolean;
  title?: string;
  intro?: string;
}
export interface BuilderPageFlowConfig {
  enabled: boolean;
  /** Indexed like pageNames (0-based); sparse; entries >= pageCount are ignored. */
  pages?: Array<BuilderPageFlowPage | null>;
  /** Default true. */
  validateOnNext?: boolean;
  /** Default "all-active". */
  breadcrumb?: "all-active" | "visited" | "hidden";
  /** "Step n of m" over active pages; absent = design.showProgressBar. */
  showProgress?: boolean;
  review?: BuilderPageFlowLandmark & { requireBeforeSubmit?: boolean; editLinkText?: string };
  /** Shown after a successful submit while the form stays open. */
  confirmation?: BuilderPageFlowLandmark & { body?: string };
}

// ---------- Validators ----------
export type BuilderValueFormat = "bc-phn" | "ca-postal" | "money";

// ---------- Tables (BuilderField.tableConfig AND ParsedField.tableConfig) ----------
export type BuilderRepeatOrphanPolicy = "remove-if-unanswered" | "keep-flagged" | "remove";
export interface BuilderTableRepeatFor {
  /** Another table field whose rows seed this one (one row each). */
  sourceFieldId: string;
  /** Source column giving row identity; default the source `_rowId`. */
  keyColumnId?: string | null;
  /** Source column shown as a read-only row label. */
  labelColumnId?: string | null;
  /** Heading of the row-label column (default "Item"; the builder offers the source column's label). */
  labelTitle?: string;
  /** Optional target column receiving a copy of the label (PDF/FHIR). */
  labelTargetColumnId?: string | null;
  /** Over the SOURCE row: controllerFieldId = source column id; no conditionRef. */
  filter?: FieldConditionGroup | null;
  /** Default "remove-if-unanswered" (answered orphans kept + flagged). */
  orphanPolicy?: BuilderRepeatOrphanPolicy;
  /** Default false. */
  allowManualRows?: boolean;
  /**
   * Shown instead of an empty grid when no source row matches; default
   * "No matching <labelTitle> — nothing to answer here." (RepeatForEachTable).
   */
  emptyMessage?: string;
  /**
   * How the seeded rows are presented at runtime. Default "grid" (one table
   * row per item). "cards" renders one card per item headed by its label, with
   * the item's questions stacked beneath it. Presentation only — the stored
   * value is the same rows array either way, so sync, completion, validation,
   * the review page and PDF fill are unaffected.
   */
  presentation?: "grid" | "cards";
}
export interface BuilderTableRowCompletion {
  enabled: boolean;
  /** Complete when all have a meaningful value; absent = visible non-computed columns. */
  requiredColumnIds?: string[];
  /** Incomplete rows block Next/Submit and appear in the error summary. */
  requireAllComplete?: boolean;
  statusLabel?: string;
}
export interface BuilderTablePdfOverflow {
  /** "drop" = current behaviour. */
  mode: "drop" | "addendum";
  /** Derive row field names beyond the explicit map, e.g. "{base}_{row}", "{base}[{row0}]". */
  numberedFieldPattern?: string | null;
  addendumTitle?: string;
  /** Columns printed in the addendum; default all visible. */
  columnIds?: string[];
}
/** Runtime row metadata keys (same underscore convention as _rowId). */
export const TABLE_ROW_META = {
  rowId: "_rowId",
  sourceKey: "_sourceKey",
  sourceRemoved: "_sourceRemoved",
  complete: "_complete",
} as const;

// ---------- Document-fill preparers (SessionFooterButtonConfig + FooterButtonConfig: pdfPreparers?) ----------
interface DocumentFillPreparerBase {
  id: string;
  enabled?: boolean;
  when?: FieldConditionGroup | null;
}
/** targetId: a form-data key, or "pdf:<AcroFieldName>" to write straight to a PDF field. */
export type DocumentFillPreparer = DocumentFillPreparerBase & (
  | { kind: "concat"; sourceIds: string[]; separator?: string; skipEmpty?: boolean; targetId: string }
  | { kind: "split"; sourceId: string; separator: string; targetIds: string[] }
  | { kind: "map-value"; sourceId: string; map: Record<string, string>; fallback?: string; targetId?: string }
  | { kind: "format-date"; sourceId: string; format: string; targetId?: string }
  | { kind: "table-to-text"; tableId: string; template: string; separator?: string; startRow?: number; targetId: string }
  | { kind: "copy"; sourceId: string; targetId: string }
);

export interface FieldLinkRule {
  /** PowerForm page navigation while a Show/Hide rule makes the page inactive.
   * Native Cerner conditional sections default to disable; hide is preview-only. */
  cernerInactivePageBehavior?: "disable" | "hide";
  /** Recursive conditions override the legacy flat condition pairs when present. */
  conditionGroup?: FieldConditionGroup;
  /** Default preserves user answers; always explicitly opts into overwriting. */
  copyPolicy?: "when-empty" | "until-edited" | "always";
  id: string;
  /** The field whose value triggers the rule */
  controllerFieldId: string;
  /** The condition that triggers the action */
  condition: FieldLinkCondition;
  /** Additional conditions evaluated together with the primary pair. */
  additionalConditions?: Array<{ controllerFieldId: string; condition: FieldLinkCondition }>;
  /** How the primary + additional conditions combine. Default "all". */
  conditionMatch?: "all" | "any";
  /**
   * How a synthesized inline-visibility rule handles an existing answer when
   * it hides its target. Default: 'preserve'.
   */
  hiddenAnswerPolicy?: HiddenAnswerPolicy;
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
  /**
   * Shown to the person filling the form when an `invalid` rule fires. Say what
   * is wrong rather than restating the condition -- "Discharge cannot be before
   * admission" beats "discharge_date is less than admission_date".
   */
  validationMessage?: string;
  /** Optional description for UI display */
  description?: string;
}

export type MoisFormType =
  | "ACTIVITY"
  | "ATTACHMENT"
  | "CALCULATOR"
  | "FLOWSHEET"
  | "TESTFORM"
  /** Legacy saved values retained for import compatibility; not offered for new forms. */
  | "WEBCLIENT"
  | "TEST";

export const MOIS_FORM_TYPE_OPTIONS: Array<{ value: MoisFormType; label: string }> = [
  { value: "ACTIVITY", label: "Activity" },
  { value: "ATTACHMENT", label: "Attachment" },
  { value: "CALCULATOR", label: "Calculator" },
  { value: "FLOWSHEET", label: "Flowsheet" },
  { value: "TESTFORM", label: "Test form" }
];

export const DEFAULT_MOIS_FORM_TYPE: MoisFormType = "ATTACHMENT";

export interface MoisSemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Per-form metadata written to the exported MOIS Identity.json/manifest.
 * The package name and title continue to follow the builder document name.
 */
import type { BuilderFormLifecycle } from "./lifecycle";

export interface BuilderMoisIdentityMetadata {
  author?: string;
  owner?: string;
  publisher?: string;
  description?: string;
  globalIdentifier?: string;
  version?: MoisSemanticVersion;
  requiredFormViewerVersion?: MoisSemanticVersion;
  requiredMoisVersion?: MoisSemanticVersion;
  isEncounterRequired?: boolean;
}

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
      headingStyle: "main",
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
export type FormHeaderSpacing = "auto" | "compact" | "standard" | "spacious";
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
  /** Space below the sticky form header. Automatic adapts to available header navigation. */
  headerSpacing?: FormHeaderSpacing;
  rtlLayout: boolean;
  uppercaseLabels: boolean;
  uiTranslations?: Record<string, Record<string, string>>;

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
  labelPosition: "left",
  showProgressBar: false,
  formWidth: "centered",
  questionSpacing: "standard",
  headerSpacing: "auto",
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
  authoring?: import("./offline-authoring").OfflineAuthoringState;
  name: string;
  fields: BuilderField[];
  design: FormDesign;
  identityType: MoisFormType;
  identityCode: string;
  identityMetadata?: BuilderMoisIdentityMetadata;
  /**
   * Draft / published / retired, with the governance dates and the change log.
   * Absent means draft: see `resolveBuilderFormStatus`, which fails closed so a
   * document written before this existed is not treated as approved for use.
   */
  lifecycle?: BuilderFormLifecycle;
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
  /**
   * Per-page "print only this page" button labels, indexed like `pageNames`.
   * A non-empty string renders the button on that page; null/undefined omits it.
   * Used for patient-facing handouts that must print without the clinical pages.
   */
  pagePrintLabels?: (string | null)[];
  pageAssignments: Record<string, number | null>;
  workflow?: BuilderWorkflowConfig;
  /** Reusable named conditions (Logic tab library); refs carry materialized copies. */
  conditions?: BuilderNamedCondition[];
  /** Conditional page flow (skip/branch/review). Not on variants: disabled for multi-version forms. */
  pageFlow?: BuilderPageFlowConfig | null;
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
  pagePrintLabels?: (string | null)[];
  pageAssignments: Record<string, number | null>;
  investigationTabs?: BuilderInvestigationTab[];
  investigationTabAssignments?: Record<string, string | null>;
}

export interface BuilderVariantSelectorConfig {
  label: string;
  style: "dropdown" | "buttons";
  displayMode?: "inline" | "changeButton";
  /**
   * "per-version": each variant carries its own field set (default, legacy behavior).
   * "shared": variants are selection labels only — the base document's fields render
   * once for every version, and the runtime exposes the chosen version to the form
   * (persisted as builderVariantId/builderVariantLabel in form data).
   */
  contentMode?: "per-version" | "shared";
}

export {
  compileFieldLinkConditionGroup,
  compileFieldLinkProtectionRule,
  compileFieldLinkVisibilityRule,
  collectConditionRefs,
  collectDirectConditionRefs,
  conditionDataEqual,
  createConditionRefGroup,
  NAMED_CONDITION_MAX_DEPTH,
  DEFAULT_CROSS_FIELD_VALIDATION_MESSAGE,
  detachConditionRef,
  evaluateConditionGroupWithLibrary,
  findNamedConditionCycles,
  materializeConditionRefs,
  evaluateCrossFieldValidation,
  evaluateFieldCondition,
  getFieldLinkConditionEntries,
  getFieldLinkConditionGroup,
  evaluateConditionGroup,
  evaluateFieldLinkRuleCondition,
  isConditionEntryMeaningful,
  isConditionValueEmpty,
  normalizeConditionBoolean,
  normalizeConditionChoiceValues,
  normalizeConditionComparable,
  type CompiledFieldLinkConditionGroup,
  type CompiledFieldLinkProtectionRule,
  type CompiledFieldLinkVisibilityRule,
  type ConditionRefIssue,
  type CrossFieldValidationError,
  type NamedConditionLibrary,
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
export {
  BUILDER_FIELD_AUTHORING_CONTRACTS,
  BUILDER_FIELD_COMMON_AUTHORING_PROPERTIES,
  buildBuilderFieldAuthoringSchema,
  getBuilderFieldAuthoringContract,
  getBuilderFieldAuthoringDefaults,
  validateBuilderFieldAuthoringValue,
  type BuilderAuthoringJsonSchema,
  type BuilderFieldAuthoringContract,
} from "./field-authoring-contracts";

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
export * from "./lifecycle";
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
