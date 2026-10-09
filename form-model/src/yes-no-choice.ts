import { getOptionLabel, getOptionValue } from "./choice-options";
import { readDefaultAnswer, writeDefaultAnswer } from "./defaults";
import { isChoiceStyle, CHOICE_STYLE_DISPLAY } from "./field-types";
import { exclusiveAnswerValues, readOptionRules } from "./option-rules";
import type { BuilderChoiceOption, BuilderField, BuilderVisibilityRule } from "./index";
import type { CompositeField, CompositeFieldComponent } from "./layout";

/**
 * A Yes/No answer and a two-answer choice are one question drawn two ways.
 * What the answer looks like
 * (Yes/No buttons, radio buttons, answer buttons) and where it prints (one PDF
 * radio group, or one PDF box per answer) are independent:
 *
 * - a choice may use the Yes/No look: `choiceStyle: "buttons"`;
 * - a Yes/No may print each answer to its own box: a `choice` composite in the
 *   layout draft whose two option components have `optionValue` "yes" and
 *   "no" (`yesNoOptionComponents`). The PDF writers turn the stored
 *   true/false (or Y/N code) into a tick in that answer's box
 *   (lib/document-fill/composite-fill.ts, PdfRegenerator).
 *
 * Switching a field between the two types goes through `convertYesNoChoice`
 * (or `convertYesNoChoiceInDocument`), which keeps the PDF boxes, carries the
 * labels and the default answer across, and rewrites show-when rules that
 * compare this answer.
 */

export type YesNoAnswer = "yes" | "no";

/** The option values a combined Yes/No prints by: the "yes" box and the "no" box. */
export const YES_NO_OPTION_VALUES: Readonly<Record<YesNoAnswer, string>> = { yes: "yes", no: "no" };

const YES_TOKENS = new Set(["true", "yes", "y", "1", "on", "checked"]);
const NO_TOKENS = new Set(["false", "no", "n", "0", "off", "unchecked"]);

/**
 * A stored answer read as yes or no: true/false, "yes"/"no", a MOIS-YESNO
 * code ("Y"/"N"), 1/0, or a coding of one. Null for a blank or any other value.
 */
export function yesNoAnswerOf(value: unknown): YesNoAnswer | null {
  if (value === true) return "yes";
  if (value === false) return "no";
  if (typeof value === "number") return value === 1 ? "yes" : value === 0 ? "no" : null;
  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    return YES_TOKENS.has(token) ? "yes" : NO_TOKENS.has(token) ? "no" : null;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return yesNoAnswerOf(record.code ?? record.value);
  }
  return null;
}

type OptionComponent = CompositeFieldComponent & { role: "option" };

/**
 * The two option components of a choice composite that print a Yes/No answer
 * (optionValue "yes" and "no", nothing else), or null when the composite is
 * not one.
 */
export function yesNoOptionComponents(
  composite: Pick<CompositeField, "type" | "components"> | null | undefined,
): { yes: OptionComponent; no: OptionComponent } | null {
  if (!composite || composite.type !== "choice") return null;
  const components = composite.components ?? [];
  if (components.some((component) => component.role === "other" || component.role === "otherText")) return null;
  const options = components.filter((component): component is OptionComponent => component.role === "option");
  if (options.length !== 2) return null;
  const valueOf = (component: OptionComponent) => (component.optionValue ?? "").trim().toLowerCase();
  const yes = options.find((component) => valueOf(component) === YES_NO_OPTION_VALUES.yes);
  const no = options.find((component) => valueOf(component) === YES_NO_OPTION_VALUES.no);
  return yes && no ? { yes, no } : null;
}

export type YesNoChoiceType = "booleanYesNo" | "choice";

function isSingleChoice(field: Pick<BuilderField, "choiceStyle">): boolean {
  return !isChoiceStyle(field.choiceStyle) || CHOICE_STYLE_DISPLAY[field.choiceStyle].selection === "single";
}

function optionComponentFor(composite: CompositeField | null | undefined, option: BuilderChoiceOption): CompositeFieldComponent | undefined {
  const value = getOptionValue(option);
  return composite?.components.find((component) =>
    component.role === "option" && (component.optionValue ?? component.fieldId) === value,
  );
}

/**
 * Why a field can't switch between Yes/No and choice without losing
 * something, or null when it can. A choice converts when it takes one answer
 * from exactly two plain options (no code system, Other, answer conditions,
 * exclusive answers, scores or answer codes, which a Yes/No can't hold).
 */
export function yesNoChoiceConversionBlocker(
  field: BuilderField,
  nextType: YesNoChoiceType,
  composite?: CompositeField | null,
): string | null {
  if (field.type === nextType) return "The field is already this type.";
  if (nextType === "choice") {
    if (field.type !== "booleanYesNo") return "Only a Yes/No field becomes a two-answer choice.";
    return null;
  }
  if (field.type !== "choice") return "Only a choice becomes a Yes/No field.";
  if (!isSingleChoice(field)) return "A choice that takes several answers can't be a Yes/No.";
  const options = field.options ?? [];
  if (options.length !== 2) return "A Yes/No has exactly two answers.";
  if (field.codeSystem) return "A coded choice keeps its code system; a Yes/No saves true or false.";
  if (field.showOtherOption) return "A Yes/No has no Other answer.";
  if (readOptionRules(field).length) return "A Yes/No has no answer conditions.";
  if (exclusiveAnswerValues(options).length) return "A Yes/No has no exclusive answers.";
  for (const option of options) {
    if (option && typeof option === "object" && ((option.codings?.length ?? 0) > 0 || option.score !== undefined)) {
      return "A Yes/No can't keep answer scores or answer codes.";
    }
  }
  if (composite) {
    if (composite.type !== "choice") return "Only a combined choice's boxes print a Yes/No.";
    if (composite.components.some((component) => component.role !== "option")) return "A Yes/No has no Other box.";
    if (options.some((option) => !optionComponentFor(composite, option))) return "Each answer needs its own PDF box.";
  }
  return null;
}

export interface YesNoChoiceConversion {
  /** The field as the new type. */
  field: BuilderField;
  /** The combined field's PDF mapping with each answer's box kept, or null without one. */
  composite: CompositeField | null;
  /** A show-when value that compared the old answer, as the new answer stores it. */
  remapConditionValue: (value: string) => string;
}

function defaultFor<T>(field: BuilderField, map: (value: unknown) => T | undefined): T | undefined {
  const answer = readDefaultAnswer(field, { shape: "field" });
  if (answer?.kind !== "literal") return undefined;
  return map(answer.value);
}

/**
 * Switch a field between Yes/No and a two-answer single choice, keeping its
 * PDF boxes. Choice → Yes/No: the first option is Yes and the second No; their
 * labels become the Yes/No labels and each answer's box keeps printing it.
 * Yes/No → choice: two options from the labels; a combined field's options
 * store "yes" and "no" (what its boxes print by), a field without one stores
 * the label, as a plain option does. The default answer and the "Can be
 * cleared back to blank" setting (`booleanNeutralMode`, read by Yes/No and
 * answer buttons alike) carry across. Null when `yesNoChoiceConversionBlocker`
 * names a reason.
 */
export function convertYesNoChoice(
  field: BuilderField,
  nextType: YesNoChoiceType,
  composite?: CompositeField | null,
): YesNoChoiceConversion | null {
  if (yesNoChoiceConversionBlocker(field, nextType, composite)) return null;
  const owned = composite ?? null;

  if (nextType === "booleanYesNo") {
    const [yesOption, noOption] = field.options ?? [];
    const yesValue = getOptionValue(yesOption);
    const noValue = getOptionValue(noOption);
    const labels = { on: getOptionLabel(yesOption) || "Yes", off: getOptionLabel(noOption) || "No" };
    const answerOf = (value: unknown): YesNoAnswer | null => {
      const text = typeof value === "object" && value ? String((value as { code?: unknown }).code ?? "") : String(value ?? "");
      if (text === yesValue || text === labels.on) return "yes";
      if (text === noValue || text === labels.off) return "no";
      return null;
    };
    const nextDefault = defaultFor(field, (value) => {
      const answer = answerOf(value);
      return answer ? answer === "yes" : undefined;
    });
    let next: BuilderField = {
      ...field,
      type: "booleanYesNo",
      booleanLabels: labels,
      options: null,
      showOtherOption: false,
    };
    const hadDefault = readDefaultAnswer(field, { shape: "field" });
    if (hadDefault) {
      next = writeDefaultAnswer(next, nextDefault === undefined ? null : { kind: "literal", value: nextDefault }, { shape: "field" });
    }
    const nextComposite = owned
      ? {
          ...owned,
          components: owned.components.map((component) => {
            const yes = component === optionComponentFor(owned, yesOption);
            const no = component === optionComponentFor(owned, noOption);
            if (!yes && !no) return component;
            return { ...component, optionValue: yes ? YES_NO_OPTION_VALUES.yes : YES_NO_OPTION_VALUES.no, optionLabel: yes ? labels.on : labels.off };
          }),
        }
      : null;
    return {
      field: next,
      composite: nextComposite,
      remapConditionValue: (value) => {
        const answer = answerOf(value);
        return answer ? YES_NO_OPTION_VALUES[answer] : value;
      },
    };
  }

  const labels = { on: field.booleanLabels?.on || "Yes", off: field.booleanLabels?.off || "No" };
  const boxes = owned ? yesNoOptionComponents(owned) : null;
  const values = boxes ? { yes: YES_NO_OPTION_VALUES.yes, no: YES_NO_OPTION_VALUES.no } : { yes: labels.on, no: labels.off };
  const options: BuilderChoiceOption[] = [
    { label: labels.on, value: values.yes },
    { label: labels.off, value: values.no },
  ];
  const keepsStyle = isChoiceStyle(field.choiceStyle) && CHOICE_STYLE_DISPLAY[field.choiceStyle].selection === "single";
  let next: BuilderField = {
    ...field,
    type: "choice",
    options,
    // The Yes/No's own look, unless a single-answer look was chosen before.
    choiceStyle: keepsStyle ? field.choiceStyle : "buttons",
    booleanLabels: null,
    showOtherOption: false,
  };
  if (readDefaultAnswer(field, { shape: "field" })) {
    const answer = defaultFor(field, yesNoAnswerOf);
    next = writeDefaultAnswer(next, answer ? { kind: "literal", value: values[answer] } : null, { shape: "field" });
  }
  const nextComposite = owned
    ? {
        ...owned,
        components: owned.components.map((component) =>
          boxes && component === boxes.yes ? { ...component, optionLabel: labels.on }
            : boxes && component === boxes.no ? { ...component, optionLabel: labels.off }
              : component,
        ),
      }
    : null;
  return {
    field: next,
    composite: nextComposite,
    remapConditionValue: (value) => {
      const answer = yesNoAnswerOf(value);
      return answer ? values[answer] : value;
    },
  };
}

interface DraftWithComposites {
  compositeFields?: CompositeField[];
}

/** The combined field (layout composite) whose answer this field holds, with its draft. */
export function findFieldComposite<TDraft extends DraftWithComposites>(
  drafts: readonly TDraft[],
  fieldId: string,
): { draft: TDraft; composite: CompositeField } | null {
  for (const draft of drafts) {
    const composite = (draft.compositeFields ?? []).find((entry) => entry.id === fieldId);
    if (composite) return { draft, composite };
  }
  return null;
}

function remapVisibility(rule: BuilderVisibilityRule | null | undefined, fieldId: string, remap: (value: string) => string): BuilderVisibilityRule | null | undefined {
  if (!rule) return rule;
  let changed = false;
  const next: BuilderVisibilityRule = { ...rule };
  if (rule.controllerId === fieldId && typeof rule.value === "string" && (rule.type === "equals" || rule.type === "not-equals")) {
    const value = remap(rule.value);
    if (value !== rule.value) {
      next.value = value;
      changed = true;
    }
  }
  if (rule.additionalConditions?.length) {
    next.additionalConditions = rule.additionalConditions.map((condition) => {
      if (condition.controllerId !== fieldId || typeof condition.value !== "string") return condition;
      if (condition.type !== "equals" && condition.type !== "not-equals") return condition;
      const value = remap(condition.value);
      if (value === condition.value) return condition;
      changed = true;
      return { ...condition, value };
    });
  }
  return changed ? next : rule;
}

/**
 * `convertYesNoChoice` applied in place to a builder document: the field, its
 * combined field's PDF boxes in the layout draft, and every show-when rule
 * that compares its answer. Returns false (and changes nothing) when the
 * field can't convert.
 */
export function convertYesNoChoiceInDocument<TDraft extends DraftWithComposites>(
  document: { fields: BuilderField[]; drafts: TDraft[] },
  fieldId: string,
  nextType: YesNoChoiceType,
): boolean {
  const field = document.fields.find((entry) => entry.id === fieldId);
  if (!field) return false;
  const owner = findFieldComposite(document.drafts, fieldId);
  const conversion = convertYesNoChoice(field, nextType, owner?.composite ?? null);
  if (!conversion) return false;
  document.fields = document.fields.map((entry) => {
    if (entry.id === fieldId) return conversion.field;
    const visibility = remapVisibility(entry.visibility, fieldId, conversion.remapConditionValue);
    return visibility === entry.visibility ? entry : { ...entry, visibility };
  });
  if (owner && conversion.composite) {
    owner.draft.compositeFields = (owner.draft.compositeFields ?? []).map((entry) =>
      entry.id === fieldId ? conversion.composite! : entry,
    );
  }
  return true;
}
