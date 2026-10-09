/**
 * OSCAR deployment choices. Clinical intent stays in the neutral binding,
 * formula and workflow readers; these are explicit target overrides only.
 */
export type OscarHostProfileId = "portable" | "juno" | "carlos";

/** A site's destination for an explicitly linked observation write. */
export interface OscarMeasurementMapping {
  fieldId: string;
  /** Exact measurement type configured in the destination OSCAR installation. */
  measurementType: string;
  /** Exact, non-empty measuring instruction; no first-row/default guessing. */
  measuringInstruction: string;
  /** Optional answer whose text accompanies the reading. */
  commentsFieldId?: string;
}

export interface OscarExportSettings {
  version: 1;
  profileId: OscarHostProfileId;
  measurementMappings: OscarMeasurementMapping[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

/**
 * Old forms and unknown profiles stay portable. A persisted claim such as
 * `runtimeVerified: true` has no authority and is not part of this contract.
 * Keep incomplete and duplicate rows so export review can explain them.
 */
export function normalizeOscarExportSettings(value: unknown): OscarExportSettings | undefined {
  if (!record(value) || (value.version !== undefined && value.version !== 1)) {
    return undefined;
  }
  const profileId = value.profileId === "juno" || value.profileId === "carlos" ? value.profileId : "portable";
  const measurementMappings = Array.isArray(value.measurementMappings)
    ? value.measurementMappings.filter(record).map((entry): OscarMeasurementMapping => ({
        fieldId: text(entry.fieldId),
        measurementType: text(entry.measurementType),
        measuringInstruction: text(entry.measuringInstruction),
        ...(text(entry.commentsFieldId) ? { commentsFieldId: text(entry.commentsFieldId) } : {}),
      }))
    : [];
  return { version: 1, profileId, measurementMappings };
}

/** The single reader for a document's OSCAR target override. */
export function readOscarExportSettings(document: { oscarExport?: unknown } | null | undefined): OscarExportSettings {
  return normalizeOscarExportSettings(document?.oscarExport) ?? { version: 1, profileId: "portable", measurementMappings: [] };
}
