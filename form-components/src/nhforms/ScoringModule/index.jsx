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
  TooltipHost,
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
 * @property {string} [description] - Optional supporting text for legends/tooltips
 */

/**
 * @typedef {Object} ScoringQuestionConfig
 * @property {string} id - Unique question ID (also used as fieldId)
 * @property {string} label - Question text
 * @property {ScoringOptionConfig[]} [options] - Answer options with scores
 * @property {boolean} [multiline] - Use vertical layout for options
 * @property {string} [codeSystem] - Optional code system reference
 * @property {{ checkedOptionKey?: string, uncheckedOptionKey?: string }} [checklist] - Optional grouped-checklist option mapping
 */

/**
 * @typedef {Object} ScoringQuestionGroupConfig
 * @property {string} id - Unique group ID
 * @property {string} [title] - Optional section heading
 * @property {string} [prompt] - Prompt shown above the group's questions
 * @property {string[]} questionIds - Questions rendered in this group
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
 * @property {"stacked"|"compact"|"matrix"|"grouped-checklist"} [layout] - Preferred question layout
 * @property {{ min?: string, max?: string }} [continuumLabels] - Optional captions for the left/right ends of a compact scale
 * @property {ScoringOptionConfig[]} [sharedOptions] - Shared scale for matrix-style questionnaires
 * @property {ScoringQuestionGroupConfig[]} [groups] - Optional grouped-checklist sections
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
const resolveQuestionOptions = (question, sharedOptions) => {
  const questionOptions = Array.isArray(question?.options) ? question.options : []
  if (questionOptions.length > 0) return questionOptions
  return Array.isArray(sharedOptions) ? sharedOptions : []
}

const buildScoreMap = (questions, sharedOptions) => {
  const map = new Map()
  for (const question of questions || []) {
    const optionMap = new Map()
    for (const opt of resolveQuestionOptions(question, sharedOptions)) {
      optionMap.set(opt.key, opt.score ?? 0)
    }
    map.set(question.id, optionMap)
  }
  return map
}

const normalizeScoreToken = (value) => String(value ?? "").trim().toLowerCase()

const collectScoreCandidates = (value, out = new Set(), depth = 0) => {
  if (depth > 4 || value === null || value === undefined) return out

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const token = String(value).trim()
    if (token) out.add(token)
    return out
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectScoreCandidates(entry, out, depth + 1))
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
    collectScoreCandidates(value[key], out, depth + 1)
  })

  if (Array.isArray(value.selectedItems)) {
    value.selectedItems.forEach((entry) => collectScoreCandidates(entry, out, depth + 1))
  }
  collectScoreCandidates(value.selectedItem, out, depth + 1)
  if (Array.isArray(value.selectedIds)) {
    value.selectedIds.forEach((entry) => collectScoreCandidates(entry, out, depth + 1))
  }
  if (Array.isArray(value.selectedLabels)) {
    value.selectedLabels.forEach((entry) => collectScoreCandidates(entry, out, depth + 1))
  }

  return out
}

/**
 * Get score for a selected value
 * @param {Object} value - The Coding value from SimpleCodeChecklist
 * @param {Map<string, number>} optionScoreMap - Map of option key to score
 * @returns {number|null}
 */
const getScoreFromValue = (value, optionScoreMap) => {
  if (!optionScoreMap) return null

  const candidates = Array.from(collectScoreCandidates(value))
  if (candidates.length === 0) return null

  for (const candidate of candidates) {
    if (optionScoreMap.has(candidate)) {
      return optionScoreMap.get(candidate)
    }
  }

  const normalizedOptionMap = new Map()
  optionScoreMap.forEach((score, key) => {
    normalizedOptionMap.set(normalizeScoreToken(key), score)
  })

  for (const candidate of candidates) {
    const direct = normalizedOptionMap.get(normalizeScoreToken(candidate))
    if (direct !== undefined) return direct
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

const serializeOptionSignature = (options) =>
  JSON.stringify((options || []).map((option) => [option.key, option.score ?? 0, option.text || "", option.description || ""]))

const resolveMatrixOptions = (config) => {
  const explicitShared = Array.isArray(config?.sharedOptions) ? config.sharedOptions : []
  if (explicitShared.length > 0) return explicitShared

  const questions = Array.isArray(config?.questions) ? config.questions : []
  const optionsBySignature = new Map()
  const countsBySignature = new Map()

  questions.forEach((question) => {
    const questionOptions = Array.isArray(question?.options) ? question.options : []
    if (questionOptions.length === 0) return
    const signature = serializeOptionSignature(questionOptions)
    optionsBySignature.set(signature, questionOptions)
    countsBySignature.set(signature, (countsBySignature.get(signature) || 0) + 1)
  })

  let winnerSignature = null
  let winnerCount = 0
  countsBySignature.forEach((count, signature) => {
    if (count > winnerCount) {
      winnerSignature = signature
      winnerCount = count
    }
  })

  if (!winnerSignature || winnerCount < 2) return []
  return optionsBySignature.get(winnerSignature) || []
}

const resolveChecklistOptions = (question, sharedOptions) => {
  const options = resolveQuestionOptions(question, sharedOptions)
  if (!Array.isArray(options) || options.length === 0) {
    return { checkedOption: null, uncheckedOption: null }
  }

  const checklist = question?.checklist || {}
  const checkedFromConfig = options.find((option) => option.key === checklist.checkedOptionKey) || null
  const uncheckedFromConfig = options.find((option) => option.key === checklist.uncheckedOptionKey) || null

  const checkedOption =
    checkedFromConfig ||
    [...options].sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0] ||
    null

  const uncheckedOption =
    uncheckedFromConfig ||
    options.find((option) => (option.score ?? 0) === 0) ||
    [...options].sort((left, right) => (left.score ?? 0) - (right.score ?? 0)).find((option) => option.key !== checkedOption?.key) ||
    checkedOption ||
    null

  return { checkedOption, uncheckedOption }
}

const _safeSerialize = (value) => {
  if (value === undefined) return "__undefined__"
  try {
    return JSON.stringify(value)
  } catch (error) {
    return String(value)
  }
}

const _cloneMirrorValue = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value !== "object") return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    return value
  }
}

const _getQuestionMirrorFieldIds = (question) => {
  const ids = new Set()
  if (question?.fieldId) ids.add(question.fieldId)
  if (Array.isArray(question?.childFieldIds)) {
    question.childFieldIds.forEach((fieldId) => {
      if (fieldId) ids.add(fieldId)
    })
  }
  ids.delete(question?.id)
  return Array.from(ids)
}

// ================================================
// Sub-components
// ================================================

/**
 * Single question using local radio inputs
 */
const ScoringQuestion = ({
  question,
  sharedOptions,
  isDarkMode,
}) => {
  const [fieldData, setFieldData] = useFormSessionData(fd => fd.field.data)
  const currentData = fieldData?.[question.id] || { selectedKey: null }
  const containerStyle = {
    ...QUESTION_CONTAINER_STYLE,
    backgroundColor: isDarkMode ? "#2a2a2a" : "#f8f8f8",
    border: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
  }

  const options = useMemo(() => resolveQuestionOptions(question, sharedOptions), [question, sharedOptions])

  useEffect(() => {
    if (!fieldData?.[question.id]) {
      setFieldData({
        [question.id]: {
          selectedKey: null,
          value: null,
          response: null,
        }
      })
    }
  }, [fieldData, question.id, setFieldData])

  const handleSelect = (option) => {
    setFieldData({
      [question.id]: {
        selectedKey: option.key,
        value: option.key,
        response: option.text,
        detailResponse: option.description || option.text,
      }
    })
  }

  return (
    <div style={containerStyle}>
      <Text styles={{ root: { fontSize: "13px", fontWeight: 600, lineHeight: 1.35, marginBottom: "10px" } }}>
        {question.label}
      </Text>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {options.map((option) => (
          <label
            key={`${question.id}_${option.key}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              cursor: "pointer",
              color: isDarkMode ? "#f3f3f3" : "#222222",
              lineHeight: 1.35,
            }}
          >
            <input
              type="radio"
              name={`scoring_${question.id}`}
              checked={currentData.selectedKey === option.key}
              onChange={() => handleSelect(option)}
              style={{ marginTop: "2px", width: "14px", height: "14px", cursor: "pointer" }}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

const ScoringOptionTooltip = ({ option }) => {
  if (!option) return null

  return (
    <div style={{ padding: "8px", maxWidth: "320px", whiteSpace: "pre-wrap", lineHeight: 1.35 }}>
      <div style={{ fontWeight: 700, marginBottom: "4px" }}>{option.text}</div>
      <div>{option.description || option.text}</div>
    </div>
  )
}

const CompactScoringQuestion = ({
  question,
  sharedOptions,
  continuumLabels,
  isDarkMode,
}) => {
  const [fieldData, setFieldData] = useFormSessionData(fd => fd.field.data)
  const currentData = fieldData?.[question.id] || { selectedKey: null }
  const options = useMemo(
    () => resolveQuestionOptions(question, sharedOptions),
    [question, sharedOptions]
  )
  useEffect(() => {
    if (!fieldData?.[question.id]) {
      setFieldData({
        [question.id]: {
          selectedKey: null,
          value: null,
          response: null,
        }
      })
    }
  }, [fieldData, question.id, setFieldData])

  const handleSelect = (option) => {
    setFieldData({
      [question.id]: {
        selectedKey: option.key,
        value: option.key,
        response: option.text,
        detailResponse: option.text,
      }
    })
  }

  const wrapperStyle = {
    ...QUESTION_CONTAINER_STYLE,
    backgroundColor: currentData.selectedKey
      ? (isDarkMode ? "#232f3d" : "#f8fbff")
      : (isDarkMode ? "#2a2a2a" : "#f8f8f8"),
    border: `1px solid ${currentData.selectedKey
      ? (isDarkMode ? "#355779" : "#b8d4f0")
      : (isDarkMode ? "#404040" : "#e0e0e0")}`,
  }

  const rowStyle = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",
  }

  const labelStyle = {
    flex: "0 1 260px",
    minWidth: "220px",
  }

  const scaleWrapStyle = {
    flex: "1 1 420px",
    minWidth: "0px",
    overflowX: "auto",
    paddingBottom: "2px",
  }

  const scaleGridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(34px, 1fr))`,
    gap: "6px",
    minWidth: `${Math.max(options.length * 42, 360)}px`,
    alignItems: "start",
  }

  const minContinuumLabel =
    typeof continuumLabels?.min === "string" && continuumLabels.min.trim()
      ? continuumLabels.min.trim()
      : null
  const maxContinuumLabel =
    typeof continuumLabels?.max === "string" && continuumLabels.max.trim()
      ? continuumLabels.max.trim()
      : null

  return (
    <div style={wrapperStyle}>
      <div style={rowStyle}>
        <div style={labelStyle}>
          <Text styles={{ root: { fontSize: "13px", fontWeight: 600, lineHeight: 1.35 } }}>
            {question.label}
          </Text>
        </div>

        <div style={scaleWrapStyle}>
          <div style={scaleGridStyle}>
            {options.map((option) => {
              const selected = currentData.selectedKey === option.key
              const hasDescription = typeof option.description === "string" && option.description.trim()
              const optionControl = (
                <label
                  key={`${question.id}_${option.key}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    cursor: "pointer",
                    padding: "6px 2px",
                    borderRadius: "6px",
                    backgroundColor: selected
                      ? (isDarkMode ? "#1f3f61" : "#eaf4ff")
                      : "transparent",
                    border: `1px solid ${selected
                      ? (isDarkMode ? "#4f87b8" : "#7ab3e6")
                      : "transparent"}`,
                  }}
                >
                  <input
                    type="radio"
                    name={`compact_${question.id}`}
                    checked={selected}
                    onChange={() => handleSelect(option)}
                    style={{ width: "16px", height: "16px", cursor: "pointer", margin: 0 }}
                  />
                  <span
                    style={{
                      fontSize: "11px",
                      lineHeight: 1,
                      fontWeight: selected ? 700 : 500,
                      color: isDarkMode ? "#f3f3f3" : "#333333",
                    }}
                  >
                    {option.text}
                  </span>
                </label>
              )

              if (!hasDescription) {
                return optionControl
              }

              return (
                <TooltipHost
                  key={`${question.id}_${option.key}`}
                  tooltipProps={{
                    onRenderContent: () => <ScoringOptionTooltip option={option} />,
                  }}
                >
                  {optionControl}
                </TooltipHost>
              )
            })}
          </div>
          {(minContinuumLabel || maxContinuumLabel) && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                minWidth: `${Math.max(options.length * 42, 360)}px`,
                marginTop: "6px",
                fontSize: "11px",
                lineHeight: 1.3,
                color: isDarkMode ? "#aeb8c2" : "#64748b",
              }}
            >
              <span>{minContinuumLabel ?? ""}</span>
              <span style={{ textAlign: "right" }}>{maxContinuumLabel ?? ""}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const MatrixScoringRow = ({
  question,
  options,
  isDarkMode,
}) => {
  const [fieldData, setFieldData] = useFormSessionData(fd => fd.field.data)
  const currentData = fieldData?.[question.id] || { selectedKey: null }

  useEffect(() => {
    if (!fieldData?.[question.id]) {
      setFieldData({
        [question.id]: {
          selectedKey: null,
          value: null,
          response: null,
        }
      })
    }
  }, [fieldData, question.id, setFieldData])

  const handleSelect = (option) => {
    setFieldData({
      [question.id]: {
        selectedKey: option.key,
        value: option.key,
        response: option.text,
        detailResponse: option.text,
      }
    })
  }

  const rowStyle = {
    backgroundColor: currentData.selectedKey
      ? (isDarkMode ? "#232f3d" : "#f8fbff")
      : (isDarkMode ? "#2a2a2a" : "#ffffff"),
  }

  const labelCellStyle = {
    padding: "12px",
    borderTop: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
    borderRight: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
    verticalAlign: "middle",
    minWidth: "280px",
  }

  const optionCellStyle = {
    padding: "10px 8px",
    borderTop: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
    textAlign: "center",
    verticalAlign: "middle",
    width: `${100 / Math.max(options.length, 1)}%`,
  }

  return (
    <tr style={rowStyle}>
      <td style={labelCellStyle}>
        <Text styles={{ root: { fontSize: "13px", lineHeight: 1.35 } }}>
          {question.label}
        </Text>
      </td>
      {options.map((option) => (
        <td key={`${question.id}_${option.key}`} style={optionCellStyle}>
          <input
            type="radio"
            name={`matrix_${question.id}`}
            checked={currentData.selectedKey === option.key}
            onChange={() => handleSelect(option)}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
        </td>
      ))}
    </tr>
  )
}

const GroupedChecklistQuestion = ({
  question,
  sharedOptions,
  isDarkMode,
}) => {
  const [fieldData, setFieldData] = useFormSessionData(fd => fd.field.data)
  const currentData = fieldData?.[question.id] || null
  const { checkedOption, uncheckedOption } = useMemo(
    () => resolveChecklistOptions(question, sharedOptions),
    [question, sharedOptions]
  )

  useEffect(() => {
    if (fieldData?.[question.id] || !uncheckedOption) return
    setFieldData({
      [question.id]: {
        selectedKey: uncheckedOption.key,
        value: uncheckedOption.key,
        response: uncheckedOption.text,
        detailResponse: uncheckedOption.description || uncheckedOption.text,
      }
    })
  }, [fieldData, question.id, setFieldData, uncheckedOption])

  const checked = currentData?.selectedKey === checkedOption?.key

  const handleToggle = (event) => {
    const nextChecked = Boolean(event?.target?.checked)
    const nextOption = nextChecked ? checkedOption : uncheckedOption
    if (!nextOption) {
      setFieldData({ [question.id]: null })
      return
    }
    setFieldData({
      [question.id]: {
        selectedKey: nextOption.key,
        value: nextOption.key,
        response: nextOption.text,
        detailResponse: nextOption.description || nextOption.text,
      }
    })
  }

  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        cursor: "pointer",
        padding: "2px 0",
        lineHeight: 1.35,
        color: isDarkMode ? "#f3f3f3" : "#222222",
      }}
    >
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={handleToggle}
        style={{ marginTop: "2px", width: "14px", height: "14px", cursor: "pointer" }}
      />
      <span style={{ fontSize: "12px" }}>{question.label}</span>
    </label>
  )
}

const GroupedChecklistSection = ({
  group,
  questionsById,
  sharedOptions,
  isDarkMode,
}) => {
  const sectionQuestions = (group.questionIds || [])
    .map((questionId) => questionsById.get(questionId))
    .filter(Boolean)

  if (sectionQuestions.length === 0) return null

  return (
    <div
      style={{
        ...QUESTION_CONTAINER_STYLE,
        backgroundColor: isDarkMode ? "#2a2a2a" : "#f8f8f8",
        border: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
        marginBottom: "12px",
      }}
    >
      {group.title ? (
        <Text
          styles={{
            root: {
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              marginBottom: "8px",
            }
          }}
        >
          {group.title}
        </Text>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 2fr) minmax(180px, 1fr)", gap: "12px" }}>
        <div>
          {group.prompt ? (
            <Text styles={{ root: { fontSize: "12px", lineHeight: 1.35 } }}>
              {group.prompt}
            </Text>
          ) : null}
        </div>
        <div>
          <Stack tokens={{ childrenGap: 2 }}>
            {sectionQuestions.map((question) => (
              <GroupedChecklistQuestion
                key={question.id}
                question={question}
                sharedOptions={sharedOptions}
                isDarkMode={isDarkMode}
              />
            ))}
          </Stack>
        </div>
      </div>
    </div>
  )
}

const MatrixScoringTable = ({
  questions,
  options,
  isDarkMode,
}) => {
  const wrapperStyle = {
    overflowX: "auto",
    borderRadius: "8px",
    border: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
  }

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  }

  const headerLabelStyle = {
    padding: "10px 12px",
    textAlign: "left",
    backgroundColor: isDarkMode ? "#222222" : "#f3f4f6",
    color: isDarkMode ? "#d4d4d4" : "#4b5563",
    fontSize: "12px",
    fontWeight: 600,
    borderRight: `1px solid ${isDarkMode ? "#404040" : "#d8d8d8"}`,
  }

  const headerOptionStyle = {
    padding: "10px 8px",
    textAlign: "center",
    backgroundColor: isDarkMode ? "#222222" : "#f3f4f6",
    color: isDarkMode ? "#d4d4d4" : "#4b5563",
    fontSize: "12px",
    fontWeight: 600,
  }

  return (
    <div style={wrapperStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerLabelStyle}>Question</th>
            {options.map((option) => (
              <th key={`header_${option.key}`} style={headerOptionStyle}>
                {option.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((question) => (
            <MatrixScoringRow
              key={question.id}
              question={question}
              options={options}
              isDarkMode={isDarkMode}
            />
          ))}
        </tbody>
      </table>
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
  const [fd, setFd] = useFormSessionData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false
  const sharedOptions = useMemo(() => resolveMatrixOptions(config), [config])
  const continuumLabels = config.continuumLabels || null
  const questionGroups = Array.isArray(config.groups) ? config.groups : null

  // Build score maps from config
  const scoreMap = useMemo(() => buildScoreMap(config.questions, sharedOptions), [config.questions, sharedOptions])

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
    const questionsById = new Map((config.questions || []).map((question) => [question.id, question]))

    for (const total of config.totals || []) {
      let score = 0
      let isComplete = true

      for (const term of total.terms || []) {
        const answer = answers[term.questionId]
        const optionScoreMap = scoreMap.get(term.questionId)
        const answerScore = getScoreFromValue(answer, optionScoreMap)

        if (answerScore !== null) {
          score += answerScore * (term.weight || 1)
        } else if (config.layout === "grouped-checklist") {
          const question = questionsById.get(term.questionId)
          const { uncheckedOption } = resolveChecklistOptions(question, sharedOptions)
          if (uncheckedOption) {
            score += (uncheckedOption.score ?? 0) * (term.weight || 1)
          } else {
            isComplete = false
          }
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
  }, [answers, config.layout, config.questions, config.totals, scoreMap, sharedOptions])

  useEffect(() => {
    if (!setFd) return

    const currentData = fd?.field?.data || {}
    const questionMirrorEntries = []

    for (const question of config.questions || []) {
      const answerValue = currentData[question.id] ?? null
      const mirrorIds = _getQuestionMirrorFieldIds(question)
      mirrorIds.forEach((fieldId) => {
        questionMirrorEntries.push([fieldId, answerValue])
      })
    }

    const totalMirrorEntries = []
    for (const total of config.totals || []) {
      const scoreValue = calculatedTotals[total.id]?.isComplete ? calculatedTotals[total.id]?.score : null
      const targetIds = [
        total.targetFieldId,
        ...(Array.isArray(total.targetFieldIds) ? total.targetFieldIds : []),
      ].filter(Boolean)
      targetIds.forEach((fieldId) => {
        totalMirrorEntries.push([fieldId, scoreValue])
      })
    }

    const allEntries = [...questionMirrorEntries, ...totalMirrorEntries]
    const hasChanges = allEntries.some(([fieldId, nextValue]) => (
      _safeSerialize(currentData[fieldId]) !== _safeSerialize(nextValue)
    ))

    if (!hasChanges) return

    setFd((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data) {
        draft.field.data = {}
      }

      allEntries.forEach(([fieldId, nextValue]) => {
        draft.field.data[fieldId] = _cloneMirrorValue(nextValue)
      })
    })
  }, [fd, setFd, config.questions, config.totals, calculatedTotals])

  // Calculate progress
  const progress = useMemo(() => {
    const questions = config.questions || []
    const total = questions.length
    const answered = questions.filter((question) => {
      const value = answers[question.id]
      const optionScoreMap = scoreMap.get(question.id)
      return getScoreFromValue(value, optionScoreMap) !== null
    }).length
    return { answered, total, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 }
  }, [answers, config.questions, scoreMap])

  const matrixSignature = sharedOptions.length > 0 ? serializeOptionSignature(sharedOptions) : null
  const normalizedLayout = config.layout || "stacked"
  const shouldRenderMatrix = normalizedLayout === "matrix" && Boolean(matrixSignature)
  const shouldRenderCompact = normalizedLayout === "compact"
  const shouldRenderGroupedChecklist = normalizedLayout === "grouped-checklist"
  const effectiveShowProgress = showProgress && !shouldRenderGroupedChecklist
  const matrixQuestions = useMemo(() => {
    if (!shouldRenderMatrix) return []
    return (config.questions || []).filter((question) => {
      const resolvedOptions = resolveQuestionOptions(question, sharedOptions)
      return resolvedOptions.length > 0 && serializeOptionSignature(resolvedOptions) === matrixSignature
    })
  }, [config.questions, matrixSignature, sharedOptions, shouldRenderMatrix])
  const matrixQuestionIds = useMemo(() => new Set(matrixQuestions.map((question) => question.id)), [matrixQuestions])
  const stackedQuestions = useMemo(() => {
    if (!shouldRenderMatrix) return config.questions || []
    return (config.questions || []).filter((question) => !matrixQuestionIds.has(question.id))
  }, [config.questions, matrixQuestionIds, shouldRenderMatrix])
  const questionsById = useMemo(
    () => new Map((config.questions || []).map((question) => [question.id, question])),
    [config.questions]
  )
  const groupedQuestionIds = useMemo(() => {
    if (!shouldRenderGroupedChecklist) return new Set()
    const ids = new Set()
    ;(questionGroups || []).forEach((group) => {
      ;(group.questionIds || []).forEach((questionId) => ids.add(questionId))
    })
    return ids
  }, [questionGroups, shouldRenderGroupedChecklist])
  const checklistUngroupedQuestions = useMemo(() => {
    if (!shouldRenderGroupedChecklist) return []
    return (config.questions || []).filter((question) => !groupedQuestionIds.has(question.id))
  }, [config.questions, groupedQuestionIds, shouldRenderGroupedChecklist])

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
      {(title || effectiveShowProgress) && (
        <div style={headerStyle}>
          {title && (
            <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
              {title}
            </Text>
          )}
          {effectiveShowProgress && (
            <div style={progressStyle}>
              {progress.answered} of {progress.total} questions answered ({progress.percentage}%)
            </div>
          )}
          <Separator styles={{ root: { marginTop: "12px" } }} />
        </div>
      )}

      {/* Questions */}
      {shouldRenderMatrix && matrixQuestions.length > 0 && (
        <div style={{ marginBottom: stackedQuestions.length > 0 ? "16px" : 0 }}>
          <MatrixScoringTable
            questions={matrixQuestions}
            options={sharedOptions}
            isDarkMode={isDarkMode}
          />
        </div>
      )}

      {shouldRenderGroupedChecklist ? (
        <div>
          {(questionGroups || []).map((group) => (
            <GroupedChecklistSection
              key={group.id}
              group={group}
              questionsById={questionsById}
              sharedOptions={sharedOptions}
              isDarkMode={isDarkMode}
            />
          ))}
          {checklistUngroupedQuestions.length > 0 ? (
            <div
              style={{
                ...QUESTION_CONTAINER_STYLE,
                backgroundColor: isDarkMode ? "#2a2a2a" : "#f8f8f8",
                border: `1px solid ${isDarkMode ? "#404040" : "#e0e0e0"}`,
              }}
            >
              <Stack tokens={{ childrenGap: 2 }}>
                {checklistUngroupedQuestions.map((question) => (
                  <GroupedChecklistQuestion
                    key={question.id}
                    question={question}
                    sharedOptions={sharedOptions}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </Stack>
            </div>
          ) : null}
        </div>
      ) : (
        <Stack tokens={{ childrenGap: 8 }}>
          {stackedQuestions.map((question) => (
            shouldRenderCompact ? (
              <CompactScoringQuestion
                key={question.id}
                question={question}
                sharedOptions={sharedOptions}
                continuumLabels={continuumLabels}
                isDarkMode={isDarkMode}
              />
            ) : (
              <ScoringQuestion
                key={question.id}
                question={question}
                sharedOptions={sharedOptions}
                isDarkMode={isDarkMode}
              />
            )
          ))}
        </Stack>
      )}

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
  checklist: def.checklist
    ? {
        checkedOptionKey: def.checklist.checkedOptionKey,
        uncheckedOptionKey: def.checklist.uncheckedOptionKey,
      }
    : undefined,
  options: (def.options || []).map((opt, idx) => ({
    key: opt.key || `${idx}`,
    text: opt.text || opt.label || `Option ${idx + 1}`,
    score: opt.score ?? idx,
    description: opt.description,
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
  layout:
    def.layout === "matrix" || def.layout === "compact" || def.layout === "grouped-checklist"
      ? def.layout
      : "stacked",
  continuumLabels: def.continuumLabels
    ? {
        min: def.continuumLabels.min,
        max: def.continuumLabels.max,
      }
    : undefined,
  sharedOptions: (def.sharedOptions || []).map((opt, idx) => ({
    key: opt.key || `${idx}`,
    text: opt.text || opt.label || `Option ${idx + 1}`,
    score: opt.score ?? idx,
    description: opt.description,
  })),
  groups: (def.groups || []).map((group, index) => ({
    id: group.id || `group_${index + 1}`,
    title: group.title,
    prompt: group.prompt,
    questionIds: Array.isArray(group.questionIds) ? group.questionIds : [],
  })),
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
