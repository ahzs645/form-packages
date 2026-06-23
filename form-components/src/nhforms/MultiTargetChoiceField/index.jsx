// MultiTargetChoiceField — a set of checkboxes that are two-way bound to OTHER
// fields. Each option declares a `target` (which field it reads/writes) and an
// optional `force` (a sibling field set as a side effect). This is the
// builder-expressible version of the legacy c19 `tstRecCategory` derivation,
// where toggling a category checkbox writes back into catDetSchool / catDetCGT /
// the catDetHCWRoles array and forces catDetHCWQuest to "Y".
//
// option = {
//   code, display,
//   target: { fieldId, mode: "scalar" | "arrayMember", value?, system? },
//   force?: { fieldId, value, whenAnyOf?: string[] }   // value may be a coding or a code string
// }

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

const optionChecked = (data, option) => {
  const target = option.target || {}
  const current = data ? data[target.fieldId] : undefined
  if (target.mode === "arrayMember") {
    return asArray(current).map(codeOf).includes(target.value)
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
  const data = { ...(prevData || {}) }
  const target = option.target || {}
  if (target.mode === "arrayMember") {
    const currentArr = asArray(data[target.fieldId])
    const has = currentArr.some((entry) => codeOf(entry) === target.value)
    if (next && !has) {
      data[target.fieldId] = [...currentArr, toCoding(target.value, option.display, target.system)]
    } else if (!next && has) {
      data[target.fieldId] = currentArr.filter((entry) => codeOf(entry) !== target.value)
    }
  } else {
    data[target.fieldId] = next ? toCoding(target.value, option.display, target.system) : null
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
  options = [],
  columns = 1,
  readOnly = false,
  disabled = false,
}) => {
  const [fd, setFormData] = useActiveData()
  const data = (fd && fd.field && fd.field.data) || {}
  const effectiveFieldId = fieldId || id || "multiTargetChoice"

  const toggle = (option, next) => {
    if (readOnly || disabled) return
    setFormData(produce((draftFd) => {
      if (!draftFd.field) draftFd.field = { data: {}, status: {}, history: [] }
      if (!draftFd.field.data || typeof draftFd.field.data !== "object") draftFd.field.data = {}
      draftFd.field.data = computeToggledData(draftFd.field.data, option, next, options, effectiveFieldId)
    }))
  }

  const gridStyle = columns > 1
    ? { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: "6px 24px" }
    : { display: "flex", flexDirection: "column", gap: 6 }

  return (
    <LayoutItem fieldId={effectiveFieldId} label={label} readOnly={readOnly}>
      <div style={gridStyle}>
        {options.map((option) => (
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
