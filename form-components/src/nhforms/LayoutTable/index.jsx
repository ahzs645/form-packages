const normalizeLayoutTableOptionList = (optionList) => {
  if (!Array.isArray(optionList)) return []
  return optionList
    .map((option) => {
      if (typeof option === "string") return { code: option, display: option }
      if (!option || typeof option !== "object") return null
      const code = option.code ?? option.key ?? option.value ?? option.display ?? option.text ?? option.label
      const display = option.display ?? option.text ?? option.label ?? option.code ?? option.key ?? option.value
      return code || display ? { code: String(code ?? display), display: String(display ?? code) } : null
    })
    .filter(Boolean)
}

const isCheckedValue = (value) => value === true || value === "true" || value === "Y" || value === "yes" || value === 1

const renderLayoutTableField = (cell, readOnly, data, setFieldValue) => {
  const fieldId = cell.fieldId || cell.id
  const label = cell.label || ""
  const labelProp = label ? { label } : {}
  const sharedProps = { fieldId, labelPosition: label ? "top" : "none", readOnly }
  const optionList = normalizeLayoutTableOptionList(cell.optionList ?? cell.options)

  switch (cell.inputType) {
    case "booleanSingle":
      return (
        <Checkbox
          name={cell.name || fieldId}
          label={label}
          ariaLabel={label || fieldId}
          checked={isCheckedValue(data?.[fieldId])}
          disabled={readOnly}
          onChange={(_, checked) => setFieldValue(fieldId, Boolean(checked))}
        />
      )
    case "number":
      return <Numeric {...sharedProps} {...labelProp} />
    case "date":
      return <DateSelect {...sharedProps} {...labelProp} />
    case "time":
      return <TimeSelect {...sharedProps} {...labelProp} />
    case "booleanYesNo":
      return <SimpleCodeSelect {...sharedProps} {...labelProp} codeSystem="MOIS-YESNO" />
    case "choice":
      return optionList.length > 0
        ? <SimpleCodeSelect {...sharedProps} {...labelProp} optionList={optionList} />
        : <SimpleCodeSelect {...sharedProps} {...labelProp} codeSystem={cell.codeSystem} />
    case "textarea":
      return <TextArea {...sharedProps} {...labelProp} multiline textFieldProps={{ autoAdjustHeight: true, resizable: false }} />
    case "text":
    default:
      return <TextArea {...sharedProps} {...labelProp} />
  }
}

const renderLayoutTableFieldList = (cell, readOnly, data, setFieldValue) => {
  const fields = Array.isArray(cell.fields) ? cell.fields : []
  if (fields.length === 0) return null

  return (
    <div style={{ display: "flex", flexFlow: "wrap", justifyContent: cell.justifyContent || "space-between", gap: cell.gap || undefined }}>
      {fields.map((field, index) => (
        <div key={field.id || field.fieldId || index}>
          {renderLayoutTableField({ ...field, id: field.id || field.fieldId }, readOnly, data, setFieldValue)}
        </div>
      ))}
    </div>
  )
}

const renderLayoutTableResources = (cell) => {
  const resources = Array.isArray(cell.resources) ? cell.resources.filter((resource) => resource?.url && resource?.label) : []
  if (resources.length === 0) return cell.text || ""

  const renderLink = (resource, index) => (
    <a key={`${resource.url}-${index}`} href={resource.url} target="_blank" rel="noreferrer">
      {resource.label}
    </a>
  )

  if (resources.length === 1 && cell.resourceListStyle !== "disc") {
    return <span>{renderLink(resources[0], 0)}</span>
  }

  return (
    <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: cell.resourceListStyle === "none" ? 0 : undefined, listStyleType: cell.resourceListStyle || "disc" }}>
      {resources.map((resource, index) => (
        <li key={`${resource.url}-${index}`}>{renderLink(resource, index)}</li>
      ))}
    </ul>
  )
}

const renderLayoutTableCellContent = (cell, readOnly, data, setFieldValue) => {
  if (cell.kind === "field") return renderLayoutTableField(cell, readOnly, data, setFieldValue)
  if (cell.kind === "fieldList") return renderLayoutTableFieldList(cell, readOnly, data, setFieldValue)
  if (cell.kind === "resources") return renderLayoutTableResources(cell)
  return cell.text || ""
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

const normalizeComparableValue = (value) => {
  if (value && typeof value === "object") {
    return value.value ?? value.code ?? value.key ?? value.text ?? value.display ?? value.label ?? ""
  }

  return value
}

const isYesLikeValue = (value) => {
  const normalized = normalizeComparableValue(value)
  if (value === true || normalized === true || value === 1 || normalized === 1) return true

  return ["y", "yes", "true", "1"].includes(String(normalized ?? "").trim().toLowerCase())
}

const isNoLikeValue = (value) => {
  const normalized = normalizeComparableValue(value)
  if (value === false || normalized === false || value === 0 || normalized === 0) return true

  return ["n", "no", "false", "0"].includes(String(normalized ?? "").trim().toLowerCase())
}

const rowIsVisible = (row, data) => {
  const rule = row?.visibleWhen
  if (!rule?.fieldId) return true

  const value = data?.[rule.fieldId]
  const comparableValue = normalizeComparableValue(value)

  switch (rule.operator || "truthy") {
    case "yes":
      return isYesLikeValue(value)
    case "equals":
      return comparableValue === rule.value
    case "notEquals":
      return comparableValue !== rule.value
    case "truthy":
    default:
      return Boolean(comparableValue) && !isNoLikeValue(value)
  }
}

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
  const [fd, setFd] = useActiveData()
  const config = { bordered, compact, fullWidth, cellPadding, borderColor, pageBreakInsideAvoid }
  const tableRows = Array.isArray(rows) ? rows : []
  const activeData = fd?.field?.data || fd?.formData || {}
  const visibleRows = tableRows.filter((row) => rowIsVisible(row, activeData))
  const setFieldValue = (fieldId, value) => {
    if (typeof setFd !== "function") return
    setFd((draft) => {
      draft.field = draft.field || { data: {}, status: {} }
      draft.field.data = draft.field.data || {}
      draft.formData = draft.formData || {}
      draft.field.data[fieldId] = value
      draft.formData[fieldId] = value
    })
  }

  if (visibleRows.length === 0) return null

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
          {visibleRows.map((row, rowIndex) => (
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
                    {renderLayoutTableCellContent(cell, readOnly, activeData, setFieldValue)}
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
