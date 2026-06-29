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

const _getDefaultCellValue = (column = {}) => {
  if (column.type === "checkbox") return column.prefill === true ? true : false
  return ""
}

const _makeEmptyRow = (columns = [], rowIndex = 0) => {
  const row = { _rowId: `row_${rowIndex}_${Date.now()}` }
  columns.forEach((col) => {
    const path = col.dataPath || col.id
    _setValueAtPath(row, path, _getDefaultCellValue(col))
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
      _setValueAtPath(copy, path, _getDefaultCellValue(col))
    }
  })
  return copy
}

const _normalizeTableColumns = (columns = []) => {
  if (!Array.isArray(columns)) return []

  return columns.map((column, index) => {
    const id = column?.id || column?.key || column?.fieldName || column?.name || `column_${index + 1}`
    return {
      ...column,
      id,
      title: column?.title || column?.label || column?.name || id,
      type: column?.type || "text",
      dataPath: column?.dataPath || column?.fieldName || id,
    }
  })
}

const _normalizeNumberConfig = (column = {}) => ({
  typeNumber: column.numberConfig?.typeNumber || column.typeNumber || "number",
  suffix: column.numberConfig?.suffix ?? column.suffix,
  buttonControls: column.numberConfig?.buttonControls ?? column.buttonControls ?? false,
  storeAsNumber: column.numberConfig?.storeAsNumber ?? column.storeAsNumber ?? true,
  spinButtonProps: {
    min: column.numberConfig?.spinButtonProps?.min ?? column.min,
    max: column.numberConfig?.spinButtonProps?.max ?? column.max,
    step: column.numberConfig?.spinButtonProps?.step ?? column.step,
  },
})

const _coerceNumberCellValue = (value, column = {}) => {
  const numberConfig = _normalizeNumberConfig(column)
  if (value === "") return ""
  if (numberConfig.storeAsNumber === false) return value
  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? "" : numericValue
}

const _normalizeInitialRowCount = (initialRows) => {
  if (Array.isArray(initialRows)) return Math.max(initialRows.length, 1)
  const count = Number(initialRows)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1
}

const _normalizeInitialRows = (initialRows, columns = []) => {
  if (!Array.isArray(initialRows)) return []
  return initialRows.map((row, index) => ({
    ..._cloneRow(row, columns),
    _rowId: row?._rowId || `row_${index}`,
  }))
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
  if (column?.computedValue?.mode === "template") {
    const computed = _computeTemplateColumnValue(row, column)
    if (_isMeaningfulValue(computed)) return computed
  }
  const value = _getValueAtPath(row, column.dataPath || column.id)
  if (column.type === "checkbox") {
    if (!_isMeaningfulValue(value)) return ""
    if (value) return column.booleanLabels?.on || "Checked"
    return column.booleanLabels?.off || "Unchecked"
  }
  return _stringifyValue(value)
}

const _computeTemplateColumnValue = (row, column) => {
  const config = column?.computedValue
  if (!config || config.mode !== "template" || typeof config.template !== "string") return ""
  const omitEmptyLines = config.emptyBehavior !== "blank"
  const rendered = config.template.replace(/\{([^{}]+)\}/g, (_match, path) => {
    return _stringifyValue(_getValueAtPath(row, String(path || "").trim()))
  })
  return omitEmptyLines
    ? rendered
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0)
      .join("\n")
    : rendered
}

const _applyComputedColumns = (row, columns = []) => {
  const nextRow = _cloneRow(row, columns)
  columns.forEach((column) => {
    if (column?.computedValue?.mode !== "template") return
    _setValueAtPath(nextRow, column.dataPath || column.id, _computeTemplateColumnValue(nextRow, column))
  })
  return nextRow
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

const _normalizeSourceCellValue = (value, column) => {
  if (column?.type === "checkbox") {
    return Boolean(value)
  }

  if (value === undefined || value === null) {
    return column?.type === "checkbox" ? false : ""
  }

  if (column?.type === "dropdown") {
    if (typeof value === "string") return value
    if (Array.isArray(value)) {
      const first = value[0]
      if (typeof first === "string") return first
      return _stringifyValue(first)
    }
    if (typeof value === "object") {
      return _stringifyValue(value.code ?? value.display ?? value.value ?? value.key ?? value.text ?? "")
    }
  }

  if (column?.type === "number") {
    if (typeof value === "number") return value
    if (typeof value === "string") return value
  }

  if (typeof value === "string") return value
  return _stringifyValue(value)
}

const _buildRowsFromSourceFields = ({
  fieldData,
  columns = [],
  sourceFieldIds = {},
  sourceFieldIdsByRow = {},
  initialRows = 1,
}) => {
  if (!fieldData || typeof fieldData !== "object") return []
  if (!Array.isArray(columns) || columns.length === 0) return []

  const explicitRowIndexes = Object.keys(sourceFieldIdsByRow || {})
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)

  const inferredRowCount = explicitRowIndexes.length > 0
    ? explicitRowIndexes[explicitRowIndexes.length - 1] + 1
    : Math.max(initialRows, 1)

  const rows = []

  for (let rowIndex = 0; rowIndex < inferredRowCount; rowIndex += 1) {
    const row = _makeEmptyRow(columns, rowIndex)
    let hasMeaningfulValue = false

    columns.forEach((column) => {
      const sourceFieldId = sourceFieldIdsByRow?.[rowIndex]?.[column.id]
        || sourceFieldIds?.[column.id]
        || null
      if (!sourceFieldId) return

      const rawValue = fieldData[sourceFieldId]
      const normalizedValue = _normalizeSourceCellValue(rawValue, column)
      _setValueAtPath(row, column.dataPath || column.id, normalizedValue)

      if (_isMeaningfulValue(normalizedValue)) {
        hasMeaningfulValue = true
      }
    })

    if (hasMeaningfulValue) {
      rows.push(row)
    }
  }

  return rows
}

const _normalizeUniqueToken = (row, columnId, columns = []) => {
  const column = columns.find((item) => item.id === columnId) || { id: columnId, dataPath: columnId }
  const raw = _getValueAtPath(row, column.dataPath || column.id)
  return _stringifyValue(raw).toLowerCase()
}

const _normalizeChoiceOptions = (options = []) => {
  if (!Array.isArray(options)) return []

  return options
    .map((option, index) => {
      if (typeof option === "string") {
        const trimmed = option.trim()
        if (!trimmed) return null
        return { key: trimmed || `option_${index + 1}`, text: trimmed }
      }
      if (option && typeof option === "object") {
        const candidate = option.text || option.display || option.label || option.code || option.key || option.value
        const trimmed = typeof candidate === "string" ? candidate.trim() : ""
        if (!trimmed) return null
        const rawKey = option.key || option.code || option.value || option.id || trimmed
        return { key: String(rawKey), text: trimmed }
      }
      return null
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
  const visibility = column.visibility && typeof column.visibility === "object"
    ? column.visibility
    : null
  const withCommon = (field) => ({
    ...field,
    visibility: visibility || undefined,
  })

  switch (column.type) {
    case "number":
      const numberConfig = _normalizeNumberConfig(column)
      return withCommon({
        id: fieldId,
        label,
        type: "number",
        min: numberConfig.spinButtonProps.min,
        max: numberConfig.spinButtonProps.max,
        step: numberConfig.spinButtonProps.step,
        typeNumber: numberConfig.typeNumber,
        suffix: numberConfig.suffix,
        buttonControls: numberConfig.buttonControls,
        storeAsNumber: numberConfig.storeAsNumber,
        required: column.required === true,
      })
    case "date":
      return withCommon({
        id: fieldId,
        label,
        type: "date",
        placeholder: column.placeholder,
        required: column.required === true,
      })
    case "time":
      return withCommon({
        id: fieldId,
        label,
        type: "time",
        placeholder: column.placeholder,
        required: column.required === true,
      })
    case "dropdown":
      return withCommon({
        id: fieldId,
        label,
        type: "choice",
        choiceStyle: "dropdown",
        options: _normalizeChoiceOptions(column.options),
        required: column.required === true,
      })
    case "checkbox":
      return withCommon({
        id: fieldId,
        label,
        type: "booleanYesNo",
        renderStyle: "checkbox",
        useToggleSwitch: column.useToggleSwitch === true,
        defaultValue: column.prefill === true ? column.booleanLabels?.on || "Checked" : undefined,
        options: [
          column.booleanLabels?.on || "Checked",
          column.booleanLabels?.off || "Unchecked",
        ],
        required: column.required === true,
      })
    case "text":
    default:
      return withCommon({
        id: fieldId,
        label,
        type: "textarea",
        rows: column.rows || 3,
        placeholder: column.placeholder,
        required: column.required === true,
      })
  }
}

const _evaluateColumnVisibility = (column, row = {}) => {
  const rule = column?.visibility
  if (!rule || typeof rule !== "object" || rule.type === "always") return true
  const controllerId = rule.controllerId
  if (!controllerId) return true
  const value = _getValueAtPath(row, controllerId)
  if (rule.type === "filled") return _isMeaningfulValue(value)
  if (rule.type === "equals") return String(value ?? "") === String(rule.value ?? "")
  if (rule.type === "gt" || rule.type === "lt") {
    const left = Number(value)
    const right = Number(rule.value ?? 0)
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false
    return rule.type === "gt" ? left > right : left < right
  }
  return true
}

EditableTable = ({
  id = "editableTable",
  columns: columnsProp = [],
  maxRows = 10,
  initialRows: initialRowsProp = 1,
  label = "",
  mode = "inline",
  orientation = "horizontal",
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
  authorshipPolicy: authorshipPolicyProp,
  sourceFieldIds = {},
  sourceFieldIdsByRow = {},
  ...props
}) => {
  const [fd] = useActiveData()
  const sd = typeof useSourceData === "function" ? useSourceData() : null
  const section = typeof useSection === "function" ? useSection() : null
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  // Per-row authorship: each row the table renders can be locked to the author
  // who entered it. Uses the shared __nhAuth engine (inlined by the nhforms
  // generator / Vite loader) so it runs in real MOIS, not just preview.
  const nhAuth = (typeof window !== "undefined" && window.__nhAuth) || null
  const authorshipPolicy = authorshipPolicyProp || section?.authorshipPolicy || { enabled: false }
  const authorshipEnabled = !!(nhAuth && authorshipPolicy && authorshipPolicy.enabled)
  const getRowLock = (row) => {
    if (!authorshipEnabled || !row?._rowId) return { locked: false }
    const actor = nhAuth.actor(sd, fd)
    return nhAuth.lockInfo(fd, sd, { scope: "row", componentId: id, rowKey: row._rowId }, {
      ownerName: actor.ownerName,
      ownerId: actor.ownerId,
      now: sd?.previewOptions?.authorshipNow,
    })
  }
  const columns = useMemo(() => _normalizeTableColumns(columnsProp), [columnsProp])
  const initialRowCount = _normalizeInitialRowCount(initialRowsProp)
  const initialSeedRows = useMemo(() => _normalizeInitialRows(initialRowsProp, columns), [initialRowsProp, columns])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRowIndex, setEditingRowIndex] = useState(null)
  const [draftRow, setDraftRow] = useState(null)
  const [errorMessage, setErrorMessage] = useState("")
  const isModalMode = mode === "modal"
  const isVertical = orientation === "vertical"
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

  const setRows = (nextRows, authorshipClaim = null) => {
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

    // Lock-on-edit: stamp the editing author's claim onto field.data.__authorship
    // for this row, carried inside the same write. nhAuth.claim mutates the
    // object we pass; nextFieldData is spread into the committed state below.
    if (authorshipClaim && authorshipEnabled && authorshipClaim.rowId) {
      nhAuth.claim(
        { field: { data: nextFieldData } },
        sd,
        { scope: "row", componentId: id, rowKey: authorshipClaim.rowId },
        authorshipClaim.value,
        authorshipPolicy,
        { now: sd?.previewOptions?.authorshipNow }
      )
    }

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
  const sourceSeedRows = useMemo(() => _buildRowsFromSourceFields({
    fieldData: fd?.field?.data,
    columns,
    sourceFieldIds,
    sourceFieldIdsByRow,
    initialRows: initialRowCount,
  }), [fd?.field?.data, columns, sourceFieldIds, sourceFieldIdsByRow, initialRowCount])

  useEffect(() => {
    if (rows) return

    const seededRows = isModalMode
      ? []
      : initialSeedRows.length > 0
        ? initialSeedRows
        : Array.from({ length: initialRowCount }, (_, index) => _makeEmptyRow(columns, index))
    setRows(seededRows)
  }, [rows, isModalMode, initialSeedRows, initialRowCount, id, columns])

  useEffect(() => {
    if (sourceSeedRows.length === 0) return

    const existingRows = Array.isArray(rows) ? rows : []
    const hasMeaningfulRows = existingRows.some((row) => !_isRowEmpty(row, columns))
    if (hasMeaningfulRows) return

    setRows(sourceSeedRows)
  }, [rows, columns, setRows, sourceSeedRows])

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

  const commitRows = useCallback((nextRows, meta = {}, authorshipClaim = null) => {
    setRows(nextRows, authorshipClaim)
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
    // Defense in depth: a locked row cannot be edited even if an input slips
    // through (read-only enforcement also gates onChange at the input level).
    if (authorshipEnabled && getRowLock(currentRows[rowIndex]).locked) return
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
    }, { rowId: nextRow._rowId, value })
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

    let resolvedRow = _applyComputedColumns(_cloneRow(draftRow, columns), columns)
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
  }

  const displayRows = (() => {
    if (isModalMode) {
      return currentRows
        .map((row, rowIndex) => ({ row, rowIndex }))
        .filter(({ row }) => !_isRowEmpty(row, columns))
    }

    // Until the seeding effect writes the initial rows into form data, render
    // placeholder rows so the table doesn't flash empty on first paint.
    if (!rows) {
      return Array.from({ length: initialRowCount }, (_, index) => ({
        row: _makeEmptyRow(columns, index),
        rowIndex: index,
      }))
    }

    // Inline rows mirror the saved data exactly: initialRows seeds the data
    // once, "+ Add Row" appends, and deleting a row visibly removes it.
    // Padding the display back up to initialRows here made deletes look like
    // no-ops — the row stayed on screen and only the icon moved up.
    return currentRows.map((row, rowIndex) => ({ row, rowIndex }))
  })()

  const currentRowCount = isModalMode ? displayRows.length : currentRows.length
  const remaining = Math.max(0, maxRows - currentRowCount)
  const shouldShowActions = !isLocked && (allowEditRows || allowDeleteRows)

  const renderEditorInput = (row, rowIndex, column, onValueChange, inline, rowReadOnly = false) => {
    const value = _getValueAtPath(row, column.dataPath || column.id)
    // When the row is authorship-locked, neutralize edits at the input level so
    // even controls that ignore a readOnly prop cannot write.
    if (rowReadOnly) onValueChange = () => {}

    switch (column.type) {
      case "number":
        const numberConfig = _normalizeNumberConfig(column)
        const spinButtonProps = {}
        if (numberConfig.spinButtonProps.min !== undefined) spinButtonProps.min = numberConfig.spinButtonProps.min
        if (numberConfig.spinButtonProps.max !== undefined) spinButtonProps.max = numberConfig.spinButtonProps.max
        if (numberConfig.spinButtonProps.step !== undefined) spinButtonProps.step = numberConfig.spinButtonProps.step
        return (
          <Numeric
            inline={inline}
            typeNumber={numberConfig.typeNumber}
            buttonControls={numberConfig.buttonControls}
            value={value?.toString() || ""}
            onChange={(newValue) => onValueChange(rowIndex, column.id, _coerceNumberCellValue(newValue, column))}
            spinButtonProps={spinButtonProps}
            textFieldProps={numberConfig.suffix ? { suffix: numberConfig.suffix } : undefined}
            storeAsNumber={numberConfig.storeAsNumber !== false}
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
        const dropdownOptions = _normalizeChoiceOptions(column.options)
        const selectionType =
          column.choiceStyle === "multiselect" || column.choiceStyle === "checkbox"
            ? "multiple"
            : "single"
        return (
          <SimpleCodeSelect
            inline={inline}
            optionList={column.codeSystem ? undefined : dropdownOptions}
            codeSystem={column.codeSystem || undefined}
            selectionType={selectionType}
            value={value ? { code: value, display: value } : undefined}
            onChange={(coding) => onValueChange(rowIndex, column.id, coding?.code || "")}
            placeholder={column.placeholder || "Select..."}
            showOther={column.showOtherOption === true}
          />
        )

      case "time":
        return (
          <TimeSelect
            inline={inline}
            value={value || ""}
            onChange={(event, newValue) => onValueChange(rowIndex, column.id, newValue || "")}
            placeholder={column.placeholder || "HH:mm"}
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

  const verticalLabelCellStyle = {
    ...headerCellStyle,
    width: "180px",
    minWidth: "180px",
    borderRight: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
    borderBottom: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
  }

  const verticalBodyCellStyle = {
    ...bodyCellStyle,
    minWidth: "120px",
    borderRight: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
  }

  const renderVerticalTable = () => {
    const rowsForVerticalLayout = displayRows.length === 0 && isModalMode
      ? [{ row: null, rowIndex: 0, isEmptyPlaceholder: true }]
      : displayRows

    return (
      <table style={tableStyle}>
        <tbody>
          {tableColumns.map((col) => (
            <tr key={col.id}>
              <th
                style={verticalLabelCellStyle}
                data-source-field-id={sourceFieldIds[col.id] || undefined}
              >
                {col.title || col.id}
              </th>
              {rowsForVerticalLayout.map(({ row, rowIndex, isEmptyPlaceholder }, displayIndex) => (
                <td
                  key={`${col.id}-${rowIndex}-${displayIndex}`}
                  style={verticalBodyCellStyle}
                  data-source-field-id={isEmptyPlaceholder ? undefined : getSourceFieldId(rowIndex, col.id)}
                >
                  {isEmptyPlaceholder
                    ? emptyStateText
                    : isModalMode
                      ? <div>{_formatCellValue(row, col)}</div>
                      : renderEditorInput(row, rowIndex, col, updateCell, true, getRowLock(row).locked)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
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
        {isVertical ? renderVerticalTable() : (
        <table style={tableStyle}>
          <thead>
            <tr style={headerRowStyle}>
              {showRowNumbers && (
                <th key="row-number" style={rowNumberHeaderStyle}>#</th>
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
                <th key="actions" className="hideonprint" style={{ ...headerCellStyle, width: "96px" }} />
              )}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && isModalMode ? (
              <tr key="empty">
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
                const rowLock = getRowLock(row)
                const rowReadOnly = !!rowLock.locked
                // Any row can be removed (not just the last): removal shifts
                // later rows up a slot, which the per-row source mapping
                // handles. Rows with values still need allowDeleteNonEmpty.
                // An authorship-locked row cannot be deleted by another user.
                const canDeleteInline =
                  currentRows.length > 1 &&
                  rowIndex < currentRows.length &&
                  allowDeleteRows &&
                  !rowReadOnly &&
                  (allowDeleteNonEmpty || isEmpty)

                return (
                  <tr key={row?._rowId || `row_${rowIndex}`} title={rowReadOnly ? rowLock.note : undefined}>
                    {showRowNumbers && (
                      <td key="row-number" style={rowNumberCellStyle}>
                        {isModalMode ? (
                          <Text>{displayIndex + 1}</Text>
                        ) : (
                          <Stack horizontal verticalAlign="center" horizontalAlign="center" tokens={{ childrenGap: 4 }}>
                            <Text>{displayIndex + 1}</Text>
                            {canDeleteInline && !isLocked && (
                              <IconButton
                                iconProps={{ iconName: "Delete" }}
                                title="Remove row"
                                onClick={() => removeRowAt(rowIndex)}
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
                          : renderEditorInput(row, rowIndex, col, updateCell, true, rowReadOnly)}
                      </td>
                    ))}
                    {(isModalMode && shouldShowActions) && (
                      <td key="actions" className="hideonprint" style={bodyCellStyle}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          {allowDeleteRows && !rowReadOnly && (
                            <IconButton
                              iconProps={{ iconName: "Delete" }}
                              title="Delete"
                              ariaLabel="Delete"
                              onClick={() => removeRowAt(rowIndex)}
                            />
                          )}
                          {allowEditRows && !rowReadOnly && (
                            <IconButton
                              iconProps={{ iconName: "Edit" }}
                              title="Edit"
                              ariaLabel="Edit"
                              onClick={() => openEditDialog(rowIndex)}
                            />
                          )}
                          {rowReadOnly && (
                            <Text variant="small" styles={{ root: { color: "#a4262c", alignSelf: "center" } }}>
                              {rowLock.note}
                            </Text>
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
        )}
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
            {modalColumns.filter((column) => _evaluateColumnVisibility(column, draftRow)).map((column) => (
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
  return _normalizeTableColumns(columnDefs).map((def) => ({
    id: def.id,
    title: def.title || def.id,
    type: def.type || "text",
    dataPath: def.dataPath,
    showInTable: def.showInTable,
    showInModal: def.showInModal,
    visibility: def.visibility,
    width: def.width,
    placeholder: def.placeholder,
    options: def.options,
    min: def.min,
    max: def.max,
    step: def.step,
    booleanLabels: def.booleanLabels,
    prefill: def.prefill,
    useToggleSwitch: def.useToggleSwitch,
  }))
}
