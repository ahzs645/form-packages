import type {
  BuilderDocument,
  BuilderField,
  BuilderWorkflowConfig,
  BuilderWorkflowOutputCondition,
  BuilderWorkflowOutputKind,
  BuilderWorkflowReportDefinition,
  FieldConditionGroup,
  FieldLinkCondition,
} from "./index";
import type { ModuleConfig } from "./layout";
import { readFieldBinding } from "./bindings";

/**
 * Submit actions (neutral form model, "Workflow outputs";
 * docs/.../architecture/runtime/component-and-workflow-writes.md).
 *
 * What happens when a form is submitted, beyond keeping its answers: write
 * an observation or a panel of them, record a calculated value, add a line to
 * the form's document, create a note, task, service episode or event, write
 * another chart record, or notify an outside system. Today the same intent
 * is spelled in several stores, each read by one runtime:
 *
 * | Store | Where | Reads as |
 * | --- | --- | --- |
 * | `workflow.outputs` | the document | one action per output: `dcoObservation` observation, `panelUpdate` observation panel, `calculatedObservation` calculated value, `documentComment` comment, `moisMutation` note, task, episode, event or record write (by its resource), `httpJson` notification; `documentUpdate`, `webformUpdate` and `customMutation` are definitions kept from an import that never run |
 * | `moisOutput` with kind `documentComment` | fields, layout cells | a comment |
 * | `computedConfig.moisCalculated` (enabled) | computed fields | a calculated value |
 * | `observationOutputs` | subform modules (section drafts, SubformScoring component fields) | observations, staged when the subform is completed and written on submit |
 * | `subformDataEntry.action` | data-entry subform modules | a note, task, episode, event or record write, run when the subform is completed |
 * | component props (`__componentPayloads` at runtime) | CodedObservationChoiceField, ValueSetObservationField, ObservationEntryGrid, PanelEntryGrid, ObservationPanelEditor, NarrativeReportBuilder, PastMeasurementField fields | the observations, panel or narrative the component stages for submit |
 *
 * `readSubmitActions` reads all of them into one list of `SubmitAction`s:
 * a kind, the fields it reads (`inputs`), when it runs (`condition`, a
 * neutral condition tree), what it writes (`target`) and where it was read
 * from (`source`). It never changes the document and never throws; a value
 * it does not know is listed in `unknown` (`readSubmitActionsDetails`).
 *
 * Not submit actions here:
 *
 * - A field's own observation write or chart mutation is its chart binding
 *   (`binding.write`, bindings.ts). The details list those writes as
 *   `bindingWrites` so a summary can name them; the binding converters own
 *   them, so the submit-action converters never report them.
 * - Subform `formDataOutputs` copy values into the form's own answers.
 * - Writes a component makes while the form is filled (ChartRecordManager
 *   and its pieces save on click), and form lifecycle steps (save, sign,
 *   close: `workflow.actions`).
 * - Submit behaviour one product holds with no neutral counterpart: a Cerner
 *   build record's task and note type (the task is charted *against*; the
 *   form does not create it), FHIR definition-based or questionnaire-level
 *   extraction kept from an import. These are listed in `targetOnly` and stay
 *   that product's options. AlayaCare's clinical event and alert queue are
 *   AlayaCare form settings, kept in the session rather than the document.
 *
 * This module imports the binding reader and types only.
 */

export const SUBMIT_ACTION_KINDS = [
  "observation",
  "observationPanel",
  "calculatedValue",
  "comment",
  "narrative",
  "note",
  "task",
  "episode",
  "event",
  "recordWrite",
  "notification",
  "definition",
] as const;

/**
 * - `observation`: save one observation (or, from a grid, several codes).
 * - `observationPanel`: save a panel (flowsheet) of observations.
 * - `calculatedValue`: save the form's calculated result (a score).
 * - `comment`: add a line to the form's own document.
 * - `narrative`: the form's narrative text, built from its answers.
 * - `note`: add or update an encounter note (a record of its own).
 * - `task`, `episode`, `event`: create or update a task, a service episode or a service event.
 * - `recordWrite`: write another chart record (contact, preference, prescription, patient details…).
 * - `notification`: send a message to an outside listener (HTTP JSON, Mirth).
 * - `definition`: a definition an import kept for audit; it never runs.
 */
export type SubmitActionKind = (typeof SUBMIT_ACTION_KINDS)[number];

export type SubmitActionStore =
  | "workflow.outputs"
  | "field.moisOutput"
  | "field.computedConfig.moisCalculated"
  | "subform.observationOutputs"
  | "subform.action"
  | "component.payload";

/** What an input feeds. */
export type SubmitActionInputRole =
  | "value"
  | "units"
  | "report"
  | "comment"
  | "template"
  | "row"
  | "payload"
  | "response"
  | "reportedBy"
  | "reportedDate";

export interface SubmitActionInput {
  role: SubmitActionInputRole;
  /** A form field id, or an entry, calculation or total id inside the subform that holds the action (`scope`). */
  fieldId: string;
  scope: "form" | "subform";
  /** The payload key, row code or template token the input feeds, when there is one. */
  key?: string;
}

export interface SubmitActionObservation {
  code: string;
  /** The code's system when the store names one; absent means a MOIS observation code. */
  system?: string;
  loinc?: string;
  unit?: string;
  valueType?: "TEXT" | "NUMERIC" | "VALUESET";
  description?: string;
}

export interface SubmitActionTarget {
  /** observation and calculatedValue: the observation written. */
  observation?: SubmitActionObservation;
  /** Several observations: a grid's codes or a panel's rows. */
  observations?: SubmitActionObservation[];
  /** observationPanel: the panel. */
  panel?: { code: string; display?: string; system?: string };
  /**
   * note, task, episode, event, recordWrite: the record, in MOIS's names
   * (the only product whose stores say it today), e.g. `task` / `createTask`.
   */
  record?: { resource: string; mutation: string };
  /** notification: where and how. */
  endpoint?: { url?: string; method?: string; payload?: string; phase?: "beforeSubmit" | "afterSubmit"; failOnError?: boolean };
  /** comment: the line's template or fixed text. */
  text?: string;
}

export interface SubmitActionSource {
  store: SubmitActionStore;
  /** Where in the document, e.g. `workflow.outputs[2]`, `fields[vitals].moisOutput`, `drafts[1].moduleConfig.subformDataEntry.action`. */
  path: string;
  /** The stored id: an output id, a field id, a subform output id. */
  id: string;
  /** The store's own kind, e.g. `dcoObservation`, `moisMutation`, the component key. */
  sourceKind?: string;
  /** The field the store lives on: the field, layout table or component field. */
  fieldId?: string;
  /** For subform stores: the subform (its section, or its component field). */
  container?: { kind: "section" | "component"; id: string; draftIndex?: number; moduleIndex?: number };
  /**
   * The stored gates `condition` was read from: an output's simple gate
   * (`condition`), its condition group (`conditionGroup`), or a field
   * output's `conditionalFieldId` (with `conditionalValues`). A converter that
   * realises only some of them reports the rest.
   */
  gates?: SubmitActionGate[];
}

export type SubmitActionGate = "condition" | "conditionGroup" | "conditionalFieldId";

export interface SubmitAction {
  /** Unique in the reading: `<store>:<stored id>`, a subform's actions prefixed with the subform. */
  id: string;
  kind: SubmitActionKind;
  title: string;
  /** False when the author turned it off (or its subform module is off). Converters skip it. */
  enabled: boolean;
  /** `subformComplete`: when the subform's Complete button is pressed, not on submit. */
  when: "submit" | "subformComplete";
  inputs: SubmitActionInput[];
  /** Runs only while this holds; null: always. */
  condition: FieldConditionGroup | null;
  target: SubmitActionTarget;
  source: SubmitActionSource;
  /** Why it cannot run as stored (no observation code, no note field…); absent when complete. */
  incomplete?: string;
}

/** A field whose own chart binding writes on submit (bindings.ts), named for summaries. */
export interface SubmitBindingWrite {
  fieldId: string;
  /** The observation code the binding writes. */
  observation?: string;
  /** The chart mutation the binding writes (MOIS write target id). */
  mutation?: string;
}

/** Submit behaviour one product holds with no neutral action; it stays that product's option. */
export interface SubmitTargetOnly {
  target: "cerner" | "fhir";
  what: string;
  path: string;
}

export interface SubmitActionsReading {
  actions: SubmitAction[];
  bindingWrites: SubmitBindingWrite[];
  targetOnly: SubmitTargetOnly[];
  /** Stored values this reader does not know (an output kind, an action shape). The census fails on any. */
  unknown: string[];
}

/** What the reader needs from a document. */
export type SubmitActionsDocument = Pick<BuilderDocument, "fields"> & Partial<Pick<BuilderDocument, "drafts" | "workflow">>;

export interface SubmitActionsContext {
  /**
   * The subform module a SubformScoring component field holds, library
   * subforms resolved (lib/form-builder/subform-module-utils.ts
   * `buildLegacySubformModuleFromField`). Without it the field's own props
   * are read.
   */
  componentSubformModule?: (field: BuilderField) => ModuleConfig | null;
  /**
   * A component's props as the export draws it, its library preset resolved
   * (a panel grid's `panelLibraryId`, a narrative's `reportTemplateLibraryId`;
   * lib/mois-export/renderers/field-renderer.ts `resolvePresetBackedComponentProps`).
   * Without it the field's own props are read.
   */
  componentProps?: (componentName: string, props: Record<string, unknown>) => Record<string, unknown>;
  /** Leave `bindingWrites` empty (a caller that only converts actions). */
  skipBindingWrites?: boolean;
}

// ---------------------------------------------------------------------------
// Small readers
// ---------------------------------------------------------------------------

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function valueTypeOf(value: unknown): SubmitActionObservation["valueType"] {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  return upper === "TEXT" || upper === "NUMERIC" || upper === "VALUESET" ? upper : undefined;
}

function observationOf(record: UnknownRecord, codeKey = "observationCode"): SubmitActionObservation | undefined {
  const code = text(record[codeKey]);
  if (!code) return undefined;
  const observation: SubmitActionObservation = { code };
  const system = text(record.system);
  const loinc = text(record.loincCode);
  const unit = text(record.units) || text(record.saveUnits);
  const valueType = valueTypeOf(record.valueType);
  const description = text(record.description) || text(record.saveDescription);
  if (system) observation.system = system;
  if (loinc) observation.loinc = loinc;
  if (unit) observation.unit = unit;
  if (valueType) observation.valueType = valueType;
  if (description) observation.description = description;
  return observation;
}

function input(role: SubmitActionInputRole, fieldId: unknown, scope: "form" | "subform" = "form", key?: string): SubmitActionInput[] {
  const id = text(fieldId);
  if (!id) return [];
  return [{ role, fieldId: id, scope, ...(key ? { key } : {}) }];
}

function uniqueInputs(inputs: SubmitActionInput[]): SubmitActionInput[] {
  const seen = new Set<string>();
  return inputs.filter((entry) => {
    const key = `${entry.role}\u0000${entry.scope}\u0000${entry.fieldId}\u0000${entry.key ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Field ids a workflow template reads: `{data.fieldId}` (and deeper paths, by their first segment). */
function workflowTemplateRefs(template: unknown): string[] {
  const source = typeof template === "string" ? template : "";
  const refs: string[] = [];
  for (const match of source.matchAll(/\{data\.([^}.\s]+)[^}]*\}/g)) if (match[1]) refs.push(match[1]);
  return refs;
}

/** Ids a subform template reads: `{{id}}` (first segment). */
function subformTemplateRefs(template: unknown): string[] {
  const source = typeof template === "string" ? template : "";
  const refs: string[] = [];
  for (const match of source.matchAll(/\{\{\s*([^}\s#/]+)[^}]*\}\}/g)) {
    const root = match[1]?.split(".")[0]?.trim();
    if (root && root !== "else" && root !== "this") refs.push(root);
  }
  return refs;
}

/** The fields a workflow report reads (its field list, its sections, its template). */
function reportInputs(report: BuilderWorkflowReportDefinition | undefined): SubmitActionInput[] {
  if (!report) return [];
  const ids = [
    ...list(report.fieldIds).map(text),
    ...list(report.sections).flatMap((section) => (isRecord(section) ? list(section.fieldIds).map(text) : [])),
    ...workflowTemplateRefs(report.template),
  ].filter(Boolean);
  return ids.map((fieldId) => ({ role: "report" as const, fieldId, scope: "form" as const, key: report.id }));
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/** The codes the MOIS output gate reads as "yes". */
const WORKFLOW_YES_CODES = ["Y", "true", "Yes"];
/** The codes the MOIS output gate's "has value" test reads as no answer. */
const WORKFLOW_FALSE_CODES = ["false", "N"];
const WORKFLOW_CONDITION_OPERATORS = new Set(["truthy", "equals", "notEquals", "yes", "no", "in", "notIn"]);

function leaf(controllerFieldId: string, condition: FieldLinkCondition): FieldConditionGroup["conditions"][number] {
  return { controllerFieldId, condition };
}

/**
 * A workflow output's gate (`{ fieldId, operator, value, values }`, the
 * generated form's `workflowConditionPasses`) as a neutral condition tree.
 * The gate compares codes (a coded answer by its code), and a multi-select
 * passes when any selected code matches:
 *
 * - `truthy` (the default): answered and not `false` or `N`;
 * - `equals` / `notEquals`: the value is (is not) selected;
 * - `yes` / `no`: `Y`, `true` or `Yes` is (is not) selected;
 * - `in` / `notIn`: one of the values is (none is) selected.
 *
 * Null when there is no gate (no controller field).
 */
export function workflowOutputConditionToGroup(condition: BuilderWorkflowOutputCondition | null | undefined): FieldConditionGroup | null {
  if (!isRecord(condition)) return null;
  const fieldId = text(condition.fieldId);
  if (!fieldId) return null;
  const operator = typeof condition.operator === "string" && WORKFLOW_CONDITION_OPERATORS.has(condition.operator) ? condition.operator : "truthy";
  const values = list(condition.values).map((entry) => String(entry));
  const single = condition.value === undefined || condition.value === null ? "" : String(condition.value);
  const group = (conditions: FieldConditionGroup["conditions"]): FieldConditionGroup => ({ match: "all", conditions });
  switch (operator) {
    case "equals":
      return group([leaf(fieldId, { type: "choice-selected", optionValues: [single] })]);
    case "notEquals":
      return group([leaf(fieldId, { type: "choice-not-selected", optionValues: [single] })]);
    case "yes":
      return group([leaf(fieldId, { type: "choice-selected", optionValues: [...WORKFLOW_YES_CODES] })]);
    case "no":
      return group([leaf(fieldId, { type: "choice-not-selected", optionValues: [...WORKFLOW_YES_CODES] })]);
    case "in":
      return group([leaf(fieldId, { type: "choice-selected", optionValues: values })]);
    case "notIn":
      return group([leaf(fieldId, { type: "choice-not-selected", optionValues: values })]);
    default:
      return group([
        leaf(fieldId, { type: "filled" }),
        leaf(fieldId, { type: "choice-not-selected", optionValues: [...WORKFLOW_FALSE_CODES] }),
      ]);
  }
}

function isConditionGroup(value: unknown): value is FieldConditionGroup {
  return isRecord(value) && (value.match === "all" || value.match === "any") && Array.isArray(value.conditions);
}

/** Both gates when both are stored: the simple gate and the condition group must hold. */
function combinedCondition(simple: FieldConditionGroup | null, group: unknown): FieldConditionGroup | null {
  const nested = isConditionGroup(group) && group.conditions.length > 0 ? group : null;
  if (simple && nested) return { match: "all", conditions: [simple, nested] };
  return simple ?? nested;
}

/** A field output's gate: `condition`, else `conditionalFieldId` (in `conditionalValues` when listed, else answered). */
function fieldOutputCondition(output: UnknownRecord): FieldConditionGroup | null {
  if (isRecord(output.condition) && text(output.condition.fieldId)) return workflowOutputConditionToGroup(output.condition as unknown as BuilderWorkflowOutputCondition);
  const fieldId = text(output.conditionalFieldId);
  if (!fieldId) return null;
  const values = list(output.conditionalValues).map((entry) => String(entry));
  return workflowOutputConditionToGroup(values.length ? { fieldId, operator: "in", values } : { fieldId, operator: "truthy" });
}

// ---------------------------------------------------------------------------
// Records: which neutral kind a MOIS resource is
// ---------------------------------------------------------------------------

/** The neutral kind of a record write, by its MOIS resource. */
export function submitActionKindForRecord(resource: unknown): SubmitActionKind {
  switch (text(resource)) {
    case "encounterNote":
      return "note";
    case "task":
      return "task";
    case "serviceEpisode":
      return "episode";
    case "serviceEvent":
      return "event";
    case "dcoObservation":
    case "observation":
      return "observation";
    case "calculatedObservation":
      return "calculatedValue";
    case "observationPanel":
      return "observationPanel";
    default:
      return "recordWrite";
  }
}

function recordInputs(record: UnknownRecord, mapKey: "payloadFields" | "payloadMap", scope: "form" | "subform"): SubmitActionInput[] {
  const inputs: SubmitActionInput[] = [...input("payload", record.payloadFieldId, scope)];
  const map = isRecord(record[mapKey]) ? (record[mapKey] as UnknownRecord) : {};
  for (const [key, fieldId] of Object.entries(map)) inputs.push(...input("payload", fieldId, scope, key));
  return inputs;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

const WORKFLOW_OUTPUT_KIND_LIST = [
  "dcoObservation",
  "documentComment",
  "calculatedObservation",
  "panelUpdate",
  "httpJson",
  "moisMutation",
  "documentUpdate",
  "webformUpdate",
  "customMutation",
] as const satisfies readonly BuilderWorkflowOutputKind[];
// Fails to compile when BuilderWorkflowOutputKind gains a kind this reader does not read.
const EVERY_WORKFLOW_OUTPUT_KIND_READ: Exclude<BuilderWorkflowOutputKind, (typeof WORKFLOW_OUTPUT_KIND_LIST)[number]> extends never ? true : false = true;
const WORKFLOW_OUTPUT_KINDS = new Set<string>(EVERY_WORKFLOW_OUTPUT_KIND_READ ? WORKFLOW_OUTPUT_KIND_LIST : []);

function readWorkflowOutputs(workflow: unknown, reading: SubmitActionsReading) {
  if (workflow === undefined || workflow === null) return;
  if (!isRecord(workflow)) {
    reading.unknown.push("workflow: not an object");
    return;
  }
  const config = workflow as BuilderWorkflowConfig;
  if (config.outputs !== undefined && !Array.isArray(config.outputs)) {
    reading.unknown.push("workflow.outputs: not a list");
    return;
  }
  const reports = new Map(
    list(config.reports)
      .filter(isRecord)
      .map((report) => [text(report.id), report as unknown as BuilderWorkflowReportDefinition] as const)
  );
  list(config.outputs).forEach((raw, index) => {
    const path = `workflow.outputs[${index}]`;
    if (!isRecord(raw)) {
      reading.unknown.push(`${path}: not an object`);
      return;
    }
    const output = raw;
    const kind = text(output.kind);
    if (!WORKFLOW_OUTPUT_KINDS.has(kind)) {
      reading.unknown.push(`${path}.kind: ${kind || "(none)"}`);
      return;
    }
    const id = text(output.id) || `output-${index + 1}`;
    const gates: SubmitActionGate[] = [
      ...(isRecord(output.condition) && text(output.condition.fieldId) ? ["condition" as const] : []),
      ...(isConditionGroup(output.conditionGroup) && output.conditionGroup.conditions.length ? ["conditionGroup" as const] : []),
    ];
    const base = {
      id: `workflow:${id}`,
      title: text(output.title) || id,
      enabled: output.enabled !== false,
      when: "submit" as const,
      condition: combinedCondition(
        workflowOutputConditionToGroup(output.condition as BuilderWorkflowOutputCondition | undefined),
        output.conditionGroup
      ),
      source: { store: "workflow.outputs" as const, path, id, sourceKind: kind, ...(gates.length ? { gates } : {}) },
    };
    const report = reports.get(text(output.reportId));
    switch (kind) {
      case "dcoObservation": {
        const observation = observationOf(output);
        const inputs = [
          ...input("value", output.valueFieldId),
          ...input("units", output.unitsFieldId),
          ...input("report", output.reportFieldId),
          ...reportInputs(report),
        ];
        reading.actions.push({
          ...base,
          kind: "observation",
          inputs: uniqueInputs(inputs),
          target: { ...(observation ? { observation } : {}), ...(!text(output.valueFieldId) && output.value !== undefined ? { text: String(output.value) } : {}) },
          ...(observation ? {} : { incomplete: "has no observation code" }),
        });
        return;
      }
      case "documentComment": {
        const template = text(output.value) || text(output.description);
        const inputs = [
          ...input("value", output.valueFieldId),
          ...workflowTemplateRefs(output.value).map((fieldId) => ({ role: "template" as const, fieldId, scope: "form" as const })),
        ];
        const anchored = Boolean(text(output.valueFieldId) || text((output.condition as UnknownRecord | undefined)?.fieldId));
        reading.actions.push({
          ...base,
          kind: "comment",
          inputs: uniqueInputs(inputs),
          target: template ? { text: template } : {},
          ...(anchored || template ? {} : { incomplete: "has no text and no answer to add" }),
        });
        return;
      }
      case "calculatedObservation": {
        const observation = observationOf(output);
        reading.actions.push({
          ...base,
          kind: "calculatedValue",
          inputs: uniqueInputs([...input("value", output.valueFieldId), ...input("report", output.reportFieldId)]),
          target: observation ? { observation } : {},
          ...(text(output.valueFieldId) ? {} : { incomplete: "has no score field" }),
        });
        return;
      }
      case "panelUpdate": {
        const payload = isRecord(output.payload) ? output.payload : {};
        const panelName = isRecord(payload.panelName) ? payload.panelName : {};
        const rows = list(payload.rowBindings).filter(isRecord);
        const panelCode = text(panelName.code);
        const payloadFields = isRecord(output.payloadFields) ? output.payloadFields : {};
        const inputs = [
          ...input("row", output.valueFieldId),
          ...rows.flatMap((row) => input("row", row.fieldId, "form", text(row.observationCode) || undefined)),
          ...Object.entries(payloadFields).flatMap(([key, fieldId]) => input("payload", fieldId, "form", key)),
        ];
        const observations = rows.map((row) => observationOf(row)).filter((entry): entry is SubmitActionObservation => Boolean(entry));
        reading.actions.push({
          ...base,
          kind: "observationPanel",
          inputs: uniqueInputs(inputs),
          target: {
            ...(panelCode ? { panel: { code: panelCode, ...(text(panelName.display) ? { display: text(panelName.display) } : {}), ...(text(panelName.system) ? { system: text(panelName.system) } : {}) } } : {}),
            ...(observations.length ? { observations } : {}),
          },
          ...(!panelCode
            ? { incomplete: "has no panel code" }
            : !text(output.valueFieldId) && rows.length === 0
              ? { incomplete: "has no rows field or row bindings" }
              : {}),
        });
        return;
      }
      case "httpJson": {
        const url = text(output.endpointUrl);
        const payloadMode = text(output.payloadMode);
        const phase = output.deliveryPhase === "afterSubmit" || output.deliveryPhase === "beforeSubmit"
          ? output.deliveryPhase
          : payloadMode === "mirthNotification" ? "afterSubmit" : "beforeSubmit";
        reading.actions.push({
          ...base,
          kind: "notification",
          inputs: uniqueInputs([...reportInputs(report), ...input("response", output.responseFieldId)]),
          target: {
            endpoint: {
              ...(url ? { url } : {}),
              method: text(output.httpMethod) || "POST",
              ...(payloadMode ? { payload: payloadMode } : {}),
              phase,
              ...(output.failOnError === true ? { failOnError: true } : {}),
            },
          },
          ...(url ? {} : { incomplete: "has no listener URL" }),
        });
        return;
      }
      case "moisMutation": {
        const resource = text(output.resource);
        const mutation = text(output.mutation);
        const actionKind = submitActionKindForRecord(resource);
        const noteField = isRecord(output.payloadFields) ? text(output.payloadFields.note) : "";
        reading.actions.push({
          ...base,
          kind: actionKind,
          inputs: uniqueInputs(recordInputs(output, "payloadFields", "form")),
          target: { record: { resource, mutation } },
          ...(!resource || !mutation
            ? { incomplete: "names no record" }
            : resource === "encounterNote" && !noteField
              ? { incomplete: "has no note field" }
              : {}),
        });
        return;
      }
      default:
        // documentUpdate, webformUpdate, customMutation: kept from an import, never run.
        reading.actions.push({ ...base, kind: "definition", inputs: [], target: {} });
    }
  });
}

/** A document comment on a field, a layout cell or a field in a cell (`moisOutput` kind `documentComment`). */
function readCommentOutput(owner: UnknownRecord, ownerId: string, path: string, hostFieldId: string, reading: SubmitActionsReading) {
  const output = owner.moisOutput;
  if (!isRecord(output) || output.kind !== "documentComment") return;
  const template = text(output.commentTemplate);
  reading.actions.push({
    id: `field.moisOutput:${ownerId}`,
    kind: "comment",
    title: text(owner.label) || ownerId,
    enabled: output.enabled !== false,
    when: "submit",
    inputs: uniqueInputs([
      ...input("value", ownerId),
      ...workflowTemplateRefs(template).map((fieldId) => ({ role: "template" as const, fieldId, scope: "form" as const })),
    ]),
    condition: fieldOutputCondition(output),
    target: template ? { text: template } : {},
    source: {
      store: "field.moisOutput",
      path: `${path}.moisOutput`,
      id: ownerId,
      sourceKind: "documentComment",
      fieldId: hostFieldId,
      ...(isRecord(output.condition) && text(output.condition.fieldId)
        ? { gates: ["condition" as const] }
        : text(output.conditionalFieldId) ? { gates: ["conditionalFieldId" as const] } : {}),
    },
  });
}

function readFieldComments(field: BuilderField, reading: SubmitActionsReading) {
  readCommentOutput(field as unknown as UnknownRecord, field.id, `fields[${field.id}]`, field.id, reading);
  const layout = (field as unknown as UnknownRecord).layoutTableConfig;
  if (!isRecord(layout)) return;
  list(layout.rows).forEach((row, rowIndex) => {
    if (!isRecord(row)) return;
    list(row.cells).forEach((cell, cellIndex) => {
      if (!isRecord(cell)) return;
      const cellPath = `fields[${field.id}].layoutTableConfig.rows[${rowIndex}].cells[${cellIndex}]`;
      const cellId = text(cell.fieldId) || text(cell.id);
      if (cellId) readCommentOutput(cell, cellId, cellPath, field.id, reading);
      list(cell.fields).forEach((nested, nestedIndex) => {
        if (!isRecord(nested)) return;
        const nestedId = text(nested.fieldId) || text(nested.id);
        if (nestedId) readCommentOutput(nested, nestedId, `${cellPath}.fields[${nestedIndex}]`, field.id, reading);
      });
    });
  });
}

/** A computed field saved as the form's calculated observation. */
function readCalculatedField(field: BuilderField, reading: SubmitActionsReading) {
  if (field.type !== "computed") return;
  const calculated = field.computedConfig?.moisCalculated;
  if (!isRecord(calculated) || calculated.enabled !== true) return;
  const observation = observationOf(calculated as unknown as UnknownRecord);
  reading.actions.push({
    id: `field.computedConfig.moisCalculated:${field.id}`,
    kind: "calculatedValue",
    title: field.label || field.id,
    enabled: true,
    when: "submit",
    inputs: uniqueInputs([
      ...input("value", field.id),
      ...input("report", calculated.reportFieldId),
      ...input("reportedBy", calculated.reportedByFieldId),
      ...input("reportedDate", calculated.reportedDateFieldId),
    ]),
    condition: null,
    target: observation ? { observation } : {},
    source: { store: "field.computedConfig.moisCalculated", path: `fields[${field.id}].computedConfig.moisCalculated`, id: field.id, fieldId: field.id },
  });
}

// Subform modules ------------------------------------------------------------

const SUBFORM_OUTPUT_SOURCES = new Set(["field", "calculation", "total", "template"]);

interface SubformHost {
  kind: "section" | "component";
  id: string;
  path: string;
  enabled: boolean;
  draftIndex?: number;
  moduleIndex?: number;
  fieldId?: string;
}

function subformContainer(host: SubformHost): SubmitActionSource["container"] {
  return {
    kind: host.kind,
    id: host.id,
    ...(host.draftIndex !== undefined ? { draftIndex: host.draftIndex } : {}),
    ...(host.moduleIndex !== undefined ? { moduleIndex: host.moduleIndex } : {}),
  };
}

function readSubformModule(subformModule: ModuleConfig, host: SubformHost, reading: SubmitActionsReading) {
  const record = subformModule as unknown as UnknownRecord;
  const scoring = isRecord(record.subformScoring) ? record.subformScoring : null;
  const dataEntry = isRecord(record.subformDataEntry) ? record.subformDataEntry : null;
  const title = text(record.title) || host.id;
  // The MOIS renderers pass a scoring subform its `subformScoring` outputs and
  // a data-entry (or calculator) subform its `subformDataEntry` outputs.
  const configKey = record.kind === "subform-scoring" ? "subformScoring" : "subformDataEntry";
  const outputs = configKey === "subformScoring" ? scoring?.observationOutputs : dataEntry?.observationOutputs;
  list(outputs).forEach((raw, index) => {
    const path = `${host.path}.${configKey}.observationOutputs[${index}]`;
    if (!isRecord(raw)) {
      reading.unknown.push(`${path}: not an object`);
      return;
    }
    const source = text(raw.source) || "field";
    if (!SUBFORM_OUTPUT_SOURCES.has(source)) reading.unknown.push(`${path}.source: ${source}`);
    const id = text(raw.id) || `output-${index + 1}`;
    const observation = observationOf(raw);
    const valueInputs =
      source === "calculation" ? input("value", raw.calculationId, "subform")
        : source === "total" ? input("value", raw.totalId, "subform")
          : source === "template" ? subformTemplateRefs(raw.valueTemplate).flatMap((ref) => input("template", ref, "subform", "value"))
            : input("value", raw.fieldId, "subform");
    const reportInputs = subformTemplateRefs(raw.reportTemplate).flatMap((ref) => input("report", ref, "subform"));
    reading.actions.push({
      id: `subform:${host.id}:${id}`,
      kind: "observation",
      title: text(raw.description) || (observation ? `Observation ${observation.code}` : id),
      enabled: host.enabled,
      when: "submit",
      inputs: uniqueInputs([...valueInputs, ...reportInputs]),
      condition: null,
      target: observation ? { observation } : {},
      source: {
        store: "subform.observationOutputs",
        path,
        id,
        sourceKind: source,
        ...(host.fieldId ? { fieldId: host.fieldId } : {}),
        container: subformContainer(host),
      },
      ...(observation ? {} : { incomplete: "has no observation code" }),
    });
  });
  const action = dataEntry?.action;
  if (action === undefined || action === null) return;
  const path = `${host.path}.subformDataEntry.action`;
  if (!isRecord(action) || action.kind !== "moisMutation") {
    reading.unknown.push(`${path}.kind: ${isRecord(action) ? text(action.kind) || "(none)" : "not an object"}`);
    return;
  }
  const resource = text(action.resource);
  const mutation = text(action.mutation);
  reading.actions.push({
    id: `subform:${host.id}:action`,
    kind: submitActionKindForRecord(resource),
    title: `${title}: ${mutation || resource || "record write"}`,
    enabled: host.enabled,
    when: "subformComplete",
    inputs: uniqueInputs(recordInputs(action, "payloadMap", "subform")),
    condition: null,
    target: { record: { resource, mutation } },
    source: {
      store: "subform.action",
      path,
      id: `${resource}.${mutation}`,
      sourceKind: "moisMutation",
      ...(host.fieldId ? { fieldId: host.fieldId } : {}),
      container: subformContainer(host),
    },
    ...(!resource || !mutation ? { incomplete: "names no record" } : {}),
  });
}

const SECTION_DRAFT_PREFIX = "builder-section-";

function readDraftModules(drafts: unknown, fieldIds: ReadonlySet<string>, reading: SubmitActionsReading) {
  list(drafts).forEach((draft, draftIndex) => {
    if (!isRecord(draft) || !isRecord(draft.moduleConfig)) return;
    const key = text(draft.key);
    const sectionId = key.startsWith(SECTION_DRAFT_PREFIX) ? key.slice(SECTION_DRAFT_PREFIX.length) : key;
    const hostId = sectionId || `draft-${draftIndex}`;
    const primary = draft.moduleConfig as unknown as ModuleConfig;
    [primary, ...list(primary.additionalSubformModules)].forEach((entry, moduleIndex) => {
      if (!isRecord(entry)) return;
      const kind = text(entry.kind);
      if (kind !== "subform-scoring" && kind !== "subform-data-entry" && kind !== "subform-calculator") return;
      readSubformModule(entry as unknown as ModuleConfig, {
        kind: "section",
        id: moduleIndex === 0 ? hostId : `${hostId}#${moduleIndex + 1}`,
        path: moduleIndex === 0 ? `drafts[${draftIndex}].moduleConfig` : `drafts[${draftIndex}].moduleConfig.additionalSubformModules[${moduleIndex - 1}]`,
        enabled: entry.enabled !== false,
        draftIndex,
        moduleIndex,
        ...(fieldIds.has(sectionId) ? { fieldId: sectionId } : {}),
      }, reading);
    });
  });
}

/** A SubformScoring component's module from its own props (library subforms need the app's resolver). */
function fallbackComponentModule(field: BuilderField): ModuleConfig | null {
  const props = isRecord(field.componentProps) ? field.componentProps : null;
  if (!props) return null;
  const title = text(props.title) || text(field.componentTitle) || text(field.label) || field.id;
  const dataEntry = isRecord(props.dataEntryConfig) ? props.dataEntryConfig : null;
  const observationOutputs = Array.isArray(props.observationOutputs) ? props.observationOutputs : undefined;
  if (dataEntry || props.mode === "data-entry") {
    return {
      enabled: true,
      title,
      context: "",
      kind: "subform-data-entry",
      subformDataEntry: { ...(dataEntry ?? {}), fields: list(dataEntry?.fields), observationOutputs } as unknown as ModuleConfig["subformDataEntry"],
    };
  }
  return {
    enabled: true,
    title,
    context: "",
    kind: "subform-scoring",
    subformScoring: { observationOutputs } as unknown as ModuleConfig["subformScoring"],
  };
}

function isSubformComponent(field: BuilderField): boolean {
  if (field.type !== "component") return false;
  return field.componentKey === "SubformScoring" || (isRecord(field.componentProps) && field.componentProps.nhformsExport === "SubformScoring");
}

// Components -------------------------------------------------------------------

/** The component a field draws (its key, or the NHForms export it names). */
function componentNameOf(field: BuilderField): string {
  if (field.type !== "component") return "";
  const props = isRecord(field.componentProps) ? field.componentProps : {};
  return text(props.nhformsExport) || text(field.componentKey);
}

function componentBase(field: BuilderField, name: string, suffix = "") {
  return {
    id: `component.payload:${field.id}${suffix}`,
    title: text(field.label) || text(field.componentTitle) || field.id,
    enabled: true,
    when: "submit" as const,
    condition: null,
    source: { store: "component.payload" as const, path: `fields[${field.id}].componentProps`, id: field.id, sourceKind: name, fieldId: field.id },
  };
}

function gridCodes(codes: unknown): SubmitActionObservation[] {
  return list(codes).flatMap((entry) => {
    if (typeof entry === "string") return entry.trim() ? [{ code: entry.trim() }] : [];
    if (!isRecord(entry)) return [];
    const observation = observationOf(entry, "code") ?? observationOf(entry);
    return observation ? [observation] : [];
  });
}

function readComponentPayloads(field: BuilderField, reading: SubmitActionsReading, context: SubmitActionsContext) {
  const name = componentNameOf(field);
  if (!name) return;
  const ownProps = isRecord(field.componentProps) ? field.componentProps : {};
  const resolved = context.componentProps ? context.componentProps(name, ownProps) : ownProps;
  const props: UnknownRecord = isRecord(resolved) ? resolved : ownProps;
  const ownId = text(props.fieldId) || text(props.id) || field.id;
  const readOnly = props.readOnly === true || props.disabled === true || field.disabled === true;
  switch (name) {
    case "CodedObservationChoiceField":
    case "ValueSetObservationField": {
      const observation = observationOf(props);
      if (!observation || readOnly) return;
      reading.actions.push({
        ...componentBase(field, name),
        kind: "observation",
        inputs: uniqueInputs([...input("value", ownId), ...input("comment", props.commentFieldId)]),
        target: { observation },
      });
      return;
    }
    case "PastMeasurementField": {
      // A past measurement stored as the field's measurementConfig is its chart binding.
      if ((field as unknown as UnknownRecord).measurementConfig || readOnly || props.persistenceMode !== "observationAndForm") return;
      const observation = observationOf(props);
      if (!observation) return;
      reading.actions.push({ ...componentBase(field, name), kind: "observation", inputs: input("value", ownId), target: { observation } });
      return;
    }
    case "ObservationEntryGrid": {
      if (readOnly) return;
      const observations = gridCodes(props.codes);
      reading.actions.push({
        ...componentBase(field, name),
        kind: "observation",
        inputs: input("value", ownId),
        target: observations.length ? { observations } : {},
        ...(observations.length ? {} : { incomplete: "lists no observation codes" }),
      });
      return;
    }
    case "PanelEntryGrid":
    case "ObservationPanelEditor": {
      if (readOnly) return;
      const saveMode = text(props.saveMode) || "panel";
      const rows = list(props.rows).filter(isRecord);
      const observations = rows.map((row) => observationOf(row)).filter((entry): entry is SubmitActionObservation => Boolean(entry));
      const payloadInputs = [
        ...input("payload", props.orderedByFieldId, "form", "orderedBy"),
        ...input("payload", props.facilityFieldId, "form", "facility"),
        ...input("payload", props.notesFieldId, "form", "notes"),
      ];
      const writesPanel = saveMode === "panel" || saveMode === "both";
      const writesObservations = name === "ObservationPanelEditor" || props.legacyDcoWrites === true || saveMode === "dco" || saveMode === "both";
      if (writesPanel) {
        const panelCode = text(props.panelCode);
        const panelName = isRecord(props.panelName) ? props.panelName : {};
        reading.actions.push({
          ...componentBase(field, name, writesObservations ? ":panel" : ""),
          kind: "observationPanel",
          inputs: uniqueInputs([...input("row", ownId), ...payloadInputs]),
          target: {
            panel: { code: panelCode, ...(text(panelName.display) || text(props.title) ? { display: text(panelName.display) || text(props.title) } : {}) },
            ...(observations.length ? { observations } : {}),
          },
          ...(panelCode ? {} : { incomplete: "has no panel code" }),
        });
      }
      if (writesObservations) {
        reading.actions.push({
          ...componentBase(field, name, writesPanel ? ":observations" : ""),
          kind: "observation",
          inputs: input("row", ownId),
          target: observations.length ? { observations } : {},
          ...(observations.length ? {} : { incomplete: "has no rows with an observation code" }),
        });
      }
      return;
    }
    case "NarrativeReportBuilder": {
      const refs = list(props.template).flatMap((row) => {
        if (!isRecord(row)) return [];
        return [
          ...input("template", row.fieldId),
          ...[row.template, row.text, row.label].flatMap(subformTemplateRefs).flatMap((ref) => input("template", ref)),
        ];
      });
      reading.actions.push({
        ...componentBase(field, name),
        kind: "narrative",
        inputs: uniqueInputs(refs),
        target: {},
      });
      return;
    }
    default:
      return;
  }
}

// Target-only settings -----------------------------------------------------------

const FHIR_EXTRACTION_URLS: Array<[RegExp, string]> = [
  [/sdc-questionnaire-itemExtractionContext$/, "definition-based extraction (itemExtractionContext)"],
  [/sdc-questionnaire-templateExtract/, "template-based extraction (templateExtract)"],
  [/sdc-questionnaire-definitionExtract/, "definition-based extraction (definitionExtract)"],
];

function fhirExtractionEntries(extensions: unknown, path: string, out: SubmitTargetOnly[], includeObservationExtract: boolean) {
  list(extensions).forEach((extension, index) => {
    if (!isRecord(extension)) return;
    const url = text(extension.url);
    const match = FHIR_EXTRACTION_URLS.find(([pattern]) => pattern.test(url));
    if (match) out.push({ target: "fhir", what: match[1], path: `${path}[${index}]` });
    else if (includeObservationExtract && /sdc-questionnaire-observationExtract$/.test(url) && extension.valueBoolean === true) {
      out.push({ target: "fhir", what: "observation extraction for the whole questionnaire (observationExtract)", path: `${path}[${index}]` });
    }
  });
}

function readTargetOnly(fields: readonly BuilderField[], reading: SubmitActionsReading) {
  for (const field of fields) {
    const cerner = (field as unknown as UnknownRecord).cernerConfig;
    const formRoot = isRecord(cerner) && isRecord(cerner.formRoot) ? cerner.formRoot : null;
    const build = formRoot && isRecord(formRoot.deployment) && isRecord(formRoot.deployment.build) ? formRoot.deployment.build : null;
    if (build) {
      const path = `fields[${field.id}].cernerConfig.formRoot.deployment.build`;
      const task = isRecord(build.task) ? build.task : null;
      if (task && (text(task.description) || text(task.taskType))) {
        reading.targetOnly.push({ target: "cerner", what: `Order Task Tool task ${text(task.description) || text(task.taskType)}`, path: `${path}.task` });
      }
      if (text(build.noteType)) reading.targetOnly.push({ target: "cerner", what: `text rendition note type ${text(build.noteType)}`, path: `${path}.noteType` });
      list(build.launchReferences).forEach((ref, index) => {
        if (isRecord(ref) && text(ref.name)) reading.targetOnly.push({ target: "cerner", what: `launched by ${text(ref.kind) || "other"} ${text(ref.name)}`, path: `${path}.launchReferences[${index}]` });
      });
    }
    const fhir = (field as unknown as UnknownRecord).fhirConfig;
    if (!isRecord(fhir)) continue;
    if (isRecord(fhir.questionnaireRoot)) {
      fhirExtractionEntries(fhir.questionnaireRoot.extension, `fields[${field.id}].fhirConfig.questionnaireRoot.extension`, reading.targetOnly, true);
    }
    fhirExtractionEntries(fhir.preservedExtensions, `fields[${field.id}].fhirConfig.preservedExtensions`, reading.targetOnly, field.type === "section");
  }
}

function readBindingWrites(fields: readonly BuilderField[], reading: SubmitActionsReading) {
  for (const field of fields) {
    let binding: ReturnType<typeof readFieldBinding> = null;
    try {
      binding = readFieldBinding(field);
    } catch {
      continue;
    }
    const observation = binding?.write?.observation?.code;
    const mutation = binding?.write?.mutation?.id;
    if (!observation && !mutation) continue;
    reading.bindingWrites.push({ fieldId: field.id, ...(observation ? { observation } : {}), ...(mutation ? { mutation } : {}) });
  }
}

// ---------------------------------------------------------------------------
// The reader
// ---------------------------------------------------------------------------

/**
 * Every submit action the form holds, from every store, with the field
 * bindings that write on submit and the product-only submit settings beside
 * them. Pure; never throws.
 */
export function readSubmitActionsDetails(
  document: SubmitActionsDocument | null | undefined,
  context: SubmitActionsContext = {}
): SubmitActionsReading {
  const reading: SubmitActionsReading = { actions: [], bindingWrites: [], targetOnly: [], unknown: [] };
  if (!isRecord(document)) return reading;
  const fields = list(document.fields).filter((field): field is BuilderField => isRecord(field) && typeof field.id === "string");
  const guard = (where: string, run: () => void) => {
    try {
      run();
    } catch (error) {
      reading.unknown.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  guard("workflow", () => readWorkflowOutputs(document.workflow, reading));
  for (const field of fields) {
    guard(`fields[${field.id}]`, () => {
      readFieldComments(field, reading);
      readCalculatedField(field, reading);
      if (isSubformComponent(field)) {
        const subformModule = context.componentSubformModule ? context.componentSubformModule(field) : fallbackComponentModule(field);
        if (subformModule) {
          readSubformModule(subformModule, { kind: "component", id: field.id, path: `fields[${field.id}].componentProps`, enabled: true, fieldId: field.id }, reading);
        }
      } else {
        readComponentPayloads(field, reading, context);
      }
    });
  }
  guard("drafts", () => readDraftModules(document.drafts, new Set(fields.map((field) => field.id)), reading));
  guard("targetOnly", () => readTargetOnly(fields, reading));
  if (!context.skipBindingWrites) guard("bindingWrites", () => readBindingWrites(fields, reading));
  // Ids stay unique in the reading, even when two stores reuse one.
  const seen = new Map<string, number>();
  for (const action of reading.actions) {
    const count = seen.get(action.id) ?? 0;
    seen.set(action.id, count + 1);
    if (count > 0) action.id = `${action.id}#${count + 1}`;
  }
  return reading;
}

/** Every submit action the form holds (`readSubmitActionsDetails(...).actions`). */
export function readSubmitActions(document: SubmitActionsDocument | null | undefined, context: SubmitActionsContext = {}): SubmitAction[] {
  return readSubmitActionsDetails(document, { ...context, skipBindingWrites: true }).actions;
}

/** Actions a converter realises or reports: enabled, and not a definition kept from an import. */
export function activeSubmitActions(actions: readonly SubmitAction[]): SubmitAction[] {
  return actions.filter((action) => action.enabled && action.kind !== "definition");
}

/** The form fields an action reads (subform-internal ids left out). */
export function submitActionFieldIds(action: Pick<SubmitAction, "inputs">): string[] {
  return Array.from(new Set(action.inputs.filter((entry) => entry.scope === "form").map((entry) => entry.fieldId)));
}

/** A short description of what an action writes, for review messages and checklists. */
export function describeSubmitAction(action: SubmitAction): string {
  const observation = action.target.observation;
  const codes = (action.target.observations ?? []).map((entry) => entry.code);
  switch (action.kind) {
    case "observation":
      if (observation) return `saves observation ${observation.code}`;
      return codes.length ? `saves observations ${codes.join(", ")}` : "saves an observation";
    case "observationPanel":
      return action.target.panel?.code ? `saves panel ${action.target.panel.code}` : "saves an observation panel";
    case "calculatedValue":
      return observation ? `saves the calculated value as observation ${observation.code}` : "saves the calculated value";
    case "comment":
      return "adds a line to the form's document";
    case "narrative":
      return "writes the form's narrative";
    case "note":
      return "writes an encounter note";
    case "task":
      return `${action.target.record?.mutation?.startsWith("create") ? "creates" : "updates"} a task`;
    case "episode":
      return "creates or updates a service episode";
    case "event":
      return "creates or updates a service event";
    case "recordWrite":
      return action.target.record?.resource ? `writes a ${action.target.record.resource} record (${action.target.record.mutation})` : "writes a chart record";
    case "notification":
      return action.target.endpoint?.url ? `notifies ${action.target.endpoint.url}` : "notifies an outside listener";
    default:
      return "is a definition kept from an import";
  }
}
