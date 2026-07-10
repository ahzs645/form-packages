import type {
  FieldLinkCondition,
  FieldLinkConditionType,
  FieldLinkRule,
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
  controllerFieldId: string;
  type: FieldLinkConditionType;
  optionValues?: string[];
  value?: string | number | boolean;
}

export interface CompiledFieldLinkConditionGroup {
  conditions: SerializedFieldLinkCondition[];
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
    "controllerFieldId" | "condition" | "additionalConditions" | "conditionMatch"
  >,
): CompiledFieldLinkConditionGroup {
  const conditions = [
    { controllerFieldId: rule.controllerFieldId, condition: rule.condition },
    ...(rule.additionalConditions ?? []),
  ].map(({ controllerFieldId, condition }) => ({
    controllerFieldId,
    type: condition.type,
    ...(condition.optionValues?.length ? { optionValues: condition.optionValues } : {}),
    ...(condition.value !== undefined && condition.value !== null
      ? { value: condition.value }
      : {}),
  }));

  return {
    conditions,
    match: rule.conditionMatch === "any" ? "any" : "all",
  };
}

export function compileFieldLinkVisibilityRule(
  rule: Pick<
    FieldLinkRule,
    "controllerFieldId" | "condition" | "additionalConditions" | "conditionMatch" | "action"
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

function evaluateNumericCondition(
  type: FieldLinkConditionType,
  leftValue: unknown,
  rightValue: unknown,
): boolean {
  const normalized = normalizeConditionComparable(leftValue);
  if (normalized === null || normalized === undefined || normalized === "") return false;
  const left = Number(normalized);
  const right = Number(rightValue);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
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

export function evaluateFieldLinkRuleCondition(
  rule: Pick<
    FieldLinkRule,
    "controllerFieldId" | "condition" | "additionalConditions" | "conditionMatch"
  >,
  metadataByFieldId: FieldConditionMetadataLookup,
  values: Record<string, unknown>,
): boolean {
  const compiled = compileFieldLinkConditionGroup(rule);
  const evaluate = (entry: SerializedFieldLinkCondition) =>
    evaluateFieldCondition(
      entry,
      values[entry.controllerFieldId],
      metadataByFieldId(entry.controllerFieldId),
    );
  return compiled.match === "any"
    ? compiled.conditions.some(evaluate)
    : compiled.conditions.every(evaluate);
}
