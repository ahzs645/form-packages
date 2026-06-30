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

const getPathValue = (root, path) => {
  if (!root || !path) return undefined
  return String(path)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), root)
}

const getCellDisplayValue = (cell, data, sourceData) => {
  const sourceValue = cell.sourcePath
    ? getPathValue({ fd: data?.__fd, field: data, formData: data?.__fd?.formData, sd: sourceData, sourceData, webform: sourceData?.webform, patient: sourceData?.patient, userProfile: sourceData?.userProfile }, cell.sourcePath)
    : undefined
  const value = sourceValue ?? cell.defaultValue ?? cell.text ?? ""
  if (value == null) return ""
  if (typeof value === "object") {
    return value.display ?? value.text ?? value.value ?? value.code ?? ""
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.split("T")[0]
  }
  return String(value)
}

const getNumericFieldValue = (data, fieldId) => {
  const raw = data?.[fieldId]
  if (raw == null || raw === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const getLayoutTableFieldRawValue = (cell, data) => {
  const fieldId = cell.fieldId || cell.id
  return data?.[fieldId] ?? cell.defaultValue ?? ""
}

const formatLayoutTableFieldDisplayValue = (cell, data) => {
  const value = getLayoutTableFieldRawValue(cell, data)
  if (value == null || value === "") return ""

  if (cell.inputType === "booleanSingle" || cell.inputType === "booleanYesNo") {
    return isCheckedValue(value) ? "Yes" : "No"
  }

  const optionList = normalizeLayoutTableOptionList(cell.optionList ?? cell.options)
  const formatOne = (candidate) => {
    if (candidate == null || candidate === "") return ""
    if (typeof candidate === "object") {
      return String(candidate.display ?? candidate.text ?? candidate.label ?? candidate.value ?? candidate.code ?? "")
    }
    const matched = optionList.find((option) => String(option.code) === String(candidate) || String(option.display) === String(candidate))
    return matched ? matched.display : String(candidate)
  }

  if (Array.isArray(value)) return value.map(formatOne).filter(Boolean).join(", ")
  return formatOne(value)
}

const renderLayoutTableReadOnlyField = (cell, data) => {
  const label = cell.label || ""
  const displayValue = formatLayoutTableFieldDisplayValue(cell, data)

  return (
    <div
      data-field-id={cell.fieldId || cell.id}
      style={{
        minHeight: "20px",
        whiteSpace: cell.inputType === "textarea" ? "pre-wrap" : "normal",
        overflowWrap: "anywhere",
      }}
    >
      {label ? (
        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: displayValue ? 2 : 0 }}>
          {label}
        </div>
      ) : null}
      <div>{displayValue}</div>
    </div>
  )
}

const extractLayoutTableFormulaRefs = (expression) => {
  const bracketedRefs = Array.from(String(expression || "").matchAll(/\[([^\]]+)\]/g)).map((match) => match[1]).filter(Boolean)
  const unwrappedExpression = String(expression || "").replace(/\[([^\]]+)\]/g, " ")
  const bareRefs = Array.from(unwrappedExpression.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g))
    .map((match) => match[0])
    .filter((token) => !["sum", "Math", "min", "max"].includes(token))
  return Array.from(new Set([...bracketedRefs, ...bareRefs]))
}

const isSafeLayoutTableFormula = (expression) => {
  const strippedExpression = String(expression || "").replace(/\[([^\]]+)\]/g, " ")
  return /^[\d\s+\-*/().,_A-Za-z]+$/.test(strippedExpression)
}

const evaluateLayoutTableFormula = (expression, data, currentFieldId) => {
  const formula = typeof expression === "string" ? expression.trim() : ""
  if (!formula) return null

  const sumMatch = formula.match(/^sum\((.*)\)$/i)
  if (sumMatch) {
    const ids = sumMatch[1].split(",").map((part) => part.trim()).filter(Boolean)
    if (ids.length === 0) return null
    return ids.reduce((sum, fieldId) => sum + (getNumericFieldValue(data, fieldId) ?? 0), 0)
  }

  if (!isSafeLayoutTableFormula(formula)) return null
  const refs = extractLayoutTableFormulaRefs(formula).filter((fieldId) => fieldId !== currentFieldId)
  const values = {}
  refs.forEach((fieldId) => {
    values[fieldId] = getNumericFieldValue(data, fieldId) ?? 0
  })

  const jsExpression = formula
    .replace(/\[([^\]]+)\]/g, (_, fieldId) => `__values[${JSON.stringify(fieldId)}]`)
    .replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (token) => {
      if (["Math", "min", "max"].includes(token)) return token
      return Object.prototype.hasOwnProperty.call(values, token) ? `__values[${JSON.stringify(token)}]` : token
    })

  try {
    const value = Function("__values", `"use strict"; return (${jsExpression});`)(values)
    return Number.isFinite(value) ? value : null
  } catch (error) {
    return null
  }
}

const formatLayoutTableComputedValue = (value, precision, resultType) => {
  if (value == null || value === "") return ""
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ""
  if (Number.isFinite(precision) && precision >= 0) {
    const rounded = numeric.toFixed(Math.round(precision))
    return resultType === "text" ? rounded : String(Number(rounded))
  }
  return String(numeric)
}

const computeLayoutTableCellValue = (cell, data) => {
  const rawValue = evaluateLayoutTableFormula(cell.formula, data, cell.fieldId) ?? cell.defaultValue ?? ""
  return formatLayoutTableComputedValue(rawValue, cell.precision, cell.resultType)
}

const renderLayoutTableField = (cell, readOnly, data, setFieldValue) => {
  const fieldId = cell.fieldId || cell.id
  const label = cell.label || ""
  const labelProp = label ? { label } : {}
  const sharedProps = { fieldId, labelPosition: label ? "top" : "none", readOnly }
  const optionList = normalizeLayoutTableOptionList(cell.optionList ?? cell.options)

  if (readOnly) return renderLayoutTableReadOnlyField(cell, data)

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
      return <Numeric {...sharedProps} {...labelProp} spinButtonProps={{ min: cell.min, max: cell.max, step: cell.step }} />
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
    case "choiceMulti": {
      const checklistOptions = optionList.map((option) => ({ key: option.code, text: option.display }))
      const multiline = cell.multiline !== false
      return checklistOptions.length > 0
        ? <SimpleCodeChecklist {...sharedProps} {...labelProp} selectionType="multiple" optionList={checklistOptions} codeSystem={cell.codeSystem} multiline={multiline} />
        : <SimpleCodeChecklist {...sharedProps} {...labelProp} selectionType="multiple" codeSystem={cell.codeSystem} multiline={multiline} />
    }
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

const renderLayoutTableStampButton = (cell, readOnly) => {
  const id = cell.stampFieldId || cell.fieldId || cell.id
  const label = cell.label || cell.text || "Sign"
  const targets = Array.isArray(cell.targets) ? cell.targets : []

  return (
    <FieldStampButton
      id={id}
      stampFieldId={cell.stampFieldId}
      label={label}
      signedLabel={cell.signedLabel || "Signed"}
      clearLabel={cell.clearLabel || "Clear"}
      buttonType={cell.buttonType || "primary"}
      targets={targets}
      allowResign={cell.allowResign !== false}
      showClear={cell.showClear === true}
      showStatus={cell.showStatus !== false}
      statusTemplate={cell.statusTemplate || "{signedLabel} {signedAt}"}
      readOnly={readOnly}
    />
  )
}

const renderLayoutTableCellContent = (cell, readOnly, data, sourceData, setFieldValue) => {
  if (cell.kind === "field") return renderLayoutTableField(cell, readOnly, data, setFieldValue)
  if (cell.kind === "fieldList") return renderLayoutTableFieldList(cell, readOnly, data, setFieldValue)
  if (cell.kind === "resources") return renderLayoutTableResources(cell)
  if (cell.kind === "stampButton") return renderLayoutTableStampButton(cell, readOnly)
  if (cell.kind === "computed") return computeLayoutTableCellValue(cell, data)
  return getCellDisplayValue(cell, data, sourceData)
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
  const section = typeof useSection === "function" ? useSection() : null
  const [activeData = {}, setActiveData] = useActiveData(section?.activeSelector)
  const sd = useSourceData()
  const config = { bordered, compact, fullWidth, cellPadding, borderColor, pageBreakInsideAvoid }
  const tableRows = Array.isArray(rows) ? rows : []
  const tableData = { ...(activeData || {}) }
  const visibleRows = tableRows.filter((row) => rowIsVisible(row, activeData))
  const setFieldValue = (fieldId, value) => {
    if (typeof setActiveData !== "function") return
    setActiveData((draft) => {
      if (!draft) return { [fieldId]: value }
      draft[fieldId] = value
    })
  }

  React.useEffect(() => {
    const computedCells = tableRows
      .flatMap((row) => Array.isArray(row.cells) ? row.cells : [])
      .filter((cell) => cell?.kind === "computed" && cell.fieldId)
    if (computedCells.length === 0 || typeof setActiveData !== "function") return

    setActiveData((draft) => {
      if (!draft) {
        const nextData = {}
        computedCells.forEach((cell) => {
          nextData[cell.fieldId] = computeLayoutTableCellValue(cell, {})
        })
        return nextData
      }
      computedCells.forEach((cell) => {
        draft[cell.fieldId] = computeLayoutTableCellValue(cell, draft)
      })
    })
  }, [setActiveData, tableRows, JSON.stringify(activeData)])

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
                    {renderLayoutTableCellContent(cell, readOnly, tableData, sd, setFieldValue)}
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
