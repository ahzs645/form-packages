const { useEffect, useMemo } = React
const { Stack, Label, TextField } = Fluent

const normalizeObservationOptions = (optionList, codeSystem, sd) => {
  if (Array.isArray(optionList) && optionList.length > 0) {
    return optionList.map((item, index) => {
      if (typeof item === "string") {
        return { key: item, text: item, code: item, display: item, system: codeSystem || "" }
      }
      return {
        key: String(item.code ?? item.key ?? index),
        text: String(item.display ?? item.text ?? item.code ?? item.key ?? `Option ${index + 1}`),
        code: String(item.code ?? item.key ?? ""),
        display: String(item.display ?? item.text ?? item.code ?? item.key ?? ""),
        system: String(item.system ?? codeSystem ?? ""),
      }
    })
  }
  const fromContext = codeSystem ? sd?.optionLists?.[codeSystem] : null
  if (Array.isArray(fromContext)) {
    return fromContext.map((item, index) => ({
      key: String(item.code ?? item.key ?? index),
      text: String(item.display ?? item.text ?? item.value ?? item.code ?? item.key ?? ""),
      code: String(item.code ?? item.key ?? ""),
      display: String(item.display ?? item.text ?? item.value ?? item.code ?? item.key ?? ""),
      system: String(item.system ?? codeSystem ?? ""),
    }))
  }
  return []
}
const stripVolatilePayloadFields = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => stripVolatilePayloadFields(item))
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "collectedDateTime")
        .map(([key, nestedValue]) => [key, stripVolatilePayloadFields(nestedValue)])
    )
  }
  return value
}
const payloadsEqual = (left, right) => (
  JSON.stringify(stripVolatilePayloadFields(left ?? null)) ===
  JSON.stringify(stripVolatilePayloadFields(right ?? null))
)

const setNestedPayload = (setFormData, componentId, payloadType, payload) => {
  setFormData((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    const container = draft.field.data.__componentPayloads ?? {}
    const key = payloadType === "webform" ? "webformUpdatesByComponent" : "dcoUpdatesByComponent"
    const nextGroup = container[key] ?? {}
    const currentPayload = nextGroup[componentId]
    if (payloadsEqual(currentPayload, payload)) {
      return
    }
    if (payload == null || (Array.isArray(payload) && payload.length === 0)) {
      delete nextGroup[componentId]
    } else {
      nextGroup[componentId] = payload
    }
    container[key] = nextGroup
    draft.field.data.__componentPayloads = container
  })
}

const ValueSetObservationField = ({
  id,
  fieldId,
  label = "Observation",
  renderAs = "dropdown",
  codeSystem = "",
  optionList = [],
  observationCode = "",
  valueType = "TEXT",
  description,
  reportTemplate = "{display}",
  commentFieldId = "",
  placeholder = "Select an option",
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const componentId = id || fieldId || "ValueSetObservationField"
  const effectiveFieldId = fieldId || componentId
  const selectedValue = fd?.field?.data?.[effectiveFieldId] ?? null
  const commentValue = commentFieldId ? fd?.field?.data?.[commentFieldId] ?? "" : ""
  const createdBy = fd?.field?.data?.createdBy ?? sd?.userProfile?.identity?.fullName
  const options = useMemo(() => normalizeObservationOptions(optionList, codeSystem, sd), [optionList, codeSystem, sd])

  useEffect(() => {
    if (!observationCode) {
      setNestedPayload(setFormData, componentId, "dco", null)
      return
    }
    const selectedCode = selectedValue?.code ?? null
    const selectedDisplay = selectedValue?.display ?? selectedValue?.text ?? null
    const oldObs = sd?.webform?.observations?.find((item) => item.observationCode === observationCode)
    const oldId = oldObs?.observationId ?? 0
    if (!selectedCode && !selectedDisplay) {
      setNestedPayload(setFormData, componentId, "dco", oldId ? [{ observationId: -oldId }] : null)
      return
    }
    const report = String(reportTemplate || "{display}")
      .replaceAll("{display}", String(selectedDisplay ?? ""))
      .replaceAll("{code}", String(selectedCode ?? ""))
      .replaceAll("{comment}", String(commentValue ?? ""))

    setNestedPayload(setFormData, componentId, "dco", [{
      observationId: oldId,
      observationCode,
      observationClass: "DCOBS",
      value: String(selectedCode ?? selectedDisplay ?? ""),
      valueType,
      status: oldId ? "C" : "F",
        description: description || label,
        report,
        units: "",
        orderedBy: createdBy,
        collectedBy: createdBy,
        collectedDateTime: getDateTimeString(new Date()),
      }])
  }, [commentValue, componentId, createdBy, description, label, observationCode, reportTemplate, sd, selectedValue, setFormData, valueType])

  const handleChange = (nextValue) => {
    setFormData((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[effectiveFieldId] = nextValue
    })
  }

  const checklistOptions = options.map((item) => ({ key: item.code || item.key, text: item.display || item.text }))

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      {renderAs === "radio" ? (
        <SimpleCodeChecklist
          fieldId={effectiveFieldId}
          label={label}
          selectionType="single"
          optionList={checklistOptions}
          multiline
        />
      ) : renderAs === "findCode" ? (
        <FindCodeSelect
          fieldId={effectiveFieldId}
          label={label}
          codeSystem={codeSystem}
          optionList={options}
          placeholder={placeholder}
          openOnFocus
          onChange={handleChange}
          value={selectedValue}
        />
      ) : (
        <SimpleCodeSelect
          fieldId={effectiveFieldId}
          label={label}
          selectionType="single"
          optionList={checklistOptions}
        />
      )}
      {commentFieldId ? (
        <TextField
          label="Comment"
          value={commentValue ?? ""}
          onChange={(_event, nextValue) => {
            setFormData((draft) => {
              if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
              if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
              draft.field.data[commentFieldId] = nextValue ?? ""
            })
          }}
        />
      ) : null}
    </Stack>
  )
}
