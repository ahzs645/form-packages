/**
 * Parsed-field and extraction contracts. Shapes that are meant to match the
 * builder model are derived from ./index rather than copied, so the two
 * cannot drift; only the parsed projection's own keys are declared here.
 */
import type {
  BuilderChoiceOption,
  BuilderField,
  BuilderTableColumn,
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
  BuilderOscarImportMapping,
  BuilderTableMode,
  BuilderVisibilityCondition,
  BuilderVisibilityRule,
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

type BuilderTableConfig = NonNullable<BuilderField["tableConfig"]>;

/** A builder table config with the parsed projection's defaults applied. */
/** The parsed (export-side) copy keeps the column view of the table's group. */
export type ParsedTableConfig = Omit<BuilderTableConfig, "group" | "allowAddRows" | "allowRemoveRows"> & {
  columns: TableColumn[];
  allowAddRows: boolean;
  allowRemoveRows: boolean;
};

/**
 * A form field as an importer or the layout layer sees it: the neutral,
 * flattened shape the PDF/AcroForm, XFA, OSCAR eForm and AI extraction
 * importers produce, that sessions and layout drafts store, and that grouping,
 * accessibility, PDF autofill and the PDF studio read.
 *
 * It carries identity, kind, label, required, answer options, geometry
 * (page, bbox, widgets, pdfFieldAliases, maxLen), provenance (oscarImport,
 * documentLayout) and the presentation settings those readers use. A key is
 * here because something outside the MOIS exporter reads or writes it; the
 * MOIS-only and lowering-derived keys are on `MoisLoweredField`
 * (lib/mois-export/lowered-field.ts), the shape `lowerBuilderFieldForMois`
 * (lib/mois-export/lower-field.ts) gives a builder field. Every key there is
 * optional, so any ParsedField can be handed to the MOIS exporter.
 *
 * Code that is not MOIS should read the builder field (BuilderField and the
 * neutral readers in this package), not a lowered copy.
 *
 * `rawType` has two meanings, by producer: an importer writes the source's
 * own class (an AcroForm field type, an OSCAR input type), while the MOIS
 * lowering writes the builder type, except that both Yes/No types are
 * "boolean" and a URL with a link target is "hyperlink".
 * `fieldTypeForParsedField` (./field-types) reads either back to a builder
 * type. Lowered fields persist inside layout drafts and share digests, so
 * the lowering does not add a separate key for the builder type.
 */
export interface ParsedField {
  documentLayout?: import("./document-layout").DocumentLayout;
  behavior?: import("./index").BuilderFieldBehavior;
  id: string;
  label: string;
  kind: ComponentKind;
  rawType: string;
  required: boolean;
  booleanStyle?: "single" | "yesNo";
  booleanLabels?: { on: string; off: string } | null;
  choiceStyle?: BuilderField["choiceStyle"];
  codeSystem?: string; // MOIS code system (e.g., "MOIS-MARITALSTATUS")
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
    /** Visual nesting only; it does not create selection dependencies. */
    presentationDepth?: number;
    /** Stored value of the visual parent; never emitted as an answer implicitly. */
    presentationParentValue?: string;
  }>;
  /** Field-level MOIS source binding, carried verbatim from BuilderField. */
  sourceConfig?: BuilderFieldSourceConfig | null;
  /** OSCAR import provenance and the user's mapping-review decision. */
  oscarImport?: BuilderOscarImportMapping | null;
  tableConfig?: ParsedTableConfig;
  page?: number;
  bbox?: BoundingBox;
  widgets?: WidgetGeometry[];
  pdfFieldAliases?: string[];
  /** AcroForm /MaxLen read from the source PDF text field, when present. */
  maxLen?: number;
  /** Builder-authored answer sync group. Primary renderers write into every linked answer field id. */
  linkedAnswerGroupId?: string | null;
  /** The other fields of that group; the preview grouping (buildPreviewGroups) sets it on the primary. */
  linkedAnswerFieldIds?: string[];
  textareaMultiline?: boolean;
  textareaBorderless?: boolean;
  timeFormat?: "12h" | "24h";
  maxStars?: number;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;

  // Number field properties
  numberTypeNumber?: NonNullable<BuilderField["numberConfig"]>["typeNumber"];
  numberButtonControls?: boolean;
  numberStoreAsNumber?: boolean;
  numberSpinButtonProps?: NonNullable<BuilderField["numberConfig"]>["spinButtonProps"];

  // Optional suffix rendered inside single-line text or numeric inputs
  inputSuffix?: string;

  // Scale field properties
  scaleMin?: number;
  scaleMax?: number;
  scaleStep?: number;
  scaleStyle?: "numeric" | "labeled";

  // Date field properties
  dateWithTime?: boolean;
  dateRange?: boolean;
  dateFormat?: NonNullable<BuilderField["dateConfig"]>["dateFormat"];
  dateCalendarView?: NonNullable<BuilderField["dateConfig"]>["calendarView"];
  documentOutputFormat?: NonNullable<BuilderField["dateConfig"]>["documentOutputFormat"];
  disablePastDates?: boolean;
  disableFutureDates?: boolean;
  prefillToday?: boolean;
  dateMinDate?: string;
  dateMaxDate?: string;
  phoneDefaultCountry?: string;
  phoneAllowExtension?: boolean;
  helpText?: string;
  hidden?: boolean;
  prefill?: FieldPrefillValue;

  // Inline show-when rule (builder field visibility editor). The exporter
  // synthesizes a fieldLinkRule from it (renderJsx) — without this the rule
  // was preview-only.
  visibility?: ParsedFieldVisibility | null;

  // Text field settings
  maxCharLimit?: number;
  showCharLimit?: boolean;
  secretInput?: boolean;

  // Section field properties
  sectionTitle?: string;
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
