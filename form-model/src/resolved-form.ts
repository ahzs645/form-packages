import type {
  BuilderDefaultAnswer,
  BuilderDocument,
  BuilderField,
  BuilderFieldBinding,
  FieldConditionGroup,
  FieldLinkRule,
} from "./index";
import { answerListOf, type AnswerList } from "./answer-list";
import {
  readLockCondition,
  visibilityRuleToFieldLinkConditions,
  type VisibilityControllerKindLookup,
} from "./conditions";
import { readDefaultAnswer } from "./defaults";
import { readFieldBinding } from "./bindings";
import { FIELD_TYPE_PROFILES, neutralAnswerTypeOf, type FieldRole, type NeutralAnswerType } from "./field-types";
import { controllerKindLookupOf, type ControllerKind, type ControllerKindInput } from "./controller-kind";
import type { StoredFormula } from "./formula/ast";
import { readFormulaStore } from "./formula/store";
import { readFormLifecycle, type FormLifecycle, type FormLifecycleSources } from "./lifecycle";
import { readOptionRules, type OptionRule } from "./option-rules";
import { readFormStructure, walkStructure, type FormStructureContext, type NeutralStructure, type StructureSection } from "./structure";
import { formLogicOf, type FormLogicInput, type NeutralFormInput } from "./targets";
import { readFormTranslations, type FormTranslations } from "./translations";
import { readFieldValidation, type NeutralFieldValidation } from "./validation";
import { readSubmitActions, type SubmitAction, type SubmitActionsContext } from "./workflow";

/**
 * The resolved form: the one analysis pass between the builder document and
 * every export target (docs/.../architecture/resolved-form.md).
 *
 * Each neutral reader (structure, validation, defaults, bindings, option
 * rules, formulas, submit actions, lifecycle, translations) already reads one
 * concept from every store that holds it. `analyzeForm` runs them once over
 * the whole form and adds the readings no single reader owned — what kind of
 * controller a field is to a condition, what answers it offers, and which
 * rules from the three rule stores act on it — so a target compiles from one
 * reading of the form instead of deriving its own. A target keeps only its
 * own policy (AlayaCare's orphan sweep, Cerner's flat sections, a flat
 * Docmosis block list) as a pass over this reading, and reports what it
 * cannot express as a `<target>.<concept>.*` loss.
 *
 * Pure: it never changes the document. Results are cached by the document
 * object, the Logic-tab rule list and the context, so repeated calls during
 * one export are free; a new document object is a new reading.
 */

// ---------------------------------------------------------------------------
// Rules from the three stores
// ---------------------------------------------------------------------------

/** Ids of the rules a field stores on itself (as the Logic tab lists them). */
export const FIELD_VISIBILITY_RULE_PREFIX = "field-visibility:";
export const LOCK_CONDITION_RULE_PREFIX = "lock-condition:";

/** A rule read from a field's own store (show-when or lock), not the Logic tab. */
export function isFieldStoredRule(rule: Pick<FieldLinkRule, "id">): boolean {
  return rule.id.startsWith(FIELD_VISIBILITY_RULE_PREFIX) || rule.id.startsWith(LOCK_CONDITION_RULE_PREFIX);
}

function firstLeaf(group: FieldConditionGroup): { controllerFieldId: string; condition: FieldLinkRule["condition"] } | null {
  for (const entry of group.conditions) {
    if ("conditions" in entry) {
      const nested = firstLeaf(entry);
      if (nested) return nested;
    } else return entry;
  }
  return null;
}

type RuleSourceField = Pick<BuilderField, "id" | "label" | "visibility" | "lockCondition" | "lockWhen">;

/** A field's show-when rule as a field-link rule (id `field-visibility:<id>`), or null. */
export function fieldVisibilityRule(field: RuleSourceField, controllerKind: VisibilityControllerKindLookup): FieldLinkRule | null {
  const visibility = field.visibility;
  const conditions = visibilityRuleToFieldLinkConditions(visibility, controllerKind);
  if (!visibility || !conditions) return null;
  return {
    id: `${FIELD_VISIBILITY_RULE_PREFIX}${field.id}`,
    ...conditions,
    ...(visibility.hiddenAnswerPolicy ? { hiddenAnswerPolicy: visibility.hiddenAnswerPolicy } : {}),
    targetFieldIds: [field.id],
    action: "show",
    description: `Visibility: ${field.label || field.id}`,
  };
}

/** A field's lock condition (`readLockCondition`, legacy `lockWhen` included) as a "set read-only" rule on both protection modes, or null. */
export function fieldLockRule(field: RuleSourceField, controllerKind: VisibilityControllerKindLookup): FieldLinkRule | null {
  const group = readLockCondition(field, controllerKind);
  const first = group ? firstLeaf(group) : null;
  if (!group || !first) return null;
  return {
    id: `${LOCK_CONDITION_RULE_PREFIX}${field.id}`,
    controllerFieldId: first.controllerFieldId,
    condition: first.condition,
    conditionGroup: group,
    targetFieldIds: [field.id],
    action: "set-readonly",
    protectionMode: "both",
    description: `Lock: ${field.label || field.id}`,
  };
}

/**
 * The rules the fields store on themselves — every show-when rule, then every
 * lock condition — as field-link rules, without the ones a Logic-tab rule
 * with the same id replaces (as the preview runs them).
 */
export function storedFieldRules(
  fields: readonly RuleSourceField[],
  logicTabRules: readonly FieldLinkRule[] = [],
  controllerKind: VisibilityControllerKindLookup = controllerKindLookupOf(fields as Iterable<ControllerKindInput & { id: string }>),
): FieldLinkRule[] {
  const replaced = new Set(logicTabRules.map((rule) => rule.id));
  const inline = fields.flatMap((field) => fieldVisibilityRule(field, controllerKind) ?? []);
  const locks = fields.flatMap((field) => fieldLockRule(field, controllerKind) ?? []);
  return [...inline, ...locks].filter((rule) => !replaced.has(rule.id));
}

/** What acts on one field, from the three rule stores. */
export interface FieldRules {
  /**
   * What decides whether it shows: its Logic-tab Show and Hide rules when any
   * target it (they replace its own rule, as `isFieldHiddenByLogic` reads
   * them), else its own show-when rule; `none` when nothing hides it.
   */
  visibilitySource: "logic-tab" | "field" | "none";
  /** The Show and Hide rules in force (see `visibilitySource`). */
  visibility: FieldLinkRule[];
  /** Its own show-when rule, even when Logic-tab rules replace it. */
  ownVisibility: FieldLinkRule | null;
  /** Its lock condition, as a "set read-only" rule. */
  lock: FieldLinkRule | null;
  /** Every other Logic-tab rule that targets it (set value, require, read-only, invalid…). */
  actions: FieldLinkRule[];
}

/** The rules acting on `field` (see `FieldRules`). */
export function readFieldRules(
  field: RuleSourceField,
  logicTabRules: readonly FieldLinkRule[] = [],
  controllerKind: VisibilityControllerKindLookup = () => undefined,
): FieldRules {
  const targeting = logicTabRules.filter((rule) => Array.isArray(rule?.targetFieldIds) && rule.targetFieldIds.includes(field.id));
  const showHide = targeting.filter((rule) => rule.action === "show" || rule.action === "hide");
  const replacedIds = new Set(logicTabRules.map((rule) => rule.id));
  const ownVisibility = fieldVisibilityRule(field, controllerKind);
  const ownLock = fieldLockRule(field, controllerKind);
  const lock = ownLock && replacedIds.has(ownLock.id) ? targeting.find((rule) => rule.id === ownLock.id) ?? null : ownLock;
  return {
    visibilitySource: showHide.length ? "logic-tab" : ownVisibility ? "field" : "none",
    visibility: showHide.length ? showHide : ownVisibility ? [ownVisibility] : [],
    ownVisibility,
    lock,
    actions: targeting.filter((rule) => rule.action !== "show" && rule.action !== "hide" && rule.id !== lock?.id),
  };
}

// ---------------------------------------------------------------------------
// The resolved form
// ---------------------------------------------------------------------------

export interface ResolvedFieldPlacement {
  /** 0-based page. */
  page: number;
  /** The innermost section, or null for a field no section claims. */
  sectionId: string | null;
  /** The innermost subgroup, or null. */
  subgroupId: string | null;
}

/** One field of the form, every neutral reading of it in one place. Each reading is computed on first use. */
export interface ResolvedField {
  id: string;
  field: BuilderField;
  role: FieldRole | null;
  answerType: NeutralAnswerType | null;
  controllerKind: ControllerKind | undefined;
  answerList: AnswerList | null;
  /** Where the structure places it; null when the structure does not reach it (a field a subform module asks). */
  placement: ResolvedFieldPlacement | null;
  readonly validation: NeutralFieldValidation;
  readonly defaultAnswer: BuilderDefaultAnswer | null;
  readonly binding: BuilderFieldBinding | null;
  readonly optionRules: OptionRule[];
  /** A computed field's formula tree (null for any other field, or a formula that does not parse). */
  readonly formula: StoredFormula | null;
  readonly rules: FieldRules;
}

export interface ResolvedForm {
  document: BuilderDocument;
  /** The Logic-tab rules (empty when the caller passed none). */
  fieldLinkRules: readonly FieldLinkRule[];
  /** The form's logic outside its fields (`formLogicOf`). */
  logic: FormLogicInput;
  /** Pages → sections → subgroups → items (`readFormStructure`, the canonical walk). */
  readonly structure: NeutralStructure;
  /** Every top-level document field, in document order. */
  fields: ReadonlyMap<string, ResolvedField>;
  field(id: string): ResolvedField | undefined;
  /** The controller kind of any document field (`controllerKindOf`). */
  controllerKind: (id: string) => ControllerKind | undefined;
  /** The rules the fields store on themselves (`storedFieldRules`), Logic-tab ids winning. */
  readonly storedRules: FieldLinkRule[];
  /** Logic-tab rules, then the stored ones: every rule the form runs. */
  readonly rules: FieldLinkRule[];
  /** What happens on submit (`readSubmitActions`). */
  readonly submitActions: SubmitAction[];
  readonly lifecycle: FormLifecycle;
  readonly translations: FormTranslations;
}

/**
 * What the app supplies: the nested-field adapters (lib/form-structure.ts),
 * the component resolvers the submit-action reader takes, and the computed
 * formula reader (lib/computed-field-config.ts). Each is optional; pass one
 * stable object (lib/resolved-form.ts) so the cache is shared.
 */
export interface ResolvedFormContext extends FormStructureContext, Pick<SubmitActionsContext, "componentProps"> {
  /** A computed field's formula, read with the form's field types. Default: its `computedConfig` store. */
  computedFormula?: (field: BuilderField, fields: readonly BuilderField[]) => StoredFormula | null;
  lifecycleSources?: FormLifecycleSources;
}

function lazy<T extends object, K extends keyof T>(target: T, key: K, compute: () => T[K]): void {
  let done = false;
  let value: T[K];
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: false,
    get() {
      if (!done) {
        value = compute();
        done = true;
      }
      return value;
    },
  });
}

function defaultComputedFormula(field: BuilderField): StoredFormula | null {
  const config = field.computedConfig as { expression?: string; formulaTree?: unknown } | undefined;
  const value = field.calculatedValue as { expression?: string; formulaTree?: unknown } | undefined;
  const text = value?.expression ?? config?.expression ?? "";
  return readFormulaStore({ text, tree: value?.formulaTree ?? config?.formulaTree }).formula;
}

// Plain literals, not frozen: the generated NHForms kits bundle form-model and
// keep any module-level call.
const NO_RULES: readonly FieldLinkRule[] = [];
const NO_CONTEXT: ResolvedFormContext = {};
const CACHE = new WeakMap<object, WeakMap<object, WeakMap<object, ResolvedForm>>>();

function placementsOf(structure: NeutralStructure): Map<string, ResolvedFieldPlacement> {
  const placements = new Map<string, ResolvedFieldPlacement>();
  const visit = (nodes: StructureSection["children"], page: number, sectionId: string | null, subgroupId: string | null) => {
    for (const node of nodes) {
      if (node.kind === "section") {
        if (node.field) placements.set(node.field.id, { page, sectionId, subgroupId });
        visit(node.children, node.page, node.id, null);
      } else if (node.kind === "subgroup") {
        visit(node.children, page, sectionId, node.id);
      } else if (node.kind === "field") {
        if (!placements.has(node.id)) placements.set(node.id, { page, sectionId, subgroupId });
      } else {
        if (node.field && !placements.has(node.field.id)) placements.set(node.field.id, { page, sectionId, subgroupId });
        node.members.forEach((member) => {
          if (member.documentField && !placements.has(member.id)) placements.set(member.id, { page, sectionId, subgroupId });
        });
      }
    }
  };
  structure.pages.forEach((page) =>
    page.sections.forEach((section) => {
      if (section.field) placements.set(section.field.id, { page: section.page, sectionId: null, subgroupId: null });
      visit(section.children, section.page, section.id, null);
    }),
  );
  return placements;
}

function buildResolvedForm(input: NeutralFormInput, context: ResolvedFormContext): ResolvedForm {
  const { document } = input;
  const fieldLinkRules = input.fieldLinkRules ?? NO_RULES;
  const fields = document.fields ?? [];
  const controllerKind = controllerKindLookupOf(fields);
  const fieldLabel = (id: string) => fields.find((field) => field.id === id)?.label;
  const resolved = {
    document,
    fieldLinkRules,
    logic: formLogicOf(input),
    controllerKind,
  } as ResolvedForm;

  lazy(resolved, "structure", () => readFormStructure(document, context));
  let placements: Map<string, ResolvedFieldPlacement> | null = null;
  const placementOf = (id: string) => (placements ??= placementsOf(resolved.structure)).get(id) ?? null;

  const byId = new Map<string, ResolvedField>();
  for (const field of fields) {
    if (!field?.id || byId.has(field.id)) continue;
    const entry = {
      id: field.id,
      field,
      role: (FIELD_TYPE_PROFILES as Record<string, { role: FieldRole }>)[field.type]?.role ?? null,
      answerType: neutralAnswerTypeOf(field),
      controllerKind: controllerKind(field.id),
      answerList: answerListOf(field),
    } as ResolvedField;
    lazy(entry, "placement", () => placementOf(field.id));
    lazy(entry, "validation", () => readFieldValidation(field, { fieldLinkRules, fieldLabel }));
    lazy(entry, "defaultAnswer", () => readDefaultAnswer(field));
    lazy(entry, "binding", () => readFieldBinding(field));
    lazy(entry, "optionRules", () => readOptionRules(field));
    lazy(entry, "formula", () =>
      field.type === "computed" ? (context.computedFormula ? context.computedFormula(field, fields) : defaultComputedFormula(field)) : null,
    );
    lazy(entry, "rules", () => readFieldRules(field, fieldLinkRules, controllerKind));
    byId.set(field.id, entry);
  }
  resolved.fields = byId;
  resolved.field = (id: string) => byId.get(id);
  lazy(resolved, "storedRules", () => storedFieldRules(fields, fieldLinkRules, controllerKind));
  lazy(resolved, "rules", () => [...fieldLinkRules, ...resolved.storedRules]);
  lazy(resolved, "submitActions", () =>
    readSubmitActions(document, {
      ...(context.componentSubformModule ? { componentSubformModule: context.componentSubformModule } : {}),
      ...(context.componentProps ? { componentProps: context.componentProps } : {}),
    }),
  );
  lazy(resolved, "lifecycle", () => readFormLifecycle(document, context.lifecycleSources ?? {}));
  lazy(resolved, "translations", () => readFormTranslations(document));
  return resolved;
}

/**
 * The whole form, read once (see `ResolvedForm`). Cached by the document
 * object, the Logic-tab rule list and the context object.
 */
export function analyzeForm(input: NeutralFormInput, context: ResolvedFormContext = NO_CONTEXT): ResolvedForm {
  const document = input.document;
  const rulesKey = (input.fieldLinkRules ?? NO_RULES) as object;
  let byRules = CACHE.get(document);
  if (!byRules) CACHE.set(document, (byRules = new WeakMap()));
  let byContext = byRules.get(rulesKey);
  if (!byContext) byRules.set(rulesKey, (byContext = new WeakMap()));
  let resolved = byContext.get(context);
  if (!resolved) byContext.set(context, (resolved = buildResolvedForm(input, context)));
  return resolved;
}

/** Every field item and group container the structure reaches, depth first, in form order. */
export function resolvedFieldOrder(resolved: Pick<ResolvedForm, "structure">): BuilderField[] {
  const order: BuilderField[] = [];
  walkStructure(resolved.structure, (node) => {
    if (node.kind === "field") order.push(node.field);
    else if (node.kind === "group" && node.field) order.push(node.field);
  });
  return order;
}
