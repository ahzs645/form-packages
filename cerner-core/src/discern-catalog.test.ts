import { describe, expect, it } from "vitest";

import {
  CONTEXT_VARIABLES,
  DISCERN_NATIVE_FUNCTIONS,
  DISCERN_OBJECT_CATALOG,
  discernArityProblem,
  parseDiscernMeta,
  substituteContextVariables,
} from "./discern-catalog";
import { DISCERN_META_HTML, DISCERN_OBJECTS, MPAGES_EVENTS, mpagesEventArityOk } from "./discern";
import {
  APPLINK_LINK_MODES,
  MOEW_CUSTOMIZE_FLAGS,
  MOEW_DISPLAY_FLAGS,
  MOEW_DISPLAY_PRESETS,
  ORDER_ACTION_AVAILABILITY,
  decodeAllergyEvent,
  decodeOrderActionAvailability,
  decodeOrdersEvent,
  decodePowerFormEvent,
  decodePowerNoteEvent,
  describeMPagesEvent,
  encodeOrderActionAvailability,
  parseCreateNewNoteJson,
  silentSignBlocker,
} from "./discern-codes";

/* Every payload below is copied from an example on Oracle's MPages
   Development Wiki (MPDEVWIKI) or the Discern Explorer help, so these tests
   pin the catalogue to the documentation rather than to a caller library. */

describe("MPAGES_EVENT payloads, as the wiki's examples send them", () => {
  it("lists exactly the five documented events, ALLERGY included", () => {
    expect(Object.keys(MPAGES_EVENTS).sort()).toEqual(["ALLERGY", "CLINICALNOTE", "ORDERS", "POWERFORM", "POWERNOTE"]);
    expect(MPAGES_EVENTS.POWERFORM.params[4]).toBe("chartMode");
    expect(MPAGES_EVENTS.POWERNOTE.params[3]).toBe("eventId");
    expect(MPAGES_EVENTS.POWERFORM.hosts).toBe("any");
    expect(MPAGES_EVENTS.ORDERS.hosts).toBe("powerchart");
  });

  it("decodes ORDERS with six fields and a two-tab list (MPAGES_EVENT - ORDERS example 1)", () => {
    const event = decodeOrdersEvent("8316243|12575702|{ORDER|0|0|0|0|0}|0|{2|127}{3|127}|8");
    expect(event).toMatchObject({
      launchOnly: true, launchView: "search", signSilently: false, silentSignFieldPresent: false, powerPlans: false,
      tab: "orders", display: 127,
    });
    expect(event.tabs.map((t) => t.tab)).toEqual(["orders", "medications"]);
    expect(event.tabs[0].panes).toHaveLength(7);
    expect(mpagesEventArityOk(MPAGES_EVENTS.ORDERS, 6)).toBe(true);
    expect(mpagesEventArityOk(MPAGES_EVENTS.ORDERS, 5)).toBe(false);
  });

  it("decodes customizeFlags 24 as PowerPlans, and bracketed nomenclature lists (Discern Explorer example)", () => {
    const event = decodeOrdersEvent("8316243|12575702|{ORDER|672556|0|0|[961514]|1}{ORDER|666011|0|0|[1029704|1029801|961514]|1}|24|{2|127}|16|1");
    expect(event.powerPlans).toBe(true);
    expect(event.customize).toEqual(["allow power plans", "allow power plan doc"]);
    expect(event.orders).toMatchObject([
      { synonymId: 672556, nomenclatureIds: [961514], interactionCheck: "on sign" },
      { synonymId: 666011, nomenclatureIds: [1029704, 1029801, 961514] },
    ]);
    expect(event).toMatchObject({ signSilently: true, launchView: "profile" });
    expect(silentSignBlocker(event)).toBeNull();
  });

  it("will not sign an order ACTION silently (the wiki: only when no other orderActions are present)", () => {
    const event = decodeOrdersEvent("8316243|12575702|{ORDER|672556|0|0|961514|1}{MODIFY|12345}|24|{2|127}|16|1");
    expect(silentSignBlocker(event)).toMatch(/MODIFY is an order action/);
    expect(() => decodeOrdersEvent("1|2|{ORDER|1|0|0|0|0}|0|{2|127}|32|0|9")).toThrow("6 or 7 fields");
    expect(() => decodeOrdersEvent("1|2|{ORDER|1|0|0|0|0}|0|{2}|32")).toThrow("{tab|display}");
  });

  it("decodes POWERFORM's chartMode and POWERNOTE's encounter-pathway CKI and event id", () => {
    expect(decodePowerFormEvent("733757|701346|15721144|0|0")).toMatchObject({ formId: 15721144, adHoc: false, existing: false, chartMode: 0 });
    expect(decodePowerFormEvent("1|2|0|4322256|1")).toMatchObject({ existing: true, chartMode: 1 });
    expect(() => decodePowerFormEvent("1|2|3|0|2")).toThrow("chartMode");
    expect(decodePowerNoteEvent("8316243|12575702|CKI!EPS HAIR LOSS|0")).toMatchObject({ ckiSource: "CKI", ckiIdentifier: "EPS HAIR LOSS", eventId: 0 });
    expect(decodePowerNoteEvent("8316243|12575702||2516864731")).toMatchObject({ cki: "", eventId: 2516864731 });
    expect(() => decodePowerNoteEvent("1|2||0")).toThrow("event id or encounter pathway CKI");
    expect(describeMPagesEvent("POWERNOTE", "1|2||2516864731")).toBe("open PowerNote 2516864731");
  });

  it("decodes both ALLERGY examples and refuses a new allergy without substanceDisp", () => {
    expect(decodeAllergyEvent("18668144|5595233|0|0|||0||0|0").mode).toBe("profile");
    expect(decodeAllergyEvent("18668144|5595233|0|5894|shellfish|d03830|3290|Food|591|1")).toMatchObject({
      mode: "add", nomenId: 5894, substanceDisp: "shellfish", conceptId: "d03830", substanceTypeCd: 3290, substanceTypeDisplay: "Food", viewSeq: 591, compSeq: 1,
    });
    expect(decodeAllergyEvent("1|2|77|5894|shellfish||||0|0").mode).toBe("modify");
    expect(() => decodeAllergyEvent("1|2|0|5894|||||0|0")).toThrow("substanceDisp");
    expect(describeMPagesEvent("ALLERGY", "18668144|5595233|0|0|||0||0|0")).toBe("open the Allergy Profile");
  });
});

describe("POWERORDERS bits (CreateMOEW, GetAvailableOrderActions)", () => {
  it("knows every documented customize and display bit, and the named presets", () => {
    const customize = Object.values(MOEW_CUSTOMIZE_FLAGS).reduce((sum, bit) => sum | bit, 0);
    expect(customize).toBe((1 << 15) - 1); // 1 … 16384, nothing missing
    expect(MOEW_DISPLAY_FLAGS["plan entry only"]).toBe(128);
    expect(MOEW_DISPLAY_FLAGS["show formulary details"]).toBe(256);
    expect(MOEW_DISPLAY_PRESETS.all).toBe(383);
    expect(MOEW_DISPLAY_PRESETS.moped).toBe(245);
  });

  it("round-trips the 31 action-availability bits", () => {
    expect(Object.keys(ORDER_ACTION_AVAILABILITY)).toHaveLength(31);
    const mask = encodeOrderActionAvailability(["CancelDC", "RetailMedManagerRefill"]);
    expect(mask).toBe(1 + 2 ** 30);
    expect(decodeOrderActionAvailability(mask)).toEqual(["CancelDC", "RetailMedManagerRefill"]);
  });
});

describe("the object catalogue", () => {
  it("covers every object the wiki home page lists, with the POWERORDERS methods of its overview", () => {
    for (const name of [
      "POWERFORM", "DYNDOC", "POWERNOTE", "PREGNANCY", "PVCONTXTMPAGE", "PVPATIENTFOCUS", "POWERORDERS", "KIACROSSMAPPING",
      "PVVIEWERMPAGE", "PVFRAMEWORKLINK", "DISCHARGEPROCESS", "PATIENTEDUCATION", "ORDERS", "PVPATIENTSEARCHMPAGE",
      "PMLISTMAINTENANCE", "TASKDOC", "INFOBUTTONLINK", "PEXSCHEDULINGACTIONS", "PEXAPPLICATIONSTATUS", "CONMANAPPNOTIFIER",
    ]) expect(DISCERN_OBJECT_CATALOG[name], name).toBeDefined();
    expect(DISCERN_OBJECTS.POWERORDERS).toEqual(expect.arrayContaining([
      "CreateMOEW", "DestroyMOEW", "InvokeCancelDCAction", "InvokeRenewAction", "InvokeCompleteAction", "GetDefaultRoutingDisplay",
      "GetAvailableOrderActions", "SignOrders", "DisplayMOEW", "GetXMLOrdersMOEW", "GetConsolidatedRoutingOptions",
      "InvokeRenewActionWithRouting", "AddPowerPlanMOEW", "InvokeResolveActionMOEW", "AddPowerPlanWithDetails",
      "InvokeRetailMedManagerRefillRequestReview", "AddNewOrdersToScratchpad", "AddNewOrderToScratchpad",
      "RemoveOrderFromScratchPad", "GetScratchPadOrders", "IsScratchPadEmptyMOEW", "AddDiagnosesToOrder",
    ]));
  });

  it("carries the wiki's parameter lists and marks what is not on the wiki", () => {
    const orders = DISCERN_OBJECT_CATALOG.POWERORDERS.methods;
    expect(orders.AddNewOrdersToScratchpad.params).toEqual(["lMOEWHandle", "newOrdersXML", "bSignTimeInteractionChecking"]);
    expect(orders.InvokeRenewAction.params).toHaveLength(10);
    expect(orders.InvokeRenewActionWithRouting.params).toHaveLength(12);
    expect(orders.CustomizeTabMOEW.source).toBe("wiki-example");
    expect(DISCERN_OBJECT_CATALOG.PVCONTXTMPAGE.methods.SetPatient.source).toBe("reverse-engineered");
    expect(DISCERN_OBJECT_CATALOG.PEXSCHEDULINGACTIONS.methods.ShowView.params).toEqual(["schEventId", "scheduleId"]);
    expect(discernArityProblem(orders.DestroyMOEW, 1)).toBeNull();
    expect(discernArityProblem(DISCERN_OBJECT_CATALOG.PEXSCHEDULINGACTIONS.methods.ShowView, 1)).toMatch(/expects 2 arguments/);
    expect(discernArityProblem(DISCERN_OBJECT_CATALOG.INFOBUTTONLINK.methods.AddAllergy, 1)).toBeNull();
    for (const [object, spec] of Object.entries(DISCERN_OBJECT_CATALOG)) {
      for (const [method, m] of Object.entries(spec.methods)) {
        if (m.source === "wiki") expect(m.wiki, `${object}.${method}`).toBeGreaterThan(0);
      }
    }
  });

  it("knows which native functions Edge drops and which are Edge-only", () => {
    expect(DISCERN_NATIVE_FUNCTIONS.CCLLINKPOPUP.edge).toBe("unsupported");
    expect(DISCERN_NATIVE_FUNCTIONS.CCLNEWSESSIONWINDOW.edge).toBe("unsupported");
    expect(DISCERN_NATIVE_FUNCTIONS.EdgePopup.edge).toBe("edge-only");
    expect(DISCERN_NATIVE_FUNCTIONS.XMLCclRequest.meta).toBe("XMLCCLREQUEST");
    expect(APPLINK_LINK_MODES[0]).toMatch(/executable name/);
    expect(APPLINK_LINK_MODES[100]).toMatch(/shell-execute/);
  });
});

describe("meta tag and context variables", () => {
  it("emits the documented meta form and parses content lists", () => {
    expect(DISCERN_META_HTML).not.toContain("http-equiv");
    expect(parseDiscernMeta("CCLLINK,APPLINK,CCLNEWSESSIONWINDOW")).toEqual({ names: ["CCLLINK", "APPLINK", "CCLNEWSESSIONWINDOW"], unknown: [], spaced: false });
    expect(parseDiscernMeta("APPLINK, XMLCCLREQUEST, POWERORDERS")).toMatchObject({ spaced: true, unknown: ["POWERORDERS"] });
  });

  it("substitutes $VAR$ with .00 on numbers, *VAR* bare and URL-encoded, case-insensitively", () => {
    expect(CONTEXT_VARIABLES.PAT_PersonId).toBe("number");
    const values = { PAT_PersonId: 589848, VIS_EncntrId: 5960967, APP_AppName: "Powerchart.exe", USR_Username: "a b" };
    expect(substituteContextVariables("^MINE^, value($pat_personid$), value($VIS_ENCNTRID$)", values).text)
      .toBe("^MINE^, value(589848.00), value(5960967.00)");
    expect(substituteContextVariables("?p=*PAT_PersonId*&u=*USR_Username*", values).text).toBe("?p=589848&u=a%20b");
    expect(substituteContextVariables("$APP_APPNAME$", values).text).toBe("Powerchart.exe");
    expect(substituteContextVariables("$PAT_Nope$ $USR_PositionCd$ $DM_INFO:CONTENT_SERVICE_URL$ 5*3*2", values)).toEqual({
      text: "$PAT_Nope$ $USR_PositionCd$ $DM_INFO:CONTENT_SERVICE_URL$ 5*3*2",
      unknown: ["PAT_Nope"],
      unresolved: ["USR_PositionCd", "DM_INFO:CONTENT_SERVICE_URL"],
    });
  });

  it("reads DYNDOC.CreateNewNote's JSON and allows one workflow_id", () => {
    expect(parseCreateNewNoteJson('{"person_id":1,"encounter_id":2,"note_list":[{"reference_template_id":3,"event_cd":4,"workflow_id":5},{"reference_template_id":6,"event_cd":7}]}'))
      .toEqual({ personId: 1, encounterId: 2, notes: [{ referenceTemplateId: 3, eventCd: 4, workflowId: 5 }, { referenceTemplateId: 6, eventCd: 7 }] });
    expect(() => parseCreateNewNoteJson({ person_id: 1, encounter_id: 2, note_list: [
      { reference_template_id: 3, event_cd: 4, workflow_id: 5 }, { reference_template_id: 6, event_cd: 7, workflow_id: 8 },
    ] })).toThrow("Only one note");
  });
});
