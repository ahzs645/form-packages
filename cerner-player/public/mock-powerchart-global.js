/*
 * Dev-only PowerChart simulator injected into example MPages served under
 * /cerner-examples. Installs the native bridges those apps probe for:
 *   - window.external.XMLCclRequest (Clinical Office v3-v5 transport)
 *   - global XMLCclRequest constructor (raw usage in site-authored MPages)
 *   - APPLINK / CCLLINK / MPAGES_EVENT logging no-ops
 *   - window.external.DiscernObjectFactory returning a promise-based proxy
 * Replies follow the Clinical Office entry-script envelope closely enough
 * for the shipped dist builds to boot and narrate themselves in their logs.
 */
(function () {
  "use strict";

  var chart = {
    personId: 12724066,
    encntrId: 97953477,
    prsnlId: 4122622,
    nameFullFormatted: "MOUSE, MICKEY BOB",
    nameFirst: "MICKEY",
    nameLast: "MOUSE",
    birthDtTm: "1980-01-01T08:00:00.000+00:00",
    gender: "Male",
  };

  function log() {
    var args = ["[mock-powerchart]"];
    for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
    try { console.info.apply(console, args); } catch (e) { /* ignore */ }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function buildDomainReply(payload, instanceId) {
    var reply = {
      runStats: {
        id: instanceId || 0,
        startTime: nowIso(),
        endTime: nowIso(),
        status: "Mock PowerChart bridge",
        hexMode: 0,
        debugFile: "",
        referenceInd: 0,
        domain: "MOCKDEV",
        node: "mock",
        prsnlId: chart.prsnlId,
        prsnlName: "Cerner Test, Physician",
        physicianInd: 1,
        positionCd: 441,
        position: "Physician",
        username: "mocktest",
        customTables: [],
      },
      chartId: {
        personId: chart.personId,
        encntrId: chart.encntrId,
        nameFullFormatted: chart.nameFullFormatted,
        prsnlId: chart.prsnlId,
        prsnlName: "Cerner Test, Physician",
        physicianInd: 1,
        positionCd: 441,
        position: "Physician",
        domain: "MOCKDEV",
      },
      errors: [],
    };

    payload = payload || {};

    if (payload.person) {
      reply.persons = [
        {
          personId: chart.personId,
          nameFullFormatted: chart.nameFullFormatted,
          nameFirst: chart.nameFirst,
          nameLast: chart.nameLast,
          birthDtTm: chart.birthDtTm,
          age: "46 Years",
          gender: chart.gender,
          genderCd: 272,
          language: "English",
          religion: "Unknown",
          maritalType: "Single",
          deceased: "No",
          aliases: [
            { alias: "9876543210", aliasPool: "BC PHN", aliasType: "PHN" },
            { alias: "700001234", aliasPool: "MOCKDEV MRN", aliasType: "MRN" },
          ],
          names: [
            {
              nameType: "PREFERRED",
              nameTypeMeaning: "PREFERRED",
              nameFirst: chart.nameFirst,
              nameLast: chart.nameLast,
              nameFullFormatted: chart.nameFullFormatted,
            },
          ],
          personInfo: [],
          prsnlReltn: [],
          personReltn: [
            {
              personReltnType: "Emergency Contact",
              personReltnTypeMeaning: "EMERGENCY",
              nameFullFormatted: "MOUSE, MINNIE",
              personReltn: "Spouse",
              relatedPersonId: 999001,
              internalSeq: 1,
              prioritySeq: 1,
            },
          ],
          personPlanReltn: [],
          personCodeReltn: [],
          orgReltn: [],
        },
      ];
    }
    if (payload.encounter) {
      reply.encounters = [
        {
          encntrId: chart.encntrId,
          personId: chart.personId,
          encntrType: "Outpatient",
          encntrTypeCd: 309308,
          location: "Mock Demo Clinic",
          nurseUnit: "Clinic",
          room: "1",
          bed: "A",
          regDtTm: nowIso(),
          aliases: [{ alias: "FIN-0001234", aliasType: "FIN NBR" }],
          encounterInfo: [],
          personReltn: [],
          prsnlReltn: [
            {
              reltnType: "Attending Physician",
              reltnTypeMeaning: "ATTENDDOC",
              personReltnType: "Attending Physician",
              nameFullFormatted: "Cerner Test, Physician",
            },
          ],
          locHist: [],
        },
      ];
    }
    if (payload.prsnl) {
      reply.prsnl = [
        {
          personId: chart.prsnlId,
          nameFullFormatted: "Cerner Test, Physician",
          position: "Physician",
          positionCd: 441,
          physicianInd: 1,
          username: "mocktest",
          aliases: [],
        },
      ];
    }
    if (payload.address) {
      reply.address = [
        {
          addressId: 1,
          parentEntityId: chart.personId,
          parentEntityName: "PERSON",
          streetAddr: "123 Demo Street",
          streetAddr2: "",
          city: "Prince George",
          state: "BC",
          zipCode: "V2L 1A1",
          country: "Canada",
          addressType: "HOME",
          addressTypeMeaning: "HOME",
        },
      ];
    }
    if (payload.phone) {
      reply.phone = [
        {
          phoneId: 1,
          parentEntityId: chart.personId,
          parentEntityName: "PERSON",
          phoneNumber: "2505550100",
          phoneFormatted: "(250) 555-0100",
          phoneType: "HOME",
          phoneTypeMeaning: "HOME",
          extension: "",
        },
      ];
    }
    if (payload.allergy) reply.allergies = [];
    if (payload.problem) reply.problem = [];
    if (payload.diagnosis) reply.diagnosis = [];
    if (payload.codeValue) reply.codeValues = [];
    if (payload.organization) reply.organizations = [];
    if (payload.reference) reply.refCodeSet = [];

    if (payload.customScript && payload.customScript.script) {
      var pre = [];
      var post = [];
      for (var s = 0; s < payload.customScript.script.length; s++) {
        var script = payload.customScript.script[s];
        log("customScript " + (script.run || "pre") + " -> " + script.name, script.parameters || {});
        var result = { id: script.id || "unnamed", data: buildCustomScriptData(script) };
        if ((script.run || "pre").toLowerCase() === "post") post.push(result);
        else pre.push(result);
      }
      if (pre.length) reply.customPre = pre;
      if (post.length) reply.customPost = post;
    }

    return reply;
  }

  function futureOrderChild(orderId, mnemonic, details, location, dueFlag) {
    var rowClass = dueFlag === 2 ? "orderOverdue" : dueFlag === 1 ? "orderDue" : "orderUpcoming";
    return {
      expanded: "",
      data: {
        orderId: orderId,
        catalogCd: 0,
        templateOrderId: 0,
        protocolOrderId: 0,
        orderMnemonic: mnemonic,
        origOrderDate: "2026-08-05T00:30:16.000+00:00",
        origOrderDateVc: "05-AUG-2026",
        requestedStartDate: "2026-09-04T00:30:00.000+00:00",
        requestedStartDateVc: "04-SEP-2026",
        orderingProvider: "CERNER TEST, PHYSICIAN",
        orderDetails: details,
        orderingLocation: location,
        specimenType: "Blood",
        origSpecType: "Blood",
        collectionPriority: "Routine",
        gracePeriod: "04-SEP-2026 - 11-SEP-2026",
        catalogType: "Laboratory",
        orderComment: "",
        orderCommentInd: 0,
        nurseCollectInd: 0,
        note: { labRequisition: "", ind: 0, marker: "" },
        powerplan: {
          description: "", ind: 0, dotInd: 0, dotEarliestDtTm: "",
          pathwayId: 0, pathwayGroupId: 0, pwGroupNbr: 0, pwCatGroupId: 0,
        },
        hoverInd: 1,
        hoverInfo: "<u>Comment:</u> Mock order generated by the PowerChart simulator",
        lookbackMonth: 1,
        lookforwardMonth: 1,
        months: 1,
        typicalLab: "true",
        typicalLab2: "true",
        hiddenData: {
          dueStatusFlag: dueFlag, rowClass: rowClass,
          needLabCollection: 0, needDateUpdate: 0, specimenTypeCd: 0,
        },
      },
    };
  }

  function futureOrderParent(children) {
    return {
      expanded: "",
      children: children,
      data: {
        orderId: 0,
        requestedStartDate: children[0].data.requestedStartDate,
        requestedStartDateVc: children[0].data.requestedStartDateVc,
        orderingProvider: children[0].data.orderingProvider,
        lookback: 1,
        lookforward: 1,
        note: { labRequisition: "", ind: 0, marker: "" },
        powerplan: { description: "", ind: 0, dotInd: 0 },
        hiddenData: {
          dueStatusFlag: children[0].data.hiddenData.dueStatusFlag,
          rowClass: children[0].data.hiddenData.rowClass,
          needLabCollection: 0,
          needDateUpdate: 0,
        },
        typicalLab: "true",
      },
    };
  }

  function buildCustomScriptData(script) {
    var name = String(script.name || "").toLowerCase();
    if (name.indexOf("future_ord") !== -1) {
      var groupA = futureOrderParent([
        futureOrderChild(789269261, "CBC and Differential",
          "Blood, Routine, Collection: 04-Sep-2026, once, Order for future visit",
          "Mock Demo Clinic", 1),
        futureOrderChild(789269262, "Hemoglobin A1C",
          "Blood, Routine, Collection: 04-Sep-2026, once, Order for future visit",
          "Mock Demo Clinic", 1),
      ]);
      var groupB = futureOrderParent([
        futureOrderChild(789269263, "Electrolytes Panel",
          "Blood, Routine, Collection: 11-Sep-2026, once, Order for future visit",
          "Mock Lab Northside", 2),
      ]);
      groupB.data.requestedStartDateVc = "11-SEP-2026";
      return {
        lastrefesh: nowIso(),
        counts: { lab: 3, cardiology: 0, radiology: 0, all: 3 },
        orderCnt: 3,
        providerList: [{ label: "CERNER TEST, PHYSICIAN", value: "CERNER TEST, PHYSICIAN" }],
        ordLocationList: [
          { label: "Mock Demo Clinic", value: "Mock Demo Clinic" },
          { label: "Mock Lab Northside", value: "Mock Lab Northside" },
        ],
        activateButtonInd: "true",
        supportToolInd: "true",
        liveInd: "true",
        supportMessage: "",
        orderList: [groupA, groupB],
      };
    }
    if (name.indexOf("mpage_setup") !== -1) {
      return {
        components: [
          {
            inBedrockId: 1,
            mappedId: 1,
            label: "webforms-player",
            path: "custom_mpage_content/webforms-player",
            mappingStatus: "Mapping Completed.",
          },
          {
            inBedrockId: 2,
            mappedId: 0,
            label: "mock-unmapped-component",
            path: "",
            mappingStatus: "Not Mapped.",
          },
        ],
        managerUrl: "http://localhost:5209/cerner-examples/manager",
        contentServiceUrl: "http://localhost:5209/cerner-examples/",
        serviceHost: "localhost",
        serviceDirectory: "http://localhost:5209/cclproxy",
        domain: "MOCKDEV",
        host: "localhost",
      };
    }
    if (name.indexOf("dm_info") !== -1) {
      return { data: [] };
    }
    return {};
  }

  function parseInstanceId(parameterString) {
    try {
      var parts = String(parameterString || "").split(",");
      return parseInt(parts[4], 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function MockCclRequest() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = "";
    this.onreadystatechange = null;
    this._blob = "";
    this._script = "";
  }
  MockCclRequest.prototype.open = function (method, script) {
    this._script = script;
    this.readyState = 1;
  };
  MockCclRequest.prototype.setRequestHeader = function () {};
  MockCclRequest.prototype.setBlobIn = function (blob) {
    this._blob = blob;
  };
  MockCclRequest.prototype.send = function (parameterString) {
    var self = this;
    var substituted = String(parameterString || "")
      .replace("$PAT_PersonId$", String(chart.personId))
      .replace("$VIS_EncntrId$", String(chart.encntrId))
      .replace("$USR_PersonId$", String(chart.prsnlId));
    log("XMLCclRequest " + this._script + " send " + substituted);
    var payload = null;
    try {
      var parsed = JSON.parse(this._blob || "{}");
      payload = parsed.payload || parsed;
    } catch (e) {
      log("blobIn was not JSON", this._blob);
    }
    var reply = buildDomainReply(payload, parseInstanceId(substituted));
    setTimeout(function () {
      self.status = 200;
      self.responseText = JSON.stringify(reply);
      self.readyState = 4;
      if (typeof self.onreadystatechange === "function") self.onreadystatechange();
    }, 150);
  };

  function makeDiscernObject(name) {
    var handler = {
      get: function (_target, prop) {
        if (prop === "then") return undefined;
        return function () {
          log("DiscernObjectFactory(" + name + ")." + String(prop), Array.prototype.slice.call(arguments));
          return Promise.resolve(1);
        };
      },
    };
    return new Proxy({}, handler);
  }

  var external = window.external || {};
  try {
    external.XMLCclRequest = function () { return new MockCclRequest(); };
    external.DiscernObjectFactory = function (name) {
      log("DiscernObjectFactory(" + name + ") requested");
      return Promise.resolve(makeDiscernObject(name));
    };
  } catch (e) { /* host object refused */ }
  try {
    Object.defineProperty(window, "external", { value: external, configurable: true });
  } catch (e) {
    try { window.external = external; } catch (e2) { /* ignore */ }
  }

  window.XMLCclRequest = function () { return new MockCclRequest(); };
  window.APPLINK = function () { log("APPLINK", Array.prototype.slice.call(arguments)); };
  window.CCLLINK = function () { log("CCLLINK", Array.prototype.slice.call(arguments)); };
  window.MPAGES_EVENT = function () { log("MPAGES_EVENT", Array.prototype.slice.call(arguments)); };
  window.MPAGES_SVC_EVENT = function () { log("MPAGES_SVC_EVENT", Array.prototype.slice.call(arguments)); };

  log("bridge installed (chart: " + chart.nameFullFormatted + ")");
})();
