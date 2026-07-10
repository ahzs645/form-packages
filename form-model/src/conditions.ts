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

export function normalizeConditionComparable(candidate: unknown): unknown {
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
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
  metadata?: FieldConditionMetadata,
): "yes" | "no" | undefined {
  if (value === true) return "yes";
  if (value === false) return "no";

  if (value && typeof value === "object" && "code" in value) {
    const coding = value as { code?: string; display?: string };
    const code = coding.code?.toLowerCase();
    if (code === "y" || code === "yes" || code === "true" || code === "1") return "yes";
    if (code === "n" || code === "no" || code === "false" || code === "0") return "no";
    const display = coding.display?.toLowerCase();
    if (display === "yes" || display === "y") return "yes";
    if (display === "no" || display === "n") return "no";
  }

  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["yes", "y", "true", "1", "on", "normal", "positive", "planned"].includes(normalized)) {
    return "yes";
  }
  if (["no", "n", "false", "0", "off", "abnormal", "negative"].includes(normalized)) {
    return "no";
  }
  if (metadata?.booleanLabels) {
    if (normalized === metadata.booleanLabels.on.toLowerCase()) return "yes";
    if (normalized === metadata.booleanLabels.off.toLowerCase()) return "no";
  }
  return undefined;
}

export function isConditionValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function evaluateNumericCondition(
  type: FieldLinkConditionType,
  leftValue: unknown,
  rightValue: unknown,
): boolean {
  const left = Number(normalizeConditionComparable(leftValue));
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
    case "equals":
      return String(normalizeConditionComparable(controllerValue) ?? "") === String(value ?? "");
    case "not-equals":
      return String(normalizeConditionComparable(controllerValue) ?? "") !== String(value ?? "");
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
  const entries = [
    { controllerFieldId: rule.controllerFieldId, condition: rule.condition },
    ...(rule.additionalConditions ?? []),
  ];
  const evaluate = (entry: (typeof entries)[number]) =>
    evaluateFieldCondition(
      entry.condition,
      values[entry.controllerFieldId],
      metadataByFieldId(entry.controllerFieldId),
    );
  return (rule.conditionMatch ?? "all") === "any"
    ? entries.some(evaluate)
    : entries.every(evaluate);
}
