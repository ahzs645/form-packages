/**
 * SMART launch context: the presentation half of what an EHR hands an
 * embedded app, alongside the patient/encounter ids resolveChartContext
 * already covers.
 *
 * `need_patient_banner` says whether the host already draws the patient
 * banner. False means it does, and we must not draw a second one; true — and
 * absence, which is what a standalone launch looks like — means the banner is
 * ours. The signal is not SMART's alone: an MPage or a Workflow component is
 * embedded in a page that draws PowerChart's own banner bar and has no token
 * response to read, so the same flag is accepted from the launch URL and from
 * the host element, the way chart ids are.
 *
 * `smart_style_url` is deliberately token-response-only. We fetch whatever it
 * names, so it has to arrive over the authenticated SMART handshake rather
 * than from a query string anyone can write.
 *
 * Precedence, lowest first: caller defaults, host-element attribute, query
 * parameter, token response. The EHR's own answer wins over a launch URL,
 * which wins over an attribute baked into a host page.
 *
 * Same runtime constraints as context.ts: this is resolved in every tier, so
 * no modern array or object helpers.
 */

import { parseSearch, type AttributeReader } from "./context";

export interface SmartLaunchContext {
  /** Draw our own patient banner? False when the host already draws one. */
  needPatientBanner: boolean;
  /** Absolute http(s) URL of the EHR's style document, when it published one. */
  smartStyleUrl: string | null;
}

/** What a player with no launch context assumes: its own banner, its own look. */
export const DEFAULT_SMART_LAUNCH_CONTEXT: SmartLaunchContext = {
  needPatientBanner: true,
  smartStyleUrl: null,
};

/** The two fields we read off fhirclient's `TokenResponse`; a structural subset. */
export interface SmartTokenResponseLike {
  need_patient_banner?: unknown;
  smart_style_url?: unknown;
}

/** fhirclient's `ClientState`, as far as we need it. */
export interface SmartClientStateLike {
  tokenResponse?: SmartTokenResponseLike | null;
}

/** fhirclient's `Client`, as far as we need it: `client.state`. */
export interface SmartClientLike {
  state?: SmartClientStateLike | null;
}

export interface ResolveSmartLaunchContextInput {
  /** A fhirclient Client, or its state, when the app was SMART-launched. */
  client?: SmartClientLike | SmartClientStateLike | null;
  /** window.location.search (with or without the leading "?"). */
  search?: string;
  /** The custom element hosting the player, when embedded as a component. */
  element?: AttributeReader;
  defaults?: Partial<SmartLaunchContext>;
}

/** Our own launch convention first, then the name the SMART spec uses. */
const BANNER_QUERY_KEYS = ["needPatientBanner", "need_patient_banner"];
const BANNER_ATTRIBUTE_KEYS = ["need-patient-banner", "need_patient_banner"];

/**
 * Absolute http(s) only: a relative URL would resolve against whichever page
 * the player happens to be served from, and every other scheme (javascript:,
 * data:, protocol-relative //host) is something we should never fetch.
 */
const STYLE_URL = /^https?:\/\/[^\s<>"'\\]+$/i;

function parseFlag(raw: string | null | undefined): boolean | undefined {
  if (raw === null || raw === undefined) return undefined;
  const value = raw.toLowerCase();
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return undefined;
}

function parseStyleUrl(raw: unknown): string | null | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.replace(/^\s+|\s+$/g, "");
  if (!value) return undefined;
  return STYLE_URL.test(value) ? value : null;
}

/** The token response behind a Client, a ClientState, or neither. */
function tokenResponseOf(
  client: SmartClientLike | SmartClientStateLike | null | undefined,
): SmartTokenResponseLike | null {
  if (!client || typeof client !== "object") return null;
  const state = (client as SmartClientLike).state;
  const source: SmartClientStateLike =
    state && typeof state === "object" ? state : (client as SmartClientStateLike);
  const token = source.tokenResponse;
  return token && typeof token === "object" ? token : null;
}

export function resolveSmartLaunchContext(
  input: ResolveSmartLaunchContextInput,
): SmartLaunchContext {
  const defaults = input.defaults;
  const context: SmartLaunchContext = {
    needPatientBanner:
      typeof defaults?.needPatientBanner === "boolean"
        ? defaults.needPatientBanner
        : DEFAULT_SMART_LAUNCH_CONTEXT.needPatientBanner,
    smartStyleUrl: parseStyleUrl(defaults?.smartStyleUrl) ?? null,
  };

  if (input.element) {
    for (let i = 0; i < BANNER_ATTRIBUTE_KEYS.length; i++) {
      const flag = parseFlag(input.element.getAttribute(BANNER_ATTRIBUTE_KEYS[i]));
      if (flag !== undefined) {
        context.needPatientBanner = flag;
        break;
      }
    }
  }

  if (input.search) {
    const query = parseSearch(input.search);
    for (let i = 0; i < BANNER_QUERY_KEYS.length; i++) {
      const flag = parseFlag(query[BANNER_QUERY_KEYS[i]]);
      if (flag !== undefined) {
        context.needPatientBanner = flag;
        break;
      }
    }
  }

  const token = tokenResponseOf(input.client);
  if (token) {
    if (typeof token.need_patient_banner === "boolean") {
      context.needPatientBanner = token.need_patient_banner;
    }
    const styleUrl = parseStyleUrl(token.smart_style_url);
    // `undefined` is "the EHR said nothing"; `null` is "it said something we
    // will not fetch" — both leave us on our own defaults.
    if (styleUrl !== undefined) context.smartStyleUrl = styleUrl;
  }

  return context;
}
