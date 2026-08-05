// Legacy preset: CodedObservationChoiceField is a strict superset of this
// component (see lib/coded-choice-field-migration.ts and the component-field
// consolidation plan). Kept as a thin alias so saved forms keep working;
// author new fields with CodedObservationChoiceField or a core choice field.
const ValueSetObservationField = ({ id, fieldId, label = "Observation", ...props }) => {
  const RuntimeCodedChoice =
    (typeof window !== "undefined" && window.__nhformsRegistry__?.CodedObservationChoiceField) ||
    CodedObservationChoiceField

  return (
    <RuntimeCodedChoice
      id={id || fieldId || "ValueSetObservationField"}
      fieldId={fieldId}
      label={label}
      existingObservationScope="webform"
      {...props}
    />
  )
}
