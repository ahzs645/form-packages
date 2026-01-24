/**
 * Provide dropdown selection of a single service episode. The initial data is
 * obtained from the patient object.
 */
const ServiceEpisodes = ({
  id = "serviceEpisodes",
  readOnly = false,
  selectText = "Select service episodes",
  selectionType = "single",
  listCompare = startDateDesc,
  ...props
}:Props) => {

  return (
    <ListSelection
      {...{id, selectionType, columns: serviceEpisodeColumns, selectText, readOnly, listCompare}}
      {...props}
    />
  )
}

const activeServiceEpisodes = se => (!se.endDate)

const serviceEpisodeColumns: ColumnSelection = [
  {
    id: "serviceEpisodeId",
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
    title: "Service Episode",
    id: "service",
    type: "code",
    size: "large",
  },
  {
    title: "Service MRP",
    id: "serviceMrp",
    type: "code",
    size: "small",
  }
]

const ServiceEpisodesFields = "serviceEpisodeId startDate endDate service {code display system} serviceMrp {code display system}"
