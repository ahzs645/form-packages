const { useCallback, useMemo } = React

const textValue = (value, fallback = "") => {
  if (value == null) return fallback
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map((item) => textValue(item)).filter(Boolean).join(", ")
  return value.display || value.text || value.name || value.code || fallback
}

const compactLines = (lines) => lines.map((line) => textValue(line).trim()).filter(Boolean)

const formatDate = (value) => {
  const raw = textValue(value)
  if (!raw) return ""
  const match = raw.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/)
  if (match) return `${match[1]}.${match[2]}.${match[3]}`
  return raw
}

const optionCode = (value, fallback = "") => {
  if (value == null) return fallback
  if (typeof value === "object") return value.code ?? value.key ?? fallback
  return String(value)
}

const optionDisplay = (value, fallback = "") => {
  if (value == null) return fallback
  if (typeof value === "object") return value.display ?? value.text ?? value.code ?? fallback
  return String(value)
}

const mergeObjects = (...objects) =>
  objects.reduce((merged, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return merged
    return { ...merged, ...value }
  }, {})

const getPatientFromData = (data) => {
  const queryPatient = Array.isArray(data?.queryResult?.patient) ? data.queryResult.patient[0] : null
  return mergeObjects(
    queryPatient,
    data?.patient,
    data?.example?.patient,
    data?.example?.demographics,
    data?.field?.data?.__patientFile
  )
}

const formatAddress = (address) => {
  if (!address) return ""
  if (typeof address === "string") return address
  if (address.text) return textValue(address.text)
  const cityLine = compactLines([address.city, address.province]).join(", ")
  const countryLine = compactLines([address.country, address.postalCode]).join(" ")
  return compactLines([address.line1, address.line2, cityLine, countryLine]).join("\n")
}

const formatContact = (telecom) => {
  if (!telecom) return ""
  if (typeof telecom === "string") return telecom
  const lines = []
  if (telecom.homePhone) lines.push(`Home: ${telecom.homePhone} Leave msg: ${optionCode(telecom.homeMessage, "N") === "Y" ? "Yes" : "No"}`)
  if (telecom.workPhone) lines.push(`Work: ${telecom.workPhone}${telecom.workExt ? ` Ext: ${telecom.workExt}` : ""}`)
  if (telecom.cellPhone) lines.push(`Cell: ${telecom.cellPhone}`)
  if (telecom.homeEmail) lines.push(`Email: ${telecom.homeEmail}`)
  return lines.join("\n")
}

function LegacyPatientFileSections({
  id = "legacyPatientFileSections",
  serviceLocation = "FAMILY PRACTICE",
  createdBy = "DR. PREVIEW USER",
  dateCreated = "",
  quickNavTarget = "clientDemographics",
  sections = ["encounter", "document", "demographics"],
  showSectionTitles = true,
}) {
  const [fd, setFd] = useActiveData()
  const sd = useSourceData()

  const patient = useMemo(() => mergeObjects(getPatientFromData(sd), getPatientFromData(fd)), [fd, sd])
  const encounter = useMemo(() => mergeObjects(sd?.webform?.encounter, sd?.encounter, fd?.example?.encounter), [fd, sd])
  const providerName = textValue(sd?.webform?.provider?.name || sd?.userProfile?.desktopProvider?.name || createdBy, createdBy)
  const createdDate = dateCreated || formatDate(sd?.webform?.createdDate || sd?.webform?.documentDate || encounter?.appointmentDateTime || new Date().toISOString())

  const writePatientUpdates = useCallback((updates) => {
    setFd((draft) => {
      draft.example = draft.example || {}
      draft.example.demographics = { ...(draft.example.demographics || patient), ...updates }
      draft.example.patient = { ...(draft.example.patient || patient), ...updates }
      draft.patient = { ...(draft.patient || patient), ...updates }
      draft.field = draft.field || { data: {}, status: {} }
      draft.field.data = draft.field.data || {}
      draft.field.data.__patientFile = { ...(draft.field.data.__patientFile || patient), ...updates }
      draft.field.data.__patientFileUpdates = { ...(draft.field.data.__patientFileUpdates || {}), ...updates }
      draft.formData = draft.formData || {}
      draft.formData.__patientFileUpdates = { ...(draft.formData.__patientFileUpdates || {}), ...updates }
    })
  }, [patient, setFd])

  const preferredPhoneOptions = [
    { key: "1", text: "Home" },
    { key: "2", text: "Work" },
    { key: "3", text: "Cell" },
    { key: "4", text: "Pager" },
  ]

  const healthNumber = textValue(patient.healthNumber || patient.insuranceNumber)
  const insuranceBy = optionCode(patient.insuranceBy, patient.healthNumberBy || "BC")
  const insuranceNumber = textValue(patient.insuranceNumber || patient.healthNumber)
  const insuranceText = compactLines([insuranceBy && insuranceNumber ? `${insuranceBy}: ${insuranceNumber}` : "", patient.insuranceDependent ? `Dep: ${patient.insuranceDependent}` : ""]).join("\n")
  const preferredCode = optionCode(patient.preferredPhone, "1")
  const activeText = optionDisplay(patient.active, "")
  const addressText = formatAddress(patient.address)
  const contactText = formatContact(patient.telecom)

  const visibleSections = useMemo(() => {
    const requested = Array.isArray(sections) ? sections : [sections]
    return new Set(requested.map((section) => String(section).toLowerCase()))
  }, [sections])

  const sectionTitleStyle = {
    background: "#f3f2f1",
    borderTop: "1px solid #c8c6c4",
    borderBottom: "1px solid #c8c6c4",
    padding: "6px 10px",
    fontWeight: 600,
    color: "#323130",
  }
  const gridStyle = {
    display: "grid",
    gap: "10px 16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    padding: "10px 0 14px",
  }
  const fieldWrapStyle = {
    breakInside: "avoid",
    margin: "0 10px",
  }
  const whiteTextFieldStyles = {
    fieldGroup: {
      backgroundColor: "#ffffff",
      selectors: {
        ":after": { borderColor: "#605e5c" },
      },
    },
    field: {
      backgroundColor: "#ffffff",
    },
  }
  const whiteFlexTextFieldStyles = {
    root: { flex: 1 },
    fieldGroup: whiteTextFieldStyles.fieldGroup,
    field: whiteTextFieldStyles.field,
  }
  const whiteDropdownStyles = {
    title: { backgroundColor: "#ffffff" },
    dropdown: { backgroundColor: "#ffffff" },
  }
  const editButtonStyle = { alignSelf: "flex-end", marginTop: 22 }

  const updateContactText = (nextValue) => {
    writePatientUpdates({
      telecom: {
        ...(patient.telecom || {}),
        displayText: nextValue || "",
      },
    })
  }

  const renderTitle = (title) => {
    if (!showSectionTitles) return null
    return <div style={sectionTitleStyle}>{title}</div>
  }

  const renderEncounterDetails = () => (
    <>
      {renderTitle("Encounter Details")}
      <div style={gridStyle}>
        <div style={fieldWrapStyle}>
          <TextField label="Service Location" value={textValue(encounter?.location || serviceLocation)} readOnly borderless tabIndex={-1} styles={whiteTextFieldStyles} />
        </div>
        <div style={fieldWrapStyle}>
          <TextField label="Current Status" value={activeText} readOnly borderless tabIndex={-1} styles={whiteTextFieldStyles} />
        </div>
      </div>
    </>
  )

  const renderDocumentDetails = () => (
    <>
      {renderTitle("Document Details")}
      <div style={gridStyle}>
        <div style={fieldWrapStyle}>
          <TextField label="Created By" value={providerName} readOnly borderless tabIndex={-1} styles={whiteTextFieldStyles} />
        </div>
        <div style={fieldWrapStyle}>
          <TextField label="Date Created" value={createdDate} readOnly borderless tabIndex={-1} styles={whiteTextFieldStyles} />
        </div>
      </div>
    </>
  )

  const renderClientDemographics = () => (
    <>
      {renderTitle("Client Demographics")}
      <div style={gridStyle}>
        <div style={fieldWrapStyle}>
          <TextField
            label="Health number"
            value={healthNumber}
            styles={whiteTextFieldStyles}
            onChange={(_, value) => writePatientUpdates({ healthNumber: value || "", insuranceNumber: value || "" })}
          />
        </div>
        <div style={{ ...fieldWrapStyle, display: "flex", gap: 6 }}>
          <TextField label="Insurance" value={insuranceText} readOnly borderless multiline rows={2} tabIndex={-1} styles={whiteFlexTextFieldStyles} />
          <IconButton ariaLabel="Edit insurance" iconProps={{ iconName: "Edit" }} style={editButtonStyle} onClick={() => writePatientUpdates({ __lastEditRequest: "insurance" })} />
        </div>
        <div style={fieldWrapStyle}>
          <TextField
            label="Address"
            value={addressText}
            multiline
            rows={5}
            borderless
            styles={whiteTextFieldStyles}
            onChange={(_, value) => writePatientUpdates({ address: { ...(patient.address || {}), text: value || "" } })}
          />
        </div>
        <div style={{ ...fieldWrapStyle, display: "flex", gap: 6 }}>
          <TextField
            label="Contact"
            value={patient.telecom?.displayText || contactText}
            multiline
            rows={5}
            borderless
            onChange={(_, value) => updateContactText(value)}
            styles={whiteFlexTextFieldStyles}
          />
          <IconButton ariaLabel="Edit contact" iconProps={{ iconName: "Edit" }} style={editButtonStyle} onClick={() => writePatientUpdates({ __lastEditRequest: "contact" })} />
        </div>
        <div style={fieldWrapStyle}>
          <Dropdown
            label="Preferred phone"
            selectedKey={preferredCode}
            options={preferredPhoneOptions}
            styles={whiteDropdownStyles}
            onChange={(_, option) => {
              if (!option) return
              writePatientUpdates({ preferredPhone: { code: option.key, display: option.text, system: "MOIS-PREFERREDPHONE" } })
            }}
          />
        </div>
      </div>
    </>
  )

  return (
    <div id={quickNavTarget} data-field-id={id} data-component="LegacyPatientFileSections">
      {visibleSections.has("encounter") ? renderEncounterDetails() : null}
      {visibleSections.has("document") ? renderDocumentDetails() : null}
      {visibleSections.has("demographics") || visibleSections.has("clientdemographics") ? renderClientDemographics() : null}
    </div>
  )
}
