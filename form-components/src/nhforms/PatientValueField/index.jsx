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

/**
 * PatientValueField — mirrors a patient-context value into a form field so the
 * builder's visibility / field-link rules can gate on patient demographics
 * (e.g. show a pregnancy question only when administrativeGender !== "M"). This
 * is the builder-expressible version of the legacy forms' basicDemographics
 * mirror: the value lands in fd.field.data[fieldId] and rules key off it.
 *
 * Hidden by default (renders nothing) — it is a data binding, not a control.
 */
const PatientValueField = ({
  id,
  fieldId = "patientValue",
  patientPath = "patient.administrativeGender.code",
  hidden = true,
  label,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const effectiveFieldId = fieldId || id || "patientValue"
  const resolved = coercePatientValue(resolvePatientContextPath(sd, patientPath))
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
