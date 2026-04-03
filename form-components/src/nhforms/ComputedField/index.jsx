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

const _extractComputedReferences = (expression) => {
  const bracketedRefs = Array.from(expression.matchAll(/\[([^\]]+)\]/g))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
  const unwrappedExpression = expression.replace(/\[([^\]]+)\]/g, " ")
  const bareRefs = unwrappedExpression.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []
  return Array.from(new Set([...bracketedRefs, ...bareRefs]))
}

const _isSafeComputedExpression = (expression) => {
  const strippedExpression = expression.replace(/\[([^\]]+)\]/g, " ")
  return /^[0-9+\-*/().,\s_a-zA-Z]+$/.test(strippedExpression)
}

const _roundComputedValue = (value, precision) => {
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

  const bracketedRefs = Array.from(trimmed.matchAll(/\[([^\]]+)\]/g))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
  const uniqueBracketedRefs = Array.from(new Set(bracketedRefs)).sort((a, b) => b.length - a.length)
  for (const ref of uniqueBracketedRefs) {
    const numeric = _toNumericValue(valuesByFieldId?.[ref])
    if (!Number.isFinite(numeric)) return null
    prepared = prepared.replace(new RegExp(`\\[${_escapeRegExp(ref)}\\]`, "g"), String(numeric))
  }

  const bareRefs = prepared.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []
  const uniqueBareRefs = Array.from(new Set(bareRefs)).sort((a, b) => b.length - a.length)
  for (const ref of uniqueBareRefs) {
    const numeric = _toNumericValue(valuesByFieldId?.[ref])
    if (!Number.isFinite(numeric)) return null
    prepared = prepared.replace(new RegExp(`\\b${_escapeRegExp(ref)}\\b`, "g"), String(numeric))
  }

  try {
    const result = Function(`"use strict"; return (${prepared});`)()
    return typeof result === "number" && Number.isFinite(result) ? result : null
  } catch (error) {
    return null
  }
}

const _toDisplayValue = (value, precision, resultType) => {
  if (!Number.isFinite(value)) return ""
  if (Number.isFinite(precision) && precision >= 0) {
    const rounded = value.toFixed(Math.round(precision))
    return resultType === "text" ? rounded : String(Number(rounded))
  }
  return String(value)
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
    if (!Number.isFinite(roundedValue)) return null
    if (resultType === "text") {
      return _toDisplayValue(roundedValue, precision, "text")
    }
    return roundedValue
  }, [precision, resultType, roundedValue])

  const displayValue = useMemo(() => {
    if (!Number.isFinite(roundedValue)) return ""
    return _toDisplayValue(roundedValue, precision, resultType)
  }, [precision, resultType, roundedValue])

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
  )
}
