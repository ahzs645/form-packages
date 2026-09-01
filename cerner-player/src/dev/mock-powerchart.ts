import type { CclRequestLike } from "@webforms/cerner-core";

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
    const reply = {
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

function makeDiscernObject(name: string): object {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") return undefined;
        return (...args: unknown[]) => {
          recordDiscernActivity(
            "DiscernObjectFactory(" + name + ")." + String(property),
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
  external.DiscernObjectFactory = (name: string) => {
    recordDiscernActivity("DiscernObjectFactory", name + " requested");
    return Promise.resolve(makeDiscernObject(name));
  };
  external.MPAGES_EVENT = (type: string, eventString: string) => {
    recordDiscernActivity("MPAGES_EVENT " + type, eventString);
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
