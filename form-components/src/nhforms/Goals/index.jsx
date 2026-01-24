
// Handle 2.25.12 case where Allergies is a predefined component
if (typeof Goals==="undefined") {
  window.Goals = null
}

/**
 * Display a list of patient goals for selection
 */
Goals = ({
  id = "goals",
  label,
  selectionType = "none",
  selectText="Select goals",
  ...props
}:ListSelectionProps) => {

  return (
    <ListSelection
      {...{id, label, selectText, selectionType, columns: goalColumns}}
      {...props}
    />
  )
}

const goalColumns: ColumnSelection = [
  {
    id: "goalId",
    type: "key",
  },
  {
    title: "Date",
    id: "startDate",
    type: "date",
  },
  {
    id: "endDate",
    type: "hidden",
  },
  {
    title: "Goal",
    id: "goal",
    type: "string",
  },
  {
    id: "expectedOutcome",
    type: "hidden",
  },
  {
    title: "Detail",
    id: "detail",
    type: "string",
    size: "large",
  },
]

const GoalsFields = "goalId startDate endDate goal expectedOutcome detail"
