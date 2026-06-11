/**
 * Query Archetype
 * GraphQL queries that are widely used for querying patient charts.
 *
 * The Patient.Query archetype defines graphQL queries that are widely used,
 * like obtaining everything in a patient chart or just querying a minimal
 * amount of data for a chart.
 *
 * The query names that end with "...Fields" are fragments containing field
 * lists that are intended to be embedded inside of full queries and composed
 * with other lists.
 *
 * IMPORTANT: fullChartFields, minimalChartFields, and nameBlockFields below
 * are verbatim copies of the real MOIS engine fragments (extracted from the
 * FormTester bundle, 2026-06-11). Exported forms interpolate the REAL
 * Mois.Query.fullChartFields at load time, so this file is reference/preview
 * material — but it must match the real schema so authors do not learn wrong
 * field shapes from it. Do not re-introduce FHIR-style selections
 * (code{}/period{}/effectiveDateTime); MOIS uses flat native naming.
 *
 * Note: the real fullChartFields does NOT select patient-level observations
 * (only observationPanels.observations). The exporter auto-appends an
 * observations selection when a form reads observation history.
 */

// Field fragments for composing queries

/**
 * Full chart fields - verbatim real MOIS fullChartFields fragment.
 */
export const fullChartFields = `
patientId
name { prefix first middle family suffix text }
nickName {first family text}
actions {
  action
  completedDate
  detail
  endDate
  encounterId
  isCompleted { code display system }
  isSensitive { code display system }
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
active { code display system }
address { city country line1
  line2
  postalCode
  province
  text
}
administrativeGender { code display system }
aliasIdentifiers {
  aliasIdentifierId
  attachmentCount
  comment
  effectiveDate
  identifier
  identifierType { code display system }
  includeOnDemographics
  patientId
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
allergies {
  adverseDocumenter { code display system }
  adverseInformant { code display system }
  adverseObserver { code display system }
  allergyId
  atcCode
  atcName
  comment
  encounterId
  intoleranceType
  isDrug
  onsetLifeStage { code display system }
  patientId
  reactions
  reason
  startDate
  stopDate
  substance
  substanceCode
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
activeChanged
benefitPayorCoverages {
  benefitPayorCoverageId
  benefitPlanCoverages {
    benefitPayorCoverageId
    benefitPlanCoverageId
    coverage
    endDate
    note
    plan { code display system }
    startDate
    stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
  }
  endDate
  note
  patientId
  payor { code display system }
  startDate
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
birthDate
insuranceDependent
chartNumber
insuranceBy { code display system }
insuranceNumber
insuranceBenefitSource
healthNumber
healthNumberBy
religion
patientId
photoDocumentId
conditions {
  certainty { code display system }
  comment
  condition { code display system }
  conditionId
  encounterId
  isSensitive { code display system }
  patientId
  resolveDate
  severity { code display system }
  startDate
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
connections {
  attachmentCount
  className
  comment
  connectionId
  connectionType { code display system }
  includeOnDemographics { code display system }
  isCareTeamMember { code display system }
  name
  patientId
  provider { code name source sourceId }
  providerType { code display system }
  startDate
  stopDate
  stopNote
  stopReason { code display system }
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
contacts {
  address { city country line1
    line2
    postalCode
    province
    text
  }
  associatedPartyId
  includeOnDemographics { code display system }
  isMemberOfCareTeam { code display system }
  name
  note
  patientId
  preferredPhone { code display system }
  relationshipType { code display system }
  relationship
  relationshipCode { code display system }
  telecom {
    cellPhone
    faxNumber
    homeEmail
    homeMessage
    homePhone
    pagerNumber
    text
    workEmail
    workExt
    workMessage
    workPhone
  }
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
chartLocation
countryOfOrigin { code display system }
cursor
race1 { code display isSelfIdentified system type }
race2 { code display isSelfIdentified system type }
race3 { code display isSelfIdentified system type }
religion
deceasedDate
documents {
  attachedEncounterId
  author
  authorRole
  authorType
  comment
  documentDate
  documentId
  encounterId
  note
  attachedTo { objectType objectId }
  pathname
  patientId
  recordState
  stateHistory {
    stateHistoryId
    userName
    userProfileId
    changeDate
    changeTime
    note
    recordState
    stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
  }
  secondaryPathname
  sentTo
  serviceRequestId
  templateSource { code display system }
  templateName
  templateId
  sourceVenue
  documentType { code display system }
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
  tasks {
    acknowledgedBy
    acknowledgedDate
    assignedUserId
    assignedUser {
      identity { fullName signature }
      loginName
      providerId
      userProfileId
      userRoleId
    }
    completedBy
    completedDate
    createdDate
    description
    dueDate
    note
    requestorId
    taskId 
    isAcknowledged { code display system }
    isComplete { code display system }
    priority { code display system }
    stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
  }
}
educationLevel {
  code
  display
  system
}
encounters {
  appointmentDateTime
  admission {
    referringReasonNote
    note
    admissionDateTime
    referringInstitution {
      system
      code
      display
    }
    referringPerson {
      system
      code
      display
    }
    referringReason {
      system
      code
      display
    }
  }
  arrivedDateTime
  attachmentCount
  attendingProvider { code display system   moisProviderId }
  billingStatus { code display system }
  cancelledDateTime
  chartAssignedDateTime
  chartNumber
  correspondences {
    correspondenceId
    when
    person
    contact
    direction
    note
  }
  dischargeDateTime
  documentStatus { code display system }
  encounterFormCount
  encounterId
  groupVisitId
  healthIssues { code display system }
  inRoomDateTime
  location
  name { first family text }
  notes {
    encounterNoteId
    encounterId
    authorUserProfileId
    creatorUserProfileId
    noteCreationDate
    note
    isComplete { code display system }
    extraInfoTemplate
    extraInfo
  }
  officeNote
  patientId
  payor { code display system }
  priority { code display system }
  provider { providerId name }
  providerId
  resourceId
  seenDateTime
  roomNumber
  serviceGroup { serviceGroupId name }
  serviceGroupId
  services { code display system count phase }
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
  status { code display system }
  taskCount
  tasks {
    acknowledgedBy
    acknowledgedDate
    assignedUserId
    assignedUser {
      identity { fullName signature }
      loginName
      providerId
      userProfileId
      userRoleId
    }
    completedBy
    completedDate
    createdDate
    description
    documentId
    dueDate
    encounterId
    note
    requestorId
    taskId 
    isAcknowledged { code display system }
    isComplete { code display system }
    priority { code display system }
    stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
  }
  timeSlots
  visitCode { code display system }
  visitMode { code display system }
  visitReason1 { code display system }
  visitReason2 { code display system }
}
firstNationStatus { code display system }
genderComment
genotypicGender { code display system }
goals {
  detail
  encounterId
  endDate
  expectedOutcome
  goal
  goalId
  patientId
  startDate
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
language { code display system }
lastContactDate
longTermMedications {
  longTermMedicationId
  atcCode { system code display }
  carriesDPW
  cdicCode { system code display }
  comment
  dailyDose
  dailyDoseUnits { system code display }
  deliveryNotAuthorized { system code display }
  dispenseQuantity
  dispenseQuantityUnits { system code display }
  doNotAdapt { system code display }
  doNotSubstitute { system code display }
  dose
  doseFrequency
  doseType
  doseUnits
  drugDurations {
    drugDurationId
    dosages {
      dosageId
      drugDurationId
      doseQuantity
      doseUnits { system code display }
      route { system code display }
      frequency { system code display }
      sequenceNumber
    }
    durationEnd
    durationStart
    durationUnits { system code display }
    numberOfUnits
    sequenceNumber
  }
  encounterId
  endDate
  genericName
  indication { system code display }
  instruction
  isOAT { system code display }
  isOATDual { system code display }
  medication
  orderedBy
  orderingProvider { system code display }
  partFill { system code display }
  partFillQuantity
  partFillUnits { system code display }
  partFillFrequency { system code display }
  patientId
  prn { system code display }
  prnDailyMaximum
  prnDoseUnits { system code display }
  prnFrequencyHigh
  prnFrequencyLow
  prnFrequencyUnits { system code display }
  prnRangeHigh
  prnRangeLow
  route
  saferSupply { system code display }
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
  startDate
  type
  witnessIngestionDPW
}
maritalStatus { code display system }
multipleBirth { code display system }
note
occupations {
  classification { code display system }
  employer
  employerAddress { city country line1
    line2
    postalCode
    province
    text
  }
  endDate
  faxNumber
  note
  occupationId
  patientId
  phone1
  phone2
  startDate
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
observationPanels {
  observationPanelId
  collectedComment
  copyTo
  facility
  fillerReferenceNumber
  notes
  observations {
    observationId
    abnormalFlag { code display system }
    attachmentCount
    codedValue { code display system }
    collectedBy
    collectedComment
    collectedDateTime
    comment
    copyTo
    description
    encounterId
    fillerReferenceNumber
    loincCode
    observationClass
    observationCode
    orderDate
    orderedBy
    orderId
    orderName
    panelSequenceNumber
    performedBy
    performedDateTime
    placerReferenceNumber
    rangeAbsurdHigh
    rangeAbsurdLow
    rangeNormalHigh
    rangeNormalLow
    rangeVeryHigh
    rangeVeryLow
    recordState { code display system }
    referenceRangeText
    report
    reportedBy
    reportedDate
    stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
    status
    units
    value
    valueType
  }  
  collectedDateTime
  orderedBy
  orderingSystem
  panelName { code display system }
  patientId
  placerReferenceNumber
  orderDateTime
  reportedDateTime
  interfaceType
  specimenReceivedDateTime
  status
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
preferences {
  attachmentCount 
  classification { code display system }
  codedSubject { code display system }
  encounterId
  endDate
  includeOnDemographics { code display system }
  instruction { code display system }
  instructionDetail
  preference
  preferenceType { code display system }
  reason { code display system }
  reasonDetail
  reportBy { code display system }
  reportMethod { code display system }
  sensitive { code display system }
  startDate
  subjectCodeType { code display system }
  subjectConceptName
  subjectDetail
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
preferredPhone { code display system }
preferredGender { code display system }
preferredPharmacy { description name phone }
prescriptions {
  prescriptionId
  administrationSpecification
  atcCode { system code display }
  carriesDPW
  cdicCode { system code display }
  comment
  dailyDose
  dailyDoseAlpha
  dailyDoseUnits { system code display }
  deliveryNotAuthorized { system code display }
  dispenseQuantity
  dispenseQuantityAlpha
  dispenseQuantityUnits { system code display }
  dispenseSpecification
  doNotAdapt { system code display }
  doNotSubstitute { system code display }
  doseType
  drugDurations {
    drugDurationId
    dosages {
      dosageId
      drugDurationId
      doseQuantity
      doseUnits { system code display }
      route { system code display }
      frequency { system code display }
      sequenceNumber
    }
    durationEnd
    durationStart
    durationUnits { system code display }
    numberOfUnits
    sequenceNumber
  }
  encounterId
  folioNumber
  genericName
  indication { system code display }
  isOAT { system code display }
  isOATDual { system code display }
  lastPrinted
  medication
  orderDate
  orderingProvider { system code display }
  partFill { system code display }
  partFillQuantity
  partFillUnits { system code display }
  partFillFrequency { system code display }
  patientId
  prescriptionNarrative
  prn { system code display }
  prnDailyMaximum
  prnDoseUnits { system code display }
  prnEnd
  prnFrequencyHigh
  prnFrequencyLow
  prnFrequencyUnits { system code display }
  prnRangeHigh
  prnRangeLow
  prnStart
  repeat { system code display }
  repeatCount
  saferSupply { system code display }
  signingMethod
  type
  witnessIngestionDPW
  witnessIngestionDPWAlpha
}
prescriptionLogs {
  prescriptionLogId
  providerId
  userProfileId
  encounterId
  createdBy
  createdDate
  logItems {
    prescriptionLogItemId
    prescriptionLogId
    prescriptionId
    administrationSpecification
    comment
    dispenseSpecification
    doNotAdapt { system code display }
    doNotSubstitute { system code display }
    doseType
    medication
    orderDate
    prn { system code display }
    repeat { system code display }
    repeatCount
  }
  method
  printBy
  printDate
  signed { system code display }
  signedBy
  type
  workStation
}
stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
shortNote
serviceEpisodes {
  encounterId
  includeOnCarePlan { code display system }
  includeOnDemographics { code display system }
  endDate
  note
  service { code display system }
  serviceEpisodeId
  serviceMrp { code display system }
  startDate
  stopNote
  stopReason { code display system }
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
serviceRequests {
  encounterId
  order { code display system }
  orderDate
  orderedBy
  orderHour
  orderMinute
  performedBy
  serviceRequestId
  serviceRequestType { code display system }
  status { code display system }
  stamp { createMachine createSource createTime createUser createUserRole createVersion modifyTime modifyUser modifyUserRole }
}
telecom {
  cellPhone
  faxNumber
  homeEmail
  homeMessage
  homePhone
  pagerNumber
  text
  workEmail
  workExt
  workMessage
  workPhone
}
  `;

/**
 * Name block fields - verbatim real MOIS nameBlockFields fragment.
 * (In the real engine minimalChartFields and nameBlockFields are the same
 * fragment.)
 */
export const nameBlockFields = `
patientId
chartNumber
name { text first middle family }
administrativeGender { code display system }
preferredGender { code display system }
maritalStatus { code display system }
insuranceBy { code display system }
birthDate
insuranceNumber
healthNumber
healthNumberBy
preferredPhone { code display system }
telecom { homePhone workPhone cellPhone }
`;

/**
 * Minimal chart fields - identical to nameBlockFields in the real engine.
 */
export const minimalChartFields = nameBlockFields;

/**
 * Query-all-for-testing fields. The real engine assembles this fragment at
 * runtime (full chart plus className/classVersion metadata on every
 * collection); this preview approximation is the full chart plus the
 * patient-level observations selection.
 */
export const queryAllForTestingFields = `
${fullChartFields}
observations {
  observationId
  abnormalFlag { code display system }
  codedValue { code display system }
  collectedBy
  collectedDateTime
  comment
  description
  encounterId
  observationClass
  observationCode
  orderedBy
  patientId
  reportedBy
  reportedDate
  status
  units
  value
  valueType
}
`;

// Full query strings

/**
 * Full chart query - retrieves complete patient chart
 */
export const fullChart = `
query openFullChart ($patientId: Int) {
  patient(id: $patientId) {
    ${fullChartFields}
  }
}
`;

/**
 * Minimal chart query - retrieves basic patient identification
 */
export const minimalChart = `
query openMinimalChart ($patientId: Int) {
  patient(id: $patientId) {
    ${minimalChartFields}
  }
}
`;

/**
 * Query all for testing - complete test query
 */
export const queryAllForTesting = `
query queryAllForTesting ($patientId: Int) {
  patient(id: $patientId) {
    ${queryAllForTestingFields}
  }
}
`;

// Export as Query object for Mois.Patient.Query pattern
export const Query = {
  fullChartFields,
  nameBlockFields,
  queryAllForTesting,
  queryAllForTestingFields,
  fullChart,
  minimalChart,
  minimalChartFields,
};

export default Query;
