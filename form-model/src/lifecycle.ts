/**
 * Where a form is in its life: still being written, live in the EMR, or
 * withdrawn — plus the dates a governance review cares about and a log of how
 * it got there.
 *
 * This is deliberately not part of `BuilderMoisIdentityMetadata`. That block is
 * MOIS's own identity contract (author, owner, publisher, the semver triple it
 * ships in a package), whereas a lifecycle is a property of the form itself and
 * every target has its own name for it — FHIR calls the middle state `active`.
 * Keeping it separate means the MOIS block stays a faithful mirror of what MOIS
 * accepts.
 *
 * The author-facing word is "published" rather than FHIR's "active", because an
 * author publishes a form; `toFhirQuestionnaireStatus` does the translation at
 * the boundary.
 */

/** Author-facing lifecycle states. */
export type BuilderFormStatus = "draft" | "published" | "retired";

export const BUILDER_FORM_STATUSES: readonly BuilderFormStatus[] = [
  "draft",
  "published",
  "retired",
] as const;

/**
 * One line of history. Appended when the status changes or a version is
 * stamped; never rewritten, so the list reads as what happened in order.
 */
export interface BuilderFormLifecycleEntry {
  /** ISO 8601 instant the entry was recorded. */
  at: string;
  status: BuilderFormStatus;
  /** The form's version at the time, if one was stamped. */
  version?: string;
  /** Who made the change, when the host knows. */
  by?: string;
  /** The author's own note — what changed and why. */
  note?: string;
}

export interface BuilderFormLifecycle {
  status: BuilderFormStatus;
  /** Date the form was approved for use (FHIR `approvalDate`), as YYYY-MM-DD. */
  approvalDate?: string;
  /** Date it was last reviewed (FHIR `lastReviewDate`), as YYYY-MM-DD. */
  lastReviewDate?: string;
  /** First day the form should be used (FHIR `effectivePeriod.start`). */
  effectiveStart?: string;
  /** Last day the form should be used (FHIR `effectivePeriod.end`). */
  effectiveEnd?: string;
  /** Append-only, oldest first. */
  changeLog?: BuilderFormLifecycleEntry[];
}

/**
 * A form with no lifecycle recorded is a draft, not a published one. Anything
 * that gates on "is this live" has to fail closed, or every legacy document
 * silently counts as approved for clinical use.
 */
export const DEFAULT_BUILDER_FORM_STATUS: BuilderFormStatus = "draft";

export function isBuilderFormStatus(value: unknown): value is BuilderFormStatus {
  return typeof value === "string" && (BUILDER_FORM_STATUSES as readonly string[]).includes(value);
}

/** The status of a document, defaulting an absent or unrecognised one to draft. */
export function resolveBuilderFormStatus(
  lifecycle: BuilderFormLifecycle | null | undefined,
): BuilderFormStatus {
  return isBuilderFormStatus(lifecycle?.status) ? lifecycle.status : DEFAULT_BUILDER_FORM_STATUS;
}

/** Only a published form is live; draft and retired both mean "do not use". */
export function isPublishedForm(lifecycle: BuilderFormLifecycle | null | undefined): boolean {
  return resolveBuilderFormStatus(lifecycle) === "published";
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Keeps YYYY-MM-DD and drops anything else, so a bad value cannot reach FHIR. */
function normalizeDateOnly(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return DATE_ONLY.test(trimmed) ? trimmed : undefined;
}

function normalizeEntry(value: unknown): BuilderFormLifecycleEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (!isBuilderFormStatus(entry.status)) return null;
  const at = typeof entry.at === "string" && entry.at.trim() ? entry.at.trim() : null;
  if (!at) return null;
  return {
    at,
    status: entry.status,
    ...(typeof entry.version === "string" && entry.version.trim() ? { version: entry.version.trim() } : {}),
    ...(typeof entry.by === "string" && entry.by.trim() ? { by: entry.by.trim() } : {}),
    ...(typeof entry.note === "string" && entry.note.trim() ? { note: entry.note.trim() } : {}),
  };
}

/**
 * Coerce whatever a document carries into a lifecycle, dropping values that are
 * not usable rather than passing them on. Returns undefined when there is
 * nothing to keep, so an untouched document stays untouched.
 */
export function normalizeBuilderFormLifecycle(value: unknown): BuilderFormLifecycle | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const changeLog = Array.isArray(source.changeLog)
    ? source.changeLog.map(normalizeEntry).filter((entry): entry is BuilderFormLifecycleEntry => entry !== null)
    : [];

  const lifecycle: BuilderFormLifecycle = {
    status: isBuilderFormStatus(source.status) ? source.status : DEFAULT_BUILDER_FORM_STATUS,
    ...(normalizeDateOnly(source.approvalDate) ? { approvalDate: normalizeDateOnly(source.approvalDate) } : {}),
    ...(normalizeDateOnly(source.lastReviewDate) ? { lastReviewDate: normalizeDateOnly(source.lastReviewDate) } : {}),
    ...(normalizeDateOnly(source.effectiveStart) ? { effectiveStart: normalizeDateOnly(source.effectiveStart) } : {}),
    ...(normalizeDateOnly(source.effectiveEnd) ? { effectiveEnd: normalizeDateOnly(source.effectiveEnd) } : {}),
    ...(changeLog.length > 0 ? { changeLog } : {}),
  };
  return lifecycle;
}

/**
 * Record a transition. Returns a new lifecycle — the caller owns persisting it —
 * with the entry appended rather than replacing what is there.
 */
export function appendLifecycleEntry(
  lifecycle: BuilderFormLifecycle | null | undefined,
  entry: Omit<BuilderFormLifecycleEntry, "at"> & { at?: string },
): BuilderFormLifecycle {
  const base = normalizeBuilderFormLifecycle(lifecycle) ?? { status: DEFAULT_BUILDER_FORM_STATUS };
  const recorded: BuilderFormLifecycleEntry = {
    at: entry.at ?? new Date().toISOString(),
    status: entry.status,
    ...(entry.version ? { version: entry.version } : {}),
    ...(entry.by ? { by: entry.by } : {}),
    ...(entry.note ? { note: entry.note } : {}),
  };
  return {
    ...base,
    status: entry.status,
    changeLog: [...(base.changeLog ?? []), recorded],
  };
}

/** FHIR's Questionnaire.status. Ours differ only in the word for "live". */
export type FhirPublicationStatus = "draft" | "active" | "retired" | "unknown";

export function toFhirQuestionnaireStatus(
  lifecycle: BuilderFormLifecycle | null | undefined,
): FhirPublicationStatus {
  switch (resolveBuilderFormStatus(lifecycle)) {
    case "published":
      return "active";
    case "retired":
      return "retired";
    default:
      return "draft";
  }
}

/**
 * The reverse, for import. FHIR's `unknown` carries no claim that the form is
 * live, so it lands on draft alongside anything unrecognised.
 */
export function fromFhirQuestionnaireStatus(status: unknown): BuilderFormStatus {
  switch (status) {
    case "active":
      return "published";
    case "retired":
      return "retired";
    default:
      return "draft";
  }
}
