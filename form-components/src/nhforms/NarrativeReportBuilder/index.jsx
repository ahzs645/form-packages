const { useEffect, useMemo, useState } = React
const { Stack, Label, DefaultButton, TextField } = Fluent

const setNarrativePayload = (setFormData, componentId, payload) => {
  setFormData((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    const container = draft.field.data.__componentPayloads ?? {}
    const nextGroup = container.webformUpdatesByComponent ?? {}
    const currentPayload = nextGroup[componentId]
    if (JSON.stringify(currentPayload ?? null) === JSON.stringify(payload ?? null)) {
      return
    }
    if (payload == null) {
      delete nextGroup[componentId]
    } else {
      nextGroup[componentId] = payload
    }
    container.webformUpdatesByComponent = nextGroup
    draft.field.data.__componentPayloads = container
  })
}

const normalizeTemplateRows = (template) => Array.isArray(template) ? template.filter((item) => item && typeof item === "object") : []
const getFieldValue = (root, fieldId) => {
  if (!fieldId || !root || typeof root !== "object") return ""
  const value = root[fieldId]
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (typeof value === "object") return String(value.display ?? value.text ?? value.code ?? "")
  return ""
}

const buildNarrative = (template, data) => {
  const sections = []
  template.forEach((entry) => {
    if (entry.kind === "labelValue") {
      const value = getFieldValue(data, entry.fieldId)
      if (!value) return
      sections.push(`${entry.label || entry.fieldId}: ${value}`)
      return
    }
    if (entry.kind === "conditional") {
      const value = getFieldValue(data, entry.whenFieldId)
      if (String(value) === String(entry.equals ?? "")) {
        sections.push(String(entry.text ?? ""))
      }
    }
  })
  return sections.join("\n")
}

const NarrativeReportBuilder = ({
  id,
  label = "Narrative Report",
  template = [],
  outputFieldId = "generatedNarrative",
  generateOn = "change",
}) => {
  const [fd, setFormData] = useActiveData()
  const [preview, setPreview] = useState("")
  const componentId = id || outputFieldId || "NarrativeReportBuilder"
  const formData = fd?.field?.data ?? {}
  const normalizedTemplate = useMemo(() => normalizeTemplateRows(template), [template])
  const generatedText = useMemo(() => buildNarrative(normalizedTemplate, formData), [formData, normalizedTemplate])

  useEffect(() => {
    setPreview(generatedText)
    setNarrativePayload(setFormData, componentId, generatedText ? { narratives: [{ id: componentId, text: generatedText }] } : null)
    if (generateOn !== "change") return
    setFormData((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[outputFieldId] = generatedText
    })
  }, [componentId, generateOn, generatedText, outputFieldId, setFormData])

  const applyNarrative = () => {
    setFormData((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[outputFieldId] = generatedText
    })
  }

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Label>{label}</Label>
      {generateOn !== "change" ? <DefaultButton text="Generate narrative" onClick={applyNarrative} /> : null}
      <TextField label="Preview" value={preview} readOnly multiline rows={6} />
    </Stack>
  )
}
