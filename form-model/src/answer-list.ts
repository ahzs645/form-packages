import type { BuilderChoiceOption } from "./index";
import { getOptionLabel } from "./choice-options";

/**
 * Answer lists: what answers a field offers — the one reading every target's
 * option writer uses (docs/.../architecture/resolved-form.md, "Answer lists").
 * This module imports the option readers only, so the structure and matrix
 * readers can use it.
 */

/**
 * The answers a field offers, in order:
 *
 * - `yesNo`: its on and off labels (`booleanLabels`, else "Yes" and "No");
 * - `checkbox`: one answer, ticked, labelled `booleanLabels.on` (else "Yes");
 * - `choice`: its options, as stored (restricted to a portable answer range
 *   when one is set);
 * - `scale`: its scale points, the key (or the number) stored and the number
 *   as the score.
 */
export type AnswerListKind = "yesNo" | "checkbox" | "choice" | "scale";

export interface AnswerList {
  kind: AnswerListKind;
  /** The answers as stored options (Yes/No and the tick as their label text). */
  options: BuilderChoiceOption[];
  /** Each answer's display text (`getOptionLabel`). */
  labels: string[];
  /**
   * Yes/No and checkbox: false when the author named the answers
   * (`booleanLabels`). A target that labels an unnamed tick box its own way
   * (a PowerForm check shows the item's caption) reads this.
   */
  defaultLabels?: boolean;
}

/** The field shapes `answerListOf` reads: builder fields, table columns and nested projections. */
export interface AnswerListInput {
  type?: string | null;
  booleanLabels?: { on?: string | null; off?: string | null } | null;
  options?: readonly BuilderChoiceOption[] | null;
  scaleConfig?: { options?: ReadonlyArray<{ value: number; label?: string | null; key?: string | null }> | null } | null;
  answerSetPortableRange?: { answerLabels: readonly string[] } | null;
}

/** A Yes/No question's two answers: its on and off labels, else "Yes" and "No". */
export function yesNoAnswerOptions(labels: AnswerListInput["booleanLabels"]): [string, string] {
  return [labels?.on ?? "Yes", labels?.off ?? "No"];
}

/**
 * A choice's options, restricted to its portable answer range when one is
 * set (an answer set shared across targets lists the labels it carries).
 */
export function portableAnswerOptions(field: Pick<AnswerListInput, "options" | "answerSetPortableRange">): BuilderChoiceOption[] | null | undefined {
  const options = field.options as BuilderChoiceOption[] | null | undefined;
  if (!field.answerSetPortableRange) return options;
  return field.answerSetPortableRange.answerLabels.flatMap((label) => {
    const option = options?.find((candidate) => getOptionLabel(candidate) === label);
    return option === undefined ? [] : [option];
  });
}

/** A scale's points as options: the key (or the number) is stored, the number is the score. */
export function scaleAnswerOptions(field: Pick<AnswerListInput, "scaleConfig">): BuilderChoiceOption[] {
  return (field.scaleConfig?.options ?? []).map((option) => ({
    label: option.label ?? String(option.value),
    value: option.key ?? String(option.value),
    score: option.value,
  }));
}

export interface AnswerListOptions {
  /** Read a choice's options as stored, ignoring a portable answer range. */
  allOptions?: boolean;
}

function answerList(kind: AnswerListKind, options: BuilderChoiceOption[], defaultLabels?: boolean): AnswerList {
  return { kind, options, labels: options.map((option) => getOptionLabel(option)), ...(defaultLabels === undefined ? {} : { defaultLabels }) };
}

/** The answers the field offers (see `AnswerList`), or null when it offers none to pick from. */
export function answerListOf(field: AnswerListInput | null | undefined, options: AnswerListOptions = {}): AnswerList | null {
  if (!field) return null;
  const labels = field.booleanLabels;
  switch (field.type) {
    case "booleanYesNo":
      return answerList("yesNo", yesNoAnswerOptions(labels), labels?.on == null && labels?.off == null);
    case "booleanSingle":
    case "checkbox":
      return answerList("checkbox", [labels?.on ?? "Yes"], labels?.on == null);
    case "scale":
      return answerList("scale", scaleAnswerOptions(field));
    case "choice":
    case "multiselect":
      return answerList("choice", [...((options.allOptions ? field.options : portableAnswerOptions(field)) ?? [])]);
    default:
      return null;
  }
}

