const { useMemo } = React
const { Stack, Label, Text } = Fluent

// Date/path/code-matching/abnormal-flag primitives live in the shared
// ObservationKit helper module (declared in Identity.json). ObservationKit is
// referenced only inside function bodies because component files load in no
// guaranteed order.

// Executes the declarative query: match codes, apply the lookback cutoff, and
// return matches tagged with their code index, parsed date, and abnormal flag.
const runObservationQuery = (sd, { sourcePath, datePath, codeList, lookback }) => {
  const source = ObservationKit.getPath(sd, sourcePath)
  const cutoff = ObservationKit.cutoffDate(lookback)
  const matches = []
  source.forEach((entry) => {
    if (!entry || typeof entry !== "object") return
    const codeIndex = ObservationKit.matchCodeIndex(entry, codeList)
    if (codeIndex < 0) return
    const parsedDate = ObservationKit.parseDate(entry[datePath])
    if (!parsedDate) return
    if (cutoff && parsedDate.getTime() < cutoff.getTime()) return
    const value = ObservationKit.extractValue(entry)
    matches.push({
      codeIndex,
      dateKey: ObservationKit.dateKey(entry[datePath]),
      time: parsedDate.getTime(),
      value,
      units: ObservationKit.toText(entry.units).trim() || codeList[codeIndex].units,
      flag: ObservationKit.classifyFlag(entry, value),
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
              const cellStyle = { border: "1px solid #e1dfdd", padding: "2px 6px", fontSize: 12, lineHeight: "16px", ...(cell ? ObservationKit.flagCellStyle(cell.flag) : {}) }
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
              <td style={{ padding: "3px 6px", fontWeight: 600, ...ObservationKit.flagCellStyle(latest.flag) }}>
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
  const codeList = useMemo(() => ObservationKit.normalizeCodes(codes), [codes])
  const matches = useMemo(
    () => runObservationQuery(sd, { sourcePath, datePath, codeList, lookback }),
    [codeList, datePath, lookback, sd, sourcePath]
  )
  const windowLabel = ObservationKit.lookbackLabel(lookback)
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
        .filter((match) => ObservationKit.toNumber(match.value) !== null || /^\d/.test(match.value))
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
