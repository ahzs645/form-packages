/**
 * PdfRegenerator
 *
 * Runtime-only client-side button that regenerates an AcroForm PDF from
 * current form data. This component is self-contained JSX and does not rely
 * on host-side MOIS-native helper components.
 */

const { useMemo, useState, useCallback } = React
const { Stack, Text, DefaultButton } = Fluent

const PDF_LIB_URL = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js"
let _pdfLibPromise = null

const _isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0

const _decodePdfHex = (value) => {
  if (!_isNonEmptyString(value)) return ""
  const withoutSlash = value.startsWith("/") ? value.slice(1) : value
  return withoutSlash.replace(/#([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

const _normalizeToken = (value) => _decodePdfHex(String(value || "")).trim().toLowerCase()

const _resolveValueByPath = (root, path) => {
  if (!root || !_isNonEmptyString(path)) return undefined
  const segments = path.split(".").map((segment) => segment.trim()).filter(Boolean)
  let current = root
  for (const segment of segments) {
    if (!current || typeof current !== "object") return undefined
    current = current[segment]
  }
  return current
}

const _toText = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    const parts = value.map(_toText).filter(Boolean)
    return parts.length ? parts.join(", ") : null
  }
  if (typeof value === "object") {
    if (typeof value.dataUrl === "string") return null

    const maybeDate = _toText(value.date)
    const maybeTime = _toText(value.time)
    if (maybeDate || maybeTime) {
      return [maybeDate, maybeTime].filter(Boolean).join(" ")
    }

    const selectedCount = value.selectedCount
    if (typeof selectedCount === "number" && Number.isFinite(selectedCount)) {
      return String(selectedCount)
    }

    const candidateKeys = ["display", "text", "label", "value", "code", "key", "id", "name"]
    for (const key of candidateKeys) {
      const candidate = _toText(value[key])
      if (candidate) return candidate
    }
  }
  return null
}

const _toBooleanLike = (value) => {
  if (typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return undefined
    if (["true", "t", "yes", "y", "on", "1", "checked"].includes(normalized)) return true
    if (["false", "f", "no", "n", "off", "0", "unchecked"].includes(normalized)) return false
    return undefined
  }
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === "object") {
    if (typeof value.isEmpty === "boolean") return !value.isEmpty
    if (typeof value.checked === "boolean") return value.checked
    if (typeof value.selectedCount === "number" && Number.isFinite(value.selectedCount)) {
      return value.selectedCount > 0
    }
    return _toBooleanLike(value.value ?? value.code ?? value.key ?? value.text ?? value.display)
  }
  return undefined
}

const _collectCandidates = (value, out) => {
  const text = _toText(value)
  if (text) out.add(text)

  if (Array.isArray(value)) {
    value.forEach((item) => _collectCandidates(item, out))
    return
  }
  if (!value || typeof value !== "object") return

  const candidateKeys = ["code", "key", "value", "text", "display", "label", "id", "name"]
  candidateKeys.forEach((key) => {
    const maybe = _toText(value[key])
    if (maybe) out.add(maybe)
  })

  if (Array.isArray(value.selectedIds)) {
    value.selectedIds.forEach((item) => _collectCandidates(item, out))
  }
  if (Array.isArray(value.selectedLabels)) {
    value.selectedLabels.forEach((item) => _collectCandidates(item, out))
  }
}

const _toCandidateList = (value) => {
  const set = new Set()
  _collectCandidates(value, set)
  return Array.from(set)
}

const _matchSingleOption = (rawValue, options) => {
  if (!Array.isArray(options) || options.length === 0) return null

  const normalizedOptionMap = new Map()
  options.forEach((option) => {
    normalizedOptionMap.set(_normalizeToken(option), option)
  })

  const candidates = _toCandidateList(rawValue)

  for (const candidate of candidates) {
    const direct = normalizedOptionMap.get(_normalizeToken(candidate))
    if (direct) return direct
  }

  for (const candidate of candidates) {
    const normalizedCandidate = _normalizeToken(candidate)
    const fuzzy = options.find((option) => {
      const normalizedOption = _normalizeToken(option)
      return normalizedOption.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedOption)
    })
    if (fuzzy) return fuzzy
  }

  return null
}

const _matchMultipleOptions = (rawValue, options) => {
  if (!Array.isArray(rawValue)) {
    const single = _matchSingleOption(rawValue, options)
    return single ? [single] : []
  }

  const selected = new Set()
  rawValue.forEach((item) => {
    const match = _matchSingleOption(item, options)
    if (match) selected.add(match)
  })
  return Array.from(selected)
}

const _normalizeFieldMap = (fieldMap, formData) => {
  const mapped = new Map()
  if (!fieldMap || typeof fieldMap !== "object") return mapped

  const formKeys = new Set(Object.keys(formData || {}))

  Object.entries(fieldMap).forEach(([leftRaw, rightRaw]) => {
    const left = String(leftRaw || "").trim()
    const right = String(rightRaw || "").trim()
    if (!left || !right) return

    const leftIsFormId = formKeys.has(left)
    const rightIsFormId = formKeys.has(right)

    if (leftIsFormId && !rightIsFormId) {
      mapped.set(right, left)
      return
    }
    if (rightIsFormId && !leftIsFormId) {
      mapped.set(left, right)
      return
    }

    // Default assumption for ambiguous mappings: formId -> pdfFieldName
    mapped.set(right, left)
  })

  return mapped
}

const _base64ToBytes = (value) => {
  const trimmed = String(value || "").trim()
  const payload = trimmed.includes("base64,") ? trimmed.slice(trimmed.indexOf("base64,") + 7) : trimmed
  const clean = payload.replace(/\s+/g, "")
  if (!clean) {
    throw new Error("Source PDF payload is empty")
  }

  if (typeof atob === "function") {
    const binary = atob(clean)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  throw new Error("Base64 decode is unavailable in this runtime")
}

const _downloadBytes = (bytes, fileName) => {
  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const _loadPdfLib = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("PDF regeneration is only available in browser runtime."))
  }

  if (window.PDFLib) {
    return Promise.resolve(window.PDFLib)
  }

  if (_pdfLibPromise) {
    return _pdfLibPromise
  }

  _pdfLibPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-pdf-lib=\"${PDF_LIB_URL}\"]`)
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.PDFLib) resolve(window.PDFLib)
        else reject(new Error("pdf-lib script loaded but global object was not found."))
      })
      existing.addEventListener("error", () => reject(new Error("Failed to load pdf-lib script.")))
      return
    }

    const script = document.createElement("script")
    script.src = PDF_LIB_URL
    script.async = true
    script.dataset.pdfLib = PDF_LIB_URL
    script.onload = () => {
      if (window.PDFLib) resolve(window.PDFLib)
      else reject(new Error("pdf-lib script loaded but global object was not found."))
    }
    script.onerror = () => reject(new Error("Failed to load pdf-lib script."))
    document.head.appendChild(script)
  })

  return _pdfLibPromise
}

const _getCheckboxOnStates = (field) => {
  const states = new Set()
  const acro = field?.acroField
  const widgets = acro?.getWidgets?.() || []
  widgets.forEach((widget) => {
    const onValue = widget?.getOnValue?.()
    const state = onValue?.toString ? _decodePdfHex(onValue.toString()) : null
    if (!state || _normalizeToken(state) === "off") return
    states.add(state)
  })
  return Array.from(states)
}

const _setCheckboxByState = (field, requestedState, PDFLib) => {
  const acro = field?.acroField
  const widgets = acro?.getWidgets?.() || []
  if (!acro || widgets.length === 0) return false

  const normalizedRequested = _normalizeToken(requestedState)
  let targetStateName = null

  for (const widget of widgets) {
    const onValue = widget?.getOnValue?.()
    const onText = onValue?.toString ? _decodePdfHex(onValue.toString()) : null
    if (!onText) continue
    if (_normalizeToken(onText) !== normalizedRequested) continue
    targetStateName = onValue instanceof PDFLib.PDFName ? onValue : PDFLib.PDFName.of(onText)
    break
  }

  if (!targetStateName) {
    targetStateName = PDFLib.PDFName.of(requestedState)
  }

  try {
    acro.setValue?.(targetStateName)
  } catch (error) {
    return false
  }

  const offState = PDFLib.PDFName.of("Off")
  widgets.forEach((widget) => {
    if (!widget?.setAppearanceState) return
    const onValue = widget?.getOnValue?.()
    const onText = onValue?.toString ? _decodePdfHex(onValue.toString()) : null
    const isOn = onText && _normalizeToken(onText) === normalizedRequested
    widget.setAppearanceState(isOn && onValue ? onValue : offState)
  })

  return true
}

const _fillField = (field, rawValue, sourceFieldId, warnings, PDFLib) => {
  try {
    if (field instanceof PDFLib.PDFTextField) {
      const text = _toText(rawValue)
      if (!text) return false
      field.setText(text)
      return true
    }

    if (field instanceof PDFLib.PDFRadioGroup) {
      const options = field.getOptions() || []
      const match = _matchSingleOption(rawValue, options)
      if (!match) {
        warnings.push(`Field \"${field.getName()}\" (${sourceFieldId}): no matching radio option.`)
        return false
      }
      field.select(match)
      return true
    }

    if (field instanceof PDFLib.PDFDropdown) {
      const options = field.getOptions() || []
      const match = _matchSingleOption(rawValue, options)
      if (!match) {
        warnings.push(`Field \"${field.getName()}\" (${sourceFieldId}): no matching dropdown option.`)
        return false
      }
      field.select(match)
      return true
    }

    if (field instanceof PDFLib.PDFOptionList) {
      const options = field.getOptions() || []
      const matches = _matchMultipleOptions(rawValue, options)
      if (!matches.length) {
        warnings.push(`Field \"${field.getName()}\" (${sourceFieldId}): no matching list option.`)
        return false
      }
      field.select(matches)
      return true
    }

    if (field instanceof PDFLib.PDFCheckBox) {
      const states = _getCheckboxOnStates(field)
      if (states.length > 0) {
        const match = _matchSingleOption(rawValue, states)
        if (match && _setCheckboxByState(field, match, PDFLib)) {
          return true
        }
      }

      const boolValue = _toBooleanLike(rawValue)
      if (boolValue === undefined) {
        warnings.push(`Field \"${field.getName()}\" (${sourceFieldId}): value is not boolean-like.`)
        return false
      }
      if (boolValue) field.check()
      else field.uncheck()
      return true
    }

    return false
  } catch (error) {
    warnings.push(`Field \"${field.getName()}\" (${sourceFieldId}): ${error?.message || "failed"}`)
    return false
  }
}

const _statusColor = (kind) => {
  if (kind === "success") return "#107c10"
  if (kind === "error") return "#a4262c"
  return "#605e5c"
}

const PdfRegenerator = ({
  label,
  buttonText = "Download Filled PDF",
  fileName = "filled-form.pdf",
  iconName = "Print",
  sourcePdfBase64,
  sourcePdfPath = "sessionPdf.base64",
  sourcePdfFieldId,
  fieldMap,
  includeOnlyFieldIds,
  flatten = false,
  disabled = false,
  showStatus = false,
  showDiagnostics = false,
  onComplete,
}) => {
  const [fd] = useActiveData()
  const sd = useSourceData()
  const [isBusy, setIsBusy] = useState(false)
  const [status, setStatus] = useState(null)

  const resolvedPdfSource = useMemo(() => {
    if (_isNonEmptyString(sourcePdfBase64)) {
      return sourcePdfBase64.trim()
    }

    const sourceId = _isNonEmptyString(sourcePdfFieldId) ? sourcePdfFieldId.trim() : ""
    if (sourceId) {
      const fromData = fd?.field?.data?.[sourceId]
      if (_isNonEmptyString(fromData)) return fromData.trim()
    }

    const fromPath = _isNonEmptyString(sourcePdfPath)
      ? _resolveValueByPath(sd, sourcePdfPath.trim())
      : null
    if (_isNonEmptyString(fromPath)) {
      return fromPath.trim()
    }

    return null
  }, [sourcePdfBase64, sourcePdfFieldId, sourcePdfPath, fd, sd])

  const handleGeneratePdf = useCallback(async () => {
    if (!_isNonEmptyString(resolvedPdfSource)) {
      setStatus({ kind: "error", message: "No source PDF found." })
      return
    }

    setIsBusy(true)
    setStatus({ kind: "info", message: "Generating PDF..." })

    try {
      const PDFLib = await _loadPdfLib()
      const bytes = _base64ToBytes(resolvedPdfSource)
      const formData = fd?.field?.data || {}
      const map = _normalizeFieldMap(fieldMap, formData)
      const includeSet = Array.isArray(includeOnlyFieldIds)
        ? new Set(includeOnlyFieldIds.map((id) => String(id || "").trim()).filter(Boolean))
        : null

      const doc = await PDFLib.PDFDocument.load(bytes, {
        throwOnInvalidObject: false,
        ignoreEncryption: true,
      })

      const form = doc.getForm()
      const warnings = []
      let filledFieldCount = 0
      let skippedFieldCount = 0

      form.getFields().forEach((field) => {
        const pdfFieldName = field.getName()
        const sourceFieldId = map.get(pdfFieldName) || pdfFieldName

        if (includeSet && !includeSet.has(sourceFieldId) && !includeSet.has(pdfFieldName)) {
          skippedFieldCount += 1
          return
        }

        const rawValue = formData[sourceFieldId]
        if (rawValue === undefined || rawValue === null || rawValue === "") {
          skippedFieldCount += 1
          return
        }

        const didFill = _fillField(field, rawValue, sourceFieldId, warnings, PDFLib)
        if (didFill) filledFieldCount += 1
        else skippedFieldCount += 1
      })

      if (flatten) {
        form.flatten()
      }

      const outputBytes = await doc.save()
      const nextFileName = _isNonEmptyString(fileName) ? fileName.trim() : "filled-form.pdf"
      _downloadBytes(outputBytes, nextFileName)

      const warningCount = warnings.length
      setStatus({
        kind: "success",
        message: `PDF generated. Filled ${filledFieldCount} field${filledFieldCount === 1 ? "" : "s"}${warningCount ? ` with ${warningCount} warning${warningCount === 1 ? "" : "s"}` : ""}.`,
        warnings,
      })

      if (typeof onComplete === "function") {
        onComplete({
          pdfBytes: outputBytes,
          filledFieldCount,
          skippedFieldCount,
          warnings,
        })
      }
    } catch (error) {
      setStatus({
        kind: "error",
        message: `Failed to generate PDF: ${error?.message || "unknown error"}`,
      })
    } finally {
      setIsBusy(false)
    }
  }, [resolvedPdfSource, fd, fieldMap, includeOnlyFieldIds, flatten, fileName, onComplete])

  const diagnosticsText = useMemo(() => {
    if (!showDiagnostics) return null
    if (!_isNonEmptyString(resolvedPdfSource)) return "Waiting for source PDF data."
    return "Source PDF detected."
  }, [showDiagnostics, resolvedPdfSource])

  const renderButton = (
    <DefaultButton
      text={isBusy ? "Generating..." : buttonText}
      iconProps={iconName ? { iconName } : undefined}
      onClick={handleGeneratePdf}
      disabled={disabled || isBusy || !_isNonEmptyString(resolvedPdfSource)}
    />
  )

  if (!label && !showStatus && !showDiagnostics) {
    return renderButton
  }

  return (
    <Stack tokens={{ childrenGap: 6 }}>
      {label ? (
        <Text variant="smallPlus" styles={{ root: { fontWeight: 600 } }}>
          {label}
        </Text>
      ) : null}

      {renderButton}

      {diagnosticsText ? (
        <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
          {diagnosticsText}
        </Text>
      ) : null}

      {showStatus && status ? (
        <Text variant="small" styles={{ root: { color: _statusColor(status.kind) } }}>
          {status.message}
        </Text>
      ) : null}

      {showStatus && Array.isArray(status?.warnings) && status.warnings.length > 0 ? (
        <Stack tokens={{ childrenGap: 2 }}>
          {status.warnings.slice(0, 3).map((warning, index) => (
            <Text key={`${index}-${warning}`} variant="small" styles={{ root: { color: "#8a8886" } }}>
              {warning}
            </Text>
          ))}
          {status.warnings.length > 3 ? (
            <Text variant="small" styles={{ root: { color: "#8a8886" } }}>
              +{status.warnings.length - 3} more warning{status.warnings.length - 3 === 1 ? "" : "s"}
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  )
}
