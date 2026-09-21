import { DISCERN_OBJECTS, MPAGES_EVENTS, type CclRequestLike } from "@webforms/cerner-core";

/**
 * Dev-only PowerChart simulator: installs a fake window.external.XMLCclRequest
 * so the player exercises the exact in-PowerChart code path (setBlobIn blob,
 * positional prompt string, chartId echo) without a Millennium domain.
 *
 * Never shipped down the production path — main.tsx only wires it when the
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
  prsnlName: "Cerner Test, Physician",
};

class MockCclRequest implements CclRequestLike {
  onreadystatechange: (() => void) | null = null;
  readyState = 0;
  status = 0;
  responseText = "";
  private blob = "";
  private readonly chart: MockChart;
  private readonly log: (line: string) => void;

  constructor(chart: MockChart, log: (line: string) => void) {
    this.chart = chart;
    this.log = log;
  }

  open(): void {
    this.readyState = 1;
  }

  setBlobIn(blob: string): void {
    this.blob = blob;
  }

  send(parameterString?: string): void {
    this.log("XMLCclRequest.send " + (parameterString ?? ""));
    this.log("blobIn " + this.blob);
    const substituted = (parameterString ?? "")
      .replace("$PAT_PersonId$", String(this.chart.personId))
      .replace("$VIS_EncntrId$", String(this.chart.encntrId));
    let payload: {
      customScript?: { script?: Array<{ id?: string; name?: string; run?: string; parameters?: unknown }> };
      person?: unknown;
      encounter?: unknown;
    } = {};
    try {
      payload = (JSON.parse(this.blob) as { payload?: typeof payload }).payload ?? {};
    } catch {
      /* non-JSON blob; ignore */
    }
    const customPre: Array<{ id: string; data: unknown }> = [];
    const customPost: Array<{ id: string; data: unknown }> = [];
    for (const script of payload.customScript?.script ?? []) {
      this.log("customScript " + (script.run ?? "pre") + " -> " + (script.name ?? "?"));
      this.log("parameters " + JSON.stringify(script.parameters ?? {}));
      const entry = {
        id: script.id ?? "unnamed",
        data: script.name?.includes("write_document")
          ? { status: "success", statusValue: 0, parentEventId: 987654321 }
          : {},
      };
      (script.run === "post" ? customPost : customPre).push(entry);
    }
    const sections: Record<string, unknown> = {};
    if ((payload as { person?: unknown }).person) {
      sections.persons = [
        {
          personId: this.chart.personId,
          nameFullFormatted: this.chart.nameFullFormatted,
          nameFirst: "MICKEY",
          nameLast: "MOUSE",
          birthDtTm: "1980-01-01T08:00:00.000+00:00",
          age: "46 Years",
          gender: "Male",
          aliases: [
            { alias: "9876 543 210", aliasType: "PHN" },
            { alias: "700001234", aliasType: "MRN" },
          ],
        },
      ];
    }
    if ((payload as { encounter?: unknown }).encounter) {
      sections.encounters = [
        {
          encntrId: this.chart.encntrId,
          personId: this.chart.personId,
          encntrType: "Outpatient",
          location: "Mock Demo Clinic",
          aliases: [{ alias: "FIN-0001234", aliasType: "FIN NBR" }],
        },
      ];
    }
    const reply = {
      ...sections,
      runStats: {
        status: "ok",
        domain: "mock",
        prsnlId: this.chart.prsnlId,
        prsnlName: this.chart.prsnlName,
        parameters: substituted,
      },
      chartId: {
        personId: this.chart.personId,
        encntrId: this.chart.encntrId,
        nameFullFormatted: this.chart.nameFullFormatted,
      },
      errors: [],
      ...(customPre.length ? { customPre } : {}),
      ...(customPost.length ? { customPost } : {}),
    };
    setTimeout(() => {
      this.status = 200;
      this.responseText = JSON.stringify(reply);
      this.readyState = 4;
      this.onreadystatechange?.();
    }, 120);
  }
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
 * CLINICALNOTE is the reason this is not a plain `split("|")`: its third field
 * is a BRACKETED, itself-pipe-delimited list of event ids, so a naive split
 * shreds it and every field after it lands one place left.
 */
export function decodeMPagesEvent(type: string, eventString: string): Record<string, string> | null {
  const spec = MPAGES_EVENTS[type as keyof typeof MPAGES_EVENTS];
  if (!spec) return null;
  const fields: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of eventString) {
    if (ch === "[") depth += 1;
    if (ch === "]") depth -= 1;
    if (ch === "|" && depth === 0) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  const out: Record<string, string> = {};
  spec.params.forEach((name, i) => { out[name] = fields[i] ?? ""; });
  if (fields.length !== spec.params.length) {
    out["!arity"] = `${fields.length} fields, expected ${spec.params.length}`;
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

export function installMockPowerChart(
  chart: MockChart = DEMO_CHART,
  log: (line: string) => void = (line) => console.info("[mock-powerchart]", line),
): void {
  const external = ((window as { external?: unknown }).external ?? {}) as Record<string, unknown>;
  external.XMLCclRequest = () => new MockCclRequest(chart, log);
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
    }
    return Promise.resolve();
  };
  external.APPLINK = (...args: unknown[]) => {
    recordDiscernActivity("APPLINK", formatArgs(args));
    return Promise.resolve();
  };
  try {
    Object.defineProperty(window, "external", { value: external, configurable: true });
  } catch {
    (window as { external?: unknown }).external = external;
  }
}
