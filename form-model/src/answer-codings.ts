import { normalizeOption } from "./values";
import type { BuilderChoiceOption, BuilderChoiceOptionObject, BuilderFhirCoding } from "./index";

/**
 * An answer's equivalent code in a standard terminology
 * (docs/.../architecture/answer-codings.md): "As much as I always could" on an
 * EPDS question is LOINC LA12345-6, whatever value the form stores for it.
 *
 * Stored once per answer as `option.codings`, beside the stored value, which
 * never changes: MOIS and saved forms keep reading the value they always read,
 * and a target that speaks the terminology (FHIR) sends the code instead. The
 * question's own code stays in `fhirConfig.code`. Reading a coded answer back
 * (a LOINC-coded response) goes through `optionForAnswerCode`.
 */

export const LOINC_SYSTEM = "http://loinc.org";

function sameSystem(left: string | undefined, right: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/^https:/, "http:").replace(/\/+$/, "");
  return typeof left === "string" && normalize(left) === normalize(right);
}

function codingsOf(option: unknown): BuilderFhirCoding[] {
  if (!option || typeof option !== "object" || Array.isArray(option)) return [];
  const codings = (option as { codings?: unknown }).codings;
  return Array.isArray(codings)
    ? codings.filter((coding): coding is BuilderFhirCoding => Boolean(coding) && typeof coding === "object" && typeof (coding as BuilderFhirCoding).code === "string")
    : [];
}

/** The answer's code in a terminology (LOINC unless named), or null when it has none. */
export function optionAnswerCoding(option: unknown, system: string = LOINC_SYSTEM): BuilderFhirCoding | null {
  return codingsOf(option).find((coding) => sameSystem(coding.system, system) && coding.code?.trim()) ?? null;
}

/**
 * The option with its code in `coding.system` set (or removed, for null). A
 * plain-text option becomes `{ label }`, which stores the same value.
 */
export function withOptionAnswerCoding<T extends BuilderChoiceOption | Record<string, unknown>>(
  option: T,
  coding: BuilderFhirCoding | null,
  system: string = coding?.system ?? LOINC_SYSTEM,
): T | BuilderChoiceOptionObject {
  const base: Record<string, unknown> = typeof option === "string" ? { label: option } : { ...(option as Record<string, unknown>) };
  const others = codingsOf(base).filter((entry) => !sameSystem(entry.system, system));
  const next = coding?.code?.trim()
    ? [...others, { system, code: coding.code.trim(), ...(coding.display ? { display: coding.display } : {}) }]
    : others;
  if (next.length) base.codings = next;
  else delete base.codings;
  return base as T | BuilderChoiceOptionObject;
}

/**
 * Back-maps a coded answer to the option that stands for it: the option whose
 * code in `system` is `code`, else one whose stored value already is the code
 * (a field inserted from LOINC stores LA codes directly).
 */
export function optionForAnswerCode<T>(options: readonly T[], code: string, system: string = LOINC_SYSTEM): T | null {
  const wanted = code.trim();
  if (!wanted) return null;
  return options.find((option) => optionAnswerCoding(option, system)?.code === wanted)
    ?? options.find((option) => normalizeOption(option).code === wanted)
    ?? null;
}

/** The stored value for a coded answer (see optionForAnswerCode), or null when no option has the code. */
export function storedValueForAnswerCode(options: readonly unknown[], code: string, system: string = LOINC_SYSTEM): string | null {
  const option = optionForAnswerCode(options, code, system);
  return option === null ? null : normalizeOption(option).code;
}
