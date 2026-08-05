// Legacy date-grouped history table, now a thin preset over ObservationQuery's
// table display. Kept for saved forms and the history-table preset library
// (data/history-table-library), which keep configuring it by columns.
//
// Column config maps onto query codes: the "date" column is implicit
// (ObservationQuery always leads with the date), every other column with an
// observationCode becomes a picked code. Matching gains ObservationQuery's
// case-insensitive code/LOINC comparison, and cells gain units + abnormal
// flags — both strict upgrades over the old exact-code, value-only table.
const HistoricalObservationTable = ({
  title = "Historical Observations",
  sourcePath = "patient.observations",
  datePath = "collectedDateTime",
  columns = [],
  maxRows = 10,
}) => {
  const codes = (Array.isArray(columns) ? columns : [])
    .filter((column) => column && typeof column === "object" && column.type !== "date" && column.observationCode)
    .map((column) => ({
      code: String(column.observationCode),
      label: String(column.label ?? column.observationCode),
    }))

  return (
    <ObservationQuery
      title={title}
      display="table"
      codes={codes}
      maxRows={maxRows}
      sort="newest"
      sourcePath={sourcePath}
      datePath={datePath}
    />
  )
}
