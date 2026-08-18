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
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : ""
  if (typeof value === "object") {
    return value.value ?? value.selectedKey ?? value.date ?? value.display ?? value.text ?? value.code ?? value.key ?? value.response ?? ""
  }
  return String(value)
}

// DateSelect stores the *formatted* display string, not ISO, so every builder
// dateFormat option must parse explicitly. dd/MM/yyyy and MM-dd-yyyy are
// distinguishable by separator (slash vs dash); MM-dd-yyyy cannot collide with
// ISO because ISO leads with a 4-digit year. Date-only strings parse as LOCAL
// calendar dates (not UTC midnight) so local getters read the intended day.
const _DATE_ONLY_FORMATS = [
  { pattern: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: [1, 2, 3] }, // yyyy-MM-dd (ISO)
  { pattern: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/, order: [1, 2, 3] }, // yyyy.MM.dd (DateSelect default)
  { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: [3, 2, 1] }, // dd/MM/yyyy
  { pattern: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: [3, 1, 2] }, // MM-dd-yyyy
]

// null = matched but invalid (e.g. 31/04); undefined = not a date-only string.
const _parseDateOnlyString = (text) => {
  for (const format of _DATE_ONLY_FORMATS) {
    const match = format.pattern.exec(text)
    if (!match) continue
    const [year, month, day] = format.order.map((index) => Number(match[index]))
    const date = new Date(year, month - 1, day)
    const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    return valid ? date : null
  }
  return undefined
}

const _toDateValue = (value) => {
  if (value === undefined || value === null || value === "") return null
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const dateOnly = _parseDateOnlyString(trimmed)
    if (dateOnly !== undefined) return dateOnly
    const date = new Date(trimmed)
    return Number.isFinite(date.getTime()) ? date : null
  }
  if (typeof value === "object") {
    for (const key of ["value", "date", "text", "display"]) {
      const date = _toDateValue(value[key])
      if (date) return date
    }
  }
  return null
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
const _floor = (value) => {
  const numeric = _toNumericValue(value)
  return Number.isFinite(numeric) ? Math.floor(numeric) : null
}
const _mod = (value, divisor) => {
  const numeric = _toNumericValue(value)
  const numericDivisor = _toNumericValue(divisor)
  if (!Number.isFinite(numeric) || !Number.isFinite(numericDivisor) || numericDivisor === 0) return null
  return numeric % numericDivisor
}
const _round = (value, precision = 0) => {
  const numeric = _toNumericValue(value)
  const numericPrecision = _toNumericValue(precision)
  if (!Number.isFinite(numeric) || !Number.isFinite(numericPrecision)) return null
  const digits = Math.round(numericPrecision)
  const factor = 10 ** digits
  if (!Number.isFinite(factor) || factor === 0) return null
  return Math.round(numeric * factor) / factor
}
const _power = (value, exponent) => {
  const numeric = _toNumericValue(value)
  const numericExponent = _toNumericValue(exponent)
  if (!Number.isFinite(numeric) || !Number.isFinite(numericExponent)) return null
  const result = numeric ** numericExponent
  return Number.isFinite(result) ? result : null
}
const _ln = (value) => {
  const numeric = _toNumericValue(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const result = Math.log(numeric)
  return Number.isFinite(result) ? result : null
}
const _exp = (value) => {
  const numeric = _toNumericValue(value)
  if (!Number.isFinite(numeric)) return null
  const result = Math.exp(numeric)
  return Number.isFinite(result) ? result : null
}
const _coalesce = (...values) => values.find((value) => value !== undefined && value !== null && value !== "") ?? null
const _text = (value) => value == null ? "" : String(value)
const _numericExtrema = (values, select) => {
  const numericValues = values.flat().map(_toNumericValue)
  if (numericValues.length === 0 || numericValues.some((value) => !Number.isFinite(value))) return null
  return select(...numericValues)
}
const _min = (...values) => _numericExtrema(values, Math.min)
const _max = (...values) => _numericExtrema(values, Math.max)
const _MS_PER_DAY = 24 * 60 * 60 * 1000

const _isDateOnlyValue = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return _DATE_ONLY_FORMATS.some((format) => format.pattern.test(trimmed))
  }
  if (!value || typeof value !== "object" || value instanceof Date) return false
  return ["value", "date", "text", "display"].some((key) => _isDateOnlyValue(value[key]))
}

const _calendarDayNumber = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / _MS_PER_DAY

const _daysSince = (value, ref) => {
  const date = _toDateValue(value)
  if (!date) return null
  const reference = ref === undefined ? new Date() : _toDateValue(ref)
  if (!reference) return null
  if (_isDateOnlyValue(value) && _isDateOnlyValue(ref)) {
    return _calendarDayNumber(reference) - _calendarDayNumber(date)
  }
  return Math.floor((reference.getTime() - date.getTime()) / _MS_PER_DAY)
}

const _monthsSince = (value, ref) => {
  const date = _toDateValue(value)
  if (!date) return null
  const reference = ref === undefined ? new Date() : _toDateValue(ref)
  if (!reference) return null
  let months = (reference.getFullYear() - date.getFullYear()) * 12 + (reference.getMonth() - date.getMonth())
  if (reference.getDate() < date.getDate()) months -= 1
  return months
}

// Local calendar date, matching the local-calendar parse of date-only strings.
const _today = () => {
  const now = new Date()
  const pad = (part) => String(part).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const _DURATION_UNIT_ALIASES = {
  day: "days", days: "days",
  week: "weeks", weeks: "weeks",
  month: "months", months: "months",
  year: "years", years: "years",
}

const _normalizeDurationUnit = (unit) =>
  typeof unit === "string" ? _DURATION_UNIT_ALIASES[unit.trim().toLowerCase()] ?? null : null

// Exact day difference projected through local calendar components, so results
// are DST-safe and date-only vs date-only arithmetic stays a whole number
// (matching _daysSince's calendar-day semantics).
const _exactDaysBetween = (from, to) => {
  const project = (date) => Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(),
    date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()
  )
  return (project(to) - project(from)) / _MS_PER_DAY
}

// Whole calendar months, matching _monthsSince's day-of-month rule.
const _wholeMonthsBetween = (from, to) => {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  return months
}

// Month arithmetic clamps to the target month's last day (Jan 31 + 1 month =
// Feb 28/29), so a duration anchor never overshoots into the following month.
const _addMonthsClamped = (date, months) => {
  const monthIndex = date.getMonth() + months
  const lastDay = new Date(date.getFullYear(), monthIndex + 1, 0).getDate()
  return new Date(
    date.getFullYear(), monthIndex, Math.min(date.getDate(), lastDay),
    date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()
  )
}

const _addCalendarDays = (date, days) => new Date(
  date.getFullYear(), date.getMonth(), date.getDate() + days,
  date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()
)

const _resolveDurationEndpoints = (value, ref) => {
  const from = _toDateValue(value)
  if (!from) return null
  const to = ref === undefined || ref === null || ref === "" ? new Date() : _toDateValue(ref)
  if (!to) return null
  return { from, to }
}

// Exact (fractional) elapsed amount between two dates in the requested unit.
// `ref` defaults to now; rounding is the caller's job (floor/round).
const _durationBetween = (value, ref, unit) => {
  const endpoints = _resolveDurationEndpoints(value, ref)
  const normalizedUnit = _normalizeDurationUnit(unit)
  if (!endpoints || !normalizedUnit) return null
  if (normalizedUnit === "days") return _exactDaysBetween(endpoints.from, endpoints.to)
  if (normalizedUnit === "weeks") return _exactDaysBetween(endpoints.from, endpoints.to) / 7
  // Fractional months: whole calendar months plus the remaining days as a
  // fraction of the actual length of the month being crossed.
  const whole = _wholeMonthsBetween(endpoints.from, endpoints.to)
  const anchor = _addMonthsClamped(endpoints.from, whole)
  const next = _addMonthsClamped(endpoints.from, whole + 1)
  const monthLength = _exactDaysBetween(anchor, next)
  const months = whole + (monthLength > 0 ? _exactDaysBetween(anchor, endpoints.to) / monthLength : 0)
  return normalizedUnit === "months" ? months : months / 12
}

// Cascading duration breakdown, e.g. "2 months, 3 weeks" for
// durationText([dob], today(), "months,weeks"). Each listed unit (descending)
// is floored and its remainder carried into the next; zero components are
// omitted except the last unit when everything is zero ("0 days").
const _durationText = (value, ref, units) => {
  const endpoints = _resolveDurationEndpoints(value, ref)
  if (!endpoints) return ""
  const orderedUnits = String(units ?? "")
    .split(",")
    .map(_normalizeDurationUnit)
    .filter(Boolean)
    .filter((unit, index, all) => all.indexOf(unit) === index)
  if (orderedUnits.length === 0) return ""

  // Ages never read as negative: an end date before the start collapses to zero.
  const end = _exactDaysBetween(endpoints.from, endpoints.to) < 0 ? endpoints.from : endpoints.to
  let cursor = endpoints.from
  const parts = orderedUnits.map((unit) => {
    let amount = 0
    if (unit === "years" || unit === "months") {
      const wholeMonths = Math.max(0, _wholeMonthsBetween(cursor, end))
      amount = unit === "years" ? Math.floor(wholeMonths / 12) : wholeMonths
      cursor = _addMonthsClamped(cursor, unit === "years" ? amount * 12 : amount)
    } else {
      const days = Math.max(0, _exactDaysBetween(cursor, end))
      amount = Math.floor(unit === "weeks" ? days / 7 : days)
      cursor = _addCalendarDays(cursor, unit === "weeks" ? amount * 7 : amount)
    }
    return { unit, amount }
  })

  const nonZero = parts.filter((part) => part.amount > 0)
  const shown = nonZero.length > 0 ? nonZero : [parts[parts.length - 1]]
  return shown
    .map((part) => `${part.amount} ${part.amount === 1 ? part.unit.slice(0, -1) : part.unit}`)
    .join(", ")
}

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

const _COMPUTED_NON_FIELD_IDENTIFIERS = new Set([
  "iif", "score", "contains", "hasValue", "countTrue", "daysSince", "monthsSince",
  "today", "durationBetween", "durationText",
  "floor", "mod", "round", "power", "ln", "exp", "coalesce", "text", "min", "max",
  "Math", "Number", "String", "null", "true", "false",
])

const _replaceBareReferencesOutsideQuotes = (expression, refs, valuesByFieldId) => {
  let prepared = ""
  let cursor = 0
  const stringPattern = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g
  const replaceInSegment = (segment) => {
    let nextSegment = segment
    for (const ref of refs) {
      if (_COMPUTED_NON_FIELD_IDENTIFIERS.has(ref)) continue
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
    const result = Function("iif", "score", "contains", "hasValue", "countTrue", "daysSince", "monthsSince", "today", "durationBetween", "durationText", "floor", "mod", "round", "power", "ln", "exp", "coalesce", "text", "min", "max", `"use strict"; return (${prepared});`)(
      _iif,
      _score,
      _contains,
      _hasValue,
      _countTrue,
      _daysSince,
      _monthsSince,
      _today,
      _durationBetween,
      _durationText,
      _floor,
      _mod,
      _round,
      _power,
      _ln,
      _exp,
      _coalesce,
      _text,
      _min,
      _max
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

const _normalizeCalculationPolicy = (value) => {
  if (value === "calculated-until-overridden" || value === "suggested-calculation") return value
  return "always-calculated"
}

const _computedFieldState = (valuesByFieldId, fieldId) => {
  const state = valuesByFieldId?.__computedFieldState?.[fieldId]
  return state && typeof state === "object" ? state : null
}

const _computedFieldIsOverridden = (valuesByFieldId, fieldId) =>
  _computedFieldState(valuesByFieldId, fieldId)?.overridden === true

const _shouldApplyComputedValue = (calculationPolicy, isOverridden) => {
  const policy = _normalizeCalculationPolicy(calculationPolicy)
  if (policy === "suggested-calculation") return false
  if (policy === "calculated-until-overridden") return !isOverridden
  return true
}

const _toEditableComputedValue = (value) => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return _toComparableValue(value) === value ? String(value) : String(_toComparableValue(value) ?? "")
}

const _hasAllReferencedValues = (expression, valuesByFieldId) => {
  const refs = _extractComputedReferences(String(expression || ""))
    .filter((ref) => !_COMPUTED_NON_FIELD_IDENTIFIERS.has(ref))
  if (refs.length === 0) return true
  // Controls such as ScaleField initialize an object-shaped value before the
  // user selects an answer. Check the object's comparable value so an empty
  // { selectedKey: null, value: null, response: null } is still incomplete,
  // while valid zero-valued answers count as answered.
  return Array.from(new Set(refs)).every((ref) =>
    _hasValue(_toComparableValue(valuesByFieldId?.[ref]))
  )
}

const _normalizeComputedDisplayStyle = (displayStyle) =>
  displayStyle === "compact" || displayStyle === "prominent" ? displayStyle : "field"

const ComputedValuePresentation = ({
  fieldId,
  label,
  value,
  displayStyle = "field",
  displaySuffix = "",
  labelPosition = "left",
  placeholder = "Calculated automatically",
  readOnly = true,
  required = false,
  size,
  onChange,
  isDarkMode = false,
}) => {
  const normalizedStyle = _normalizeComputedDisplayStyle(displayStyle)

  // Editable calculations retain the regular field control regardless of the
  // chosen summary style, so override and suggestion policies remain usable.
  if (normalizedStyle === "field" || readOnly === false) {
    return (
      <TextArea
        fieldId={fieldId}
        label={label}
        value={value}
        onChange={onChange}
        labelPosition={labelPosition}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        size={size}
        textFieldProps={displaySuffix ? { suffix: displaySuffix } : undefined}
      />
    )
  }

  const isProminent = normalizedStyle === "prominent"
  const displayValue = value === undefined || value === null || value === ""
    ? "Incomplete"
    : String(value)
  const containerStyle = isProminent
    ? {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "12px",
        padding: "12px 14px",
        borderRadius: "6px",
        border: `1px solid ${isDarkMode ? "#2a5a8c" : "#b8d4f0"}`,
        backgroundColor: isDarkMode ? "#1a3a5c" : "#e6f2ff",
      }
    : {
        display: "flex",
        alignItems: "baseline",
        gap: "6px",
        padding: "4px 0",
        fontSize: "13px",
      }

  return (
    <div style={containerStyle}>
      <span style={{
        color: isDarkMode ? "#a0a0a0" : "#666666",
        fontWeight: isProminent ? 600 : 500,
        flexShrink: 0,
      }}>
        {label}:
      </span>
      <span style={{
        fontWeight: isProminent ? 700 : 400,
        fontSize: isProminent ? "16px" : "13px",
        fontStyle: displayValue === "Incomplete" ? "italic" : "normal",
      }}>
        {displayValue}{displayValue !== "Incomplete" && displaySuffix ? ` ${displaySuffix}` : ""}
      </span>
    </div>
  )
}

const ComputedField = ({
  fieldId,
  label,
  expression,
  precision,
  resultType = "number",
  displayStyle = "field",
  displaySuffix = "",
  calculationPolicy = "always-calculated",
  labelPosition = "left",
  placeholder = "Calculated automatically",
  size,
  required = false,
  readOnly: readOnlyProp,
  disabled = false,
  showInterpretation = false,
  interpretation,
  // Legacy calculators (BPI Severity/Interference/Relief, PEG, DLQI) pair
  //   IF (IsNull(...), 'Incomplete', '')
  // with mirrored visible expressions so a partial total never shows and never
  // persists. "compute-anyway" is the default so existing forms are unchanged.
  incompleteBehavior = "compute-anyway",
  incompleteText = "Incomplete",
  resolvedValue,
  presentationOnly = false,
  isDarkMode = false,
  // Prior observations are display-only. They never seed the calculated field
  // and never participate in its MOIS write.
  showHistory = false,
  historyObservationCode = "",
  historyLoincCode = "",
  historyUnits = "",
  historyMaxRows = 1,
  graphLinkText = "Graph",
  graphHref = "",
}) => {
  // Authorship/lock rules arrive as a dynamic `disabled` expression from the
  // exporter; fold it into readOnly.
  const readOnly = disabled ? true : readOnlyProp
  const theme = useTheme()
  const [fd, setFd] = useActiveData()
  const valuesByFieldId = fd?.field?.data || {}
  const policy = _normalizeCalculationPolicy(calculationPolicy)
  const isOverridden = _computedFieldIsOverridden(valuesByFieldId, fieldId)

  const computedValue = useMemo(
    () => presentationOnly
      ? resolvedValue
      : _evaluateComputedExpression(expression, valuesByFieldId, fieldId),
    [expression, fieldId, presentationOnly, resolvedValue, valuesByFieldId]
  )

  const roundedValue = useMemo(
    () => _roundComputedValue(computedValue, precision),
    [computedValue, precision]
  )

  const isIncomplete = useMemo(
    () => (
      incompleteBehavior !== "compute-anyway" &&
      !_hasAllReferencedValues(expression, valuesByFieldId)
    ),
    [expression, incompleteBehavior, valuesByFieldId]
  )

  const storedValue = useMemo(() => {
    // A partial total must not reach the patient record, so an incomplete
    // calculation persists null regardless of which incomplete style is used.
    if (isIncomplete) return null
    if (typeof roundedValue === "string" || typeof roundedValue === "boolean") return roundedValue
    if (!Number.isFinite(roundedValue)) return null
    if (resultType === "text") {
      return _toDisplayValue(roundedValue, precision, "text")
    }
    return roundedValue
  }, [isIncomplete, precision, resultType, roundedValue])

  const displayValue = useMemo(() => {
    if (isIncomplete) return incompleteBehavior === "show-text" ? incompleteText : ""
    // String/boolean results (e.g. iif chains returning "LOW"/"HIGH") must
    // render, not just persist — Number.isFinite alone blanked them.
    if (typeof roundedValue === "string") return roundedValue
    if (typeof roundedValue === "boolean") return String(roundedValue)
    if (!Number.isFinite(roundedValue)) return ""
    return _toDisplayValue(roundedValue, precision, resultType)
  }, [incompleteBehavior, incompleteText, isIncomplete, precision, resultType, roundedValue])

  const currentValue = valuesByFieldId?.[fieldId]
  const enteredDisplayValue = _toEditableComputedValue(currentValue)
  const renderedValue = policy === "always-calculated" ? displayValue : enteredDisplayValue
  const externallyReadOnly = readOnly === true
  const canEdit = policy !== "always-calculated" && !externallyReadOnly
  // LayoutItem owns the left-label column used by TextArea and measurement
  // fields. Supplemental rows live outside that control, so derive the same
  // column width from the MOIS theme instead of using an unrelated fixed inset.
  const labelColumnWidth = theme?.mois?.defaultCommonControlStyle?.minLabelWidth ?? 240
  const supplementalInset = labelPosition !== "left"
    ? 0
    : typeof labelColumnWidth === "number"
      ? `${labelColumnWidth + 10}px`
      : `calc(${labelColumnWidth} + 10px)`

  const canShowInterpretation = useMemo(
    () => Boolean(showInterpretation && _hasAllReferencedValues(expression, valuesByFieldId)),
    [expression, showInterpretation, valuesByFieldId]
  )

  const interpretationValue = policy === "always-calculated"
    ? roundedValue
    : _toNumericValue(currentValue)
  const interpretationRange = useMemo(
    () => canShowInterpretation ? _getInterpretationRange(interpretationValue, interpretation) : null,
    [canShowInterpretation, interpretation, interpretationValue]
  )

  useEffect(() => {
    if (presentationOnly) return
    if (!fieldId) return
    if (!_shouldApplyComputedValue(policy, isOverridden)) return
    setFd((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data || typeof draft.field.data !== "object") {
        draft.field.data = {}
      }
      const stateContainer = draft.field.data.__computedFieldState && typeof draft.field.data.__computedFieldState === "object"
        ? draft.field.data.__computedFieldState
        : {}
      const previousState = stateContainer[fieldId]
      const valueMatches = draft.field.data[fieldId] === storedValue
      const stateMatches = previousState?.overridden === false
        && previousState?.policy === policy
        && previousState?.lastCalculatedValue === storedValue
      if (valueMatches && stateMatches) return
      draft.field.data[fieldId] = storedValue
      stateContainer[fieldId] = {
        overridden: false,
        policy,
        lastCalculatedValue: storedValue,
      }
      draft.field.data.__computedFieldState = stateContainer
    })
  // The generated form's parent useOnLoad effect can run after this child
  // effect and replace field data with InitialData/sourceFormData. Track the
  // persisted value itself so an owned calculation repairs that late seed on
  // the next render. Suggested values and user overrides still opt out through
  // _shouldApplyComputedValue above.
  }, [currentValue, fieldId, isOverridden, policy, presentationOnly, setFd, storedValue])

  const markOverridden = () => {
    if (!fieldId || !canEdit) return
    setFd((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const stateContainer = draft.field.data.__computedFieldState && typeof draft.field.data.__computedFieldState === "object"
        ? draft.field.data.__computedFieldState
        : {}
      stateContainer[fieldId] = {
        overridden: true,
        policy,
        lastCalculatedValue: storedValue,
      }
      draft.field.data.__computedFieldState = stateContainer
    })
  }

  const useCalculatedValue = () => {
    if (!fieldId || !canEdit) return
    setFd((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const stateContainer = draft.field.data.__computedFieldState && typeof draft.field.data.__computedFieldState === "object"
        ? draft.field.data.__computedFieldState
        : {}
      draft.field.data[fieldId] = storedValue
      stateContainer[fieldId] = {
        overridden: policy === "suggested-calculation",
        policy,
        lastCalculatedValue: storedValue,
      }
      draft.field.data.__computedFieldState = stateContainer
    })
  }

  // Legacy hid the score control outright until every item was answered. All
  // hooks above have already run, so bailing out here is safe.
  if (isIncomplete && incompleteBehavior === "hide") return null

  return (
    <div>
      <ComputedValuePresentation
        fieldId={fieldId}
        label={label}
        value={renderedValue}
        onChange={markOverridden}
        displayStyle={displayStyle}
        labelPosition={labelPosition}
        placeholder={placeholder}
        readOnly={!canEdit}
        required={required}
        size={size}
        displaySuffix={displaySuffix}
        isDarkMode={isDarkMode}
      />
      {showHistory && (historyObservationCode || historyLoincCode) ? (
        <div
          data-computed-observation-history
          style={{ marginTop: 4, marginLeft: supplementalInset }}
        >
          <ObservationValueDisplay
            labelPosition="none"
            observationCode={historyObservationCode}
            loincCode={historyLoincCode}
            units={historyUnits}
            maxRows={historyMaxRows}
            graphLinkText={graphLinkText}
            graphHref={graphHref}
            presentation="measurement-summary"
          />
        </div>
      ) : null}
      {!presentationOnly && policy === "calculated-until-overridden" ? (
        <div style={{ marginTop: 4, marginLeft: supplementalInset, display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: isOverridden ? "#9a3412" : "#475569" }}>
          <span>
            {isOverridden
              ? `User override preserved. Current calculation: ${displayValue || "unavailable"}.`
              : "Updates automatically until a user edits the value."}
          </span>
          {isOverridden && canEdit ? (
            <button type="button" onClick={useCalculatedValue} style={{ border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", padding: "2px 8px", cursor: "pointer" }}>
              Reset to calculation
            </button>
          ) : null}
        </div>
      ) : null}
      {!presentationOnly && policy === "suggested-calculation" ? (
        <div style={{ marginTop: 4, marginLeft: supplementalInset, display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#475569" }}>
          <span><strong>Suggested:</strong> {displayValue || "Unavailable until inputs are complete"}</span>
          {displayValue && canEdit ? (
            <button type="button" onClick={useCalculatedValue} style={{ border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", padding: "2px 8px", cursor: "pointer" }}>
              Use suggestion
            </button>
          ) : null}
        </div>
      ) : null}
      {!presentationOnly && interpretationRange ? (
        <div style={{ marginTop: 4, marginLeft: supplementalInset, fontSize: 12, color: "#475569" }}>
          <strong>{interpretation?.label || "Interpretation"}:</strong> {interpretationRange.label}
          {interpretationRange.description ? <span> - {interpretationRange.description}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
