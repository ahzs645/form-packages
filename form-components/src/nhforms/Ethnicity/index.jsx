
const Ethnicity = props => {
  return (
    <SimpleCodeSelect
      fieldId='ethnicity'
      label='Ethnicity'
      readOnly
      codeSystem="CDC-RACE"
      optionList={firstNationsEthnicityReferenceSet}
      {...props}
    />
  )
}

const firstNationsEthnicityReferenceSet = [
  { code: "91", display: "First Nations" },
  { code: "92", display: "Inuit" },
  { code: "93", display: "Metis" },
]

const firstNationEthnicityCodes = firstNationsEthnicityReferenceSet.map(e=>e.code)
