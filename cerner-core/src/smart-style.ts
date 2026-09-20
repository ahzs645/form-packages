/**
 * SMART style: the small JSON document an EHR publishes at `smart_style_url`
 * so an embedded app can match the chrome around it. The canonical sample is
 * <https://launch.smarthealthit.org/smart-style.json>; the documented set is
 * six colours, three dimensions and two font stacks, and nothing else.
 *
 * The document is fetched from a URL the EHR chose, so it is untrusted input
 * that ends up in a stylesheet. Two rules follow, and both are load-bearing:
 *
 *  - only the eleven documented keys are read, each mapped to a fixed CSS
 *    custom-property name we own — a key the EHR invents can never name a
 *    property, so it cannot reach a declaration we did not write;
 *  - every value is validated against the shape its kind allows. A value that
 *    does not match is dropped, not escaped, so no `;`, `}`, `url(` or
 *    `expression(` can ride in and close our declaration.
 *
 * Nothing here throws or reports: a missing, unreachable or malformed
 * document simply yields no properties and the player keeps its own look.
 */

export interface SmartStyleFetchOptions {
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

type SmartStyleKind = "color" | "dimension" | "fontFamily";

/** Documented key → the custom property we set → how its value is validated. */
const SMART_STYLE_PROPERTIES: ReadonlyArray<readonly [string, string, SmartStyleKind]> = [
  ["color_background", "--smart-color-background", "color"],
  ["color_error", "--smart-color-error", "color"],
  ["color_highlight", "--smart-color-highlight", "color"],
  ["color_modal_backdrop", "--smart-color-modal-backdrop", "color"],
  ["color_success", "--smart-color-success", "color"],
  ["color_text", "--smart-color-text", "color"],
  ["dim_border_radius", "--smart-dim-border-radius", "dimension"],
  ["dim_font_size", "--smart-dim-font-size", "dimension"],
  ["dim_spacing_size", "--smart-dim-spacing-size", "dimension"],
  ["font_family_body", "--smart-font-family-body", "fontFamily"],
  ["font_family_heading", "--smart-font-family-heading", "fontFamily"],
];

/** The custom properties this module can set, for tests and documentation. */
export const SMART_STYLE_CUSTOM_PROPERTIES: readonly string[] = SMART_STYLE_PROPERTIES.map(
  (entry) => entry[1],
);

/** #rgb / #rgba / #rrggbb / #rrggbbaa, an rgb()/hsl() function, or a named colour. */
const COLOR =
  /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|rgba|hsl|hsla)\([0-9a-z%.,/\s+-]{1,60}\)|[a-z]{3,20})$/i;

/** A single CSS length or percentage; `0` is allowed unitless, as CSS allows. */
const DIMENSION = /^(?:0|[0-9]+(?:\.[0-9]+)?(?:px|pt|em|rem|ex|ch|%|vh|vw))$/i;

/**
 * A font stack: names, quotes and commas. ASCII only, which every published
 * SMART style document is; a non-ASCII family name is dropped rather than
 * passed through, because the point of the check is that nothing exotic gets
 * into the declaration.
 */
const FONT_FAMILY = /^[A-Za-z0-9 '",._-]+$/;

/** Longest value we will copy into a declaration. Real ones are well under this. */
const MAX_VALUE_LENGTH = 200;

function isValid(kind: SmartStyleKind, value: string): boolean {
  if (kind === "color") return COLOR.test(value);
  if (kind === "dimension") return DIMENSION.test(value);
  return FONT_FAMILY.test(value);
}

/**
 * The CSS custom properties a SMART style document asks for, keyed by property
 * name. Unknown keys, non-string values, empty strings (the sample document
 * ships `color_modal_backdrop: ""`) and values that fail validation are all
 * dropped; anything that is not an object at all yields `{}`.
 */
export function parseSmartStyle(document: unknown): Record<string, string> {
  const properties: Record<string, string> = {};
  if (!document || typeof document !== "object" || Array.isArray(document)) return properties;
  const source = document as Record<string, unknown>;
  for (const [key, property, kind] of SMART_STYLE_PROPERTIES) {
    const raw = source[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value || value.length > MAX_VALUE_LENGTH) continue;
    if (isValid(kind, value)) properties[property] = value;
  }
  return properties;
}

/**
 * Fetches and parses the EHR's style document. Resolves to `{}` for every
 * failure — no URL, a URL that will not load, a non-2xx reply, a body that is
 * not JSON, or JSON with nothing usable in it — so a caller only ever has to
 * handle "these are the properties to set".
 */
export async function fetchSmartStyle(
  url: string | null | undefined,
  options: SmartStyleFetchOptions = {},
): Promise<Record<string, string>> {
  if (!url) return {};
  const request = options.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  if (!request) return {};
  try {
    const response = await request(url, {
      // The document is public by definition; sending the EHR session's
      // cookies to it would be a needless credential leak.
      credentials: "omit",
      signal: options.signal,
    });
    if (!response || !response.ok) return {};
    return parseSmartStyle(await response.json());
  } catch {
    // Offline, CORS, abort, malformed JSON — all the same answer: our own look.
    return {};
  }
}
