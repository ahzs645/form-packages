
/**
 * Display the relationship (marital) status demographic field of the patient as
 * a read only field.
 */
const RelationshipStatus = ({
  sourceId = "maritalStatus",
  fieldId = "relationshipStatus",
  label = "Relationship status",
  placeholder="Not recorded in chart",
  ...props
}) => {

  return (
    <SimpleCodeSelect
      {...{fieldId,sourceId,label,placeholder}}
      readOnly
      refresh
      {...props}
    />
  )
}
