import { describe, expect, it, vi } from "vitest";

import { hexDecode, hexEncode } from "./hex";
import { CclClient, CclTransportError, type CclRequestLike } from "./transport";

class FakeRequest implements CclRequestLike {
  onreadystatechange: (() => void) | null = null;
  readyState = 0;
  status = 0;
  responseText = "";
  opened?: { method: string; url: string; user?: string };
  blobIn?: string;
  sentBody?: string;
  headers: Record<string, string> = {};
  private readonly hasBlobIn: boolean;

  constructor(hasBlobIn: boolean) {
    this.hasBlobIn = hasBlobIn;
    if (hasBlobIn) {
      this.setBlobIn = (blob: string) => {
        this.blobIn = blob;
      };
    }
  }

  setBlobIn?: (blob: string) => void;

  open(method: string, url: string, _async: boolean, user?: string): void {
    this.opened = { method, url, user };
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  send(body?: string): void {
    this.sentBody = body;
  }

  respond(status: number, responseText: string): void {
    this.status = status;
    this.responseText = responseText;
    this.readyState = 4;
    this.onreadystatechange?.();
  }
}

const powerChartWindow = {
  external: { XMLCclRequest: () => ({}) },
  location: { hostname: "chart.example", origin: "https://chart.example" },
};

const browserWindow = {
  external: {},
  location: { hostname: "localhost", origin: "http://localhost:3000" },
};

function makeClient(
  windowRef: typeof powerChartWindow | typeof browserWindow,
  requests: FakeRequest[],
  extra?: Partial<ConstructorParameters<typeof CclClient>[0]>,
) {
  return new CclClient({
    scriptName: "nh_wf_entry:group1",
    windowRef,
    requestFactory: (inPowerChart) => {
      const request = new FakeRequest(inPowerChart);
      requests.push(request);
      return request;
    },
    ...extra,
  });
}

describe("CclClient in PowerChart", () => {
  it("sends the blob through setBlobIn and context through the parameter string", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(powerChartWindow, requests, { personId: 5, encntrId: 6 });
    const pending = client.execute({ patientSource: [{ personId: 5, encntrId: 6 }] });

    const request = requests[0];
    expect(request.opened).toEqual({ method: "GET", url: "nh_wf_entry:group1", user: undefined });
    expect(JSON.parse(request.blobIn ?? "")).toEqual({
      payload: { patientSource: [{ personId: 5, encntrId: 6 }] },
    });
    expect(request.sentBody).toBe('^MINE^,5,6,0,0,^{"mode":"CHART","hexMode":false}^');

    request.respond(200, '{"runStats":{"status":"ok"},"chartId":{"personId":5}}');
    await expect(pending).resolves.toEqual({
      runStats: { status: "ok" },
      chartId: { personId: 5 },
    });
  });

  it("forces f8 typing for id keys in the blob", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(powerChartWindow, requests, { personId: 1, encntrId: 1 });
    const pending = client.execute({ patientSource: [{ personId: 12724066, encntrId: 0 }] });
    expect(requests[0].blobIn).toBe(
      '{"payload":{"patientSource":[{"personId":12724066.0,"encntrId":0.0}]}}',
    );
    requests[0].respond(200, "{}");
    await pending;
  });

  it("absorbs chart context echoed back by the entry script", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(powerChartWindow, requests);
    const first = client.execute({});
    expect(requests[0].sentBody).toContain("$PAT_PersonId$");
    requests[0].respond(200, '{"chartId":{"personId":42,"encntrId":77}}');
    await first;

    const second = client.execute({});
    expect(requests[1].sentBody).toContain("^MINE^,42,77,");
    requests[1].respond(200, "{}");
    await second;
  });

  it("uses macro tokens when chart context is unknown", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(powerChartWindow, requests);
    const pending = client.execute({});
    expect(requests[0].sentBody).toContain("$PAT_PersonId$,$VIS_EncntrId$");
    requests[0].respond(200, "{}");
    await pending;
  });

  it("strips raw control characters before parsing", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(powerChartWindow, requests, { personId: 1, encntrId: 1 });
    const pending = client.execute({});
    requests[0].respond(200, '{"runStats":\n\t{"status":"ok"}\r}');
    await expect(pending).resolves.toEqual({ runStats: { status: "ok" } });
  });

  it("queues calls beyond the instance pool and reuses freed slots", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(powerChartWindow, requests, {
      personId: 1,
      encntrId: 1,
      maxInstances: 2,
    });

    const first = client.execute({});
    const second = client.execute({});
    const third = client.execute({});
    expect(requests).toHaveLength(2);
    expect(client.pendingCount).toBe(1);

    requests[0].respond(200, "{}");
    await first;
    expect(requests).toHaveLength(3);
    expect(requests[2].sentBody).toContain(",0,^");

    requests[1].respond(200, "{}");
    requests[2].respond(200, "{}");
    await Promise.all([second, third]);
    expect(client.pendingCount).toBe(0);
  });

  it("rejects with CclTransportError on non-200 and on unparseable replies", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(powerChartWindow, requests, { personId: 1, encntrId: 1 });

    const failing = client.execute({});
    requests[0].respond(403, "denied");
    await expect(failing).rejects.toMatchObject({ name: "CclTransportError", status: 403 });

    const garbled = client.execute({});
    requests[1].respond(200, "not json");
    await expect(garbled).rejects.toThrow(/not parseable JSON/);
  });

  it("treats 492 non-fatal errors as success and names known statuses in failures", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(powerChartWindow, requests, { personId: 1, encntrId: 1 });

    const nonFatal = client.execute({});
    requests[0].respond(492, '{"runStats":{"status":"warn"}}');
    await expect(nonFatal).resolves.toEqual({ runStats: { status: "warn" } });

    const memoryError = client.execute({});
    requests[1].respond(493, "");
    await expect(memoryError).rejects.toThrow(/493 \(Memory Error\)/);
  });

  it("releases the slot after a failure", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(powerChartWindow, requests, {
      personId: 1,
      encntrId: 1,
      maxInstances: 1,
    });
    const failing = client.execute({});
    requests[0].respond(500, "boom");
    await expect(failing).rejects.toBeInstanceOf(CclTransportError);

    const next = client.execute({});
    expect(requests).toHaveLength(2);
    requests[1].respond(200, "{}");
    await next;
  });

  it("times out and rejects when configured", async () => {
    vi.useFakeTimers();
    try {
      const requests: FakeRequest[] = [];
      const client = makeClient(powerChartWindow, requests, {
        personId: 1,
        encntrId: 1,
        timeoutMs: 1000,
      });
      const pending = client.execute({});
      vi.advanceTimersByTime(1001);
      await expect(pending).rejects.toThrow(/timed out/);
      // late replies after settlement must be ignored
      requests[0].respond(200, "{}");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("CclClient outside PowerChart", () => {
  it("POSTs the hex-encoded envelope to the dev proxy on localhost", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(browserWindow, requests, { personId: 7, encntrId: 8 });
    const pending = client.execute({ address: true });

    const request = requests[0];
    expect(request.opened?.method).toBe("POST");
    expect(request.opened?.url).toBe("http://localhost:3000/cclproxy/nh_wf_entry:group1");
    expect(request.headers["Content-Type"]).toBe("application/json");

    const body = request.sentBody ?? "";
    expect(body).toContain('parameters=^MINE^,7,8,0,0,^{"mode":"CHART","hexMode":true}^&blobIn=');
    const blobHex = body.split("&blobIn=")[1];
    expect(JSON.parse(hexDecode(blobHex))).toEqual({ payload: { address: true } });

    request.respond(200, hexEncode('{"runStats":{"hexMode":1}}'));
    await expect(pending).resolves.toEqual({ runStats: { hexMode: 1 } });
  });

  it("requires a contextRoot off localhost", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(
      { external: {}, location: { hostname: "forms.nh.ca", origin: "https://forms.nh.ca" } },
      requests,
    );
    await expect(client.execute({})).rejects.toThrow(/contextRoot is required/);
    expect(client.pendingCount).toBe(0);
  });

  it("uses the contextRoot when provided", async () => {
    const requests: FakeRequest[] = [];
    const client = makeClient(
      { external: {}, location: { hostname: "forms.nh.ca", origin: "https://forms.nh.ca" } },
      requests,
      { contextRoot: "https://mois.nh.ca/discern/prod/mpages/reports/" },
    );
    const pending = client.execute({});
    expect(requests[0].opened?.url).toBe(
      "https://mois.nh.ca/discern/prod/mpages/reports/nh_wf_entry:group1",
    );
    requests[0].respond(200, hexEncode("{}"));
    await pending;
  });
});
