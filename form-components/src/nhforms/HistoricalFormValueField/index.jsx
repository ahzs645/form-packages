const { useEffect, useMemo } = React
const { TextField } = Fluent

const asText = (value) => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (typeof value === "object") return String(value.display ?? value.text ?? value.value ?? value.code ?? "")
  return ""
}

const resolveHistoryRows = (sd) => {
  const roots = [
    sd?.webformHistory,
    sd?.historicalForms,
    sd?.patient?.webforms,
    sd?.patient?.forms,
    sd?.patient?.dformHistory,
    sd?.queryResult?.patient?.[0]?.webforms,
    sd?.queryResult?.patient?.[0]?.forms,
  ]
  return roots.flatMap((value) => Array.isArray(value) ? value : [])
}

const fieldValueFromRow = (row, legacyFieldId) => {
  if (!row || typeof row !== "object" || !legacyFieldId) return ""
  const candidates = [row, row.formData, row.data, row.field?.data, row.values]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue
    if (Object.prototype.hasOwnProperty.call(candidate, legacyFieldId)) {
      return asText(candidate[legacyFieldId])
    }
    const matchingKey = Object.keys(candidate).find((key) =>
      key.endsWith(`_${legacyFieldId}`) || key.endsWith(`_field_${legacyFieldId}`)
    )
    if (matchingKey) return asText(candidate[matchingKey])
  }
  return ""
}

const rowDate = (row) => {
  const raw = row?.docDate ?? row?.documentDate ?? row?.createdDate ?? row?.createdAt ?? row?.updatedAt
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

/**
 * Mirrors the latest value of a legacy Dynamic Form field when MOIS exposes
 * prior webform/DForm rows in the source query. It is intentionally read-only:
 * legacy `viewonly=dform` tags never created a new chart write.
 */
const HistoricalFormValueField = ({
  id,
  fieldId,
  label = "Prior form value",
  legacyFieldId = "",
  placeholder = "No prior value",
  readOnly = true,
  disabled = false,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const effectiveFieldId = fieldId || id || "historicalFormValue"
  const value = useMemo(() => {
    const rows = resolveHistoryRows(sd)
      .map((row) => ({ row, value: fieldValueFromRow(row, legacyFieldId) }))
      .filter((entry) => entry.value)
      .sort((left, right) => rowDate(right.row) - rowDate(left.row))
    return rows[0]?.value ?? ""
  }, [legacyFieldId, sd])
  const stored = fd?.field?.data?.[effectiveFieldId]

  useEffect(() => {
    if (!value || stored === value || typeof setFormData !== "function") return
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[effectiveFieldId] = value
    }))
  }, [effectiveFieldId, setFormData, stored, value])

  return (
    <LayoutItem fieldId={effectiveFieldId} label={label} disabled={disabled}>
      <TextField
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
      />
    </LayoutItem>
  )
}
