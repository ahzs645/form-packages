import { CS } from "../db/seed";
import { isCurrent, type MillenniumDb } from "../db/db";
import { cclDate, cernerAge, formatPhone } from "../ccl/json";
import type { EncounterRow, PersonRow, PrsnlRow } from "../db/types";
import {
  addParent, addPatient, addPrsnl, allowedBy, flag, list, num, options, pick, present, refRows, skipJson, str, typeFilter,
  type EntryState, type Json,
} from "./support";

/**
 * The eight domain scripts the entry runs, in its fixed order. Each returns
 * the top-level members it splices into the reply, or null for "no key at
 * all". Field lists and their order follow the spec; values are correct
 * where the production scripts leave fields blank (see QUIRKS.md).
 */

const d = cclDate;

/* ---------------------------------------------------------------- codeValue */

export function codeValueDomain(db: MillenniumDb, state: EntryState): Json | null {
  const rows: Json[] = [];
  for (const entry of list(pick(state.payload, "codeValue"))) {
    const cs = num(pick(entry, "cs"));
    const value = num(pick(entry, "value") ?? pick(entry, "cv"));
    const filter = str(pick(entry, "filter")).trim();
    const alias = str(pick(entry, "alias"));
    const outbound = str(pick(entry, "outboundAlias"));
    if (filter) {
      state.notices.push({ kind: "quirk", code: "co5.code-value-filter", message: `codeValue filter "${filter}" is raw CCL in production (an injection surface). The simulator applies only simple CV.<column> = "value" filters.` });
    }
    const match = parseSimpleFilter(filter);
    const found = db.tables.codeValues
      .filter((row) => row.active && !row.endEffective && row.codeValue !== 0 && row.codeSet > 0 && (row.codeSet === cs || row.codeValue === value))
      .filter((row) => !match || String((row as unknown as Json)[match.column] ?? "").toUpperCase() === match.value.toUpperCase())
      .sort((a, b) => a.displayKey.localeCompare(b.displayKey));
    for (const row of found) {
      rows.push({
        codeValue: row.codeValue, codeSet: row.codeSet, cdfMeaning: row.cdfMeaning, display: row.display, displayKey: row.displayKey,
        description: row.description, definition: row.definition, aliasInd: alias, alias: "", outboundInd: outbound, outbound: "",
      });
    }
  }
  return rows.length ? { codeValues: rows } : null;
}

function parseSimpleFilter(filter: string): { column: string; value: string } | null {
  const match = /^\s*cv\.(\w+)\s*=\s*["'](.*)["']\s*$/i.exec(filter);
  if (!match) return null;
  const column = match[1].toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return { column, value: match[2] };
}

/* ---------------------------------------------------------------- encounter */

function locationOrg(db: MillenniumDb, locationCd: number): number {
  return db.tables.locations.find((row) => row.locationCd === locationCd)?.organizationId ?? 0;
}

function encounterCore(db: MillenniumDb, encntrId: number, enc: EncounterRow | undefined): Json {
  const e = enc;
  const cd = (value: number | undefined) => value ?? 0;
  const show = (value: number | undefined) => db.display(value ?? 0);
  return {
    encntrId, personId: cd(e?.personId), encntrClass: show(e?.encntrClassCd), encntrType: show(e?.encntrTypeCd),
    encntrTypeClass: show(e?.encntrTypeClassCd), encntrStatus: show(e?.encntrStatusCd), preRegDtTm: d(null), preRegPrsnlId: 0,
    regDtTm: d(e?.regDtTm), regPrsnlId: cd(e?.regPrsnlId), estArriveDtTm: d(null), estDepartDtTm: d(null), arriveDtTm: d(e?.arriveDtTm),
    departDtTm: d(null), admitType: show(e?.admitTypeCd), admitSrc: "", admitMode: "", dischDisposition: "", dischToLoctn: "", readmit: "",
    accommodation: "", accommodationRequest: "", accommodationReason: "", ambulatoryCond: "", courtesy: "", isolation: show(e?.isolationCd),
    medService: show(e?.medServiceCd), confidLevel: show(e?.confidLevelCd), vip: show(e?.vipCd), location: show(e?.locationCd),
    locFacility: show(e?.locFacilityCd), locBuilding: show(e?.locBuildingCd), locNurseUnit: show(e?.locNurseUnitCd),
    locRoom: show(e?.locRoomCd), locBed: show(e?.locBedCd), dischDtTm: d(e?.dischDtTm), organizationId: cd(e?.organizationId),
    reasonForVisit: e?.reasonForVisit ?? "", encntrFinancialId: 0, financialClass: show(e?.financialClassCd), trauma: "", triage: "",
    triageDtTm: d(null), visitorStatus: "", inpatientAdmitDtTm: d(e?.inpatientAdmitDtTm), encntrClassCd: cd(e?.encntrClassCd),
    encntrTypeCd: cd(e?.encntrTypeCd), encntrTypeClassCd: cd(e?.encntrTypeClassCd), encntrStatusCd: cd(e?.encntrStatusCd),
    admitTypeCd: cd(e?.admitTypeCd), admitSrcCd: 0, admitModeCd: 0, dischDispositionCd: 0, dischToLoctnCd: 0, readmitCd: 0,
    accommodationCd: 0, accommodationRequestCd: 0, accommodationReasonCd: 0, ambulatoryCondCd: 0, courtesyCd: 0,
    isolationCd: cd(e?.isolationCd), medServiceCd: cd(e?.medServiceCd), confidLevelCd: cd(e?.confidLevelCd), vipCd: cd(e?.vipCd),
    locationCd: cd(e?.locationCd), locationOrgId: e ? locationOrg(db, e.locationCd) : 0, locFacilityCd: cd(e?.locFacilityCd),
    locBuildingCd: cd(e?.locBuildingCd),
    /* Production leaves this 0 while filling locNurseUnit (QUIRKS: co5.encounter-nurse-unit-cd). */
    locNurseUnitCd: cd(e?.locNurseUnitCd),
    locRoomCd: cd(e?.locRoomCd), locBedCd: cd(e?.locBedCd), financialClassCd: cd(e?.financialClassCd), traumaCd: 0, triageCd: 0,
    visitorStatusCd: 0,
  };
}

export function encounterDomain(db: MillenniumDb, state: EntryState, now: Date): Json | null {
  if (!state.visits.length) return null;
  const opts = options(state, "encounter");
  const extended = flag(opts, "loadExtendedPersons");
  if (state.reference) {
    refRows(state, "encounters", [["encntrTypeCd", CS.encounterType, "Encounter type"], ["encntrTypeClassCd", CS.encounterTypeClass, "Encounter type class"], ["encntrStatusCd", CS.encounterStatus, "Encounter status"], ["medServiceCd", CS.medService, "Medical service"], ["locationCd", CS.location, "Location"]]);
    return skipJson(state, "encounter") ? null : { encounters: [{ ...encounterCore(db, 0, undefined), aliases: [{}], personReltn: [{}], prsnlReltn: [{}], encntrInfo: [{}], encntrPlanReltn: [{}], locHist: [{}] }] };
  }
  const aliasTypes = typeFilter(db, state, CS.encounterAliasType);
  const prsnlTypes = typeFilter(db, state, CS.encntrPrsnlReltn);
  const rows = state.visits.map((visit) => {
    const enc = db.tables.encounters.find((row) => row.encntrId === visit.encntrId && visit.encntrId > 0);
    const aliases = flag(opts, "aliases") && enc
      ? db.tables.encntrAliases.filter((row) => row.encntrId === enc.encntrId && isCurrent(row, now) && allowedBy(aliasTypes, row.encntrAliasTypeCd)).map((row) => ({
          aliasPool: db.display(row.aliasPoolCd), aliasType: db.display(row.encntrAliasTypeCd), aliasTypeMeaning: db.meaning(row.encntrAliasTypeCd),
          alias: row.alias, aliasFormatted: row.alias, aliasSubType: db.display(row.encntrAliasSubTypeCd), aliasPoolCd: row.aliasPoolCd,
          encntrAliasTypeCd: row.encntrAliasTypeCd, encntrAliasSubTypeCd: row.encntrAliasSubTypeCd,
        }))
      : [];
    const prsnlReltn = flag(opts, "prsnlReltn") && enc
      ? db.tables.encntrPrsnlReltns.filter((row) => row.encntrId === enc.encntrId && isCurrent(row, now) && allowedBy(prsnlTypes, row.encntrPrsnlRCd)).map((row) => {
          const p = db.tables.prsnl.find((x) => x.personId === row.prsnlPersonId);
          if (extended) addPrsnl(state, row.prsnlPersonId);
          return {
            reltnType: db.display(row.encntrPrsnlRCd), reltnTypeMeaning: db.meaning(row.encntrPrsnlRCd), personId: row.prsnlPersonId,
            prioritySeq: row.prioritySeq, internalSeq: row.internalSeq, prsnlType: db.display(p?.prsnlTypeCd ?? 0),
            nameFullFormatted: p?.nameFullFormatted ?? "", physicianInd: p?.physicianInd ?? 0, position: db.display(p?.positionCd ?? 0),
            nameLast: p?.nameLast ?? "", nameFirst: p?.nameFirst ?? "", userName: p?.username ?? "", encntrPrsnlRCd: row.encntrPrsnlRCd,
            prsnlTypeCd: p?.prsnlTypeCd ?? 0, positionCd: p?.positionCd ?? 0,
          };
        })
      : [];
    const locHist = flag(opts, "locHist") && enc
      ? [{
          begEffectiveDtTm: d(enc.regDtTm), endEffectiveDtTm: d(null), arriveDtTm: d(enc.arriveDtTm), arrivePrsnlId: 0, departDtTm: d(null),
          departPrsnlId: 0, location: db.display(enc.locationCd), locFacility: db.display(enc.locFacilityCd), locBuilding: db.display(enc.locBuildingCd),
          locNurseUnit: db.display(enc.locNurseUnitCd), locRoom: db.display(enc.locRoomCd), locBed: db.display(enc.locBedCd),
          encntrType: db.display(enc.encntrTypeCd), medService: db.display(enc.medServiceCd), transactionDtTm: d(enc.regDtTm),
          activityDtTm: d(enc.regDtTm), accommodation: "", accommodationRequest: "", accommodationReason: "", admitType: db.display(enc.admitTypeCd),
          isolation: db.display(enc.isolationCd), organizationId: enc.organizationId, encntrTypeClass: db.display(enc.encntrTypeClassCd),
          locationCd: enc.locationCd, locationOrgId: locationOrg(db, enc.locationCd), locFacilityCd: enc.locFacilityCd, locBuildingCd: enc.locBuildingCd,
          locNurseUnitCd: enc.locNurseUnitCd, locRoomCd: enc.locRoomCd, locBedCd: enc.locBedCd, encntrTypeCd: enc.encntrTypeCd,
          medServiceCd: enc.medServiceCd, accommodationCd: 0, accommodationRequestCd: 0, accommodationReasonCd: 0, admitTypeCd: enc.admitTypeCd,
          isolationCd: enc.isolationCd, encntrTypeClassCd: enc.encntrTypeClassCd,
        }]
      : [];
    if (extended && enc) {
      addParent(state, enc.organizationId, "ORGANIZATION");
      addPrsnl(state, enc.regPrsnlId);
    }
    return { ...encounterCore(db, visit.encntrId, enc), aliases, personReltn: [], prsnlReltn, encntrInfo: [], encntrPlanReltn: [], locHist };
  });
  return skipJson(state, "encounter") ? null : { encounters: rows };
}

/* ---------------------------------------------------------------- person */

function personCore(db: MillenniumDb, personId: number, p: PersonRow | undefined, patient: boolean, now: Date): Json {
  const show = (value: number | undefined) => db.display(value ?? 0);
  return {
    personId, logicalDomainId: p?.logicalDomainId ?? 0, nameFullFormatted: p?.nameFullFormatted ?? "", nameLast: p?.nameLast ?? "",
    nameFirst: p?.nameFirst ?? "", nameMiddle: p?.nameMiddle ?? "", birthDtTm: d(p?.birthDtTm), age: p ? cernerAge(p.birthDtTm, now) : "",
    deceasedDtTm: d(p?.deceasedDtTm), lastEncntrDtTm: d(p?.lastEncntrDtTm), autopsy: show(p?.autopsyCd), deceased: show(p?.deceasedCd),
    ethnicGrp: show(p?.ethnicGrpCd), language: show(p?.languageCd), maritalType: show(p?.maritalTypeCd), race: show(p?.raceCd),
    religion: show(p?.religionCd), sex: show(p?.sexCd), species: show(p?.speciesCd), confidLevel: show(p?.confidLevelCd), vip: show(p?.vipCd),
    interpRequired: patient ? show(p?.interpRequiredCd) : "", livingWill: patient ? show(p?.livingWillCd) : "", gestAgeAtBirth: 0,
    gestAgeMethod: "", healthInfoAccessOffered: "", autopsyCd: p?.autopsyCd ?? 0, deceasedCd: p?.deceasedCd ?? 0, ethnicGrpCd: p?.ethnicGrpCd ?? 0,
    languageCd: p?.languageCd ?? 0, maritalTypeCd: p?.maritalTypeCd ?? 0, raceCd: p?.raceCd ?? 0, religionCd: p?.religionCd ?? 0,
    sexCd: p?.sexCd ?? 0, speciesCd: p?.speciesCd ?? 0, confidLevelCd: p?.confidLevelCd ?? 0, vipCd: p?.vipCd ?? 0,
    interpRequiredCd: patient ? p?.interpRequiredCd ?? 0 : 0, livingWillCd: patient ? p?.livingWillCd ?? 0 : 0, gestAgeMethodCd: 0,
    healthInfoAccessOfferedCd: 0,
  };
}

export function personDomain(db: MillenniumDb, state: EntryState, now: Date): Json | null {
  if (!state.patients.length) return null;
  const opts = options(state, "person");
  if (state.reference) {
    refRows(state, "persons", [["sexCd", CS.sex, "Sex"]]);
    return skipJson(state, "person") ? null : { persons: [{ ...personCore(db, 0, undefined, false, now), aliases: [{}], names: [{}], prsnlReltn: [{}], personReltn: [{}], personPlanReltn: [{}], personOrgReltn: [{}], personInfo: [{}], personCodeReltn: [{}] }] };
  }
  const patient = flag(opts, "patient");
  const aliasTypes = typeFilter(db, state, CS.personAliasType);
  const nameTypes = typeFilter(db, state, CS.nameType);
  const prsnlTypes = typeFilter(db, state, CS.personPrsnlReltn);
  const reltnTypes = typeFilter(db, state, CS.personReltnType);
  const build = (personId: number): Json => {
    const p = db.tables.persons.find((row) => row.personId === personId && isCurrent(row, now));
    const aliases = flag(opts, "aliases") && p
      ? db.tables.personAliases.filter((row) => row.personId === personId && isCurrent(row, now) && allowedBy(aliasTypes, row.personAliasTypeCd)).map((row) => ({
          aliasPool: db.display(row.aliasPoolCd), aliasType: db.display(row.personAliasTypeCd), aliasTypeMeaning: db.meaning(row.personAliasTypeCd),
          alias: row.alias, aliasFormatted: row.personAliasTypeCd === db.byMeaning(CS.personAliasType, "PHN") ? row.alias.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3") : row.alias,
          aliasSubType: db.display(row.personAliasSubTypeCd), visitSeqNbr: row.visitSeqNbr, healthCardProvince: row.healthCardProvince,
          healthCardVerCode: row.healthCardVerCode, healthCardIssueDtTm: d(row.healthCardIssueDtTm), healthCardExpiryDtTm: d(row.healthCardExpiryDtTm),
          healthCardType: row.healthCardType, aliasPoolCd: row.aliasPoolCd, personAliasTypeCd: row.personAliasTypeCd, personAliasSubTypeCd: row.personAliasSubTypeCd,
        }))
      : [];
    const names = flag(opts, "names") && p
      ? db.tables.personNames.filter((row) => row.personId === personId && isCurrent(row, now) && allowedBy(nameTypes, row.nameTypeCd))
          .sort((a, b) => b.begEffective.getTime() - a.begEffective.getTime()).map((row) => ({
            nameType: db.display(row.nameTypeCd), nameTypeMeaning: db.meaning(row.nameTypeCd), begEffectiveDtTm: d(row.begEffective),
            endEffectiveDtTm: d(row.endEffective), nameFullFormatted: row.nameFull, nameFirst: row.nameFirst, nameMiddle: row.nameMiddle,
            nameLast: row.nameLast, nameDegree: row.nameDegree, nameTitle: row.nameTitle, namePrefix: row.namePrefix, nameSuffix: row.nameSuffix,
            nameInitials: row.nameInitials, nameTypeSeq: row.nameTypeSeq, nameTypeCd: row.nameTypeCd,
          }))
      : [];
    /* person→staff links always queue the staff member, whatever the options. */
    const prsnlRows = p ? db.tables.personPrsnlReltns.filter((row) => row.personId === personId && isCurrent(row, now) && allowedBy(prsnlTypes, row.personPrsnlRCd)) : [];
    for (const row of prsnlRows) { addPrsnl(state, row.prsnlPersonId); addParent(state, row.prsnlPersonId, "PERSON"); }
    const prsnlReltn = flag(opts, "prsnlReltn")
      ? prsnlRows.map((row) => {
          const s = db.tables.prsnl.find((x) => x.personId === row.prsnlPersonId);
          return {
            reltnType: db.display(row.personPrsnlRCd), reltnTypeMeaning: db.meaning(row.personPrsnlRCd), personId: row.prsnlPersonId,
            prioritySeq: row.prioritySeq, prsnlType: db.display(s?.prsnlTypeCd ?? 0), nameFullFormatted: s?.nameFullFormatted ?? "",
            physicianInd: s?.physicianInd ?? 0, position: db.display(s?.positionCd ?? 0), nameLast: s?.nameLast ?? "", nameFirst: s?.nameFirst ?? "",
            userName: s?.username ?? "", personPrsnlRCd: row.personPrsnlRCd, prsnlTypeCd: s?.prsnlTypeCd ?? 0, positionCd: s?.positionCd ?? 0,
          };
        })
      : [];
    const personReltn = flag(opts, "personReltn") && p
      ? db.tables.personPersonReltns.filter((row) => row.personId === personId && isCurrent(row, now) && allowedBy(reltnTypes, row.personReltnTypeCd)).map((row) => {
          const other = db.tables.persons.find((x) => x.personId === row.relatedPersonId);
          if (flag(opts, "loadExtendedPersons")) addPatient(state, row.relatedPersonId);
          return {
            personReltnType: db.display(row.personReltnTypeCd), personReltnTypeMeaning: db.meaning(row.personReltnTypeCd), personReltn: db.display(row.personReltnCd),
            relatedPersonReltn: db.display(row.relatedPersonReltnCd), personId: row.relatedPersonId, prioritySeq: row.prioritySeq, internalSeq: row.internalSeq,
            nameFullFormatted: other?.nameFullFormatted ?? "", nameLast: other?.nameLast ?? "", nameFirst: other?.nameFirst ?? "", nameMiddle: other?.nameMiddle ?? "",
            personReltnTypeCd: row.personReltnTypeCd, personReltnCd: row.personReltnCd, relatedPersonReltnCd: row.relatedPersonReltnCd,
          };
        })
      : [];
    return { ...personCore(db, personId, p, patient, now), aliases, names, prsnlReltn, personReltn, personPlanReltn: [], personOrgReltn: [], personInfo: [], personCodeReltn: [] };
  };
  if (present(opts, "orgReltn") || present(opts, "personPlanReltn")) {
    state.notices.push({ kind: "info", message: "person.orgReltn / personPlanReltn: the synthetic chart has no rows for these sections, so the lists are empty." });
  }
  /* loadExtendedPersons: one pass to discover, then the full list once more. */
  if (flag(opts, "loadExtendedPersons")) state.patients.slice().forEach(build);
  const rows = state.patients.map(build);
  return skipJson(state, "person") ? null : { persons: rows };
}

/* ---------------------------------------------------------------- prsnl */

function prsnlCore(db: MillenniumDb, personId: number, p: PrsnlRow | undefined): Json {
  const show = (value: number | undefined) => db.display(value ?? 0);
  return {
    personId, begEffectiveDtTm: d(p?.begEffective), endEffectiveDtTm: d(p?.endEffective), prsnlType: show(p?.prsnlTypeCd),
    prsnlTypeCd: p?.prsnlTypeCd ?? 0, nameFullFormatted: p?.nameFullFormatted ?? "", email: p?.email ?? "", physicianInd: p?.physicianInd ?? 0,
    position: show(p?.positionCd), positionCd: p?.positionCd ?? 0, department: show(p?.departmentCd), departmentCd: p?.departmentCd ?? 0,
    section: show(p?.sectionCd), sectionCd: p?.sectionCd ?? 0, nameLast: p?.nameLast ?? "", nameFirst: p?.nameFirst ?? "", username: p?.username ?? "",
    primAssignLoc: show(p?.primAssignLocCd), primAssignLocCd: p?.primAssignLocCd ?? 0, physicianStatus: show(p?.physicianStatusCd),
    physicianStatusCd: p?.physicianStatusCd ?? 0, logicalDomainGrpId: p?.logicalDomainGrpId ?? 0, logicalDomainId: p?.logicalDomainId ?? 0,
    externalInd: p?.externalInd ?? 0,
  };
}

export function prsnlDomain(db: MillenniumDb, state: EntryState): Json | null {
  for (const entry of list(pick(state.payload, "prsnlSource"))) addPrsnl(state, num(pick(entry, "personId")));
  if (state.reference) {
    refRows(state, "prsnl", [["positionCd", CS.position, "Position"]]);
    return skipJson(state, "prsnl") ? null : { prsnl: [{ ...prsnlCore(db, 0, undefined), aliases: [{}], credential: [{}], prsnlGroup: [{}], prsnlPrsnlReltn: [{}], prsnlOrgReltn: [{}] }] };
  }
  const rows = state.prsnlSource.map((personId) => ({
    ...prsnlCore(db, personId, db.tables.prsnl.find((row) => row.personId === personId)),
    aliases: [], credential: [], prsnlGroup: [], prsnlPrsnlReltn: [], prsnlOrgReltn: [],
  }));
  return skipJson(state, "prsnl") ? null : { prsnl: rows };
}

/* ---------------------------------------------------------------- apo */

export function apoDomain(db: MillenniumDb, state: EntryState, now: Date): Json | null {
  for (const personId of state.patients) addParent(state, personId, "PERSON");
  for (const entry of list(pick(state.payload, "orgSource"))) addParent(state, num(pick(entry, "organizationId")), "ORGANIZATION");
  if (!state.parents.length) return null;
  const wantOrg = present(state.payload, "organization") && present(state.payload, "orgSource");
  if (present(state.payload, "organization") && !present(state.payload, "orgSource")) {
    state.notices.push({ kind: "quirk", code: "co5.apo-organization-needs-org-source", message: "organization was requested without orgSource; production loads organizations only when both are present, so organization is []." });
  }
  /* Production checks diagnosis.skipJSON here; we honour the section's own flag (QUIRKS: co5.apo-skip-json). */
  if (skipJson(state, "address") || skipJson(state, "phone") || skipJson(state, "organization")) return null;
  if (state.reference) {
    refRows(state, "address", [["addressTypeCd", CS.addressType, "Address type"]]);
    refRows(state, "phone", [["phoneTypeCd", CS.phoneType, "Phone type"]]);
    return { apoExecuted: 0, address: [{}], phone: [{}], organization: [{}] };
  }
  const isParent = (id: number, name: string) => state.parents.some((parent) => parent.id === id && parent.name === name);
  const addressTypes = typeFilter(db, state, CS.addressType);
  const phoneTypes = typeFilter(db, state, CS.phoneType);
  /* phone.phoneOption picks cnvtphone's format in production; North American numbers format the same under every option. */
  const address = present(state.payload, "address")
    ? db.tables.addresses.filter((row) => isCurrent(row, now) && isParent(row.parentEntityId, row.parentEntityName) && allowedBy(addressTypes, row.addressTypeCd))
        .sort((a, b) => a.parentEntityId - b.parentEntityId || a.parentEntityName.localeCompare(b.parentEntityName) || db.display(a.addressTypeCd).localeCompare(db.display(b.addressTypeCd)) || a.addressTypeSeq - b.addressTypeSeq)
        .map((row) => ({
          parentEntityId: row.parentEntityId, parentEntityName: row.parentEntityName, addressId: row.addressId, addressTypeCd: row.addressTypeCd,
          addressType: db.display(row.addressTypeCd), addressTypeMeaning: db.meaning(row.addressTypeCd), addressTypeSeq: row.addressTypeSeq,
          activeInd: 1, begEffectiveDtTm: d(row.begEffective), endEffectiveDtTm: d(row.endEffective), streetAddr: row.streetAddr,
          streetAddr2: row.streetAddr2, streetAddr3: row.streetAddr3, streetAddr4: row.streetAddr4, city: row.city, stateCd: row.stateCd,
          state: row.stateCd ? db.display(row.stateCd) : row.state, zipCode: row.zipcode, countyCd: row.countyCd,
          county: row.countyCd ? db.display(row.countyCd) : row.county, countryCd: row.countryCd, country: row.countryCd ? db.display(row.countryCd) : row.country,
        }))
    : [];
  const phone = present(state.payload, "phone")
    ? db.tables.phones.filter((row) => isCurrent(row, now) && isParent(row.parentEntityId, row.parentEntityName) && allowedBy(phoneTypes, row.phoneTypeCd))
        .sort((a, b) => a.parentEntityId - b.parentEntityId || a.parentEntityName.localeCompare(b.parentEntityName) || db.display(a.phoneTypeCd).localeCompare(db.display(b.phoneTypeCd)) || a.phoneTypeSeq - b.phoneTypeSeq)
        .map((row) => ({
          parentEntityId: row.parentEntityId, parentEntityName: row.parentEntityName, phoneId: row.phoneId, phoneTypeCd: row.phoneTypeCd,
          phoneType: db.display(row.phoneTypeCd), phoneTypeMeaning: db.meaning(row.phoneTypeCd), phoneTypeSeq: row.phoneTypeSeq, activeInd: 1,
          begEffectiveDtTm: d(row.begEffective), endEffectiveDtTm: d(row.endEffective), phoneNumber: row.phoneNum,
          phoneFormatted: formatPhone(row.phoneNum), extension: row.extension,
        }))
    : [];
  const organization = wantOrg
    ? state.parents.filter((parent) => parent.name === "ORGANIZATION").flatMap((parent) => {
        const org = db.tables.organizations.find((row) => row.organizationId === parent.id && isCurrent(row, now));
        if (!org) return [];
        return [{
          organizationId: org.organizationId, orgName: org.orgName, federalTaxIdNbr: org.federalTaxIdNbr, orgStatusCd: org.orgStatusCd,
          orgStatus: db.display(org.orgStatusCd), orgClassCd: org.orgClassCd, orgClass: db.display(org.orgClassCd), externalInd: org.externalInd, aliases: [],
        }];
      })
    : [];
  return { apoExecuted: 1, address, phone, organization };
}

/* ---------------------------------------------------------------- allergy */

export function allergyDomain(db: MillenniumDb, state: EntryState, now: Date): Json | null {
  if (!state.patients.length) return null;
  const opts = options(state, "allergy");
  if (state.reference) {
    refRows(state, "allergy", [["substanceTypeCd", CS.substanceType, "Substance type"], ["reactionStatusCd", CS.reactionStatus, "Reaction status"], ["severityCd", CS.severity, "Severity"]]);
    return skipJson(state, "allergy") ? null : { allergies: [{ reaction: [{}], comment: [{}] }] };
  }
  const statusTypes = typeFilter(db, state, CS.reactionStatus);
  const substanceTypes = typeFilter(db, state, CS.substanceType);
  const nom = (id: number) => db.tables.nomenclature.find((row) => row.nomenclatureId === id);
  const rows = db.tables.allergies
    .filter((row) => state.patients.includes(row.personId) && isCurrent(row, now) && allowedBy(statusTypes, row.reactionStatusCd) && allowedBy(substanceTypes, row.substanceTypeCd) && nom(row.substanceNomId))
    .sort((a, b) => a.personId - b.personId || (nom(a.substanceNomId)?.sourceString || a.substanceFtdesc).toUpperCase().localeCompare((nom(b.substanceNomId)?.sourceString || b.substanceFtdesc).toUpperCase()))
    .map((row) => {
      const n = nom(row.substanceNomId);
      return {
        personId: row.personId, encntrId: row.encntrId, allergyId: row.allergyId, allergyInstanceId: row.allergyInstanceId,
        substance: n?.sourceString || row.substanceFtdesc, substanceIdentifier: n?.sourceIdentifier ?? "", substanceFtDesc: row.substanceFtdesc,
        substanceType: db.display(row.substanceTypeCd),
        /* Production leaves these five blank (QUIRKS: co5.allergy-unfilled-fields). */
        substanceTypeMeaning: db.meaning(row.substanceTypeCd), reactionClass: db.display(row.reactionClassCd), severity: db.display(row.severityCd),
        sourceOfInfo: db.display(row.sourceOfInfoCd), sourceOfInfoFt: "", onsetDtTm: d(row.onsetDtTm), reactionStatus: db.display(row.reactionStatusCd),
        createdDtTm: d(row.createdDtTm), createdPrsnlId: row.createdPrsnlId, cancelReason: "", cancelDtTm: d(null), cancelPrsnlId: 0,
        verifiedStatusFlag: 0, recSrcVocab: db.display(n?.sourceVocabularyCd ?? 0), recSrcIdentifer: n?.sourceIdentifier ?? "",
        recSrcString: n?.sourceString ?? "", onsetPrecision: "", onsetPrecisionFlag: 0, reviewedDtTm: d(row.reviewedDtTm),
        reviewedPrsnlId: row.reviewedPrsnlId, origPrsnlId: row.createdPrsnlId, reactionStatusDtTm: d(row.createdDtTm),
        substanceTypeCd: row.substanceTypeCd, reactionClassCd: row.reactionClassCd, severityCd: row.severityCd, sourceOfInfoCd: row.sourceOfInfoCd,
        reactionStatusCd: row.reactionStatusCd, cancelReasonCd: 0, recSrcVocabCd: n?.sourceVocabularyCd ?? 0, onsetPrecisionCd: 0,
        reaction: flag(opts, "reactions") ? row.reactions.map((r) => {
          const rn = nom(r.nomenclatureId);
          return { reaction: rn?.sourceString || r.reactionFtdesc, reactionIdentifier: rn?.sourceIdentifier ?? "", reactionFtdesc: r.reactionFtdesc };
        }).sort((a, b) => a.reaction.toUpperCase().localeCompare(b.reaction.toUpperCase())) : [],
        comment: flag(opts, "comments") ? [...row.comments].sort((a, b) => b.commentDtTm.getTime() - a.commentDtTm.getTime()).map((c) => ({
          commentDtTm: d(c.commentDtTm), commentPrsnlId: c.commentPrsnlId, allergyComment: c.allergyComment.replace(/\r/g, "").replace(/\n/g, "\\n"),
        })) : [],
      };
    });
  if (skipJson(state, "allergy") || !rows.length) return null;
  return { allergies: rows };
}

/* ---------------------------------------------------------------- diagnosis */

export function diagnosisDomain(db: MillenniumDb, state: EntryState, now: Date): Json | null {
  if (!state.visits.length) return null;
  if (state.reference) {
    refRows(state, "diagnosis", [["diagTypeCd", CS.diagnosisType, "Diagnosis type"]]);
    return skipJson(state, "diagnosis") ? null : { diagnosis: [{}] };
  }
  const diagTypes = typeFilter(db, state, CS.diagnosisType);
  const vocab = typeFilter(db, state, CS.sourceVocabulary);
  const nom = (id: number) => db.tables.nomenclature.find((row) => row.nomenclatureId === id);
  if (state.visits.some((visit) => visit.encntrId === 0)) {
    state.notices.push({ kind: "quirk", code: "co5.diagnosis-zero-encounter", message: "A visit with encntrId 0 makes production return every encounter-less diagnosis in the domain, for any person. The simulator limits it to that visit's person." });
  }
  const rows = db.tables.diagnoses
    .filter((row) => isCurrent(row, now) && state.visits.some((visit) => visit.encntrId === row.encntrId && (visit.encntrId > 0 || visit.personId === row.personId)))
    .filter((row) => allowedBy(diagTypes, row.diagTypeCd) && allowedBy(vocab, nom(row.nomenclatureId)?.sourceVocabularyCd ?? 0))
    .map((row) => {
      const n = nom(row.nomenclatureId);
      return {
        personId: row.personId, encntrId: row.encntrId, diagnosisId: row.diagnosisId, nomenclatureId: row.nomenclatureId,
        dxSourceString: n?.sourceString ?? "", dxSourceIdentifier: n?.sourceIdentifier ?? "", dxSourceVocab: db.display(n?.sourceVocabularyCd ?? 0),
        diagDtTm: d(row.diagDtTm), diagType: db.display(row.diagTypeCd), diagnosticCategory: "", diagPriority: row.diagPriority,
        diagPrsnlId: row.diagPrsnlId, diagPrsnlName: db.prsnlName(row.diagPrsnlId), diagClass: "", confidLevel: "", attestationDtTm: d(null),
        diagFtdesc: row.diagFtdesc, modNomenclatureId: 0, modSourceString: "", modSourceIdentifier: "", modSourceVocab: "", diagNote: "",
        conditionQual: "", clinicalService: "", confirmationStatus: db.display(row.confirmationStatusCd), classification: db.display(row.classificationCd),
        /* Production shows the classification display here (QUIRKS: co5.diagnosis-severity-class). */
        severityClass: db.display(row.severityClassCd), certainty: "", probability: 0, diagnosisDisplay: row.diagnosisDisplay, severityFtdesc: "",
        longBlobId: 0, ranking: db.display(row.rankingCd), severity: "", diagnosisGroup: 0, clinicalDiagPriority: row.diagPriority, presentOnAdmit: "",
        hacInd: 0, laterality: "", originatingNomenclatureId: row.nomenclatureId, origDxSourceString: n?.sourceString ?? "",
        origDxSourceIdentifier: n?.sourceIdentifier ?? "", origDxSourceVocab: db.display(n?.sourceVocabularyCd ?? 0), diagTypeCd: row.diagTypeCd,
        dxSourceVocabCd: n?.sourceVocabularyCd ?? 0, diagnosticCategoryCd: 0, diagClassCd: 0, confidLevelCd: 0, modSourceVocabCd: 0,
        conditionalQualCd: 0, clinicalServiceCd: 0, confirmationStatusCd: row.confirmationStatusCd, classificationCd: row.classificationCd,
        severityClassCd: row.severityClassCd, certaintyCd: 0, rankingCd: row.rankingCd, severityCd: 0, presentOnAdmitCd: 0, lateralityCd: 0,
        origDxSourceVocabCd: n?.sourceVocabularyCd ?? 0,
      };
    });
  if (skipJson(state, "diagnosis") || !rows.length) return null;
  return { diagnosis: rows };
}

/* ---------------------------------------------------------------- problem */

export function problemDomain(db: MillenniumDb, state: EntryState, now: Date): Json | null {
  if (!state.patients.length) return null;
  const opts = options(state, "problem");
  if (state.reference) {
    refRows(state, "problem", [["lifeCycleStatusCd", CS.lifeCycleStatus, "Life cycle status"]]);
    return skipJson(state, "problem") ? null : { problem: [{ comment: [{}] }] };
  }
  const lifeCycle = typeFilter(db, state, CS.lifeCycleStatus);
  const vocab = typeFilter(db, state, CS.sourceVocabulary);
  const nom = (id: number) => db.tables.nomenclature.find((row) => row.nomenclatureId === id);
  const rows = db.tables.problems
    .filter((row) => state.patients.includes(row.personId) && isCurrent(row, now) && allowedBy(lifeCycle, row.lifeCycleStatusCd) && allowedBy(vocab, nom(row.nomenclatureId)?.sourceVocabularyCd ?? 0))
    .sort((a, b) => a.personId - b.personId || a.annotatedDisplay.toUpperCase().localeCompare(b.annotatedDisplay.toUpperCase()))
    .map((row) => {
      const n = nom(row.nomenclatureId);
      return {
        personId: row.personId, problemInstanceId: row.problemInstanceId, problemId: row.problemId, nomenclatureId: row.nomenclatureId,
        probSourceString: n?.sourceString ?? "", probSourceIdentifier: n?.sourceIdentifier ?? "", probSourceVocabCd: n?.sourceVocabularyCd ?? 0,
        problemFtdesc: row.problemFtdesc, estimatedResolutionDtTm: d(null), actualResolutionDtTm: d(null), classificationCd: row.classificationCd,
        persistenceCd: 0, confirmationStatusCd: row.confirmationStatusCd, lifeCycleStatusCd: row.lifeCycleStatusCd, lifeCycleDtTm: d(row.begEffective),
        onsetDtCd: 0, onsetDtTm: d(row.onsetDtTm), rankingCd: 0, certaintyCd: 0, probability: 0, personAwareCd: 0, prognosisCd: 0,
        personAwarePrognosisCd: 0, familyAwareCd: 0, sensitivity: 0, courseCd: 0, cancelReasonCd: 0, onsetDtFlag: 0, statusUpdtPrecisionCd: 0,
        statusUpdtFlag: 0, statusUpdtDtTm: d(row.begEffective), qualifierCd: 0, annotatedDisplay: row.annotatedDisplay, severityClassCd: 0,
        severityCd: 0, severityFtdesc: "", lifeCycleDtCd: 0, lifeCycleDtFlag: 0, problemTypeFlag: 0, lateralityCd: 0,
        originatingNomenclatureId: row.nomenclatureId, origProbSourceString: n?.sourceString ?? "", origProbSourceIdentifier: n?.sourceIdentifier ?? "",
        origProbSourceVocabCd: n?.sourceVocabularyCd ?? 0,
        comment: flag(opts, "comments") ? [...row.comments].sort((a, b) => b.commentDtTm.getTime() - a.commentDtTm.getTime()).map((c) => ({
          commentDtTm: d(c.commentDtTm), commentPrsnlId: c.commentPrsnlId, problemComment: c.problemComment.replace(/\r/g, "").replace(/\n/g, "\\n"),
        })) : [],
      };
    });
  /* Production checks diagnosis.skipJSON here (QUIRKS: co5.problem-skip-json). */
  if (skipJson(state, "problem") || !rows.length) return null;
  return { problem: rows };
}
