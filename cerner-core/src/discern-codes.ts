/**
 * Encoders and decoders for the positional payloads an MPage hands PowerChart.
 *
 * `discern.ts` names the calls; this module knows what the numbers inside them
 * mean. Every table here is read from `geekmdtravis/fluent-cerner-js` 1.1.x
 * (MIT, © 2022 geekmdtravis), whose authors took them from Cerner's MPage
 * developer wiki (`MPAGES_EVENT - ORDERS`, `CreateMOEW`, `CLINICALNOTE`,
 * `APPLINK`). They are that library's reading of the documentation, not values
 * observed in a live client, and are labelled as such where it matters.
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
 * The order verbs, keyed by the names fluent-cerner-js gives them. `launch
 * moew` and `new order` share the wire verb `ORDER`; launch is the one whose
 * synonym id is 0.
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

/** `{tab|display}`: 2 is the Orders tab, 3 Medications; display 127 turns PowerPlans on. */
export const ORDER_TABS = {
  orders: { tab: 2, display: 0 },
  "power orders": { tab: 2, display: 127 },
  medications: { tab: 3, display: 0 },
  "power medications": { tab: 3, display: 127 },
} as const;
export type OrderTabName = keyof typeof ORDER_TABS;

export const ORDER_LAUNCH_VIEWS = { search: 8, profile: 16, signature: 32 } as const;
export type OrderLaunchView = keyof typeof ORDER_LAUNCH_VIEWS;

/** The fourth ORDERS field. fluent-cerner-js sends 24 whenever a PowerPlan tab is targeted. */
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
}

/** The whole ORDERS payload, exactly as fluent-cerner-js' `submitOrdersAsync` builds it. */
export function encodeOrdersEvent(input: OrdersEventInput): string {
  const targetTab = input.targetTab ?? "orders";
  const { tab, display } = ORDER_TABS[targetTab];
  return [
    input.personId,
    input.encntrId,
    input.orders.join(""),
    targetTab.startsWith("power") ? ORDERS_POWER_PLAN_FLAG : 0,
    `{${tab}|${display}}`,
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

export interface DecodedOrdersEvent {
  personId: number;
  encntrId: number;
  orders: DecodedOrder[];
  powerPlans: boolean;
  /** "orders" / "medications" when the tab code is one we know. */
  tab: "orders" | "medications" | number;
  display: number;
  launchView: OrderLaunchView | number;
  signSilently: boolean;
  /** True when the only order string is the bare launch (`{ORDER|0|0|0|0|0}`). */
  launchOnly: boolean;
}

export function decodeOrdersEvent(payload: string): DecodedOrdersEvent {
  const fields = splitDiscernPayload(payload);
  if (fields.length !== 7) throw new Error(`ORDERS expects 7 fields; got ${fields.length}.`);
  const [person, encounter, orderField, planFlag, tabSpec, view, silent] = fields;
  const tabParts = splitDiscernPayload(tabSpec.replace(/^\{|\}$/g, ""));
  if (!/^\{.*\}$/.test(tabSpec) || tabParts.length !== 2) throw new Error(`"${tabSpec}" is not a {tab|display} spec.`);
  const tabCode = num(tabParts[0]);
  const orders = decodeOrderStrings(orderField);
  return {
    personId: num(person),
    encntrId: num(encounter),
    orders,
    powerPlans: num(planFlag) !== 0,
    tab: tabCode === 2 ? "orders" : tabCode === 3 ? "medications" : tabCode,
    display: num(tabParts[1]),
    launchView: keyFor(ORDER_LAUNCH_VIEWS, num(view)) as OrderLaunchView | number,
    signSilently: num(silent) === 1,
    launchOnly: orders.length > 0 && orders.every((o) => o.verb === "ORDER" && o.synonymId === 0),
  };
}

/* ============================================================================
   POWERORDERS — the Modal Order Entry Window (MOEW)
   ========================================================================= */

/** `dwCustomizeFlag` bits. */
export const MOEW_CUSTOMIZE_FLAGS = {
  "sign later": 1,
  "read only": 4,
  "allow power plans": 8,
  "allow power plan doc": 16,
  "allow only inpatient and outpatient orders": 32,
  "show refresh and print buttons": 128,
  "documented meds only": 256,
  "hide med rec": 512,
  "disallow EOL": 1024,
  "hide demographics": 2048,
  "add rx to filter": 4096,
  "disable auto search": 8192,
  "allow regimen": 16384,
} as const;

/** `dwTabDisplayOptionsFlag` bits: which panes the window shows. */
export const MOEW_DISPLAY_FLAGS = {
  "show nav tree": 1,
  "show diag and probs": 2,
  "show related res": 4,
  "show orders search": 8,
  "show order profile": 16,
  "show scratchpad": 32,
  "show list details": 64,
} as const;

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
   APPLINK
   ========================================================================= */

/**
 * APPLINK's first argument. 100 covers a file, a URL and an executable alike —
 * the target decides which.
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

/** Scheduling methods and the appointment state each leaves behind. */
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
  const tab = typeof event.tab === "number" ? `tab ${event.tab}` : event.tab === "orders" ? "Orders tab" : "Medications tab";
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
    const fields = splitDiscernPayload(payload);
    if (name === "POWERFORM") {
      const [, , formId, activityId, permanent] = fields;
      if (num(formId) === 0 && num(activityId) === 0) return "open the PowerForm search (Ad Hoc)";
      return [
        num(activityId) ? `reopen activity ${activityId}` : `new form ${formId}`,
        num(permanent) === 1 && "read-only",
      ].filter(Boolean).join(" · ");
    }
    if (name === "POWERNOTE") {
      const [, , cki, noteId] = fields;
      return num(noteId) ? `open note ${noteId}` : `new note from template ${cki || "(no CKI)"}`;
    }
  } catch {
    return null;
  }
  return null;
}
