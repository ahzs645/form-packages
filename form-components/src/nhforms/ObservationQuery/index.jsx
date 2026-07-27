const { useMemo } = React
const { Stack, Label, Text } = Fluent

const queryToText = (value) => {
  if (value === null || value === undefined) return ""
  return String(value)
}

const queryDateKey = (value) => {
  const raw = queryToText(value)
  return raw.includes("T") ? raw.split("T")[0] : raw
}

const queryParseDate = (value) => {
  const raw = queryToText(value).trim()
  if (!raw) return null
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(/\./g, "-"))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getQuerySource = (sd, sourcePath) => {
  if (!sourcePath) return sd?.patient?.observations ?? []
  const steps = queryToText(sourcePath).split(".").filter(Boolean)
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

const normalizeQueryCodes = (codes) => {
  if (!Array.isArray(codes)) return []
  return codes
    .map((entry) => {
      if (typeof entry === "string") {
        const code = entry.trim()
        return code ? { code, label: code, loincCode: "", units: "" } : null
      }
      if (!entry || typeof entry !== "object") return null
      const code = queryToText(entry.code).trim()
      if (!code) return null
      return {
        code,
        label: queryToText(entry.label).trim() || code,
        loincCode: queryToText(entry.loincCode).trim(),
        units: queryToText(entry.units).trim(),
      }
    })
    .filter(Boolean)
}

// Cutoff for a {amount, unit} lookback window, anchored at "now". Returns null
// when the window is unset or invalid so callers fall back to full history.
const queryCutoffDate = (lookback) => {
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

const queryLookbackLabel = (lookback) => {
  const amount = Math.floor(Number(lookback?.amount))
  if (!Number.isFinite(amount) || amount <= 0) return ""
  const unit = lookback.unit === "days" || lookback.unit === "months" || lookback.unit === "years" ? lookback.unit : null
  if (!unit) return ""
  const singular = { days: "day", months: "month", years: "year" }[unit]
  return "Last " + amount + " " + (amount === 1 ? singular : unit)
}

const matchQueryCodeIndex = (entry, codeList) => {
  const entryCode = queryToText(entry?.observationCode).trim().toLowerCase()
  const entryLoinc = queryToText(entry?.loincCode).trim().toLowerCase()
  for (let index = 0; index < codeList.length; index += 1) {
    const candidate = codeList[index]
    const code = candidate.code.toLowerCase()
    const loinc = candidate.loincCode.toLowerCase()
    if (entryCode && (entryCode === code || (loinc && entryCode === loinc))) return index
    if (entryLoinc && (entryLoinc === code || (loinc && entryLoinc === loinc))) return index
  }
  return -1
}

const queryNumber = (value) => {
  const text = queryToText(value).trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

// Four MOIS abnormal bands: critical LL/HH (absurd/very ranges) outrank L/H
// (normal range) — mirrors the PastMeasurementField save-path classification.
const classifyQueryFlag = (entry, rawValue) => {
  const explicit =
    entry?.abnormalFlag && typeof entry.abnormalFlag === "object"
      ? queryToText(entry.abnormalFlag.code).trim()
      : queryToText(entry?.abnormalFlag).trim()
  if (explicit) return explicit
  const value = queryNumber(rawValue)
  if (value === null) return ""
  const criticalLow = queryNumber(entry?.rangeAbsurdLow) ?? queryNumber(entry?.rangeVeryLow)
  const criticalHigh = queryNumber(entry?.rangeAbsurdHigh) ?? queryNumber(entry?.rangeVeryHigh)
  const normalLow = queryNumber(entry?.rangeNormalLow)
  const normalHigh = queryNumber(entry?.rangeNormalHigh)
  if (criticalLow !== null && value < criticalLow) return "LL"
  if (criticalHigh !== null && value > criticalHigh) return "HH"
  if (normalLow !== null && value < normalLow) return "L"
  if (normalHigh !== null && value > normalHigh) return "H"
  return ""
}

const queryFlagCellStyle = (flag) => {
  if (flag === "LL" || flag === "HH") {
    return { background: "#fde7e9", color: "#a4262c", fontWeight: 600 }
  }
  if (flag === "L" || flag === "H") {
    return { background: "#fff4ce" }
  }
  return {}
}

// Executes the declarative query: match codes, apply the lookback cutoff, and
// return matches tagged with their code index, parsed date, and abnormal flag.
const runObservationQuery = (sd, { sourcePath, datePath, codeList, lookback }) => {
  const source = getQuerySource(sd, sourcePath)
  const cutoff = queryCutoffDate(lookback)
  const matches = []
  source.forEach((entry) => {
    if (!entry || typeof entry !== "object") return
    const codeIndex = matchQueryCodeIndex(entry, codeList)
    if (codeIndex < 0) return
    const parsedDate = queryParseDate(entry[datePath])
    if (!parsedDate) return
    if (cutoff && parsedDate.getTime() < cutoff.getTime()) return
    const value = entry.value ?? entry.display ?? entry.report ?? ""
    matches.push({
      codeIndex,
      dateKey: queryDateKey(entry[datePath]),
      time: parsedDate.getTime(),
      value: queryToText(value),
      units: queryToText(entry.units).trim() || codeList[codeIndex].units,
      flag: classifyQueryFlag(entry, value),
    })
  })
  return matches
}

const ObservationQueryTable = ({ codeList, matches, maxRows, sort }) => {
  const grouped = new Map()
  matches.forEach((match) => {
    if (!match.dateKey) return
    const row = grouped.get(match.dateKey) ?? { date: match.dateKey, cells: {} }
    const existing = row.cells[match.codeIndex]
    if (!existing || match.time >= existing.time) {
      row.cells[match.codeIndex] = match
    }
    grouped.set(match.dateKey, row)
  })
  // Always keep the most recent N dates; `sort` only controls display order.
  const recentFirst = Array.from(grouped.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const limited = recentFirst.slice(0, Math.max(1, maxRows))
  const rows = sort === "oldest" ? limited.slice().reverse() : limited

  if (rows.length === 0) {
    return <Text variant="small">No observations found for this query.</Text>
  }

  const headerStyle = { border: "1px solid #d0d0d0", textAlign: "left", padding: "3px 6px", background: "#f3f2f1", fontSize: 12, lineHeight: "16px" }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d0d0d0" }}>
      <thead>
        <tr>
          <th style={headerStyle}>Date</th>
          {codeList.map((code, index) => (
            <th key={index} style={headerStyle}>{code.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.date}>
            <td style={{ border: "1px solid #e1dfdd", padding: "2px 6px", fontSize: 12, lineHeight: "16px", whiteSpace: "nowrap" }}>{row.date}</td>
            {codeList.map((code, index) => {
              const cell = row.cells[index]
              const cellStyle = { border: "1px solid #e1dfdd", padding: "2px 6px", fontSize: 12, lineHeight: "16px", ...(cell ? queryFlagCellStyle(cell.flag) : {}) }
              return (
                <td key={index} style={cellStyle}>
                  {cell ? (
                    <span>
                      {cell.value}
                      {cell.units ? " " + cell.units : ""}
                      {cell.flag ? <span style={{ marginLeft: 8, fontWeight: 700 }}>{cell.flag}</span> : null}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const ObservationQueryLatest = ({ codeList, matches }) => {
  const latestByCode = new Map()
  matches.forEach((match) => {
    const existing = latestByCode.get(match.codeIndex)
    if (!existing || match.time > existing.time) {
      latestByCode.set(match.codeIndex, match)
    }
  })
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {codeList.map((code, index) => {
          const latest = latestByCode.get(index)
          if (!latest) {
            return (
              <tr key={index}>
                <td style={{ padding: "3px 6px", color: "#a4262c", fontWeight: 600 }} colSpan={3}>
                  {code.label} Not Found
                </td>
              </tr>
            )
          }
          return (
            <tr key={index}>
              <td style={{ padding: "3px 6px", color: "#004578" }}>{code.label}</td>
              <td style={{ padding: "3px 6px", whiteSpace: "nowrap" }}>{latest.dateKey}</td>
              <td style={{ padding: "3px 6px", fontWeight: 600, ...queryFlagCellStyle(latest.flag) }}>
                {latest.value}
                {latest.units ? " " + latest.units : ""}
                {latest.flag ? <span style={{ marginLeft: 8 }}>{latest.flag}</span> : null}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const ObservationQuery = ({
  title = "Observation Query",
  display = "table",
  codes = [],
  lookback = null,
  maxRows = 10,
  sort = "newest",
  sourcePath = "patient.observations",
  datePath = "collectedDateTime",
  chartHeight = 240,
}) => {
  const sd = useSourceData()
  const codeList = useMemo(() => normalizeQueryCodes(codes), [codes])
  const matches = useMemo(
    () => runObservationQuery(sd, { sourcePath, datePath, codeList, lookback }),
    [codeList, datePath, lookback, sd, sourcePath]
  )
  const windowLabel = queryLookbackLabel(lookback)
  const effectiveMaxRows = Math.max(1, Math.floor(Number(maxRows)) || 10)

  if (codeList.length === 0) {
    return (
      <Stack tokens={{ childrenGap: 6 }}>
        <Label>{title}</Label>
        <Text variant="small">No observations selected for this query yet.</Text>
      </Stack>
    )
  }

  let body = null
  if (display === "latest") {
    body = <ObservationQueryLatest codeList={codeList} matches={matches} />
  } else if (display === "chart") {
    if (typeof ObservationChart === "function") {
      const chartRows = matches
        .filter((match) => queryNumber(match.value) !== null || /^\d/.test(match.value))
        .map((match) => ({
          date: new Date(match.time).toISOString(),
          ["c" + match.codeIndex]: match.value,
          units: match.units,
        }))
      const series = codeList.map((code, index) => ({
        label: code.label,
        dataKey: "c" + index,
        parser: "number",
      }))
      body = (
        <ObservationChart
          data={chartRows}
          series={series}
          maxPoints={effectiveMaxRows}
          height={chartHeight}
          showLegend
        />
      )
    } else {
      body = <Text variant="small">Chart display requires the ObservationChart component.</Text>
    }
  } else {
    body = <ObservationQueryTable codeList={codeList} matches={matches} maxRows={effectiveMaxRows} sort={sort} />
  }

  return (
    <Stack tokens={{ childrenGap: 6 }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Label>{title}</Label>
        {windowLabel ? <Text variant="small" style={{ color: "#605e5c" }}>{windowLabel}</Text> : null}
      </Stack>
      {body}
    </Stack>
  )
}
