const { useEffect, useMemo, useState } = React
const { Stack, Text, Label, Link } = Fluent

const pathSegments = (path) => String(path || "").split(".").map((part) => part.trim()).filter(Boolean)

const resolvePath = (root, path) => {
  if (!root || !path) return undefined
  let current = root
  for (const segment of pathSegments(path)) {
    if (Array.isArray(current)) {
      current = current.map((entry) => entry?.[segment]).filter((entry) => entry !== undefined && entry !== null)
      if (current.length === 0) return undefined
      continue
    }
    if (!current || typeof current !== "object") return undefined
    current = current[segment]
  }
  return current
}

const resolveMoisValue = (source, path) => {
  if (!source || !path) return undefined
  const direct = resolvePath(source, path)
  if (direct !== undefined && direct !== null) return direct
  if (path.startsWith("patient.")) {
    const patientPath = path.slice("patient.".length)
    return resolvePath(source.patient ?? source, patientPath)
  }
  return undefined
}

const textValue = (value) => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(", ")
  if (typeof value === "object") {
    for (const key of ["display", "text", "value", "code", "id", "name"]) {
      const candidate = textValue(value[key])
      if (candidate) return candidate
    }
  }
  return ""
}

const parseDate = (value) => {
  const raw = textValue(value)
  if (!raw) return null
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(/\./g, "-"))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDate = (value) => {
  const parsed = parseDate(value)
  if (!parsed) return textValue(value)
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}

const normalizeItems = ({
  source,
  valuePath,
  datePath,
  unitsPath,
  codePath,
  commentPath,
  observationCode,
  observationComment,
  maxRows,
}) => {
  const rows = Array.isArray(source) ? source : []
  return rows
    .map((entry, index) => {
      const date = resolvePath(entry, datePath)
      const parsedDate = parseDate(date)
      return {
        index,
        date,
        dateText: formatDate(date) || "-",
        dateTime: parsedDate ? parsedDate.getTime() : 0,
        valueText: textValue(resolvePath(entry, valuePath)),
        unitsText: textValue(resolvePath(entry, unitsPath)),
        codeText: textValue(resolvePath(entry, codePath)),
        commentText: textValue(resolvePath(entry, commentPath)),
      }
    })
    .filter((entry) => entry.valueText)
    .filter((entry) => !observationCode || entry.codeText === observationCode)
    .filter((entry) => !observationComment || entry.commentText === observationComment)
    .sort((left, right) => right.dateTime - left.dateTime || left.index - right.index)
    .slice(0, Math.max(1, Number(maxRows) || 5))
}

const getFocusedFieldId = (target) => {
  if (!target || typeof target.closest !== "function") return ""
  const host = target.closest("[data-field-id]")
  if (host?.getAttribute) return host.getAttribute("data-field-id") || ""
  return target.getAttribute?.("data-field-id") || target.name || target.id || ""
}

function FocusedObservationHistory({
  id,
  title = "History",
  watchFieldId,
  historySourcePath = "patient.observations",
  valuePath = "value",
  datePath = "collectedDateTime",
  unitsPath = "units",
  codePath = "observationCode",
  commentPath = "comment",
  observationCode = "",
  observationComment = "",
  maxRows = 5,
  showWhenNotFocused = false,
  emptyText = "No history found",
  graphLabel = "Graph",
  graphHref,
}) {
  const sd = useSourceData()
  const [activeFieldId, setActiveFieldId] = useState("")

  useEffect(() => {
    const handleFocus = (event) => setActiveFieldId(getFocusedFieldId(event.target))
    const handleBlur = () => window.setTimeout(() => setActiveFieldId(getFocusedFieldId(document.activeElement)), 0)
    document.addEventListener("focusin", handleFocus)
    document.addEventListener("focusout", handleBlur)
    return () => {
      document.removeEventListener("focusin", handleFocus)
      document.removeEventListener("focusout", handleBlur)
    }
  }, [])

  const isVisible = showWhenNotFocused || !watchFieldId || activeFieldId === watchFieldId
  const items = useMemo(() => normalizeItems({
    source: resolveMoisValue(sd, historySourcePath),
    valuePath,
    datePath,
    unitsPath,
    codePath,
    commentPath,
    observationCode: textValue(observationCode),
    observationComment: textValue(observationComment),
    maxRows,
  }), [codePath, commentPath, datePath, historySourcePath, maxRows, observationCode, observationComment, sd, unitsPath, valuePath])

  if (!isVisible) return null

  return (
    <Stack id={id} data-focused-observation-history tokens={{ childrenGap: 4 }}>
      {title ? <Label>{title}</Label> : null}
      {graphLabel ? (
        graphHref ? <Link href={graphHref} target="_blank" rel="noreferrer">{graphLabel}</Link> : <Text variant="small">{graphLabel}</Text>
      ) : null}
      {items.length === 0 ? (
        <Text variant="small">{emptyText}</Text>
      ) : (
        <Stack tokens={{ childrenGap: 2 }}>
          {items.map((item) => (
            <Text key={`${item.dateText}-${item.index}`} variant="small">
              {item.dateText}: {item.valueText}{item.unitsText ? ` (${item.unitsText})` : ""}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

