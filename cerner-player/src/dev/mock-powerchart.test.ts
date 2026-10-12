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
      /* the wiki's name (MPAGES_EVENT - POWERFORM): 0 view or modify, 1 view-only */
      chartMode: "0",
    });
    /* 0|0 is how the client is told to open Ad Hoc rather than a named form */
    expect(decodeMPagesEvent("POWERFORM", "1|2|0|0|0")?.formId).toBe("0");
  });

  it("puts the CKI in the third POWERNOTE field", () => {
    /* The wiki (MPAGES_EVENT - POWERNOTE): the CKI names an ENCOUNTER PATHWAY
       (CKI_SOURCE!CKI_IDENTIFIER), and the fourth field is the event_id of an
       existing PowerNote — not a "note id". Getting either into the wrong slot
       silently opens nothing. */
    const decoded = decodeMPagesEvent("POWERNOTE", "8316243|12575702|CKI!EPS HAIR LOSS|0");
    expect(decoded?.CKI).toBe("CKI!EPS HAIR LOSS");
    expect(decoded?.eventId).toBe("0");
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
    /* field names are the wiki's (MPAGES_EVENT - ORDERS) */
    expect(decodeMPagesEvent("ORDERS", "1|2|{ORDER|123|0|0|0|0}|0|{2|0}|32|0")).toEqual({
      personId: "1", encntrId: "2", orderLst: "{ORDER|123|0|0|0|0}",
      customizeFlags: "0", tabLst: "{2|0}", defaultDisplay: "32", silentSignFlag: "0",
    });
  });

  it("accepts the wiki's own six-field ORDERS example (silentSignFlag omitted)", () => {
    const decoded = decodeMPagesEvent("ORDERS", "8316243|12575702|{ORDER|0|0|0|0|0}|0|{2|127}{3|127}|8");
    expect(decoded?.["!arity"]).toBeUndefined();
    expect(decoded?.tabLst).toBe("{2|127}{3|127}");
    expect(decoded?.silentSignFlag).toBe("");
  });

  it("reports arity rather than silently padding", () => {
    const decoded = decodeMPagesEvent("POWERFORM", "1|2|3");
    expect(decoded?.["!arity"]).toBe("3 fields, expected 5");
    expect(decoded?.chartMode).toBe("");
    expect(decodeMPagesEvent("ORDERS", "1|2|{ORDER|0|0|0|0|0}|0|{2|127}")?.["!arity"]).toBe("5 fields, expected 6 or 7");
  });

  it("knows the ALLERGY conversation", () => {
    const decoded = decodeMPagesEvent("ALLERGY", "18668144|5595233|0|5894|shellfish|d03830|3290|Food|591|1");
    expect(decoded).toMatchObject({ allergyId: "0", nomenId: "5894", substanceDisp: "shellfish", substanceTypeDisplay: "Food", compSeq: "1" });
    expect(decoded?.["!arity"]).toBeUndefined();
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

describe("simulated CCL behind the dev bridge", () => {
  type Request = { open: (m: string, p: string) => void; setBlobIn: (b: string) => void; send: (s: string) => void; onreadystatechange: (() => void) | null; readyState: number; status: number; responseText: string };
  const call = (payload: unknown) => new Promise<Record<string, any>>((resolve) => {
    const request = (window.external as unknown as { XMLCclRequest: () => Request }).XMLCclRequest();
    request.onreadystatechange = () => { if (request.readyState === 4) resolve(JSON.parse(request.responseText)); };
    request.open("GET", "nh_wf_entry:group1");
    request.setBlobIn(JSON.stringify({ payload }));
    request.send('^MINE^,$PAT_PersonId$,$VIS_EncntrId$,0,1,^{"mode":"CHART","hexMode":false}^');
  });

  it("answers the player's chart load in nh_wf_entry's real shape", async () => {
    installMockPowerChart();
    const reply = await call({ patientSource: [{ personId: 12724066, encntrId: 97953477 }], person: { aliases: true }, encounter: { aliases: true } });
    expect(reply.chartId).toEqual({ personId: 12724066, encntrId: 97953477, nameFullFormatted: "MOUSE, MICKEY BOB" });
    expect(reply.runStats.prsnlName).toBe("CERNER TEST, PHYSICIAN");
    expect(reply.persons[0]).toMatchObject({ gender: "Male", age: expect.stringMatching(/Years$/) });
    expect(reply.persons[0].aliases.map((a: { aliasTypeMeaning: string }) => a.aliasTypeMeaning).sort()).toEqual(["MRN", "PHN"]);
    expect(reply.encounters[0].aliases[0]).toMatchObject({ aliasTypeMeaning: "FIN NBR", alias: "FIN-0001234" });
  });

  it("files a document under the player's default event key and note format", async () => {
    installMockPowerChart();
    const reply = await call({
      patientSource: [{ personId: 12724066, encntrId: 97953477 }],
      customScript: { script: [{ name: "nh_wf_write_document:group1", id: "doc", run: "pre", parameters: { eventKey: "WEBFORMDOC", title: "Form", document: "<p>x</p>", noteFormat: "AH" } }] },
    });
    expect(reply.customPre[0].data).toMatchObject({ status: "success", statusValue: 0 });
    expect(reply.customPre[0].data.parentEventId).toBeGreaterThan(0);
  });
});
