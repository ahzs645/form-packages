/**
 * Display a list of patient's employers and occupations. By default, it will
 * display all occupations in the patient chart and then allows selection of
 * which items to display.
 */
const Occupations = ({
  id = "occupations",
  label = "Employment History",
  selectText = "Select specific employment",
  selectionType = "none",
}) => {

  return (
    <ListSelection
      {...{id, label, selectText, selectionType, columns: occupationColumns}}
    />
  )
}

const occupationColumns: ColumnSelection = [
  {
    id: "occupationId",
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
    title: "Description",
    id: "classification",
    type: "code",
    size: "medium",
  },
  {
    title: "Employer",
    id: "employer",
    type: "string",
    size: "small",
  },
  {
    title: "Hours/week",
    id: "hoursPerWeek",
    type: "number",
    size: "tiny",
  },
]

const OccupationsFields = `
occupationId 
startDate
endDate
employer
classification { code display system }
hoursPerWeek
`
