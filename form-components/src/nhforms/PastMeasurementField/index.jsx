const { useEffect, useMemo, useState } = React
const { Stack, StackItem, Label, Link, Text, TextField } = Fluent

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0

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

const setNestedPayload = (setFormData, componentId, payloadType, payload) => {
  setFormData((draft) => {
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
  })
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

  const fieldData = fd?.field?.data ?? {}
  const hasStoredValue = effectiveFieldId
    ? Object.prototype.hasOwnProperty.call(fieldData, effectiveFieldId)
    : false
  const storedValue = effectiveFieldId ? fieldData[effectiveFieldId] : ""
  const effectiveHistorySize = coercePositiveInt(maxHistory, 5)
  const codeFilter = stringifyValue(observationCode)
  const commentFilter = stringifyValue(observationComment)
  const documentDate = docDateFieldPath ? parseDateValue(resolvePathValue(fieldData, docDateFieldPath)) : null

  const historyItems = useMemo(() => {
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
  ])

  const linkedObservationItem = useMemo(() => (
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
  ), [codeFilter, commentPath, codePath, commentFilter, datePath, sd, unitsPath, valuePath])

  const latestHistoryItem = historyItems[0] ?? null
  const resolvedCurrentValue = hasMeaningfulValue(storedValue)
    ? storedValue
    : linkedObservationItem?.valueText ?? latestHistoryItem?.valueText ?? ""
  const numericCurrentValue = Number(stringifyValue(resolvedCurrentValue))
  const hasNumericCurrentValue = Number.isFinite(numericCurrentValue)
  const abnormalLowValue = Number(abnormalLow)
  const abnormalHighValue = Number(abnormalHigh)
  const hasAbnormalLow = Number.isFinite(abnormalLowValue)
  const hasAbnormalHigh = Number.isFinite(abnormalHighValue)
  const isAbnormal = hasNumericCurrentValue && (
    (hasAbnormalLow && numericCurrentValue < abnormalLowValue) ||
    (hasAbnormalHigh && numericCurrentValue > abnormalHighValue)
  )
  const shouldShowHistory = showHistory && (!showHistoryOnFocus || historyFocused)

  useEffect(() => {
    if (persistenceMode !== "observationAndForm") {
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

    setNestedPayload(setFormData, componentId, "dco", [{
      observationId: oldId,
      observationCode,
      observationClass: "DCOBS",
      value: explicitValue,
      valueType: String(valueType || "TEXT"),
      status: oldId ? "C" : "F",
      description: stringifyValue(saveDescription) || label || "Measurement",
      units: resolvedUnits,
      orderedBy: createdBy,
      collectedBy: createdBy,
      collectedDateTime: getDateTimeString(new Date()),
      ...(commentFilter ? { comment: commentFilter } : {}),
    }])
  }, [
    componentId,
    effectiveFieldId,
    fieldData,
    hasStoredValue,
    label,
    latestHistoryItem,
    linkedObservationItem,
    observationCode,
    persistenceMode,
    saveDescription,
    saveUnits,
    sd,
    setFormData,
    storedValue,
    valueType,
    commentFilter,
  ])

  useEffect(() => {
    if (!effectiveFieldId || !autoFillFromHistory) return
    if (!latestHistoryItem?.valueText) return
    if (hasMeaningfulValue(storedValue)) return
    if (linkedObservationItem?.valueText) return

    setFormData((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data || typeof draft.field.data !== "object") {
        draft.field.data = {}
      }
      if (hasMeaningfulValue(draft.field.data[effectiveFieldId])) return
      draft.field.data[effectiveFieldId] = latestHistoryItem.valueText
    })
  }, [autoFillFromHistory, effectiveFieldId, latestHistoryItem, linkedObservationItem, setFormData, storedValue])

  const handleValueChange = (event, nextValue) => {
    if (!effectiveFieldId) return
    if (readOnly || disabled) return

    const updatedValue = nextValue ?? ""
    setFormData((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data || typeof draft.field.data !== "object") {
        draft.field.data = {}
      }
      draft.field.data[effectiveFieldId] = updatedValue
    })

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
    <Stack tokens={{ childrenGap: 4 }}>
      {label ? <Label>{label}</Label> : null}

      <Stack horizontal verticalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { flexWrap: "wrap" } }}>
        <StackItem grow styles={{ root: { minWidth: 220 } }}>
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
          />
        </StackItem>

        {shouldShowHistory ? (
          <StackItem styles={{ root: { minWidth: 220 } }}>
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
