/**
 * Synthetic Millennium tables.
 *
 * Only the columns the simulated CCL programs read are modelled. Field names
 * are the column names in camelCase, so a row maps onto a CNVTRECTOJSON
 * record field without renaming. Every table that real scripts filter by
 * activity keeps `active` plus an effective window; `endEffective` null means
 * open-ended (Millennium's 2100-12-31).
 *
 * Nothing here is real patient data: the seed builds it from the emulator's
 * invented ZZZTEST roster.
 */

export interface Effective {
  active: boolean;
  begEffective: Date;
  endEffective: Date | null;
}

export interface CodeValueRow {
  codeValue: number;
  codeSet: number;
  cdfMeaning: string;
  display: string;
  displayKey: string;
  description: string;
  definition: string;
  cki: string;
  conceptCki: string;
  collationSeq: number;
  active: boolean;
  endEffective: Date | null;
}

export interface PrsnlRow extends Effective {
  personId: number;
  nameFullFormatted: string;
  nameLast: string;
  nameFirst: string;
  username: string;
  email: string;
  positionCd: number;
  physicianInd: number;
  prsnlTypeCd: number;
  departmentCd: number;
  sectionCd: number;
  primAssignLocCd: number;
  physicianStatusCd: number;
  logicalDomainId: number;
  logicalDomainGrpId: number;
  externalInd: number;
}

export interface PersonRow extends Effective {
  personId: number;
  logicalDomainId: number;
  nameFullFormatted: string;
  nameLast: string;
  nameFirst: string;
  nameMiddle: string;
  birthDtTm: Date | null;
  deceasedDtTm: Date | null;
  lastEncntrDtTm: Date | null;
  sexCd: number;
  languageCd: number;
  maritalTypeCd: number;
  raceCd: number;
  religionCd: number;
  ethnicGrpCd: number;
  vipCd: number;
  confidLevelCd: number;
  deceasedCd: number;
  autopsyCd: number;
  speciesCd: number;
  /** PERSON_PATIENT columns (the `patient` option). */
  interpRequiredCd: number;
  livingWillCd: number;
}

export interface PersonAliasRow extends Effective {
  personId: number;
  alias: string;
  personAliasTypeCd: number;
  personAliasSubTypeCd: number;
  aliasPoolCd: number;
  visitSeqNbr: number;
  healthCardProvince: string;
  healthCardVerCode: string;
  healthCardType: string;
  healthCardIssueDtTm: Date | null;
  healthCardExpiryDtTm: Date | null;
}

export interface PersonNameRow extends Effective {
  personId: number;
  nameTypeCd: number;
  nameFull: string;
  nameFirst: string;
  nameMiddle: string;
  nameLast: string;
  nameDegree: string;
  nameTitle: string;
  namePrefix: string;
  nameSuffix: string;
  nameInitials: string;
  nameTypeSeq: number;
}

export interface PersonPrsnlReltnRow extends Effective {
  personId: number;
  prsnlPersonId: number;
  personPrsnlRCd: number;
  prioritySeq: number;
}

export interface PersonPersonReltnRow extends Effective {
  personId: number;
  relatedPersonId: number;
  personReltnTypeCd: number;
  personReltnCd: number;
  relatedPersonReltnCd: number;
  prioritySeq: number;
  internalSeq: number;
}

export interface EncounterRow extends Effective {
  encntrId: number;
  personId: number;
  encntrClassCd: number;
  encntrTypeCd: number;
  encntrTypeClassCd: number;
  encntrStatusCd: number;
  regDtTm: Date | null;
  regPrsnlId: number;
  arriveDtTm: Date | null;
  dischDtTm: Date | null;
  inpatientAdmitDtTm: Date | null;
  admitTypeCd: number;
  medServiceCd: number;
  locationCd: number;
  locFacilityCd: number;
  locBuildingCd: number;
  locNurseUnitCd: number;
  locRoomCd: number;
  locBedCd: number;
  organizationId: number;
  reasonForVisit: string;
  financialClassCd: number;
  isolationCd: number;
  vipCd: number;
  confidLevelCd: number;
}

export interface EncntrAliasRow extends Effective {
  encntrId: number;
  alias: string;
  encntrAliasTypeCd: number;
  encntrAliasSubTypeCd: number;
  aliasPoolCd: number;
}

export interface EncntrPrsnlReltnRow extends Effective {
  encntrId: number;
  prsnlPersonId: number;
  encntrPrsnlRCd: number;
  prioritySeq: number;
  internalSeq: number;
}

/** ENCNTR_DOMAIN: the census index (one row per current inpatient bed). */
export interface EncntrDomainRow extends Effective {
  encntrId: number;
  personId: number;
  locFacilityCd: number;
  locNurseUnitCd: number;
}

export interface OrganizationRow extends Effective {
  organizationId: number;
  orgName: string;
  orgNameKey: string;
  federalTaxIdNbr: string;
  orgStatusCd: number;
  orgClassCd: number;
  externalInd: number;
}

export interface AddressRow extends Effective {
  addressId: number;
  parentEntityId: number;
  parentEntityName: "PERSON" | "ORGANIZATION";
  addressTypeCd: number;
  addressTypeSeq: number;
  streetAddr: string;
  streetAddr2: string;
  streetAddr3: string;
  streetAddr4: string;
  city: string;
  stateCd: number;
  state: string;
  zipcode: string;
  countyCd: number;
  county: string;
  countryCd: number;
  country: string;
}

export interface PhoneRow extends Effective {
  phoneId: number;
  parentEntityId: number;
  parentEntityName: "PERSON" | "ORGANIZATION";
  phoneTypeCd: number;
  phoneTypeSeq: number;
  phoneNum: string;
  extension: string;
}

export interface NomenclatureRow {
  nomenclatureId: number;
  sourceString: string;
  sourceIdentifier: string;
  sourceVocabularyCd: number;
}

export interface AllergyRow extends Effective {
  allergyId: number;
  allergyInstanceId: number;
  personId: number;
  encntrId: number;
  substanceNomId: number;
  substanceFtdesc: string;
  substanceTypeCd: number;
  reactionClassCd: number;
  severityCd: number;
  sourceOfInfoCd: number;
  reactionStatusCd: number;
  onsetDtTm: Date | null;
  createdDtTm: Date | null;
  createdPrsnlId: number;
  reviewedDtTm: Date | null;
  reviewedPrsnlId: number;
  reactions: { nomenclatureId: number; reactionFtdesc: string }[];
  comments: { commentDtTm: Date; commentPrsnlId: number; allergyComment: string }[];
}

export interface ProblemRow extends Effective {
  problemId: number;
  problemInstanceId: number;
  personId: number;
  nomenclatureId: number;
  problemFtdesc: string;
  annotatedDisplay: string;
  lifeCycleStatusCd: number;
  classificationCd: number;
  confirmationStatusCd: number;
  onsetDtTm: Date | null;
  comments: { commentDtTm: Date; commentPrsnlId: number; problemComment: string }[];
}

export interface DiagnosisRow extends Effective {
  diagnosisId: number;
  personId: number;
  encntrId: number;
  nomenclatureId: number;
  diagFtdesc: string;
  diagnosisDisplay: string;
  diagDtTm: Date | null;
  diagTypeCd: number;
  diagPriority: number;
  diagPrsnlId: number;
  confirmationStatusCd: number;
  classificationCd: number;
  severityClassCd: number;
  rankingCd: number;
}

export interface LocationRow {
  locationCd: number;
  locationTypeCd: number;
  /** LOCATION_GROUP parent (0 for facilities). */
  parentLocationCd: number;
  organizationId: number;
  censusInd: number;
  active: boolean;
}

export interface DmInfoRow {
  infoDomain: string;
  infoName: string;
  infoDate: string;
  infoChar: string;
  infoNumber: number;
  infoDomainId: number;
  longTextId: number;
  updtDtTm: Date;
  updtId: number;
}

export interface LongTextRow {
  longTextId: number;
  parentEntityName: string;
  longText: string;
  active: boolean;
}

/** CUST_CO_REFERENCE / cust_nh_wf_reference: one chunk per row. */
export interface RefDataRow {
  refId: number;
  refName: string;
  refTask: string;
  description: string;
  parentEntityId: number;
  parentEntityName: string;
  sequence: number;
  refText: string;
  active: boolean;
  createPrsnlId: number;
  createDtTm: Date;
  updtId: number;
  updtDtTm: Date;
  begEffective: Date;
  endEffective: Date;
}

/** CLINICAL_EVENT parent + DOC child with its blob, collapsed into one row. */
export interface ClinicalDocumentRow {
  parentEventId: number;
  eventId: number;
  personId: number;
  encntrId: number;
  eventCd: number;
  eventTitleText: string;
  eventEndDtTm: Date;
  resultStatusCd: number;
  formatCd: number;
  /** The document body as stored (plain text, HTML or RTF per formatCd). */
  blob: string;
  performPrsnlId: number;
}

/** A Bedrock MPage component registered against a namespace. */
export interface BedrockComponentRow {
  label: string;
  namespace: string;
}

export interface PatientListRow {
  patientListId: number;
  name: string;
  members: { personId: number; encntrId: number }[];
}

export interface MillenniumTables {
  codeValues: CodeValueRow[];
  prsnl: PrsnlRow[];
  persons: PersonRow[];
  personAliases: PersonAliasRow[];
  personNames: PersonNameRow[];
  personPrsnlReltns: PersonPrsnlReltnRow[];
  personPersonReltns: PersonPersonReltnRow[];
  encounters: EncounterRow[];
  encntrAliases: EncntrAliasRow[];
  encntrPrsnlReltns: EncntrPrsnlReltnRow[];
  encntrDomains: EncntrDomainRow[];
  organizations: OrganizationRow[];
  addresses: AddressRow[];
  phones: PhoneRow[];
  nomenclature: NomenclatureRow[];
  allergies: AllergyRow[];
  problems: ProblemRow[];
  diagnoses: DiagnosisRow[];
  locations: LocationRow[];
  dmInfo: DmInfoRow[];
  longText: LongTextRow[];
  refData: RefDataRow[];
  documents: ClinicalDocumentRow[];
  bedrockComponents: BedrockComponentRow[];
  patientLists: PatientListRow[];
}
