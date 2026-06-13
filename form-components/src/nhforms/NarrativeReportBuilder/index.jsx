const { useEffect, useMemo, useState } = React
const { Stack, Label, DefaultButton, TextField } = Fluent

// setFormData must receive a produce()-wrapped recipe: the real MOIS runtime
// hands back the raw React state setter, so a bare mutator would replace the
// active form data with undefined.
const setNarrativePayload = (setFormData, componentId, payload) => {
  setFormData(produce((draft) => {
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
  }))
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

const getPathValue = (root, path) => {
  if (!path) return ""
  return String(path).split(".").filter(Boolean).reduce((current, key) => {
    if (current == null) return undefined
    if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)]
    return current[key]
  }, root)
}

const normalizeTextValue = (value) => {
  if (value === undefined || value === null) return ""
  if (Array.isArray(value)) return value.map(normalizeTextValue).filter(Boolean).join(", ")
  if (typeof value === "object") return String(value.display ?? value.text ?? value.value ?? value.code ?? JSON.stringify(value))
  return String(value)
}

const renderTextTemplate = (template, data, context = {}) =>
  String(template || "")
    .replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, path, body) => {
      const rows = getPathValue(data, String(path).trim())
      if (!Array.isArray(rows)) return ""
      return rows
        .map((item, index) => renderTextTemplate(body, data, { ...context, this: item, index: index + 1 }))
        .join("")
    })
    .replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey) => {
      const key = String(rawKey).trim()
      if (key === "index") return String(context.index ?? "")
      if (key === "this") return normalizeTextValue(context.this)
      if (key.startsWith("this.")) return normalizeTextValue(getPathValue(context.this, key.slice(5)))
      return normalizeTextValue(getPathValue(data, key))
    })
    .replace(/\{([^{}]+)\}/g, (_, rawKey) => normalizeTextValue(getPathValue(data, String(rawKey).trim())))

const buildNarrative = (template, data) => {
  if (typeof template === "string") return renderTextTemplate(template, data)
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
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[outputFieldId] = generatedText
    }))
  }, [componentId, generateOn, generatedText, outputFieldId, setFormData])

  const applyNarrative = () => {
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[outputFieldId] = generatedText
    }))
  }

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Label>{label}</Label>
      {generateOn !== "change" ? <DefaultButton text="Generate narrative" onClick={applyNarrative} /> : null}
      <TextField label="Preview" value={preview} readOnly multiline rows={6} />
    </Stack>
  )
}
