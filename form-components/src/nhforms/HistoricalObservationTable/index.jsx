const { useMemo } = React
const { Stack, Label, Text } = Fluent

const historyDateKey = (value) => {
  const raw = String(value ?? "")
  return raw.includes("T") ? raw.split("T")[0] : raw
}

const getHistorySource = (sd, sourcePath) => {
  if (!sourcePath) return sd?.patient?.observations ?? []
  const steps = String(sourcePath).split(".").filter(Boolean)
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

const HistoricalObservationTable = ({
  title = "Historical Observations",
  sourcePath = "patient.observations",
  datePath = "collectedDateTime",
  columns = [],
  maxRows = 10,
}) => {
  const sd = useSourceData()
  const rows = useMemo(() => {
    const source = getHistorySource(sd, sourcePath)
    const grouped = new Map()
    source.forEach((entry) => {
      const date = historyDateKey(entry?.[datePath])
      if (!date) return
      const current = grouped.get(date) ?? { date }
      columns.forEach((column) => {
        if (column.type === "date") return
        if (column.observationCode && entry?.observationCode === column.observationCode) {
          current[column.id] = entry.value ?? entry.display ?? entry.report ?? ""
        }
      })
      grouped.set(date, current)
    })
    return Array.from(grouped.values()).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, maxRows)
  }, [columns, datePath, maxRows, sd, sourcePath])

  if (rows.length === 0) {
    return (
      <Stack tokens={{ childrenGap: 6 }}>
        <Label>{title}</Label>
        <Text variant="small">No historical observations found.</Text>
      </Stack>
    )
  }

  return (
    <Stack tokens={{ childrenGap: 6 }}>
      <Label>{title}</Label>
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d0d0d0" }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} style={{ border: "1px solid #d0d0d0", textAlign: "left", padding: "6px", background: "#f3f2f1" }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              {columns.map((column) => (
                <td key={column.id} style={{ border: "1px solid #e1dfdd", padding: "6px" }}>
                  {column.type === "date" ? row.date : row[column.id] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Stack>
  )
}
