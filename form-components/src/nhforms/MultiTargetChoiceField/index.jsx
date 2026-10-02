// MultiTargetChoiceField — a set of checkboxes that are two-way bound to OTHER
// fields. Each option declares a `target` (which field it reads/writes) and an
// optional `force` (a sibling field set as a side effect). This is the
// builder-expressible version of the legacy c19 `tstRecCategory` derivation,
// where toggling a category checkbox writes back into catDetSchool / catDetCGT /
// the catDetHCWRoles array and forces catDetHCWQuest to "Y".
//
// option = {
//   code, display,
//   target: { fieldId, mode: "scalar" | "arrayMember" | "flag" | "yesNo", value?, display?, offValue?, system? },
//   force?: { fieldId, value, whenAnyOf?: string[] }   // value may be a coding or a code string
// }
//
// target.mode:
//   "scalar"      — field holds a coding; checked ⇔ code === value (or, if no
//                   value, the field is non-empty). Toggle on → set; off → clear.
//                   `display` preserves the target field's native label when it
//                   differs from the aggregate checkbox label.
//   "arrayMember" — field holds an array of codings; checked ⇔ value is a member.
//                   Toggle on → add the member; off → remove it.
//   "flag"        — field is a boolean envelope { checked }; checked ⇔ field.checked.
//                   Toggle on → { checked: true }; off → { checked: undefined }. Use
//                   for yes/no fields shared with other checkboxes (e.g. genC19contact).
//   "yesNo"       — field stores independent legacy values (default "YES"/"NO").
//                   This keeps grouped checkbox presentation without collapsing
//                   separate MOIS columns into one multi-select array.
//
// option.visibleWhen (optional) — gate a single option's visibility with the SAME
// condition vocabulary the builder's fieldLinkRules use:
//   visibleWhen: { controllerFieldId, condition: { type, value?, optionValues? } }
// e.g. HOS shows only for non-male patients via the mirrored __patientGender field:
//   { controllerFieldId: "__patientGender", condition: { type: "not-equals", value: "M" } }

const { useEffect } = React

// Opt-in compatibility for imported independent checkboxes. An explicit current
// answer wins; consume only understood old aliases so a stale answer cannot
// return after a later edit. Unknown/foreign codings remain recoverable.
const normalizeLegacyCheckboxData = (previous, options) => {
  const data = { ...(previous || {}) }
  const convert = (value, target) => {
    if (typeof value === "boolean") return value ? String(target.value ?? "YES") : String(target.offValue ?? "NO")
    if (typeof value !== "string") return value
    if (/^(true|yes|y)$/i.test(value)) return String(target.value ?? "YES")
    if (/^(false|no|n)$/i.test(value)) return String(target.offValue ?? "NO")
    return value
  }
  options.forEach(({ target = {} }) => {
    if (target.mode !== "yesNo" || !target.acceptLegacyBoolean || !target.fieldId) return
    if (Object.prototype.hasOwnProperty.call(data, target.fieldId)) {
      data[target.fieldId] = convert(data[target.fieldId], target)
    } else {
      const alias = (target.legacyFieldIds || []).find((key) => {
        const value = data[key]
        return typeof value === "boolean" || (typeof value === "string" && /^(true|false|yes|no|y|n)$/i.test(value))
      })
      if (alias) data[target.fieldId] = convert(data[alias], target)
    }
    if (Object.prototype.hasOwnProperty.call(data, target.fieldId)) {
      ;(target.legacyFieldIds || []).forEach((key) => {
        const value = data[key]
        if (key !== target.fieldId && (typeof value === "boolean" || (typeof value === "string" && /^(true|false|yes|no|y|n)$/i.test(value)))) delete data[key]
      })
    }
  })
  return data
}

const codeOf = (value) => {
  if (value == null) return ""
  if (typeof value === "object") return String(value.code ?? value.key ?? value.value ?? "")
  return String(value)
}

const asArray = (value) => {
  if (Array.isArray(value)) return value
  if (value == null || value === "") return []
  return [value]
}

const hasValue = (value) => {
  if (value == null || value === "") return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") return Boolean(value.code ?? value.display ?? value.value)
  return true
}

const toCoding = (value, fallbackDisplay, system) => {
  if (value && typeof value === "object") return value
  return { code: String(value ?? ""), display: fallbackDisplay ?? String(value ?? ""), ...(system ? { system } : {}) }
}

// Per-option visibility — reuses the builder's fieldLinkRules condition vocabulary
// so it stays consistent with field-level rules and is configurable the same way.
// Mirrors lib/preview-utils/visibility.ts `checkFieldLinkCondition` for the
// option-gating subset (equals / not-equals / choice-selected / filled / empty).
const normalizeComparable = (candidate) => {
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    return candidate.code ?? candidate.display ?? candidate.value ?? candidate.text ?? ""
  }
  return candidate
}

const normalizeChoiceValues = (candidate) => {
  if (Array.isArray(candidate)) return candidate.flatMap(normalizeChoiceValues)
  if (candidate && typeof candidate === "object") {
    return [candidate.code, candidate.display, candidate.value, candidate.text]
      .filter((entry) => entry != null)
      .map((entry) => String(entry))
  }
  if (candidate == null) return []
  return [String(candidate)]
}

const isEmptyValue = (value) =>
  value == null ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0)

const evalCondition = (controllerValue, condition) => {
  if (!condition || !condition.type) return true
  const { type, optionValues, value } = condition
  switch (type) {
    case "choice-selected":
      return Array.isArray(optionValues) && optionValues.length > 0 &&
        optionValues.some((opt) => normalizeChoiceValues(controllerValue).includes(opt))
    case "choice-not-selected":
      return !Array.isArray(optionValues) || optionValues.length === 0 ||
        !optionValues.some((opt) => normalizeChoiceValues(controllerValue).includes(opt))
    case "equals":
      return String(normalizeComparable(controllerValue) ?? "") === String(value ?? "")
    case "not-equals":
      return String(normalizeComparable(controllerValue) ?? "") !== String(value ?? "")
    case "filled":
      return !isEmptyValue(controllerValue)
    case "empty":
      return isEmptyValue(controllerValue)
    case "number-gt":
    case "number-gte":
    case "number-lt":
    case "number-lte":
    case "number-equals": {
      const left = Number(normalizeComparable(controllerValue))
      const right = Number(value)
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false
      if (type === "number-gt") return left > right
      if (type === "number-gte") return left >= right
      if (type === "number-lt") return left < right
      if (type === "number-lte") return left <= right
      return left === right
    }
    default:
      return true // types we don't gate on per-option fail open (visible)
  }
}

// An option renders only when its optional `visibleWhen` rule passes.
const optionVisible = (data, option) => {
  const rule = option.visibleWhen
  if (!rule || !rule.controllerFieldId) return true
  return evalCondition(data ? data[rule.controllerFieldId] : undefined, rule.condition)
}

const optionChecked = (data, option) => {
  const target = option.target || {}
  const current = data ? data[target.fieldId] : undefined
  if (target.mode === "arrayMember") {
    return asArray(current).map(codeOf).includes(target.value)
  }
  if (target.mode === "flag") {
    return Boolean(current && current.checked)
  }
  if (target.mode === "yesNo") {
    return codeOf(current) === String(target.value ?? "YES")
  }
  return target.value != null && target.value !== "" ? codeOf(current) === target.value : hasValue(current)
}

// Forced side effects: when any of force.whenAnyOf (default: the option's own
// code) is checked, set force.fieldId to force.value. Never un-forces (matches
// the source, which only forces catDetHCWQuest to "Y").
const applyForces = (data, options) => {
  options.forEach((option) => {
    const force = option.force
    if (!force || !force.fieldId) return
    const triggers = Array.isArray(force.whenAnyOf) && force.whenAnyOf.length ? force.whenAnyOf : [option.code]
    const anyOn = triggers.some((code) => {
      const opt = options.find((entry) => entry.code === code)
      return opt ? optionChecked(data, opt) : false
    })
    if (anyOn) data[force.fieldId] = toCoding(force.value, undefined, (option.target || {}).system)
  })
}

// Pure: returns the next field-data object after toggling `option`. Module-level
// so the toggle semantics (scalar set/clear, array add/remove, forced sibling,
// aggregate mirror) are directly unit-testable — see
// lib/__tests__/nhforms-runtime-logic.test.ts.
const computeToggledData = (prevData, option, next, options, aggregateFieldId) => {
  const data = normalizeLegacyCheckboxData(prevData, options)
  const target = option.target || {}
  if (target.mode === "arrayMember") {
    const currentArr = asArray(data[target.fieldId])
    const has = currentArr.some((entry) => codeOf(entry) === target.value)
    if (next && !has) {
      data[target.fieldId] = [...currentArr, toCoding(target.value, target.display ?? option.display, target.system)]
    } else if (!next && has) {
      data[target.fieldId] = currentArr.filter((entry) => codeOf(entry) !== target.value)
    }
  } else if (target.mode === "flag") {
    data[target.fieldId] = next ? { checked: true } : { checked: undefined }
  } else if (target.mode === "yesNo") {
    data[target.fieldId] = next
      ? String(target.value ?? "YES")
      : String(target.offValue ?? "NO")
  } else {
    data[target.fieldId] = next ? toCoding(target.value, target.display ?? option.display, target.system) : null
  }
  applyForces(data, options)
  if (aggregateFieldId) {
    data[aggregateFieldId] = options.filter((entry) => optionChecked(data, entry)).map((entry) => entry.code)
  }
  return data
}

const MultiTargetChoiceField = ({
  id,
  fieldId,
  label = "Categories",
  // "none" draws no caption row: a single MOIS checkbox whose text is its label.
  labelPosition,
  options = [],
  columns = 1,
  writeAggregate = true,
  readOnly = false,
  disabled = false,
  required = false,
}) => {
  const [fd, setFormData] = useActiveData()
  const theme = useTheme()
  const storedData = (fd && fd.field && fd.field.data) || {}
  const data = normalizeLegacyCheckboxData(storedData, options)
  useEffect(() => {
    if (!setFormData || !options.some(({ target }) => target?.acceptLegacyBoolean)) return
    const keys = Object.keys(storedData)
    if (keys.length === Object.keys(data).length && keys.every((key) => storedData[key] === data[key])) return
    setFormData(produce((draftFd) => {
      const previous = draftFd.field?.data
      if (!previous) return
      const normalized = normalizeLegacyCheckboxData(previous, options)
      const keys = Object.keys(previous)
      if (keys.length === Object.keys(normalized).length && keys.every((key) => previous[key] === normalized[key])) return
      draftFd.field.data = normalized
    }))
  }, [storedData, options, setFormData])
  const effectiveFieldId = fieldId || id || "multiTargetChoice"
  const anyChecked = options.some((option) => optionChecked(data, option))
  // Native MOIS required affordance: warning tint while unanswered.
  const requiredBackground =
    theme?.mois?.requiredBackground ?? theme?.aihs?.requiredBackground ?? "#fff4ce"

  const toggle = (option, next) => {
    if (readOnly || disabled) return
    setFormData(produce((draftFd) => {
      if (!draftFd.field) draftFd.field = { data: {}, status: {}, history: [] }
      if (!draftFd.field.data || typeof draftFd.field.data !== "object") draftFd.field.data = {}
      draftFd.field.data = computeToggledData(
        draftFd.field.data,
        option,
        next,
        options,
        writeAggregate ? effectiveFieldId : undefined
      )
    }))
  }

  const gridStyle = columns > 1
    ? { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: "6px 24px" }
    : { display: "flex", flexDirection: "column", gap: 6 }
  const requiredStyle = required && !anyChecked
    ? { background: requiredBackground, padding: "4px 6px", borderRadius: 2 }
    : {}

  return (
    <LayoutItem fieldId={effectiveFieldId} label={label} labelPosition={labelPosition} readOnly={readOnly} required={required}>
      <div style={{ ...gridStyle, ...requiredStyle }}>
        {options.filter((option) => optionVisible(data, option)).map((option) => (
          <Fluent.Checkbox
            key={option.code}
            label={option.display || option.code}
            checked={optionChecked(data, option)}
            disabled={disabled || readOnly}
            onChange={(_event, checked) => toggle(option, Boolean(checked))}
          />
        ))}
      </div>
    </LayoutItem>
  )
}
