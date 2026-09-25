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
  Checkbox,
  ChoiceGroup,
} = Fluent

if (typeof EditableTable === "undefined") {
  window.EditableTable = null
}

const _getDefaultCellValue = (column = {}) => {
  if (column.type === "checkbox") return column.prefill === true ? true : false
  // A starting value the filler can change (e.g. 7.5 hours per shift).
  if (typeof column.prefill === "string" || typeof column.prefill === "number") return String(column.prefill)
  return ""
}

const _formatLocalDate = (date) => {
  const pad2 = (value) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

// SMOIS DateSelect calls onChange with a Date; preview supplies a date string.
// Store the local calendar day, avoiding an implicit UTC conversion.
const _normalizeDateCellValue = (value) => {
  if (value && typeof value.getFullYear === "function") {
    return Number.isNaN(value.getTime()) ? "" : _formatLocalDate(value)
  }
  return typeof value === "string" ? value : ""
}

const _todayDateValue = () => _formatLocalDate(new Date())

const _addDaysToDateValue = (value, days = 1) => {
  if (!value) return ""
  const text = String(value).trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(text)
  if (Number.isNaN(date.getTime())) return ""
  date.setDate(date.getDate() + days)
  return _formatLocalDate(date)
}

const _makeEmptyRow = (columns = [], rowIndex = 0) => {
  const row = { _rowId: `row_${rowIndex}_${Date.now()}` }
  columns.forEach((col) => {
    const path = col.dataPath || col.id
    _setValueAtPath(row, path, _getDefaultCellValue(col))
  })
  return row
}

const _applyDefaultValuesToRow = (row, fields = [], context = {}) => {
  if (!row || !Array.isArray(fields)) return row
  fields.forEach((field) => {
    if (!field || typeof field !== "object" || typeof field.defaultValue === "undefined") return
    const fieldId = field.id
    if (!fieldId) return
    const currentValue = _getValueAtPath(row, fieldId)
    if (_isMeaningfulValue(currentValue)) return
    _setValueAtPath(row, fieldId, _resolveFieldDefaultValue(field.defaultValue, context))
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

const _combinedTextValue = (row, column) => {
  const authored = _getValueAtPath(row, column.dataPath || column.id)
  if (!column.textContinuation || _isMeaningfulValue(authored)) return authored
  const first = _getValueAtPath(row, column.textContinuation.firstPath)
  const second = _getValueAtPath(row, column.textContinuation.secondPath)
  return [first, second].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ")
}

const _splitContinuationText = (value, firstSegmentMaxChars) => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim()
  const maxChars = Math.max(1, Number(firstSegmentMaxChars) || 12)
  if (normalized.length <= maxChars) return [normalized, ""]
  const wordBoundary = normalized.lastIndexOf(" ", maxChars)
  const splitAt = wordBoundary > 0 ? wordBoundary : maxChars
  return [normalized.slice(0, splitAt).trim(), normalized.slice(splitAt).trim()]
}

const _resolvePathValue = (root, path) => {
  if (!root || !path) return undefined
  return String(path)
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((current, segment) => {
      if (current == null) return undefined
      if (Array.isArray(current) && /^\d+$/.test(segment)) return current[Number(segment)]
      return typeof current === "object" ? current[segment] : undefined
    }, root)
}

const _resolveLiteralValue = (value, context) => {
  if (value === "$now") return new Date().toISOString()
  if (value === "$today") return new Date().toISOString().slice(0, 10)
  if (value === "$userInitials") return _resolvePathValue(context, "userProfile.identity.initials")
  if (value === "$userFullName") return _resolvePathValue(context, "userProfile.identity.fullName")
  if (value === "$userLoginName") return _resolvePathValue(context, "userProfile.loginName")
  return value
}

const _resolveFieldDefaultValue = (defaultValue, context = {}) => {
  if (!defaultValue || typeof defaultValue !== "object" || Array.isArray(defaultValue)) {
    return defaultValue
  }

  if (defaultValue.kind === "today") return _todayDateValue()

  if (defaultValue.kind === "nextDateAfterLastRow") {
    const sourceColumn = defaultValue.sourceColumn || "Date"
    const rows = Array.isArray(context.currentRows) ? context.currentRows : []
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const candidate = _getValueAtPath(rows[index], sourceColumn)
      const nextDate = _addDaysToDateValue(candidate, 1)
      if (nextDate) return nextDate
    }
    return _todayDateValue()
  }

  return defaultValue
}

const _normalizeStampCellValue = (value) => {
  if (value == null) return ""
  if (typeof value === "object") {
    return String(value.display ?? value.text ?? value.name ?? value.value ?? value.code ?? "")
  }
  return String(value)
}

const _resolveStampCellValue = (column = {}, context = {}) => {
  const config = column.stampConfig || {}
  const sourcePath = String(config.sourcePath || "userProfile.identity.initials").trim()
  const raw = sourcePath
    ? _resolvePathValue(context, sourcePath)
    : _resolveLiteralValue(config.value ?? "$userInitials", context)
  const fallback = _resolveLiteralValue(config.fallback ?? "", context)
  return _normalizeStampCellValue(raw ?? fallback)
}

const _normalizeRows = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.rows)) return value.rows
  return null
}

const _cloneRow = (row = {}, columns = []) => {
  const copy = JSON.parse(JSON.stringify(row || {}))
  copy._rowId = row?._rowId || copy._rowId || `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
  return columns.every((col) => {
    // Calculated cells and untouched starting values are not answers.
    if (col?.computedValue?.mode === "formula") return true
    const value = _getValueAtPath(row, col.dataPath || col.id)
    if (col.type !== "checkbox" && col.prefill !== undefined && col.prefill !== null && _stringifyValue(value) === String(col.prefill)) return true
    return !_isMeaningfulValue(value)
  })
}

const _isRowEmptyWithMappedFields = (row, columns, rowMapping) => {
  if (!_isRowEmpty(row, columns)) return false
  return Object.keys(rowMapping || {}).every((fieldId) => !_isMeaningfulValue(_getValueAtPath(row, fieldId)))
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

const _stampColumnLocksRow = (column = {}) => (
  column?.type === "stampButton" && column?.stampConfig?.lockRowUntilPersisted === true
)

const _hasStampedLockValue = (row = {}, column = {}) => {
  if (!_stampColumnLocksRow(column)) return false
  return _stringifyValue(_getValueAtPath(row, column.dataPath || column.id)).length > 0
}

const _getLocalStampLock = (row = {}, columns = []) => {
  const lockColumns = columns.filter((column) => _hasStampedLockValue(row, column))
  if (lockColumns.length === 0) return { locked: false, columns: [] }
  return {
    locked: true,
    columns: lockColumns,
    note: "Initialed row is locked until the stamp is cleared or the form is submitted.",
  }
}

const _hasPersistedAuthorshipClaim = (rowLock = {}) => (
  !!rowLock?.claim && rowLock.claim.status !== "pending" && rowLock.claim.status !== "unlocked"
)

const _formatCellValue = (row, column) => {
  if (column?.computedValue?.mode === "template") {
    const computed = _computeTemplateColumnValue(row, column)
    if (_isMeaningfulValue(computed)) return computed
  }
  const value = column.textContinuation
    ? _combinedTextValue(row, column)
    : _getValueAtPath(row, column.dataPath || column.id)
  // Choice cells store the option's code; show its wording.
  if (column.type === "dropdown" && !column.codeSystem && (typeof value === "string" || Array.isArray(value))) {
    const options = _normalizeChoiceOptions(column.options)
    const wording = (code) => options.find((option) => String(option.key) === String(code))?.text ?? code
    return _stringifyValue(Array.isArray(value) ? value.map(wording) : wording(value))
  }
  if (column.type === "checkbox") {
    if (value === undefined || value === null || value === "") return ""
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
  return _applyFormulaColumns(nextRow, columns)
}

// Formula columns: `computedValue: { mode: "formula", expression, calculationPolicy?,
// precision?, incompleteBehavior? }`. The expression uses ComputedField's syntax
// (FormulaKit) and reads the same row: `[columnId]` is that row's cell, e.g.
// `weekdaysBetween([from], [to]) * [hoursPerShift]`.
//
// calculationPolicy (ComputedField's names):
// - "always-calculated": read-only, recalculated on every change;
// - "calculated-until-overridden" (default): the filler may type over it; the
//   row remembers that in `_formulaOverrides` and a reset icon restores the
//   calculation;
// - "suggested-calculation": the same, but the calculation is only offered
//   (via the reset icon) and never replaces what the filler typed.
const _FORMULA_OVERRIDES_KEY = "_formulaOverrides"

const _isFormulaColumn = (column) =>
  column?.computedValue?.mode === "formula" && typeof column.computedValue.expression === "string"

const _formulaPolicy = (column) => {
  const policy = column?.computedValue?.calculationPolicy
  return policy === "always-calculated" || policy === "suggested-calculation" ? policy : "calculated-until-overridden"
}

const _isFormulaOverridden = (row, column) =>
  !!row?.[_FORMULA_OVERRIDES_KEY]?.[column.id]

const _setFormulaOverride = (row, column, overridden) => {
  const overrides = { ...(row[_FORMULA_OVERRIDES_KEY] || {}) }
  if (overridden) overrides[column.id] = true
  else delete overrides[column.id]
  if (Object.keys(overrides).length) row[_FORMULA_OVERRIDES_KEY] = overrides
  else delete row[_FORMULA_OVERRIDES_KEY]
}

const _rowFormulaValues = (row, columns = []) => {
  const values = {}
  columns.forEach((column) => {
    const path = column.dataPath || column.id
    const value = _getValueAtPath(row, path)
    values[column.id] = value
    if (path !== column.id) values[path] = value
  })
  return values
}

// The calculated value for one cell, as stored text ("" when the formula's
// inputs are incomplete or it cannot be evaluated).
const _computeFormulaCellValue = (row, column, columns = []) => {
  const config = column.computedValue
  const values = _rowFormulaValues(row, columns)
  if (config.incompleteBehavior !== "compute-anyway" && !FormulaKit.hasAllReferencedValues(config.expression, values)) return ""
  const precision = Number(config.precision)
  const result = FormulaKit.roundValue(FormulaKit.evaluate(config.expression, values, column.id), Number.isFinite(precision) ? precision : 2)
  if (result === null || result === undefined || result === "") return ""
  if (typeof result === "boolean") return result ? "true" : "false"
  return String(result)
}

// Recalculate every formula cell the filler has not taken over, in column
// order so a formula may read an earlier formula column.
const _applyFormulaColumns = (row, columns = []) => {
  if (!row || !columns.some(_isFormulaColumn)) return row
  const nextRow = row
  columns.forEach((column) => {
    if (!_isFormulaColumn(column)) return
    const policy = _formulaPolicy(column)
    if (policy !== "always-calculated" && _isFormulaOverridden(nextRow, column)) return
    const computed = _computeFormulaCellValue(nextRow, column, columns)
    const path = column.dataPath || column.id
    // A suggestion fills an empty cell but never replaces a typed answer.
    if (policy === "suggested-calculation" && _isMeaningfulValue(_getValueAtPath(nextRow, path))) return
    _setValueAtPath(nextRow, path, computed)
  })
  return nextRow
}

// Write one cell and recalculate the row. Typing into a formula cell marks it
// overridden (unless the typed value is the calculation itself).
const _writeCellAndRecalculate = (row, column, value, columns = []) => {
  _setValueAtPath(row, column.dataPath || column.id, value)
  if (column.textContinuation?.firstPath && column.textContinuation?.secondPath) {
    const [first, second] = _splitContinuationText(value, column.textContinuation.firstSegmentMaxChars)
    _setValueAtPath(row, column.textContinuation.firstPath, first)
    _setValueAtPath(row, column.textContinuation.secondPath, second)
  }
  // A choice can represent distinct checkboxes on the source PDF. Preserve
  // every selected option for multi-select choices, and clear deselected ones.
  const selectedValues = new Set(
    (Array.isArray(value) ? value : [value]).map((entry) => String(entry))
  )
  Object.entries(column.choiceBooleanTargets || {}).forEach(([optionKey, targetPath]) => {
    _setValueAtPath(row, targetPath, selectedValues.has(optionKey))
  })
  if (_isFormulaColumn(column) && _formulaPolicy(column) !== "always-calculated") {
    const typed = _stringifyValue(value)
    const calculated = _computeFormulaCellValue(row, column, columns)
    _setFormulaOverride(row, column, typed !== "" && typed !== calculated)
  }
  return _clearHiddenColumnAnswers(_applyFormulaColumns(row, columns), columns)
}

const _resetFormulaCell = (row, column, columns = []) => {
  _setFormulaOverride(row, column, false)
  _setValueAtPath(row, column.dataPath || column.id, _computeFormulaCellValue(row, column, columns))
  return _applyFormulaColumns(row, columns)
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
  let lastMeaningfulRowIndex = -1

  for (let rowIndex = 0; rowIndex < inferredRowCount; rowIndex += 1) {
    const row = _makeEmptyRow(columns, rowIndex)
    let hasMeaningfulValue = false
    const explicitRowMapping = sourceFieldIdsByRow?.[rowIndex] || null

    columns.forEach((column) => {
      const sourceFieldId = explicitRowMapping?.[column.id]
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

    // A compact summary table may edit additional PDF-backed row values in its
    // SubformScoring modal. Those values are mapped by row but are not display
    // columns, so restore them when loading existing form data as well.
    Object.entries(explicitRowMapping || {}).forEach(([columnId, sourceFieldId]) => {
      if (columns.some((column) => column.id === columnId)) return
      const rawValue = fieldData[sourceFieldId]
      if (rawValue === undefined || rawValue === null) return
      _setValueAtPath(row, columnId, rawValue)
      if (_isMeaningfulValue(rawValue)) hasMeaningfulValue = true
    })

    columns.forEach((column) => {
      const selected = Object.entries(column.choiceBooleanTargets || {})
        .filter(([, targetPath]) => _isMeaningfulValue(_getValueAtPath(row, targetPath)))
        .map(([optionKey]) => optionKey)
      if (selected.length > 0) {
        _setValueAtPath(row, column.dataPath || column.id,
          column.choiceStyle === "multiselect" || column.choiceStyle === "checkbox"
            ? selected : selected[0])
      }
    })
    columns.forEach((column) => {
      if (!column.textContinuation) return
      _setValueAtPath(row, column.dataPath || column.id, _combinedTextValue(row, column))
    })

    rows.push(row)
    if (hasMeaningfulValue) {
      lastMeaningfulRowIndex = rowIndex
    }
  }

  return lastMeaningfulRowIndex >= 0 ? rows.slice(0, lastMeaningfulRowIndex + 1) : []
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

const _choiceValueToCoding = (value, options = []) => {
  if (value === undefined || value === null || value === "") return null
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const code = value.code ?? value.value ?? value.key ?? value.selectedKey
    if (code === undefined || code === null || code === "") return null
    const display = value.display ?? value.text ?? value.label ?? value.response ?? code
    return { code: String(code), display: String(display) }
  }
  const code = String(value)
  const option = options.find((entry) => String(entry.key) === code)
  return { code, display: option?.text || code }
}

const _choiceValueForControl = (value, selectionType, options = []) => {
  if (selectionType === "multiple") {
    const values = Array.isArray(value) ? value : value ? [value] : []
    return values.map((entry) => _choiceValueToCoding(entry, options)).filter(Boolean)
  }
  return _choiceValueToCoding(value, options) || undefined
}

const _choiceValueForStorage = (coding, codings, selectionType) =>
  selectionType === "multiple"
    ? (codings || []).map((entry) => entry?.code).filter(Boolean)
    : coding?.code || ""

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

  for (const column of columns) {
    if (column.requiredWhenVisible !== true || !_evaluateColumnVisibility(column, row)) continue
    if (_isMeaningfulValue(_getValueAtPath(row, column.dataPath || column.id))) continue
    return `${column.title || column.label || column.id} is required.`
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
        type: column.withTime ? "datetime" : "date",
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
        choiceStyle: column.choiceStyle || "dropdown",
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
    case "stampButton":
      return withCommon({
        id: fieldId,
        label,
        type: "text",
        placeholder: column.placeholder,
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

const _clearHiddenColumnAnswers = (row, columns = []) => {
  if (!row) return row
  columns.forEach((column) => {
    if (column.visibility?.hiddenAnswerPolicy !== "clear" || _evaluateColumnVisibility(column, row)) return
    _setValueAtPath(row, column.dataPath || column.id, column.type === "checkbox" ? false : "")
    Object.values(column.choiceBooleanTargets || {}).forEach((targetPath) => {
      _setValueAtPath(row, targetPath, false)
    })
  })
  return row
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
  // Row dialog width in px (Fluent caps a Dialog at 340px unless told otherwise).
  modalWidth = 640,
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
  showAuthorshipColumn = false,
  authorshipColumnLabel = "Lock",
  sourceFieldIds = {},
  sourceFieldIdsByRow = {},
  rowsPath,
  countPath,
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
  const showRowAuthorshipColumn = !!(
    authorshipEnabled &&
    authorshipPolicy?.granularity === "row" &&
    (showAuthorshipColumn || authorshipPolicy?.showStatusColumn)
  )
  const getRowLock = (row) => {
    if (!authorshipEnabled || !row?._rowId) return { locked: false }
    const actor = nhAuth.actor(sd, fd)
    return nhAuth.lockInfo(fd, sd, { scope: "row", componentId: id, rowKey: row._rowId }, {
      ownerName: actor.ownerName,
      ownerId: actor.ownerId,
      now: sd?.previewOptions?.authorshipNow,
    })
  }
  const renderRowAuthorshipStatus = (rowLock) => {
    const claim = rowLock?.claim
    if (!claim) return <Text variant="small" styles={{ root: { color: isDarkMode ? "#9ca3af" : "#666666" } }}>Open</Text>
    const owner = claim.ownerName || claim.ownerId || "Unknown"
    const savedAt = nhAuth?.formatTimestamp ? nhAuth.formatTimestamp(claim.lastSavedAt || claim.timestamp || claim.claimedAt) : ""
    return (
      <Stack tokens={{ childrenGap: 2 }}>
        <Text variant="small" styles={{ root: { fontWeight: 600, color: isDarkMode ? "#f3f4f6" : "#323130" } }}>
          {owner}
        </Text>
        {savedAt ? (
          <Text variant="small" styles={{ root: { color: isDarkMode ? "#9ca3af" : "#605e5c" } }}>
            {savedAt}
          </Text>
        ) : null}
      </Stack>
    )
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
  const effectiveMaxRows = Number(maxRows) > 0 ? Number(maxRows) : Number.POSITIVE_INFINITY
  const modalEditorConfig = props.modalEditorConfig || null
  const processingConfig = props.processingConfig || modalEditorConfig?.processingConfig || null
  const validationConfig = props.validationConfig || modalEditorConfig?.validationConfig || null
  const isRequiredModalColumn = (column) => column.requiredWhenVisible === true ||
    (Array.isArray(validationConfig?.requiredPaths) ? validationConfig.requiredPaths : []).some((entry) =>
      (typeof entry === "string" ? entry : entry?.path) === (column.dataPath || column.id))
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
  const saveAndAddNextConfig =
    subformModalConfig?.saveAndAddNext && typeof subformModalConfig.saveAndAddNext === "object"
      ? subformModalConfig.saveAndAddNext
      : null
  const saveAndAddNextLabel =
    typeof saveAndAddNextConfig?.label === "string" && saveAndAddNextConfig.label.trim()
      ? saveAndAddNextConfig.label.trim()
      : "Save & Add Next"

  const getRows = () => {
    try {
      const data = _getValueAtPath(fd?.field?.data, rowsPath || id)
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

    // Commit ONLY this table's keys through a produce recipe. Never spread the
    // captured fd snapshot into setFormData: object payloads replace state
    // wholesale, clobber concurrent writes from sibling components (two tables
    // seeding on mount ping-ponged into a React #185 update loop), and bypass
    // the no-op bailout that recipe writes get from immer.
    fd.setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const data = draft.field.data
      _setValueAtPath(data, rowsPath || id, nextRows)
      if (countPath) _setValueAtPath(data, countPath, Array.isArray(nextRows) ? nextRows.length : 0)

      mirroredFieldIds.forEach((fieldId) => {
        data[fieldId] = null
      })

      ;(Array.isArray(nextRows) ? nextRows : []).forEach((row, rowIndex) => {
        columns.forEach((column) => {
          const sourceFieldId = getSourceFieldId(rowIndex, column.id)
          if (!sourceFieldId) return
          const rawValue = _getValueAtPath(row, column.dataPath || column.id)
          data[sourceFieldId] = _normalizeMirroredCellValue(rawValue, column)
        })
        // Modal-only row values have source mappings too, even though they are
        // absent from the two summary columns. Mirror them for PDF regeneration.
        Object.entries(sourceFieldIdsByRow?.[rowIndex] || {}).forEach(([columnId, sourceFieldId]) => {
          if (!sourceFieldId || columns.some((column) => column.id === columnId)) return
          data[sourceFieldId] = _normalizeMirroredCellValue(_getValueAtPath(row, columnId))
        })
      })

      // Lock-on-edit: stamp the editing author's claim onto field.data.__authorship
      // for this row, carried inside the same write. nhAuth.claim mutates the
      // draft's data object in place.
      if (authorshipClaim && authorshipEnabled && authorshipClaim.rowId) {
        nhAuth.claim(
          { field: { data } },
          sd,
          { scope: "row", componentId: id, rowKey: authorshipClaim.rowId },
          authorshipClaim.value,
          authorshipPolicy,
          { now: sd?.previewOptions?.authorshipNow }
        )
      }
    }))
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

    const seededRows = isModalMode && modalEditorConfig?.seedInitialRows !== true
      ? []
      : initialSeedRows.length > 0
        ? initialSeedRows
        : Array.from({ length: initialRowCount }, (_, index) => _makeEmptyRow(columns, index))
    setRows(seededRows)
  }, [rows, isModalMode, initialSeedRows, initialRowCount, id, columns, rowsPath, countPath])

  useEffect(() => {
    if (sourceSeedRows.length === 0) return

    const existingRows = Array.isArray(rows) ? rows : []
    const hasMeaningfulRows = existingRows.some((row, rowIndex) =>
      !_isRowEmptyWithMappedFields(row, columns, sourceFieldIdsByRow?.[rowIndex]))
    if (hasMeaningfulRows) return
    // Convergence guard: compare row CONTENT with the volatile _rowId stripped.
    // Seed builders stamp Date.now()-based _rowIds, so raw JSON never matches
    // and the reseed would rewrite state on every render — this exact table
    // seeding sustained a React #185 update loop (two seeded tables, 2026-07-02).
    const _rowContentSignature = (rowList) => JSON.stringify(
      rowList.map((row) => {
        const { _rowId, ...rest } = row || {}
        return rest
      })
    )
    if (_rowContentSignature(existingRows) === _rowContentSignature(sourceSeedRows)) return

    setRows(sourceSeedRows)
  }, [rows, columns, setRows, sourceSeedRows])

  const currentRows = Array.isArray(rows) ? rows : []
  const canSaveAndAddNext =
    Boolean(saveAndAddNextConfig) &&
    editingRowIndex === null &&
    allowAddRows &&
    !isLocked &&
    currentRows.length + 1 < effectiveMaxRows

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

  const makeDraftRow = (rowIndex = currentRows.length) => {
    const nextRow = _makeEmptyRow(columns, rowIndex)
    return _applyDefaultValuesToRow(nextRow, modalEditorConfig?.dataEntryConfig?.fields, {
      currentRows,
      columns,
      rowIndex,
      sd,
      sourceData: sd,
      userProfile: sd?.userProfile,
      fd,
    })
  }

  const openCreateDialog = () => {
    if (isLocked || !allowAddRows || currentRows.length >= effectiveMaxRows) return
    if (modalEditorConfig?.seedInitialRows === true) {
      const emptyRowIndex = currentRows.findIndex((row, rowIndex) =>
        _isRowEmptyWithMappedFields(row, columns, sourceFieldIdsByRow?.[rowIndex]))
      if (emptyRowIndex >= 0) {
        openEditDialog(emptyRowIndex)
        return
      }
    }
    setEditingRowIndex(null)
    setDraftRow(makeDraftRow(currentRows.length))
    setErrorMessage("")
    setIsDialogOpen(true)
  }

  const openEditDialog = (rowIndex) => {
    if (isLocked || !allowEditRows) return
    const row = currentRows[rowIndex]
    if (!row) return
    if (authorshipEnabled && getRowLock(row).locked) return
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
    const rowLock = getRowLock(currentRows[rowIndex])
    if (
      isLocked ||
      (authorshipEnabled && rowLock.locked) ||
      (!_hasPersistedAuthorshipClaim(rowLock) && _getLocalStampLock(currentRows[rowIndex], columns).locked)
    ) return
    const nextRows = [...currentRows]
    if (!nextRows[rowIndex]) {
      nextRows[rowIndex] = _makeEmptyRow(columns, rowIndex)
    }
    const nextRow = _cloneRow(nextRows[rowIndex], columns)
    const column = columns.find((item) => item.id === columnId) || { id: columnId, dataPath: columnId }
    _writeCellAndRecalculate(nextRow, column, value, columns)
    nextRows[rowIndex] = nextRow
    commitRows(nextRows, {
      reason: "update",
      rowIndex,
      row: nextRow,
      previousRows: currentRows,
    }, { rowId: nextRow._rowId, value })
  }

  const stampCell = (rowIndex, column) => {
    if (isLocked) return
    if (authorshipEnabled && getRowLock(currentRows[rowIndex]).locked) return
    const nextRows = [...currentRows]
    if (!nextRows[rowIndex]) {
      nextRows[rowIndex] = _makeEmptyRow(columns, rowIndex)
    }
    const nextRow = _cloneRow(nextRows[rowIndex], columns)
    const signedAt = new Date().toISOString()
    const stampPath = column.dataPath || column.id
    const hasStampedValue = _stringifyValue(_getValueAtPath(nextRow, stampPath)).length > 0
    const shouldToggleLocalLock =
      _stampColumnLocksRow(column) &&
      hasStampedValue &&
      column.stampConfig?.allowResign !== false

    if (shouldToggleLocalLock) {
      _setValueAtPath(nextRow, stampPath, "")
      if (column.stampConfig?.signedAtPath) {
        _setValueAtPath(nextRow, column.stampConfig.signedAtPath, "")
      }
      nextRows[rowIndex] = nextRow
      commitRows(nextRows, {
        reason: "unstamp",
        rowIndex,
        row: nextRow,
        previousRows: currentRows,
      }, { rowId: nextRow._rowId, value: nextRow })
      return
    }

    const value = _resolveStampCellValue(column, {
      sd,
      sourceData: sd,
      userProfile: sd?.userProfile,
      webform: sd?.webform,
      patient: sd?.patient,
      formParams: sd?.formParams,
      fd,
      field: fd?.field?.data || {},
      formData: fd?.formData || {},
      tableId: id,
      row: nextRow,
    })
    _setValueAtPath(nextRow, stampPath, value)
    if (column.stampConfig?.signedAtPath) {
      _setValueAtPath(nextRow, column.stampConfig.signedAtPath, signedAt)
    }
    nextRows[rowIndex] = nextRow
    commitRows(nextRows, {
      reason: "stamp",
      rowIndex,
      row: nextRow,
      previousRows: currentRows,
    }, { rowId: nextRow._rowId, value })
  }

  const updateDraftCell = (columnId, value) => {
    if (_getLocalStampLock(draftRow || {}, columns).locked) return
    const nextDraft = _cloneRow(draftRow || _makeEmptyRow(columns, currentRows.length), columns)
    const column = columns.find((item) => item.id === columnId) || { id: columnId, dataPath: columnId }
    _writeCellAndRecalculate(nextDraft, column, value, columns)
    setDraftRow(nextDraft)
  }

  const resetFormulaCell = (rowIndex, column) => {
    if (isLocked) return
    if (authorshipEnabled && getRowLock(currentRows[rowIndex]).locked) return
    const nextRows = [...currentRows]
    if (!nextRows[rowIndex]) nextRows[rowIndex] = _makeEmptyRow(columns, rowIndex)
    const nextRow = _resetFormulaCell(_cloneRow(nextRows[rowIndex], columns), column, columns)
    nextRows[rowIndex] = nextRow
    commitRows(nextRows, {
      reason: "update",
      rowIndex,
      row: nextRow,
      previousRows: currentRows,
    }, { rowId: nextRow._rowId, value: _getValueAtPath(nextRow, column.dataPath || column.id) })
  }

  const resetDraftFormulaCell = (column) => {
    const nextDraft = _cloneRow(draftRow || _makeEmptyRow(columns, currentRows.length), columns)
    setDraftRow(_resetFormulaCell(nextDraft, column, columns))
  }

  const stampDraftCell = (column) => {
    if (isLocked) return
    const nextDraft = _cloneRow(draftRow || _makeEmptyRow(columns, currentRows.length), columns)
    const signedAt = new Date().toISOString()
    const stampPath = column.dataPath || column.id
    const hasStampedValue = _stringifyValue(_getValueAtPath(nextDraft, stampPath)).length > 0
    const shouldToggleLocalLock =
      _stampColumnLocksRow(column) &&
      hasStampedValue &&
      column.stampConfig?.allowResign !== false

    if (shouldToggleLocalLock) {
      _setValueAtPath(nextDraft, stampPath, "")
      if (column.stampConfig?.signedAtPath) {
        _setValueAtPath(nextDraft, column.stampConfig.signedAtPath, "")
      }
      setDraftRow(nextDraft)
      return
    }

    const value = _resolveStampCellValue(column, {
      sd,
      sourceData: sd,
      userProfile: sd?.userProfile,
      webform: sd?.webform,
      patient: sd?.patient,
      formParams: sd?.formParams,
      fd,
      field: fd?.field?.data || {},
      formData: fd?.formData || {},
      tableId: id,
      row: nextDraft,
    })
    _setValueAtPath(nextDraft, stampPath, value)
    if (column.stampConfig?.signedAtPath) {
      _setValueAtPath(nextDraft, column.stampConfig.signedAtPath, signedAt)
    }
    setDraftRow(nextDraft)
  }

  const updateDraftValueAtPath = useCallback((fieldPath, value) => {
    const nextDraft = _cloneRow(draftRow || _makeEmptyRow(columns, currentRows.length), columns)
    const column = columns.find((item) => (item.dataPath || item.id) === fieldPath)
    if (column) {
      _writeCellAndRecalculate(nextDraft, column, value, columns)
    } else {
      _setValueAtPath(nextDraft, fieldPath, value)
      _applyFormulaColumns(nextDraft, columns)
    }
    setDraftRow(nextDraft)
  }, [draftRow, columns, currentRows.length])

  const removeRowAt = (rowIndex) => {
    if (isLocked || !allowDeleteRows) return
    const deletedRow = currentRows[rowIndex]
    if (authorshipEnabled && getRowLock(deletedRow).locked) return
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

  const prepareSave = () => {
    if (!draftRow) return null
    if (isLocked) return null
    if (
      authorshipEnabled &&
      editingRowIndex !== null &&
      getRowLock(currentRows[editingRowIndex]).locked
    ) return null

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
        return null
      }
    }

    if (!resolvedRow || typeof resolvedRow !== "object") {
      setErrorMessage("Row save failed because the row data was invalid.")
      return null
    }

    _clearHiddenColumnAnswers(resolvedRow, columns)
    const validationError = validateResolvedRow(resolvedRow)
    if (validationError) {
      setErrorMessage(validationError)
      return null
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
    }, { rowId: normalizedRow._rowId, value: normalizedRow })

    return { normalizedRow, savedRowIndex, sortedRows }
  }

  const commitSave = (options = {}) => {
    const saved = prepareSave()
    if (!saved) return false
    const { normalizedRow, savedRowIndex, sortedRows } = saved
    onRowSaved?.(normalizedRow, buildRowContext(normalizedRow, {
      rowIndex: savedRowIndex,
      reason: editingRowIndex === null ? "create" : "edit",
      previousRows: currentRows,
      nextRows: sortedRows,
    }))
    if (options.addNext && editingRowIndex === null && sortedRows.length < effectiveMaxRows) {
      setEditingRowIndex(null)
      setDraftRow(_applyDefaultValuesToRow(_makeEmptyRow(columns, sortedRows.length), modalEditorConfig?.dataEntryConfig?.fields, {
        currentRows: sortedRows,
        columns,
        rowIndex: sortedRows.length,
        sd,
        sourceData: sd,
        userProfile: sd?.userProfile,
        fd,
      }))
      setErrorMessage("")
      setIsDialogOpen(true)
    } else {
      closeDialog()
    }
    return true
  }

  const saveDraftRow = () => {
    commitSave()
  }

  const addInlineRow = () => {
    if (isLocked || !allowAddRows || currentRows.length >= effectiveMaxRows) return
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
        .filter(({ row, rowIndex }) => modalEditorConfig?.seedInitialRows === true ||
          !_isRowEmptyWithMappedFields(row, columns, sourceFieldIdsByRow?.[rowIndex]))
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
  const remaining = Number.isFinite(effectiveMaxRows)
    ? Math.max(0, effectiveMaxRows - currentRowCount)
    : Number.POSITIVE_INFINITY
  const shouldShowActions = !isLocked && (allowEditRows || allowDeleteRows)

  const renderEditorControl = (row, rowIndex, column, onValueChange, inline, rowReadOnly = false, onStampColumn = null, rowLockState = null, onResetFormula = null) => {
    const value = column.textContinuation
      ? _combinedTextValue(row, column)
      : _getValueAtPath(row, column.dataPath || column.id)
    const realRowReadOnly = !!rowLockState?.authorship?.locked
    const localStampLocked = !!rowLockState?.localStamp?.locked
    const thisStampLocksRow = _hasStampedLockValue(row, column)
    const stampCanUnlockLocalRow =
      column.type === "stampButton" &&
      localStampLocked &&
      thisStampLocksRow &&
      column.stampConfig?.allowResign !== false
    const effectiveReadOnly = isLocked || (rowReadOnly && !stampCanUnlockLocalRow)
    // When the table/row is locked, neutralize edits at the input level so even
    // controls that ignore a readOnly prop cannot write.
    if (effectiveReadOnly) onValueChange = () => {}
    if (effectiveReadOnly) {
      const displayValue = _formatCellValue(row, column)
      return (
        <Text
          styles={{
            root: {
              color: isDarkMode ? "#f3f4f6" : "#323130",
              whiteSpace: "pre-wrap",
            },
          }}
        >
          {displayValue || " "}
        </Text>
      )
    }

    if (_isFormulaColumn(column)) {
      return renderFormulaControl(row, rowIndex, column, value, onValueChange, inline, onResetFormula)
    }

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
            onChange={(valueOrEvent, nextValue) => onValueChange(rowIndex, column.id, _coerceNumberCellValue(nextValue === undefined ? valueOrEvent : nextValue, column))}
            spinButtonProps={spinButtonProps}
            textFieldProps={numberConfig.suffix ? { suffix: numberConfig.suffix } : undefined}
            storeAsNumber={numberConfig.storeAsNumber !== false}
            readOnly={effectiveReadOnly}
            disabled={effectiveReadOnly}
          />
        )

      case "date":
        // withTime columns persist the engine's getDateTimeString shape
        // (YYYY-MM-DDTHH:mm) rather than a bare date.
        if (column.withTime) {
          return (
            <DateTimeSelect
              inline={inline}
              value={value || ""}
              onChange={(newValue) => onValueChange(rowIndex, column.id, newValue || "")}
              placeholder={column.placeholder || "Select date and time"}
              readOnly={effectiveReadOnly}
              disabled={effectiveReadOnly}
            />
          )
        }
        return (
          <DateSelect
            dateFormat={column.dateConfig?.dateFormat}
            inline={inline}
            value={value || ""}
            onChange={(newValue) => onValueChange(rowIndex, column.id, _normalizeDateCellValue(newValue))}
            placeholder={column.placeholder || "Select date"}
            readOnly={effectiveReadOnly}
            disabled={effectiveReadOnly}
          />
        )

      case "dropdown":
        const dropdownOptions = _normalizeChoiceOptions(column.options)
        if (column.choiceStyle === "checkbox") {
          const selected = new Set((Array.isArray(value) ? value : value ? [value] : []).map(String))
          return (
            <Stack tokens={{ childrenGap: 4 }}>
              {dropdownOptions.map((option) => (
                <Checkbox
                  key={option.key}
                  label={option.text}
                  checked={selected.has(option.key)}
                  disabled={effectiveReadOnly}
                  onChange={(_event, checked) => {
                    const next = new Set(selected)
                    if (checked) next.add(option.key)
                    else next.delete(option.key)
                    onValueChange(rowIndex, column.id, Array.from(next))
                  }}
                />
              ))}
            </Stack>
          )
        }
        if (column.choiceStyle === "radio") {
          return (
            <ChoiceGroup
              options={dropdownOptions}
              selectedKey={value ? String(value) : undefined}
              disabled={effectiveReadOnly}
              onChange={(_event, option) => onValueChange(rowIndex, column.id, option?.key || "")}
            />
          )
        }
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
            value={_choiceValueForControl(value, selectionType, dropdownOptions)}
            onChange={(coding, codings) => onValueChange(
              rowIndex,
              column.id,
              _choiceValueForStorage(coding, codings, selectionType)
            )}
            placeholder={column.placeholder || "Select..."}
            showOther={column.showOtherOption === true}
            readOnly={effectiveReadOnly}
            disabled={effectiveReadOnly}
          />
        )

      case "time":
        return (
          <TimeSelect
            inline={inline}
            value={value || ""}
            onChange={(event, newValue) => onValueChange(rowIndex, column.id, newValue || "")}
            placeholder={column.placeholder || "HH:mm"}
            readOnly={effectiveReadOnly}
            disabled={effectiveReadOnly}
          />
        )

      case "checkbox":
        return (
          <OptionChoice
            inline={inline}
            displayStyle="checkmark"
            value={value}
            onChange={(event, checked) => onValueChange(rowIndex, column.id, !!checked)}
            readOnly={effectiveReadOnly}
            disabled={effectiveReadOnly}
          />
        )

      case "stampButton":
        const stampConfig = column.stampConfig || {}
        const stampedValue = _stringifyValue(value)
        const hasStampedValue = stampedValue.length > 0
        const canResign = stampConfig.allowResign !== false
        const disabledStamp =
          isLocked ||
          realRowReadOnly ||
          (localStampLocked && !thisStampLocksRow) ||
          (hasStampedValue && !canResign)
        const ButtonComponent = column.buttonType === "default" ? DefaultButton : PrimaryButton
        return (
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }} wrap>
            <ButtonComponent
              text={hasStampedValue ? (stampConfig.signedLabel || "Initialed") : (stampConfig.buttonLabel || "Initial")}
              disabled={disabledStamp}
              onClick={() => {
                if (disabledStamp) return
                if (typeof onStampColumn === "function") {
                  onStampColumn(rowIndex, column, row)
                } else {
                  onValueChange(rowIndex, column.id, _resolveStampCellValue(column, {
                    sd,
                    sourceData: sd,
                    userProfile: sd?.userProfile,
                    webform: sd?.webform,
                    patient: sd?.patient,
                    formParams: sd?.formParams,
                    fd,
                    field: fd?.field?.data || {},
                    formData: fd?.formData || {},
                    tableId: id,
                    row,
                  }))
                }
              }}
            />
            {stampConfig.showStatus !== false && hasStampedValue ? (
              <Text variant="small" styles={{ root: { color: isDarkMode ? "#c8c8c8" : "#605e5c" } }}>
                {stampedValue}
              </Text>
            ) : null}
          </Stack>
        )

      case "text":
      default:
        return (
          <TextArea
            multiline={column.textareaConfig?.multiline}
            textFieldProps={column.textareaConfig ? { rows: column.textareaConfig.rows, resizable: column.textareaConfig.resizable } : undefined}
            inline={inline}
            value={value || ""}
            onChange={(event, newValue) => onValueChange(rowIndex, column.id, newValue || "")}
            placeholder={column.placeholder || ""}
            readOnly={effectiveReadOnly}
            disabled={effectiveReadOnly}
          />
        )
    }
  }

  // A formula cell: the calculated value, which the filler may type over unless
  // the column is always-calculated. Once it differs from the calculation, a
  // reset icon at the right of the box puts the calculation back.
  const renderFormulaControl = (row, rowIndex, column, value, onValueChange, inline, onResetFormula) => {
    const policy = _formulaPolicy(column)
    const calculated = _computeFormulaCellValue(row, column, columns)
    const current = _stringifyValue(value)
    const numberConfig = _normalizeNumberConfig(column)
    const numeric = column.type === "number" || column.computedValue.resultType === "number"
    const canReset = policy !== "always-calculated" && typeof onResetFormula === "function" && current !== calculated
    const tooltip = calculated
      ? `Reset to the calculated value (${calculated})`
      : "Reset to the calculation (it has no value until its inputs are filled in)"
    const { TooltipHost } = Fluent
    // Fluent paints the suffix slot grey with 10px padding; the wrapper covers
    // that so the icon reads as part of the input (same as ComputedField).
    const renderSuffix = canReset
      ? () => (
          <div style={{ display: "flex", alignItems: "center", alignSelf: "stretch", margin: "0 -10px", padding: "0 2px", background: isDarkMode ? "#1f1f1f" : "#ffffff" }}>
            {numberConfig.suffix ? <span style={{ marginRight: 4 }}>{numberConfig.suffix}</span> : null}
            <TooltipHost content={tooltip}>
              <IconButton
                iconProps={{ iconName: "Refresh" }}
                ariaLabel={tooltip}
                onClick={() => onResetFormula(rowIndex, column)}
                styles={{ root: { width: 26, height: 26 }, icon: { fontSize: 13 } }}
              />
            </TooltipHost>
          </div>
        )
      : undefined
    const readOnly = policy === "always-calculated"
    const textFieldProps = renderSuffix
      ? { onRenderSuffix: renderSuffix }
      : numberConfig.suffix ? { suffix: numberConfig.suffix } : undefined
    if (numeric) {
      // Stored as text: storeAsNumber would turn "7." into 7 while typing.
      return (
        <Numeric
          inline={inline}
          typeNumber="decimal"
          value={current}
          onChange={(valueOrEvent, nextValue) => onValueChange(rowIndex, column.id, String((nextValue === undefined ? valueOrEvent : nextValue) ?? ""))}
          textFieldProps={textFieldProps}
          storeAsNumber={false}
          readOnly={readOnly}
          disabled={readOnly}
        />
      )
    }
    return (
      <TextArea
        inline={inline}
        value={current}
        onChange={(event, newValue) => onValueChange(rowIndex, column.id, newValue || "")}
        textFieldProps={textFieldProps}
        readOnly={readOnly}
        disabled={readOnly}
      />
    )
  }

  // Inline cells render live Fluent controls, which print as empty boxed inputs
  // and make a patient-facing handout unreadable. Mirror the formatted value as
  // print-only text and drop the control on paper — the same split the legacy
  // NHForms tables did by hand. The inline `display: none` keeps the mirror
  // hidden when a host page ships no print stylesheet; the print rule's
  // `!important` overrides it. Dialog editors (inline === false) never print.
  const renderEditorInput = (row, rowIndex, column, onValueChange, inline, rowReadOnly = false, onStampColumn = null, rowLockState = null, onResetFormula = null) => {
    const control = renderEditorControl(row, rowIndex, column, onValueChange, inline, rowReadOnly, onStampColumn, rowLockState, onResetFormula)
    if (!inline) return control
    return (
      <>
        <span className="showonprint" style={{ display: "none", whiteSpace: "pre-wrap" }}>
          {_formatCellValue(row, column) || " "}
        </span>
        <div className="hideonprint">{control}</div>
      </>
    )
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

  const authorshipHeaderCellStyle = {
    ...headerCellStyle,
    width: "150px",
    minWidth: "130px",
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
          {showRowAuthorshipColumn ? (
            <tr key="__authorship">
              <th style={verticalLabelCellStyle}>{authorshipColumnLabel}</th>
              {rowsForVerticalLayout.map(({ row, rowIndex, isEmptyPlaceholder }, displayIndex) => {
                const rowLock = isEmptyPlaceholder ? null : getRowLock(row)
                return (
                  <td
                    key={`__authorship-${rowIndex}-${displayIndex}`}
                    style={verticalBodyCellStyle}
                    title={rowLock?.note || undefined}
                  >
                    {isEmptyPlaceholder ? "" : renderRowAuthorshipStatus(rowLock)}
                  </td>
                )
              })}
            </tr>
          ) : null}
          {tableColumns.map((col) => (
            <tr key={col.id}>
              <th
                style={verticalLabelCellStyle}
                data-source-field-id={sourceFieldIds[col.id] || undefined}
              >
                {col.title || col.id}
              </th>
              {rowsForVerticalLayout.map(({ row, rowIndex, isEmptyPlaceholder }, displayIndex) => {
                const rowLock = isEmptyPlaceholder ? { locked: false } : getRowLock(row)
                const localStampLock =
                  isEmptyPlaceholder || _hasPersistedAuthorshipClaim(rowLock)
                    ? { locked: false, columns: [] }
                    : _getLocalStampLock(row, columns)
                const rowReadOnly = !!(rowLock.locked || localStampLock.locked)
                const rowLockState = { authorship: rowLock, localStamp: localStampLock }

                return (
                  <td
                    key={`${col.id}-${rowIndex}-${displayIndex}`}
                    style={verticalBodyCellStyle}
                    data-source-field-id={isEmptyPlaceholder ? undefined : getSourceFieldId(rowIndex, col.id)}
                    title={rowReadOnly ? rowLock.note || localStampLock.note : undefined}
                  >
                    {isEmptyPlaceholder
                      ? emptyStateText
                      : isModalMode
                        ? col.type === "stampButton"
                          ? renderEditorInput(row, rowIndex, col, updateCell, true, rowReadOnly, stampCell, rowLockState, resetFormulaCell)
                          : <div>{_formatCellValue(row, col)}</div>
                        : renderEditorInput(row, rowIndex, col, updateCell, true, rowReadOnly, stampCell, rowLockState, resetFormulaCell)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const draftLocalStampLock = draftRow ? _getLocalStampLock(draftRow, columns) : { locked: false, columns: [] }
  const draftLockState = { authorship: { locked: false }, localStamp: draftLocalStampLock }

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
              {showRowAuthorshipColumn && (
                <th key="authorship" style={authorshipHeaderCellStyle}>
                  {authorshipColumnLabel}
                </th>
              )}
              {(isModalMode && shouldShowActions) && (
                <th key="actions" className="hideonprint" style={{ ...headerCellStyle, width: "96px" }} />
              )}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && isModalMode ? (
              <tr key="empty">
                <td
                  colSpan={tableColumns.length + (showRowNumbers ? 1 : 0) + (showRowAuthorshipColumn ? 1 : 0) + (shouldShowActions ? 1 : 0)}
                  style={{ ...bodyCellStyle, textAlign: "center", color: isDarkMode ? "#bdbdbd" : "#666666" }}
                >
                  {emptyStateText}
                </td>
              </tr>
            ) : (
              displayRows.map(({ row, rowIndex }, displayIndex) => {
                const isEmpty = _isRowEmptyWithMappedFields(row, columns, sourceFieldIdsByRow?.[rowIndex])
                const rowLock = getRowLock(row)
                const localStampLock = _hasPersistedAuthorshipClaim(rowLock)
                  ? { locked: false, columns: [] }
                  : _getLocalStampLock(row, columns)
                const rowReadOnly = !!(rowLock.locked || localStampLock.locked)
                const rowLockState = { authorship: rowLock, localStamp: localStampLock }
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
                  <tr key={row?._rowId || `row_${rowIndex}`} title={rowReadOnly ? rowLock.note || localStampLock.note : undefined}>
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
                          ? col.type === "stampButton"
                            ? renderEditorInput(row, rowIndex, col, updateCell, true, rowReadOnly, stampCell, rowLockState, resetFormulaCell)
                            : <div>{_formatCellValue(row, col)}</div>
                          : renderEditorInput(row, rowIndex, col, updateCell, true, rowReadOnly, stampCell, rowLockState, resetFormulaCell)}
                      </td>
                    ))}
                    {showRowAuthorshipColumn && (
                      <td key="authorship" style={bodyCellStyle} title={rowLock.note || undefined}>
                        {renderRowAuthorshipStatus(rowLock)}
                      </td>
                    )}
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
        <Stack className="hideonprint" horizontal verticalAlign="center" tokens={{ childrenGap: 12 }} style={{ marginTop: "12px" }}>
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
          {Number.isFinite(remaining) ? (
            <Text style={{ fontSize: "14px", color: isDarkMode ? "#a0a0a0" : "#666666" }}>
              {remaining} more row{remaining !== 1 ? "s" : ""} available
            </Text>
          ) : null}
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
          secondaryCompleteButtonText={canSaveAndAddNext ? saveAndAddNextLabel : undefined}
          cancelButtonText={modalEditorConfig?.cancelButtonText || "Cancel"}
          onSecondaryComplete={canSaveAndAddNext ? () => {
            commitSave({ addNext: true })
            return false
          } : undefined}
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
          minWidth={Math.min(Math.max(340, Number(modalWidth) || 640), typeof window !== "undefined" ? window.innerWidth - 48 : 640)}
          maxWidth="96vw"
          onDismiss={closeDialog}
        >
          <Stack tokens={{ childrenGap: 12 }}>
            {/* Two columns when the dialog has room; choices and long text take a full row. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px 16px" }}>
            {modalColumns.filter((column) => _evaluateColumnVisibility(column, draftRow)).flatMap((column, index, visibleColumns) => [
              ...(column.modalSection && (index === 0 || visibleColumns[index - 1]?.modalSection !== column.modalSection)
                ? [<div key={`section-${column.id}`} style={{ gridColumn: "1 / -1", fontWeight: 600, borderBottom: `1px solid ${isDarkMode ? "#505050" : "#d1d5db"}`, paddingTop: "8px", paddingBottom: "4px" }}>{column.modalSection}</div>]
                : []),
              <div key={column.id} style={column.type === "dropdown" || column.type === "text" ? { gridColumn: "1 / -1" } : undefined}>
                <Label>{column.title || column.id}{isRequiredModalColumn(column) ? " *" : ""}</Label>
                {renderEditorInput(
                  draftRow,
                  editingRowIndex ?? currentRows.length,
                  column,
                  (rowIndex, columnId, value) => updateDraftCell(columnId, value),
                  false,
                  draftLocalStampLock.locked,
                  (_rowIndex, stampColumn) => stampDraftCell(stampColumn),
                  draftLockState,
                  (_rowIndex, formulaColumn) => resetDraftFormulaCell(formulaColumn)
                )}
              </div>,
            ])}
            </div>
            {errorMessage && (
              <Text style={{ color: isDarkMode ? "#ffb3b3" : "#b42318" }}>
                {errorMessage}
              </Text>
            )}
            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
              <DefaultButton text="Cancel" onClick={closeDialog} />
              {canSaveAndAddNext ? (
                <DefaultButton text={saveAndAddNextLabel} onClick={() => commitSave({ addNext: true })} />
              ) : null}
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
    stampConfig: def.stampConfig,
  }))
}
