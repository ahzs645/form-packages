import type {
  BuilderChoiceOption,
  BuilderChoiceOptionObject,
} from "./index";

type ExtendedChoiceOptionObject = BuilderChoiceOptionObject & {
  hotKey?: string;
  order?: number;
};

/**
 * Helpers for the `string | BuilderChoiceOptionObject` choice-option union.
 *
 * Options used to be plain label strings. They can now also be objects that
 * carry a per-option `score` (and an optional distinct stored `value`). The
 * score lives *inside* the same array element as the label, so renaming a label
 * never detaches its score — unlike a parallel score map keyed by label text,
 * which silently orphans scores on rename.
 *
 * Everything that reads options should go through these helpers so the two
 * shapes stay interchangeable.
 */

const LEADING_OPTION_MARKER_PATTERN = /^[\u2610-\u2612\u25A0-\u25A3\u25CB-\u25CF\u2713\u2714\u2717\u2718\uF046\uF096\uF0A8\uF14A]\s+/u;

export function normalizeOptionLabel(label: string): string {
  const trimmed = label.replace(/\u00a0/g, " ").trimStart();

  // Some PDF/icon-font imports encode a leading checkbox as text.
  const withoutMarker = trimmed.replace(LEADING_OPTION_MARKER_PATTERN, "");

  // Regression guard for extracted labels like "hortness of breath", where
  // the source font maps the first glyph to a private-use code point.
  if (withoutMarker.startsWith("\uF0A3")) {
    const remainder = withoutMarker.slice(1);
    if (/^\p{Ll}/u.test(remainder)) return `S${remainder}`;
    return remainder.trimStart();
  }

  return withoutMarker;
}

export function isChoiceOptionObject(
  option: BuilderChoiceOption | null | undefined,
): option is BuilderChoiceOptionObject {
  return typeof option === "object" && option !== null;
}

/** The human-readable label for an option, regardless of shape. */
export function getOptionLabel(option: BuilderChoiceOption | null | undefined): string {
  if (option == null) return "";
  if (typeof option === "string") return normalizeOptionLabel(option);
  return normalizeOptionLabel(option.label ?? "");
}

/**
 * The stored value for an option. Falls back to the label when no explicit
 * `value` is set (matching how bare-string options behave today).
 */
export function getOptionValue(option: BuilderChoiceOption | null | undefined): string {
  if (option == null) return "";
  if (typeof option === "string") return option;
  return option.value ?? option.label ?? "";
}

/**
 * The numeric score for an option, or `undefined` when none is assigned.
 * A bare-string option never has an explicit score.
 */
export function getOptionScore(
  option: BuilderChoiceOption | null | undefined,
): number | undefined {
  if (!isChoiceOptionObject(option)) return undefined;
  return typeof option.score === "number" && Number.isFinite(option.score)
    ? option.score
    : undefined;
}

/** Whether any option in the list carries an explicit score. */
export function hasAnyOptionScore(
  options: ReadonlyArray<BuilderChoiceOption> | null | undefined,
): boolean {
  return Array.isArray(options) && options.some((option) => getOptionScore(option) !== undefined);
}

/** Coerce an option to its object form, preserving label/value/score/description. */
export function toChoiceOptionObject(option: BuilderChoiceOption): BuilderChoiceOptionObject {
  if (typeof option === "string") return { label: option };
  return { ...option };
}

/**
 * Collapse an option back to a bare string when it carries no extra data, so we
 * don't bloat saved forms with `{ label }` objects that add nothing. Options
 * with a score/value/description are kept as objects.
 */
export function compactChoiceOption(option: BuilderChoiceOption): BuilderChoiceOption {
  if (typeof option === "string") return normalizeOptionLabel(option);
  const extended = option as ExtendedChoiceOptionObject;
  const label = normalizeOptionLabel(option.label ?? "");
  const hasValue = option.value != null && option.value !== option.label && option.value !== label;
  const hasScore = typeof option.score === "number" && Number.isFinite(option.score);
  const hasDescription = option.description != null && option.description !== "";
  const hasHotKey = typeof extended.hotKey === "string" && extended.hotKey !== "";
  const hasOrder = typeof extended.order === "number" && Number.isFinite(extended.order);
  if (!hasValue && !hasScore && !hasDescription && !hasHotKey && !hasOrder) return label;
  const next: ExtendedChoiceOptionObject = { label };
  if (hasValue) next.value = option.value;
  if (hasScore) next.score = option.score;
  if (hasDescription) next.description = option.description;
  if (hasHotKey) next.hotKey = extended.hotKey;
  if (hasOrder) next.order = extended.order;
  return next;
}

/** Return a copy of `option` with `label` replaced (preserving other fields). */
export function withOptionLabel(
  option: BuilderChoiceOption,
  label: string,
): BuilderChoiceOption {
  if (typeof option === "string") return normalizeOptionLabel(label);
  return compactChoiceOption({ ...option, label });
}

/**
 * Merge a partial patch (label/value/score/description) into an option and
 * compact the result. Clears a field when the patch sets it to `undefined`,
 * empty string, or NaN (for score). Used by the option detail dialog.
 */
export function withOptionPatch(
  option: BuilderChoiceOption,
  patch: Partial<ExtendedChoiceOptionObject>,
): BuilderChoiceOption {
  const base = toChoiceOptionObject(option) as ExtendedChoiceOptionObject;
  if ("label" in patch) base.label = patch.label ?? "";
  if ("value" in patch) {
    if (patch.value == null || patch.value === "") delete base.value;
    else base.value = patch.value;
  }
  if ("score" in patch) {
    if (patch.score == null || !Number.isFinite(patch.score)) delete base.score;
    else base.score = patch.score;
  }
  if ("description" in patch) {
    if (patch.description == null || patch.description === "") delete base.description;
    else base.description = patch.description;
  }
  if ("hotKey" in patch) {
    const hotKey = (patch.hotKey ?? "").trim().slice(0, 1);
    if (!hotKey) delete base.hotKey;
    else base.hotKey = hotKey;
  }
  if ("order" in patch) {
    if (patch.order == null || !Number.isFinite(patch.order)) delete base.order;
    else base.order = patch.order;
  }
  return compactChoiceOption(base);
}

/** Return a copy of `option` with `score` set (or cleared when `undefined`/NaN). */
export function withOptionScore(
  option: BuilderChoiceOption,
  score: number | undefined,
): BuilderChoiceOption {
  const base = toChoiceOptionObject(option);
  if (score == null || !Number.isFinite(score)) {
    delete base.score;
  } else {
    base.score = score;
  }
  return compactChoiceOption(base);
}

/**
 * Build the `{ valueOrLabel -> score }` map that `score([id])` resolves against
 * at evaluation time. Both the stored value and the label key map to the same
 * score, so the lookup succeeds whichever form the saved answer takes. Returns
 * an empty object when no option carries a score.
 */
export function buildOptionScoreMap(
  options: ReadonlyArray<BuilderChoiceOption> | null | undefined,
): Record<string, number> {
  const map: Record<string, number> = {};
  if (!Array.isArray(options)) return map;
  for (const option of options) {
    const score = getOptionScore(option);
    if (score === undefined) continue;
    const label = getOptionLabel(option);
    const value = getOptionValue(option);
    if (label) map[label] = score;
    if (value) map[value] = score;
  }
  return map;
}

/**
 * Build the `{ fieldId: { answer: score } }` map for a set of fields, used to
 * resolve `score([id])` formulas. Only fields that carry at least one explicit
 * option score are included. Accepts any field-like object with `id`/`options`.
 */
export function buildScoreMapsFromFields(
  fields: Iterable<{ id: string; options?: ReadonlyArray<BuilderChoiceOption> | null }>,
): Record<string, Record<string, number>> {
  const maps: Record<string, Record<string, number>> = {};
  for (const field of fields) {
    if (!field?.id) continue;
    const map = buildOptionScoreMap(field.options);
    if (Object.keys(map).length > 0) maps[field.id] = map;
  }
  return maps;
}

/** Convenience: just the labels, for code paths that only display options. */
export function getOptionLabels(
  options: ReadonlyArray<BuilderChoiceOption> | null | undefined,
): string[] {
  if (!Array.isArray(options)) return [];
  return options.map(getOptionLabel).filter((label) => label.trim().length > 0);
}
