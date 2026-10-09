import { CS } from "../db/seed";
import { END_OF_TIME, isCurrent } from "../db/db";
import { camelJson, cclDate, hexRaw, rawHex } from "../ccl/json";
import { programKey, promptNumber } from "../ccl/params";
import type { CclProgramInfo, CclRunContext } from "../ccl/types";
import { flag, list, num, pick, present, str, type Json } from "../co5/support";

/**
 * Our own `nh_wf_entry` (packages/cerner-ccl), simulated so the form player
 * and our templates can be exercised before the CCL is ever compiled. Same
 * prompts and envelope as the Clinical Office entry, plus the two things it
 * adds on purpose: a custom-script whitelist and person/encounter
 * entitlement checks. Reply fields follow the record definitions in
 * nh_wf_entry.prg (camel-cased by CNVTRECTOJSON).
 */

const WHITELIST = ["nh_wf_write_document", "nh_wf_form_store"];

export function nhEntry(ctx: CclRunContext) {
  const [, personPrompt, encntrPrompt, debugPrompt, idPrompt, configPrompt] = ctx.prompts;
  const db = ctx.db;
  let config: Json = {};
  try { config = configPrompt ? (JSON.parse(String(configPrompt)) as Json) : {}; } catch { config = {}; }
  const hexMode = flag(config, "hexMode");
  const user = db.tables.prsnl.find((row) => row.personId === ctx.session.prsnlId);
  const runStats: Json = {
    id: promptNumber(idPrompt), startTime: cclDate(ctx.now), endTime: "", status: "", hexMode: hexMode ? 1 : 0, domain: ctx.session.domain,
    node: ctx.session.node, prsnlId: ctx.session.prsnlId, prsnlName: user?.nameFullFormatted ?? "", physicianInd: user?.physicianInd ?? 0,
    positionCd: user?.positionCd ?? 0, position: db.display(user?.positionCd ?? 0), username: user?.username ?? "",
  };
  const chartId: Json = { personId: 0, encntrId: 0, nameFullFormatted: "" };
  const errors: Json[] = [];
  const sections: [string, unknown][] = [];
  const reply = () => {
    runStats.endTime = cclDate(ctx.now);
    if (!str(runStats.status)) runStats.status = "ok";
    const out: Json = { runStats, chartId, errors };
    for (const [key, value] of sections) out[key] = value;
    const body = camelJson(out);
    return { status: 200, contentType: "application/json", body: hexMode ? rawHex(body) : body };
  };

  let payload: Json = {};
  const blob = ctx.call.blobIn ?? "";
  try { payload = (pick(JSON.parse(hexMode ? hexRaw(blob) : blob), "payload") as Json) ?? {}; } catch { payload = {}; }
  if (promptNumber(debugPrompt) > 0) {
    runStats.status = "Debug: request captured, services skipped";
    return reply();
  }

  const visits: { personId: number; encntrId: number }[] = [];
  for (const row of list(pick(payload, "patientSource"))) {
    const personId = num(pick(row, "personId"));
    const encntrId = num(pick(row, "encntrId"));
    if (personId > 0 || encntrId > 0) visits.push({ personId, encntrId });
  }
  if (!visits.length && promptNumber(personPrompt) > 0) visits.push({ personId: promptNumber(personPrompt), encntrId: promptNumber(encntrPrompt) });
  for (const visit of visits) {
    if (visit.personId <= 0 && visit.encntrId > 0) visit.personId = db.tables.encounters.find((e) => e.encntrId === visit.encntrId)?.personId ?? 0;
    const allowed = visit.encntrId > 0
      ? db.tables.encounters.some((e) => e.encntrId === visit.encntrId && e.personId === visit.personId && e.active)
      : visit.personId > 0 && db.tables.persons.some((p) => p.personId === visit.personId && p.active);
    if (!allowed) {
      errors.push({ code: 403, message: `Access denied for person ${visit.personId}` });
      visit.personId = 0;
      visit.encntrId = 0;
    }
  }
  if (visits.length) {
    chartId.personId = visits[0].personId;
    chartId.encntrId = visits[0].encntrId;
    chartId.nameFullFormatted = db.tables.persons.find((p) => p.personId === visits[0].personId)?.nameFullFormatted ?? "";
  }
  const scripts = list(pick(pick(payload, "customScript"), "script"));
  const custom = (phase: "PRE" | "POST") => {
    const out: Json[] = [];
    scripts.forEach((script) => {
      if (str(pick(script, "run")).toUpperCase() !== phase) return;
      const name = programKey(str(pick(script, "name")));
      if (!WHITELIST.includes(name)) {
        errors.push({ code: 400, message: `Script not whitelisted: ${str(pick(script, "name")).toLowerCase()}` });
        return;
      }
      const params = (pick(script, "parameters") as Json) ?? {};
      const data = name === "nh_wf_form_store" ? formStore(ctx, params) : writeDocument(ctx, visits, params);
      out.push({ id: str(pick(script, "id")), data });
    });
    return out;
  };

  const pre = custom("PRE");
  const personId = num(chartId.personId);
  if (present(payload, "person") && personId > 0) {
    const p = db.tables.persons.find((row) => row.personId === personId);
    sections.push(["persons", p ? [{
      personId, nameFullFormatted: p.nameFullFormatted, nameFirst: p.nameFirst, nameLast: p.nameLast, birthDtTm: cclDate(p.birthDtTm),
      genderCd: p.sexCd, gender: db.display(p.sexCd), deceasedInd: p.deceasedCd ? 1 : 0,
      aliases: db.tables.personAliases.filter((a) => a.personId === personId && isCurrent(a, ctx.now)).map((a) => ({
        alias: a.alias, aliasFormatted: a.personAliasTypeCd === db.byMeaning(CS.personAliasType, "PHN") ? a.alias.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3") : a.alias,
        aliasTypeCd: a.personAliasTypeCd, aliasType: db.display(a.personAliasTypeCd), aliasTypeMeaning: db.meaning(a.personAliasTypeCd),
        aliasPoolCd: a.aliasPoolCd, aliasPool: db.display(a.aliasPoolCd), healthCardProvince: a.healthCardProvince, healthCardVerCode: a.healthCardVerCode,
        healthCardType: a.healthCardType, healthCardIssueDtTm: cclDate(a.healthCardIssueDtTm), healthCardExpiryDtTm: cclDate(a.healthCardExpiryDtTm),
      })),
    }] : []]);
  }
  const encntrId = num(chartId.encntrId);
  if (present(payload, "encounter") && encntrId > 0) {
    const e = db.tables.encounters.find((row) => row.encntrId === encntrId);
    sections.push(["encounters", e ? [{
      encntrId, personId: e.personId, encntrTypeCd: e.encntrTypeCd, encntrType: db.display(e.encntrTypeCd), locFacilityCd: e.locFacilityCd,
      location: db.display(e.locFacilityCd), regDtTm: cclDate(e.regDtTm),
      aliases: db.tables.encntrAliases.filter((a) => a.encntrId === encntrId && isCurrent(a, ctx.now)).map((a) => ({
        alias: a.alias, aliasFormatted: a.alias, aliasTypeCd: a.encntrAliasTypeCd, aliasType: db.display(a.encntrAliasTypeCd),
        aliasTypeMeaning: db.meaning(a.encntrAliasTypeCd), aliasPoolCd: a.aliasPoolCd, aliasPool: db.display(a.aliasPoolCd),
      })),
    }] : []]);
  }
  const post = custom("POST");
  if (pre.length) sections.push(["customPre", pre]);
  if (post.length) sections.push(["customPost", post]);
  return reply();
}

/** nh_wf_form_store: chunked key/value rows on cust_nh_wf_reference. */
function formStore(ctx: CclRunContext, params: Json): Json {
  const db = ctx.db;
  const action = (str(pick(params, "action")) || "r").toLowerCase();
  const data = list(pick(params, "data"));
  const rows: Json[] = [];
  if (!data.length) return { rows, actionStatus: "No data rows supplied" };
  const key = (item: Json) => ({ name: str(pick(item, "refName")).trim(), task: str(pick(item, "refTask")).trim(), parent: num(pick(item, "parentEntityId")) });
  const same = (row: (typeof db.tables.refData)[number], k: ReturnType<typeof key>) => row.refName === k.name && row.refTask === k.task && (k.parent <= 0 || row.parentEntityId === k.parent);
  if (action === "r" || action === "ra") {
    for (const item of data) {
      const k = key(item);
      const chunks = db.tables.refData.filter((row) => same(row, k) && (action === "ra" || row.active)).sort((a, b) => a.sequence - b.sequence);
      if (!chunks.length) continue;
      rows.push({
        refName: chunks[0].refName, refTask: chunks[0].refTask, description: chunks[0].description, parentEntityId: chunks[0].parentEntityId,
        parentEntityName: chunks[0].parentEntityName, refText: chunks.map((c) => c.refText).join(""), updtDtTm: cclDate(chunks[0].updtDtTm),
      });
    }
    return { rows, actionStatus: "Read complete" };
  }
  if (action === "w") {
    for (const item of data) {
      const k = key(item);
      db.tables.refData = db.tables.refData.filter((row) => !same(row, k));
      const text = str(pick(item, "refText"));
      const pieces = Math.max(1, Math.ceil(text.length / 32000));
      for (let seq = 1; seq <= pieces; seq++) {
        db.tables.refData.push({
          refId: db.allocateId(), refName: k.name, refTask: k.task, description: str(pick(item, "description")).trim(), parentEntityId: k.parent,
          parentEntityName: str(pick(item, "parentEntityName")).trim(), sequence: seq, refText: text.slice((seq - 1) * 32000, seq * 32000), active: true,
          createPrsnlId: ctx.session.prsnlId, createDtTm: ctx.now, updtId: ctx.session.prsnlId, updtDtTm: ctx.now, begEffective: ctx.now, endEffective: END_OF_TIME,
        });
      }
    }
    return { rows, actionStatus: "Write complete" };
  }
  if (action === "i") {
    for (const item of data) for (const row of db.tables.refData) if (same(row, key(item))) { row.active = false; row.endEffective = ctx.now; }
    return { rows, actionStatus: "Inactivate complete" };
  }
  if (action === "d") {
    for (const item of data) db.tables.refData = db.tables.refData.filter((row) => !same(row, key(item)));
    return { rows, actionStatus: "Delete complete" };
  }
  return { rows, actionStatus: `Unknown action: ${action}` };
}

/** nh_wf_write_document: file the form as a clinical document (mmf_publish_ce in production). */
function writeDocument(ctx: CclRunContext, visits: { personId: number; encntrId: number }[], params: Json): Json {
  const db = ctx.db;
  const fail = (status: string) => ({ status, statusValue: 0, parentEventId: 0 });
  const valid = visits.filter((visit) => visit.personId > 0);
  if (valid.length !== 1) return fail("Exactly one patient_source visit is required");
  if (!valid[0].encntrId) return fail("A valid person and encounter are required");
  const title = str(pick(params, "title")).trim();
  if (!title) return fail("Blank title not allowed");
  const documentText = str(pick(params, "document"));
  if (!documentText.trim()) return fail("Blank document content not allowed");
  const eventKey = str(pick(params, "eventKey")).trim();
  const eventCd = db.byDisplayKey(CS.eventCode, eventKey);
  if (!eventCd) return fail(`Invalid event key: ${eventKey}`);
  const noteFormat = str(pick(params, "noteFormat")).trim();
  const formatCd = db.byMeaning(CS.noteFormat, noteFormat) || (noteFormat.toUpperCase() === "AH" ? db.byMeaning(CS.noteFormat, "HTML") : 0);
  if (!formatCd) return fail(`Invalid note format: ${noteFormat}`);
  const parentEventId = db.allocateId();
  db.tables.documents.push({
    parentEventId, eventId: db.allocateId(), personId: valid[0].personId, encntrId: valid[0].encntrId, eventCd, eventTitleText: title, eventEndDtTm: ctx.now,
    resultStatusCd: db.byMeaning(CS.resultStatus, "AUTH"), formatCd, blob: documentText.replace(/\\n/g, "\n"), performPrsnlId: ctx.session.prsnlId,
  });
  return { status: "success", statusValue: 0, parentEventId };
}

export const NH_PROGRAMS: CclProgramInfo[] = [
  { name: "nh_wf_entry:group1", description: "Northern Health webforms entry (clean-room CCL in packages/cerner-ccl): whitelist + entitlement", program: nhEntry },
];
