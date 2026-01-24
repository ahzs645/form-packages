/**
 * Shows and allows selection of service requests
 */
const ServiceRequests = ({
  id = "serviceRequests",
  label = "Service Requests",
  moisModule = "ORDERS",
  selectText = "Select service request",
  selectionType = "single",
  listCompare = orderDateDesc,
  ...props
}:Props) => {


  return (
    <ListSelection
      {...{id, label, moisModule, selectText, selectionType, listCompare, columns: serviceRequestColumns}}
      {...props}
    />
  )
}

const serviceRequestColumns: ColumnSelection = [
  {
    id: "serviceRequestId",
    type: "key",
  },
  {
    title: "Date",
    id: "orderDate",
    type: "date",
  },
  {
    title: "Type",
    id: "serviceRequestType",
    type: "code",
  },
  {
    title: "Ordered by",
    id: "orderedBy",
    type: "string",
    size: "small",
  },
  {
    title: "Order",
    id: "order",
    type: "code",
    size: "large",
  },
  {
    title: "Status",
    id: "status",
    type: "rawcode",
  },
]

const orderDateDesc = (a,b) => -(a.orderDate?.localeCompare(b.orderDate) ?? 0)
const activeServiceRequests = (sr) => {
  return ["IP","SC","A","HD",].includes(sr.status.code)
}

const ServiceRequestsFields = `
serviceRequestId
orderDate
serviceRequestType { code display system }
orderedBy
order { code display system }
status { code display system }
`