/**
 * Display a list of long term medication orders for this patient.
 */
const LongTermMedications = ({
  id = "longTermMedicationOrders",
  label = "Long term medications",
  selectText = "Select relevant medications",
  selectionType = "none",
  listSelectionProps,
  ...props
}:Props) => {

  return (
    <ListSelection
      {...{id, label, selectText, selectionType, columns: longTermMedicationColumns}}
      {...props}
    />
  )
}

const longTermMedicationColumns: ColumnSelection = [
  {
    id: "longTermMedicationOrderId",
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
    title: "Medication",
    id: "medication",
    type: "string",
  },
  {
    title: "Dose Frequency",
    id: "doseFrequency",
    type: "string",
  },
]

const LongTermMedicationsFields = "longTermMedicationOrderId startDate endDate medication doseFrequency"
