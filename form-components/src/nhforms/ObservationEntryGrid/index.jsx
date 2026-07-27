const { useMemo, useState, useEffect } = React
const { Stack, Label, Text, TextField, DefaultButton, PrimaryButton, Dropdown } = Fluent

const gridToText = (value) => {
  if (value === null || value === undefined) return ""
  return String(value)
}

const gridDateKey = (value) => {
  const raw = gridToText(value)
  return raw.includes("T") ? raw.split("T")[0] : raw
}

const gridParseDate = (value) => {
  const raw = gridToText(value).trim()
  if (!raw) return null
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(/\./g, "-"))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getGridSource = (sd, sourcePath) => {
  if (!sourcePath) return sd?.patient?.observations ?? []
  const steps = gridToText(sourcePath).split(".").filter(Boolean)
  let current = sd
  for (const step of steps) {
    if (current && typeof current === "object") {
      current = current[step]
    } else {
      return []
    }
  }
  return Array.isArray(current) ? current : []
}

const normalizeGridCodes = (codes) => {
  if (!Array.isArray(codes)) return []
  return codes
    .map((entry) => {
      if (typeof entry === "string") {
        const code = entry.trim()
        return code ? { code, label: code, loincCode: "", units: "", hotkey: "" } : null
      }
      if (!entry || typeof entry !== "object") return null
      const code = gridToText(entry.code).trim()
      if (!code) return null
      return {
        code,
        label: gridToText(entry.label).trim() || code,
        loincCode: gridToText(entry.loincCode).trim(),
        units: gridToText(entry.units).trim(),
        hotkey: gridToText(entry.hotkey).trim().slice(0, 1).toLowerCase(),
      }
    })
    .filter(Boolean)
}

const gridCutoffDate = (lookback) => {
  if (!lookback || typeof lookback !== "object") return null
  const amount = Math.floor(Number(lookback.amount))
  if (!Number.isFinite(amount) || amount <= 0) return null
  const cutoff = new Date()
  if (lookback.unit === "days") {
    cutoff.setDate(cutoff.getDate() - amount)
  } else if (lookback.unit === "years") {
    cutoff.setFullYear(cutoff.getFullYear() - amount)
  } else if (lookback.unit === "months") {
    cutoff.setMonth(cutoff.getMonth() - amount)
  } else {
    return null
  }
  return cutoff
}

const gridNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// Same four MOIS bands as PastMeasurementField's save path: absurd/very
// ranges -> LL/HH outrank the normal range -> L/H.
const classifyGridFlag = (ranges, rawValue) => {
  const value = gridNumber(rawValue)
  if (value === null || !ranges) return null
  const criticalLow = gridNumber(ranges.rangeAbsurdLow) ?? gridNumber(ranges.rangeVeryLow)
  const criticalHigh = gridNumber(ranges.rangeAbsurdHigh) ?? gridNumber(ranges.rangeVeryHigh)
  const normalLow = gridNumber(ranges.rangeNormalLow)
  const normalHigh = gridNumber(ranges.rangeNormalHigh)
  if (criticalLow !== null && value < criticalLow) return "LL"
  if (criticalHigh !== null && value > criticalHigh) return "HH"
  if (normalLow !== null && value < normalLow) return "L"
  if (normalHigh !== null && value > normalHigh) return "H"
  return null
}

const gridFlagStyle = (flag) => {
  if (flag === "LL" || flag === "HH") {
    return { background: "#fde7e9", color: "#a4262c", fontWeight: 600 }
  }
  if (flag === "L" || flag === "H") {
    return { background: "#fff4ce" }
  }
  return {}
}

const gridEntryMatchesCode = (entry, candidate) => {
  const entryCode = gridToText(entry?.observationCode).trim().toLowerCase()
  const entryLoinc = gridToText(entry?.loincCode).trim().toLowerCase()
  const code = candidate.code.toLowerCase()
  const loinc = candidate.loincCode.toLowerCase()
  if (entryCode && (entryCode === code || (loinc && entryCode === loinc))) return true
  if (entryLoinc && (entryLoinc === code || (loinc && entryLoinc === loinc))) return true
  return false
}

const stripVolatileGridFields = (payload) => {
  if (!Array.isArray(payload)) return payload
  return payload.map((entry) => {
    if (!entry || typeof entry !== "object") return entry
    const { collectedDateTime, ...rest } = entry
    return rest
  })
}

const gridPayloadsEqual = (left, right) => (
  JSON.stringify(stripVolatileGridFields(left ?? null)) ===
  JSON.stringify(stripVolatileGridFields(right ?? null))
)

// setFormData must receive a produce()-wrapped recipe (raw React setter in the
// real MOIS runtime) — same contract as PastMeasurementField.
const setGridNestedPayload = (setFormData, componentId, payload) => {
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    const container = draft.field.data.__componentPayloads ?? {}
    const nextGroup = container.dcoUpdatesByComponent ?? {}
    const currentPayload = nextGroup[componentId]
    if (gridPayloadsEqual(currentPayload, payload)) {
      return
    }
    if (payload == null || (Array.isArray(payload) && payload.length === 0)) {
      delete nextGroup[componentId]
    } else {
      nextGroup[componentId] = payload
    }
    container.dcoUpdatesByComponent = nextGroup
    draft.field.data.__componentPayloads = container
  }))
}

const readGridRows = (fd, key) => {
  const stored = fd?.field?.data?.[key]
  return Array.isArray(stored) ? stored.filter((entry) => entry && typeof entry === "object") : []
}

// Ranges for flag classification come from the most recent chart observation
// carrying range metadata for the same code — the code config itself has none.
const findRangesForCode = (source, candidate) => {
  let best = null
  let bestTime = -Infinity
  source.forEach((entry) => {
    if (!entry || typeof entry !== "object") return
    if (!gridEntryMatchesCode(entry, candidate)) return
    const hasRanges = [entry.rangeNormalLow, entry.rangeNormalHigh, entry.rangeVeryLow, entry.rangeVeryHigh, entry.rangeAbsurdLow, entry.rangeAbsurdHigh]
      .some((value) => gridToText(value).trim() !== "")
    if (!hasRanges) return
    const parsed = gridParseDate(entry.collectedDateTime)
    const time = parsed ? parsed.getTime() : 0
    if (time >= bestTime) {
      best = entry
      bestTime = time
    }
  })
  if (!best) return null
  return {
    rangeNormalLow: best.rangeNormalLow,
    rangeNormalHigh: best.rangeNormalHigh,
    rangeVeryLow: best.rangeVeryLow,
    rangeVeryHigh: best.rangeVeryHigh,
    rangeAbsurdLow: best.rangeAbsurdLow,
    rangeAbsurdHigh: best.rangeAbsurdHigh,
    referenceRangeText: best.referenceRangeText,
    units: best.units,
  }
}

const GRID_FLAG_DISPLAYS = { LL: "Critical low", L: "Low", H: "High", HH: "Critical high" }

const buildGridAbnormalFlag = (sd, flagCode) => (
  flagCode
    ? {
        code: flagCode,
        display: sd?.optionLists?.["MOIS-ABNORMALFLAG"]?.[flagCode] ?? GRID_FLAG_DISPLAYS[flagCode],
        system: "MOIS-ABNORMALFLAG",
      }
    : null
)

const cellStyle = { border: "1px solid #e1dfdd", padding: "5px 6px", fontSize: 12 }
const headStyle = { border: "1px solid #d0d0d0", textAlign: "left", padding: "5px 6px", background: "#f3f2f1", fontSize: 12 }
const rowActionStyles = { root: { minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 } }

const GridDetailPane = ({ row }) => {
  if (!row) return null
  const ranges = row.ranges ?? {}
  const rangeText = gridToText(ranges.referenceRangeText).trim()
  const bands = [
    { key: "LL", value: ranges.rangeAbsurdLow ?? ranges.rangeVeryLow },
    { key: "L", value: ranges.rangeNormalLow },
    { key: "H", value: ranges.rangeNormalHigh },
    { key: "HH", value: ranges.rangeAbsurdHigh ?? ranges.rangeVeryHigh },
  ].filter((band) => gridToText(band.value).trim() !== "")
  return (
    <div style={{ border: "1px solid #d0d0d0", background: "#faf9f8", padding: "8px 10px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {row.description || row.code}
        {row.flag ? <span style={{ marginLeft: 8, ...gridFlagStyle(row.flag), padding: "0 4px" }}>{row.flag}</span> : null}
      </div>
      <div>Code: {row.code}{row.units ? "  ·  Units: " + row.units : ""}</div>
      <div>Collected: {row.dateKey || "-"}</div>
      {bands.length > 0 ? (
        <div>
          Ref. ranges: {bands.map((band) => band.key + " " + gridToText(band.value)).join("  ·  ")}
        </div>
      ) : rangeText ? (
        <div>Ref. range: {rangeText}</div>
      ) : (
        <div style={{ color: "#605e5c" }}>No reference range on record.</div>
      )}
    </div>
  )
}

const ObservationEntryGrid = ({
  fieldId,
  id,
  title = "Measurements",
  codes = [],
  lookback = null,
  maxRows = 15,
  sourcePath = "patient.observations",
  datePath = "collectedDateTime",
  showQuickButtons = true,
  showDetail = true,
  allowChartEdits = false,
  readOnly = false,
}) => {
  const sd = useSourceData()
  const [fd, setFormData] = useActiveData()
  const componentId = id || fieldId || "ObservationEntryGrid"
  const entriesKey = componentId + "_entries"
  const editsKey = componentId + "_edits"
  const codeList = useMemo(() => normalizeGridCodes(codes), [codes])
  const source = useMemo(() => getGridSource(sd, sourcePath), [sd, sourcePath])
  const entries = readGridRows(fd, entriesKey)
  const edits = readGridRows(fd, editsKey)
  const [selectedKey, setSelectedKey] = useState(null)
  // editor: null | { mode: "new", code } | { mode: "correct", observationId, code, description }
  const [editor, setEditor] = useState(null)
  const [editorValue, setEditorValue] = useState("")

  const editByObservationId = useMemo(() => {
    const map = new Map()
    edits.forEach((edit) => {
      const observationId = gridNumber(edit.observationId)
      if (observationId !== null) map.set(observationId, edit)
    })
    return map
  }, [edits])

  const chartRows = useMemo(() => {
    const cutoff = gridCutoffDate(lookback)
    const rows = []
    source.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return
      const codeIndex = codeList.length > 0 ? codeList.findIndex((candidate) => gridEntryMatchesCode(entry, candidate)) : -1
      if (codeList.length > 0 && codeIndex < 0) return
      const parsed = gridParseDate(entry[datePath])
      if (!parsed) return
      if (cutoff && parsed.getTime() < cutoff.getTime()) return
      const value = gridToText(entry.value ?? entry.display ?? entry.report ?? "")
      const explicitFlag = entry.abnormalFlag && typeof entry.abnormalFlag === "object"
        ? gridToText(entry.abnormalFlag.code).trim()
        : gridToText(entry.abnormalFlag).trim()
      rows.push({
        key: "chart-" + index,
        observationId: gridNumber(entry.observationId),
        dateKey: gridDateKey(entry[datePath]),
        collectedDateTime: gridToText(entry[datePath]),
        time: parsed.getTime(),
        code: gridToText(entry.observationCode).trim(),
        description: gridToText(entry.description).trim() || (codeIndex >= 0 ? codeList[codeIndex].label : ""),
        value,
        units: gridToText(entry.units).trim(),
        flag: explicitFlag || classifyGridFlag(entry, value),
        ranges: entry,
        fromChart: true,
      })
    })
    rows.sort((left, right) => right.time - left.time)
    return rows.slice(0, Math.max(1, Math.floor(Number(maxRows)) || 15))
  }, [codeList, datePath, lookback, maxRows, source])

  const entryRows = useMemo(() => entries.map((entry) => {
    const candidate = codeList.find((item) => item.code === entry.code) ?? { code: gridToText(entry.code), label: gridToText(entry.description), loincCode: "", units: "", hotkey: "" }
    const ranges = findRangesForCode(source, candidate)
    return {
      key: "entry-" + gridToText(entry.rowId),
      rowId: gridToText(entry.rowId),
      dateKey: gridDateKey(entry.dateTime),
      code: candidate.code,
      description: gridToText(entry.description).trim() || candidate.label,
      value: gridToText(entry.value),
      units: gridToText(entry.units).trim() || candidate.units || gridToText(ranges?.units).trim(),
      flag: classifyGridFlag(ranges, entry.value),
      ranges: ranges ?? {},
      fromChart: false,
    }
  }), [codeList, entries, source])

  // Stage in-form rows as new DCOBS observations (id 0 / status F), chart
  // corrections as status C on the original id, and chart deletions as
  // negative ids — the generated form's save path flattens them into
  // DCOUpdates.
  useEffect(() => {
    if (readOnly) return
    const createdBy = sd?.userProfile?.identity?.fullName
    const newPayload = entries
      .filter((entry) => gridToText(entry.value).trim() !== "" && gridToText(entry.code).trim() !== "")
      .map((entry) => {
        const candidate = codeList.find((item) => item.code === entry.code) ?? { code: gridToText(entry.code), label: gridToText(entry.description), loincCode: "", units: "", hotkey: "" }
        const ranges = findRangesForCode(source, candidate)
        const value = gridToText(entry.value).trim()
        const flagCode = classifyGridFlag(ranges, value)
        const abnormalFlag = buildGridAbnormalFlag(sd, flagCode)
        return {
          observationId: 0,
          observationCode: candidate.code,
          observationClass: "DCOBS",
          value,
          valueType: gridNumber(value) !== null ? "NUMERIC" : "TEXT",
          status: "F",
          description: gridToText(entry.description).trim() || candidate.label || "Measurement",
          units: gridToText(entry.units).trim() || candidate.units || gridToText(ranges?.units).trim(),
          ...(candidate.loincCode ? { loincCode: candidate.loincCode } : {}),
          ...(createdBy ? { orderedBy: createdBy, collectedBy: createdBy } : {}),
          collectedDateTime: gridToText(entry.dateTime) || getDateTimeString(new Date()),
          ...(ranges && gridToText(ranges.rangeNormalLow).trim() !== "" ? { rangeNormalLow: gridToText(ranges.rangeNormalLow) } : {}),
          ...(ranges && gridToText(ranges.rangeNormalHigh).trim() !== "" ? { rangeNormalHigh: gridToText(ranges.rangeNormalHigh) } : {}),
          ...(abnormalFlag ? { abnormalFlag } : {}),
        }
      })
    const editPayload = edits
      .map((edit) => {
        const observationId = gridNumber(edit.observationId)
        if (observationId === null || observationId <= 0) return null
        if (edit.action === "delete") {
          return { observationId: -observationId }
        }
        const value = gridToText(edit.value).trim()
        if (!value) return null
        const candidate = codeList.find((item) => item.code === edit.code) ?? { code: gridToText(edit.code), label: gridToText(edit.description), loincCode: "", units: "", hotkey: "" }
        const ranges = findRangesForCode(source, candidate)
        const flagCode = classifyGridFlag(ranges, value)
        const abnormalFlag = buildGridAbnormalFlag(sd, flagCode)
        return {
          observationId,
          observationCode: candidate.code,
          observationClass: "DCOBS",
          value,
          valueType: gridNumber(value) !== null ? "NUMERIC" : "TEXT",
          status: "C",
          description: gridToText(edit.description).trim() || candidate.label || "Measurement",
          units: gridToText(edit.units).trim() || candidate.units || gridToText(ranges?.units).trim(),
          ...(createdBy ? { collectedBy: createdBy } : {}),
          collectedDateTime: gridToText(edit.collectedDateTime) || getDateTimeString(new Date()),
          ...(abnormalFlag ? { abnormalFlag } : {}),
        }
      })
      .filter(Boolean)
    setGridNestedPayload(setFormData, componentId, [...newPayload, ...editPayload])
  }, [codeList, componentId, edits, entries, readOnly, sd, setFormData, source])

  const startEntry = (code) => {
    if (readOnly) return
    setEditor({ mode: "new", code: code ?? codeList[0]?.code ?? null })
    setEditorValue("")
  }

  const startCorrection = (row) => {
    if (readOnly || row.observationId === null) return
    setEditor({
      mode: "correct",
      observationId: row.observationId,
      code: row.code,
      description: row.description,
      units: row.units,
      collectedDateTime: row.collectedDateTime,
    })
    setEditorValue(row.value)
  }

  const writeRows = (key, updater) => {
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const current = Array.isArray(draft.field.data[key]) ? draft.field.data[key] : []
      draft.field.data[key] = updater(current)
    }))
  }

  const saveEditor = () => {
    if (!editor) return
    const value = gridToText(editorValue).trim()
    if (!value) return
    if (editor.mode === "correct") {
      const edit = {
        observationId: editor.observationId,
        action: "correct",
        code: editor.code,
        description: editor.description,
        units: editor.units,
        value,
        collectedDateTime: editor.collectedDateTime,
      }
      writeRows(editsKey, (current) => [
        edit,
        ...current.filter((item) => gridNumber(item.observationId) !== editor.observationId),
      ])
    } else {
      const code = gridToText(editor.code).trim()
      if (!code) return
      const candidate = codeList.find((item) => item.code === code)
      const rowId = "row-" + Date.now() + "-" + Math.floor(Math.random() * 100000)
      writeRows(entriesKey, (current) => [
        {
          rowId,
          code,
          description: candidate?.label ?? code,
          value,
          units: candidate?.units ?? "",
          dateTime: getDateTimeString(new Date()),
        },
        ...current,
      ])
    }
    setEditor(null)
    setEditorValue("")
  }

  const deleteEntry = (rowId) => {
    writeRows(entriesKey, (current) => current.filter((entry) => gridToText(entry.rowId) !== rowId))
    if (selectedKey === "entry-" + rowId) setSelectedKey(null)
  }

  const stageChartDelete = (row) => {
    if (row.observationId === null) return
    writeRows(editsKey, (current) => [
      { observationId: row.observationId, action: "delete", code: row.code, description: row.description },
      ...current.filter((item) => gridNumber(item.observationId) !== row.observationId),
    ])
  }

  const undoChartEdit = (observationId) => {
    writeRows(editsKey, (current) => current.filter((item) => gridNumber(item.observationId) !== observationId))
  }

  // MOIS-parity quick-entry shortcuts (BP ctrl+b, Weight ctrl+w, ...): each
  // configured hotkey starts a prefilled new entry.
  useEffect(() => {
    if (readOnly) return undefined
    const withHotkeys = codeList.filter((item) => item.hotkey)
    if (withHotkeys.length === 0) return undefined
    const handleKeyDown = (event) => {
      if (!event.ctrlKey || event.metaKey || event.altKey) return
      const key = gridToText(event.key).toLowerCase()
      const match = withHotkeys.find((item) => item.hotkey === key)
      if (!match) return
      event.preventDefault()
      setEditor({ mode: "new", code: match.code })
      setEditorValue("")
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [codeList, readOnly])

  const allRows = [...entryRows, ...chartRows]
  const selectedRow = allRows.find((row) => row.key === selectedKey) ?? null
  const showActionsColumn = !readOnly

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Label>{title}</Label>
        {!readOnly && codeList.length > 0 ? (
          <DefaultButton className="hideonprint" text="New" onClick={() => startEntry(null)} />
        ) : null}
      </Stack>
      <Stack horizontal tokens={{ childrenGap: 10 }}>
        <Stack.Item grow>
          <Stack tokens={{ childrenGap: 8 }}>
            {editor ? (
              <div className="hideonprint" style={{ border: "1px solid #d0d0d0", background: "#f3f9fd", padding: "8px 10px" }}>
                <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="end" wrap>
                  {editor.mode === "correct" ? (
                    <Text>
                      Correcting {editor.description || editor.code} ({editor.code})
                    </Text>
                  ) : (
                    <Dropdown
                      label="Measurement"
                      selectedKey={editor.code}
                      options={codeList.map((item) => ({ key: item.code, text: item.label + (item.units ? " (" + item.units + ")" : "") }))}
                      onChange={(_event, option) => setEditor({ mode: "new", code: option ? String(option.key) : null })}
                      styles={{ root: { minWidth: 220 } }}
                    />
                  )}
                  <TextField
                    label="Value"
                    value={editorValue}
                    onChange={(_event, value) => setEditorValue(value ?? "")}
                    styles={{ root: { minWidth: 120 } }}
                  />
                  <PrimaryButton
                    text={editor.mode === "correct" ? "Save correction" : "Add"}
                    disabled={!gridToText(editorValue).trim()}
                    onClick={saveEditor}
                  />
                  <DefaultButton text="Cancel" onClick={() => { setEditor(null); setEditorValue("") }} />
                </Stack>
              </div>
            ) : null}
            {allRows.length === 0 ? (
              <Text variant="small">No measurements found.</Text>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d0d0d0" }}>
                <thead>
                  <tr>
                    <th style={headStyle}>Collected</th>
                    <th style={headStyle}>Code</th>
                    <th style={headStyle}>Test Name</th>
                    <th style={headStyle}>Value</th>
                    <th style={headStyle}>Flag</th>
                    {showActionsColumn ? <th style={{ ...headStyle }} className="hideonprint" aria-label="Actions" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((row) => {
                    const pendingEdit = row.fromChart && row.observationId !== null
                      ? editByObservationId.get(row.observationId)
                      : null
                    const pendingDelete = pendingEdit?.action === "delete"
                    const pendingCorrection = pendingEdit?.action === "correct"
                    const displayValue = pendingCorrection ? gridToText(pendingEdit.value) : row.value
                    const displayFlag = pendingCorrection
                      ? classifyGridFlag(row.ranges, displayValue) ?? row.flag
                      : row.flag
                    return (
                      <tr
                        key={row.key}
                        onClick={() => setSelectedKey(row.key)}
                        style={{
                          cursor: showDetail ? "pointer" : "default",
                          background: row.key === selectedKey ? "#deecf9" : row.fromChart ? undefined : "#eff6fc",
                          ...(pendingDelete ? { textDecoration: "line-through", color: "#a4262c" } : {}),
                        }}
                      >
                        <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{row.dateKey}</td>
                        <td style={cellStyle}>{row.code}</td>
                        <td style={{ ...cellStyle, ...gridFlagStyle(displayFlag) }}>{row.description}</td>
                        <td style={{ ...cellStyle, ...gridFlagStyle(displayFlag) }}>
                          {pendingCorrection ? (
                            <span>
                              <span style={{ textDecoration: "line-through", color: "#605e5c", marginRight: 6 }}>
                                {row.value}
                              </span>
                              {displayValue}
                              {row.units ? " " + row.units : ""}
                            </span>
                          ) : (
                            <span>
                              {row.value}
                              {row.units ? " " + row.units : ""}
                            </span>
                          )}
                        </td>
                        <td style={{ ...cellStyle, textAlign: "center", fontWeight: 700 }}>{displayFlag ?? "-"}</td>
                        {showActionsColumn ? (
                          <td style={{ ...cellStyle, whiteSpace: "nowrap" }} className="hideonprint">
                            {!row.fromChart ? (
                              <DefaultButton
                                text="Delete"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  deleteEntry(row.rowId)
                                }}
                                styles={rowActionStyles}
                              />
                            ) : pendingEdit ? (
                              <DefaultButton
                                text="Undo"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  undoChartEdit(row.observationId)
                                }}
                                styles={rowActionStyles}
                              />
                            ) : allowChartEdits && row.observationId !== null ? (
                              <span>
                                <DefaultButton
                                  text="Edit"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    startCorrection(row)
                                  }}
                                  styles={rowActionStyles}
                                />
                                <DefaultButton
                                  text="Delete"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    stageChartDelete(row)
                                  }}
                                  styles={{ root: { ...rowActionStyles.root, marginLeft: 4 } }}
                                />
                              </span>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {showDetail ? <GridDetailPane row={selectedRow} /> : null}
          </Stack>
        </Stack.Item>
        {!readOnly && showQuickButtons && codeList.length > 0 ? (
          <div className="hideonprint" style={{ border: "1px solid #d0d0d0", background: "#faf9f8", padding: "8px", minWidth: 130 }}>
            <div style={{ fontWeight: 700, fontSize: 12, textAlign: "center", marginBottom: 6 }}>REMINDER</div>
            <Stack tokens={{ childrenGap: 6 }}>
              {codeList.map((item) => (
                <div key={item.code} style={{ textAlign: "center" }}>
                  <DefaultButton
                    text={item.label}
                    onClick={() => startEntry(item.code)}
                    styles={{ root: { width: "100%" } }}
                  />
                  {item.hotkey ? (
                    <div style={{ fontSize: 11, color: "#605e5c", marginTop: 2 }}>(ctrl + {item.hotkey})</div>
                  ) : null}
                </div>
              ))}
            </Stack>
          </div>
        ) : null}
      </Stack>
    </Stack>
  )
}
