/**
 * ScoringModule - A scoring questionnaire component with interpretation
 *
 * Features:
 * - Uses SimpleCodeChecklist for question/answer selection
 * - Configurable questions with scored answer options
 * - Automatic total calculation with weighted terms
 * - Interpretation ranges with labels (e.g., "Follow-up required")
 * - Dark mode support via theme
 */

const { useMemo, useEffect } = React
const {
  Stack,
  StackItem,
  Label,
  Text,
  Separator,
} = Fluent

// ================================================
// Type definitions (JSDoc for documentation)
// ================================================

/**
 * @typedef {Object} ScoringOptionConfig
 * @property {string} key - Option code/key
 * @property {string} text - Display text
 * @property {number} score - Score value when selected
 */

/**
 * @typedef {Object} ScoringQuestionConfig
 * @property {string} id - Unique question ID (also used as fieldId)
 * @property {string} label - Question text
 * @property {ScoringOptionConfig[]} options - Answer options with scores
 * @property {boolean} [multiline] - Use vertical layout for options
 * @property {string} [codeSystem] - Optional code system reference
 */

/**
 * @typedef {Object} ScoreTotalTerm
 * @property {string} questionId - Question ID to include in total
 * @property {number} [weight=1] - Weight multiplier for the question's score
 */

/**
 * @typedef {Object} ScoreTotalRange
 * @property {string} label - Interpretation label
 * @property {number} min - Minimum score for this range
 * @property {number|null} max - Maximum score (null for unbounded)
 * @property {boolean} [minInclusive=true] - Whether min is inclusive (≥ vs >)
 * @property {boolean} [maxInclusive=true] - Whether max is inclusive (≤ vs <)
 */

/**
 * @typedef {Object} ScoreTotalConfig
 * @property {string} id - Unique total ID
 * @property {string} label - Display label for the total
 * @property {ScoreTotalTerm[]} terms - Questions/weights that make up this total
 * @property {string} [targetFieldId] - Field ID to write result to
 * @property {ScoreTotalRange[]} ranges - Interpretation ranges
 */

/**
 * @typedef {Object} ScoringConfig
 * @property {ScoringQuestionConfig[]} questions - Question configurations
 * @property {ScoreTotalConfig[]} totals - Total/score configurations
 */

// ================================================
// Styles
// ================================================

const QUESTION_CONTAINER_STYLE = {
  padding: "12px 16px",
  marginBottom: "8px",
  borderRadius: "4px",
}

const TOTAL_CONTAINER_STYLE = {
  padding: "16px",
  marginTop: "16px",
  borderRadius: "8px",
}

const INTERPRETATION_BOX_STYLE = {
  padding: "8px 12px",
  borderRadius: "4px",
  display: "inline-block",
  marginTop: "8px",
}

// ================================================
// Helper Functions
// ================================================

/**
 * Build a score map from question options for quick lookup
 * @param {ScoringQuestionConfig[]} questions
 * @returns {Map<string, Map<string, number>>} Map of questionId -> (optionKey -> score)
 */
const buildScoreMap = (questions) => {
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

/**
 * Get score for a selected value
 * @param {Object} value - The Coding value from SimpleCodeChecklist
 * @param {Map<string, number>} optionScoreMap - Map of option key to score
 * @returns {number|null}
 */
const getScoreFromValue = (value, optionScoreMap) => {
  if (!value || !optionScoreMap) return null
  const code = value.code || value.key
  if (code && optionScoreMap.has(code)) {
    return optionScoreMap.get(code)
  }
  return null
}

/**
 * Check if a score falls within a range
 */
const isInRange = (score, range) => {
  if (score === null || score === undefined) return false

  const min = range.min
  const max = range.max

  const meetsMin = range.minInclusive !== false ? score >= min : score > min
  const meetsMax = max === null ? true : (range.maxInclusive !== false ? score <= max : score < max)

  return meetsMin && meetsMax
}

/**
 * Get the interpretation for a score based on ranges
 */
const getInterpretation = (score, ranges) => {
  if (score === null || score === undefined || !ranges?.length) {
    return null
  }

  for (const range of ranges) {
    if (isInRange(score, range)) {
      return {
        label: range.label,
        range,
        bounds: formatBounds(range),
      }
    }
  }

  return null
}

/**
 * Format range bounds for display (e.g., "≥14" or "10-13")
 */
const formatBounds = (range) => {
  const minSymbol = range.minInclusive !== false ? "≥" : ">"
  const maxSymbol = range.maxInclusive !== false ? "≤" : "<"

  if (range.max === null) {
    return `${minSymbol}${range.min}`
  }

  if (range.min === range.max && range.minInclusive !== false && range.maxInclusive !== false) {
    return `=${range.min}`
  }

  return `${range.min}-${range.max}`
}

// ================================================
// Sub-components
// ================================================

/**
 * Single question using SimpleCodeChecklist
 */
const ScoringQuestion = ({
  question,
  isDarkMode,
}) => {
  const containerStyle = {
    ...QUESTION_CONTAINER_STYLE,
    backgroundColor: isDarkMode ? "#2a2a2a" : "#f8f8f8",
    border: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
  }

  // Convert options to SimpleCodeChecklist format
  // Include score in the text for transparency
  const optionList = useMemo(() => {
    return (question.options || []).map(opt => ({
      key: opt.key,
      text: opt.text,
    }))
  }, [question.options])

  return (
    <div style={containerStyle}>
      <SimpleCodeChecklist
        fieldId={question.id}
        label={question.label}
        optionList={optionList}
        selectionType="single"
        multiline={question.multiline}
        codeSystem={question.codeSystem}
      />
    </div>
  )
}

/**
 * Total score display with interpretation
 */
const ScoringTotal = ({
  total,
  score,
  isComplete,
  isDarkMode,
}) => {
  const interpretation = useMemo(() => {
    return getInterpretation(score, total.ranges)
  }, [score, total.ranges])

  const containerStyle = {
    ...TOTAL_CONTAINER_STYLE,
    backgroundColor: isDarkMode ? "#1a3a5c" : "#e6f2ff",
    border: `1px solid ${isDarkMode ? "#2a5a8c" : "#b8d4f0"}`,
  }

  const errorContainerStyle = {
    ...TOTAL_CONTAINER_STYLE,
    backgroundColor: isDarkMode ? "#5c1a1a" : "#ffe6e6",
    border: `1px solid ${isDarkMode ? "#8c2a2a" : "#f0b8b8"}`,
  }

  const interpretationStyle = {
    ...INTERPRETATION_BOX_STYLE,
    backgroundColor: isDarkMode ? "#2a5a8c" : "#0078d4",
    color: "#ffffff",
  }

  if (!isComplete) {
    return (
      <div style={errorContainerStyle}>
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
          <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
            {total.label}:
          </Text>
          <Text styles={{ root: { color: isDarkMode ? "#ff8a8a" : "#d32f2f" } }}>
            Please answer all questions
          </Text>
        </Stack>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <Stack tokens={{ childrenGap: 8 }}>
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
          <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
            {total.label}:
          </Text>
          <Text variant="xLarge" styles={{ root: { fontWeight: 700 } }}>
            {score}
          </Text>
        </Stack>

        {interpretation && (
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <span style={interpretationStyle}>
              {interpretation.bounds} · {interpretation.label}
            </span>
          </Stack>
        )}
      </Stack>
    </div>
  )
}

// ================================================
// Main Component
// ================================================

/**
 * ScoringModule - Main scoring questionnaire component
 *
 * Uses SimpleCodeChecklist for each question and automatically
 * calculates totals based on configured score mappings.
 *
 * @param {Object} props
 * @param {string} props.id - Unique ID for this scoring module
 * @param {ScoringConfig} props.config - Scoring configuration
 * @param {string} [props.title] - Optional title for the module
 * @param {boolean} [props.showProgress] - Show completion progress
 */
const ScoringModule = ({
  id = "scoringModule",
  config = { questions: [], totals: [] },
  title,
  showProgress = true,
  ...props
}) => {
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  // Build score maps from config
  const scoreMap = useMemo(() => buildScoreMap(config.questions), [config.questions])

  // Get all answers from form data (each question stores its value at fd.field.data[questionId])
  const getAnswers = () => {
    const answers = {}
    for (const question of config.questions || []) {
      const value = fd?.field?.data?.[question.id]
      if (value) {
        answers[question.id] = value
      }
    }
    return answers
  }

  const answers = getAnswers()

  // Calculate totals
  const calculatedTotals = useMemo(() => {
    const results = {}

    for (const total of config.totals || []) {
      let score = 0
      let isComplete = true

      for (const term of total.terms || []) {
        const answer = answers[term.questionId]
        const optionScoreMap = scoreMap.get(term.questionId)
        const answerScore = getScoreFromValue(answer, optionScoreMap)

        if (answerScore !== null) {
          score += answerScore * (term.weight || 1)
        } else {
          isComplete = false
        }
      }

      results[total.id] = {
        score: isComplete ? score : null,
        isComplete,
      }
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

  // Container styles
  const containerStyle = {
    padding: "16px",
    border: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
    borderRadius: "8px",
    backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
  }

  const headerStyle = {
    marginBottom: "16px",
  }

  const progressStyle = {
    fontSize: "14px",
    color: isDarkMode ? "#a0a0a0" : "#666666",
    marginTop: "4px",
  }

  return (
    <div style={containerStyle}>
      {(title || showProgress) && (
        <div style={headerStyle}>
          {title && (
            <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
              {title}
            </Text>
          )}
          {showProgress && (
            <div style={progressStyle}>
              {progress.answered} of {progress.total} questions answered ({progress.percentage}%)
            </div>
          )}
          <Separator styles={{ root: { marginTop: "12px" } }} />
        </div>
      )}

      {/* Questions */}
      <Stack tokens={{ childrenGap: 8 }}>
        {(config.questions || []).map((question) => (
          <ScoringQuestion
            key={question.id}
            question={question}
            isDarkMode={isDarkMode}
          />
        ))}
      </Stack>

      {/* Totals */}
      {(config.totals || []).map((total) => (
        <ScoringTotal
          key={total.id}
          total={total}
          score={calculatedTotals[total.id]?.score}
          isComplete={calculatedTotals[total.id]?.isComplete}
          isDarkMode={isDarkMode}
        />
      ))}
    </div>
  )
}

/**
 * Schema definition for ScoringModule data
 * Each question stores its value as a Coding object
 */
const ScoringModuleSchema = {
  type: "object",
  additionalProperties: {
    $ref: "#/definitions/coding",
  },
}

/**
 * Helper to create question configurations with scored options
 * @param {Object} def - Question definition
 * @returns {ScoringQuestionConfig}
 *
 * @example
 * createScoringQuestion({
 *   id: "anxiety",
 *   label: "How often do you feel anxious?",
 *   options: [
 *     { key: "0", text: "Never", score: 0 },
 *     { key: "1", text: "Sometimes", score: 1 },
 *     { key: "2", text: "Often", score: 2 },
 *     { key: "3", text: "Always", score: 3 },
 *   ]
 * })
 */
const createScoringQuestion = (def) => ({
  id: def.id,
  label: def.label,
  multiline: def.multiline ?? false,
  codeSystem: def.codeSystem,
  options: (def.options || []).map((opt, idx) => ({
    key: opt.key || `${idx}`,
    text: opt.text || opt.label || `Option ${idx + 1}`,
    score: opt.score ?? idx,
  })),
})

/**
 * Helper to create total configurations
 * @param {Object} def - Total definition
 * @returns {ScoreTotalConfig}
 *
 * @example
 * createScoringTotal({
 *   id: "total",
 *   label: "Total Score",
 *   questionIds: ["q1", "q2", "q3"],  // shorthand for equal-weighted terms
 *   ranges: [
 *     { label: "Low", min: 0, max: 5 },
 *     { label: "High", min: 6, max: null },
 *   ]
 * })
 */
const createScoringTotal = (def) => ({
  id: def.id,
  label: def.label,
  targetFieldId: def.targetFieldId,
  terms: (def.terms || def.questionIds || []).map(t =>
    typeof t === "string" ? { questionId: t, weight: 1 } : t
  ),
  ranges: (def.ranges || []).map(r => ({
    label: r.label,
    min: r.min ?? 0,
    max: r.max ?? null,
    minInclusive: r.minInclusive !== false,
    maxInclusive: r.maxInclusive !== false,
  })),
})

/**
 * Helper to create a full scoring config
 * @param {Object} def - Config definition
 * @returns {ScoringConfig}
 *
 * @example
 * createScoringConfig({
 *   questions: [
 *     { id: "q1", label: "Question 1", options: [...] },
 *     { id: "q2", label: "Question 2", options: [...] },
 *   ],
 *   totals: [
 *     { id: "total", label: "Score", questionIds: ["q1", "q2"], ranges: [...] }
 *   ]
 * })
 */
const createScoringConfig = (def) => ({
  questions: (def.questions || []).map(createScoringQuestion),
  totals: (def.totals || []).map(createScoringTotal),
})

/**
 * Pre-built option sets for common scoring scales
 */
const ScoringScales = {
  /**
   * HoNOS Scale5 - Health of the Nation Outcome Scales
   * Standard 0-4 severity rating with 9 for unknown
   * Used in mental health assessments
   */
  honos: [
    { key: "0", text: "0 - No problem", score: 0 },
    { key: "1", text: "1 - Minor problem not requiring action", score: 1 },
    { key: "2", text: "2 - Mild problem but definitely present", score: 2 },
    { key: "3", text: "3 - Moderate problem", score: 3 },
    { key: "4", text: "4 - Severe to very severe problem", score: 4 },
    { key: "9", text: "9 - Unknown or not asked", score: 0 },
  ],
  /**
   * HoNOS Scale5 compact - Shows only numbers (like original HonosQuestion)
   * Useful when question labels already explain the scale
   */
  honosCompact: [
    { key: "0", text: "0", score: 0 },
    { key: "1", text: "1", score: 1 },
    { key: "2", text: "2", score: 2 },
    { key: "3", text: "3", score: 3 },
    { key: "4", text: "4", score: 4 },
    { key: "9", text: "9", score: 0 },
  ],
  /** Standard 0-4 frequency scale */
  frequency5: [
    { key: "0", text: "Never (0)", score: 0 },
    { key: "1", text: "Rarely (1)", score: 1 },
    { key: "2", text: "Sometimes (2)", score: 2 },
    { key: "3", text: "Often (3)", score: 3 },
    { key: "4", text: "Always (4)", score: 4 },
  ],
  /** Standard 0-3 severity scale */
  severity4: [
    { key: "0", text: "None (0)", score: 0 },
    { key: "1", text: "Mild (1)", score: 1 },
    { key: "2", text: "Moderate (2)", score: 2 },
    { key: "3", text: "Severe (3)", score: 3 },
  ],
  /** Standard 0-4 agreement scale */
  agreement5: [
    { key: "0", text: "Strongly Disagree (0)", score: 0 },
    { key: "1", text: "Disagree (1)", score: 1 },
    { key: "2", text: "Neutral (2)", score: 2 },
    { key: "3", text: "Agree (3)", score: 3 },
    { key: "4", text: "Strongly Agree (4)", score: 4 },
  ],
  /** Yes/No scale */
  yesNo: [
    { key: "Y", text: "Yes", score: 1 },
    { key: "N", text: "No", score: 0 },
  ],
  /** Yes/No/Unknown scale */
  yesNoUnknown: [
    { key: "Y", text: "Yes", score: 1 },
    { key: "N", text: "No", score: 0 },
    { key: "U", text: "Unknown", score: 0 },
  ],
}
