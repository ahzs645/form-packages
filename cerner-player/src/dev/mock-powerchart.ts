import { DISCERN_OBJECTS, MPAGES_EVENTS, describeMPagesEvent, mpagesEventArityOk, splitDiscernPayload } from "@webforms/cerner-core";
import {
  createSimXmlCclRequest,
  createStandardSimulator,
  installDiscernWebIntercept,
  type CernerSimulator,
} from "@webforms/cerner-sim";

/**
 * Dev-only PowerChart: the player (and, through powerchart-global.ts, any
 * example MPage) gets window.external.XMLCclRequest and the Discern bridges
 * without a Millennium domain.
 *
 * CCL is answered by the simulated Millennium domain in @webforms/cerner-sim —
 * the same one behind the PowerChart emulator — so `nh_wf_entry`, the
 * Clinical Office v5 entry and their custom scripts reply in their real
 * shapes from a synthetic chart, not from hand-written stubs.
 *
 * Never shipped down the production path — App.tsx only wires it when the
 * page runs outside PowerChart with ?mock=1 (or on localhost).
 */

export interface MockChart {
  personId: number;
  encntrId: number;
  nameFullFormatted: string;
  prsnlId: number;
  prsnlName: string;
}

export const DEMO_CHART: MockChart = {
  personId: 12724066,
  encntrId: 97953477,
  nameFullFormatted: "MOUSE, MICKEY BOB",
  prsnlId: 4122622,
  prsnlName: "CERNER TEST, PHYSICIAN",
};

/**
 * The simulated domain behind the demo chart: one invented patient (BC PHN,
 * MRN, an outpatient visit with FIN) and the signed-in physician. Built once
 * per page so writes (stored drafts, filed documents) survive re-renders.
 */
export function createPlayerSimulator(chart: MockChart = DEMO_CHART): CernerSimulator {
  const [last, rest = ""] = chart.nameFullFormatted.split(",").map((part) => part.trim());
  const [first = "", ...middle] = rest.split(/\s+/);
  const [userLast, userFirst = ""] = chart.prsnlName.split(",").map((part) => part.trim());
  return createStandardSimulator({
    roster: [{
      chart: "700001234", encounter: "FIN-0001234", personId: chart.personId, encntrId: chart.encntrId,
      first, middle: middle.join(" "), last, dob: "1980-01-01", gender: "M",
      location: "Mock Demo Clinic", provider: "Okafor, Daniel MD", encounterType: "Outpatient",
      allergies: "Penicillins", bchn: "9876543210", home: "250-555-0101", address: "1 Demo Way",
      city: "Prince George", province: "BC", postal: "V2N 0A1", registered: "2026-09-01",
    }],
    session: { prsnlId: chart.prsnlId, domain: "MOCKDEV" },
    seed: { user: { personId: chart.prsnlId, nameLast: userLast.toUpperCase(), nameFirst: userFirst.toUpperCase(), username: "MOCKTEST", position: "PHYSICIAN", physician: true } },
  });
}

let pageSimulator: { chart: MockChart; sim: CernerSimulator } | null = null;

/** The page's simulator for this chart (one per page load). */
export function playerSimulator(chart: MockChart = DEMO_CHART): CernerSimulator {
  if (!pageSimulator || pageSimulator.chart !== chart) pageSimulator = { chart, sim: createPlayerSimulator(chart) };
  return pageSimulator.sim;
}

export interface DiscernActivity {
  bridge: string;
  detail: string;
  timestamp: string;
}

/** Ring buffer of simulated Discern bridge calls; UI listens via the mock-discern event. */
export const discernActivity: DiscernActivity[] = [];

function recordDiscernActivity(bridge: string, detail: string): void {
  const entry: DiscernActivity = { bridge, detail, timestamp: new Date().toISOString() };
  discernActivity.push(entry);
  if (discernActivity.length > 50) discernActivity.shift();
  window.dispatchEvent(new CustomEvent("mock-discern", { detail: entry }));
  console.info("[mock-powerchart]", bridge, detail);
}

function formatArgs(args: unknown[]): string {
  return args
    .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
    .join(", ");
}

/**
 * Decode a pipe-delimited MPAGES_EVENT payload into its named fields.
 *
 * CLINICALNOTE embeds a bracketed event list, while ORDERS embeds braced
 * order details and a tab spec. A plain split shifts later fields.
 */
export function decodeMPagesEvent(type: string, eventString: string): Record<string, string> | null {
  const spec = MPAGES_EVENTS[type as keyof typeof MPAGES_EVENTS];
  if (!spec) return null;
  let fields: string[];
  try {
    fields = splitDiscernPayload(eventString);
  } catch {
    return { "!syntax": "unbalanced groups" };
  }
  const out: Record<string, string> = {};
  spec.params.forEach((name, i) => { out[name] = fields[i] ?? ""; });
  /* ORDERS' trailing silentSignFlag is optional (the wiki's own examples send six fields). */
  if (!mpagesEventArityOk(spec, fields.length)) {
    const min = spec.params.length - (spec.optional ?? 0);
    out["!arity"] = `${fields.length} fields, expected ${min === spec.params.length ? min : `${min} or ${spec.params.length}`}`;
  }
  return out;
}

/**
 * A permissive proxy that nevertheless CHECKS. It used to answer any method on
 * any object with `1`, so an MPage calling a method that does not exist in
 * Millennium got a silent success here and a hard failure in the real client —
 * the worst possible order to find out. It still answers, because refusing
 * would make the mock useless for pages that legitimately go beyond the
 * catalogue, but it records the discrepancy so a developer sees it.
 */
function makeDiscernObject(name: string, warn: (line: string) => void): object {
  const known = DISCERN_OBJECTS[name as keyof typeof DISCERN_OBJECTS];
  if (!known) warn(`DiscernObjectFactory("${name}") is not a Millennium object this catalogue knows.`);
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") return undefined;
        const method = String(property);
        if (known && !known.includes(method)) {
          warn(`${name}.${method}() is not in the catalogue for ${name}. Known: ${known.join(", ")}.`);
        }
        return (...args: unknown[]) => {
          recordDiscernActivity(
            "DiscernObjectFactory(" + name + ")." + method,
            formatArgs(args),
          );
          return Promise.resolve(1);
        };
      },
    },
  );
}

export interface InstallOptions {
  /**
   * Also install what older or site-written pages reach for: a global
   * `XMLCclRequest` constructor, global CCLLINK / MPAGES_EVENT /
   * MPAGES_SVC_EVENT, and simulated Discern Web Services (`/cclproxy`,
   * `…/mpages/reports/<program>`) inside this window's fetch/XMLHttpRequest.
   */
  globals?: boolean;
}

export function installMockPowerChart(
  chart: MockChart = DEMO_CHART,
  log: (line: string) => void = (line) => console.info("[mock-powerchart]", line),
  options: InstallOptions = {},
): CernerSimulator {
  const sim = playerSimulator(chart);
  sim.subscribe((call) => {
    if (call.nested) return;
    log(`CCL ${call.program} (${call.transport}) -> ${call.status}`);
    for (const notice of call.notices) log(`${notice.kind === "quirk" ? "differs from production" : notice.kind}: ${notice.message}`);
  });
  const SimXMLCclRequest = createSimXmlCclRequest(sim, {
    context: () => ({ personId: chart.personId, encntrId: chart.encntrId }),
    warn: (line) => log("WARNING " + line),
  });
  const external = ((window as { external?: unknown }).external ?? {}) as Record<string, unknown>;
  external.XMLCclRequest = () => new SimXMLCclRequest();
  const warn = (line: string) => {
    log("WARNING " + line);
    recordDiscernActivity("bridge warning", line);
  };
  external.DiscernObjectFactory = (name: string) => {
    recordDiscernActivity("DiscernObjectFactory", name + " requested");
    return Promise.resolve(makeDiscernObject(name, warn));
  };
  external.MPAGES_EVENT = (type: string, eventString: string) => {
    const decoded = decodeMPagesEvent(type, eventString);
    if (!decoded) {
      warn(`MPAGES_EVENT("${type}", …) is not an event this catalogue knows.`);
      recordDiscernActivity("MPAGES_EVENT " + type, eventString);
    } else {
      if (decoded["!arity"]) warn(`MPAGES_EVENT("${type}") arity: ${decoded["!arity"]}.`);
      /* the decoded form is what a developer actually needs: which field was
         meant to be the CKI, and whether it landed where they think */
      recordDiscernActivity(
        "MPAGES_EVENT " + type,
        Object.entries(decoded).filter(([k]) => !k.startsWith("!"))
          .map(([k, v]) => `${k}=${v || "\u2014"}`).join("  "),
      );
      /* and the same call in words, from the shared codecs the stage uses */
      const words = describeMPagesEvent(type, eventString);
      if (words) recordDiscernActivity("MPAGES_EVENT " + type, words);
    }
    return Promise.resolve();
  };
  external.APPLINK = (...args: unknown[]) => {
    recordDiscernActivity("APPLINK", formatArgs(args));
    return Promise.resolve();
  };
  // fluent-cerner-js calls the global APPLINK, while older MPages may use
  // window.external.APPLINK. Keep both entry points on the same mock.
  Object.defineProperty(window, "APPLINK", { value: external.APPLINK, configurable: true });
  try {
    Object.defineProperty(window, "external", { value: external, configurable: true });
  } catch {
    (window as { external?: unknown }).external = external;
  }
  if (options.globals) {
    const define = (name: string, value: unknown) => Object.defineProperty(window, name, { value, configurable: true, writable: true });
    define("XMLCclRequest", SimXMLCclRequest);
    define("MPAGES_EVENT", external.MPAGES_EVENT);
    for (const name of ["CCLLINK", "MPAGES_SVC_EVENT"]) {
      define(name, (...args: unknown[]) => { recordDiscernActivity(name, formatArgs(args)); return Promise.resolve(); });
    }
    installDiscernWebIntercept(window as Window & typeof globalThis, sim);
  }
  return sim;
}
