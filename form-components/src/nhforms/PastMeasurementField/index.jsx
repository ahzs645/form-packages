const { useEffect, useMemo } = React
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

const PastMeasurementField = ({
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
  showHistory = true,
  showHistoryList = false,
  emptyHistoryText = "No past measurement available",
  graphLinkText = "Graph",
  graphHref,
  openGraphInNewTab = true,
  readOnly = false,
  disabled = false,
  onChange,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()

  const fieldData = fd?.field?.data ?? {}
  const currentValue = fieldId ? fieldData[fieldId] : ""
  const effectiveHistorySize = coercePositiveInt(maxHistory, 5)

  const historyItems = useMemo(() => {
    const sourceItems = resolveMoisValue(sd, historySourcePath)
    if (!Array.isArray(sourceItems)) return []

    const codeFilter = stringifyValue(observationCode)
    const commentFilter = stringifyValue(observationComment)
    const documentDate = docDateFieldPath ? parseDateValue(resolvePathValue(fieldData, docDateFieldPath)) : null

    const normalized = sourceItems
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return null

        const entryValue = valuePath ? resolvePathValue(entry, valuePath) : undefined
        const entryDate = datePath ? resolvePathValue(entry, datePath) : undefined
        const entryUnits = unitsPath ? resolvePathValue(entry, unitsPath) : undefined
        const entryCode = codePath ? resolvePathValue(entry, codePath) : undefined
        const entryComment = commentPath ? resolvePathValue(entry, commentPath) : undefined

        const parsedDate = parseDateValue(entryDate)
        const numericTime = parsedDate ? parsedDate.getTime() : 0

        return {
          index,
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
        if (documentDate && entry.dateTime && entry.dateTime > documentDate) return false
        return true
      })
      .sort((a, b) => {
        if (a.dateTimeValue !== b.dateTimeValue) {
          return b.dateTimeValue - a.dateTimeValue
        }
        return a.index - b.index
      })

    return normalized.slice(0, effectiveHistorySize)
  }, [
    commentPath,
    codePath,
    datePath,
    docDateFieldPath,
    effectiveHistorySize,
    fieldData,
    historySourcePath,
    observationCode,
    observationComment,
    sd,
    unitsPath,
    valuePath,
  ])

  const latestHistoryItem = historyItems[0] ?? null

  useEffect(() => {
    if (!fieldId || !autoFillFromHistory) return
    if (!latestHistoryItem?.valueText) return
    if (hasMeaningfulValue(currentValue)) return

    setFormData((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data || typeof draft.field.data !== "object") {
        draft.field.data = {}
      }
      if (hasMeaningfulValue(draft.field.data[fieldId])) return
      draft.field.data[fieldId] = latestHistoryItem.valueText
    })
  }, [autoFillFromHistory, currentValue, fieldId, latestHistoryItem, setFormData])

  const handleValueChange = (event, nextValue) => {
    if (!fieldId) return
    if (readOnly || disabled) return

    const updatedValue = nextValue ?? ""
    setFormData((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data || typeof draft.field.data !== "object") {
        draft.field.data = {}
      }
      draft.field.data[fieldId] = updatedValue
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
            value={stringifyValue(currentValue)}
            placeholder={placeholder}
            onChange={handleValueChange}
            disabled={disabled}
            readOnly={readOnly}
          />
        </StackItem>

        {showHistory ? (
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
            </Stack>
          </StackItem>
        ) : null}
      </Stack>

      {showHistory && showHistoryList && historyItems.length > 1 ? (
        <Text variant="xSmall">Recent: {recentHistoryText}</Text>
      ) : null}
    </Stack>
  )
}
