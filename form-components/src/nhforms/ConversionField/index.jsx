const { useCallback, useMemo, useRef } = React

const _conversionPathSegments = (path) =>
  String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)

const _readConversionPath = (root, path) => {
  const segments = _conversionPathSegments(path)
  if (!root || segments.length === 0) return undefined
  let current = root
  for (const segment of segments) {
    if (!current || typeof current !== "object") return undefined
    current = current[segment]
  }
  return current
}

const _readConversionValue = (fd, fieldId, valueRoot) => {
  if (valueRoot && typeof valueRoot === "object") {
    const pathValue = _readConversionPath(valueRoot, fieldId)
    if (pathValue !== undefined) return pathValue
  }
  return fd?.field?.data?.[fieldId] ?? fd?.formData?.[fieldId] ?? ""
}

const _sanitizeConversionNumber = (value, allowNegative) => {
  const text = String(value ?? "")
  let next = ""
  let hasDecimal = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char >= "0" && char <= "9") {
      next += char
      continue
    }
    if (char === "." && !hasDecimal) {
      next += char
      hasDecimal = true
      continue
    }
    if (char === "-" && allowNegative && next.length === 0) {
      next += char
    }
  }

  return next
}

const _asPositiveNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const _asPrecision = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(8, Math.floor(parsed)) : fallback
}

const _normalizeConversionRows = ({
  conversions,
  fromFieldId,
  toFieldId,
  fromUnit,
  toUnit,
  conversionFactor,
  precision,
}) => {
  const rows = Array.isArray(conversions) && conversions.length > 0
    ? conversions
    : [{
        fromFieldId,
        toFieldId,
        fromUnit,
        toUnit,
        factor: conversionFactor,
        precision,
      }]

  return rows
    .map((row, index) => {
      const source = row && typeof row === "object" ? row : {}
      const normalizedFromFieldId = String(source.fromFieldId || source.sourceFieldId || fromFieldId || `conversion_${index + 1}_from`).trim()
      const normalizedToFieldId = String(source.toFieldId || source.targetFieldId || toFieldId || `conversion_${index + 1}_to`).trim()
      if (!normalizedFromFieldId || !normalizedToFieldId || normalizedFromFieldId === normalizedToFieldId) return null

      return {
        fromFieldId: normalizedFromFieldId,
        toFieldId: normalizedToFieldId,
        fromUnit: String(source.fromUnit || source.sourceUnit || fromUnit || "from").trim(),
        toUnit: String(source.toUnit || source.targetUnit || toUnit || "to").trim(),
        factor: _asPositiveNumber(source.factor ?? source.conversionFactor ?? conversionFactor, 1),
        offset: Number.isFinite(Number(source.offset)) ? Number(source.offset) : 0,
        precision: _asPrecision(source.precision ?? precision, 1),
      }
    })
    .filter(Boolean)
}

function ConversionField({
  id = "conversionField",
  label = "Conversion",
  helperText = "",
  fromFieldId = "valueFrom",
  toFieldId = "valueTo",
  fromUnit = "from",
  toUnit = "to",
  conversionFactor = 1,
  precision = 1,
  conversions,
  clearText = "Clear",
  showClear = true,
  convertOnBlur = true,
  allowNegative = false,
  readOnly = false,
  required = false,
  valueRoot,
  onValueChange,
}) {
  const [fd, setFd] = useActiveData()
  const lastEditedRef = useRef(null)
  const rows = useMemo(
    () => _normalizeConversionRows({
      conversions,
      fromFieldId,
      toFieldId,
      fromUnit,
      toUnit,
      conversionFactor,
      precision,
    }),
    [conversionFactor, conversions, fromFieldId, fromUnit, precision, toFieldId, toUnit]
  )

  const setConversionValues = useCallback((updates) => {
    if (typeof onValueChange === "function") {
      Object.entries(updates).forEach(([fieldId, value]) => onValueChange(fieldId, value))
      return
    }
    setFd((draft) => {
      draft.field = draft.field || { data: {}, status: {}, history: [] }
      draft.field.data = draft.field.data || {}
      draft.formData = draft.formData || {}
      Object.assign(draft.field.data, updates)
      Object.assign(draft.formData, updates)
    })
  }, [onValueChange, setFd])

  const updateValue = useCallback((row, fieldId, oppositeFieldId, value) => {
    const nextValue = _sanitizeConversionNumber(value, allowNegative)
    lastEditedRef.current = { row, fieldId, value: nextValue }
    setConversionValues({
      [fieldId]: nextValue,
      [oppositeFieldId]: "",
    })
  }, [allowNegative, setConversionValues])

  const convertRow = useCallback((row) => {
    const lastEdited = lastEditedRef.current
    const sourceFieldId = lastEdited?.row === row && lastEdited?.fieldId ? lastEdited.fieldId : null
    const fromValue = _readConversionValue(fd, row.fromFieldId, valueRoot)
    const toValue = _readConversionValue(fd, row.toFieldId, valueRoot)
    const activeFrom = sourceFieldId === row.fromFieldId ? lastEdited.value : fromValue
    const activeTo = sourceFieldId === row.toFieldId ? lastEdited.value : toValue
    const parsedFrom = Number.parseFloat(activeFrom)
    const parsedTo = Number.parseFloat(activeTo)
    const canUseFrom = Number.isFinite(parsedFrom)
    const canUseTo = Number.isFinite(parsedTo)

    if (canUseFrom && (!canUseTo || sourceFieldId !== row.toFieldId)) {
      lastEditedRef.current = null
      setConversionValues({
        [row.fromFieldId]: parsedFrom.toFixed(row.precision),
        [row.toFieldId]: ((parsedFrom * row.factor) + row.offset).toFixed(row.precision),
      })
      return
    }

    if (canUseTo) {
      lastEditedRef.current = null
      setConversionValues({
        [row.toFieldId]: parsedTo.toFixed(row.precision),
        [row.fromFieldId]: ((parsedTo - row.offset) / row.factor).toFixed(row.precision),
      })
    }
  }, [fd, setConversionValues, valueRoot])

  const clearValues = useCallback(() => {
    lastEditedRef.current = null
    const updates = {}
    rows.forEach((row) => {
      updates[row.fromFieldId] = ""
      updates[row.toFieldId] = ""
    })
    setConversionValues(updates)
  }, [rows, setConversionValues])

  const hasAnyValue = rows.some((row) => _readConversionValue(fd, row.fromFieldId, valueRoot) || _readConversionValue(fd, row.toFieldId, valueRoot))

  if (!rows.length) {
    return (
      <div data-field-id={id} data-component="ConversionField" style={{ padding: 8, color: "#856404", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 4 }}>
        ConversionField needs at least one valid conversion row.
      </div>
    )
  }

  return (
    <div data-field-id={id} data-component="ConversionField" style={{ margin: "8px 0px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(120px, 160px) minmax(120px, 160px) auto", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 600 }}>
          <span id={`${id}Label`}>{label}{required ? " *" : ""}</span>
          {helperText ? <div style={{ fontWeight: 400, fontSize: 12, color: "#605e5c" }}>{helperText}</div> : null}
        </div>
        {rows.map((row) => {
          const fromValue = _readConversionValue(fd, row.fromFieldId, valueRoot)
          const toValue = _readConversionValue(fd, row.toFieldId, valueRoot)
          return (
            <React.Fragment key={`${row.fromFieldId}-${row.toFieldId}`}>
              <TextField
                id={row.fromFieldId}
                value={String(fromValue ?? "")}
                suffix={row.fromUnit}
                aria-labelledby={`${id}Label`}
                disabled={readOnly}
                onChange={(event, nextValue) => updateValue(row, row.fromFieldId, row.toFieldId, nextValue ?? event?.target?.value ?? "")}
                onBlur={() => convertOnBlur && convertRow(row)}
              />
              <TextField
                id={row.toFieldId}
                value={String(toValue ?? "")}
                suffix={row.toUnit}
                aria-labelledby={`${id}Label`}
                disabled={readOnly}
                onChange={(event, nextValue) => updateValue(row, row.toFieldId, row.fromFieldId, nextValue ?? event?.target?.value ?? "")}
                onBlur={() => convertOnBlur && convertRow(row)}
              />
              <div>
                {!convertOnBlur ? (
                  <DefaultButton
                    text="Convert"
                    disabled={readOnly}
                    onClick={() => convertRow(row)}
                  />
                ) : null}
              </div>
            </React.Fragment>
          )
        })}
        {showClear ? (
          <DefaultButton
            text={clearText}
            disabled={readOnly || !hasAnyValue}
            style={{ gridColumn: "2 / 4", justifySelf: "start" }}
            onClick={clearValues}
          />
        ) : null}
      </div>
    </div>
  )
}

const ConversionFieldSchema = {
  valueFrom: { type: "string" },
  valueTo: { type: "string" },
}
