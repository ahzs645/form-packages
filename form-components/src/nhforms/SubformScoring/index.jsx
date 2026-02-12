/**
 * SubformScoring - Modal-based scoring subform with configurable summary display
 *
 * Opens a ScoringModule inside a modal dialog. After the user fills out questions,
 * configurable summary items (scores, interpretations, individual answers, progress)
 * are displayed inline below the trigger button.
 *
 * Data persists live in the main form data store via useActiveData().
 *
 * Props:
 * @param {string} id - Unique identifier for this subform
 * @param {string} [title] - Label shown next to the button and as summary header
 * @param {string} [buttonText="Complete Assessment"] - Text on the trigger button
 * @param {ScoringConfig} config - Scoring configuration (same format as ScoringModule)
 * @param {Object} [summaryConfig] - What to display after completion
 * @param {Array} [summaryConfig.showItems] - Items to show: { type, totalId?, questionId? }
 *   type: 'total' | 'interpretation' | 'answer' | 'progress'
 * @param {'inline'|'stacked'} [summaryConfig.layout='stacked'] - Summary layout direction
 * @param {Object} [modalConfig] - Modal customization
 * @param {number|string} [modalConfig.minWidth=700] - Modal min width
 * @param {string} [modalConfig.title] - Override modal dialog title
 * @param {boolean} [showProgress=true] - Show progress bar inside modal
 */

const { useState, useMemo, useCallback } = React
const {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  Separator,
  Dialog,
  DialogType,
} = Fluent

// ================================================
// Score calculation helpers (same logic as ScoringModule)
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

  const displayText = answer.display || answer.text || answer.code || answer.key || ""
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
// Main Component
// ================================================

const SubformScoring = ({
  id = "subformScoring",
  title,
  buttonText = "Complete Assessment",
  config = { questions: [], totals: [] },
  summaryConfig = {},
  modalConfig = {},
  showProgress = true,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  // Build score maps from config
  const scoreMap = useMemo(() => _buildScoreMap(config.questions), [config.questions])

  // Get all answers from form data
  const answers = useMemo(() => {
    const result = {}
    for (const question of config.questions || []) {
      const value = fd?.field?.data?.[question.id]
      if (value) {
        result[question.id] = value
      }
    }
    return result
  }, [fd, config.questions])

  // Calculate totals for summary
  const calculatedTotals = useMemo(() => {
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
  }, [answers, config.totals, scoreMap])

  // Calculate progress
  const progress = useMemo(() => {
    const total = config.questions?.length || 0
    const answered = Object.keys(answers).filter(qId => {
      const val = answers[qId]
      return val && (val.code || val.key)
    }).length
    return { answered, total, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 }
  }, [answers, config.questions])

  const hasAnyAnswers = progress.answered > 0

  // Summary items config
  const showItems = summaryConfig.showItems || []
  const summaryLayout = summaryConfig.layout || "stacked"

  // Find total config by ID
  const getTotalConfig = useCallback((totalId) => {
    return (config.totals || []).find(t => t.id === totalId)
  }, [config.totals])

  // Find question config by ID
  const getQuestionConfig = useCallback((questionId) => {
    return (config.questions || []).find(q => q.id === questionId)
  }, [config.questions])

  // Render a single summary item
  const renderSummaryItem = (item, index) => {
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
      case "progress": {
        return (
          <ProgressSummaryItem
            key={`progress-${index}`}
            answered={progress.answered}
            total={progress.total}
            percentage={progress.percentage}
            isDarkMode={isDarkMode}
          />
        )
      }
      default:
        return null
    }
  }

  // Styles
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

  // Modal config
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
      {/* Button row */}
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

      {/* Summary display */}
      {hasAnyAnswers && showItems.length > 0 && (
        <div style={summaryContainerStyle}>
          <div style={summaryItemsStyle}>
            {showItems.map((item, idx) => renderSummaryItem(item, idx))}
          </div>
        </div>
      )}

      {/* Modal with ScoringModule */}
      <Dialog
        hidden={!isOpen}
        onDismiss={() => setIsOpen(false)}
        dialogContentProps={dialogContentProps}
        modalProps={modalProps}
        minWidth={dialogMinWidth}
      >
        <ScoringModule
          id={id}
          config={config}
          title=""
          showProgress={showProgress}
        />
        <div style={{ height: "16px" }} />
        <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
          <PrimaryButton text="Done" onClick={() => setIsOpen(false)} />
          <DefaultButton text="Cancel" onClick={() => setIsOpen(false)} />
        </Stack>
      </Dialog>
    </div>
  )
}
