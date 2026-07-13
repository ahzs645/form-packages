const { useEffect, useMemo, useState } = React
const { Stack, StackItem, Label, Link, Text, TextField } = Fluent

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0

const measurementWidthBySize = {
  "1/4": "25%",
  "1/3": "33.333%",
  "1/2": "50%",
  "2/3": "66.667%",
  "3/4": "75%",
  tiny: "80px",
  small: "160px",
  medium: "320px",
  large: "480px",
}

const resolveMeasurementContainerStyle = (size) => {
  if (size && typeof size === "object") {
    return { ...size, minWidth: size.minWidth ?? 0 }
  }

  const width = measurementWidthBySize[size]
  if (!width) return { width: "100%", minWidth: 0 }

  return {
    boxSizing: "border-box",
    flex: `0 0 ${width}`,
    maxWidth: width,
    minWidth: 0,
    width,
  }
}

const hasMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") return Object.keys(value).length > 0
  return true
}

const toPathSegments = (path) =>
  String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)

const resolvePathValue = (root, path) => {
  if (!root || !path) return undefined
  const segments = toPathSegments(path)
  if (segments.length === 0) return undefined

  let current = root
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (/^\d+$/.test(segment)) {
        const index = Number(segment)
        current = current[index]
      } else {
        current = current
          .map((entry) => (entry && typeof entry === "object" ? entry[segment] : undefined))
          .filter((entry) => entry !== undefined && entry !== null)
      }
      if (current === undefined || current === null) return current
      if (Array.isArray(current) && current.length === 0) return undefined
      continue
    }

    if (current && typeof current === "object") {
      current = current[segment]
      if (current === undefined || current === null) return current
      continue
    }

    return undefined
  }

  return current
}

const resolveMoisValue = (source, path) => {
  if (!source || !isNonEmptyString(path)) return undefined

  const direct = resolvePathValue(source, path)
  if (direct !== undefined && direct !== null) return direct

  if (path.startsWith("patient.")) {
    const patientPath = path.slice("patient.".length)
    const fromPatient = resolvePathValue(source?.patient ?? source, patientPath)
    if (fromPatient !== undefined && fromPatient !== null) return fromPatient

    const fromQueryResult = resolvePathValue(source?.queryResult?.patient?.[0], patientPath)
    if (fromQueryResult !== undefined && fromQueryResult !== null) return fromQueryResult
  }

  if (path.startsWith("queryResult.patient.0.")) {
    const patientPath = path.slice("queryResult.patient.0.".length)
    const fromPatient = resolvePathValue(source?.patient, patientPath)
    if (fromPatient !== undefined && fromPatient !== null) return fromPatient
  }

  return undefined
}

const stringifyValue = (value) => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    return value
      .map((entry) => stringifyValue(entry))
      .filter(Boolean)
      .join(", ")
  }
  if (typeof value === "object") {
    const valueKeys = ["display", "text", "value", "code", "id", "name"]
    for (const key of valueKeys) {
      const candidate = stringifyValue(value[key])
      if (candidate) return candidate
    }
  }
  return ""
}

const resolveHistoricalFormRows = (source) => {
  const roots = [
    source?.webformHistory,
    source?.historicalForms,
    source?.patient?.webforms,
    source?.patient?.forms,
    source?.patient?.dformHistory,
    source?.queryResult?.patient?.[0]?.webforms,
    source?.queryResult?.patient?.[0]?.forms,
  ]
  return roots.flatMap((value) => (Array.isArray(value) ? value : []))
}

const valueFromHistoricalFormRow = (row, legacyFieldId) => {
  if (!row || typeof row !== "object" || !legacyFieldId) return ""
  const candidates = [
    row,
    row.formData,
    row.formData?.field?.data,
    row.data,
    row.field?.data,
    row.values,
  ]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue
    if (Object.prototype.hasOwnProperty.call(candidate, legacyFieldId)) {
      return stringifyValue(candidate[legacyFieldId])
    }
    const matchingKey = Object.keys(candidate).find((key) => (
      key.endsWith(`_${legacyFieldId}`) || key.endsWith(`_field_${legacyFieldId}`)
    ))
    if (matchingKey) return stringifyValue(candidate[matchingKey])
  }
  return ""
}

const historicalFormRowDate = (row) => {
  const raw = row?.docDate ?? row?.documentDate ?? row?.createdDate ?? row?.createdAt ?? row?.updatedAt
  return parseDateValue(raw)?.getTime() ?? 0
}

const optionalString = (value) => {
  if (value === undefined || value === null || value === "") return undefined
  return stringifyValue(value)
}

const parseDateValue = (value) => {
  const text = stringifyValue(value)
  if (!text) return null

  const normalizedDateOnly = /^\d{4}[./-]\d{2}[./-]\d{2}$/.test(text)
    ? text.replace(/\./g, "-")
    : text

  const parsed = new Date(normalizedDateOnly)
  if (!Number.isNaN(parsed.getTime())) return parsed

  if (text.includes("T")) {
    const parsedDateOnly = new Date(text.split("T")[0])
    if (!Number.isNaN(parsedDateOnly.getTime())) return parsedDateOnly
  }

  return null
}

const formatDate = (value) => {
  const parsed = parseDateValue(value)
  if (!parsed) return stringifyValue(value)

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}

const coercePositiveInt = (value, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

const stripVolatilePayloadFields = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => stripVolatilePayloadFields(item))
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "collectedDateTime")
        .map(([key, nestedValue]) => [key, stripVolatilePayloadFields(nestedValue)])
    )
  }
  return value
}

const payloadsEqual = (left, right) => (
  JSON.stringify(stripVolatilePayloadFields(left ?? null)) ===
  JSON.stringify(stripVolatilePayloadFields(right ?? null))
)

// setFormData must receive a produce()-wrapped recipe: the real MOIS runtime
// hands back the raw React state setter, so a bare mutator would replace the
// active form data with undefined.
const setNestedPayload = (setFormData, componentId, payloadType, payload) => {
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    const container = draft.field.data.__componentPayloads ?? {}
    const key = payloadType === "webform" ? "webformUpdatesByComponent" : "dcoUpdatesByComponent"
    const nextGroup = container[key] ?? {}
    const currentPayload = nextGroup[componentId]
    if (payloadsEqual(currentPayload, payload)) {
      return
    }
    if (payload == null || (Array.isArray(payload) && payload.length === 0)) {
      delete nextGroup[componentId]
    } else {
      nextGroup[componentId] = payload
    }
    container[key] = nextGroup
    draft.field.data.__componentPayloads = container
  }))
}

const toObservationList = (source) => (
  Array.isArray(source)
    ? source.filter((entry) => entry && typeof entry === "object")
    : []
)

const normalizeObservationItems = ({
  items,
  valuePath,
  datePath,
  unitsPath,
  codePath,
  commentPath,
  codeFilter,
  commentFilter,
  documentDate,
  applyDocumentDateFilter = true,
}) => (
  toObservationList(items)
    .map((entry, index) => {
      const entryValue = valuePath ? resolvePathValue(entry, valuePath) : undefined
      const entryDate = datePath ? resolvePathValue(entry, datePath) : undefined
      const entryUnits = unitsPath ? resolvePathValue(entry, unitsPath) : undefined
      const entryCode = codePath ? resolvePathValue(entry, codePath) : undefined
      const entryComment = commentPath ? resolvePathValue(entry, commentPath) : undefined
      const parsedDate = parseDateValue(entryDate)
      const numericTime = parsedDate ? parsedDate.getTime() : 0

      return {
        index,
        raw: entry,
        rawDate: entryDate,
        dateText: formatDate(entryDate) || "-",
        dateTime: parsedDate,
        dateTimeValue: numericTime,
        valueText: stringifyValue(entryValue),
        unitsText: stringifyValue(entryUnits),
        codeText: stringifyValue(entryCode),
        commentText: stringifyValue(entryComment),
      }
    })
    .filter((entry) => Boolean(entry))
    .filter((entry) => {
      if (!entry) return false
      if (!entry.valueText) return false
      if (codeFilter && entry.codeText !== codeFilter) return false
      if (commentFilter && entry.commentText !== commentFilter) return false
      if (applyDocumentDateFilter && documentDate && entry.dateTime && entry.dateTime > documentDate) return false
      return true
    })
    .sort((a, b) => {
      if (a.dateTimeValue !== b.dateTimeValue) {
        return b.dateTimeValue - a.dateTimeValue
      }
      return a.index - b.index
    })
)

const PastMeasurementField = ({
  id,
  fieldId,
  label = "Measurement",
  placeholder,
  size,
  historyKind = "observation",
  legacyFieldId = "",
  historySourcePath = "patient.observations",
  valuePath = "value",
  datePath = "collectedDateTime",
  unitsPath = "units",
  codePath = "observationCode",
  observationCode = "",
  commentPath = "comment",
  observationComment = "",
  docDateFieldPath = "docDate",
  maxHistory = 5,
  autoFillFromHistory = false,
  persistenceMode = "formOnly",
  valueType = "TEXT",
  observationDescription,
  saveDescription,
  saveUnits,
  showHistory = true,
  showHistoryList = false,
  showHistoryOnFocus = false,
  historyInitiallyVisible = false,
  emptyHistoryText = "No past measurement available",
  graphLinkText = "Graph",
  graphHref,
  openGraphInNewTab = true,
  abnormalLow,
  abnormalHigh,
  criticalLow,
  criticalHigh,
  rangeAbsurdLow,
  rangeAbsurdHigh,
  rangeNormalLow,
  rangeNormalHigh,
  rangeVeryLow,
  rangeVeryHigh,
  abnormalMessage = "Abnormal",
  normalMessage = "",
  readOnly = false,
  disabled = false,
  onChange,
}) => {
  const [historyFocused, setHistoryFocused] = useState(historyInitiallyVisible)
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const componentId = id || fieldId || "PastMeasurementField"
  const effectiveFieldId = fieldId || componentId
  const isHistoricalFormValue = String(historyKind || "").replace(/[^a-z]/gi, "").toLowerCase() === "formvalue"

  const fieldData = fd?.field?.data ?? {}
  const hasStoredValue = effectiveFieldId
    ? Object.prototype.hasOwnProperty.call(fieldData, effectiveFieldId)
    : false
  const storedValue = effectiveFieldId ? fieldData[effectiveFieldId] : ""
  const effectiveHistorySize = coercePositiveInt(maxHistory, 5)
  const codeFilter = stringifyValue(observationCode)
  const commentFilter = stringifyValue(observationComment)
  const documentDate = docDateFieldPath ? parseDateValue(resolvePathValue(fieldData, docDateFieldPath)) : null

  const formHistoryItems = useMemo(() => {
    if (!isHistoricalFormValue) return []
    return resolveHistoricalFormRows(sd)
      .map((row, index) => {
        const valueText = valueFromHistoricalFormRow(row, legacyFieldId)
        const rawDate = row?.docDate ?? row?.documentDate ?? row?.createdDate ?? row?.createdAt ?? row?.updatedAt
        return {
          index,
          raw: row,
          rawDate,
          dateText: formatDate(rawDate) || "-",
          dateTimeValue: historicalFormRowDate(row),
          valueText,
          unitsText: "",
        }
      })
      .filter((entry) => Boolean(entry.valueText))
      .sort((left, right) => right.dateTimeValue - left.dateTimeValue || left.index - right.index)
      .slice(0, effectiveHistorySize)
  }, [effectiveHistorySize, isHistoricalFormValue, legacyFieldId, sd])

  const observationHistoryItems = useMemo(() => {
    if (isHistoricalFormValue) return []
    return normalizeObservationItems({
      items: resolveMoisValue(sd, historySourcePath),
      valuePath,
      datePath,
      unitsPath,
      codePath,
      commentPath,
      codeFilter,
      commentFilter,
      documentDate,
      applyDocumentDateFilter: true,
    }).slice(0, effectiveHistorySize)
  }, [
    codeFilter,
    commentPath,
    codePath,
    commentFilter,
    datePath,
    documentDate,
    effectiveHistorySize,
    historySourcePath,
    sd,
    unitsPath,
    valuePath,
    isHistoricalFormValue,
  ])

  const historyItems = isHistoricalFormValue ? formHistoryItems : observationHistoryItems

  const linkedObservationItem = useMemo(() => (
    isHistoricalFormValue
      ? null
      :
    normalizeObservationItems({
      items: sd?.webform?.observations,
      valuePath,
      datePath,
      unitsPath,
      codePath,
      commentPath,
      codeFilter,
      commentFilter,
      documentDate: null,
      applyDocumentDateFilter: false,
    })[0] ?? null
  ), [codeFilter, commentPath, codePath, commentFilter, datePath, isHistoricalFormValue, sd, unitsPath, valuePath])

  const latestHistoryItem = historyItems[0] ?? null
  const resolvedCurrentValue = isHistoricalFormValue
    ? latestHistoryItem?.valueText ?? ""
    : hasMeaningfulValue(storedValue)
      ? storedValue
      : linkedObservationItem?.valueText ?? (autoFillFromHistory ? latestHistoryItem?.valueText : "") ?? ""
  const numericCurrentValue = Number(stringifyValue(resolvedCurrentValue))
  const hasNumericCurrentValue = Number.isFinite(numericCurrentValue)
  const resolvedAbnormalLow = abnormalLow ?? rangeNormalLow
  const resolvedAbnormalHigh = abnormalHigh ?? rangeNormalHigh
  const resolvedCriticalLow = criticalLow ?? rangeAbsurdLow ?? rangeVeryLow
  const resolvedCriticalHigh = criticalHigh ?? rangeAbsurdHigh ?? rangeVeryHigh
  const abnormalLowValue = Number(resolvedAbnormalLow)
  const abnormalHighValue = Number(resolvedAbnormalHigh)
  const hasAbnormalLow = Number.isFinite(abnormalLowValue)
  const hasAbnormalHigh = Number.isFinite(abnormalHighValue)
  const isAbnormal = hasNumericCurrentValue && (
    (hasAbnormalLow && numericCurrentValue < abnormalLowValue) ||
    (hasAbnormalHigh && numericCurrentValue > abnormalHighValue)
  )
  const shouldShowHistory = showHistory && (!showHistoryOnFocus || historyFocused)
  const shouldReserveHistory = showHistory && showHistoryOnFocus
  const inputSuffix = stringifyValue(saveUnits) || latestHistoryItem?.unitsText || ""

  useEffect(() => {
    if (isHistoricalFormValue || persistenceMode !== "observationAndForm") {
      setNestedPayload(setFormData, componentId, "dco", null)
      return
    }
    if (!observationCode || !effectiveFieldId) {
      setNestedPayload(setFormData, componentId, "dco", null)
      return
    }

    const oldObs = linkedObservationItem?.raw
    const oldId = oldObs?.observationId ?? 0
    const hasExplicitValue = hasStoredValue
    const explicitValue = hasExplicitValue ? stringifyValue(storedValue) : ""

    if (!hasExplicitValue) {
      setNestedPayload(setFormData, componentId, "dco", null)
      return
    }

    if (!explicitValue) {
      setNestedPayload(setFormData, componentId, "dco", oldId ? [{ observationId: -oldId }] : null)
      return
    }

    const createdBy = fieldData.createdBy ?? sd?.userProfile?.identity?.fullName
    const resolvedUnits = stringifyValue(saveUnits) || linkedObservationItem?.unitsText || latestHistoryItem?.unitsText || ""

    // Persist the abnormal classification on the observation itself (legacy
    // makeUpdateObs/getFlagLevel parity); MOIS codes the flag with
    // MOIS-ABNORMALFLAG. Four bands: criticalLow/High -> LL/HH outrank
    // abnormalLow/High -> L/H. Display resolves from the host's option list
    // when available, matching the HFC source.
    const numericExplicitValue = Number(explicitValue)
    const criticalLowValue = Number(resolvedCriticalLow)
    const criticalHighValue = Number(resolvedCriticalHigh)
    const flagCode = !Number.isFinite(numericExplicitValue)
      ? null
      : Number.isFinite(criticalLowValue) && numericExplicitValue < criticalLowValue
        ? "LL"
        : Number.isFinite(criticalHighValue) && numericExplicitValue > criticalHighValue
          ? "HH"
          : hasAbnormalLow && numericExplicitValue < abnormalLowValue
            ? "L"
            : hasAbnormalHigh && numericExplicitValue > abnormalHighValue
              ? "H"
              : null
    const flagDisplays = { LL: "Critical low", L: "Low", H: "High", HH: "Critical high" }
    const hasRangeMetadata = [
      resolvedCriticalLow,
      resolvedCriticalHigh,
      resolvedAbnormalLow,
      resolvedAbnormalHigh,
    ].some((value) => optionalString(value) !== undefined)
    const abnormalFlag = hasRangeMetadata
      ? {
          code: flagCode,
          display: flagCode ? (sd?.optionLists?.["MOIS-ABNORMALFLAG"]?.[flagCode] ?? flagDisplays[flagCode]) : null,
          system: "MOIS-ABNORMALFLAG",
        }
      : null
    const legacyRangePayload = {
      ...(optionalString(resolvedCriticalHigh) !== undefined ? { rangeAbsurdHigh: optionalString(resolvedCriticalHigh) } : {}),
      ...(optionalString(resolvedCriticalLow) !== undefined ? { rangeAbsurdLow: optionalString(resolvedCriticalLow) } : {}),
      ...(optionalString(resolvedAbnormalHigh) !== undefined ? { rangeNormalHigh: optionalString(resolvedAbnormalHigh) } : {}),
      ...(optionalString(resolvedAbnormalLow) !== undefined ? { rangeNormalLow: optionalString(resolvedAbnormalLow) } : {}),
    }

    setNestedPayload(setFormData, componentId, "dco", [{
      observationId: oldId,
      observationCode,
      observationClass: "DCOBS",
      value: explicitValue,
      valueType: String(valueType || "TEXT"),
      ...legacyRangePayload,
      status: oldId ? "C" : "F",
      description: stringifyValue(observationDescription) || stringifyValue(saveDescription) || label || "Measurement",
      units: resolvedUnits,
      orderedBy: createdBy,
      collectedBy: createdBy,
      collectedDateTime: getDateTimeString(new Date()),
      ...(commentFilter ? { comment: commentFilter } : {}),
      ...(abnormalFlag ? { abnormalFlag } : {}),
    }])
  }, [
    componentId,
    effectiveFieldId,
    fieldData,
    hasStoredValue,
    label,
    latestHistoryItem,
    linkedObservationItem,
    isHistoricalFormValue,
    observationCode,
    observationDescription,
    persistenceMode,
    rangeAbsurdHigh,
    rangeAbsurdLow,
    rangeNormalHigh,
    rangeNormalLow,
    rangeVeryHigh,
    rangeVeryLow,
    resolvedAbnormalHigh,
    resolvedAbnormalLow,
    resolvedCriticalHigh,
    resolvedCriticalLow,
    saveDescription,
    saveUnits,
    sd,
    setFormData,
    storedValue,
    valueType,
    commentFilter,
  ])

  useEffect(() => {
    if (!effectiveFieldId) return
    if (!latestHistoryItem?.valueText) return
    if (isHistoricalFormValue && storedValue === latestHistoryItem.valueText) return
    if (!isHistoricalFormValue) {
      if (!autoFillFromHistory) return
      if (hasMeaningfulValue(storedValue)) return
      if (linkedObservationItem?.valueText) return
    }

    setFormData(produce((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data || typeof draft.field.data !== "object") {
        draft.field.data = {}
      }
      if (!isHistoricalFormValue && hasMeaningfulValue(draft.field.data[effectiveFieldId])) return
      draft.field.data[effectiveFieldId] = latestHistoryItem.valueText
    }))
  }, [autoFillFromHistory, effectiveFieldId, isHistoricalFormValue, latestHistoryItem, linkedObservationItem, setFormData, storedValue])

  const handleValueChange = (event, nextValue) => {
    if (!effectiveFieldId) return
    if (readOnly || disabled) return

    const updatedValue = nextValue ?? ""
    setFormData(produce((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data || typeof draft.field.data !== "object") {
        draft.field.data = {}
      }
      draft.field.data[effectiveFieldId] = updatedValue
    }))

    if (typeof onChange === "function") {
      onChange(event, updatedValue)
    }
  }

  const historySummary = latestHistoryItem
    ? [
        latestHistoryItem.dateText,
        latestHistoryItem.valueText,
        latestHistoryItem.unitsText ? `(${latestHistoryItem.unitsText})` : "",
      ]
        .filter(Boolean)
        .join("   ")
    : emptyHistoryText

  const recentHistoryText = historyItems
    .slice(0, effectiveHistorySize)
    .map((item) => {
      const valuePart = item.unitsText ? `${item.valueText} (${item.unitsText})` : item.valueText
      return `${item.dateText}: ${valuePart}`
    })
    .join(" | ")

  return (
    <Stack tokens={{ childrenGap: 4 }} styles={{ root: resolveMeasurementContainerStyle(size) }}>
      {label ? <Label>{label}</Label> : null}

      <Stack tokens={{ childrenGap: 4 }}>
        <StackItem styles={{ root: { width: "100%", minWidth: 0 } }}>
          <TextField
            value={stringifyValue(resolvedCurrentValue)}
            placeholder={placeholder}
            onChange={handleValueChange}
            onFocus={() => setHistoryFocused(true)}
            onBlur={() => {
              if (!historyInitiallyVisible) setHistoryFocused(false)
            }}
            disabled={disabled}
            readOnly={readOnly}
            suffix={inputSuffix || undefined}
          />
        </StackItem>

        {shouldShowHistory || shouldReserveHistory ? (
          <StackItem styles={{ root: { width: "100%", minWidth: 0, visibility: shouldShowHistory ? "visible" : "hidden" } }}>
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }} styles={{ root: { flexWrap: "wrap" } }}>
              {isNonEmptyString(graphLinkText) ? (
                isNonEmptyString(graphHref) ? (
                  <Link
                    href={graphHref}
                    target={openGraphInNewTab ? "_blank" : undefined}
                    rel={openGraphInNewTab ? "noopener noreferrer" : undefined}
                  >
                    {graphLinkText}
                  </Link>
                ) : (
                  <Text variant="small" styles={{ root: { color: "#0f5ea8" } }}>
                    {graphLinkText}
                  </Text>
                )
              ) : null}
              <Text variant="small">{historySummary}</Text>
              {hasNumericCurrentValue && (isAbnormal ? abnormalMessage : normalMessage) ? (
                <Text
                  variant="small"
                  styles={{
                    root: {
                      color: isAbnormal ? "#a4262c" : "#107c10",
                      fontWeight: 600,
                    },
                  }}
                >
                  {isAbnormal ? abnormalMessage : normalMessage}
                </Text>
              ) : null}
            </Stack>
          </StackItem>
        ) : null}
      </Stack>

      {shouldShowHistory && showHistoryList && historyItems.length > 1 ? (
        <Text variant="xSmall">Recent: {recentHistoryText}</Text>
      ) : null}
    </Stack>
  )
}
