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
 */

// Field fragments for composing queries

/**
 * Full chart fields - all patient data fields
 */
export const fullChartFields = `
  patientId
  chartNumber
  name { text first middle family prefix suffix }
  birthDate
  deceasedDate
  preferredPhone { code display system }
  telecom { cellPhone homePhone workPhone workExt email }
  administrativeGender { code display }
  preferredGender { code display }
  insuranceBy { code display system }
  insuranceNumber
  address {
    use line city state postalCode country
  }
  maritalStatus { code display }
  language { code display }
  race { code display }
  ethnicity { code display }
  religion { code display }
  active
  firstNationStatus { code display }
  contacts {
    contactId
    name { text first middle family }
    relationship { code display }
    telecom { cellPhone homePhone workPhone email }
    address { line city state postalCode }
  }
  encounters {
    encounterId
    type { code display }
    status { code display }
    period { start end }
    serviceProvider
    location
  }
  observations {
    observationId
    code { code display system }
    value
    effectiveDateTime
    status
  }
  conditions {
    conditionId
    code { code display }
    clinicalStatus { code display }
    onsetDateTime
    recordedDate
  }
  medications {
    medicationId
    code { code display }
    status
    authoredOn
    dosageInstruction
  }
  allergies {
    allergyId
    code { code display }
    type
    category
    criticality
    recordedDate
  }
`;

/**
 * Name block fields - minimal fields for displaying patient name
 */
export const nameBlockFields = `
  patientId
  chartNumber
  name { text first middle family prefix suffix }
  birthDate
  administrativeGender { code display }
  preferredPhone { code display system }
`;

/**
 * Query all for testing - complete query for test scenarios
 */
export const queryAllForTestingFields = `
  patientId
  chartNumber
  name { text first middle family prefix suffix }
  birthDate
  deceasedDate
  preferredPhone { code display system }
  telecom { cellPhone homePhone workPhone workExt email }
  administrativeGender { code display }
  preferredGender { code display }
  insuranceBy { code display system }
  insuranceNumber
  address {
    use line city state postalCode country
  }
  maritalStatus { code display }
  language { code display }
  race { code display }
  ethnicity { code display }
  religion { code display }
  active
  firstNationStatus { code display }
`;

/**
 * Minimal chart fields - essential patient identification
 */
export const minimalChartFields = `
  patientId
  chartNumber
  name { text first middle family }
  birthDate
  preferredPhone { code display system }
  telecom { cellPhone homePhone workPhone workExt }
  administrativeGender { code display }
  preferredGender { code display }
  insuranceBy { code display system }
  insuranceNumber
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
