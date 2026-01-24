/**
 * Displays the patient's educational history as recorded in the chart.
 */
const EducationHistory = ({
  id = "educations",
  label = "Education history",
  selectionType = "none",
  selectText = "Select relevent education",
  ...props
}:ListSelectionProps) => {

  return (
    <ListSelection
      {...{id, label, selectText, selectionType, columns: educationHistorycolumns}}
      {...props}
    />
  )
}

const educationHistorycolumns: ColumnSelection = [
  {
    id: "educationId",
    type: "key",
  },
  {
    title: "Start",
    id: "startDate",
    type: "date",
  },
  {
    title: "Stop",
    id: "stopDate",
    type: "date",
  },
  {
    title: "Educational Institution",
    id: "educationalInstitution",
    type: "code",
    size: "medium",
  },
  {
    title: "Level of Education",
    id: "educationLevel",
    type: "code",
  },
]

const EducationHistoryFields = "educationId startDate stopDate educationalInstitution { code display system } educationLevel { code display system }"
