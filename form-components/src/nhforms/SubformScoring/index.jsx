/**
 * SubformScoring - Modal subform supporting scoring and data-entry modes.
 *
 * mode="scoring": existing behavior, opens ScoringModule in a dialog.
 * mode="data-entry": opens regular fields in a dialog with optional calculations.
 */

const { useState, useMemo, useCallback, useEffect } = React
const {
  Stack,
  Label,
  Text,
  PrimaryButton,
  DefaultButton,
  Dialog,
  DialogType,
  Toggle,
} = Fluent

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

// ================================================
// Scoring helpers (same logic as ScoringModule)
// ================================================

const _resolveQuestionOptions = (question, sharedOptions) => {
  const questionOptions = Array.isArray(question?.options) ? question.options : []
  if (questionOptions.length > 0) return questionOptions
  return Array.isArray(sharedOptions) ? sharedOptions : []
}

const _buildScoreMap = (questions, sharedOptions) => {
  const map = new Map()
  for (const question of questions || []) {
    const optionMap = new Map()
    for (const opt of _resolveQuestionOptions(question, sharedOptions)) {
      optionMap.set(opt.key, opt.score ?? 0)
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

const _collectScoreCandidates = (value, out = new Set(), depth = 0) => {
  if (depth > 4 || value === null || value === undefined) return out

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const token = String(value).trim()
    if (token) out.add(token)
    return out
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => _collectScoreCandidates(entry, out, depth + 1))
    return out
  }

  if (typeof value !== "object") return out

  const candidateKeys = [
    "code",
    "key",
    "value",
    "id",
    "text",
    "display",
    "label",
    "state",
    "fieldId",
  ]
  candidateKeys.forEach((key) => {
    _collectScoreCandidates(value[key], out, depth + 1)
  })

  if (Array.isArray(value.selectedItems)) {
    value.selectedItems.forEach((entry) => _collectScoreCandidates(entry, out, depth + 1))
  }
  _collectScoreCandidates(value.selectedItem, out, depth + 1)
  if (Array.isArray(value.selectedIds)) {
    value.selectedIds.forEach((entry) => _collectScoreCandidates(entry, out, depth + 1))
  }
  if (Array.isArray(value.selectedLabels)) {
    value.selectedLabels.forEach((entry) => _collectScoreCandidates(entry, out, depth + 1))
  }

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
  "patient.changePatientName": {
    document: `mutation changePatientName($patientId: Int!, $patientUpdate: PatientInput!) {
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
  "patient.changePatientRace": {
    document: `mutation changePatientRace($patientId: Int!, $newPatient: PatientInput!) {
      changePatient(patientId: $patientId, newPatient: $newPatient) {
        patientId
      }
    }`,
    idVariable: "patientId",
    buildVariables: (patientId, payload) => ({ patientId, newPatient: payload }),
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
    buildVariables: (patientId, payload) => ({ patientId, longTermMedication: payload }),
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

    const report = output.reportTemplate
      ? _resolveObservationTemplate(output.reportTemplate, allValues)
      : ""
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

// ================================================
// Data-entry helpers
// ================================================

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

const _isHeadingField = (field) => field?.type === "heading"

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

const _normalizeSelectableOptions = (field, fallbackOptions = []) => {
  const rawOptions = Array.isArray(field?.options) && field.options.length > 0
    ? field.options
    : fallbackOptions

  return rawOptions
    .map((option, index) => {
      if (option && typeof option === "object" && !Array.isArray(option)) {
        const rawValue =
          option.value ??
          option.key ??
          option.id ??
          option.label ??
          option.text ??
          index
        const key = String(option.key ?? option.id ?? rawValue ?? `option_${index + 1}`)
        const text = String(option.label ?? option.text ?? rawValue ?? `Option ${index + 1}`)
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

const _resolveFieldDefaultValue = (field, sd, allowObservationDefault = true) => {
  if (!field || _isHeadingField(field)) return undefined

  const observationDefault = allowObservationDefault ? _latestObservationDefault(field, sd) : undefined
  const explicitDefault = observationDefault ?? field.defaultValue ?? field.default_value
  if (explicitDefault === undefined) return undefined

  if (explicitDefault === "__today") {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const day = String(today.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
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
    const matrixGroupId = typeof field?.matrixGroupId === "string" ? field.matrixGroupId.trim() : ""
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
  return groups
}

const _isScaleChoiceSelected = (value, option) => {
  const optionValue = String(option?.value ?? "")
  if (value && typeof value === "object") {
    if (value.selectedKey !== null && value.selectedKey !== undefined) {
      return String(value.selectedKey) === optionValue
    }
    if (Number.isFinite(value.value)) {
      return Number(value.value) === Number(option.value)
    }
  }
  const numeric = _toNumericValue(value)
  if (numeric !== null) {
    return numeric === Number(option.value)
  }
  return false
}

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

const _LOCAL_INPUT_STYLE = (isDarkMode) => ({
  width: "100%",
  minHeight: "34px",
  borderRadius: "2px",
  border: `1px solid ${isDarkMode ? "#5a5a5a" : "#b8b8b8"}`,
  backgroundColor: isDarkMode ? "#1a1a1a" : "#fff",
  color: isDarkMode ? "#fff" : "#111",
  padding: "6px 8px",
  fontSize: "14px",
  boxSizing: "border-box",
})

const _LOCAL_TEXTAREA_STYLE = (isDarkMode) => ({
  ..._LOCAL_INPUT_STYLE(isDarkMode),
  minHeight: "96px",
  resize: "vertical",
  fontFamily: "inherit",
})

const _LOCAL_RADIO_GROUP_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
}

// ================================================
// Summary sub-components
// ================================================

const ScoreSummaryItem = ({ total, score, isComplete, isDarkMode }) => {
  const style = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    borderRadius: "4px",
    backgroundColor: isDarkMode ? "#1a3a5c" : "#e6f2ff",
    border: `1px solid ${isDarkMode ? "#2a5a8c" : "#b8d4f0"}`,
  }

  if (!isComplete) {
    return (
      <div style={{ ...style, backgroundColor: isDarkMode ? "#3a3a1a" : "#fff8e6", border: `1px solid ${isDarkMode ? "#5a5a2a" : "#f0e0b8"}` }}>
        <Text styles={{ root: { fontWeight: 600, fontSize: "13px" } }}>{total.label}:</Text>
        <Text styles={{ root: { fontSize: "13px", color: isDarkMode ? "#cca050" : "#996600", fontStyle: "italic" } }}>
          Incomplete
        </Text>
      </div>
    )
  }

  return (
    <div style={style}>
      <Text styles={{ root: { fontWeight: 600, fontSize: "13px" } }}>{total.label}:</Text>
      <Text styles={{ root: { fontWeight: 700, fontSize: "16px" } }}>{score}</Text>
    </div>
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

  const style = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    borderRadius: "4px",
    backgroundColor: isDarkMode ? "#1a3a5c" : "#e6f2ff",
    border: `1px solid ${isDarkMode ? "#2a5a8c" : "#b8d4f0"}`,
  }

  if (value === null || value === undefined) {
    return (
      <div style={{ ...style, backgroundColor: isDarkMode ? "#3a3a1a" : "#fff8e6", border: `1px solid ${isDarkMode ? "#5a5a2a" : "#f0e0b8"}` }}>
        <Text styles={{ root: { fontWeight: 600, fontSize: "13px" } }}>{calculation.label}:</Text>
        <Text styles={{ root: { fontSize: "13px", color: isDarkMode ? "#cca050" : "#996600", fontStyle: "italic" } }}>
          Incomplete
        </Text>
      </div>
    )
  }

  return (
    <div style={style}>
      <Text styles={{ root: { fontWeight: 600, fontSize: "13px" } }}>{calculation.label}:</Text>
      <Text styles={{ root: { fontWeight: 700, fontSize: "16px" } }}>{value}</Text>
    </div>
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

// ================================================
// Main component
// ================================================

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
  ...props
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [fd] = useFormSessionData()
  const sd = useSourceData()
  // One useMutation per supported write action. Iterating a module-constant
  // key array keeps the hook count and order deterministic across renders
  // (rules-of-hooks safe); the executor picks the runner by action key.
  const writeMutationRunners = {}
  for (const writeKey of MOIS_WRITE_MUTATION_KEYS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    writeMutationRunners[writeKey] = useMutation(MOIS_WRITE_MUTATIONS[writeKey].document)[0]
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

  // Scoring-mode answer and score calculations
  const scoreMap = useMemo(() => {
    if (isDataEntryMode) return new Map()
    return _buildScoreMap(config.questions, config.sharedOptions)
  }, [isDataEntryMode, config.questions, config.sharedOptions])

  const answers = useMemo(() => {
    if (isDataEntryMode) return {}
    const result = {}
    for (const question of config.questions || []) {
      const value = fd?.field?.data?.[question.id]
      if (value !== undefined && value !== null && value !== "") {
        result[question.id] = value
      }
    }
    return result
  }, [isDataEntryMode, fd, config.questions])

  const calculatedTotals = useMemo(() => {
    if (isDataEntryMode) return {}
    const results = {}
    const questionsById = new Map((config.questions || []).map((question) => [question.id, question]))
    const totals = Array.isArray(config.calculatedValues) && config.calculatedValues.length > 0
      ? config.calculatedValues
      : config.totals || []
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
        const evaluated = isComplete ? _evaluateExpression(total.expression, expressionVars) : null
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

  // Data-entry-mode values and calculations
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
    const totalLabel = String(rawConfig.totalLabel || rawConfig.total_label || "TOTAL MEQ").trim() || "TOTAL MEQ"
    const doseColumnLabel = String(rawConfig.doseColumnLabel || rawConfig.dose_column_label || "Total Daily Dose").trim() || "Total Daily Dose"
    const equivalentColumnLabel = String(rawConfig.equivalentColumnLabel || rawConfig.equivalent_column_label || "Equivalent Dose (mg)").trim() || "Equivalent Dose (mg)"
    const resultColumnLabel = String(rawConfig.resultColumnLabel || rawConfig.result_column_label || "Morphine Equivalent (MEQ)").trim() || "Morphine Equivalent (MEQ)"

    return {
      type: normalizedType,
      rows,
      baseEquivalentDoseMg,
      totalCalculationId,
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
    if (!isDataEntryMode || !isDialogOpen) return

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
  }, [bringForward, isDataEntryMode, isDialogOpen, dataEntryFields, dataEntryValues, fd, onDataEntryValueChange, sd])

  const dataEntryCalculations = useMemo(() => {
    if (Array.isArray(dataEntryConfig?.calculatedValues) && dataEntryConfig.calculatedValues.length > 0) {
      return dataEntryConfig.calculatedValues
    }
    return Array.isArray(dataEntryConfig?.calculations) ? dataEntryConfig.calculations : []
  }, [dataEntryConfig])

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
    const result = {}
    for (const calculation of dataEntryCalculations) {
      const value = _evaluateExpression(calculation.expression, vars)
      if (value === null || value === undefined) {
        result[calculation.id] = null
        continue
      }
      const precision = Number.isFinite(calculation.precision) ? Math.max(0, Math.min(6, calculation.precision)) : null
      result[calculation.id] = precision === null ? value : Number(value.toFixed(precision))
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
      result[dataEntryCalculatorConfig.totalCalculationId] = numericValues.length > 0
        ? Number(numericValues.reduce((sum, value) => sum + value, 0).toFixed(1))
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
        : dataEntryFields.filter((field) => !_isHeadingField(field))
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

    const total = config.questions?.length || 0
    const answered = (config.questions || []).filter((question) => {
      const value = answers[question.id]
      const optionScoreMap = scoreMap.get(question.id)
      return _getScoreFromValue(value, optionScoreMap) !== null
    }).length
    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0
    }
  }, [isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryFieldById, dataEntryFields, dataEntryValues, config.questions, answers])

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

  const prepareCompletionState = useCallback((actionPayload) => {
    const payload = _buildSubformObservationUpdates(observationOutputs, {
      answers,
      calculatedExpressions,
      calculatedTotals,
      dataEntryValues,
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
  }, [answers, calculatedExpressions, calculatedTotals, dataEntryFields, dataEntryValueRoot, dataEntryValues, fd, formDataOutputs, id, observationOutputs, sd])

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

  const renderDataEntryField = (field, renderOptions = {}) => {
    if (_isHeadingField(field)) {
      return (
        <Text
          key={`field-${field.id}`}
          styles={{
            root: {
              marginTop: "12px",
              marginBottom: "2px",
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
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
          valueRoot={hasExternalDataEntryStore ? dataEntryValueRoot : undefined}
          onValueChange={setDataEntryValue}
        />
      )
    }

    if (field.type === "number") {
      const inputValue = dataEntryValues[field.id]
      return (
        <div key={`field-${field.id}`}>
          <Label required={required}>{field.label}</Label>
          <input
            type="number"
            inputMode="decimal"
            min={Number.isFinite(field.min) ? field.min : undefined}
            max={Number.isFinite(field.max) ? field.max : undefined}
            step={Number.isFinite(field.step) ? field.step : "any"}
            placeholder={field.placeholder}
            value={inputValue === null || inputValue === undefined ? "" : String(inputValue)}
            onChange={(event) => {
              const nextRaw = event?.target?.value ?? ""
              if (!nextRaw) {
                setDataEntryValue(field.id, null)
                return
              }
              const parsed = Number(nextRaw)
              setDataEntryValue(field.id, Number.isFinite(parsed) ? parsed : nextRaw)
            }}
            style={_LOCAL_INPUT_STYLE(isDarkMode)}
          />
        </div>
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
          showTooltip={field.showTooltip === true}
        />
      )
    }

    if (field.type === "date") {
      return (
        <div key={`field-${field.id}`}>
          <Label required={required}>{field.label}</Label>
          <input
            type="date"
            placeholder={field.placeholder}
            value={dataEntryValues[field.id] ?? ""}
            onChange={(event) => setDataEntryValue(field.id, event?.target?.value ?? "")}
            style={_LOCAL_INPUT_STYLE(isDarkMode)}
          />
        </div>
      )
    }

    if (field.type === "datetime") {
      return (
        <div key={`field-${field.id}`}>
          <Label required={required}>{field.label}</Label>
          <input
            type="datetime-local"
            placeholder={field.placeholder}
            value={dataEntryValues[field.id] ?? ""}
            onChange={(event) => setDataEntryValue(field.id, event?.target?.value ?? "")}
            style={_LOCAL_INPUT_STYLE(isDarkMode)}
          />
        </div>
      )
    }

    if (field.type === "choice") {
      if (field.codeSystem && typeof FindCodeSelect !== "undefined") {
        return (
          <FindCodeSelect
            key={`field-${field.id}`}
            fieldId={`subform_${id}_${field.id}`}
            label={field.label}
            codeSystem={field.codeSystem}
            value={dataEntryValues[field.id] ?? null}
            defaultValue={_resolveFieldDefaultValue(field, sd, bringForward)}
            placeholder={field.placeholder || "Please search"}
            required={required}
            openOnFocus
            showOtherOption={Boolean(field.showOtherOption || field.show_other_option)}
            onChange={(nextValue) => setDataEntryValue(field.id, nextValue)}
          />
        )
      }
      const optionList = _normalizeSelectableOptions(field)
      const useRadio = field.choiceStyle === "radio"
      const selectedOption = optionList.find((option) => _isSelectableOptionSelected(dataEntryValues[field.id], option)) || null
      if (useRadio) {
        return (
          <div key={`field-${field.id}`}>
            <Label required={required}>{field.label}</Label>
            <div style={_LOCAL_RADIO_GROUP_STYLE}>
              {optionList.map((option) => (
                <label
                  key={`${field.id}_${option.key}`}
                  style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name={`subform_choice_${field.id}`}
                    checked={Boolean(selectedOption && selectedOption.key === option.key)}
                    onChange={() => setDataEntryValue(field.id, _serializeSelectableValue(field, option))}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          </div>
        )
      }
      return (
        <div key={`field-${field.id}`}>
          <Label required={required}>{field.label}</Label>
          <select
            value={selectedOption?.key ?? ""}
            onChange={(event) => {
              const nextKey = event?.target?.value || null
              if (!nextKey) {
                setDataEntryValue(field.id, null)
                return
              }
              const nextOption = optionList.find((option) => option.key === nextKey) || null
              setDataEntryValue(field.id, nextOption ? _serializeSelectableValue(field, nextOption) : nextKey)
            }}
            style={_LOCAL_INPUT_STYLE(isDarkMode)}
          >
            <option value="">Select...</option>
            {optionList.map((option) => (
              <option key={`${field.id}_${option.key}`} value={option.key}>
                {option.text}
              </option>
            ))}
          </select>
        </div>
      )
    }

    if (field.type === "booleanYesNo") {
      const optionList = _normalizeSelectableOptions(field, ["Yes", "No"])
      const selectedOption = optionList.find((option) => _isSelectableOptionSelected(dataEntryValues[field.id], option)) || null
      const renderStyle = String(field.renderStyle || field.render_style || "").trim().toLowerCase()
      if (renderStyle === "checkbox" || renderStyle === "checklist-row") {
        const { checkedOption, uncheckedOption } = _resolveSelectableBinaryOptions(field, ["Yes", "No"])
        const checked = checkedOption ? _isSelectableOptionSelected(dataEntryValues[field.id], checkedOption) : false
        const controlLabel = checkedOption?.text || "Yes"
        const useToggleSwitch = field.useToggleSwitch === true || field.use_toggle_switch === true
        return (
          <div key={`field-${field.id}`}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <Label required={required} styles={{ root: { marginBottom: 0 } }}>
                {field.label}
              </Label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <input
                  type="checkbox"
                  role={useToggleSwitch ? "switch" : undefined}
                  checked={Boolean(checked)}
                  onChange={(event) => {
                    if (event?.target?.checked) {
                      setDataEntryValue(field.id, _serializeSelectableValue(field, checkedOption))
                      return
                    }
                    if (_resolveFieldEmptyNumericValue(field) !== null) {
                      setDataEntryValue(field.id, null)
                      return
                    }
                    setDataEntryValue(field.id, uncheckedOption ? _serializeSelectableValue(field, uncheckedOption) : null)
                  }}
                  style={useToggleSwitch ? {
                    appearance: "none",
                    WebkitAppearance: "none",
                    width: "34px",
                    height: "18px",
                    borderRadius: "999px",
                    border: `1px solid ${checked ? "#2563eb" : "#94a3b8"}`,
                    background: checked ? "#2563eb" : "#e2e8f0",
                    boxShadow: `inset ${checked ? "16px" : "2px"} 0 0 2px #ffffff`,
                    transition: "background 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
                  } : undefined}
                />
                <span>{controlLabel}</span>
              </label>
            </div>
          </div>
        )
      }
      return (
        <div key={`field-${field.id}`}>
          <Label required={required}>{field.label}</Label>
          <div style={_LOCAL_RADIO_GROUP_STYLE}>
            {optionList.map((option) => (
              <label
                  key={`${field.id}_${option.key}`}
                  style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name={`subform_boolean_${field.id}`}
                    checked={Boolean(selectedOption && selectedOption.key === option.key)}
                    onChange={() => setDataEntryValue(field.id, _serializeSelectableValue(field, option))}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
          </div>
        </div>
      )
    }

    if (field.type === "textarea") {
      return (
        <div key={`field-${field.id}`}>
          <Label required={required}>{field.label}</Label>
          <textarea
            rows={field.rows || 4}
            placeholder={field.placeholder}
            value={dataEntryValues[field.id] ?? ""}
            onChange={(event) => setDataEntryValue(field.id, event?.target?.value ?? "")}
            style={_LOCAL_TEXTAREA_STYLE(isDarkMode)}
          />
        </div>
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
        />
      )
    }

    return (
      <div key={`field-${field.id}`}>
        <Label required={required}>{field.label}</Label>
        <input
          type="text"
          placeholder={field.placeholder}
          value={dataEntryValues[field.id] ?? ""}
          onChange={(event) => setDataEntryValue(field.id, event?.target?.value ?? "")}
          style={_LOCAL_INPUT_STYLE(isDarkMode)}
        />
      </div>
    )
  }

  const renderDataEntryScaleMatrix = (group) => {
    const options = Array.isArray(group?.options) ? group.options : []
    const fields = Array.isArray(group?.fields) ? group.fields : []
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
              {field.helpText ? (
                <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#666", marginTop: "2px" } }}>
                  {field.helpText}
                </Text>
              ) : null}
            </div>

            {options.map((option) => {
              const checked = _isScaleChoiceSelected(dataEntryValues[field.id], option)
              return (
                <label
                  key={`matrix-option-${field.id}-${option.value}`}
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    cursor: "pointer",
                    minHeight: "34px",
                  }}
                >
                  <input
                    type="radio"
                    name={`subform_matrix_${field.id}`}
                    checked={checked}
                    onChange={() =>
                      setDataEntryValue(field.id, {
                        selectedKey: String(option.value),
                        value: option.value,
                        response: option.label || String(option.value),
                        detailResponse: option.description || option.label || String(option.value),
                      })
                    }
                  />
                </label>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

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
          const rawValue = dataEntryValues[row.inputFieldId]
          const displayValue = rawValue === null || rawValue === undefined ? "" : String(rawValue)
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
              <input
                type={inputType}
                inputMode="decimal"
                step="any"
                value={displayValue}
                placeholder={inputType === "number" ? "0" : ""}
                onChange={(event) => {
                  const nextRaw = event?.target?.value ?? ""
                  if (!nextRaw) {
                    setDataEntryValue(row.inputFieldId, null)
                    return
                  }
                  if (inputType === "number") {
                    const parsed = Number(nextRaw)
                    setDataEntryValue(row.inputFieldId, Number.isFinite(parsed) ? parsed : nextRaw)
                    return
                  }
                  setDataEntryValue(row.inputFieldId, nextRaw)
                }}
                style={{
                  width: "100%",
                  maxWidth: "140px",
                  height: "34px",
                  borderRadius: "2px",
                  border: `1px solid ${isDarkMode ? "#5a5a5a" : "#b8b8b8"}`,
                  backgroundColor: isDarkMode ? "#1a1a1a" : "#fff",
                  color: isDarkMode ? "#fff" : "#111",
                  padding: "4px 8px",
                  fontSize: "15px"
                }}
              />
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
            {_formatCalculatorDisplayValue(totalValue, 1)}
          </Text>
        </div>
      </div>
    )
  }

  const renderBloodGlucoseReadingEditor = () => {
    const rowLabels = ["AC/B", "PC/B", "AC/L", "PC/L", "AC/D", "PC/D", "HS"]
    const dateField = dataEntryFieldById.get("Date") || { id: "Date", label: "Select reading date" }
    const commentsField = dataEntryFieldById.get("Comments") || { id: "Comments", label: "Comments", rows: 3 }
    const fieldExists = (fieldId) => dataEntryFieldById.has(fieldId)
    const renderNumberInput = (fieldId) => (
      <input
        id={fieldId}
        type="number"
        inputMode="decimal"
        step="any"
        value={dataEntryValues[fieldId] === null || dataEntryValues[fieldId] === undefined ? "" : String(dataEntryValues[fieldId])}
        onChange={(event) => {
          const nextRaw = event?.target?.value ?? ""
          if (!nextRaw) {
            setDataEntryValue(fieldId, null)
            return
          }
          const parsed = Number(nextRaw)
          setDataEntryValue(fieldId, Number.isFinite(parsed) ? parsed : nextRaw)
        }}
        style={{
          width: "100%",
          minWidth: "0",
          border: `1px solid ${isDarkMode ? "#5a5a5a" : "#b8b8b8"}`,
          backgroundColor: isDarkMode ? "#1a1a1a" : "#fff",
          color: isDarkMode ? "#fff" : "#111",
          padding: "4px 6px",
          fontSize: "14px",
          textAlign: "center",
        }}
      />
    )

    return (
      <div data-component="SubForm" style={{ minWidth: "min(96vw, 760px)" }}>
        <Stack tokens={{ childrenGap: 12 }}>
          <div
            data-field-id={dateField.id}
            style={{ breakInside: "avoid", margin: "0 10px", flex: "2 2 0", minWidth: 80, maxWidth: 180 }}
          >
            <Label required={dateField.required === true}>{dateField.label || "Select reading date"}</Label>
            <input
              id={dateField.id}
              type="date"
              value={dataEntryValues[dateField.id] ?? ""}
              onChange={(event) => setDataEntryValue(dateField.id, event?.target?.value ?? "")}
              style={_LOCAL_INPUT_STYLE(isDarkMode)}
            />
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
            <Label>{commentsField.label || "Comments"}</Label>
            <textarea
              id={commentsField.id}
              rows={commentsField.rows || 3}
              value={dataEntryValues[commentsField.id] ?? ""}
              onChange={(event) => setDataEntryValue(commentsField.id, event?.target?.value ?? "")}
              style={_LOCAL_TEXTAREA_STYLE(isDarkMode)}
            />
          </div>
        </Stack>
      </div>
    )
  }

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

  const containerStyle = {
    padding: "8px 0",
  }

  const buttonRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
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
  const dialogMinWidth = modalConfig.minWidth || 700
  const showCalculationsInModal =
    Boolean(modalConfig.showCalculationsInModal) ||
    Boolean(modalConfig.show_calculations_in_modal)

  const dialogContentProps = {
    type: DialogType.largeHeader,
    title: dialogTitle,
    closeButtonAriaLabel: "Close",
  }

  const modalProps = {
    isBlocking: false,
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
          </Text>
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

      <Dialog
        hidden={!isDialogOpen}
        onDismiss={() => setDialogOpen(false)}
        dialogContentProps={dialogContentProps}
        modalProps={modalProps}
        minWidth={dialogMinWidth}
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
                  if (!_evaluateDataEntryVisibility(field, dataEntryValues)) return null
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
                  const containerStyle = isHeading
                    ? { flex: "1 0 100%", maxWidth: "100%" }
                    : { flex: `1 1 ${basis}`, maxWidth: basis, minWidth: "220px" }
                  return (
                    <div key={field.id} style={containerStyle}>
                      {renderDataEntryField(field, { showLegend: showLegendForScale })}
                      {field.helpText && !isHeading && (
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
                  return (
                    <div
                      key={`modal-calc-${calculation.id}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "12px"
                      }}
                    >
                      <Text styles={{ root: { fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em" } }}>
                        {calculation.label.toUpperCase()}:
                      </Text>
                      <Text styles={{ root: { fontSize: "26px", fontWeight: 700, lineHeight: 1 } }}>
                        {value ?? "Incomplete"}
                      </Text>
                    </div>
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
                  if (!_evaluateDataEntryVisibility(field, dataEntryValues)) return null
                  const basis = _resolveFieldWidthBasis(field)
                  return (
                    <div
                      key={`supplemental-${field.id}`}
                      style={{ flex: `1 1 ${basis}`, maxWidth: basis, minWidth: "220px" }}
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
        <div style={{ height: "16px" }} />
        <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
          {typeof onSecondaryComplete === "function" ? (
            <DefaultButton
              text={secondaryCompleteButtonText || "Save & Add Next"}
              onClick={() => {
                const shouldClose = onSecondaryComplete({
                  mode: isDataEntryMode ? "data-entry" : "scoring",
                  dataEntryValues,
                  calculatedExpressions,
                  progress,
                  answers,
                  calculatedTotals,
                })
                if (shouldClose !== false) {
                  onCommitToParent?.(prepareCompletionState())
                  setDialogOpen(false)
                }
              }}
            />
          ) : null}
          <PrimaryButton
            text={completeButtonText}
            onClick={async () => {
              const shouldClose = onComplete?.({
                mode: isDataEntryMode ? "data-entry" : "scoring",
                dataEntryValues,
                calculatedExpressions,
                progress,
                answers,
                calculatedTotals,
              })
              if (shouldClose !== false) {
                let actionPayload = null
                if (isDataEntryMode && dataEntryAction) {
                  const writeDefinition = MOIS_WRITE_MUTATIONS[dataEntryAction.writeKey]
                  const runMutation = writeMutationRunners[dataEntryAction.writeKey]
                  const resolvedId = _resolveWriteActionId(
                    writeDefinition.idVariable,
                    dataEntryAction,
                    { sd, fd, sourceData: sd, formData: fd?.field?.data, patient: sd?.patient }
                  )
                  const payload = _buildMappedPayload(dataEntryValues, dataEntryAction)
                  const variables = writeDefinition.buildVariables(resolvedId, payload)
                  actionPayload = {
                    kind: "moisMutation",
                    resource: dataEntryAction.resource,
                    mutation: dataEntryAction.mutation,
                    ...variables,
                  }
                  const hasRequiredId =
                    writeDefinition.requiresId === false ||
                    Boolean(variables[writeDefinition.idVariable])
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
            }}
          />
          <DefaultButton text={cancelButtonText} onClick={() => setDialogOpen(false)} />
        </Stack>
      </Dialog>
    </div>
  )
}

const SubformScoring = (props) => {
  const {
    id = "subformScoring",
    isOpen: controlledIsOpen,
    onOpenChange,
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

  const handleCommitToParent = useCallback((sessionFd) => {
    if (!parentFd?.setFormData) return
    const sessionState = cloneFormSessionState(sessionFd)
    parentFd.setFormData((current) => {
      const nextState = cloneFormSessionState(current)
      mergeFormSessionState(nextState, sessionState)
      return nextState
    })
  }, [parentFd])

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
