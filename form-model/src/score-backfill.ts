import type { BuilderField } from "./index";
import { getOptionLabel, getOptionScore, getOptionValue, withOptionScore } from "./choice-options";

/**
 * Lift per-option scores out of legacy inline `score([id], { ...map })` formulas
 * onto the referenced choice field's options, then rewrite those calls to the
 * clean linked form `score([id])`.
 *
 * Why: forms imported before per-option scoring existed (e.g. FHIR ordinal
 * questionnaires) stored the scores ONLY inside the total-score formula. That
 * left the option editor blank and kept two copies of the scores. This back-fill
 * makes the option the single source of truth — the score moves onto the option,
 * the formula just references it, and the computed field's interpretation ranges
 * are untouched.
 *
 * Equivalence: a call is only cleaned when the referenced field carries option
 * scores afterwards. `score([id])` resolves the same map from those option scores
 * at eval/export time, and an option with no matching map entry falls back to the
 * numeric value exactly as the inline form did — so behavior is preserved.
 *
 * Pure: returns a new array; inputs are not mutated. Fields that don't match
 * (e.g. matrix fields with no `options`) keep their inline formula untouched.
 */

// Matches a two-argument `score([field-id], { ...flat json map... })` call.
const scoreCallWithMap = () => /score\(\s*\[([^\]]+)\]\s*,\s*(\{[^{}]*\})\s*\)/g;

function expressionOf(field: BuilderField): string | undefined {
  return field.computedConfig?.expression ?? field.calculatedValue?.expression ?? undefined;
}

export function backfillOptionScoresFromFormula(fields: BuilderField[]): BuilderField[] {
  const byId = new Map(fields.map((field) => [field.id, field]));

  // 1. Collect the inline score maps referenced by every computed expression.
  const mapByFieldId = new Map<string, Record<string, number>>();
  for (const field of fields) {
    const expression = expressionOf(field);
    if (typeof expression !== "string" || !expression.includes("score(")) continue;
    const pattern = scoreCallWithMap();
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(expression)) !== null) {
      const refId = match[1].trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(match[2]);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      const numericEntries: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "number" && Number.isFinite(value)) numericEntries[key] = value;
      }
      mapByFieldId.set(refId, { ...(mapByFieldId.get(refId) ?? {}), ...numericEntries });
    }
  }
  if (mapByFieldId.size === 0) return fields;

  // 2. Apply the maps onto each referenced field's options (only blank scores).
  const patchedOptionsById = new Map<string, BuilderField["options"]>();
  for (const [refId, map] of mapByFieldId) {
    const target = byId.get(refId);
    if (!target || !Array.isArray(target.options)) continue;
    let changed = false;
    const nextOptions = target.options.map((option) => {
      if (getOptionScore(option) !== undefined) return option; // respect an explicit score
      const value = getOptionValue(option);
      const label = getOptionLabel(option);
      const score = Object.prototype.hasOwnProperty.call(map, value)
        ? map[value]
        : Object.prototype.hasOwnProperty.call(map, label)
          ? map[label]
          : undefined;
      if (score === undefined) return option;
      changed = true;
      return withOptionScore(option, score);
    });
    if (changed) patchedOptionsById.set(refId, nextOptions);
  }

  const fieldHasOptionScores = (fieldId: string): boolean => {
    const options = patchedOptionsById.get(fieldId) ?? byId.get(fieldId)?.options;
    return Array.isArray(options) && options.some((option) => getOptionScore(option) !== undefined);
  };

  // 3. Rewrite inline calls to the clean form, but only where the referenced
  //    field now carries scores (otherwise leave the inline map to be safe).
  const cleanExpression = (expression: string): string =>
    expression.replace(scoreCallWithMap(), (full, rawId: string) => {
      const refId = rawId.trim();
      return fieldHasOptionScores(refId) ? `score([${refId}])` : full;
    });

  // 4. Emit new fields with patched options and/or cleaned expressions.
  return fields.map((field) => {
    let next = field;
    const patchedOptions = patchedOptionsById.get(field.id);
    if (patchedOptions) next = { ...next, options: patchedOptions };

    const expression = expressionOf(next);
    if (typeof expression === "string" && expression.includes("score(")) {
      const cleaned = cleanExpression(expression);
      if (cleaned !== expression) {
        if (next.computedConfig?.expression === expression) {
          next = { ...next, computedConfig: { ...next.computedConfig, expression: cleaned } };
        } else if (next.calculatedValue?.expression === expression) {
          next = { ...next, calculatedValue: { ...next.calculatedValue, expression: cleaned } };
        }
      }
    }
    return next;
  });
}
