import type {
  BuilderNamedCondition,
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

/**
 * Whether one cell (or nested value) holds an answer. Same rules as
 * EditableTable / FormLogicKit's tableCellAnswered: an unchecked checkbox
 * (false), a blank string, NaN and an empty list/object are not answers.
 */
function isConditionCellAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.some(isConditionCellAnswered);
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).trim() !== "";
}

/**
 * Whether one entry of a collection answer (a table row, a multi-select item)
 * holds a real answer. On a row, keys starting with "_" are bookkeeping
 * (_rowId, _sourceKey, _complete, _formulaOverrides, ...), never answers.
 * Kept in parity with the ConditionalGroup and FormLogicKit NHForms and the
 * exporter's cross-field helper (shared vectors in condition-empty-parity.test.tsx).
 */
export function isConditionEntryMeaningful(value: unknown): boolean {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return Object.keys(record).some((key) => !key.startsWith("_") && isConditionCellAnswered(record[key]));
  }
  return isConditionCellAnswered(value);
}

/** A table's rows (array or `{ rows: [...] }`) or a multi-select's items; undefined for scalars. */
function conditionCollectionEntries(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as { rows?: unknown }).rows)) {
    return (value as { rows: unknown[] }).rows;
  }
  return undefined;
}

/**
 * "is empty" for any answer. Collections (table rows, multi-select items) are
 * empty unless some entry holds a real answer, so a table whose only row is
 * blank or holds only meta keys has "no items". Scalars and coded objects keep
 * the comparable-value rule (blank string / null / undefined is empty).
 */
export function isConditionValueEmpty(value: unknown): boolean {
  const entries = conditionCollectionEntries(value);
  if (entries) return !entries.some(isConditionEntryMeaningful);
  const normalized = normalizeConditionComparable(value);
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

// ---------- Named condition references ----------
// A group with `conditionRef` carries a MATERIALIZED copy of the named
// condition it points at. Consumers read the copy; authoring code refreshes it
// with materializeConditionRefs. Broken refs (missing, cyclic, too deep, or an
// empty definition) keep their stale copy and are reported, never emptied.

export type NamedConditionLibrary = ReadonlyArray<BuilderNamedCondition>;

export interface ConditionRefIssue {
  /**
   * missing: the id is not in the library. cycle: the definition (transitively)
   * references itself. depth: nesting exceeded maxDepth. empty: the definition
   * has no conditions yet (half-authored), so the stale copy is kept.
   */
  kind: "missing" | "cycle" | "depth" | "empty";
  ref: string;
  /** Ref ids from the outermost reference down to `ref` (a cycle repeats its first id). */
  path: string[];
}

/** Default limit on nested named-condition references (not group nesting). */
export const NAMED_CONDITION_MAX_DEPTH = 16;

function cloneConditionGroup(group: FieldConditionGroup): FieldConditionGroup {
  return JSON.parse(JSON.stringify(group)) as FieldConditionGroup;
}

function isConditionGroupEntry(entry: unknown): entry is FieldConditionGroup {
  return Boolean(entry) && typeof entry === "object" && Array.isArray((entry as FieldConditionGroup).conditions);
}

/** Structural equality over JSON-like condition data (key order insensitive, undefined keys ignored). */
export function conditionDataEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    return a.length === other.length && a.every((value, index) => conditionDataEqual(value, other[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] === undefined && right[key] === undefined) continue;
    if (!conditionDataEqual(left[key], right[key])) return false;
  }
  return true;
}

/** A group that references `named`, carrying a materialized copy of its definition. */
export function createConditionRefGroup(named: BuilderNamedCondition): FieldConditionGroup {
  const copy = cloneConditionGroup(named.group);
  return { ...copy, conditionRef: named.id };
}

/** Every named-condition id referenced by `group` or any nested group, first-seen order. */
export function collectConditionRefs(group: FieldConditionGroup): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  const walk = (entry: FieldConditionGroup): void => {
    if (entry.conditionRef && !seen.has(entry.conditionRef)) {
      seen.add(entry.conditionRef);
      refs.push(entry.conditionRef);
    }
    for (const child of entry.conditions ?? []) {
      if (child && typeof child === "object" && "conditions" in child) walk(child);
    }
  };
  walk(group);
  return refs;
}

/**
 * Refs written directly in `group`: nested ref groups are reported but their
 * materialized copies are not descended into (those are the definition's own
 * edges, not this group's).
 */
export function collectDirectConditionRefs(group: FieldConditionGroup): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  const walk = (entry: FieldConditionGroup, top: boolean): void => {
    if (entry.conditionRef && !top) {
      if (!seen.has(entry.conditionRef)) {
        seen.add(entry.conditionRef);
        refs.push(entry.conditionRef);
      }
      return;
    }
    for (const child of entry.conditions ?? []) {
      if (isConditionGroupEntry(child)) walk(child, false);
    }
  };
  // A library definition whose top level is itself a ref is an alias edge.
  if (group.conditionRef) return [group.conditionRef];
  walk(group, true);
  return refs;
}

/**
 * Refresh every ref's materialized copy from `library`.
 * On missing/cycle keep the stale cached copy and report an issue (never produce an empty group).
 * Returns the SAME group object when nothing changed (structural sharing below).
 */
export function materializeConditionRefs(
  group: FieldConditionGroup,
  library: NamedConditionLibrary,
  options?: { maxDepth?: number },
): { group: FieldConditionGroup; changed: boolean; issues: ConditionRefIssue[] } {
  const maxDepth = options?.maxDepth ?? NAMED_CONDITION_MAX_DEPTH;
  const byId = new Map(library.map((named) => [named.id, named]));
  const issues: ConditionRefIssue[] = [];
  const issueKeys = new Set<string>();
  const report = (issue: ConditionRefIssue) => {
    const key = `${issue.kind}:${issue.path.join(">")}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push(issue);
  };

  // Materialize the children of `entry` (not its own ref).
  const materializeChildren = (entry: FieldConditionGroup, stack: string[]): FieldConditionGroup => {
    if (!Array.isArray(entry.conditions)) return entry;
    let changed = false;
    const conditions = entry.conditions.map((child) => {
      if (!isConditionGroupEntry(child)) return child;
      const next = materializeGroup(child, stack);
      if (next !== child) changed = true;
      return next;
    });
    return changed ? { ...entry, conditions } : entry;
  };

  const materializeGroup = (entry: FieldConditionGroup, stack: string[]): FieldConditionGroup => {
    const ref = entry.conditionRef;
    if (!ref) return materializeChildren(entry, stack);
    const path = [...stack, ref];
    if (stack.includes(ref)) {
      report({ kind: "cycle", ref, path });
      return entry;
    }
    if (stack.length >= maxDepth) {
      report({ kind: "depth", ref, path });
      return entry;
    }
    const named = byId.get(ref);
    if (!named || !isConditionGroupEntry(named.group)) {
      report({ kind: "missing", ref, path });
      // Nested refs inside the stale copy may still resolve.
      return materializeChildren(entry, path);
    }
    const before = issues.length;
    const definition = materializeGroup(named.group, path);
    const brokenCycle = issues.slice(before).some((issue) => issue.kind === "cycle" && issue.path.includes(ref) && issue.path[issue.path.length - 1] === ref);
    if (brokenCycle) return entry;
    if (!definition.conditions.length) {
      report({ kind: "empty", ref, path });
      return materializeChildren(entry, path);
    }
    const fresh: FieldConditionGroup = {
      match: definition.match === "any" ? "any" : "all",
      conditions: cloneConditionGroup(definition).conditions,
      conditionRef: ref,
    };
    return conditionDataEqual(fresh, entry) ? entry : fresh;
  };

  const next = materializeGroup(group, []);
  return { group: next, changed: next !== group, issues };
}

/** Turn a reference into an ordinary inline group (keeps its current copy). */
export function detachConditionRef(group: FieldConditionGroup): FieldConditionGroup {
  const { conditionRef: _conditionRef, ...rest } = group;
  return rest;
}

/**
 * Reference cycles in the library, each as the list of ids forming the loop
 * (first id repeated at the end, rotated to start at the smallest id).
 * Only direct edges count: a definition's nested copies are not followed.
 */
export function findNamedConditionCycles(library: NamedConditionLibrary): string[][] {
  const edges = new Map<string, string[]>();
  for (const named of library) {
    edges.set(named.id, isConditionGroupEntry(named.group) ? collectDirectConditionRefs(named.group) : []);
  }
  const cycles: string[][] = [];
  const seenCycles = new Set<string>();
  const state = new Map<string, "active" | "done">();
  const stack: string[] = [];
  const visit = (id: string) => {
    state.set(id, "active");
    stack.push(id);
    for (const next of edges.get(id) ?? []) {
      if (!edges.has(next)) continue; // missing ref, not a cycle
      const nextState = state.get(next);
      if (nextState === "active") {
        const loop = stack.slice(stack.indexOf(next));
        const minIndex = loop.reduce((best, value, index) => (value < loop[best] ? index : best), 0);
        const rotated = [...loop.slice(minIndex), ...loop.slice(0, minIndex)];
        const key = rotated.join(">");
        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          cycles.push([...rotated, rotated[0]]);
        }
      } else if (!nextState) {
        visit(next);
      }
    }
    stack.pop();
    state.set(id, "done");
  };
  for (const named of library) {
    if (!state.has(named.id)) visit(named.id);
  }
  return cycles;
}

/** Evaluate after materializing refs from `library` (stale copies are used when a ref is broken). */
export function evaluateConditionGroupWithLibrary(
  group: FieldConditionGroup,
  library: NamedConditionLibrary,
  metadata: FieldConditionMetadataLookup,
  values: Record<string, unknown>,
): boolean {
  return evaluateConditionGroup(materializeConditionRefs(group, library).group, metadata, values);
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
