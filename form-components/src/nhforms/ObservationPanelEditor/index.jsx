const { useEffect, useMemo } = React
const { Stack, Text, TextField, Label, Separator, ChoiceGroup } = Fluent

const normalizePanelRows = (rows) => Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object" && typeof row.id === "string") : []
const normalizePanelTotals = (totals) => Array.isArray(totals) ? totals.filter((row) => row && typeof row === "object" && typeof row.id === "string") : []
const panelDateKey = (value) => {
  const raw = String(value ?? "")
  return raw.includes("T") ? raw.split("T")[0] : raw
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
const getPanelValue = (values, key) => values && typeof values === "object" ? values[key] : undefined
const toNumericValue = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const getCurrentActorName = (sd, fd) => (
  fd?.field?.data?.createdBy
  || fd?.formData?.createdBy
  || sd?.userProfile?.identity?.fullName
  || sd?.webform?.provider?.name
  || ""
)
const setPanelPayload = (setFormData, componentId, payloadType, payload) => {
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

const ObservationPanelEditor = ({
  id,
  fieldId,
  title = "Observation Panel",
  panelCode = "",
  rows = [],
  totals = [],
  history = false,
  historyConfig,
  saveMode = "panel",
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const section = useSection()
  const componentId = id || fieldId || "ObservationPanelEditor"
  const effectiveFieldId = fieldId || componentId
  const rootValue = fd?.field?.data?.[effectiveFieldId] ?? {}
  const rowDefs = useMemo(() => normalizePanelRows(rows), [rows])
  const totalDefs = useMemo(() => normalizePanelTotals(totals), [totals])
  const maxHistory = Number(historyConfig?.maxRows) > 0 ? Number(historyConfig.maxRows) : 5
  const createdBy = fd?.field?.data?.createdBy ?? sd?.userProfile?.identity?.fullName
  const currentActorName = getCurrentActorName(sd, fd)
  const authorshipPolicy = section?.authorshipPolicy || { enabled: false, granularity: "row", lockOn: "save" }

  useEffect(() => {
    if (!authorshipPolicy?.enabled || authorshipPolicy?.granularity !== "row") return
    const rowIds = rowDefs.map((row) => row.id).filter(Boolean)
    if (rowIds.length === 0) return
    setFormData((draft) => {
      registerAuthorshipRowTarget(draft, {
        componentId,
        fieldId: effectiveFieldId,
        rowIds,
        policy: authorshipPolicy,
      })
    })
  }, [authorshipPolicy, componentId, effectiveFieldId, rowDefs, setFormData])

  const computedTotals = useMemo(() => {
    const next = {}
    totalDefs.forEach((total) => {
      const sourceIds = Array.isArray(total.sourceRowIds) ? total.sourceRowIds : []
      next[total.id] = sourceIds.reduce((sum, sourceId) => sum + toNumericValue(getPanelValue(rootValue, sourceId)), 0)
    })
    return next
  }, [rootValue, totalDefs])

  useEffect(() => {
    const dcoUpdates = []
    rowDefs.forEach((row) => {
      const value = getPanelValue(rootValue, row.id)
      const hasValue = value !== undefined && value !== null && value !== ""
      if (!row.observationCode || !hasValue) return
      const oldObs = sd?.webform?.observations?.find((item) => item.observationCode === row.observationCode)
      dcoUpdates.push({
        observationId: oldObs?.observationId ?? 0,
        observationCode: row.observationCode,
        observationClass: "DCOBS",
        value,
        valueType: row.type === "numeric" ? "NUMBER" : "TEXT",
        status: oldObs?.observationId ? "C" : "F",
        description: row.label,
        orderedBy: createdBy,
        collectedBy: createdBy,
        collectedDateTime: getDateTimeString(new Date()),
      })
    })
    totalDefs.forEach((total) => {
      if (!total.observationCode) return
      const oldObs = sd?.webform?.observations?.find((item) => item.observationCode === total.observationCode)
      dcoUpdates.push({
        observationId: oldObs?.observationId ?? 0,
        observationCode: total.observationCode,
        observationClass: "DCOBS",
        value: computedTotals[total.id] ?? 0,
        valueType: "NUMBER",
        status: oldObs?.observationId ? "C" : "F",
        description: total.label,
        orderedBy: createdBy,
        collectedBy: createdBy,
        collectedDateTime: getDateTimeString(new Date()),
      })
    })
    setPanelPayload(setFormData, componentId, "dco", dcoUpdates)
    if (saveMode === "panel") {
      setPanelPayload(setFormData, componentId, "webform", {
        panelUpdates: [{
          panelCode,
          title,
          rows: rowDefs.map((row) => ({ id: row.id, label: row.label, value: getPanelValue(rootValue, row.id), observationCode: row.observationCode })),
          totals: totalDefs.map((total) => ({ id: total.id, label: total.label, value: computedTotals[total.id] ?? 0, observationCode: total.observationCode })),
        }],
      })
    }
  }, [componentId, computedTotals, createdBy, panelCode, rootValue, rowDefs, saveMode, sd, setFormData, title, totalDefs])

  const historyRows = useMemo(() => {
    if (!history) return []
    const codeSet = new Set([...rowDefs, ...totalDefs].map((item) => item.observationCode).filter(Boolean))
    const source = Array.isArray(sd?.patient?.observations) ? sd.patient.observations : []
    const grouped = new Map()
    source.forEach((entry) => {
      if (!codeSet.has(entry.observationCode)) return
      const key = panelDateKey(entry.collectedDateTime)
      const current = grouped.get(key) ?? { date: key }
      current[entry.observationCode] = entry.value
      grouped.set(key, current)
    })
    return Array.from(grouped.values()).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, maxHistory)
  }, [history, maxHistory, rowDefs, sd, totalDefs])

  const setRowValue = (rowId, nextValue) => {
    setFormData((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const current = draft.field.data[effectiveFieldId] && typeof draft.field.data[effectiveFieldId] === "object"
        ? draft.field.data[effectiveFieldId]
        : {}
      const { __authorship, ...rowValues } = current
      draft.field.data[effectiveFieldId] = { ...rowValues, [rowId]: nextValue }
    })
  }

  return (
    <Stack tokens={{ childrenGap: 10 }}>
      <Label>{title}</Label>
      {rowDefs.map((row) => {
        const value = getPanelValue(rootValue, row.id)
        const rowLockInfo = authorshipPolicy?.enabled
          ? getAuthorshipLockInfo(fd, { scope: "row", componentId, rowKey: row.id }, currentActorName)
          : { locked: false }
        const rowReadOnly = !!rowLockInfo.locked
        if (row.type === "coded") {
          const optionList = Array.isArray(row.options)
            ? row.options.map((option) => ({ key: String(option), text: String(option) }))
            : []
          return (
            <Stack key={row.id} tokens={{ childrenGap: 4 }}>
              <ChoiceGroup
                label={row.label}
                options={optionList}
                selectedKey={value == null ? undefined : String(value)}
                onChange={rowReadOnly ? undefined : (_event, option) => setRowValue(row.id, option?.key ?? "")}
                disabled={rowReadOnly}
              />
              {rowLockInfo.note ? (
                <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                  {rowLockInfo.note}
                </Text>
              ) : null}
            </Stack>
          )
        }
        return (
          <Stack key={row.id} tokens={{ childrenGap: 4 }}>
            <TextField
              label={row.label}
              value={value ?? ""}
              onChange={rowReadOnly ? undefined : (_event, nextValue) => setRowValue(row.id, row.type === "numeric" ? Number(nextValue ?? 0) : (nextValue ?? ""))}
              multiline={row.type === "text"}
              readOnly={rowReadOnly}
            />
            {rowLockInfo.note ? (
              <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                {rowLockInfo.note}
              </Text>
            ) : null}
          </Stack>
        )
      })}
      {totalDefs.length > 0 ? <Separator /> : null}
      {totalDefs.map((total) => (
        <Text key={total.id} variant="mediumPlus">
          {total.label}: {computedTotals[total.id] ?? 0}
        </Text>
      ))}
      {history && historyRows.length > 0 ? (
        <Stack tokens={{ childrenGap: 6 }}>
          <Label>History</Label>
          {historyRows.map((entry) => (
            <Text key={entry.date} variant="small">
              {entry.date}: {rowDefs.concat(totalDefs).map((item) => `${item.label} ${entry[item.observationCode] ?? "-"}`).join(" | ")}
            </Text>
          ))}
        </Stack>
      ) : null}
    </Stack>
  )
}
