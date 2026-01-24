
// Handle 2.25.12 case where Allergies is a predefined component
if (typeof Conditions==="undefined") {
  window.Conditions = null
}

/**
 * Display a list of health issues (conditions) experienced by the patient and
 * optionally allows selection.
 */
Conditions = ({
    selectText = "Select conditions",
    id = "conditions",
    selectionType = "none",
    filterPred = selectAll,
    ...props
}:Props) => {

  return (
    <ListSelection
      {...{id, selectionType, columns: conditionsColumns, selectText}}
      {...props}
    />
  )
}

const conditionsColumns: ColumnSelection = [
  {
    id: "conditionId",
    type: "key",
  },
  {
    title: "Date",
    id: "startDate",
    type: "date",
  },
  {
    id: "resolveDate",
    type: "hidden",
  },
  {
    title: "Condition",
    id: "condition",
    type: "code",
    size: "large",
  },
  {
    title: "Certainty",
    id: "certainty",
    type: "code",
  },
  {
    title: "Severity",
    id: "severity",
    type: "code",
  },
]

const ConditionsFields = `
conditionId 
startDate 
resolveDate
condition { code display system } 
severity { code display system } 
certainty { code display system }
`
