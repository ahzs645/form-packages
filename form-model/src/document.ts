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

export type TableChoiceOption = string | {
  label: string;
  value?: string;
  score?: number;
  description?: string;
};

export interface TableColumn {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "time" | "choice" | "booleanYesNo" | "checkbox" | "stampButton";
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
  options?: TableChoiceOption[] | null;
  choiceStyle?: "dropdown" | "radio" | "multiselect" | "checkbox" | "simpleCodeSelect" | "findCode";
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
  visibility?: {
    type: "always" | "filled" | "equals" | "gt" | "lt";
    controllerId?: string;
    value?: string;
  } | null;
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
  } | null;
}

export type TableMode = "inline" | "modal";
export type LayoutTableCellKind = "text" | "field" | "fieldList" | "resources" | "computed" | "stampButton";
export type LayoutTableCellInputType = "text" | "textarea" | "number" | "date" | "time" | "choice" | "choiceMulti" | "booleanYesNo" | "booleanSingle";
export type LayoutTableSourceFormat = "text" | "date" | "dateTime" | "visitCode";
export interface LayoutTableStampTarget {
  fieldId: string;
  sourcePath?: string;
  value?: string | number | boolean | null;
  fallback?: string | number | boolean | null;
}
export interface LayoutTableCellField {
  id?: string;
  fieldId: string;
  label?: string;
  name?: string;
  inputType?: LayoutTableCellInputType;
  optionList?: string[] | Array<{ key?: string; text?: string; code?: string; display?: string }>;
  codeSystem?: string;
}
export interface LayoutTableCell {
  id: string;
  kind: LayoutTableCellKind;
  text?: string;
  sourcePath?: string;
  sourcePaths?: string[];
  sourceFormat?: LayoutTableSourceFormat;
  sourceFallback?: string | number | boolean | null;
  defaultValue?: string | number | boolean | null;
  fieldId?: string;
  label?: string;
  readOnly?: boolean;
  fields?: LayoutTableCellField[];
  inputType?: LayoutTableCellInputType;
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
  targets?: LayoutTableStampTarget[];
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
export interface LayoutTableRow {
  id: string;
  cells: LayoutTableCell[];
  visibleWhen?: {
    fieldId: string;
    operator?: "truthy" | "yes" | "equals" | "notEquals";
    value?: string | number | boolean | null;
  };
}
export interface LayoutTableConfig {
  presetId?: string;
  rows: LayoutTableRow[];
  showLabel?: boolean;
  bordered?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  cellPadding?: number;
  borderColor?: string;
  pageBreakInsideAvoid?: boolean;
  quickNavTarget?: string;
}
export type FieldPrefillValue =
  | string
  | number
  | boolean
  | null
  | FieldPrefillValue[]
  | { [key: string]: FieldPrefillValue };

export interface ParsedField {
  id: string;
  label: string;
  kind: ComponentKind;
  rawType: string;
  required: boolean;
  lockWhenSectionComplete?: boolean;
  lockWhen?: {
    field: string;
    operator?: "truthy" | "equals" | "notEquals";
    value?: string | number | boolean | null;
  } | null;
  booleanStyle?: "single" | "yesNo";
  booleanLabels?: { on: string; off: string } | null;
  booleanNeutralMode?: "cycle" | "initial" | "none";
  choiceStyle?:
    | "dropdown"
    | "radio"
    | "multiselect"
    | "checkbox"
    | "simpleCodeSelect"
    | "findCode";
  /** Layout of radio/checklist answers inside a SimpleCodeChecklist field. */
  choiceAnswerLayout?: "vertical" | "responsive" | "columns-2" | "columns-3" | "columns-4";
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
  optionDetails?: Array<{
    value: string;
    label: string;
    hotKey?: string;
    order?: number;
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
  tableConfig?: {
    columns: TableColumn[];
    mode?: TableMode;
    orientation?: "horizontal" | "vertical";
    allowAddRows: boolean;
    allowRemoveRows: boolean;
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
  };
  layoutTableConfig?: LayoutTableConfig | null;
  page?: number;
  bbox?: BoundingBox;
  widgets?: WidgetGeometry[];
  pdfFieldAliases?: string[];
  /** Builder-authored answer sync group. Primary renderers write into every linked answer field id. */
  linkedAnswerGroupId?: string | null;
  linkedAnswerFieldIds?: string[];
  // New field type properties
  textareaRows?: number;
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
  numberTypeNumber?: "number" | "decimal" | "year";
  numberButtonControls?: boolean;
  numberStoreAsNumber?: boolean;
  numberSpinButtonProps?: {
    min?: number;
    max?: number;
    step?: number;
  };
  /** `{ answer -> score }` map from this field's options, when any option has a
   *  score. Lets `score([id])` formulas be compiled with the live option scores
   *  at export time. Keyed by both stored value and label. */
  optionScores?: Record<string, number>;
  computedExpression?: string;
  computedPrecision?: number;
  computedResultType?: "number" | "text";
  computedCalculationPolicy?:
    | "always-calculated"
    | "calculated-until-overridden"
    | "suggested-calculation";
  computedShowInterpretation?: boolean;
  computedInterpretation?: {
    label?: string;
    ranges: Array<{
      min?: number;
      max?: number;
      label: string;
      description?: string;
    }>;
  } | null;
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
  scaleOptions?: Array<{
    value: number;
    label: string;
    description?: string;
  }>;

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
  dateFormat?: "yyyy.MM.dd" | "dd/MM/yyyy" | "MM-dd-yyyy" | "yyyy-MM-dd";
  disablePastDates?: boolean;
  disableFutureDates?: boolean;
  prefillToday?: boolean;
  dateMinDate?: string;
  dateMaxDate?: string;
  dateBorderless?: boolean;
  dateButtonControls?: boolean;
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
  helpPosition?: "above_input" | "below_input";
  hidden?: boolean;
  disabled?: boolean;
  width?: "auto" | "full" | "1/2" | "1/3" | "2/3" | "1/4" | "3/4";
  labelPosition?: "top" | "left" | "none";
  prefill?: FieldPrefillValue;
  validation?: {
    rules?: Array<{
      type: "required" | "minLength" | "maxLength" | "pattern" | "min" | "max" | "email" | "url" | "custom";
      value?: string | number;
      message?: string;
    }>;
    customError?: string;
    listMode?: "allowlist" | "denylist";
    listValues?: string[];
    listMatch?: "domain" | "address";
  } | null;

  // Inline show-when rule (builder field visibility editor). The exporter
  // synthesizes a fieldLinkRule from it (renderJsx) — without this the rule
  // was preview-only.
  visibility?: {
    type: "always" | "filled" | "equals" | "gt" | "lt";
    controllerId?: string;
    value?: string;
  } | null;

  // Direct MOIS output mapping authored in the builder.
  moisOutput?: {
    enabled?: boolean;
    /** "dcoObservation" is a legacy fixture alias of "observation". */
    kind: "observation" | "documentComment" | "dcoObservation";
    observationCode?: string;
    /** Standard LOINC code carried alongside the MOIS observationCode. */
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
    valueType?: "TEXT" | "NUMERIC" | "VALUESET" | "numeric" | "text";
    valueSource?: "display" | "code";
    reportFromDisplay?: boolean;
    deleteWhenFalse?: boolean;
    /**
     * Report template with {display}/{code}/{value}/{comment} tokens (the
     * CodedObservationChoiceField contract). Wins over reportFromDisplay and
     * reportFieldId when set.
     */
    reportTemplate?: string;
    /** Field whose value fills the {comment} token in reportTemplate. */
    commentFieldId?: string;
    /** Persisted value override ("See report" pattern); field value gates the write. */
    valueTemplate?: string;
    reportFieldId?: string;
    /** Static units selected from the MOIS measure dictionary. */
    units?: string;
    unitsFieldId?: string;
    unitsInline?: boolean;
    conditionalFieldId?: string;
    /** When set, the conditionalFieldId gate becomes "value in this set". */
    conditionalValues?: string[];
    condition?: {
      fieldId: string;
      operator?: "truthy" | "equals" | "notEquals" | "yes" | "no" | "in" | "notIn";
      value?: string | number | boolean | null;
      values?: Array<string | number>;
    };
    commentTemplate?: string;
    rangeNormalLow?: string;
    rangeNormalHigh?: string;
    rangeAbsurdLow?: string;
    rangeAbsurdHigh?: string;
    referenceRangeText?: string;
  } | null;

  // Text field settings
  maxCharLimit?: number;
  showCharLimit?: boolean;
  secretInput?: boolean;
  richTextSource?: string | null;
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
  sectionCollapsible?: boolean;
  sectionDefaultCollapsed?: boolean;
  sectionLayoutType?: "grid" | "stacked";
  sectionGridColumns?: 1 | 2 | 3 | 4;
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
  moisNavigation?: {
    moisModule: string;
    objectIdSourcePath?: string | null;
  } | null;
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
