import { CS } from "../db/seed";
import { END_OF_TIME, isCurrent, toKey, type MillenniumDb } from "../db/db";
import { cclDate, cernerAge, formatPhone, rawHex, CCL_ZERO_DATE } from "../ccl/json";
import type { CclRunContext, PromptValue } from "../ccl/types";
import { addPatient, flag, list, num, pick, str, typeFilter, allowedBy, type EntryState, type Json } from "./support";

/**
 * Custom-script services the Clinical Office entry dispatches by name
 * (`payload.customScript.script[].name`). Each returns the `data` object the
 * entry wraps as `{id, data}`, or undefined for "no entry at all".
 */
export type CustomScript = (ctx: CclRunContext, state: EntryState, script: Json, prompts: PromptValue[]) => Json | undefined;

const params = (script: Json): Json => {
  const value = pick(script, "parameters");
  return value && typeof value === "object" ? (value as Json) : {};
};

/* ------------------------------------------------------------- dm_info */

export const dmInfo: CustomScript = (ctx, _state, script) => {
  const p = params(script);
  const action = str(pick(p, "action")).trim().charAt(0).toUpperCase();
  const db = ctx.db;
  const out: Json[] = [];
  for (const item of list(pick(p, "data"))) {
    const domain = str(pick(item, "infoDomain"));
    const name = str(pick(item, "infoName"));
    const domainId = num(pick(item, "infoDomainId"));
    if (action === "R") {
      for (const row of db.tables.dmInfo) {
        if (row.infoDomain !== domain) continue;
        if (name && row.infoName !== name) continue;
        if (domainId && row.infoDomainId !== domainId) continue;
        out.push(dmInfoRow(db, row, "READ"));
      }
    } else if (action === "W") {
      const existing = db.tables.dmInfo.find((row) => row.infoDomain === domain && row.infoName === name && row.infoDomainId === domainId);
      const longText = str(pick(item, "infoLongText"));
      if (existing) {
        existing.infoDate = str(pick(item, "infoDate"));
        existing.infoChar = str(pick(item, "infoChar"));
        existing.infoNumber = num(pick(item, "infoNumber"));
        existing.updtDtTm = ctx.now;
        existing.updtId = ctx.session.prsnlId;
        const text = db.tables.longText.find((row) => row.longTextId === existing.longTextId);
        if (text) text.longText = longText;
        out.push(dmInfoRow(db, existing, "UPDATE"));
      } else {
        const longTextId = longText.trim() ? db.allocateId() : 0;
        if (longTextId) db.tables.longText.push({ longTextId, parentEntityName: "DM_INFO", longText, active: true });
        const row = {
          infoDomain: domain, infoName: name, infoDate: str(pick(item, "infoDate")), infoChar: str(pick(item, "infoChar")),
          infoNumber: num(pick(item, "infoNumber")), infoDomainId: domainId, longTextId, updtDtTm: ctx.now, updtId: ctx.session.prsnlId,
        };
        db.tables.dmInfo.push(row);
        out.push(dmInfoRow(db, row, "INSERT"));
      }
    } else if (action === "D") {
      const index = db.tables.dmInfo.findIndex((row) => row.infoDomain === domain && row.infoName === name && row.infoDomainId === domainId);
      if (index >= 0) {
        const [row] = db.tables.dmInfo.splice(index, 1);
        const text = db.tables.longText.find((t) => t.longTextId === row.longTextId);
        if (text) text.active = false;
        out.push(dmInfoRow(db, row, "DELETE"));
      }
    }
  }
  if (!out.length) {
    ctx.notice({ kind: "info", code: "co5.dm-info-no-match", message: "dm_info matched no rows, so (as in production) no {id, data} entry is returned for this script." });
    return undefined;
  }
  return { dmInfo: out };
};

function dmInfoRow(db: MillenniumDb, row: MillenniumDb["tables"]["dmInfo"][number], actionStatus: string): Json {
  return {
    infoDomain: row.infoDomain, infoName: row.infoName, infoDate: row.infoDate || CCL_ZERO_DATE, infoChar: row.infoChar, infoNumber: row.infoNumber,
    longTextId: row.longTextId, longText: db.tables.longText.find((t) => t.longTextId === row.longTextId && t.active)?.longText ?? "",
    updtDtTm: cclDate(row.updtDtTm), updtId: row.updtId, infoDomainId: row.infoDomainId, actionStatus,
  };
}

/* ------------------------------------------------------------- ref_data (CUST_CO_REFERENCE) */

const CHUNK = 32000;

export const refData: CustomScript = (ctx, _state, script) => {
  /* Note: action/data sit on the script entry itself, not under parameters. */
  const action = str(pick(script, "action")).toLowerCase();
  const data = list(pick(script, "data"));
  if (!action || !pick(script, "data")) {
    if (pick(params(script), "action")) {
      ctx.notice({ kind: "warning", message: "ref_data reads action/data from the script entry itself; these were sent under parameters, so production does nothing." });
    }
    return { action: "", data: [] };
  }
  const db = ctx.db;
  const rows: Json[] = [];
  for (const item of data) {
    const name = str(pick(item, "refName"));
    const hasTask = pick(item, "refTask") !== undefined;
    const task = str(pick(item, "refTask"));
    const scoped = pick(item, "parentEntityId") !== undefined && pick(item, "parentEntityName") !== undefined;
    const parentId = scoped ? num(pick(item, "parentEntityId")) : 0;
    const parentName = scoped ? str(pick(item, "parentEntityName")) : "";
    const matches = (row: (typeof db.tables.refData)[number], forRead: boolean) =>
      row.refName === name &&
      (forRead && !hasTask ? true : row.refTask === task) &&
      (forRead && !scoped ? true : row.parentEntityId === parentId && row.parentEntityName === parentName);
    if (action === "r" || action === "ra") {
      const found = db.tables.refData.filter((row) => matches(row, true) && (action === "ra" || row.active));
      const groups = new Map<string, typeof found>();
      for (const row of found) {
        const key = `${row.active ? 1 : 0}|${row.createDtTm.getTime()}|${row.refTask}|${row.parentEntityId}|${row.parentEntityName}`;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      const ordered = [...groups.values()].sort((a, b) => Number(b[0].active) - Number(a[0].active) || b[0].createDtTm.getTime() - a[0].createDtTm.getTime());
      for (const chunks of ordered) {
        chunks.sort((a, b) => a.sequence - b.sequence);
        const first = chunks[0];
        rows.push({
          refName: first.refName, refTask: first.refTask, description: first.description, parentEntityId: first.parentEntityId,
          parentEntityName: first.parentEntityName, refText: chunks.map((chunk) => chunk.refText).join(""), createPrsnlId: first.createPrsnlId,
          createPrsnlName: db.prsnlName(first.createPrsnlId), activeInd: first.active ? 1 : 0, updtId: first.updtId, updtName: db.prsnlName(first.updtId),
          updtDtTm: cclDate(first.updtDtTm), begEffectiveDtTm: cclDate(first.begEffective), endEffectiveDtTm: cclDate(first.endEffective),
        });
      }
    } else if (action === "w") {
      const existing = db.tables.refData.filter((row) => matches(row, false) && row.active).sort((a, b) => a.sequence - b.sequence);
      const text = str(pick(item, "refText"));
      const pieces = Math.max(1, Math.ceil(text.length / CHUNK));
      const createPrsnlId = existing[0]?.createPrsnlId ?? ctx.session.prsnlId;
      const createDtTm = existing[0]?.createDtTm ?? ctx.now;
      db.tables.refData = db.tables.refData.filter((row) => !(matches(row, false) && row.active && row.sequence > pieces));
      for (let seq = 1; seq <= pieces; seq++) {
        const chunk = text.slice((seq - 1) * CHUNK, seq * CHUNK);
        const row = db.tables.refData.find((r) => matches(r, false) && r.active && r.sequence === seq);
        if (row) {
          row.refText = chunk; row.description = str(pick(item, "description")); row.updtId = ctx.session.prsnlId; row.updtDtTm = ctx.now;
        } else {
          db.tables.refData.push({
            refId: db.allocateId(), refName: name, refTask: task, description: str(pick(item, "description")), parentEntityId: parentId,
            parentEntityName: parentName, sequence: seq, refText: chunk, active: true, createPrsnlId, createDtTm, updtId: ctx.session.prsnlId,
            updtDtTm: ctx.now, begEffective: ctx.now, endEffective: END_OF_TIME,
          });
        }
      }
    } else if (action === "i") {
      for (const row of db.tables.refData) if (matches(row, false) && row.active) { row.active = false; row.endEffective = ctx.now; }
    } else if (action === "d") {
      db.tables.refData = db.tables.refData.filter((row) => !(matches(row, false) && row.active));
    }
  }
  return { action, data: rows };
};

/* ------------------------------------------------------------- setup + components */

export const COMPONENT_DOMAIN = "Clinical Office Component";

export const setupInit: CustomScript = (ctx, _state, script) => {
  const action = str(pick(params(script), "action"));
  if (!action) return undefined;
  if (action !== "init") return { statusCode: 0 };
  const db = ctx.db;
  const mapped = db.tables.dmInfo.filter((row) => row.infoDomain === COMPONENT_DOMAIN);
  const components: Json[] = db.tables.bedrockComponents
    .filter((row) => row.namespace === "clinical_office.mpage_component")
    .map((row) => row.label)
    .sort((a, b) => a.localeCompare(b))
    .map((label) => {
      const map = mapped.find((row) => row.infoName === label);
      return {
        inBedrockId: 1, mappedId: map ? 1 : 0, label, path: map?.infoChar ?? "",
        mappingStatus: map ? "Mapping Completed." : "Not Mapped.", lastUpdateDtTm: map ? cclDate(map.updtDtTm) : CCL_ZERO_DATE,
        updtId: map?.updtId ?? 0, mappingLastUpdatedBy: map ? db.prsnlName(map.updtId) : "",
      };
    });
  for (const map of mapped) {
    if (components.some((row) => row.label === map.infoName)) continue;
    components.push({
      inBedrockId: 0, mappedId: 1, label: map.infoName, path: map.infoChar, mappingStatus: "No longer exists in Bedrock, please delete.",
      lastUpdateDtTm: cclDate(map.updtDtTm), updtId: map.updtId, mappingLastUpdatedBy: db.prsnlName(map.updtId),
    });
  }
  const domain = ctx.session.domain.toLowerCase();
  return {
    components,
    managerUrl: `${db.contentServiceUrl()}/manager`,
    host: { domain, zone: ctx.session.zone, fullCanonicalDomainName: `${domain}.${ctx.session.zone}`, serviceDirectoryUrl: ctx.session.serviceDirectoryUrl },
  };
};

/** 1co5_mpage_component's lookup, shared by the standalone program and the embedded-workflow service. */
export function componentLookup(db: MillenniumDb, label: string, now: Date) {
  const row = db.tables.dmInfo.find((r) => r.infoDomain === COMPONENT_DOMAIN && r.infoName === label);
  const base = `${db.contentServiceUrl()}/custom_mpage_content/`;
  const pad = (n: number) => String(n).padStart(2, "0");
  const cache = `?${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  if (!row) return { componentName: "", url: base, component: "", cache, successInd: 0 };
  const path = row.infoChar;
  if (/^https?:/i.test(path)) {
    const trimmed = path.replace(/\/+$/, "");
    return { componentName: label, url: path, component: trimmed.slice(trimmed.lastIndexOf("/") + 1), cache, successInd: 1 };
  }
  return { componentName: label, url: `${base}${path}`, component: path, cache, successInd: 1 };
}

export const embeddedWorkflowComp: CustomScript = (ctx, _state, script) => {
  const p = params(script);
  if (str(pick(p, "action")) !== "get-component") return { data: [] };
  const found = componentLookup(ctx.db, str(pick(p, "componentName")), ctx.now);
  return { data: [{ componentName: found.componentName, component: found.component, url: found.url, cache: found.cache }] };
};

/* ------------------------------------------------------------- search / select services */

type SelectRow = { key: number; value: string };

function selectResult(rows: SelectRow[], searchLimit: number, count: number, hasSearch: boolean, defaults: number[]) {
  const status = { errorInd: 0, message: "No records qualified.", limitMet: 0, fullDataSetLoaded: 0 };
  if (searchLimit > 0) {
    if (count > searchLimit) {
      status.limitMet = 1;
      if (!defaults.length) {
        status.errorInd = 1;
        status.message = `${count} records retrieved. Limit is ${searchLimit}.`;
        return { status, data: [] as SelectRow[] };
      }
    } else if (!hasSearch) status.fullDataSetLoaded = 1;
  }
  const limited = status.limitMet && defaults.length ? rows.filter((row) => defaults.includes(row.key)) : rows;
  if (limited.length) status.message = "Ok.";
  return { status, data: limited };
}

export const codeValueSearch: CustomScript = (ctx, _state, script) => {
  const p = params(script);
  const codeSet = num(pick(p, "codeSet"));
  const valueType = str(pick(p, "valueType")).toUpperCase() || "DISPLAY";
  const search = str(pick(p, "searchValue")).toUpperCase();
  const limitType = str(pick(p, "codeSetLimitType")).toUpperCase();
  const limits = (pick(p, "codeSetLimits") as unknown[] | undefined)?.map((v) => String(v).toUpperCase()) ?? [];
  const defaults = ((pick(p, "default") as unknown[] | undefined) ?? []).map(num);
  const column = (row: MillenniumDb["tables"]["codeValues"][number], type: string) =>
    type === "DISPLAY_KEY" ? row.displayKey : type === "DESCRIPTION" ? row.description : type === "DEFINITION" ? row.definition :
    type === "CDF_MEANING" ? row.cdfMeaning : type === "CKI" ? row.cki : type === "CONCEPT_CKI" ? row.conceptCki : row.display;
  const candidates = ctx.db.codeSet(codeSet).filter((row) => row.active && !row.endEffective);
  const filtered = candidates
    .filter((row) => !search || column(row, valueType).toUpperCase().startsWith(search))
    .filter((row) => !limits.length || limits.includes(column(row, limitType).toUpperCase()));
  const rows = filtered.map((row) => ({ key: row.codeValue, value: column(row, valueType) })).sort((a, b) => a.value.localeCompare(b.value));
  return selectResult(rows, num(pick(p, "searchLimit")), filtered.length, Boolean(search), defaults);
};

export const prsnlSearch: CustomScript = (ctx, _state, script) => {
  const p = params(script);
  const mode = str(pick(p, "mode")) || "mpage-select";
  const physicianOnly = flag(p, "physicianInd");
  const staff = ctx.db.tables.prsnl.filter((row) => isCurrent(row, ctx.now) && (!physicianOnly || row.physicianInd === 1));
  if (mode === "provider-search") {
    const full = str(pick(p, "fullName"));
    const [lastFromFull = "", firstFromFull = ""] = full.split(",").map((part) => part.trim());
    const last = (str(pick(p, "lastName")) || lastFromFull).toUpperCase();
    const first = (str(pick(p, "firstName")) || firstFromFull).toUpperCase();
    /* Exact match unless the caller supplies * wildcards (no implicit trailing *). */
    const like = (value: string, pattern: string) =>
      !pattern || new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`).test(value.toUpperCase());
    const rows = staff.filter((row) => like(row.nameLast, last) && like(row.nameFirst, first)).map((row) => ({
      personId: row.personId, nameFullFormatted: row.nameFullFormatted, positionCd: row.positionCd, position: ctx.db.display(row.positionCd),
      physician: row.physicianInd ? "Yes" : "No",
    }));
    return { status: { errorInd: 0, message: rows.length ? "Ok." : "No records qualified." }, data: rows };
  }
  const search = str(pick(p, "searchValue")).toUpperCase();
  const [lastPart = "", firstPart] = search.split(",").map((part) => part.trim());
  const defaults = ((pick(p, "default") as unknown[] | undefined) ?? []).map(num);
  const limit = num(pick(p, "searchLimit"));
  let found = staff.filter((row) => toKey(row.nameLast).startsWith(toKey(lastPart)) && (firstPart === undefined || toKey(row.nameFirst).startsWith(toKey(firstPart))));
  if (!search && limit > 0 && defaults.length) found = found.filter((row) => defaults.includes(row.personId));
  const rows = found.sort((a, b) => a.nameFullFormatted.localeCompare(b.nameFullFormatted)).map((row) => ({ key: row.personId, value: row.nameFullFormatted }));
  const tooMany = limit > 0 && rows.length > limit && !defaults.length;
  return {
    status: { errorInd: tooMany ? 1 : 0, message: tooMany ? `${rows.length} records retrieved. Limit is ${limit}.` : rows.length ? "Ok." : "No records qualified.", count: limit > 0 ? rows.length : 0 },
    data: tooMany ? [] : rows,
  };
};

export const eventSetSearch: CustomScript = (ctx) => {
  ctx.notice({ kind: "info", message: "The synthetic domain has no event set hierarchy, so event set searches return no rows." });
  return { status: { errorInd: 0, message: "No records qualified.", limitMet: 0, fullDataSetLoaded: 1 }, data: [] };
};

function locationChildren(db: MillenniumDb, parent: number) {
  return db.tables.locations.filter((row) => row.parentLocationCd === parent && row.active);
}

export const locationTree: CustomScript = (ctx, _state, script) => {
  const p = params(script);
  const db = ctx.db;
  let options: Json = {};
  try { options = (JSON.parse(`{${str(pick(p, "scriptParams")).replace(/^\s*\{|\}\s*$/g, "")}}`) as Json) ?? {}; } catch { options = {}; }
  const maxLevel = str(pick(options, "maxViewLevel")).toUpperCase() || "ALL";
  const depthOf: Record<string, number> = { FACILITY: 0, BUILDING: 1, UNIT: 2, ALL: 4 };
  const typeDepth = (meaning: string) => (meaning === "FACILITY" ? 0 : meaning === "BUILDING" ? 1 : meaning === "NURSEUNIT" || meaning === "AMBULATORY" ? 2 : meaning === "ROOM" ? 3 : 4);
  const branchId = num(pick(p, "branchId"));
  const row = (loc: MillenniumDb["tables"]["locations"][number], parentId: number, extra: Partial<Json> = {}) => {
    const depth = typeDepth(db.meaning(loc.locationTypeCd));
    return {
      parentId, id: loc.locationCd, display: db.description(loc.locationCd),
      expandable: depth < (depthOf[maxLevel] ?? 4) && locationChildren(db, loc.locationCd).length > 0 ? 1 : 0,
      selected: 0, indeterminate: 0, expanded: 0, dirty: 0, createZone: 1, ...extra,
    };
  };
  if (branchId > 0) {
    const parent = branchId === 1 ? 0 : branchId;
    return { data: locationChildren(db, parent).map((loc) => row(loc, branchId)).sort((a, b) => String(a.display).localeCompare(String(b.display))) };
  }
  return { data: locationChildren(db, 0).map((loc) => row(loc, 1)) };
};

export const locationSearch: CustomScript = (ctx, _state, script) => {
  const p = params(script);
  const search = str(pick(p, "searchValue")).toUpperCase();
  const valueType = str(pick(p, "valueType")).toUpperCase() || "DISPLAY";
  const rows = ctx.db.codeSet(CS.location)
    .filter((row) => row.active && (!search || (valueType === "DESCRIPTION" ? row.description : row.display).toUpperCase().startsWith(search)))
    .map((row) => ({ key: row.codeValue, value: valueType === "DESCRIPTION" ? row.description : row.display }))
    .sort((a, b) => a.value.localeCompare(b.value) || a.key - b.key);
  return selectResult(rows, num(pick(p, "searchLimit")), rows.length, Boolean(search), ((pick(p, "default") as unknown[] | undefined) ?? []).map(num));
};

/* ------------------------------------------------------------- patient search */

export const encSearch: CustomScript = (ctx, state, script) => {
  const p = params(script);
  const db = ctx.db;
  const personId = num(pick(p, "personId"));
  const hits = new Map<number, { encntrId: number; count: number }>();
  let level = 0;
  const bump = (person: number, encntrId: number) => {
    const known = hits.get(person);
    if (!known) hits.set(person, { encntrId, count: level });
    else if (encntrId === 0 || encntrId === known.encntrId) known.count++;
  };
  const encAliases = list(pick(p, "encntrAlias")).filter((a) => str(pick(a, "alias")));
  if (encAliases.length) {
    level += encAliases.length;
    for (const crit of encAliases) {
      const typeCd = db.byMeaning(CS.encounterAliasType, str(pick(crit, "cdfMeaning")) || "FIN NBR");
      for (const row of db.tables.encntrAliases.filter((r) => isCurrent(r, ctx.now) && r.encntrAliasTypeCd === typeCd && r.alias.toUpperCase() === str(pick(crit, "alias")).toUpperCase())) {
        const enc = db.tables.encounters.find((e) => e.encntrId === row.encntrId);
        if (enc) bump(enc.personId, enc.encntrId);
      }
    }
  }
  const personAliases = list(pick(p, "personAlias")).filter((a) => str(pick(a, "alias")));
  if (personAliases.length) {
    level += personAliases.length;
    for (const crit of personAliases) {
      const typeCd = db.byMeaning(CS.personAliasType, str(pick(crit, "cdfMeaning")) || "MRN");
      for (const row of db.tables.personAliases.filter((r) => isCurrent(r, ctx.now) && r.personAliasTypeCd === typeCd && r.alias.replace(/\s/g, "") === str(pick(crit, "alias")).replace(/\s/g, ""))) bump(row.personId, 0);
    }
  }
  const full = str(pick(p, "fullName"));
  const [lastFromFull = "", firstFromFull = ""] = full.split(",").map((part) => part.trim());
  const last = (str(pick(p, "lastName")) || lastFromFull).toUpperCase();
  const first = (str(pick(p, "firstName")) || firstFromFull).toUpperCase();
  if (last.replace(/\*/g, "").length >= 2 && hits.size === 0) {
    level += 1;
    const pattern = (text: string) => new RegExp(`^${toKey(text.replace(/\*/g, "§")).replace(/§/g, ".*")}$`);
    const birth = str(pick(p, "birthDate"));
    const sexCd = num(pick(p, "sexCd"));
    const found = db.tables.persons.filter((row) => isCurrent(row, ctx.now) && pattern(last).test(toKey(row.nameLast)) && (!first || pattern(first.includes("*") ? first : `${first}*`).test(toKey(row.nameFirst))) && (!birth || cclDate(row.birthDtTm).startsWith(birth)) && (!sexCd || row.sexCd === sexCd));
    if (found.length > 1000) return { status: { type: "person", message: "More than 1000 patients returned. Please modify your search.", code: 1000 } };
    for (const row of found) bump(row.personId, 0);
  }
  if (personId > 0) {
    level += 1;
    /* Every encounter of that person qualifies; earlier candidates do not. */
    const visits = db.tables.encounters.filter((e) => e.personId === personId && isCurrent(e, ctx.now));
    for (const enc of visits) { addPatient(state, personId); state.visits.push({ personId, encntrId: enc.encntrId }); }
    return visits.length
      ? { status: { type: "encounter", message: "", code: 0 } }
      : { status: { type: "encounter", message: "No records qualified.", code: 99 } };
  }
  let added = 0;
  for (const [person, hit] of hits) {
    if (hit.count !== level) continue;
    addPatient(state, person);
    if (hit.encntrId > 0) state.visits.push({ personId: person, encntrId: hit.encntrId });
    added++;
  }
  return added ? { status: { type: "person", message: "", code: 0 } } : { status: { type: "person", message: "No records qualified.", code: 99 } };
};

export const encSearchData: CustomScript = (ctx, state) => {
  const db = ctx.db;
  const person = state.patients
    .map((id) => db.tables.persons.find((row) => row.personId === id && isCurrent(row, ctx.now)))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.nameFullFormatted.localeCompare(b.nameFullFormatted) || a.personId - b.personId)
    .map((row) => {
      const mrn = db.tables.personAliases.find((a) => a.personId === row.personId && a.personAliasTypeCd === db.byMeaning(CS.personAliasType, "MRN"));
      const home = db.tables.addresses.filter((a) => a.parentEntityName === "PERSON" && a.parentEntityId === row.personId && a.addressTypeCd === db.byMeaning(CS.addressType, "HOME")).pop();
      const phones = ["MOBILE", "HOME", "BUSINESS"].flatMap((meaning) => {
        const phone = db.tables.phones.find((ph) => ph.parentEntityName === "PERSON" && ph.parentEntityId === row.personId && ph.phoneTypeCd === db.byMeaning(CS.phoneType, meaning));
        return phone ? [`${db.display(phone.phoneTypeCd)}: ${formatPhone(phone.phoneNum)}`] : [];
      });
      return {
        personId: row.personId, name: row.nameFullFormatted, vip: db.display(row.vipCd), mrn: mrn?.alias ?? "", sex: db.display(row.sexCd),
        birthDate: cclDate(row.birthDtTm), age: cernerAge(row.birthDtTm, ctx.now),
        homeAddress: home ? [home.streetAddr, home.streetAddr2, home.streetAddr3, home.streetAddr4, home.city, `${home.state} ${home.country} ${home.zipcode}`.trim()].filter(Boolean).join(", ") : "",
        phoneNumbers: phones.join(", "), ethnicGroup: db.display(row.ethnicGrpCd),
      };
    });
  const encounter = state.visits
    .map((visit) => db.tables.encounters.find((row) => row.encntrId === visit.encntrId && visit.encntrId > 0))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.personId - b.personId || Number(Boolean(a.dischDtTm)) - Number(Boolean(b.dischDtTm)) || (b.regDtTm?.getTime() ?? 0) - (a.regDtTm?.getTime() ?? 0))
    .map((row) => {
      const fin = db.tables.encntrAliases.find((a) => a.encntrId === row.encntrId && a.encntrAliasTypeCd === db.byMeaning(CS.encounterAliasType, "FIN NBR"));
      const attending = db.tables.encntrPrsnlReltns.filter((r) => r.encntrId === row.encntrId && r.encntrPrsnlRCd === db.byMeaning(CS.encntrPrsnlReltn, "ATTENDDOC")).pop();
      const room = db.display(row.locRoomCd);
      const bed = db.display(row.locBedCd);
      return {
        encntrId: row.encntrId, personId: row.personId, finNumber: fin?.alias ?? "", facility: db.display(row.locFacilityCd), nurseUnit: db.display(row.locNurseUnitCd),
        roomBed: room && bed ? `${room}-${bed}` : room, regDtTm: cclDate(row.regDtTm), dischDtTm: cclDate(row.dischDtTm), medicalService: db.display(row.medServiceCd),
        encounterType: db.display(row.encntrTypeCd), attendingPhysician: attending ? db.prsnlName(attending.prsnlPersonId) : "",
      };
    });
  return { person, encounter };
};

/* ------------------------------------------------------------- list builders */

function replacePatientSource(state: EntryState, visits: { personId: number; encntrId: number }[]) {
  const sorted = [...visits].sort((a, b) => a.personId - b.personId || a.encntrId - b.encntrId);
  state.visits = sorted;
  state.patients = [];
  for (const visit of sorted) addPatient(state, visit.personId);
  return sorted.length ? { visits: sorted } : undefined;
}

export const censusList: CustomScript = (ctx, state) => {
  const db = ctx.db;
  const units = typeFilter(db, state, CS.location);
  const classes = typeFilter(db, state, CS.encounterTypeClass);
  const visits = db.tables.encntrDomains
    .filter((row) => isCurrent(row, ctx.now) && allowedBy(units, row.locNurseUnitCd))
    .flatMap((row) => {
      const enc = db.tables.encounters.find((e) => e.encntrId === row.encntrId && isCurrent(e, ctx.now) && !e.dischDtTm && allowedBy(classes, e.encntrTypeClassCd));
      return enc ? [{ personId: enc.personId, encntrId: enc.encntrId }] : [];
    });
  return replacePatientSource(state, visits);
};

export const encList: CustomScript = (ctx, state, script) => {
  const p = params(script);
  const db = ctx.db;
  const field = str(pick(p, "dateField")).toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()) || "regDtTm";
  const from = new Date(str(pick(p, "fromDate")) || 0);
  const to = new Date(str(pick(p, "toDate")) || END_OF_TIME);
  const orgs = list(pick(p, "organizations")).map((o) => toKey(str(pick(o, "orgName"))));
  const orgIds = orgs.length ? db.tables.organizations.filter((o) => orgs.includes(o.orgNameKey)).map((o) => o.organizationId) : null;
  const limitTo = state.patients.length ? new Set(state.patients) : null;
  const filters = { disp: typeFilter(db, state, CS.dischDisposition), type: typeFilter(db, state, CS.encounterType), service: typeFilter(db, state, CS.medService), cls: typeFilter(db, state, CS.encounterTypeClass), unit: typeFilter(db, state, CS.location) };
  if (filters.unit) ctx.notice({ kind: "quirk", code: "co5.enc-list-220-facility", message: "Production applies a code set 220 typeList to the encounter's FACILITY although the docs call it nurse unit. The simulator filters nurse unit, as documented." });
  const visits = db.tables.encounters
    .filter((enc) => isCurrent(enc, ctx.now) && (!limitTo || limitTo.has(enc.personId)) && (!orgIds || orgIds.includes(enc.organizationId)))
    .filter((enc) => {
      const value = (enc as unknown as Json)[field];
      return value instanceof Date && value >= from && value <= to;
    })
    .filter((enc) => allowedBy(filters.type, enc.encntrTypeCd) && allowedBy(filters.service, enc.medServiceCd) && allowedBy(filters.cls, enc.encntrTypeClassCd) && allowedBy(filters.unit, enc.locNurseUnitCd) && allowedBy(filters.disp, 0))
    .map((enc) => ({ personId: enc.personId, encntrId: enc.encntrId }));
  return replacePatientSource(state, visits);
};

export const getPatientList: CustomScript = (ctx, state, _script, prompts) => {
  const listId = num(prompts[0]);
  const found = ctx.db.tables.patientLists.find((row) => row.patientListId === listId);
  if (!found) ctx.notice({ kind: "warning", message: `Patient list ${listId} does not exist in the synthetic domain.` });
  replacePatientSource(state, found?.members ?? []);
  return undefined;
};

/* ------------------------------------------------------------- documents */

export const writeDocument: CustomScript = (ctx, state, script) => {
  const p = params(script);
  const db = ctx.db;
  const visits = state.visits.filter((visit) => visit.personId > 0);
  const fail = (status: string, statusValue: unknown) => ({ status, statusValue: str(statusValue), parentEventId: 0 });
  if (visits.length !== 1) return fail("You must have one valid patient_source->visits record", "");
  const formatCd = db.byMeaning(CS.noteFormat, str(pick(p, "noteFormat")));
  if (!formatCd) return fail("Invalid Note Format", pick(p, "noteFormat"));
  const eventCd = db.byDisplayKey(CS.eventCode, str(pick(p, "eventKey")));
  if (!eventCd) return fail("Invalid Event Key", pick(p, "eventKey"));
  const title = str(pick(p, "title"));
  if (!title.trim()) return fail("Blank Title Not Allowed", "");
  const documentText = str(pick(p, "document"));
  if (!documentText.trim()) return fail("Blank Document Content Not Allowed", "");
  const parentEventId = db.allocateId();
  db.tables.documents.push({
    parentEventId, eventId: db.allocateId(), personId: visits[0].personId, encntrId: visits[0].encntrId, eventCd, eventTitleText: title,
    eventEndDtTm: ctx.now, resultStatusCd: db.byMeaning(CS.resultStatus, "AUTH"), formatCd, blob: documentText.replace(/\\n/g, "\n"), performPrsnlId: ctx.session.prsnlId,
  });
  return { status: "", statusValue: "", parentEventId };
};

export const loadDocument: CustomScript = (ctx, _state, script) => {
  const db = ctx.db;
  const parentEventId = num(pick(params(script), "parentEventId"));
  const docs = db.tables.documents.filter((row) => row.parentEventId === parentEventId && parentEventId > 0);
  if (!docs.length) return { status: { message: "Invalid Parent Event Id" }, document: [] };
  return {
    status: { message: "Document Loaded." },
    document: docs.map((row) => {
      const meaning = db.meaning(row.formatCd);
      const html = meaning === "HTML" ? row.blob : `<html><body><pre>${row.blob.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre></body></html>`;
      return {
        eventId: row.eventId, eventEndDtTm: cclDate(row.eventEndDtTm), eventTitleText: row.eventTitleText, eventCd: row.eventCd, event: db.display(row.eventCd),
        eventTag: row.eventTitleText, resultStatusCd: row.resultStatusCd, resultStatus: db.display(row.resultStatusCd), storageCd: db.byMeaning(CS.storage, "BLOB"),
        storage: "Blob", formatCd: row.formatCd, format: db.display(row.formatCd), docContent: rawHex(html), signature: rawHex(`<p>Electronically signed by ${db.prsnlName(row.performPrsnlId)} ${cclDate(row.eventEndDtTm)}</p>`),
        blobHandle: "", imageUrl: "",
      };
    }),
  };
};

export const ping: CustomScript = () => ({ ping: 0 });

/** Custom scripts by program name (lower case, without the group). */
export const CO5_CUSTOM_SCRIPTS: Record<string, CustomScript> = {
  "1co5_ping": ping,
  "1co5_mpage_dm_info": dmInfo,
  "1co5_mpage_ref_data": refData,
  "1co5_mpage_setup": setupInit,
  "1co5_embedded_workflow_comp": embeddedWorkflowComp,
  "1co5_code_value_search": codeValueSearch,
  "1co5_prsnl_search": prsnlSearch,
  "1co5_event_set_search": eventSetSearch,
  "1co5_location_tree": locationTree,
  "1co5_location_search": locationSearch,
  "1co5_enc_search": encSearch,
  "1co5_enc_search_data": encSearchData,
  "1co5_mpage_census_list": censusList,
  "1co5_mpage_enc_list": encList,
  "1co5_get_patient_list": getPatientList,
  "1co5_load_document": loadDocument,
  "1co5_write_document": writeDocument,
};
