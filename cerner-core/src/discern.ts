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
