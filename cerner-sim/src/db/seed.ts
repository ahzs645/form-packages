import { END_OF_TIME, MillenniumDb, toKey } from "./db";
import type { Effective, PrsnlRow } from "./types";

/**
 * Seeds a synthetic Millennium domain from a small chart roster.
 *
 * The roster shape is the PowerChart emulator's own Patient record, so the
 * same invented ZZZTEST charts the emulator shows are the ones CCL answers
 * about. Code values carry the CDF meanings the real scripts filter on
 * (MRN, FIN NBR, HOME, ATTENDDOC, …); their numeric ids are synthetic and
 * never claim to be any site's.
 */

/** Code sets the simulated programs read, by their Millennium numbers. */
export const CS = {
  personAliasType: 4,
  activeStatus: 48,
  eventClass: 53,
  sex: 57,
  encounterTypeClass: 69,
  encounterType: 71,
  eventCode: 72,
  position: 88,
  resultStatus: 8,
  nameType: 213,
  addressType: 212,
  location: 220,
  locationType: 222,
  encounterStatus: 261,
  noteFormat: 23,
  storage: 25,
  medService: 34,
  dischDisposition: 19,
  phoneType: 43,
  encounterAliasType: 319,
  personPrsnlReltn: 331,
  encntrPrsnlReltn: 333,
  personReltnType: 351,
  diagnosisType: 17,
  sourceVocabulary: 400,
  substanceType: 12020,
  reactionClass: 12021,
  severity: 12022,
  sourceOfInfo: 12023,
  reactionStatus: 12025,
  lifeCycleStatus: 12030,
  confirmationStatus: 12031,
  orgClass: 396,
  personType: 302,
  prsnlType: 309,
} as const;

/** One chart in the roster (the emulator's Patient record). */
export interface SimPatientInput {
  /** Medical record number; also the person id when numeric. */
  chart: string;
  /** Financial (FIN) number. */
  encounter: string;
  first: string;
  middle?: string;
  last: string;
  /** YYYY.MM.DD or YYYY-MM-DD. */
  dob: string;
  gender: "M" | "F" | "";
  /** "Unit / Room / Bed" as the banner prints it. */
  location?: string;
  /** "Last, First MD". */
  provider?: string;
  /** "A, B", "No Known Allergies", or blank. */
  allergies?: string;
  encounterType?: string;
  home?: string;
  address?: string;
  city?: string;
  province?: string;
  postal?: string;
  /** BC Personal Health Number. */
  bchn?: string;
  /** YYYY.MM.DD registration date. */
  registered?: string;
  /** Explicit ids; default derive from chart / encounter. */
  personId?: number;
  encntrId?: number;
}

export interface SeedOptions {
  /** The signed-in user. */
  user?: { personId: number; nameLast: string; nameFirst: string; username: string; position: string; physician: boolean };
  domain?: string;
  contentServiceUrl?: string;
  /** Reference time for ages and "now"; default the current time. */
  now?: Date;
  /** Bedrock MPage components (label + namespace) the domain has registered. */
  bedrockComponents?: { label: string; namespace: string }[];
  /** Patient lists (1co5_get_patient_list). Default: one list holding every chart. */
  patientLists?: { patientListId: number; name: string; members: { personId: number; encntrId: number }[] }[];
}

/** The components a fresh synthetic domain has in Bedrock: ours, registered the Clinical Office way and our own way. */
export const DEFAULT_BEDROCK_COMPONENTS = [
  { label: "Webforms Player", namespace: "clinical_office.mpage_component" },
  { label: "Webforms Demo Component", namespace: "clinical_office.mpage_component" },
  { label: "Webforms Form", namespace: "webforms.mpage_component" },
];

const BEGINNING = new Date("2000-01-01T00:00:00.000Z");
const live = (): Effective => ({ active: true, begEffective: BEGINNING, endEffective: null });

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})[.-](\d{2})[.-](\d{2})/.exec(value.trim());
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 8, 0, 0));
}

/** Deterministic FNV-1a alias for a non-numeric key, in a range that never claims a real id. */
export function stableNumericId(value: string, prefix: string): number {
  if (/^\d+$/.test(value) && Number(value) > 0 && Number.isSafeInteger(Number(value))) return Number(value);
  let hash = 2166136261;
  for (const char of prefix + value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return 1000000000 + (hash >>> 0);
}

/** The default user: a DBA-position physician, as a developer's test account would be. */
export const DEFAULT_SIM_USER = {
  personId: 4122622,
  nameLast: "WEBFORMS",
  nameFirst: "DEVELOPER",
  username: "WFDEV",
  position: "DBA",
  physician: true,
};

function seedCodes(db: MillenniumDb) {
  const add = (codeSet: number, cdfMeaning: string, display: string, extra: { description?: string; cki?: string } = {}) =>
    db.addCode({ codeSet, cdfMeaning, display, ...extra });
  const sets: [number, [string, string][]][] = [
    [CS.personAliasType, [["MRN", "MRN"], ["CMRN", "Community Medical Record Number"], ["PHN", "BC PHN"]]],
    [CS.encounterAliasType, [["FIN NBR", "FIN NBR"], ["VISITID", "Visit Id"], ["MRN", "MRN"]]],
    [CS.activeStatus, [["ACTIVE", "Active"], ["INACTIVE", "Inactive"]]],
    [CS.sex, [["MALE", "Male"], ["FEMALE", "Female"], ["UNKNOWN", "Unknown"]]],
    [CS.encounterTypeClass, [["INPATIENT", "Inpatient"], ["OUTPATIENT", "Outpatient"], ["EMERGENCY", "Emergency"], ["RECURRING", "Recurring"]]],
    [CS.encounterType, [["INPATIENT", "Inpatient"], ["OUTPATIENT", "Outpatient"], ["EMERGENCY", "Emergency"], ["RECURRING", "Recurring"], ["AMBULATORY", "Ambulatory"]]],
    [CS.encounterStatus, [["ACTIVE", "Active"], ["DISCHARGED", "Discharged"]]],
    [CS.position, [["DBA", "DBA"], ["PHYSICIAN", "Physician"], ["NURSE", "Nurse"], ["CLERK", "Unit Clerk"]]],
    [CS.nameType, [["CURRENT", "Current"], ["PREFERRED", "Preferred"]]],
    [CS.addressType, [["HOME", "Home"], ["BUSINESS", "Business"], ["MAILING", "Mailing"]]],
    [CS.phoneType, [["HOME", "Home"], ["BUSINESS", "Business"], ["MOBILE", "Mobile"]]],
    [CS.locationType, [["FACILITY", "Facility"], ["BUILDING", "Building"], ["NURSEUNIT", "Nurse Unit"], ["AMBULATORY", "Ambulatory"], ["ROOM", "Room"], ["BED", "Bed"]]],
    [CS.encntrPrsnlReltn, [["ATTENDDOC", "Attending Physician"], ["ADMITDOC", "Admitting Physician"]]],
    [CS.personPrsnlReltn, [["PCP", "Primary Care Physician"]]],
    [CS.personReltnType, [["EMC", "Emergency Contact"], ["NOK", "Next of Kin"]]],
    [CS.medService, [["MEDICINE", "Medicine"], ["OBSTETRICS", "Obstetrics"], ["EMERGENCY", "Emergency Medicine"], ["FAMILYPRAC", "Family Practice"], ["HOMEHEALTH", "Home Health"], ["PEDIATRICS", "Pediatrics"]]],
    [CS.dischDisposition, [["HOME", "Home"]]],
    [CS.diagnosisType, [["FINAL", "Final"], ["WORKING", "Working"], ["DISCHARGE", "Discharge"]]],
    [CS.sourceVocabulary, [["ICD10-CA", "ICD-10-CA"], ["SNOMED CT", "SNOMED CT"], ["MUL.ALGCAT", "Multum Allergy Category"]]],
    [CS.substanceType, [["DRUG", "Drug"], ["FOOD", "Food"], ["ENVIRONMENT", "Environment"]]],
    [CS.reactionClass, [["ALLERGY", "Allergy"], ["INTOLERANCE", "Intolerance"]]],
    [CS.severity, [["MILD", "Mild"], ["MODERATE", "Moderate"], ["SEVERE", "Severe"]]],
    [CS.sourceOfInfo, [["PATIENT", "Patient"], ["FAMILY", "Family"]]],
    [CS.reactionStatus, [["ACTIVE", "Active"], ["CANCELED", "Canceled"], ["RESOLVED", "Resolved"]]],
    [CS.lifeCycleStatus, [["ACTIVE", "Active"], ["RESOLVED", "Resolved"], ["INACTIVE", "Inactive"]]],
    [CS.confirmationStatus, [["CONFIRMED", "Confirmed"], ["PROBABLE", "Probable"]]],
    [CS.noteFormat, [["AS", "ASCII Text"], ["HTML", "HTML"], ["RTF", "Rich Text"]]],
    [CS.storage, [["BLOB", "Blob"]]],
    [CS.eventClass, [["DOC", "Document"], ["MDOC", "Multi-Document"]]],
    [CS.resultStatus, [["AUTH", "Auth (Verified)"], ["MODIFIED", "Modified"]]],
    [CS.eventCode, [["", "Progress Note"], ["", "Webforms Document"], ["", "Nursing Admission Assessment"]]],
    [CS.orgClass, [["ORG", "Organization"]]],
    [CS.personType, [["PERSON", "Person"]]],
    [CS.prsnlType, [["USER", "User"]]],
  ];
  for (const [codeSet, rows] of sets) for (const [meaning, display] of rows) add(codeSet, meaning, display);
}

/** "Unit / Room / Bed" plus facility, as code set 220 rows linked by LOCATION_GROUP. */
class LocationBuilder {
  private cache = new Map<string, number>();
  constructor(private db: MillenniumDb, private facilityOrg: number) {}

  private node(display: string, type: string, parent: number, description = display): number {
    const key = `${parent}|${display}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const typeCd = this.db.byMeaning(CS.locationType, type);
    const codeValue = this.db.addCode({ codeSet: CS.location, cdfMeaning: type, display, description });
    this.db.tables.locations.push({ locationCd: codeValue, locationTypeCd: typeCd, parentLocationCd: parent, organizationId: this.facilityOrg, censusInd: type === "NURSEUNIT" ? 1 : 0, active: true });
    this.cache.set(key, codeValue);
    return codeValue;
  }

  facility(display: string, description: string) { return this.node(display, "FACILITY", 0, description); }

  /** Parse the banner text into facility → building → unit → room → bed codes. */
  place(facility: number, building: number, text: string | undefined) {
    const parts = (text ?? "").split("/").map((part) => part.trim()).filter(Boolean);
    const unitText = (parts[0] ?? "").replace(/^NHGH\s*/i, "").trim() || "Main";
    const ambulatory = /clinic|home health|ambulatory/i.test(unitText);
    const unit = this.node(unitText, ambulatory ? "AMBULATORY" : "NURSEUNIT", building, `${unitText} unit`);
    const room = parts[1] ? this.node(parts[1], "ROOM", unit) : 0;
    const bed = room && parts[2] ? this.node(parts[2], "BED", room) : 0;
    return { facility, building, unit, room, bed };
  }
}

function splitProvider(text: string): { last: string; first: string; suffix: string } {
  const [last = "", rest = ""] = text.split(",").map((part) => part.trim());
  const words = rest.split(/\s+/).filter(Boolean);
  const suffix = words.length > 1 && /^(MD|NP|RN|DO)$/i.test(words[words.length - 1]) ? words.pop()! : "";
  return { last, first: words.join(" "), suffix };
}

function addPrsnl(db: MillenniumDb, input: { personId?: number; last: string; first: string; suffix?: string; position: string; physician: boolean; username?: string }): number {
  const personId = input.personId ?? db.allocateId();
  const full = `${input.last}, ${input.first}${input.suffix ? ` ${input.suffix}` : ""}`;
  const row: PrsnlRow = {
    ...live(),
    personId,
    nameFullFormatted: full,
    nameLast: input.last,
    nameFirst: input.first,
    username: input.username ?? toKey(`${input.first.slice(0, 1)}${input.last}`),
    email: "",
    positionCd: db.byMeaning(CS.position, input.position),
    physicianInd: input.physician ? 1 : 0,
    prsnlTypeCd: db.byMeaning(CS.prsnlType, "USER"),
    departmentCd: 0,
    sectionCd: 0,
    primAssignLocCd: 0,
    physicianStatusCd: 0,
    logicalDomainId: 0,
    logicalDomainGrpId: 0,
    externalInd: 0,
  };
  db.tables.prsnl.push(row);
  return personId;
}

function encounterClassFor(type: string | undefined): string {
  const text = (type ?? "").toUpperCase();
  if (text.includes("EMERG")) return "EMERGENCY";
  if (text.includes("RECUR")) return "RECURRING";
  if (text.includes("AMBUL") || text.includes("OUTPAT")) return "OUTPATIENT";
  return "INPATIENT";
}

/**
 * Build a synthetic domain from a roster. Each chart gets a person, its
 * aliases (MRN, PHN), a current name, home address and phone, one encounter
 * with FIN and attending physician, allergies from the banner text, and a
 * census row when inpatient.
 */
export function seedMillenniumDb(roster: readonly SimPatientInput[], options: SeedOptions = {}): MillenniumDb {
  const db = new MillenniumDb();
  const now = options.now ?? new Date();
  seedCodes(db);

  const user = options.user ?? DEFAULT_SIM_USER;
  addPrsnl(db, { personId: user.personId, last: user.nameLast, first: user.nameFirst, position: user.position, physician: user.physician, username: user.username });

  const orgId = db.allocateId();
  db.tables.organizations.push({ ...live(), organizationId: orgId, orgName: "Northern Health Training Hospital", orgNameKey: toKey("Northern Health Training Hospital"), federalTaxIdNbr: "", orgStatusCd: db.byMeaning(CS.activeStatus, "ACTIVE"), orgClassCd: db.byMeaning(CS.orgClass, "ORG"), externalInd: 0 });

  const locations = new LocationBuilder(db, orgId);
  const facility = locations.facility("NHGH", "Northern Health Training Hospital");
  const building = db.addCode({ codeSet: CS.location, cdfMeaning: "BUILDING", display: "NHGH Main", description: "NHGH Main Building" });
  db.tables.locations.push({ locationCd: building, locationTypeCd: db.byMeaning(CS.locationType, "BUILDING"), parentLocationCd: facility, organizationId: orgId, censusInd: 0, active: true });

  db.tables.dmInfo.push({
    infoDomain: "INS", infoName: "CONTENT_SERVICE_URL",
    infoChar: options.contentServiceUrl ?? "http://webforms-sim.local/mpages",
    infoDate: "", infoNumber: 0, infoDomainId: 0, longTextId: 0, updtDtTm: now, updtId: user.personId,
  });

  const providers = new Map<string, number>();
  const providerId = (text: string | undefined) => {
    if (!text) return 0;
    const known = providers.get(text);
    if (known) return known;
    const parsed = splitProvider(text);
    const id = addPrsnl(db, { last: parsed.last.toUpperCase(), first: parsed.first.toUpperCase(), suffix: parsed.suffix, position: "PHYSICIAN", physician: true });
    providers.set(text, id);
    return id;
  };

  const allergyNom = new Map<string, number>();
  const nomenclature = (text: string, vocab: string) => {
    const known = allergyNom.get(text);
    if (known) return known;
    const nomenclatureId = db.allocateId();
    db.tables.nomenclature.push({ nomenclatureId, sourceString: text, sourceIdentifier: toKey(text).slice(0, 12), sourceVocabularyCd: db.byMeaning(CS.sourceVocabulary, vocab) });
    allergyNom.set(text, nomenclatureId);
    return nomenclatureId;
  };
  /* Millennium's zero rows, which inner joins rely on. */
  db.tables.nomenclature.push({ nomenclatureId: 0, sourceString: "", sourceIdentifier: "", sourceVocabularyCd: 0 });

  /* One working diagnosis per visit and a chronic problem for adults, so the
     diagnosis and problem programs have something to return. Invented. */
  const DIAGNOSIS_BY_SERVICE: Record<string, string> = {
    MEDICINE: "Community acquired pneumonia", OBSTETRICS: "Spontaneous vaginal delivery", EMERGENCY: "Chest pain",
    HOMEHEALTH: "Surgical wound care", FAMILYPRAC: "Essential hypertension",
  };

  for (const patient of roster) {
    const personId = patient.personId ?? stableNumericId(patient.chart, "person:");
    const encntrId = patient.encntrId ?? stableNumericId(patient.encounter || `${patient.chart}-visit`, "encounter:");
    const first = patient.first.toUpperCase();
    const last = patient.last.toUpperCase();
    const middle = (patient.middle ?? "").toUpperCase();
    const full = `${last}, ${first}${middle ? ` ${middle}` : ""}`;
    const birth = parseDate(patient.dob);
    const registered = parseDate(patient.registered) ?? now;
    const sexCd = db.byMeaning(CS.sex, patient.gender === "M" ? "MALE" : patient.gender === "F" ? "FEMALE" : "UNKNOWN");

    db.tables.persons.push({
      ...live(), personId, logicalDomainId: 0, nameFullFormatted: full, nameLast: last, nameFirst: first, nameMiddle: middle,
      birthDtTm: birth, deceasedDtTm: null, lastEncntrDtTm: registered, sexCd,
      languageCd: 0, maritalTypeCd: 0, raceCd: 0, religionCd: 0, ethnicGrpCd: 0, vipCd: 0, confidLevelCd: 0,
      deceasedCd: 0, autopsyCd: 0, speciesCd: 0, interpRequiredCd: 0, livingWillCd: 0,
    });
    db.tables.personNames.push({
      ...live(), personId, nameTypeCd: db.byMeaning(CS.nameType, "CURRENT"), nameFull: full, nameFirst: first, nameMiddle: middle,
      nameLast: last, nameDegree: "", nameTitle: "", namePrefix: "", nameSuffix: "", nameInitials: `${first[0] ?? ""}${last[0] ?? ""}`, nameTypeSeq: 1,
    });
    const alias = (type: string, value: string, extra: Partial<{ healthCardProvince: string; healthCardType: string }> = {}) =>
      db.tables.personAliases.push({
        ...live(), personId, alias: value, personAliasTypeCd: db.byMeaning(CS.personAliasType, type), personAliasSubTypeCd: 0,
        aliasPoolCd: 0, visitSeqNbr: 0, healthCardProvince: extra.healthCardProvince ?? "", healthCardVerCode: "",
        healthCardType: extra.healthCardType ?? "", healthCardIssueDtTm: null, healthCardExpiryDtTm: null,
      });
    alias("MRN", patient.chart);
    if (patient.bchn) alias("PHN", patient.bchn.replace(/\s+/g, ""), { healthCardProvince: patient.province ?? "BC", healthCardType: "PHN" });

    if (patient.address || patient.city) {
      db.tables.addresses.push({
        ...live(), addressId: db.allocateId(), parentEntityId: personId, parentEntityName: "PERSON",
        addressTypeCd: db.byMeaning(CS.addressType, "HOME"), addressTypeSeq: 1, streetAddr: patient.address ?? "",
        streetAddr2: "", streetAddr3: "", streetAddr4: "", city: patient.city ?? "", stateCd: 0, state: patient.province ?? "",
        zipcode: patient.postal ?? "", countyCd: 0, county: "", countryCd: 0, country: "Canada",
      });
    }
    if (patient.home) {
      db.tables.phones.push({
        ...live(), phoneId: db.allocateId(), parentEntityId: personId, parentEntityName: "PERSON",
        phoneTypeCd: db.byMeaning(CS.phoneType, "HOME"), phoneTypeSeq: 1, phoneNum: patient.home.replace(/\D/g, ""), extension: "",
      });
    }

    const place = locations.place(facility, building, patient.location);
    const typeClass = encounterClassFor(patient.encounterType);
    const encounterTypeCd = db.byDisplayKey(CS.encounterType, patient.encounterType ?? "") || db.byMeaning(CS.encounterType, typeClass);
    const attending = providerId(patient.provider);
    db.tables.encounters.push({
      ...live(), encntrId, personId,
      encntrClassCd: 0, encntrTypeCd: encounterTypeCd, encntrTypeClassCd: db.byMeaning(CS.encounterTypeClass, typeClass),
      encntrStatusCd: db.byMeaning(CS.encounterStatus, "ACTIVE"), regDtTm: registered, regPrsnlId: user.personId,
      arriveDtTm: registered, dischDtTm: null, inpatientAdmitDtTm: typeClass === "INPATIENT" ? registered : null,
      admitTypeCd: 0, medServiceCd: db.byMeaning(CS.medService, typeClass === "EMERGENCY" ? "EMERGENCY" : /matern/i.test(patient.location ?? "") ? "OBSTETRICS" : typeClass === "RECURRING" ? "HOMEHEALTH" : "MEDICINE"),
      locationCd: place.bed || place.room || place.unit, locFacilityCd: place.facility, locBuildingCd: place.building,
      locNurseUnitCd: place.unit, locRoomCd: place.room, locBedCd: place.bed, organizationId: orgId,
      reasonForVisit: "", financialClassCd: 0, isolationCd: 0, vipCd: 0, confidLevelCd: 0,
    });
    if (patient.encounter) {
      db.tables.encntrAliases.push({ ...live(), encntrId, alias: patient.encounter, encntrAliasTypeCd: db.byMeaning(CS.encounterAliasType, "FIN NBR"), encntrAliasSubTypeCd: 0, aliasPoolCd: 0 });
    }
    if (attending) {
      db.tables.encntrPrsnlReltns.push({ ...live(), encntrId, prsnlPersonId: attending, encntrPrsnlRCd: db.byMeaning(CS.encntrPrsnlReltn, "ATTENDDOC"), prioritySeq: 1, internalSeq: 0 });
      db.tables.personPrsnlReltns.push({ ...live(), personId, prsnlPersonId: attending, personPrsnlRCd: db.byMeaning(CS.personPrsnlReltn, "PCP"), prioritySeq: 1 });
    }
    if (typeClass === "INPATIENT" || typeClass === "EMERGENCY") {
      db.tables.encntrDomains.push({ ...live(), encntrId, personId, locFacilityCd: place.facility, locNurseUnitCd: place.unit });
    }

    const service = db.meaning(db.tables.encounters[db.tables.encounters.length - 1].medServiceCd);
    const dxText = DIAGNOSIS_BY_SERVICE[service] ?? (typeClass === "OUTPATIENT" ? "Essential hypertension" : "");
    if (dxText) {
      db.tables.diagnoses.push({
        ...live(), diagnosisId: db.allocateId(), personId, encntrId, nomenclatureId: nomenclature(dxText, "ICD10-CA"), diagFtdesc: "",
        diagnosisDisplay: dxText, diagDtTm: registered, diagTypeCd: db.byMeaning(CS.diagnosisType, "WORKING"), diagPriority: 1,
        diagPrsnlId: attending, confirmationStatusCd: db.byMeaning(CS.confirmationStatus, "CONFIRMED"), classificationCd: 0, severityClassCd: 0, rankingCd: 0,
      });
    }
    if (birth && now.getUTCFullYear() - birth.getUTCFullYear() >= 40) {
      const problemId = db.allocateId();
      db.tables.problems.push({
        ...live(), problemId, problemInstanceId: problemId, personId, nomenclatureId: nomenclature("Essential hypertension", "SNOMED CT"),
        problemFtdesc: "", annotatedDisplay: "Essential hypertension", lifeCycleStatusCd: db.byMeaning(CS.lifeCycleStatus, "ACTIVE"),
        classificationCd: 0, confirmationStatusCd: db.byMeaning(CS.confirmationStatus, "CONFIRMED"), onsetDtTm: null, comments: [],
      });
    }

    const allergyText = (patient.allergies ?? "").trim();
    if (allergyText && !/no known allergies/i.test(allergyText)) {
      for (const substance of allergyText.split(",").map((part) => part.trim()).filter(Boolean)) {
        const allergyId = db.allocateId();
        db.tables.allergies.push({
          ...live(), allergyId, allergyInstanceId: allergyId, personId, encntrId, substanceNomId: nomenclature(substance, "MUL.ALGCAT"),
          substanceFtdesc: "", substanceTypeCd: db.byMeaning(CS.substanceType, /latex/i.test(substance) ? "ENVIRONMENT" : "DRUG"),
          reactionClassCd: db.byMeaning(CS.reactionClass, "ALLERGY"), severityCd: db.byMeaning(CS.severity, "MODERATE"),
          sourceOfInfoCd: db.byMeaning(CS.sourceOfInfo, "PATIENT"), reactionStatusCd: db.byMeaning(CS.reactionStatus, "ACTIVE"),
          onsetDtTm: null, createdDtTm: registered, createdPrsnlId: user.personId, reviewedDtTm: registered, reviewedPrsnlId: user.personId,
          reactions: [{ nomenclatureId: nomenclature("Rash", "SNOMED CT"), reactionFtdesc: "" }],
          comments: [],
        });
      }
    }
  }

  db.tables.bedrockComponents.push(...(options.bedrockComponents ?? DEFAULT_BEDROCK_COMPONENTS));
  db.tables.patientLists.push(...(options.patientLists ?? [{
    patientListId: 5000001,
    name: "My Patients",
    members: db.tables.encounters.map((row) => ({ personId: row.personId, encntrId: row.encntrId })),
  }]));
  return db;
}

/** Keep END_OF_TIME reachable for consumers writing their own rows. */
export { END_OF_TIME };
