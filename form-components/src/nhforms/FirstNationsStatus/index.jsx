

const FirstNationsStatus = () => {

  const [fd] = useActiveData()
  const hasReserveName = !!fd.field.data.reserveName

  useOnRefresh((sd,fd) => {
    if (sd.webform?.isDraft!=="N") {

      // Reserve name is coded as a connected resource in MOIS
      const connections = sd.patient?.connectedResources ?? []
      const reserveConnection = connections.find(c => (c.connectionType.code==="FNRESERVE"))
      const reserveName = reserveConnection?.name || null

      // ethnicity is recorded in the raceN fields, we use the "SELF" race that
      // is a first nations CDC race code, If no self recorded, then the first mother or father race.
      const races = [sd.patient?.race3, sd.patient?.race2, sd.patient?.race1]
      let ethnicity = { code: null, display: null, system: "CDC-RACE"}
      let selfId = { code: "U", display: "Unknown", system: "AIHS-YESNOUNKNOWN"}
      for (const race of races) {
        if (!race) continue
        if (race.type==="SELF" && firstNationEthnicityCodes.includes(race.code)) {
          ethnicity = { code: race.code, display: race.display, system: race.system }
          if (race.isSelfIdentified!=null) {
            selfId = race.isSelfIdentified
              ? { code: "Y", display: "Yes", system: "AIHS-YESNOUNKNOWN"}
              : { code: "N", display: "No", system: "AIHS-YESNOUNKNOWN"}
          }
          break // Stop looking if self
        } else if (firstNationEthnicityCodes.includes(race.code)) {
          ethnicity = { code: race.code, display: race.display, system: race.system }
          if (race.isSelfIdentified!=null) {
            selfId = race.isSelfIdentified
              ? { code: "Y", display: "Yes", system: "AIHS-YESNOUNKNOWN"}
              : { code: "N", display: "No", system: "AIHS-YESNOUNKNOWN"}
          }
          continue // In case "self" is set
        }
      }

      fd.setFormData(produce(draft => {
        draft.field.data.firstNationStatus = sd.patient?.firstNationStatus
        draft.field.data.reserveName = reserveName
        draft.field.data.ethnicity = ethnicity
        draft.field.data.ethnicitySelfIDed = selfId
      }))
    }
  })

  return (
    <>
      <SimpleCodeSelect
        id='firstNationStatus'
        readOnly
        moisModule="DEMOGRAPHICS"
        label='First Nations Status'
        placeholder="No record in Demographics - Patient detail"
        conditionalCodes={["Status Indian","Non-status Indian"]}
      >
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          fieldId='ethnicitySelfIDed'
          label='Self identified'
          optionSize="small"
          readOnly
        />
        <Ethnicity />
      </SimpleCodeSelect>

      <SimpleCodeChecklist
        fieldId="livingOnReserve"
        label="Living on Reserve"
        codeSystem="AIHS-YESNOUNKNOWN"
        size="large"
        optionSize="small"
        optionList={[
          { key: "Y", text: "Predominantly lives on reserve"},
          { key: "N", text: "Predominantly lives off reserve"},
          { key: "U", text: "Unknown / Not Asked"},
        ]}
        conditionalCodes={["Y"]}
      >
        <TextArea
          fieldId="reserveName"
          label="Reserve Name"
          placeholder="Please enter a connection in MOIS as follows:"
          moisModule="DEMOGRAPHICS"
          readOnly
        />
        {!hasReserveName && 
          <Markdown source={`
- Connection Role: **FNRESERVE**
- Connection Resource: **Organization (Ext)**
- Connection: **Reserve name**
          `} />
        }
      </SimpleCodeChecklist>
    </>
  )
}

const firstNationsStatusPatientFields = `
connectedResources {connectionId connectionType { code display system } name startDate stopDate}
firstNationStatus { code display system }
race1 {code display isSelfIdentified system type }
race2 {code display isSelfIdentified system type }
race3 {code display isSelfIdentified system type }
`

const firstNationsStatusSchema = {
  firstNationStatus:  { $ref: "#/definitions/coding" },
  ethnicitySelfIDed:  { $ref: "#/definitions/ynu" },
  ethnicity:          { $ref: "#/definitions/coding" },
  livingOnReserve:    { $ref: "#/definitions/ynu" },
  reserveName:        { type: ["string","null"] },
}
