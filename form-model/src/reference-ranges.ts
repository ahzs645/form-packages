import type { BuilderField } from "./index";

/**
 * Reference ranges: what a numeric answer is expected to be, by patient
 * (docs/.../architecture/reference-ranges.md).
 *
 * A field's ranges are a list of bands. Each band applies to the patients it
 * names (sex, an age span, gestational age) and sets up to three limit pairs
 * in one unit:
 *
 * - `normal`: outside it the result is low or high (interpretation);
 * - `critical`: outside it the result is critically low or high;
 * - `feasible`: outside it the value is probably a mistake. A feasible range
 *   questions a value, it never refuses it (validation, as Cerner's feasible
 *   range and MOIS's absurd range do).
 *
 * and, for laboratory results, `analytical` limits (Cerner's linear range):
 * what the method can measure. A lab flags a result outside them as
 * nonlinear and may show it as `<low` or `>high`; it is not a form
 * validation rule.
 *
 * A band can also name a `context` beyond the patient: the service resource
 * that performs the test, the specimen type or the encounter type. These are
 * not patient conditions; a band with a context applies only where the caller
 * states a matching one.
 *
 * Stored once as `field.referenceRanges`. The reader also takes the ranges a
 * target stored before this existed: a Cerner DTA's reference range table
 * (`cernerConfig.dta.definition`: `range` and `bands`) and a MOIS observation
 * output's normal and absurd ranges (`moisOutput.rangeNormalLow` …).
 */

export type ReferenceRangeAgeUnit = "minutes" | "hours" | "days" | "weeks" | "months" | "years";
export type ReferenceRangeSex = "female" | "male" | "undifferentiated";

export interface ReferenceRangeLimits {
  low?: number;
  high?: number;
}

export interface ReferenceRangeBand {
  /** Applies to one sex only; absent applies to every patient. */
  sex?: ReferenceRangeSex;
  /** The age span it applies to, from inclusive to exclusive; absent bounds are open. */
  ageFrom?: { value: number; unit: ReferenceRangeAgeUnit };
  ageTo?: { value: number; unit: ReferenceRangeAgeUnit };
  /** Ages count from the gestational start (a neonatal band). */
  gestational?: boolean;
  /** The unit the limits are in, as the source spells it. */
  unit?: string;
  normal?: ReferenceRangeLimits;
  critical?: ReferenceRangeLimits;
  feasible?: ReferenceRangeLimits;
  /** What the laboratory method can measure (Cerner's linear range); not a validation rule. */
  analytical?: ReferenceRangeLimits;
  /** Applies only in this context; absent applies in every one. */
  context?: ReferenceRangeContext;
}

/**
 * Where a band applies beyond the patient, by display name: the performing
 * service resource (a lab or instrument), the specimen type, the encounter
 * type. How PowerChart ranks an encounter-type row is undocumented.
 */
export interface ReferenceRangeContext {
  performer?: string;
  specimenType?: string;
  encounterType?: string;
}

const CONTEXT_KEYS = ["performer", "specimenType", "encounterType"] as const;

export type ReferenceRangeSource = "field" | "cerner-dta" | "mois-output";

export interface ReferenceRangeReading {
  bands: ReferenceRangeBand[];
  /** Where the bands came from; null when the field has none. */
  source: ReferenceRangeSource | null;
}

/** The patient a band is chosen for. */
export interface ReferenceRangePatient {
  sex?: string | null;
  /** ISO date (YYYY-MM-DD). */
  birthDate?: string | null;
  /** When the result applies (ISO date or date-time); defaults to now. */
  asOf?: string | null;
  /** Gestational age in days at `asOf`, for gestational bands. */
  gestationalAgeDays?: number | null;
  /** The performer, specimen and encounter the result is for, for bands with a context. */
  context?: ReferenceRangeContext | null;
}

const finite = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
};

function limits(low: unknown, high: unknown): ReferenceRangeLimits | undefined {
  const out: ReferenceRangeLimits = {};
  const l = finite(low);
  const h = finite(high);
  if (l !== undefined) out.low = l;
  if (h !== undefined) out.high = h;
  return out.low === undefined && out.high === undefined ? undefined : out;
}

const AGE_UNITS: Record<string, ReferenceRangeAgeUnit> = {
  MINUTES: "minutes", HOURS: "hours", DAYS: "days", WEEKS: "weeks", MONTHS: "months", YEARS: "years",
};

function sexOf(value: unknown): ReferenceRangeSex | undefined {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (key.startsWith("f")) return "female";
  if (key.startsWith("m")) return "male";
  if (key.startsWith("u")) return "undifferentiated";
  return undefined;
}

function contextOf(parts: Record<string, unknown> | null | undefined): ReferenceRangeContext | undefined {
  if (!parts) return undefined;
  const out: ReferenceRangeContext = {};
  for (const key of CONTEXT_KEYS) {
    const value = parts[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function band(parts: Omit<ReferenceRangeBand, "normal" | "critical" | "feasible"> & Pick<ReferenceRangeBand, "normal" | "critical" | "feasible">): ReferenceRangeBand | null {
  if (!parts.normal && !parts.critical && !parts.feasible && !parts.analytical) return null;
  const out: ReferenceRangeBand = {};
  for (const key of ["sex", "ageFrom", "ageTo", "gestational", "unit", "normal", "critical", "feasible", "analytical", "context"] as const) {
    if (parts[key] !== undefined && parts[key] !== "" && parts[key] !== false) (out as Record<string, unknown>)[key] = parts[key];
  }
  return out;
}

type CernerLimits = {
  units?: string; normalLow?: number; normalHigh?: number; criticalLow?: number; criticalHigh?: number; feasibleLow?: number; feasibleHigh?: number;
  linearLow?: number; linearHigh?: number; serviceResource?: string; specimenType?: string; encounterType?: string;
};
type CernerBand = CernerLimits & { sex?: string; gestational?: boolean; ageFrom?: number; ageFromUnits?: string; ageTo?: number; ageToUnits?: string };

function fromCerner(entry: CernerBand, allPatients: boolean): ReferenceRangeBand | null {
  const from = finite(entry.ageFrom);
  const to = finite(entry.ageTo);
  return band({
    ...(allPatients ? {} : {
      sex: sexOf(entry.sex),
      // Cerner writes 0 years to 150 years for "every age".
      ...(from !== undefined && from > 0 ? { ageFrom: { value: from, unit: AGE_UNITS[entry.ageFromUnits ?? "YEARS"] ?? "years" } } : {}),
      ...(to !== undefined && !(to >= 150 && (entry.ageToUnits ?? "YEARS") === "YEARS") ? { ageTo: { value: to, unit: AGE_UNITS[entry.ageToUnits ?? "YEARS"] ?? "years" } } : {}),
      gestational: entry.gestational || undefined,
    }),
    unit: entry.units?.trim() || undefined,
    normal: limits(entry.normalLow, entry.normalHigh),
    critical: limits(entry.criticalLow, entry.criticalHigh),
    feasible: limits(entry.feasibleLow, entry.feasibleHigh),
    analytical: limits(entry.linearLow, entry.linearHigh),
    context: contextOf({ performer: entry.serviceResource, specimenType: entry.specimenType, encounterType: entry.encounterType }),
  });
}

/** Normalises a stored band list, dropping bands with no limits. */
function storedBands(value: unknown): ReferenceRangeBand[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const age = (part: unknown) => {
      if (!part || typeof part !== "object") return undefined;
      const { value: amount, unit } = part as { value?: unknown; unit?: unknown };
      const n = finite(amount);
      return n !== undefined && typeof unit === "string" && Object.values(AGE_UNITS).includes(unit as ReferenceRangeAgeUnit) ? { value: n, unit: unit as ReferenceRangeAgeUnit } : undefined;
    };
    const pair = (part: unknown) => (part && typeof part === "object" ? limits((part as ReferenceRangeLimits).low, (part as ReferenceRangeLimits).high) : undefined);
    const result = band({
      sex: sexOf(raw.sex),
      ageFrom: age(raw.ageFrom),
      ageTo: age(raw.ageTo),
      gestational: raw.gestational === true || undefined,
      unit: typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : undefined,
      normal: pair(raw.normal),
      critical: pair(raw.critical),
      feasible: pair(raw.feasible),
      analytical: pair(raw.analytical),
      context: raw.context && typeof raw.context === "object" ? contextOf(raw.context as Record<string, unknown>) : undefined,
    });
    return result ? [result] : [];
  });
}

/**
 * A field's reference ranges, from the first store that has any: the neutral
 * `referenceRanges`; a Cerner DTA definition (the all-patient band, then the
 * bands by sex, gestation or age); a MOIS observation output's normal and
 * absurd ranges. Pass a Cerner definition read from the DTA record when the
 * field keeps only the record (lib/reference-ranges.ts does).
 */
export function readReferenceRanges(
  field: Partial<Pick<BuilderField, "referenceRanges" | "cernerConfig" | "moisOutput">>,
  options: { cernerDefinition?: { range?: CernerLimits | null; bands?: CernerBand[] | null; bandsOnly?: boolean } | null } = {},
): ReferenceRangeReading {
  const own = storedBands(field.referenceRanges);
  if (own.length) return { bands: own, source: "field" };

  const definition = options.cernerDefinition ?? (field.cernerConfig?.dta?.definition as { range?: CernerLimits | null; bands?: CernerBand[] | null; bandsOnly?: boolean } | undefined);
  if (definition) {
    const bands = [
      ...(definition.range && !definition.bandsOnly ? [fromCerner(definition.range, true)] : []),
      ...(definition.bands ?? []).map((entry) => fromCerner(entry, false)),
    ].filter((entry): entry is ReferenceRangeBand => Boolean(entry));
    if (bands.length) return { bands, source: "cerner-dta" };
  }

  const output = field.moisOutput as { rangeNormalLow?: unknown; rangeNormalHigh?: unknown; rangeAbsurdLow?: unknown; rangeAbsurdHigh?: unknown; units?: unknown } | undefined;
  if (output) {
    const mois = band({
      unit: typeof output.units === "string" && output.units.trim() ? output.units.trim() : undefined,
      normal: limits(output.rangeNormalLow, output.rangeNormalHigh),
      feasible: limits(output.rangeAbsurdLow, output.rangeAbsurdHigh),
    });
    if (mois) return { bands: [mois], source: "mois-output" };
  }
  return { bands: [], source: null };
}

/** Whether a band names no patient and no context: it applies to everyone, everywhere. */
export function isAllPatientBand(entry: ReferenceRangeBand): boolean {
  return !entry.sex && !entry.ageFrom && !entry.ageTo && !entry.gestational && !entry.context;
}

/** Whether a band's context matches the caller's; undefined when the caller does not state one the band names. */
function contextApplies(entry: ReferenceRangeBand, context: ReferenceRangeContext | null | undefined): boolean | undefined {
  if (!entry.context) return true;
  for (const key of CONTEXT_KEYS) {
    const wanted = entry.context[key];
    if (!wanted) continue;
    const stated = context?.[key]?.trim();
    if (!stated) return undefined;
    if (stated.toLowerCase() !== wanted.toLowerCase()) return false;
  }
  return true;
}

const MINUTE = 60_000;

function addAge(start: Date, amount: number, unit: ReferenceRangeAgeUnit): Date {
  const date = new Date(start.getTime());
  switch (unit) {
    case "minutes": return new Date(date.getTime() + amount * MINUTE);
    case "hours": return new Date(date.getTime() + amount * 60 * MINUTE);
    case "days": return new Date(date.getTime() + amount * 1440 * MINUTE);
    case "weeks": return new Date(date.getTime() + amount * 7 * 1440 * MINUTE);
    case "months": date.setUTCMonth(date.getUTCMonth() + amount); return date;
    case "years": date.setUTCFullYear(date.getUTCFullYear() + amount); return date;
  }
}

const isoDate = (value: string | null | undefined): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isFinite(date.getTime()) ? date : undefined;
};

/** Whether a band applies to a patient; undefined when the patient lacks what the band needs. */
export function bandAppliesTo(entry: ReferenceRangeBand, patient: ReferenceRangePatient | null | undefined): boolean | undefined {
  if (isAllPatientBand(entry)) return true;
  const inContext = contextApplies(entry, patient?.context);
  if (inContext === false) return false;
  if (inContext === undefined) return undefined;
  if (entry.sex) {
    const sex = sexOf(patient?.sex);
    if (!sex) return undefined;
    if (sex !== entry.sex) return false;
  }
  if (!entry.ageFrom && !entry.ageTo && !entry.gestational) return true;
  const at = isoDate(patient?.asOf) ?? new Date();
  let start = isoDate(patient?.birthDate);
  if (entry.gestational) {
    const days = patient?.gestationalAgeDays;
    if (days === null || days === undefined || !Number.isFinite(days)) return undefined;
    start = new Date(at.getTime() - days * 1440 * MINUTE);
  }
  if (!start) return undefined;
  if (entry.ageFrom && at < addAge(start, entry.ageFrom.value, entry.ageFrom.unit)) return false;
  if (entry.ageTo && at >= addAge(start, entry.ageTo.value, entry.ageTo.unit)) return false;
  return true;
}

export interface ReferenceRangeSelection {
  status: "matched" | "no-match" | "needs-patient" | "needs-context" | "ambiguous" | "none";
  band?: ReferenceRangeBand;
}

/**
 * The band for a patient: the most specific band that applies (a band by sex
 * or age before the all-patient one). `needs-patient` when a band might apply
 * but the patient lacks its sex, birth date or gestational age;
 * `needs-context` when only bands for a performer, specimen or encounter the
 * caller did not state might apply; `ambiguous` when two equally specific
 * bands with different limits apply.
 */
export function selectReferenceRange(bands: readonly ReferenceRangeBand[], patient?: ReferenceRangePatient | null): ReferenceRangeSelection {
  if (!bands.length) return { status: "none" };
  const specific = bands.filter((entry) => !isAllPatientBand(entry));
  const applying = specific.filter((entry) => bandAppliesTo(entry, patient) === true);
  const unknown = specific.filter((entry) => bandAppliesTo(entry, patient) === undefined);
  if (applying.length) {
    const distinct = new Set(applying.map((entry) => JSON.stringify([entry.unit, entry.normal, entry.critical, entry.feasible, entry.analytical])));
    return distinct.size === 1 ? { status: "matched", band: applying[0] } : { status: "ambiguous" };
  }
  const general = bands.find(isAllPatientBand);
  if (general) return { status: "matched", band: general };
  if (!unknown.length) return { status: "no-match" };
  return { status: unknown.some((entry) => contextApplies(entry, patient?.context) !== undefined) ? "needs-patient" : "needs-context" };
}

export type ReferenceRangeFlag = "critical-low" | "low" | "normal" | "high" | "critical-high";

export interface ReferenceRangeInterpretation {
  /** Against the normal and critical limits; null when the band sets neither. */
  flag: ReferenceRangeFlag | null;
  /** Outside the feasible range: probably a mistake, worth checking (never refused). */
  infeasible: "below" | "above" | null;
  /** Outside the analytical (linear) range: a lab reports it as nonlinear, `<low` or `>high`. */
  nonlinear: "below" | "above" | null;
}

/** What a numeric value means against a band. */
export function interpretReferenceRange(value: number, entry: ReferenceRangeBand): ReferenceRangeInterpretation {
  const below = (limit?: number) => limit !== undefined && value < limit;
  const above = (limit?: number) => limit !== undefined && value > limit;
  let flag: ReferenceRangeFlag | null = null;
  if (below(entry.critical?.low)) flag = "critical-low";
  else if (above(entry.critical?.high)) flag = "critical-high";
  else if (below(entry.normal?.low)) flag = "low";
  else if (above(entry.normal?.high)) flag = "high";
  else if (entry.normal || entry.critical) flag = "normal";
  const infeasible = below(entry.feasible?.low) ? "below" : above(entry.feasible?.high) ? "above" : null;
  const nonlinear = below(entry.analytical?.low) ? "below" : above(entry.analytical?.high) ? "above" : null;
  return { flag, infeasible, nonlinear };
}

/** Plain-language text for an interpretation, or null when there is nothing to say. */
export function describeReferenceRange(value: number, entry: ReferenceRangeBand, interpretation = interpretReferenceRange(value, entry)): string | null {
  const unit = entry.unit ? ` ${entry.unit}` : "";
  if (interpretation.infeasible) {
    const limit = interpretation.infeasible === "below" ? entry.feasible?.low : entry.feasible?.high;
    return `${value}${unit} is ${interpretation.infeasible} the possible range (${interpretation.infeasible === "below" ? "at least" : "at most"} ${limit}${unit}). Check the value.`;
  }
  switch (interpretation.flag) {
    case "critical-low": return `${value}${unit} is critically low (below ${entry.critical!.low}${unit}).`;
    case "critical-high": return `${value}${unit} is critically high (above ${entry.critical!.high}${unit}).`;
    case "low": return `${value}${unit} is below normal (${entry.normal!.low}${unit}).`;
    case "high": return `${value}${unit} is above normal (${entry.normal!.high}${unit}).`;
    default: return null;
  }
}
