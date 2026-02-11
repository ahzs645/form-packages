
/**
 * EditableTable - A table component with add/delete row functionality
 *
 * Features:
 * - Progressive disclosure: Start with limited visible rows, add more as needed
 * - Empty row detection: Only allow deletion of empty rows
 * - Configurable columns with different field types
 * - Dark mode support via theme
 * - Maximum row limit support
 */

const { useState, useEffect } = React
const {
  Stack,
  Label,
  IconButton,
  DefaultButton,
  Text,
} = Fluent

// Handle case where EditableTable might already be defined
if (typeof EditableTable === "undefined") {
  window.EditableTable = null
}

EditableTable = ({
  id = "editableTable",
  columns = [],
  maxRows = 10,
  initialRows = 1,
  label = "",
  addButtonText = "+ Add Row",
  showRowNumbers = true,
  allowDeleteNonEmpty = false,
  showBackground = false,
  sourceFieldIds = {},  // Map of column ID to original PDF field ID for PDF sync
  sourceFieldIdsByRow = {},  // Map row index -> column ID -> original PDF field ID
  ...props
}) => {
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  // State for visible rows count
  const [visibleRows, setVisibleRows] = useState(initialRows)

  // Get rows data from form data
  const getRows = () => {
    try {
      const data = fd?.field?.data?.[id]
      if (Array.isArray(data) && data.length > 0) {
        return data
      }
    } catch (e) {
      console.log("Error getting rows:", e)
    }
    return null
  }

  const rows = getRows()

  // Initialize rows if they don't exist
  useEffect(() => {
    if (!rows && fd?.setFormData) {
      const initialData = []
      for (let i = 0; i < maxRows; i++) {
        const row = { _rowId: `row_${i}` }
        columns.forEach(col => {
          row[col.id] = col.type === "checkbox" ? false : ""
        })
        initialData.push(row)
      }

      fd.setFormData({
        ...fd,
        field: {
          ...fd.field,
          data: {
            ...fd.field?.data,
            [id]: initialData,
          },
        },
      })
    }
  }, [id, rows, fd, maxRows, columns])

  // Check if a row is empty
  const isRowEmpty = (row) => {
    if (!row) return true
    return columns.every((col) => {
      const value = row[col.id]
      return value === undefined || value === null || value === "" || value === false
    })
  }

  // Remove the last visible row
  const removeRow = () => {
    if (visibleRows > 1) {
      setVisibleRows(visibleRows - 1)
    }
  }

  // Add a new visible row
  const addRow = () => {
    if (visibleRows < maxRows) {
      setVisibleRows(visibleRows + 1)
    }
  }

  // Update a cell value
  const updateCell = (rowIndex, columnId, value) => {
    if (!fd?.setFormData) return

    const currentRows = fd?.field?.data?.[id] || []
    const updatedRows = [...currentRows]

    if (!updatedRows[rowIndex]) {
      updatedRows[rowIndex] = { _rowId: `row_${rowIndex}` }
    }
    updatedRows[rowIndex] = {
      ...updatedRows[rowIndex],
      [columnId]: value,
    }

    fd.setFormData({
      ...fd,
      field: {
        ...fd.field,
        data: {
          ...fd.field?.data,
          [id]: updatedRows,
        },
      },
    })
  }

  const remaining = maxRows - visibleRows

  const getSourceFieldId = (rowIndex, columnId) => {
    return sourceFieldIdsByRow?.[rowIndex]?.[columnId]
      || sourceFieldIds[columnId]
      || undefined
  }

  // Always create display rows based on visibleRows count
  // This ensures the table renders even before data is initialized
  const displayRows = []
  for (let i = 0; i < visibleRows; i++) {
    if (rows && rows[i]) {
      displayRows.push(rows[i])
    } else {
      // Create empty row placeholder
      const emptyRow = { _rowId: `row_${i}` }
      columns.forEach(col => {
        emptyRow[col.id] = col.type === "checkbox" ? false : ""
      })
      displayRows.push(emptyRow)
    }
  }

  // Styles
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

  // Render cell input based on column type
  const renderCellInput = (row, rowIndex, column) => {
    const value = row?.[column.id]

    switch (column.type) {
      case "number":
        return (
          <Numeric
            inline
            buttonControls
            value={value?.toString() || "0"}
            onChange={(newValue) => updateCell(rowIndex, column.id, newValue ? parseFloat(newValue) : 0)}
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
            inline
            value={value || ""}
            onChange={(newValue) => updateCell(rowIndex, column.id, newValue || "")}
            placeholder={column.placeholder || "Select date"}
          />
        )

      case "dropdown":
        return (
          <SimpleCodeSelect
            inline
            optionList={column.options || []}
            value={value ? { code: value, display: value } : undefined}
            onChange={(coding) => updateCell(rowIndex, column.id, coding?.code || "")}
            placeholder={column.placeholder || "Select..."}
          />
        )

      case "checkbox":
        return (
          <OptionChoice
            inline
            displayStyle="checkmark"
            value={value}
            onChange={(e, checked) => updateCell(rowIndex, column.id, !!checked)}
          />
        )

      case "text":
      default:
        return (
          <TextArea
            inline
            value={value || ""}
            onChange={(e, newValue) => updateCell(rowIndex, column.id, newValue || "")}
            placeholder={column.placeholder || ""}
          />
        )
    }
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
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => {
              const isEmpty = isRowEmpty(row)
              const canDelete = visibleRows > 1 && (allowDeleteNonEmpty || isEmpty)
              const isLastRow = idx === visibleRows - 1

              return (
                <tr key={row?._rowId || `row_${idx}`}>
                  {showRowNumbers && (
                    <td style={rowNumberCellStyle}>
                      <Stack horizontal verticalAlign="center" horizontalAlign="center" tokens={{ childrenGap: 4 }}>
                        <Text>{idx + 1}</Text>
                        {isLastRow && canDelete && (
                          <IconButton
                            iconProps={{ iconName: "Delete" }}
                            title="Remove row"
                            onClick={removeRow}
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
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.id} style={bodyCellStyle} data-source-field-id={getSourceFieldId(idx, col.id)}>
                      {renderCellInput(row, idx, col)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {remaining > 0 && (
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }} style={{ marginTop: "12px" }}>
          <DefaultButton
            text={addButtonText}
            onClick={addRow}
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
    </div>
  )
}

/**
 * Schema definition for EditableTable data
 */
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

/**
 * Helper to create column definitions
 */
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
  }))
}
