/**
 * Chart lists (neutral form model).
 *
 * "The patient's chart list of X, shown on this form": the allergies, the
 * problem list, the medication list, procedure history, social history or
 * family history, read from the patient's chart and, where the target allows,
 * maintained from the form. The list is the chart's own, so the form stores
 * no answer for it; what the author means is only which list, and whether
 * the form is where it is kept up to date.
 *
 * The intent is stored once as `field.chartList`. Older forms and imports say
 * the same thing in product stores, which `readChartList` also reads:
 *
 * | Store | Where | Reads as |
 * | --- | --- | --- |
 * | `chartList` | the field | the list and its access |
 * | a MOIS chart component (`ChartRecordTable` with `source` allergies, conditions or longTermMedications; the older `Allergies`, `AllergyTable`, `Conditions` and `LongTermMedications` wrappers) | `componentKey`, `componentProps.source` | the list, reviewed |
 * | a PowerChart chart control (INPUT_TYPE 11 Allergies; 2, 4, 5, 6 and 8 on the `PFEXTCTRLS` library: problem list, procedure history, family history, medication list, social history; the older type-1 Medication Profile) | `cernerConfig` | the list, maintained |
 *
 * When `chartList` and a MOIS component disagree on which list, the
 * component wins (it was edited by a writer that only knew it), the way an
 * edited legacy binding store wins in bindings.ts. `writeChartList` keeps the
 * MOIS component in step when the field is one.
 *
 * Each target realises the list with its own control or reports the loss
 * (`<target>.chartList.*`): MOIS `ChartRecordTable`, Cerner the PowerChart
 * control, AlayaCare its medical-history or medication field. This module has
 * type imports only.
 */
import type { BuilderCernerConfig, BuilderField } from "./index";

export const CHART_LIST_DOMAINS = ["allergies", "problems", "medications", "procedures", "socialHistory", "familyHistory"] as const;
export type ChartListDomain = (typeof CHART_LIST_DOMAINS)[number];

/**
 * `review`: the form shows the chart's list. `maintain`: the form is also
 * where the list is kept up to date (records added, changed, marked
 * reviewed), as PowerChart's own chart controls are.
 */
export type ChartListAccess = "review" | "maintain";

/** The stored intent (`BuilderField.chartList`). */
export interface BuilderChartList {
  domain: ChartListDomain;
  /** Absent reads as `review`. */
  access?: ChartListAccess;
}

/** The builder's own component key for a chart list; no product runtime draws it directly. */
export const CHART_LIST_COMPONENT = "ChartList";

export interface ChartListDomainInfo {
  /** What the list is called on a form. */
  title: string;
  /** In a sentence: "the patient's …". */
  noun: string;
  /** One line for pickers. */
  description: string;
}

export const CHART_LIST_DOMAIN_INFO: Record<ChartListDomain, ChartListDomainInfo> = {
  allergies: { title: "Allergies", noun: "allergies", description: "Allergies, intolerances and adverse reactions on the patient's chart." },
  problems: { title: "Problem list / diagnoses", noun: "problem list", description: "Active problems and diagnoses on the patient's chart." },
  medications: { title: "Medication list", noun: "medication list", description: "The patient's current and home medications." },
  procedures: { title: "Procedure history", noun: "procedure history", description: "Surgeries and procedures the patient has had." },
  socialHistory: { title: "Social history", noun: "social history", description: "Substance use, living situation, activities of daily living and other social history." },
  familyHistory: { title: "Family history", noun: "family history", description: "Health conditions of the patient's relatives." },
};

export type ChartListStore = "chartList" | "mois-component" | "cerner-control";

export interface NeutralChartList {
  domain: ChartListDomain;
  access: ChartListAccess;
  /** Where the list was read from. */
  store: ChartListStore;
}

export function isChartListDomain(value: unknown): value is ChartListDomain {
  return typeof value === "string" && (CHART_LIST_DOMAINS as readonly string[]).includes(value);
}

// --- MOIS -------------------------------------------------------------------

/**
 * The MOIS full-chart collection holding each list (Mois.Patient.Query
 * fullChartFields in the SMOIS bundle). MOIS has no procedure, social or
 * family history collection.
 */
export const MOIS_CHART_LIST_SOURCES: Partial<Record<ChartListDomain, string>> = {
  allergies: "allergies",
  problems: "conditions",
  medications: "longTermMedications",
};

/** The MOIS component that lists any chart collection (NHForms `ChartRecordTable`). */
export const MOIS_CHART_LIST_COMPONENT = "ChartRecordTable";

/** The older single-collection NHForms wrappers. */
const MOIS_WRAPPER_DOMAINS: Record<string, ChartListDomain> = {
  Allergies: "allergies",
  AllergyTable: "allergies",
  Conditions: "problems",
  LongTermMedications: "medications",
};

function moisComponentDomain(field: Pick<BuilderField, "type" | "componentKey" | "componentProps">): ChartListDomain | null {
  if (field.type !== "component" || !field.componentKey) return null;
  const wrapper = MOIS_WRAPPER_DOMAINS[field.componentKey];
  if (wrapper) return wrapper;
  if (field.componentKey !== MOIS_CHART_LIST_COMPONENT) return null;
  const source = field.componentProps?.source;
  // ChartRecordTable's own default collection is allergies.
  const collection = typeof source === "string" && source.trim() ? source.trim() : "allergies";
  const entry = Object.entries(MOIS_CHART_LIST_SOURCES).find(([, value]) => value === collection);
  return entry ? (entry[0] as ChartListDomain) : null;
}

/** A field MOIS draws with one of its own chart-list components. */
export function isMoisChartListComponent(field: Pick<BuilderField, "type" | "componentKey" | "componentProps">): boolean {
  return moisComponentDomain(field) !== null;
}

// --- Cerner -----------------------------------------------------------------

/** The extension control library PowerChart's chart controls are drawn by. */
export const CERNER_CHART_CONTROL_LIBRARY = "PFEXTCTRLS";

/** What identifies a PowerForm input as one of PowerChart's chart controls. */
export interface CernerChartControlInput {
  type: number;
  /** The input's MODULE leaf; `undefined` when not known (fields imported before it was kept). */
  module?: string;
  description?: string;
  /** The input merges to a DTA (a chart control never does). */
  hasDta?: boolean;
  prefs?: Record<string, string>;
}

/**
 * The list a PowerForm input shows, when it is one of PowerChart's chart
 * controls (T1978A Large Pull, 2026-09-11: 53 type-11 Allergies with no
 * library; on PFEXTCTRLS 75 type-2 Problem List/Diagnosis, 43 type-6
 * Medication List, 37 type-8 Social History, 20 type-4 Procedure History,
 * 8 type-5 Family History and 9 type-1 Medication Profile). Another library
 * on the same type is another control: the two type-2 PVTRACKFORMS inputs
 * are the ED tracking control, with DTAs of their own.
 */
export function cernerChartControlDomain(input: CernerChartControlInput): ChartListDomain | null {
  if (input.hasDta) return null;
  const library = input.module?.trim();
  const onLibrary = library === CERNER_CHART_CONTROL_LIBRARY;
  // A known library other than the chart controls' is another control.
  if (library && !onLibrary) return null;
  const description = (input.description ?? "").trim().toLowerCase();
  switch (input.type) {
    case 11:
      return "allergies";
    case 2:
      return "problems";
    case 5:
      return "familyHistory";
    case 8:
      return "socialHistory";
    // Types 4 and 6 are ordinary alpha lists and typed boxes off the library;
    // a field imported before the library was kept is known by its name.
    case 4:
      return onLibrary || (input.module === undefined && description === "procedure history") ? "procedures" : null;
    case 6:
      return onLibrary || (input.module === undefined && description === "medication list" && Boolean(input.prefs && ("meds_rec" in input.prefs || "meds_orders" in input.prefs)))
        ? "medications"
        : null;
    case 1:
      return onLibrary ? "medications" : null;
    default:
      return null;
  }
}

/** The chart control an imported or exported field's Cerner settings describe, if any. */
export function cernerConfigChartListDomain(config: BuilderCernerConfig | null | undefined): ChartListDomain | null {
  if (!config || config.sourceKind === "iview") return null;
  const hasDta = Boolean(config.dta?.mnemonic) || Boolean(config.modules?.some((entry) => entry.mergeName === "DISCRETE_TASK_ASSAY" && entry.dtaMnemonic));
  // The import keeps only a non-empty library, and fields imported before it
  // was kept have none, so an absent library is unknown rather than empty.
  return cernerChartControlDomain({ type: config.inputType, module: config.inputModule, description: config.inputDescription, hasDta, prefs: config.preferences });
}

// --- Reader and writer ----------------------------------------------------

/** The chart list a field shows, from whichever store says so, or null. */
export function readChartList(field: Pick<BuilderField, "type" | "componentKey" | "componentProps" | "cernerConfig"> & { chartList?: BuilderChartList | null }): NeutralChartList | null {
  const stored = field.chartList && isChartListDomain(field.chartList.domain) ? field.chartList : null;
  const mois = moisComponentDomain(field);
  if (mois) return { domain: mois, access: stored?.access ?? "review", store: stored && stored.domain === mois ? "chartList" : "mois-component" };
  // A MOIS chart table switched to another collection (goals, connections, …) is no longer a chart list.
  if (field.type === "component" && field.componentKey === MOIS_CHART_LIST_COMPONENT) return null;
  if (stored) return { domain: stored.domain, access: stored.access ?? "review", store: "chartList" };
  const cerner = cernerConfigChartListDomain(field.cernerConfig);
  if (cerner) return { domain: cerner, access: "maintain", store: "cerner-control" };
  return null;
}

/**
 * The changes that make a field show `list`: the neutral store, and a MOIS
 * chart component kept in step when the field already is one (switched to
 * the builder's own chart-list component when MOIS has no such collection).
 * Any other field becomes the builder's chart-list component.
 */
export function writeChartList(field: Pick<BuilderField, "type" | "componentKey" | "componentProps">, list: BuilderChartList): Partial<BuilderField> {
  const chartList: BuilderChartList = { domain: list.domain, ...(list.access ? { access: list.access } : {}) };
  const source = MOIS_CHART_LIST_SOURCES[list.domain];
  if (field.type === "component" && field.componentKey === MOIS_CHART_LIST_COMPONENT) {
    const props = { ...(field.componentProps ?? {}) };
    if (source) return { chartList, componentProps: { ...props, source } };
    delete props.source;
    delete props.sourceId;
    return { chartList, componentKey: CHART_LIST_COMPONENT, componentProps: props };
  }
  if (field.type === "component" && field.componentKey && MOIS_WRAPPER_DOMAINS[field.componentKey]) {
    // A wrapper names its collection; another list needs the general table.
    if (MOIS_WRAPPER_DOMAINS[field.componentKey] === list.domain) return { chartList };
    return source
      ? { chartList, componentKey: MOIS_CHART_LIST_COMPONENT, componentProps: { ...(field.componentProps ?? {}), source } }
      : { chartList, componentKey: CHART_LIST_COMPONENT, componentProps: {} };
  }
  return { chartList, type: "component", componentKey: CHART_LIST_COMPONENT, ...(field.type === "component" && field.componentKey === CHART_LIST_COMPONENT ? {} : { componentProps: {} }) };
}

/** A new chart-list field (gallery and palette inserts). */
export function newChartListField(domain: ChartListDomain, access: ChartListAccess = "review"): Omit<BuilderField, "id"> {
  const info = CHART_LIST_DOMAIN_INFO[domain];
  return {
    type: "component",
    label: info.title,
    componentKey: CHART_LIST_COMPONENT,
    componentTitle: info.title,
    componentDescription: info.description,
    componentProps: {},
    chartList: { domain, access },
  };
}
