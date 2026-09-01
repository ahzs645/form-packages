import { describe, expect, it } from "vitest";

import { resolveChartContext } from "./context";
import { detectHostEnvironment, isInPowerChart } from "./environment";

function fakeElement(attributes: Record<string, string>) {
  return {
    getAttribute(name: string): string | null {
      return name in attributes ? attributes[name] : null;
    },
  };
}

describe("resolveChartContext", () => {
  it("returns zeros with no sources", () => {
    expect(resolveChartContext({})).toEqual({ personId: 0, encntrId: 0, prsnlId: 0 });
  });

  it("reads component attributes in underscore and kebab forms", () => {
    expect(
      resolveChartContext({
        element: fakeElement({ person_id: "11", "encntr-id": "22", prsnl_id: "33" }),
      }),
    ).toEqual({ personId: 11, encntrId: 22, prsnlId: 33 });
  });

  it("lets query parameters win over attributes", () => {
    expect(
      resolveChartContext({
        search: "?personId=100&encounterId=200&userId=300",
        element: fakeElement({ person_id: "11", encntr_id: "22" }),
      }),
    ).toEqual({ personId: 100, encntrId: 200, prsnlId: 300 });
  });

  it("ignores malformed and negative ids, keeping defaults", () => {
    expect(
      resolveChartContext({
        search: "?personId=abc&encounterId=-4",
        defaults: { personId: 7 },
      }),
    ).toEqual({ personId: 7, encntrId: 0, prsnlId: 0 });
  });

  it("accepts a search string without the leading question mark", () => {
    expect(resolveChartContext({ search: "personId=5" }).personId).toBe(5);
  });
});

describe("environment detection", () => {
  it("detects PowerChart via the XMLCclRequest bridge", () => {
    expect(isInPowerChart({ external: { XMLCclRequest: () => ({}) } })).toBe(true);
    expect(isInPowerChart({ external: {} })).toBe(false);
    expect(isInPowerChart({})).toBe(false);
  });

  it("classifies legacy IE via documentMode", () => {
    expect(detectHostEnvironment({ document: { documentMode: 11 } })).toEqual({
      inPowerChart: false,
      legacyIe: true,
      tier: "legacy",
    });
    expect(detectHostEnvironment({ document: {} }).tier).toBe("modern");
  });
});
