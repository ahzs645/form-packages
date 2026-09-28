/**
 * The `provider` answer type: a clinician chosen from the organisation's
 * provider directory.
 *
 * The neutral answer is a Coding: the provider's identifier as `code`, the
 * name shown to people as `display`, and the directory the identifier belongs
 * to as `system`. Each target's directory has its own system:
 *
 * | Target | Native control | Stored |
 * | --- | --- | --- |
 * | MOIS | `Provider` / FindCode over `useAppSettings().providers` | `{ code: providerId, display: name, system: "MOIS-PROVIDERS" }` (the engine's own provider default) |
 * | Cerner | PowerForm control 18 and iView rows on a `PROVIDER` DTA | the personnel record PowerChart charts |
 * | FHIR | `reference` item, `questionnaire-referenceResource` = Practitioner | `valueReference { reference: "Practitioner/<id>", display }` |
 *
 * Targets without a directory (AlayaCare, documents) keep the name as text.
 *
 * Saved forms, runtimes and imports hold the answer in several shapes; this
 * reader accepts all of them so no consumer needs its own normalizer.
 */

/** The directory an answer's identifier comes from, when none is stated. */
export const PROVIDER_DIRECTORY_SYSTEMS = {
  mois: "MOIS-PROVIDERS",
  /** Cerner personnel (PRSNL) ids. */
  cerner: "urn:cerner:prsnl",
  fhir: "Practitioner",
  /** The builder preview's sample directory. */
  preview: "urn:webforms:preview-providers",
} as const;

export interface ProviderAnswer {
  /** The provider's identifier in `system`; empty when only a name is known (free text, legacy answers). */
  code: string;
  /** The provider's name as shown to people. */
  display: string;
  system?: string;
}

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() ? value.trim() : undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function first(record: AnyRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const found = text(record[key]);
    if (found !== undefined) return found;
  }
  return undefined;
}

const PRACTITIONER_REFERENCE = /^(?:.*\/)?Practitioner(?:Role)?\/([^/]+)$/;

/**
 * A provider answer from any stored shape, or null when unanswered:
 * - a Coding `{ code, display, system }` (the neutral shape; FindCodeSelect saves it);
 * - a MOIS provider record `{ providerId, name, … }`, as the engine's
 *   `Provider` control and `useAppSettings().providers` hold it;
 * - a FHIR `valueReference` (or a QuestionnaireResponse answer holding one);
 * - a plain name (an answer typed before the field was a provider search).
 */
export function readProviderAnswer(value: unknown): ProviderAnswer | null {
  if (Array.isArray(value)) return value.length ? readProviderAnswer(value[0]) : null;
  if (typeof value === "string" || typeof value === "number") {
    const name = text(value);
    return name === undefined ? null : { code: "", display: name };
  }
  if (!isRecord(value)) return null;
  if (isRecord(value.valueReference)) return readProviderAnswer(value.valueReference);
  if (isRecord(value.valueCoding)) return readProviderAnswer(value.valueCoding);
  if (typeof value.valueString === "string") return readProviderAnswer(value.valueString);

  const reference = text(value.reference);
  const referenced = reference ? PRACTITIONER_REFERENCE.exec(reference)?.[1] : undefined;
  const code = first(value, ["code", "providerId", "id", "personId", "prsnlId", "sourceId"]) ?? referenced ?? "";
  const display = first(value, ["display", "name", "fullName", "text", "label"]) ?? "";
  if (!code && !display) return null;
  const answer: ProviderAnswer = { code, display: display || code };
  const system = text(value.system) ?? (referenced ? PROVIDER_DIRECTORY_SYSTEMS.fhir : undefined);
  if (system !== undefined) answer.system = system;
  return answer;
}

/** The name a text-only target writes for a provider answer ("" when unanswered). */
export function providerAnswerText(value: unknown): string {
  return readProviderAnswer(value)?.display ?? "";
}

/** A directory entry as the builder preview and the MOIS runtime list it. */
export interface ProviderDirectoryEntry {
  id: string;
  name: string;
  /** Role or discipline shown beside the name in a search. */
  role?: string;
}

/** The neutral answer for a directory entry. */
export function providerAnswerFor(entry: ProviderDirectoryEntry, system: string = PROVIDER_DIRECTORY_SYSTEMS.preview): ProviderAnswer {
  return { code: entry.id, display: entry.name, system };
}

/**
 * Entries matching a search: every word of the query starts a word of the
 * name (so "smi j" finds "SMITH, JOHN"), in directory order, at most `limit`.
 */
export function searchProviderDirectory<T extends ProviderDirectoryEntry>(entries: readonly T[], query: string, limit = 10): T[] {
  const terms = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!terms.length) return entries.slice(0, limit);
  return entries
    .filter((entry) => {
      const words = entry.name.toLowerCase().split(/[\s,.]+/).filter(Boolean);
      return terms.every((term) => words.some((word) => word.startsWith(term)));
    })
    .slice(0, limit);
}
