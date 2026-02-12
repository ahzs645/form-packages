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

const _getScoreFromValue = (value, optionScoreMap) => {
  if (!value || !optionScoreMap) return null
  const code = value.code || value.key
  if (code && optionScoreMap.has(code)) {
    return optionScoreMap.get(code)
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
    return value.display || value.text || value.code || value.key || ""
  }
  return String(value)
}

const _toNumericValue = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === "object") {
    const candidate = value.value ?? value.display ?? value.text ?? value.code ?? value.key
    const parsed = Number(candidate)
    return Number.isFinite(parsed) ? parsed : null
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
    const replacement = Number.isFinite(numeric) ? String(numeric) : "0"
    prepared = prepared.replace(new RegExp(`\\b${token}\\b`, "g"), replacement)
  }

  try {
    const result = Function(`"use strict"; return (${prepared});`)()
    return typeof result === "number" && Number.isFinite(result) ? result : null
  } catch (error) {
    return null
  }
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

  const dataEntryValues = useMemo(() => {
    if (!isDataEntryMode) return {}
    const result = {}
    for (const field of dataEntryFields) {
      result[field.id] = fd?.field?.data?.[field.id]
    }
    return result
  }, [isDataEntryMode, dataEntryFields, fd])

  const dataEntryCalculations = useMemo(() => {
    return Array.isArray(dataEntryConfig?.calculations) ? dataEntryConfig.calculations : []
  }, [dataEntryConfig])

  const calculatedExpressions = useMemo(() => {
    if (!isDataEntryMode) return {}
    const vars = {}
    for (const field of dataEntryFields) {
      vars[field.id] = _toNumericValue(dataEntryValues[field.id]) ?? 0
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
  }, [isDataEntryMode, dataEntryFields, dataEntryValues, dataEntryCalculations])

  const progress = useMemo(() => {
    if (isDataEntryMode) {
      const requiredFields = dataEntryFields.filter((field) => field.required)
      const fieldsForProgress = requiredFields.length > 0 ? requiredFields : dataEntryFields
      const total = fieldsForProgress.length
      const answered = fieldsForProgress.filter((field) => _isMeaningfulValue(dataEntryValues[field.id])).length
      return {
        answered,
        total,
        percentage: total > 0 ? Math.round((answered / total) * 100) : 0
      }
    }

    const total = config.questions?.length || 0
    const answered = Object.keys(answers).filter((questionId) => {
      const value = answers[questionId]
      return value && (value.code || value.key)
    }).length
    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0
    }
  }, [isDataEntryMode, dataEntryFields, dataEntryValues, config.questions, answers])

  const hasAnyAnswers = useMemo(() => {
    if (isDataEntryMode) {
      return dataEntryFields.some((field) => _isMeaningfulValue(dataEntryValues[field.id]))
    }
    return progress.answered > 0
  }, [isDataEntryMode, dataEntryFields, dataEntryValues, progress])

  const showItems = useMemo(() => {
    if (Array.isArray(summaryConfig.showItems) && summaryConfig.showItems.length > 0) {
      return summaryConfig.showItems
    }
    if (isDataEntryMode) {
      const defaults = dataEntryCalculations.map((calculation) => ({
        type: "calculation",
        calculationId: calculation.id
      }))
      defaults.push({ type: "progress" })
      return defaults
    }
    return []
  }, [summaryConfig.showItems, isDataEntryMode, dataEntryCalculations])

  const summaryLayout = summaryConfig.layout || "stacked"

  const getTotalConfig = useCallback((totalId) => {
    return (config.totals || []).find((total) => total.id === totalId)
  }, [config.totals])

  const getQuestionConfig = useCallback((questionId) => {
    return (config.questions || []).find((question) => question.id === questionId)
  }, [config.questions])

  const getDataEntryFieldConfig = useCallback((fieldId) => {
    return dataEntryFields.find((field) => field.id === fieldId)
  }, [dataEntryFields])

  const getCalculationConfig = useCallback((calculationId) => {
    return dataEntryCalculations.find((calculation) => calculation.id === calculationId)
  }, [dataEntryCalculations])

  const renderDataEntryField = (field) => {
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
        />
      )
    }

    if (field.type === "date") {
      return (
        <DateSelect
          key={`field-${field.id}`}
          {...commonProps}
          placeholder={field.placeholder}
        />
      )
    }

    if (field.type === "datetime") {
      return (
        <DateTimeSelect
          key={`field-${field.id}`}
          {...commonProps}
          placeholder={field.placeholder}
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
        />
      )
    }

    return (
      <TextArea
        key={`field-${field.id}`}
        {...commonProps}
        placeholder={field.placeholder}
      />
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
            {dataEntryFields.length > 0 ? (
              <Stack tokens={{ childrenGap: 10 }}>
                {dataEntryFields.map((field) => (
                  <div key={field.id}>
                    {renderDataEntryField(field)}
                    {field.helpText && (
                      <Text styles={{ root: { fontSize: "12px", color: isDarkMode ? "#a0a0a0" : "#666", marginTop: "2px" } }}>
                        {field.helpText}
                      </Text>
                    )}
                  </div>
                ))}
              </Stack>
            ) : (
              <Text styles={{ root: { fontSize: "13px", color: isDarkMode ? "#a0a0a0" : "#666" } }}>
                No data-entry fields configured.
              </Text>
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
