import { describe, expect, it } from "vitest";

import { DEFAULT_SMART_LAUNCH_CONTEXT, resolveSmartLaunchContext } from "./launch";

function fakeElement(attributes: Record<string, string>) {
  return {
    getAttribute(name: string): string | null {
      return name in attributes ? attributes[name] : null;
    },
  };
}

/** A fhirclient Client, as far as resolveSmartLaunchContext looks at one. */
function fakeClient(tokenResponse: Record<string, unknown>) {
  return { state: { serverUrl: "https://fhir.example/r4", tokenResponse } };
}

describe("resolveSmartLaunchContext", () => {
  it("draws our own banner and uses our own look with no launch context", () => {
    expect(resolveSmartLaunchContext({})).toEqual(DEFAULT_SMART_LAUNCH_CONTEXT);
    expect(DEFAULT_SMART_LAUNCH_CONTEXT).toEqual({ needPatientBanner: true, smartStyleUrl: null });
  });

  it("reads both flags out of the fhirclient token response", () => {
    expect(
      resolveSmartLaunchContext({
        client: fakeClient({
          need_patient_banner: false,
          smart_style_url: "https://launch.smarthealthit.org/smart-style.json",
        }),
      }),
    ).toEqual({
      needPatientBanner: false,
      smartStyleUrl: "https://launch.smarthealthit.org/smart-style.json",
    });
  });

  it("accepts a bare client state as well as a client", () => {
    const state = { tokenResponse: { need_patient_banner: false } };
    expect(resolveSmartLaunchContext({ client: state }).needPatientBanner).toBe(false);
  });

  it("keeps the default when the EHR sends no flag or a non-boolean one", () => {
    expect(resolveSmartLaunchContext({ client: fakeClient({}) }).needPatientBanner).toBe(true);
    // An EHR that sends the string "false" has not sent a boolean; we do not
    // guess, we keep the banner. The one that matters is an explicit `false`.
    expect(
      resolveSmartLaunchContext({ client: fakeClient({ need_patient_banner: "false" }) })
        .needPatientBanner,
    ).toBe(true);
    expect(resolveSmartLaunchContext({ client: null }).needPatientBanner).toBe(true);
    expect(resolveSmartLaunchContext({ client: { state: null } }).needPatientBanner).toBe(true);
  });

  it("reads the banner flag from the launch URL and the host element", () => {
    expect(resolveSmartLaunchContext({ search: "?needPatientBanner=0" }).needPatientBanner).toBe(false);
    expect(resolveSmartLaunchContext({ search: "need_patient_banner=false" }).needPatientBanner).toBe(false);
    expect(resolveSmartLaunchContext({ search: "?needPatientBanner=true" }).needPatientBanner).toBe(true);
    expect(
      resolveSmartLaunchContext({ element: fakeElement({ "need-patient-banner": "no" }) })
        .needPatientBanner,
    ).toBe(false);
    expect(
      resolveSmartLaunchContext({ element: fakeElement({ need_patient_banner: "0" }) })
        .needPatientBanner,
    ).toBe(false);
  });

  it("ignores values that are not a yes or a no", () => {
    expect(resolveSmartLaunchContext({ search: "?needPatientBanner=maybe" }).needPatientBanner).toBe(true);
    expect(
      resolveSmartLaunchContext({
        search: "?needPatientBanner=maybe",
        element: fakeElement({ "need-patient-banner": "false" }),
      }).needPatientBanner,
    ).toBe(false);
  });

  it("lets the EHR outrank the launch URL, and the URL outrank the element", () => {
    expect(
      resolveSmartLaunchContext({
        client: fakeClient({ need_patient_banner: true }),
        search: "?needPatientBanner=0",
        element: fakeElement({ "need-patient-banner": "0" }),
      }).needPatientBanner,
    ).toBe(true);
    expect(
      resolveSmartLaunchContext({
        search: "?needPatientBanner=1",
        element: fakeElement({ "need-patient-banner": "0" }),
      }).needPatientBanner,
    ).toBe(true);
    expect(
      resolveSmartLaunchContext({
        defaults: { needPatientBanner: false },
      }).needPatientBanner,
    ).toBe(false);
  });

  it("takes the style URL only from the token response", () => {
    // We fetch what this names, so a query string must not be able to set it.
    expect(
      resolveSmartLaunchContext({
        search: "?smart_style_url=https%3A%2F%2Fevil.example%2Fstyle.json",
      }).smartStyleUrl,
    ).toBeNull();
    expect(
      resolveSmartLaunchContext({
        element: fakeElement({ smart_style_url: "https://evil.example/style.json" }),
      }).smartStyleUrl,
    ).toBeNull();
  });

  it("refuses style URLs that are not absolute http(s)", () => {
    const refused = [
      "javascript:alert(1)",
      "data:application/json,{}",
      "//evil.example/style.json",
      "/smart-style.json",
      "ftp://host/style.json",
      "https://host/style.json\" onload=\"x",
      "",
      "   ",
      42,
      null,
    ];
    for (const smart_style_url of refused) {
      expect(
        resolveSmartLaunchContext({ client: fakeClient({ smart_style_url }) }).smartStyleUrl,
        String(smart_style_url),
      ).toBeNull();
    }
  });

  it("trims the style URL the EHR sent", () => {
    expect(
      resolveSmartLaunchContext({
        client: fakeClient({ smart_style_url: "  https://ehr.example/smart-style.json  " }),
      }).smartStyleUrl,
    ).toBe("https://ehr.example/smart-style.json");
  });
});
