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

const { useState, useEffect, useMemo, useCallback } = React
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
    const path = col.dataPath || col.id
    _setValueAtPath(row, path, col.type === "checkbox" ? false : "")
  })
  return row
}

const _toPathSegments = (path) =>
  String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)

const _getValueAtPath = (root, path) => {
  const segments = _toPathSegments(path)
  if (segments.length === 0) return undefined

  let current = root
  for (const segment of segments) {
    if (!current || typeof current !== "object") return undefined
    current = current[segment]
  }
  return current
}

const _setValueAtPath = (root, path, value) => {
  const segments = _toPathSegments(path)
  if (segments.length === 0) return root

  let current = root
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]
    const nextValue = current[key]
    if (!nextValue || typeof nextValue !== "object" || Array.isArray(nextValue)) {
      current[key] = {}
    }
    current = current[key]
  }
  current[segments[segments.length - 1]] = value
  return root
}

const _normalizeRows = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.rows)) return value.rows
  return null
}

const _cloneRow = (row = {}, columns = []) => {
  const copy = JSON.parse(JSON.stringify(row || {}))
  copy._rowId = row?._rowId ?? copy._rowId ?? null
  columns.forEach((col) => {
    const path = col.dataPath || col.id
    const currentValue = _getValueAtPath(copy, path)
    if (typeof currentValue === "undefined") {
      _setValueAtPath(copy, path, col.type === "checkbox" ? false : "")
    }
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
  return columns.every((col) => !_isMeaningfulValue(_getValueAtPath(row, col.dataPath || col.id)))
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
  const value = _getValueAtPath(row, column.dataPath || column.id)
  if (column.type === "checkbox") {
    if (!_isMeaningfulValue(value)) return ""
    if (value) return column.booleanLabels?.on || "Yes"
    return column.booleanLabels?.off || "No"
  }
  return _stringifyValue(value)
}

const _normalizeMirroredCellValue = (value, column) => {
  if (column?.type === "checkbox") {
    return Boolean(value)
  }

  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  return value
}

const _normalizeUniqueToken = (row, columnId, columns = []) => {
  const column = columns.find((item) => item.id === columnId) || { id: columnId, dataPath: columnId }
  const raw = _getValueAtPath(row, column.dataPath || column.id)
  return _stringifyValue(raw).toLowerCase()
}

const _normalizeChoiceOptions = (options = []) => {
  if (!Array.isArray(options)) return []

  return options
    .map((option) => {
      if (typeof option === "string") return option.trim()
      if (option && typeof option === "object") {
        const candidate = option.text || option.display || option.label || option.code || option.key || option.value
        return typeof candidate === "string" ? candidate.trim() : ""
      }
      return ""
    })
    .filter(Boolean)
}

const _normalizeValidationMessage = (result) => {
  if (!result) return null
  if (typeof result === "string") {
    const trimmed = result.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof result === "object") {
    const candidate = result.message || result.error || result.reason
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
  }
  return null
}

const _validateRowWithConfig = (row, validationConfig, columns = []) => {
  if (!row || !validationConfig || typeof validationConfig !== "object") return null

  const requireAnyGroups = Array.isArray(validationConfig.requireAnyGroups)
    ? validationConfig.requireAnyGroups
    : []

  for (const group of requireAnyGroups) {
    const paths = Array.isArray(group?.paths) ? group.paths.filter(Boolean) : []
    if (paths.length === 0) continue

    const hasValue = paths.some((path) => _isMeaningfulValue(_getValueAtPath(row, path)))
    if (hasValue) continue

    const message =
      typeof group?.message === "string" && group.message.trim()
        ? group.message.trim()
        : typeof group?.label === "string" && group.label.trim()
          ? `Enter at least one value for ${group.label.trim()}.`
          : "Enter at least one value before saving this row."
    return message
  }

  const requiredPaths = Array.isArray(validationConfig.requiredPaths)
    ? validationConfig.requiredPaths
    : []

  for (const requiredEntry of requiredPaths) {
    if (typeof requiredEntry === "string") {
      if (_isMeaningfulValue(_getValueAtPath(row, requiredEntry))) continue
      const column = columns.find((item) => (item.dataPath || item.id) === requiredEntry)
      return `${column?.title || column?.label || requiredEntry} is required.`
    }

    if (requiredEntry && typeof requiredEntry === "object") {
      const path = requiredEntry.path
      if (!path) continue
      if (_isMeaningfulValue(_getValueAtPath(row, path))) continue
      if (typeof requiredEntry.message === "string" && requiredEntry.message.trim()) {
        return requiredEntry.message.trim()
      }
      const column = columns.find((item) => (item.dataPath || item.id) === path)
      return `${column?.title || column?.label || path} is required.`
    }
  }

  return null
}

const _toFiniteNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const _normalizeZeroLikeValue = (value, zeroIsEmpty = true) => {
  if (!zeroIsEmpty || typeof value !== "string") return value
  const trimmed = value.trim()
  if (trimmed === "" || trimmed === "0" || trimmed === "0." || trimmed === ".") return ""
  return value
}

const _formatProcessedNumber = (value, precision = 0, trimTrailingZero = false) => {
  if (!Number.isFinite(value)) return ""
  const safePrecision = Math.max(0, Math.min(6, Number(precision) || 0))
  let text = value.toFixed(safePrecision)
  if (trimTrailingZero && text.includes(".")) {
    text = text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")
  }
  return text
}

const _sortRowsByPath = (rows = [], path, direction = "asc") => {
  if (!path) return rows
  const sign = direction === "desc" ? -1 : 1
  return [...rows].sort((left, right) => {
    const leftValue = _stringifyValue(_getValueAtPath(left, path))
    const rightValue = _stringifyValue(_getValueAtPath(right, path))
    const leftDate = leftValue ? Date.parse(leftValue) : Number.NaN
    const rightDate = rightValue ? Date.parse(rightValue) : Number.NaN

    if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
      return (leftDate - rightDate) * sign
    }

    return leftValue.localeCompare(rightValue) * sign
  })
}

const _applyRowProcessingConfig = (row, processingConfig, columns = []) => {
  if (!row || !processingConfig || typeof processingConfig !== "object") return row

  const normalizedConfig = Array.isArray(processingConfig.pairs)
    ? processingConfig
    : processingConfig.type === "paired-unit-conversion"
      ? processingConfig
      : null

  if (!normalizedConfig) return row

  const nextRow = _cloneRow(row, columns)
  const factor = Number(normalizedConfig.factor)
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 18
  const cadPrecision = Number.isFinite(Number(normalizedConfig.cadPrecision))
    ? Number(normalizedConfig.cadPrecision)
    : 1
  const usPrecision = Number.isFinite(Number(normalizedConfig.usPrecision))
    ? Number(normalizedConfig.usPrecision)
    : 0
  const trimTrailingZero = normalizedConfig.trimTrailingZero !== false
  const zeroIsEmpty = normalizedConfig.zeroIsEmpty !== false
  const prefer = normalizedConfig.prefer === "us" ? "us" : "cad"
  const pairs = Array.isArray(normalizedConfig.pairs) ? normalizedConfig.pairs : []

  pairs.forEach((pair) => {
    const cadPath = pair?.cadPath
    const usPath = pair?.usPath
    if (!cadPath || !usPath) return

    const pairFactor = Number(pair.factor)
    const resolvedFactor = Number.isFinite(pairFactor) && pairFactor > 0 ? pairFactor : safeFactor
    const pairCadPrecision = Number.isFinite(Number(pair.cadPrecision))
      ? Number(pair.cadPrecision)
      : cadPrecision
    const pairUsPrecision = Number.isFinite(Number(pair.usPrecision))
      ? Number(pair.usPrecision)
      : usPrecision
    const pairPrefer = pair.prefer === "us" || pair.prefer === "cad" ? pair.prefer : prefer

    const rawCad = _normalizeZeroLikeValue(_getValueAtPath(nextRow, cadPath), zeroIsEmpty)
    const rawUs = _normalizeZeroLikeValue(_getValueAtPath(nextRow, usPath), zeroIsEmpty)
    let cadNumber = _toFiniteNumber(rawCad)
    let usNumber = _toFiniteNumber(rawUs)

    if (cadNumber !== null && usNumber === null) {
      usNumber = cadNumber * resolvedFactor
    } else if (cadNumber === null && usNumber !== null) {
      cadNumber = usNumber / resolvedFactor
    } else if (cadNumber !== null && usNumber !== null) {
      if (pairPrefer === "us") {
        cadNumber = usNumber / resolvedFactor
      } else {
        usNumber = cadNumber * resolvedFactor
      }
    }

    _setValueAtPath(
      nextRow,
      cadPath,
      cadNumber === null ? "" : _formatProcessedNumber(cadNumber, pairCadPrecision, trimTrailingZero)
    )
    _setValueAtPath(
      nextRow,
      usPath,
      usNumber === null ? "" : _formatProcessedNumber(usNumber, pairUsPrecision, false)
    )
  })

  return nextRow
}

const _buildSubformFieldFromColumn = (column) => {
  const fieldId = column.dataPath || column.id
  const label = column.title || column.label || column.id

  switch (column.type) {
    case "number":
      return {
        id: fieldId,
        label,
        type: "number",
        min: column.min,
        max: column.max,
        step: column.step,
        required: column.required === true,
      }
    case "date":
      return {
        id: fieldId,
        label,
        type: "date",
        placeholder: column.placeholder,
        required: column.required === true,
      }
    case "dropdown":
      return {
        id: fieldId,
        label,
        type: "choice",
        choiceStyle: "dropdown",
        options: _normalizeChoiceOptions(column.options),
        required: column.required === true,
      }
    case "checkbox":
      return {
        id: fieldId,
        label,
        type: "booleanYesNo",
        options: [
          column.booleanLabels?.on || "Yes",
          column.booleanLabels?.off || "No",
        ],
        required: column.required === true,
      }
    case "text":
    default:
      return {
        id: fieldId,
        label,
        type: "textarea",
        rows: column.rows || 3,
        placeholder: column.placeholder,
        required: column.required === true,
      }
  }
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
  const modalEditorConfig = props.modalEditorConfig || null
  const processingConfig = props.processingConfig || modalEditorConfig?.processingConfig || null
  const validationConfig = props.validationConfig || modalEditorConfig?.validationConfig || null
  const onBeforeSaveRow = props.onBeforeSaveRow
  const validateRow = props.validateRow
  const onRowsChange = props.onRowsChange
  const onRowSaved = props.onRowSaved
  const onRowDeleted = props.onRowDeleted
  const modalEditorType = String(modalEditorConfig?.type || modalEditorConfig?.editor || "").trim().toLowerCase()
  const usesSubformEditor =
    isModalMode &&
    Boolean(modalEditorConfig) &&
    typeof SubformScoring !== "undefined" &&
    (modalEditorType === "" || modalEditorType === "subform" || modalEditorType === "subform-scoring")
  const tableColumns = isModalMode
    ? columns.filter((column) => column.showInTable !== false)
    : columns
  const modalColumns = columns.filter((column) => column.showInModal !== false)
  const defaultSubformDataEntryConfig = useMemo(() => ({
    fields: modalColumns.map(_buildSubformFieldFromColumn),
    calculations: [],
  }), [modalColumns])
  const subformModalConfig = useMemo(() => ({
    ...(modalEditorConfig?.modalConfig || {}),
    title:
      modalEditorConfig?.modalConfig?.title
      || modalEditorConfig?.title
      || modalTitle
      || label
      || "Row Details",
  }), [modalEditorConfig, modalTitle, label])

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

    const mirroredFieldIds = new Set()
    Object.values(sourceFieldIds || {}).forEach((fieldId) => {
      if (fieldId) mirroredFieldIds.add(fieldId)
    })
    Object.values(sourceFieldIdsByRow || {}).forEach((rowMapping) => {
      Object.values(rowMapping || {}).forEach((fieldId) => {
        if (fieldId) mirroredFieldIds.add(fieldId)
      })
    })

    const nextFieldData = {
      ...fd.field?.data,
      [id]: nextRows,
    }

    mirroredFieldIds.forEach((fieldId) => {
      nextFieldData[fieldId] = null
    })

    ;(Array.isArray(nextRows) ? nextRows : []).forEach((row, rowIndex) => {
      columns.forEach((column) => {
        const sourceFieldId = getSourceFieldId(rowIndex, column.id)
        if (!sourceFieldId) return
        const rawValue = _getValueAtPath(row, column.dataPath || column.id)
        nextFieldData[sourceFieldId] = _normalizeMirroredCellValue(rawValue, column)
      })
    })

    fd.setFormData({
      ...fd,
      field: {
        ...fd.field,
        data: {
          ...nextFieldData,
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

  const buildRowContext = useCallback((row, extra = {}) => ({
    tableId: id,
    row,
    columns,
    currentRows,
    editingRowIndex,
    isModalMode,
    getValueAtPath: _getValueAtPath,
    setValueAtPath: _setValueAtPath,
    cloneRow: (candidate) => _cloneRow(candidate, columns),
    ...extra,
  }), [id, columns, currentRows, editingRowIndex, isModalMode])

  const commitRows = useCallback((nextRows, meta = {}) => {
    setRows(nextRows)
    if (typeof onRowsChange === "function") {
      onRowsChange({
        tableId: id,
        rows: nextRows,
        columns,
        mode,
        ...meta,
      })
    }
  }, [setRows, onRowsChange, id, columns, mode])

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
    const nextRow = _cloneRow(nextRows[rowIndex], columns)
    const column = columns.find((item) => item.id === columnId) || { id: columnId, dataPath: columnId }
    _setValueAtPath(nextRow, column.dataPath || column.id, value)
    nextRows[rowIndex] = nextRow
    commitRows(nextRows, {
      reason: "update",
      rowIndex,
      row: nextRow,
      previousRows: currentRows,
    })
  }

  const updateDraftCell = (columnId, value) => {
    const nextDraft = _cloneRow(draftRow || _makeEmptyRow(columns, currentRows.length), columns)
    const column = columns.find((item) => item.id === columnId) || { id: columnId, dataPath: columnId }
    _setValueAtPath(nextDraft, column.dataPath || column.id, value)
    setDraftRow(nextDraft)
  }

  const updateDraftValueAtPath = useCallback((fieldPath, value) => {
    const nextDraft = _cloneRow(draftRow || _makeEmptyRow(columns, currentRows.length), columns)
    _setValueAtPath(nextDraft, fieldPath, value)
    setDraftRow(nextDraft)
  }, [draftRow, columns, currentRows.length])

  const removeInlineRow = () => {
    if (isLocked || !allowDeleteRows || currentRows.length <= 1) return
    const lastRow = currentRows[currentRows.length - 1]
    if (!allowDeleteNonEmpty && !_isRowEmpty(lastRow, columns)) return
    const nextRows = currentRows.slice(0, -1)
    commitRows(nextRows, {
      reason: "delete",
      rowIndex: currentRows.length - 1,
      row: lastRow,
      previousRows: currentRows,
    })
    onRowDeleted?.(lastRow, buildRowContext(lastRow, {
      rowIndex: currentRows.length - 1,
      reason: "delete",
      previousRows: currentRows,
      nextRows,
    }))
    setVisibleRows(Math.max(1, nextRows.length))
  }

  const removeRowAt = (rowIndex) => {
    if (isLocked || !allowDeleteRows) return
    const deletedRow = currentRows[rowIndex]
    const nextRows = currentRows.filter((_, index) => index !== rowIndex)
    commitRows(nextRows, {
      reason: "delete",
      rowIndex,
      row: deletedRow,
      previousRows: currentRows,
    })
    if (deletedRow) {
      onRowDeleted?.(deletedRow, buildRowContext(deletedRow, {
        rowIndex,
        reason: "delete",
        previousRows: currentRows,
        nextRows,
      }))
    }
    if (!isModalMode) {
      setVisibleRows(Math.max(1, nextRows.length))
    }
  }

  const validateResolvedRow = (candidateRow) => {
    if (!candidateRow) return null

    if (typeof validateRow === "function") {
      const customResult = validateRow(candidateRow, buildRowContext(candidateRow, {
        reason: editingRowIndex === null ? "create" : "edit",
      }))
      const customMessage = _normalizeValidationMessage(customResult)
      if (customMessage) return customMessage
    }

    const configMessage = _validateRowWithConfig(candidateRow, validationConfig, columns)
    if (configMessage) return configMessage

    if (!Array.isArray(uniqueBy) || uniqueBy.length === 0) return null

    for (const columnId of uniqueBy) {
      const candidate = _normalizeUniqueToken(candidateRow, columnId, columns)
      if (!candidate) continue
      const duplicateIndex = currentRows.findIndex((row, index) => {
        if (editingRowIndex !== null && index === editingRowIndex) return false
        return _normalizeUniqueToken(row, columnId, columns) === candidate
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

    let resolvedRow = _cloneRow(draftRow, columns)
    if (processingConfig) {
      resolvedRow = _applyRowProcessingConfig(resolvedRow, processingConfig, columns)
    }
    if (typeof onBeforeSaveRow === "function") {
      try {
        const transformedRow = onBeforeSaveRow(resolvedRow, buildRowContext(resolvedRow, {
          reason: editingRowIndex === null ? "create" : "edit",
        }))
        if (typeof transformedRow !== "undefined") {
          resolvedRow = transformedRow
        }
      } catch (error) {
        setErrorMessage(error?.message || "Unable to prepare row for save.")
        return
      }
    }

    if (!resolvedRow || typeof resolvedRow !== "object") {
      setErrorMessage("Row save failed because the row data was invalid.")
      return
    }

    const validationError = validateResolvedRow(resolvedRow)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    const normalizedRow = {
      ...resolvedRow,
      _rowId:
        resolvedRow._rowId
        || currentRows[editingRowIndex ?? -1]?._rowId
        || `row_${editingRowIndex ?? currentRows.length}_${Date.now()}`,
    }

    const nextRows = [...currentRows]
    if (editingRowIndex === null) {
      nextRows.push(normalizedRow)
    } else {
      nextRows[editingRowIndex] = normalizedRow
    }

    const sortedRows = processingConfig?.sortByPath
      ? _sortRowsByPath(nextRows, processingConfig.sortByPath, processingConfig.sortDirection)
      : nextRows
    const savedRowIndex = sortedRows.findIndex((row) => row?._rowId === normalizedRow._rowId)

    commitRows(sortedRows, {
      reason: editingRowIndex === null ? "create" : "edit",
      rowIndex: savedRowIndex,
      row: normalizedRow,
      previousRows: currentRows,
    })
    onRowSaved?.(normalizedRow, buildRowContext(normalizedRow, {
      rowIndex: savedRowIndex,
      reason: editingRowIndex === null ? "create" : "edit",
      previousRows: currentRows,
      nextRows: sortedRows,
    }))
    if (!isModalMode) {
      setVisibleRows(sortedRows.length)
    }
    closeDialog()
  }

  const addInlineRow = () => {
    if (isLocked || !allowAddRows || currentRows.length >= maxRows) return
    const nextRows = [...currentRows, _makeEmptyRow(columns, currentRows.length)]
    commitRows(nextRows, {
      reason: "create",
      rowIndex: nextRows.length - 1,
      row: nextRows[nextRows.length - 1],
      previousRows: currentRows,
    })
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
    const value = _getValueAtPath(row, column.dataPath || column.id)

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
              {tableColumns.map((col) => (
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
                  colSpan={tableColumns.length + (showRowNumbers ? 1 : 0) + (shouldShowActions ? 1 : 0)}
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
                    {tableColumns.map((col) => (
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

      {isModalMode && isDialogOpen && draftRow && usesSubformEditor && (
        <SubformScoring
          id={`${id}__rowEditor`}
          mode="data-entry"
          title={subformModalConfig.title}
          hideTriggerButton
          showSummary={false}
          isOpen={isDialogOpen}
          onOpenChange={(nextIsOpen) => {
            if (!nextIsOpen) {
              closeDialog()
            }
          }}
          completeButtonText={modalEditorConfig?.completeButtonText || "Save"}
          cancelButtonText={modalEditorConfig?.cancelButtonText || "Cancel"}
          onComplete={() => {
            saveDraftRow()
            return false
          }}
          dataEntryValueRoot={draftRow}
          onDataEntryValueChange={updateDraftValueAtPath}
          dataEntryConfig={modalEditorConfig?.dataEntryConfig || defaultSubformDataEntryConfig}
          summaryConfig={modalEditorConfig?.summaryConfig || { showItems: [] }}
          modalConfig={subformModalConfig}
        />
      )}

      {isModalMode && isDialogOpen && draftRow && !usesSubformEditor && (
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
            {modalColumns.map((column) => (
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
    dataPath: def.dataPath,
    showInTable: def.showInTable,
    showInModal: def.showInModal,
    width: def.width,
    placeholder: def.placeholder,
    options: def.options,
    min: def.min,
    max: def.max,
    step: def.step,
    booleanLabels: def.booleanLabels,
  }))
}
