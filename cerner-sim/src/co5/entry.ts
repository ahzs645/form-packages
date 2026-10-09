import { camelJson, cclDate, hexRaw, looksHex, rawHex } from "../ccl/json";
import { programKey, promptNumber, splitProgramInvocation } from "../ccl/params";
import type { CclProgramInfo, CclRunContext } from "../ccl/types";
import { CO5_CUSTOM_SCRIPTS, componentLookup, COMPONENT_DOMAIN } from "./custom";
import { allergyDomain, apoDomain, codeValueDomain, diagnosisDomain, encounterDomain, personDomain, prsnlDomain, problemDomain } from "./domains";
import { addPatient, flag, list, num, pick, present, str, type EntryState, type Json } from "./support";

/**
 * Clean-room `1co5_mpage_entry`: the dispatcher every Clinical Office v5
 * MPage calls. Prompt slots: OUTDEV, PERSON_ID, ENCNTR_ID, DEBUG_IND, ID,
 * CONFIG (a JSON fragment). The request blob is `{"payload":{…}}`, hex when
 * config.hexMode. Behaviour per SPEC.md §2; deliberate differences from
 * production are listed in QUIRKS.md and raised as inspector notices.
 */
export function co5Entry(ctx: CclRunContext) {
  const [, personPrompt, encntrPrompt, debugPrompt, idPrompt, configPrompt] = ctx.prompts;
  const db = ctx.db;
  let config: Json = {};
  if (typeof configPrompt === "string" && configPrompt.trim()) {
    try { config = JSON.parse(configPrompt) as Json; } catch { ctx.notice({ kind: "warning", message: `CONFIG prompt is not valid JSON: ${configPrompt}` }); }
  }
  const hexMode = flag(config, "hexMode");
  const mode = str(pick(config, "mode")).toUpperCase();
  const debug = promptNumber(debugPrompt) === 1;
  const startTime = ctx.now;

  const user = db.tables.prsnl.find((row) => row.personId === ctx.session.prsnlId);
  const runStats: Json = {
    id: promptNumber(idPrompt), startTime: cclDate(startTime), endTime: "", status: "", hexMode: hexMode ? 1 : 0, debugFile: "", referenceInd: 0,
    domain: ctx.session.domain, node: ctx.session.node, prsnlId: ctx.session.prsnlId, prsnlName: user?.nameFullFormatted ?? "",
    physicianInd: user?.physicianInd ?? 0, positionCd: user?.positionCd ?? 0, position: db.display(user?.positionCd ?? 0), username: user?.username ?? "",
    customTables: ["cust_co_reference"],
  };
  const chartId: Json = { personId: 0, encntrId: 0, nameFullFormatted: "" };
  const finish = (state: EntryState | null, sections: [string, unknown][]) => {
    runStats.endTime = cclDate(ctx.now);
    const reply: Json = { runStats, chartId, errors: state?.errors ?? [] };
    for (const [key, value] of sections) reply[key] = value;
    const body = camelJson(reply);
    return { status: 200, body: hexMode ? rawHex(body) : body, contentType: "application/json" };
  };

  let blob = ctx.call.blobIn ?? "";
  if (hexMode && blob) blob = hexRaw(blob);
  else if (!hexMode && looksHex(blob)) {
    ctx.notice({ kind: "warning", message: "The blob looks hex-encoded but config.hexMode is off; production would fail to parse it." });
  }
  let parsed: Json | null = null;
  try { parsed = blob ? (JSON.parse(blob) as Json) : null; } catch { parsed = null; }
  const payload = parsed ? pick(parsed, "payload") : undefined;
  if (debug) {
    runStats.debugFile = `1co_debug_${ctx.session.prsnlId}.json`;
    ctx.notice({ kind: "info", message: `Debug indicator set: production writes the request to ${runStats.debugFile} on ${ctx.session.node} and runs nothing else.` });
  }
  if (!payload || typeof payload !== "object") {
    runStats.status = "ERROR: Invalid Payload";
    return finish(null, []);
  }

  chartId.personId = promptNumber(personPrompt);
  chartId.encntrId = promptNumber(encntrPrompt);
  const state: EntryState = {
    payload: payload as Json, mode: mode === "CHART" ? "CHART" : mode === "ORGANIZER" ? "ORGANIZER" : "",
    visits: [], patients: [], prsnlSource: [], parents: [], refCodeSet: [], reference: false, errors: [], notices: [], scriptIndex: 0,
  };

  if (state.mode === "CHART" && num(chartId.encntrId) === 0) {
    const test = db.tables.dmInfo.find((row) => row.infoDomain === "CLINICAL OFFICE" && row.infoName === "DEVELOPER TEST VISIT" && row.infoDomainId === ctx.session.prsnlId);
    const enc = test ? db.tables.encounters.find((row) => row.encntrId === test.infoNumber) : undefined;
    const person = enc ? db.tables.persons.find((row) => row.personId === enc.personId) : undefined;
    if (enc && person) {
      chartId.personId = person.personId;
      chartId.encntrId = enc.encntrId;
      runStats.status = `Chart Level MPage with no encounter. Using testing value from dm_info: ${person.nameFullFormatted} (ENCNTR_ID: ${enc.encntrId})`;
    }
  }
  if (state.mode === "CHART") {
    chartId.nameFullFormatted = db.tables.persons.find((row) => row.personId === num(chartId.personId))?.nameFullFormatted ?? "";
  }
  if (present(payload, "reference")) {
    state.reference = flag(payload, "reference");
    runStats.referenceInd = state.reference ? 1 : 0;
  }

  /* patientSource: drop 0/0 rows, resolve persons from encounters, sort by person then encounter. */
  const source = list(pick(payload, "patientSource"));
  if (present(payload, "patientSource")) {
    const resolved: { personId: number; encntrId: number }[] = [];
    let dropped = 0;
    for (const row of source) {
      const personId = num(pick(row, "personId"));
      const encntrId = num(pick(row, "encntrId"));
      if (!personId && !encntrId) { dropped++; continue; }
      const enc = encntrId ? db.tables.encounters.find((e) => e.encntrId === encntrId) : undefined;
      if (encntrId && !enc) { dropped++; continue; }
      resolved.push({ personId: personId || enc?.personId || 0, encntrId });
    }
    resolved.sort((a, b) => a.personId - b.personId || a.encntrId - b.encntrId);
    for (const visit of resolved) { state.visits.push(visit); addPatient(state, visit.personId); }
    if (dropped && resolved.length) {
      ctx.notice({ kind: "quirk", code: "co5.patient-source-filler", message: `${dropped} patientSource row(s) were dropped; production leaves {0,0} filler visits at the end of the list for them. The simulator omits the filler.` });
    }
  }
  if (!state.visits.length) {
    state.visits.push({ personId: num(chartId.personId), encntrId: num(chartId.encntrId) });
    state.patients.push(num(chartId.personId));
  }

  const customScript = pick(payload, "customScript");
  const scripts = list(pick(customScript, "script"));
  if (!debug) {
    if (flag(payload, "clearPatientSource")) { state.visits = []; state.patients = []; }
    if (flag(customScript, "clearPatientSource")) {
      ctx.notice({ kind: "quirk", code: "co5.clear-patient-source-placement", message: "clearPatientSource is inside customScript. The production entry only reads the top-level flag, so the patient source was NOT cleared (the vendor docs show both placements)." });
    }
  }

  const sections: [string, unknown][] = [];
  const runCustom = (phase: "PRE" | "POST") => {
    const out: Json[] = [];
    scripts.forEach((script, index) => {
      if (str(pick(script, "run")).toUpperCase() !== phase) return;
      state.scriptIndex = index;
      const name = str(pick(script, "name"));
      const { program, prompts } = splitProgramInvocation(name);
      const handler = CO5_CUSTOM_SCRIPTS[programKey(program)];
      if (!handler) {
        state.errors.push({ code: 1, message: `%CCL-E-18-PRG_NOT_FOUND: program ${program} not found (simulator whitelist).` });
        ctx.notice({ kind: "warning", message: `Custom script ${program} is not implemented by the simulator. Production executes any name verbatim; the simulator only runs known scripts.` });
        return;
      }
      const data = handler(ctx, state, script, prompts);
      const id = str(pick(script, "id"));
      if (data !== undefined && id.trim()) out.push({ id, data });
    });
    return out;
  };

  if (!debug) {
    if (scripts.length || present(customScript, "script")) sections.push(["customPre", runCustom("PRE")]);
    const domain = (key: string, fn: () => Json | null) => {
      if (!present(payload, key)) return;
      const result = fn();
      if (result) for (const [name, value] of Object.entries(result)) sections.push([name, value]);
    };
    domain("codeValue", () => codeValueDomain(db, state));
    domain("encounter", () => encounterDomain(db, state, ctx.now));
    domain("person", () => personDomain(db, state, ctx.now));
    domain("prsnl", () => prsnlDomain(db, state));
    if (present(payload, "organization") || present(payload, "address") || present(payload, "phone")) {
      const result = apoDomain(db, state, ctx.now);
      if (result) for (const [name, value] of Object.entries(result)) sections.push([name, value]);
    }
    domain("allergy", () => allergyDomain(db, state, ctx.now));
    domain("diagnosis", () => diagnosisDomain(db, state, ctx.now));
    domain("problem", () => problemDomain(db, state, ctx.now));
    if (scripts.length || present(customScript, "script")) sections.push(["customPost", runCustom("POST")]);
    if (state.refCodeSet.length) sections.push(["refCodeSet", state.refCodeSet]);
  }
  for (const notice of state.notices) ctx.notice(notice);
  return finish(state, sections);
}

/** `1co5_mpage_redirect(outdev, path)`: a Discern Report tab's launcher. */
export function co5Redirect(ctx: CclRunContext) {
  const outdev = str(ctx.prompts[0]).toUpperCase();
  const original = str(ctx.prompts[1]);
  const db = ctx.db;
  let path = original;
  let component = "";
  let url = "";
  if (outdev === "EDGE-COMPONENT") {
    const row = db.tables.dmInfo.find((r) => r.infoDomain === COMPONENT_DOMAIN && r.infoName === original);
    if (row) {
      path = row.infoChar;
      component = /^https?:/i.test(path) ? path.replace(/\/+$/, "").split("/").pop() ?? "" : path;
    }
  }
  if (outdev !== "COMPONENT" && outdev !== "EDGE-COMPONENT" && !/\/index\.html/i.test(path)) path = `${path.replace(/\/+$/, "")}/index.html#/`;
  if (/^https?:/i.test(path)) url = path;
  const csu = db.contentServiceUrl();
  if (!url) url = `${csu}/custom_mpage_content/${path}`;
  if (outdev === "COMPONENT" || outdev === "EDGE-COMPONENT") {
    return { status: 200, contentType: "application/json", body: camelJson({ response: { url, component: outdev === "COMPONENT" ? "" : component } }) };
  }
  return {
    status: 200,
    contentType: "text/html",
    body: `<html><head><script>window.location.href=${JSON.stringify(url)};</script></head><body>Preparing Report Output</body></html>`,
  };
}

/** `1co5_mpage_component(headerTitle)`: where a Bedrock-labelled component's script lives. */
export function co5Component(ctx: CclRunContext) {
  return { status: 200, contentType: "application/json", body: camelJson({ response: componentLookup(ctx.db, str(ctx.prompts[0]), ctx.now) }) };
}

export const CO5_PROGRAMS: CclProgramInfo[] = [
  { name: "1co5_mpage_entry:group1", description: "Clinical Office v5 entry: payload dispatch to domain and custom scripts", program: co5Entry },
  { name: "1co5_mpage_redirect:group1", description: "Discern Report tab launcher: HTML redirect or component JSON", program: co5Redirect },
  { name: "1co5_mpage_component:group1", description: "Workflow component path lookup by Bedrock label", program: co5Component },
];
