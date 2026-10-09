import type { CernerSimulator } from "../simulator";

/**
 * Discern Web Services, as an MPage reaches CCL outside PowerChart.
 *
 * Two URL shapes reach the same reports endpoint:
 *   - `<contextRoot>/<program>` where contextRoot is
 *     `http://<host>/discern/<domain>/mpages/reports` (config.json);
 *   - `/cclproxy/<program>` — the Angular dev proxy every Clinical Office
 *     template rewrites to that contextRoot.
 * The program reads `parameters` (the prompt line) and optionally `blobIn`,
 * by GET query or form POST. Clinical Office posts the body unencoded
 * (`parameters=^MINE^,…&blobIn=<hex>`); classic pages url-encode it.
 * Nothing is substituted: `$PAT_PersonId$` arrives as literal text.
 *
 * The services directory lookup the setup app makes is answered here too.
 */

export interface WebRequest {
  method: string;
  /** Absolute URL. */
  url: string;
  body?: string | null;
}

export interface WebResponse {
  status: number;
  body: string;
  contentType: string;
}

const REPORTS = /\/mpages\/reports\/([^/?#]+)/i;
const PROXY = /\/cclproxy\/([^/?#]+)/i;
const SERVICES_DIRECTORY = /\/services-directory\/authorities\/([^/]+)\/keys\/urn:cerner:api:mpages\.json$/i;

/** Does this URL belong to the simulated web services? */
export function matchesDiscernWeb(url: string): boolean {
  let path: string;
  try { path = new URL(url).pathname; } catch { return false; }
  return REPORTS.test(path) || PROXY.test(path) || SERVICES_DIRECTORY.test(path);
}

function decodeMaybe(value: string): string {
  if (!/%[0-9a-f]{2}/i.test(value) && !value.includes("+")) return value;
  try { return decodeURIComponent(value.replace(/\+/g, " ")); } catch { return value; }
}

/** Split a form body into parameters / blobIn without trusting it to be url-encoded. */
export function parseWebBody(body: string): { parameters: string; blobIn: string | null } {
  const text = body ?? "";
  const blobAt = text.search(/(^|&)blobIn=/);
  const head = blobAt === -1 ? text : text.slice(0, blobAt);
  const blob = blobAt === -1 ? null : text.slice(blobAt).replace(/^&?blobIn=/, "");
  const params = /(?:^|&)parameters=([\s\S]*)$/.exec(head)?.[1] ?? "";
  return { parameters: decodeMaybe(params), blobIn: blob === null ? null : decodeMaybe(blob) };
}

export function handleDiscernWebRequest(sim: CernerSimulator, request: WebRequest, origin: string): WebResponse | null {
  let url: URL;
  try { url = new URL(request.url); } catch { return null; }
  const directory = SERVICES_DIRECTORY.exec(url.pathname);
  if (directory) {
    return {
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ link: `${origin}/discern/${sim.session.domain.toLowerCase()}/mpages/`, key: "urn:cerner:api:mpages", authority: decodeURIComponent(directory[1]) }),
    };
  }
  const program = (REPORTS.exec(url.pathname) ?? PROXY.exec(url.pathname))?.[1];
  if (!program) return null;
  let parameters = url.searchParams.get("parameters") ?? "";
  let blobIn: string | null = url.searchParams.get("blobIn");
  if (request.method.toUpperCase() === "POST" && request.body) {
    const parsed = parseWebBody(request.body);
    parameters = parsed.parameters || parameters;
    blobIn = parsed.blobIn ?? blobIn;
  }
  const reply = sim.execute({ program: decodeURIComponent(program), params: parameters, blobIn, transport: "web" });
  return { status: reply.status, body: reply.body, contentType: reply.contentType ?? "application/json" };
}
