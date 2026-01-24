
/**
 * Display a list of planned actions for the patient. By default, it will display
 * all planned actions in the chart. The user can then remove unwanted items.
 */
const PlannedActions = ({
  id = "actions",
  selectionType = "multiple",
  selectText = "Select actions",
  filterPred=plannedActionsActiveOnly,
  ...props
}: Props) => {

  return (
    <ListSelection
      {...{columns: plannedActionsColumns, id, selectionType, selectText, filterPred}}
      {...props}
    />
  )

}

const plannedActionsColumns: ColumnSelection = [
  {
    id: "plannedActionId",
    type: "key",
  },
  {
    title: "Start",
    id: "startDate",
    type: "date",
  },
  {
    title: "End",
    id: "endDate",
    type: "date",
  },
  {
    title: "Action",
    id: "action",
    type: "string",
  },
  {
    title: "Participant(s)",
    id: "responsibility",
    type: "string",
    size: "small",
  },
  {
    title: "Completed",
    id: "completedDate",
    type: "date",
  },
  {
    id: "isCompleted",
    type: "hidden",
  },
]

const plannedActionsActiveOnly = item => (item.isCompleted?.code!=="Y")

const PlannedActionsFields = `plannedActionId startDate endDate action responsibility completedDate
 isCompleted { code display system }`

