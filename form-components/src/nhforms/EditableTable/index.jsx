/**
 * EditableTable - Repeating row table with inline and modal editing modes.
 *
 * Features:
 * - Inline edit mode with progressive row disclosure
 * - Modal/display mode for summary-table workflows
 * - Row add/edit/delete actions
 * - Empty row detection and row-level uniqueness checks
 * - Configurable column types
 */

const { useState, useEffect } = React
const {
  Stack,
  Label,
  IconButton,
  DefaultButton,
  PrimaryButton,
  Dialog,
  DialogType,
  Text,
} = Fluent

if (typeof EditableTable === "undefined") {
  window.EditableTable = null
}

const _makeEmptyRow = (columns = [], rowIndex = 0) => {
  const row = { _rowId: `row_${rowIndex}_${Date.now()}` }
  columns.forEach((col) => {
    row[col.id] = col.type === "checkbox" ? false : ""
  })
  return row
}

const _normalizeRows = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.rows)) return value.rows
  return null
}

const _cloneRow = (row = {}, columns = []) => {
  const copy = { _rowId: row?._rowId ?? null }
  columns.forEach((col) => {
    copy[col.id] = row?.[col.id] ?? (col.type === "checkbox" ? false : "")
  })
  return copy
}

const _isMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "boolean") return value
  if (typeof value === "number") return !Number.isNaN(value)
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") return Object.keys(value).length > 0
  return true
}

const _isRowEmpty = (row, columns = []) => {
  if (!row) return true
  return columns.every((col) => !_isMeaningfulValue(row[col.id]))
}

const _stringifyValue = (value) => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map(_stringifyValue).filter(Boolean).join(", ")
  if (typeof value === "object") {
    const candidate = value.display ?? value.text ?? value.value ?? value.code ?? value.key ?? ""
    return _stringifyValue(candidate)
  }
  return String(value)
}

const _formatCellValue = (row, column) => {
  const value = row?.[column.id]
  if (column.type === "checkbox") {
    if (!_isMeaningfulValue(value)) return ""
    if (value) return column.booleanLabels?.on || "Yes"
    return column.booleanLabels?.off || "No"
  }
  return _stringifyValue(value)
}

const _normalizeUniqueToken = (row, columnId) => {
  const raw = row?.[columnId]
  return _stringifyValue(raw).toLowerCase()
}

EditableTable = ({
  id = "editableTable",
  columns = [],
  maxRows = 10,
  initialRows = 1,
  label = "",
  mode = "inline",
  modalTitle,
  addButtonText = "+ Add Row",
  emptyStateText = "No rows added yet",
  showRowNumbers = true,
  allowAddRows = true,
  allowEditRows = true,
  allowDeleteRows = true,
  allowDeleteNonEmpty = false,
  uniqueBy = [],
  showBackground = false,
  readOnly = false,
  disabled = false,
  sourceFieldIds = {},
  sourceFieldIdsByRow = {},
  ...props
}) => {
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false
  const [visibleRows, setVisibleRows] = useState(Math.max(initialRows, 1))
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRowIndex, setEditingRowIndex] = useState(null)
  const [draftRow, setDraftRow] = useState(null)
  const [errorMessage, setErrorMessage] = useState("")
  const isModalMode = mode === "modal"
  const isLocked = disabled || readOnly

  const getRows = () => {
    try {
      const data = fd?.field?.data?.[id]
      return _normalizeRows(data)
    } catch (error) {
      console.log("Error getting rows:", error)
      return null
    }
  }

  const setRows = (nextRows) => {
    if (!fd?.setFormData) return

    fd.setFormData({
      ...fd,
      field: {
        ...fd.field,
        data: {
          ...fd.field?.data,
          [id]: nextRows,
        },
      },
    })
  }

  const rows = getRows()

  useEffect(() => {
    if (rows) return

    const seededRows = isModalMode
      ? []
      : Array.from({ length: Math.max(initialRows, 1) }, (_, index) => _makeEmptyRow(columns, index))
    setRows(seededRows)
  }, [rows, isModalMode, initialRows, id, columns])

  useEffect(() => {
    const rowCount = Array.isArray(rows) ? rows.length : 0
    if (rowCount > visibleRows) {
      setVisibleRows(rowCount)
    }
  }, [rows, visibleRows])

  const currentRows = Array.isArray(rows) ? rows : []

  const getSourceFieldId = (rowIndex, columnId) => {
    return sourceFieldIdsByRow?.[rowIndex]?.[columnId]
      || sourceFieldIds[columnId]
      || undefined
  }

  const openCreateDialog = () => {
    if (isLocked || !allowAddRows || currentRows.length >= maxRows) return
    setEditingRowIndex(null)
    setDraftRow(_makeEmptyRow(columns, currentRows.length))
    setErrorMessage("")
    setIsDialogOpen(true)
  }

  const openEditDialog = (rowIndex) => {
    if (isLocked || !allowEditRows) return
    const row = currentRows[rowIndex]
    if (!row) return
    setEditingRowIndex(rowIndex)
    setDraftRow(_cloneRow(row, columns))
    setErrorMessage("")
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingRowIndex(null)
    setDraftRow(null)
    setErrorMessage("")
  }

  const updateCell = (rowIndex, columnId, value) => {
    const nextRows = [...currentRows]
    if (!nextRows[rowIndex]) {
      nextRows[rowIndex] = _makeEmptyRow(columns, rowIndex)
    }
    nextRows[rowIndex] = {
      ...nextRows[rowIndex],
      [columnId]: value,
    }
    setRows(nextRows)
  }

  const updateDraftCell = (columnId, value) => {
    setDraftRow({
      ...(draftRow || _makeEmptyRow(columns, currentRows.length)),
      [columnId]: value,
    })
  }

  const removeInlineRow = () => {
    if (isLocked || !allowDeleteRows || currentRows.length <= 1) return
    const lastRow = currentRows[currentRows.length - 1]
    if (!allowDeleteNonEmpty && !_isRowEmpty(lastRow, columns)) return
    const nextRows = currentRows.slice(0, -1)
    setRows(nextRows)
    setVisibleRows(Math.max(1, nextRows.length))
  }

  const removeRowAt = (rowIndex) => {
    if (isLocked || !allowDeleteRows) return
    const nextRows = currentRows.filter((_, index) => index !== rowIndex)
    setRows(nextRows)
    if (!isModalMode) {
      setVisibleRows(Math.max(1, nextRows.length))
    }
  }

  const validateDraftRow = () => {
    if (!draftRow) return null
    if (!Array.isArray(uniqueBy) || uniqueBy.length === 0) return null

    for (const columnId of uniqueBy) {
      const candidate = _normalizeUniqueToken(draftRow, columnId)
      if (!candidate) continue
      const duplicateIndex = currentRows.findIndex((row, index) => {
        if (editingRowIndex !== null && index === editingRowIndex) return false
        return _normalizeUniqueToken(row, columnId) === candidate
      })
      if (duplicateIndex > -1) {
        const column = columns.find((item) => item.id === columnId)
        return `${column?.title || column?.label || columnId} must be unique.`
      }
    }

    return null
  }

  const saveDraftRow = () => {
    if (!draftRow) return

    const validationError = validateDraftRow()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    const normalizedRow = {
      ...draftRow,
      _rowId:
        draftRow._rowId
        || currentRows[editingRowIndex ?? -1]?._rowId
        || `row_${editingRowIndex ?? currentRows.length}_${Date.now()}`,
    }

    const nextRows = [...currentRows]
    if (editingRowIndex === null) {
      nextRows.push(normalizedRow)
    } else {
      nextRows[editingRowIndex] = normalizedRow
    }

    setRows(nextRows)
    if (!isModalMode) {
      setVisibleRows(nextRows.length)
    }
    closeDialog()
  }

  const addInlineRow = () => {
    if (isLocked || !allowAddRows || currentRows.length >= maxRows) return
    const nextRows = [...currentRows, _makeEmptyRow(columns, currentRows.length)]
    setRows(nextRows)
    setVisibleRows(nextRows.length)
  }

  const displayRows = (() => {
    if (isModalMode) {
      return currentRows
        .map((row, rowIndex) => ({ row, rowIndex }))
        .filter(({ row }) => !_isRowEmpty(row, columns))
    }

    const paddedRows = []
    const rowCount = Math.max(visibleRows, Math.max(initialRows, 1))
    for (let index = 0; index < rowCount; index += 1) {
      paddedRows.push({
        row: currentRows[index] || _makeEmptyRow(columns, index),
        rowIndex: index,
      })
    }
    return paddedRows
  })()

  const currentRowCount = isModalMode ? displayRows.length : currentRows.length
  const remaining = Math.max(0, maxRows - currentRowCount)
  const shouldShowActions = !isLocked && (allowEditRows || allowDeleteRows)

  const renderEditorInput = (row, rowIndex, column, onValueChange, inline) => {
    const value = row?.[column.id]

    switch (column.type) {
      case "number":
        return (
          <Numeric
            inline={inline}
            buttonControls
            value={value?.toString() || ""}
            onChange={(newValue) => onValueChange(rowIndex, column.id, newValue === "" ? "" : Number(newValue))}
            spinButtonProps={{
              min: column.min ?? 0,
              max: column.max ?? 999999,
              step: column.step ?? 1,
            }}
          />
        )

      case "date":
        return (
          <DateSelect
            inline={inline}
            value={value || ""}
            onChange={(newValue) => onValueChange(rowIndex, column.id, newValue || "")}
            placeholder={column.placeholder || "Select date"}
          />
        )

      case "dropdown":
        return (
          <SimpleCodeSelect
            inline={inline}
            optionList={column.options || []}
            value={value ? { code: value, display: value } : undefined}
            onChange={(coding) => onValueChange(rowIndex, column.id, coding?.code || "")}
            placeholder={column.placeholder || "Select..."}
          />
        )

      case "checkbox":
        return (
          <OptionChoice
            inline={inline}
            displayStyle="checkmark"
            value={value}
            onChange={(event, checked) => onValueChange(rowIndex, column.id, !!checked)}
          />
        )

      case "text":
      default:
        return (
          <TextArea
            inline={inline}
            value={value || ""}
            onChange={(event, newValue) => onValueChange(rowIndex, column.id, newValue || "")}
            placeholder={column.placeholder || ""}
          />
        )
    }
  }

  const containerStyle = showBackground ? {
    padding: "16px",
    border: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
    borderRadius: "8px",
    backgroundColor: isDarkMode ? "#1f1f1f" : "#fafafa",
  } : {}

  const tableContainerStyle = {
    overflowX: "auto",
    border: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
    borderRadius: "4px",
  }

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  }

  const headerRowStyle = {
    backgroundColor: isDarkMode ? "#2a2a2a" : "#f5f5f5",
  }

  const headerCellStyle = {
    padding: "12px",
    textAlign: "left",
    borderBottom: `2px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
    fontWeight: 600,
  }

  const rowNumberHeaderStyle = {
    ...headerCellStyle,
    width: "60px",
    textAlign: "center",
  }

  const bodyCellStyle = {
    padding: "8px",
    borderBottom: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
    verticalAlign: "middle",
  }

  const rowNumberCellStyle = {
    padding: "12px",
    fontWeight: 500,
    backgroundColor: isDarkMode ? "#2a2a2a" : "#fafafa",
    textAlign: "center",
    borderBottom: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
    verticalAlign: "middle",
  }

  return (
    <div style={containerStyle}>
      {label && (
        <div style={{ marginBottom: "12px" }}>
          <Label styles={{ root: { fontSize: "16px", fontWeight: 600 } }}>
            {label}
          </Label>
        </div>
      )}

      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={headerRowStyle}>
              {showRowNumbers && (
                <th style={rowNumberHeaderStyle}>#</th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  style={{
                    ...headerCellStyle,
                    minWidth: col.width || "auto",
                  }}
                  data-source-field-id={sourceFieldIds[col.id] || undefined}
                >
                  {col.title || col.id}
                </th>
              ))}
              {(isModalMode && shouldShowActions) && (
                <th className="hideonprint" style={{ ...headerCellStyle, width: "96px" }} />
              )}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && isModalMode ? (
              <tr>
                <td
                  colSpan={columns.length + (showRowNumbers ? 1 : 0) + (shouldShowActions ? 1 : 0)}
                  style={{ ...bodyCellStyle, textAlign: "center", color: isDarkMode ? "#bdbdbd" : "#666666" }}
                >
                  {emptyStateText}
                </td>
              </tr>
            ) : (
              displayRows.map(({ row, rowIndex }, displayIndex) => {
                const isEmpty = _isRowEmpty(row, columns)
                const canDeleteInline = currentRows.length > 1 && allowDeleteRows && (allowDeleteNonEmpty || isEmpty)
                const isLastInlineRow = rowIndex === currentRows.length - 1

                return (
                  <tr key={row?._rowId || `row_${rowIndex}`}>
                    {showRowNumbers && (
                      <td style={rowNumberCellStyle}>
                        {isModalMode ? (
                          <Text>{displayIndex + 1}</Text>
                        ) : (
                          <Stack horizontal verticalAlign="center" horizontalAlign="center" tokens={{ childrenGap: 4 }}>
                            <Text>{displayIndex + 1}</Text>
                            {isLastInlineRow && canDeleteInline && !isLocked && (
                              <IconButton
                                iconProps={{ iconName: "Delete" }}
                                title="Remove row"
                                onClick={removeInlineRow}
                                styles={{
                                  root: {
                                    width: 24,
                                    height: 24,
                                    color: isDarkMode ? "#ff6b6b" : "#d32f2f",
                                  },
                                  icon: {
                                    fontSize: 14,
                                    color: isDarkMode ? "#ff6b6b" : "#d32f2f",
                                  },
                                }}
                              />
                            )}
                          </Stack>
                        )}
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.id} style={bodyCellStyle} data-source-field-id={getSourceFieldId(rowIndex, col.id)}>
                        {isModalMode
                          ? <div>{_formatCellValue(row, col)}</div>
                          : renderEditorInput(row, rowIndex, col, updateCell, true)}
                      </td>
                    ))}
                    {(isModalMode && shouldShowActions) && (
                      <td className="hideonprint" style={bodyCellStyle}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          {allowDeleteRows && (
                            <IconButton
                              iconProps={{ iconName: "Delete" }}
                              title="Delete"
                              ariaLabel="Delete"
                              onClick={() => removeRowAt(rowIndex)}
                            />
                          )}
                          {allowEditRows && (
                            <IconButton
                              iconProps={{ iconName: "Edit" }}
                              title="Edit"
                              ariaLabel="Edit"
                              onClick={() => openEditDialog(rowIndex)}
                            />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {allowAddRows && !isLocked && remaining > 0 && (
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }} style={{ marginTop: "12px" }}>
          <DefaultButton
            text={addButtonText}
            onClick={isModalMode ? openCreateDialog : addInlineRow}
            styles={{
              root: {
                border: "none",
                backgroundColor: "transparent",
                padding: "0 8px",
              },
              label: {
                fontWeight: 400,
              },
            }}
          />
          <Text style={{ fontSize: "14px", color: isDarkMode ? "#a0a0a0" : "#666666" }}>
            {remaining} more row{remaining !== 1 ? "s" : ""} available
          </Text>
        </Stack>
      )}

      {isModalMode && isDialogOpen && draftRow && (
        <Dialog
          hidden={!isDialogOpen}
          dialogContentProps={{
            type: DialogType.largeHeader,
            title: modalTitle || label || "Row Details",
          }}
          modalProps={{
            isBlocking: true,
          }}
          onDismiss={closeDialog}
        >
          <Stack tokens={{ childrenGap: 12 }}>
            {columns.map((column) => (
              <div key={column.id}>
                <Label>{column.title || column.id}</Label>
                {renderEditorInput(
                  draftRow,
                  editingRowIndex ?? currentRows.length,
                  column,
                  (rowIndex, columnId, value) => updateDraftCell(columnId, value),
                  false
                )}
              </div>
            ))}
            {errorMessage && (
              <Text style={{ color: isDarkMode ? "#ffb3b3" : "#b42318" }}>
                {errorMessage}
              </Text>
            )}
            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
              <DefaultButton text="Cancel" onClick={closeDialog} />
              <PrimaryButton text="Save" onClick={saveDraftRow} />
            </Stack>
          </Stack>
        </Dialog>
      )}
    </div>
  )
}

const EditableTableSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      _rowId: { type: "string" },
    },
    additionalProperties: true,
  },
}

const createTableColumns = (columnDefs) => {
  return columnDefs.map((def) => ({
    id: def.id,
    title: def.title || def.id,
    type: def.type || "text",
    width: def.width,
    placeholder: def.placeholder,
    options: def.options,
    min: def.min,
    max: def.max,
    step: def.step,
    booleanLabels: def.booleanLabels,
  }))
}
