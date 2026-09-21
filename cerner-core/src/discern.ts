/**
 * Constants for the Discern/PowerChart hosting contract.
 *
 * PowerChart only injects its native bridges (window.external.XMLCclRequest,
 * APPLINK, MPAGES_EVENT, ...) into pages that declare them in a
 * `<meta name="discern">` tag, so every page we serve into an MPage host must
 * emit DISCERN_META_HTML in its <head>.
 */

export const DISCERN_CAPABILITIES = [
  "APPLINK",
  "CCLLINK",
  "MPAGES_EVENT",
  "MPAGES_SVC_EVENT",
  "XMLCCLREQUEST",
  "CCLNEWSESSIONWINDOW",
] as const;

export type DiscernCapability = (typeof DISCERN_CAPABILITIES)[number];

export const DISCERN_META_CONTENT = DISCERN_CAPABILITIES.join(",");

export const DISCERN_META_HTML = `<meta name="discern" content="${DISCERN_META_CONTENT}" http-equiv="Content-Type">`;

/**
 * MPage host caches content aggressively (WebView2 and the legacy IE control
 * both); these tags are the conventional opt-out and belong next to the
 * discern meta tag.
 */
export const NO_CACHE_META_HTML = [
  '<meta http-equiv="cache-control" content="no-cache, must-revalidate, post-check=0, pre-check=0">',
  '<meta http-equiv="Pragma" content="no-cache">',
  '<meta http-equiv="Expires" content="-1">',
].join("\n");

/**
 * Macro tokens substituted by PowerChart itself (not by CCL) inside the
 * XMLCclRequest.send() parameter string. Only meaningful for chart-level
 * pages running inside PowerChart; anywhere else they must be replaced with
 * concrete ids before sending.
 */
export const PAT_PERSON_ID_TOKEN = "$PAT_PersonId$";
export const VIS_ENCNTR_ID_TOKEN = "$VIS_EncntrId$";

/* ============================================================================
   The bridge catalogue.

   Until now this module named the CAPABILITIES PowerChart injects but not the
   calls you make through them, so the player's mock had to guess and the
   survey had nothing to check against. These are the verbatim signatures, read
   from `geekmdtravis/fluent-cerner-js` (MIT, © 2022 geekmdtravis), which wraps
   the native objects an embedded MPage talks to. Adapted, not copied: the
   library is a caller, this is a description.

   Two things worth knowing before using them:
     - every MPAGES_EVENT payload is ONE pipe-delimited positional string, so
       an omitted middle argument is `0` or empty, never absent; and
     - a call outside PowerChart throws rather than returning, which is how a
       page detects it is not hosted. `outsideOfPowerChartError` below is that
       test.
   ========================================================================= */

export interface DiscernEventSpec {
  /** Positional fields of the pipe-delimited payload, in order. */
  params: readonly string[];
  description: string;
}

export const MPAGES_EVENTS: Readonly<Record<string, DiscernEventSpec>> = {
  /** Opens a PowerForm, by form id for a new one or activity id for an existing. */
  POWERFORM: {
    params: ["personId", "encntrId", "formId", "activityId", "permanentFlag"],
    description:
      "personId|encntrId|formId|activityId|permanentFlag. A new form carries formId with activityId 0; an existing one the reverse; the ad-hoc search is 0|0. permanentFlag is 1 only to view a completed form read-only.",
  },
  /**
   * Opens a PowerNote. The third field is the CKI — the Clinical Knowledge
   * Identifier that NAMES A NOTE TEMPLATE, which is the handle a Smart
   * Template demo needs and the one no public Cerner doc spells out.
   */
  POWERNOTE: {
    params: ["personId", "encntrId", "CKI", "noteId"],
    description:
      "personId|encntrId|CKI|noteId. A new note carries a CKI string and noteId 0; an existing one an empty CKI and a numeric noteId.",
  },
  CLINICALNOTE: {
    params: [
      "personId", "encntrId", "eventIds", "windowTitle",
      "viewOptionFlags", "viewName", "viewSeq", "compName", "compSeq",
    ],
    description:
      "personId|encntrId|[eventId|eventId…]|windowTitle|viewOptionFlags|viewName|viewSeq|compName|compSeq. eventIds is bracketed and itself pipe-delimited, which is why a naive split on | is wrong.",
  },
  ORDERS: {
    params: ["personId", "encntrId", "orderString"],
    description: "personId|encntrId|order payload. Superseded by the POWERORDERS object for anything beyond a simple launch.",
  },
} as const;

export type MPagesEventName = keyof typeof MPAGES_EVENTS;

/**
 * The COM objects reachable through `window.external.DiscernObjectFactory`,
 * and the methods each one answers. POWERORDERS is the large one: it drives
 * the Modal Order Entry Window (MOEW), which is created, configured, shown
 * modally, read back and then destroyed — and it MUST be destroyed, or
 * PowerChart leaks the window.
 */
export const DISCERN_OBJECTS: Readonly<Record<string, readonly string[]>> = {
  POWERORDERS: [
    "CreateMOEW", "DestroyMOEW", "DisplayMOEW",
    "AddNewOrdersToScratchpad", "AddPowerPlanWithDetails", "GetXMLOrdersMOEW",
    "SignOrders",
  ],
  DYNDOC: [
    "OpenNewDocumentByReferenceTemplateId",
    "OpenNewDocumentByReferenceTemplateIdAndNoteType",
    "OpenDynDocByWorkFlowId",
    "ModifyExistingDocumentByEventId",
  ],
  PVCONTXTMPAGE: ["SetPatient", "GetValidEncounters"],
  POWERFORM: ["OpenForm"],
  PATIENTEDUCATION: ["SetPatient", "SetDefaultTab", "DoModal"],
  DISCHARGEPROCESS: ["LaunchDischargeDialog"],
  PEXSCHEDULINGACTIONS: ["CheckInAppointment", "CheckOutAppointment", "CancelAppointment", "HoldAppointment", "NoShowAppointment", "ShowView", "ShowHistoryView"],
} as const;

export type DiscernObjectName = keyof typeof DISCERN_OBJECTS;

/**
 * True when a bridge call failed because the page is not hosted by PowerChart,
 * rather than because the call itself was wrong. Outside PowerChart the
 * `window.external` members simply do not exist, so the throw is a TypeError
 * naming the member.
 */
export function outsideOfPowerChartError(e: unknown): boolean {
  return (
    e instanceof TypeError &&
    /(MPAGES_EVENT|DiscernObjectFactory|XMLCclRequest|APPLINK)/.test(e.message)
  );
}
