// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { openPatientTabAsync } from "fluent-cerner-js";

import { decodeMPagesEvent, installMockPowerChart } from "./mock-powerchart";

/* The bridge payloads are ONE pipe-delimited positional string each, so the
   only way to be wrong is quietly: a field lands one place left and the call
   still "works". These pin the shapes recorded in cerner-core's catalogue. */
describe("decodeMPagesEvent", () => {
  it("names the POWERFORM fields, including the ad-hoc search form", () => {
    expect(decodeMPagesEvent("POWERFORM", "8316243|12575702|15361|0|0")).toEqual({
      personId: "8316243",
      encntrId: "12575702",
      formId: "15361",
      activityId: "0",
      permanentFlag: "0",
    });
    /* 0|0 is how the client is told to open Ad Hoc rather than a named form */
    expect(decodeMPagesEvent("POWERFORM", "1|2|0|0|0")?.formId).toBe("0");
  });

  it("puts the CKI in the third POWERNOTE field", () => {
    /* The CKI names a note TEMPLATE. It is the handle a Smart Template demo
       needs, and getting it into the wrong slot silently opens nothing. */
    const decoded = decodeMPagesEvent("POWERNOTE", "8316243|12575702|CKI!EPS_NOTE_TYPE|0");
    expect(decoded?.CKI).toBe("CKI!EPS_NOTE_TYPE");
    expect(decoded?.noteId).toBe("0");
  });

  it("does not shred CLINICALNOTE's bracketed event id list", () => {
    /* The third field is itself pipe-delimited inside brackets. A plain
       split("|") yields nine fields from three ids and shifts every field
       after it — this is the case the decoder exists for. */
    const decoded = decodeMPagesEvent(
      "CLINICALNOTE",
      "8316243|12575702|[155543|155544|155545]|Documents|127|CKI_VIEW|1|CKI_COMP|2",
    );
    expect(decoded?.eventIds).toBe("[155543|155544|155545]");
    expect(decoded?.windowTitle).toBe("Documents");
    expect(decoded?.compSeq).toBe("2");
    expect(decoded?.["!arity"]).toBeUndefined();
  });

  it("keeps ORDERS brace groups intact and names the full seven-field payload", () => {
    expect(decodeMPagesEvent("ORDERS", "1|2|{ORDER|123|0|0|0|0}|0|{2|0}|32|0")).toEqual({
      personId: "1", encntrId: "2", orderString: "{ORDER|123|0|0|0|0}",
      powerPlanFlag: "0", tabSpec: "{2|0}", launchViewFlag: "32", signSilently: "0",
    });
  });

  it("reports arity rather than silently padding", () => {
    const decoded = decodeMPagesEvent("POWERFORM", "1|2|3");
    expect(decoded?.["!arity"]).toBe("3 fields, expected 5");
    expect(decoded?.permanentFlag).toBe("");
  });

  it("returns null for an event the catalogue does not know", () => {
    expect(decodeMPagesEvent("NOTAREALEVENT", "1|2")).toBeNull();
  });
});

it("exposes the global APPLINK used by fluent-cerner-js", async () => {
  installMockPowerChart();
  expect(typeof window.APPLINK).toBe("function");
  const result = await openPatientTabAsync(12724066, 97953477, "Orders");
  expect(result.inPowerChart).toBe(true);
  expect(result.badInput).toBe(false);
  expect(result.eventString).toContain("/FIRSTTAB=^Orders^");
});
