/**
 * SubformScoring - Modal subform supporting scoring and data-entry modes.
 *
 * mode="scoring": existing behavior, opens ScoringModule in a dialog.
 * mode="data-entry": opens regular fields in a dialog with optional calculations.
 *
 * Runtime packaging note:
 * NHForms loads this file as source text and executes it in one injected scope.
 * Keep the dependency-ordered sections below in this single compilation unit
 * until both runtime loaders, the generator, MOIS export packaging, and the
 * source-level characterization harness support ordered source fragments.
 *
 * Calculations and totals are evaluated by FormulaKit from their stored trees;
 * ValueKit reads options and answers; DefaultsKit reads and resolves each
 * entry's default answer when the subform opens on an empty answer; FieldKit
 * draws each data-entry question with the MOIS control the exporter chooses;
 * DialogKit draws the dialog (RowDialog on the MOIS SubForm). All of them
 * (and FormLogicKit) are referenced only inside function bodies (component
 * files load in no guaranteed order).
 */

// =====================================================================
// Injected-scope bindings
// =====================================================================

const { useState, useMemo, useCallback, useEffect } = React
const {
  Stack,
  Label,
  Text,
  PrimaryButton,
  Toggle,
} = Fluent

// =====================================================================
// Form-session bridge
// =====================================================================

var __SubformScoringSessionContext = (() => {
  const root = typeof globalThis !== "undefined"
    ? globalThis
    : (typeof window !== "undefined" ? window : {})
  if (!root.__MOIS_FORM_STATE_CONTEXT__) {
    root.__MOIS_FORM_STATE_CONTEXT__ = React.createContext(null)
  }
  return root.__MOIS_FORM_STATE_CONTEXT__
})()

var __cloneSubformScoringSessionValue = (value, fallback) => {
  const target = value === undefined ? fallback : value
  return JSON.parse(JSON.stringify(target))
}

var cloneFormSessionState = typeof cloneFormSessionState !== "undefined"
  ? cloneFormSessionState
  : (fd) => ({
      field: {
        data: __cloneSubformScoringSessionValue(fd?.field?.data, {}),
        status: __cloneSubformScoringSessionValue(fd?.field?.status, {}),
        history: __cloneSubformScoringSessionValue(Array.isArray(fd?.field?.history) ? fd.field.history : [], []),
      },
      uiState: {
        ...__cloneSubformScoringSessionValue(fd?.uiState || {}, {}),
        sections: __cloneSubformScoringSessionValue(fd?.uiState?.sections ?? {}, {}),
      },
      tempArea: __cloneSubformScoringSessionValue(fd?.tempArea || {}, {}),
    })

var mergeFormSessionState = typeof mergeFormSessionState !== "undefined"
  ? mergeFormSessionState
  : (draft, sessionState) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data) draft.field.data = {}
      if (!draft.field.status) draft.field.status = {}
      if (!Array.isArray(draft.field.history)) draft.field.history = []

      Object.entries(sessionState?.field?.data || {}).forEach(([fieldId, value]) => {
        draft.field.data[fieldId] = __cloneSubformScoringSessionValue(value, null)
      })
      Object.entries(sessionState?.field?.status || {}).forEach(([fieldId, value]) => {
        draft.field.status[fieldId] = __cloneSubformScoringSessionValue(value, null)
      })
      if (sessionState?.tempArea && typeof sessionState.tempArea === "object") {
        draft.tempArea = {
          ...(draft.tempArea || {}),
          ...__cloneSubformScoringSessionValue(sessionState.tempArea, {}),
        }
      }
    }

var FormSessionProvider = typeof FormSessionProvider !== "undefined"
  ? FormSessionProvider
  : ({ children, initialFormData }) => {
      const normalize = (input) => cloneFormSessionState(input)
      const [formData, setFormDataState] = useState(() => normalize(initialFormData))

      useEffect(() => {
        setFormDataState(normalize(initialFormData))
      }, [initialFormData])

      const setFormData = useCallback((updater) => {
        setFormDataState((prev) => {
          if (typeof updater === "function") {
            try {
              const next = cloneFormSessionState(prev)
              const result = updater(next)
              return cloneFormSessionState(result || next)
            } catch (error) {
              return prev
            }
          }
          if (updater && typeof updater === "object") {
            return cloneFormSessionState({ ...prev, ...updater })
          }
          return prev
        })
      }, [])

      return (
        <__SubformScoringSessionContext.Provider value={{ formData, setFormData }}>
          {children}
        </__SubformScoringSessionContext.Provider>
      )
    }

var useFormSessionData = typeof useFormSessionData !== "undefined"
  ? useFormSessionData
  : (selector) => {
      const sessionContext = React.useContext(__SubformScoringSessionContext)
      const [fallbackData, fallbackSetData] = useActiveData(selector)
      const normalizedSessionData = useMemo(() => {
        if (!sessionContext?.formData) return null
        return {
          ...sessionContext.formData,
          field: sessionContext.formData.field || { data: {}, status: {}, history: [] },
          uiState: {
            sections: {},
            ...(sessionContext.formData.uiState || {}),
            sections: sessionContext.formData.uiState?.sections || {},
          },
          tempArea: sessionContext.formData.tempArea || {},
        }
      }, [sessionContext])
      const sessionSetFormData = useCallback((updater) => {
        sessionContext?.setFormData?.(updater)
      }, [sessionContext])
      if (!sessionContext) return [fallbackData, fallbackSetData]
      const selected = selector ? selector(normalizedSessionData) : normalizedSessionData
      const selectedWithSetter =
        selected && typeof selected === "object" && !Array.isArray(selected)
          ? { ...selected, setFormData: sessionSetFormData }
          : selected
      const scopedSetter = (updates) => {
        if (!selector) {
          sessionSetFormData(updates)
          return
        }
        sessionSetFormData((draft) => {
          const target = selector(draft)
          if (!target || typeof target !== "object") return
          if (typeof updates === "function") {
            const result = updates(target)
            if (result && typeof result === "object") Object.assign(target, result)
            return
          }
          if (updates && typeof updates === "object") Object.assign(target, updates)
        })
      }
      return [selectedWithSetter, scopedSetter]
    }

// =====================================================================
// Scoring module: option resolution and answer normalization
// =====================================================================

const _resolveQuestionOptions = (question, sharedOptions) => {
  const questionOptions = Array.isArray(question?.options) ? question.options : []
  if (questionOptions.length > 0) return questionOptions
  return Array.isArray(sharedOptions) ? sharedOptions : []
}

// A scoring option's stored key (its explicit key or id, else ValueKit's code)
// and score (ValueKit's reading, 0 when it has none).
const _scoringOptionKey = (option) => {
  const explicit = option && typeof option === "object" ? option.key ?? option.id : undefined
  return explicit !== undefined && explicit !== null ? explicit : ValueKit.normalizeOption(option).code
}
const _scoringOptionScore = (option) => {
  const score = ValueKit.normalizeOption(option).score
  return Number.isFinite(score) ? score : 0
}

const _buildScoreMap = (questions, sharedOptions) => {
  const map = new Map()
  for (const question of questions || []) {
    const optionMap = new Map()
    for (const opt of _resolveQuestionOptions(question, sharedOptions)) {
      optionMap.set(_scoringOptionKey(opt), _scoringOptionScore(opt))
    }
    map.set(question.id, optionMap)
  }
  return map
}

const _resolveChecklistOptions = (question, sharedOptions) => {
  const options = _resolveQuestionOptions(question, sharedOptions)
  if (!Array.isArray(options) || options.length === 0) {
    return { checkedOption: null, uncheckedOption: null }
  }

  const checklist = question?.checklist || {}
  const checkedFromConfig = options.find((option) => option.key === checklist.checkedOptionKey) || null
  const uncheckedFromConfig = options.find((option) => option.key === checklist.uncheckedOptionKey) || null

  const checkedOption =
    checkedFromConfig ||
    [...options].sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0] ||
    null

  const uncheckedOption =
    uncheckedFromConfig ||
    options.find((option) => (option.score ?? 0) === 0) ||
    [...options].sort((left, right) => (left.score ?? 0) - (right.score ?? 0)).find((option) => option.key !== checkedOption?.key) ||
    checkedOption ||
    null

  return { checkedOption, uncheckedOption }
}

const _normalizeScoreToken = (value) => String(value ?? "").trim().toLowerCase()

// Every token an answer can be matched to an option by: each chosen entry's
// code and wording as ValueKit.readChoice reads them (bare codes, codings,
// subform and scoring selections { selectedKey, response }, checklist ids and
// labels, FindCodeSelect { selectedItems } / { selectedItem }, FHIR answers,
// lists).
const _collectScoreCandidates = (value, out = new Set()) => {
  ValueKit.readChoice(value).forEach((entry) => {
    const code = String(entry.code ?? "").trim()
    const display = String(entry.display ?? "").trim()
    if (code) out.add(code)
    if (display) out.add(display)
  })
  return out
}

const _getScoreFromValue = (value, optionScoreMap) => {
  if (!optionScoreMap) return null

  const candidates = Array.from(_collectScoreCandidates(value))
  if (candidates.length === 0) return null

  for (const candidate of candidates) {
    if (optionScoreMap.has(candidate)) {
      return optionScoreMap.get(candidate)
    }
  }

  const normalizedOptionMap = new Map()
  optionScoreMap.forEach((score, key) => {
    normalizedOptionMap.set(_normalizeScoreToken(key), score)
  })
  for (const candidate of candidates) {
    const direct = normalizedOptionMap.get(_normalizeScoreToken(candidate))
    if (direct !== undefined) return direct
  }

  return null
}

// =====================================================================
// MOIS action module: path resolution, payload mapping, and mutations
// =====================================================================

const _resolvePathValue = (source, path) => {
  if (!path) return undefined
  const segments = String(path).split(".").map((segment) => segment.trim()).filter(Boolean)
  let current = source
  for (const segment of segments) {
    if (current === undefined || current === null) return undefined
    current = current[segment]
  }
  return current
}

const _normalizeChartPreferenceValue = (value) => {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value === "object") {
    if (
      value.code !== undefined ||
      value.display !== undefined ||
      value.system !== undefined
    ) {
      return value
    }
    if (value.value && typeof value.value === "object") return value.value
    return value.code ?? value.key ?? value.value ?? value.text ?? value.label ?? value.display
  }
  return value
}

const _buildMappedPayload = (values, action) => {
  const payload = { ...(action?.payloadDefaults || action?.payload_defaults || {}) }
  const payloadMap = action?.payloadMap || action?.payload_map || {}
  Object.entries(payloadMap).forEach(([targetKey, sourceKey]) => {
    const value = _normalizeChartPreferenceValue(values?.[sourceKey])
    if (value !== undefined) payload[targetKey] = value
  })
  return payload
}

// Full-record MOIS writes carry a declarative recordShape (see
// data/mois-write-targets.json). This interpreter is kept verbatim in sync with
// MOIS_RECORD_SHAPE_RUNTIME_SOURCE in lib/mois-export/mois-record-shape-runtime.ts;
// the registry test fails if the two drift.
const _applyMoisRecordShape = (payload, shape, context) => {
  const ctx = context || {}
  const input = { ...(payload || {}) }
  const blank = (value) => value === undefined || value === null || value === ""
  const toNumber = (value) => (typeof value === "string" && /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : value)
  const titleCase = (code) => String(code).toLowerCase().split(/[_\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
  const toCoding = (value, rule) => {
    if (value === undefined || value === null) return value
    if (typeof value === "object") return { code: value.code ?? null, display: value.display ?? null, system: value.system ?? rule.system ?? null }
    const code = typeof value === "boolean" ? (value ? "Y" : "N") : String(value)
    return { code, display: (rule.displays && rule.displays[code]) || titleCase(code), system: rule.system }
  }
  const codings = shape.codings || {}
  for (const key of shape.numeric || []) if (key in input) input[key] = toNumber(input[key])
  for (const key of Object.keys(codings)) if (key in input) input[key] = toCoding(input[key], codings[key])
  const id = Number(input[shape.idKey] || 0)
  if (!Number.isFinite(id) || id < 0) return { error: shape.idKey + " must be empty (create) or a positive id (update); deleting through this write is not verified" }
  const isUpdate = id > 0
  if (!isUpdate && shape.updateOnly) return { error: shape.idKey + " is required: this write only updates an existing record" }
  let base = null
  if (isUpdate && shape.base) {
    let rows = [ctx.patient]
    for (const segment of shape.base.path) rows = rows.flatMap((row) => { const next = row && row[segment]; return Array.isArray(next) ? next : next ? [next] : [] })
    const existing = rows.find((row) => row && Number(row[shape.idKey]) === id)
    if (!existing && shape.base.required) return { error: shape.idKey + " " + id + " is not on the loaded chart, so its other fields cannot be resent unchanged" }
    if (existing) {
      base = {}
      for (const key of shape.base.fields) if (existing[key] !== undefined) base[key] = codings[key] ? toCoding(existing[key], codings[key]) : existing[key]
    }
  }
  const fromContext = (source) => (source === "today" ? ctx.today : ctx[source])
  const contextValues = {}
  const contextSources = { ...(isUpdate ? {} : shape.createContextDefaults || {}), ...(shape.contextFields || {}) }
  for (const key of Object.keys(contextSources)) {
    const value = fromContext(contextSources[key])
    if (!blank(value)) contextValues[key] = toNumber(value)
  }
  const record = { ...(shape.defaults || {}), ...(isUpdate ? {} : shape.createDefaults || {}), ...contextValues, ...(base || {}), ...input }
  if (!isUpdate) record[shape.idKey] = 0
  for (const key of Object.keys(shape.derive || {})) {
    const rule = shape.derive[key]
    const source = record[rule.from]
    if (!blank(record[key]) || blank(source)) continue
    if (rule.coding) record[key] = { code: String(source), display: null, system: rule.coding }
    else record[key] = toNumber(rule.field ? source[rule.field] : source)
  }
  const required = ((shape.required || {})[isUpdate ? "update" : "create"]) || []
  const missing = required.filter((key) => blank(record[key]))
  if (missing.length) return { error: "Missing " + missing.join(", ") + (isUpdate ? " for this update" : " to create this record") }
  return { record, isUpdate }
}

const _moisLocalToday = () => {
  const now = new Date()
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0")
}

// MOIS write actions supported at runtime, keyed by `${resource}.${mutation}`
// to match lib/mois-write-action-registry.ts ids — every key here must be
// runtimeStatus "supported" there, and vice versa. Every mutation document is
// a verbatim engine-verified document: the operation name often differs from
// the GraphQL field it invokes (changeTelecom -> changePatientContact), and
// field argument names can differ from the variable names (changePatientName
// passes $patientUpdate as newPatient). Do not "normalize" these.
// idVariable declares which context id the action needs; buildVariables maps
// the resolved id + mapped payload onto the document's variables.
const MOIS_WRITE_MUTATIONS = {
  "chartPreference.changeChartPreference": {
    document: `mutation changeChartPreference($patientId: Int!, $chartPreference: ChartPreferenceInput!) {
      changeChartPreference(patientId: $patientId, chartPreference: $chartPreference) {
        patientId
      }
    }`,
    idVariable: "patientId",
    buildVariables: (patientId, payload) => ({ patientId, chartPreference: payload }),
  },
  "patient.changeTelecom": {
    document: `mutation changeTelecom($patientId: Int!, $newContact: ContactPointInput!) {
      changePatientContact(patientId: $patientId, newContact: $newContact) {
        patientId
      }
    }`,
    idVariable: "patientId",
    buildVariables: (patientId, payload) => ({ patientId, newContact: payload }),
  },
  "patient.changeOfAddress": {
    document: `mutation changeOfAddress($patientId: Int!, $newAddress: AddressInput!) {
      changePatientAddress(patientId: $patientId, newAddress: $newAddress) {
        patientId
      }
    }`,
    idVariable: "patientId",
    buildVariables: (patientId, payload) => ({ patientId, newAddress: payload }),
  },
  // MOIS ships one patient-update surface (changePatient) under two operation
  // labels differing only in input variable name, so it is one write target.
  "patient.changePatient": {
    document: `mutation changePatient($patientId: Int!, $patientUpdate: PatientInput!) {
      changePatient(patientId: $patientId, newPatient: $patientUpdate) {
        patientId
      }
    }`,
    idVariable: "patientId",
    buildVariables: (patientId, payload) => ({ patientId, patientUpdate: payload }),
  },
  "patient.changeInsurance": {
    document: `mutation changeInsurance($patientId: Int!, $newInsurance: InsuranceInput!) {
      changePatientInsurance(patientId: $patientId, newInsurance: $newInsurance) {
        patientId
      }
    }`,
    idVariable: "patientId",
    buildVariables: (patientId, payload) => ({ patientId, newInsurance: payload }),
  },
  "connection.changeConnection": {
    document: `mutation changeConnection($patientId: Int!, $connection: ConnectionInput!) {
      changeConnection(patientId: $patientId, connection: $connection) {
        patientId
      }
    }`,
    idVariable: "patientId",
    buildVariables: (patientId, payload) => ({ patientId, connection: payload }),
  },
  "task.createTask": {
    document: `mutation createTask($encounterId: Int!, $newTask: MoisTaskInput!) {
      createEncounterTask(encounterId: $encounterId, newTask: $newTask) {
        encounterId
      }
    }`,
    idVariable: "encounterId",
    // The registry exposes encounterId as a mappable payload key; a mapped
    // value wins over the resolved context id and is lifted out of the task.
    buildVariables: (encounterId, payload) => {
      const { encounterId: mappedEncounterId, ...newTask } = payload
      const resolved = mappedEncounterId ?? encounterId
      return { encounterId: typeof resolved === "string" ? Number(resolved) : resolved, newTask }
    },
  },
  "correspondence.createCorrespondence": {
    document: `mutation createCorrespondence($encounterId: Int!, $newCorrespondence: CorrespondenceInput!) {
      createEncounterCorrespondence(encounterId: $encounterId, correspondence: $newCorrespondence) {
        encounterId
      }
    }`,
    idVariable: "encounterId",
    buildVariables: (encounterId, payload) => {
      const { encounterId: mappedEncounterId, ...newCorrespondence } = payload
      const resolved = mappedEncounterId ?? encounterId
      return { encounterId: typeof resolved === "string" ? Number(resolved) : resolved, newCorrespondence }
    },
  },
  // Full-record writes, live-verified 2026-09-10/11: the executor applies the
  // recordShape (copy the current record from the chart, then the mapped
  // fields) before buildVariables sees the payload.
  "encounterNote.changeEncounterNote": {
    document: `mutation addEncounterNote($patientId: Int!, $encounterNote: EncounterNoteInput!) {
      changeEncounterNote(patientId: $patientId, encounterNote: $encounterNote) {
        encounterId
      }
    }`,
    idVariable: "patientId",
    recordShape: {"idKey":"encounterNoteId","numeric":["encounterNoteId","encounterId","authorUserProfileId","creatorUserProfileId"],"codings":{"isComplete":{"system":"MOIS-YESNO","displays":{"Y":"Yes","N":"No"}}},"base":{"path":["encounters","notes"],"required":true,"fields":["encounterNoteId","encounterId","authorUserProfileId","creatorUserProfileId","noteCreationDate","note","isComplete","extraInfoTemplate","extraInfo"]},"createDefaults":{"extraInfoTemplate":null,"extraInfo":null,"isComplete":{"code":"N","display":"No","system":"MOIS-YESNO"}},"createContextDefaults":{"encounterId":"encounterId","authorUserProfileId":"userId","creatorUserProfileId":"userId","noteCreationDate":"today"},"required":{"create":["encounterId","note","authorUserProfileId","creatorUserProfileId"],"update":["encounterNoteId","encounterId"]}},
    buildVariables: (patientId, record) => ({ patientId: Number(patientId), encounterNote: record }),
  },
  "task.changeTask": {
    document: `mutation changeTask($patientId: Int!, $task: MoisTaskInput!) {
      changeTask(patientId: $patientId, task: $task) {
        taskId
      }
    }`,
    idVariable: "patientId",
    recordShape: {"idKey":"taskId","numeric":["taskId","encounterId","documentId","assignedUserId"],"codings":{"priority":{"system":"MOIS-TASKPRIORITY","displays":{"MEDIUM":"Medium"}},"isAcknowledged":{"system":"MOIS-YESNO","displays":{"Y":"Yes","N":"No"}},"isComplete":{"system":"MOIS-YESNO","displays":{"Y":"Yes","N":"No"}}},"base":{"path":["encounters","tasks"],"required":true,"fields":["documentId","encounterId","taskId","createdDate","assignedUserId","priority","dueDate","isAcknowledged","acknowledgedBy","acknowledgedDate","isComplete","completedBy","completedDate","description","note"]},"updateOnly":true,"required":{"update":["taskId"]}},
    buildVariables: (patientId, record) => ({ patientId: Number(patientId), task: record }),
  },
  "serviceEpisode.changeServiceEpisode": {
    document: `mutation changeServiceEpisode($patientId: Int!, $serviceEpisode: ServiceEpisodeInput!) {
      changeServiceEpisode(patientId: $patientId, serviceEpisode: $serviceEpisode) {
        patientId
      }
    }`,
    idVariable: "patientId",
    recordShape: {"idKey":"serviceEpisodeId","numeric":["serviceEpisodeId","encounterId","serviceMrpId"],"codings":{"service":{"system":"NH.SERVICE"},"serviceMrp":{"system":"MOIS.USER"},"includeOnDemographics":{"system":"MOIS-YESNO","displays":{"Y":"Yes","N":"No"}},"includeOnCarePlan":{"system":"MOIS-YESNO","displays":{"Y":"Yes","N":"No"}}},"base":{"path":["serviceEpisodes"],"required":true,"fields":["serviceEpisodeId","encounterId","startDate","endDate","service","serviceMrp","serviceMrpId","stopReason","stopNote","note","includeOnDemographics","includeOnCarePlan"]},"createDefaults":{"encounterId":null,"endDate":null,"stopReason":{"code":null,"display":null,"system":null},"stopNote":null,"includeOnDemographics":{"code":"N","display":"No","system":"MOIS-YESNO"},"includeOnCarePlan":{"code":"N","display":"No","system":"MOIS-YESNO"},"asMemberOfs":[]},"createContextDefaults":{"startDate":"today"},"contextFields":{"patientId":"patientId"},"derive":{"serviceMrp":{"from":"serviceMrpId","coding":"MOIS.USER"},"serviceMrpId":{"from":"serviceMrp","field":"code"}},"required":{"create":["service","serviceMrp","serviceMrpId","startDate"],"update":["serviceEpisodeId","service"]}},
    buildVariables: (patientId, record) => ({ patientId: Number(patientId), serviceEpisode: record }),
  },
  // The parent episode is both the $serviceEpisodeId variable and a field of
  // ServiceEventInput, so it is read from the shaped record, not the context.
  "serviceEvent.changeServiceEvent": {
    document: `mutation changeServiceEvent($serviceEpisodeId: Int!, $serviceEvent: ServiceEventInput!) {
      changeServiceEvent(serviceEpisodeId: $serviceEpisodeId, serviceEvent: $serviceEvent) {
        serviceEventId
      }
    }`,
    idVariable: "serviceEpisodeId",
    recordShape: {"idKey":"serviceEventId","numeric":["serviceEventId","serviceEpisodeId","objectId"],"codings":{"service":{"system":"NH.SERVICE"},"phase":{"system":"MOIS-SERVICEEVENTPHASE","displays":{"INITIAL":"Initial","FOLLOWUP":"Follow Up"}}},"defaults":{"objectType":"tdt_encounter","objectTypeExt":null},"createDefaults":{"healthIssues":[]},"createContextDefaults":{"objectId":"encounterId"},"required":{"create":["serviceEpisodeId","objectId","service","phase"],"update":["serviceEventId","serviceEpisodeId","objectId","service","phase"]}},
    buildVariables: (_contextId, record) => ({ serviceEpisodeId: record.serviceEpisodeId, serviceEvent: record }),
  },
  "prescription.updatePrescription": {
    document: `mutation updatePrescription($patientId: Int!, $prescription: PrescriptionInput!) {
      changePrescription(patientId: $patientId, prescription: $prescription) {
        patientId
      }
    }`,
    idVariable: "patientId",
    buildVariables: (patientId, payload) => ({ patientId, prescription: payload }),
  },
  "prescription.updateLongTermMedication": {
    document: `mutation updateLongTermMedication($patientId: Int!, $longTermMedication: LongTermMedicationInput!) {
      changeLongTermMedication(patientId: $patientId, longTermMedication: $longTermMedication) {
        patientId
      }
    }`,
    idVariable: "patientId",
    // Full-record update, live-verified 2026-09-11: the executor resends the
    // chart record (drug durations and dosages included) with the mapped text.
    recordShape: {"idKey":"longTermMedicationId","numeric":["longTermMedicationId"],"base":{"path":["longTermMedications"],"required":true,"fields":["longTermMedicationId","patientId","encounterId","startDate","endDate","orderingProvider","medication","doseFrequency","comment","instruction","genericName","indication","atcCode","cdicCode","prn","type","doNotSubstitute","doNotAdapt","doseType","drugDurations","partFill","partFillQuantity","partFillUnits","partFillFrequency","prnRangeLow","prnRangeHigh","prnDailyMaximum","prnDoseUnits","prnFrequencyLow","prnFrequencyHigh","prnFrequencyUnits","dispenseQuantity","dispenseQuantityUnits","dailyDose","dailyDoseUnits","witnessIngestionDPW","deliveryNotAuthorized","carriesDPW","saferSupply","isOAT","isOATDual"]},"updateOnly":true,"contextFields":{"patientId":"patientId"},"required":{"update":["longTermMedicationId","patientId","medication"]}},
    buildVariables: (patientId, payload) => ({ patientId: Number(patientId), longTermMedication: payload }),
  },
  "prescription.updateFavouriteMedication": {
    document: `mutation updateFavouriteMedication($userId: Int, $favouriteMedication: FavouriteMedicationInput!) {
      changeFavouriteMedication(userId: $userId, favouriteMedication: $favouriteMedication) {
        userProfileId
      }
    }`,
    idVariable: "userId",
    // $userId is nullable in the engine schema; the server falls back to the
    // authenticated user when it is omitted.
    requiresId: false,
    buildVariables: (userId, payload) => ({ userId: userId ?? null, favouriteMedication: payload }),
  },
  "prescription.logPrescriptionSave": {
    document: `mutation logPrescriptionSave($patientId: Int!, $prescriptionLog: PrescriptionLogInput!) {
      changePrescriptionLog(patientId: $patientId, prescriptionLog: $prescriptionLog) {
        patientId
      }
    }`,
    idVariable: "patientId",
    buildVariables: (patientId, payload) => ({ patientId, prescriptionLog: payload }),
  },
  // addObservation declares only $observation — the patient rides inside
  // ObservationInput rather than arriving as a variable, so buildVariables
  // folds the resolved id into the payload. Key set mirrors the engine's own
  // observation-history editor (MOIS Form Tester 2.30.31).
  "observation.addObservationHistory": {
    document: `mutation addObservationHistory($observation: ObservationInput!) {
      addObservation(observation: $observation) {
        observationId
      }
    }`,
    idVariable: "patientId",
    injectContextIdInto: "patientId",
    buildVariables: (patientId, payload) => ({
      observation: { observationId: 0, status: "F", ...payload, patientId },
    }),
  },
}

const MOIS_WRITE_MUTATION_KEYS = Object.keys(MOIS_WRITE_MUTATIONS)

// Fallback context paths per id kind, used when the action does not name an
// explicit id path (or it resolves empty).
const MOIS_WRITE_ID_FALLBACK_PATHS = {
  patientId: ["sd.formParams.patientId", "patient.patientId"],
  encounterId: ["sd.formParams.encounterId", "sd.webform.encounterId", "sd.webform.encounter.encounterId"],
  userId: ["sd.auth.userProfileId", "sd.userProfile.userProfileId"],
}

const _resolveWriteActionId = (idVariable, action, root) => {
  const candidatePaths = [
    action?.patientIdPath,
    ...(MOIS_WRITE_ID_FALLBACK_PATHS[idVariable] || []),
  ].filter(Boolean)
  for (const path of candidatePaths) {
    const value = _resolvePathValue(root, path)
    if (value !== undefined && value !== null && value !== "") return value
  }
  return undefined
}

// setFormData must receive a produce()-wrapped recipe: the real MOIS runtime
// hands back the raw React state setter, so a bare mutator would replace the
// active form data with undefined.
const _recordSubformActionPayload = (setFormData, componentId, payload) => {
  if (!setFormData) return
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    const container = draft.field.data.__componentPayloads ?? {}
    const nextGroup = container.moisActionsByComponent ?? {}
    const history = Array.isArray(nextGroup[componentId]) ? nextGroup[componentId] : []
    nextGroup[componentId] = [...history, payload].slice(-10)
    container.moisActionsByComponent = nextGroup
    draft.field.data.__componentPayloads = container
    draft.tempArea = draft.tempArea || {}
    const runtime = draft.tempArea.__moisRuntime || { lastAction: null, actionHistory: [] }
    const entry = {
      action: "moisMutation",
      payload,
      timestamp: new Date().toISOString(),
    }
    runtime.lastAction = entry
    runtime.actionHistory = [...(runtime.actionHistory || []), entry].slice(-10)
    draft.tempArea.__moisRuntime = runtime
  }))
}

// =====================================================================
// Observation-output module: DCO construction and prepared writes
// =====================================================================

const _stringifyObservationValue = (value) => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map(_stringifyObservationValue).filter(Boolean).join(", ")
  if (typeof value !== "object") return ""
  if (Number.isFinite(value.count)) return String(value.count)
  if (Number.isFinite(value.selectedCount)) return String(value.selectedCount)
  if (Array.isArray(value.selectedIds)) return String(value.selectedIds.length)
  if (Array.isArray(value.selectedItems)) return String(value.selectedItems.length)
  return _stringifyObservationValue(
    value.value ?? value.code ?? value.text ?? value.display ?? value.label ?? value.total
  )
}

const _resolveObservationTemplate = (template, values) => String(template || "").replace(
  /\{\{\s*([^}\s]+)\s*\}\}/g,
  (_, fieldPath) => {
    const direct = values && Object.prototype.hasOwnProperty.call(values, fieldPath)
      ? values[fieldPath]
      : _resolvePathValue(values, fieldPath)
    return _stringifyObservationValue(direct)
  }
)

// Report-body formats. Mirrors REPORT_ITEM_FORMATS in @webforms/form-model —
// this bundle is executed as standalone source by MOIS and cannot import it, so
// the two are pinned together by subform-observation-report.test.ts. A workflow
// report over top-level fields offers the same formats, so either surface can
// produce the same body.
const _REPORT_ITEM_FORMATS = {
  promptAnswer: { value: "answer", separator: ": ", indent: "" },
  promptScore: { value: "score", separator: " : ", indent: "    " },
}

const _findQuestionOptionForAnswer = (question, sharedOptions, answer) => {
  const options = _resolveQuestionOptions(question, sharedOptions)
  if (!Array.isArray(options) || options.length === 0) return null
  const candidates = Array.from(_collectScoreCandidates(answer))
  if (candidates.length === 0) return null
  for (const candidate of candidates) {
    const match = options.find((option) => String(option?.key) === String(candidate))
    if (match) return match
  }
  const normalized = candidates.map((candidate) => _normalizeScoreToken(candidate))
  return options.find((option) => normalized.includes(_normalizeScoreToken(option?.key))) ?? null
}

const _resolveDataEntryDisplayValue = (field, value) => {
  const raw = _stringifyObservationValue(value)
  if (!raw) return ""
  const scaleOptions = Array.isArray(field?.scaleOptions) ? field.scaleOptions : []
  const scaleMatch = scaleOptions.find((option) => String(option?.value) === raw)
  if (scaleMatch) return String(scaleMatch.description || scaleMatch.label || raw)
  const options = Array.isArray(field?.options) ? field.options : []
  const optionMatch = options.find((option) => (
    typeof option === "object" && option !== null
      ? [option.key, option.id, option.value].some((candidate) => String(candidate) === raw)
      : String(option) === raw
  ))
  if (optionMatch && typeof optionMatch === "object") {
    return String(optionMatch.text || optionMatch.label || optionMatch.description || raw)
  }
  return raw
}

/**
 * Build the report body from the subform's own items, one line each. Items with
 * no answer are skipped, so a partially completed subform reports what it has
 * rather than a column of empty prompts.
 */
const _buildFormattedObservationReport = (output, context) => {
  const spec = _REPORT_ITEM_FORMATS[output?.reportFormat] || _REPORT_ITEM_FORMATS.promptAnswer
  const printScore = spec.value === "score"
  const { separator, indent } = spec
  const lines = []

  const heading = typeof output?.reportHeading === "string" ? output.reportHeading.trim() : ""
  if (heading) lines.push(heading)

  for (const question of context?.questions || []) {
    if (!question) continue
    const answer = context?.answers?.[question.id]
    if (answer === undefined || answer === null || answer === "") continue
    const label = String(question.label || question.id || "").trim()
    if (!label) continue
    const score = _getScoreFromValue(answer, context?.scoreMap?.get?.(question.id))
    let printed
    if (printScore) {
      printed = score === null || score === undefined ? _stringifyObservationValue(answer) : String(score)
    } else {
      const option = _findQuestionOptionForAnswer(question, context?.sharedOptions, answer)
      printed = String(option?.text || option?.label || "") || _stringifyObservationValue(answer)
    }
    if (!printed) continue
    lines.push(`${indent}${label}${separator}${printed}`)
  }

  for (const field of context?.dataEntryFields || []) {
    if (!field || _isHeadingField(field)) continue
    // dataEntryValues is keyed by the literal field id, dots and all, so try a
    // direct hit before walking the id as a path.
    const values = context?.dataEntryValues
    const value = values && Object.prototype.hasOwnProperty.call(values, field.id)
      ? values[field.id]
      : _getValueAtPath(values, field.id)
    const label = String(field.label || field.id || "").trim()
    if (!label) continue
    const printed = printScore
      ? _stringifyObservationValue(value)
      : _resolveDataEntryDisplayValue(field, value)
    if (!printed) continue
    lines.push(`${indent}${label}${separator}${printed}`)
  }

  return lines.length > 0 ? lines.join("\n") : ""
}

const _buildSubformObservationReport = (output, context) => {
  if (_REPORT_ITEM_FORMATS[output?.reportFormat]) {
    return _buildFormattedObservationReport(output, context)
  }
  return output?.reportTemplate
    ? _resolveObservationTemplate(output.reportTemplate, context?.allValues)
    : ""
}

const _buildSubformObservationUpdates = (outputs, context) => {
  if (!Array.isArray(outputs) || outputs.length === 0) return []
  const allValues = {
    ...(context?.answers || {}),
    ...(context?.dataEntryValues || {}),
    ...(context?.calculatedExpressions || {}),
  }
  Object.entries(context?.calculatedTotals || {}).forEach(([totalId, result]) => {
    allValues[totalId] = result?.score
  })
  const observationRows = [
    ...(Array.isArray(context?.sd?.webform?.observations) ? context.sd.webform.observations : []),
    ...(Array.isArray(context?.sd?.patient?.observations) ? context.sd.patient.observations : []),
  ]
  const createdBy = context?.formData?.createdBy ?? context?.sd?.userProfile?.identity?.fullName

  return outputs.flatMap((output) => {
    if (!output || typeof output !== "object" || !output.observationCode) return []
    const source = String(output.source || "").toLowerCase()
    let rawValue
    if (source === "calculation") rawValue = context?.calculatedExpressions?.[output.calculationId]
    else if (source === "total") rawValue = context?.calculatedTotals?.[output.totalId]?.score
    else if (source === "template") rawValue = _resolveObservationTemplate(output.valueTemplate, allValues)
    else rawValue = allValues[output.fieldId] ?? _resolveObservationTemplate(output.valueTemplate, allValues)

    const value = _stringifyObservationValue(rawValue)
    const oldObservation = observationRows.find((entry) => entry?.observationCode === output.observationCode)
    const oldId = oldObservation?.observationId ?? 0
    if (!value) {
      return output.deleteWhenEmpty && oldId ? [{ observationId: -oldId }] : []
    }

    const report = _buildSubformObservationReport(output, { ...context, allValues })
    return [{
      observationId: oldId,
      observationCode: String(output.observationCode),
      observationClass: "DCOBS",
      value,
      valueType: String(output.valueType || "NUMERIC"),
      status: oldId ? "C" : "F",
      description: String(output.description || output.observationCode),
      ...(output.units ? { units: String(output.units) } : {}),
      ...(report ? { report } : {}),
      ...(createdBy ? { orderedBy: createdBy, collectedBy: createdBy } : {}),
      collectedDateTime: getDateTimeString(new Date()),
    }]
  })
}

const _setSubformObservationPayloads = (setFormData, componentId, payload) => {
  if (typeof setFormData !== "function") return
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    const container = draft.field.data.__componentPayloads ?? {}
    const groups = container.dcoUpdatesByComponent ?? {}
    if (!payload || payload.length === 0) delete groups[componentId]
    else groups[componentId] = payload
    container.dcoUpdatesByComponent = groups
    draft.field.data.__componentPayloads = container
  }))
}

// =====================================================================
// Form-output module: nested snapshots and prepared-session writes
// =====================================================================

const _buildDataEntrySnapshot = (fields, formData, externalRoot) => {
  const sourceRoot = externalRoot && typeof externalRoot === "object" ? externalRoot : formData
  const snapshot = {}
  for (const field of fields || []) {
    if (!field || _isHeadingField(field)) continue
    if (field.type === "conversion") {
      const conversions = Array.isArray(field.conversions) ? field.conversions : []
      for (const conversion of conversions) {
        for (const path of [conversion?.fromFieldId, conversion?.toFieldId].filter(Boolean)) {
          const value = _getValueAtPath(sourceRoot, path)
          if (value !== undefined) _setValueAtPath(snapshot, path, __cloneSubformScoringSessionValue(value, null))
        }
      }
      continue
    }
    const value = _getValueAtPath(sourceRoot, field.id)
    if (value !== undefined) _setValueAtPath(snapshot, field.id, __cloneSubformScoringSessionValue(value, null))
  }
  return snapshot
}

const _buildSubformFormDataWrites = (outputs, context) => {
  if (!Array.isArray(outputs) || outputs.length === 0) return []
  const allValues = {
    ...(context?.answers || {}),
    ...(context?.dataEntryValues || {}),
    ...(context?.calculatedExpressions || {}),
  }
  Object.entries(context?.calculatedTotals || {}).forEach(([totalId, result]) => {
    allValues[totalId] = result?.score
  })
  const dataEntrySnapshot = _buildDataEntrySnapshot(
    context?.dataEntryFields,
    context?.formData,
    context?.dataEntryValueRoot
  )

  return outputs.flatMap((output) => {
    if (!output || typeof output !== "object" || !output.targetPath) return []
    const source = String(output.source || "field").toLowerCase()
    let value
    if (source === "data-entry") value = dataEntrySnapshot
    else if (source === "calculation") value = context?.calculatedExpressions?.[output.calculationId]
    else if (source === "total") value = context?.calculatedTotals?.[output.totalId]?.score
    else if (source === "template") value = _resolveObservationTemplate(output.valueTemplate, allValues)
    else value = allValues[output.fieldId]
    if (value === undefined) return []
    return [{
      targetPath: String(output.targetPath),
      mode: output.mode === "append" ? "append" : "replace",
      value: __cloneSubformScoringSessionValue(value, null),
    }]
  })
}

const _setSubformFormDataOutputs = (setFormData, writes) => {
  if (typeof setFormData !== "function" || !Array.isArray(writes) || writes.length === 0) return
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    for (const write of writes) {
      const current = _getValueAtPath(draft.field.data, write.targetPath)
      const nextValue = write.mode === "append"
        ? [...(Array.isArray(current) ? current : []), write.value]
        : write.value
      _setValueAtPath(draft.field.data, write.targetPath, nextValue)
    }
  }))
}

const _createPreparedSessionSetter = (initialState) => {
  let prepared = cloneFormSessionState(initialState)
  return {
    setFormData: (updater) => {
      if (typeof updater === "function") {
        const result = updater(prepared)
        prepared = cloneFormSessionState(result || prepared)
      } else if (updater && typeof updater === "object") {
        prepared = cloneFormSessionState({ ...prepared, ...updater })
      }
    },
    getFormData: () => prepared,
  }
}

// =====================================================================
// Interpretation module: range matching and labels
// =====================================================================

const _isInRange = (score, range) => {
  if (score === null || score === undefined) return false
  const min = range.min
  const max = range.max
  const meetsMin = range.minInclusive !== false ? score >= min : score > min
  const meetsMax = max === null ? true : (range.maxInclusive !== false ? score <= max : score < max)
  return meetsMin && meetsMax
}

const _getInterpretation = (score, ranges) => {
  if (score === null || score === undefined || !ranges?.length) return null
  for (const range of ranges) {
    if (_isInRange(score, range)) {
      return {
        label: range.label,
        range,
        bounds: _formatBounds(range),
      }
    }
  }
  return null
}

const _formatBounds = (range) => {
  const minSymbol = range.minInclusive !== false ? "\u2265" : ">"
  if (range.max === null) return `${minSymbol}${range.min}`
  if (range.min === range.max && range.minInclusive !== false && range.maxInclusive !== false) {
    return `=${range.min}`
  }
  return `${range.min}-${range.max}`
}

// =====================================================================
// Data-entry value module: visibility, paths, display, and coercion
// =====================================================================

const _isMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") {
    if ("selectedKey" in value) {
      const selected = value.selectedKey
      if (selected === null || selected === undefined) return false
      return String(selected).trim().length > 0
    }
    if (Number.isFinite(value.selectedCount)) {
      return Number(value.selectedCount) > 0
    }
    if (value.display) return String(value.display).trim().length > 0
    if (value.text) return String(value.text).trim().length > 0
    if (value.code) return String(value.code).trim().length > 0
    if (value.key) return String(value.key).trim().length > 0
    return Object.keys(value).length > 0
  }
  return true
}

const _evaluateDataEntryVisibility = (field, values = {}) => {
  const rule = field?.visibility
  if (!rule || typeof rule !== "object" || rule.type === "always") return true
  const controllerId = rule.controllerId
  if (!controllerId) return true
  const value = values[controllerId]
  if (rule.type === "filled") return _isMeaningfulValue(value)
  if (rule.type === "equals") return String(value ?? "") === String(rule.value ?? "")
  if (rule.type === "gt" || rule.type === "lt") {
    const left = Number(value)
    const right = Number(rule.value ?? 0)
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false
    return rule.type === "gt" ? left > right : left < right
  }
  return true
}

/**
 * Whether a scoring question can be answered now: its `enabledWhen` rule over
 * the other questions' answers, read as option keys. Mirrors ScoringModule's
 * isScoringQuestionEnabled, which greys the question out in the dialog (DLQI's
 * "If No…" follow-up, MOIS window 120).
 */
const _isScoringQuestionEnabled = (question, answers) => {
  const rule = question?.enabledWhen
  if (!rule || typeof rule !== "object" || !rule.controllerId || rule.type === "always") return true
  const getValue = (questionId) => {
    const answer = answers?.[questionId]
    if (answer === null || answer === undefined) return ""
    if (typeof answer !== "object") return String(answer)
    const key = answer.selectedKey ?? answer.value ?? answer.code ?? ""
    return key === null ? "" : String(key)
  }
  if (typeof FormLogicKit !== "undefined" && FormLogicKit && typeof FormLogicKit.evaluateVisibilityRule === "function") {
    return FormLogicKit.evaluateVisibilityRule(rule, getValue, { controllerKind: () => "choice" }) !== false
  }
  const value = getValue(rule.controllerId)
  const expected = rule.value === undefined || rule.value === null ? "" : String(rule.value)
  if (rule.type === "equals") return value === expected
  if (rule.type === "not-equals") return value !== expected
  if (rule.type === "not-filled") return value === ""
  return value !== ""
}

// How FormLogicKit should compare a controller's answer, from its entry type.
const _dataEntryControllerKind = (field) => {
  const type = field?.type
  if (type === "booleanYesNo") return "boolean"
  if (type === "choice") return "choice"
  if (type === "number" || type === "scale") return "number"
  return "text"
}

/**
 * Whether a data-entry field's visibility rule (a builder BuilderVisibilityRule
 * lifted by lib/subform-data-entry.ts) shows it. FormLogicKit evaluates the
 * full operator set (not-filled, gte, additional conditions, match any, ...)
 * the same way regular fields do; the local evaluator is the fallback when the
 * kit is not loaded. `getValue(controllerId)` returns the raw answer.
 */
const _isDataEntryFieldVisible = (field, getValue, fieldById) => {
  const rule = field?.visibility
  if (!rule || typeof rule !== "object" || rule.type === "always") return true
  if (
    typeof FormLogicKit !== "undefined" &&
    FormLogicKit &&
    typeof FormLogicKit.evaluateVisibilityRule === "function"
  ) {
    return FormLogicKit.evaluateVisibilityRule(rule, getValue, {
      controllerKind: (controllerId) => _dataEntryControllerKind(fieldById?.get?.(controllerId)),
    }) !== false
  }
  const controllerId = rule.controllerId
  return _evaluateDataEntryVisibility(field, controllerId ? { [controllerId]: getValue(controllerId) } : {})
}

// "Dose is required." / "Dose and Route are required." — the wording
// EditableTable's row Save uses, naming every missing field at once.
const _formatMissingRequiredMessage = (fields) => {
  const labels = (fields || []).map((field) => String(field?.label || field?.id || "").trim()).filter(Boolean)
  if (labels.length === 0) return ""
  if (labels.length === 1) return `${labels[0]} is required.`
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]} are required.`
}

const _toPathSegments = (path) =>
  String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)

const _getValueAtPath = (root, path) => {
  const segments = _toPathSegments(path)
  if (segments.length === 0) return undefined

  let current = root
  for (const segment of segments) {
    if (!current || typeof current !== "object") return undefined
    current = current[segment]
  }
  return current
}

const _setValueAtPath = (root, path, value) => {
  const segments = _toPathSegments(path)
  if (!root || typeof root !== "object" || segments.length === 0) return

  let current = root
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value
      return
    }
    if (!current[segment] || typeof current[segment] !== "object" || Array.isArray(current[segment])) {
      current[segment] = {}
    }
    current = current[segment]
  })
}

const _toDisplayValue = (value) => {
  if (!_isMeaningfulValue(value)) return ""
  if (Array.isArray(value)) {
    return value.map(_toDisplayValue).filter(Boolean).join(", ")
  }
  if (typeof value === "object") {
    if ("selectedKey" in value) {
      const response =
        typeof value.detailResponse === "string" && value.detailResponse.trim()
          ? value.detailResponse.trim()
          : typeof value.response === "string" && value.response.trim()
            ? value.response.trim()
            : null
      if (response) return response
      if (value.selectedKey !== null && value.selectedKey !== undefined) {
        return String(value.selectedKey)
      }
    }
    if (Array.isArray(value.selectedLabels) && value.selectedLabels.length > 0) {
      return value.selectedLabels.join(", ")
    }
    if (Array.isArray(value.selectedIds) && value.selectedIds.length > 0) {
      return value.selectedIds.join(", ")
    }
    if (Number.isFinite(value.selectedCount)) {
      return `${value.selectedCount}`
    }
    return value.display || value.text || value.code || value.key || ""
  }
  return String(value)
}

const _toNumericValue = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const direct = Number(trimmed)
    if (Number.isFinite(direct)) return direct
    const normalized = trimmed
      .replace(/[−–—]/g, "-")
      .replace(/(\d)[,\s](?=\d{3}\b)/g, "$1")
      .replace(/,(?=\d{1,2}\b)/g, ".")
    const extracted = normalized.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/)
    if (!extracted) return null
    const parsed = Number(extracted[0])
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === "object") {
    if (Number.isFinite(value.selectedCount)) {
      return Number(value.selectedCount)
    }
    const candidate = value.value ?? value.selectedKey ?? value.display ?? value.text ?? value.code ?? value.key
    return _toNumericValue(candidate)
  }
  return null
}

const _evaluateExpression = (expression, varsByName) => {
  if (typeof expression !== "string") return null
  const trimmed = expression.trim()
  if (!trimmed) return null
  if (!/^[0-9+\-*/().,\s_[\]a-zA-Z]+$/.test(trimmed)) return null

  const functionNames = new Set(["round", "floor", "ceil", "min", "max", "abs", "mod", "iif"])
  const generatedVars = {}
  let generatedIndex = 0
  let prepared = trimmed.replace(/\[([^\]]+)\]/g, (_match, fieldId) => {
    const token = `__field_${generatedIndex++}`
    generatedVars[token] = varsByName[String(fieldId).trim()]
    return token
  })
  const allVars = { ...varsByName, ...generatedVars }
  const tokenMatches = prepared.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []
  const uniqueTokens = Array.from(new Set(tokenMatches)).sort((a, b) => b.length - a.length)
  for (const token of uniqueTokens) {
    if (functionNames.has(token)) continue
    const numeric = allVars[token]
    if (!Number.isFinite(numeric)) return null
    const replacement = String(numeric)
    prepared = prepared.replace(new RegExp(`\\b${token}\\b`, "g"), replacement)
  }

  try {
    const round = (value, precision = 0) => {
      const places = Number.isFinite(precision) ? Math.max(0, Math.floor(precision)) : 0
      const factor = 10 ** places
      return Math.round((Number(value) + Number.EPSILON) * factor) / factor
    }
    const floor = Math.floor
    const ceil = Math.ceil
    const min = Math.min
    const max = Math.max
    const abs = Math.abs
    const mod = (left, right) => Number(left) % Number(right)
    const iif = (condition, whenTrue, whenFalse) => condition ? whenTrue : whenFalse
    const result = Function(
      "round", "floor", "ceil", "min", "max", "abs", "mod", "iif",
      `"use strict"; return (${prepared});`
    )(round, floor, ceil, min, max, abs, mod, iif)
    return typeof result === "number" && Number.isFinite(result) ? result : null
  } catch (error) {
    return null
  }
}

// =====================================================================
// Formula trees: data-entry calculations and scoring totals
// =====================================================================
//
// Calculations and totals are evaluated by FormulaKit.evaluateTree (the
// reference semantics in docs/.../architecture/formula-semantics.md) from the
// exported `formulaTree`, else from the text parsed by FormulaKit.parse with
// the ids the formula may read. A kit without tree support, or text that does
// not parse, keeps _evaluateExpression above.

const _subformFormulaTrees = new Map()
const _subformFormulaTree = (store, fieldIds) => {
  if (typeof FormulaKit === "undefined" || !FormulaKit || typeof FormulaKit.evaluateTree !== "function") return null
  const stored = store?.formulaTree
  if (stored && stored.v === 1 && stored.expr && typeof stored.expr === "object") return stored
  const text = typeof store?.expression === "string" ? store.expression : ""
  if (!text.trim() || typeof FormulaKit.parse !== "function") return null
  const ids = Array.from(new Set((fieldIds || []).filter(Boolean)))
  const key = text + "\u0000" + ids.join("\u0001")
  if (_subformFormulaTrees.has(key)) return _subformFormulaTrees.get(key)
  let tree = null
  try {
    const parsed = FormulaKit.parse(text, ids.length > 0 ? { fieldIds: ids } : {})
    if (parsed && parsed.v === 1 && parsed.expr) tree = parsed
    else if (parsed && parsed.formula && !(parsed.errors && parsed.errors.length)) tree = parsed.formula
  } catch (error) {
    tree = null
  }
  _subformFormulaTrees.set(key, tree)
  return tree
}

// The formulas to evaluate. The builder's `calculatedValues` mirror of the
// calculations or totals (display settings shared with computed fields) wins
// when present, but an entry without a tree takes the stored tree of the
// calculation or total it mirrors (same id, same text), so the exported tree
// is evaluated whichever copy the config carries.
const _subformFormulaStores = (mirror, sources) => {
  const stores = Array.isArray(sources) ? sources : []
  if (!Array.isArray(mirror) || mirror.length === 0) return stores
  const sourceById = new Map(stores.filter((store) => store && store.id).map((store) => [store.id, store]))
  const text = (value) => (typeof value === "string" ? value.trim() : "")
  return mirror.map((entry) => {
    if (!entry || (entry.formulaTree && entry.formulaTree.v === 1)) return entry
    const source = sourceById.get(entry.id)
    const tree = source?.formulaTree
    if (!tree || tree.v !== 1 || !text(entry.expression) || text(source.expression) !== text(entry.expression)) return entry
    return { ...entry, formulaTree: tree }
  })
}

// A calculation's or total's result: a finite number, or text; else null.
const _subformFormulaResult = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") return value.trim() ? value : null
  return null
}

// Evaluate a calculation's or total's tree. The result stays blank until every
// input it reads has a value (as _evaluateExpression did), unless the store
// says "compute-anyway": a missing input then counts as 0.
const _evaluateSubformFormulaTree = (tree, getValue, store, options = {}) => {
  const computeAnyway = store?.incompleteBehavior === "compute-anyway"
  if (!computeAnyway && typeof FormulaKit.hasAllReferencedValues === "function"
    && !FormulaKit.hasAllReferencedValues(tree, getValue, { fieldKind: options.fieldKind })) return null
  return _subformFormulaResult(FormulaKit.evaluateTree(tree, getValue, {
    ...options,
    incomplete: computeAnyway ? "compute-anyway" : "blank",
  }))
}

// =====================================================================
// Data-entry field module: layout, choices, defaults, and render groups
// =====================================================================

const _isHeadingField = (field) => field?.type === "heading"

// The data-entry row uses a 12px column gap, so fractional widths must
// subtract their gap share or two 50% fields can never share a row
// (50% + 50% + 12px > 100% always wraps — the halves silently stacked).
const _dataEntryFieldContainerStyle = (field) => {
  if (_isHeadingField(field)) return { flex: "1 0 100%", maxWidth: "100%" }
  const basis = _resolveFieldWidthBasis(field)
  if (basis === "100%") return { flex: "1 1 100%", maxWidth: "100%", minWidth: "220px" }
  const adjusted = `calc(${basis} - 12px)`
  return { flex: `1 1 ${adjusted}`, maxWidth: adjusted, minWidth: "160px" }
}

const _resolveFieldWidthBasis = (field) => {
  if (_isHeadingField(field)) return "100%"
  const normalized = typeof field?.width === "string" ? field.width.trim().toLowerCase() : ""
  switch (normalized) {
    case "1/4":
    case "25%":
      return "25%"
    case "1/3":
    case "33%":
    case "33.3%":
    case "33.33%":
      return "33.3333%"
    case "1/2":
    case "50%":
    case "half":
      return "50%"
    case "2/3":
    case "66%":
    case "66.6%":
    case "66.67%":
      return "66.6667%"
    case "3/4":
    case "75%":
      return "75%"
    case "1/1":
    case "100%":
    case "full":
      return "100%"
    case "auto":
      return field?.type === "textarea" ? "100%" : "50%"
    default:
      return "100%"
  }
}

const _buildScaleOptions = (field) => {
  const min = Number.isFinite(field?.min) ? Number(field.min) : 0
  const max = Number.isFinite(field?.max) ? Number(field.max) : 4
  const step = Number.isFinite(field?.step) && Number(field.step) > 0 ? Number(field.step) : 1
  const providedOptions = Array.isArray(field?.scaleOptions) ? field.scaleOptions : []
  const normalizedOptions = providedOptions
    .map((option) => {
      const numericValue = Number(option?.value)
      if (!Number.isFinite(numericValue)) return null
      const label = typeof option?.label === "string" && option.label.trim()
        ? option.label.trim()
        : String(numericValue)
      const description = typeof option?.description === "string" && option.description.trim()
        ? option.description.trim()
        : undefined
      return {
        value: numericValue,
        label,
        description,
      }
    })
    .filter(Boolean)

  if (normalizedOptions.length > 0) return normalizedOptions

  const fallbackOptions = []
  for (let cursor = Math.min(min, max); cursor <= Math.max(min, max) + step / 1000; cursor += step) {
    const value = Number(cursor.toFixed(6))
    const option = { value, label: String(value) }
    if (value === Math.min(min, max) && field?.minLabel) {
      option.description = field.minLabel
    } else if (value === Math.max(min, max) && field?.maxLabel) {
      option.description = field.maxLabel
    }
    fallbackOptions.push(option)
    if (fallbackOptions.length > 1000) break
  }
  return fallbackOptions
}

const _buildScaleLegendSignature = (field) => {
  if (!field || field.type !== "scale") return ""
  const options = _buildScaleOptions(field)
  return JSON.stringify(
    options.map((option) => ({
      value: Number(option.value),
      legend: String(option.description || option.label || option.value),
    }))
  )
}

const _isLoincDataEntryField = (field) =>
  Array.isArray(field?.fhirConfig?.code) &&
  field.fhirConfig.code.some((coding) => coding?.system === "http://loinc.org")

const _shouldShowDataEntryHelpText = (field) =>
  Boolean(field?.helpText) &&
  !(_isLoincDataEntryField(field) && String(field.helpText).includes(" · "))

const _usesStructuredSelectableOptions = (field) =>
  Array.isArray(field?.options) &&
  field.options.some((option) => option && typeof option === "object" && !Array.isArray(option))

const _getSelectableOptionNumericValue = (option) => {
  const rawValue = option?.value ?? option?.key ?? null
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim()
    if (!trimmed) return null
    const numeric = Number(trimmed)
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

// A data-entry field's answers as offered now. Its option rules (lifted by
// lib/subform-data-entry.ts, or a table column's) hide or disable answers by
// sibling answers, parent-form answers and chart facts (FormLogicKit).
const _withAvailableOptions = (field, getValue) => {
  if (!field || !Array.isArray(field.optionRules) || field.optionRules.length === 0 || !Array.isArray(field.options)) return field
  if (typeof FormLogicKit === "undefined" || !FormLogicKit || typeof FormLogicKit.availableOptions !== "function") return field
  const options = FormLogicKit.availableOptions(field.options, field.optionRules, getValue)
  return options === field.options ? field : { ...field, options }
}

const _normalizeSelectableOptions = (field, fallbackOptions = []) => {
  const rawOptions = Array.isArray(field?.options) && field.options.length > 0
    ? field.options
    : fallbackOptions

  return rawOptions
    .map((option, index) => {
      if (option && typeof option === "object" && !Array.isArray(option)) {
        // ValueKit reads the option; the stored selectedKey keeps an explicit
        // key or id, then the value, so saved answers still match.
        const normalized = ValueKit.normalizeOption(option)
        const rawValue =
          option.value ??
          option.key ??
          option.id ??
          (normalized.code || index)
        const key = String(option.key ?? option.id ?? rawValue ?? `option_${index + 1}`)
        const text = String(normalized.display || rawValue || `Option ${index + 1}`)
        const description =
          typeof option.description === "string" && option.description.trim()
            ? option.description.trim()
            : undefined
        return {
          key,
          text,
          value: rawValue,
          description,
          system: option.system,
          ...(option.disabled === true ? { disabled: true } : {}),
        }
      }

      const text = String(option ?? "").trim()
      if (!text) return null
      return {
        key: text,
        text,
        value: text,
        description: undefined,
        system: field?.codeSystem,
      }
    })
    .filter(Boolean)
}

const _optionMatchesValue = (option, value) => {
  if (!option) return false

  const candidates = Array.from(_collectScoreCandidates(value)).map((candidate) => _normalizeScoreToken(candidate))
  if (candidates.length === 0) return false

  const optionTokens = [
    option.key,
    option.value,
    option.text,
    option.description,
  ]
    .map((candidate) => _normalizeScoreToken(candidate))
    .filter(Boolean)

  return optionTokens.some((candidate) => candidates.includes(candidate))
}

const _isSelectableOptionSelected = (value, option) => {
  if (value && typeof value === "object" && value.selectedKey !== null && value.selectedKey !== undefined) {
    return String(value.selectedKey) === String(option?.key ?? "")
  }
  return _optionMatchesValue(option, value)
}

const _serializeSelectableValue = (field, option) => {
  if (!option) return null
  if (!_usesStructuredSelectableOptions(field)) {
    return option.key
  }
  return {
    selectedKey: option.key,
    value: option.value,
    response: option.text,
    detailResponse: option.description || option.text,
  }
}

const _resolveSelectableBinaryOptions = (field, fallbackOptions = []) => {
  const options = _normalizeSelectableOptions(field, fallbackOptions)
  if (options.length === 0) {
    return { checkedOption: null, uncheckedOption: null }
  }

  const uncheckedOption =
    options.find((option) => _getSelectableOptionNumericValue(option) === 0) ||
    null

  const checkedOption =
    options.find((option) => option !== uncheckedOption && _getSelectableOptionNumericValue(option) !== 0) ||
    options.find((option) => option !== uncheckedOption) ||
    options[0] ||
    null

  return {
    checkedOption,
    uncheckedOption,
  }
}

// The open dialog's answers as text, for noticing a change since it opened.
const _dialogAnswerSignature = (dataEntryValues, answers) => {
  try {
    return JSON.stringify({ values: dataEntryValues || {}, answers: answers || {} })
  } catch (_error) {
    return ""
  }
}

// A yes/no entry's options for its CompactBooleanField: the checked option,
// the option "No" stores (the value-0 option, else the other one), and the
// value-0 option alone (strictUncheckedOption), which an unticked check box
// stores when the field has one.
const _booleanEntryOptions = (field) => {
  const options = _normalizeSelectableOptions(field, ["Yes", "No"])
  const { checkedOption, uncheckedOption } = _resolveSelectableBinaryOptions(field, ["Yes", "No"])
  return {
    options,
    checkedOption,
    uncheckedOption: uncheckedOption || options.find((option) => option.key !== checkedOption?.key) || null,
    strictUncheckedOption: uncheckedOption,
  }
}

const _latestObservationDefault = (field, sd) => {
  const binding = field?.defaultFromObservation ?? field?.default_from_observation
  const code = String(binding?.observationCode ?? binding?.observation_code ?? "").trim()
  if (!code) return undefined
  const aspect = String(binding?.aspect ?? "value")
  const observations = Array.isArray(sd?.patient?.observations)
    ? sd.patient.observations
    : Array.isArray(sd?.queryResult?.patient?.[0]?.observations)
      ? sd.queryResult.patient[0].observations
      : []
  const latest = observations
    .filter((entry) => entry?.observationCode === code)
    .sort((left, right) => {
      const leftDate = new Date(left?.collectedDateTime ?? 0).getTime() || 0
      const rightDate = new Date(right?.collectedDateTime ?? 0).getTime() || 0
      return rightDate - leftDate
    })[0]
  if (!latest) return undefined
  return latest[aspect]
}

// The patient's latest observation with this code, collected within
// `lookbackDays` when set; `aspect` (a defaultFromObservation setting) picks
// another part of it than the value.
const _latestObservationValue = (sd, code, lookbackDays, aspect, now) => {
  const observations = Array.isArray(sd?.patient?.observations)
    ? sd.patient.observations
    : Array.isArray(sd?.queryResult?.patient?.[0]?.observations)
      ? sd.queryResult.patient[0].observations
      : []
  const collectedAt = (entry) => new Date(entry?.collectedDateTime ?? 0).getTime() || 0
  const cutoff = typeof lookbackDays === "number" && lookbackDays > 0 ? now.getTime() - lookbackDays * 86400000 : null
  const latest = observations
    .filter((entry) => entry?.observationCode === code && (cutoff === null || collectedAt(entry) >= cutoff))
    .sort((left, right) => collectedAt(right) - collectedAt(left))[0]
  if (!latest) return undefined
  return latest[aspect || "value"]
}

// The entry's default answer through DefaultsKit (every saved shape: the
// defaultAnswer descriptor, defaultValue with its "__today"/"__now" tokens,
// defaultFromObservation), resolved for a newly opened subform. An
// observation default that finds nothing falls back to the entry's other
// default. Null without the kit (the caller reads the older shapes itself).
const _resolveDefaultAnswerWithKit = (field, sd, allowObservationDefault) => {
  const kit = typeof DefaultsKit !== "undefined" && DefaultsKit ? DefaultsKit : null
  if (!kit) return null
  const now = new Date()
  const binding = field.defaultFromObservation ?? field.default_from_observation
  const context = {
    now,
    fieldType: kit.temporalKindOf(field),
    readLastObservation: (code, system, lookbackDays) => {
      const bindingCode = String(binding?.observationCode ?? binding?.observation_code ?? "").trim()
      const aspect = bindingCode === code && typeof binding?.aspect === "string" ? binding.aspect : "value"
      return _latestObservationValue(sd, code, lookbackDays, aspect, now)
    },
  }
  const answer = kit.readDefaultAnswer(field, { shape: "subformEntry", bringForward: allowObservationDefault })
  let value = kit.resolveDefaultAnswer(answer, context)
  if (value === undefined && answer && answer.kind === "lastObservation") {
    value = kit.resolveDefaultAnswer(kit.readDefaultAnswer(field, { shape: "subformEntry", bringForward: false }), context)
  }
  return { value }
}

const _resolveFieldDefaultValue = (field, sd, allowObservationDefault = true) => {
  if (!field || _isHeadingField(field)) return undefined

  const fromKit = _resolveDefaultAnswerWithKit(field, sd, allowObservationDefault)
  if (fromKit && fromKit.value === undefined) return undefined
  const observationDefault = !fromKit && allowObservationDefault ? _latestObservationDefault(field, sd) : undefined
  const explicitDefault = fromKit ? fromKit.value : observationDefault ?? field.defaultValue ?? field.default_value
  if (explicitDefault === undefined) return undefined

  // A yes/no default reads as true or false: the first option is yes, the second no.
  if (field.type === "booleanYesNo" && typeof explicitDefault === "boolean") {
    const options = _normalizeSelectableOptions(field, ["Yes", "No"])
    const option = options[explicitDefault ? 0 : 1]
    if (option) return _serializeSelectableValue(field, option)
  }

  if (explicitDefault === "__today" || explicitDefault === "__now") {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const day = String(today.getDate()).padStart(2, "0")
    if (explicitDefault === "__today") return `${year}-${month}-${day}`
    // datetime-local value, the format the date-time input stores.
    const hours = String(today.getHours()).padStart(2, "0")
    const minutes = String(today.getMinutes()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  if (field.type === "choice" || field.type === "booleanYesNo") {
    const fallbackOptions = field.type === "booleanYesNo" ? ["Yes", "No"] : []
    const options = _normalizeSelectableOptions(field, fallbackOptions)
    const matchedOption = options.find((option) => _optionMatchesValue(option, explicitDefault))
    return matchedOption ? _serializeSelectableValue(field, matchedOption) : explicitDefault
  }

  if (field.type === "scale") {
    const options = _buildScaleOptions(field)
    const matchedOption = options.find((option) => _optionMatchesValue(option, explicitDefault))
    if (!matchedOption) return explicitDefault
    return {
      selectedKey: String(matchedOption.value),
      value: matchedOption.value,
      response: matchedOption.label || String(matchedOption.value),
      detailResponse: matchedOption.description || matchedOption.label || String(matchedOption.value),
    }
  }

  return explicitDefault
}

const _resolveFieldEmptyNumericValue = (field) => {
  if (!field || _isHeadingField(field)) return null
  const rawValue = field.emptyValue ?? field.empty_value
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue
  if (typeof rawValue === "string" && rawValue.trim()) {
    const numeric = Number(rawValue)
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

const _clampDataEntryNumberValue = (value, field) => {
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return value

  const configuredMin = field?.min
  const configuredMax = field?.max
  const min = configuredMin !== null && configuredMin !== undefined && Number.isFinite(Number(configuredMin))
    ? Number(configuredMin)
    : null
  const max = configuredMax !== null && configuredMax !== undefined && Number.isFinite(Number(configuredMax))
    ? Number(configuredMax)
    : null

  if (min !== null && numeric < min) return min
  if (max !== null && numeric > max) return max
  return numeric
}

const _buildDataEntryRenderGroups = (fields) => {
  const groups = []
  let matrixBuffer = null

  const flushMatrixBuffer = () => {
    if (!matrixBuffer || matrixBuffer.fields.length === 0) return
    if (matrixBuffer.fields.length === 1) {
      groups.push({ type: "field", field: matrixBuffer.fields[0] })
    } else {
      groups.push({
        type: "scaleMatrix",
        matrixGroupId: matrixBuffer.matrixGroupId,
        signature: matrixBuffer.signature,
        options: matrixBuffer.options,
        fields: matrixBuffer.fields,
      })
    }
    matrixBuffer = null
  }

  for (const field of fields || []) {
    const configuredMatrixGroupId = typeof field?.matrixGroupId === "string" ? field.matrixGroupId.trim() : ""
    // LOINC symptom scales use the standard stacked ScaleField presentation,
    // even if a short-lived generated config persisted a matrixGroupId.
    const matrixGroupId = _isLoincDataEntryField(field) ? "" : configuredMatrixGroupId
    const isMatrixCandidate = field?.type === "scale" && matrixGroupId

    if (!isMatrixCandidate) {
      flushMatrixBuffer()
      groups.push({ type: "field", field })
      continue
    }

    const signature = _buildScaleLegendSignature(field)
    const options = _buildScaleOptions(field)
    if (
      matrixBuffer &&
      matrixBuffer.matrixGroupId === matrixGroupId &&
      matrixBuffer.signature === signature
    ) {
      matrixBuffer.fields.push(field)
      continue
    }

    flushMatrixBuffer()
    matrixBuffer = {
      matrixGroupId,
      signature,
      options,
      fields: [field],
    }
  }

  flushMatrixBuffer()

  // LOINC symptom scales remain individual ScaleField rows, but consecutive
  // rows share one overflow container so horizontal scrolling stays aligned.
  const stackedGroups = []
  let scaleStack = []
  const flushScaleStack = () => {
    if (scaleStack.length === 0) return
    if (scaleStack.length === 1) {
      stackedGroups.push(scaleStack[0])
    } else {
      stackedGroups.push({
        type: "scaleStack",
        fields: scaleStack.map((entry) => entry.field),
      })
    }
    scaleStack = []
  }

  for (const entry of groups) {
    if (
      entry?.type === "field" &&
      entry.field?.type === "scale" &&
      _isLoincDataEntryField(entry.field)
    ) {
      scaleStack.push(entry)
      continue
    }
    flushScaleStack()
    stackedGroups.push(entry)
  }
  flushScaleStack()
  return stackedGroups
}

// =====================================================================
// Calculator and local-style module
// =====================================================================

const _formatNumericValue = (value, precision = 1) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null
  const numeric = Number(value)
  const boundedPrecision = Number.isFinite(precision) ? Math.max(0, Math.min(6, Math.trunc(precision))) : null
  if (boundedPrecision === null) return `${numeric}`
  return numeric.toFixed(boundedPrecision).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
}

const _formatCalculatorDisplayValue = (value, precision = 1, fallback = "Incomplete") => {
  const formatted = _formatNumericValue(value, precision)
  return formatted === null ? fallback : formatted
}

const _computeMorphineEquivalent = (doseValue, equivalentDoseMg, baseEquivalentDoseMg) => {
  const dose = _toNumericValue(doseValue)
  const equivalentDose = Number(equivalentDoseMg)
  const baseDose = Number(baseEquivalentDoseMg)
  if (!Number.isFinite(dose)) return null
  if (!Number.isFinite(equivalentDose) || equivalentDose <= 0) return null
  if (!Number.isFinite(baseDose) || baseDose <= 0) return null
  return (dose * baseDose) / equivalentDose
}

// =====================================================================
// Summary-view module
// =====================================================================

const _calculationIncompleteBehavior = (calculation) =>
  calculation?.incompleteBehavior ||
  calculation?.builderField?.computedConfig?.incompleteBehavior ||
  "compute-anyway"

const _calculationIncompleteText = (calculation) =>
  calculation?.incompleteText ||
  calculation?.builderField?.computedConfig?.incompleteText ||
  "Incomplete"

const _calculationPresentationValue = (calculation, value, isComplete) => {
  if (isComplete) return value
  return _calculationIncompleteBehavior(calculation) === "show-text"
    ? _calculationIncompleteText(calculation)
    : null
}

const ScoreSummaryItem = ({ total, score, isComplete, isDarkMode }) => {
  if (!isComplete && _calculationIncompleteBehavior(total) === "hide") return null
  return (
    <ComputedField
      fieldId={total.id}
      label={total.label}
      resolvedValue={_calculationPresentationValue(total, score, isComplete)}
      presentationOnly
      displayStyle={total.displayStyle || "field"}
      readOnly
      isDarkMode={isDarkMode}
    />
  )
}

const InterpretationSummaryItem = ({ total, score, isComplete, isDarkMode }) => {
  const interpretation = _getInterpretation(score, total.ranges)

  if (!isComplete || !interpretation) return null

  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "4px",
    backgroundColor: isDarkMode ? "#2a5a8c" : "#0078d4",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 500,
  }

  return (
    <span style={style}>
      {interpretation.bounds} &middot; {interpretation.label}
    </span>
  )
}

const AnswerSummaryItem = ({ question, answer, isDarkMode }) => {
  if (!answer) return null
  const displayText = _toDisplayValue(answer)
  if (!displayText) return null

  const style = {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    padding: "4px 0",
    fontSize: "13px",
  }

  const labelStyle = {
    color: isDarkMode ? "#a0a0a0" : "#666666",
    fontWeight: 500,
    flexShrink: 0,
  }

  return (
    <div style={style}>
      <span style={labelStyle}>{question.label}:</span>
      <span>{displayText}</span>
    </div>
  )
}

const DataFieldSummaryItem = ({ field, value, isDarkMode }) => {
  if (!field) return null
  const displayText = _toDisplayValue(value)
  if (!displayText) return null

  const style = {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    padding: "4px 0",
    fontSize: "13px",
  }

  const labelStyle = {
    color: isDarkMode ? "#a0a0a0" : "#666666",
    fontWeight: 500,
    flexShrink: 0,
  }

  return (
    <div style={style}>
      <span style={labelStyle}>{field.label}:</span>
      <span>{displayText}</span>
    </div>
  )
}

const CalculationSummaryItem = ({ calculation, value, isDarkMode }) => {
  if (!calculation) return null
  const isComplete = value !== null && value !== undefined
  if (!isComplete && _calculationIncompleteBehavior(calculation) === "hide") return null
  return (
    <ComputedField
      fieldId={calculation.id}
      label={calculation.label}
      resolvedValue={_calculationPresentationValue(calculation, value, isComplete)}
      presentationOnly
      displayStyle={calculation.displayStyle || "field"}
      readOnly
      isDarkMode={isDarkMode}
    />
  )
}

const DataInterpretationSummaryItem = ({ calculation, value, isDarkMode }) => {
  const interpretation = _getInterpretation(value, calculation?.ranges)

  if (value === null || value === undefined || !interpretation) return null

  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "4px",
    backgroundColor: isDarkMode ? "#2a5a8c" : "#0078d4",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 500,
  }

  return (
    <span style={style}>
      {interpretation.bounds} &middot; {interpretation.label}
    </span>
  )
}

const ProgressSummaryItem = ({ answered, total, percentage, isDarkMode }) => {
  const barBg = isDarkMode ? "#333333" : "#e0e0e0"
  const barFill = percentage === 100
    ? (isDarkMode ? "#2a8c2a" : "#28a745")
    : (isDarkMode ? "#0078d4" : "#0078d4")

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{
        flex: 1,
        height: "6px",
        backgroundColor: barBg,
        borderRadius: "3px",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${percentage}%`,
          height: "100%",
          backgroundColor: barFill,
          borderRadius: "3px",
          transition: "width 0.3s ease",
        }} />
      </div>
      <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#666666", whiteSpace: "nowrap" } }}>
        {answered}/{total} ({percentage}%)
      </Text>
    </div>
  )
}

// =====================================================================
// Dialog controller: state derivation and completion orchestration
// =====================================================================

const SubformScoringInner = ({
  id = "subformScoring",
  mode,
  title,
  buttonText = "Complete Assessment",
  buttonIconName,
  config = { questions: [], totals: [] },
  dataEntryConfig = { fields: [], calculations: [] },
  summaryConfig = {},
  modalConfig = {},
  hideTitle = false,
  showProgress = true,
  bringForward = true,
  isOpen: controlledIsOpen,
  onOpenChange,
  hideTriggerButton = false,
  showSummary = true,
  required = false,
  completeButtonText = "Done",
  secondaryCompleteButtonText,
  cancelButtonText = "Cancel",
  onComplete,
  onSecondaryComplete,
  onCommitToParent,
  dataEntryValueRoot,
  onDataEntryValueChange,
  observationOutputs = [],
  formDataOutputs = [],
  // Locked (section complete / signed / host read-only): the modal still opens
  // to show the answers, but nothing in it can change and Done cannot save.
  readOnly = false,
  disabled = false,
  // A host-side validation message (e.g. EditableTable's row Save) shown
  // inside the dialog above its buttons.
  errorMessage = null,
  ...props
}) => {
  const isReadOnly = readOnly === true || disabled === true
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  // Set by a Done that found missing required answers; the message then
  // tracks the answers live until every required field is filled.
  const [showRequiredErrors, setShowRequiredErrors] = useState(false)
  const [fd] = useFormSessionData()
  const sd = useSourceData()
  // One useMutation per supported write action. Iterating a module-constant
  // key array keeps the hook count and order deterministic across renders
  // (rules-of-hooks safe); the executor picks the runner by action key.
  const writeMutationRunners = {}
  for (const writeKey of MOIS_WRITE_MUTATION_KEYS) {
    // The engine's useMutation destructures its options argument unguarded
    // (`l = c.options; b = l.auth`) and then reads b.jwToken / b.apiServer, so
    // omitting it throws the moment a write action fires. operationName is what
    // MOIS logs the call as; without it the engine records "See event name".
    // eslint-disable-next-line react-hooks/rules-of-hooks
    writeMutationRunners[writeKey] = useMutation(
      MOIS_WRITE_MUTATIONS[writeKey].document,
      { auth: sd?.auth, operationName: writeKey },
      sd?.errorDispatch
    )[0]
  }
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false
  const isDialogOpen = typeof controlledIsOpen === "boolean" ? controlledIsOpen : internalIsOpen
  const hasExternalDataEntryStore =
    dataEntryValueRoot !== null &&
    typeof dataEntryValueRoot === "object"

  const setDialogOpen = useCallback((nextValue) => {
    if (typeof controlledIsOpen !== "boolean") {
      setInternalIsOpen(nextValue)
    }
    setShowRequiredErrors(false)
    onOpenChange?.(nextValue)
  }, [controlledIsOpen, onOpenChange])

  const isDataEntryMode = useMemo(() => {
    if (mode === "data-entry") return true
    if (mode === "scoring") return false
    return Array.isArray(dataEntryConfig?.fields) && dataEntryConfig.fields.length > 0
  }, [mode, dataEntryConfig])

  const setDataEntryValue = useCallback((fieldId, nextValue) => {
    if (!fieldId) return
    if (typeof onDataEntryValueChange === "function") {
      onDataEntryValueChange(fieldId, nextValue)
      return
    }
    if (!fd?.setFormData) return
    fd.setFormData(produce((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data) {
        draft.field.data = {}
      }
      if (nextValue === undefined) {
        draft.field.data[fieldId] = null
      } else {
        draft.field.data[fieldId] = nextValue
      }
    }))
  }, [fd, onDataEntryValueChange])

  // -------------------------------------------------------------------
  // Scoring-mode derivations
  // -------------------------------------------------------------------

  // Scoring-mode answer and score calculations
  const scoreMap = useMemo(() => {
    if (isDataEntryMode) return new Map()
    return _buildScoreMap(config.questions, config.sharedOptions)
  }, [isDataEntryMode, config.questions, config.sharedOptions])

  // A question whose enabledWhen fails (see _isScoringQuestionEnabled) counts
  // as unanswered: out of the totals, the progress and the report.
  const answers = useMemo(() => {
    if (isDataEntryMode) return {}
    const stored = {}
    for (const question of config.questions || []) {
      const value = fd?.field?.data?.[question.id]
      if (value !== undefined && value !== null && value !== "") {
        stored[question.id] = value
      }
    }
    const result = {}
    for (const question of config.questions || []) {
      if (question.id in stored && _isScoringQuestionEnabled(question, stored)) result[question.id] = stored[question.id]
    }
    return result
  }, [isDataEntryMode, fd, config.questions])

  const calculatedTotals = useMemo(() => {
    if (isDataEntryMode) return {}
    const results = {}
    const questionsById = new Map((config.questions || []).map((question) => [question.id, question]))
    const storedAnswers = Object.fromEntries((config.questions || []).map((question) => [question.id, fd?.field?.data?.[question.id]]))
    const totals = _subformFormulaStores(config.calculatedValues, config.totals)
    for (const total of totals) {
      let score = 0
      let isComplete = true
      const expressionVars = {}
      for (const question of config.questions || []) {
        const answer = answers[question.id]
        const optionScoreMap = scoreMap.get(question.id)
        const answerScore = _getScoreFromValue(answer, optionScoreMap)
        const resolvedScore = answerScore !== null
          ? answerScore
          : (Number.isFinite(question.emptyScore) ? Number(question.emptyScore) : null)
        if (resolvedScore === null) continue
        const aliases = [question.id, question.fieldId, ...(question.childFieldIds || [])]
        aliases.filter(Boolean).forEach((alias) => {
          expressionVars[alias] = resolvedScore
        })
      }
      for (const variable of total.contextVariables || []) {
        if (!variable?.id || !variable?.sourcePath) continue
        const root = { patient: sd?.patient, sourceData: sd, formData: fd?.field?.data }
        const rawValue = _resolvePathValue(root, variable.sourcePath)
        const normalizedValues = Array.from(_collectScoreCandidates(rawValue))
          .map((candidate) => String(candidate ?? "").trim().toLowerCase())
        const matched = (variable.equals || []).some((candidate) =>
          normalizedValues.includes(String(candidate ?? "").trim().toLowerCase())
        )
        expressionVars[variable.id] = matched
          ? (Number.isFinite(variable.trueValue) ? Number(variable.trueValue) : 1)
          : (Number.isFinite(variable.falseValue) ? Number(variable.falseValue) : 0)
      }
      for (const term of total.terms || []) {
        const termQuestionId = term.questionId || term.answerFieldId
        // an unavailable question (enabledWhen) adds nothing and blocks nothing
        const termQuestion = questionsById.get(termQuestionId)
        if (termQuestion?.enabledWhen && !_isScoringQuestionEnabled(termQuestion, storedAnswers)) continue
        const answer = answers[termQuestionId]
        const optionScoreMap = scoreMap.get(termQuestionId)
        const answerScore = _getScoreFromValue(answer, optionScoreMap)
        if (answerScore !== null) {
          score += answerScore * (term.weight || 1)
        } else if (Number.isFinite(questionsById.get(termQuestionId)?.emptyScore)) {
          score += Number(questionsById.get(termQuestionId).emptyScore) * (term.weight || 1)
        } else if (config.layout === "grouped-checklist") {
          const question = questionsById.get(termQuestionId)
          const { uncheckedOption } = _resolveChecklistOptions(question, config.sharedOptions)
          if (uncheckedOption) {
            score += (uncheckedOption.score ?? 0) * (term.weight || 1)
          } else {
            isComplete = false
          }
        } else {
          isComplete = false
        }
      }
      if (typeof total.expression === "string" && total.expression.trim()) {
        // A question reference reads the question's score (emptyScore when
        // unanswered); the tree says so with score([question]).
        const computeAnyway = total.incompleteBehavior === "compute-anyway"
        const formulaIds = [
          ...(config.questions || []).flatMap((question) => [question.id, question.fieldId, ...(question.childFieldIds || [])]),
          ...(total.contextVariables || []).map((variable) => variable?.id),
        ]
        const tree = _subformFormulaTree(total, formulaIds)
        let evaluated = null
        if (tree && (isComplete || computeAnyway)) {
          evaluated = _evaluateSubformFormulaTree(
            tree,
            (id) => (Object.prototype.hasOwnProperty.call(expressionVars, id) ? expressionVars[id] : undefined),
            total,
            { selfId: total.id }
          )
        } else if (!tree) {
          evaluated = isComplete ? _evaluateExpression(total.expression, expressionVars) : null
        }
        score = evaluated
        isComplete = evaluated !== null
      }
      if (isComplete && Number.isFinite(score) && Number.isFinite(total.precision)) {
        const factor = 10 ** Math.max(0, Math.floor(Number(total.precision)))
        score = Math.round((score + Number.EPSILON) * factor) / factor
      }
      results[total.id] = { score: isComplete ? score : null, isComplete }
    }
    return results
  }, [isDataEntryMode, answers, config.calculatedValues, config.layout, config.questions, config.sharedOptions, config.totals, scoreMap, sd, fd])

  // -------------------------------------------------------------------
  // Data-entry-mode configuration, values, and calculations
  // -------------------------------------------------------------------

  const dataEntryFields = useMemo(() => {
    return Array.isArray(dataEntryConfig?.fields) ? dataEntryConfig.fields : []
  }, [dataEntryConfig])
  const dataEntryAction = useMemo(() => {
    const action = dataEntryConfig?.action
    if (!action || typeof action !== "object") return null
    if (action.kind !== "moisMutation") return null
    const writeKey = `${action.resource}.${action.mutation}`
    if (!MOIS_WRITE_MUTATIONS[writeKey]) return null
    return { ...action, writeKey }
  }, [dataEntryConfig])

  const dataEntryFieldById = useMemo(() => {
    const map = new Map()
    for (const field of dataEntryFields) {
      if (!field?.id) continue
      map.set(field.id, field)
    }
    return map
  }, [dataEntryFields])

  const dataEntryRenderGroups = useMemo(() => {
    return _buildDataEntryRenderGroups(dataEntryFields)
  }, [dataEntryFields])

  const dataEntryCalculatorConfig = useMemo(() => {
    const rawConfig = dataEntryConfig?.calculatorConfig || dataEntryConfig?.calculator_config
    if (!rawConfig || typeof rawConfig !== "object") return null

    const rawType = String(rawConfig.type || rawConfig.calculatorType || rawConfig.calculator_type || "").trim().toLowerCase()
    const normalizedType =
      rawType === "morphine-equivalence" ||
      rawType === "morphine_equivalence" ||
      rawType === "meq"
        ? "morphine-equivalence"
        : null
    if (!normalizedType) return null

    const rawRows = Array.isArray(rawConfig.rows) ? rawConfig.rows : []
    const rows = rawRows
      .map((row, index) => {
        if (!row || typeof row !== "object") return null
        const rowId = String(row.id || `row_${index + 1}`).trim()
        const label = String(row.label || rowId || `Row ${index + 1}`).trim()
        const inputFieldId = String(
          row.inputFieldId ||
          row.input_field_id ||
          row.fieldId ||
          row.field_id ||
          row.doseFieldId ||
          row.dose_field_id ||
          ""
        ).trim()
        if (!inputFieldId) return null

        const equivalentDoseMg = Number(
          row.equivalentDoseMg ??
          row.equivalent_dose_mg ??
          row.equivalentDose ??
          row.equivalent_dose
        )
        if (!Number.isFinite(equivalentDoseMg) || equivalentDoseMg <= 0) return null

        const meqCalculationId = String(row.meqCalculationId || row.meq_calculation_id || "").trim() || null
        const precisionRaw = Number(row.precision)
        const precision = Number.isFinite(precisionRaw)
          ? Math.max(0, Math.min(6, Math.trunc(precisionRaw)))
          : 1
        return {
          id: rowId,
          label,
          inputFieldId,
          equivalentDoseMg,
          meqCalculationId,
          precision
        }
      })
      .filter(Boolean)

    if (rows.length === 0) return null

    const baseEquivalentDoseRaw = Number(rawConfig.baseEquivalentDoseMg ?? rawConfig.base_equivalent_dose_mg)
    const baseEquivalentDoseMg = Number.isFinite(baseEquivalentDoseRaw) && baseEquivalentDoseRaw > 0
      ? baseEquivalentDoseRaw
      : 30
    const totalCalculationId = String(rawConfig.totalCalculationId || rawConfig.total_calculation_id || "").trim() || null
    // The total's decimal places: the preset's defaultPrecision (MOIS's
    // MORPHINE EQUIVALENCE sums its rows unrounded), else one place.
    const totalPrecisionRaw = Number(
      rawConfig.totalPrecision ?? rawConfig.total_precision ?? rawConfig.defaultPrecision ?? rawConfig.default_precision
    )
    const totalPrecision = Number.isFinite(totalPrecisionRaw)
      ? Math.max(0, Math.min(6, Math.trunc(totalPrecisionRaw)))
      : 1
    const totalLabel = String(rawConfig.totalLabel || rawConfig.total_label || "TOTAL MEQ").trim() || "TOTAL MEQ"
    const doseColumnLabel = String(rawConfig.doseColumnLabel || rawConfig.dose_column_label || "Total Daily Dose").trim() || "Total Daily Dose"
    const equivalentColumnLabel = String(rawConfig.equivalentColumnLabel || rawConfig.equivalent_column_label || "Equivalent Dose (mg)").trim() || "Equivalent Dose (mg)"
    const resultColumnLabel = String(rawConfig.resultColumnLabel || rawConfig.result_column_label || "Morphine Equivalent (MEQ)").trim() || "Morphine Equivalent (MEQ)"

    return {
      type: normalizedType,
      rows,
      baseEquivalentDoseMg,
      totalCalculationId,
      totalPrecision,
      totalLabel,
      doseColumnLabel,
      equivalentColumnLabel,
      resultColumnLabel
    }
  }, [dataEntryConfig])

  const isMorphineCalculatorMode = useMemo(() => {
    return isDataEntryMode &&
      dataEntryCalculatorConfig?.type === "morphine-equivalence" &&
      Array.isArray(dataEntryCalculatorConfig?.rows) &&
      dataEntryCalculatorConfig.rows.length > 0
  }, [isDataEntryMode, dataEntryCalculatorConfig])
  const useBloodGlucoseReadingLayout =
    isDataEntryMode &&
    String(modalConfig?.layout || modalConfig?.variant || "").trim().toLowerCase() === "blood-glucose-reading"
  const [showBloodGlucoseUsEntry, setShowBloodGlucoseUsEntry] = useState(false)

  const dataEntryValues = useMemo(() => {
    if (!isDataEntryMode && dataEntryFields.length === 0) return {}
    const result = {}
    for (const field of dataEntryFields) {
      if (_isHeadingField(field)) continue
      result[field.id] = hasExternalDataEntryStore
        ? _getValueAtPath(dataEntryValueRoot, field.id)
        : fd?.field?.data?.[field.id]
    }
    if (isMorphineCalculatorMode) {
      for (const row of dataEntryCalculatorConfig?.rows || []) {
        if (!row?.inputFieldId) continue
        if (!(row.inputFieldId in result)) {
          result[row.inputFieldId] = hasExternalDataEntryStore
            ? _getValueAtPath(dataEntryValueRoot, row.inputFieldId)
            : fd?.field?.data?.[row.inputFieldId]
        }
      }
    }
    return result
  }, [isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryFields, fd, hasExternalDataEntryStore, dataEntryValueRoot])

  useEffect(() => {
    // A locked record is shown as saved; defaults never write into it.
    if (!isDataEntryMode || !isDialogOpen || isReadOnly) return

    const pendingDefaults = []
    for (const field of dataEntryFields) {
      if (!field?.id || _isMeaningfulValue(dataEntryValues[field.id])) continue
      const defaultValue = _resolveFieldDefaultValue(field, sd, bringForward)
      if (defaultValue === undefined) continue
      pendingDefaults.push([field.id, defaultValue])
    }

    if (pendingDefaults.length === 0) return

    if (typeof onDataEntryValueChange === "function") {
      pendingDefaults.forEach(([fieldId, defaultValue]) => {
        onDataEntryValueChange(fieldId, defaultValue)
      })
      return
    }

    if (!fd?.setFormData) return

    fd.setFormData(produce((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data) {
        draft.field.data = {}
      }
      pendingDefaults.forEach(([fieldId, defaultValue]) => {
        draft.field.data[fieldId] = defaultValue
      })
    }))
  }, [bringForward, isDataEntryMode, isDialogOpen, isReadOnly, dataEntryFields, dataEntryValues, fd, onDataEntryValueChange, sd])

  // Whether the open dialog holds changed answers (asked about before a
  // close discards them). The baseline is taken once the opening defaults
  // have been written, so seeded defaults do not count as a change.
  const hasPendingDefaults = isDataEntryMode && isDialogOpen && !isReadOnly && dataEntryFields.some((field) => (
    field?.id &&
    !_isMeaningfulValue(dataEntryValues[field.id]) &&
    _resolveFieldDefaultValue(field, sd, bringForward) !== undefined
  ))
  const dialogAnswerSignature = isDialogOpen ? _dialogAnswerSignature(dataEntryValues, answers) : null
  const dirtyBaselineRef = React.useRef(null)
  useEffect(() => {
    if (!isDialogOpen) {
      dirtyBaselineRef.current = null
      return
    }
    if (dirtyBaselineRef.current === null && !hasPendingDefaults) {
      dirtyBaselineRef.current = dialogAnswerSignature
    }
  }, [isDialogOpen, hasPendingDefaults, dialogAnswerSignature])
  const isDialogDirty = Boolean(isDialogOpen) &&
    dirtyBaselineRef.current !== null &&
    dialogAnswerSignature !== dirtyBaselineRef.current

  // Visibility rules may name a sibling (the usual case) or a parent-form
  // field, read from the same store the subform's answers live in.
  const getVisibilityControllerValue = useCallback((controllerId) => {
    if (Object.prototype.hasOwnProperty.call(dataEntryValues, controllerId)) {
      return dataEntryValues[controllerId]
    }
    return hasExternalDataEntryStore
      ? _getValueAtPath(dataEntryValueRoot, controllerId)
      : fd?.field?.data?.[controllerId]
  }, [dataEntryValues, dataEntryValueRoot, fd, hasExternalDataEntryStore])

  // Hidden fields still collect their default answer but are never drawn,
  // never required and never counted in progress.
  const isDataEntryFieldShown = useCallback((field) => (
    field?.hidden !== true &&
    _isDataEntryFieldVisible(field, getVisibilityControllerValue, dataEntryFieldById)
  ), [dataEntryFieldById, getVisibilityControllerValue])

  const missingRequiredFields = useMemo(() => {
    if (!isDataEntryMode) return []
    return dataEntryFields.filter((field) => (
      field?.id &&
      field.required === true &&
      !_isHeadingField(field) &&
      field.type !== "conversion" &&
      isDataEntryFieldShown(field) &&
      !_isMeaningfulValue(dataEntryValues[field.id])
    ))
  }, [isDataEntryMode, dataEntryFields, dataEntryValues, isDataEntryFieldShown])

  const dataEntryCalculations = useMemo(
    () => _subformFormulaStores(dataEntryConfig?.calculatedValues, dataEntryConfig?.calculations),
    [dataEntryConfig]
  )

  const calculatedExpressions = useMemo(() => {
    if (!isDataEntryMode) return {}
    const vars = {}
    const variableFieldIds = new Set()
    for (const field of dataEntryFields) {
      if (_isHeadingField(field)) continue
      variableFieldIds.add(field.id)
    }
    if (isMorphineCalculatorMode) {
      for (const row of dataEntryCalculatorConfig?.rows || []) {
        if (row?.inputFieldId) variableFieldIds.add(row.inputFieldId)
      }
    }
    for (const fieldId of variableFieldIds) {
      const configuredField = dataEntryFieldById.get(fieldId) || null
      const numericValue = _toNumericValue(dataEntryValues[fieldId])
      vars[fieldId] = numericValue !== null ? numericValue : _resolveFieldEmptyNumericValue(configuredField)
    }
    // The formula kit reads each field's stored answer (its field type and
    // option scores tell it how); a blank answer reads as the field's
    // emptyValue when it has one, and a hotspot map's selection as its count
    // (CDAI: swollen + tender), as _toNumericValue did.
    const formulaIds = [...variableFieldIds, ...dataEntryCalculations.map((calculation) => calculation?.id)]
    const fieldKinds = {}
    const scoreMaps = {}
    for (const field of dataEntryFields) {
      if (!field?.id || _isHeadingField(field)) continue
      if (typeof field.type === "string") fieldKinds[field.id] = field.type
      const scores = {}
      const optionSources = field.type === "scale" ? _buildScaleOptions(field) : Array.isArray(field.options) ? field.options : []
      optionSources.forEach((option) => {
        const normalized = ValueKit.normalizeOption(option)
        if (!Number.isFinite(normalized.score)) return
        if (normalized.code) scores[normalized.code] = normalized.score
        if (normalized.display) scores[normalized.display] = normalized.score
      })
      if (Object.keys(scores).length > 0) scoreMaps[field.id] = scores
    }
    const readFieldValue = (fieldId) => {
      const raw = dataEntryValues[fieldId]
      if (raw && typeof raw === "object" && !Array.isArray(raw) && Number.isFinite(raw.selectedCount)) {
        return Number(raw.selectedCount)
      }
      if (_isMeaningfulValue(raw)) return raw
      const emptyValue = _resolveFieldEmptyNumericValue(dataEntryFieldById.get(fieldId) || null)
      return emptyValue !== null ? emptyValue : raw
    }
    const result = {}
    for (const calculation of dataEntryCalculations) {
      const tree = _subformFormulaTree(calculation, formulaIds)
      const value = tree
        ? _evaluateSubformFormulaTree(
          tree,
          // Fields by id; an earlier calculation by its id; never itself (selfId).
          (id) => {
            if (variableFieldIds.has(id)) return readFieldValue(id)
            return Object.prototype.hasOwnProperty.call(result, id) ? result[id] : undefined
          },
          calculation,
          { fieldKind: (id) => fieldKinds[id], scoreMaps, selfId: calculation.id }
        )
        : _evaluateExpression(calculation.expression, vars)
      if (value === null || value === undefined) {
        result[calculation.id] = null
        continue
      }
      const precision = Number.isFinite(calculation.precision) ? Math.max(0, Math.min(6, calculation.precision)) : null
      result[calculation.id] = precision === null || typeof value !== "number" ? value : Number(value.toFixed(precision))
    }
    if (isMorphineCalculatorMode && dataEntryCalculatorConfig?.totalCalculationId) {
      const rowValues = (dataEntryCalculatorConfig.rows || []).map((row) => {
        const fromCalculation = row.meqCalculationId ? result[row.meqCalculationId] : null
        return fromCalculation ?? _computeMorphineEquivalent(
          dataEntryValues[row.inputFieldId],
          row.equivalentDoseMg,
          dataEntryCalculatorConfig.baseEquivalentDoseMg
        )
      })
      const numericValues = rowValues.filter((value) => Number.isFinite(Number(value))).map(Number)
      // The exported total calculation carries the preset's precision; a
      // config handed over whole (component insert) says it itself.
      const totalCalculation = dataEntryCalculations.find(
        (calculation) => calculation?.id === dataEntryCalculatorConfig.totalCalculationId
      )
      const totalPrecision = Number.isFinite(totalCalculation?.precision)
        ? Math.max(0, Math.min(6, Math.trunc(totalCalculation.precision)))
        : dataEntryCalculatorConfig.totalPrecision
      result[dataEntryCalculatorConfig.totalCalculationId] = numericValues.length > 0
        ? Number(numericValues.reduce((sum, value) => sum + value, 0).toFixed(totalPrecision))
        : null
    }
    return result
  }, [isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryFieldById, dataEntryFields, dataEntryValues, dataEntryCalculations])

  const progress = useMemo(() => {
    if (isDataEntryMode) {
      const calculatorFields = isMorphineCalculatorMode
        ? (dataEntryCalculatorConfig?.rows || []).map((row) => (
            dataEntryFieldById.get(row.inputFieldId) || {
              id: row.inputFieldId,
              required: false,
            }
          ))
        : []
      const answerableFields = calculatorFields.length > 0
        ? calculatorFields
        : dataEntryFields.filter((field) => !_isHeadingField(field) && isDataEntryFieldShown(field))
      const requiredFields = answerableFields.filter((field) => field.required)
      const fieldsForProgress = requiredFields.length > 0 ? requiredFields : answerableFields
      const total = fieldsForProgress.length
      const answered = fieldsForProgress.filter((field) => _isMeaningfulValue(dataEntryValues[field.id])).length
      return {
        answered,
        total,
        percentage: total > 0 ? Math.round((answered / total) * 100) : 0
      }
    }

    const storedAnswers = Object.fromEntries((config.questions || []).map((question) => [question.id, fd?.field?.data?.[question.id]]))
    const enabledQuestions = (config.questions || []).filter((question) => _isScoringQuestionEnabled(question, storedAnswers))
    const total = enabledQuestions.length
    const answered = enabledQuestions.filter((question) => {
      const value = answers[question.id]
      const optionScoreMap = scoreMap.get(question.id)
      return _getScoreFromValue(value, optionScoreMap) !== null
    }).length
    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0
    }
  }, [isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryFieldById, dataEntryFields, dataEntryValues, isDataEntryFieldShown, config.questions, answers, fd])

  const hasAnyAnswers = useMemo(() => {
    if (isDataEntryMode) {
      if (isMorphineCalculatorMode) {
        return (dataEntryCalculatorConfig?.rows || []).some((row) =>
          _isMeaningfulValue(dataEntryValues[row.inputFieldId])
        )
      }
      return dataEntryFields
        .filter((field) => !_isHeadingField(field))
        .some((field) => _isMeaningfulValue(dataEntryValues[field.id]))
    }
    return progress.answered > 0
  }, [isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryFields, dataEntryValues, progress])

  // -------------------------------------------------------------------
  // Completion payload and summary configuration
  // -------------------------------------------------------------------

  const prepareCompletionState = useCallback((actionPayload) => {
    const payload = _buildSubformObservationUpdates(observationOutputs, {
      answers,
      calculatedExpressions,
      calculatedTotals,
      dataEntryValues,
      // Itemized report formats print labels, so the emit site needs the
      // question/field definitions, not just their answers.
      questions: config.questions,
      sharedOptions: config.sharedOptions,
      scoreMap,
      dataEntryFields,
      formData: fd?.field?.data,
      sd,
    })
    const formDataWrites = _buildSubformFormDataWrites(formDataOutputs, {
      answers,
      calculatedExpressions,
      calculatedTotals,
      dataEntryFields,
      dataEntryValues,
      dataEntryValueRoot,
      formData: fd?.field?.data,
    })
    const preparedSession = _createPreparedSessionSetter(fd)
    _setSubformObservationPayloads(preparedSession.setFormData, id, payload)
    _setSubformFormDataOutputs(preparedSession.setFormData, formDataWrites)
    if (actionPayload) {
      _recordSubformActionPayload(preparedSession.setFormData, id, actionPayload)
    }
    return preparedSession.getFormData()
  }, [answers, calculatedExpressions, calculatedTotals, config.questions, config.sharedOptions, dataEntryFields, dataEntryValueRoot, dataEntryValues, fd, formDataOutputs, id, observationOutputs, scoreMap, sd])

  const showItems = useMemo(() => {
    if (Array.isArray(summaryConfig.showItems) && summaryConfig.showItems.length > 0) {
      return summaryConfig.showItems
    }
    if (isDataEntryMode) {
      if (isMorphineCalculatorMode && dataEntryCalculatorConfig?.totalCalculationId) {
        return [
          {
            type: "calculation",
            calculationId: dataEntryCalculatorConfig.totalCalculationId,
          },
          { type: "progress" },
        ]
      }
      const defaults = dataEntryCalculations.map((calculation) => ({
        type: "calculation",
        calculationId: calculation.id
      }))
      defaults.push({ type: "progress" })
      return defaults
    }
    return []
  }, [summaryConfig.showItems, isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryCalculations])

  const summaryLayout = summaryConfig.layout || "stacked"

  const getTotalConfig = useCallback((totalId) => {
    const totals = Array.isArray(config.calculatedValues) && config.calculatedValues.length > 0
      ? config.calculatedValues
      : config.totals || []
    return totals.find((total) => total.id === totalId)
  }, [config.calculatedValues, config.totals])

  const getQuestionConfig = useCallback((questionId) => {
    return (config.questions || []).find((question) => question.id === questionId)
  }, [config.questions])

  const getDataEntryFieldConfig = useCallback((fieldId) => {
    return dataEntryFieldById.get(fieldId)
  }, [dataEntryFieldById])

  const getCalculationConfig = useCallback((calculationId) => {
    return dataEntryCalculations.find((calculation) => calculation.id === calculationId)
  }, [dataEntryCalculations])

  // -------------------------------------------------------------------
  // General field renderer
  // -------------------------------------------------------------------

  const renderDataEntryField = (sourceField, renderOptions = {}) => {
    const field = _withAvailableOptions(sourceField, getVisibilityControllerValue)
    if (_isHeadingField(field)) {
      // MOIS questionnaires lead with the stem question in sentence case
      // ("1. Over the past 2 weeks, ..."); only band headers are shouted.
      const isPrompt = field.headingStyle === "prompt"
      return (
        <Text
          key={`field-${field.id}`}
          styles={{
            root: {
              marginTop: "12px",
              marginBottom: "2px",
              fontSize: "13px",
              fontWeight: isPrompt ? 600 : 700,
              textTransform: isPrompt ? "none" : "uppercase",
              letterSpacing: isPrompt ? "normal" : "0.03em",
              color: isDarkMode ? "#d9d9d9" : "#333",
              borderBottom: `1px solid ${isDarkMode ? "#404040" : "#e5e5e5"}`,
              paddingBottom: "4px"
            }
          }}
        >
          {field.label}
        </Text>
      )
    }

    const required = field.required === true
    const commonProps = {
      fieldId: field.id,
      label: field.label,
      required,
    }

    if (field.type === "conversion") {
      const conversions = Array.isArray(field.conversions) && field.conversions.length > 0
        ? field.conversions
        : [{
            fromFieldId: field.fromFieldId,
            toFieldId: field.toFieldId,
            fromUnit: field.fromUnit,
            toUnit: field.toUnit,
            factor: field.factor,
            offset: field.offset,
            precision: field.precision,
          }]
      return (
        <ConversionField
          key={`field-${field.id}`}
          id={field.id}
          label={field.label}
          helperText={field.helpText || field.helperText || ""}
          conversions={conversions}
          clearText={field.clearText || "Clear"}
          showClear={field.showClear !== false}
          convertOnBlur={field.convertOnBlur !== false}
          allowNegative={field.allowNegative === true}
          required={required}
          readOnly={isReadOnly}
          valueRoot={hasExternalDataEntryStore ? dataEntryValueRoot : undefined}
          onValueChange={setDataEntryValue}
        />
      )
    }

    if (field.type === "scale") {
      const scaleOptions = _buildScaleOptions(field)
      const showLegend = typeof renderOptions.showLegend === "boolean"
        ? renderOptions.showLegend
        : field.showLegend === true

      return (
        <ScaleField
          key={`field-${field.id}`}
          fieldId={field.id}
          label={field.label}
          required={required}
          options={scaleOptions}
          showLegend={showLegend}
          showInlineLabels={field.showInlineLabels !== false}
          showEndpointLabels={
            field.showEndpointLabels === true ||
            (field.showEndpointLabels !== false && Boolean(field.minLabel || field.maxLabel))
          }
          showTooltip={field.showTooltip === true}
          tooltipMode={field.tooltipMode === "option" ? "option" : "all"}
          disableHorizontalScroll={renderOptions.disableHorizontalScroll === true}
          readOnly={isReadOnly}
          // Controlled, like every other entry: the engine's ScaleField binds
          // to the host store, which a subform's session never reads.
          value={dataEntryValues[field.id] ?? null}
          onChange={(answer) => setDataEntryValue(field.id, answer ?? null)}
        />
      )
    }

    if (field.type === "hotspotMap") {
      return (
        <HotspotMapField
          key={`field-${field.id}`}
          {...commonProps}
          imageUrl={field.imageUrl}
          imageSvg={field.imageSvg}
          imageAlt={field.imageAlt}
          hotspots={Array.isArray(field.hotspots) ? field.hotspots : []}
          allowMultiSelect={field.allowMultiSelect !== false}
          showSummary={field.showSummary !== false}
          showDefaultCounter={field.showDefaultCounter !== false}
          showSelectedLabels={field.showSelectedLabels === true}
          showHotspotLabels={field.showHotspotLabels === true}
          interactionMode={field.interactionMode}
          enableAnnotations={field.enableAnnotations === true}
          annotationDefaultSymbol={field.annotationDefaultSymbol}
          annotationSymbols={field.annotationSymbols}
          annotationDefaultColor={field.annotationDefaultColor}
          annotationSizePercent={field.annotationSizePercent}
          numberFields={Array.isArray(field.numberFields) ? field.numberFields : []}
          totalCountLabel={field.totalCountLabel}
          counterGroups={Array.isArray(field.counterGroups) ? field.counterGroups : undefined}
          openInModal={field.openInModal === true}
          modalButtonText={field.modalButtonText}
          modalTitle={field.modalTitle}
          modalMinWidth={field.modalMinWidth}
          mapZoomPercent={field.mapZoomPercent}
          mapWidthPercent={field.mapWidthPercent}
          mapMaxWidth={field.mapMaxWidth}
          mapMinHeight={field.mapMinHeight}
          mapPaddingPx={field.mapPaddingPx}
          mapMarginPx={field.mapMarginPx}
          markerSize={field.markerSize}
          totalCountFieldId={field.totalCountFieldId}
          selectedIdsFieldId={field.selectedIdsFieldId}
          selectedLabelsFieldId={field.selectedLabelsFieldId}
          readOnly={isReadOnly}
        />
      )
    }

    // Text, long text, number, date, date-time, time, choice and yes/no.
    return renderEntryControl(field)
  }

  // A data-entry question drawn by FieldKit with the MOIS control the
  // exporter chooses for the same field (FieldKit.fromSubformEntry): a
  // TextArea, Numeric, DateSelect, DateTimeSelect, TimeSelect, a
  // SimpleCodeSelect (dropdown) or SimpleCodeChecklist (radio) choice, and a
  // CompactBooleanField yes/no (its check box for the checkbox render styles;
  // a yes/no with more than two options is a radio choice, as the exporter
  // draws it). The answer keeps SubformScoring's stored shapes
  // (FieldKit.storage.entry): an option's key or { selectedKey, value,
  // response, detailResponse } (structured options), a coded choice's Coding,
  // a clamped number, "YYYY-MM-DD", "YYYY-MM-DDTHH:mm" and "HH:mm". Answers
  // stay in this subform's store: controlled, with no fieldId.
  const renderEntryControl = (field, overrides = {}) => {
    const booleanEntry = field.type === "booleanYesNo" ? _booleanEntryOptions(field) : null
    let descriptor = FieldKit.fromSubformEntry(field)
    let selectable = []
    if (booleanEntry && booleanEntry.options.length > 2) {
      selectable = booleanEntry.options
      descriptor = {
        ...descriptor,
        type: "choice",
        choiceStyle: "radio",
        options: selectable.map((option) => ({ key: option.key, label: option.text })),
      }
    } else if (booleanEntry) {
      descriptor = {
        ...descriptor,
        booleanLabels: {
          on: booleanEntry.checkedOption?.text || "Yes",
          off: booleanEntry.uncheckedOption?.text || "No",
        },
      }
    } else if (descriptor.type === "choice" && !field.codeSystem) {
      selectable = _normalizeSelectableOptions(field)
      descriptor = { ...descriptor, options: selectable.map((option) => ({ key: option.key, label: option.text })) }
    }
    const storage = FieldKit.storage.entry(descriptor, {
      options: selectable,
      serialize: (option) => _serializeSelectableValue(field, option),
      isSelected: _isSelectableOptionSelected,
      checkedOption: booleanEntry?.checkedOption || null,
      uncheckedOption: booleanEntry?.uncheckedOption || null,
      // A check box left unticked stores the unchecked option only when the
      // field has one and no empty value (as the native check box did).
      falseIsEmpty: Boolean(booleanEntry) && descriptor.presentation === "checkbox" &&
        (_resolveFieldEmptyNumericValue(field) !== null || !booleanEntry.strictUncheckedOption),
      coerceNumber: field.type === "number"
        ? (text) => {
            const raw = String(text ?? "").trim()
            if (!raw) return null
            const parsed = Number(raw)
            return Number.isFinite(parsed) ? _clampDataEntryNumberValue(parsed, field) : raw
          }
        : undefined,
    })
    return FieldKit.renderControl(descriptor, {
      key: `field-${field.id}`,
      value: dataEntryValues[field.id],
      onChange: (stored) => setDataEntryValue(field.id, stored),
      storage,
      label: field.label,
      labelPosition: "top",
      required: field.required === true,
      readOnly: isReadOnly,
      placeholder: field.placeholder || undefined,
      // Fill the field's cell (the default "medium" caps at 320px).
      size: field.size || { minWidth: 120, flex: "1 1 0px" },
      ...overrides,
    })
  }

  const renderDataEntryScaleStack = (group) => {
    const fields = (Array.isArray(group?.fields) ? group.fields : [])
      .filter(isDataEntryFieldShown)
    if (fields.length === 0) return null

    const stackMinWidth = fields.reduce((widest, field) => {
      const optionCount = _buildScaleOptions(field).length
      return Math.max(widest, Math.max(360, optionCount * 64 + 170))
    }, 0)

    return (
      <div style={{ width: "100%", overflowX: "auto" }}>
        <div style={{ minWidth: `${stackMinWidth}px`, display: "flex", flexDirection: "column", gap: "4px" }}>
          {fields.map((field) => (
            <div key={`stacked-scale-${field.id}`}>
              {renderDataEntryField(field, { disableHorizontalScroll: true })}
              {_shouldShowDataEntryHelpText(field) ? (
                <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#666", marginTop: "2px" } }}>
                  {field.helpText}
                </Text>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------
  // Scale-matrix renderer
  // -------------------------------------------------------------------

  const renderDataEntryScaleMatrix = (group) => {
    const options = Array.isArray(group?.options) ? group.options : []
    const fields = (Array.isArray(group?.fields) ? group.fields : []).filter(isDataEntryFieldShown)
    if (options.length === 0 || fields.length === 0) return null

    const columnTemplate = `minmax(240px, 1.8fr) repeat(${options.length}, minmax(56px, 1fr))`

    return (
      <div
        key={`matrix-${group.matrixGroupId || fields.map((field) => field.id).join("-")}`}
        style={{
          width: "100%",
          border: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
          borderRadius: "8px",
          overflowX: "auto",
          backgroundColor: isDarkMode ? "#161616" : "#fff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: columnTemplate,
            gap: "8px",
            alignItems: "end",
            padding: "10px 12px",
            borderBottom: `1px solid ${isDarkMode ? "#333" : "#ececec"}`,
            backgroundColor: isDarkMode ? "#202020" : "#f8f8f8",
            minWidth: `${Math.max(640, 260 + options.length * 76)}px`,
          }}
        >
          <span />
          {options.map((option, index) => (
            <div
              key={`matrix-header-${index}-${option.value}`}
              style={{
                textAlign: "center",
                fontSize: "11px",
                lineHeight: 1.3,
                fontWeight: 700,
                color: isDarkMode ? "#f3f3f3" : "#222",
              }}
            >
              <div>{option.description || option.label || option.value}</div>
              {String(option.description || option.label || "") !== String(option.value) ? (
                <div style={{ fontSize: "10px", fontWeight: 500, opacity: 0.75 }}>
                  {option.value}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {fields.map((field, rowIndex) => (
          <div
            key={`matrix-row-${field.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: columnTemplate,
              gap: "8px",
              alignItems: "center",
              padding: "10px 12px",
              borderBottom: rowIndex < fields.length - 1
                ? `1px solid ${isDarkMode ? "#2a2a2a" : "#f0f0f0"}`
                : "none",
              minWidth: `${Math.max(640, 260 + options.length * 76)}px`,
            }}
          >
            <div>
              <Label required={field.required === true}>{field.label}</Label>
              {_shouldShowDataEntryHelpText(field) ? (
                <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#666", marginTop: "2px" } }}>
                  {field.helpText}
                </Text>
              ) : null}
            </div>

            {/* The row's answer is the exporter's scale control (ScaleField
                through FieldKit), its options spread under the header's
                columns; it stores { selectedKey, value, response,
                detailResponse } as the matrix always did. */}
            <div style={{ gridColumn: `2 / span ${options.length}`, minWidth: 0 }}>
              {FieldKit.renderControl(
                {
                  id: field.id,
                  type: "scale",
                  label: field.label,
                  required: field.required === true,
                  scaleConfig: {
                    options: options.map((option) => ({
                      value: option.value,
                      label: option.label || String(option.value),
                      description: option.description,
                    })),
                    showInlineLabels: false,
                    disableHorizontalScroll: true,
                  },
                },
                {
                  value: dataEntryValues[field.id] ?? null,
                  onChange: (answer) => setDataEntryValue(field.id, answer),
                  labelPosition: "none",
                  readOnly: isReadOnly,
                }
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // -------------------------------------------------------------------
  // Morphine-equivalence renderer
  // -------------------------------------------------------------------

  const renderMorphineCalculator = () => {
    if (!isMorphineCalculatorMode || !dataEntryCalculatorConfig) return null

    const rows = Array.isArray(dataEntryCalculatorConfig.rows) ? dataEntryCalculatorConfig.rows : []
    if (rows.length === 0) return null

    const rowValues = rows.map((row) => {
      const fromCalculation = row.meqCalculationId
        ? calculatedExpressions[row.meqCalculationId]
        : null
      const computedFallback = _computeMorphineEquivalent(
        dataEntryValues[row.inputFieldId],
        row.equivalentDoseMg,
        dataEntryCalculatorConfig.baseEquivalentDoseMg
      )
      return fromCalculation ?? computedFallback
    })

    const totalFromCalculation = dataEntryCalculatorConfig.totalCalculationId
      ? calculatedExpressions[dataEntryCalculatorConfig.totalCalculationId]
      : null
    const totalFallback = rowValues.reduce((sum, value) => {
      if (!Number.isFinite(Number(value))) return sum
      return sum + Number(value)
    }, 0)
    const hasAnyRowValue = rowValues.some((value) => Number.isFinite(Number(value)))
    const totalValue = totalFromCalculation ?? (hasAnyRowValue ? totalFallback : null)

    return (
      <div style={{
        border: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
        borderRadius: "6px",
        overflow: "hidden"
      }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr minmax(140px, 1fr) minmax(120px, 1fr) minmax(160px, 1fr)",
            gap: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            borderBottom: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
            backgroundColor: isDarkMode ? "#202020" : "#f8f8f8"
          }}
        >
          <span />
          <span>{dataEntryCalculatorConfig.doseColumnLabel}</span>
          <span>{dataEntryCalculatorConfig.equivalentColumnLabel}</span>
          <span>{dataEntryCalculatorConfig.resultColumnLabel}</span>
        </div>

        {rows.map((row, index) => {
          const field = dataEntryFieldById.get(row.inputFieldId)
          const inputType = field?.type === "text" ? "text" : "number"
          const meqValue = rowValues[index]
          const meqDisplay = _formatCalculatorDisplayValue(meqValue, row.precision, "-")

          return (
            <div
              key={`calculator-row-${row.id || row.inputFieldId}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr minmax(140px, 1fr) minmax(120px, 1fr) minmax(160px, 1fr)",
                gap: "8px",
                alignItems: "center",
                padding: "10px 12px",
                borderBottom: index < rows.length - 1
                  ? `1px solid ${isDarkMode ? "#333" : "#ececec"}`
                  : "none"
              }}
            >
              <Text styles={{ root: { fontSize: "16px", fontWeight: 500 } }}>
                {row.label}:
              </Text>
              {renderEntryControl(
                { ...(field || {}), id: row.inputFieldId, type: inputType, label: field?.label || row.label },
                { labelPosition: "none", inline: true, placeholder: inputType === "number" ? "0" : undefined, size: { maxWidth: 140 } }
              )}
              <Text styles={{ root: { fontSize: "20px", fontWeight: 500 } }}>
                {_formatCalculatorDisplayValue(row.equivalentDoseMg, 2, "-")}
              </Text>
              <Text styles={{ root: { fontSize: "22px", fontWeight: 700 } }}>
                {meqDisplay}
              </Text>
            </div>
          )
        })}

        <div style={{
          borderTop: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
          backgroundColor: isDarkMode ? "#252525" : "#f4f4f4",
          padding: "12px",
          display: "flex",
          justifyContent: "center",
          alignItems: "baseline",
          gap: "14px"
        }}>
          <Text styles={{ root: { fontSize: "36px", fontWeight: 800, letterSpacing: "0.02em" } }}>
            {dataEntryCalculatorConfig.totalLabel}:
          </Text>
          <Text styles={{ root: { fontSize: "40px", fontWeight: 800, lineHeight: 1 } }}>
            {_formatCalculatorDisplayValue(totalValue, dataEntryCalculatorConfig.totalPrecision)}
          </Text>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------
  // Blood-glucose renderer
  // -------------------------------------------------------------------

  const renderBloodGlucoseReadingEditor = () => {
    const rowLabels = ["AC/B", "PC/B", "AC/L", "PC/L", "AC/D", "PC/D", "HS"]
    const dateField = dataEntryFieldById.get("Date") || { id: "Date", label: "Select reading date" }
    const commentsField = dataEntryFieldById.get("Comments") || { id: "Comments", label: "Comments", rows: 3 }
    const fieldExists = (fieldId) => dataEntryFieldById.has(fieldId)
    const renderNumberInput = (fieldId) => renderEntryControl(
      { ...(dataEntryFieldById.get(fieldId) || {}), id: fieldId, type: "number", label: dataEntryFieldById.get(fieldId)?.label || fieldId },
      { labelPosition: "none", inline: true, size: { minWidth: 0 } }
    )

    return (
      <div data-component="SubForm" style={{ minWidth: "min(96vw, 760px)" }}>
        <Stack tokens={{ childrenGap: 12 }}>
          <div
            data-field-id={dateField.id}
            style={{ breakInside: "avoid", margin: "0 10px", flex: "2 2 0", minWidth: 80, maxWidth: 180 }}
          >
            {/* DateSelect through FieldKit: stores "YYYY-MM-DD" whether the
                control reports a Date (engine) or dotted text (preview). */}
            {renderEntryControl({ ...dateField, type: "date", label: dateField.label || "Select reading date" })}
          </div>

          <Toggle
            label="Show US (mg/dl) entry"
            checked={showBloodGlucoseUsEntry}
            onText="Yes"
            offText="No"
            onChange={(_event, checked) => setShowBloodGlucoseUsEntry(Boolean(checked))}
          />

          <table
            id="entryTable"
            style={{
              width: "100%",
              border: "1px solid black",
              borderCollapse: "collapse",
              marginBottom: 10,
            }}
          >
            <thead>
              <tr>
                <th style={{ width: showBloodGlucoseUsEntry ? "40%" : "50%" }} />
                <th style={{ width: showBloodGlucoseUsEntry ? "30%" : "50%" }}>CAD (mmol/L)</th>
                {showBloodGlucoseUsEntry && <th style={{ width: "30%" }}>US (mg/dL)</th>}
              </tr>
            </thead>
            <tbody>
              {rowLabels.map((label, index) => {
                const cadFieldId = `${label}.cad`
                const usFieldId = `${label}.us`
                if (!fieldExists(cadFieldId) && !fieldExists(usFieldId)) return null
                return (
                  <tr key={`bg-reading-${label}`} style={{ backgroundColor: index % 2 === 0 ? "whitesmoke" : "transparent" }}>
                    <td style={{ border: "1px solid black", padding: "6px 8px", fontWeight: 600 }}>{label}</td>
                    <td style={{ border: "1px solid black", padding: "6px 8px" }}>{renderNumberInput(cadFieldId)}</td>
                    {showBloodGlucoseUsEntry && (
                      <td style={{ border: "1px solid black", padding: "6px 8px" }}>{renderNumberInput(usFieldId)}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div data-field-id={commentsField.id} style={{ breakInside: "avoid", margin: "0 10px", maxWidth: 360 }}>
            {renderEntryControl({ ...commentsField, type: "textarea", label: commentsField.label || "Comments", rows: commentsField.rows || 3 })}
          </div>
        </Stack>
      </div>
    )
  }

  // -------------------------------------------------------------------
  // Summary renderer and dialog composition
  // -------------------------------------------------------------------

  const renderSummaryItem = (item, index) => {
    if (isDataEntryMode) {
      switch (item.type) {
        case "field": {
          const field = getDataEntryFieldConfig(item.fieldId)
          if (!field) return null
          return (
            <DataFieldSummaryItem
              key={`field-${index}`}
              field={field}
              value={dataEntryValues[field.id]}
              isDarkMode={isDarkMode}
            />
          )
        }
        case "calculation": {
          const calculation = getCalculationConfig(item.calculationId)
          if (!calculation) return null
          return (
            <CalculationSummaryItem
              key={`calc-${index}`}
              calculation={calculation}
              value={calculatedExpressions[calculation.id]}
              isDarkMode={isDarkMode}
            />
          )
        }
        case "interpretation": {
          const calculation = getCalculationConfig(item.calculationId)
          if (!calculation) return null
          return (
            <DataInterpretationSummaryItem
              key={`interp-${index}`}
              calculation={calculation}
              value={calculatedExpressions[calculation.id]}
              isDarkMode={isDarkMode}
            />
          )
        }
        case "progress":
          return (
            <ProgressSummaryItem
              key={`progress-${index}`}
              answered={progress.answered}
              total={progress.total}
              percentage={progress.percentage}
              isDarkMode={isDarkMode}
            />
          )
        default:
          return null
      }
    }

    switch (item.type) {
      case "total": {
        const total = getTotalConfig(item.totalId)
        if (!total) return null
        const calc = calculatedTotals[item.totalId]
        return (
          <ScoreSummaryItem
            key={`total-${index}`}
            total={total}
            score={calc?.score}
            isComplete={calc?.isComplete}
            isDarkMode={isDarkMode}
          />
        )
      }
      case "interpretation": {
        const total = getTotalConfig(item.totalId)
        if (!total) return null
        const calc = calculatedTotals[item.totalId]
        return (
          <InterpretationSummaryItem
            key={`interp-${index}`}
            total={total}
            score={calc?.score}
            isComplete={calc?.isComplete}
            isDarkMode={isDarkMode}
          />
        )
      }
      case "answer": {
        const question = getQuestionConfig(item.questionId)
        if (!question) return null
        return (
          <AnswerSummaryItem
            key={`answer-${index}`}
            question={question}
            answer={answers[item.questionId]}
            isDarkMode={isDarkMode}
          />
        )
      }
      case "progress":
        return (
          <ProgressSummaryItem
            key={`progress-${index}`}
            answered={progress.answered}
            total={progress.total}
            percentage={progress.percentage}
            isDarkMode={isDarkMode}
          />
        )
      default:
        return null
    }
  }

  // Done/Save & Add Next refuse to complete while a visible required field is
  // empty, like EditableTable's row Save: the dialog stays open and names them.
  // An answer its option rules no longer offer (a sibling or the chart
  // changed) blocks Done the same way, naming the field.
  const unavailableAnswerFields = isDataEntryMode && typeof FormLogicKit !== "undefined" && FormLogicKit && typeof FormLogicKit.hasUnavailableAnswer === "function"
    ? dataEntryFields.filter((field) => (
      field?.id && Array.isArray(field.optionRules) && field.optionRules.length > 0 &&
      isDataEntryFieldShown(field) &&
      FormLogicKit.hasUnavailableAnswer(dataEntryValues[field.id], field.optionRules, getVisibilityControllerValue)
    ))
    : []
  const blockOnMissingRequired = () => {
    if (missingRequiredFields.length === 0 && unavailableAnswerFields.length === 0) return false
    setShowRequiredErrors(true)
    return true
  }
  const requiredErrorMessage = showRequiredErrors
    ? [
      missingRequiredFields.length ? _formatMissingRequiredMessage(missingRequiredFields) : "",
      ...unavailableAnswerFields.map((field) => `${field.label || field.id}: choose an available option.`),
    ].filter(Boolean).join(" ")
    : ""
  const hostErrorMessage = typeof errorMessage === "string" ? errorMessage.trim() : ""
  const dialogErrorMessage = requiredErrorMessage || hostErrorMessage

  const containerStyle = {
    padding: "8px 0",
  }

  // Outer Required = the subform must be complete (its own progress metric).
  // Mirror the native MOIS affordance: warning tint + asterisk until done.
  const subformIncomplete = progress.total > 0 && progress.answered < progress.total
  const showRequiredHint = required && subformIncomplete
  const buttonRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    ...(showRequiredHint
      ? {
          background: theme?.mois?.requiredBackground ?? theme?.aihs?.requiredBackground ?? "#fff4ce",
          padding: "4px 6px",
          borderRadius: "4px",
        }
      : {}),
  }

  const summaryContainerStyle = {
    marginTop: hasAnyAnswers && showItems.length > 0 ? "10px" : 0,
    padding: hasAnyAnswers && showItems.length > 0 ? "10px 14px" : 0,
    borderRadius: "6px",
    backgroundColor: hasAnyAnswers && showItems.length > 0
      ? (isDarkMode ? "#1f1f1f" : "#fafafa")
      : "transparent",
    border: hasAnyAnswers && showItems.length > 0
      ? `1px solid ${isDarkMode ? "#333" : "#e8e8e8"}`
      : "none",
  }

  const summaryItemsStyle = summaryLayout === "inline"
    ? { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }
    : { display: "flex", flexDirection: "column", gap: "6px" }

  const dialogTitle = modalConfig.title || title || "Assessment"
  const configuredDialogMinWidth = Number(modalConfig.minWidth) || 700
  const widestScaleMinWidth = dataEntryFields.reduce((widest, field) => {
    if (field?.type !== "scale") return widest
    const optionCount = _buildScaleOptions(field).length
    return Math.max(widest, Math.max(360, optionCount * 64 + 170))
  }, 0)
  // ScaleField deliberately keeps its radio options on one row. Give that row
  // the dialog content padding it needs, but never make the modal wider than
  // the viewport; small screens retain the existing horizontal scroll escape.
  const desiredDialogMinWidth = Math.max(
    configuredDialogMinWidth,
    widestScaleMinWidth > 0 ? widestScaleMinWidth + 48 : 0
  )
  const showCalculationsInModal =
    Boolean(modalConfig.showCalculationsInModal) ||
    Boolean(modalConfig.show_calculations_in_modal)

  const handleSecondaryComplete = () => {
    if (isReadOnly) return
    const shouldClose = onSecondaryComplete({
      mode: isDataEntryMode ? "data-entry" : "scoring",
      dataEntryValues,
      calculatedExpressions,
      progress,
      answers,
      calculatedTotals,
    })
    if (shouldClose !== false) {
      if (blockOnMissingRequired()) return
      onCommitToParent?.(prepareCompletionState())
      setDialogOpen(false)
    }
  }

  const handleComplete = async () => {
    if (isReadOnly) return
    const shouldClose = onComplete?.({
      mode: isDataEntryMode ? "data-entry" : "scoring",
      dataEntryValues,
      calculatedExpressions,
      progress,
      answers,
      calculatedTotals,
    })
    if (shouldClose !== false) {
      // A host that keeps the dialog open (onComplete returning
      // false, e.g. EditableTable's row editor) runs its own
      // validation and reports it through errorMessage.
      if (blockOnMissingRequired()) return
      let actionPayload = null
      if (isDataEntryMode && dataEntryAction) {
        const writeDefinition = MOIS_WRITE_MUTATIONS[dataEntryAction.writeKey]
        const runMutation = writeMutationRunners[dataEntryAction.writeKey]
        const resolvedId = _resolveWriteActionId(
          writeDefinition.idVariable,
          dataEntryAction,
          { sd, fd, sourceData: sd, formData: fd?.field?.data, patient: sd?.patient }
        )
        let payload = _buildMappedPayload(dataEntryValues, dataEntryAction)
        if (writeDefinition.recordShape) {
          const contextRoot = { sd, fd, sourceData: sd, formData: fd?.field?.data, patient: sd?.patient }
          const shaped = _applyMoisRecordShape(payload, writeDefinition.recordShape, {
            patient: sd?.patient,
            patientId: resolvedId,
            encounterId: _resolveWriteActionId("encounterId", null, contextRoot),
            userId: _resolveWriteActionId("userId", null, contextRoot),
            today: _moisLocalToday(),
          })
          if (shaped.error) {
            // Refuse rather than send a partial record: the modal stays
            // open and the reason is recorded for the DebugView.
            _recordSubformActionPayload(fd?.setFormData, id, {
              kind: "moisMutation",
              resource: dataEntryAction.resource,
              mutation: dataEntryAction.mutation,
              error: shaped.error,
            })
            return
          }
          payload = shaped.record
        }
        const variables = writeDefinition.buildVariables(resolvedId, payload)
        actionPayload = {
          kind: "moisMutation",
          resource: dataEntryAction.resource,
          mutation: dataEntryAction.mutation,
          ...variables,
        }
        // When the id is folded into the payload there is no id
        // variable to inspect, so check the resolved id instead.
        const hasRequiredId =
          writeDefinition.requiresId === false ||
          (writeDefinition.injectContextIdInto
            ? Boolean(resolvedId)
            : Boolean(variables[writeDefinition.idVariable]))
        if (runMutation && hasRequiredId && Object.keys(payload).length > 0) {
          try {
            await runMutation(variables)
          } catch (error) {
            _recordSubformActionPayload(fd?.setFormData, id, {
              ...actionPayload,
              error: error?.message || String(error),
            })
            return
          }
        }
      }
      onCommitToParent?.(prepareCompletionState(actionPayload))
      setDialogOpen(false)
    }
  }

  const normalizedButtonIconName = String(buttonIconName ?? "").trim()
  const shouldUseDefaultButtonIcon = normalizedButtonIconName.length === 0
  const shouldHideButtonIcon = normalizedButtonIconName.toLowerCase() === "none"
  const triggerButtonIconProps = shouldHideButtonIcon
    ? undefined
    : { iconName: shouldUseDefaultButtonIcon ? (hasAnyAnswers ? "EditNote" : "ClipboardList") : normalizedButtonIconName }

  return (
    <div style={containerStyle}>
      <div style={buttonRowStyle}>
        {!hideTriggerButton && (
          <PrimaryButton
            text={buttonText}
            onClick={() => setDialogOpen(true)}
            iconProps={triggerButtonIconProps}
          />
        )}
        {!hideTriggerButton && !hideTitle && title && (
          <Text styles={{ root: { fontWeight: 600, fontSize: "14px" } }}>
            {title}
            {required && <span style={{ color: "#a4262c", marginLeft: "4px" }}>*</span>}
          </Text>
        )}
        {!hideTriggerButton && (hideTitle || !title) && required && (
          <span style={{ color: "#a4262c", fontWeight: 600 }}>*</span>
        )}
        {!hideTriggerButton && hasAnyAnswers && (
          <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#888" } }}>
            {progress.answered}/{progress.total} answered
          </Text>
        )}
      </div>

      {showSummary && hasAnyAnswers && showItems.length > 0 && (
        <div style={summaryContainerStyle}>
          <div style={summaryItemsStyle}>
            {showItems.map((item, idx) => renderSummaryItem(item, idx))}
          </div>
        </div>
      )}

      {/* DialogKit's RowDialog on the MOIS SubForm: blocking, so a click
          outside no longer closes it (and discards the session); the close
          button, Escape and Cancel ask before discarding changed answers.
          Read-only disables the body (a disabled fieldset) and Done. */}
      <DialogKit.RowDialog
        hidden={!isDialogOpen}
        title={dialogTitle}
        width={desiredDialogMinWidth}
        onSave={handleComplete}
        onCancel={() => setDialogOpen(false)}
        saveText={completeButtonText}
        cancelText={cancelButtonText}
        extraActions={typeof onSecondaryComplete === "function"
          ? [{ text: secondaryCompleteButtonText || "Save & Add Next", onClick: handleSecondaryComplete }]
          : []}
        errorMessage={dialogErrorMessage || undefined}
        readOnly={isReadOnly}
        dirty={isDialogDirty}
        confirmDiscard
      >
        {isDataEntryMode ? (
          <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: "4px" }}>
            {useBloodGlucoseReadingLayout ? (
              renderBloodGlucoseReadingEditor()
            ) : isMorphineCalculatorMode ? (
              renderMorphineCalculator()
            ) : dataEntryFields.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", columnGap: "12px", rowGap: "10px" }}>
                {dataEntryRenderGroups.map((entry, index) => {
                  if (entry.type === "scaleStack") {
                    return (
                      <div
                        key={`scale-stack-${index}`}
                        style={{ flex: "1 0 100%", maxWidth: "100%" }}
                      >
                        {renderDataEntryScaleStack(entry)}
                      </div>
                    )
                  }

                  if (entry.type === "scaleMatrix") {
                    return (
                      <div
                        key={`matrix-group-${entry.matrixGroupId || index}`}
                        style={{ flex: "1 0 100%", maxWidth: "100%" }}
                      >
                        {renderDataEntryScaleMatrix(entry)}
                      </div>
                    )
                  }

                  const field = entry.field
                  if (!isDataEntryFieldShown(field)) return null
                  const isHeading = _isHeadingField(field)
                  const basis = _resolveFieldWidthBasis(field)
                  let showLegendForScale = undefined
                  if (field.type === "scale" && field.showLegend === true) {
                    const currentSignature = _buildScaleLegendSignature(field)
                    let previousScaleSignature = null
                    for (let prevIndex = index - 1; prevIndex >= 0; prevIndex -= 1) {
                      const previousEntry = dataEntryRenderGroups[prevIndex]
                      if (!previousEntry || previousEntry.type !== "field") break
                      const previousField = previousEntry.field
                      if (_isHeadingField(previousField)) break
                      if (previousField?.type === "scale" && previousField.showLegend === true) {
                        previousScaleSignature = _buildScaleLegendSignature(previousField)
                      }
                      break
                    }
                    showLegendForScale = previousScaleSignature !== currentSignature
                  }
                  const containerStyle = _dataEntryFieldContainerStyle(field)
                  return (
                    <div key={field.id} style={containerStyle}>
                      {renderDataEntryField(field, { showLegend: showLegendForScale })}
                      {_shouldShowDataEntryHelpText(field) && !isHeading && (
                        <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#666", marginTop: "2px" } }}>
                          {field.helpText}
                        </Text>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <Text styles={{ root: { fontSize: "13px", color: isDarkMode ? "#a0a0a0" : "#666" } }}>
                No data-entry fields configured.
              </Text>
            )}
            {showCalculationsInModal && dataEntryCalculations.length > 0 && !isMorphineCalculatorMode && (
              <div style={{
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                {dataEntryCalculations.map((calculation) => {
                  const value = calculatedExpressions[calculation.id]
                  const isComplete = value !== null && value !== undefined
                  if (!isComplete && _calculationIncompleteBehavior(calculation) === "hide") {
                    return null
                  }
                  return (
                    <ComputedField
                      key={`modal-calc-${calculation.id}`}
                      fieldId={calculation.id}
                      label={calculation.label}
                      resolvedValue={_calculationPresentationValue(calculation, value, isComplete)}
                      presentationOnly
                      displayStyle={calculation.displayStyle || "field"}
                      readOnly
                      isDarkMode={isDarkMode}
                    />
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: "4px" }}>
            {dataEntryFields.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", columnGap: "12px", rowGap: "10px", marginBottom: "16px" }}>
                {dataEntryFields.map((field) => {
                  if (!isDataEntryFieldShown(field)) return null
                  const basis = _resolveFieldWidthBasis(field)
                  return (
                    <div
                      key={`supplemental-${field.id}`}
                      style={_dataEntryFieldContainerStyle(field)}
                    >
                      {renderDataEntryField(field)}
                    </div>
                  )
                })}
              </div>
            )}
            <ScoringModule
              id={id}
              config={config}
              title=""
              showProgress={showProgress}
            />
          </div>
        )}
      </DialogKit.RowDialog>
    </div>
  )
}

// =====================================================================
// Public wrapper: isolated session lifecycle and parent commit
// =====================================================================

const SubformScoring = (props) => {
  const {
    id = "subformScoring",
    isOpen: controlledIsOpen,
    onOpenChange,
    formDataOutputs = [],
    persistNestedFields = true,
    onCommitToParent: hostCommitToParent,
  } = props
  const [parentFd] = useActiveData()
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [sessionSeed, setSessionSeed] = useState(() => cloneFormSessionState(parentFd))

  const isDialogOpen = typeof controlledIsOpen === "boolean" ? controlledIsOpen : internalIsOpen
  const effectiveInitialData = useMemo(() => (
    isDialogOpen ? sessionSeed : cloneFormSessionState(parentFd)
  ), [isDialogOpen, parentFd, sessionSeed])

  const handleOpenChange = useCallback((nextValue) => {
    if (nextValue) {
      setSessionSeed(cloneFormSessionState(parentFd))
    }
    if (typeof controlledIsOpen !== "boolean") {
      setInternalIsOpen(nextValue)
    }
    onOpenChange?.(nextValue)
  }, [controlledIsOpen, onOpenChange, parentFd])

  const mergeSessionIntoParent = useCallback((sessionFd) => {
    if (!parentFd?.setFormData) return
    const sessionState = cloneFormSessionState(sessionFd)
    parentFd.setFormData((current) => {
      const nextState = cloneFormSessionState(current)
      if (persistNestedFields !== false) {
        mergeFormSessionState(nextState, sessionState)
      } else {
        if (!nextState.field) nextState.field = { data: {}, status: {}, history: [] }
        if (!nextState.field.data) nextState.field.data = {}
        for (const output of formDataOutputs || []) {
          if (!output?.targetPath) continue
          const value = _getValueAtPath(sessionState?.field?.data, output.targetPath)
          if (value !== undefined) {
            _setValueAtPath(
              nextState.field.data,
              output.targetPath,
              __cloneSubformScoringSessionValue(value, null)
            )
          }
        }
        const componentPayloads = sessionState?.field?.data?.__componentPayloads
        if (componentPayloads) {
          nextState.field.data.__componentPayloads = __cloneSubformScoringSessionValue(componentPayloads, {})
        }
      }
      return nextState
    })
  }, [formDataOutputs, parentFd, persistNestedFields])

  // Merge the isolated session into the parent form, then hand the committed
  // state to the host's own onCommitToParent (ChartRecordManager refreshes the
  // chart there). The two compose: `{...props}` used to be overridden by this
  // wrapper, so a host's callback silently never ran.
  const handleCommitToParent = useCallback((sessionFd) => {
    mergeSessionIntoParent(sessionFd)
    if (typeof hostCommitToParent === "function") hostCommitToParent(sessionFd)
  }, [hostCommitToParent, mergeSessionIntoParent])

  return (
    <FormSessionProvider initialFormData={effectiveInitialData}>
      <SubformScoringInner
        {...props}
        id={id}
        isOpen={isDialogOpen}
        onOpenChange={handleOpenChange}
        onCommitToParent={handleCommitToParent}
      />
    </FormSessionProvider>
  )
}
