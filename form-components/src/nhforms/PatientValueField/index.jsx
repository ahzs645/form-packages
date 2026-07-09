const { useEffect } = React

// Resolve a dotted path against patient/source context (e.g.
// "patient.administrativeGender.code"). Mirrors the way other NHForms
// components read sd.patient.* (FirstNationsStatus, NameBlock).
const resolvePatientContextPath = (sd, path) => {
  const root = {
    patient: sd?.patient ?? sd?.queryResult?.patient?.[0],
    sd,
    queryResult: sd?.queryResult,
    webform: sd?.webform,
    userProfile: sd?.userProfile,
  }
  return String(path || "")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), root)
}

const resolveCollectionItemPath = (item, path) => {
  if (!path) return item
  return String(path)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), item)
}

const coercePatientValue = (raw) => {
  if (raw == null) return ""
  if (typeof raw === "object") return String(raw.code ?? raw.display ?? raw.value ?? "")
  return String(raw)
}

const collectionCandidateValues = (raw, values = []) => {
  if (raw == null) return values
  if (Array.isArray(raw)) {
    raw.forEach((entry) => collectionCandidateValues(entry, values))
    return values
  }
  if (typeof raw === "object") {
    ;["code", "display", "value", "key", "text", "label", "id"].forEach((key) => {
      if (raw[key] != null && raw[key] !== "") values.push(String(raw[key]))
    })
    return values
  }
  values.push(String(raw))
  return values
}

const collectionItemMatches = (item, itemPath, operator = "notEmpty", matchValue = "") => {
  const raw = resolveCollectionItemPath(item, itemPath)
  const values = collectionCandidateValues(raw)
  const expected = String(matchValue ?? "").trim()
  const normalizedExpected = expected.toUpperCase()

  if (operator === "empty") return values.length === 0
  if (operator === "notEmpty") return values.length > 0
  if (operator === "in") {
    const candidates = expected.split(",").map((value) => value.trim()).filter(Boolean)
    return values.some((value) => candidates.includes(value))
  }
  if (operator === "contains") {
    return values.some((value) => value.toUpperCase().includes(normalizedExpected))
  }
  if (operator === "notEquals") {
    return values.length > 0 && values.every((value) => value !== expected)
  }
  return values.some((value) => value === expected)
}

// Whole years between a birth date and a reference date (default: today).
// Returns a numeric string (so `Number()`-based field/option rules can compare
// it) or "" when the input is missing/unparseable. `reference` is injectable so
// the result is deterministically testable.
const computeAgeYears = (birthValue, reference) => {
  const raw = birthValue && typeof birthValue === "object"
    ? (birthValue.value ?? birthValue.code ?? birthValue.display ?? "")
    : birthValue
  if (raw == null || raw === "") return ""
  const dob = new Date(raw)
  if (Number.isNaN(dob.getTime())) return ""
  const now = reference || new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDelta = now.getMonth() - dob.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1
  return age >= 0 ? String(age) : ""
}

// Apply an optional value transform after resolving the patient path. Collection
// transforms deliberately reduce chart lists to rule-friendly scalar strings:
// "true"/"false" for existence/matches and a number string for counts.
const applyPatientTransform = (raw, transform, itemPath, matchOperator, matchValue) => {
  if (transform === "ageYears") return computeAgeYears(raw)
  if (transform === "collectionCount") return String(Array.isArray(raw) ? raw.length : 0)
  if (transform === "collectionExists") return Array.isArray(raw) && raw.length > 0 ? "true" : "false"
  if (transform === "collectionAnyMatch") {
    const items = Array.isArray(raw) ? raw : []
    return items.some((item) => collectionItemMatches(item, itemPath, matchOperator, matchValue)) ? "true" : "false"
  }
  return coercePatientValue(raw)
}

/**
 * PatientValueField — mirrors a patient-context value into a form field so the
 * builder's visibility / field-link rules can gate on patient demographics
 * (e.g. show a pregnancy question only when administrativeGender !== "M"). This
 * is the builder-expressible version of the legacy forms' basicDemographics
 * mirror: the value lands in fd.field.data[fieldId] and rules key off it.
 *
 * `transform: "ageYears"` derives a numeric age from a birth-date path
 * (patient.birthDate) so rules can gate on age (e.g. number-gte 65).
 *
 * Collection transforms provide the equivalent for medications, conditions,
 * allergies, and observations. Point `patientPath` at the collection, then
 * use collectionExists, collectionCount, or collectionAnyMatch with an item
 * path and comparator. The resulting scalar can drive ordinary field rules.
 *
 * Hidden by default (renders nothing) — it is a data binding, not a control.
 */
const PatientValueField = ({
  id,
  fieldId = "patientValue",
  patientPath = "patient.administrativeGender.code",
  transform,
  itemPath = "",
  matchOperator = "notEmpty",
  matchValue = "",
  hidden = true,
  label,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const effectiveFieldId = fieldId || id || "patientValue"
  const resolved = applyPatientTransform(
    resolvePatientContextPath(sd, patientPath),
    transform,
    itemPath,
    matchOperator,
    matchValue,
  )
  const stored = fd?.field?.data?.[effectiveFieldId]

  useEffect(() => {
    if (stored === resolved) return
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[effectiveFieldId] = resolved
    }))
  }, [resolved, effectiveFieldId, stored, setFormData])

  if (hidden) return null
  return (
    <div data-patient-field={effectiveFieldId}>
      <Fluent.Text variant="small">{`${label || effectiveFieldId}: ${resolved || "—"}`}</Fluent.Text>
    </div>
  )
}
