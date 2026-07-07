/**
 * Shows a list of all the patients current connected resources,
 * such as their primary care provider, other care team members, and
 * associated care providers.
 */
// Named comparators so fixtures/builder props can request a sort order without
// a function prop (legacy homecare passed listCompare={sortRoleThenName}).
const CONNECTIONS_SORTS = {
  roleThenName: (a, b) => {
    const byType = a.connectionType?.display?.localeCompare(b.connectionType?.display)
    return (byType ? byType : a.name?.localeCompare(b.name)) ?? 0
  },
}

const Connections = ({
  id = "connectedResources",
  label = "Patient Connections",
  selectText="Select connections",
  selectionType = "none",
  filterPred = SelectActiveConnections,
  sortBy,
  listCompare,
  ...props
}:ListSelectionProps) => {
  const resolvedCompare = listCompare ?? (sortBy ? CONNECTIONS_SORTS[sortBy] : undefined)

  return (
    <ListSelection
      {...{id, label, selectText, selectionType, filterPred, columns: connectionsColumns}}
      {...(resolvedCompare ? { listCompare: resolvedCompare } : {})}
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
