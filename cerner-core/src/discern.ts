import { DISCERN_OBJECT_CATALOG } from "./discern-catalog";

/**
 * Constants for the Discern/PowerChart hosting contract.
 *
 * Under Internet Explorer PowerChart only injects its native functions
 * (APPLINK, CCLLINK, MPAGES_EVENT, XMLCclRequest, ...) into pages that declare
 * them in a `<meta name="discern">` tag, so every page we serve into an MPage
 * host emits DISCERN_META_HTML in its <head>. Under Microsoft Edge (2018.08+)
 * the tag is no longer needed — Discern injects the functions into every page
 * — and a page that defines its OWN copies of them stops working there (MPages
 * Development Wiki, "Microsoft Edge Browser Integration"). The full documented
 * surface is in discern-catalog.ts.
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

/**
 * The documented form: names comma-separated with no spaces, and no
 * `http-equiv` (an earlier copy carried `http-equiv="Content-Type"`, which no
 * wiki example has and which declares a bogus content type to the browser).
 */
export const DISCERN_META_HTML = `<meta name="discern" content="${DISCERN_META_CONTENT}">`;

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
 * Context variables (wiki: "Context Variables"). The wiki documents their
 * substitution in CCLLINK and APPLINK arguments and in the Discern Report
 * REPORT_NAME / REPORT_PARAM preferences, where `$NAME$` gains a `.00` on
 * numbers and `*NAME*` does not. REVERSE-ENGINEERED ONLY: the envelope also
 * sends these two inside the XMLCclRequest.send() parameter string and relies
 * on PowerChart substituting them there; no wiki page says XMLCclRequest
 * parameters are substituted, so treat that as observed behaviour, not
 * contract. They are never substituted inside an MPAGES_EVENT payload.
 */
export const PAT_PERSON_ID_TOKEN = "$PAT_PersonId$";
export const VIS_ENCNTR_ID_TOKEN = "$VIS_EncntrId$";

/* ============================================================================
   The bridge catalogue.

   The payload shapes below are checked against Oracle's MPages Development
   Wiki (space MPDEVWIKI; page ids in `wiki`) and the Discern Explorer help.
   They were first read from `geekmdtravis/fluent-cerner-js` (MIT, © 2022
   geekmdtravis); where the wiki disagreed, the wiki won — field names are the
   wiki's, ALLERGY was missing, and ORDERS' trailing silent-sign field is
   optional (the wiki's own examples send six fields).

   Two things worth knowing before using them:
     - every MPAGES_EVENT payload is ONE pipe-delimited positional string, so
       an omitted middle argument is `0` or empty, never absent, and context
       variables are NOT substituted inside it; and
     - a call outside PowerChart throws rather than returning, which is how a
       page detects it is not hosted. `outsideOfPowerChartError` below is that
       test (a fluent-cerner-js convention, not a documented contract).
   ========================================================================= */

export interface DiscernEventSpec {
  /** Positional fields of the pipe-delimited payload, in order (the wiki's names). */
  params: readonly string[];
  /** Trailing fields the payload may omit. */
  optional?: number;
  /** `powerchart`: PowerChart and its clones only; `any`: any Discern Output Viewer host. */
  hosts: "powerchart" | "any";
  wiki: number;
  description: string;
}

export const MPAGES_EVENTS: Readonly<Record<string, DiscernEventSpec>> = {
  /** The Allergy conversation: the profile, one allergy to modify, or a new one prefilled. */
  ALLERGY: {
    params: [
      "personId", "encntrId", "allergyId", "nomenId", "substanceDisp", "conceptId",
      "substanceTypeCd", "substanceTypeDisplay", "viewSeq", "compSeq",
    ],
    hosts: "any",
    wiki: 34310769,
    description:
      "personId|encntrId|allergyId|nomenId|substanceDisp|conceptId|substanceTypeCd|substanceTypeDisplay|viewSeq|compSeq. A non-zero allergyId modifies that allergy and ignores the substance fields; all of them empty opens the Allergy Profile; a new allergy needs substanceDisp. viewSeq/compSeq 0 use default preferences.",
  },
  /** Opens a PowerForm, by form id for a new one or activity id for an existing. */
  POWERFORM: {
    params: ["personId", "encntrId", "formId", "activityId", "chartMode"],
    hosts: "any",
    wiki: 34310784,
    description:
      "personId|encntrId|formId|activityId|chartMode. formId opens a new form, a non-zero activityId an existing one (it wins over formId); both 0 opens Ad Hoc Charting. chartMode 0 views or modifies, 1 is view-only.",
  },
  /**
   * Opens a PowerNote. The third field is a CKI in CKI_SOURCE!CKI_IDENTIFIER
   * form from SCR_PATTERN naming an ENCOUNTER PATHWAY (`CKI!EPS HAIR LOSS`);
   * the fourth is the CLINICAL_EVENT event_id of an existing PowerNote.
   */
  POWERNOTE: {
    params: ["personId", "encntrId", "CKI", "eventId"],
    hosts: "powerchart",
    wiki: 34310805,
    description:
      "personId|encntrId|CKI|eventId. A non-zero eventId loads that PowerNote; otherwise a new note starts from the encounter pathway the CKI names. One of the two is required.",
  },
  CLINICALNOTE: {
    params: [
      "personId", "encntrId", "eventIds", "windowTitle",
      "viewOptionFlags", "viewName", "viewSeq", "compName", "compSeq",
    ],
    hosts: "powerchart",
    wiki: 34310809,
    description:
      "personId|encntrId|[eventId|eventId…]|windowTitle|viewOptionFlags|viewName|viewSeq|compName|compSeq. eventIds is bracketed and itself pipe-delimited, which is why a naive split on | is wrong.",
  },
  ORDERS: {
    params: ["personId", "encntrId", "orderLst", "customizeFlags", "tabLst", "defaultDisplay", "silentSignFlag"],
    optional: 1,
    hosts: "powerchart",
    wiki: 34310807,
    description:
      "personId|encntrId|{order}{order}…|customizeFlags|{tab|tabDisplayFlags}{…}|defaultDisplay[|silentSignFlag]. customizeFlags 24 enables PowerPlans; tab 2 orders, 3 medications, display 127 full PowerOrders; defaultDisplay 8 search, 16 profile, 32 signature. The brace groups contain pipes and must be parsed as one field.",
  },
} as const;

export type MPagesEventName = keyof typeof MPAGES_EVENTS;

/** Whether a payload with `count` top-level fields has an arity the wiki allows. */
export function mpagesEventArityOk(spec: DiscernEventSpec, count: number): boolean {
  return count <= spec.params.length && count >= spec.params.length - (spec.optional ?? 0);
}

/**
 * The COM objects reachable through `window.external.DiscernObjectFactory`,
 * and the methods each one answers — derived from DISCERN_OBJECT_CATALOG,
 * which carries each method's parameters, return and wiki page. POWERORDERS
 * is the large one: it drives the Modal Order Entry Window (MOEW), which is
 * created, configured, shown modally, read back and then destroyed — and it
 * MUST be destroyed, or PowerChart leaks the window.
 */
export const DISCERN_OBJECTS: Readonly<Record<string, readonly string[]>> = (() => {
  const out: Record<string, readonly string[]> = {};
  for (const name in DISCERN_OBJECT_CATALOG) out[name] = Object.keys(DISCERN_OBJECT_CATALOG[name].methods);
  return out;
})();

export type DiscernObjectName = keyof typeof DISCERN_OBJECTS;

/**
 * True when a bridge call failed because the page is not hosted by PowerChart,
 * rather than because the call itself was wrong (fluent-cerner-js' test; the
 * wiki documents no such error shape). Outside PowerChart the
 * `window.external` members simply do not exist, so the throw is a TypeError
 * naming the member.
 */
export function outsideOfPowerChartError(e: unknown): boolean {
  return (
    e instanceof TypeError &&
    /(MPAGES_EVENT|DiscernObjectFactory|XMLCclRequest|APPLINK)/.test(e.message)
  );
}
