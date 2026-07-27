const { useMemo, useState, useEffect, useRef } = React
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
  const text = gridToText(value).trim()
  if (!text) return null
  const parsed = Number(text)
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

const cellStyle = { border: "1px solid #e1dfdd", padding: "2px 6px", fontSize: 12, lineHeight: "16px" }
const headStyle = { border: "1px solid #d0d0d0", textAlign: "left", padding: "3px 6px", background: "#f3f2f1", fontSize: 12, lineHeight: "16px" }
const zebraRowBackground = "#faf9f8"
// MOIS paints unsaved in-grid entries salmon until the form is saved.
const newRowBackground = "#f8d5c8"
const inlineDropdownStyles = {
  root: { minWidth: 150 },
  title: { height: 22, lineHeight: "20px", fontSize: 12, paddingLeft: 6 },
  caretDownWrapper: { height: 22, lineHeight: "22px" },
}
const inlineTextFieldStyles = {
  root: { minWidth: 90 },
  fieldGroup: { height: 22 },
  field: { fontSize: 12, padding: "0 6px" },
}
const inlineCodeFieldStyles = {
  root: { minWidth: 60, maxWidth: 90 },
  fieldGroup: { height: 22 },
  field: { fontSize: 12, padding: "0 6px" },
}

const detailLabelStyle = { color: "#605e5c", whiteSpace: "nowrap", paddingRight: 6, textAlign: "right" }
const detailValueStyle = { paddingRight: 18, minWidth: 110 }
const detailBandLabelStyle = { color: "#004578", fontSize: 10, fontWeight: 600, textAlign: "center", padding: "0 6px" }

// MOIS-style reference-range band strip: threshold values in LL/L/H/HH colored
// cells around the units, band names captioned beneath. Rendered even when the
// row has no ranges (empty boxes, like MOIS) so the pane height never jumps.
const GridRangeBands = ({ ranges, centerText }) => {
  const cells = [
    { key: "LL", value: gridToText(ranges.rangeAbsurdLow ?? ranges.rangeVeryLow).trim(), style: { background: "#fde7e9" } },
    { key: "L", value: gridToText(ranges.rangeNormalLow).trim(), style: { background: "#fff4ce" } },
    { key: "NORMAL RANGE", value: gridToText(centerText).trim(), style: { color: "#605e5c" } },
    { key: "H", value: gridToText(ranges.rangeNormalHigh).trim(), style: { background: "#fff4ce" } },
    { key: "HH", value: gridToText(ranges.rangeAbsurdHigh ?? ranges.rangeVeryHigh).trim(), style: { background: "#fde7e9" } },
  ]
  return (
    <table style={{ borderCollapse: "collapse" }}>
      <tbody>
        <tr>
          <td rowSpan={2} style={{ padding: "0 4px", fontWeight: 700 }}>{"<"}</td>
          {cells.map((cell) => (
            <td
              key={cell.key}
              style={{
                border: "1px solid #d0d0d0",
                padding: "1px 10px",
                minWidth: 52,
                textAlign: "center",
                fontSize: 12,
                ...cell.style,
              }}
            >
              {cell.value || " "}
            </td>
          ))}
          <td rowSpan={2} style={{ padding: "0 4px", fontWeight: 700 }}>{">"}</td>
        </tr>
        <tr>
          {cells.map((cell) => (
            <td key={cell.key} style={detailBandLabelStyle}>{cell.key}</td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

const GridDetailPane = ({ row }) => {
  if (!row) return null
  const ranges = row.ranges ?? {}
  const rangeText = gridToText(ranges.referenceRangeText).trim()
  const hasBands = [ranges.rangeAbsurdLow, ranges.rangeVeryLow, ranges.rangeNormalLow, ranges.rangeNormalHigh, ranges.rangeAbsurdHigh, ranges.rangeVeryHigh]
    .some((value) => gridToText(value).trim() !== "")
  // Bands show the units in the center; without bands the center carries the
  // text-only range (or nothing), keeping the strip — and pane height — stable.
  const centerText = hasBands ? row.units : rangeText
  const fields = [
    [
      { label: "Ordered By", value: row.orderedBy },
      { label: "Collected By", value: row.collectedBy },
      { label: "Collect Date", value: row.dateKey },
    ],
    [
      { label: "Category", value: row.observationClass },
      { label: "LOINC", value: row.loincCode },
      { label: "Status", value: row.status },
    ],
  ]
  return (
    <div style={{ border: "1px solid #d0d0d0", background: "#faf9f8", padding: "6px 10px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {row.description || row.code}
        <span style={{ marginLeft: 8, color: "#605e5c", fontWeight: 400 }}>Code: {row.code}</span>
        {row.flag ? <span style={{ marginLeft: 8, ...gridFlagStyle(row.flag), padding: "0 4px" }}>{row.flag}</span> : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "2px 24px" }}>
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            {fields.map((line, index) => (
              <tr key={index}>
                {line.map((field) => (
                  <React.Fragment key={field.label}>
                    <td style={detailLabelStyle}>{field.label}:</td>
                    <td style={detailValueStyle}>{gridToText(field.value).trim() || "-"}</td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <div style={{ ...detailLabelStyle, textAlign: "left", fontSize: 11 }}>Ref. Ranges:</div>
          <GridRangeBands ranges={hasBands ? ranges : {}} centerText={centerText} />
        </div>
      </div>
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
  showOrderedBy = true,
  filterByCodes = true,
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
  // Per-row uncommitted code text: typing resolves only on Enter/blur so
  // partial codes ("19") don't prematurely match ("1950" intended).
  const [codeDrafts, setCodeDrafts] = useState({})
  const valueFieldRefs = useRef({})

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
      if (filterByCodes && codeList.length > 0 && codeIndex < 0) return
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
        loincCode: gridToText(entry.loincCode).trim(),
        description: gridToText(entry.description).trim() || (codeIndex >= 0 ? codeList[codeIndex].label : ""),
        value,
        units: gridToText(entry.units).trim(),
        orderedBy: gridToText(entry.orderedBy).trim(),
        collectedBy: gridToText(entry.collectedBy).trim(),
        observationClass: gridToText(entry.observationClass).trim(),
        status: gridToText(entry.status).trim(),
        flag: explicitFlag || classifyGridFlag(entry, value),
        ranges: entry,
        fromChart: true,
      })
    })
    rows.sort((left, right) => right.time - left.time)
    return rows.slice(0, Math.max(1, Math.floor(Number(maxRows)) || 15))
  }, [codeList, datePath, filterByCodes, lookback, maxRows, source])

  const entryRows = useMemo(() => entries.map((entry) => {
    const candidate = codeList.find((item) => item.code === entry.code) ?? { code: gridToText(entry.code), label: gridToText(entry.description), loincCode: "", units: "", hotkey: "" }
    const ranges = findRangesForCode(source, candidate)
    return {
      key: "entry-" + gridToText(entry.rowId),
      rowId: gridToText(entry.rowId),
      dateKey: gridDateKey(entry.dateTime),
      code: candidate.code,
      loincCode: candidate.loincCode,
      description: gridToText(entry.description).trim() || candidate.label,
      value: gridToText(entry.value),
      units: gridToText(entry.units).trim() || candidate.units || gridToText(ranges?.units).trim(),
      orderedBy: gridToText(sd?.userProfile?.identity?.fullName).trim(),
      collectedBy: gridToText(sd?.userProfile?.identity?.fullName).trim(),
      observationClass: "DCOBS",
      status: "F",
      flag: classifyGridFlag(ranges, entry.value),
      ranges: ranges ?? {},
      fromChart: false,
    }
  }), [codeList, entries, sd, source])

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

  const writeRows = (key, updater) => {
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const current = Array.isArray(draft.field.data[key]) ? draft.field.data[key] : []
      draft.field.data[key] = updater(current)
    }))
  }

  // MOIS-style New: insert an editable row at the top of the grid — pick the
  // test and type the value in place. Rows without a code+value never stage.
  const startEntry = (code) => {
    if (readOnly) return
    const candidate = code ? codeList.find((item) => item.code === code) : null
    const rowId = "row-" + Date.now() + "-" + Math.floor(Math.random() * 100000)
    writeRows(entriesKey, (current) => [
      {
        rowId,
        code: candidate?.code ?? "",
        description: candidate?.label ?? "",
        value: "",
        units: candidate?.units ?? "",
        dateTime: getDateTimeString(new Date()),
      },
      ...current,
    ])
    setSelectedKey("entry-" + rowId)
  }

  const updateEntry = (rowId, patch) => {
    writeRows(entriesKey, (current) => current.map((entry) => (
      gridToText(entry.rowId) === rowId ? { ...entry, ...patch } : entry
    )))
  }

  // Resolve a typed code to a test name: configured codes first (code or
  // LOINC), then the chart's own observations (newest matching record wins).
  const resolveEntryCode = (raw) => {
    const text = gridToText(raw).trim()
    if (!text) return { code: "", description: "", units: "" }
    const lower = text.toLowerCase()
    const candidate = codeList.find((item) =>
      item.code.toLowerCase() === lower || (item.loincCode && item.loincCode.toLowerCase() === lower))
    if (candidate) return { code: candidate.code, description: candidate.label, units: candidate.units }
    let best = null
    let bestTime = -Infinity
    source.forEach((entry) => {
      if (!entry || typeof entry !== "object") return
      const entryCode = gridToText(entry.observationCode).trim().toLowerCase()
      const entryLoinc = gridToText(entry.loincCode).trim().toLowerCase()
      if (entryCode !== lower && entryLoinc !== lower) return
      const time = gridParseDate(entry.collectedDateTime)?.getTime() ?? 0
      if (time >= bestTime) {
        best = entry
        bestTime = time
      }
    })
    if (best) {
      return { code: text, description: gridToText(best.description).trim(), units: gridToText(best.units).trim() }
    }
    return { code: text, description: "", units: "" }
  }

  const commitEntryCode = (rowId, raw) => {
    const resolved = resolveEntryCode(raw)
    updateEntry(rowId, resolved)
    setCodeDrafts((current) => {
      const next = { ...current }
      delete next[rowId]
      return next
    })
    if (resolved.code) valueFieldRefs.current[rowId]?.focus?.()
  }

  // Corrections stage immediately at the current value; the row's value cell
  // becomes editable in place until Undo or save.
  const startCorrection = (row) => {
    if (readOnly || row.observationId === null) return
    writeRows(editsKey, (current) => [
      {
        observationId: row.observationId,
        action: "correct",
        code: row.code,
        description: row.description,
        units: row.units,
        value: row.value,
        collectedDateTime: row.collectedDateTime,
      },
      ...current.filter((item) => gridNumber(item.observationId) !== row.observationId),
    ])
  }

  const updateCorrection = (observationId, value) => {
    writeRows(editsKey, (current) => current.map((item) => (
      gridNumber(item.observationId) === observationId && item.action === "correct"
        ? { ...item, value }
        : item
    )))
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
      startEntry(match.code)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  })

  const allRows = [...entryRows, ...chartRows]
  // MOIS keeps a row selected at all times, so the detail pane and the
  // toolbar's row actions always have a target — default to the newest row.
  const selectedRow = allRows.find((row) => row.key === selectedKey) ?? allRows[0] ?? null
  const selectedPendingEdit = selectedRow?.fromChart && selectedRow.observationId !== null
    ? editByObservationId.get(selectedRow.observationId)
    : null

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Label>{title}</Label>
        {!readOnly ? (
          <Stack horizontal tokens={{ childrenGap: 6 }} className="hideonprint">
            {codeList.length > 0 ? (
              <DefaultButton text="New" onClick={() => startEntry(null)} />
            ) : null}
            {selectedRow && !selectedRow.fromChart ? (
              <DefaultButton text="Delete" onClick={() => deleteEntry(selectedRow.rowId)} />
            ) : null}
            {selectedRow?.fromChart && selectedPendingEdit ? (
              <DefaultButton text="Undo" onClick={() => undoChartEdit(selectedRow.observationId)} />
            ) : null}
            {selectedRow?.fromChart && !selectedPendingEdit && allowChartEdits && selectedRow.observationId !== null ? (
              <DefaultButton text="Edit" onClick={() => startCorrection(selectedRow)} />
            ) : null}
            {selectedRow?.fromChart && !selectedPendingEdit && allowChartEdits && selectedRow.observationId !== null ? (
              <DefaultButton text="Delete" onClick={() => stageChartDelete(selectedRow)} />
            ) : null}
          </Stack>
        ) : null}
      </Stack>
      <Stack horizontal tokens={{ childrenGap: 10 }}>
        <Stack.Item grow>
          <Stack tokens={{ childrenGap: 8 }}>
            {allRows.length === 0 ? (
              <Text variant="small">No measurements found.</Text>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d0d0d0" }}>
                <thead>
                  <tr>
                    <th style={headStyle}>Collected</th>
                    {showOrderedBy ? <th style={headStyle}>Ordered By</th> : null}
                    <th style={headStyle}>Code</th>
                    <th style={headStyle}>Test Name</th>
                    <th style={headStyle}>Value</th>
                    <th style={headStyle}>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((row, rowIndex) => {
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
                          cursor: "pointer",
                          background: row.key === selectedRow?.key
                            ? (row.fromChart ? "#deecf9" : "#f4b8a4")
                            : row.fromChart
                              ? (rowIndex % 2 === 1 ? zebraRowBackground : undefined)
                              : newRowBackground,
                          ...(pendingDelete ? { textDecoration: "line-through", color: "#a4262c" } : {}),
                        }}
                      >
                        <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{row.dateKey}</td>
                        {showOrderedBy ? <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>{row.orderedBy || ""}</td> : null}
                        <td style={cellStyle}>
                          {!row.fromChart && !readOnly ? (
                            <TextField
                              placeholder="Code"
                              value={codeDrafts[row.rowId] ?? gridToText(row.code)}
                              autoFocus={!row.code}
                              onChange={(_event, value) => setCodeDrafts((current) => ({ ...current, [row.rowId]: value ?? "" }))}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter") return
                                event.preventDefault()
                                commitEntryCode(row.rowId, codeDrafts[row.rowId] ?? row.code)
                              }}
                              onBlur={() => {
                                if (codeDrafts[row.rowId] !== undefined) commitEntryCode(row.rowId, codeDrafts[row.rowId])
                              }}
                              styles={inlineCodeFieldStyles}
                            />
                          ) : (
                            row.code
                          )}
                        </td>
                        <td style={{ ...cellStyle, ...gridFlagStyle(displayFlag) }}>
                          {!row.fromChart && !readOnly && !row.description ? (
                            <Dropdown
                              placeholder="Select test…"
                              selectedKey={row.code || null}
                              options={codeList.map((item) => ({ key: item.code, text: item.label + (item.units ? " (" + item.units + ")" : "") }))}
                              onChange={(_event, option) => {
                                const nextCode = option ? String(option.key) : ""
                                const candidate = codeList.find((item) => item.code === nextCode)
                                setCodeDrafts((current) => {
                                  const next = { ...current }
                                  delete next[row.rowId]
                                  return next
                                })
                                updateEntry(row.rowId, {
                                  code: nextCode,
                                  description: candidate?.label ?? "",
                                  units: candidate?.units ?? "",
                                })
                              }}
                              styles={inlineDropdownStyles}
                            />
                          ) : (
                            row.description
                          )}
                        </td>
                        <td style={{ ...cellStyle, ...gridFlagStyle(displayFlag) }}>
                          {!row.fromChart && !readOnly ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <TextField
                                value={gridToText(row.value)}
                                autoFocus={Boolean(row.code)}
                                componentRef={(ref) => { valueFieldRefs.current[gridToText(row.rowId)] = ref }}
                                onChange={(_event, value) => updateEntry(row.rowId, { value: value ?? "" })}
                                styles={inlineTextFieldStyles}
                              />
                              {row.units ? <span>{row.units}</span> : null}
                            </span>
                          ) : pendingCorrection ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span style={{ textDecoration: "line-through", color: "#605e5c", marginRight: 2 }}>
                                {row.value}
                              </span>
                              <TextField
                                value={displayValue}
                                autoFocus
                                onChange={(_event, value) => updateCorrection(row.observationId, value ?? "")}
                                styles={inlineTextFieldStyles}
                              />
                              {row.units ? <span>{row.units}</span> : null}
                            </span>
                          ) : (
                            <span>
                              {row.value}
                              {row.units ? " " + row.units : ""}
                            </span>
                          )}
                        </td>
                        <td style={{ ...cellStyle, textAlign: "center", fontWeight: 700 }}>{displayFlag ?? "-"}</td>
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
