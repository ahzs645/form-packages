/**
 * Component fields (neutral form model).
 *
 * A `component` field is a prebuilt piece of form: a scored rating question,
 * a tick-box group, the patient's observation history, a blood pressure pair,
 * a "you have unsaved changes" guard. What the author means is the component's
 * **kind** and its props; how each EMR draws it is that target's
 * **implementation**. Some kinds belong to one product (`owner`: a MOIS
 * NHForms tool, a Cerner PowerChart control), and for those every other target
 * names its equivalent, or leaves the component out with a reported loss.
 *
 * The intent is stored once as `field.component`:
 *
 * ```ts
 * { kind: "observationHistory", implementations: { fhir: { as: "omit", fallback: "none" } } }
 * ```
 *
 * Older forms and every import say the same thing in the MOIS store, which
 * `readComponent` also reads:
 *
 * | Store | Where | Reads as |
 * | --- | --- | --- |
 * | `component` | the field | the kind, its props (for kinds no MOIS component holds) and per-target implementations |
 * | the NHForms component (`componentKey`, `componentProps.nhformsExport`) | the field | the kind (`COMPONENT_KINDS[].legacyKeys`, else `mois:<Key>`), its props, and the MOIS implementation |
 * | a retired NHForms key (`RETIRED_COMPONENT_KEYS`) | `componentKey` | the component that absorbed it |
 * | `alayaCareConfig.fieldType` | the field | the AlayaCare implementation (`{ as: "fieldType" }`) |
 * | a PowerChart blood pressure pair or unit conversion (`cernerConfig.bloodPressure`, `.unitConversion`) | the field | the Cerner-owned kind's props |
 *
 * When `component.kind` and the MOIS component disagree, the MOIS component
 * wins (it was edited by a writer that only knew it), the way chart-lists.ts
 * and bindings.ts treat an edited legacy store; the stored implementations
 * then belong to another kind and are not read. `alayaCareConfig.fieldType`
 * likewise wins over a stored AlayaCare implementation. Writers store the
 * neutral `component` and keep the mirrors in step (`componentKey`,
 * `componentProps`, `alayaCareConfig.fieldType`), so lib/mois-export and the
 * AlayaCare exporter read what they always read.
 *
 * Each target realises a kind with its own implementation or reports the
 * loss (`<target>.component.<kind>`); the per-target lowerings and their
 * defaults are in lib/targets/components. This module has type imports only.
 */
import type { BuilderField } from "./index";
import type { TargetId } from "./targets";

/** A component kind: a neutral id (`scoredQuestion`) or a product-owned one (`mois:PlannedActions`). */
export type ComponentKindId = string;

/**
 * How one target draws a component:
 * - `component`: the target's own component (an NHForms export, PowerChart's blood pressure control);
 * - `fieldType`: a field type of the target (an AlayaCare `vital`, a FHIR item), with its settings;
 * - `decompose`: the component's parts as ordinary questions (`variant` names which lowering, when a kind has several);
 * - `hostSetting`: the target's own form screen does it (save-on-close, the form version line);
 * - `omit`: left out, with nothing (`none`), a note (`placeholder`) or the component's text (`readOnlyText`) in its place.
 */
export type ComponentImplementation =
  | { as: "component"; key: string; props?: Record<string, unknown> }
  | { as: "fieldType"; fieldType: string; config?: Record<string, unknown> }
  | { as: "decompose"; variant?: string }
  | { as: "hostSetting"; setting: string }
  | { as: "omit"; fallback: "placeholder" | "readOnlyText" | "none" };

/** The stored intent (`BuilderField.component`). */
export interface BuilderComponent {
  kind: ComponentKindId;
  /** The kind's props, for kinds whose props no MOIS component holds. */
  props?: Record<string, unknown>;
  /** Per-target choices the author made; absent targets use the target's default. */
  implementations?: Partial<Record<TargetId, ComponentImplementation>>;
}

/**
 * - `answer`: collects answers (a tick-box group, a scored question);
 * - `content`: shows text or lays out other questions;
 * - `chart`: shows what is on the patient's chart;
 * - `host`: a behaviour of the form screen itself (saving, submitting, the version line).
 */
export type ComponentRole = "answer" | "content" | "chart" | "host";

export interface ComponentKindInfo {
  id: ComponentKindId;
  title: string;
  description: string;
  /** The product the kind belongs to; absent for neutral kinds every target can carry in some way. */
  owner?: TargetId;
  role: ComponentRole;
  /**
   * MOIS stores that read as this kind: an NHForms key (`ObservationChart`)
   * or a key with its export (`HonosQuestion#HonosFinalScore`).
   */
  legacyKeys: readonly string[];
}

export type ComponentStore = "component" | "legacy";

export interface NeutralComponent {
  kind: ComponentKindId;
  props: Record<string, unknown>;
  implementations: Partial<Record<TargetId, ComponentImplementation>>;
  /** The MOIS component the field names (`HonosQuestion#Scale5`, `RichMarkdownBlock`), or null. */
  legacyKey: string | null;
  /** Where the kind was read from. */
  store: ComponentStore;
}

/** Retired NHForms keys and the component that absorbed them (forms saved before the merge still carry them). */
export const RETIRED_COMPONENT_KEYS: Readonly<Record<string, string>> = {
  // MoisMarkdownBlock was a copy of RichMarkdownBlock with `mois:` link handling; RichMarkdownBlock now does both.
  MoisMarkdownBlock: "RichMarkdownBlock",
};

/** PowerChart's blood pressure pair and measurement conversion, as the Cerner authoring components name them. */
export const CERNER_BLOOD_PRESSURE_KEY = "CernerBloodPressure";
export const CERNER_UNIT_CONVERSION_KEY = "CernerUnitConversion";

/** The builder's own chart-list key (chart-lists.ts `CHART_LIST_COMPONENT`). */
const CHART_LIST_KEYS = ["ChartList", "ChartRecordTable", "Allergies", "AllergyTable", "Conditions", "LongTermMedications"] as const;

export const COMPONENT_KINDS: readonly ComponentKindInfo[] = [
  {
    id: "checkboxGroup",
    title: "Tick-box group",
    description: "Several tick boxes under one question, each answer saved on its own (MOIS keeps one yes/no column per box).",
    role: "answer",
    legacyKeys: ["MultiTargetChoiceField"],
  },
  {
    id: "scoredQuestion",
    title: "Scored rating question",
    description: "One question rated on a fixed scale (0 to 4 and 9 for not known, or 0 to 10), each rating with a score and a description.",
    role: "answer",
    legacyKeys: ["HonosQuestion", "HonosQuestion#Scale5", "HonosQuestion#Scale10"],
  },
  {
    id: "scaleLegend",
    title: "Rating scale legend",
    description: "What each rating of a scored scale means, shown once above its questions.",
    role: "content",
    legacyKeys: ["HonosQuestion#Scale5Legend", "HonosQuestion#Scale10Legend"],
  },
  {
    id: "scoreTotal",
    title: "Scale total",
    description: "The sum of the scored ratings, kept as the form's total score.",
    role: "answer",
    legacyKeys: ["HonosQuestion#HonosFinalScore"],
  },
  {
    id: "submitButton",
    title: "Submit button",
    description: "Submits the form, optionally after filling unanswered ratings.",
    role: "host",
    legacyKeys: ["HonosQuestion#Scale5SubmitButton", "SubmitButton"],
  },
  {
    id: "unsavedChangesGuard",
    title: "Unsaved changes guard",
    description: "Asks before closing a form with unsaved changes, and offers to save it.",
    role: "host",
    legacyKeys: ["UnsavedChangesGuard", "SaveOnClose"],
  },
  {
    id: "formVersion",
    title: "Form version",
    description: "Shows the form's name and version on the form.",
    role: "host",
    legacyKeys: ["FormVersion"],
  },
  {
    id: "observationHistory",
    title: "Observation history",
    description: "The patient's earlier results for one or more observations, as a chart, a table or a flow sheet.",
    role: "chart",
    legacyKeys: ["ObservationChart", "FocusedObservationHistory", "HistoricalObservationTable", "FlowSheet"],
  },
  {
    id: "bloodPressure",
    title: "Blood pressure",
    description: "Systolic and diastolic pressure entered together, each charted as its own result.",
    owner: "cerner",
    role: "answer",
    legacyKeys: [CERNER_BLOOD_PRESSURE_KEY],
  },
  {
    id: "measurementConversion",
    title: "Measurement with conversion",
    description: "A measurement with its value shown again in another unit.",
    owner: "cerner",
    role: "answer",
    legacyKeys: [CERNER_UNIT_CONVERSION_KEY],
  },
  {
    id: "richText",
    title: "Formatted text",
    description: "Formatted guidance text; every target draws it as its own text block.",
    role: "content",
    legacyKeys: ["RichMarkdownBlock", "MoisMarkdownBlock"],
  },
  {
    id: "layoutTable",
    title: "Question layout table",
    description: "Arranges other questions of the form in a table; the questions themselves are fields of the form.",
    role: "content",
    legacyKeys: ["LayoutTable"],
  },
  {
    id: "chartList",
    title: "Chart list",
    description: "The patient's allergies, problems, medications or history from the chart (see chart-lists.ts).",
    role: "chart",
    legacyKeys: CHART_LIST_KEYS,
  },
  {
    id: "subform",
    title: "Subform",
    description: "A group of questions opened from the form; its questions are converted with the form's structure (structure.ts).",
    role: "answer",
    legacyKeys: ["SubformScoring"],
  },
];

const KIND_BY_ID: ReadonlyMap<string, ComponentKindInfo> = new Map(COMPONENT_KINDS.map((kind) => [kind.id, kind]));
const KIND_BY_LEGACY_KEY: ReadonlyMap<string, string> = new Map(
  COMPONENT_KINDS.flatMap((kind) => (kind.id === "chartList" ? [] : kind.legacyKeys.map((key) => [key, kind.id] as const))),
);

/** A neutral kind's description, or null for product-owned (`mois:`, `cerner:`) and unknown ids. */
export function neutralComponentKind(id: ComponentKindId): ComponentKindInfo | null {
  return KIND_BY_ID.get(id) ?? null;
}

/** The product a kind id names (`mois:PlannedActions` → mois), or the neutral kind's owner. */
export function componentKindOwner(id: ComponentKindId): TargetId | undefined {
  const known = KIND_BY_ID.get(id);
  if (known) return known.owner;
  const prefix = id.split(":")[0];
  return prefix === "mois" || prefix === "cerner" || prefix === "alayacare" || prefix === "fhir" || prefix === "oscar" ? prefix : undefined;
}

/** A kind id as it appears in a loss code: `mois:PlannedActions` → `mois.PlannedActions`, `mois:HFC_PT_ASMT_SnapShot` → `mois.HFC-PT-ASMT-SnapShot`. */
export function componentKindCode(id: ComponentKindId): string {
  return id.replace(/:/g, ".").replace(/[^A-Za-z0-9.-]+/g, "-");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** The NHForms export a component field draws: `componentProps.nhformsExport`, else its key (HonosQuestion draws Scale5). */
function legacyExportOf(field: Pick<BuilderField, "componentKey" | "componentProps">): { key: string; exportName: string } | null {
  const rawKey = text(field.componentKey);
  const key = RETIRED_COMPONENT_KEYS[rawKey] ?? rawKey;
  const requested = isRecord(field.componentProps) ? text(field.componentProps.nhformsExport) : "";
  if (!key && !requested) return null;
  const exportName = requested || (key === "HonosQuestion" ? "Scale5" : key);
  return { key: key || exportName, exportName };
}

/** The kind a MOIS component names: a neutral kind's legacy key, else `mois:<Key>` (`cerner:<Key>` for a Cerner key). */
export function componentKindOfLegacyKey(key: string, exportName?: string): ComponentKindId {
  const resolved = RETIRED_COMPONENT_KEYS[key] ?? key;
  const exported = exportName ? RETIRED_COMPONENT_KEYS[exportName] ?? exportName : "";
  const byExport = exported ? KIND_BY_LEGACY_KEY.get(`${resolved}#${exported}`) ?? KIND_BY_LEGACY_KEY.get(exported) : undefined;
  const kind = byExport ?? KIND_BY_LEGACY_KEY.get(resolved);
  if (kind) return kind;
  return /^Cerner[A-Z]/.test(resolved) ? `cerner:${resolved}` : `mois:${exported && exported !== resolved ? exported : resolved}`;
}

type ComponentFieldInput = Pick<BuilderField, "id" | "type" | "label" | "componentKey" | "componentProps" | "cernerConfig" | "alayaCareConfig"> & {
  component?: BuilderComponent | null;
  chartList?: BuilderField["chartList"];
  multiSelect?: unknown;
};

// --- Legacy props readers --------------------------------------------------

const SCALE_5_LEGENDS = ["No problem", "Minor not requiring action", "Mild but present", "Moderate", "Severe to very severe"];
const SCALE_5_UNKNOWN = "Unknown or not asked";
const SCALE_10_LEGENDS = ["No problem", "Very low", "Low", "Mild", "Mild to moderate", "Moderate", "Moderate to high", "High", "Very high", "Severe", "Extreme"];

export interface ScoredRating {
  /** The stored rating ("0" … "4", "9"). */
  value: string;
  /** What the rating means. */
  label: string;
  /** What it adds to a total (9, not known, adds 0). */
  score: number;
  /** The question's own description of this rating, when it has one. */
  description?: string;
}

/** The ratings of a Scale5 (0 to 4, and 9 for not known) or Scale10 (0 to 10) question, as the NHForms HonosQuestion draws them. */
export function scaleRatings(scale: 5 | 10, tooltip?: unknown, scaleOptions?: unknown): ScoredRating[] {
  const descriptions = new Map<string, string>();
  if (Array.isArray(tooltip)) {
    for (const entry of tooltip) {
      if (isRecord(entry) && entry.rating !== undefined && text(entry.description)) descriptions.set(String(entry.rating), text(entry.description));
    }
  }
  const custom = Array.isArray(scaleOptions)
    ? scaleOptions.filter((entry): entry is Record<string, unknown> => isRecord(entry) && Number.isFinite(Number(entry.value)))
    : [];
  const base: ScoredRating[] = custom.length
    ? custom.map((entry) => ({ value: String(entry.value), label: text(entry.label) || String(entry.value), score: Number(entry.value), ...(text(entry.description) ? { description: text(entry.description) } : {}) }))
    : scale === 10
      ? SCALE_10_LEGENDS.map((label, value) => ({ value: String(value), label, score: value }))
      : [...SCALE_5_LEGENDS.map((label, value) => ({ value: String(value), label, score: value })), { value: "9", label: SCALE_5_UNKNOWN, score: 0 }];
  return base.map((rating) => (descriptions.has(rating.value) ? { ...rating, description: descriptions.get(rating.value) } : rating));
}

export interface CheckboxGroupOption {
  /** The stored answer (the option's code). */
  value: string;
  label: string;
  /** The field each box writes in MOIS, and how. */
  target?: { fieldId: string; mode: string; value?: string; offValue?: string };
  /** The box also sets another answer (MultiTargetChoiceField `force`). */
  effect?: { fieldId: string };
  /** The box shows only when a condition holds (`visibleWhen`). */
  conditional?: boolean;
}

function checkboxGroupProps(field: ComponentFieldInput): Record<string, unknown> {
  const props = isRecord(field.componentProps) ? field.componentProps : {};
  const options: CheckboxGroupOption[] = (Array.isArray(props.options) ? props.options : []).flatMap((entry): CheckboxGroupOption[] => {
    if (!isRecord(entry)) return [];
    const label = text(entry.display) || text(entry.label) || text(entry.code);
    const value = text(entry.code) || label;
    if (!value) return [];
    const target = isRecord(entry.target) && text(entry.target.fieldId)
      ? {
          fieldId: text(entry.target.fieldId),
          mode: text(entry.target.mode) || "scalar",
          ...(entry.target.value !== undefined ? { value: String(entry.target.value) } : {}),
          ...(entry.target.offValue !== undefined ? { offValue: String(entry.target.offValue) } : {}),
        }
      : undefined;
    const effect = isRecord(entry.force) && text(entry.force.fieldId) ? { fieldId: text(entry.force.fieldId) } : undefined;
    return [{ value, label, ...(target ? { target } : {}), ...(effect ? { effect } : {}), ...(entry.visibleWhen ? { conditional: true } : {}) }];
  });
  // The NHForms component is a set of checkboxes; `multiSelect: false` is the builder's legacy single-answer flag.
  const multiple = field.multiSelect === false ? false : true;
  return { options, multiple };
}

function scoredQuestionProps(field: ComponentFieldInput, exportName: string): Record<string, unknown> {
  const props = isRecord(field.componentProps) ? field.componentProps : {};
  const scale = exportName === "Scale10" ? 10 : 5;
  return {
    scale,
    question: text(props.question) || text(props.label) || text(field.label),
    ratings: scaleRatings(scale, props.tooltip, props.scaleOptions),
    ...(text(props.labelHtml) ? { labelHtml: text(props.labelHtml) } : {}),
  };
}

function observationHistoryProps(field: ComponentFieldInput, exportName: string): Record<string, unknown> {
  const props = isRecord(field.componentProps) ? field.componentProps : {};
  const codes: string[] = [];
  const add = (value: unknown) => {
    const code = text(value);
    if (code && !/^-+$/.test(code) && !codes.includes(code)) codes.push(code);
  };
  if (Array.isArray(props.observationCodes)) props.observationCodes.forEach(add);
  add(props.observationCode);
  if (Array.isArray(props.watchFields)) props.watchFields.forEach((entry) => isRecord(entry) && add(entry.observationCode));
  if (Array.isArray(props.rows)) props.rows.forEach((row) => isRecord(row) && row.kind !== "medication" && add(row.code));
  const display = exportName === "FocusedObservationHistory" ? "focused" : exportName === "FlowSheet" ? "flowsheet" : exportName === "HistoricalObservationTable" ? "table" : "chart";
  const maxRows = Number(props.maxRows ?? props.maxPoints ?? props.maxColumns);
  return {
    codes,
    display,
    ...(Number.isFinite(maxRows) && maxRows > 0 ? { maxRows } : {}),
    ...(text(props.title) ? { title: text(props.title) } : {}),
  };
}

function legacyProps(kind: ComponentKindId, field: ComponentFieldInput, exportName: string): Record<string, unknown> {
  const props = isRecord(field.componentProps) ? field.componentProps : {};
  switch (kind) {
    case "checkboxGroup":
      return checkboxGroupProps(field);
    case "scoredQuestion":
      return scoredQuestionProps(field, exportName);
    case "scaleLegend": {
      const scale = exportName === "Scale10Legend" ? 10 : 5;
      return { scale, ratings: scaleRatings(scale) };
    }
    case "scoreTotal": {
      const ids = (Array.isArray(props.scoredQuestionIds) ? props.scoredQuestionIds : Array.isArray(props.questionIds) ? props.questionIds : []).map(String).filter(Boolean);
      return { questionIds: ids, ...(text(props.observationCode) ? { observationCode: text(props.observationCode) } : {}) };
    }
    case "observationHistory":
      return observationHistoryProps(field, exportName);
    case "bloodPressure": {
      const pair = field.cernerConfig?.bloodPressure;
      return pair ? { systolic: pair.systolic, diastolic: pair.diastolic } : {};
    }
    case "measurementConversion": {
      const pair = field.cernerConfig?.unitConversion;
      return pair ? { input: pair.input, display: pair.display } : {};
    }
    case "richText":
      return { source: typeof props.source === "string" ? props.source : "", ...(Array.isArray(props.images) ? { images: props.images } : {}) };
    case "layoutTable": {
      const fieldIds: string[] = [];
      for (const row of Array.isArray(props.rows) ? props.rows : []) {
        for (const cell of isRecord(row) && Array.isArray(row.cells) ? row.cells : []) {
          if (isRecord(cell) && text(cell.fieldId)) fieldIds.push(text(cell.fieldId));
          for (const nested of isRecord(cell) && Array.isArray(cell.fields) ? cell.fields : []) if (isRecord(nested) && text(nested.fieldId)) fieldIds.push(text(nested.fieldId));
        }
      }
      return { fieldIds };
    }
    case "submitButton":
    case "unsavedChangesGuard":
    case "formVersion":
    case "subform":
    case "chartList":
      return {};
    default:
      // A product-owned kind's props are the product component's own.
      return { ...props };
  }
}

/** A MOIS chart-list component (chart-lists.ts), without importing it: the chart list's own reader decides. */
function isChartListLegacy(key: string, field: ComponentFieldInput): boolean {
  if (!(CHART_LIST_KEYS as readonly string[]).includes(key)) return false;
  if (key !== "ChartRecordTable") return true;
  const source = isRecord(field.componentProps) ? text(field.componentProps.source) : "";
  return !source || source === "allergies" || source === "conditions" || source === "longTermMedications";
}

function implementationsOf(value: unknown): Partial<Record<TargetId, ComponentImplementation>> {
  if (!isRecord(value)) return {};
  const out: Partial<Record<TargetId, ComponentImplementation>> = {};
  for (const [target, implementation] of Object.entries(value)) {
    if (isComponentImplementation(implementation)) out[target as TargetId] = implementation;
  }
  return out;
}

export function isComponentImplementation(value: unknown): value is ComponentImplementation {
  if (!isRecord(value)) return false;
  switch (value.as) {
    case "component":
      return typeof value.key === "string" && value.key.trim().length > 0;
    case "fieldType":
      return typeof value.fieldType === "string" && value.fieldType.trim().length > 0;
    case "decompose":
      return value.variant === undefined || typeof value.variant === "string";
    case "hostSetting":
      return typeof value.setting === "string";
    case "omit":
      return value.fallback === "placeholder" || value.fallback === "readOnlyText" || value.fallback === "none";
    default:
      return false;
  }
}

/** Whether two implementations say the same thing (props and config aside). */
export function componentImplementationsMatch(left: ComponentImplementation | undefined | null, right: ComponentImplementation | undefined | null): boolean {
  if (!left || !right || left.as !== right.as) return false;
  switch (left.as) {
    case "component":
      return left.key === (right as typeof left).key;
    case "fieldType":
      return left.fieldType === (right as typeof left).fieldType;
    case "decompose":
      return (left.variant ?? "") === ((right as typeof left).variant ?? "");
    case "hostSetting":
      return left.setting === (right as typeof left).setting;
    case "omit":
      return left.fallback === (right as typeof left).fallback;
  }
}

// --- Reader and writers ----------------------------------------------------

/** The component a field is, from whichever store says so, or null for any other field. */
export function readComponent(field: ComponentFieldInput): NeutralComponent | null {
  if (field.type !== "component") return null;
  const stored = isRecord(field.component) && typeof field.component.kind === "string" && field.component.kind.trim() ? field.component : null;
  const legacy = legacyExportOf(field);
  let kind: ComponentKindId;
  let props: Record<string, unknown>;
  let storedImplementations: Partial<Record<TargetId, ComponentImplementation>> = {};
  let store: ComponentStore;
  let legacyKey: string | null = null;
  if (legacy) {
    legacyKey = legacy.exportName === legacy.key ? legacy.key : `${legacy.key}#${legacy.exportName}`;
    kind = isChartListLegacy(legacy.key, field) ? "chartList" : componentKindOfLegacyKey(legacy.key, legacy.exportName);
    props = legacyProps(kind, field, legacy.exportName);
    // The MOIS store wins when the kinds disagree: its edit is the newer one.
    if (stored && stored.kind === kind) {
      storedImplementations = implementationsOf(stored.implementations);
      store = "component";
    } else {
      store = "legacy";
    }
  } else if (stored) {
    kind = stored.kind.trim();
    props = isRecord(stored.props) ? { ...stored.props } : {};
    storedImplementations = implementationsOf(stored.implementations);
    store = "component";
  } else {
    return null;
  }
  const implementations: Partial<Record<TargetId, ComponentImplementation>> = { ...storedImplementations };
  // The NHForms component a field names is its MOIS implementation.
  if (legacy && !/^Cerner[A-Z]/.test(legacy.key)) {
    implementations.mois = { as: "component", key: legacy.exportName };
  }
  // AlayaCare's own field-type setting is the AlayaCare implementation (it is what the AlayaCare editor edits).
  const alayaCareType = text(field.alayaCareConfig?.fieldType);
  if (alayaCareType) implementations.alayacare = { as: "fieldType", fieldType: alayaCareType };
  return { kind, props, implementations, legacyKey, store };
}

/** Whether a field is a component of `kind`. */
export function isComponentOfKind(field: ComponentFieldInput, kind: ComponentKindId): boolean {
  return readComponent(field)?.kind === kind;
}

function storedComponent(field: ComponentFieldInput, current: NeutralComponent): BuilderComponent {
  // Props live in the MOIS store when there is one; only a kind without it keeps its own.
  const keepProps = current.store === "component" && current.legacyKey === null && Object.keys(current.props).length > 0;
  const implementations = field.component && field.component.kind === current.kind ? implementationsOf(field.component.implementations) : {};
  return {
    kind: current.kind,
    ...(keepProps ? { props: current.props } : {}),
    ...(Object.keys(implementations).length ? { implementations } : {}),
  };
}

/**
 * The changes that set (or, with null, clear) one target's implementation of
 * a component field: the neutral store, and the AlayaCare mirror
 * (`alayaCareConfig.fieldType`) the AlayaCare exporter and editor read. The
 * MOIS implementation is the field's NHForms component, which only the
 * component editor changes.
 */
export function writeComponentImplementation(
  field: ComponentFieldInput,
  target: TargetId,
  implementation: ComponentImplementation | null,
): Partial<BuilderField> {
  const current = readComponent(field);
  if (!current) return {};
  const component = storedComponent(field, current);
  const implementations = { ...(component.implementations ?? {}) };
  if (implementation) implementations[target] = implementation;
  else delete implementations[target];
  const nextComponent: BuilderComponent = { kind: component.kind, ...(component.props ? { props: component.props } : {}), ...(Object.keys(implementations).length ? { implementations } : {}) };
  const patch: Partial<BuilderField> = { component: nextComponent };
  if (target === "alayacare") {
    const config = { ...(field.alayaCareConfig ?? {}) };
    if (implementation?.as === "fieldType") config.fieldType = implementation.fieldType as NonNullable<BuilderField["alayaCareConfig"]>["fieldType"];
    else delete config.fieldType;
    patch.alayaCareConfig = config;
  }
  return patch;
}

/**
 * The changes that make a field the component `component`: the neutral
 * store, with the MOIS component (`componentKey`, `componentProps`) as its
 * mirror when the MOIS implementation is one, and the AlayaCare field type
 * when that implementation is one.
 */
export function writeComponent(field: ComponentFieldInput, component: BuilderComponent): Partial<BuilderField> {
  const implementations = implementationsOf(component.implementations);
  const mois = implementations.mois;
  const patch: Partial<BuilderField> = {
    type: "component",
    component: {
      kind: component.kind,
      ...(component.props && Object.keys(component.props).length ? { props: component.props } : {}),
      ...(Object.keys(implementations).length ? { implementations } : {}),
    },
  };
  if (mois?.as === "component") {
    patch.componentKey = mois.key;
    patch.componentProps = { ...(field.componentKey === mois.key ? field.componentProps ?? {} : {}), ...(mois.props ?? {}) };
  }
  const alayacare = implementations.alayacare;
  if (alayacare?.as === "fieldType") {
    patch.alayaCareConfig = { ...(field.alayaCareConfig ?? {}), fieldType: alayacare.fieldType as NonNullable<BuilderField["alayaCareConfig"]>["fieldType"] };
  }
  return patch;
}
