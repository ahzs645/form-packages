import { describe, expect, it } from "vitest";
import type { BuilderField, BuilderWorkflowConfig } from "./index";
import type { ModuleConfig } from "./layout";
import { evaluateConditionGroup } from "./conditions";
import {
  activeSubmitActions,
  describeSubmitAction,
  readSubmitActions,
  readSubmitActionsDetails,
  submitActionFieldIds,
  submitActionKindForRecord,
  workflowOutputConditionToGroup,
  type SubmitAction,
} from "./workflow";

function field(partial: Partial<BuilderField> & Pick<BuilderField, "id" | "type">): BuilderField {
  return { label: partial.id, ...partial } as BuilderField;
}

const byId = (actions: SubmitAction[]) => new Map(actions.map((action) => [action.id, action]));

const WORKFLOW: BuilderWorkflowConfig = {
  reports: [{ id: "summary", title: "Summary", kind: "fieldList", fieldIds: ["pain", "notes"], sections: [{ title: "More", fieldIds: ["mood"] }] }],
  outputs: [
    { id: "pain_obs", title: "Pain score", kind: "dcoObservation", observationCode: "PAIN", loincCode: "72514-3", valueFieldId: "pain", unitsFieldId: "pain_units", valueType: "numeric", reportId: "summary", condition: { fieldId: "consent", operator: "yes" } },
    { id: "no_code", title: "No code", kind: "dcoObservation", valueFieldId: "pain" },
    { id: "comment", title: "Comment", kind: "documentComment", value: "Pain {data.pain} of 10", condition: { fieldId: "pain", operator: "truthy" } },
    { id: "score", title: "Score", kind: "calculatedObservation", observationCode: "SCORE", valueFieldId: "total", reportFieldId: "notes" },
    { id: "bp", title: "BP panel", kind: "panelUpdate", payload: { panelName: { code: "BP", display: "Blood pressure" }, rowBindings: [{ fieldId: "sys", observationCode: "SYS" }, { fieldId: "dia", observationCode: "DIA" }] }, payloadFields: { notes: "notes" } },
    { id: "mirth", title: "Mirth", kind: "httpJson", endpointUrl: "https://listener.example/forms", payloadMode: "mirthNotification", reportId: "summary", responseFieldId: "http_response" },
    { id: "note", title: "Note to patient", kind: "moisMutation", resource: "encounterNote", mutation: "changeEncounterNote", payloadFields: { note: "notes" } },
    { id: "task", title: "Follow up", kind: "moisMutation", resource: "task", mutation: "createTask", payloadFields: { description: "notes" } },
    { id: "off", title: "Off", kind: "dcoObservation", observationCode: "OFF", valueFieldId: "pain", enabled: false },
    { id: "legacy", title: "Legacy", kind: "customMutation" },
  ],
};

describe("readSubmitActions: workflow outputs", () => {
  const reading = readSubmitActionsDetails({ fields: [], workflow: WORKFLOW });
  const actions = byId(reading.actions);

  it("reads one action per output, with its kind, target and inputs", () => {
    expect(reading.unknown).toEqual([]);
    expect(reading.actions.map((action) => [action.id, action.kind])).toEqual([
      ["workflow:pain_obs", "observation"],
      ["workflow:no_code", "observation"],
      ["workflow:comment", "comment"],
      ["workflow:score", "calculatedValue"],
      ["workflow:bp", "observationPanel"],
      ["workflow:mirth", "notification"],
      ["workflow:note", "note"],
      ["workflow:task", "task"],
      ["workflow:off", "observation"],
      ["workflow:legacy", "definition"],
    ]);
    const pain = actions.get("workflow:pain_obs")!;
    expect(pain.target.observation).toEqual({ code: "PAIN", loinc: "72514-3", valueType: "NUMERIC" });
    expect(pain.inputs).toEqual([
      { role: "value", fieldId: "pain", scope: "form" },
      { role: "units", fieldId: "pain_units", scope: "form" },
      { role: "report", fieldId: "pain", scope: "form", key: "summary" },
      { role: "report", fieldId: "notes", scope: "form", key: "summary" },
      { role: "report", fieldId: "mood", scope: "form", key: "summary" },
    ]);
    expect(pain.source).toEqual({ store: "workflow.outputs", path: "workflow.outputs[0]", id: "pain_obs", sourceKind: "dcoObservation", gates: ["condition"] });
    expect(submitActionFieldIds(pain)).toEqual(["pain", "pain_units", "notes", "mood"]);
    expect(actions.get("workflow:comment")!.inputs).toEqual([{ role: "template", fieldId: "pain", scope: "form" }]);
    expect(actions.get("workflow:bp")!.target).toEqual({
      panel: { code: "BP", display: "Blood pressure" },
      observations: [{ code: "SYS" }, { code: "DIA" }],
    });
    expect(actions.get("workflow:mirth")!.target.endpoint).toEqual({ url: "https://listener.example/forms", method: "POST", payload: "mirthNotification", phase: "afterSubmit" });
    expect(actions.get("workflow:task")!.target.record).toEqual({ resource: "task", mutation: "createTask" });
    expect(actions.get("workflow:task")!.inputs).toEqual([{ role: "payload", fieldId: "notes", scope: "form", key: "description" }]);
  });

  it("marks what cannot run as incomplete, and what is off or kept for audit as inactive", () => {
    expect(actions.get("workflow:no_code")!.incomplete).toBe("has no observation code");
    expect(actions.get("workflow:pain_obs")!.incomplete).toBeUndefined();
    expect(readSubmitActions({ fields: [], workflow: { outputs: [{ id: "n", title: "n", kind: "moisMutation", resource: "encounterNote", mutation: "changeEncounterNote" }] } })[0].incomplete).toBe("has no note field");
    expect(activeSubmitActions(reading.actions).map((action) => action.id)).not.toContain("workflow:off");
    expect(activeSubmitActions(reading.actions).map((action) => action.id)).not.toContain("workflow:legacy");
  });

  it("reads the gate as a neutral condition, both gates when both are stored", () => {
    expect(actions.get("workflow:pain_obs")!.condition).toEqual({
      match: "all",
      conditions: [{ controllerFieldId: "consent", condition: { type: "choice-selected", optionValues: ["Y", "true", "Yes"] } }],
    });
    const group = { match: "any" as const, conditions: [{ controllerFieldId: "a", condition: { type: "filled" as const } }] };
    const [both] = readSubmitActions({ fields: [], workflow: { outputs: [{ id: "x", title: "x", kind: "dcoObservation", observationCode: "X", condition: { fieldId: "b", operator: "in", values: ["1"] }, conditionGroup: group }] } });
    expect(both.condition).toEqual({
      match: "all",
      conditions: [{ match: "all", conditions: [{ controllerFieldId: "b", condition: { type: "choice-selected", optionValues: ["1"] } }] }, group],
    });
  });

  it("never throws on odd shapes, and lists what it does not know", () => {
    const odd = readSubmitActionsDetails({
      fields: [null, { id: 3 }, { id: "ok", type: "text" }] as unknown as BuilderField[],
      workflow: { outputs: [null, { id: "q", kind: "surprise" }, "text"] } as unknown as BuilderWorkflowConfig,
      drafts: [{ key: "builder-section-x", moduleConfig: { kind: "subform-data-entry", subformDataEntry: { fields: [], observationOutputs: [1], action: { kind: "http" } } } }],
    });
    expect(odd.actions).toEqual([]);
    expect(odd.unknown).toEqual([
      "workflow.outputs[0]: not an object",
      "workflow.outputs[1].kind: surprise",
      "workflow.outputs[2]: not an object",
      "drafts[0].moduleConfig.subformDataEntry.observationOutputs[0]: not an object",
      "drafts[0].moduleConfig.subformDataEntry.action.kind: http",
    ]);
    expect(readSubmitActionsDetails(null)).toEqual({ actions: [], bindingWrites: [], targetOnly: [], unknown: [] });
    expect(readSubmitActionsDetails({ fields: [], workflow: { outputs: "nope" } as unknown as BuilderWorkflowConfig }).unknown).toEqual(["workflow.outputs: not a list"]);
  });
});

describe("workflowOutputConditionToGroup", () => {
  const passes = (condition: Parameters<typeof workflowOutputConditionToGroup>[0], value: unknown) =>
    evaluateConditionGroup(workflowOutputConditionToGroup(condition)!, () => undefined, { c: value });

  it("keeps the output gate's code-aware meaning", () => {
    expect(workflowOutputConditionToGroup(null)).toBeNull();
    expect(workflowOutputConditionToGroup({ fieldId: "" })).toBeNull();
    expect(passes({ fieldId: "c" }, "anything")).toBe(true);
    expect(passes({ fieldId: "c" }, "N")).toBe(false);
    expect(passes({ fieldId: "c" }, "")).toBe(false);
    expect(passes({ fieldId: "c", operator: "equals", value: "A" }, { code: "A", display: "Apple" })).toBe(true);
    expect(passes({ fieldId: "c", operator: "equals", value: "A" }, ["B", "A"])).toBe(true);
    expect(passes({ fieldId: "c", operator: "notEquals", value: "A" }, "B")).toBe(true);
    expect(passes({ fieldId: "c", operator: "notEquals", value: "A" }, undefined)).toBe(true);
    expect(passes({ fieldId: "c", operator: "yes" }, true)).toBe(true);
    expect(passes({ fieldId: "c", operator: "yes" }, "N")).toBe(false);
    expect(passes({ fieldId: "c", operator: "no" }, "N")).toBe(true);
    expect(passes({ fieldId: "c", operator: "in", values: [1, 2] }, "2")).toBe(true);
    expect(passes({ fieldId: "c", operator: "notIn", values: [1, 2] }, "3")).toBe(true);
    expect(passes({ fieldId: "c", operator: "in", values: [] }, "3")).toBe(false);
  });
});

describe("readSubmitActions: fields and components", () => {
  const fields = [
    field({ id: "allergy", type: "text", label: "Allergy", moisOutput: { kind: "documentComment", commentTemplate: "Allergy: {value}", conditionalFieldId: "has_allergy", conditionalValues: ["Y"] } }),
    field({ id: "quiet", type: "text", moisOutput: { kind: "documentComment", enabled: false } }),
    field({ id: "weight", type: "number", moisOutput: { kind: "observation", observationCode: "WT" } }),
    field({ id: "total", type: "computed", label: "Total", computedConfig: { expression: "[a]+[b]", moisCalculated: { enabled: true, observationCode: "TOT", reportFieldId: "notes" } } }),
    field({
      id: "grid",
      type: "layoutTable",
      layoutTableConfig: { rows: [{ id: "r", cells: [{ id: "c1", kind: "field", fieldId: "cell_note", moisOutput: { kind: "documentComment" } }] }] } as unknown as BuilderField["layoutTableConfig"],
    }),
    field({ id: "coded", type: "component", componentKey: "CodedObservationChoiceField", componentProps: { observationCode: "SMOKE", valueType: "VALUESET", commentFieldId: "smoke_comment" } }),
    field({ id: "coded_ro", type: "component", componentKey: "CodedObservationChoiceField", componentProps: { observationCode: "RO", readOnly: true } }),
    field({ id: "entry", type: "component", componentKey: "ObservationEntryGrid", componentProps: { codes: ["1950", { code: "128", loincCode: "4548-4" }] } }),
    field({ id: "panel", type: "component", componentKey: "PanelEntryGrid", componentProps: { panelCode: "ABS", saveMode: "both", rows: [{ id: "r1", observationCode: "ABS1" }], notesFieldId: "notes" } }),
    field({ id: "legacy_panel", type: "component", componentKey: "ObservationPanelEditor", componentProps: { panelCode: "OPE", rows: [] } }),
    field({ id: "story", type: "component", componentKey: "NarrativeReportBuilder", componentProps: { template: [{ fieldId: "pain", template: "Mood {{mood}}" }] } }),
    field({ id: "past", type: "component", componentKey: "PastMeasurementField", componentProps: { observationCode: "BP", persistenceMode: "observationAndForm" } }),
    field({ id: "past_form_only", type: "component", componentKey: "PastMeasurementField", componentProps: { observationCode: "BP" } }),
    field({ id: "header", type: "component", componentKey: "FormContextHeader", componentProps: {} }),
  ];
  const reading = readSubmitActionsDetails({ fields });
  const actions = byId(reading.actions);

  it("reads field comments, the calculated value and each component's staged writes", () => {
    expect(reading.unknown).toEqual([]);
    expect(reading.actions.map((action) => `${action.id} ${action.kind} ${action.enabled ? "on" : "off"}`)).toEqual([
      "field.moisOutput:allergy comment on",
      "field.moisOutput:quiet comment off",
      "field.computedConfig.moisCalculated:total calculatedValue on",
      "field.moisOutput:cell_note comment on",
      "component.payload:coded observation on",
      "component.payload:entry observation on",
      "component.payload:panel:panel observationPanel on",
      "component.payload:panel:observations observation on",
      "component.payload:legacy_panel:panel observationPanel on",
      "component.payload:legacy_panel:observations observation on",
      "component.payload:story narrative on",
      "component.payload:past observation on",
    ]);
    expect(actions.get("field.moisOutput:allergy")!.condition).toEqual({
      match: "all",
      conditions: [{ controllerFieldId: "has_allergy", condition: { type: "choice-selected", optionValues: ["Y"] } }],
    });
    expect(actions.get("field.moisOutput:allergy")!.target.text).toBe("Allergy: {value}");
    expect(actions.get("field.moisOutput:cell_note")!.source).toMatchObject({ fieldId: "grid", path: "fields[grid].layoutTableConfig.rows[0].cells[0].moisOutput" });
    expect(actions.get("field.computedConfig.moisCalculated:total")!.inputs.map((entry) => `${entry.role}:${entry.fieldId}`)).toEqual(["value:total", "report:notes"]);
    expect(actions.get("component.payload:coded")!.inputs.map((entry) => `${entry.role}:${entry.fieldId}`)).toEqual(["value:coded", "comment:smoke_comment"]);
    expect(actions.get("component.payload:entry")!.target.observations).toEqual([{ code: "1950" }, { code: "128", loinc: "4548-4" }]);
    expect(actions.get("component.payload:legacy_panel:observations")!.incomplete).toBe("has no rows with an observation code");
    expect(actions.get("component.payload:story")!.inputs.map((entry) => entry.fieldId)).toEqual(["pain", "mood"]);
  });

  it("names the field bindings that write, without making them actions", () => {
    expect(reading.bindingWrites).toEqual([{ fieldId: "weight", observation: "WT" }]);
    expect(reading.actions.some((action) => action.source.fieldId === "weight")).toBe(false);
    expect(readSubmitActionsDetails({ fields }, { skipBindingWrites: true }).bindingWrites).toEqual([]);
  });
});

describe("readSubmitActions: subforms", () => {
  const dataEntry: ModuleConfig = {
    enabled: true,
    title: "Contact",
    context: "",
    kind: "subform-data-entry",
    subformDataEntry: {
      fields: [{ id: "phone", label: "Phone", type: "text" }],
      calculations: [{ id: "calc", label: "Calc", expression: "1" }],
      observationOutputs: [
        { id: "phone_obs", observationCode: "PHONE", source: "field", fieldId: "phone" },
        { id: "calc_obs", observationCode: "CALC", source: "calculation", calculationId: "calc", reportTemplate: "Phone {{phone}}" },
      ],
      action: { kind: "moisMutation", resource: "patient", mutation: "changeTelecom", payloadMap: { value: "phone" } },
    },
  } as unknown as ModuleConfig;
  const scoring: ModuleConfig = {
    enabled: false,
    title: "PHQ",
    context: "",
    kind: "subform-scoring",
    subformScoring: { observationOutputs: [{ id: "phq", observationCode: "PHQ9", source: "total", totalId: "t" }] },
    subformDataEntry: { fields: [], observationOutputs: [{ id: "stale", observationCode: "STALE" }] },
  } as unknown as ModuleConfig;

  it("reads section subform outputs and actions, with their container", () => {
    const reading = readSubmitActionsDetails({
      fields: [field({ id: "contact", type: "section" })],
      drafts: [{ key: "builder-section-contact", moduleConfig: { ...dataEntry, additionalSubformModules: [scoring] } }],
    });
    expect(reading.unknown).toEqual([]);
    expect(reading.actions.map((action) => `${action.id} ${action.kind} ${action.when} ${action.enabled}`)).toEqual([
      "subform:contact:phone_obs observation submit true",
      "subform:contact:calc_obs observation submit true",
      "subform:contact:action recordWrite subformComplete true",
      "subform:contact#2:phq observation submit false",
    ]);
    const [phone, calc, action] = reading.actions;
    expect(phone.inputs).toEqual([{ role: "value", fieldId: "phone", scope: "subform" }]);
    expect(calc.inputs).toEqual([{ role: "value", fieldId: "calc", scope: "subform" }, { role: "report", fieldId: "phone", scope: "subform" }]);
    expect(action.target.record).toEqual({ resource: "patient", mutation: "changeTelecom" });
    expect(action.source.container).toEqual({ kind: "section", id: "contact", draftIndex: 0, moduleIndex: 0 });
    expect(action.source.fieldId).toBe("contact");
    expect(describeSubmitAction(action)).toBe("writes a patient record (changeTelecom)");
  });

  it("reads a SubformScoring component through the app's resolver, else its own props", () => {
    const component = field({ id: "bpi", type: "component", componentKey: "SubformScoring", componentProps: { subformLibraryId: "bpi", observationOutputs: [{ id: "own", observationCode: "OWN" }] } });
    expect(readSubmitActions({ fields: [component] }).map((action) => action.id)).toEqual(["subform:bpi:own"]);
    const resolved = readSubmitActions({ fields: [component] }, { componentSubformModule: () => ({ ...dataEntry, kind: "subform-scoring", subformScoring: { observationOutputs: [{ id: "lib", observationCode: "LIB" }] } } as unknown as ModuleConfig) });
    expect(resolved.map((action) => `${action.id} ${action.source.container?.kind}`)).toEqual(["subform:bpi:lib component", "subform:bpi:action component"]);
  });
});

describe("readSubmitActions: product-only submit settings", () => {
  it("lists a Cerner build record's task and note type and FHIR extraction as target-only", () => {
    const reading = readSubmitActionsDetails({
      fields: [
        field({
          id: "root",
          type: "section",
          cernerConfig: { version: 1, formRoot: { deployment: { build: { task: { description: "Discharge teaching" }, noteType: "Discharge Note", launchReferences: [{ kind: "rule", name: "SBAR rule" }] } } } } as unknown as BuilderField["cernerConfig"],
          fhirConfig: { questionnaireRoot: { extension: [{ url: "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-itemExtractionContext", valueCode: "Patient" }] } } as unknown as BuilderField["fhirConfig"],
        }),
        field({ id: "q", type: "text", fhirConfig: { preservedExtensions: [{ url: "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract", valueBoolean: true }] } as unknown as BuilderField["fhirConfig"] }),
      ],
    });
    expect(reading.actions).toEqual([]);
    expect(reading.targetOnly.map((entry) => `${entry.target}: ${entry.what}`)).toEqual([
      "cerner: Order Task Tool task Discharge teaching",
      "cerner: text rendition note type Discharge Note",
      "cerner: launched by rule SBAR rule",
      "fhir: definition-based extraction (itemExtractionContext)",
    ]);
  });
});

describe("submitActionKindForRecord", () => {
  it("names the neutral kind of a MOIS record", () => {
    expect(["encounterNote", "task", "serviceEpisode", "serviceEvent", "connection", "calculatedObservation", undefined].map(submitActionKindForRecord)).toEqual([
      "note",
      "task",
      "episode",
      "event",
      "recordWrite",
      "calculatedValue",
      "recordWrite",
    ]);
  });
});
