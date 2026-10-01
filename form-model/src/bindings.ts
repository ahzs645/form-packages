/**
 * Chart bindings (neutral form model).
 *
 * A binding says where a field's value comes from in the patient chart and
 * where the answer goes back to, in terms that belong to no EMR:
 *
 * - `read`: a clinical concept from the concept catalog (the
 *   `crossPlatformMappingId` ids, e.g. `patient.phn`), or an observation
 *   (LOINC first, with its MOIS code and unit beside it), and how the value is
 *   applied: filled once (`initial`), kept in sync (`sync`), or not filled at
 *   all while the field shows the patient's earlier results (`none` with
 *   `history`). `paths` are MOIS source-data paths, kept only when they are
 *   not simply the concept's or observation's own path (an override).
 * - `write`: an observation the answer is saved as, and/or a chart mutation,
 *   on submit.
 *
 * Older forms spell the same intent in several product stores, each read by
 * a different subset of targets. `readFieldBinding` reads all of them:
 *
 * | Legacy store | Where | Reads as |
 * | --- | --- | --- |
 * | `sourceConfig` (paths, mode, presentation, fallback, format, valueTransform) | fields | `read` |
 * | `sourceConfig.chartQuery` (and its derived `patient.chart.query.q…` path) | fields | `read.observation` + `read.query` |
 * | `measurementConfig` (autoFillFromHistory, showHistory, persistenceMode) | fields | `read` (`initial`, or `none` with `history`); `write.observation` for "Observation + form draft" on an editable field |
 * | `moisOutput` (observation kind, enabled not false, a code) | fields, layout cells | `write.observation` |
 * | `moisConfig.writeBinding` | fields | `write.mutation` |
 * | `moisTargetId` | table columns | `read.paths` (the MOIS picker stores a source path) |
 * | `sourcePath`, `sourcePaths`, `sourceMode`, `sourceFallback` (else `defaultValue`), `sourceFormat` | layout cells | `read` (a cell filled once from the clock is a default answer, see defaults.ts) |
 * | `crossPlatformMappingId` | fields | the concept of each part; alone, the parts its catalog entry defines |
 * | `alayaCareConfig` demographics or vital with a catalog concept | fields | `read.concept` / `write` of the concept's observation |
 * | `cernerConfig.dta` with a reviewed crosswalk row | fields | `write.observation` |
 * | `fhirConfig.observationExtract` with an item code | fields | `write.observation` |
 *
 * Deliberately not read here: default answers (`defaultAnswer`, a subform
 * entry's `defaultFromObservation`, FHIR `initialExpression` and
 * `observationLinkPeriod`) are read by `readDefaultAnswer`; the MOIS save key
 * (`moisConfig.localWrite`) and chart-module link (`moisConfig.navigation`)
 * are MOIS storage and navigation options; a `documentComment` output, stamp
 * buttons (`stampConfig.sourcePath`) and import provenance (`sourceContract`,
 * `oscarImport`) are not chart bindings. An AlayaCare demographics or vital
 * setting, or a Cerner DTA, with no catalog concept or reviewed crosswalk row
 * binds in that product only; it is listed in `targetOnly` and stays a
 * product option.
 *
 * `writeFieldBinding` stores the binding as `binding` and writes each changed
 * part into the store that holds it today (or the mirror current exporters
 * read: `sourceConfig` for a MOIS read, `moisOutput` for an observation,
 * `moisConfig.writeBinding` for a mutation, the cell's source keys on a layout
 * cell, `moisTargetId` on a table column). A reader that finds a stored
 * binding and legacy stores that disagree takes the legacy store for that
 * part: a writer that only knew the legacy store changed it after the binding
 * was saved, the way an edited formula text wins over a stale tree.
 *
 * Product catalogs (concept ids, MOIS read paths, the Cerner crosswalk) live
 * in the app, so the reader takes them as a `FieldBindingCatalog`; without
 * one it reads what the stores say literally. This module has type imports
 * only.
 */
import type { BuilderChartQuery } from "./index";

export const BINDING_LOINC_SYSTEM = "http://loinc.org";
export const BINDING_MOIS_OBSERVATION_SYSTEM = "urn:mois:observation";

export type BindingReadMode = "initial" | "sync" | "none";
export type BindingPresentation = "shown" | "backing";
export type BindingWriteWhen = "submit" | "save";
export type BindingValueType = "TEXT" | "NUMERIC" | "VALUESET";

export interface BindingCoding {
  code: string;
  system: string;
}

/** An observation: its primary code (LOINC when known), unit, and the same observation in other code systems. */
export interface BindingObservation {
  code: string;
  /** `http://loinc.org`, `urn:mois:observation`, or another system. Absent means a MOIS observation code. */
  system?: string;
  /** The unit as the source stores it (UCUM for LOINC and FHIR sources, MOIS display units otherwise). */
  unit?: string;
  /** The same observation in other code systems, e.g. the MOIS observation code beside its LOINC code. */
  codings?: BindingCoding[];
}

/** How a portable chart query picks the observation (BuilderChartQuery without its code). */
export interface BindingObservationQuery {
  encounter?: "any" | "selected";
  lookBackDays?: number;
  statuses?: Array<"final" | "amended" | "corrected">;
  specimen?: { system: string; code: string };
  unitSystem?: string;
}

export interface BuilderFieldBindingRead {
  /** Concept catalog id (`crossPlatformMappingId` namespace), e.g. `patient.phn`, `vital.weight`, `patient.age`. */
  concept?: string;
  /** The catalog variant of a concept with several shapes, e.g. `months` for `patient.age`. */
  variant?: string;
  observation?: BindingObservation;
  /** Present when the read is a portable chart query (latest matching observation). */
  query?: BindingObservationQuery;
  /** MOIS source-data paths tried in order: an override kept only when the concept or observation does not give it. */
  paths?: string[];
  /** `initial` fills an empty answer once, `sync` refills on every load, `none` fills nothing (see `history`). */
  mode: BindingReadMode;
  /** `backing` keeps the value in data, saves and document fills but hides the input. */
  presentation: BindingPresentation;
  /** Used when nothing resolves. */
  fallback?: string | number | boolean | null;
  /** How the source value is formatted: text, date, dateTime, coding, visitCode, or an OSCAR summary. */
  format?: string;
  /** Engine-side reshaping of a structured source value (MOIS `valueTransform`: exists, address, insurance, telecom). */
  transform?: string;
  /** Show the patient's earlier results for the observation beside the field. */
  history?: boolean;
  /**
   * The field shows chart content the EMR assembles, read-only, and takes no
   * answer: a chart summary. Such a read has no value path of its own; each
   * target converts it or reports it (`<target>.binding.chart-summary`).
   */
  summary?: BindingChartSummary;
}

/**
 * A read-only view of chart content, not a value the question takes: a
 * PowerChart Smart Template or chart summary drawn in a rich-text box, the
 * charted results of a DTA shown read-only, or an iView row that displays
 * results charted elsewhere (a lab, a device, another form). The field is
 * refreshed from the chart, never answered and never written back.
 */
export interface BindingChartSummary {
  /** What the content is called: the template's, the DTA's or the result set's display name. */
  title: string;
  /**
   * `template`: content a named chart template or program assembles (a
   * Smart Template, a chart summary); `results`: the charted results of one
   * result type (a DTA, an event set).
   */
  kind: "template" | "results";
}

export interface BindingMutation {
  /** The chart mutation (MOIS write target id). */
  id: string;
  payloadField: string;
  contextIdPath?: string | null;
}

/**
 * What an observation write does when its date field is blank on submit:
 * `ask` stops the submit until the date is entered, `skip` leaves the reading
 * off the chart (the answer stays with the form), `submitTime` dates it at
 * the moment the form is submitted.
 */
export type BindingWhenDateMissing = "ask" | "skip" | "submitTime";

/**
 * When the reading an observation write records was taken, from other
 * answers on the form: a birth weight is dated by the birth date, a discharge
 * weight by the discharge date. Each target converts it (MOIS: the collected
 * date, hour and minute; FHIR: `Observation.effective[x]`; Cerner: the
 * result's performed date) or reports it as a loss
 * (`<target>.binding.observation-date`). No `effective` means the target's own
 * default, which for every target today is the time the form is submitted.
 */
export interface BindingObservationDate {
  /** The date or date-and-time field whose answer dates the reading. */
  fieldId: string;
  /** A time field giving the clock when `fieldId` holds a date only. */
  timeFieldId?: string;
  whenMissing: BindingWhenDateMissing;
}

export interface BuilderFieldBindingWrite {
  concept?: string;
  observation?: BindingObservation & { valueType?: BindingValueType };
  mutation?: BindingMutation;
  when: BindingWriteWhen;
  /**
   * The date of the reading the observation records. Stored on the binding
   * only (no product store holds it), so it follows the observation whichever
   * store that comes from.
   */
  effective?: BindingObservationDate;
}

export interface BuilderFieldBinding {
  read?: BuilderFieldBindingRead;
  write?: BuilderFieldBindingWrite;
}

/** Where a binding is stored, which decides the legacy stores read and written. */
export type FieldBindingShape = "field" | "tableColumn" | "layoutCell" | "layoutCellField";

export type FieldBindingStore =
  | "binding"
  | "sourceConfig"
  | "sourceConfig.chartQuery"
  | "measurementConfig.read"
  | "measurementConfig.write"
  | "moisOutput"
  | "moisConfig.writeBinding"
  | "moisTargetId"
  | "layoutCell.source"
  | "crossPlatformMappingId"
  | "alayaCareConfig.demographics"
  | "alayaCareConfig.vital"
  | "cernerConfig.dta"
  | "fhirConfig.observationExtract";

export interface FieldBindingReading {
  binding: BuilderFieldBinding | null;
  /** The stores the binding was read from. */
  stores: FieldBindingStore[];
  /** Settings that bind in one product only, with no neutral identity (they stay that product's options). */
  targetOnly: string[];
  /** Keys or values in a binding store this reader does not know. The fixture census fails on any. */
  unknown: string[];
}

/** An observation's identity in the app's catalogs. */
export interface BindingObservationIdentity {
  concept?: string;
  /** Every known coding of the observation (LOINC, MOIS…), the looked-up one included or not. */
  codings?: BindingCoding[];
  unit?: string;
}

/**
 * The app's catalogs, passed in because they live outside this package
 * (lib/field-bindings.ts builds the one the builder and exporters use).
 */
export interface FieldBindingCatalog {
  /** The concept (and variant) a MOIS source path reads. */
  conceptForPath?(path: string): { concept: string; variant?: string } | null;
  /** The MOIS source path of a concept (and variant). */
  pathForConcept?(concept: string, variant?: string): string | null;
  /** The concept an AlayaCare demographics or vital setting names. */
  conceptForAlayaCare?(setting: { fieldType?: string | null; demographicsFieldName?: string | null; vitalType?: string | null }): string | null;
  /** What a concept binds when it is the only store: a read, and the observation it writes. */
  conceptParts?(concept: string): { read: boolean; write?: BindingObservation & { valueType?: BindingValueType } } | null;
  /** The observation's other codings, concept and unit. */
  observationIdentity?(coding: BindingCoding): BindingObservationIdentity | null;
  /** The observation a Cerner DTA charts to, through the reviewed crosswalk. */
  observationForDta?(dta: { mnemonic?: string; taskAssayId?: string; taskAssayGuid?: string; eventCodeDisplay?: string }): (BindingObservation & { concept?: string }) | null;
  /** The derived MOIS path the preview and export use for a chart query. */
  queryPath?(query: BuilderChartQuery): string;
}

export interface FieldBindingOptions {
  shape?: FieldBindingShape;
  catalog?: FieldBindingCatalog | null;
}

export interface WriteFieldBindingOptions extends FieldBindingOptions {
  /**
   * Where a new observation write goes on a field that has none: `moisOutput`
   * (default) or the field's past-measurement settings.
   */
  writeStore?: "moisOutput" | "measurementConfig";
}

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasOwn = (value: AnyRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as unknown as T;
  if (isRecord(value)) {
    const out: AnyRecord = {};
    for (const key of Object.keys(value)) if (value[key] !== undefined) out[key] = cloneValue(value[key]);
    return out as T;
  }
  return value;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return value === undefined ? "null" : JSON.stringify(value);
}

function uniqueStrings(values: unknown[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    const text = nonEmptyString(value);
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Known store shapes (anything else is reported as unknown)
// ---------------------------------------------------------------------------

const SOURCE_CONFIG_KEYS = ["paths", "format", "mode", "fallback", "chartQuery", "presentation", "valueTransform"];
/** `datetime` is an older spelling of `dateTime`; the MOIS runtime passes both through unchanged. */
const SOURCE_FORMATS = ["text", "date", "dateTime", "datetime", "coding", "oscarAllergies", "oscarConditions", "oscarMedications"];
const LAYOUT_SOURCE_FORMATS = ["text", "date", "dateTime", "visitCode", "coding"];
const SOURCE_MODES = ["initial", "sync"];
const LAYOUT_SOURCE_MODES = ["initial", "live"];
const PRESENTATIONS = ["editable", "backing"];
const VALUE_TRANSFORMS = ["exists", "address", "insurance", "telecom"];
const CHART_QUERY_KEYS = ["kind", "system", "code", "unit", "unitSystem", "encounter", "lookBackDays", "statuses", "specimen"];
const MOIS_OUTPUT_KEYS = [
  "enabled", "kind", "observationCode", "loincCode", "system", "labCode", "status", "dictionaryMetadata",
  "description", "valueType", "valueSource", "reportFromDisplay", "deleteWhenFalse", "valueTemplate",
  "reportFieldId", "units", "unitsFieldId", "unitsInline", "conditionalFieldId", "conditionalValues",
  "condition", "commentTemplate", "rangeNormalLow", "rangeNormalHigh", "rangeAbsurdLow", "rangeAbsurdHigh",
  "referenceRangeText", "reportTemplate", "commentFieldId",
];
const MOIS_OUTPUT_KINDS = ["observation", "dcoObservation", "documentComment"];
const VALUE_TYPES = ["TEXT", "NUMERIC", "VALUESET"];
const MEASUREMENT_KEYS = [
  "enabled", "observationCode", "observationComment", "valueType", "saveDescription", "saveUnits",
  "persistenceMode", "maxHistory", "autoFillFromHistory", "bringForward", "showHistory", "showHistoryList",
  "showHistoryOnFocus", "historyInitiallyVisible", "inlineLayout", "emptyHistoryText", "graphLinkText",
  "graphHref", "abnormalLow", "abnormalHigh", "criticalLow", "criticalHigh", "abnormalMessage", "normalMessage",
];
const PERSISTENCE_MODES = ["formOnly", "observationAndForm"];
const MOIS_CONFIG_KEYS = ["localWrite", "writeBinding", "navigation"];
const CERNER_DTA_KEYS = [
  "mnemonic", "description", "taskAssayId", "taskAssayGuid", "eventCodeDisplay", "eventCodeUid", "eventSetName",
  "activityType", "resultType", "conceptCki", "refTextFiles", "definition", "catalogDefinition", "nativeRecord",
  "authoring", "provenance",
];
const BINDING_KEYS = ["read", "write"];
const READ_KEYS = ["concept", "variant", "observation", "query", "paths", "mode", "presentation", "fallback", "format", "transform", "history", "summary"];
const SUMMARY_KEYS = ["title", "kind"];
const WRITE_KEYS = ["concept", "observation", "mutation", "when", "effective"];
const EFFECTIVE_KEYS = ["fieldId", "timeFieldId", "whenMissing"];
const WHEN_DATE_MISSING: readonly BindingWhenDateMissing[] = ["ask", "skip", "submitTime"];
const OBSERVATION_KEYS = ["code", "system", "unit", "codings", "valueType"];

function checkKeys(store: string, value: AnyRecord, known: readonly string[], unknown: string[]) {
  for (const key of Object.keys(value)) if (!known.includes(key) && value[key] !== undefined) unknown.push(`${store}.${key}`);
}

function checkValue(store: string, value: unknown, known: readonly string[], unknown: string[], caseInsensitive = false) {
  if (value === undefined || value === null) return;
  const text = typeof value === "string" ? (caseInsensitive ? value.toUpperCase() : value) : value;
  if (!known.includes(text as string)) unknown.push(`${store}=${String(value)}`);
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

const OBSERVATION_VALUE_PATH = /^patient\.observations\[observationCode=([^\]]+)\]\.value$/;

/** The MOIS source path of an observation's latest value. */
export function observationValuePath(moisCode: string): string {
  return `patient.observations[observationCode=${moisCode.trim().replace(/\]/g, "")}].value`;
}

/** The MOIS observation code a latest-value path reads, or null. */
export function parseObservationValuePath(path: string): string | null {
  const match = OBSERVATION_VALUE_PATH.exec(path.trim());
  return match?.[1]?.trim() || null;
}

/** Paths MOIS derives from a chart query (patient.chart.query.q<hex>); never an author's own path. */
const isDerivedQueryPath = (path: string) => path.startsWith("patient.chart.query.q");

/** The observation's code in a code system (a missing system counts as a MOIS code), or null. */
export function observationCodeIn(observation: BindingObservation | null | undefined, system: string): string | null {
  if (!observation) return null;
  const own = observation.system ?? BINDING_MOIS_OBSERVATION_SYSTEM;
  if (own === system) return observation.code;
  return observation.codings?.find((coding) => coding.system === system)?.code ?? null;
}

/** The MOIS observation code an observation is saved and read under, or null. */
export function moisObservationCodeOf(observation: BindingObservation | null | undefined): string | null {
  return observationCodeIn(observation, BINDING_MOIS_OBSERVATION_SYSTEM);
}

const normalizeValueType = (value: unknown): BindingValueType | undefined => {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  return upper === "NUMERIC" || upper === "VALUESET" ? upper : upper ? "TEXT" : undefined;
};

/**
 * An observation from its codings, with the catalog's other codings, concept
 * and unit added. LOINC is the primary code when known (unless `keepPrimary`,
 * for a chart query whose own code must survive); the others are `codings`,
 * sorted by system.
 */
function identifyObservation(
  given: BindingCoding[],
  unit: string | undefined,
  catalog: FieldBindingCatalog | null | undefined,
  keepPrimary = false,
): { observation: BindingObservation; concept?: string } | null {
  const codings: BindingCoding[] = [];
  const add = (coding: BindingCoding | undefined) => {
    const code = nonEmptyString(coding?.code);
    const system = nonEmptyString(coding?.system);
    if (!code || !system || codings.some((existing) => existing.system === system)) return;
    codings.push({ code, system });
  };
  given.forEach(add);
  if (codings.length === 0) return null;
  let concept: string | undefined;
  let catalogUnit: string | undefined;
  if (catalog?.observationIdentity) {
    for (const coding of [...codings]) {
      const identity = catalog.observationIdentity(coding);
      if (!identity) continue;
      identity.codings?.forEach(add);
      concept ??= nonEmptyString(identity.concept);
      catalogUnit ??= nonEmptyString(identity.unit);
    }
  }
  const primary = !keepPrimary && codings.find((coding) => coding.system === BINDING_LOINC_SYSTEM) || codings[0];
  const others = codings.filter((coding) => coding !== primary).sort((a, b) => a.system.localeCompare(b.system));
  const resolvedUnit = nonEmptyString(unit) ?? catalogUnit;
  return {
    observation: {
      code: primary.code,
      system: primary.system,
      ...(resolvedUnit ? { unit: resolvedUnit } : {}),
      ...(others.length ? { codings: others } : {}),
    },
    ...(concept ? { concept } : {}),
  };
}

function observationCodings(observation: BindingObservation): BindingCoding[] {
  return [
    { code: observation.code, system: observation.system ?? BINDING_MOIS_OBSERVATION_SYSTEM },
    ...(observation.codings ?? []),
  ];
}

// ---------------------------------------------------------------------------
// Normalising a stored binding
// ---------------------------------------------------------------------------

function normalizeObservation(value: unknown, unknown: string[], store: string, withValueType: boolean): (BindingObservation & { valueType?: BindingValueType }) | undefined {
  if (!isRecord(value)) return undefined;
  checkKeys(store, value, withValueType ? OBSERVATION_KEYS : OBSERVATION_KEYS.filter((key) => key !== "valueType"), unknown);
  const code = nonEmptyString(value.code);
  if (!code) return undefined;
  const system = nonEmptyString(value.system);
  const unit = nonEmptyString(value.unit);
  const codings = Array.isArray(value.codings)
    ? value.codings
        .filter(isRecord)
        .map((coding) => ({ code: nonEmptyString(coding.code), system: nonEmptyString(coding.system) }))
        .filter((coding): coding is BindingCoding => Boolean(coding.code && coding.system))
    : [];
  const valueType = withValueType ? normalizeValueType(value.valueType) : undefined;
  return {
    code,
    ...(system ? { system } : {}),
    ...(unit ? { unit } : {}),
    ...(codings.length ? { codings } : {}),
    ...(valueType ? { valueType } : {}),
  };
}

function normalizeQuery(value: unknown): BindingObservationQuery | undefined {
  if (!isRecord(value)) return undefined;
  const out: BindingObservationQuery = {};
  if (value.encounter === "any" || value.encounter === "selected") out.encounter = value.encounter;
  if (typeof value.lookBackDays === "number" && Number.isFinite(value.lookBackDays)) out.lookBackDays = value.lookBackDays;
  if (Array.isArray(value.statuses)) out.statuses = value.statuses.filter((status): status is "final" | "amended" | "corrected" => status === "final" || status === "amended" || status === "corrected");
  if (isRecord(value.specimen) && nonEmptyString(value.specimen.system) && nonEmptyString(value.specimen.code)) {
    out.specimen = { system: nonEmptyString(value.specimen.system)!, code: nonEmptyString(value.specimen.code)! };
  }
  const unitSystem = nonEmptyString(value.unitSystem);
  if (unitSystem) out.unitSystem = unitSystem;
  return out;
}

function normalizeRead(value: unknown, unknown: string[]): BuilderFieldBindingRead | undefined {
  if (!isRecord(value)) return undefined;
  checkKeys("binding.read", value, READ_KEYS, unknown);
  const concept = nonEmptyString(value.concept);
  const variant = concept ? nonEmptyString(value.variant) : undefined;
  const observation = normalizeObservation(value.observation, unknown, "binding.read.observation", false);
  const query = observation ? normalizeQuery(value.query) : undefined;
  const paths = Array.isArray(value.paths) ? uniqueStrings(value.paths) : [];
  const mode: BindingReadMode = value.mode === "sync" ? "sync" : value.mode === "none" ? "none" : "initial";
  const history = value.history === true;
  const summary = normalizeSummary(value.summary, unknown);
  if (!concept && !observation && paths.length === 0 && !summary) return undefined;
  if (mode === "none" && !history && !summary) return undefined;
  const format = nonEmptyString(value.format);
  const transform = nonEmptyString(value.transform);
  const fallback = value.fallback;
  return {
    ...(concept ? { concept } : {}),
    ...(variant ? { variant } : {}),
    ...(observation ? { observation } : {}),
    ...(query ? { query } : {}),
    ...(paths.length ? { paths } : {}),
    mode,
    presentation: value.presentation === "backing" ? "backing" : "shown",
    ...(fallback !== undefined && fallback !== null && fallback !== "" && ["string", "number", "boolean"].includes(typeof fallback) ? { fallback: fallback as string | number | boolean } : {}),
    ...(format ? { format: format === "datetime" ? "dateTime" : format } : {}),
    ...(transform ? { transform } : {}),
    ...(history ? { history } : {}),
    ...(summary ? { summary } : {}),
  };
}

function normalizeSummary(value: unknown, unknown: string[]): BindingChartSummary | undefined {
  if (!isRecord(value)) return undefined;
  checkKeys("binding.read.summary", value, SUMMARY_KEYS, unknown);
  const title = nonEmptyString(value.title);
  if (!title) return undefined;
  checkValue("binding.read.summary.kind", value.kind, ["template", "results"], unknown);
  return { title, kind: value.kind === "results" ? "results" : "template" };
}

/** The chart summary a binding shows, or null (see `BindingChartSummary`). */
export function chartSummaryOfBinding(binding: BuilderFieldBinding | null | undefined): BindingChartSummary | null {
  return binding?.read?.summary ?? null;
}

function normalizeMutation(value: unknown): BindingMutation | undefined {
  if (!isRecord(value)) return undefined;
  const id = nonEmptyString(value.id);
  const payloadField = nonEmptyString(value.payloadField);
  if (!id || !payloadField) return undefined;
  const contextIdPath = nonEmptyString(value.contextIdPath);
  return { id, payloadField, ...(contextIdPath ? { contextIdPath } : {}) };
}

function normalizeObservationDate(value: unknown, unknown: string[]): BindingObservationDate | undefined {
  if (!isRecord(value)) return undefined;
  checkKeys("binding.write.effective", value, EFFECTIVE_KEYS, unknown);
  checkValue("binding.write.effective.whenMissing", value.whenMissing, WHEN_DATE_MISSING, unknown);
  const fieldId = nonEmptyString(value.fieldId);
  if (!fieldId) return undefined;
  const timeFieldId = nonEmptyString(value.timeFieldId);
  const whenMissing = WHEN_DATE_MISSING.includes(value.whenMissing as BindingWhenDateMissing)
    ? value.whenMissing as BindingWhenDateMissing
    : "ask";
  return { fieldId, ...(timeFieldId && timeFieldId !== fieldId ? { timeFieldId } : {}), whenMissing };
}

function normalizeWrite(value: unknown, unknown: string[]): BuilderFieldBindingWrite | undefined {
  if (!isRecord(value)) return undefined;
  checkKeys("binding.write", value, WRITE_KEYS, unknown);
  const observation = normalizeObservation(value.observation, unknown, "binding.write.observation", true);
  const mutation = normalizeMutation(value.mutation);
  if (!observation && !mutation) return undefined;
  const concept = nonEmptyString(value.concept);
  // A date dates an observation; a write with none has nothing to date.
  const effective = observation ? normalizeObservationDate(value.effective, unknown) : undefined;
  return {
    ...(concept ? { concept } : {}),
    ...(observation ? { observation } : {}),
    ...(mutation ? { mutation } : {}),
    when: value.when === "save" ? "save" : "submit",
    ...(effective ? { effective } : {}),
  };
}

/**
 * The date of the reading a binding's observation write records, or null
 * (the target dates it at submit). A date with no observation is none.
 */
export function observationDateOf(binding: BuilderFieldBinding | null | undefined): BindingObservationDate | null {
  const write = binding?.write;
  return write?.observation && write.effective ? write.effective : null;
}

function normalizeBindingWith(value: unknown, unknown: string[]): BuilderFieldBinding | null {
  if (!isRecord(value)) return null;
  checkKeys("binding", value, BINDING_KEYS, unknown);
  const read = normalizeRead(value.read, unknown);
  const write = normalizeWrite(value.write, unknown);
  if (!read && !write) return null;
  return { ...(read ? { read } : {}), ...(write ? { write } : {}) };
}

/** A well-formed binding with only its own keys, trimmed; null when it binds nothing. */
export function normalizeFieldBinding(value: unknown): BuilderFieldBinding | null {
  return normalizeBindingWith(value, []);
}

/** Whether two bindings (or two absent bindings) say the same thing. */
export function sameFieldBinding(left: BuilderFieldBinding | null | undefined, right: BuilderFieldBinding | null | undefined): boolean {
  return stableJson(normalizeFieldBinding(left) ?? null) === stableJson(normalizeFieldBinding(right) ?? null);
}

// ---------------------------------------------------------------------------
// Canonical form: concept from paths, observation identity, derivable paths dropped
// ---------------------------------------------------------------------------

/**
 * The MOIS source paths a read resolves to: its own paths, else the concept's
 * catalog path, else the observation's latest-value path. A chart query's
 * derived path is separate (`catalog.queryPath`).
 */
export function moisReadPathsOf(read: BuilderFieldBindingRead | null | undefined, catalog?: FieldBindingCatalog | null): string[] {
  if (!read || read.query) return [];
  if (read.paths?.length) return [...read.paths];
  if (read.concept) {
    const path = catalog?.pathForConcept?.(read.concept, read.variant);
    if (path) return [path];
  }
  const moisCode = moisObservationCodeOf(read.observation);
  return moisCode ? [observationValuePath(moisCode)] : [];
}

function canonicalRead(read: BuilderFieldBindingRead | undefined, catalog: FieldBindingCatalog | null | undefined): BuilderFieldBindingRead | undefined {
  if (!read) return undefined;
  const next: BuilderFieldBindingRead = cloneValue(read);
  const paths = next.paths ?? [];
  if (!next.concept && paths.length && catalog?.conceptForPath) {
    for (const path of paths) {
      const hit = catalog.conceptForPath(path);
      if (hit?.concept) {
        next.concept = hit.concept;
        if (hit.variant) next.variant = hit.variant;
        break;
      }
    }
  }
  if (!next.observation && paths.length) {
    const code = parseObservationValuePath(paths[0]);
    if (code) next.observation = { code, system: BINDING_MOIS_OBSERVATION_SYSTEM };
  }
  if (next.observation) {
    const identity = identifyObservation(observationCodings(next.observation), next.observation.unit, catalog, Boolean(next.query));
    if (identity) {
      next.observation = identity.observation;
      if (!next.concept && identity.concept) next.concept = identity.concept;
    }
  }
  if (paths.length === 1) {
    const conceptPath = next.concept ? catalog?.pathForConcept?.(next.concept, next.variant) : null;
    const moisCode = moisObservationCodeOf(next.observation);
    if (paths[0] === conceptPath || (moisCode && paths[0] === observationValuePath(moisCode))) delete next.paths;
  }
  return next;
}

function canonicalWrite(write: BuilderFieldBindingWrite | undefined, catalog: FieldBindingCatalog | null | undefined): BuilderFieldBindingWrite | undefined {
  if (!write) return undefined;
  const next: BuilderFieldBindingWrite = cloneValue(write);
  if (next.observation) {
    const { valueType } = next.observation;
    const identity = identifyObservation(observationCodings(next.observation), next.observation.unit, catalog);
    if (identity) {
      next.observation = { ...identity.observation, ...(valueType ? { valueType } : {}) };
      if (!next.concept && identity.concept) next.concept = identity.concept;
    }
  }
  return next;
}

function canonicalBinding(binding: BuilderFieldBinding | null, catalog: FieldBindingCatalog | null | undefined): BuilderFieldBinding | null {
  if (!binding) return null;
  const read = canonicalRead(binding.read, catalog);
  const write = canonicalWrite(binding.write, catalog);
  if (!read && !write) return null;
  return { ...(read ? { read } : {}), ...(write ? { write } : {}) };
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

const TABLE_COLUMN_ONLY_TYPES = ["checkbox", "stampButton"];

/** The store a field-like object is: a regular (or parsed) field, table column, layout cell, or a field inside a field-list cell. */
export function inferFieldBindingShape(fieldLike: unknown): FieldBindingShape {
  if (!isRecord(fieldLike)) return "field";
  if (typeof fieldLike.type === "string") {
    if (
      TABLE_COLUMN_ONLY_TYPES.includes(fieldLike.type)
      || hasOwn(fieldLike, "dataPath")
      || hasOwn(fieldLike, "showInTable")
      || hasOwn(fieldLike, "showInModal")
      || hasOwn(fieldLike, "withTime")
      || hasOwn(fieldLike, "moisTargetId")
    ) return "tableColumn";
    return "field";
  }
  if (typeof fieldLike.rawType === "string") return "field";
  if (typeof fieldLike.kind === "string") return "layoutCell";
  if (hasOwn(fieldLike, "fieldId") || hasOwn(fieldLike, "inputType")) return "layoutCellField";
  return "field";
}

// ---------------------------------------------------------------------------
// Reading the legacy stores
// ---------------------------------------------------------------------------

const CLOCK_PATHS = ["system.currentDate", "system.currentDateTime"];

function layoutSourcePaths(cell: AnyRecord): string[] {
  return uniqueStrings([cell.sourcePath, ...(Array.isArray(cell.sourcePaths) ? cell.sourcePaths : [])]);
}

/** A layout cell filled once from the clock: a default answer (readDefaultAnswer), not a binding. */
function isClockDefaultCell(cell: AnyRecord): boolean {
  const paths = layoutSourcePaths(cell);
  return paths.length > 0 && cell.sourceMode === "initial" && paths.every((path) => CLOCK_PATHS.includes(path));
}

function hasPrimitiveValue(value: unknown): value is string | number | boolean {
  return (typeof value === "string" && value !== "") || typeof value === "number" || typeof value === "boolean";
}

function chartQueryOf(value: unknown, unknown: string[]): BuilderChartQuery | null {
  if (!isRecord(value)) return null;
  checkKeys("sourceConfig.chartQuery", value, CHART_QUERY_KEYS, unknown);
  if (value.kind !== undefined && value.kind !== "Observation") unknown.push(`sourceConfig.chartQuery.kind=${String(value.kind)}`);
  if (!nonEmptyString(value.code) || !nonEmptyString(value.system)) return null;
  return value as unknown as BuilderChartQuery;
}

function readFromSourceConfig(field: AnyRecord, unknown: string[], stores: FieldBindingStore[]): BuilderFieldBindingRead | null {
  const config = field.sourceConfig;
  if (config === undefined || config === null) return null;
  if (!isRecord(config)) {
    unknown.push(`sourceConfig:${typeof config}`);
    return null;
  }
  checkKeys("sourceConfig", config, SOURCE_CONFIG_KEYS, unknown);
  checkValue("sourceConfig.format", config.format, SOURCE_FORMATS, unknown);
  checkValue("sourceConfig.mode", config.mode, SOURCE_MODES, unknown);
  checkValue("sourceConfig.presentation", config.presentation, PRESENTATIONS, unknown);
  checkValue("sourceConfig.valueTransform", config.valueTransform, VALUE_TRANSFORMS, unknown);
  if (config.paths !== undefined && !Array.isArray(config.paths)) unknown.push("sourceConfig.paths:not-a-list");
  const query = chartQueryOf(config.chartQuery, unknown);
  const paths = uniqueStrings(Array.isArray(config.paths) ? config.paths : []).filter((path) => !isDerivedQueryPath(path));
  if (!query && paths.length === 0) return null;
  stores.push(query ? "sourceConfig.chartQuery" : "sourceConfig");
  const format = nonEmptyString(config.format);
  const transform = nonEmptyString(config.valueTransform);
  const read: BuilderFieldBindingRead = {
    ...(query
      ? {
          observation: {
            code: query.code.trim(),
            system: query.system.trim(),
            ...(nonEmptyString(query.unit) ? { unit: query.unit.trim() } : {}),
          },
          query: normalizeQuery(query) ?? {},
        }
      : { paths }),
    mode: config.mode === "sync" ? "sync" : "initial",
    presentation: config.presentation === "backing" ? "backing" : "shown",
    ...(hasPrimitiveValue(config.fallback) ? { fallback: config.fallback } : {}),
    ...(format ? { format: format === "datetime" ? "dateTime" : format } : {}),
    ...(transform ? { transform } : {}),
  };
  return read;
}

function readFromLayoutCell(cell: AnyRecord, unknown: string[], stores: FieldBindingStore[]): BuilderFieldBindingRead | null {
  checkValue("layoutCell.sourceFormat", cell.sourceFormat, LAYOUT_SOURCE_FORMATS, unknown);
  checkValue("layoutCell.sourceMode", cell.sourceMode, LAYOUT_SOURCE_MODES, unknown);
  const paths = layoutSourcePaths(cell);
  if (paths.length === 0 || isClockDefaultCell(cell)) return null;
  stores.push("layoutCell.source");
  const fallback = cell.sourceFallback ?? cell.defaultValue;
  const format = nonEmptyString(cell.sourceFormat);
  return {
    paths,
    mode: cell.sourceMode === "initial" ? "initial" : "sync",
    presentation: "shown",
    ...(hasPrimitiveValue(fallback) ? { fallback } : {}),
    ...(format ? { format } : {}),
  };
}

interface MeasurementParts {
  read: BuilderFieldBindingRead | null;
  write: BuilderFieldBindingWrite | null;
}

function readFromMeasurement(field: AnyRecord, unknown: string[]): MeasurementParts {
  const config = field.measurementConfig;
  if (config === undefined || config === null) return { read: null, write: null };
  if (!isRecord(config)) {
    unknown.push(`measurementConfig:${typeof config}`);
    return { read: null, write: null };
  }
  checkKeys("measurementConfig", config, MEASUREMENT_KEYS, unknown);
  checkValue("measurementConfig.persistenceMode", config.persistenceMode, PERSISTENCE_MODES, unknown);
  checkValue("measurementConfig.valueType", config.valueType, VALUE_TYPES, unknown, true);
  const code = nonEmptyString(config.observationCode);
  if (config.enabled === false || !code) return { read: null, write: null };
  const observation: BindingObservation = { code, system: BINDING_MOIS_OBSERVATION_SYSTEM };
  const fills = config.autoFillFromHistory === true && config.bringForward !== false;
  const history = config.showHistory !== false;
  const read: BuilderFieldBindingRead | null = fills || history
    ? { observation, mode: fills ? "initial" : "none", presentation: "shown", ...(history ? { history: true } : {}) }
    : null;
  const unit = nonEmptyString(config.saveUnits);
  const valueType = normalizeValueType(config.valueType);
  const write: BuilderFieldBindingWrite | null = config.persistenceMode === "observationAndForm" && field.disabled !== true
    ? { observation: { ...observation, ...(unit ? { unit } : {}), ...(valueType ? { valueType } : {}) }, when: "submit" }
    : null;
  return { read, write };
}

function readFromMoisOutput(field: AnyRecord, unknown: string[], stores: FieldBindingStore[], targetOnly: string[]): BuilderFieldBindingWrite | null {
  const output = field.moisOutput;
  if (output === undefined || output === null) return null;
  if (!isRecord(output)) {
    unknown.push(`moisOutput:${typeof output}`);
    return null;
  }
  checkKeys("moisOutput", output, MOIS_OUTPUT_KEYS, unknown);
  checkValue("moisOutput.kind", output.kind, MOIS_OUTPUT_KINDS, unknown);
  checkValue("moisOutput.valueType", output.valueType, VALUE_TYPES, unknown, true);
  if (output.enabled === false) return null;
  if (output.kind === "documentComment") {
    targetOnly.push("moisOutput.documentComment");
    return null;
  }
  const code = nonEmptyString(output.observationCode);
  if (!code) return null;
  stores.push("moisOutput");
  const codings: BindingCoding[] = [{ code, system: BINDING_MOIS_OBSERVATION_SYSTEM }];
  const loinc = nonEmptyString(output.loincCode);
  if (loinc) codings.push({ code: loinc, system: BINDING_LOINC_SYSTEM });
  const unit = nonEmptyString(output.units);
  const valueType = normalizeValueType(output.valueType);
  return {
    observation: {
      code,
      system: BINDING_MOIS_OBSERVATION_SYSTEM,
      ...(unit ? { unit } : {}),
      ...(loinc ? { codings: [{ code: loinc, system: BINDING_LOINC_SYSTEM }] } : {}),
      ...(valueType ? { valueType } : {}),
    },
    when: "submit",
  };
}

function readMutation(field: AnyRecord, unknown: string[], stores: FieldBindingStore[]): BindingMutation | null {
  const config = field.moisConfig;
  if (config === undefined || config === null) return null;
  if (!isRecord(config)) {
    unknown.push(`moisConfig:${typeof config}`);
    return null;
  }
  checkKeys("moisConfig", config, MOIS_CONFIG_KEYS, unknown);
  const binding = config.writeBinding;
  if (!isRecord(binding)) return null;
  const id = nonEmptyString(binding.targetId);
  const payloadField = nonEmptyString(binding.payloadField);
  if (!id || !payloadField) return null;
  stores.push("moisConfig.writeBinding");
  const contextIdPath = nonEmptyString(binding.contextIdPath);
  return { id, payloadField, ...(contextIdPath ? { contextIdPath } : {}) };
}

interface LegacyReading extends FieldBindingReading {
  /** Where each part came from (the writer updates that store). */
  readStore: FieldBindingStore | null;
  writeStore: FieldBindingStore | null;
  /** The concept an explicit library mapping id gives. */
  mappingConcept: string | null;
}

function readLegacy(fieldLike: AnyRecord, shape: FieldBindingShape, catalog: FieldBindingCatalog | null | undefined): LegacyReading {
  const stores: FieldBindingStore[] = [];
  const targetOnly: string[] = [];
  const unknown: string[] = [];
  let read: BuilderFieldBindingRead | null = null;
  let observationWrite: BuilderFieldBindingWrite | null = null;
  let mutation: BindingMutation | null = null;
  let readStore: FieldBindingStore | null = null;
  let writeStore: FieldBindingStore | null = null;
  const note = (store: FieldBindingStore) => {
    if (!stores.includes(store)) stores.push(store);
  };

  // --- reads -----------------------------------------------------------------
  if (shape === "field") {
    read = readFromSourceConfig(fieldLike, unknown, stores);
    if (read) readStore = stores[stores.length - 1];
  } else if (shape === "tableColumn") {
    const path = nonEmptyString(fieldLike.moisTargetId);
    if (fieldLike.moisTargetId !== undefined && fieldLike.moisTargetId !== null && typeof fieldLike.moisTargetId !== "string") {
      unknown.push(`moisTargetId:${typeof fieldLike.moisTargetId}`);
    }
    if (path) {
      read = { paths: [path], mode: "initial", presentation: "shown" };
      readStore = "moisTargetId";
      note("moisTargetId");
    }
  } else if (shape === "layoutCell") {
    read = readFromLayoutCell(fieldLike, unknown, stores);
    if (read) readStore = "layoutCell.source";
  } else if (layoutSourcePaths(fieldLike).length > 0) {
    // A field inside a field-list cell has no source keys the runtime reads.
    unknown.push("layoutCellField.sourcePaths");
  }

  if (shape === "field") {
    const measurement = readFromMeasurement(fieldLike, unknown);
    if (!read && measurement.read) {
      read = measurement.read;
      readStore = "measurementConfig.read";
      note("measurementConfig.read");
    }
    if (measurement.write) {
      observationWrite = measurement.write;
      writeStore = "measurementConfig.write";
      note("measurementConfig.write");
    }
  }

  // --- writes ----------------------------------------------------------------
  if (shape !== "tableColumn") {
    const output = readFromMoisOutput(fieldLike, unknown, stores, targetOnly);
    if (output) {
      // The field's own Submit Output wins over a past-measurement write (the
      // export keeps the measurement form-only when both are set).
      observationWrite = output;
      writeStore = "moisOutput";
    }
  }
  if (shape === "field") {
    mutation = readMutation(fieldLike, unknown, stores);
  }

  // --- product stores that name a concept or observation ---------------------
  let mappingConcept: string | null = null;
  let alayaCareConcept: string | null = null;
  if (shape === "field") {
    const mappingId = nonEmptyString(fieldLike.crossPlatformMappingId);
    if (fieldLike.crossPlatformMappingId !== undefined && fieldLike.crossPlatformMappingId !== null && typeof fieldLike.crossPlatformMappingId !== "string") {
      unknown.push(`crossPlatformMappingId:${typeof fieldLike.crossPlatformMappingId}`);
    }
    if (mappingId) {
      mappingConcept = mappingId;
      note("crossPlatformMappingId");
    }

    const alayaCare = fieldLike.alayaCareConfig;
    if (isRecord(alayaCare) && (alayaCare.fieldType === "demographics" || alayaCare.fieldType === "vital")) {
      const store: FieldBindingStore = alayaCare.fieldType === "demographics" ? "alayaCareConfig.demographics" : "alayaCareConfig.vital";
      const name = alayaCare.fieldType === "demographics" ? nonEmptyString(alayaCare.demographicsFieldName) : nonEmptyString(alayaCare.vitalType);
      if (name) {
        const concept = catalog?.conceptForAlayaCare?.({
          fieldType: alayaCare.fieldType as string,
          demographicsFieldName: nonEmptyString(alayaCare.demographicsFieldName) ?? null,
          vitalType: nonEmptyString(alayaCare.vitalType) ?? null,
        }) ?? null;
        if (concept) {
          alayaCareConcept = concept;
          note(store);
        } else {
          targetOnly.push(`${store}:${name}`);
        }
      }
    }

    const cerner = fieldLike.cernerConfig;
    if (isRecord(cerner) && cerner.dta !== undefined && cerner.dta !== null) {
      if (!isRecord(cerner.dta)) {
        unknown.push(`cernerConfig.dta:${typeof cerner.dta}`);
      } else {
        checkKeys("cernerConfig.dta", cerner.dta, CERNER_DTA_KEYS, unknown);
        const dta = cerner.dta;
        const mnemonic = nonEmptyString(dta.mnemonic);
        if (mnemonic) {
          const crosswalked = catalog?.observationForDta?.({
            mnemonic,
            taskAssayId: nonEmptyString(dta.taskAssayId),
            taskAssayGuid: nonEmptyString(dta.taskAssayGuid),
            eventCodeDisplay: nonEmptyString(dta.eventCodeDisplay),
          }) ?? null;
          if (crosswalked) {
            note("cernerConfig.dta");
            if (!observationWrite) {
              const { concept, ...observation } = crosswalked;
              observationWrite = { ...(concept ? { concept } : {}), observation, when: "submit" };
              writeStore = "cernerConfig.dta";
            }
          } else {
            targetOnly.push(`cernerConfig.dta:${mnemonic}`);
          }
        }
      }
    }

    const fhir = fieldLike.fhirConfig;
    if (isRecord(fhir) && fhir.observationExtract !== undefined) {
      if (typeof fhir.observationExtract !== "boolean") unknown.push(`fhirConfig.observationExtract:${typeof fhir.observationExtract}`);
      const codes = Array.isArray(fhir.code) ? fhir.code.filter(isRecord) : [];
      const codings = codes
        .map((coding) => ({ code: nonEmptyString(coding.code), system: nonEmptyString(coding.system) }))
        .filter((coding): coding is BindingCoding => Boolean(coding.code && coding.system));
      if (fhir.observationExtract === true && codings.length > 0) {
        note("fhirConfig.observationExtract");
        if (!observationWrite) {
          const unit = isRecord(fhir.unit) ? nonEmptyString(fhir.unit.code) ?? nonEmptyString(fhir.unit.display) : undefined;
          const loinc = codings.find((coding) => coding.system === BINDING_LOINC_SYSTEM) ?? codings[0];
          const others = codings.filter((coding) => coding !== loinc);
          observationWrite = {
            observation: { code: loinc.code, system: loinc.system, ...(unit ? { unit } : {}), ...(others.length ? { codings: others } : {}) },
            when: "submit",
          };
          writeStore = "fhirConfig.observationExtract";
        }
      }
    }
  }

  const write: BuilderFieldBindingWrite | null = observationWrite || mutation
    ? {
        ...(observationWrite?.concept ? { concept: observationWrite.concept } : {}),
        ...(observationWrite?.observation ? { observation: observationWrite.observation } : {}),
        ...(mutation ? { mutation } : {}),
        when: "submit",
      }
    : null;
  const canonical = canonicalBinding(
    read || write ? { ...(read ? { read } : {}), ...(write ? { write } : {}) } : null,
    catalog,
  );
  const alayaCareKind = stores.includes("alayaCareConfig.demographics") ? "demographics" : stores.includes("alayaCareConfig.vital") ? "vital" : null;
  const binding = applyConcepts(canonical, mappingConcept, alayaCareConcept && alayaCareKind ? { concept: alayaCareConcept, kind: alayaCareKind } : null, catalog);
  return { binding, stores, targetOnly, unknown, readStore, writeStore, mappingConcept };
}

/**
 * Concepts named outside the MOIS stores: an explicit library mapping names
 * the concept of every part (and, alone, binds what its catalog entry
 * defines); an AlayaCare demographics setting names the read's concept and a
 * vital setting the written observation's, where the MOIS stores give none.
 */
function applyConcepts(
  binding: BuilderFieldBinding | null,
  mappingConcept: string | null,
  alayaCare: { concept: string; kind: "demographics" | "vital" } | null,
  catalog: FieldBindingCatalog | null | undefined,
): BuilderFieldBinding | null {
  let read = binding?.read;
  let write = binding?.write;
  const fromCatalog = (concept: string, parts: "read" | "write" | "both") => {
    const entry = catalog?.conceptParts?.(concept) ?? null;
    if (!entry) return;
    if (entry.read && parts !== "write") read = { concept, mode: "initial", presentation: "shown" };
    if (entry.write && parts !== "read") write = { concept, observation: cloneValue(entry.write), when: "submit" };
  };
  if (mappingConcept) {
    if (!read && !write) fromCatalog(mappingConcept, "both");
    else {
      if (read && read.concept !== mappingConcept) {
        const { variant: _variant, ...rest } = read;
        read = { ...rest, concept: mappingConcept };
      }
      if (write?.observation) write = { ...write, concept: mappingConcept };
    }
  } else if (alayaCare) {
    if (alayaCare.kind === "demographics") {
      if (read && !read.concept) read = { ...read, concept: alayaCare.concept };
      else if (!read && !write) read = { concept: alayaCare.concept, mode: "initial", presentation: "shown" };
    } else if (write?.observation && !write.concept) {
      write = { ...write, concept: alayaCare.concept };
    } else if (!read && !write) {
      fromCatalog(alayaCare.concept, "write");
    }
  }
  return canonicalBinding(read || write ? { ...(read ? { read } : {}), ...(write ? { write } : {}) } : null, catalog);
}

// ---------------------------------------------------------------------------
// What each shape's legacy stores can say (for reconciling a stored binding)
// ---------------------------------------------------------------------------

function readFingerprint(read: BuilderFieldBindingRead | undefined, shape: FieldBindingShape, catalog: FieldBindingCatalog | null | undefined): string | null {
  if (!read) return null;
  if (shape === "layoutCellField") return null;
  const paths = moisReadPathsOf(read, catalog);
  if (shape === "tableColumn") return paths.length ? stableJson({ path: paths[0] }) : null;
  if (shape === "layoutCell") {
    if (!paths.length || read.mode === "none") return null;
    return stableJson({ paths, mode: read.mode, fallback: read.fallback ?? null, format: read.format ?? null });
  }
  const query = read.query ? { query: read.query, observation: { code: read.observation?.code, system: read.observation?.system, unit: read.observation?.unit ?? null } } : null;
  if (!paths.length && !query) return null;
  const moisCode = moisObservationCodeOf(read.observation);
  // A read that fills nothing is only a history display, which a MOIS past measurement holds.
  if (read.mode === "none") return moisCode && read.history ? stableJson({ history: moisCode }) : null;
  return stableJson({
    paths,
    ...(query ?? {}),
    mode: read.mode,
    presentation: read.presentation,
    fallback: read.fallback ?? null,
    format: read.format ?? null,
    transform: read.transform ?? null,
    history: read.history === true,
  });
}

function observationWriteFingerprint(write: BuilderFieldBindingWrite | undefined, shape: FieldBindingShape): string | null {
  const observation = write?.observation;
  if (!observation || shape === "tableColumn") return null;
  const moisCode = moisObservationCodeOf(observation);
  if (!moisCode) return null;
  return stableJson({ moisCode, unit: observation.unit ?? null, valueType: observation.valueType ?? null });
}

function mutationFingerprint(write: BuilderFieldBindingWrite | undefined, shape: FieldBindingShape): string | null {
  if (!write?.mutation || shape !== "field") return null;
  return stableJson(write.mutation);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * The binding a field-like object describes, with where it came from, the
 * product-only settings it leaves in their product, and any store shape this
 * reader does not know. See the table at the top of this file.
 */
export function readFieldBindingDetails(fieldLike: unknown, options: FieldBindingOptions = {}): FieldBindingReading {
  if (!isRecord(fieldLike)) return { binding: null, stores: [], targetOnly: [], unknown: [] };
  const shape = options.shape ?? inferFieldBindingShape(fieldLike);
  const catalog = options.catalog ?? null;
  const legacy = readLegacy(fieldLike, shape, catalog);
  const unknown = [...legacy.unknown];
  const storedRaw = fieldLike.binding;
  if (storedRaw !== undefined && storedRaw !== null && !isRecord(storedRaw)) unknown.push(`binding:${typeof storedRaw}`);
  const stored = canonicalBinding(normalizeBindingWith(storedRaw, unknown), catalog);
  if (!stored) {
    return { binding: legacy.binding, stores: legacy.stores, targetOnly: legacy.targetOnly, unknown };
  }

  // Per part: the stored binding stands while the legacy stores still say what
  // it would have mirrored; otherwise the legacy store is the newer edit.
  const legacyBinding = legacy.binding;
  const conceptDisagrees = (storedConcept: string | undefined, legacyConcept: string | undefined) =>
    Boolean(legacyConcept && storedConcept !== legacyConcept);
  const readFromStored =
    readFingerprint(stored.read, shape, catalog) === readFingerprint(legacyBinding?.read, shape, catalog)
    && !conceptDisagrees(stored.read?.concept, legacyBinding?.read?.concept);
  const observationFromStored =
    observationWriteFingerprint(stored.write, shape) === observationWriteFingerprint(legacyBinding?.write, shape)
    && !conceptDisagrees(stored.write?.concept, legacyBinding?.write?.concept);
  const mutationFromStored = mutationFingerprint(stored.write, shape) === mutationFingerprint(legacyBinding?.write, shape);

  const read = readFromStored ? stored.read : legacyBinding?.read;
  const observationSide = observationFromStored ? stored.write : legacyBinding?.write;
  const mutationSide = mutationFromStored ? stored.write : legacyBinding?.write;
  // The reading's date has no legacy store: it stays with the observation
  // even when a legacy store's newer edit supplies the observation itself.
  const effective = observationSide?.observation ? stored.write?.effective : undefined;
  const write: BuilderFieldBindingWrite | undefined = observationSide?.observation || mutationSide?.mutation
    ? {
        ...(observationSide?.observation && observationSide.concept ? { concept: observationSide.concept } : {}),
        ...(observationSide?.observation ? { observation: observationSide.observation } : {}),
        ...(mutationSide?.mutation ? { mutation: mutationSide.mutation } : {}),
        when: (observationFromStored || mutationFromStored ? stored.write?.when : undefined) ?? "submit",
        ...(effective ? { effective } : {}),
      }
    : undefined;
  const binding = read || write ? cloneValue({ ...(read ? { read } : {}), ...(write ? { write } : {}) }) : null;
  return {
    binding,
    stores: ["binding", ...legacy.stores],
    targetOnly: legacy.targetOnly,
    unknown,
  };
}

/** The binding a field-like object describes (see readFieldBindingDetails); null when it binds nothing. */
export function readFieldBinding(fieldLike: unknown, options: FieldBindingOptions = {}): BuilderFieldBinding | null {
  return readFieldBindingDetails(fieldLike, options).binding;
}

// ---------------------------------------------------------------------------
// Which targets write an observation
// ---------------------------------------------------------------------------

/** Targets that choose whether to write a binding's observation (a Cerner DTA always charts itself). */
export type ObservationWriteTarget = "mois" | "alayacare" | "fhir";

/** Stores that link an observation write for every target: Save as observation and a past measurement. */
const WRITE_STORES_FOR_EVERY_TARGET: readonly FieldBindingStore[] = ["moisOutput", "measurementConfig.write"];

/** Each target's own setting for an observation write. */
const OWN_WRITE_STORES: Record<ObservationWriteTarget, readonly FieldBindingStore[]> = {
  mois: [],
  // The binding library is where AlayaCare's vital and demographics types come from.
  alayacare: ["alayaCareConfig.vital", "crossPlatformMappingId"],
  fhir: ["fhirConfig.observationExtract"],
};

/** Stores of one product (or of the binding library alone) that can name an observation write. */
export const PRODUCT_WRITE_STORES: readonly FieldBindingStore[] = [
  "cernerConfig.dta",
  "fhirConfig.observationExtract",
  "alayaCareConfig.vital",
  "crossPlatformMappingId",
];

export interface ObservationWriteLink {
  /** The target writes the observation to the chart. */
  linked: boolean;
  /** When it does not: the other products' stores the observation is known from. */
  knownFrom: FieldBindingStore[];
}

/**
 * Whether a target writes the observation a binding names (chart-bindings.md,
 * "Which targets write"). Writing changes the patient's chart, so a target
 * writes it only when the form links it for that target or for every target:
 * Save as observation (`moisOutput`), a past measurement, the target's own
 * setting (an AlayaCare vital or library concept, FHIR extraction), or a
 * stored binding with no other product's store behind it. An observation known
 * only from another product's settings (a Cerner DTA through the reviewed
 * crosswalk, a FHIR import's extraction flag, an AlayaCare vital, a library
 * concept whose MOIS output was switched off) stays with the form, and each
 * target's Export review lists it as `<target>.binding.observation-not-linked`;
 * Save as observation links it for all of them at once.
 *
 * `stores` is `FieldBindingReading.stores` of a binding that writes an observation.
 */
export function observationWriteLinkFor(stores: readonly FieldBindingStore[], target: ObservationWriteTarget): ObservationWriteLink {
  const own = OWN_WRITE_STORES[target];
  if (stores.some((store) => WRITE_STORES_FOR_EVERY_TARGET.includes(store) || own.includes(store))) {
    return { linked: true, knownFrom: [] };
  }
  const knownFrom = PRODUCT_WRITE_STORES.filter((store) => !own.includes(store) && stores.includes(store));
  if (knownFrom.length === 0 && stores.includes("binding")) return { linked: true, knownFrom: [] };
  return { linked: false, knownFrom };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

function sameUnlessBothAbsent(left: unknown, right: unknown) {
  return stableJson(left ?? null) === stableJson(right ?? null);
}

function mirrorSourceConfig(
  read: BuilderFieldBindingRead,
  paths: string[],
  existing: unknown,
  catalog: FieldBindingCatalog | null | undefined,
): AnyRecord {
  const base: AnyRecord = isRecord(existing) ? { ...existing } : {};
  if (read.query && read.observation) {
    const existingQuery = isRecord(base.chartQuery) ? base.chartQuery : null;
    const chartQuery: AnyRecord = {
      kind: "Observation",
      system: read.observation.system ?? BINDING_MOIS_OBSERVATION_SYSTEM,
      code: read.observation.code,
      unit: read.observation.unit ?? "",
      ...(read.query.unitSystem ? { unitSystem: read.query.unitSystem } : {}),
      encounter: read.query.encounter ?? "any",
      ...(read.query.lookBackDays !== undefined ? { lookBackDays: read.query.lookBackDays } : {}),
      ...(read.query.statuses ? { statuses: [...read.query.statuses] } : {}),
      ...(read.query.specimen ? { specimen: { ...read.query.specimen } } : {}),
    };
    const unchanged = existingQuery && stableJson(existingQuery) === stableJson(chartQuery);
    base.chartQuery = unchanged ? existingQuery : chartQuery;
    const derived = catalog?.queryPath?.(chartQuery as unknown as BuilderChartQuery);
    base.paths = unchanged && Array.isArray(base.paths) ? base.paths : derived ? [derived] : [];
  } else {
    base.paths = [...paths];
    delete base.chartQuery;
  }
  if (!(base.mode === undefined && read.mode === "initial")) base.mode = read.mode === "sync" ? "sync" : "initial";
  if (read.presentation === "backing") base.presentation = "backing";
  else if (base.presentation !== undefined) base.presentation = "editable";
  if (read.fallback !== undefined) base.fallback = read.fallback;
  else if (base.fallback !== undefined) base.fallback = null;
  const existingFormat = nonEmptyString(base.format);
  const normalizedExisting = existingFormat === "datetime" ? "dateTime" : existingFormat;
  if (read.format) {
    if (normalizedExisting !== read.format) base.format = read.format;
  } else delete base.format;
  if (read.transform) base.valueTransform = read.transform;
  else delete base.valueTransform;
  return base;
}

function applyReadMirror(
  out: AnyRecord,
  original: AnyRecord,
  read: BuilderFieldBindingRead | undefined,
  shape: FieldBindingShape,
  legacy: LegacyReading,
  catalog: FieldBindingCatalog | null | undefined,
) {
  const paths = read ? moisReadPathsOf(read, catalog) : [];
  if (shape === "field") {
    const measurementHolds = legacy.readStore === "measurementConfig.read" && isRecord(original.measurementConfig);
    const measurementCode = measurementHolds ? nonEmptyString((original.measurementConfig as AnyRecord).observationCode) : undefined;
    if (measurementHolds && (!read || (!read.paths?.length && !read.query && moisObservationCodeOf(read.observation) === measurementCode))) {
      const config: AnyRecord = { ...(original.measurementConfig as AnyRecord) };
      const fills = read?.mode === "initial";
      if (fills) config.autoFillFromHistory = true;
      else if (config.autoFillFromHistory !== undefined) config.autoFillFromHistory = false;
      if (fills && config.bringForward === false) delete config.bringForward;
      config.showHistory = read?.history === true;
      out.measurementConfig = config;
      return;
    }
    const mirrorable = Boolean(read) && read!.mode !== "none" && (paths.length > 0 || Boolean(read!.query));
    if (mirrorable) out.sourceConfig = mirrorSourceConfig(read!, paths, original.sourceConfig, catalog);
    else if (isRecord(original.sourceConfig)) out.sourceConfig = null;
    return;
  }
  if (shape === "tableColumn") {
    if (paths.length) out.moisTargetId = paths[0];
    else delete out.moisTargetId;
    return;
  }
  if (shape === "layoutCell") {
    if (!read || !paths.length || read.mode === "none") {
      if (!isClockDefaultCell(original)) {
        delete out.sourcePath;
        delete out.sourcePaths;
        delete out.sourceMode;
        delete out.sourceFallback;
        delete out.sourceFormat;
      }
      return;
    }
    delete out.sourcePath;
    out.sourcePaths = [...paths];
    if (read.mode === "initial") out.sourceMode = "initial";
    else if (original.sourceMode !== undefined) out.sourceMode = "live";
    else delete out.sourceMode;
    const currentFallback = original.sourceFallback ?? original.defaultValue;
    if (read.fallback !== undefined) {
      if (!(original.sourceFallback === undefined && currentFallback === read.fallback)) out.sourceFallback = read.fallback;
    } else {
      delete out.sourceFallback;
    }
    if (read.format) out.sourceFormat = read.format;
    else delete out.sourceFormat;
  }
}

function applyObservationMirror(
  out: AnyRecord,
  original: AnyRecord,
  write: BuilderFieldBindingWrite | undefined,
  shape: FieldBindingShape,
  legacy: LegacyReading,
  options: WriteFieldBindingOptions,
) {
  if (shape === "tableColumn") return;
  const observation = write?.observation;
  const moisCode = moisObservationCodeOf(observation);
  const measurement = shape === "field" && isRecord(original.measurementConfig) ? (original.measurementConfig as AnyRecord) : null;
  const measurementCode = measurement ? nonEmptyString(measurement.observationCode) : undefined;
  const useMeasurement = Boolean(measurement)
    && (legacy.writeStore === "measurementConfig.write" || (legacy.writeStore === null && options.writeStore === "measurementConfig"))
    && (!observation || moisCode === measurementCode);
  if (useMeasurement) {
    const config: AnyRecord = { ...measurement! };
    config.persistenceMode = observation ? "observationAndForm" : "formOnly";
    if (observation?.unit && observation.unit !== nonEmptyString(config.saveUnits)) config.saveUnits = observation.unit;
    if (observation?.valueType && observation.valueType !== "VALUESET" && observation.valueType !== normalizeValueType(config.valueType)) config.valueType = observation.valueType;
    out.measurementConfig = config;
    return;
  }
  const existing = isRecord(original.moisOutput) ? (original.moisOutput as AnyRecord) : null;
  if (!observation || !moisCode) {
    // Nothing MOIS can write: switch the field's own output off, keeping its settings.
    if (existing && existing.kind !== "documentComment" && existing.enabled !== false && nonEmptyString(existing.observationCode)) {
      out.moisOutput = { ...existing, enabled: false };
    }
    if (legacy.writeStore === "measurementConfig.write" && measurement) {
      out.measurementConfig = { ...measurement, persistenceMode: "formOnly" };
    }
    return;
  }
  const next: AnyRecord = existing && existing.kind !== "documentComment" ? { ...existing } : { kind: "observation" };
  const codeChanged = nonEmptyString(next.observationCode) !== moisCode;
  next.enabled = true;
  if (next.kind === undefined && !nonEmptyString(existing?.observationCode)) next.kind = "observation";
  next.observationCode = moisCode;
  const loinc = observationCodeIn(observation, BINDING_LOINC_SYSTEM);
  if (loinc) next.loincCode = loinc;
  else delete next.loincCode;
  if (observation.unit) next.units = observation.unit;
  else delete next.units;
  if (observation.valueType && normalizeValueType(next.valueType) !== observation.valueType) next.valueType = observation.valueType;
  if (codeChanged) {
    delete next.dictionaryMetadata;
    delete next.labCode;
    delete next.status;
  }
  out.moisOutput = next;
  // A past measurement that also wrote the observation hands the write over.
  if (legacy.writeStore === "measurementConfig.write" && measurement) {
    out.measurementConfig = { ...measurement, persistenceMode: "formOnly" };
  }
}

function applyMutationMirror(out: AnyRecord, original: AnyRecord, write: BuilderFieldBindingWrite | undefined, shape: FieldBindingShape) {
  if (shape !== "field") return;
  const existing = isRecord(original.moisConfig) ? { ...(original.moisConfig as AnyRecord) } : null;
  const mutation = write?.mutation;
  if (mutation) {
    const config: AnyRecord = existing ?? {};
    config.writeBinding = { targetId: mutation.id, payloadField: mutation.payloadField, contextIdPath: mutation.contextIdPath ?? null };
    out.moisConfig = config;
    return;
  }
  if (!existing) return;
  delete existing.writeBinding;
  out.moisConfig = Object.values(existing).some((value) => value !== undefined && value !== null) ? existing : null;
}

/**
 * A copy of `fieldLike` with `binding` stored and every part that changed
 * written into the store that holds it (or the mirror exporters read: see
 * the file comment). Parts that did not change leave their stores untouched,
 * so writing back what `readFieldBinding` returned changes only `binding`.
 * A null binding clears the field's bindings. Changing the concept away from
 * a library mapping (`crossPlatformMappingId`) unlinks it.
 */
export function writeFieldBinding<T extends object>(
  fieldLike: T,
  binding: BuilderFieldBinding | null | undefined,
  options: WriteFieldBindingOptions = {},
): T {
  const original = fieldLike as unknown as AnyRecord;
  const shape = options.shape ?? inferFieldBindingShape(original);
  const catalog = options.catalog ?? null;
  const next = canonicalBinding(normalizeFieldBinding(binding), catalog);
  const legacy = readLegacy(original, shape, catalog);
  const current = legacy.binding;
  const out: AnyRecord = { ...original };

  if (
    readFingerprint(next?.read, shape, catalog) !== readFingerprint(current?.read, shape, catalog)
    || (!next?.read && current?.read && legacy.readStore !== null)
  ) {
    applyReadMirror(out, original, next?.read, shape, legacy, catalog);
  }
  if (
    observationWriteFingerprint(next?.write, shape) !== observationWriteFingerprint(current?.write, shape)
    || (!next?.write?.observation && current?.write?.observation && (legacy.writeStore === "moisOutput" || legacy.writeStore === "measurementConfig.write"))
  ) {
    applyObservationMirror(out, original, next?.write, shape, legacy, options);
  }
  if (mutationFingerprint(next?.write, shape) !== mutationFingerprint(current?.write, shape)) {
    applyMutationMirror(out, original, next?.write, shape);
  }

  if (legacy.mappingConcept) {
    const concepts = [next?.read?.concept, next?.write?.concept];
    if (!concepts.includes(legacy.mappingConcept)) out.crossPlatformMappingId = null;
  }

  if (next) out.binding = next;
  else delete out.binding;
  return out as unknown as T;
}

/**
 * The same write as a patch of changed keys, for editors that merge patches
 * (`{ ...field, ...patch }`). A removed `binding`, `sourceConfig`,
 * `moisOutput` or `moisConfig` is null; other removed keys are undefined.
 */
export function fieldBindingPatch<T extends object>(
  fieldLike: T,
  binding: BuilderFieldBinding | null | undefined,
  options: WriteFieldBindingOptions = {},
): Partial<T> {
  const before = fieldLike as unknown as AnyRecord;
  const after = writeFieldBinding(fieldLike, binding, options) as unknown as AnyRecord;
  const patch: AnyRecord = {};
  const keys = Object.keys(before).concat(Object.keys(after).filter((key) => !hasOwn(before, key)));
  for (const key of keys) {
    if (sameUnlessBothAbsent(before[key], after[key]) && hasOwn(before, key) === hasOwn(after, key)) continue;
    if (hasOwn(after, key)) patch[key] = after[key];
    else patch[key] = ["binding", "sourceConfig", "moisOutput", "moisConfig"].includes(key) ? null : undefined;
  }
  return patch as Partial<T>;
}

/** Every concept a binding names (read first), without repeats. */
export function fieldBindingConcepts(binding: BuilderFieldBinding | null | undefined): string[] {
  return uniqueStrings([binding?.read?.concept, binding?.write?.concept]);
}
