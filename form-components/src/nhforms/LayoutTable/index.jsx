const renderLayoutTableField = (cell, readOnly) => {
  const fieldId = cell.fieldId || cell.id
  const label = cell.label || ""
  const labelProp = label ? { label } : {}
  const sharedProps = { fieldId, labelPosition: label ? "top" : "none", readOnly }

  switch (cell.inputType) {
    case "number":
      return <Numeric {...sharedProps} {...labelProp} />
    case "date":
      return <DateSelect {...sharedProps} {...labelProp} />
    case "time":
      return <TimeSelect {...sharedProps} {...labelProp} />
    case "booleanYesNo":
      return <SimpleCodeSelect {...sharedProps} {...labelProp} codeSystem="MOIS-YESNO" />
    case "textarea":
      return <TextArea {...sharedProps} {...labelProp} multiline textFieldProps={{ autoAdjustHeight: true, resizable: false }} />
    case "text":
    default:
      return <TextArea {...sharedProps} {...labelProp} />
  }
}

const cellStyle = (cell, config) => ({
  border: config.bordered === false ? undefined : `1px solid ${config.borderColor || "#000"}`,
  padding: `${Number(config.cellPadding ?? (config.compact ? 3 : 6)) || 0}px`,
  verticalAlign: cell.verticalAlign || "top",
  textAlign: cell.align || "left",
  width: cell.width || undefined,
  backgroundColor: cell.backgroundColor || undefined,
  fontWeight: cell.header ? 700 : undefined,
  pageBreakInside: config.pageBreakInsideAvoid === false ? undefined : "avoid",
  whiteSpace: cell.kind === "text" ? "pre-wrap" : undefined,
})

function LayoutTable({
  id,
  label,
  rows = [],
  bordered = true,
  compact = false,
  fullWidth = true,
  cellPadding,
  borderColor = "#000",
  pageBreakInsideAvoid = true,
  readOnly = false,
}) {
  const config = { bordered, compact, fullWidth, cellPadding, borderColor, pageBreakInsideAvoid }
  const tableRows = Array.isArray(rows) ? rows : []

  if (tableRows.length === 0) return null

  return (
    <div id={id} data-layout-table style={{ width: fullWidth ? "100%" : undefined, pageBreakInside: pageBreakInsideAvoid ? "avoid" : undefined }}>
      {label ? <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div> : null}
      <table
        style={{
          width: fullWidth ? "100%" : undefined,
          borderCollapse: "collapse",
          pageBreakInside: pageBreakInsideAvoid ? "avoid" : undefined,
        }}
      >
        <tbody>
          {tableRows.map((row, rowIndex) => (
            <tr key={row.id || rowIndex} style={{ pageBreakInside: pageBreakInsideAvoid ? "avoid" : undefined }}>
              {(Array.isArray(row.cells) ? row.cells : []).map((cell, cellIndex) => {
                const Tag = cell.header ? "th" : "td"
                return (
                  <Tag
                    key={cell.id || cellIndex}
                    colSpan={Math.max(1, Number(cell.colSpan) || 1)}
                    rowSpan={Math.max(1, Number(cell.rowSpan) || 1)}
                    style={cellStyle(cell, config)}
                  >
                    {cell.kind === "field" ? renderLayoutTableField(cell, readOnly) : (cell.text || "")}
                  </Tag>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

