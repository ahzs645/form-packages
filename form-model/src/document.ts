/**
 * Parsed-field and extraction contracts. Shapes that are meant to match the
 * builder model are derived from ./index rather than copied, so the two
 * cannot drift; only the parsed projection's own keys are declared here.
 */
import type {
  BuilderChoiceOption,
  BuilderField,
  BuilderFieldMoisConfig,
  BuilderFieldSourceConfig,
  BuilderLayoutTableCell,
  BuilderLayoutTableCellField,
  BuilderLayoutTableCellInputType,
  BuilderLayoutTableCellKind,
  BuilderLayoutTableConfig,
  BuilderLayoutTableRow,
  BuilderLayoutTableSourceFormat,
  BuilderLayoutTableSourceMode,
  BuilderLayoutTableStampTarget,
  BuilderLockWhenRule,
  BuilderMoisOutputMapping,
  BuilderOscarImportMapping,
  BuilderRichTextImageAsset,
  BuilderTableMode,
  BuilderValidationConfig,
  BuilderVisibilityCondition,
  BuilderVisibilityRule,
  CalculatedValueDisplayStyle,
  CalculatedValuePolicy,
  FieldWidth,
  HelpPosition,
  IncompleteCalculationBehavior,
  MoisNavigationTarget,
} from "./index";

export type ComponentKind =
  | "text"
  | "number"
  | "boolean"
  | "choice"
  | "date"
  | "time"
  | "table"
  | "layoutTable"
  | "component"
  | "rating"
  | "slider"
  | "scale"
  | "matrix"
  | "barcode"
  | "file"
  | "signature"
  | "section"
  | "heading";

export interface MeasurementFieldConfig {
  enabled?: boolean;
  observationCode?: string;
  observationComment?: string;
  valueType?: "TEXT" | "NUMERIC";
  saveDescription?: string;
  saveUnits?: string;
  persistenceMode?: "formOnly" | "observationAndForm";
  maxHistory?: number;
  autoFillFromHistory?: boolean;
  showHistory?: boolean;
  showHistoryList?: boolean;
  showHistoryOnFocus?: boolean;
  historyInitiallyVisible?: boolean;
  inlineLayout?: boolean;
  emptyHistoryText?: string;
  graphLinkText?: string;
  graphHref?: string;
  abnormalLow?: number;
  abnormalHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  abnormalMessage?: string;
  normalMessage?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetGeometry {
  page?: number;
  bbox: BoundingBox;
}

export type TableChoiceOption = BuilderChoiceOption;

/** One column of a builder table, as stored on `BuilderField.tableConfig.columns`. */
type BuilderTableColumn = NonNullable<BuilderField["tableConfig"]>["columns"][number];

/** A builder table column plus the keys only the parsed projection carries. */
export interface TableColumn extends BuilderTableColumn {
  /** Project one modal answer into two PDF-backed text paths. */
  textContinuation?: { firstPath: string; secondPath: string; firstSegmentMaxChars: number } | null;
}

export type TableMode = BuilderTableMode;
export type LayoutTableCellKind = BuilderLayoutTableCellKind;
export type LayoutTableCellInputType = BuilderLayoutTableCellInputType;
export type LayoutTableSourceFormat = BuilderLayoutTableSourceFormat;
export type LayoutTableSourceMode = BuilderLayoutTableSourceMode;
export type LayoutTableStampTarget = BuilderLayoutTableStampTarget;
export type LayoutTableCellField = BuilderLayoutTableCellField;
export type LayoutTableCell = BuilderLayoutTableCell;
export type LayoutTableRow = BuilderLayoutTableRow;
export type LayoutTableConfig = BuilderLayoutTableConfig;
export type FieldPrefillValue =
  | string
  | number
  | boolean
  | null
  | FieldPrefillValue[]
  | { [key: string]: FieldPrefillValue };

export type ParsedFieldVisibilityCondition = BuilderVisibilityCondition;

export type ParsedFieldVisibility = BuilderVisibilityRule;

/**
 * The builder's MOIS output mapping plus two keys older fixtures carry
 * verbatim (the CodedObservationChoiceField report contract). They belong on
 * BuilderMoisOutputMapping; until they move there the parsed copy declares them.
 */
export type ParsedMoisOutputMapping = BuilderMoisOutputMapping & {
  /**
   * Report template with {display}/{code}/{value}/{comment} tokens (the
   * CodedObservationChoiceField contract). Wins over reportFromDisplay and
   * reportFieldId when set.
   */
  reportTemplate?: string;
  /** Field whose value fills the {comment} token in reportTemplate. */
  commentFieldId?: string;
};

type BuilderTableConfig = NonNullable<BuilderField["tableConfig"]>;

/** A builder table config with the parsed projection's defaults applied. */
export type ParsedTableConfig = Omit<BuilderTableConfig, "columns" | "allowAddRows" | "allowRemoveRows"> & {
  columns: TableColumn[];
  allowAddRows: boolean;
  allowRemoveRows: boolean;
};

export interface ParsedField {
  documentLayout?: import("./document-layout").DocumentLayout;
  /** Canonical answer values to target MOIS codes, used for rule projection. */
  answerValueAliases?: Record<string, string>;
  answerSetIssue?: string;
  behavior?: import("./index").BuilderFieldBehavior;
  translations?: import("./index").BuilderField["translations"];
  id: string;
  label: string;
  kind: ComponentKind;
  rawType: string;
  required: boolean;
  lockWhenSectionComplete?: boolean;
  /** Lock once the MOIS record is SIGNED. Defaults on; set false to opt out. */
  lockWhenSigned?: boolean;
  /** @deprecated Legacy lock rule; read locks with `readLockCondition`. */
  lockWhen?: BuilderLockWhenRule | null;
  /** Neutral lock condition (see BuilderField.lockCondition). Present only when set. */
  lockCondition?: BuilderField["lockCondition"];
  /**
   * The default answer descriptor (see BuilderField.defaultAnswer), as
   * readDefaultAnswer resolves it on the builder field. Present only when the
   * builder field stores a descriptor, so a chart or latest-observation
   * default, which has no legacy `prefill` spelling, reaches the exporters.
   */
  defaultAnswer?: BuilderField["defaultAnswer"];
  /**
   * Where `required` came from when it is not the field's own setting
   * (readFieldValidation): a `validation.rules` required entry or the Cerner
   * required preference kept from an import. `required` already holds the
   * resolved value; this is provenance. Present only for those sources.
   */
  requiredSource?: "validation-rule" | "cerner-preference" | "fhir-item";
  /** Label styling carried to whichever target renders the form. */
  labelColor?: string | null;
  labelHighlight?: string | null;
  labelBold?: boolean;
  booleanStyle?: "single" | "yesNo";
  booleanLabels?: { on: string; off: string } | null;
  booleanNeutralMode?: "cycle" | "initial" | "none";
  choiceStyle?: BuilderField["choiceStyle"];
  /** Layout of radio/checklist answers inside a SimpleCodeChecklist field. */
  choiceAnswerLayout?: BuilderField["choiceAnswerLayout"];
  codeSystem?: string; // MOIS code system (e.g., "MOIS-MARITALSTATUS")
  showOtherOption?: boolean; // Allow "Other" option with custom input
  /** Emit MOIS autoHotKey on coded selects/checklists (keyboard shortcuts). */
  autoHotKey?: boolean;
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
      /** Stored answer key when it differs from the score. See BuilderField.scaleConfig. */
      key?: string;
    }>;
    [key: string]: unknown;
  } | null;
  labelHints?: string[];
  optionStates?: string[];
  /**
   * Structured choice options carrying the stored code (`value`) when it
   * differs from the label, plus explicit MOIS hotKey/order. When present the
   * choice renderer serializes these (and keeps them alongside `codeSystem`,
   * matching CodedObservationChoiceField precedence: inline options win).
   */
  /** Answers that clear the others when chosen (option `exclusive`). */
  exclusiveOptionValues?: string[];
  optionDetails?: Array<{
    value: string;
    label: string;
    hotKey?: string;
    order?: number;
    /** Visual nesting only; it does not create selection dependencies. */
    presentationDepth?: number;
    /** Stored value of the visual parent; never emitted as an answer implicitly. */
    presentationParentValue?: string;
  }>;
  /** MOIS control density for coded selects/checklists (`size` prop). */
  choiceSize?: string;
  /** MOIS per-option density for coded selects/checklists (`optionSize` prop). */
  choiceOptionSize?: string;
  /**
   * Past-measurement binding on a core text/number field — exports as the
   * PastMeasurementField runtime with standard observation paths baked in
   * (lib/measurement-field-config.ts).
   */
  measurementConfig?: MeasurementFieldConfig | null;
  /**
   * The field's chart binding as the MOIS export realises it (the neutral
   * binding read from every store, less the parts a past measurement or no
   * MOIS store holds; lib/mois-export/field-binding.ts). Present only when set.
   */
  binding?: BuilderField["binding"];
  /**
   * The field's reference ranges, read from every store (lib/reference-ranges.ts):
   * normal, critical and feasible limits by patient. Present only when set.
   */
  referenceRanges?: import("./reference-ranges").ReferenceRangeBand[];
  /** Field-level MOIS source binding, carried verbatim from BuilderField. */
  sourceConfig?: BuilderFieldSourceConfig | null;
  /** Field-level MOIS save key / mutation / module link, carried verbatim. */
  moisConfig?: BuilderFieldMoisConfig | null;
  /** OSCAR import provenance and the user's mapping-review decision. */
  oscarImport?: BuilderOscarImportMapping | null;
  tableConfig?: ParsedTableConfig;
  layoutTableConfig?: LayoutTableConfig | null;
  page?: number;
  bbox?: BoundingBox;
  widgets?: WidgetGeometry[];
  pdfFieldAliases?: string[];
  /** AcroForm /MaxLen read from the source PDF text field, when present. */
  maxLen?: number;
  /** Builder-authored answer sync group. Primary renderers write into every linked answer field id. */
  linkedAnswerGroupId?: string | null;
  linkedAnswerFieldIds?: string[];
  // New field type properties
  textareaRows?: number;
  /** Explicit MOIS control size for the textarea input, overriding the width-derived size. */
  moisSize?: string;
  textareaMultiline?: boolean;
  textareaBorderless?: boolean;
  textareaResizable?: boolean;
  timeFormat?: "12h" | "24h";
  maxStars?: number;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  acceptedFileTypes?: string[];
  maxFileSize?: number;

  // Number field properties
  numberTypeNumber?: NonNullable<BuilderField["numberConfig"]>["typeNumber"];
  numberButtonControls?: boolean;
  numberStoreAsNumber?: boolean;
  numberSpinButtonProps?: NonNullable<BuilderField["numberConfig"]>["spinButtonProps"];
  /** `{ answer -> score }` map from this field's options, when any option has a
   *  score. Lets `score([id])` formulas be compiled with the live option scores
   *  at export time. Keyed by both stored value and label. */
  optionScores?: Record<string, number>;
  computedExpression?: string;
  computedPrecision?: number;
  computedResultType?: "number" | "text";
  computedDisplayStyle?: CalculatedValueDisplayStyle;
  /** Presentation-only suffix resolved from an enabled computed-field suffix setting. */
  computedDisplaySuffix?: string;
  computedCalculationPolicy?: CalculatedValuePolicy;
  /** What to do before every referenced input has a value. Defaults to "compute-anyway". */
  computedIncompleteBehavior?: IncompleteCalculationBehavior;
  /** Text shown in place of the total when computedIncompleteBehavior is "show-text". */
  computedIncompleteText?: string;
  computedShowInterpretation?: boolean;
  computedInterpretation?: NonNullable<BuilderField["computedConfig"]>["interpretation"];
  /** Persist this computed value as the webform's linked MOIS calculated
   *  observation on submit (`calculated` -> ObservationInput on the save
   *  mutations). Only present when enabled in the builder; the exporter
   *  derives `MoisExportParams.calculatedUpdate` from the first field
   *  carrying this. */
  computedMoisCalculated?: {
    observationCode?: string;
    loincCode?: string;
    system?: string;
    labCode?: string;
    status?: string;
    dictionaryMetadata?: {
      label?: string;
      description?: string;
      category?: string;
      units?: string;
    };
    description?: string;
    valueType?: "NUMERIC" | "TEXT";
    units?: string;
    reportFieldId?: string;
    reportedByFieldId?: string;
    reportedDateFieldId?: string;
  } | null;
  /** Read-only prior observations displayed with a computed field. This is
   *  intentionally separate from computedMoisCalculated so history settings
   *  never leak into the MOIS calculated-observation write payload. */
  computedObservationHistory?: {
    observationCode?: string;
    loincCode?: string;
    units?: string;
    maxRows?: number;
    graphLinkText?: string;
    graphHref?: string;
  } | null;

  // Optional suffix rendered inside single-line text or numeric inputs
  inputSuffix?: string;

  // Scale field properties
  scaleMin?: number;
  scaleMax?: number;
  scaleStep?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  scaleStyle?: "numeric" | "labeled";
  scaleShowLegend?: boolean;
  scaleShowInlineLabels?: boolean;
  scaleShowTooltip?: boolean;
  scaleTooltipMode?: "option" | "all";
  /** Stored answer key per option when it differs from the score. See BuilderField.scaleConfig. */
  scaleOptions?: NonNullable<BuilderField["scaleConfig"]>["options"];

  // Matrix field properties
  matrixRows?: string[];
  matrixColumns?: string[];
  matrixMultiplePerRow?: boolean;
  matrixAutoNumberRows?: boolean;
  matrixRowLabelStyle?: "numbers" | "letters";

  // Barcode field properties
  barcodeDecoders?: Array<"qr" | "ean" | "ean8" | "upc" | "upc_e" | "code128" | "code39">;

  // Date field properties
  dateWithTime?: boolean;
  dateRange?: boolean;
  dateFormat?: NonNullable<BuilderField["dateConfig"]>["dateFormat"];
  documentOutputFormat?: NonNullable<BuilderField["dateConfig"]>["documentOutputFormat"];
  disablePastDates?: boolean;
  disableFutureDates?: boolean;
  prefillToday?: boolean;
  dateMinDate?: string;
  dateMaxDate?: string;
  /** dateConfig.relativeMinDate (a limit counted from today). Present only when set. */
  dateRelativeMinDate?: NonNullable<BuilderField["dateConfig"]>["relativeMinDate"];
  /** dateConfig.relativeMaxDate (a limit counted from today). Present only when set. */
  dateRelativeMaxDate?: NonNullable<BuilderField["dateConfig"]>["relativeMaxDate"];
  dateBorderless?: boolean;
  dateButtonControls?: boolean;
  dateFillTodayOnCalendarOpen?: boolean;
  dateShowAge?: boolean;
  dateVertical?: boolean;

  // Phone field properties
  phoneUseSimpleInput?: boolean;
  phoneDefaultCountry?: string;
  phoneExcludeCountries?: string[];
  phoneAllowExtension?: boolean;
  phoneExtensionPlaceholder?: string;
  phoneExtensionFieldId?: string;

  // Hyperlink field properties
  hyperlinkHref?: string;
  hyperlinkLabel?: string;
  hyperlinkTarget?: "_blank" | "_self" | "_parent" | "_top";
  hyperlinkDisplayStyle?: "button" | "inline";

  // Common field settings
  placeholder?: string;
  helpText?: string;
  helpPosition?: HelpPosition;
  pendingConversion?: BuilderField["pendingConversion"];
  hidden?: boolean;
  disabled?: boolean;
  width?: FieldWidth;
  labelPosition?: BuilderField["labelPosition"];
  prefill?: FieldPrefillValue;
  validation?: BuilderValidationConfig | null;

  // Inline show-when rule (builder field visibility editor). The exporter
  // synthesizes a fieldLinkRule from it (renderJsx) — without this the rule
  // was preview-only.
  visibility?: ParsedFieldVisibility | null;

  // Direct MOIS output mapping authored in the builder.
  moisOutput?: ParsedMoisOutputMapping | null;

  // Text field settings
  maxCharLimit?: number;
  showCharLimit?: boolean;
  secretInput?: boolean;
  richTextSource?: string | null;
  richTextImages?: BuilderRichTextImageAsset[];
  richTextReadOnly?: boolean;
  richTextBorderless?: boolean;
  richTextStartingMode?: "edit" | "preview" | "default";
  richTextHeight?: number | null;

  // Choice field settings
  allowCreation?: boolean;
  shuffleOptions?: boolean;
  minSelection?: number;
  maxSelection?: number;

  // File upload settings
  multipleFiles?: boolean;
  cameraUpload?: boolean;

  // Section field properties
  sectionTitle?: string;
  sectionDescription?: string;
  sectionSubtitleBackground?: string;
  sectionSubtitleBorder?: string;
  sectionSubtitlePadding?: string;
  sectionHideTitle?: boolean;
  sectionHeadingStyle?: "main" | "subheading" | "none";
  sectionCollapsible?: boolean;
  sectionDefaultCollapsed?: boolean;
  sectionLayoutType?: "grid" | "stacked";
  sectionGridColumns?: 1 | 2 | 3 | 4;
  sectionRowSeparators?: boolean;
  sectionQuestionSpacing?: "compact" | "standard" | "comfortable" | "spacious";
  childFieldIds?: string[];
  sectionShowScaleLegend?: boolean;
  sectionAuthorshipPolicy?: {
    enabled?: boolean;
    granularity?: "field" | "row";
    lockOn?: "save" | "sign" | "submit";
    showStatusColumn?: boolean;
  };

  // Heading field properties
  /** MOIS module link for heading component */
  moisNavigation?: MoisNavigationTarget | null;
  /** @deprecated Prefer moisNavigation */
  moisModule?: string | null;
  sectionScaleLegendOptions?: Array<{
    value: number;
    label: string;
    description?: string;
  }>;
  sectionScaleLegendPreset?: string;
}

export interface FieldConstraint {
  maxLength?: number | null;
  typeHint?: string | null;
  labelHint?: string | null;
}

export type ExtractAnswerType =
  | "number"
  | "email"
  | "name"
  | "national_insurance_number"
  | "phone_number"
  | "organisation_name"
  | "address"
  | "date"
  | "time_period"
  | "single_choice"
  | "multiple_choice"
  | "text"
  | "text_area"
  | "yes_no_question"
  | "information_page";

export interface ExtractedOption {
  value?: string | null;
  text: string;
}

export interface ExtractedQuestion {
  question_number?: number | null;
  question_text: string;
  hint_text?: string | null;
  help_text?: string | null;
  needs_routing?: boolean | null;
  answer_type: ExtractAnswerType;
  answer_settings?: {
    input_type?:
      | "date_of_birth"
      | "other_date"
      | "full_name"
      | "uk_address"
      | "international_address";
  } | null;
  information?: string | null;
  options: ExtractedOption[];
}

export interface ExtractedPage {
  page: number;
  questions: ExtractedQuestion[];
}

export interface ExtractedFormResult {
  alert?: string | null;
  pages: ExtractedPage[];
}
