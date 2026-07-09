const { useMemo } = React
const { ComboBox } = Fluent

const normalizeLookupName = (value) => String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase()

const normalizeOption = (value, index) => {
  if (value === undefined || value === null) return null
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value)
    return { key: text, text, raw: value }
  }
  if (typeof value !== "object") return null
  const key = String(value.code ?? value.id ?? value.key ?? value.value ?? value.display ?? value.label ?? index)
  const text = String(value.display ?? value.label ?? value.text ?? value.name ?? value.code ?? key)
  return { key, text, raw: value }
}

const optionSources = (sd, lookupType) => {
  const normalized = normalizeLookupName(lookupType)
  const optionLists = sd?.optionLists || {}
  const candidates = [
    sd?.lookups?.[lookupType],
    sd?.lookupValues?.[lookupType],
    sd?.[`${lookupType}Options`],
    sd?.[`${lookupType}s`],
    optionLists[lookupType],
    optionLists[lookupType?.toUpperCase?.()],
    optionLists[`MOIS-${lookupType?.toUpperCase?.()}`],
  ]
  if (normalized === "servicelocation") {
    candidates.push(sd?.serviceLocations, optionLists.SERVICELOCATION, optionLists.SERVICE_LOCATION, optionLists["MOIS-SERVICELOCATION"])
  }
  if (normalized === "jorg") {
    candidates.push(sd?.jorg, sd?.organizations, optionLists.JORG, optionLists["MOIS-JORG"])
  }
  return candidates.flatMap((candidate) => Array.isArray(candidate) ? candidate : [])
}

const valueForTarget = (raw, targetId, targetLabel, fallback) => {
  if (!raw || typeof raw !== "object") return fallback
  const normalizedLabel = normalizeLookupName(targetLabel)
  const directKeys = [targetId, targetId?.split("_").pop(), normalizedLabel]
  for (const key of directKeys) {
    if (key && raw[key] !== undefined && raw[key] !== null) return String(raw[key])
  }
  const aliasSets = [
    ["healthauthority", "authority"],
    ["healthservicedeliveryarea", "hsda"],
    ["branch"],
    ["responsibleservicedeliverylocation", "servicedeliverylocation", "sdl", "location"],
  ]
  const aliases = aliasSets.find((items) => items.some((item) => normalizedLabel.includes(item))) ?? []
  for (const alias of aliases) {
    const matchingKey = Object.keys(raw).find((key) => normalizeLookupName(key) === alias)
    if (matchingKey && raw[matchingKey] != null) return String(raw[matchingKey])
  }
  return fallback
}

/**
 * Dynamic Form lookups used source-specific service-location and organization
 * lists. This adapter accepts those lists from common MOIS source locations and
 * writes the selected record into the primary field plus any mapped targets.
 */
const LegacyLookupField = ({
  id,
  fieldId,
  label = "Lookup",
  lookupType = "",
  targetFieldIds = [],
  targetLabels = {},
  placeholder = "Select or enter a value",
  disabled = false,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const effectiveFieldId = fieldId || id || "legacyLookup"
  const value = fd?.field?.data?.[effectiveFieldId] ?? ""
  const options = useMemo(() => {
    const seen = new Set()
    return optionSources(sd, lookupType)
      .map(normalizeOption)
      .filter((option) => option && !seen.has(option.key) && seen.add(option.key))
  }, [lookupType, sd])

  const commit = (option, freeformValue) => {
    const fallback = String(option?.text ?? freeformValue ?? "")
    const raw = option?.raw
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const targets = Array.isArray(targetFieldIds) && targetFieldIds.length > 0 ? targetFieldIds : [effectiveFieldId]
      targets.forEach((targetId) => {
        if (!targetId) return
        draft.field.data[targetId] = valueForTarget(raw, targetId, targetLabels?.[targetId], fallback)
      })
    }))
  }

  return (
    <LayoutItem fieldId={effectiveFieldId} label={label} disabled={disabled}>
      <ComboBox
        text={String(value)}
        placeholder={placeholder}
        options={options}
        allowFreeform
        autoComplete="on"
        disabled={disabled}
        onChange={(_, option, __, freeformValue) => commit(option, freeformValue)}
      />
    </LayoutItem>
  )
}
