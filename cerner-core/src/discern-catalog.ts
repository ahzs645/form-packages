/**
 * The Discern native surface an MPage can call, as Oracle's MPages Development
 * Wiki (Confluence space MPDEVWIKI) and the Discern Explorer help
 * (1101discernHP) document it.
 *
 * `discern.ts` started as a reading of `fluent-cerner-js`; this module is the
 * catalogue checked against the wiki itself, page by page (the numbers in
 * `wiki` are Confluence page ids). Every entry says where it came from:
 *
 *   - "wiki"               the method has its own page with a syntax line;
 *   - "wiki-example"       it only appears inside another page's example code
 *                          (CustomizeTabMOEW, the `Add` spelling on
 *                          INDEXEDDOUBLECOLLECTION) or a system-message table;
 *   - "reverse-engineered" no wiki page describes it; it comes from a caller
 *                          library or a capture and should be treated as such.
 *
 * Runtime code here must stay ES5-safe: the legacy player tier imports
 * cerner-core, so no Object.entries/fromEntries or Array.includes at runtime.
 */

export type DiscernEvidence = "wiki" | "wiki-example" | "reverse-engineered";

/**
 * What a method hands back. The wiki's COM signatures end in an `[out, retval]`
 * pointer (`BOOL* pRetVal`, `BSTR* …Xml`); that pointer is what JavaScript
 * receives, so `returns` names it rather than the HRESULT.
 */
export type DiscernReturn =
  | "void"
  | "bool"
  | "number"
  | "bitmask"
  | "handle"
  | "string"
  | "xml"
  | "json"
  | "object";

export interface DiscernMethodSpec {
  params: readonly string[];
  /** How many trailing params the wiki marks optional. */
  optional?: number;
  returns: DiscernReturn;
  wiki?: number;
  source: DiscernEvidence;
  note?: string;
}

export interface DiscernObjectSpec {
  description: string;
  wiki?: number;
  methods: Readonly<Record<string, DiscernMethodSpec>>;
  /** Property-style API: set these, then call a method (POWERFORM.Open, DISCHARGEPROCESS, ORDERS). */
  properties?: readonly string[];
  note?: string;
}

const m = (
  params: readonly string[],
  returns: DiscernReturn,
  wiki?: number,
  extra: Partial<DiscernMethodSpec> = {},
): DiscernMethodSpec => {
  const spec: DiscernMethodSpec = { params, returns, source: "wiki" };
  if (wiki !== undefined) spec.wiki = wiki;
  for (const key in extra) (spec as unknown as Record<string, unknown>)[key] = (extra as Record<string, unknown>)[key];
  return spec;
};

/** Every POWERORDERS method takes the handle CreateMOEW returned first. */
const H = "lMOEWHandle";
const RENEW_DETAILS = [
  "dOrderId", "lDuration", "dDurationUnitCd", "lDispenseDuration", "dDispenseDurationUnitCd",
  "lNbrRefills", "dDispenseQty", "dDispenseQtyUnitCd",
] as const;

export const DISCERN_OBJECT_CATALOG: Readonly<Record<string, DiscernObjectSpec>> = {
  POWERORDERS: {
    description:
      "The Modal Order Entry Window (MOEW). CreateMOEW must come first; DestroyMOEW must always be called when done. One MOEW at a time: never create one from a workflow that started in a MOEW or PowerOrders, the scratchpad is shared.",
    wiki: 62263543,
    methods: {
      CreateMOEW: m(["dPersonId", "dEncntrId", "dwCustomizeFlag", "dwTabFlag", "dwTabDisplayOptionsFlag"], "handle", 62263636),
      DestroyMOEW: m([H], "void", 62263646),
      DisplayMOEW: m([H], "bool", 62100610, { note: "Shows the window modally; the value is whether anything was signed." }),
      SignOrders: m([H], "bool", 62100606, { note: "Signs silently when it can; otherwise DISPLAYS the window." }),
      GetXMLOrdersMOEW: m([H], "xml", 62100625, { note: "Orders signed during the previous invocation; \"\" when none." }),
      CustomizeTabMOEW: m([H, "dwTabFlag", "dwTabDisplayOptionsFlag"], "bool", undefined, {
        source: "wiki-example",
        note: "No page of its own: used in the AddPowerPlanMOEW/AddPowerPlanWithDetails examples and named in the Orders system messages.",
      }),
      AddNewOrdersToScratchpad: m([H, "newOrdersXML", "bSignTimeInteractionChecking"], "number", 1468869696, {
        note: "Returns eModAddToSpValues: 0 added, 1 added and signed, 2 cancelled by user, 3 failed. Standard orders and non-meds only; all or nothing.",
      }),
      AddNewOrderToScratchpad: m([H, "newOrderXML", "bSignTimeInteractionChecking"], "bool", 1468868049, {
        note: "One order only, local scratchpad, never launches the MOEW.",
      }),
      RemoveOrderFromScratchPad: m([H, "dOrderId"], "bool", 1468870629),
      GetScratchPadOrders: m([H, "bGetNonViewableOrders", "bActionSort", "eSpType"], "xml", 1468869845, {
        note: "eSpType 0 not defined, 1 local, 2 only local, 3 global, 4 current. \"\" when the scratchpad is empty.",
      }),
      IsScratchPadEmptyMOEW: m([H], "bool", 1468870910, {
        note: "Despite the name, the wiki says the value is TRUE when the MOEW HAS uncommitted data.",
      }),
      AddDiagnosesToOrder: m([H, "dPatientId", "dEncounterId", "diagnosesXML"], "xml", 1468870851, {
        note: "Returns a status document: one <DiagnosisId Value=…>True|False</DiagnosisId> per diagnosis. Diagnoses must already be on the encounter.",
      }),
      AddPowerPlanMOEW: m([H, "dPathwayCatalogId", "dPersonalizedPlanId"], "bool", 1072705416),
      AddPowerPlanWithDetails: m([H, "planDetailsXML"], "bool", 1290845600),
      GetAvailableOrderActions: m([H, "dOrderId"], "bitmask", 62100623),
      InvokeCancelDCAction: m([H, "dOrderId", "cancelDCDateTimeBstr", "dCancelDCReasonCd"], "bool", 62263585, {
        note: "Date/time is YYYYMMDDhhmmsscc; the reason is a code value from code set 1309.",
      }),
      InvokeCompleteAction: m([H, "dOrderId"], "bool", 62558146),
      InvokeResolveActionMOEW: m([H, "dOrderId"], "bool", 1139901604),
      InvokeRenewAction: m([H, ...RENEW_DETAILS, "bApplyDefaultRouting"], "bool", 62558159, {
        note: "Prescription or historical orders. Units are code set 54 code values.",
      }),
      InvokeRenewActionWithRouting: m([H, ...RENEW_DETAILS, "dRouteMeaningId", "dOeFieldValue", "oeFieldDisplayValueBstr"], "bool", 934084617),
      InvokeRetailMedManagerRefillRequestReview: m([H, "dOrderId"], "number", 2834903583, {
        note: "0 submitted, 1 not submitted, 2 error retrieving, 3 error submitting, 100 invalid parameters, 101 function missing.",
      }),
      GetDefaultRoutingDisplay: m([H], "string", 62100614),
      GetConsolidatedRoutingOptions: m([H, "catalogCdsBstr"], "json", 934084615),
    },
  },
  POWERFORM: {
    description: "The PowerForm component. OpenForm is the preferred call; the property API sets the same five values and calls Open().",
    wiki: 33004243,
    properties: ["window", "PersonId", "EncntrId", "FormId", "ActivityId", "ChartMode"],
    methods: {
      OpenForm: m(["personId", "encntrId", "formId", "activityId", "chartMode"], "void", 33004396, {
        note: "Both ids 0 opens Ad Hoc Charting; a non-zero activityId wins over formId; chartMode 0 read/write, 1 read only.",
      }),
      Open: m([], "void", 33004548),
    },
  },
  POWERNOTE: {
    description: "PowerNote in the Document Viewing tab. The person and encounter must match.",
    wiki: 32228303,
    methods: {
      BeginNoteFromEncounterPathway: m(["personId", "encounterId", "encounterPathwayCKISource", "encounterPathwayCKIIdentifier"], "void", 32228308),
      BeginNoteFromPrecompletedNote: m(["personId", "encounterId", "scdStoryId"], "void", 32231871),
      BeginNoteFromCopiedForwardNote: m(["personId", "encounterId", "scdStoryId"], "void", 32231889),
      ModifyExistingNoteByEventId: m(["personId", "encounterId", "eventId"], "void", 32231906),
    },
  },
  DYNDOC: {
    description: "Dynamic Documentation in the Document Viewing tab.",
    wiki: 1207699820,
    methods: {
      CreateNewNote: m(["jsonParams"], "void", 1526235743, {
        note: "{person_id, encounter_id, note_list:[{reference_template_id, event_cd, workflow_id?}]} — at most one entry may carry workflow_id. The wiki names no return value.",
      }),
      OpenNewDocumentByReferenceTemplateId: m(["personId", "encounterId", "templateId"], "bool", 1207699858),
      OpenNewDocumentByReferenceTemplateIdAndNoteType: m(["personId", "encounterId", "templateId", "noteTypeEventCd"], "bool", 1290800743),
      OpenDynDocByWorkFlowId: m(["personId", "encounterId", "workflowId"], "bool", 1207699905),
      ModifyExistingDocumentByEventId: m(["personId", "encounterId", "eventId"], "bool", 1207699872, { note: "eventId is the MDOC event_id." }),
    },
  },
  PVCONTXTMPAGE: {
    description: "Patient context.",
    wiki: 44860122,
    methods: {
      GetValidEncounters: m(["personId"], "string", 44860154, {
        note: "Comma-separated encounter ids; \"\" when the user may see none.",
      }),
      SetPatient: m(["personId", "encntrId"], "void", undefined, {
        source: "reverse-engineered",
        note: "Not on the wiki's PVCONTXTMPAGE page (which lists GetValidEncounters only); kept because earlier catalogues carried it.",
      }),
    },
  },
  PVFRAMEWORKLINK: {
    description: "Messages to the PowerChart framework: pending data, pop-ups, store info.",
    wiki: 934183277,
    methods: {
      SetPendingData: m(["pendingData"], "void", 934183382, { note: "1 warns on refresh / chart close; 0 clears it. The flag outlives the object." }),
      LaunchPopup: m([], "void", 985958697),
      SetPopupBoolProp: m(["boolPropertyName", "booleanValue"], "void", 985958697),
      SetPopupStringProp: m(["stringPropertyName", "stringValue"], "void", 985958697),
      SetPopupDoubleProp: m(["doublePropertyName", "doubleValue"], "void", 985958697),
      SetPopupLongProp: m(["longPropertyName", "longValue"], "void", 985958697),
      SetStoreInfo: m(["stringName", "stringValue"], "void", 989012334),
      LaunchPVResultsToEndorseViewer: m(["personId"], "void", 1936395137),
    },
  },
  PVPATIENTFOCUS: {
    description: "The PowerChart patient focus bar.",
    wiki: 1179029345,
    methods: {
      SetPatientFocus: m(["patientId", "encounterId", "patientName"], "void", 1179029370),
      ClearPatientFocus: m([], "void", 1179029399),
    },
  },
  PVPATIENTSEARCHMPAGE: {
    description: "The patient search dialog.",
    wiki: 1007354842,
    methods: {
      SearchForPatientAndEncounter: m([], "object", 1007354901, {
        note: "Returns {PersonId, EncounterId}; both 0 when cancelled, EncounterId 0 when only a patient was chosen.",
      }),
    },
  },
  PMLISTMAINTENANCE: {
    description: "The patient list maintenance dialog.",
    wiki: 1007354930,
    methods: {
      OpenListMaintenanceDialog: m([], "bool", 1007354957, { note: "True when lists were modified." }),
    },
  },
  PVVIEWERMPAGE: {
    description: "Result detail viewers. Each family is Create… → Append…(repeatable) → Launch…, in that order.",
    wiki: 66754999,
    methods: {
      CreateDocViewer: m(["personId"], "void", 928614884),
      AppendDocEvent: m(["eventId"], "void", 928614884),
      LaunchDocViewer: m([], "void", 928614884),
      SkipDocViewerPrivilegeCheck: m(["bSkipCheck"], "void", 928614884),
      CreateEventViewer: m(["personId"], "void", 928614967),
      AppendEvent: m(["eventId"], "void", 928614967),
      LaunchEventViewer: m([], "void", 928614967),
      CreateGroupViewer: m([], "void", 928614984),
      AppendGroupEvent: m(["eventId"], "void", 928614984),
      LaunchGroupViewer: m([], "void", 928614984),
      CreateMicroViewer: m(["personId"], "void", 928615001),
      AppendMicroEvent: m(["eventId"], "void", 928615001),
      LaunchMicroViewer: m([], "void", 928615001),
      CreateAPViewer: m([], "void", 928615010),
      AppendAPEvent: m(["eventId", "parentEventId"], "void", 928615010),
      LaunchAPViewer: m([], "void", 928615010),
      CreateProcViewer: m(["personId"], "void", 928615743),
      AppendProcEvent: m(["eventId"], "void", 928615743),
      LaunchProcViewer: m([], "void", 928615743),
      CreateAndLaunchHLAViewer: m(["personId", "eventId"], "void", 928615747),
      LaunchRemindersViewer: m(["taskId"], "void", 928615752),
      LaunchOrderInfoViewer: m(["orderId", "tabView"], "void", 1400707513, { note: "tabView 1 details, 2 comments, 16 additional info." }),
    },
  },
  TASKDOC: {
    description: "Task documentation, label printing and Interactive View.",
    wiki: 1007354982,
    methods: {
      SetDocumentationDtTm: m(["intYear", "intMonth", "intDate", "intHour", "intMinutes"], "void", 1007355018, { note: "Call before DocumentTasks." }),
      DocumentTasks: m(["window", "patientId", "collection", "chartMode"], "bool", 1007355046, {
        note: "collection is an INDEXEDDOUBLECOLLECTION; chartMode CHART, CHART_DONE, CHART_DONE_DT_TM or CHART_NOT_DONE. On Edge pass {} for window.",
      }),
      PrintLabels: m(["patientId", "collection"], "bool", 1007355098),
      LaunchIView: m(["bandName", "sectionName", "itemName", "patientId", "encounterId"], "void", 1077837848),
    },
  },
  INDEXEDDOUBLECOLLECTION: {
    description: "A collection of doubles for TASKDOC; a JavaScript array is not accepted.",
    wiki: 1007355062,
    methods: {
      add: m(["value"], "void", 1007355062),
      remove: m(["value"], "void", 1007355062),
      removeAll: m([], "void", 1007355062),
      Add: m(["value"], "void", 1007355046, { source: "wiki-example", note: "The TASKDOC examples spell it Add." }),
    },
  },
  PREGNANCY: {
    description: "Pregnancy dialogs. The first argument is the page's window (on Edge, an empty object).",
    wiki: 38175021,
    methods: {
      AddPregnancy: m(["window", "personId", "encounterId"], "bool", 38175024),
      ModifyPregnancy: m(["window", "personId", "encounterId", "pregnancyId"], "bool", 38175032),
      ClosePregnancy: m(["window", "personId", "encounterId", "pregnancyId"], "bool", 38175042),
      CancelPregnancy: m(["window", "personId", "encounterId", "pregnancyId"], "bool", 38175045),
      ReopenPregnancy: m(["window", "personId", "encounterId", "pregnancyId"], "bool", 38175051),
      AddEDD: m(["window", "personId", "encounterId", "pregnancyId"], "bool", 38175055),
      ModifyEDD: m(["window", "personId", "encounterId", "eddId"], "bool", 38175058),
      LaunchFundalHeightGraph: m(["window", "personId", "pregnancyId"], "bool", 38175064),
      LaunchLaborGraph: m(["window", "personId", "pregnancyId"], "bool", 38175066),
    },
  },
  KIACROSSMAPPING: {
    description: "The diagnosis/problem cross-mapping dialog.",
    wiki: 62564776,
    methods: {
      GetDxProbMapping: m([
        "personId", "encntrId", "eMapMode", "originatingNomenclatureId", "diagnosisTargetVocabCd",
        "pprCode", "posCode", "visitLabelDisplay", "activeLabelDisplay", "historicalLabelDisplay",
      ], "number", 928744854, { note: "Returns the mapped nomenclature id." }),
    },
  },
  INFOBUTTONLINK: {
    description: "Infobutton services (the wiki's object is CInfoButtonLink; its home page lists it as CINFOLINKBUTTON, every example creates INFOBUTTONLINK).",
    wiki: 1212549129,
    methods: {
      SetInfoButtonData: m(["dPersonId", "dEncntrId", "dPrimaryCriteriaCd", "iQueryPurposeInd", "iPerformerInd"], "void", 1212549165),
      IsInfoButtonOn: m(["bInfoButtonActive"], "bool", 1212549148),
      LaunchInfoButton: m([], "void", 1212549159),
      AddProblem: m(["dNomenclatureId", "dSearchNomenclatureId", "lItemDescription"], "void", 1212549174, { optional: 2 }),
      AddDiagnosis: m(["dNomenclatureId", "dSearchNomenclatureId", "lItemDescription"], "void", 1212549174, { optional: 2 }),
      AddAllergy: m(["dNomenclatureId", "dSearchNomenclatureId", "lItemDescription"], "void", 1212549174, { optional: 2 }),
      AddMedication: m(["dSynonymId"], "void", 1212549177),
      AddResult: m(["dEventId", "dEventCd", "dEventClassCd", "sResultValue", "dResultValuecd", "dResultUnitCd"], "void", 1212549188),
    },
  },
  DISCHARGEPROCESS: {
    description: "The Discharge Process module. Set person_id, encounter_id and user_id, then LaunchDischargeDialog().",
    wiki: 935443140,
    properties: ["person_id", "encounter_id", "user_id"],
    methods: { LaunchDischargeDialog: m([], "void", 938869060) },
  },
  PATIENTEDUCATION: {
    description: "The Patient Education module. SetPatient is required before DoModal.",
    wiki: 935443147,
    methods: {
      SetPatient: m(["dPersonId", "dEncounterId"], "void", 938869070),
      SetDefaultTab: m(["lTabSequence"], "void", 938869070, { note: "0 instructions (the default), 1 follow-up." }),
      DoModal: m([], "void", 938869070),
    },
  },
  ORDERS: {
    description: "Win32 orders components (medication reconciliation). Set PersonId and EncntrId first.",
    wiki: 935443158,
    properties: ["PersonId", "EncntrId", "defaultVenue", "reconciliationMode"],
    methods: {
      LaunchOrdersMode: m(["eMode", "bDisplaySearchWnd", "pExitVal"], "void", 938869075, {
        note: "eMode 0 order list, 1 medication list, 2 reconciliation; bDisplaySearchWnd 1 opens on search, 0 on the profile; pass 0 for pExitVal.",
      }),
    },
  },
  PEXSCHEDULINGACTIONS: {
    description: "Scheduling actions on one appointment (sch_appt.sch_event_id). Each returns whether the action was performed.",
    wiki: 1560519883,
    methods: {
      CheckInAppointment: m(["schEventId"], "bool", 1560519883),
      CheckOutAppointment: m(["schEventId"], "bool", 1560519883),
      CancelAppointment: m(["schEventId"], "bool", 1560519883),
      HoldAppointment: m(["schEventId"], "bool", 1560519883),
      NoShowAppointment: m(["schEventId"], "bool", 1560519883),
      ShowView: m(["schEventId", "scheduleId"], "bool", 1560519883),
      ShowHistoryView: m(["schEventId", "scheduleId"], "bool", 1560519883),
    },
  },
  PEXAPPLICATIONSTATUS: {
    description: "Whether the MPage is in view; application restart.",
    wiki: 1560520203,
    methods: {
      IsPageInView: m(["document"], "bool", 1560520203),
      RestartApplication: m([], "void", 1560520203),
    },
  },
  CONMANAPPNOTIFIER: {
    description: "Predecessor of PEXAPPLICATIONSTATUS: pending-change check and application restart.",
    wiki: 1736282669,
    methods: {
      QueryAppShutdown: m([], "bool", 1736282669),
      RestartApplication: m([], "void", 1736282669, { note: "Only after QueryAppShutdown returned true." }),
    },
  },
};

/** Arity check against the catalogue: null when fine, else what the wiki expects. */
export function discernArityProblem(spec: DiscernMethodSpec, count: number): string | null {
  const max = spec.params.length;
  const min = max - (spec.optional ?? 0);
  if (count >= min && count <= max) return null;
  return `expects ${min === max ? max : `${min}–${max}`} argument${max === 1 ? "" : "s"} (${spec.params.join(", ") || "none"}); got ${count}`;
}

/* ============================================================================
   Native functions: the globals and window.external members a page calls
   ========================================================================= */

export interface DiscernNativeFunctionSpec {
  /** `global` functions are injected by the discern meta tag; `external` live on window.external. */
  scope: "global" | "external";
  params: readonly string[];
  optional?: number;
  /** The `<meta name="discern">` value that injects it under Internet Explorer. */
  meta?: string;
  /**
   * Microsoft Edge (2018.08+): `promise` — supported, returns a Promise;
   * `unsupported` — use PVFRAMEWORKLINK instead; `edge-only`; `alerts-only`.
   */
  edge: "promise" | "unsupported" | "edge-only" | "alerts-only";
  wiki: number;
  description: string;
}

export const DISCERN_NATIVE_FUNCTIONS: Readonly<Record<string, DiscernNativeFunctionSpec>> = {
  APPLINK: {
    scope: "global", params: ["linkmode", "launchobject", "commandlineargs"], meta: "APPLINK", edge: "promise", wiki: 16059922,
    description: "Open an application, a chart tab (/PERSONID /ENCNTRID /FIRSTTAB) or an organizer tab (/ORGANIZERTAB), or shell-execute a URL/file.",
  },
  CCLLINK: {
    scope: "global", params: ["reportname", "prompts", "linkdestination"], optional: 1, meta: "CCLLINK", edge: "promise", wiki: 32211220,
    description: "Run a CCL report. linkdestination 0 opens Discern Report Viewer, 1 replaces the current page (default 0 in IE, 1 in Edge).",
  },
  CCLLINKPOPUP: {
    scope: "global", params: ["reportname", "prompts", "target", "features", "replaceflag"], meta: "CCLLINKPOPUP", edge: "unsupported", wiki: 32211229,
    description: "Run a CCL report into an Internet Explorer pop-up. Not supported in Edge: use PVFRAMEWORKLINK.LaunchPopup.",
  },
  CCLNEWSESSIONWINDOW: {
    scope: "global", params: ["url", "target", "features", "replaceflag", "modalflag"], meta: "CCLNEWSESSIONWINDOW", edge: "unsupported", wiki: 32211267,
    description: "Open a URL in a new Discern Output Viewer window. Not supported in Edge: use PVFRAMEWORKLINK.LaunchPopup.",
  },
  CCLEVENT: {
    scope: "global", params: ["eventname"], meta: "CCLEVENT", edge: "alerts-only", wiki: 32211246,
    description: "EVENT_EKS_OK, EVENT_NOTIFY_DELETE, EVENT_NOTIFY_DELETE_HTMLONLY or EVENT_NOTIFY_MINIMIZE. In Edge only from Discern alerts and EdgePopup.",
  },
  MPAGES_EVENT: {
    scope: "global", params: ["eventname", "parameters"], meta: "MPAGES_EVENT", edge: "promise", wiki: 33005440,
    description: "Launch an ALLERGY, POWERFORM, POWERNOTE, ORDERS or CLINICALNOTE conversation from a pipe-delimited payload.",
  },
  MPAGES_SVC_EVENT: {
    scope: "global", params: ["uri", "params"], meta: "MPAGES_SVC_EVENT", edge: "promise", wiki: 33005323,
    description: "Run a report through the Discern MPages web service.",
  },
  XMLCclRequest: {
    scope: "global", params: [], meta: "XMLCCLREQUEST", edge: "promise", wiki: 33005364,
    description: "Constructor; open(method, name[, async=true]), setBlobIn(blob), send(params<65535), cleanup(). Synchronous calls throw in Edge.",
  },
  DiscernReportViewer: {
    scope: "global", params: ["options"], edge: "edge-only", wiki: 2686438743,
    description: "{url|program, params, left, top, width, height, useedge}.",
  },
  EdgePopup: {
    scope: "global", params: ["options"], edge: "edge-only", wiki: 2851602452,
    description: "{url|program, params, left, top, width, height, isResizable, showStatusBar, showToolbar, modal, fullscreen, toolbarOptions, callback}.",
  },
  DiscernObjectFactory: {
    scope: "external", params: ["objectName"], edge: "promise", wiki: 16057928,
    description: "Create one of the DISCERN_OBJECT_CATALOG objects.",
  },
  MPAGESOVERRIDEREFRESH: {
    scope: "external", params: ["handler"], optional: 1, edge: "promise", wiki: 1107632259,
    description: "Call handler instead of reloading on Refresh. IE takes a function NAME (\"\" restores), Edge a function (no argument restores).",
  },
  MPAGESOVERRIDEPRINT: {
    scope: "external", params: ["handler"], optional: 1, edge: "promise", wiki: 1264887411,
    description: "Call handler instead of printing. Same IE/Edge difference as MPAGESOVERRIDEREFRESH.",
  },
  PCUpdateRefreshTime: {
    scope: "external", params: ["year", "month", "day", "hour", "minute", "second"], optional: 6, edge: "promise", wiki: 1287041433,
    description: "Set the Refresh button's As Of time: no arguments for now, or all six.",
  },
  PCRegisterMessage: {
    scope: "external", params: ["messageId", "handler", "persist"], optional: 1, edge: "promise", wiki: 1125287661,
    description: "Receive framework messages. Ids 0–9,999 are reserved for Oracle. IE takes a function name, Edge a function.",
  },
  PCUnRegisterMessage: { scope: "external", params: ["messageId"], edge: "promise", wiki: 1125287661, description: "Stop receiving a message." },
  PCSendMessage: {
    scope: "external", params: ["messageId", "payload"], edge: "promise", wiki: 1125287661,
    description: "Broadcast to every open tab, every chart included. 2101 closes a LaunchPopup window from inside it.",
  },
  PCActivatePatArrows: {
    scope: "external", params: ["listIndex", "callbackName", "persist"], optional: 1, edge: "promise", wiki: 1185751499,
    description: "IE patient-list Previous/Next buttons. A negative index turns them off.",
  },
  PCEdgePatNavSetCallback: { scope: "external", params: ["callback"], edge: "edge-only", wiki: 1185751499, description: "Edge patient-list navigation callback." },
  PCEdgeActivatePatArrows: {
    scope: "external", params: ["listIndex", "prevPersonId", "prevEncntrId", "nextPersonId", "nextEncntrId"], edge: "edge-only", wiki: 1185751499,
    description: "Edge patient-list Previous/Next buttons, with both neighbours supplied up front.",
  },
  ReplaceContextVariables: {
    scope: "external", params: ["text"], edge: "edge-only", wiki: 2047356875,
    description: "Resolve $VAR$ / *VAR* context variables; returns a Promise of the string.",
  },
};

/* ============================================================================
   The discern meta tag
   ========================================================================= */

/** Every value the wiki documents for `<meta name="discern" content="…">`. */
export const DISCERN_META_NAMES = [
  "APPLINK",
  "CCLLINK",
  "CCLLINKPOPUP",
  "CCLNEWSESSIONWINDOW",
  "CCLEVENT",
  "MPAGES_EVENT",
  "MPAGES_SVC_EVENT",
  "XMLCCLREQUEST",
  "CCLOVERRIDEPOPUPWINDOW",
] as const;

export interface ParsedDiscernMeta {
  names: string[];
  /** Values the wiki does not document. */
  unknown: string[];
  /** The wiki separates names with commas and NO spaces. */
  spaced: boolean;
}

export function parseDiscernMeta(content: string): ParsedDiscernMeta {
  const parts = content.split(",");
  const names: string[] = [];
  const unknown: string[] = [];
  let spaced = false;
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i];
    const name = raw.replace(/^\s+|\s+$/g, "").toUpperCase();
    if (name !== raw.toUpperCase()) spaced = true;
    if (!name) continue;
    names.push(name);
    if ((DISCERN_META_NAMES as readonly string[]).indexOf(name) === -1) unknown.push(name);
  }
  return { names, unknown, spaced };
}

/* ============================================================================
   Context variables
   ========================================================================= */

/**
 * The context variables the wiki's Context Variables page lists. They are
 * substituted in CCLLINK and APPLINK arguments and in the Discern Report
 * REPORT_NAME / REPORT_PARAM preferences — NOT inside MPAGES_EVENT payloads
 * (every MPAGES_EVENT page says so), and the wiki never says XMLCclRequest
 * parameters are substituted either.
 */
export const CONTEXT_VARIABLES: Readonly<Record<string, "string" | "number">> = {
  APP_AppName: "string",
  DEV_Location: "string",
  DEF_Location: "string",
  PAT_ABORhDisplay: "string",
  PAT_AccountId: "number",
  PAT_Age: "string",
  PAT_AgeInMinutes: "number",
  PAT_AllergyListing: "string",
  PAT_BirthDate: "string",
  PAT_ConsentDisplay: "string",
  PAT_EMR: "string",
  PAT_GestationalAgeAtBirth: "number",
  PAT_GestationalAgeAtBirthFormatted: "string",
  PAT_IQHealthAlias: "string",
  PAT_NameFirst: "string",
  PAT_NameFullFormatted: "string",
  PAT_NameLast: "string",
  PAT_NameMiddle: "string",
  PAT_PersonId: "number",
  PAT_PPRCode: "number",
  PAT_Sex: "string",
  PAT_SexMeaning: "string",
  PAT_SSN: "string",
  PAT_URN: "string",
  USR_PersonId: "number",
  USR_PersonName: "string",
  USR_PositionCd: "number",
  USR_Username: "string",
  VIS_EncntrId: "number",
  VIS_EncntrStatusCd: "number",
  VIS_EncntrTypeCd: "number",
  VIS_EncntrTypeClassCd: "number",
  VIS_EncntrTypeClassDisp: "string",
  VIS_EncntrTypeDisp: "string",
  VIS_EnctrStatusDisp: "string",
  VIS_FinNbr: "string",
  VIS_IsFutureEncntr: "number",
  VIS_IsolationCd: "number",
  VIS_IsolationDisp: "string",
  VIS_LocBedCd: "number",
  VIS_LocBedDisp: "string",
  VIS_LocFacilityCd: "number",
  VIS_LocFacilityDisp: "string",
  VIS_LocNurseUnitCd: "number",
  VIS_LocNurseUnitDisp: "string",
  VIS_LocRoomCd: "number",
  VIS_LocRoomDisp: "string",
  VIS_MedServiceCd: "number",
  VIS_MedServiceDisp: "string",
  VIS_OrgId: "number",
  VIS_ReasonForVisit: "string",
};

/** The catalogue name for a token, matched case-insensitively (the wiki writes `$pat_personid$` and `$VIS_ENCNTRID$`). */
export function contextVariableName(token: string): string | null {
  const wanted = token.toLowerCase();
  for (const name in CONTEXT_VARIABLES) if (name.toLowerCase() === wanted) return name;
  return null;
}

/** `$NAME$`, `*NAME*` and `$DM_INFO:NAME$`, restricted to the documented prefixes so ordinary `*` and `$` survive. */
const CONTEXT_TOKEN = /\$(DM_INFO:[^$]+|(?:APP|DEV|DEF|PAT|USR|VIS)_[A-Za-z]+)\$|\*((?:APP|DEV|DEF|PAT|USR|VIS)_[A-Za-z]+)\*/gi;

export interface ContextSubstitution {
  text: string;
  /** Tokens naming no documented variable ("Invalid parameter context variable"). */
  unknown: string[];
  /** Documented variables the caller had no value for (left in place). */
  unresolved: string[];
}

/**
 * Substitute context variables the way the wiki describes: `$NAME$` puts the
 * value in with `.00` appended to numbers; `*NAME*` leaves numbers bare and
 * URL-encodes the value. `$DM_INFO:…$` reads the DM_INFO table, which a
 * browser does not have, so it is reported as unresolved.
 */
export function substituteContextVariables(
  text: string,
  values: Readonly<Record<string, string | number | undefined>>,
): ContextSubstitution {
  const unknown: string[] = [];
  const unresolved: string[] = [];
  const out = text.replace(CONTEXT_TOKEN, (whole, dollar: string | undefined, star: string | undefined) => {
    const token = dollar ?? star ?? "";
    if (/^DM_INFO:/i.test(token)) { unresolved.push(token); return whole; }
    const name = contextVariableName(token);
    if (!name) { unknown.push(token); return whole; }
    const value = values[name];
    if (value === undefined) { unresolved.push(name); return whole; }
    if (star !== undefined) return encodeURIComponent(String(value));
    return CONTEXT_VARIABLES[name] === "number" ? `${Number(value)}.00` : String(value);
  });
  return { text: out, unknown, unresolved };
}
