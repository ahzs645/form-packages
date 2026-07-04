const { useEffect, useMemo } = React

const normalizeCodedChoiceOptions = (optionList, codeSystem, sd) => {
  if (Array.isArray(optionList) && optionList.length > 0) {
    return optionList.map((item, index) => {
      if (typeof item === "string") {
        return { key: item, text: item, code: item, display: item, system: codeSystem || "" }
      }
      return {
        key: String(item.code ?? item.key ?? index),
        text: String(item.display ?? item.text ?? item.label ?? item.code ?? item.key ?? `Option ${index + 1}`),
        code: String(item.code ?? item.key ?? ""),
        display: String(item.display ?? item.text ?? item.label ?? item.code ?? item.key ?? ""),
        system: String(item.system ?? codeSystem ?? ""),
        order: typeof item.order === "number" ? item.order : undefined,
        hotKey: item.hotKey ? String(item.hotKey) : undefined,
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

const normalizeSelectedCodings = (rawValue, options, codeSystem) => {
  const values = Array.isArray(rawValue)
    ? rawValue
    : rawValue === undefined || rawValue === null || rawValue === ""
      ? []
      : [rawValue]

  return values
    .map((item) => {
      if (typeof item === "string") {
        const option = options.find((entry) => entry.code === item || entry.key === item || entry.display === item)
        return {
          code: option?.code ?? item,
          display: option?.display ?? option?.text ?? item,
          system: option?.system ?? codeSystem ?? "",
        }
      }
      if (!item || typeof item !== "object") return null
      const code = item.code ?? item.key ?? null
      const display = item.display ?? item.text ?? item.label ?? code ?? ""
      if (code === null && !display) return null
      return {
        code: code === null || code === undefined ? null : String(code),
        display: String(display ?? ""),
        system: String(item.system ?? codeSystem ?? ""),
      }
    })
    .filter(Boolean)
}

const stripVolatileCodedChoicePayloadFields = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => stripVolatileCodedChoicePayloadFields(item))
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "collectedDateTime")
        .map(([key, nestedValue]) => [key, stripVolatileCodedChoicePayloadFields(nestedValue)])
    )
  }
  return value
}

const codedChoicePayloadsEqual = (left, right) => (
  JSON.stringify(stripVolatileCodedChoicePayloadFields(left ?? null)) ===
  JSON.stringify(stripVolatileCodedChoicePayloadFields(right ?? null))
)

const setCodedChoicePayload = (setFormData, componentId, payload) => {
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    const container = draft.field.data.__componentPayloads ?? {}
    const nextGroup = container.dcoUpdatesByComponent ?? {}
    const currentPayload = nextGroup[componentId]
    if (codedChoicePayloadsEqual(currentPayload, payload)) {
      return
    }
    if (payload == null || (Array.isArray(payload) && payload.length === 0)) {
      delete nextGroup[componentId]
    } else {
      nextGroup[componentId] = payload
    }
    container.dcoUpdatesByComponent = nextGroup
    draft.field.data.__componentPayloads = container
  }))
}

const findExistingObservationId = (sd, observationCode) => {
  if (!observationCode) return 0
  const candidates = [
    ...(Array.isArray(sd?.webform?.observations) ? sd.webform.observations : []),
    ...(Array.isArray(sd?.patient?.observations) ? sd.patient.observations : []),
  ]
  const match = candidates.find((item) => item?.observationCode === observationCode)
  return Number(match?.observationId ?? 0) || 0
}

const formatCodedChoiceReport = (template, codings, commentValue) => {
  const display = codings.map((item) => item.display ?? item.code ?? "").filter(Boolean).join(", ")
  const code = codings.map((item) => item.code ?? item.display ?? "").filter(Boolean).join(", ")
  return String(template || "{display}")
    .replaceAll("{display}", display)
    .replaceAll("{code}", code)
    .replaceAll("{value}", code || display)
    .replaceAll("{comment}", String(commentValue ?? ""))
}

const writeCodedChoiceValue = (setFormData, fieldId, value) => {
  if (!fieldId) return
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    draft.field.data[fieldId] = value
  }))
}

const CodedObservationChoiceField = ({
  id,
  fieldId,
  label = "Coded choice",
  renderAs,
  choiceStyle,
  selectionType = "single",
  codeSystem = "",
  optionList = [],
  observationCode = "",
  loincCode = "",
  valueType = "TEXT",
  description,
  reportTemplate = "{display}",
  commentFieldId = "",
  placeholder = "Select an option",
  autoHotKey = false,
  noAutoSkip = false,
  showOtherOption = false,
  labelPosition,
  readOnly = false,
  required = false,
  disabled = false,
  multiline = true,
  multiSaveMode = "joinCodes",
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const componentId = id || fieldId || "CodedObservationChoiceField"
  const effectiveFieldId = fieldId || componentId
  const selectedValue = fd?.field?.data?.[effectiveFieldId] ?? null
  const commentValue = commentFieldId ? fd?.field?.data?.[commentFieldId] ?? "" : ""
  const createdBy = fd?.field?.data?.createdBy ?? sd?.userProfile?.identity?.fullName
  const options = useMemo(() => normalizeCodedChoiceOptions(optionList, codeSystem, sd), [optionList, codeSystem, sd])
  const codings = useMemo(
    () => normalizeSelectedCodings(selectedValue, options, codeSystem),
    [selectedValue, options, codeSystem]
  )

  useEffect(() => {
    if (!observationCode) {
      setCodedChoicePayload(setFormData, componentId, null)
      return
    }
    const oldId = findExistingObservationId(sd, observationCode)
    if (codings.length === 0) {
      setCodedChoicePayload(setFormData, componentId, oldId ? [{ observationId: -oldId }] : null)
      return
    }

    const display = codings.map((item) => item.display ?? item.code ?? "").filter(Boolean).join(", ")
    const code = codings.map((item) => item.code ?? item.display ?? "").filter(Boolean).join(", ")
    const value = multiSaveMode === "joinDisplays" ? display : code || display
    const report = formatCodedChoiceReport(reportTemplate, codings, commentValue)

    setCodedChoicePayload(setFormData, componentId, [{
      observationId: oldId,
      observationCode,
      ...(loincCode ? { loincCode } : {}),
      observationClass: "DCOBS",
      value: String(value ?? ""),
      valueType,
      status: oldId ? "C" : "F",
      description: description || label,
      report,
      units: "",
      orderedBy: createdBy,
      collectedBy: createdBy,
      collectedDateTime: getDateTimeString(new Date()),
    }])
  }, [codings, commentValue, componentId, createdBy, description, label, loincCode, multiSaveMode, observationCode, reportTemplate, sd, setFormData, valueType])

  const effectiveRenderAs = renderAs || choiceStyle || "dropdown"
  const isMultiple =
    selectionType === "multiple" ||
    effectiveRenderAs === "checkbox" ||
    effectiveRenderAs === "multiselect"
  const effectiveSelectionType = isMultiple ? "multiple" : "single"
  const checklistOptions = options.map((item) => ({ key: item.code || item.key, text: item.display || item.text, order: item.order, hotKey: item.hotKey }))
  const selectOptions = options.map((item) => ({
    code: item.code || item.key,
    display: item.display || item.text,
    system: item.system || codeSystem || "",
    order: item.order,
    hotKey: item.hotKey,
  }))

  const handleFindCodeChange = (nextValue) => {
    writeCodedChoiceValue(setFormData, effectiveFieldId, nextValue)
  }

  return (
    <div>
      {effectiveRenderAs === "radio" || effectiveRenderAs === "checkbox" ? (
        <SimpleCodeChecklist
          fieldId={effectiveFieldId}
          label={label}
          selectionType={effectiveSelectionType}
          optionList={checklistOptions}
          codeSystem={codeSystem}
          multiline={multiline}
          autoHotKey={autoHotKey}
          noAutoSkip={noAutoSkip}
          showOtherOption={showOtherOption}
          labelPosition={labelPosition}
          readOnly={readOnly}
          required={required}
          disabled={disabled}
        />
      ) : effectiveRenderAs === "findCode" ? (
        <FindCodeSelect
          fieldId={effectiveFieldId}
          label={label}
          codeSystem={codeSystem}
          optionList={selectOptions}
          selectionType={effectiveSelectionType}
          placeholder={placeholder}
          openOnFocus
          showOtherOption={showOtherOption}
          onChange={handleFindCodeChange}
          value={selectedValue}
          labelPosition={labelPosition}
          readOnly={readOnly}
          required={required}
          disabled={disabled}
        />
      ) : (
        <SimpleCodeSelect
          fieldId={effectiveFieldId}
          label={label}
          selectionType={effectiveSelectionType}
          optionList={selectOptions}
          codeSystem={codeSystem}
          placeholder={placeholder}
          showOtherOption={showOtherOption}
          autoHotKey={autoHotKey}
          noAutoSkip={noAutoSkip}
          labelPosition={labelPosition}
          readOnly={readOnly}
          required={required}
          disabled={disabled}
        />
      )}
      {commentFieldId ? (
        <Fluent.TextField
          label="Comment"
          value={commentValue ?? ""}
          onChange={(_event, nextValue) => writeCodedChoiceValue(setFormData, commentFieldId, nextValue ?? "")}
        />
      ) : null}
    </div>
  )
}
