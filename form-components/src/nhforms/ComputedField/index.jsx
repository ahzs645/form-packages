const { useEffect, useMemo } = React

const _escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const _toNumericValue = (value) => {
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (Array.isArray(value)) {
    return value.length
  }
  if (typeof value === "object") {
    if (Number.isFinite(value.selectedCount)) {
      return Number(value.selectedCount)
    }
    const candidate = value.value ?? value.selectedKey ?? value.display ?? value.text ?? value.code ?? value.key ?? value.response
    return _toNumericValue(candidate)
  }
  return null
}

const _toComparableValue = (value) => {
  if (value === undefined || value === null) return ""
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value
  if (Array.isArray(value)) return value.map(_toComparableValue)
  if (typeof value === "object") {
    return value.value ?? value.selectedKey ?? value.display ?? value.text ?? value.code ?? value.key ?? value.response ?? ""
  }
  return String(value)
}

const _score = (value, scoreMap) => {
  const candidate = _toComparableValue(value)
  if (Array.isArray(candidate)) {
    return candidate.reduce((sum, entry) => sum + _score(entry, scoreMap), 0)
  }
  const direct = scoreMap?.[String(candidate)]
  if (Number.isFinite(direct)) return Number(direct)
  const numeric = _toNumericValue(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const _contains = (values, value) => {
  if (!Array.isArray(values)) return false
  const candidate = _toComparableValue(value)
  if (Array.isArray(candidate)) {
    return candidate.some((entry) => _contains(values, entry))
  }
  return values.map(String).includes(String(candidate))
}

const _hasValue = (value) => {
  if (value === undefined || value === null || value === "") return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

const _iif = (condition, whenTrue, whenFalse) => (condition ? whenTrue : whenFalse)
const _countTrue = (...values) => values.flat().filter((value) => value === true || value === "true" || value === "Y" || value === "Yes" || value === 1).length

// A field reference is `[field-id]`, and ids are slugified to id-safe
// characters. Restricting the class (rather than `[^\]]+`) keeps JSON array
// literals like `["often","very-often"]` — which appear as arguments to
// `contains(...)` — from being mistaken for field references.
const _COMPUTED_REF_PATTERN = /\[([A-Za-z0-9_.-]+)\]/g

const _extractComputedReferences = (expression) => {
  const bracketedRefs = Array.from(expression.matchAll(_COMPUTED_REF_PATTERN))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
  const unwrappedExpression = _stripQuotedStrings(expression.replace(/\[([^\]]+)\]/g, " "))
  const bareRefs = unwrappedExpression.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []
  return Array.from(new Set([...bracketedRefs, ...bareRefs]))
}

const _stripQuotedStrings = (expression) =>
  String(expression).replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, " ")

const _replaceBareReferencesOutsideQuotes = (expression, refs, valuesByFieldId) => {
  let prepared = ""
  let cursor = 0
  const stringPattern = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g
  const replaceInSegment = (segment) => {
    let nextSegment = segment
    for (const ref of refs) {
      if (["iif", "score", "contains", "hasValue", "countTrue", "null", "true", "false"].includes(ref)) continue
      const numeric = _toNumericValue(valuesByFieldId?.[ref])
      if (!Number.isFinite(numeric)) return null
      nextSegment = nextSegment.replace(new RegExp(`\\b${_escapeRegExp(ref)}\\b`, "g"), String(numeric))
    }
    return nextSegment
  }

  for (const match of expression.matchAll(stringPattern)) {
    const start = match.index ?? 0
    const replaced = replaceInSegment(expression.slice(cursor, start))
    if (replaced === null) return null
    prepared += replaced + match[0]
    cursor = start + match[0].length
  }

  const tail = replaceInSegment(expression.slice(cursor))
  if (tail === null) return null
  return prepared + tail
}

const _isSafeComputedExpression = (expression) => {
  const strippedExpression = _stripQuotedStrings(expression).replace(/\[([^\]]+)\]/g, " ")
  return /^[0-9+\-*/().,?:<>=!&|{}\[\]'"":\s_a-zA-Z]+$/.test(strippedExpression)
}

const _roundComputedValue = (value, precision) => {
  if (typeof value === "string" || typeof value === "boolean") return value
  if (!Number.isFinite(value)) return null
  if (!Number.isFinite(precision) || precision < 0) return value
  return Number(value.toFixed(Math.round(precision)))
}

const _evaluateComputedExpression = (expression, valuesByFieldId, currentFieldId) => {
  if (typeof expression !== "string") return null
  const trimmed = expression.trim()
  if (!trimmed) return null
  if (!_isSafeComputedExpression(trimmed)) return null

  const refs = _extractComputedReferences(trimmed)
  if (currentFieldId && refs.includes(currentFieldId)) {
    return null
  }

  let prepared = trimmed

  const bracketedRefs = Array.from(trimmed.matchAll(_COMPUTED_REF_PATTERN))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
  const uniqueBracketedRefs = Array.from(new Set(bracketedRefs)).sort((a, b) => b.length - a.length)
  for (const ref of uniqueBracketedRefs) {
    prepared = prepared.replace(new RegExp(`\\[${_escapeRegExp(ref)}\\]`, "g"), JSON.stringify(_toComparableValue(valuesByFieldId?.[ref])))
  }

  const bareRefs = _stripQuotedStrings(prepared).match(/[A-Za-z_][A-Za-z0-9_]*/g) || []
  const uniqueBareRefs = Array.from(new Set(bareRefs)).sort((a, b) => b.length - a.length)
  prepared = _replaceBareReferencesOutsideQuotes(prepared, uniqueBareRefs, valuesByFieldId)
  if (prepared === null) return null

  try {
    const result = Function("iif", "score", "contains", "hasValue", "countTrue", `"use strict"; return (${prepared});`)(
      _iif,
      _score,
      _contains,
      _hasValue,
      _countTrue
    )
    if (typeof result === "number") return Number.isFinite(result) ? result : null
    if (typeof result === "string" || typeof result === "boolean") return result
    return null
  } catch (error) {
    return null
  }
}

const _toDisplayValue = (value, precision, resultType) => {
  if (typeof value === "string") return value
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (!Number.isFinite(value)) return ""
  if (Number.isFinite(precision) && precision >= 0) {
    const rounded = value.toFixed(Math.round(precision))
    return resultType === "text" ? rounded : String(Number(rounded))
  }
  return String(value)
}

const _getInterpretationRange = (value, interpretation) => {
  if (!Number.isFinite(value) || !Array.isArray(interpretation?.ranges)) return null
  return interpretation.ranges.find((range) => {
    const min = Number(range?.min)
    const max = Number(range?.max)
    const passesMin = !Number.isFinite(min) || value >= min
    const passesMax = !Number.isFinite(max) || value <= max
    return passesMin && passesMax
  }) ?? null
}

const _hasAllReferencedValues = (expression, valuesByFieldId) => {
  const refs = Array.from(String(expression || "").matchAll(_COMPUTED_REF_PATTERN))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
  if (refs.length === 0) return true
  return Array.from(new Set(refs)).every((ref) => _hasValue(valuesByFieldId?.[ref]))
}

const ComputedField = ({
  fieldId,
  label,
  expression,
  precision,
  resultType = "number",
  labelPosition = "left",
  placeholder = "Calculated automatically",
  size,
  required = false,
  readOnly = true,
  showInterpretation = false,
  interpretation,
}) => {
  const [fd, setFd] = useActiveData()
  const valuesByFieldId = fd?.field?.data || {}

  const computedValue = useMemo(
    () => _evaluateComputedExpression(expression, valuesByFieldId, fieldId),
    [expression, fieldId, valuesByFieldId]
  )

  const roundedValue = useMemo(
    () => _roundComputedValue(computedValue, precision),
    [computedValue, precision]
  )

  const storedValue = useMemo(() => {
    if (typeof roundedValue === "string" || typeof roundedValue === "boolean") return roundedValue
    if (!Number.isFinite(roundedValue)) return null
    if (resultType === "text") {
      return _toDisplayValue(roundedValue, precision, "text")
    }
    return roundedValue
  }, [precision, resultType, roundedValue])

  const displayValue = useMemo(() => {
    // String/boolean results (e.g. iif chains returning "LOW"/"HIGH") must
    // render, not just persist — Number.isFinite alone blanked them.
    if (typeof roundedValue === "string") return roundedValue
    if (typeof roundedValue === "boolean") return String(roundedValue)
    if (!Number.isFinite(roundedValue)) return ""
    return _toDisplayValue(roundedValue, precision, resultType)
  }, [precision, resultType, roundedValue])

  const canShowInterpretation = useMemo(
    () => Boolean(showInterpretation && _hasAllReferencedValues(expression, valuesByFieldId)),
    [expression, showInterpretation, valuesByFieldId]
  )

  const interpretationRange = useMemo(
    () => canShowInterpretation ? _getInterpretationRange(roundedValue, interpretation) : null,
    [canShowInterpretation, interpretation, roundedValue]
  )

  useEffect(() => {
    if (!fieldId) return
    setFd((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data || typeof draft.field.data !== "object") {
        draft.field.data = {}
      }
      if (draft.field.data[fieldId] === storedValue) return
      draft.field.data[fieldId] = storedValue
    })
  }, [fieldId, setFd, storedValue])

  return (
    <div>
      <TextArea
        fieldId={fieldId}
        label={label}
        value={displayValue}
        labelPosition={labelPosition}
        placeholder={placeholder}
        readOnly={readOnly !== false}
        required={required}
        size={size}
      />
      {interpretationRange ? (
        <div style={{ marginTop: 4, marginLeft: labelPosition === "left" ? 160 : 0, fontSize: 12, color: "#475569" }}>
          <strong>{interpretation?.label || "Interpretation"}:</strong> {interpretationRange.label}
          {interpretationRange.description ? <span> - {interpretationRange.description}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
