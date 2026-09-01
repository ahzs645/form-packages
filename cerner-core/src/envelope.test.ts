import { describe, expect, it } from "vitest";

import { buildParameterString, getCustomResult, type MPageResponse } from "./envelope";

const config = { mode: "CHART" as const, hexMode: false };

describe("buildParameterString", () => {
  it("sends concrete ids when the encounter is known", () => {
    expect(
      buildParameterString({
        mode: "CHART",
        personId: 123,
        encntrId: 456,
        instanceIndex: 1,
        config,
        allowContextTokens: true,
      }),
    ).toBe('^MINE^,123,456,0,1,^{"mode":"CHART","hexMode":false}^');
  });

  it("falls back to PowerChart macro tokens for unknown chart context in PowerChart", () => {
    expect(
      buildParameterString({
        mode: "CHART",
        instanceIndex: 0,
        config,
        allowContextTokens: true,
      }),
    ).toBe('^MINE^,$PAT_PersonId$,$VIS_EncntrId$,0,0,^{"mode":"CHART","hexMode":false}^');
  });

  it("never emits macro tokens off PowerChart", () => {
    expect(
      buildParameterString({
        mode: "CHART",
        personId: 9,
        instanceIndex: 0,
        config,
        allowContextTokens: false,
      }),
    ).toBe('^MINE^,9,0,0,0,^{"mode":"CHART","hexMode":false}^');
  });

  it("always sends zero context in organizer mode", () => {
    expect(
      buildParameterString({
        mode: "ORGANIZER",
        personId: 123,
        encntrId: 456,
        debugIndicator: 1,
        instanceIndex: 2,
        config: { mode: "ORGANIZER", hexMode: true },
        allowContextTokens: true,
      }),
    ).toBe('^MINE^,0,0,1,2,^{"mode":"ORGANIZER","hexMode":true}^');
  });

  it("rejects config containing the ^ delimiter", () => {
    expect(() =>
      buildParameterString({
        mode: "CHART",
        instanceIndex: 0,
        config: { mode: "CH^ART" as never, hexMode: false },
        allowContextTokens: true,
      }),
    ).toThrow(/delimiter/);
  });
});

describe("getCustomResult", () => {
  const response: MPageResponse = {
    customPre: [{ id: "form-def", data: { title: "ABC Stamp" } }],
    customPost: [{ id: "save", data: { ok: true } }],
  };

  it("finds results in pre and post buckets", () => {
    expect(getCustomResult(response, "form-def")).toEqual({ title: "ABC Stamp" });
    expect(getCustomResult(response, "save")).toEqual({ ok: true });
  });

  it("returns undefined for unknown ids or missing buckets", () => {
    expect(getCustomResult(response, "missing")).toBeUndefined();
    expect(getCustomResult({}, "form-def")).toBeUndefined();
  });
});
