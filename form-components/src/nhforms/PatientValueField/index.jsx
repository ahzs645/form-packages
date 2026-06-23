const { useEffect } = React

// Resolve a dotted path against patient/source context (e.g.
// "patient.administrativeGender.code"). Mirrors the way other NHForms
// components read sd.patient.* (FirstNationsStatus, NameBlock).
const resolvePatientContextPath = (sd, path) => {
  const root = { patient: sd?.patient, sd, webform: sd?.webform, userProfile: sd?.userProfile }
  return String(path || "")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), root)
}

const coercePatientValue = (raw) => {
  if (raw == null) return ""
  if (typeof raw === "object") return String(raw.code ?? raw.display ?? raw.value ?? "")
  return String(raw)
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

// Apply an optional value transform after resolving the patient path.
const applyPatientTransform = (raw, transform) =>
  transform === "ageYears" ? computeAgeYears(raw) : coercePatientValue(raw)

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
 * Hidden by default (renders nothing) — it is a data binding, not a control.
 */
const PatientValueField = ({
  id,
  fieldId = "patientValue",
  patientPath = "patient.administrativeGender.code",
  transform,
  hidden = true,
  label,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const effectiveFieldId = fieldId || id || "patientValue"
  const resolved = applyPatientTransform(resolvePatientContextPath(sd, patientPath), transform)
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
