const { useMemo, useCallback, useEffect } = React

const numberOrBlank = (value) => {
  if (value == null || value === "") return ""
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : ""
}

const getFieldValue = (fd, fieldId, fallback = "") => {
  const value = fd?.field?.data?.[fieldId] ?? fd?.formData?.[fieldId]
  return value == null ? fallback : value
}

function AssessmentScoringTable({
  id = "legacyAssessmentTable",
  title = "Assessment",
  encounterDate = "2026-04-28",
  enteredBy = "DR. PREVIEW USER",
  rows = [],
  totalFieldId = "totalScore",
  totalLabel = "Total Score",
  min = 1,
  max = 5,
  step = 1,
}) {
  const [fd, setFd] = useActiveData()

  const scoreRows = useMemo(() => {
    if (Array.isArray(rows) && rows.length > 0) return rows
    return []
  }, [rows])

  const total = useMemo(() => {
    let hasValue = false
    const sum = scoreRows.reduce((nextTotal, row) => {
      const raw = getFieldValue(fd, row.fieldId)
      if (raw == null || raw === "") return nextTotal
      const value = Number(raw)
      if (!Number.isFinite(value)) return nextTotal
      hasValue = true
      return nextTotal + value
    }, 0)
    return hasValue ? sum : ""
  }, [fd, scoreRows])

  useEffect(() => {
    setFd((draft) => {
      draft.field = draft.field || { data: {}, status: {} }
      draft.field.data = draft.field.data || {}
      draft.formData = draft.formData || {}
      draft.field.data[totalFieldId] = total
      draft.formData[totalFieldId] = total
    })
  }, [setFd, total, totalFieldId])

  const setScore = useCallback((fieldId, value) => {
    setFd((draft) => {
      draft.field = draft.field || { data: {}, status: {} }
      draft.field.data = draft.field.data || {}
      draft.formData = draft.formData || {}
      draft.field.data[fieldId] = value
      draft.formData[fieldId] = value
    })
  }, [setFd])

  const tableStyle = {
    borderCollapse: "collapse",
    border: "1px solid darkgrey",
    width: "auto",
    maxWidth: "100%",
  }
  const labelCellStyle = {
    maxWidth: 200,
    minHeight: 20,
    display: "flex",
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    fontSize: "1.2em",
    whiteSpace: "normal",
    textAlign: "center",
    borderCollapse: "collapse",
    borderRight: "1px solid darkgrey",
  }
  const valueCellStyle = {
    maxWidth: 150,
    minWidth: 120,
    minHeight: 20,
    justifyContent: "center",
    alignItems: "center",
    fontSize: "1.2em",
    whiteSpace: "normal",
    textAlign: "center",
    borderCollapse: "collapse",
    borderRight: "2px solid black",
    padding: "8px 10px",
  }
  const inputStyle = {
    fontSize: "inherit",
    textAlign: "center",
    width: 52,
    border: "none",
    background: "#ffffff",
  }

  const renderRow = (row, index, valueContent) => (
    <tr key={row.id || row.fieldId || row.label} style={index % 2 === 0 ? { backgroundColor: "whitesmoke" } : undefined}>
      <td style={labelCellStyle}>{row.label}</td>
      <td style={valueCellStyle}>{valueContent}</td>
    </tr>
  )

  return (
    <div data-field-id={id} data-component="AssessmentScoringTable" style={{ width: "100%" }}>
      <div style={{ width: "100%" }}>
        <div className="ms-Stack" style={{ backgroundColor: "rgb(237, 235, 233)", padding: "2px 5px" }}>
          <Label>{title}</Label>
        </div>
      </div>
      <table style={tableStyle}>
        <tbody>
          {renderRow({ label: "Encounter Date", id: "encounterDate" }, 0, <span style={{ fontSize: "inherit", textAlign: "center" }}>{encounterDate}</span>)}
          {scoreRows.map((row, index) =>
            renderRow(
              row,
              index + 1,
              <input
                id={row.fieldId}
                min={row.min ?? min}
                max={row.max ?? max}
                step={row.step ?? step}
                required={row.required ?? true}
                type="number"
                value={numberOrBlank(getFieldValue(fd, row.fieldId))}
                style={inputStyle}
                onChange={(event) => setScore(row.fieldId, event.target.value)}
              />
            )
          )}
          {renderRow({ label: totalLabel, id: totalFieldId }, scoreRows.length + 1, <span id={totalFieldId}>{numberOrBlank(total)}</span>)}
          {renderRow({ label: "Entered By", id: "enteredBy" }, scoreRows.length + 2, enteredBy)}
        </tbody>
      </table>
    </div>
  )
}
