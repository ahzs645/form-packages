
const commonSchemaDefn = {

  coding: {
    type: "object",
    properties: {
      code:     { type: ["string", "null"] },
      display:  { type: ["string", "null"] },
      system:   { type: ["string", "null"] },
    },
  },
  codings: {
    type: "array",
    items: {
      type: "object",
      properties: {
        code:     { type: ["string", "null"] },
        display:  { type: ["string", "null"] },
        system:   { type: ["string", "null"] },
      },
    },
  },

  "date":         { "type": [ "string", "null" ] },

  selectedItems: {
    type: "array",
    items: {
      type: "object",
      properties: {},
    }
  },

  "ynu": {
    type: "object",
    properties: {
      code:     { type: ["string", "null"] },
      display:  { type: ["string", "null"] },
      system:   { type: ["string", "null"] },
    },
  },

}

const nameBlockSchema = {
  "basicDemographics": {
    "type": "object",
    "properties": {
      "patientId":    { "type": "number" },
      "chartNumber":  { "type": "number" },
      "name": {
        "type": "object",
        "properties": {
          "text":   { "type": ["string", "null"] },
          "first":  { "type": ["string", "null"] },
          "middle": { "type": ["string", "null"] },
          "family": { "type": ["string", "null"] },
        }
      },
      "birthDate":  { "$ref": "#/definitions/date" },
      "telecom": {
        "homePhone": { "type": ["string", "null"] },
        "workPhone": { "type": ["string", "null"] },
        "cellPhone": { "type": ["string", "null"] },
      },
      "preferredPhone":       { "$ref": "#/definitions/coding" },
      "administrativeGender": { "$ref": "#/definitions/coding" },
      "preferredGender":      { "$ref": "#/definitions/coding" },
      "insuranceNumber":      { "type": ["string", "null"] },
      "insuranceBy":          { "$ref": "#/definitions/coding" },
    },
    "required": [ "patientId", "chartNumber", "name", "birthDate", "administrativeGender" ],
    "additionalProperties": false
  },
}

const NameBlockFields = `
patientId
chartNumber
name { text first middle family }
administrativeGender { code display system }
preferredGender { code display system }
maritalStatus { code display system }
insuranceBy { code display system }
birthDate
insuranceNumber
preferredPhone { code display system }
telecom { homePhone workPhone cellPhone }
`

const formHistorySchema = {
  createdBy:      { type: "string" },
  createdAt:      { $ref: "#/definitions/coding" },
  dateCreated:    { $ref: "#/definitions/date" },
}

const selectAll = ()=>true
const startDateDesc = (a,b) => -a.startDate.localeCompare(b.startDate)

const ynuaOptions=[
  { order: 1, code: "Y", display: "Yes", system: "AIHS-YESNOUNKNOWN", hotKey: "Y" },
  { order: 2, code: "N", display: "No", system: "AIHS-YESNOUNKNOWN", hotKey: "N" },          
  { order: 3, code: "U", display: "Unknown / Not Asked", system: "AIHS-YESNOUNKNOWN", hotKey: "U" },
]

/** Returns a list of observation updates for text values. Assumes a single observation with the same code */
const makeTextObsUpdates = (
  sd: SourceDataType,
  fd: ActiveDataType,
  observationCode: string,
  testName: string,
  valueField: string = "See report",
  report: string,
  template: Observation = {},
  conditional: boolean = true,         // Observation should exist only if true
): Observation[] => {

  const active = fd.field.data
  const oldObs = sd.webform?.observations?.find(o=>o.observationCode===observationCode)
  const oldObsId = oldObs?.observationId ?? 0

  if (conditional) {                // There should be an observation

    const newDco = {
      observationId: oldObsId,
      collectedDate: active.dateCreated,
      collectedBy: active.createdBy ?? sd.userProfile?.identity?.fullName,
      orderedBy: active.createdBy ?? sd.userProfile?.identity?.fullName,
      observationCode,
      observationClass: "DCOBS",
      value: valueField,
      units: "",
      valueType: "TEXT",
      status: oldObsId ? "C" : "F",
      description: testName,
      report: report,
      ...template,
    }
    return [newDco]

  } else if (oldObsId) {        // Existing observation, but conditional is now false
    return [{ observationId: -oldObsId }] // Delete obsolete value
  }
}


/** Returns a list of observation updates for code values. Assumes a single observation with the same code */
const makeCodedObsUpdates = (
  sd: SourceDataType,
  fd: ActiveDataType,
  fieldId: string,
  observationCode: string,
  codingField: string = "code",
  template: Observation = {},
  conditional: boolean = true,         // Observation should exist only if true
): Observation[] => {

  const active = fd.field.data
  const oldObs = sd.webform?.observations?.find(o=>o.observationCode===observationCode)
  const oldObsId = oldObs?.observationId ?? 0

  if (conditional) {                // There should be an observation
    if (active?.[fieldId]?.code) {   // There is a code to set

      const newDco = {
        observationId: oldObsId,
        collectedDate: active.dateCreated,
        collectedBy: active.createdBy ?? sd.userProfile?.identity?.fullName,
        orderedBy: active.createdBy ?? sd.userProfile?.identity?.fullName,
        observationCode,
        observationClass: "DCOBS",
        value: active[fieldId][codingField],
        units: "",
        // Using "TEXT" and not "VALUESET" so that values are locked to form
        valueType: "TEXT",
        status: oldObsId ? "C" : "F",
        ...template,
      }
      return [newDco]
    } else if (oldObsId) {      // Existing observation, but no new one
      return [{ observationId: -oldObsId }] // Delete obsolete value
    }

  } else if (oldObsId) {        // Existing observation, but conditional is now false
    return [{ observationId: -oldObsId }] // Delete obsolete value
  }
}

const makeValueSetOptions = (
  sd: SourceDataType,
  vs: {
    observationCode: string,
    fbCodeDisplay: string,    // Note: always used since code lookup is not in 2.26
    fbSystem: string,
    fbOptions: any,
  }
) => {
  const valueSet = sd.optionLists["AIHS-LABCODEVALUESETS"]?.[vs.observationCode] ?? vs.fbSystem
  const options = {
    code: vs.observationCode,
    display: vs.fbCodeDisplay,
    codeSystem: valueSet,
    optionList: sd.optionLists[valueSet] ?? vs.fbOptions,
  }
  return options
}

const makeObsUpdatesFromVs = (
  sd: SourceDataType,
  fd: ActiveDataType,
  vs: any,              // Value set description
  report: string,       // Defaults to code display value
  conditional: boolean = true,         // Observation should exist only if true
) => {
  const vso = makeValueSetOptions(sd,vs)
  return makeCodedObsUpdates(
    sd,
    fd,
    vs.fieldId,
    vso.code,
    "code",
    { description: vso.display, report: report ?? fd.field.data[vs.fieldId]?.display ?? null },
    conditional
  )
}
