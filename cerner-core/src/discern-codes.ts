/**
 * Encoders and decoders for the positional payloads an MPage hands PowerChart.
 *
 * `discern.ts` names the calls; this module knows what the numbers inside them
 * mean. The tables were first read from `geekmdtravis/fluent-cerner-js` 1.1.x
 * (MIT, © 2022 geekmdtravis) and have since been checked against Oracle's
 * MPages Development Wiki itself (`MPAGES_EVENT - ORDERS`, `CreateMOEW`,
 * `GetAvailableOrderActions`, `MPAGES_EVENT - CLINICALNOTE`, `APPLINK`, …).
 * Where the two disagree the wiki wins and the comment says so; what only the
 * library (not the wiki) says is labelled as such. None of it is observed in a
 * live client.
 *
 * Both directions are here so a caller (an MPage, a test) and a host (the
 * PowerChart stage, the player's dev mock) share one copy of each table.
 */

/* ============================================================================
   Payload splitting
   ========================================================================= */

/**
 * Split a pipe-delimited payload into its top-level fields. `[...]` and `{...}`
 * groups are themselves pipe-delimited, so a plain `split("|")` shreds them
 * and shifts every later field. Throws on unbalanced groups.
 */
export function splitDiscernPayload(payload: string): string[] {
  const fields: string[] = [];
  const closes: string[] = [];
  let current = "";
  for (const char of payload) {
    if (char === "[") closes.push("]");
    if (char === "{") closes.push("}");
    if (char === "]" || char === "}") {
      if (closes.pop() !== char) throw new Error("Unbalanced MPage payload groups.");
    }
    if (char === "|" && !closes.length) {
      fields.push(current);
      current = "";
    } else current += char;
  }
  if (closes.length) throw new Error("Unbalanced MPage payload groups.");
  return [...fields, current];
}

/** `{a|b}{c|d}` → `["a|b", "c|d"]`. Text outside braces is an error. */
function braceGroups(field: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of field) {
    if (char === "{") {
      if (depth++ === 0) { current = ""; continue; }
    } else if (char === "}") {
      if (--depth === 0) { groups.push(current); continue; }
      if (depth < 0) throw new Error("Unbalanced order string braces.");
    } else if (depth === 0) {
      if (char.trim()) throw new Error(`Unexpected "${char}" between order strings.`);
      continue;
    }
    current += char;
  }
  if (depth) throw new Error("Unbalanced order string braces.");
  return groups;
}

const unbracket = (value: string) => value.replace(/^\[|\]$/g, "");
const num = (value: string | undefined) => {
  const n = Number(value ?? "");
  return Number.isFinite(n) ? n : NaN;
};

/* ============================================================================
   MPAGES_EVENT("ORDERS")
   ========================================================================= */

/**
 * The order verbs, keyed by the names fluent-cerner-js gives them. The wire
 * verbs are exactly the thirteen `orderAction` values the wiki lists. `launch
 * moew` and `new order` share the wire verb `ORDER`; launch is the wiki's
 * "empty" set `{ORDER|0|0|0|0|0}`.
 */
export const ORDER_ACTIONS = {
  "launch moew": "ORDER",
  "new order": "ORDER",
  "activate existing": "ACTIVATE",
  "cancel-discontinue": "CANCEL DC",
  "cancel-reorder": "CANCEL REORD",
  "clear actions": "CLEAR",
  "convert inpatient": "CONVERT_INPAT",
  "convert prescription": "CONVERT_RX",
  modify: "MODIFY",
  renew: "RENEW",
  "renew prescription": "RENEW_RX",
  "copy existing": "REPEAT",
  resume: "RESUME",
  suspend: "SUSPEND",
} as const;

export type OrderActionName = keyof typeof ORDER_ACTIONS;
export type OrderVerb = (typeof ORDER_ACTIONS)[OrderActionName];

/** The reading a person wants, per wire verb. */
export const ORDER_VERB_LABELS: Readonly<Record<OrderVerb, string>> = {
  ORDER: "new order",
  ACTIVATE: "activate existing",
  "CANCEL DC": "cancel/discontinue",
  "CANCEL REORD": "cancel and reorder",
  CLEAR: "clear actions",
  CONVERT_INPAT: "convert to inpatient",
  CONVERT_RX: "convert to prescription",
  MODIFY: "modify",
  RENEW: "renew",
  RENEW_RX: "renew prescription",
  REPEAT: "copy existing",
  RESUME: "resume",
  SUSPEND: "suspend",
};

const VERBS = new Set<string>(Object.values(ORDER_ACTIONS));
export const isOrderVerb = (value: string): value is OrderVerb => VERBS.has(value);

export const ORDER_ORIGINATIONS = { normal: 0, prescription: 1, satellite: 5 } as const;
export type OrderOrigination = keyof typeof ORDER_ORIGINATIONS;
export const ORDER_INTERACTION_CHECKS = { default: 0, "on sign": 1 } as const;
export type OrderInteractionCheck = keyof typeof ORDER_INTERACTION_CHECKS;

/**
 * `{tab|tabDisplayFlags}` as fluent-cerner-js fills it: 2 is the Order List,
 * 3 the Medication List. The display value is a pane mask (MOEW_DISPLAY_FLAGS);
 * the wiki says 127 is "full PowerOrders functionality" and never uses 0.
 * fluent-cerner-js sends 0 for its plain tabs — REVERSE-ENGINEERED ONLY, and a
 * mask with no search (8) or scratchpad (32) pane is one the wiki says cannot
 * add orders. Pass `displayFlags: 127` to encodeOrdersEvent for the documented
 * payload.
 */
export const ORDER_TABS = {
  orders: { tab: 2, display: 0 },
  "power orders": { tab: 2, display: 127 },
  medications: { tab: 3, display: 0 },
  "power medications": { tab: 3, display: 127 },
} as const;
export type OrderTabName = keyof typeof ORDER_TABS;

export const ORDER_LAUNCH_VIEWS = { search: 8, profile: 16, signature: 32 } as const;
export type OrderLaunchView = keyof typeof ORDER_LAUNCH_VIEWS;

/**
 * The fourth ORDERS field, `customizeFlags`. The wiki: "use a value of 24 to
 * enable PowerPlans, otherwise 0" — 24 is CreateMOEW's 8 (plan order entry) |
 * 16 (plan documentation). Tying it to a PowerPlan TAB is fluent-cerner-js'
 * choice, not the wiki's.
 */
export const ORDERS_POWER_PLAN_FLAG = 24;

export interface OrderStringOptions {
  orderSentenceId?: number;
  nomenclatureIds?: readonly number[];
  origination?: OrderOrigination;
  interactionCheck?: OrderInteractionCheck;
}

/**
 * One `{...}` order string. A new order carries its synonym id; every other
 * verb carries the id of the existing order it acts on.
 */
export function encodeOrderString(
  action: OrderActionName,
  id = 0,
  opts: OrderStringOptions = {},
): string {
  const verb = ORDER_ACTIONS[action];
  if (action === "launch moew") return `{${verb}|0|0|0|0|0}`;
  if (!id) throw new Error(`"${action}" needs ${action === "new order" ? "a synonym" : "an order"} id.`);
  if (action !== "new order") return `{${verb}|${id}}`;
  const nids = opts.nomenclatureIds ?? [];
  return `{${[
    verb,
    id,
    ORDER_ORIGINATIONS[opts.origination ?? "normal"],
    opts.orderSentenceId ?? 0,
    nids.length > 1 ? `[${nids.join("|")}]` : nids[0] ?? 0,
    ORDER_INTERACTION_CHECKS[opts.interactionCheck ?? "default"],
  ].join("|")}}`;
}

export interface OrdersEventInput {
  personId: number;
  encntrId: number;
  /** Order strings from `encodeOrderString`, concatenated in order. */
  orders: readonly string[];
  targetTab?: OrderTabName;
  launchView?: OrderLaunchView;
  signSilently?: boolean;
  /** Override the tab's pane mask; 127 is the wiki's "full PowerOrders functionality". */
  displayFlags?: number;
}

/**
 * The whole ORDERS payload, exactly as fluent-cerner-js' `submitOrdersAsync`
 * builds it (seven fields, the silent-sign flag always present) unless
 * `displayFlags` overrides the pane mask.
 */
export function encodeOrdersEvent(input: OrdersEventInput): string {
  const targetTab = input.targetTab ?? "orders";
  const { tab, display } = ORDER_TABS[targetTab];
  return [
    input.personId,
    input.encntrId,
    input.orders.join(""),
    targetTab.startsWith("power") ? ORDERS_POWER_PLAN_FLAG : 0,
    `{${tab}|${input.displayFlags ?? display}}`,
    ORDER_LAUNCH_VIEWS[input.launchView ?? "signature"],
    input.signSilently ? 1 : 0,
  ].join("|");
}

export type DecodedOrder =
  | {
      verb: "ORDER";
      /** 0 only for the bare "launch the order window" string. */
      synonymId: number;
      origination: OrderOrigination | number;
      orderSentenceId: number;
      nomenclatureIds: number[];
      interactionCheck: OrderInteractionCheck | number;
    }
  | { verb: Exclude<OrderVerb, "ORDER">; orderId: number };

const keyFor = <T extends Record<string, number>>(table: T, value: number): keyof T | number =>
  (Object.keys(table) as (keyof T)[]).find((key) => table[key] === value) ?? value;

/** Decode the concatenated `{...}{...}` field. Throws on anything malformed. */
export function decodeOrderStrings(field: string): DecodedOrder[] {
  return braceGroups(field).map((group) => {
    const [verb, ...rest] = splitDiscernPayload(group);
    if (!isOrderVerb(verb)) throw new Error(`"${verb}" is not an ORDERS verb.`);
    if (verb === "ORDER") {
      if (rest.length !== 5) throw new Error(`ORDER takes five fields after the verb; got ${rest.length}.`);
      const [synonym, origination, sentence, nomenclature, interaction] = rest;
      const synonymId = num(synonym);
      if (Number.isNaN(synonymId)) throw new Error(`"${synonym}" is not a synonym id.`);
      return {
        verb,
        synonymId,
        origination: keyFor(ORDER_ORIGINATIONS, num(origination)) as OrderOrigination | number,
        orderSentenceId: num(sentence) || 0,
        nomenclatureIds: unbracket(nomenclature).split("|").map(Number).filter((n) => n > 0),
        interactionCheck: keyFor(ORDER_INTERACTION_CHECKS, num(interaction)) as OrderInteractionCheck | number,
      };
    }
    if (rest.length !== 1) throw new Error(`${verb} takes one order id; got ${rest.length} fields.`);
    const orderId = num(rest[0]);
    if (!(orderId > 0)) throw new Error(`"${rest[0]}" is not an order id.`);
    return { verb, orderId };
  });
}

/** One `{tab|tabDisplayFlags}` set from the ORDERS tab list. */
export interface DecodedOrdersTab {
  /** "orders" (2) / "medications" (3) when the tab code is one the wiki names. */
  tab: "orders" | "medications" | number;
  display: number;
  panes: MOEWDisplayFlag[];
  unknownDisplayBits: number;
}

export interface DecodedOrdersEvent {
  personId: number;
  encntrId: number;
  orders: DecodedOrder[];
  /** The raw customizeFlags field (CreateMOEW's dwCustomizeFlag bits). */
  customizeFlags: number;
  customize: MOEWCustomizeFlag[];
  /** Plan order entry (bit 8) is on; the wiki's documented value is 24. */
  powerPlans: boolean;
  /** Every `{tab|display}` set, in order; the wiki's own example sends `{2|127}{3|127}`. */
  tabs: DecodedOrdersTab[];
  /** The first set's tab and pane mask. */
  tab: "orders" | "medications" | number;
  display: number;
  launchView: OrderLaunchView | number;
  signSilently: boolean;
  /** False when the payload stopped at defaultDisplay (six fields), as the wiki's examples do. */
  silentSignFieldPresent: boolean;
  /** True when the only order string is the bare launch (`{ORDER|0|0|0|0|0}`). */
  launchOnly: boolean;
}

const tabCodeName = (code: number): DecodedOrdersTab["tab"] => (code === 2 ? "orders" : code === 3 ? "medications" : code);

/** `{2|127}{3|127}` → one entry per set. Throws on anything that is not a list of two-field sets. */
export function decodeOrdersTabList(field: string): DecodedOrdersTab[] {
  const groups = braceGroups(field);
  if (!groups.length) throw new Error(`"${field}" is not a {tab|display} list.`);
  return groups.map((group) => {
    const parts = splitDiscernPayload(group);
    const code = num(parts[0]);
    const display = num(parts[1]);
    if (parts.length !== 2 || Number.isNaN(code) || Number.isNaN(display)) throw new Error(`"{${group}}" is not a {tab|display} spec.`);
    const bits = decodeBits(MOEW_DISPLAY_FLAGS, display);
    return { tab: tabCodeName(code), display, panes: bits.names, unknownDisplayBits: bits.unknownBits };
  });
}

/**
 * Decode an ORDERS payload. Six fields (no silentSignFlag, as every example
 * on the MPDEVWIKI page) and seven (as the Discern Explorer help and
 * fluent-cerner-js send) are both documented.
 */
export function decodeOrdersEvent(payload: string): DecodedOrdersEvent {
  const fields = splitDiscernPayload(payload);
  if (fields.length !== 6 && fields.length !== 7) throw new Error(`ORDERS expects 6 or 7 fields; got ${fields.length}.`);
  const [person, encounter, orderField, customizeField, tabField, view, silent] = fields;
  const tabs = decodeOrdersTabList(tabField);
  const orders = decodeOrderStrings(orderField);
  const customizeFlags = num(customizeField) || 0;
  return {
    personId: num(person),
    encntrId: num(encounter),
    orders,
    customizeFlags,
    customize: decodeBits(MOEW_CUSTOMIZE_FLAGS, customizeFlags).names,
    powerPlans: (customizeFlags & MOEW_CUSTOMIZE_FLAGS["allow power plans"]) !== 0,
    tabs,
    tab: tabs[0].tab,
    display: tabs[0].display,
    launchView: keyFor(ORDER_LAUNCH_VIEWS, num(view)) as OrderLaunchView | number,
    signSilently: silent !== undefined && num(silent) === 1,
    silentSignFieldPresent: silent !== undefined,
    launchOnly: orders.length > 0 && orders.every((o) => o.verb === "ORDER" && o.synonymId === 0),
  };
}

/**
 * The wiki's rule for silentSignFlag: orders sign without the window only
 * when every line is a NEW order (no other orderActions) — and, in the
 * client, only when their required details are prefilled and nothing else is
 * already on the scratchpad. Null when a silent sign is allowed.
 */
export function silentSignBlocker(event: DecodedOrdersEvent): string | null {
  if (!event.signSilently) return null;
  const actions = event.orders.filter((o) => o.verb !== "ORDER");
  return actions.length
    ? `silentSignFlag only signs new orders silently; ${actions.map((o) => o.verb).join(", ")} ${actions.length === 1 ? "is an order action" : "are order actions"}, so the window is shown`
    : null;
}

/* ============================================================================
   POWERORDERS — the Modal Order Entry Window (MOEW)
   ========================================================================= */

/**
 * `dwCustomizeFlag` bits (wiki: CreateMOEW; the POE_* constant each maps to is
 * in the comment). 0 means "PowerOrders defaults".
 */
export const MOEW_CUSTOMIZE_FLAGS = {
  "sign later": 1, // POE_MOEW_CUSTOMIZE_ALLOW_SIGN_LATER
  /** The wiki marks it "not implemented". */
  actionable: 2, // POE_MOEW_ACTION_MODE_ACTIONABLE
  "read only": 4, // POE_MOEW_ACTION_MODE_READONLY
  "allow power plans": 8, // POE_GEN_ALLOW_PLAN_ORDER_ENTRY
  "allow power plan doc": 16, // POE_VIEW_DOCUMENT_IN_PLAN
  /** Inpatient and ambulatory venue ordering only. */
  "allow only inpatient and outpatient orders": 32, // POE_MOEW_RX_ONLY_VENUE_SEARCH
  /** The wiki marks it "not implemented — use CustomizeSignBtnCaptionMOEW". */
  "custom sign caption": 64, // POE_MOEW_CUSTOMIZE_SIGN_CAPTION
  "show refresh and print buttons": 128, // POE_MOEW_SHOW_BANNER
  "documented meds only": 256, // POE_MOEW_DOCUMENT_MEDS_ONLY
  "hide med rec": 512, // POE_MOEW_HIDE_MEDS_REC
  "disallow EOL": 1024, // POE_MOEW_DISALLOW_EOL
  "hide demographics": 2048, // POE_MOEW_HIDE_DEMOGRAPHICS
  "add rx to filter": 4096, // POE_MOEW_ADD_RX_TO_FILTER
  "disable auto search": 8192, // POE_MOEW_DO_NOT_AUTO_INVOKE_SEARCH
  "allow regimen": 16384, // POE_GEN_ALLOW_REGIMEN
} as const;

/** Customize bits the wiki documents but says do nothing. */
export const MOEW_UNIMPLEMENTED_CUSTOMIZE_BITS = 2 | 64;

/**
 * `dwTabDisplayOptionsFlag` bits: which panes the window shows. The wiki says
 * search (8) and scratchpad (32) are required to add orders, and details (64)
 * to act on any order.
 */
export const MOEW_DISPLAY_FLAGS = {
  "show nav tree": 1, // POE_VIEW_LIST_NAVIGATOR
  "show diag and probs": 2, // POE_VIEW_LIST_DIAGNOSES_AND_PROBLEMS
  "show related res": 4, // POE_VIEW_LIST_RESULTS
  "show orders search": 8, // POE_VIEW_LIST_SEARCH
  "show order profile": 16, // POE_VIEW_LIST_PROFILE
  "show scratchpad": 32, // POE_VIEW_LIST_SCRATCHPAD
  "show list details": 64, // POE_VIEW_LIST_DETAILS
  "plan entry only": 128, // POE_VIEW_LIST_PLAN_ENTRY_ONLY
  "show formulary details": 256, // POE_VIEW_LIST_FORMULARY_DETAILS
} as const;

/** The wiki's named combinations of display bits. */
export const MOEW_DISPLAY_PRESETS = {
  /** POE_VIEW_LIST_RUBBER_BAND: navigator | diagnoses | results | formulary details. */
  "rubber band": 1 | 2 | 4 | 256,
  /** POE_VIEW_LIST_MOPED: plan entry only | navigator | results | profile | scratchpad | details. */
  moped: 128 | 1 | 4 | 16 | 32 | 64,
  /** POE_VIEW_LIST_ALL: rubber band | search | profile | scratchpad | details. */
  all: 1 | 2 | 4 | 256 | 8 | 16 | 32 | 64,
  /** What every wiki example passes. */
  "full powerorders": 127,
} as const;

/** Panes the wiki says an MOEW needs before it can ADD orders. */
export const MOEW_PANES_TO_ADD_ORDERS = 8 | 32;
/** The pane the wiki says an MOEW needs before it can act on an existing order. */
export const MOEW_PANE_TO_ACT_ON_ORDERS = 64;

/** `dwTabFlag`. */
export const MOEW_TABS = { "orders tab": 2, "medications tab": 3 } as const;

export type MOEWCustomizeFlag = keyof typeof MOEW_CUSTOMIZE_FLAGS;
export type MOEWDisplayFlag = keyof typeof MOEW_DISPLAY_FLAGS;
export type MOEWTab = keyof typeof MOEW_TABS;

export interface MOEWFlags {
  dwCustomizeFlag: number;
  dwTabFlag: number;
  dwTabDisplayOptionsFlag: number;
}

/** What fluent-cerner-js asks for when a caller names no flags. */
export const MOEW_DEFAULT_FLAGS: readonly (MOEWCustomizeFlag | MOEWDisplayFlag)[] = [
  "show refresh and print buttons", "allow power plan doc", "allow power plans",
  "show list details", "show scratchpad", "show order profile", "show orders search",
  "show related res", "show diag and probs", "show nav tree",
];

export function encodeMOEWFlags(
  tab: MOEWTab,
  flags: readonly (MOEWCustomizeFlag | MOEWDisplayFlag)[] = MOEW_DEFAULT_FLAGS,
): MOEWFlags {
  let dwCustomizeFlag = 0;
  let dwTabDisplayOptionsFlag = 0;
  for (const flag of new Set(flags)) {
    if (flag in MOEW_CUSTOMIZE_FLAGS) dwCustomizeFlag |= MOEW_CUSTOMIZE_FLAGS[flag as MOEWCustomizeFlag];
    else dwTabDisplayOptionsFlag |= MOEW_DISPLAY_FLAGS[flag as MOEWDisplayFlag];
  }
  return { dwCustomizeFlag, dwTabFlag: MOEW_TABS[tab], dwTabDisplayOptionsFlag };
}

function decodeBits<T extends Record<string, number>>(table: T, value: number) {
  const names = (Object.keys(table) as (keyof T & string)[]).filter((name) => value & table[name]);
  const known = names.reduce((sum, name) => sum | table[name], 0);
  return { names, unknownBits: value & ~known };
}

export interface DecodedMOEWFlags {
  tab: MOEWTab | number;
  customize: MOEWCustomizeFlag[];
  display: MOEWDisplayFlag[];
  /** Bits set that no table names; worth a warning, not an error. */
  unknownCustomizeBits: number;
  unknownDisplayBits: number;
}

export function decodeMOEWFlags(flags: MOEWFlags): DecodedMOEWFlags {
  const customize = decodeBits(MOEW_CUSTOMIZE_FLAGS, flags.dwCustomizeFlag);
  const display = decodeBits(MOEW_DISPLAY_FLAGS, flags.dwTabDisplayOptionsFlag);
  return {
    tab: keyFor(MOEW_TABS, flags.dwTabFlag) as MOEWTab | number,
    customize: customize.names,
    display: display.names,
    unknownCustomizeBits: customize.unknownBits,
    unknownDisplayBits: display.unknownBits,
  };
}

/** `AddNewOrdersToScratchpad` return codes. */
export const SCRATCHPAD_RESULTS = {
  0: "successfully added",
  1: "added and signed",
  2: "cancelled by user",
  3: "add failed",
} as const;
export type ScratchpadResultCode = keyof typeof SCRATCHPAD_RESULTS;

/** `GetScratchPadOrders`' eSpType: which scratchpad to read. */
export const SCRATCHPAD_TYPES = {
  0: "not defined",
  1: "local",
  2: "only local",
  3: "global",
  4: "current",
} as const;

/**
 * `GetAvailableOrderActions`' DWORD: one bit per action PowerOrders would
 * allow on the order right now (wiki page GetAvailableOrderActions).
 */
export const ORDER_ACTION_AVAILABILITY = {
  CancelDC: 1 << 0,
  Modify: 1 << 1,
  Activate: 1 << 2,
  Cosign: 1 << 3,
  Review: 1 << 4,
  Repeat: 1 << 5,
  Prep: 1 << 6,
  Comments: 1 << 7,
  Ingred: 1 << 8,
  Suspend: 1 << 9,
  Resume: 1 << 10,
  Renew: 1 << 11,
  Reference: 1 << 12,
  Info: 1 << 13,
  Remove: 1 << 14,
  Complete: 1 << 15,
  MedRequest: 1 << 16,
  Reschedule: 1 << 17,
  TransferCancel: 1 << 18,
  Void: 1 << 19,
  Clear: 1 << 20,
  Reorder: 1 << 21,
  GiveWith: 1 << 22,
  UnLink: 1 << 23,
  TCRewrite: 1 << 24,
  RenewRx: 1 << 25,
  ConvertInpatient: 1 << 26,
  ConvertRx: 1 << 27,
  ConvertHx: 1 << 28,
  ResolveITP: 1 << 29,
  RetailMedManagerRefill: 1 << 30,
} as const;
export type OrderActionAvailability = keyof typeof ORDER_ACTION_AVAILABILITY;

export const encodeOrderActionAvailability = (actions: readonly OrderActionAvailability[]) =>
  actions.reduce((mask, action) => (mask | ORDER_ACTION_AVAILABILITY[action]) >>> 0, 0);
export const decodeOrderActionAvailability = (mask: number) => decodeBits(ORDER_ACTION_AVAILABILITY, mask >>> 0).names;

/** `InvokeRetailMedManagerRefillRequestReview` results. */
export const RETAIL_REFILL_RESULTS = {
  0: "refill request submitted",
  1: "refill request not submitted",
  2: "error retrieving refill request review data",
  3: "error submitting refill request",
  100: "invalid parameters",
  101: "function pointer missing from pvorderpoe.dll",
} as const;

/** `ORDERS.LaunchOrdersMode` eMode, and the reconciliation modes it reads from the object. */
export const ORDERS_LAUNCH_MODES = { 0: "order list", 1: "medication list", 2: "reconciliation" } as const;
export const RECONCILIATION_MODES = {
  0: "unknown",
  1: "admission",
  2: "transfer",
  3: "discharge",
  4: "short term leave",
  5: "short term return",
} as const;

/** `TASKDOC.DocumentTasks` chart modes. */
export const TASK_CHART_MODES = ["CHART", "CHART_DONE", "CHART_DONE_DT_TM", "CHART_NOT_DONE"] as const;

/** `PATIENTEDUCATION.SetDefaultTab`. */
export const PATIENT_EDUCATION_TABS = { 0: "instructions", 1: "follow-up" } as const;

/** `CCLEVENT` names (IE; in Edge only from Discern alerts and EdgePopup). */
export const CCLEVENT_NAMES = [
  "EVENT_EKS_OK",
  "EVENT_NOTIFY_DELETE",
  "EVENT_NOTIFY_DELETE_HTMLONLY",
  "EVENT_NOTIFY_MINIMIZE",
] as const;

/**
 * `PVFRAMEWORKLINK.LaunchPopup` properties, by setter. REPORT_NAME carries a
 * web page as `<url>https://…` or an MPage report name used with REPORT_PARAM.
 */
export const POPUP_PROPERTIES = {
  bool: ["MODAL", "SHOW_TOOLBAR", "SHOW_BUTTONS", "REFRESH_ON_ENCOUNTER_CHANGE", "EDGE"],
  string: ["DLL_NAME", "REPORT_NAME", "REPORT_PARAM", "VIEW_CAPTION"],
  double: ["WIDTH", "HEIGHT", "LEFT", "TOP"],
  long: [] as string[],
} as const;
/** PCSendMessage id a LaunchPopup window sends to close itself. */
export const POPUP_CLOSE_MESSAGE_ID = 2101;
/** Message ids below this are Oracle's. */
export const CUSTOM_MESSAGE_ID_FLOOR = 10000;

/* ============================================================================
   DYNDOC.CreateNewNote
   ========================================================================= */

export interface CreateNewNoteRequest {
  personId: number;
  encounterId: number;
  notes: { referenceTemplateId: number; eventCd: number; workflowId?: number }[];
}

/**
 * Read CreateNewNote's JSON (a string or an object). Throws when the shape is
 * not the wiki's, including a second note carrying workflow_id — only one note
 * may be tied to the workflow's documentation components.
 */
export function parseCreateNewNoteJson(input: unknown): CreateNewNoteRequest {
  const value = (typeof input === "string" ? JSON.parse(input) : input) as Record<string, unknown> | null;
  if (!value || typeof value !== "object") throw new Error("CreateNewNote takes a JSON object.");
  const personId = Number(value.person_id);
  const encounterId = Number(value.encounter_id);
  if (!(personId > 0) || !(encounterId > 0)) throw new Error("CreateNewNote needs person_id and encounter_id.");
  if (!Array.isArray(value.note_list) || !value.note_list.length) throw new Error("CreateNewNote needs a non-empty note_list.");
  const notes = (value.note_list as Record<string, unknown>[]).map((note, i) => {
    const referenceTemplateId = Number(note?.reference_template_id);
    const eventCd = Number(note?.event_cd);
    if (!(referenceTemplateId > 0) || !(eventCd > 0)) throw new Error(`note_list[${i}] needs reference_template_id and event_cd.`);
    const workflowId = Number(note.workflow_id);
    return { referenceTemplateId, eventCd, ...(workflowId > 0 ? { workflowId } : {}) };
  });
  if (notes.filter((note) => note.workflowId).length > 1) throw new Error("Only one note in note_list may carry a workflow_id.");
  return { personId, encounterId, notes };
}

/* ============================================================================
   MPAGES_EVENT("CLINICALNOTE") view options
   ========================================================================= */

export const CLINICAL_NOTE_VIEW_FLAGS = {
  menu: 1,
  buttons: 2,
  toolbar: 4,
  calculator: 8,
  "view-only": 16,
} as const;
export type ClinicalNoteViewFlag = keyof typeof CLINICAL_NOTE_VIEW_FLAGS;

export const encodeClinicalNoteViewFlags = (flags: readonly ClinicalNoteViewFlag[]) =>
  [...new Set(flags)].reduce((sum, flag) => sum | CLINICAL_NOTE_VIEW_FLAGS[flag], 0);

export const decodeClinicalNoteViewFlags = (value: number) =>
  decodeBits(CLINICAL_NOTE_VIEW_FLAGS, value);

export interface DecodedClinicalNoteEvent {
  personId: number;
  encntrId: number;
  eventIds: number[];
  windowTitle: string;
  viewFlags: ClinicalNoteViewFlag[];
  viewOnly: boolean;
  inheritance: { viewName: string; viewSeq: string; compName: string; compSeq: string };
}

export function decodeClinicalNoteEvent(payload: string): DecodedClinicalNoteEvent {
  const fields = splitDiscernPayload(payload);
  if (fields.length !== 9) throw new Error(`CLINICALNOTE expects 9 fields; got ${fields.length}.`);
  const [person, encounter, events, windowTitle, flags, viewName, viewSeq, compName, compSeq] = fields;
  if (!/^\[.*\]$/.test(events)) throw new Error(`"${events}" is not a bracketed event id list.`);
  const viewFlags = decodeClinicalNoteViewFlags(num(flags) || 0).names;
  return {
    personId: num(person),
    encntrId: num(encounter),
    eventIds: unbracket(events).split("|").map(Number).filter((n) => n > 0),
    windowTitle,
    viewFlags,
    viewOnly: viewFlags.includes("view-only"),
    inheritance: { viewName, viewSeq, compName, compSeq },
  };
}

/* ============================================================================
   MPAGES_EVENT("POWERFORM"), ("POWERNOTE"), ("ALLERGY")
   ========================================================================= */

export interface DecodedPowerFormEvent {
  personId: number;
  encntrId: number;
  formId: number;
  activityId: number;
  /** 0 view or modify, 1 view-only; meaningless for the Ad Hoc search. */
  chartMode: number;
  /** formId and activityId both 0: the Ad Hoc Charting dialog. */
  adHoc: boolean;
  /** A non-zero activityId opens that existing form, whatever formId says. */
  existing: boolean;
}

export function decodePowerFormEvent(payload: string): DecodedPowerFormEvent {
  const fields = splitDiscernPayload(payload);
  if (fields.length !== 5) throw new Error(`POWERFORM expects 5 fields; got ${fields.length}.`);
  const [person, encounter, form, activity, mode] = fields.map(num);
  if ([person, encounter, form, activity, mode].some(Number.isNaN)) throw new Error("POWERFORM fields are all numbers.");
  if (mode !== 0 && mode !== 1) throw new Error(`chartMode ${mode} is neither 0 (view or modify) nor 1 (view-only).`);
  return {
    personId: person, encntrId: encounter, formId: form, activityId: activity, chartMode: mode,
    adHoc: form === 0 && activity === 0,
    existing: activity !== 0,
  };
}

export interface DecodedPowerNoteEvent {
  personId: number;
  encntrId: number;
  /** CKI_SOURCE!CKI_IDENTIFIER naming an encounter pathway; "" when loading an existing note. */
  cki: string;
  ckiSource: string;
  ckiIdentifier: string;
  /** CLINICAL_EVENT event_id of an existing PowerNote; 0 for a new note. */
  eventId: number;
}

/** Throws the wiki's own complaint when neither a CKI nor an event id is given. */
export function decodePowerNoteEvent(payload: string): DecodedPowerNoteEvent {
  const fields = splitDiscernPayload(payload);
  if (fields.length !== 4) throw new Error(`POWERNOTE expects 4 fields; got ${fields.length}.`);
  const [person, encounter, cki, event] = fields;
  const eventId = num(event) || 0;
  if (!eventId && !cki.trim()) throw new Error("A valid event id or encounter pathway CKI identifier must be provided.");
  const bang = cki.indexOf("!");
  return {
    personId: num(person),
    encntrId: num(encounter),
    cki,
    ckiSource: bang > 0 ? cki.slice(0, bang) : "",
    ckiIdentifier: bang > 0 ? cki.slice(bang + 1) : cki,
    eventId,
  };
}

export interface DecodedAllergyEvent {
  personId: number;
  encntrId: number;
  mode: "profile" | "modify" | "add";
  allergyId: number;
  nomenId: number;
  substanceDisp: string;
  conceptId: string;
  substanceTypeCd: number;
  substanceTypeDisplay: string;
  viewSeq: number;
  compSeq: number;
}

/**
 * ALLERGY: a non-zero allergyId modifies that allergy (the substance fields
 * are ignored), every substance field empty opens the Allergy Profile, and
 * anything else adds an allergy — which needs substanceDisp.
 */
export function decodeAllergyEvent(payload: string): DecodedAllergyEvent {
  const fields = splitDiscernPayload(payload);
  if (fields.length !== 10) throw new Error(`ALLERGY expects 10 fields; got ${fields.length}.`);
  const [person, encounter, allergy, nomen, substanceDisp, conceptId, typeCd, typeDisplay, viewSeq, compSeq] = fields;
  const allergyId = num(allergy) || 0;
  const nomenId = num(nomen) || 0;
  const substanceTypeCd = num(typeCd) || 0;
  const empty = !nomenId && !substanceDisp.trim() && !conceptId.trim() && !substanceTypeCd && !typeDisplay.trim();
  const mode = allergyId ? "modify" : empty ? "profile" : "add";
  if (mode === "add" && !substanceDisp.trim()) throw new Error("A new allergy needs substanceDisp.");
  return {
    personId: num(person), encntrId: num(encounter), mode, allergyId, nomenId,
    substanceDisp, conceptId, substanceTypeCd, substanceTypeDisplay: typeDisplay,
    viewSeq: num(viewSeq) || 0, compSeq: num(compSeq) || 0,
  };
}

/* ============================================================================
   APPLINK
   ========================================================================= */

/**
 * APPLINK's `linkmode`, as the wiki defines it. Chart navigation
 * (/PERSONID /ENCNTRID /FIRSTTAB, /ORGANIZERTAB) is documented for mode 0
 * with the solution's executable or `$APP_AppName$`.
 */
export const APPLINK_LINK_MODES = {
  0: "start a solution by executable name",
  1: "start a solution by application object (e.g. DiscernAnalytics.Application)",
  100: "shell-execute a file, link or executable",
} as const;

/**
 * APPLINK's first argument under fluent-cerner-js' names. Its "by solution
 * name" is the wiki's mode 0 ("by executable name"), and its "by executable"
 * is 100, a shell execute — fluent-cerner-js opens chart tabs with 100, which
 * the wiki does not document (every chart-navigation example uses 0).
 */
export const APPLINK_MODES = {
  "by solution name": 0,
  "by application object": 1,
  "by file": 100,
  "by url": 100,
  "by executable": 100,
} as const;

export interface AppLinkArgument {
  argument: string;
  value: string | number;
  /** Chart tabs only: append `+`, which opens the tab's Add action. */
  quickOpen?: boolean;
}

/** `/PERSONID=1 /FIRSTTAB=^Orders+^` — tab values are caret-quoted. */
export function encodeAppLinkArguments(args: readonly AppLinkArgument[]): string {
  return args.map(({ argument, value, quickOpen }) => {
    const organizer = /organizertab/i.test(argument);
    const tab = organizer || /firsttab/i.test(argument);
    const quote = tab ? "^" : "";
    return `/${argument.toUpperCase()}=${quote}${value}${quickOpen && tab && !organizer ? "+" : ""}${quote}`;
  }).join(" ");
}

/** The inverse, with argument names upper-cased. Caret quoting allows spaces. */
export function decodeAppLinkArguments(args: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of args.matchAll(/\/([A-Z_]+)=(?:\^([^^]*)\^|(\S+))/gi)) {
    out[match[1].toUpperCase()] = match[2] ?? match[3];
  }
  return out;
}

/* ============================================================================
   PEXSCHEDULINGACTIONS
   ========================================================================= */

/**
 * Scheduling methods and the appointment state each leaves behind. Each takes
 * sch_appt.sch_event_id; ShowView and ShowHistoryView also take the
 * schedule_id (fluent-cerner-js passes only the event id).
 */
export const SCHEDULING_ACTIONS = {
  CheckInAppointment: "Checked In",
  CheckOutAppointment: "Checked Out",
  CancelAppointment: "Canceled",
  HoldAppointment: "Hold",
  NoShowAppointment: "No Show",
} as const;
export type SchedulingStateAction = keyof typeof SCHEDULING_ACTIONS;

/* ============================================================================
   Human-readable descriptions for call logs
   ========================================================================= */

const list = (items: readonly (string | number)[]) => items.join(", ") || "none";

export function describeOrder(order: DecodedOrder): string {
  if (order.verb !== "ORDER") return `${ORDER_VERB_LABELS[order.verb]} · order ${order.orderId}`;
  if (!order.synonymId) return "launch the order window";
  const extras = [
    order.origination !== "normal" && `origination ${order.origination}`,
    order.orderSentenceId && `sentence ${order.orderSentenceId}`,
    order.nomenclatureIds.length && `diagnoses ${list(order.nomenclatureIds)}`,
    order.interactionCheck !== "default" && `interaction check ${order.interactionCheck}`,
  ].filter(Boolean);
  return [`new order · synonym ${order.synonymId}`, ...extras].join(" · ");
}

const viewLabel = (view: OrderLaunchView | number) =>
  typeof view === "number" ? `view ${view}` : `opens on ${view === "signature" ? "Signature" : view === "profile" ? "Profile" : "Search"}`;

export function describeOrdersEvent(event: DecodedOrdersEvent): string {
  const tab = event.tabs
    .map((t) => (typeof t.tab === "number" ? `tab ${t.tab}` : t.tab === "orders" ? "Orders tab" : "Medications tab"))
    .join(" + ");
  return [
    ...event.orders.map(describeOrder),
    event.powerPlans ? `${tab} with PowerPlans` : tab,
    viewLabel(event.launchView),
    event.signSilently && "sign silently",
  ].filter(Boolean).join(" · ");
}

export function describeMOEWFlags(decoded: DecodedMOEWFlags): string {
  const tab = typeof decoded.tab === "number" ? `tab ${decoded.tab}` : decoded.tab;
  const unknown = [
    decoded.unknownCustomizeBits && `unknown customize bits ${decoded.unknownCustomizeBits}`,
    decoded.unknownDisplayBits && `unknown display bits ${decoded.unknownDisplayBits}`,
  ].filter(Boolean);
  return [tab, `options: ${list(decoded.customize)}`, `panes: ${list(decoded.display)}`, ...unknown].join(" · ");
}

export function describeClinicalNoteEvent(event: DecodedClinicalNoteEvent): string {
  return [
    `documents ${list(event.eventIds)}`,
    `"${event.windowTitle}"`,
    `flags: ${list(event.viewFlags)}`,
  ].join(" · ");
}

/**
 * One line for any MPAGES_EVENT payload, or null when it cannot be decoded
 * (the caller already logs the raw string and a warning).
 */
export function describeMPagesEvent(name: string, payload: string): string | null {
  try {
    if (name === "ORDERS") return describeOrdersEvent(decodeOrdersEvent(payload));
    if (name === "CLINICALNOTE") return describeClinicalNoteEvent(decodeClinicalNoteEvent(payload));
    if (name === "POWERFORM") {
      const form = decodePowerFormEvent(payload);
      if (form.adHoc) return "open the PowerForm search (Ad Hoc)";
      return [
        form.existing ? `reopen activity ${form.activityId}` : `new form ${form.formId}`,
        form.chartMode === 1 && "view-only",
      ].filter(Boolean).join(" · ");
    }
    if (name === "POWERNOTE") {
      const note = decodePowerNoteEvent(payload);
      return note.eventId ? `open PowerNote ${note.eventId}` : `new note from encounter pathway ${note.cki}`;
    }
    if (name === "ALLERGY") {
      const allergy = decodeAllergyEvent(payload);
      if (allergy.mode === "profile") return "open the Allergy Profile";
      if (allergy.mode === "modify") return `modify allergy ${allergy.allergyId}`;
      return [
        `add allergy "${allergy.substanceDisp}"`,
        allergy.nomenId && `nomenclature ${allergy.nomenId}`,
        allergy.substanceTypeDisplay && `category ${allergy.substanceTypeDisplay}`,
      ].filter(Boolean).join(" · ");
    }
  } catch {
    return null;
  }
  return null;
}
