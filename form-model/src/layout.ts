import type { BoundingBox, ParsedField } from "./document";
import type { GroupSummary } from "./grouping";
import type {
  BuilderField,
  CalculatedValueConfig,
  CalculatedValueRange,
  MoisNavigationTarget,
  ScoreTotalTerm,
} from "./index";

export type LayoutType = "table" | "grid" | "list";

/** Section layout type for field arrangement */
export type SectionLayoutType = "grid" | "stacked";

export type BooleanFieldStyle = 'radio' | 'buttons' | 'toggle';

// Legacy types - kept for backwards compatibility
/** @deprecated Use DisplayOptions instead */
export type PreviewDisplayMode = "default" | "compact-checklist" | "inline-grid";

/** @deprecated Use DisplayOptions instead */
export interface PreviewDisplayOptions {
  mode: PreviewDisplayMode;
  columnsPerRow: number;
  showDetailsOnYes: boolean;
  compactTarget?: 'cards' | 'fields';
  booleanStyle?: BooleanFieldStyle;
  // New fields for backward-compatible migration
  cardGridColumns?: GridColumns;   // Columns for arranging subgroup cards
  fieldGridColumns?: GridColumns;  // Columns for fields inside cards
}

/** @deprecated Use SubgroupDisplayOverride instead */
export interface SubgroupDisplayOptions {
  mode: PreviewDisplayMode;
  columnsPerRow: number;
  fieldsPerRow?: number;
  childRenderMode?: 'card' | 'inline';
  booleanStyle?: BooleanFieldStyle;
  fullWidth?: boolean;  // When true, subgroup spans all card columns
}

// New primitive-based display options
export type GridColumns = 1 | 2 | 3 | 4;
export type SubgroupStyle = 'card' | 'flat';
export type ChildSubgroupStyle = 'card' | 'inline';
export type DisplayOptionsPreset = 'list' | 'compact-cards' | 'wide-grid' | 'custom';

export interface DisplayOptions {
  gridColumns: GridColumns;           // Columns for fields inside cards
  cardGridColumns: GridColumns;       // Columns for arranging subgroup cards
  subgroupStyle: SubgroupStyle;
  childSubgroupStyle: ChildSubgroupStyle;
  booleanStyle: BooleanFieldStyle;
  showDetailsOnYes: boolean;
  labelPosition: LabelPosition;       // Default label position for fields in this section
  showPlaceholders?: boolean;         // Whether to render placeholder text in fields (default: true)
  uppercaseLabels?: boolean;          // Form-wide question-label presentation
}

export interface SubgroupDisplayOverride {
  gridColumns?: GridColumns;          // Override field columns for this subgroup
  childSubgroupStyle?: ChildSubgroupStyle;
  booleanStyle?: BooleanFieldStyle;
  fullWidth?: boolean;                // When true, this subgroup spans all card columns
}

// Default values for new display options
export const defaultDisplayOptions: DisplayOptions = {
  gridColumns: 1,
  cardGridColumns: 1,
  subgroupStyle: 'flat',        // Default to flat (no card borders) - can be toggled on
  childSubgroupStyle: 'inline', // Default to inline (no nested card borders)
  booleanStyle: 'radio',
  showDetailsOnYes: true,
  labelPosition: 'left',
};

// Preset configurations
export const displayOptionsPresets: Record<Exclude<DisplayOptionsPreset, 'custom'>, Partial<DisplayOptions>> = {
  'list': {
    gridColumns: 1,
    cardGridColumns: 1,
    subgroupStyle: 'card',
  },
  'compact-cards': {
    gridColumns: 1,
    cardGridColumns: 2,
    subgroupStyle: 'card',
  },
  'wide-grid': {
    gridColumns: 2,
    cardGridColumns: 1,
    subgroupStyle: 'flat',
  },
};

// Migration function: convert legacy PreviewDisplayOptions to new DisplayOptions
export function migrateDisplayOptions(legacy: PreviewDisplayOptions): DisplayOptions {
  const gridColumns = (legacy.columnsPerRow >= 1 && legacy.columnsPerRow <= 4
    ? legacy.columnsPerRow
    : 2) as GridColumns;

  let subgroupStyle: SubgroupStyle = 'card';
  if (legacy.mode === 'compact-checklist' && legacy.compactTarget === 'fields') {
    subgroupStyle = 'flat';
  }

  // Legacy format didn't distinguish between card and field columns
  // Use gridColumns for fields if compact-checklist with cards, otherwise for cards
  const isCompactCards = legacy.mode === 'compact-checklist' && legacy.compactTarget === 'cards';

  return {
    gridColumns: isCompactCards ? 1 : gridColumns,
    cardGridColumns: isCompactCards ? gridColumns : 1,
    subgroupStyle,
    childSubgroupStyle: 'card',
    booleanStyle: legacy.booleanStyle || 'radio',
    showDetailsOnYes: legacy.showDetailsOnYes ?? true,
    labelPosition: 'top',
  };
}

// Reverse migration: convert new DisplayOptions to legacy PreviewDisplayOptions
export function toLegacyDisplayOptions(options: DisplayOptions): PreviewDisplayOptions {
  // Determine mode based on columns and subgroup style
  const hasCardGrid = options.cardGridColumns > 1;
  const hasFieldGrid = options.gridColumns > 1;

  let mode: PreviewDisplayMode = 'default';
  if (options.subgroupStyle === 'flat') {
    mode = 'compact-checklist';
  } else if (hasCardGrid || hasFieldGrid) {
    mode = 'inline-grid';
  }

  // Use the larger of the two for legacy columnsPerRow (for backwards compat)
  const columnsPerRow = Math.max(options.gridColumns, options.cardGridColumns) as number;

  return {
    mode,
    columnsPerRow,
    showDetailsOnYes: options.showDetailsOnYes,
    compactTarget: options.subgroupStyle === 'flat' ? 'fields' : 'cards',
    booleanStyle: options.booleanStyle,
    // Include new fields for renderers that support them
    cardGridColumns: options.cardGridColumns,
    fieldGridColumns: options.gridColumns,
  };
}

// Migration function: convert legacy SubgroupDisplayOptions to new SubgroupDisplayOverride
export function migrateSubgroupDisplayOptions(legacy: SubgroupDisplayOptions): SubgroupDisplayOverride {
  const override: SubgroupDisplayOverride = {};

  if (legacy.columnsPerRow >= 1 && legacy.columnsPerRow <= 4) {
    override.gridColumns = legacy.columnsPerRow as GridColumns;
  }

  if (legacy.childRenderMode) {
    override.childSubgroupStyle = legacy.childRenderMode;
  }

  if (legacy.booleanStyle) {
    override.booleanStyle = legacy.booleanStyle;
  }

  return override;
}

// Determine which preset matches the current options (or 'custom' if none match)
export function getDisplayOptionsPreset(options: DisplayOptions): DisplayOptionsPreset {
  // List: single column for both cards and fields
  if (options.cardGridColumns === 1 && options.gridColumns === 1 && options.subgroupStyle === 'card') {
    return 'list';
  }
  // Compact Cards: cards arranged in grid, fields single column
  if (options.cardGridColumns >= 2 && options.gridColumns === 1 && options.subgroupStyle === 'card') {
    return 'compact-cards';
  }
  // Wide Grid: single column cards, fields in grid, flat style
  if (options.cardGridColumns === 1 && options.gridColumns >= 2 && options.subgroupStyle === 'flat') {
    return 'wide-grid';
  }
  return 'custom';
}

// Apply a preset to display options
export function applyDisplayOptionsPreset(
  preset: Exclude<DisplayOptionsPreset, 'custom'>,
  current: DisplayOptions
): DisplayOptions {
  return {
    ...current,
    ...displayOptionsPresets[preset],
  };
}

// Get effective display options from a draft (handles migration from legacy format)
export function getEffectiveDisplayOptions(draft: GroupLayoutDraft | undefined): DisplayOptions {
  if (!draft) return defaultDisplayOptions;

  // Prefer new format if available
  if (draft.displayOptions) {
    return draft.displayOptions;
  }

  // Migrate from legacy format if present
  if (draft.previewDisplayOptions) {
    return migrateDisplayOptions(draft.previewDisplayOptions);
  }

  return defaultDisplayOptions;
}

// Get effective subgroup override from a draft
export function getEffectiveSubgroupOverride(
  draft: GroupLayoutDraft | undefined,
  subgroupId: string
): SubgroupDisplayOverride {
  if (!draft) return {};

  // Prefer new format if available
  if (draft.subgroupOverrides?.[subgroupId]) {
    return draft.subgroupOverrides[subgroupId];
  }

  // Migrate from legacy format if present
  if (draft.subgroupDisplayOptions?.[subgroupId]) {
    return migrateSubgroupDisplayOptions(draft.subgroupDisplayOptions[subgroupId]);
  }

  return {};
}

// Resolve display options for a subgroup (applies overrides to section options)
export function resolveSubgroupDisplayOptions(
  sectionOptions: DisplayOptions,
  override: SubgroupDisplayOverride
): DisplayOptions {
  return {
    ...sectionOptions,
    gridColumns: override.gridColumns ?? sectionOptions.gridColumns,
    childSubgroupStyle: override.childSubgroupStyle ?? sectionOptions.childSubgroupStyle,
    booleanStyle: override.booleanStyle ?? sectionOptions.booleanStyle,
  };
}

export interface SubgroupNode {
  id: string;
  name: string;
  layoutType: LayoutType;
  parentId: string | null;
  createdByAssistant?: boolean;
  showHeading?: boolean;
  showCard?: boolean; // When false, subgroup renders inline without card borders
}

export interface SubgroupTreeNode extends SubgroupNode {
  children: SubgroupTreeNode[];
}

export const MAX_SUBGROUP_DEPTH = 5;

export type FormInputType =
  | "shortText"
  | "longText"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "checkbox"
  | "yesNo"
  | "select"
  | "multiSelect"
  | "signature";

export type TextAreaSize = 'small' | 'medium' | 'large' | 'auto';
export type LabelPosition = 'top' | 'left' | 'none';
export type MoisReadBindingPresentation = "editable" | "backing";
export type MoisReadBindingValueTransform = "exists";

export interface MoisReadBinding {
  sourcePath: string;
  presentation: MoisReadBindingPresentation;
  hiddenInExport?: boolean;
  valueTransform?: MoisReadBindingValueTransform;
}

export interface MoisLocalWriteTarget {
  targetId: string;
}

/**
 * An explicit chart write. `targetId` must resolve to a supported entry in the
 * MOIS write-action registry at export time; a read path is never writable by
 * implication. Multiple fields can target different payload keys of the same
 * mutation.
 */
export interface MoisWriteBinding {
  targetId: string;
  payloadField: string;
  contextIdPath?: string | null;
}

export interface MoisPersistedOutputTarget {
  kind: "none" | "observation";
  observationCode?: string;
  description?: string;
  valueType?: "TEXT" | "NUMERIC";
  reportFieldId?: string;
  units?: string;
  unitsFieldId?: string;
  unitsInline?: boolean;
  conditionalFieldId?: string;
}

export interface MoisFieldContract {
  readBinding?: MoisReadBinding | null;
  localWrite?: MoisLocalWriteTarget | null;
  writeBinding?: MoisWriteBinding | null;
  navigation?: MoisNavigationTarget | null;
  persistedOutput?: MoisPersistedOutputTarget | null;
}

export interface DerivedMoisBindingFields {
  moisContract: MoisFieldContract | null;
  autoFillEnabled: boolean;
  autoFillSource: string | null;
}

export const PREVIEW_ONLY_MOIS_SOURCE_PREFIXES = ["example."];

export interface FieldLayoutConfig {
  label: string;
  autoFillEnabled: boolean;
  autoFillSource: string | null;
  moisContract?: MoisFieldContract | null;
  componentBinding?: {
    componentKey: string;
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
  } | null;
  subgroupId: string | null;
  inputType: FormInputType;
  maxLength: number | null;
  placeholder: string;
  helperText: string;
  source: "pdf" | "custom";
  required?: boolean;
  textAreaSize?: TextAreaSize;
  labelPosition?: LabelPosition;
}

function normalizeLabelForPrefixMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function stripLeadingContextLabel(label: string, prefix: string | undefined): string {
  const trimmedLabel = label.trim();
  const trimmedPrefix = prefix?.trim();
  if (!trimmedLabel || !trimmedPrefix) return label;

  const normalizedLabel = normalizeLabelForPrefixMatch(trimmedLabel);
  const normalizedPrefix = normalizeLabelForPrefixMatch(trimmedPrefix);
  if (!normalizedPrefix || normalizedLabel === normalizedPrefix || !normalizedLabel.startsWith(`${normalizedPrefix} `)) {
    return label;
  }

  const prefixWords = normalizedPrefix.split(" ").length;
  const words = trimmedLabel.split(/\s+/);
  return words.slice(prefixWords).join(" ").trim() || label;
}

export function stripRedundantGroupLabelPrefix(
  label: string,
  context: {
    sectionLabels?: Array<string | null | undefined>;
    subgroupName?: string | null;
  }
): string {
  const sectionLabels = context.sectionLabels ?? [];
  let next = label;
  sectionLabels.forEach((sectionLabel) => {
    next = stripLeadingContextLabel(next, sectionLabel ?? undefined);
  });
  next = stripLeadingContextLabel(next, context.subgroupName ?? undefined);
  return next.trim() || label;
}

export function stripRedundantDraftFieldLabelPrefix(
  label: string,
  draft: Pick<GroupLayoutDraft, "displayLabel" | "sectionLabel" | "group" | "subgroups">,
  subgroupId: string | null | undefined
): string {
  const subgroupName = subgroupId
    ? draft.subgroups.find((subgroup) => subgroup.id === subgroupId)?.name
    : null;
  return stripRedundantGroupLabelPrefix(label, {
    sectionLabels: [draft.displayLabel, draft.group.prefixLabel, draft.sectionLabel],
    subgroupName
  });
}

// Composite field types (e.g., combining DD/MM/YYYY into a single date field, or merging duplicate boolean fields)
export type CompositeFieldType = "date" | "boolean" | "text" | "choice";

export type DateFieldRole = "day" | "month" | "year";
export type GenericFieldRole = "primary" | "secondary" | "tertiary";
export type ChoiceFieldRole = "option" | "other" | "otherText";

export interface CompositeFieldComponent {
  fieldId: string;           // Original PDF field ID
  role: DateFieldRole | GenericFieldRole | ChoiceFieldRole;  // Role in the composite (day/month/year, linked value, or checklist target)
  format?: string;           // Original format hint (e.g., "DD", "MM", "YYYY")
  /** Stable stored value for a choice option. Defaults to fieldId. */
  optionValue?: string;
  /** Runtime label shown for a choice option. */
  optionLabel?: string;
}

export interface CompositeField {
  id: string;
  type: CompositeFieldType;
  label: string;
  components: CompositeFieldComponent[];
  subgroupId: string | null;  // Can be assigned to a subgroup like regular fields
  autoFillEnabled?: boolean;
  autoFillSource?: string | null;
  moisContract?: MoisFieldContract | null;
  /**
   * Snapshot of the original component builder fields (in component order,
   * primary first), captured when the builder collapses the members into one
   * card. Lets an in-builder uncombine restore the exact source fields without
   * depending on draft reconstruction. Ignored by exporters/MOIS.
   */
  componentSnapshots?: CompositeComponentSnapshot[];
}

/** A builder field captured for a composite component (see componentSnapshots). */
export type CompositeComponentSnapshot = BuilderField;

function normalizeTrimmedString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMoisReadBinding(
  binding?: MoisReadBinding | null,
  fallbackSourcePath?: string | null,
  fallbackPresentation: MoisReadBindingPresentation = "backing"
): MoisReadBinding | null {
  const sourcePath = normalizeTrimmedString(binding?.sourcePath ?? fallbackSourcePath);
  if (!sourcePath) return null;
  const presentation =
    binding?.presentation === "editable" || binding?.presentation === "backing"
      ? binding.presentation
      : typeof binding?.hiddenInExport === "boolean"
        ? (binding.hiddenInExport ? "backing" : "editable")
        : fallbackPresentation;
  return {
    sourcePath,
    presentation,
    hiddenInExport: presentation === "backing",
    ...(binding?.valueTransform === "exists" ? { valueTransform: "exists" } : {}),
  };
}

function normalizeMoisLocalWriteTarget(
  target?: MoisLocalWriteTarget | null,
  fallbackTargetId?: string | null
): MoisLocalWriteTarget | null {
  const targetId = normalizeTrimmedString(target?.targetId ?? fallbackTargetId);
  if (!targetId) return null;
  return { targetId };
}

function normalizeMoisWriteBinding(binding?: MoisWriteBinding | null): MoisWriteBinding | null {
  const targetId = normalizeTrimmedString(binding?.targetId);
  const payloadField = normalizeTrimmedString(binding?.payloadField);
  if (!targetId || !payloadField) return null;
  return {
    targetId,
    payloadField,
    contextIdPath: normalizeTrimmedString(binding?.contextIdPath) ?? null,
  };
}

export function normalizeMoisNavigationTarget(
  target?: Partial<MoisNavigationTarget> | null,
  fallbackMoisModule?: string | null
): MoisNavigationTarget | null {
  const moisModule = normalizeTrimmedString(target?.moisModule ?? fallbackMoisModule);
  if (!moisModule) return null;
  return {
    moisModule,
    objectIdSourcePath: normalizeTrimmedString(target?.objectIdSourcePath) ?? null,
  };
}

export function normalizeMoisPersistedOutputTarget(
  target?: MoisPersistedOutputTarget | null
): MoisPersistedOutputTarget | null {
  if (!target) return null;

  if (target.kind === "none") {
    return { kind: "none" };
  }

  if (target.kind !== "observation") {
    return null;
  }

  const observationCode = normalizeTrimmedString(target.observationCode);
  if (!observationCode) return null;

  return {
    kind: "observation",
    observationCode,
    description: normalizeTrimmedString(target.description) ?? undefined,
    valueType: target.valueType === "NUMERIC" ? "NUMERIC" : "TEXT",
    reportFieldId: normalizeTrimmedString(target.reportFieldId) ?? undefined,
    unitsFieldId: normalizeTrimmedString(target.unitsFieldId) ?? undefined,
    unitsInline: target.unitsInline === true,
    conditionalFieldId: normalizeTrimmedString(target.conditionalFieldId) ?? undefined,
  };
}

function buildResolvedMoisContract(parts: {
  readBinding: MoisReadBinding | null;
  localWrite?: MoisLocalWriteTarget | null;
  writeBinding?: MoisWriteBinding | null;
  navigation: MoisNavigationTarget | null;
  persistedOutput: MoisPersistedOutputTarget | null;
  defaultTargetId?: string | null;
}): MoisFieldContract | null {
  const { readBinding, navigation, persistedOutput, defaultTargetId } = parts;
  const hasExplicitLocalWrite = Boolean(normalizeTrimmedString(parts.localWrite?.targetId));
  const writeBinding = normalizeMoisWriteBinding(parts.writeBinding);
  const hasPersistedOutput = Boolean(persistedOutput && persistedOutput.kind === "observation");
  const hasAnySemantics = Boolean(readBinding || navigation || hasPersistedOutput || hasExplicitLocalWrite || writeBinding);

  if (!hasAnySemantics) {
    return null;
  }

  const contract: MoisFieldContract = {
    readBinding,
    localWrite: normalizeMoisLocalWriteTarget(parts.localWrite, defaultTargetId),
    navigation,
    persistedOutput,
  };
  if (writeBinding) contract.writeBinding = writeBinding;
  return contract;
}

export function sanitizeMoisFieldContract(
  contract: MoisFieldContract | null | undefined,
  options?: {
    defaultTargetId?: string | null;
    availableTargetIds?: string[];
  }
): MoisFieldContract | null {
  if (!contract) return null;

  const readSourcePath = normalizeTrimmedString(contract.readBinding?.sourcePath);
  const navigationModule = normalizeTrimmedString(contract.navigation?.moisModule);
  const persistedObservationCode =
    contract.persistedOutput?.kind === "observation"
      ? normalizeTrimmedString(contract.persistedOutput.observationCode)
      : null;
  const normalizedDefaultTargetId = normalizeTrimmedString(options?.defaultTargetId);
  const explicitLocalWriteTargetId = normalizeTrimmedString(contract.localWrite?.targetId);
  const hasExplicitLocalWrite =
    Boolean(explicitLocalWriteTargetId) && explicitLocalWriteTargetId !== normalizedDefaultTargetId;
  const writeBinding = normalizeMoisWriteBinding(contract.writeBinding);
  const hasSemantics = Boolean(
    readSourcePath || navigationModule || persistedObservationCode || hasExplicitLocalWrite || writeBinding
  );

  if (!hasSemantics) {
    return null;
  }

  // Custom save keys outside availableTargetIds are kept intentionally: they
  // let a rebuilt form keep writing into a legacy document's data slot. The
  // binding editor surfaces unknown keys with a warning instead.
  const resolvedTargetId = explicitLocalWriteTargetId ?? normalizedDefaultTargetId;

  const normalizedContract: MoisFieldContract = {
    readBinding: readSourcePath
      ? normalizeMoisReadBinding(contract.readBinding, readSourcePath, "backing")
      : null,
    localWrite: resolvedTargetId ? { targetId: resolvedTargetId } : null,
    navigation: navigationModule
      ? {
          moisModule: navigationModule,
          objectIdSourcePath: normalizeTrimmedString(contract.navigation?.objectIdSourcePath) ?? null,
        }
      : null,
    persistedOutput: persistedObservationCode
      ? {
          kind: "observation",
          observationCode: persistedObservationCode,
          description: normalizeTrimmedString(contract.persistedOutput?.description) ?? undefined,
          valueType: contract.persistedOutput?.valueType === "NUMERIC" ? "NUMERIC" : "TEXT",
          reportFieldId: normalizeTrimmedString(contract.persistedOutput?.reportFieldId) ?? undefined,
          units: normalizeTrimmedString(contract.persistedOutput?.units) ?? undefined,
          unitsFieldId: normalizeTrimmedString(contract.persistedOutput?.unitsFieldId) ?? undefined,
          unitsInline: contract.persistedOutput?.unitsInline === true,
          conditionalFieldId: normalizeTrimmedString(contract.persistedOutput?.conditionalFieldId) ?? undefined,
        }
      : null,
  };
  if (writeBinding) normalizedContract.writeBinding = writeBinding;
  return normalizedContract;
}

export function deriveMoisBindingFields(
  contract: MoisFieldContract | null | undefined,
  options?: {
    defaultTargetId?: string | null;
    availableTargetIds?: string[];
  }
): DerivedMoisBindingFields {
  const nextContract = sanitizeMoisFieldContract(contract, options);

  return {
    moisContract: nextContract,
    autoFillEnabled: Boolean(nextContract?.readBinding?.sourcePath),
    autoFillSource: nextContract?.readBinding?.sourcePath ?? null,
  };
}

export function resolveFieldLayoutMoisContract(
  config?: Partial<FieldLayoutConfig> | null,
  defaultTargetId?: string | null
): MoisFieldContract | null {
  const useLegacyAutoFill =
    Boolean(config)
    && !Object.prototype.hasOwnProperty.call(config, "moisContract");
  const readBinding = normalizeMoisReadBinding(
    config?.moisContract?.readBinding,
    useLegacyAutoFill && config?.autoFillEnabled ? config.autoFillSource : null,
    "backing"
  );
  const navigation = normalizeMoisNavigationTarget(config?.moisContract?.navigation);
  const persistedOutput = normalizeMoisPersistedOutputTarget(config?.moisContract?.persistedOutput);

  return buildResolvedMoisContract({
    readBinding,
    localWrite: config?.moisContract?.localWrite ?? null,
    writeBinding: config?.moisContract?.writeBinding ?? null,
    navigation,
    persistedOutput,
    defaultTargetId,
  });
}

export function resolveCompositeMoisContract(
  composite?: Partial<CompositeField> | null,
  defaultTargetId?: string | null
): MoisFieldContract | null {
  const useLegacyAutoFill =
    Boolean(composite)
    && !Object.prototype.hasOwnProperty.call(composite, "moisContract");
  const readBinding = normalizeMoisReadBinding(
    composite?.moisContract?.readBinding,
    useLegacyAutoFill && composite?.autoFillEnabled ? composite.autoFillSource ?? null : null,
    "backing"
  );
  const navigation = normalizeMoisNavigationTarget(composite?.moisContract?.navigation);
  const persistedOutput = normalizeMoisPersistedOutputTarget(composite?.moisContract?.persistedOutput);

  return buildResolvedMoisContract({
    readBinding,
    localWrite: composite?.moisContract?.localWrite ?? null,
    writeBinding: composite?.moisContract?.writeBinding ?? null,
    navigation,
    persistedOutput,
    defaultTargetId,
  });
}

export function resolveHeadingMoisNavigationTarget(config?: {
  navigationTarget?: Partial<MoisNavigationTarget> | null;
  moisModule?: string | null;
} | null): MoisNavigationTarget | null {
  return normalizeMoisNavigationTarget(config?.navigationTarget, config?.moisModule ?? null);
}

export function isPreviewOnlyMoisSourcePath(sourcePath?: string | null): boolean {
  const normalized = normalizeTrimmedString(sourcePath);
  if (!normalized) return false;
  return PREVIEW_ONLY_MOIS_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export interface GroupLayoutDraft {
  key: string;
  group: GroupSummary;
  displayLabel: string;
  sectionLabel: string;
  moduleConfig: ModuleConfig;
  layoutType: LayoutType;
  description: string;
  columnLabels: Record<string, string>;
  fieldOverrides: Record<string, FieldLayoutConfig>;
  autoFillMode: "manual" | "collection";
  autoFillCollectionId: string | null;
  subgroups: SubgroupNode[];
  fieldOrder: string[];
  customFields: Record<string, ParsedField>;
  customFieldPositions: Record<string, { row: string; column: string }>;
  // Legacy display options (deprecated, use displayOptions instead)
  previewDisplayOptions?: PreviewDisplayOptions;
  subgroupDisplayOptions?: Record<string, SubgroupDisplayOptions>;
  // New primitive-based display options
  displayOptions?: DisplayOptions;
  subgroupOverrides?: Record<string, SubgroupDisplayOverride>;
  pdfSnippets?: PdfSnippetConfig[];
  compositeFields?: CompositeField[];
  // Section collapsibility settings
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  // Section subtitle style settings
  sectionSubtitleBackground?: string;
  sectionSubtitleBorder?: string;
  sectionSubtitlePadding?: string;
  // Scale legend settings (for HoNOS-style sections)
  showScaleLegend?: boolean;
  scaleLegendOptions?: Array<{
    value: number;
    label: string;
    description?: string;
  }>;
  // Section layout type: "grid" (fields side-by-side using Row) or "stacked" (fields vertical using Column)
  sectionLayoutType?: SectionLayoutType;
  // Number of columns per row when in grid layout (1-4, default 2)
  gridColumns?: 1 | 2 | 3 | 4;
  // Optional section override; omitted inherits the form-wide question spacing.
  questionSpacing?: "compact" | "standard" | "comfortable" | "spacious";
  // When true, show all fields individually instead of condensing by column
  expandRows?: boolean;
  authorshipPolicy?: {
    enabled?: boolean;
    granularity?: "field" | "row";
    lockOn?: "save" | "sign" | "submit";
    editableWindowHours?: number;
    showStatusColumn?: boolean;
  };
}

export interface SubformScoringDisplayItem {
  type: "total" | "interpretation" | "answer" | "progress";
  totalId?: string;
  questionId?: string;
}

/**
 * A DCO observation emitted when a modal subform is completed. The value can
 * come from a data-entry field, a calculation, a scoring total, or a template
 * that interpolates those values with `{{fieldId}}` tokens.
 */
export interface MoisSubformObservationOutput {
  id: string;
  observationCode: string;
  description?: string;
  valueType?: "TEXT" | "NUMERIC" | "VALUESET";
  source?: "field" | "calculation" | "total" | "template";
  fieldId?: string;
  calculationId?: string;
  totalId?: string;
  valueTemplate?: string;
  reportTemplate?: string;
  units?: string;
  deleteWhenEmpty?: boolean;
}

/**
 * A structured form-data write emitted when a modal subform is completed.
 * This is used when the source form stored a value or repeating row in
 * `formData` rather than publishing a MOIS observation.
 */
export interface SubformFormDataOutput {
  id: string;
  targetPath: string;
  source?: "field" | "calculation" | "total" | "template" | "data-entry";
  fieldId?: string;
  calculationId?: string;
  totalId?: string;
  valueTemplate?: string;
  mode?: "replace" | "append";
}

export interface SubformScoringConfig {
  buttonText?: string;
  /** Fluent UI icon name for the trigger button. Use "none" to hide the icon. */
  buttonIconName?: string;
  /** When true, hide the section title beside the trigger button. */
  hideTitle?: boolean;
  /** When true, render this module instead of regular section fields. */
  replaceFields?: boolean;
  /** Whether observation-backed defaults may prefill a newly opened subform. */
  bringForward?: boolean;
  summaryConfig?: {
    showItems: SubformScoringDisplayItem[];
    layout?: "inline" | "stacked";
  };
  modalConfig?: {
    minWidth?: number;
    title?: string;
    /** Show live calculation rows inside the modal body (SDAI/CDAI-style). */
    showCalculationsInModal?: boolean;
  };
  observationOutputs?: MoisSubformObservationOutput[];
  formDataOutputs?: SubformFormDataOutput[];
  /** When false, only configured completion outputs are merged into the parent form. */
  persistNestedFields?: boolean;
}

export interface SubformDataEntryFieldConfig {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "datetime" | "choice" | "booleanYesNo" | "heading" | "hotspotMap" | "scale";
  mapLibraryId?: string;
  width?: "auto" | "1/1" | "1/2" | "1/3" | "2/3" | "1/4" | "3/4";
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<string | {
    key?: string;
    id?: string;
    label?: string;
    text?: string;
    value?: string | number;
    description?: string;
    system?: string;
  }>;
  /** MOIS/code-list system used by searchable coded selectors. */
  codeSystem?: string | null;
  showOtherOption?: boolean;
  choiceStyle?: "dropdown" | "radio";
  renderStyle?: "checkbox" | "checklist-row";
  defaultValue?: unknown;
  /** Fill an empty data-entry field from the latest matching patient observation when the modal opens. */
  defaultFromObservation?: {
    observationCode: string;
    aspect?: "value" | "collectedDateTime" | "units" | "comment";
  };
  emptyValue?: number;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  matrixGroupId?: string;
  showLegend?: boolean;
  showInlineLabels?: boolean;
  scaleOptions?: Array<{
    value: number;
    label: string;
    description?: string;
  }>;
  imageUrl?: string;
  imageSvg?: string;
  imageAlt?: string;
  hotspots?: Array<{
    id: string;
    label?: string;
    shape?: "rect" | "circle" | "polygon";
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    points?: Array<{
      x: number;
      y: number;
    }>;
    fieldId?: string;
    group?: string;
  }>;
  allowMultiSelect?: boolean;
  showSummary?: boolean;
  showDefaultCounter?: boolean;
  showSelectedLabels?: boolean;
  showHotspotLabels?: boolean;
  interactionMode?: "select" | "symbol" | "draw" | "symbol_draw" | "field_fill";
  enableAnnotations?: boolean;
  annotationDefaultSymbol?: "x" | "circle" | "triangle";
  annotationSymbols?: Array<"x" | "circle" | "triangle">;
  annotationDefaultColor?: string;
  annotationSizePercent?: number;
  numberFields?: Array<{
    id: string;
    fieldId?: string;
    label?: string;
    x: number;
    y: number;
    width?: number;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
  }>;
  totalCountLabel?: string;
  counterGroups?: Array<{
    id: string;
    label?: string;
    showCounter?: boolean;
    hotspotIds?: string[];
  }>;
  openInModal?: boolean;
  modalButtonText?: string;
  modalTitle?: string;
  modalMinWidth?: number;
  mapZoomPercent?: number;
  mapWidthPercent?: number;
  mapMaxWidth?: number;
  mapMinHeight?: number;
  mapPaddingPx?: number;
  mapMarginPx?: number;
  markerSize?: number;
  totalCountFieldId?: string;
  selectedIdsFieldId?: string;
  selectedLabelsFieldId?: string;
}

export interface SubformDataEntryCalculationConfig {
  id: string;
  label: string;
  expression: string;
  precision?: number;
  ranges?: Array<{
    label: string;
    min: number;
    max: number | null;
    minInclusive?: boolean;
    maxInclusive?: boolean;
  }>;
}

export interface SubformDataEntryCalculatorRowConfig {
  id: string;
  label: string;
  inputFieldId: string;
  equivalentDoseMg: number;
  meqCalculationId?: string;
  precision?: number;
}

export interface SubformDataEntryCalculatorConfig {
  type: "morphine-equivalence";
  baseEquivalentDoseMg?: number;
  rows: SubformDataEntryCalculatorRowConfig[];
  totalCalculationId?: string;
  totalLabel?: string;
  doseColumnLabel?: string;
  equivalentColumnLabel?: string;
  resultColumnLabel?: string;
}

export interface SubformDataEntryDisplayItem {
  type: "field" | "calculation" | "interpretation" | "progress";
  fieldId?: string;
  calculationId?: string;
}

export interface SubformDataEntryConfig {
  buttonText?: string;
  /** Fluent UI icon name for the trigger button. Use "none" to hide the icon. */
  buttonIconName?: string;
  /** When true, hide the section title beside the trigger button. */
  hideTitle?: boolean;
  /** When true, render this module instead of regular section fields. */
  replaceFields?: boolean;
  /** Whether observation-backed defaults may prefill a newly opened subform. */
  bringForward?: boolean;
  /** Optional typed action to run when the modal is completed. */
  action?: {
    kind: "moisMutation";
    resource:
      | "chartPreference"
      | "connection"
      | "encounterNote"
      | "patient"
      | "encounter"
      | "correspondence"
      | "task"
      | "prescription"
      | "formLifecycle"
      | "documentUpdate"
      | "document"
      | "webformDefinition"
      | "calculatedObservation"
      | "dcoObservation"
      | "observationPanel";
    mutation:
      | "changeChartPreference"
      | "changeConnection"
      | "changeEncounterNote"
      | "changePatientName"
      | "changeOfAddress"
      | "changeTelecom"
      | "changeInsurance"
      | "changePatientRace"
      | "NewEncounter"
      | "NewEncompassingEncounter"
      | "UpdateEncounter"
      | "TransferCareEncounter"
      | "UpdateAdmission"
      | "saveCallCounts"
      | "createCorrespondence"
      | "createTask"
      | "updatePrescription"
      | "updateLongTermMedication"
      | "updateFavouriteMedication"
      | "logPrescriptionSave"
      | "saveDraft"
      | "saveSubmit"
      | "signSubmit"
      | "documentUpdate"
      | "deleteDocumentFromSummary"
      | "addWebformDefinition"
      | "updateWebformDefinition"
      | "deleteWebformDefinition"
      | "calculatedUpdate"
      | "observations"
      | "panels";
    patientIdPath?: string;
    payloadFieldId?: string;
    payloadMap?: Record<string, string>;
    payloadDefaults?: Record<string, unknown>;
  };
  fields: SubformDataEntryFieldConfig[];
  calculatedValues?: CalculatedValueConfig[];
  calculations?: SubformDataEntryCalculationConfig[];
  calculatorConfig?: SubformDataEntryCalculatorConfig;
  summaryConfig?: {
    showItems: SubformDataEntryDisplayItem[];
    layout?: "inline" | "stacked";
  };
  modalConfig?: {
    minWidth?: number;
    title?: string;
    /** Show live calculation rows inside the modal body (SDAI/CDAI-style). */
    showCalculationsInModal?: boolean;
  };
  observationOutputs?: MoisSubformObservationOutput[];
  formDataOutputs?: SubformFormDataOutput[];
  /** When false, only configured completion outputs are merged into the parent form. */
  persistNestedFields?: boolean;
}

export interface ModuleConfig {
  enabled: boolean;
  title: string;
  context: string;
  kind?: "simple" | "scoring" | "subform-scoring" | "subform-data-entry" | "subform-calculator" | "customCode";
  scoring?: ScoringModuleConfig;
  subformScoring?: SubformScoringConfig;
  subformDataEntry?: SubformDataEntryConfig;
  customCode?: CustomCodeModuleConfig;
  /**
   * Explicit override: when `false`, this module renders alongside the section's
   * fields instead of replacing them — regardless of kind. Used when a subform
   * is relocated into a section that already has its own content. When omitted,
   * the per-kind replace behavior applies.
   */
  replaceFields?: boolean;
  /** When multiple modal subform modules target the same section, extras are stored here. */
  additionalSubformModules?: ModuleConfig[];
  /** Canvas-only mixed ordering for section child fields/subgroups and section modules. */
  itemOrder?: string[];
}

export interface ScoringModuleConfig {
  layout?: "stacked" | "compact" | "matrix" | "grouped-checklist";
  matrixAutoNumberRows?: boolean;
  matrixRowLabelStyle?: "numbers" | "letters";
  continuumLabels?: {
    min?: string;
    max?: string;
  };
  sharedOptions?: QuestionOptionConfig[];
  groups?: ScoringQuestionGroupConfig[];
  questions: ModuleQuestionConfig[];
  calculatedValues?: CalculatedValueConfig[];
  totals: ScoreTotalConfig[];
  pdfSnippets: PdfSnippetConfig[];
}

export interface ScoringQuestionGroupConfig {
  id: string;
  title?: string;
  prompt?: string;
  questionIds: string[];
}

export interface CustomCodeModuleConfig {
  code: string;
}

export interface QuestionOptionConfig {
  id: string;
  label: string;
  score: number;
  state?: string | null;
  description?: string | null;
}

export interface ModuleQuestionConfig {
  id: string;
  label: string;
  fieldId: string;
  childFieldIds: string[];
  valueByFieldId: Record<string, number>;
  options?: QuestionOptionConfig[];
  checklist?: {
    checkedOptionKey?: string;
    uncheckedOptionKey?: string;
  };
  /** Score used by formulas when this question is intentionally left unanswered. */
  emptyScore?: number;
  /** Inspector presentation only: hides per-option value inputs without clearing option state values. */
  hideOptionValues?: boolean;
  /** True if this question was created in the module designer (not linked from existing fields) */
  isNewQuestion?: boolean;
  /** Pending field configuration for new questions - cleared after save */
  pendingFieldConfig?: {
    type: 'choice';
    choiceStyle: 'radio' | 'dropdown' | 'checkbox' | 'multiselect';
  };
}

export interface ScoreContextVariableConfig {
  id: string;
  label?: string;
  /** Dot path resolved against { patient, sourceData, formData }, e.g. patient.gender. */
  sourcePath: string;
  /** Case-insensitive values that select trueValue. */
  equals: Array<string | number | boolean>;
  trueValue: number;
  falseValue: number;
}

export interface ScoreTotalConfig {
  id: string;
  label: string;
  expression?: string;
  precision?: number;
  resultType?: "number" | "text";
  showInterpretation?: boolean;
  contextVariables?: ScoreContextVariableConfig[];
  terms: ScoreTotalTerm[];
  targetFieldId?: string | null;
  targetFieldIds?: string[];
  ranges: CalculatedValueRange[];
}

export interface PdfSnippetConfig {
  id: string;
  page: number;
  bbox: BoundingBox;
  label?: string;
}

export interface DisplayEntry {
  fieldId: string;
  field: ParsedField;
  row: string;
  column: string;
  isCustom: boolean;
}

export interface ColumnAnalysisGroup {
  key: string;
  label: string;
  editableKey: string | null;
  count: number;
  valueKey: string;
}

export interface ColumnAnalysisResult {
  groups: ColumnAnalysisGroup[];
  hasExplicitColumns: boolean;
}

export interface AssistantDialogContext {
  draftKey: string;
  columnAnalysis: ColumnAnalysisResult;
  displayEntries: DisplayEntry[];
}

export const layoutTypeOptions: Array<{ value: LayoutType; label: string; helper: string }> = [
  {
    value: "table",
    label: "Table",
    helper: "Multi-row, multi-column presentation. Ideal for repeating signatures or vitals."
  },
  {
    value: "grid",
    label: "Grid",
    helper: "Multiple columns but only one or two rows. Fields line up left-to-right."
  },
  {
    value: "list",
    label: "List",
    helper: "Single column stack with labels above each field."
  }
];

export const inputTypeOptions: Array<{ value: FormInputType; label: string }> = [
  { value: "shortText", label: "Short text" },
  { value: "longText", label: "Paragraph" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & Time" },
  { value: "time", label: "Time" },
  { value: "checkbox", label: "Checkbox" },
  { value: "yesNo", label: "Yes / No" },
  { value: "select", label: "Dropdown" },
  { value: "multiSelect", label: "Multi-select" },
  { value: "signature", label: "Signature" }
];

export function detectLayoutType(group: GroupSummary): LayoutType {
  if (group.rows.length >= 3 && group.columns.length >= 2) {
    return "table";
  }
  if (group.columns.length > 1) {
    return "grid";
  }
  return "list";
}

export function getColumnLabelValue(column: string, draft: GroupLayoutDraft) {
  const fallback = column || "Value";
  const label = draft.columnLabels[column] ?? fallback;
  const trimmed = label.trim();
  return trimmed || "Value";
}

export function mapInputTypeToKind(inputType: FormInputType): ParsedField["kind"] {
  switch (inputType) {
    case "number":
      return "number";
    case "date":
    case "datetime":
      return "date";
    case "time":
      return "time";
    case "signature":
      return "signature";
    case "yesNo":
    case "checkbox":
      return "boolean";
    case "select":
    case "multiSelect":
      return "choice";
    default:
      return "text";
  }
}

export function getDefaultInputType(kind: ParsedField["kind"], booleanStyle?: ParsedField["booleanStyle"]): FormInputType {
  switch (kind) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "time":
      return "time";
    case "boolean":
      return booleanStyle === "yesNo" ? "yesNo" : "checkbox";
    case "choice":
      return "select";
    default:
      return "shortText";
  }
}

/**
 * Extract the base name used for linked-field grouping by removing trailing digits.
 * e.g. "OB History Date2" -> "OB History Date"
 */
export function extractLinkedFieldBaseName(name: string): string {
  return name.replace(/\d+$/, "").trim();
}

function normalizeLinkedFieldOptions(field: ParsedField): string {
  return JSON.stringify((field.optionStates ?? []).map((option) => option.trim()).filter(Boolean));
}

/**
 * Build a compatibility key for linked-field grouping.
 * Fields only share a linked group when both their label/column key and
 * compatibility key match, which prevents mixed renderers from collapsing into
 * a single primary control.
 */
export function getLinkedFieldCompatibilityKey(field: ParsedField): string {
  switch (field.kind) {
    case "component":
      return `component:${field.id}`;
    case "number":
      return [
        "number",
        field.rawType,
        field.numberTypeNumber ?? "",
        field.scaleStyle ?? "",
        field.scaleMin ?? "",
        field.scaleMax ?? "",
        field.sliderMin ?? "",
        field.sliderMax ?? "",
      ].join(":");
    case "date":
      return ["date", field.rawType, field.dateWithTime ? "time" : "date"].join(":");
    case "time":
      return ["time", field.rawType, field.timeFormat ?? ""].join(":");
    case "boolean":
      return [
        "boolean",
        field.booleanStyle ?? "",
        field.booleanLabels?.on ?? "",
        field.booleanLabels?.off ?? "",
      ].join(":");
    case "choice":
      return [
        "choice",
        field.rawType,
        field.choiceStyle ?? "",
        field.codeSystem ?? "",
        normalizeLinkedFieldOptions(field),
      ].join(":");
    case "table":
      return `table:${field.id}`;
    case "text":
    default:
      if (field.rawType === "hyperlink") {
        return `hyperlink:${field.id}`;
      }
      return [
        "text",
        field.rawType,
        field.phoneAllowExtension ? "ext" : "",
        field.phoneDefaultCountry ?? "",
      ].join(":");
  }
}

export function getDisplayEntries(draft: GroupLayoutDraft): DisplayEntry[] {
  const entries = new Map<string, DisplayEntry>();
  draft.group.entries.forEach((entry) => {
    entries.set(entry.field.id, {
      fieldId: entry.field.id,
      field: entry.field,
      row: entry.row,
      column: entry.column || "Value",
      isCustom: false
    });
  });
  Object.entries(draft.customFields).forEach(([fieldId, field]) => {
    const position = draft.customFieldPositions[fieldId] ?? {
      row: `${draft.group.entries.length + 1}`,
      column: field.label || "Value"
    };
    entries.set(fieldId, {
      fieldId,
      field,
      row: position.row,
      column: position.column,
      isCustom: true
    });
  });
  const ordered: DisplayEntry[] = [];
  draft.fieldOrder.forEach((fieldId) => {
    const entry = entries.get(fieldId);
    if (entry) {
      ordered.push(entry);
      entries.delete(fieldId);
    }
  });
  entries.forEach((entry) => ordered.push(entry));
  return ordered;
}

/**
 * Compute the depth of a subgroup within the hierarchy.
 * Root level (no parent) = depth 1.
 */
export function getSubgroupDepth(subgroups: SubgroupNode[], subgroupId: string, memo = new Map<string, number>()): number {
  if (memo.has(subgroupId)) return memo.get(subgroupId)!;
  const subgroup = subgroups.find((entry) => entry.id === subgroupId);
  if (!subgroup) {
    memo.set(subgroupId, 1);
    return 1;
  }
  if (!subgroup.parentId) {
    memo.set(subgroupId, 1);
    return 1;
  }
  // Cycle guard: if parent loops back, treat as root depth
  if (subgroup.parentId === subgroupId) {
    memo.set(subgroupId, 1);
    return 1;
  }
  const depth = 1 + getSubgroupDepth(subgroups, subgroup.parentId, memo);
  memo.set(subgroupId, depth);
  return depth;
}

export function getSubgroupAncestors(subgroups: SubgroupNode[], subgroupId: string): SubgroupNode[] {
  const chain: SubgroupNode[] = [];
  let current = subgroups.find((entry) => entry.id === subgroupId) ?? null;
  const seen = new Set<string>();
  while (current && current.parentId && !seen.has(current.parentId)) {
    seen.add(current.id);
    const parent = subgroups.find((entry) => entry.id === current!.parentId) ?? null;
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

export function canNestSubgroup(subgroups: SubgroupNode[], parentId: string | null): boolean {
  if (!parentId) return true;
  const depth = getSubgroupDepth(subgroups, parentId);
  return depth < MAX_SUBGROUP_DEPTH;
}

export function buildSubgroupTree(subgroups: SubgroupNode[]): SubgroupTreeNode[] {
  const lookup = new Map<string, SubgroupTreeNode>();
  const roots: SubgroupTreeNode[] = [];
  subgroups.forEach((subgroup) => {
    lookup.set(subgroup.id, {
      ...subgroup,
      parentId: subgroup.parentId ?? null,
      children: []
    });
  });
  subgroups.forEach((subgroup) => {
    const node = lookup.get(subgroup.id)!;
    if (node.parentId && lookup.has(node.parentId)) {
      lookup.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export function flattenSubgroupTree(tree: SubgroupTreeNode[]): SubgroupNode[] {
  const result: SubgroupNode[] = [];
  const walk = (nodes: SubgroupTreeNode[]) => {
    nodes.forEach((node) => {
      const { children, ...rest } = node;
      result.push({ ...rest });
      if (children.length) {
        walk(children);
      }
    });
  };
  walk(tree);
  return result;
}
