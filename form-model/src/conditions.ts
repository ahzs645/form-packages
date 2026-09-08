import type {
  FieldLinkCondition,
  FieldLinkConditionType,
  FieldLinkRule,
  FieldConditionGroup,
} from "./index";

export interface FieldConditionMetadata {
  booleanLabels?: { on: string; off: string } | null;
}

export type FieldConditionMetadataLookup = (
  fieldId: string,
) => FieldConditionMetadata | undefined;

/**
 * UI-independent condition entry consumed by exported NHForms condition
 * components. This is deliberately flat so it can be JSON-serialized into
 * generated JSX without leaking the builder's nested condition shape.
 */
export interface SerializedFieldLinkCondition {
  valueFieldId?: string;
  controllerFieldId: string;
  type: FieldLinkConditionType;
  optionValues?: string[];
  value?: string | number | boolean;
  /** Right-hand side comes from this field's answer instead of `value`. */
  compareFieldId?: string;
}

export interface CompiledFieldLinkConditionGroup {
  conditions: Array<SerializedFieldLinkCondition | CompiledFieldLinkConditionGroup>;
  match: "all" | "any";
}

export interface CompiledFieldLinkVisibilityRule extends CompiledFieldLinkConditionGroup {
  invertMatch: boolean;
}

export interface CompiledFieldLinkProtectionRule extends CompiledFieldLinkConditionGroup {
  action: "set-readonly" | "clear-readonly";
  protectionMode: "readOnly" | "disabled" | "both";
}

/** Compile a builder rule into the stable JSON contract used by NHForms. */
export function compileFieldLinkConditionGroup(
  rule: Pick<
    FieldLinkRule,
    "controllerFieldId" | "condition" | "additionalConditions" | "conditionMatch" | "conditionGroup"
  >,
): CompiledFieldLinkConditionGroup {
  if (rule.conditionGroup) {
    const compile = (group: FieldConditionGroup): CompiledFieldLinkConditionGroup => ({
      match: group.match,
      conditions: group.conditions.map(entry => "conditions" in entry ? compile(entry) : ({
        controllerFieldId: entry.controllerFieldId, ...entry.condition,
        value: entry.condition.value ?? undefined,
      })),
    });
    return compile(rule.conditionGroup);
  }
  const conditions = [
    { controllerFieldId: rule.controllerFieldId, condition: rule.condition },
    ...(rule.additionalConditions ?? []),
  ].map(({ controllerFieldId, condition }) => ({
    controllerFieldId,
    type: condition.type,
    ...(condition.valueFieldId ? { valueFieldId: condition.valueFieldId } : {}),
    ...(condition.optionValues?.length ? { optionValues: condition.optionValues } : {}),
    ...(condition.value !== undefined && condition.value !== null
      ? { value: condition.value }
      : {}),
    ...(condition.compareFieldId ? { compareFieldId: condition.compareFieldId } : {}),
  }));

  return {
    conditions,
    match: rule.conditionMatch === "any" ? "any" : "all",
  };
}

export function compileFieldLinkVisibilityRule(
  rule: Pick<
    FieldLinkRule,
    "controllerFieldId" | "condition" | "additionalConditions" | "conditionMatch" | "conditionGroup" | "action"
  >,
): CompiledFieldLinkVisibilityRule {
  if (rule.action !== "show" && rule.action !== "hide") {
    throw new Error(`Cannot compile ${rule.action} as a field visibility rule`);
  }
  return {
    ...compileFieldLinkConditionGroup(rule),
    invertMatch: rule.action === "hide",
  };
}

export function compileFieldLinkProtectionRule(
  rule: Pick<
    FieldLinkRule,
    | "controllerFieldId"
    | "condition"
    | "additionalConditions"
    | "conditionMatch"
    | "conditionGroup"
    | "action"
    | "protectionMode"
  >,
): CompiledFieldLinkProtectionRule {
  if (rule.action !== "set-readonly" && rule.action !== "clear-readonly") {
    throw new Error(`Cannot compile ${rule.action} as a field protection rule`);
  }
  return {
    ...compileFieldLinkConditionGroup(rule),
    action: rule.action,
    protectionMode: rule.protectionMode ?? "both",
  };
}

export function normalizeConditionComparable(candidate: unknown): unknown {
  // Match the exported ConditionalGroup helper exactly. Arrays deliberately
  // reach this object branch and normalize to an empty scalar; choice operators
  // use normalizeConditionChoiceValues instead and retain array membership.
  if (candidate && typeof candidate === "object") {
    const record = candidate as Record<string, unknown>;
    return record.code ?? record.display ?? record.value ?? record.text ?? "";
  }
  return candidate;
}

export function normalizeConditionChoiceValues(candidate: unknown): string[] {
  if (Array.isArray(candidate)) {
    return candidate.flatMap(normalizeConditionChoiceValues);
  }
  if (candidate && typeof candidate === "object") {
    const record = candidate as Record<string, unknown>;
    return [record.code, record.display, record.value, record.text]
      .filter((entry) => entry !== undefined && entry !== null)
      .map((entry) => String(entry));
  }
  if (candidate === undefined || candidate === null) return [];
  return [String(candidate)];
}

export function normalizeConditionBoolean(
  value: unknown,
  _metadata?: FieldConditionMetadata,
): "yes" | "no" | undefined {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeConditionBoolean(
      record.code ?? record.display ?? record.value ?? record.text ?? record.label,
    );
  }
  if (value === true || value === "yes" || value === "Y" || value === 1) return "yes";
  if (value === false || value === "no" || value === "N" || value === 0) return "no";
  return undefined;
}

export function isConditionValueEmpty(value: unknown): boolean {
  const normalized = normalizeConditionComparable(value);
  if (Array.isArray(normalized)) return normalized.length === 0;
  if (normalized && typeof normalized === "object") return Object.keys(normalized).length === 0;
  return normalized === null || normalized === undefined || String(normalized).trim() === "";
}

/**
 * Numbers where both sides are numeric, dates otherwise. Cross-field rules are
 * mostly about dates ("discharge before admission"), and Number("2026-01-02")
 * is NaN, so an ordered comparison that only knew numbers could never express
 * the commonest case.
 */
function toOrderedPair(leftValue: unknown, rightValue: unknown): [number, number] | null {
  const left = Number(leftValue);
  const right = Number(rightValue);
  if (Number.isFinite(left) && Number.isFinite(right)) return [left, right];
  const leftDate = Date.parse(String(leftValue));
  const rightDate = Date.parse(String(rightValue));
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) return [leftDate, rightDate];
  return null;
}

function evaluateNumericCondition(
  type: FieldLinkConditionType,
  leftValue: unknown,
  rightValue: unknown,
): boolean {
  const normalized = normalizeConditionComparable(leftValue);
  if (normalized === null || normalized === undefined || normalized === "") return false;
  // An empty right-hand side means the other answer is not given yet; comparing
  // against nothing would raise an error about a question nobody has answered.
  if (isConditionValueEmpty(rightValue)) return false;
  const pair = toOrderedPair(normalized, rightValue);
  if (!pair) return false;
  const [left, right] = pair;
  if (type === "number-gt") return left > right;
  if (type === "number-gte") return left >= right;
  if (type === "number-lt") return left < right;
  if (type === "number-lte") return left <= right;
  return left === right;
}

export function evaluateFieldCondition(
  condition: FieldLinkCondition,
  controllerValue: unknown,
  metadata?: FieldConditionMetadata,
): boolean {
  const { type, optionValues, value } = condition;
  switch (type) {
    case "boolean-yes":
      return normalizeConditionBoolean(controllerValue, metadata) === "yes";
    case "boolean-no":
      return normalizeConditionBoolean(controllerValue, metadata) === "no";
    case "choice-selected": {
      if (!optionValues?.length) return false;
      const values = normalizeConditionChoiceValues(controllerValue);
      return optionValues.some((option) => values.includes(option));
    }
    case "choice-not-selected": {
      if (!optionValues?.length) return true;
      const values = normalizeConditionChoiceValues(controllerValue);
      return !optionValues.some((option) => values.includes(option));
    }
    case "number-gt":
    case "number-gte":
    case "number-lt":
    case "number-lte":
    case "number-equals":
      return evaluateNumericCondition(type, controllerValue, value);
    case "equals": {
      const normalized = normalizeConditionComparable(controllerValue);
      if (normalized === null || normalized === undefined || normalized === "") return false;
      return String(normalized) === String(value ?? "");
    }
    case "not-equals": {
      const normalized = normalizeConditionComparable(controllerValue);
      if (normalized === null || normalized === undefined || normalized === "") return false;
      return String(normalized) !== String(value ?? "");
    }
    case "filled":
      return !isConditionValueEmpty(controllerValue);
    case "empty":
      return isConditionValueEmpty(controllerValue);
  }
}

function asConditionValue(value: unknown): string | number | boolean | null {
  const normalized = normalizeConditionComparable(value);
  if (normalized === null || normalized === undefined) return null;
  if (typeof normalized === "number" || typeof normalized === "boolean") return normalized;
  return String(normalized);
}

export function evaluateFieldLinkRuleCondition(
  rule: Pick<
    FieldLinkRule,
    "controllerFieldId" | "condition" | "additionalConditions" | "conditionMatch" | "conditionGroup"
  >,
  metadataByFieldId: FieldConditionMetadataLookup,
  values: Record<string, unknown>,
): boolean {
  return evaluateConditionGroup(getFieldLinkConditionGroup(rule), metadataByFieldId, values);
}

export function getFieldLinkConditionGroup(rule: Pick<FieldLinkRule, "controllerFieldId" | "condition" | "additionalConditions" | "conditionMatch" | "conditionGroup">): FieldConditionGroup {
  return rule.conditionGroup ?? {
    match: rule.conditionMatch ?? "all",
    conditions: [{ controllerFieldId: rule.controllerFieldId, condition: rule.condition }, ...(rule.additionalConditions ?? [])],
  };
}

export function getFieldLinkConditionEntries(rule: Pick<FieldLinkRule, "controllerFieldId" | "condition" | "additionalConditions" | "conditionMatch" | "conditionGroup">): Array<{ controllerFieldId: string; condition: FieldLinkCondition }> {
  const flatten = (group: FieldConditionGroup): Array<{ controllerFieldId: string; condition: FieldLinkCondition }> =>
    group.conditions.flatMap(entry => "conditions" in entry ? flatten(entry) : [entry]);
  return flatten(getFieldLinkConditionGroup(rule));
}

export function evaluateConditionGroup(group: FieldConditionGroup, metadata: FieldConditionMetadataLookup, values: Record<string, unknown>): boolean {
  if (!group.conditions.length) return false;
  const evaluate = (entry: FieldConditionGroup["conditions"][number]): boolean => {
    if ("conditions" in entry) return evaluateConditionGroup(entry, metadata, values);
    const compareFieldId = entry.condition.compareFieldId || entry.condition.valueFieldId;
    if (compareFieldId && isConditionValueEmpty(values[compareFieldId])) return false;
    return evaluateFieldCondition(
      compareFieldId ? { ...entry.condition, value: asConditionValue(values[compareFieldId]) } : entry.condition,
      values[entry.controllerFieldId], metadata(entry.controllerFieldId),
    );
  };
  return group.match === "any" ? group.conditions.some(evaluate) : group.conditions.every(evaluate);
}

/** A blocking error raised by a cross-field rule. */
export interface CrossFieldValidationError {
  /** The field the message is shown against. */
  fieldId: string;
  /** The rule that raised it, so the builder can point at the rule. */
  ruleId: string;
  message: string;
}

/** Fallback when the author has not written a message for the rule. */
export const DEFAULT_CROSS_FIELD_VALIDATION_MESSAGE = "This answer conflicts with another answer.";

/**
 * Evaluate every `invalid` rule against a set of answers.
 *
 * These are the checks a per-field rule cannot make, because the fault is in
 * the relationship between two answers rather than in either one alone:
 * discharge before admission, diastolic above systolic, a dose above the
 * calculated maximum. The rule's condition describes what is *wrong*, so a rule
 * that fires is an error.
 */
export function evaluateCrossFieldValidation(
  rules: Array<Pick<
    FieldLinkRule,
    | "id"
    | "controllerFieldId"
    | "condition"
    | "additionalConditions"
    | "conditionMatch"
    | "targetFieldIds"
    | "action"
    | "validationMessage"
    | "conditionGroup"
  >>,
  values: Record<string, unknown>,
  metadataByFieldId: FieldConditionMetadataLookup = () => undefined,
): CrossFieldValidationError[] {
  const errors: CrossFieldValidationError[] = [];
  for (const rule of rules) {
    if (rule.action !== "invalid") continue;
    if (!evaluateFieldLinkRuleCondition(rule, metadataByFieldId, values)) continue;
    const message = rule.validationMessage?.trim() || DEFAULT_CROSS_FIELD_VALIDATION_MESSAGE;
    for (const fieldId of rule.targetFieldIds) {
      errors.push({ fieldId, ruleId: rule.id, message });
    }
  }
  return errors;
}
