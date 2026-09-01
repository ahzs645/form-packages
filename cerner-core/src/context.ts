/**
 * Chart-context resolution shared by every render tier.
 *
 * Precedence follows the MPage component convention: URL query parameters
 * (personId/encounterId/userId — used when the host navigates us with
 * context) win over host-element attributes (person_id/encntr_id/prsnl_id —
 * used when we're embedded as a custom element in a Workflow page), which
 * win over caller defaults. Ids of 0 mean "unknown"; in-PowerChart chart
 * pages can then fall back to the macro tokens at send time.
 */

export interface ChartContext {
  personId: number;
  encntrId: number;
  prsnlId: number;
}

export const EMPTY_CHART_CONTEXT: ChartContext = { personId: 0, encntrId: 0, prsnlId: 0 };

export interface AttributeReader {
  getAttribute(name: string): string | null;
}

export interface ResolveChartContextInput {
  /** window.location.search (with or without the leading "?"). */
  search?: string;
  /** The custom element hosting the player, when embedded as a component. */
  element?: AttributeReader;
  defaults?: Partial<ChartContext>;
}

const QUERY_KEYS: Array<[keyof ChartContext, string]> = [
  ["personId", "personId"],
  ["encntrId", "encounterId"],
  ["prsnlId", "userId"],
];

const ATTRIBUTE_KEYS: Array<[keyof ChartContext, string[]]> = [
  ["personId", ["person_id", "person-id"]],
  ["encntrId", ["encntr_id", "encntr-id"]],
  ["prsnlId", ["prsnl_id", "prsnl-id"]],
];

function parseId(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const value = parseInt(raw, 10);
  if (isNaN(value) || value < 0) return undefined;
  return value;
}

function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const trimmed = search.charAt(0) === "?" ? search.substring(1) : search;
  if (!trimmed) return out;
  const pairs = trimmed.split("&");
  for (let i = 0; i < pairs.length; i++) {
    const eq = pairs[i].indexOf("=");
    if (eq === -1) continue;
    const key = decodeURIComponent(pairs[i].substring(0, eq));
    const value = decodeURIComponent(pairs[i].substring(eq + 1));
    if (!(key in out)) out[key] = value;
  }
  return out;
}

export function resolveChartContext(input: ResolveChartContextInput): ChartContext {
  const context: ChartContext = {
    personId: input.defaults?.personId ?? 0,
    encntrId: input.defaults?.encntrId ?? 0,
    prsnlId: input.defaults?.prsnlId ?? 0,
  };

  if (input.element) {
    for (let i = 0; i < ATTRIBUTE_KEYS.length; i++) {
      const [field, names] = ATTRIBUTE_KEYS[i];
      for (let n = 0; n < names.length; n++) {
        const value = parseId(input.element.getAttribute(names[n]));
        if (value !== undefined) {
          context[field] = value;
          break;
        }
      }
    }
  }

  if (input.search) {
    const query = parseQuery(input.search);
    for (let i = 0; i < QUERY_KEYS.length; i++) {
      const [field, name] = QUERY_KEYS[i];
      const value = parseId(query[name]);
      if (value !== undefined) context[field] = value;
    }
  }

  return context;
}
