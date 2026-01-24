
// Handle 2.25.12 case where Allergies is a predefined component
if (typeof Allergies==="undefined") {
  window.Allergies = null
}

/**
 * Display a list of allergy indications associated with the patient
 */
Allergies = ({
  id = "allergies",
  selectText = "Select allergies to include",
  selectionType = "none",
  ...props
}:Props) => {

  return (
    <ListSelection
      {...{columns: allergyColumns, id, selectionType, selectText}}
      {...props}
    />
  )

}

const allergyColumns: ColumnSelection = [
  {
    id: "allergyId",
    type: "key",
  },
  {
    title: "Onset",
    id: "startDate",
    type: "date",
  },
  {
    id: "stopDate",
    type: "hidden",
  },
  {
    title: "Agent",
    id: "substance",
    type: "string",
  },
  {
    title: "Reactions",
    id: "reactions",
    type: "string",
  },
]

const AllergiesFields = "allergyId startDate stopDate substance reactions"
