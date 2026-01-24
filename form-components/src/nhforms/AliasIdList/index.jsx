
const AliasIdList = ({
  label = "Alias Patient Identifiers",
  placeholder = "No alias patient identifiers in chart",
  id = "aliasIdentifiers",
  fieldId,
  sourceId,
  filterPred = (aid:any)=>true,
  isComplete,
  section,
  moisModule = null,
  required = false,
  labelProps = {},
}:Props) => {
  const { Label,Text,Stack } = Fluent
  fieldId = fieldId ?? id
  sourceId = sourceId ?? id

  const [fd, setFd] = useActiveData()
  const sd = useSourceData()
  section = MoisHooks.useSection(section)
  isComplete = isComplete ?? section.sectionComplete(sd,fd,section.sectionNum)

  const active = section.activeSelector(fd)?.[fieldId]

  useOnRefresh((sd,fd) => {
    const source = section.sourceSelector(sd)
    const data = section.activeSelector(fd)
    const initializing = fieldId && data[fieldId]===undefined
    const updating = sourceId && fieldId && !(isComplete ?? section.sectionComplete(sd,fd,section.sectionNum))
    if (initializing || updating) {
      setFd(produce(draft => {
        const newIds = source?.[sourceId]?.filter(filterPred)?.map( aid => ({
          aliasIdentifierId: aid.aliasIdentifierId,
          effectiveDate: aid.effectiveDate,
          idType: aid.identifierType.display,
          identifier: aid.identifier,
          comment: aid.comment,
        }))
        section.activeSelector(draft)[fieldId] = newIds
        }
      ))
    }
  })

  if (active?.length>0) {
    return (
      <>
      <MoisControl.LayoutItem {...{label,moisModule,required,labelProps}}>
        <>
          {active.map((item) => (
            <div key={item.aliasIdentifierId} style={{display: "flex"}}>
              <Text style={{minWidth: "150px"}}>{item.idType}:</Text>
              <Text style={{minWidth: "150px"}}>{item.identifier}</Text>
              <Text>{item.comment}</Text>
            </div>
          ))}
        </>
      </MoisControl.LayoutItem>
      </>
    )
  } else {
    return (
      <Stack horizontal>
        <Label required={required} {...labelProps}>{placeholder}</Label>
        {moisModule && <LinkToMois moisModule={moisModule} />}
      </Stack>
    )
  }
}

const AliasIdListFields = "aliasIdentifierId identifier comment effectiveDate identifierType { code display system }"
