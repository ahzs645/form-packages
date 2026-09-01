// ObservationValueKit — non-rendering value/write kernel for panel-entry
// composites. It follows the real NHForms CommonSchemaDefn pattern: keep the
// observation data contract in one shared helper and let renderers focus on UI.
//
// Consumers must read ObservationValueKit inside component functions because
// NHForms modules have no guaranteed evaluation order in the MOIS engine.

const ObservationValueKit = (() => {
  const toText = (value) => value === null || value === undefined ? "" : String(value)

  const normalizeOptions = (options) => (Array.isArray(options) ? options : [])
    .map((option) => {
      if (option && typeof option === "object") {
        const value = option.value ?? option.key ?? option.code
        if (value === undefined || value === null) return null
        return {
          ...option,
          key: toText(option.key ?? option.code ?? value),
          value,
          label: toText(option.label ?? option.text ?? option.display ?? value),
          description: toText(option.description ?? option.detail ?? option.label ?? option.text ?? option.display ?? value),
          system: toText(option.system),
        }
      }
      if (option === undefined || option === null) return null
      return {
        key: toText(option),
        value: option,
        label: toText(option),
        description: toText(option),
        system: "",
      }
    })
    .filter(Boolean)

  const isEmpty = (value) => {
    if (value === undefined || value === null || value === "") return true
    if (Array.isArray(value)) return value.length === 0
    if (value && typeof value === "object") {
      if (Object.prototype.hasOwnProperty.call(value, "selectedKey")) {
        return value.selectedKey === undefined || value.selectedKey === null || value.selectedKey === ""
      }
      if (Object.prototype.hasOwnProperty.call(value, "code") || Object.prototype.hasOwnProperty.call(value, "display")) {
        return !toText(value.code ?? value.display).trim()
      }
      if (Object.prototype.hasOwnProperty.call(value, "value")) return isEmpty(value.value)
    }
    return false
  }

  const normalizeAnswer = (value, options) => {
    const optionList = normalizeOptions(options)
    const rawKey = value && typeof value === "object"
      ? value.selectedKey ?? value.code ?? value.key ?? value.value
      : value
    const option = optionList.find((candidate) => (
      candidate.key === toText(rawKey) || candidate.value === rawKey || toText(candidate.value) === toText(rawKey)
    ))
    const rawValue = value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")
      ? value.value
      : (option?.value ?? value)
    const numeric = Number(rawValue)
    return {
      raw: rawValue,
      code: toText(
        value && typeof value === "object"
          ? value.selectedKey ?? value.code ?? value.key ?? option?.key ?? rawValue
          : option?.key ?? rawValue
      ),
      display: toText(
        value && typeof value === "object"
          ? value.response ?? value.display ?? value.text ?? option?.label ?? rawValue
          : option?.label ?? rawValue
      ),
      detail: toText(
        value && typeof value === "object"
          ? value.detailResponse ?? value.description ?? option?.description ?? value.response ?? value.display ?? rawValue
          : option?.description ?? option?.label ?? rawValue
      ),
      numeric: Number.isFinite(numeric) ? numeric : null,
      system: toText(
        value && typeof value === "object" ? value.system ?? option?.system : option?.system
      ),
      empty: isEmpty(value),
    }
  }

  const valueType = (row) => {
    const explicit = toText(row?.valueType).trim().toUpperCase()
    if (explicit === "VALUESET" || explicit === "NUMERIC" || explicit === "TEXT") return explicit
    const type = toText(row?.type).trim().toLowerCase()
    if (type === "scale" || type === "coded" || type === "choice") return "VALUESET"
    if (type === "number" || type === "numeric") return "NUMERIC"
    return "TEXT"
  }

  const buildObservation = (row, value, index) => {
    const answer = normalizeAnswer(value, row?.options)
    const type = valueType(row)
    const observation = {
      description: row?.description ?? row?.label,
      observationCode: row?.observationCode,
      ...(row?.loincCode ? { loincCode: row.loincCode } : {}),
      observationClass: "DCOBS",
      panelSequenceNumber: row?.panelSequenceNumber ?? index + 1,
      valueType: type,
      status: row?.status ?? "F",
      units: row?.units,
      rangeNormalLow: row?.rangeNormalLow,
      rangeNormalHigh: row?.rangeNormalHigh,
      rangeAbsurdLow: row?.rangeAbsurdLow,
      rangeAbsurdHigh: row?.rangeAbsurdHigh,
      referenceRangeText: row?.referenceRangeText,
    }
    if (type === "VALUESET") {
      observation.codedValue = {
        code: answer.empty ? null : answer.code,
        display: answer.empty ? null : answer.display,
        system: row?.system ?? answer.system,
      }
    } else if (type === "NUMERIC") {
      observation.value = answer.empty ? null : answer.numeric
    } else {
      observation.value = answer.empty ? null : answer.display
    }
    return observation
  }

  const nowString = () => typeof getDateTimeString === "function"
    ? getDateTimeString(new Date())
    : new Date().toISOString()

  const buildPanelUpdate = ({
    sd,
    panelCode,
    panelName,
    title,
    rows,
    totals,
    values,
    totalValues,
    includeEmptyRows = false,
    orderedBy,
    facility,
    notes,
  }) => {
    const normalizedName = panelName && typeof panelName === "object"
      ? panelName
      : { code: panelCode, display: title, system: "MOIS" }
    if (!toText(normalizedName?.code).trim()) return null
    const existingPanels = Array.isArray(sd?.webform?.observationPanels) ? sd.webform.observationPanels : []
    const existing = existingPanels.find((panel) => panel?.panelName?.code === normalizedName.code)
    const rowObservations = (Array.isArray(rows) ? rows : [])
      .map((row, index) => ({ row, value: values?.[row.id], index }))
      .filter(({ value }) => includeEmptyRows || !isEmpty(value))
      .map(({ row, value, index }) => buildObservation(row, value, index))
    const totalObservations = (Array.isArray(totals) ? totals : [])
      .map((total, index) => ({ total, value: totalValues?.[total.id], index: rowObservations.length + index }))
      .filter(({ value }) => includeEmptyRows || !isEmpty(value))
      .map(({ total, value, index }) => buildObservation({ ...total, type: "numeric", valueType: "NUMERIC" }, value, index))
    const observations = [...rowObservations, ...totalObservations]
    if (observations.length === 0) return null
    const timestamp = nowString()
    return {
      observationPanelId: existing?.observationPanelId ?? 0,
      collectedDate: timestamp,
      reportedDate: timestamp,
      orderedBy: orderedBy ?? sd?.userProfile?.identity?.fullName,
      status: "F",
      panelName: normalizedName,
      observations,
      ...(facility ? { facility } : {}),
      ...(notes ? { notes } : {}),
    }
  }

  const buildDcoUpdates = ({ sd, rows, totals, values, totalValues, collectedBy }) => (
    [...(Array.isArray(rows) ? rows : []), ...(Array.isArray(totals) ? totals : [])]
      .map((row) => {
        const value = (Array.isArray(totals) ? totals : []).includes(row)
          ? totalValues?.[row.id]
          : values?.[row.id]
        if (!row?.observationCode || isEmpty(value)) return null
        const answer = normalizeAnswer(value, row.options)
        const type = valueType(row)
        const oldObs = sd?.webform?.observations?.find((item) => item.observationCode === row.observationCode)
        return {
          observationId: oldObs?.observationId ?? 0,
          observationCode: row.observationCode,
          observationClass: "DCOBS",
          value: type === "NUMERIC" ? answer.numeric : (type === "VALUESET" ? answer.code : answer.display),
          valueType: type === "NUMERIC" ? "NUMBER" : "TEXT",
          status: oldObs?.observationId ? "C" : "F",
          description: row.label,
          orderedBy: collectedBy,
          collectedBy,
          collectedDateTime: nowString(),
        }
      })
      .filter(Boolean)
  )

  return {
    toText,
    normalizeOptions,
    isEmpty,
    normalizeAnswer,
    valueType,
    buildObservation,
    buildPanelUpdate,
    buildDcoUpdates,
  }
})()
