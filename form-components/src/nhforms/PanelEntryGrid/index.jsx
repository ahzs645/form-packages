const { useEffect, useMemo } = React
const { Dropdown, Label, Separator, Stack, Text, TextField } = Fluent

const panelGridRows = (rows) => Array.isArray(rows)
  ? rows.filter((row) => row && typeof row === "object" && typeof row.id === "string")
  : []
const panelGridTotals = (totals) => Array.isArray(totals)
  ? totals.filter((total) => total && typeof total === "object" && typeof total.id === "string")
  : []
const panelGridDateKey = (value) => {
  const raw = String(value ?? "")
  return raw.includes("T") ? raw.split("T")[0] : raw
}
const stripPanelGridVolatileFields = (value) => {
  if (Array.isArray(value)) return value.map(stripPanelGridVolatileFields)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "collectedDate" && key !== "reportedDate" && key !== "collectedDateTime")
        .map(([key, nested]) => [key, stripPanelGridVolatileFields(nested)])
    )
  }
  return value
}
const panelGridPayloadsEqual = (left, right) => (
  JSON.stringify(stripPanelGridVolatileFields(left ?? null)) ===
  JSON.stringify(stripPanelGridVolatileFields(right ?? null))
)
const setPanelGridPayload = (setFormData, componentId, payloadType, payload) => {
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    const container = draft.field.data.__componentPayloads ?? {}
    const key = payloadType === "webform" ? "webformUpdatesByComponent" : "dcoUpdatesByComponent"
    const group = container[key] ?? {}
    if (panelGridPayloadsEqual(group[componentId], payload)) return
    if (payload == null || (Array.isArray(payload) && payload.length === 0)) delete group[componentId]
    else group[componentId] = payload
    container[key] = group
    draft.field.data.__componentPayloads = container
  }))
}
const getPanelGridAuth = () => (typeof window !== "undefined" && window.__nhAuth) || null

const PANEL_GRID_TABLE_STYLE = {
  borderCollapse: "collapse",
  tableLayout: "fixed",
  width: "100%",
}
const PANEL_GRID_CELL_STYLE = {
  border: "1px solid #d2d0ce",
  padding: "8px",
  verticalAlign: "middle",
}

/**
 * Shared observation-panel entry surface.
 *
 * Row types: scale/coded, numeric/number, text, and choice. Values stay nested
 * under fieldId while ObservationValueKit emits one MOIS observation panel.
 * Historical panels are transposed into date columns beside the current entry.
 */
const PanelEntryGrid = ({
  id,
  fieldId,
  title = "Observation Panel",
  panelCode = "",
  panelName,
  rows = [],
  totals = [],
  history = false,
  historyConfig,
  saveMode = "panel",
  includeEmptyRows = false,
  legacyDcoWrites = false,
  authorshipPolicy: authorshipPolicyProp,
  orderedByFieldId,
  facilityFieldId,
  notesFieldId,
}) => {
  const kit = ObservationValueKit
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const section = useSection()
  const componentId = id || fieldId || "PanelEntryGrid"
  const effectiveFieldId = fieldId || componentId
  const values = fd?.field?.data?.[effectiveFieldId] && typeof fd.field.data[effectiveFieldId] === "object"
    ? fd.field.data[effectiveFieldId]
    : {}
  const rowDefs = useMemo(() => panelGridRows(rows), [rows])
  const totalDefs = useMemo(() => panelGridTotals(totals), [totals])
  const historyEnabled = history || historyConfig?.enabled === true
  const maxHistory = Number(historyConfig?.maxRows) > 0 ? Number(historyConfig.maxRows) : 5
  const authorshipPolicy = authorshipPolicyProp || section?.authorshipPolicy || { enabled: false, granularity: "row", lockOn: "edit" }
  const nhAuth = getPanelGridAuth()
  const actor = nhAuth
    ? nhAuth.actor(sd, fd)
    : { ownerName: fd?.field?.data?.createdBy ?? sd?.userProfile?.identity?.fullName ?? "" }

  const computedTotals = useMemo(() => {
    const next = {}
    totalDefs.forEach((total) => {
      const sourceIds = Array.isArray(total.sourceRowIds) ? total.sourceRowIds : []
      const answers = sourceIds.map((sourceId) => kit.normalizeAnswer(values[sourceId], rowDefs.find((row) => row.id === sourceId)?.options))
      const requireComplete = total.requireComplete !== false
      if (answers.length === 0 || (requireComplete && answers.some((answer) => answer.empty || answer.numeric === null))) {
        next[total.id] = null
        return
      }
      const numbers = answers.filter((answer) => !answer.empty && answer.numeric !== null).map((answer) => answer.numeric)
      if (numbers.length === 0) {
        next[total.id] = null
      } else if (total.method === "average") {
        next[total.id] = numbers.reduce((sum, value) => sum + value, 0) / numbers.length
      } else if (total.method === "min") {
        next[total.id] = Math.min(...numbers)
      } else if (total.method === "max") {
        next[total.id] = Math.max(...numbers)
      } else {
        next[total.id] = numbers.reduce((sum, value) => sum + value, 0)
      }
    })
    return next
  }, [kit, rowDefs, totalDefs, values])

  useEffect(() => {
    const data = fd?.field?.data ?? {}
    const collectedBy = data.createdBy ?? sd?.userProfile?.identity?.fullName
    const shouldWriteDcos = legacyDcoWrites || saveMode === "dco" || saveMode === "both"
    setPanelGridPayload(
      setFormData,
      componentId,
      "dco",
      shouldWriteDcos
        ? kit.buildDcoUpdates({ sd, rows: rowDefs, totals: totalDefs, values, totalValues: computedTotals, collectedBy })
        : null
    )
    const shouldWritePanel = saveMode === "panel" || saveMode === "both"
    const panelUpdate = shouldWritePanel
      ? kit.buildPanelUpdate({
          sd,
          panelCode,
          panelName,
          title,
          rows: rowDefs,
          totals: totalDefs,
          values,
          totalValues: computedTotals,
          includeEmptyRows,
          orderedBy: orderedByFieldId ? data[orderedByFieldId] : collectedBy,
          facility: facilityFieldId ? data[facilityFieldId] : undefined,
          notes: notesFieldId ? data[notesFieldId] : undefined,
        })
      : null
    setPanelGridPayload(setFormData, componentId, "webform", panelUpdate ? { panelUpdates: [panelUpdate] } : null)
  }, [componentId, computedTotals, fd, facilityFieldId, includeEmptyRows, kit, legacyDcoWrites, notesFieldId, orderedByFieldId, panelCode, panelName, rowDefs, saveMode, sd, setFormData, title, totalDefs, values])

  const historyColumns = useMemo(() => {
    if (!historyEnabled) return []
    const definitions = [...rowDefs, ...totalDefs]
    const observations = Array.isArray(sd?.patient?.observations)
      ? sd.patient.observations
      : (Array.isArray(sd?.queryResult?.patient?.[0]?.observations) ? sd.queryResult.patient[0].observations : [])
    const grouped = new Map()
    observations.forEach((entry) => {
      const definition = definitions.find((candidate) => (
        (candidate.observationCode && candidate.observationCode === entry?.observationCode) ||
        (candidate.loincCode && candidate.loincCode === entry?.loincCode)
      ))
      if (!definition) return
      const date = panelGridDateKey(entry?.collectedDateTime ?? entry?.collectedDate ?? entry?.reportedDate)
      if (!date) return
      const column = grouped.get(date) ?? { date, values: {} }
      column.values[definition.id] = entry?.codedValue?.display ?? entry?.display ?? entry?.value ?? entry?.report ?? ""
      grouped.set(date, column)
    })
    return Array.from(grouped.values())
      .sort((left, right) => String(right.date).localeCompare(String(left.date)))
      .slice(0, maxHistory)
  }, [historyEnabled, maxHistory, rowDefs, sd, totalDefs])

  const setRowValue = (rowId, nextValue) => {
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const current = draft.field.data[effectiveFieldId] && typeof draft.field.data[effectiveFieldId] === "object"
        ? draft.field.data[effectiveFieldId]
        : {}
      draft.field.data[effectiveFieldId] = { ...current, [rowId]: nextValue }
      if (nhAuth && authorshipPolicy?.enabled) {
        nhAuth.claim(draft, sd, { scope: "row", componentId, rowKey: rowId }, nextValue, authorshipPolicy, {
          now: sd?.previewOptions?.authorshipNow,
        })
      }
    }))
  }

  const renderCurrentValue = (row, value, readOnly) => {
    const type = String(row.type ?? "text").toLowerCase()
    const normalizedOptions = kit.normalizeOptions(row.options)
    const scaleLike = type === "scale" || (type === "coded" && normalizedOptions.length > 0 && normalizedOptions.every((option) => Number.isFinite(Number(option.value))))
    if (scaleLike) {
      return (
        <ScaleField
          fieldId={`${effectiveFieldId}_${row.id}`}
          label={row.label}
          options={normalizedOptions}
          value={value}
          onChange={(nextValue) => setRowValue(row.id, nextValue)}
          hideLabel
          disableHorizontalScroll
          showInlineLabels={row.showInlineLabels !== false}
          showTooltip={row.showTooltip === true}
          tooltipMode={row.tooltipMode ?? "option"}
          required={row.required === true}
          readOnly={readOnly}
        />
      )
    }
    if (type === "choice" || type === "coded") {
      const answer = kit.normalizeAnswer(value, normalizedOptions)
      return (
        <Dropdown
          options={normalizedOptions.map((option) => ({ key: option.key, text: option.label }))}
          selectedKey={answer.empty ? undefined : answer.code}
          onChange={readOnly ? undefined : (_event, option) => {
            const selected = normalizedOptions.find((candidate) => candidate.key === String(option?.key ?? ""))
            setRowValue(row.id, selected ? {
              code: selected.key,
              display: selected.label,
              system: row.system ?? selected.system,
            } : null)
          }}
          disabled={readOnly}
        />
      )
    }
    if (type === "numeric" || type === "number") {
      const answer = kit.normalizeAnswer(value, row.options)
      return (
        <TextField
          type="number"
          value={answer.empty ? "" : String(answer.raw)}
          min={row.min}
          max={row.max}
          step={row.step}
          onChange={readOnly ? undefined : (_event, nextValue) => setRowValue(row.id, nextValue === "" ? "" : Number(nextValue))}
          readOnly={readOnly}
        />
      )
    }
    return (
      <TextField
        value={kit.normalizeAnswer(value, row.options).display}
        multiline={row.multiline !== false}
        onChange={readOnly ? undefined : (_event, nextValue) => setRowValue(row.id, nextValue ?? "")}
        readOnly={readOnly}
      />
    )
  }

  return (
    <Stack tokens={{ childrenGap: 10 }}>
      <Label>{title}</Label>
      <div style={{ overflowX: "auto" }}>
        <table style={PANEL_GRID_TABLE_STYLE}>
          <thead>
            <tr>
              <th style={{ ...PANEL_GRID_CELL_STYLE, minWidth: 180, textAlign: "left" }}>Measure</th>
              <th style={{ ...PANEL_GRID_CELL_STYLE, minWidth: 320 }}>Current</th>
              {historyColumns.map((column) => (
                <th key={column.date} style={{ ...PANEL_GRID_CELL_STYLE, minWidth: 110 }}>{column.date}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowDefs.map((row) => {
              const value = values[row.id]
              const lockInfo = nhAuth && authorshipPolicy?.enabled
                ? nhAuth.lockInfo(fd, sd, { scope: "row", componentId, rowKey: row.id }, {
                    ownerName: actor.ownerName,
                    ownerId: actor.ownerId,
                    now: sd?.previewOptions?.authorshipNow,
                  })
                : { locked: false }
              return (
                <tr key={row.id}>
                  <th scope="row" style={{ ...PANEL_GRID_CELL_STYLE, textAlign: "left" }}>
                    {row.label}
                    {row.units ? <Text variant="small"> {`(${row.units})`}</Text> : null}
                    {lockInfo.note ? (
                      <Text block variant="small" styles={{ root: { color: "#605e5c", fontWeight: 400 } }}>{lockInfo.note}</Text>
                    ) : null}
                  </th>
                  <td style={PANEL_GRID_CELL_STYLE}>{renderCurrentValue(row, value, !!lockInfo.locked)}</td>
                  {historyColumns.map((column) => (
                    <td key={column.date} style={{ ...PANEL_GRID_CELL_STYLE, textAlign: "center" }}>
                      {column.values[row.id] === undefined || column.values[row.id] === "" ? "—" : String(column.values[row.id])}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {totalDefs.length > 0 ? <Separator /> : null}
      {totalDefs.map((total) => (
        <Text key={total.id} variant="mediumPlus">
          {total.label}: {computedTotals[total.id] === null ? "—" : computedTotals[total.id]}
        </Text>
      ))}
    </Stack>
  )
}
