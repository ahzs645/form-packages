/**
 * The form-logic runtime: the meaning of conditions, show-when rules,
 * hidden answers, answer conditions, chart facts, value formats and
 * submit-time checks over the compiled contract an exported form carries
 * (compiled condition groups, `config.checks`, table columns as the runtime
 * tables get them, and answers read through a getter).
 *
 * It composes the reference readers of this package and adds only what is
 * about the runtime's data: nested answer lookup, the registered chart
 * source, and copy-on-write edits of the answers object. The NHForms
 * `FormLogicKit` is generated from this module (with its DOM helpers) by
 * scripts/generate-form-logic-kit.mjs, so the exported MOIS form decides
 * exactly what the builder decides. Must stay free of DOM and React.
 */

import {
  evaluateConditionTree,
  evaluateVisibilityRule as evaluateVisibilityRuleWith,
  hasHiddenAnswer,
  hiddenAnswerPolicyOf as hiddenAnswerPolicyOfRules,
  isConditionValueEmpty,
  isLayoutRowVisible as isLayoutRowVisibleWith,
  shouldClearHiddenAnswer,
  shouldDropHiddenAnswer,
  type ConditionTree,
  type ConditionValueGetter,
  type HiddenAnswerPolicySource,
  type LayoutRowVisibleWhenSource,
  type VisibilityRuleSource,
} from "./conditions";
import { chartFactValues as patientChartFactValues, isChartFactId } from "./chart-facts";
import { chartConceptMatches, type ChartConceptDefinition } from "./chart-concepts";
import {
  answerCheckProblems,
  DEFAULT_FORMAT_MESSAGES,
  matchesValueFormat,
  readDateAnswer,
  type AnswerChecks,
  type NeutralValueFormat,
} from "./validation";

export { hasHiddenAnswer, shouldClearHiddenAnswer, shouldDropHiddenAnswer, isChartFactId, chartConceptMatches };

type AnswerRecord = Record<string, unknown>;
type GetterSource = ConditionValueGetter | AnswerRecord | null | undefined;

// ---------------------------------------------------------------------------
// Reading answers
// ---------------------------------------------------------------------------

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/** "is empty" for any answer (isConditionValueEmpty). */
export const isEmptyValue = (value: unknown): boolean => isConditionValueEmpty(value);
export const hasMeaningfulValue = (value: unknown): boolean => !isConditionValueEmpty(value);

/**
 * An answer by field id: the direct key first, then a nested search (some
 * legacy forms keep a section's answers in a nested object).
 */
export function readValue(data: unknown, fieldId: string): unknown {
  if (!data || !fieldId || typeof data !== "object") return undefined;
  if (hasOwn(data, fieldId)) return (data as AnswerRecord)[fieldId];
  for (const value of Object.values(data as AnswerRecord)) {
    if (value && typeof value === "object") {
      const nested = readValue(value, fieldId);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

/** A getter, or a getter over an answers object. */
function toGetter(source: GetterSource): ConditionValueGetter {
  return typeof source === "function" ? source : (id) => readValue(source ?? {}, id);
}

// ---------------------------------------------------------------------------
// Chart facts
// ---------------------------------------------------------------------------

/** The patient in source data (sd.patient, or the query result's first patient), or a plain { sex, birthDate }. */
function chartPatientOf(sourceData: unknown) {
  if (!sourceData || typeof sourceData !== "object") return null;
  const data = sourceData as AnswerRecord;
  const queryPatient = (data.queryResult as { patient?: unknown[] } | undefined)?.patient?.[0];
  const patient = (data.patient ?? queryPatient) as AnswerRecord | undefined;
  if (patient && typeof patient === "object") {
    return {
      sex: patient.administrativeGender ?? patient.gender ?? patient.sex,
      birthDate: patient.birthDate,
      conditions: patient.conditions,
      longTermMedications: patient.longTermMedications,
    } as Parameters<typeof patientChartFactValues>[0];
  }
  return "sex" in data || "birthDate" in data || "conditions" in data || "longTermMedications" in data
    ? (data as Parameters<typeof patientChartFactValues>[0])
    : null;
}

/** The preview's assessment date (the workspace's patient test values) at the current time of day; real MOIS has none. */
function previewAsOf(sourceData: unknown): Date | undefined {
  const raw = (sourceData as { previewOptions?: { chartFactsAsOf?: unknown } } | null)?.previewOptions?.chartFactsAsOf;
  const match = typeof raw === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim()) : null;
  if (!match) return undefined;
  const now = new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), now.getHours(), now.getMinutes());
}

let chartConcepts: ChartConceptDefinition[] = [];
let chartConceptsKey = "";
let activeChartSource: unknown = null;
let activeChartFacts: Record<string, unknown> | null = null;
let activeChartStamp = "";

/** Every chart fact's value, keyed by controller id; facts the chart lacks are left out. `concepts` defaults to the registered ones. */
export function chartFactValues(sourceData: unknown, explicitAsOf?: Date | null, concepts?: ChartConceptDefinition[] | null): Record<string, unknown> {
  const patient = chartPatientOf(sourceData);
  if (!patient) return {};
  const asOf = explicitAsOf instanceof Date ? explicitAsOf : previewAsOf(sourceData) ?? new Date();
  return patientChartFactValues(patient, asOf, Array.isArray(concepts) ? concepts : chartConcepts);
}

/** The concepts whose facts this form reads: [{ name, group, rules }]. Called on every render; the same list keeps the cache. */
export function setChartConcepts(concepts: unknown): void {
  const next = Array.isArray(concepts)
    ? (concepts.filter((concept) => concept && typeof (concept as { name?: unknown }).name === "string") as ChartConceptDefinition[])
    : [];
  const key = JSON.stringify(next);
  if (key === chartConceptsKey) return;
  chartConceptsKey = key;
  chartConcepts = next;
  activeChartFacts = null;
}

/** The form's source data, registered by the generated form root for rules evaluated where no getter reads the chart. */
export function setChartSource(sourceData: unknown): void {
  if (sourceData === activeChartSource) return;
  activeChartSource = sourceData || null;
  activeChartFacts = null;
}

function activeChartFact(id: string): unknown {
  // Ages move with the clock: recompute at most once a minute.
  const now = new Date();
  const stamp = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}T${now.getHours()}:${now.getMinutes()}`;
  if (!activeChartFacts || activeChartStamp !== stamp) {
    activeChartFacts = chartFactValues(activeChartSource);
    activeChartStamp = stamp;
  }
  return activeChartFacts[id];
}

/** A chart fact from the registered source data; undefined for any other id. */
export function chartFact(id: string): unknown {
  return isChartFactId(id) ? activeChartFact(id) : undefined;
}

/** A getter that answers chart-fact ids from the chart and everything else as before. */
export function withChartFacts(getValue: GetterSource, sourceData?: unknown, asOf?: Date | null): ConditionValueGetter {
  const get = toGetter(getValue);
  let facts: Record<string, unknown> | null = null;
  return (id) => {
    if (!isChartFactId(id)) return get(id);
    if (!facts) facts = chartFactValues(sourceData, asOf);
    return facts[id];
  };
}

/** The getter rules run against: an answer the form holds, else a chart fact from the registered source. */
function ruleGetter(getValue: GetterSource): ConditionValueGetter {
  const get = toGetter(getValue);
  return (id) => {
    const value = get(id);
    return value === undefined && isChartFactId(id) ? activeChartFact(id) : value;
  };
}

// ---------------------------------------------------------------------------
// Conditions and show-when rules
// ---------------------------------------------------------------------------

/** Evaluate a (compiled or builder-shape) condition group. Missing or empty group: false. */
export function evaluateGroup(group: unknown, getValue: GetterSource): boolean {
  return evaluateConditionTree(group as ConditionTree, ruleGetter(getValue));
}

export interface VisibilityRuleOptions {
  /** The controller's kind: "boolean", "checkbox", "choice", "number", "text" or undefined. */
  controllerKind?: (controllerId: string) => string | null | undefined;
}

/**
 * Whether a builder show-when rule (BuilderVisibilityRule) shows its target.
 * No rule, "always" or no controller: shown.
 */
export function evaluateVisibilityRule(rule: unknown, getValue: GetterSource, options: VisibilityRuleOptions = {}): boolean {
  if (!rule || typeof rule !== "object") return true;
  const kind = typeof options?.controllerKind === "function" ? options.controllerKind : () => undefined;
  return evaluateVisibilityRuleWith(rule as VisibilityRuleSource, ruleGetter(getValue), kind);
}

/** Whether a layout-table row is shown (its `visibleWhen`). No controller: shown. */
export function isLayoutRowVisible(visibleWhen: unknown, getValue: GetterSource): boolean {
  return isLayoutRowVisibleWith(visibleWhen as LayoutRowVisibleWhenSource, toGetter(getValue));
}

/**
 * Whether one gate passes. A gate is a compiled condition group (a subgroup
 * gate), or a nested entry's own show condition: { layoutRow: visibleWhen }
 * or { visibility: rule, controllerKinds } read with the container's answer kinds.
 */
export function gatePasses(gate: unknown, getValue: GetterSource): boolean {
  if (!gate || typeof gate !== "object") return true;
  const get = toGetter(getValue);
  const record = gate as { layoutRow?: unknown; visibility?: unknown; controllerKinds?: Record<string, string> };
  if (record.layoutRow) return isLayoutRowVisible(record.layoutRow, get);
  if (record.visibility) {
    const kinds = record.controllerKinds || {};
    return evaluateVisibilityRule(record.visibility, get, { controllerKind: (id) => (hasOwn(kinds, id) ? kinds[id] : undefined) });
  }
  return evaluateGroup(gate, get);
}

interface CompiledRule extends ConditionTree {
  action?: string;
  hiddenAnswerPolicy?: string | null;
  copyFromFieldId?: string;
  copyPolicy?: string;
}

interface FieldBehaviorConfig {
  hidden?: boolean;
  gates?: unknown[];
  rules?: CompiledRule[];
}

/** Whether a field is hidden by its compiled behaviour: hidden, a failed gate, no matching show rule, or a matching hide rule. */
export function isFieldHidden(config: FieldBehaviorConfig | null | undefined, getValue: GetterSource): boolean {
  if (!config) return false;
  const get = toGetter(getValue);
  const rules = config.rules || [];
  const showRules = rules.filter((rule) => rule.action === "show");
  return Boolean(
    config.hidden ||
      (config.gates || []).some((gate) => !gatePasses(gate, get)) ||
      (showRules.length > 0 && !showRules.some((rule) => evaluateGroup(rule, get))) ||
      rules.some((rule) => rule.action === "hide" && evaluateGroup(rule, get)),
  );
}

// ---------------------------------------------------------------------------
// Hidden answers
// ---------------------------------------------------------------------------

/** "clear" when any show/hide rule (or a rule without an action: a field rule, a page) asks to clear. */
export function hiddenAnswerPolicyOf(rules: unknown): "clear" | "preserve" {
  const list = Array.isArray(rules) ? rules : rules ? [rules] : [];
  return hiddenAnswerPolicyOfRules(list as HiddenAnswerPolicySource[]);
}

/** Remove the stored answers of `fieldIds` from a data object (an Immer draft). Mutates; returns the ids it removed. */
export function clearHiddenAnswers(data: unknown, fieldIds: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const record = data as AnswerRecord;
  return (Array.isArray(fieldIds) ? (fieldIds as string[]) : []).filter((id) => {
    if (!hasHiddenAnswer(record[id])) return false;
    delete record[id];
    return true;
  });
}

const pathSegments = (path: unknown) => String(path || "").split(".").map((part) => part.trim()).filter(Boolean);

function valueAtPath(data: unknown, path: unknown): unknown {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as AnswerRecord)[key] : undefined), data);
}

function setValueAtPath(row: AnswerRecord, path: unknown, value: unknown): void {
  const segments = pathSegments(path);
  if (segments.length === 0) return;
  let current = row;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    const next = current[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) current[key] = {};
    current = current[key] as AnswerRecord;
  }
  current[segments[segments.length - 1]] = value;
}

/** `data` with the value at a dotted path replaced, copying each level (never mutates). */
function withValueAtPath(data: unknown, path: unknown, value: unknown): unknown {
  const segments = pathSegments(path);
  if (segments.length === 0) return data;
  const write = (node: unknown, index: number): AnswerRecord => {
    const copy: AnswerRecord = node && typeof node === "object" && !Array.isArray(node) ? { ...(node as AnswerRecord) } : {};
    copy[segments[index]] = index === segments.length - 1 ? value : write(copy[segments[index]], index + 1);
    return copy;
  };
  return write(data, 0);
}

/** `data` without the answer at a dotted path, copying each level; `data` itself when nothing is stored there. */
function withoutValueAtPath(data: unknown, path: unknown): unknown {
  const segments = pathSegments(path);
  if (segments.length === 0) return data;
  const remove = (node: unknown, index: number): unknown => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const record = node as AnswerRecord;
    const key = segments[index];
    if (!hasOwn(record, key)) return node;
    if (index === segments.length - 1) {
      if (!hasHiddenAnswer(record[key])) return node;
      const copy = { ...record };
      delete copy[key];
      return copy;
    }
    const child = remove(record[key], index + 1);
    return child === record[key] ? node : { ...record, [key]: child };
  };
  return remove(data, 0);
}

/** `data` without one answer: data[fieldId], and the value at `path` when given. Copies; `data` itself when nothing was stored. */
function withoutAnswer(data: AnswerRecord, fieldId: string | undefined, path?: string): AnswerRecord {
  let next = data;
  if (fieldId && hasHiddenAnswer(next[fieldId])) {
    next = { ...next };
    delete next[fieldId];
  }
  return (path ? withoutValueAtPath(next, path) : next) as AnswerRecord;
}

// ---------------------------------------------------------------------------
// Runtime tables (EditableTable / RepeatForEachTable columns)
// ---------------------------------------------------------------------------

/** One cell (or nested value) holds an answer: an unchecked box, blank text and NaN do not. */
function tableCellAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return !Number.isNaN(value);
  if (Array.isArray(value)) return value.some(tableCellAnswered);
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

const rowStarted = (row: unknown) =>
  Boolean(row) && typeof row === "object" && Object.keys(row as AnswerRecord).some((key) => key.charAt(0) !== "_" && tableCellAnswered((row as AnswerRecord)[key]));

interface RuntimeTableColumn {
  id?: string;
  dataPath?: string;
  fieldName?: string;
  type?: string;
  visibility?: (VisibilityRuleSource & { hiddenAnswerPolicy?: string }) | null;
  options?: unknown[];
  optionRules?: unknown[];
  choiceBooleanTargets?: Record<string, string>;
}

interface TableRowOptions {
  columns?: RuntimeTableColumn[];
  formData?: unknown;
  sourceData?: unknown;
  asOf?: Date | null;
}

const tableColumnPath = (column: RuntimeTableColumn | null | undefined) => (column && (column.dataPath || column.fieldName || column.id)) || "";

/** How a rule naming a table column compares its answers. */
export function tableColumnKind(column: RuntimeTableColumn | null | undefined): string | undefined {
  const type = column && column.type;
  if (!type) return undefined;
  if (type === "checkbox" || type === "booleanYesNo" || type === "booleanSingle") return "boolean";
  if (type === "dropdown" || type === "choice") return "choice";
  if (type === "number") return "number";
  return "text";
}

/** What a rule on one row reads: a sibling column by row path, else the row, else the form's answers, else a chart fact. */
function tableRowGetter(row: unknown, options: TableRowOptions = {}) {
  const columns = Array.isArray(options.columns) ? options.columns : [];
  const sibling = (id: string) => columns.find((entry) => entry && (tableColumnPath(entry) === id || entry.id === id));
  const getValue = (id: string) => {
    const controller = sibling(id);
    if (controller) return valueAtPath(row, tableColumnPath(controller));
    const inRow = valueAtPath(row, id);
    if (inRow !== undefined) return inRow;
    return options.formData ? readValue(options.formData, id) : undefined;
  };
  return { getValue: withChartFacts(getValue, options.sourceData, options.asOf), sibling };
}

/** Whether a table column is shown in one row (its visibility rule, against sibling columns, the row and the form). */
export function isTableColumnVisible(column: RuntimeTableColumn | null | undefined, row: unknown, options: TableRowOptions = {}): boolean {
  const rule = column && column.visibility;
  if (!rule || typeof rule !== "object") return true;
  const { getValue, sibling } = tableRowGetter(row, options);
  return evaluateVisibilityRule(rule, getValue, { controllerKind: (id) => tableColumnKind(sibling(id)) });
}

/**
 * Blank the answers of columns hidden in this row whose rule asks for it
 * (hiddenAnswerPolicy "clear"), plus their choiceBooleanTargets. Repeats
 * until settled. Mutates and returns `row`.
 */
export function clearHiddenTableAnswers<T>(row: T, columns: unknown, options: TableRowOptions = {}): T {
  if (!row || typeof row !== "object") return row;
  const list = (Array.isArray(columns) ? columns : []).filter(Boolean) as RuntimeTableColumn[];
  const clearing = list.filter((column) => column.visibility && column.visibility.hiddenAnswerPolicy === "clear");
  const record = row as unknown as AnswerRecord;
  for (let pass = 0; pass <= clearing.length; pass += 1) {
    let changed = false;
    clearing.forEach((column) => {
      if (isTableColumnVisible(column, record, { columns: list, formData: options.formData })) return;
      const blank = column.type === "checkbox" ? false : "";
      const path = tableColumnPath(column);
      if (valueAtPath(record, path) !== blank) {
        setValueAtPath(record, path, blank);
        changed = true;
      }
      Object.values(column.choiceBooleanTargets || {}).forEach((targetPath) => {
        if (valueAtPath(record, targetPath) === false) return;
        setValueAtPath(record, targetPath, false);
        changed = true;
      });
    });
    if (!changed) break;
  }
  return row;
}

interface HiddenAnswerEntry {
  fieldId?: string;
  rules?: CompiledRule[];
  gates?: unknown[];
  hiddenAnswerPolicy?: string;
  path?: string;
  table?: { rowsPath?: string; columns?: RuntimeTableColumn[] };
  members?: Array<string | { fieldId?: string; path?: string }>;
}

/**
 * In each saved row of a table entry, blank the answers of its columns
 * hidden in that row whose rule says "clear". Rows are copied, never changed
 * in place; returns `data` itself when nothing changes.
 */
export function dropHiddenTableAnswers(data: unknown, entry: HiddenAnswerEntry): unknown {
  const table = entry.table;
  const path = (table && table.rowsPath) || entry.fieldId;
  const stored = valueAtPath(data, path);
  const rows = Array.isArray(stored) ? stored : stored && Array.isArray((stored as { rows?: unknown }).rows) ? (stored as { rows: unknown[] }).rows : null;
  if (!rows || rows.length === 0) return data;
  let changed = false;
  const nextRows = rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const before = JSON.stringify(row);
    const copy = clearHiddenTableAnswers(JSON.parse(before), table?.columns, { formData: data });
    if (JSON.stringify(copy) === before) return row;
    changed = true;
    return copy;
  });
  if (!changed) return data;
  return withValueAtPath(data, path, Array.isArray(stored) ? nextRows : { ...(stored as AnswerRecord), rows: nextRows });
}

/**
 * The answers to save without those of hidden "clear" fields (the save and
 * submit half of the hidden-answer rule). entries: [{ fieldId, rules,
 * gates?, path?, table?, members? }]. Repeats until settled, since a dropped
 * answer can hide another field. Never mutates: returns a copy when
 * something is dropped, otherwise `data` itself.
 */
export function dropHiddenAnswers<T>(data: T, entries: unknown): T {
  if (!data || typeof data !== "object") return data;
  const list = (Array.isArray(entries) ? entries : []).filter((entry) => entry && entry.fieldId) as HiddenAnswerEntry[];
  let next = data as unknown as AnswerRecord;
  for (let pass = 0; pass <= list.length; pass += 1) {
    let changed = false;
    list.forEach((entry) => {
      const policy = entry.hiddenAnswerPolicy || hiddenAnswerPolicyOf(entry.rules);
      const hidden = isFieldHidden({ rules: entry.rules || [], gates: entry.gates || [] }, next);
      if (Array.isArray(entry.members)) {
        if (policy !== "clear" || !hidden) return;
        entry.members.forEach((member) => {
          const id = member && typeof member === "object" ? member.fieldId : member;
          const kept = withoutAnswer(next, id, member && typeof member === "object" ? member.path : undefined);
          if (kept === next) return;
          next = kept;
          changed = true;
        });
        return;
      }
      const stored = entry.path ? valueAtPath(next, entry.path) : undefined;
      if (shouldDropHiddenAnswer(policy, hidden, next[entry.fieldId!]) || shouldDropHiddenAnswer(policy, hidden, stored)) {
        next = withoutAnswer(next, entry.fieldId, entry.path);
        changed = true;
        return;
      }
      if (!entry.table) return;
      const kept = dropHiddenTableAnswers(next, entry) as AnswerRecord;
      if (kept === next) return;
      next = kept;
      changed = true;
    });
    if (!changed) break;
  }
  return next as unknown as T;
}

// ---------------------------------------------------------------------------
// Answer conditions (option rules)
// ---------------------------------------------------------------------------

/** An option's stored value: a text value, code, key, id or state, then a numeric value (a score), then the label. */
export function optionKey(option: unknown): string {
  if (option === null || option === undefined) return "";
  if (typeof option !== "object") return String(option);
  const record = option as AnswerRecord;
  const text = (value: unknown) => (value === null || value === undefined || String(value).trim() === "" ? undefined : String(value));
  const keys = typeof record.value === "number" ? ["code", "key", "id", "state", "value"] : ["value", "code", "key", "id", "state"];
  for (const key of keys) {
    const value = text(record[key]);
    if (value !== undefined) return value;
  }
  return text(record.label) ?? text(record.display) ?? text(record.text) ?? "";
}

interface RuntimeOptionRule {
  value: string;
  showWhen?: ConditionTree;
  disableWhen?: ConditionTree;
}

const hasConditions = (group: unknown) => Boolean(group && typeof group === "object" && Array.isArray((group as ConditionTree).conditions) && (group as ConditionTree).conditions!.length > 0);

/** A question's option rules from a list or any container shape; a rule still being written (no conditions) is no rule. */
function readRuntimeOptionRules(source: unknown): RuntimeOptionRule[] {
  const record = source as { behavior?: { optionRules?: unknown }; optionRules?: unknown } | null | undefined;
  const raw = Array.isArray(source) ? source : record && (record.behavior?.optionRules ?? record.optionRules);
  return Array.isArray(raw)
    ? (raw.filter((rule) => rule && typeof rule.value === "string" && (hasConditions(rule.showWhen) || hasConditions(rule.disableWhen))) as RuntimeOptionRule[])
    : [];
}

/** "available", "disabled" or "hidden" for one answer. */
export function optionState(value: unknown, optionRules: unknown, getValue: GetterSource): "available" | "disabled" | "hidden" {
  const rule = readRuntimeOptionRules(optionRules).find((entry) => entry.value === String(value));
  if (!rule) return "available";
  if (hasConditions(rule.showWhen) && !evaluateGroup(rule.showWhen, getValue)) return "hidden";
  if (hasConditions(rule.disableWhen) && evaluateGroup(rule.disableWhen, getValue)) return "disabled";
  return "available";
}

/**
 * The answers a choice offers now: hidden ones left out, disabled ones
 * marked `disabled: true` (a string option becomes { key, text, … }).
 * Unchanged (the same array) when there are no rules.
 */
export function availableOptions<T>(options: T[], optionRules: unknown, getValue: GetterSource): T[] {
  const rules = readRuntimeOptionRules(optionRules);
  if (!Array.isArray(options) || rules.length === 0) return options;
  return options.flatMap((option) => {
    const state = optionState(optionKey(option), rules, getValue);
    if (state === "hidden") return [];
    if (state !== "disabled") return [option];
    if (typeof option === "object" && option !== null) return [{ ...option, disabled: true }];
    const text = String(option);
    return [{ key: text, text, code: text, display: text, label: text, value: text, disabled: true } as unknown as T];
  });
}

/** Whether a stored answer (one value or several) includes an answer that is not offered now. */
export function hasUnavailableAnswer(value: unknown, optionRules: unknown, getValue: GetterSource): boolean {
  const rules = readRuntimeOptionRules(optionRules);
  if (rules.length === 0) return false;
  // Codings ({ code }), subform selections ({ selectedKey }) and plain values.
  const answerKey = (entry: unknown) =>
    entry && typeof entry === "object"
      ? ((entry as AnswerRecord).code ?? (entry as AnswerRecord).selectedKey ?? (entry as AnswerRecord).key ?? (entry as AnswerRecord).value ?? (entry as AnswerRecord).display ?? "")
      : entry;
  const selected = (Array.isArray(value) ? value : [value])
    .map(answerKey)
    .filter((entry) => entry !== undefined && entry !== null && String(entry).trim() !== "")
    .map(String);
  return selected.some((entry) => optionState(entry, rules, getValue) !== "available");
}

/** A column as one row offers it: its options filtered by its option rules. */
export function withAvailableColumnOptions(column: RuntimeTableColumn, row: unknown, options: TableRowOptions = {}): RuntimeTableColumn {
  if (!column || !Array.isArray(column.optionRules) || column.optionRules.length === 0 || !Array.isArray(column.options)) return column;
  const { getValue } = tableRowGetter(row || {}, options);
  const offered = availableOptions(column.options, column.optionRules, getValue);
  return offered === column.options ? column : { ...column, options: offered };
}

// ---------------------------------------------------------------------------
// Copy-value rules
// ---------------------------------------------------------------------------

interface CopyRuleConfig {
  fieldId: string;
  rules?: CompiledRule[];
}

/**
 * Copy rules resolve together (targets may sit on unmounted pages); a cycle
 * is reported as a form-level problem. A field locked now (`locks[fieldId]`)
 * is never copied into.
 */
export function resolveFieldCopies(configs: CopyRuleConfig[], original: unknown, locks: Record<string, unknown> = {}): { values: unknown; error: string } {
  const next = JSON.parse(JSON.stringify(original || {})) as AnswerRecord & { __fieldCopyState?: Record<string, { value: unknown; edited: boolean }> };
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  for (let pass = 0; pass < Math.min(configs.length + 2, 100); pass += 1) {
    const before = JSON.stringify(next);
    for (const config of configs) {
      if (locks && locks[config.fieldId]) continue;
      const rules = config.rules || [];
      const matches = (rule: CompiledRule) => evaluateGroup(rule, (id) => readValue(next, id));
      let protectedField = false;
      rules.forEach((rule) => {
        if (matches(rule) && (rule.action === "set-readonly" || rule.action === "clear-readonly")) {
          protectedField = rule.action === "set-readonly";
        }
      });
      if (protectedField) continue;
      const rule = [...rules].reverse().find((candidate) => candidate.action === "copy-value" && candidate.copyFromFieldId !== config.fieldId && matches(candidate));
      if (!rule) continue;
      const source = readValue(next, rule.copyFromFieldId!);
      const value = readValue(next, config.fieldId);
      if (source === undefined || same(source, value)) continue;
      const state = next.__fieldCopyState?.[config.fieldId];
      const edited = state?.edited || (state && !same(value, state.value));
      const policy = rule.copyPolicy || "when-empty";
      const mayCopy = policy === "always" || (policy === "until-edited" ? !edited && (state || !hasMeaningfulValue(value)) : !hasMeaningfulValue(value));
      if (mayCopy) {
        next[config.fieldId] = JSON.parse(JSON.stringify(source));
        next.__fieldCopyState = { ...next.__fieldCopyState, [config.fieldId]: { value: source, edited: false } };
      } else if (policy === "until-edited" && edited && !state?.edited) {
        next.__fieldCopyState = { ...next.__fieldCopyState, [config.fieldId]: { ...state!, edited: true } };
      }
    }
    if (before === JSON.stringify(next)) return { values: next, error: "" };
  }
  return { values: original, error: "Copy rules did not settle. Check the dependency map for a cycle." };
}

// ---------------------------------------------------------------------------
// Value formats and submit-time checks
// ---------------------------------------------------------------------------

/** Value formats keyed by format id: { test(value), message }. An unknown format never raises an issue. */
export const formats: Record<NeutralValueFormat, { message: string; test: (value: unknown) => boolean }> = Object.fromEntries(
  (Object.keys(DEFAULT_FORMAT_MESSAGES) as NeutralValueFormat[]).map((format) => [
    format,
    { message: DEFAULT_FORMAT_MESSAGES[format], test: (value: unknown) => matchesValueFormat(format, value) },
  ]),
) as Record<NeutralValueFormat, { message: string; test: (value: unknown) => boolean }>;

/**
 * How many rows a repeat-for-each table would have for the current answers,
 * counted from its source table: rows with an answered cell that pass the
 * filter and have a non-empty key.
 */
export function repeatItemCount(values: unknown, repeatFor: { sourceFieldId?: string; sourceRowsPath?: string; filter?: unknown; keyColumnId?: string } | null | undefined): number {
  if (!repeatFor || !repeatFor.sourceFieldId) return 0;
  const data = values || {};
  const raw = repeatFor.sourceRowsPath ? valueAtPath(data, repeatFor.sourceRowsPath) : readValue(data, repeatFor.sourceFieldId);
  const rows: unknown[] = Array.isArray(raw) ? raw : raw && Array.isArray((raw as { rows?: unknown }).rows) ? (raw as { rows: unknown[] }).rows : [];
  const filter = repeatFor.filter;
  const keyText = (value: unknown): string => {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(keyText).filter(Boolean).join(", ");
    if (typeof value === "object") {
      const record = value as AnswerRecord;
      return keyText(record.display ?? record.text ?? record.value ?? record.code ?? record.key ?? "");
    }
    return String(value);
  };
  return rows.filter((row, index) => {
    if (!row || typeof row !== "object" || !rowStarted(row)) return false;
    if (hasConditions(filter) && !evaluateConditionTree(filter as ConditionTree, (columnId) => valueAtPath(row, columnId))) return false;
    const key = repeatFor.keyColumnId ? keyText(valueAtPath(row, repeatFor.keyColumnId)) : String((row as AnswerRecord)._rowId || `row_${index}`);
    return key !== "";
  }).length;
}

export interface FormValidationIssue {
  fieldId: string;
  label: string;
  message: string;
  pageIndex?: number;
  kind: string;
}

interface CompiledFieldValidationConfig extends FieldBehaviorConfig {
  fieldId: string;
  label: string;
  pageIndex?: number;
  required?: boolean;
  requiredCapable?: boolean;
  checks?: AnswerChecks | null;
  /** Older compiled shape, without `checks`. */
  validations?: Array<{ validWhen?: ConditionTree; message: string; translations?: Record<string, string> }>;
  format?: string;
  formatMessage?: string;
  optionRules?: unknown[];
  table?: { requiredColumnIds?: string[]; requireAllComplete?: boolean; columns?: RuntimeTableColumn[] };
}

export interface ValidateOptions {
  pageIndex?: number;
  inactivePages?: number[];
  locale?: string;
  uiTranslations?: Record<string, Record<string, string>>;
  /** The form's translateFormText; wins over uiTranslations. */
  translate?: (source: string) => string | null | undefined;
  today?: Date | string;
  /** The form's source data, for rules that read chart facts. */
  sourceData?: unknown;
  asOf?: Date | null;
}

type Issue = (kind: string, message: string) => FormValidationIssue;

function tableRowIssues(
  config: CompiledFieldValidationConfig,
  value: unknown,
  required: boolean | undefined,
  issue: Issue,
  translate: (source: string) => string,
  values: unknown,
): FormValidationIssue[] {
  const rows: unknown[] = Array.isArray(value) ? value : Array.isArray((value as { rows?: unknown } | null)?.rows) ? (value as { rows: unknown[] }).rows : [];
  const counted = rows.filter((row) => row && !(row as AnswerRecord)._sourceRemoved && ((row as AnswerRecord)._sourceKey || rowStarted(row))) as AnswerRecord[];
  if (counted.length === 0) return required ? [issue("required", translate(`${config.label} is required`))] : [];
  const table = config.table!;
  const paths = table.requiredColumnIds || [];
  if (!table.requireAllComplete || paths.length === 0) return [];
  // A column hidden in a row (its visibility rule) is not required there.
  const tableColumns = Array.isArray(table.columns) ? table.columns.filter(Boolean) : [];
  const shown = (row: AnswerRecord, path: string) => {
    const column = tableColumns.find((entry) => tableColumnPath(entry) === path || entry.id === path);
    return !column || isTableColumnVisible(column, row, { columns: tableColumns, formData: values });
  };
  // One issue per table naming every incomplete row: "Adherence: complete Metformin, Atorvastatin and row 4".
  const names = counted
    .filter((row) => !paths.every((path) => !shown(row, path) || tableCellAnswered(valueAtPath(row, path))))
    .map((row) => (row._sourceLabel ? String(row._sourceLabel) : `row ${rows.indexOf(row) + 1}`));
  if (names.length === 0) return [];
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return [issue("row-incomplete", translate(`${config.label}: complete ${list}`))];
}

/**
 * Validate answers against compiled field configs. A config with `checks`
 * is checked like validateAnswer: an empty answer only meets the required
 * check and Logic-tab invalid rules, a non-empty one every value check.
 * Without `checks` the older keys (`validations`, `format`) apply.
 */
export function validate(configs: unknown, values: unknown, options: ValidateOptions = {}): FormValidationIssue[] {
  const list = (Array.isArray(configs) ? configs : []) as CompiledFieldValidationConfig[];
  const locale = options.locale || "";
  const uiTranslations = options.uiTranslations || {};
  const translate =
    typeof options.translate === "function"
      ? (source: string) => options.translate!(source) || source
      : (source: string) => uiTranslations[locale]?.[source] || source;
  const inactivePages = new Set(Array.isArray(options.inactivePages) ? options.inactivePages : []);
  const scoped = list.filter((config) => {
    const pageIndex = typeof config.pageIndex === "number" ? config.pageIndex : 0;
    if (inactivePages.has(pageIndex)) return false;
    return typeof options.pageIndex === "number" ? pageIndex === options.pageIndex : true;
  });
  const copyResult = resolveFieldCopies(list, values);
  if (copyResult.error) return [{ fieldId: "_form", label: "", message: copyResult.error, kind: "rule" }];
  const get = withChartFacts((id) => readValue(values, id), options.sourceData, options.asOf);
  const today = options.today instanceof Date ? options.today : readDateAnswer(options.today) ?? new Date();
  return scoped.flatMap((config) => {
    if (isFieldHidden(config, get)) return [];
    const issue: Issue = (kind, message) => ({ fieldId: config.fieldId, label: config.label, message, pageIndex: config.pageIndex, kind });
    let required = config.required;
    (config.rules || []).forEach((rule) => {
      if (!evaluateGroup(rule, get)) return;
      if (rule.action === "set-required") required = config.requiredCapable !== false;
      if (rule.action === "clear-required") required = false;
    });
    const value = get(config.fieldId);
    if (config.table) return tableRowIssues(config, value, required, issue, translate, values);
    const checks = config.checks && typeof config.checks === "object" ? config.checks : null;
    // A behavior validation ("valid-when") keeps the issue kind "rule" the
    // error summary re-checks live; a Logic-tab invalid rule is "cross-field".
    const toIssue = (problem: ReturnType<typeof answerCheckProblems>[number]) =>
      issue(problem.crossFieldKind === "valid-when" ? "rule" : problem.kind, problem.defaultMessage ? translate(problem.message) : problem.message);
    if (!hasMeaningfulValue(value)) {
      const missing = required ? [issue("required", translate(checks?.requiredMessage ? checks.requiredMessage : `${config.label} is required`))] : [];
      return checks ? missing.concat(answerCheckProblems(checks, value, get, { emptyAnswer: true, locale }).map(toIssue)) : missing;
    }
    let issues: FormValidationIssue[];
    if (checks) {
      issues = answerCheckProblems(checks, value, get, { today, locale }).map(toIssue);
    } else {
      issues = (config.validations || [])
        .filter((rule) => !evaluateGroup(rule.validWhen, get))
        .map((rule) => issue("rule", rule.translations?.[locale] || rule.message));
      const format = config.format ? formats[config.format as NeutralValueFormat] : null;
      if (format && !format.test(value)) issues.push(issue("format", config.formatMessage || translate(format.message || `${config.label} is not valid`)));
    }
    if (hasUnavailableAnswer(value, config.optionRules, get)) issues.push(issue("option", translate(`${config.label}: choose an available option`)));
    return issues;
  });
}
