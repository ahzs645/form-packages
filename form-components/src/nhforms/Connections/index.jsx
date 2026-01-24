/**
 * Shows a list of all the patients current connected resources,
 * such as their primary care provider, other care team members, and
 * associated care providers.
 */
const Connections = ({
  id = "connectedResources",
  label = "Patient Connections",
  selectText="Select connections",
  selectionType = "none",
  filterPred = SelectActiveConnections,
  ...props
}:ListSelectionProps) => {

  return (
    <ListSelection
      {...{id, label, selectText, selectionType, filterPred, columns: connectionsColumns}}
      {...props}
    />
  )
}

const connectionsColumns: ColumnSelection = [
  {
    id: "connectionId",
    type: "key",
  },
  {
    title: "Date",
    id: "startDate",
    type: "date"
  },
  {
    id: "stopDate",
    type: "hidden",
  },
  {
    title: "Role",
    id: "connectionType",
    type: "code",
  },
  {
    title: "Name",
    id: "name",
    type: "string",
  },
]

const SelectActiveConnections = cr => (!cr.stopDate)

const ConnectionsFields = "connectionId startDate stopDate connectionType {code display system} name"
