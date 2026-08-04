const { useMemo, useState } = React
const { Stack, Label, Text, PrimaryButton, Dialog, DialogType, DialogFooter } = Fluent

const flowToText = (value) => {
  if (value === null || value === undefined) return ""
  return String(value)
}

const flowDateKey = (value) => {
  const raw = flowToText(value)
  return raw.includes("T") ? raw.split("T")[0] : raw
}

const flowParseDate = (value) => {
  const raw = flowToText(value).trim()
  if (!raw) return null
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(/[./]/g, "-"))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// Display text for values that may be plain strings or {code, display} objects.
const flowDisplay = (value) => {
  if (value && typeof value === "object") {
    return flowToText(value.display ?? value.text ?? value.code).trim()
  }
  return flowToText(value).trim()
}

// Day-precision timestamp so medication ranges compare cleanly against column dates.
const flowDayTime = (value) => {
  const parsed = flowParseDate(flowDateKey(value))
  return parsed ? parsed.getTime() : null
}

// MOIS renders dates with dot separators (2024.11.21).
const flowDisplayDate = (dateKey) => flowToText(dateKey).replace(/-/g, ".")

const flowGetPath = (sd, path, fallback) => {
  const steps = flowToText(path || fallback).split(".").filter(Boolean)
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

// A row whose code is all dashes is a MOIS-style "----" separator element.
const flowIsSeparatorEntry = (entry) => {
  if (entry && typeof entry === "object" && entry.kind === "separator") return true
  const code = typeof entry === "string" ? entry : flowToText(entry?.code)
  return /^-+$/.test(code.trim())
}

const flowNormalizeRows = (rows) => {
  if (!Array.isArray(rows)) return []
  return rows
    .map((entry) => {
      if (flowIsSeparatorEntry(entry)) {
        return { kind: "separator", label: typeof entry === "object" ? flowToText(entry.label).trim() : "" }
      }
      if (entry && typeof entry === "object" && entry.kind === "medication") {
        const match = flowToText(entry.match).trim()
        if (!match) return null
        return { kind: "medication", match, label: flowToText(entry.label).trim() || match }
      }
      if (typeof entry === "string") {
        const code = entry.trim()
        return code ? { kind: "observation", code, label: code, loincCode: "", units: "" } : null
      }
      if (!entry || typeof entry !== "object") return null
      const code = flowToText(entry.code).trim()
      if (!code) return null
      const label = flowToText(entry.label).trim() || code
      const units = flowToText(entry.units).trim()
      return {
        kind: "observation",
        code,
        label: units ? label + " (" + units + ")" : label,
        loincCode: flowToText(entry.loincCode).trim(),
        units,
      }
    })
    .filter(Boolean)
}

const flowCutoffDate = (lookback) => {
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

const flowMatchesRow = (entry, row) => {
  const entryCode = flowToText(entry?.observationCode).trim().toLowerCase()
  const entryLoinc = flowToText(entry?.loincCode).trim().toLowerCase()
  const code = row.code.toLowerCase()
  const loinc = row.loincCode.toLowerCase()
  if (entryCode && (entryCode === code || (loinc && entryCode === loinc))) return true
  if (entryLoinc && (entryLoinc === code || (loinc && entryLoinc === loinc))) return true
  return false
}

const flowNumber = (value) => {
  const text = flowToText(value).trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

// Four MOIS abnormal bands: critical LL/HH (absurd/very ranges) outrank L/H.
const flowClassifyFlag = (entry, rawValue) => {
  const explicit =
    entry?.abnormalFlag && typeof entry.abnormalFlag === "object"
      ? flowToText(entry.abnormalFlag.code).trim()
      : flowToText(entry?.abnormalFlag).trim()
  if (explicit) return explicit
  const value = flowNumber(rawValue)
  if (value === null) return ""
  const criticalLow = flowNumber(entry?.rangeAbsurdLow) ?? flowNumber(entry?.rangeVeryLow)
  const criticalHigh = flowNumber(entry?.rangeAbsurdHigh) ?? flowNumber(entry?.rangeVeryHigh)
  const normalLow = flowNumber(entry?.rangeNormalLow)
  const normalHigh = flowNumber(entry?.rangeNormalHigh)
  if (criticalLow !== null && value < criticalLow) return "LL"
  if (criticalHigh !== null && value > criticalHigh) return "HH"
  if (normalLow !== null && value < normalLow) return "L"
  if (normalHigh !== null && value > normalHigh) return "H"
  return ""
}

const flowFlagCellStyle = (flag) => {
  if (flag === "LL" || flag === "HH") {
    return { background: "#fde7e9", color: "#a4262c", fontWeight: 600 }
  }
  if (flag === "L" || flag === "H") {
    return { background: "#fff4ce" }
  }
  return {}
}

// Collect matched observations per row and the distinct date columns they land on.
const flowRunQuery = (sd, { sourcePath, datePath, rows, lookback }) => {
  const source = flowGetPath(sd, sourcePath, "patient.observations")
  const cutoff = flowCutoffDate(lookback)
  const observationRows = rows.filter((row) => row.kind === "observation")
  const cellsByRow = observationRows.map(() => new Map())
  const dateKeys = new Set()
  source.forEach((entry) => {
    if (!entry || typeof entry !== "object") return
    const parsedDate = flowParseDate(entry[datePath])
    if (!parsedDate) return
    if (cutoff && parsedDate.getTime() < cutoff.getTime()) return
    observationRows.forEach((row, rowIndex) => {
      if (!flowMatchesRow(entry, row)) return
      const dateKey = flowDateKey(entry[datePath])
      if (!dateKey) return
      const value = flowToText(entry.value ?? entry.display ?? entry.report ?? "")
      const existing = cellsByRow[rowIndex].get(dateKey)
      if (existing && existing.time >= parsedDate.getTime()) return
      cellsByRow[rowIndex].set(dateKey, {
        time: parsedDate.getTime(),
        value,
        flag: flowClassifyFlag(entry, value),
      })
      dateKeys.add(dateKey)
    })
  })
  return { cellsByRow, dateKeys }
}

const flowNormalizeMedications = (source, lookback) => {
  const cutoff = flowCutoffDate(lookback)
  const meds = source
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const name =
        flowDisplay(entry.medication).toUpperCase() || flowDisplay(entry.genericName).toUpperCase()
      const startTime = flowDayTime(entry.startDate)
      const stopRaw = flowToText(entry.endDate ?? entry.stopDate).trim()
      const stopTime = stopRaw ? flowDayTime(stopRaw) : null
      const doseFrequency =
        flowDisplay(entry.doseFrequency) ||
        [flowDisplay(entry.dose), flowDisplay(entry.route), flowDisplay(entry.frequency)]
          .filter(Boolean)
          .join(" ")
      return {
        name,
        genericName: flowDisplay(entry.genericName).toUpperCase(),
        atcCode: flowDisplay(entry.atcCode).toUpperCase(),
        doseFrequency,
        startTime,
        stopTime,
        startKey: flowDateKey(flowToText(entry.startDate)),
        stopKey: stopRaw ? flowDateKey(stopRaw) : "",
      }
    })
    .filter((entry) => entry.name && entry.startTime !== null)
    // A course fully stopped before the lookback window never draws a bar; drop it.
    .filter((entry) => !cutoff || entry.stopTime === null || entry.stopTime >= cutoff.getTime())
  meds.sort((left, right) => left.name.localeCompare(right.name) || left.startTime - right.startTime)
  return meds
}

// A configured medication row matches a course by name/generic substring or ATC prefix.
const flowMedicationMatches = (med, match) => {
  const needle = flowToText(match).trim().toUpperCase()
  if (!needle) return false
  if (med.name.includes(needle) || med.genericName.includes(needle)) return true
  return Boolean(med.atcCode && med.atcCode.startsWith(needle))
}

const flowMedicationRowLabel = (label, med, showDose) =>
  showDose && med?.doseFrequency ? label + " — " + med.doseFrequency : label

const FLOW_CELL_STYLE = {
  border: "1px solid #e1dfdd",
  padding: "2px 6px",
  fontSize: 12,
  lineHeight: "16px",
  whiteSpace: "nowrap",
  textAlign: "center",
  minWidth: 74,
}

const FLOW_LABEL_CELL_STYLE = {
  border: "1px solid #e1dfdd",
  padding: "2px 6px",
  fontSize: 12,
  lineHeight: "16px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 230,
  minWidth: 230,
  position: "sticky",
  left: 0,
  background: "#ffffff",
  zIndex: 1,
}

const FlowMedicationBarCells = ({ med, columns }) =>
  columns.map((dateKey) => {
    const columnTime = flowDayTime(dateKey)
    const active =
      columnTime !== null &&
      med.startTime <= columnTime &&
      (med.stopTime === null || med.stopTime >= columnTime)
    if (!active) return <td key={dateKey} style={FLOW_CELL_STYLE} />
    return (
      <td
        key={dateKey}
        style={{
          ...FLOW_CELL_STYLE,
          background: "#1a5c94",
          color: "#ffffff",
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        ========
      </td>
    )
  })

const FlowSheetGrid = ({
  rows,
  cellsByRow,
  medRowCourses,
  columns,
  medications,
  medicationsLabel,
  showFlags,
  showDose,
  maxHeight,
}) => {
  const headerStyle = {
    border: "1px solid #d0d0d0",
    padding: "3px 6px",
    background: "#c7d9f2",
    fontSize: 12,
    lineHeight: "16px",
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 2,
    textAlign: "center",
  }
  let observationIndex = -1
  return (
    <div style={{ overflow: "auto", maxHeight, border: "1px solid #d0d0d0" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...headerStyle, ...FLOW_LABEL_CELL_STYLE, background: "#c7d9f2", zIndex: 3, textAlign: "left" }}>
              Element / Date
            </th>
            {columns.map((dateKey) => (
              <th key={dateKey} style={headerStyle}>
                {flowDisplayDate(dateKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            if (row.kind === "separator") {
              return (
                <tr key={"separator-" + rowIndex}>
                  <td style={{ ...FLOW_LABEL_CELL_STYLE, color: "#605e5c" }}>{row.label || "----"}</td>
                  {columns.map((dateKey) => (
                    <td key={dateKey} style={FLOW_CELL_STYLE} />
                  ))}
                </tr>
              )
            }
            if (row.kind === "medication") {
              const courses = medRowCourses[rowIndex] ?? []
              if (courses.length === 0) {
                // Keep the configured row visible as a recall cue even when the
                // chart carries no matching course.
                return (
                  <tr key={"medication-row-" + rowIndex}>
                    <td style={FLOW_LABEL_CELL_STYLE} title={row.label + " — no matching chart medication"}>
                      {row.label}
                    </td>
                    {columns.map((dateKey) => (
                      <td key={dateKey} style={FLOW_CELL_STYLE} />
                    ))}
                  </tr>
                )
              }
              // MOIS parity: every matched course keeps its own row of bars.
              return (
                <React.Fragment key={"medication-row-" + rowIndex}>
                  {courses.map((med, courseIndex) => (
                    <tr key={"medication-row-" + rowIndex + "-" + courseIndex}>
                      <td
                        style={FLOW_LABEL_CELL_STYLE}
                        title={med.name + (med.doseFrequency ? " — " + med.doseFrequency : "")}
                      >
                        {flowMedicationRowLabel(row.label, med, showDose)}
                      </td>
                      <FlowMedicationBarCells med={med} columns={columns} />
                    </tr>
                  ))}
                </React.Fragment>
              )
            }
            observationIndex += 1
            const cells = cellsByRow[observationIndex]
            return (
              <tr key={"observation-" + rowIndex}>
                <td style={FLOW_LABEL_CELL_STYLE} title={row.label}>
                  {row.label}
                </td>
                {columns.map((dateKey) => {
                  const cell = cells.get(dateKey)
                  const cellStyle = { ...FLOW_CELL_STYLE, ...(cell && showFlags ? flowFlagCellStyle(cell.flag) : {}) }
                  return (
                    <td key={dateKey} style={cellStyle}>
                      {cell ? cell.value + (showFlags && cell.flag ? " " + cell.flag : "") : ""}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {medications.length > 0 ? (
            <tr>
              <td style={{ ...FLOW_LABEL_CELL_STYLE, fontWeight: 600, paddingTop: 8 }}>{medicationsLabel}</td>
              {columns.map((dateKey) => (
                <td key={dateKey} style={FLOW_CELL_STYLE} />
              ))}
            </tr>
          ) : null}
          {medications.map((med, medIndex) => (
            <tr key={"medication-" + medIndex}>
              <td style={FLOW_LABEL_CELL_STYLE} title={med.name + (med.doseFrequency ? " — " + med.doseFrequency : "")}>
                {flowMedicationRowLabel(med.name, med, showDose)}
              </td>
              <FlowMedicationBarCells med={med} columns={columns} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const FlowSheet = ({
  title = "Flow Sheet",
  rows = [],
  showMedications = true,
  medicationsMode = "",
  showMedicationDose = false,
  medicationsLabel = "LONG TERM MEDICATIONS",
  medicationPath = "patient.longTermMedications",
  sourcePath = "patient.observations",
  datePath = "collectedDateTime",
  lookback = null,
  maxColumns = 13,
  showFlags = true,
  openInModal = false,
  modalButtonText = "Open Flow Sheet",
  modalTitle = "",
  modalMinWidth = 980,
}) => {
  const sd = useSourceData()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const rowList = useMemo(() => flowNormalizeRows(rows), [rows])

  // Modes: "all" appends every chart course below the elements (matched placed
  // rows are not repeated), "selected" shows only placed medication rows,
  // "none" hides medications entirely. Legacy boolean maps onto all/none.
  const resolvedMedicationsMode =
    medicationsMode === "all" || medicationsMode === "selected" || medicationsMode === "none"
      ? medicationsMode
      : showMedications === false
        ? "none"
        : "all"

  const { cellsByRow, dateKeys } = useMemo(
    () => flowRunQuery(sd, { sourcePath, datePath, rows: rowList, lookback }),
    [datePath, lookback, rowList, sd, sourcePath]
  )

  const allMedications = useMemo(() => {
    if (resolvedMedicationsMode === "none") return []
    return flowNormalizeMedications(flowGetPath(sd, medicationPath, "patient.longTermMedications"), lookback)
  }, [lookback, medicationPath, resolvedMedicationsMode, sd])

  // Expand each placed medication row into its matching chart courses, and
  // collect what the bottom "all others" section still needs to show.
  const { medRowCourses, medications } = useMemo(() => {
    const courses = {}
    const matched = new Set()
    rowList.forEach((row, rowIndex) => {
      if (row.kind !== "medication") return
      const matches = resolvedMedicationsMode === "none"
        ? []
        : allMedications.filter((med) => flowMedicationMatches(med, row.match))
      courses[rowIndex] = matches
      matches.forEach((med) => matched.add(med))
    })
    const remaining =
      resolvedMedicationsMode === "all"
        ? allMedications.filter((med) => !matched.has(med))
        : []
    return { medRowCourses: courses, medications: remaining }
  }, [allMedications, resolvedMedicationsMode, rowList])

  // Keep the most recent N dates but display oldest -> newest like MOIS. A
  // medications-only sheet has no observation dates, so fall back to the
  // course start/stop dates as the column axis.
  const columns = useMemo(() => {
    const limit = Math.max(1, Math.floor(Number(maxColumns)) || 13)
    let keys = Array.from(dateKeys)
    if (keys.length === 0) {
      const medKeys = new Set()
      allMedications.forEach((med) => {
        if (med.startKey) medKeys.add(med.startKey)
        if (med.stopKey) medKeys.add(med.stopKey)
      })
      keys = Array.from(medKeys)
    }
    return keys.sort().slice(-limit)
  }, [allMedications, dateKeys, maxColumns])

  const hasObservationRows = rowList.some((row) => row.kind === "observation" || row.kind === "medication")
  if (!hasObservationRows && medications.length === 0) {
    return (
      <Stack tokens={{ childrenGap: 6 }}>
        <Label>{title}</Label>
        <Text variant="small">No flow sheet rows configured yet.</Text>
      </Stack>
    )
  }

  const rangeLabel =
    columns.length > 0
      ? "DATE RANGE: " + flowDisplayDate(columns[0]) + " TO " + flowDisplayDate(columns[columns.length - 1])
      : ""

  const renderSheet = (maxHeight) => {
    if (columns.length === 0) {
      return <Text variant="small">No chart observations matched this flow sheet.</Text>
    }
    return (
      <FlowSheetGrid
        rows={rowList}
        cellsByRow={cellsByRow}
        medRowCourses={medRowCourses}
        columns={columns}
        medications={medications}
        medicationsLabel={medicationsLabel}
        showFlags={showFlags !== false}
        showDose={showMedicationDose === true}
        maxHeight={maxHeight}
      />
    )
  }

  const header = (
    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
      <Label>{title}</Label>
      {rangeLabel ? <Text variant="small" style={{ color: "#605e5c" }}>{rangeLabel}</Text> : null}
    </Stack>
  )

  if (openInModal) {
    const resolvedMinWidth = Math.max(480, Number(modalMinWidth) || 980)
    return (
      <Stack tokens={{ childrenGap: 6 }}>
        {header}
        <Stack horizontal>
          <PrimaryButton text={modalButtonText || "Open Flow Sheet"} onClick={() => setIsModalOpen(true)} />
        </Stack>
        <Dialog
          hidden={!isModalOpen}
          onDismiss={() => setIsModalOpen(false)}
          dialogContentProps={{
            type: DialogType.largeHeader,
            title: modalTitle || title || "Flow Sheet",
          }}
          minWidth={Math.min(resolvedMinWidth, typeof window !== "undefined" ? window.innerWidth - 48 : resolvedMinWidth)}
          maxWidth="96vw"
          modalProps={{ isBlocking: false }}
        >
          <Stack tokens={{ childrenGap: 6 }}>
            {rangeLabel ? <Text variant="small" style={{ color: "#605e5c" }}>{rangeLabel}</Text> : null}
            {renderSheet("70vh")}
          </Stack>
          <DialogFooter>
            <PrimaryButton text="Done" onClick={() => setIsModalOpen(false)} />
          </DialogFooter>
        </Dialog>
      </Stack>
    )
  }

  return (
    <Stack tokens={{ childrenGap: 6 }}>
      {header}
      {renderSheet(420)}
    </Stack>
  )
}
