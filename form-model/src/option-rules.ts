import { getOptionValue } from "./choice-options";
import { evaluateConditionGroup, type FieldConditionMetadataLookup } from "./conditions";
import type { BuilderChoiceOption, BuilderOptionRule, FieldConditionGroup } from "./index";

/**
 * Which answers a choice offers, by condition (docs/.../architecture/chart-facts.md):
 * a rule per answer that shows it only when a condition holds, or disables it
 * when one does. Conditions read other answers and chart facts
 * (./chart-facts.ts), so "offer this answer only to patients 13 to 17" is one
 * rule. Stored once per question as `behavior.optionRules`, on a form field
 * and on every nested question a table column, subform entry or layout cell
 * holds (their adapters carry it), and run by FormLogicKit in NHForms.
 */

export type OptionRule = BuilderOptionRule;

/**
 * Option rules with every condition's controller ids renamed (a container's
 * row path ↔ a builder field id); chart facts and unknown ids pass through.
 */
export function mapOptionRuleControllers(rules: readonly OptionRule[], rename: (id: string) => string): OptionRule[] {
  const mapGroup = (group: FieldConditionGroup): FieldConditionGroup => ({
    ...group,
    conditions: group.conditions.map((entry) => {
      if ("conditions" in entry) return mapGroup(entry);
      const condition = { ...entry.condition };
      if (condition.compareFieldId) condition.compareFieldId = rename(condition.compareFieldId);
      if (condition.valueFieldId) condition.valueFieldId = rename(condition.valueFieldId);
      return { controllerFieldId: rename(entry.controllerFieldId), condition };
    }),
  });
  return rules.map((rule) => ({
    value: rule.value,
    ...(rule.showWhen ? { showWhen: mapGroup(rule.showWhen) } : {}),
    ...(rule.disableWhen ? { disableWhen: mapGroup(rule.disableWhen) } : {}),
  }));
}

export type OptionState = "available" | "disabled" | "hidden";

const isGroup = (value: unknown): value is FieldConditionGroup =>
  Boolean(value && typeof value === "object" && Array.isArray((value as FieldConditionGroup).conditions));

/** A question's option rules from any container shape (`behavior.optionRules`, or a nested `optionRules`); malformed rules are dropped. */
export function readOptionRules(source: { behavior?: { optionRules?: unknown } | null; optionRules?: unknown } | null | undefined): OptionRule[] {
  const raw = source?.behavior?.optionRules ?? source?.optionRules;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { value, showWhen, disableWhen } = entry as Record<string, unknown>;
    if (typeof value !== "string" || !value) return [];
    const rule: OptionRule = { value };
    if (isGroup(showWhen) && showWhen.conditions.length) rule.showWhen = showWhen;
    if (isGroup(disableWhen) && disableWhen.conditions.length) rule.disableWhen = disableWhen;
    return rule.showWhen || rule.disableWhen ? [rule] : [];
  });
}

/**
 * A question's option rules as stored, for adapters that copy them between
 * containers: like readOptionRules, but a condition group still being built
 * (no conditions yet) is kept, so an editor can add its first condition.
 */
export function storedOptionRules(source: { behavior?: { optionRules?: unknown } | null; optionRules?: unknown } | null | undefined): OptionRule[] {
  const raw = source?.behavior?.optionRules ?? source?.optionRules;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { value, showWhen, disableWhen } = entry as Record<string, unknown>;
    if (typeof value !== "string" || !value) return [];
    const rule: OptionRule = { value };
    if (isGroup(showWhen)) rule.showWhen = showWhen;
    if (isGroup(disableWhen)) rule.disableWhen = disableWhen;
    return rule.showWhen || rule.disableWhen ? [rule] : [];
  });
}

/** Whether an answer is offered: hidden when its show-when fails, disabled when its disable-when holds. */
export function optionState(
  value: string,
  rules: readonly OptionRule[],
  values: Record<string, unknown>,
  metadata: FieldConditionMetadataLookup = () => undefined,
): OptionState {
  const rule = rules.find((entry) => entry.value === value);
  if (!rule) return "available";
  if (rule.showWhen && !evaluateConditionGroup(rule.showWhen, metadata, values)) return "hidden";
  if (rule.disableWhen && evaluateConditionGroup(rule.disableWhen, metadata, values)) return "disabled";
  return "available";
}

/** The answers a choice offers now, each with whether it is disabled; hidden answers are left out. */
export function availableOptions<T extends BuilderChoiceOption>(
  options: readonly T[],
  rules: readonly OptionRule[],
  values: Record<string, unknown>,
  metadata?: FieldConditionMetadataLookup,
): Array<{ option: T; disabled: boolean }> {
  if (!rules.length) return options.map((option) => ({ option, disabled: false }));
  return options.flatMap((option) => {
    const state = optionState(getOptionValue(option), rules, values, metadata);
    return state === "hidden" ? [] : [{ option, disabled: state === "disabled" }];
  });
}

interface ExclusiveAnswerSource {
  options?: readonly BuilderChoiceOption[] | null;
  cernerConfig?: { firstResponseExclusive?: boolean } | null;
}

/**
 * The stored values of a question's exclusive answers: each answer's
 * `exclusive` flag, given the answers or the question.
 *
 * Given the question, a Cerner `cernerConfig.firstResponseExclusive` (the
 * PowerForm control's `exclude_first_ar`, which only the first answer can
 * carry) is read too, as the same intent: set, it makes the first answer
 * exclusive; cleared, it makes the first answer not exclusive. An editor that
 * knew only the Cerner option changed it last, so it wins for the first
 * answer; the other answers keep their own flags.
 */
export function exclusiveAnswerValues(source: readonly BuilderChoiceOption[] | ExclusiveAnswerSource | null | undefined): string[] {
  const options = Array.isArray(source) ? source : (source as ExclusiveAnswerSource | null | undefined)?.options ?? [];
  const values = options.flatMap((option) => (typeof option === "object" && option !== null && option.exclusive === true ? [getOptionValue(option)] : []));
  const firstResponse = Array.isArray(source) ? undefined : (source as ExclusiveAnswerSource | null | undefined)?.cernerConfig?.firstResponseExclusive;
  if (typeof firstResponse !== "boolean" || !options.length) return values;
  const first = getOptionValue(options[0]);
  if (firstResponse) return values.includes(first) ? values : [first, ...values];
  return values.filter((value) => value !== first);
}

/**
 * The answers after ticking or unticking one, on a question that takes
 * several: an exclusive answer replaces the others, and any other answer
 * clears the exclusive ones.
 */
export function toggleAnswer(selected: readonly string[], value: string, checked: boolean, exclusive: readonly string[]): string[] {
  if (!checked) return selected.filter((entry) => entry !== value);
  if (exclusive.includes(value)) return [value];
  return [...selected.filter((entry) => entry !== value && !exclusive.includes(entry)), value];
}
