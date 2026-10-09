import { describe, expect, it } from "vitest";

import contract from "./__fixtures__/co5-setup-app.contract.json";
import {
  CCL_ZERO_DATE,
  createSimXmlCclRequest,
  createStandardSimulator,
  handleDiscernWebRequest,
  parsePromptLine,
  splitProgramInvocation,
  stableNumericId,
  type SimPatientInput,
} from "./index";

const ROSTER: SimPatientInput[] = [
  {
    chart: "70010045", encounter: "NH-2026-004512", first: "HLS-NHGH-LTC", middle: "", last: "ZZZTEST", dob: "1948.03.11", gender: "F",
    location: "NHGH 3E / 312 / A", provider: "Nadeau, Claire MD", allergies: "Penicillins, Sulfa", encounterType: "Inpatient",
    bchn: "9011 234 567", home: "250-555-0142", address: "1450 Edmonton St", city: "Prince George", province: "BC", postal: "V2M 6W5", registered: "2026.09.02",
  },
  {
    chart: "70010046", encounter: "NH-2026-004537", first: "AMBULATORY", middle: "J", last: "ZZZTEST", dob: "1979.11.24", gender: "M",
    location: "NHGH Ambulatory Clinic", provider: "Okafor, Daniel MD", allergies: "No Known Allergies", encounterType: "Ambulatory",
    bchn: "9011 234 568", registered: "2026.09.08",
  },
];

const PERSON = 70010045;
const ENCNTR = stableNumericId("NH-2026-004512", "encounter:");
const NOW = new Date("2026-10-09T12:00:00.000Z");

function sim() {
  return createStandardSimulator({ roster: ROSTER, now: () => NOW });
}

const CHART_CONFIG = '^{"mode":"CHART","hexMode":false}^';
function entry(s: ReturnType<typeof sim>, payload: unknown, params = `^MINE^,${PERSON},${ENCNTR},0,7,${CHART_CONFIG}`) {
  const reply = s.execute({ program: "1co5_mpage_entry:group1", params, blobIn: JSON.stringify(payload), transport: "powerchart" });
  return { ...reply, json: JSON.parse(reply.body) as Record<string, any> };
}

/** Resolve a contract path like `customPre[id=config].data.components[].label`. */
function resolve(root: unknown, path: string): unknown[] {
  let current: unknown[] = [root];
  for (const segment of path.split(".")) {
    const match = /^(\w+)(?:\[(.*)\])?$/.exec(segment)!;
    const [, key, selector] = match;
    const next: unknown[] = [];
    for (const value of current) {
      const child = (value as Record<string, unknown> | undefined)?.[key];
      if (selector === undefined) next.push(child);
      else if (selector === "") next.push(...((child as unknown[]) ?? []));
      else {
        const [field, wanted] = selector.split("=");
        next.push(...((child as Record<string, unknown>[]) ?? []).filter((item) => String(item[field]) === wanted));
      }
    }
    current = next;
  }
  return current;
}

function check(value: unknown, rule: unknown): boolean {
  if (rule === "array") return Array.isArray(value);
  if (rule === "array-empty") return Array.isArray(value) && value.length === 0;
  if (rule === "empty-string") return value === "";
  if (rule === "string") return typeof value === "string";
  if (rule === "number") return typeof value === "number";
  if (rule === "positive") return typeof value === "number" && value > 0;
  if (typeof rule === "string" && rule.startsWith("ends-with:")) return typeof value === "string" && value.endsWith(rule.slice(10));
  return value === rule;
}

describe("prompt parsing", () => {
  it("splits caret, quote and bare values without breaking JSON config", () => {
    expect(parsePromptLine('^MINE^,0,0,false,1,^{"mode":"ORGANIZER","hexMode":false}^')).toEqual([
      "MINE", 0, 0, 0, 1, '{"mode":"ORGANIZER","hexMode":false}',
    ]);
    expect(parsePromptLine("'MINE',12.00,'abc'")).toEqual(["MINE", 12, "abc"]);
    expect(parsePromptLine("MINE")).toEqual(["MINE"]);
  });

  it("separates a program name from its prompt arguments", () => {
    expect(splitProgramInvocation('1co5_get_patient_list:group1 "5000001"')).toEqual({ program: "1co5_get_patient_list:group1", prompts: ["5000001"] });
  });

  it("substitutes PowerChart context tokens only on the PowerChart transport", () => {
    const s = sim();
    s.execute({ program: "wf_demo_echo_ids", params: "^MINE^,$PAT_PersonId$,$VIS_EncntrId$", blobIn: null, transport: "powerchart", context: { personId: PERSON, encntrId: ENCNTR } });
    expect(s.log.at(-1)!.prompts).toEqual(["MINE", PERSON, ENCNTR]);
    s.execute({ program: "wf_demo_echo_ids", params: "^MINE^,$PAT_PersonId$", blobIn: null, transport: "web" });
    expect(s.log.at(-1)!.prompts).toEqual(["MINE", "$PAT_PersonId$"]);
  });
});

describe("Clinical Office v5 entry", () => {
  it("always returns runStats, chartId and errors, with the chart name only in CHART mode", () => {
    const s = sim();
    const chart = entry(s, { payload: { patientSource: [{ personId: 0, encntrId: 0 }] } }).json;
    expect(Object.keys(chart).slice(0, 3)).toEqual(["runStats", "chartId", "errors"]);
    expect(chart.runStats).toMatchObject({ id: 7, debugFile: "", referenceInd: 0, hexMode: 0, prsnlId: 4122622, domain: "WFSIM" });
    expect(chart.chartId).toEqual({ personId: PERSON, encntrId: ENCNTR, nameFullFormatted: "ZZZTEST, HLS-NHGH-LTC" });
    const organizer = entry(s, { payload: {} }, '^MINE^,0,0,0,1,^{"mode":"ORGANIZER","hexMode":false}^').json;
    expect(organizer.chartId).toEqual({ personId: 0, encntrId: 0, nameFullFormatted: "" });
  });

  it("flags an invalid payload the way production does", () => {
    const s = sim();
    const reply = s.execute({ program: "1co5_mpage_entry:group1", params: `^MINE^,0,0,0,1,${CHART_CONFIG}`, blobIn: '{"nope":{}}', transport: "powerchart" });
    expect(JSON.parse(reply.body).runStats.status).toBe("ERROR: Invalid Payload");
  });

  it("returns persons and encounters with aliases by meaning, honouring typeList", () => {
    const s = sim();
    const reply = entry(s, { payload: { patientSource: [{ personId: 0, encntrId: 0 }], person: { aliases: true }, encounter: { aliases: true, prsnlReltn: true } } }).json;
    const person = reply.persons[0];
    expect(person).toMatchObject({ personId: PERSON, nameFullFormatted: "ZZZTEST, HLS-NHGH-LTC", sex: "Female", age: "78 Years" });
    expect(person.aliases.map((a: any) => a.aliasTypeMeaning).sort()).toEqual(["MRN", "PHN"]);
    expect(person.aliases.find((a: any) => a.aliasTypeMeaning === "PHN")).toMatchObject({ aliasFormatted: "9011 234 567", healthCardProvince: "BC" });
    const encounter = reply.encounters[0];
    expect(encounter).toMatchObject({ encntrId: ENCNTR, locNurseUnit: "3E", locRoom: "312", locBed: "A" });
    expect(encounter.locNurseUnitCd).toBeGreaterThan(0);
    expect(encounter.dischDtTm).toBe(CCL_ZERO_DATE);
    expect(encounter.aliases[0]).toMatchObject({ aliasTypeMeaning: "FIN NBR", alias: "NH-2026-004512" });
    expect(encounter.prsnlReltn[0]).toMatchObject({ reltnTypeMeaning: "ATTENDDOC", nameFullFormatted: "NADEAU, CLAIRE MD" });
    const onlyMrn = entry(s, { payload: { person: { aliases: true }, typeList: [{ codeSet: 4, type: "MRN", typeCd: 0 }] } }).json;
    expect(onlyMrn.persons[0].aliases.map((a: any) => a.aliasTypeMeaning)).toEqual(["MRN"]);
  });

  it("returns allergies (omitted when there are none), diagnoses and problems", () => {
    const s = sim();
    const reply = entry(s, { payload: { allergy: { reactions: true }, diagnosis: {}, problem: {} } }).json;
    expect(reply.allergies.map((a: any) => a.substance)).toEqual(["Penicillins", "Sulfa"]);
    expect(reply.allergies[0]).toMatchObject({ severity: "Moderate", reactionClass: "Allergy", substanceTypeMeaning: "DRUG", reactionStatus: "Active" });
    expect(reply.allergies[0].reaction[0].reaction).toBe("Rash");
    expect(reply.diagnosis[0]).toMatchObject({ diagnosisDisplay: "Community acquired pneumonia", diagType: "Working" });
    expect(reply.problem[0].annotatedDisplay).toBe("Essential hypertension");
    const amb = entry(s, { payload: { allergy: {} } }, `^MINE^,70010046,0,0,1,${CHART_CONFIG}`).json;
    expect(amb).not.toHaveProperty("allergies");
  });

  it("splices address/phone/organization as singular flat lists", () => {
    const s = sim();
    const reply = entry(s, { payload: { address: true, phone: true } }).json;
    expect(reply.apoExecuted).toBe(1);
    expect(reply.address[0]).toMatchObject({ parentEntityName: "PERSON", addressTypeMeaning: "HOME", city: "Prince George" });
    expect(reply.phone[0]).toMatchObject({ phoneFormatted: "(250) 555-0142" });
    expect(reply.organization).toEqual([]);
  });

  it("only honours a top-level clearPatientSource, and says so", () => {
    const s = sim();
    const inside = entry(s, { payload: { person: {}, customScript: { script: [], clearPatientSource: true } } });
    expect(inside.json.persons).toHaveLength(1);
    expect(inside.notices.some((n) => n.code === "co5.clear-patient-source-placement")).toBe(true);
    const top = entry(s, { payload: { person: {}, clearPatientSource: true } }).json;
    expect(top).not.toHaveProperty("persons");
  });

  it("finds a patient by MRN through enc_search + enc_search_data", () => {
    const s = sim();
    const reply = entry(s, {
      payload: {
        clearPatientSource: true,
        customScript: { script: [
          { name: "1co5_enc_search:group1", run: "pre", id: "search", parameters: { personAlias: [{ alias: "70010046", cdfMeaning: "MRN" }] } },
          { name: "1co5_enc_search_data:group1", run: "post", id: "data", parameters: {} },
        ] },
      },
    }).json;
    expect(reply.customPre[0]).toEqual({ id: "search", data: { status: { type: "person", message: "", code: 0 } } });
    expect(reply.customPost[0].data.person[0]).toMatchObject({ name: "ZZZTEST, AMBULATORY J", mrn: "70010046", age: "46 Years" });
  });

  it("loads the census and turns it into the patient source", () => {
    const s = sim();
    const reply = entry(s, { payload: { clearPatientSource: true, customScript: { script: [{ name: "1co5_mpage_census_list:group1", run: "pre", id: "census" }] }, person: {} } }, '^MINE^,0,0,0,1,^{"mode":"ORGANIZER","hexMode":false}^').json;
    expect(reply.customPre[0].data.visits).toEqual([{ personId: PERSON, encntrId: ENCNTR }]);
    expect(reply.persons.map((p: any) => p.personId)).toEqual([PERSON]);
  });

  it("round-trips a document through write_document and load_document", () => {
    const s = sim();
    const written = entry(s, { payload: { customScript: { script: [{ name: "1co5_write_document:group1", run: "pre", id: "w", parameters: { eventKey: "WEBFORMSDOCUMENT", title: "Braden", document: "Score 18\\nLow risk", noteFormat: "AS" } }] } } }).json;
    const parentEventId = written.customPre[0].data.parentEventId;
    expect(parentEventId).toBeGreaterThan(0);
    const loaded = entry(s, { payload: { customScript: { script: [{ name: "1co5_load_document:group1", run: "pre", id: "l", parameters: { parentEventId } }] } } }).json;
    const doc = loaded.customPre[0].data.document[0];
    const html = doc.docContent.match(/../g).map((h: string) => String.fromCharCode(parseInt(h, 16))).join("");
    expect(html).toContain("Score 18\nLow risk");
    const bad = entry(s, { payload: { customScript: { script: [{ name: "1co5_write_document:group1", run: "pre", id: "w", parameters: { eventKey: "NOPE", title: "x", document: "y", noteFormat: "AS" } }] } } }).json;
    expect(bad.customPre[0].data).toEqual({ status: "Invalid Event Key", statusValue: "NOPE", parentEventId: 0 });
  });

  it("reports an unknown custom script as an error instead of running it", () => {
    const reply = entry(sim(), { payload: { customScript: { script: [{ name: "rm_rf_everything:group1", run: "pre", id: "x" }] } } }).json;
    expect(reply.errors[0].message).toMatch(/not found/);
    expect(reply.customPre).toEqual([]);
  });
});

describe("Clinical Office setup app contract", () => {
  it("satisfies every field the setup app reads, in its call order", () => {
    const s = sim();
    for (const call of contract.calls) {
      const reply = s.execute({ program: call.program, params: call.params, blobIn: JSON.stringify(call.blob), transport: "powerchart" });
      expect(reply.status, call.name).toBe(200);
      const json = JSON.parse(reply.body);
      for (const [path, rule] of Object.entries(call.requires)) {
        const values = resolve(json, path);
        expect(values.length, `${call.name}: ${path} is missing`).toBeGreaterThan(0);
        for (const value of values) expect(check(value, rule), `${call.name}: ${path} = ${JSON.stringify(value)} fails ${String(rule)}`).toBe(true);
      }
    }
    const init = JSON.parse(s.execute({ program: contract.calls[1].program, params: contract.calls[1].params, blobIn: JSON.stringify(contract.calls[1].blob), transport: "powerchart" }).body);
    const host = init.customPre[0].data.host;
    const url = contract.http[0].urlTemplate.replace("{serviceDirectoryUrl}", host.serviceDirectoryUrl).replace("{fullCanonicalDomainName}", host.fullCanonicalDomainName);
    const directory = handleDiscernWebRequest(s, { method: "GET", url }, "http://localhost:3000")!;
    for (const [path, rule] of Object.entries(contract.http[0].requires)) expect(check(JSON.parse(directory.body)[path], rule)).toBe(true);
  });
});

describe("Discern Web Services path", () => {
  it("accepts the unencoded Clinical Office POST and answers in hex", () => {
    const s = sim();
    const blob = JSON.stringify({ payload: { patientSource: [{ personId: 0.0, encntrId: 0.0 }] } });
    /* The client's own hex: toString(16) per char, unpadded — fine for printable ASCII. */
    const hex = [...blob].map((c) => c.charCodeAt(0).toString(16)).join("");
    const response = handleDiscernWebRequest(s, {
      method: "POST",
      url: "http://localhost:3000/cclproxy/1co5_mpage_entry:group1",
      body: `parameters=^MINE^,0,0,false,0,^{"mode":"ORGANIZER","hexMode":true}^&blobIn=${hex}`,
    }, "http://localhost:3000")!;
    expect(response.body).toMatch(/^[0-9A-F]+$/);
    const decoded = response.body.match(/../g)!.map((h) => String.fromCharCode(parseInt(h, 16))).join("");
    expect(JSON.parse(decoded).runStats.hexMode).toBe(1);
  });

  it("does not substitute context tokens over the web", () => {
    const s = sim();
    const response = handleDiscernWebRequest(s, { method: "GET", url: "http://h/discern/wfsim/mpages/reports/wf_demo_demographics?parameters=%5EMINE%5E,$PAT_PersonId$" }, "http://h")!;
    expect(JSON.parse(response.body).DEMOGRAPHICS.STATUS).toBe("Z");
  });

  it("answers a missing program with the PDF error report", () => {
    const reply = sim().execute({ program: "no_such_prg", params: "", blobIn: null, transport: "powerchart" });
    expect(reply.status).toBe(200);
    expect(reply.body.startsWith("%PDF")).toBe(true);
  });
});

describe("nh_wf_entry", () => {
  const call = (s: ReturnType<typeof sim>, payload: unknown) =>
    JSON.parse(s.execute({ program: "nh_wf_entry:group1", params: `^MINE^,${PERSON},${ENCNTR},0,1,${CHART_CONFIG}`, blobIn: JSON.stringify(payload), transport: "powerchart" }).body);

  it("refuses scripts outside the whitelist and stores forms in chunks", () => {
    const s = sim();
    expect(call(s, { payload: { customScript: { script: [{ name: "1co5_ping:group1", run: "pre", id: "p" }] } } }).errors[0]).toEqual({ code: 400, message: "Script not whitelisted: 1co5_ping:group1" });
    const big = "x".repeat(70000);
    call(s, { payload: { customScript: { script: [{ name: "nh_wf_form_store:group1", run: "pre", id: "w", parameters: { action: "w", data: [{ refName: "FORM", refTask: "draft", refText: big }] } }] } } });
    expect(s.db.tables.refData.filter((row) => row.refName === "FORM")).toHaveLength(3);
    const read = call(s, { payload: { customScript: { script: [{ name: "nh_wf_form_store:group1", run: "pre", id: "r", parameters: { action: "r", data: [{ refName: "FORM", refTask: "draft" }] } }] } } });
    expect(read.customPre[0].data.rows[0].refText).toHaveLength(70000);
  });

  it("denies a patient source that is not the encounter's person", () => {
    const reply = call(sim(), { payload: { patientSource: [{ personId: 70010046, encntrId: ENCNTR }], person: {} } });
    expect(reply.errors[0].code).toBe(403);
  });
});

describe("XMLCclRequest transport", () => {
  it("completes asynchronously and calls a handler attached after send()", async () => {
    const s = sim();
    const Request = createSimXmlCclRequest(s, { context: () => ({ personId: PERSON, encntrId: ENCNTR }) });
    const request = new Request();
    request.open("GET", "wf_demo_demographics");
    request.send("^MINE^,$PAT_PersonId$,$VIS_EncntrId$");
    const done = new Promise<void>((resolveDone) => { request.onreadystatechange = () => resolveDone(); });
    expect(request.readyState).toBe(2);
    await done;
    expect(request.status).toBe(200);
    const data = JSON.parse(request.responseText).DEMOGRAPHICS;
    expect(data).toMatchObject({ NAME_FULL_FORMATTED: "ZZZTEST, HLS-NHGH-LTC", MRN: "70010045", PHN: "9011 234 567" });
    expect(data.BIRTH_DT_TM).toBe("/Date(1948-03-11T08:00:00.000+00:00)/");
    expect(data.ENCOUNTER.FIN).toBe("NH-2026-004512");
  });

  it("completes synchronously for legacy pages, with a warning", () => {
    const warnings: string[] = [];
    const Request = createSimXmlCclRequest(sim(), { context: () => ({ personId: PERSON, encntrId: ENCNTR }), warn: (m) => warnings.push(m) });
    const request = new Request();
    request.open("GET", "wf_demo_echo_ids", false);
    request.send("^MINE^,1,2");
    expect(request.readyState).toBe(4);
    expect(JSON.parse(request.responseText).ECHO.PERSON_ID).toBe(1);
    expect(warnings[0]).toMatch(/synchronous/);
  });
});
