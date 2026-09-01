/**
 * FHIR R4 write-side helpers for the SMART/Ignite path.
 *
 * Hydration rules adapted from TopologyHealth/SMARTerFHIR (Apache-2.0):
 * before POSTing, fill in the launch context a resource type requires but the
 * caller left blank — subject, encounter, context, and (Cerner-specific) an
 * author reference, since Cerner rejects authorless document writes.
 *
 * Pure functions, no dependency on any FHIR client; the player passes the
 * hydrated resource to whatever client performs the create.
 */

export const FHIR_JSON_ACCEPT = "application/fhir+json";

export interface FhirReference {
  reference: string;
}

export interface FhirWriteContext {
  patientId?: string;
  encounterId?: string;
  practitionerId?: string;
  /** Clock override for tests; must return an ISO instant. */
  now?: () => string;
}

export interface FhirResourceLike {
  resourceType: string;
  subject?: FhirReference;
  encounter?: FhirReference;
  author?: FhirReference[];
  context?: { encounter: FhirReference[]; period: { start: string; end: string } };
  [key: string]: unknown;
}

const SUBJECT_REQUIRED: Record<string, true> = {
  QuestionnaireResponse: true,
  DocumentReference: true,
  Observation: true,
};

const ENCOUNTER_REQUIRED: Record<string, true> = {
  QuestionnaireResponse: true,
  Observation: true,
};

const CONTEXT_REQUIRED: Record<string, true> = {
  DocumentReference: true,
};

const AUTHOR_REQUIRED: Record<string, true> = {
  DocumentReference: true,
};

/**
 * Returns a shallow copy with missing required context filled from the launch
 * context. Fields the caller already set are never overwritten; context the
 * caller didn't provide is simply left absent (the server then reports the
 * gap instead of us guessing).
 */
export function hydrateFhirResource<T extends { resourceType: string }>(
  resource: T,
  context: FhirWriteContext,
): T & FhirResourceLike {
  const out: FhirResourceLike = { ...resource };
  const type = resource.resourceType;

  if (SUBJECT_REQUIRED[type] && !out.subject && context.patientId) {
    out.subject = { reference: "Patient/" + context.patientId };
  }
  if (ENCOUNTER_REQUIRED[type] && !out.encounter && context.encounterId) {
    out.encounter = { reference: "Encounter/" + context.encounterId };
  }
  if (CONTEXT_REQUIRED[type] && !out.context && context.encounterId) {
    const now = (context.now ?? defaultNow)();
    out.context = {
      encounter: [{ reference: "Encounter/" + context.encounterId }],
      period: { start: now, end: now },
    };
  }
  if (
    AUTHOR_REQUIRED[type] &&
    (!out.author || out.author.length === 0) &&
    context.practitionerId
  ) {
    out.author = [{ reference: "Practitioner/" + context.practitionerId }];
  }
  return out as T & FhirResourceLike;
}

function defaultNow(): string {
  return new Date().toISOString();
}
