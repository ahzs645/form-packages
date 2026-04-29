const { useEffect, useMemo } = React

const legacyContextText = (value, fallback = "") => {
  if (value == null) return fallback
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map((item) => legacyContextText(item)).filter(Boolean).join(", ")
  return value.display || value.text || value.name || value.code || fallback
}

const legacyContextVisitCode = (value, fallback = "") => {
  if (value == null) return fallback
  if (typeof value === "object") {
    const code = value.code || value.key || ""
    const display = value.display || value.text || ""
    if (code && display) return `${code} (${display})`
    return display || code || fallback
  }
  return String(value)
}

const legacyContextDate = (value, separator = ".") => {
  const raw = legacyContextText(value)
  if (!raw) return ""
  const match = raw.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/)
  if (match) return `${match[1]}${separator}${match[2]}${separator}${match[3]}`
  return raw
}

const legacyContextDateTime = (value) => {
  const raw = legacyContextText(value)
  if (!raw) return ""
  const match = raw.match(/^(\d{4})[-.](\d{2})[-.](\d{2})(?:T|\s)?(\d{2})?:?(\d{2})?/)
  if (!match) return raw
  const date = `${match[1]}-${match[2]}-${match[3]}`
  if (!match[4]) return date
  return `${date} ${match[4]}:${match[5] || "00"}`
}

const legacyFieldWrap = {
  breakInside: "avoid",
  margin: "0px 10px",
  flex: "3 3 0px",
  minWidth: 160,
  maxWidth: 320,
}

const legacySmallFieldWrap = {
  ...legacyFieldWrap,
  flex: "2 2 0px",
  minWidth: 80,
  maxWidth: 160,
}

const legacyTextStyles = {
  fieldGroup: { background: "#fff" },
  field: { color: "#323130" },
}

function LegacyFormContextHeader({
  id = "legacyFormContextHeader",
  formDateFieldId = "formDate",
  createdByFieldId = "createdBy",
  encounterDateFieldId = "encDate",
  visitCodeFieldId = "visCode",
  visitReasonFieldId = "visReason",
  providerFieldId = "daybookProvider",
  attendingProviderFieldId = "attendingProvider",
  serviceLocationFieldId = "serviceLoc",
  createdByFallback = "DR. PREVIEW USER",
  serviceLocationFallback = "FAMILY PRACTICE",
  formDateLabel = "Form Date:",
  createdByLabel = "Form Created by:",
}) {
  const sd = useSourceData()
  const [fd, setFd] = useActiveData()

  const values = useMemo(() => {
    const encounter = sd?.webform?.encounter || sd?.encounter || fd?.example?.encounter || {}
    const providerName = legacyContextText(
      sd?.webform?.provider?.name ||
        sd?.userProfile?.desktopProvider?.name ||
        sd?.userProfile?.identity?.fullName ||
        createdByFallback,
      createdByFallback
    )
    const appointmentDateTime = encounter?.appointmentDateTime || encounter?.date || new Date().toISOString()
    return {
      [formDateFieldId]: legacyContextDate(sd?.webform?.documentDate || sd?.webform?.createdDate || new Date().toISOString(), "."),
      [createdByFieldId]: providerName,
      [encounterDateFieldId]: legacyContextDateTime(appointmentDateTime),
      [visitCodeFieldId]: legacyContextVisitCode(encounter?.visitCode || encounter?.code, ""),
      [visitReasonFieldId]: legacyContextText(encounter?.visitReason1 || encounter?.visitReason || encounter?.reason, ""),
      [providerFieldId]: providerName,
      [attendingProviderFieldId]: legacyContextText(encounter?.attendingProvider, providerName),
      [serviceLocationFieldId]: legacyContextText(encounter?.location, serviceLocationFallback),
    }
  }, [
    attendingProviderFieldId,
    createdByFallback,
    createdByFieldId,
    encounterDateFieldId,
    fd,
    formDateFieldId,
    providerFieldId,
    sd,
    serviceLocationFallback,
    serviceLocationFieldId,
    visitCodeFieldId,
    visitReasonFieldId,
  ])

  useEffect(() => {
    setFd((draft) => {
      draft.field = draft.field || { data: {}, status: {} }
      draft.field.data = draft.field.data || {}
      draft.formData = draft.formData || {}
      Object.assign(draft.field.data, values)
      Object.assign(draft.formData, values)
    })
  }, [setFd, values])

  const renderReadOnlyField = (fieldId, label, value) => (
    <div data-field-id={fieldId} style={legacyFieldWrap}>
      <div style={{ display: "flex", flexFlow: "column", minWidth: 160, width: "100%" }}>
        <div style={{ flex: "1 1 0px", display: "flex", flexFlow: "wrap", minWidth: 160, width: "100%" }}>
          <TextField
            id={fieldId}
            label={label}
            value={value}
            readOnly
            borderless
            tabIndex={-1}
            styles={legacyTextStyles}
          />
        </div>
      </div>
      <div style={{ clear: "both" }} />
    </div>
  )

  return (
    <div data-field-id={id} data-component="LegacyFormContextHeader">
      <div style={{ width: "100%" }}>
        <div style={legacySmallFieldWrap} data-field-id={formDateFieldId}>
          <Label>{formDateLabel}</Label>
          <DatePicker
            value={values[formDateFieldId] ? new Date(values[formDateFieldId].replace(/\./g, "-")) : undefined}
            formatDate={() => values[formDateFieldId]}
            placeholder="YYYY.MM.DD"
            disabled
          />
          <div style={{ clear: "both" }} />
        </div>
        <div style={legacyFieldWrap} data-field-id={createdByFieldId}>
          <Label>{createdByLabel}</Label>
          <TextField id={createdByFieldId} value={values[createdByFieldId]} readOnly disabled placeholder="Please search" styles={legacyTextStyles} />
          <div style={{ clear: "both" }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}>
        {renderReadOnlyField(encounterDateFieldId, "Encounter Date:", values[encounterDateFieldId])}
        {renderReadOnlyField(visitCodeFieldId, "Visit Code:", values[visitCodeFieldId])}
      </div>
      {renderReadOnlyField(visitReasonFieldId, "Visit Reason", values[visitReasonFieldId])}
      {renderReadOnlyField(providerFieldId, "Provider:", values[providerFieldId])}
      {renderReadOnlyField(attendingProviderFieldId, "Attending Provider:", values[attendingProviderFieldId])}
      {renderReadOnlyField(serviceLocationFieldId, "Service Location:", values[serviceLocationFieldId])}
    </div>
  )
}

const LegacyFormContextHeaderSchema = {
  formDate: { type: "string" },
  createdBy: { type: "string" },
  encDate: { type: "string" },
  visCode: { type: "string" },
  visReason: { type: "string" },
  daybookProvider: { type: "string" },
  attendingProvider: { type: "string" },
  serviceLoc: { type: "string" },
}
