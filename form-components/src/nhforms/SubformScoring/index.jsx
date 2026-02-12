/**
 * SubformScoring - Modal subform supporting scoring and data-entry modes.
 *
 * mode="scoring": existing behavior, opens ScoringModule in a dialog.
 * mode="data-entry": opens regular fields in a dialog with optional calculations.
 */

const { useState, useMemo, useCallback } = React
const {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  Dialog,
  DialogType,
} = Fluent

// ================================================
// Scoring helpers (same logic as ScoringModule)
// ================================================

const _buildScoreMap = (questions) => {
  const map = new Map()
  for (const question of questions || []) {
    const optionMap = new Map()
    for (const opt of question.options || []) {
      optionMap.set(opt.key, opt.score ?? 0)
    }
    map.set(question.id, optionMap)
  }
  return map
}

const _normalizeScoreToken = (value) => String(value ?? "").trim().toLowerCase()

const _collectScoreCandidates = (value, out = new Set(), depth = 0) => {
  if (depth > 4 || value === null || value === undefined) return out

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const token = String(value).trim()
    if (token) out.add(token)
    return out
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => _collectScoreCandidates(entry, out, depth + 1))
    return out
  }

  if (typeof value !== "object") return out

  const candidateKeys = [
    "code",
    "key",
    "value",
    "id",
    "text",
    "display",
    "label",
    "state",
    "fieldId",
  ]
  candidateKeys.forEach((key) => {
    _collectScoreCandidates(value[key], out, depth + 1)
  })

  if (Array.isArray(value.selectedItems)) {
    value.selectedItems.forEach((entry) => _collectScoreCandidates(entry, out, depth + 1))
  }
  _collectScoreCandidates(value.selectedItem, out, depth + 1)
  if (Array.isArray(value.selectedIds)) {
    value.selectedIds.forEach((entry) => _collectScoreCandidates(entry, out, depth + 1))
  }
  if (Array.isArray(value.selectedLabels)) {
    value.selectedLabels.forEach((entry) => _collectScoreCandidates(entry, out, depth + 1))
  }

  return out
}

const _getScoreFromValue = (value, optionScoreMap) => {
  if (!optionScoreMap) return null

  const candidates = Array.from(_collectScoreCandidates(value))
  if (candidates.length === 0) return null

  for (const candidate of candidates) {
    if (optionScoreMap.has(candidate)) {
      return optionScoreMap.get(candidate)
    }
  }

  const normalizedOptionMap = new Map()
  optionScoreMap.forEach((score, key) => {
    normalizedOptionMap.set(_normalizeScoreToken(key), score)
  })
  for (const candidate of candidates) {
    const direct = normalizedOptionMap.get(_normalizeScoreToken(candidate))
    if (direct !== undefined) return direct
  }

  return null
}

const _isInRange = (score, range) => {
  if (score === null || score === undefined) return false
  const min = range.min
  const max = range.max
  const meetsMin = range.minInclusive !== false ? score >= min : score > min
  const meetsMax = max === null ? true : (range.maxInclusive !== false ? score <= max : score < max)
  return meetsMin && meetsMax
}

const _getInterpretation = (score, ranges) => {
  if (score === null || score === undefined || !ranges?.length) return null
  for (const range of ranges) {
    if (_isInRange(score, range)) {
      return {
        label: range.label,
        range,
        bounds: _formatBounds(range),
      }
    }
  }
  return null
}

const _formatBounds = (range) => {
  const minSymbol = range.minInclusive !== false ? "\u2265" : ">"
  if (range.max === null) return `${minSymbol}${range.min}`
  if (range.min === range.max && range.minInclusive !== false && range.maxInclusive !== false) {
    return `=${range.min}`
  }
  return `${range.min}-${range.max}`
}

// ================================================
// Data-entry helpers
// ================================================

const _isMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") {
    if (Number.isFinite(value.selectedCount)) {
      return Number(value.selectedCount) > 0
    }
    if (value.display) return String(value.display).trim().length > 0
    if (value.text) return String(value.text).trim().length > 0
    if (value.code) return String(value.code).trim().length > 0
    if (value.key) return String(value.key).trim().length > 0
    return Object.keys(value).length > 0
  }
  return true
}

const _toDisplayValue = (value) => {
  if (!_isMeaningfulValue(value)) return ""
  if (Array.isArray(value)) {
    return value.map(_toDisplayValue).filter(Boolean).join(", ")
  }
  if (typeof value === "object") {
    if (Array.isArray(value.selectedLabels) && value.selectedLabels.length > 0) {
      return value.selectedLabels.join(", ")
    }
    if (Array.isArray(value.selectedIds) && value.selectedIds.length > 0) {
      return value.selectedIds.join(", ")
    }
    if (Number.isFinite(value.selectedCount)) {
      return `${value.selectedCount}`
    }
    return value.display || value.text || value.code || value.key || ""
  }
  return String(value)
}

const _toNumericValue = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const direct = Number(trimmed)
    if (Number.isFinite(direct)) return direct
    const normalized = trimmed
      .replace(/[−–—]/g, "-")
      .replace(/(\d)[,\s](?=\d{3}\b)/g, "$1")
      .replace(/,(?=\d{1,2}\b)/g, ".")
    const extracted = normalized.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/)
    if (!extracted) return null
    const parsed = Number(extracted[0])
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === "object") {
    if (Number.isFinite(value.selectedCount)) {
      return Number(value.selectedCount)
    }
    const candidate = value.value ?? value.display ?? value.text ?? value.code ?? value.key
    return _toNumericValue(candidate)
  }
  return null
}

const _evaluateExpression = (expression, varsByName) => {
  if (typeof expression !== "string") return null
  const trimmed = expression.trim()
  if (!trimmed) return null
  if (!/^[0-9+\-*/().,\s_a-zA-Z]+$/.test(trimmed)) return null

  const tokenMatches = trimmed.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []
  const uniqueTokens = Array.from(new Set(tokenMatches)).sort((a, b) => b.length - a.length)
  let prepared = trimmed
  for (const token of uniqueTokens) {
    const numeric = varsByName[token]
    if (!Number.isFinite(numeric)) return null
    const replacement = String(numeric)
    prepared = prepared.replace(new RegExp(`\\b${token}\\b`, "g"), replacement)
  }

  try {
    const result = Function(`"use strict"; return (${prepared});`)()
    return typeof result === "number" && Number.isFinite(result) ? result : null
  } catch (error) {
    return null
  }
}

const _isHeadingField = (field) => field?.type === "heading"

const _resolveFieldWidthBasis = (field) => {
  if (_isHeadingField(field)) return "100%"
  const normalized = typeof field?.width === "string" ? field.width.trim().toLowerCase() : ""
  switch (normalized) {
    case "1/4":
    case "25%":
      return "25%"
    case "1/3":
    case "33%":
    case "33.3%":
    case "33.33%":
      return "33.3333%"
    case "1/2":
    case "50%":
    case "half":
      return "50%"
    case "2/3":
    case "66%":
    case "66.6%":
    case "66.67%":
      return "66.6667%"
    case "3/4":
    case "75%":
      return "75%"
    case "1/1":
    case "100%":
    case "full":
      return "100%"
    case "auto":
      return field?.type === "textarea" ? "100%" : "50%"
    default:
      return "100%"
  }
}

const _formatNumericValue = (value, precision = 1) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null
  const numeric = Number(value)
  const boundedPrecision = Number.isFinite(precision) ? Math.max(0, Math.min(6, Math.trunc(precision))) : null
  if (boundedPrecision === null) return `${numeric}`
  return numeric.toFixed(boundedPrecision).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
}

const _formatCalculatorDisplayValue = (value, precision = 1, fallback = "Incomplete") => {
  const formatted = _formatNumericValue(value, precision)
  return formatted === null ? fallback : formatted
}

const _computeMorphineEquivalent = (doseValue, equivalentDoseMg, baseEquivalentDoseMg) => {
  const dose = _toNumericValue(doseValue)
  const equivalentDose = Number(equivalentDoseMg)
  const baseDose = Number(baseEquivalentDoseMg)
  if (!Number.isFinite(dose)) return null
  if (!Number.isFinite(equivalentDose) || equivalentDose <= 0) return null
  if (!Number.isFinite(baseDose) || baseDose <= 0) return null
  return (dose * baseDose) / equivalentDose
}

// ================================================
// Summary sub-components
// ================================================

const ScoreSummaryItem = ({ total, score, isComplete, isDarkMode }) => {
  const style = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    borderRadius: "4px",
    backgroundColor: isDarkMode ? "#1a3a5c" : "#e6f2ff",
    border: `1px solid ${isDarkMode ? "#2a5a8c" : "#b8d4f0"}`,
  }

  if (!isComplete) {
    return (
      <div style={{ ...style, backgroundColor: isDarkMode ? "#3a3a1a" : "#fff8e6", border: `1px solid ${isDarkMode ? "#5a5a2a" : "#f0e0b8"}` }}>
        <Text styles={{ root: { fontWeight: 600, fontSize: "13px" } }}>{total.label}:</Text>
        <Text styles={{ root: { fontSize: "13px", color: isDarkMode ? "#cca050" : "#996600", fontStyle: "italic" } }}>
          Incomplete
        </Text>
      </div>
    )
  }

  return (
    <div style={style}>
      <Text styles={{ root: { fontWeight: 600, fontSize: "13px" } }}>{total.label}:</Text>
      <Text styles={{ root: { fontWeight: 700, fontSize: "16px" } }}>{score}</Text>
    </div>
  )
}

const InterpretationSummaryItem = ({ total, score, isComplete, isDarkMode }) => {
  const interpretation = _getInterpretation(score, total.ranges)

  if (!isComplete || !interpretation) return null

  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "4px",
    backgroundColor: isDarkMode ? "#2a5a8c" : "#0078d4",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 500,
  }

  return (
    <span style={style}>
      {interpretation.bounds} &middot; {interpretation.label}
    </span>
  )
}

const AnswerSummaryItem = ({ question, answer, isDarkMode }) => {
  if (!answer) return null
  const displayText = _toDisplayValue(answer)
  if (!displayText) return null

  const style = {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    padding: "4px 0",
    fontSize: "13px",
  }

  const labelStyle = {
    color: isDarkMode ? "#a0a0a0" : "#666666",
    fontWeight: 500,
    flexShrink: 0,
  }

  return (
    <div style={style}>
      <span style={labelStyle}>{question.label}:</span>
      <span>{displayText}</span>
    </div>
  )
}

const DataFieldSummaryItem = ({ field, value, isDarkMode }) => {
  if (!field) return null
  const displayText = _toDisplayValue(value)
  if (!displayText) return null

  const style = {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    padding: "4px 0",
    fontSize: "13px",
  }

  const labelStyle = {
    color: isDarkMode ? "#a0a0a0" : "#666666",
    fontWeight: 500,
    flexShrink: 0,
  }

  return (
    <div style={style}>
      <span style={labelStyle}>{field.label}:</span>
      <span>{displayText}</span>
    </div>
  )
}

const CalculationSummaryItem = ({ calculation, value, isDarkMode }) => {
  if (!calculation) return null

  const style = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    borderRadius: "4px",
    backgroundColor: isDarkMode ? "#1a3a5c" : "#e6f2ff",
    border: `1px solid ${isDarkMode ? "#2a5a8c" : "#b8d4f0"}`,
  }

  if (value === null || value === undefined) {
    return (
      <div style={{ ...style, backgroundColor: isDarkMode ? "#3a3a1a" : "#fff8e6", border: `1px solid ${isDarkMode ? "#5a5a2a" : "#f0e0b8"}` }}>
        <Text styles={{ root: { fontWeight: 600, fontSize: "13px" } }}>{calculation.label}:</Text>
        <Text styles={{ root: { fontSize: "13px", color: isDarkMode ? "#cca050" : "#996600", fontStyle: "italic" } }}>
          Incomplete
        </Text>
      </div>
    )
  }

  return (
    <div style={style}>
      <Text styles={{ root: { fontWeight: 600, fontSize: "13px" } }}>{calculation.label}:</Text>
      <Text styles={{ root: { fontWeight: 700, fontSize: "16px" } }}>{value}</Text>
    </div>
  )
}

const ProgressSummaryItem = ({ answered, total, percentage, isDarkMode }) => {
  const barBg = isDarkMode ? "#333333" : "#e0e0e0"
  const barFill = percentage === 100
    ? (isDarkMode ? "#2a8c2a" : "#28a745")
    : (isDarkMode ? "#0078d4" : "#0078d4")

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{
        flex: 1,
        height: "6px",
        backgroundColor: barBg,
        borderRadius: "3px",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${percentage}%`,
          height: "100%",
          backgroundColor: barFill,
          borderRadius: "3px",
          transition: "width 0.3s ease",
        }} />
      </div>
      <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#666666", whiteSpace: "nowrap" } }}>
        {answered}/{total} ({percentage}%)
      </Text>
    </div>
  )
}

// ================================================
// Main component
// ================================================

const SubformScoring = ({
  id = "subformScoring",
  mode,
  title,
  buttonText = "Complete Assessment",
  config = { questions: [], totals: [] },
  dataEntryConfig = { fields: [], calculations: [] },
  summaryConfig = {},
  modalConfig = {},
  showProgress = true,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  const isDataEntryMode = useMemo(() => {
    if (mode === "data-entry") return true
    if (mode === "scoring") return false
    return Array.isArray(dataEntryConfig?.fields) && dataEntryConfig.fields.length > 0
  }, [mode, dataEntryConfig])

  const setDataEntryValue = useCallback((fieldId, nextValue) => {
    if (!fieldId || !fd?.setFormData) return
    fd.setFormData((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data) {
        draft.field.data = {}
      }
      if (nextValue === undefined) {
        draft.field.data[fieldId] = null
      } else {
        draft.field.data[fieldId] = nextValue
      }
    })
  }, [fd])

  // Scoring-mode answer and score calculations
  const scoreMap = useMemo(() => {
    if (isDataEntryMode) return new Map()
    return _buildScoreMap(config.questions)
  }, [isDataEntryMode, config.questions])

  const answers = useMemo(() => {
    if (isDataEntryMode) return {}
    const result = {}
    for (const question of config.questions || []) {
      const value = fd?.field?.data?.[question.id]
      if (value) {
        result[question.id] = value
      }
    }
    return result
  }, [isDataEntryMode, fd, config.questions])

  const calculatedTotals = useMemo(() => {
    if (isDataEntryMode) return {}
    const results = {}
    for (const total of config.totals || []) {
      let score = 0
      let isComplete = true
      for (const term of total.terms || []) {
        const answer = answers[term.questionId]
        const optionScoreMap = scoreMap.get(term.questionId)
        const answerScore = _getScoreFromValue(answer, optionScoreMap)
        if (answerScore !== null) {
          score += answerScore * (term.weight || 1)
        } else {
          isComplete = false
        }
      }
      results[total.id] = { score: isComplete ? score : null, isComplete }
    }
    return results
  }, [isDataEntryMode, answers, config.totals, scoreMap])

  // Data-entry-mode values and calculations
  const dataEntryFields = useMemo(() => {
    return Array.isArray(dataEntryConfig?.fields) ? dataEntryConfig.fields : []
  }, [dataEntryConfig])

  const dataEntryFieldById = useMemo(() => {
    const map = new Map()
    for (const field of dataEntryFields) {
      if (!field?.id) continue
      map.set(field.id, field)
    }
    return map
  }, [dataEntryFields])

  const dataEntryCalculatorConfig = useMemo(() => {
    const rawConfig = dataEntryConfig?.calculatorConfig || dataEntryConfig?.calculator_config
    if (!rawConfig || typeof rawConfig !== "object") return null

    const rawType = String(rawConfig.type || rawConfig.calculatorType || rawConfig.calculator_type || "").trim().toLowerCase()
    const normalizedType =
      rawType === "morphine-equivalence" ||
      rawType === "morphine_equivalence" ||
      rawType === "meq"
        ? "morphine-equivalence"
        : null
    if (!normalizedType) return null

    const rawRows = Array.isArray(rawConfig.rows) ? rawConfig.rows : []
    const rows = rawRows
      .map((row, index) => {
        if (!row || typeof row !== "object") return null
        const rowId = String(row.id || `row_${index + 1}`).trim()
        const label = String(row.label || rowId || `Row ${index + 1}`).trim()
        const inputFieldId = String(
          row.inputFieldId ||
          row.input_field_id ||
          row.fieldId ||
          row.field_id ||
          row.doseFieldId ||
          row.dose_field_id ||
          ""
        ).trim()
        if (!inputFieldId) return null

        const equivalentDoseMg = Number(
          row.equivalentDoseMg ??
          row.equivalent_dose_mg ??
          row.equivalentDose ??
          row.equivalent_dose
        )
        if (!Number.isFinite(equivalentDoseMg) || equivalentDoseMg <= 0) return null

        const meqCalculationId = String(row.meqCalculationId || row.meq_calculation_id || "").trim() || null
        const precisionRaw = Number(row.precision)
        const precision = Number.isFinite(precisionRaw)
          ? Math.max(0, Math.min(6, Math.trunc(precisionRaw)))
          : 1
        return {
          id: rowId,
          label,
          inputFieldId,
          equivalentDoseMg,
          meqCalculationId,
          precision
        }
      })
      .filter(Boolean)

    if (rows.length === 0) return null

    const baseEquivalentDoseRaw = Number(rawConfig.baseEquivalentDoseMg ?? rawConfig.base_equivalent_dose_mg)
    const baseEquivalentDoseMg = Number.isFinite(baseEquivalentDoseRaw) && baseEquivalentDoseRaw > 0
      ? baseEquivalentDoseRaw
      : 30
    const totalCalculationId = String(rawConfig.totalCalculationId || rawConfig.total_calculation_id || "").trim() || null
    const totalLabel = String(rawConfig.totalLabel || rawConfig.total_label || "TOTAL MEQ").trim() || "TOTAL MEQ"
    const doseColumnLabel = String(rawConfig.doseColumnLabel || rawConfig.dose_column_label || "Total Daily Dose").trim() || "Total Daily Dose"
    const equivalentColumnLabel = String(rawConfig.equivalentColumnLabel || rawConfig.equivalent_column_label || "Equivalent Dose (mg)").trim() || "Equivalent Dose (mg)"
    const resultColumnLabel = String(rawConfig.resultColumnLabel || rawConfig.result_column_label || "Morphine Equivalent (MEQ)").trim() || "Morphine Equivalent (MEQ)"

    return {
      type: normalizedType,
      rows,
      baseEquivalentDoseMg,
      totalCalculationId,
      totalLabel,
      doseColumnLabel,
      equivalentColumnLabel,
      resultColumnLabel
    }
  }, [dataEntryConfig])

  const isMorphineCalculatorMode = useMemo(() => {
    return isDataEntryMode &&
      dataEntryCalculatorConfig?.type === "morphine-equivalence" &&
      Array.isArray(dataEntryCalculatorConfig?.rows) &&
      dataEntryCalculatorConfig.rows.length > 0
  }, [isDataEntryMode, dataEntryCalculatorConfig])

  const dataEntryValues = useMemo(() => {
    if (!isDataEntryMode) return {}
    const result = {}
    for (const field of dataEntryFields) {
      if (_isHeadingField(field)) continue
      result[field.id] = fd?.field?.data?.[field.id]
    }
    if (isMorphineCalculatorMode) {
      for (const row of dataEntryCalculatorConfig?.rows || []) {
        if (!row?.inputFieldId) continue
        if (!(row.inputFieldId in result)) {
          result[row.inputFieldId] = fd?.field?.data?.[row.inputFieldId]
        }
      }
    }
    return result
  }, [isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryFields, fd])

  const dataEntryCalculations = useMemo(() => {
    return Array.isArray(dataEntryConfig?.calculations) ? dataEntryConfig.calculations : []
  }, [dataEntryConfig])

  const calculatedExpressions = useMemo(() => {
    if (!isDataEntryMode) return {}
    const vars = {}
    const variableFieldIds = new Set()
    for (const field of dataEntryFields) {
      if (_isHeadingField(field)) continue
      variableFieldIds.add(field.id)
    }
    if (isMorphineCalculatorMode) {
      for (const row of dataEntryCalculatorConfig?.rows || []) {
        if (row?.inputFieldId) variableFieldIds.add(row.inputFieldId)
      }
    }
    for (const fieldId of variableFieldIds) {
      vars[fieldId] = _toNumericValue(dataEntryValues[fieldId])
    }
    const result = {}
    for (const calculation of dataEntryCalculations) {
      const value = _evaluateExpression(calculation.expression, vars)
      if (value === null || value === undefined) {
        result[calculation.id] = null
        continue
      }
      const precision = Number.isFinite(calculation.precision) ? Math.max(0, Math.min(6, calculation.precision)) : null
      result[calculation.id] = precision === null ? value : Number(value.toFixed(precision))
    }
    return result
  }, [isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryFields, dataEntryValues, dataEntryCalculations])

  const progress = useMemo(() => {
    if (isDataEntryMode) {
      const calculatorFields = isMorphineCalculatorMode
        ? (dataEntryCalculatorConfig?.rows || []).map((row) => (
            dataEntryFieldById.get(row.inputFieldId) || {
              id: row.inputFieldId,
              required: false,
            }
          ))
        : []
      const answerableFields = calculatorFields.length > 0
        ? calculatorFields
        : dataEntryFields.filter((field) => !_isHeadingField(field))
      const requiredFields = answerableFields.filter((field) => field.required)
      const fieldsForProgress = requiredFields.length > 0 ? requiredFields : answerableFields
      const total = fieldsForProgress.length
      const answered = fieldsForProgress.filter((field) => _isMeaningfulValue(dataEntryValues[field.id])).length
      return {
        answered,
        total,
        percentage: total > 0 ? Math.round((answered / total) * 100) : 0
      }
    }

    const total = config.questions?.length || 0
    const answered = (config.questions || []).filter((question) => {
      const value = answers[question.id]
      const optionScoreMap = scoreMap.get(question.id)
      return _getScoreFromValue(value, optionScoreMap) !== null
    }).length
    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0
    }
  }, [isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryFieldById, dataEntryFields, dataEntryValues, config.questions, answers])

  const hasAnyAnswers = useMemo(() => {
    if (isDataEntryMode) {
      if (isMorphineCalculatorMode) {
        return (dataEntryCalculatorConfig?.rows || []).some((row) =>
          _isMeaningfulValue(dataEntryValues[row.inputFieldId])
        )
      }
      return dataEntryFields
        .filter((field) => !_isHeadingField(field))
        .some((field) => _isMeaningfulValue(dataEntryValues[field.id]))
    }
    return progress.answered > 0
  }, [isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryFields, dataEntryValues, progress])

  const showItems = useMemo(() => {
    if (Array.isArray(summaryConfig.showItems) && summaryConfig.showItems.length > 0) {
      return summaryConfig.showItems
    }
    if (isDataEntryMode) {
      if (isMorphineCalculatorMode && dataEntryCalculatorConfig?.totalCalculationId) {
        return [
          {
            type: "calculation",
            calculationId: dataEntryCalculatorConfig.totalCalculationId,
          },
          { type: "progress" },
        ]
      }
      const defaults = dataEntryCalculations.map((calculation) => ({
        type: "calculation",
        calculationId: calculation.id
      }))
      defaults.push({ type: "progress" })
      return defaults
    }
    return []
  }, [summaryConfig.showItems, isDataEntryMode, isMorphineCalculatorMode, dataEntryCalculatorConfig, dataEntryCalculations])

  const summaryLayout = summaryConfig.layout || "stacked"

  const getTotalConfig = useCallback((totalId) => {
    return (config.totals || []).find((total) => total.id === totalId)
  }, [config.totals])

  const getQuestionConfig = useCallback((questionId) => {
    return (config.questions || []).find((question) => question.id === questionId)
  }, [config.questions])

  const getDataEntryFieldConfig = useCallback((fieldId) => {
    return dataEntryFieldById.get(fieldId)
  }, [dataEntryFieldById])

  const getCalculationConfig = useCallback((calculationId) => {
    return dataEntryCalculations.find((calculation) => calculation.id === calculationId)
  }, [dataEntryCalculations])

  const renderDataEntryField = (field) => {
    if (_isHeadingField(field)) {
      return (
        <Text
          key={`field-${field.id}`}
          styles={{
            root: {
              marginTop: "12px",
              marginBottom: "2px",
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              color: isDarkMode ? "#d9d9d9" : "#333",
              borderBottom: `1px solid ${isDarkMode ? "#404040" : "#e5e5e5"}`,
              paddingBottom: "4px"
            }
          }}
        >
          {field.label}
        </Text>
      )
    }

    const required = field.required === true
    const commonProps = {
      fieldId: field.id,
      label: field.label,
      required,
    }

    if (field.type === "number") {
      const spinButtonProps = {}
      if (Number.isFinite(field.min)) spinButtonProps.min = field.min
      if (Number.isFinite(field.max)) spinButtonProps.max = field.max
      if (Number.isFinite(field.step)) spinButtonProps.step = field.step
      const hasSpinProps = Object.keys(spinButtonProps).length > 0
      return (
        <Numeric
          key={`field-${field.id}`}
          {...commonProps}
          storeAsNumber
          buttonControls={hasSpinProps}
          spinButtonProps={hasSpinProps ? spinButtonProps : undefined}
          value={dataEntryValues[field.id] ?? ""}
          onChange={(value) => setDataEntryValue(field.id, value)}
        />
      )
    }

    if (field.type === "date") {
      return (
        <DateSelect
          key={`field-${field.id}`}
          {...commonProps}
          placeholder={field.placeholder}
          value={dataEntryValues[field.id]}
          onChange={(value) => setDataEntryValue(field.id, value)}
        />
      )
    }

    if (field.type === "datetime") {
      return (
        <DateTimeSelect
          key={`field-${field.id}`}
          {...commonProps}
          placeholder={field.placeholder}
          value={dataEntryValues[field.id]}
          onChange={(value) => setDataEntryValue(field.id, value)}
        />
      )
    }

    if (field.type === "choice") {
      const optionList = (field.options || []).map((option) => ({ key: option, text: option }))
      const useRadio = field.choiceStyle === "radio"
      if (useRadio) {
        return (
          <SimpleCodeChecklist
            key={`field-${field.id}`}
            {...commonProps}
            optionList={optionList}
            selectionType="single"
            multiline
          />
        )
      }
      return (
        <SimpleCodeSelect
          key={`field-${field.id}`}
          {...commonProps}
          optionList={optionList}
          selectionType="single"
          value={dataEntryValues[field.id]}
          onChange={(value) => setDataEntryValue(field.id, value)}
        />
      )
    }

    if (field.type === "booleanYesNo") {
      const yesNoOptions = (field.options && field.options.length >= 2)
        ? field.options
        : ["Yes", "No"]
      const optionList = yesNoOptions.map((option) => ({ key: option, text: option }))
      return (
        <SimpleCodeChecklist
          key={`field-${field.id}`}
          {...commonProps}
          optionList={optionList}
          selectionType="single"
          multiline
        />
      )
    }

    if (field.type === "textarea") {
      return (
        <TextArea
          key={`field-${field.id}`}
          {...commonProps}
          multiline
          rows={field.rows || 4}
          placeholder={field.placeholder}
          value={dataEntryValues[field.id] ?? ""}
          onChange={(_, value) => setDataEntryValue(field.id, value ?? "")}
        />
      )
    }

    if (field.type === "hotspotMap") {
      return (
        <HotspotMapField
          key={`field-${field.id}`}
          {...commonProps}
          imageUrl={field.imageUrl}
          imageSvg={field.imageSvg}
          imageAlt={field.imageAlt}
          hotspots={Array.isArray(field.hotspots) ? field.hotspots : []}
          allowMultiSelect={field.allowMultiSelect !== false}
          showSummary={field.showSummary !== false}
          showHotspotLabels={field.showHotspotLabels === true}
          openInModal={field.openInModal === true}
          modalButtonText={field.modalButtonText}
          modalTitle={field.modalTitle}
          modalMinWidth={field.modalMinWidth}
          mapZoomPercent={field.mapZoomPercent}
          mapWidthPercent={field.mapWidthPercent}
          mapMaxWidth={field.mapMaxWidth}
          mapMinHeight={field.mapMinHeight}
          markerSize={field.markerSize}
          totalCountFieldId={field.totalCountFieldId}
          selectedIdsFieldId={field.selectedIdsFieldId}
          selectedLabelsFieldId={field.selectedLabelsFieldId}
        />
      )
    }

    return (
      <TextArea
        key={`field-${field.id}`}
        {...commonProps}
        placeholder={field.placeholder}
        value={dataEntryValues[field.id] ?? ""}
        onChange={(_, value) => setDataEntryValue(field.id, value ?? "")}
      />
    )
  }

  const renderMorphineCalculator = () => {
    if (!isMorphineCalculatorMode || !dataEntryCalculatorConfig) return null

    const rows = Array.isArray(dataEntryCalculatorConfig.rows) ? dataEntryCalculatorConfig.rows : []
    if (rows.length === 0) return null

    const rowValues = rows.map((row) => {
      const fromCalculation = row.meqCalculationId
        ? calculatedExpressions[row.meqCalculationId]
        : null
      const computedFallback = _computeMorphineEquivalent(
        dataEntryValues[row.inputFieldId],
        row.equivalentDoseMg,
        dataEntryCalculatorConfig.baseEquivalentDoseMg
      )
      return fromCalculation ?? computedFallback
    })

    const totalFromCalculation = dataEntryCalculatorConfig.totalCalculationId
      ? calculatedExpressions[dataEntryCalculatorConfig.totalCalculationId]
      : null
    const totalFallback = rowValues.reduce((sum, value) => {
      if (!Number.isFinite(Number(value))) return sum
      return sum + Number(value)
    }, 0)
    const hasAnyRowValue = rowValues.some((value) => Number.isFinite(Number(value)))
    const totalValue = totalFromCalculation ?? (hasAnyRowValue ? totalFallback : null)

    return (
      <div style={{
        border: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
        borderRadius: "6px",
        overflow: "hidden"
      }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr minmax(140px, 1fr) minmax(120px, 1fr) minmax(160px, 1fr)",
            gap: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            borderBottom: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
            backgroundColor: isDarkMode ? "#202020" : "#f8f8f8"
          }}
        >
          <span />
          <span>{dataEntryCalculatorConfig.doseColumnLabel}</span>
          <span>{dataEntryCalculatorConfig.equivalentColumnLabel}</span>
          <span>{dataEntryCalculatorConfig.resultColumnLabel}</span>
        </div>

        {rows.map((row, index) => {
          const field = dataEntryFieldById.get(row.inputFieldId)
          const inputType = field?.type === "text" ? "text" : "number"
          const rawValue = dataEntryValues[row.inputFieldId]
          const displayValue = rawValue === null || rawValue === undefined ? "" : String(rawValue)
          const meqValue = rowValues[index]
          const meqDisplay = _formatCalculatorDisplayValue(meqValue, row.precision, "-")

          return (
            <div
              key={`calculator-row-${row.id || row.inputFieldId}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr minmax(140px, 1fr) minmax(120px, 1fr) minmax(160px, 1fr)",
                gap: "8px",
                alignItems: "center",
                padding: "10px 12px",
                borderBottom: index < rows.length - 1
                  ? `1px solid ${isDarkMode ? "#333" : "#ececec"}`
                  : "none"
              }}
            >
              <Text styles={{ root: { fontSize: "16px", fontWeight: 500 } }}>
                {row.label}:
              </Text>
              <input
                type={inputType}
                inputMode="decimal"
                step="any"
                value={displayValue}
                placeholder={inputType === "number" ? "0" : ""}
                onChange={(event) => {
                  const nextRaw = event?.target?.value ?? ""
                  if (!nextRaw) {
                    setDataEntryValue(row.inputFieldId, null)
                    return
                  }
                  if (inputType === "number") {
                    const parsed = Number(nextRaw)
                    setDataEntryValue(row.inputFieldId, Number.isFinite(parsed) ? parsed : nextRaw)
                    return
                  }
                  setDataEntryValue(row.inputFieldId, nextRaw)
                }}
                style={{
                  width: "100%",
                  maxWidth: "140px",
                  height: "34px",
                  borderRadius: "2px",
                  border: `1px solid ${isDarkMode ? "#5a5a5a" : "#b8b8b8"}`,
                  backgroundColor: isDarkMode ? "#1a1a1a" : "#fff",
                  color: isDarkMode ? "#fff" : "#111",
                  padding: "4px 8px",
                  fontSize: "15px"
                }}
              />
              <Text styles={{ root: { fontSize: "20px", fontWeight: 500 } }}>
                {_formatCalculatorDisplayValue(row.equivalentDoseMg, 2, "-")}
              </Text>
              <Text styles={{ root: { fontSize: "22px", fontWeight: 700 } }}>
                {meqDisplay}
              </Text>
            </div>
          )
        })}

        <div style={{
          borderTop: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
          backgroundColor: isDarkMode ? "#252525" : "#f4f4f4",
          padding: "12px",
          display: "flex",
          justifyContent: "center",
          alignItems: "baseline",
          gap: "14px"
        }}>
          <Text styles={{ root: { fontSize: "36px", fontWeight: 800, letterSpacing: "0.02em" } }}>
            {dataEntryCalculatorConfig.totalLabel}:
          </Text>
          <Text styles={{ root: { fontSize: "40px", fontWeight: 800, lineHeight: 1 } }}>
            {_formatCalculatorDisplayValue(totalValue, 1)}
          </Text>
        </div>
      </div>
    )
  }

  const renderSummaryItem = (item, index) => {
    if (isDataEntryMode) {
      switch (item.type) {
        case "field": {
          const field = getDataEntryFieldConfig(item.fieldId)
          if (!field) return null
          return (
            <DataFieldSummaryItem
              key={`field-${index}`}
              field={field}
              value={dataEntryValues[field.id]}
              isDarkMode={isDarkMode}
            />
          )
        }
        case "calculation": {
          const calculation = getCalculationConfig(item.calculationId)
          if (!calculation) return null
          return (
            <CalculationSummaryItem
              key={`calc-${index}`}
              calculation={calculation}
              value={calculatedExpressions[calculation.id]}
              isDarkMode={isDarkMode}
            />
          )
        }
        case "progress":
          return (
            <ProgressSummaryItem
              key={`progress-${index}`}
              answered={progress.answered}
              total={progress.total}
              percentage={progress.percentage}
              isDarkMode={isDarkMode}
            />
          )
        default:
          return null
      }
    }

    switch (item.type) {
      case "total": {
        const total = getTotalConfig(item.totalId)
        if (!total) return null
        const calc = calculatedTotals[item.totalId]
        return (
          <ScoreSummaryItem
            key={`total-${index}`}
            total={total}
            score={calc?.score}
            isComplete={calc?.isComplete}
            isDarkMode={isDarkMode}
          />
        )
      }
      case "interpretation": {
        const total = getTotalConfig(item.totalId)
        if (!total) return null
        const calc = calculatedTotals[item.totalId]
        return (
          <InterpretationSummaryItem
            key={`interp-${index}`}
            total={total}
            score={calc?.score}
            isComplete={calc?.isComplete}
            isDarkMode={isDarkMode}
          />
        )
      }
      case "answer": {
        const question = getQuestionConfig(item.questionId)
        if (!question) return null
        return (
          <AnswerSummaryItem
            key={`answer-${index}`}
            question={question}
            answer={answers[item.questionId]}
            isDarkMode={isDarkMode}
          />
        )
      }
      case "progress":
        return (
          <ProgressSummaryItem
            key={`progress-${index}`}
            answered={progress.answered}
            total={progress.total}
            percentage={progress.percentage}
            isDarkMode={isDarkMode}
          />
        )
      default:
        return null
    }
  }

  const containerStyle = {
    padding: "8px 0",
  }

  const buttonRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  }

  const summaryContainerStyle = {
    marginTop: hasAnyAnswers && showItems.length > 0 ? "10px" : 0,
    padding: hasAnyAnswers && showItems.length > 0 ? "10px 14px" : 0,
    borderRadius: "6px",
    backgroundColor: hasAnyAnswers && showItems.length > 0
      ? (isDarkMode ? "#1f1f1f" : "#fafafa")
      : "transparent",
    border: hasAnyAnswers && showItems.length > 0
      ? `1px solid ${isDarkMode ? "#333" : "#e8e8e8"}`
      : "none",
  }

  const summaryItemsStyle = summaryLayout === "inline"
    ? { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }
    : { display: "flex", flexDirection: "column", gap: "6px" }

  const dialogTitle = modalConfig.title || title || "Assessment"
  const dialogMinWidth = modalConfig.minWidth || 700
  const showCalculationsInModal =
    Boolean(modalConfig.showCalculationsInModal) ||
    Boolean(modalConfig.show_calculations_in_modal)

  const dialogContentProps = {
    type: DialogType.largeHeader,
    title: dialogTitle,
    closeButtonAriaLabel: "Close",
  }

  const modalProps = {
    isBlocking: false,
  }

  return (
    <div style={containerStyle}>
      <div style={buttonRowStyle}>
        <PrimaryButton
          text={buttonText}
          onClick={() => setIsOpen(true)}
          iconProps={{ iconName: hasAnyAnswers ? "EditNote" : "ClipboardList" }}
        />
        {title && (
          <Text styles={{ root: { fontWeight: 600, fontSize: "14px" } }}>
            {title}
          </Text>
        )}
        {hasAnyAnswers && (
          <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#888" } }}>
            {progress.answered}/{progress.total} answered
          </Text>
        )}
      </div>

      {hasAnyAnswers && showItems.length > 0 && (
        <div style={summaryContainerStyle}>
          <div style={summaryItemsStyle}>
            {showItems.map((item, idx) => renderSummaryItem(item, idx))}
          </div>
        </div>
      )}

      <Dialog
        hidden={!isOpen}
        onDismiss={() => setIsOpen(false)}
        dialogContentProps={dialogContentProps}
        modalProps={modalProps}
        minWidth={dialogMinWidth}
      >
        {isDataEntryMode ? (
          <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: "4px" }}>
            {isMorphineCalculatorMode ? (
              renderMorphineCalculator()
            ) : dataEntryFields.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", columnGap: "12px", rowGap: "10px" }}>
                {dataEntryFields.map((field) => {
                  const isHeading = _isHeadingField(field)
                  const basis = _resolveFieldWidthBasis(field)
                  const containerStyle = isHeading
                    ? { flex: "1 0 100%", maxWidth: "100%" }
                    : { flex: `1 1 ${basis}`, maxWidth: basis, minWidth: "220px" }
                  return (
                  <div key={field.id} style={containerStyle}>
                    {renderDataEntryField(field)}
                    {field.helpText && !isHeading && (
                      <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#666", marginTop: "2px" } }}>
                        {field.helpText}
                      </Text>
                    )}
                  </div>
                )})}
              </div>
            ) : (
              <Text styles={{ root: { fontSize: "13px", color: isDarkMode ? "#a0a0a0" : "#666" } }}>
                No data-entry fields configured.
              </Text>
            )}
            {showCalculationsInModal && dataEntryCalculations.length > 0 && !isMorphineCalculatorMode && (
              <div style={{
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                {dataEntryCalculations.map((calculation) => {
                  const value = calculatedExpressions[calculation.id]
                  return (
                    <div
                      key={`modal-calc-${calculation.id}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "12px"
                      }}
                    >
                      <Text styles={{ root: { fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em" } }}>
                        {calculation.label.toUpperCase()}:
                      </Text>
                      <Text styles={{ root: { fontSize: "26px", fontWeight: 700, lineHeight: 1 } }}>
                        {value ?? "Incomplete"}
                      </Text>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <ScoringModule
            id={id}
            config={config}
            title=""
            showProgress={showProgress}
          />
        )}
        <div style={{ height: "16px" }} />
        <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
          <PrimaryButton text="Done" onClick={() => setIsOpen(false)} />
          <DefaultButton text="Cancel" onClick={() => setIsOpen(false)} />
        </Stack>
      </Dialog>
    </div>
  )
}
