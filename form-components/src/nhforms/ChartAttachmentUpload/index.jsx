const { useEffect, useMemo, useRef, useState } = React

const firstPositiveId = (...values) => {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

const readChartAttachmentResponse = async (response) => {
  if (!response || typeof response.text !== "function") return null
  let text = ""
  try {
    text = await response.text()
  } catch (_error) {
    return null
  }
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (_error) {
    return text.length > 20000 ? `${text.slice(0, 20000)}...[truncated]` : text
  }
}

const persistChartAttachmentResult = (setFormData, fieldId, result) => {
  if (!fieldId || typeof setFormData !== "function") return
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    draft.field.data[fieldId] = result
    if (draft.formData && typeof draft.formData === "object") draft.formData[fieldId] = result
  }))
}

const formatChartAttachmentBytes = (value) => {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * ChartAttachmentUpload — exported MOIS attachment API diagnostic.
 *
 * The file is uploaded immediately to the current patient's chart when the
 * user presses Upload. File contents are never stored in webform state; only
 * request/response metadata is persisted under resultFieldId.
 */
const ChartAttachmentUpload = ({
  id,
  resultFieldId = "chartAttachmentUploadResult",
  title = "MOIS chart attachment upload test",
  description = "Choose a small, non-sensitive test file. Upload immediately creates a separate document on the current patient's chart; it is not embedded in this webform.",
  buttonText = "Upload test attachment",
  documentTypeCode = "NOTE",
  documentTypeDisplay = "Note / General Purpose Document",
  documentTypeSystem = "MOIS-DOCUMENTTYPE",
  defaultNote = "Uploaded from Webforms attachment API test",
  accept = "",
  maxFileSizeBytes = 10 * 1024 * 1024,
  showResponseBody = true,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const documentTypes = useCodeList(documentTypeSystem, sd)
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [note, setNote] = useState(defaultNote)
  const [selectedDocumentTypeCode, setSelectedDocumentTypeCode] = useState(documentTypeCode)
  const [busy, setBusy] = useState(false)
  const storedResult = resultFieldId ? fd?.field?.data?.[resultFieldId] : null
  const [result, setResult] = useState(() => storedResult || null)

  const runtime = useMemo(() => {
    const appSettings = typeof sd?.useAppSettings === "function" ? sd.useAppSettings() : null
    const auth = sd?.auth || appSettings?.auth || {}
    const userProfile = sd?.userProfile || appSettings?.userProfile || {}
    const patientId = firstPositiveId(
      sd?.formParams?.patientId,
      sd?.patientId,
      sd?.patient?.patientId,
      sd?.webform?.patientId,
    )
    const userProfileId = firstPositiveId(userProfile?.userProfileId, userProfile?.id)
    const rawApiServer = String(auth?.apiServer || "").trim()
    const apiServer = rawApiServer && !rawApiServer.endsWith("/") ? `${rawApiServer}/` : rawApiServer
    const endpoint = apiServer && patientId != null && userProfileId != null
      ? `${apiServer}api/attachment/file/${encodeURIComponent(userProfileId)}/${encodeURIComponent(patientId)}/`
      : ""
    return {
      endpoint,
      patientId,
      userProfileId,
      jwToken: auth?.jwToken || "",
    }
  }, [sd])

  const normalizedDocumentTypes = useMemo(() => {
    if (Array.isArray(documentTypes)) return documentTypes
    if (!documentTypes || typeof documentTypes !== "object") return []
    return Object.entries(documentTypes).map(([code, value]) => {
      if (value && typeof value === "object") {
        return {
          code: value.code || code,
          display: value.display || value.text || value.code || code,
          system: value.system || documentTypeSystem,
        }
      }
      return { code, display: String(value || code), system: documentTypeSystem }
    })
  }, [documentTypeSystem, documentTypes])
  const documentTypeOptions = useMemo(() => (
    Array.isArray(normalizedDocumentTypes)
      ? normalizedDocumentTypes
        .filter((entry) => entry?.code)
        .map((entry) => ({ key: String(entry.code), text: String(entry.display || entry.code) }))
      : []
  ), [normalizedDocumentTypes])
  const selectedDocumentType = useMemo(() => {
    const liveEntry = Array.isArray(normalizedDocumentTypes)
      ? normalizedDocumentTypes.find((entry) => String(entry?.code) === String(selectedDocumentTypeCode))
      : null
    if (liveEntry) {
      return {
        code: String(liveEntry.code),
        display: String(liveEntry.display || liveEntry.code),
        system: String(liveEntry.system || documentTypeSystem),
      }
    }
    if (documentTypeOptions.length > 0) return null
    return selectedDocumentTypeCode
      ? { code: String(selectedDocumentTypeCode), display: String(documentTypeDisplay || selectedDocumentTypeCode), system: documentTypeSystem }
      : null
  }, [documentTypeDisplay, documentTypeOptions.length, documentTypeSystem, normalizedDocumentTypes, selectedDocumentTypeCode])

  useEffect(() => {
    if (documentTypeOptions.length === 0) return
    if (documentTypeOptions.some((option) => option.key === String(selectedDocumentTypeCode))) return
    const configuredOption = documentTypeOptions.find((option) => option.key === String(documentTypeCode))
    setSelectedDocumentTypeCode(String(configuredOption?.key || documentTypeOptions[0].key))
  }, [documentTypeCode, documentTypeOptions, selectedDocumentTypeCode])

  const inputId = `${id || resultFieldId || "chart-attachment-upload"}-file`
  const fileTooLarge = Boolean(
    selectedFile && Number(maxFileSizeBytes) > 0 && selectedFile.size > Number(maxFileSizeBytes)
  )
  const canUpload = Boolean(
    selectedFile && selectedDocumentType && runtime.endpoint && runtime.jwToken && !fileTooLarge && !busy
  )

  const recordResult = (nextResult) => {
    setResult(nextResult)
    persistChartAttachmentResult(setFormData, resultFieldId, nextResult)
  }

  const clearSelection = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadAttachment = async () => {
    if (!canUpload || !selectedFile) return
    const startedAt = Date.now()
    const document = {
      documentId: 0,
      patientId: Number(runtime.patientId),
      note: String(note || defaultNote || selectedFile.name),
      documentType: selectedDocumentType,
    }

    setBusy(true)
    try {
      const fetchAttachment = typeof window !== "undefined" && typeof window.fetch === "function"
        ? window.fetch.bind(window)
        : null
      const FormDataClass = typeof window !== "undefined" ? window.FormData : null
      if (!fetchAttachment || !FormDataClass) {
        throw new Error("Browser fetch/FormData is not available in this MOIS runtime.")
      }

      const body = new FormDataClass()
      body.append("file", selectedFile)
      body.set("document", JSON.stringify(document))
      const response = await fetchAttachment(runtime.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${runtime.jwToken}` },
        body,
      })
      const responseBody = await readChartAttachmentResponse(response)
      const nextResult = {
        source: "chart-attachment-upload",
        ok: Boolean(response?.ok),
        status: response?.status ?? null,
        statusText: response?.statusText || "",
        contentType: response?.headers?.get ? response.headers.get("content-type") : null,
        body: responseBody,
        endpoint: runtime.endpoint,
        patientId: runtime.patientId,
        userProfileId: runtime.userProfileId,
        file: {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type || "application/octet-stream",
        },
        document,
        receivedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      }
      if (!response?.ok) nextResult.error = `HTTP ${response?.status || "error"}${response?.statusText ? `: ${response.statusText}` : ""}`
      recordResult(nextResult)
    } catch (error) {
      recordResult({
        source: "chart-attachment-upload",
        ok: false,
        status: null,
        statusText: "",
        body: null,
        endpoint: runtime.endpoint,
        patientId: runtime.patientId,
        userProfileId: runtime.userProfileId,
        file: selectedFile ? {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type || "application/octet-stream",
        } : null,
        document,
        error: error?.message || String(error),
        diagnostic: "No HTTP response was readable. Check MOIS endpoint access, authorization, and runtime network policy.",
        receivedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      })
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = !result
    ? "Not tested"
    : result.ok
      ? `Upload succeeded${result.status ? ` (${result.status})` : ""}`
      : result.status
        ? `Upload failed (${result.status})`
        : "Upload request failed"
  const statusColor = !result ? "#605e5c" : result.ok ? "#107c10" : "#a4262c"
  const missingRuntime = []
  if (runtime.patientId == null) missingRuntime.push("patient ID")
  if (runtime.userProfileId == null) missingRuntime.push("user profile ID")
  if (!runtime.endpoint) missingRuntime.push("MOIS API server")
  if (!runtime.jwToken) missingRuntime.push("authorization token")

  return (
    <div
      data-chart-attachment-upload={id || resultFieldId}
      style={{ border: "1px solid #d2d0ce", padding: 14, background: "#faf9f8" }}
    >
      <Fluent.Stack tokens={{ childrenGap: 10 }}>
        <Fluent.Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>{title}</Fluent.Text>
        <Fluent.MessageBar messageBarType={Fluent.MessageBarType.warning}>
          {description}
        </Fluent.MessageBar>
        <Fluent.Text variant="small">
          Patient ID: {runtime.patientId ?? "Unavailable"} · User profile ID: {runtime.userProfileId ?? "Unavailable"}
        </Fluent.Text>
        <Fluent.Text variant="small" styles={{ root: { color: "#605e5c", wordBreak: "break-all" } }}>
          Endpoint: {runtime.endpoint || "Unavailable"}
        </Fluent.Text>
        {missingRuntime.length > 0 ? (
          <Fluent.MessageBar messageBarType={Fluent.MessageBarType.error}>
            Cannot upload because the runtime did not provide: {missingRuntime.join(", ")}.
          </Fluent.MessageBar>
        ) : null}
        <div>
          <label htmlFor={inputId} style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
            Test file
          </label>
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept={accept || undefined}
            disabled={busy}
            onChange={(event) => setSelectedFile(event?.target?.files?.[0] || null)}
          />
        </div>
        {selectedFile ? (
          <Fluent.Text variant="small">
            Selected: {selectedFile.name} ({formatChartAttachmentBytes(selectedFile.size)}, {selectedFile.type || "unknown type"})
          </Fluent.Text>
        ) : null}
        {fileTooLarge ? (
          <Fluent.MessageBar messageBarType={Fluent.MessageBarType.error}>
            The selected file exceeds this test form's {formatChartAttachmentBytes(maxFileSizeBytes)} safety limit.
          </Fluent.MessageBar>
        ) : null}
        <Fluent.TextField
          label="Chart document note"
          value={note}
          disabled={busy}
          onChange={(_event, value) => setNote(value || "")}
        />
        <Fluent.Dropdown
          label="Chart document type"
          selectedKey={selectedDocumentTypeCode || undefined}
          options={documentTypeOptions.length > 0
            ? documentTypeOptions
            : [{ key: documentTypeCode, text: documentTypeDisplay || documentTypeCode }]}
          disabled={busy}
          onChange={(_event, option) => setSelectedDocumentTypeCode(option?.key ? String(option.key) : "")}
        />
        <Fluent.Text variant="small" styles={{ root: { color: "#605e5c" } }}>
          Document types are loaded from {documentTypeSystem} when the target MOIS server provides that list.
        </Fluent.Text>
        <Fluent.Stack horizontal tokens={{ childrenGap: 8 }}>
          <Fluent.PrimaryButton
            text={busy ? "Uploading..." : buttonText}
            disabled={!canUpload}
            onClick={uploadAttachment}
          />
          <Fluent.DefaultButton
            text="Clear selection"
            disabled={!selectedFile || busy}
            onClick={clearSelection}
          />
        </Fluent.Stack>
        <div role="status" aria-live="polite" style={{ color: statusColor, fontWeight: 600 }}>
          {busy ? "Uploading attachment..." : statusLabel}
          {result?.durationMs != null ? ` in ${result.durationMs} ms` : ""}
        </div>
        {result?.error ? <Fluent.Text styles={{ root: { color: "#a4262c" } }}>{result.error}</Fluent.Text> : null}
        {result?.diagnostic ? <Fluent.Text variant="small">{result.diagnostic}</Fluent.Text> : null}
        {showResponseBody && result ? (
          <pre style={{ margin: 0, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </Fluent.Stack>
    </div>
  )
}
