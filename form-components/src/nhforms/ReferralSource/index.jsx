
const ReferralSource = props => {
  const codeSystem = "VALUESET:REFERRAL.SOURCE"
  const sd = useSourceData()
  const optionList = sd.optionLists[codeSystem] ?? referralValueSet
  return (
    <SimpleCodeSelect
      fieldId="referralSource"
      label="Referral Source/Requested By"
      {...{optionList,codeSystem}}
      {...props}
    />
  )
}

// This is a fallback value set if VALUESET:REFERRAL.SOURCE is not in the
// Database.
const referralValueSet = [
  { code: "ABORIGINAL COMMUNITY SERVICE", display: "Aboriginal Community Service (not HA service)" },
  { code: "ACUTE CARE", display: "Acute Care" },
  { code: "ADULT JUSTICE", display: "Adult Justice (Corrections, Probation and Police)" },
  { code: "YOUTH MENTAL HEALTH", display: "Child and Youth Mental Health" },
  { code: "CHILD PROTECTION", display: "Child Protection" },
  { code: "COMMUNITY AGENCY", display: "Community Agency" },
  { code: "CRISIS RESPONSE SERVICE", display: "Crisis Response Service (not HA service)" },
  { code: "EMERGENCY ROOM", display: "Emergency Room" },
  { code: "FAMILY RELATIVE FRIEND OR CAREGIVER", display: "Family, Relative, Friend or Caregiver" },
  { code: "HOME AND COMMUNITY CARE", display: "Home and Community Care" },
  { code: "HOSPITAL", display: "Hospital" },
  { code: "HOUSING SERVICE", display: "Housing Service" },
  { code: "INCOME ASSISTANCE", display: "Income Assistance" },
  { code: "OTHER", display: "Other" },
  { code: "OTHER COMMUNITY SERVICE", display: "Other Community Service (not MHSU, not HCC)" },
  { code: "OTHER HEALTH AUTHORITY", display: "Other Health Authority" },
  { code: "OTHER HEALTH PROFESSIONAL", display: "Other Health Professional" },
  { code: "OTHER MENTAL HEALTHSERVICE", display: "Other Mental Health Service (not HA service)" },
  { code: "OTHER MHSU SERVICE", display: "Other MHSU Service from within the same HA" },
  { code: "OTHER SUBSTANCE USE SERVICE", display: "Other Substance Use Service (not HA service)" },
  { code: "PHYSICIAN SPECIALIST", display: "Physician/GP, Specialist (include Psychiatrist)" },
  { code: "PUBLIC HEALTH SERVICE", display: "Public Health Service" },
  { code: "EDUCATIONAL INSTITUTION", display: "Schools and Educational Institutions" },
  { code: "SELF", display: "Self" },
  { code: "TERTIARY CARE", display: "Tertiary Care" },
  { code: "UNKNOWN", display: "Unknown/not asked" },
  { code: "YOUTH FORENSICS", display: "Youth Forensics" },
  { code: "YOUTH JUSTICE", display: "Youth Justice" },
]
