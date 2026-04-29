const { useCallback, useMemo, useRef } = React

const _sanitizeDentalWeight = (value) => {
  const text = String(value ?? "")
  const numeric = text.replace(/[^0-9.]/g, "").replace(/(\.\d?).*$/, "$1")
  const parts = numeric.split(".")
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("").slice(0, 1)
  }
  return numeric
}

const _readDentalField = (fd, fieldId) => fd?.field?.data?.[fieldId] ?? fd?.formData?.[fieldId] ?? ""

const _positiveNumber = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function DentalWeightConverter({
  id = "dentalWeightConverter",
  label = "Child's Weight",
  helperText = "(automatically converted)",
  kgFieldId = "cWeightkg",
  lbFieldId = "cWeightlb",
  kgSuffix = "kg",
  lbSuffix = "lb",
  clearText = "Clear Weights",
  conversionFactor = 2.2,
  precision = 1,
}) {
  const [fd, setFd] = useActiveData()
  const lastEditedRef = useRef(null)
  const data = fd?.field?.data || {}
  const kgValue = _readDentalField(fd, kgFieldId)
  const lbValue = _readDentalField(fd, lbFieldId)

  const setDentalValues = useCallback((updates) => {
    setFd((draft) => {
      draft.field = draft.field || { data: {}, status: {} }
      draft.field.data = draft.field.data || {}
      draft.formData = draft.formData || {}
      Object.assign(draft.field.data, updates)
      Object.assign(draft.formData, updates)
    })
  }, [setFd])

  const updateWeight = useCallback((fieldId, oppositeFieldId, value) => {
    const nextValue = _sanitizeDentalWeight(value)
    lastEditedRef.current = { fieldId, value: nextValue }
    setDentalValues({
      [fieldId]: nextValue,
      [oppositeFieldId]: "",
    })
  }, [setDentalValues])

  const convertWeights = useCallback(() => {
    const fixedPrecision = Number.isFinite(Number(precision)) ? Number(precision) : 1
    const factor = _positiveNumber(conversionFactor) || 2.2
    const lastEdited = lastEditedRef.current
    const pounds = _positiveNumber(lastEdited?.fieldId === lbFieldId ? lastEdited.value : data[lbFieldId])
    const kilograms = _positiveNumber(lastEdited?.fieldId === kgFieldId ? lastEdited.value : data[kgFieldId])

    if (pounds != null) {
      lastEditedRef.current = null
      setDentalValues({
        [lbFieldId]: pounds.toFixed(fixedPrecision),
        [kgFieldId]: (pounds / factor).toFixed(fixedPrecision),
      })
      return
    }

    if (kilograms != null) {
      lastEditedRef.current = null
      setDentalValues({
        [kgFieldId]: kilograms.toFixed(fixedPrecision),
        [lbFieldId]: (kilograms * factor).toFixed(fixedPrecision),
      })
    }
  }, [conversionFactor, data, kgFieldId, lbFieldId, precision, setDentalValues])

  const clearWeights = useCallback(() => {
    lastEditedRef.current = null
    setDentalValues({
      [kgFieldId]: "",
      [lbFieldId]: "",
    })
  }, [kgFieldId, lbFieldId, setDentalValues])

  const disabled = useMemo(() => !kgValue && !lbValue, [kgValue, lbValue])

  const cellStyle = {
    breakInside: "avoid",
    margin: "0px 10px",
    flex: "2 2 0px",
    minWidth: 80,
    maxWidth: 160,
  }

  const fieldWrapperStyle = {
    display: "flex",
    flexFlow: "column",
    minWidth: 80,
  }

  return (
    <div data-field-id={id} data-component="DentalWeightConverter" style={{ margin: "8px 0px" }}>
      <div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div style={{ ...cellStyle, gridArea: "1 / 1 / 2 / 2" }}>
            <div style={fieldWrapperStyle}>
              <div style={{ flex: "2 1 0%", display: "flex", flexFlow: "wrap", minWidth: 80 }}>
                <span
                  id={`${id}Label`}
                  style={{
                    fontWeight: 600,
                    display: "inline-flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  {label}
                  <br />
                  {helperText}
                </span>
              </div>
            </div>
            <div style={{ clear: "both" }} />
          </div>

          <div style={{ ...cellStyle, gridArea: "1 / 2 / 2 / 3" }}>
            <div style={fieldWrapperStyle}>
              <div style={{ flex: "2 1 0%", display: "flex", flexFlow: "wrap", minWidth: 80 }}>
                <TextField
                  id={kgFieldId}
                  value={String(kgValue ?? "")}
                  suffix={kgSuffix}
                  aria-labelledby={`${id}Label`}
                  onChange={(event, nextValue) => updateWeight(kgFieldId, lbFieldId, nextValue ?? event?.target?.value ?? "")}
                  onBlur={convertWeights}
                />
              </div>
            </div>
            <div style={{ clear: "both" }} />
          </div>

          <div style={{ ...cellStyle, gridArea: "2 / 2 / 3 / 3" }}>
            <div style={fieldWrapperStyle}>
              <div style={{ flex: "2 1 0%", display: "flex", flexFlow: "wrap", minWidth: 80 }}>
                <TextField
                  id={lbFieldId}
                  value={String(lbValue ?? "")}
                  suffix={lbSuffix}
                  aria-labelledby={`${id}Label`}
                  onChange={(event, nextValue) => updateWeight(lbFieldId, kgFieldId, nextValue ?? event?.target?.value ?? "")}
                  onBlur={convertWeights}
                />
              </div>
            </div>
            <div style={{ clear: "both" }} />
          </div>

          <DefaultButton
            text={clearText}
            disabled={disabled}
            style={{ gridArea: "1 / 3 / 2 / 4", alignSelf: "center" }}
            onClick={clearWeights}
          />
        </div>
      </div>
    </div>
  )
}

const DentalWeightConverterSchema = {
  cWeightkg: { type: "string" },
  cWeightlb: { type: "string" },
}
