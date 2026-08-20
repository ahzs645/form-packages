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

const waitForAttachmentBatchDelay = (delayMs) => new Promise((resolve) => {
  setTimeout(resolve, Math.max(0, Number(delayMs) || 0))
})

const escapeAttachmentCsvCell = (value) => {
  const text = value == null ? "" : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
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
  attachToEncounter = true,
  enableBatchTest = false,
  batchDelayMs = 150,
  maxBatchTypes = 250,
  accept = "",
  maxFileSizeBytes = 10 * 1024 * 1024,
  showResponseBody = true,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const documentTypes = useCodeList(documentTypeSystem, sd)
  const fileInputRef = useRef(null)
  const cancelBatchRef = useRef(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [note, setNote] = useState(defaultNote)
  const [selectedDocumentTypeCode, setSelectedDocumentTypeCode] = useState(documentTypeCode)
  const [selectedBatchTypeCodes, setSelectedBatchTypeCodes] = useState([String(documentTypeCode)])
  const [batchConfirmed, setBatchConfirmed] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)
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
    const encounterId = firstPositiveId(
      sd?.formParams?.encounterId,
      sd?.webform?.encounterId,
      sd?.webform?.encounter?.encounterId,
    )
    const rawApiServer = String(auth?.apiServer || "").trim()
    const apiServer = rawApiServer && !rawApiServer.endsWith("/") ? `${rawApiServer}/` : rawApiServer
    const endpoint = apiServer && patientId != null && userProfileId != null
      ? `${apiServer}api/attachment/file/${encodeURIComponent(userProfileId)}/${encodeURIComponent(patientId)}/`
      : ""
    return {
      endpoint,
      patientId,
      encounterId,
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
  const availableDocumentTypes = useMemo(() => {
    const seen = new Set()
    const entries = (Array.isArray(normalizedDocumentTypes) ? normalizedDocumentTypes : [])
      .filter((entry) => entry?.code)
      .map((entry) => ({
        code: String(entry.code),
        display: String(entry.display || entry.code),
        system: String(entry.system || documentTypeSystem),
      }))
      .filter((entry) => {
        if (seen.has(entry.code)) return false
        seen.add(entry.code)
        return true
      })
    if (entries.length > 0) return entries
    return documentTypeCode
      ? [{ code: String(documentTypeCode), display: String(documentTypeDisplay || documentTypeCode), system: documentTypeSystem }]
      : []
  }, [documentTypeCode, documentTypeDisplay, documentTypeSystem, normalizedDocumentTypes])
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
  const selectedBatchDocumentTypes = useMemo(() => {
    const selected = new Set(selectedBatchTypeCodes.map(String))
    return availableDocumentTypes.filter((entry) => selected.has(entry.code))
  }, [availableDocumentTypes, selectedBatchTypeCodes])

  useEffect(() => {
    if (documentTypeOptions.length === 0) return
    const configuredOption = documentTypeOptions.find((option) => option.key === String(documentTypeCode))
    const fallbackCode = String(configuredOption?.key || documentTypeOptions[0].key)
    if (!documentTypeOptions.some((option) => option.key === String(selectedDocumentTypeCode))) {
      setSelectedDocumentTypeCode(fallbackCode)
    }
    const validCodes = new Set(documentTypeOptions.map((option) => String(option.key)))
    setSelectedBatchTypeCodes((current) => {
      const valid = current.map(String).filter((code) => validCodes.has(code))
      return valid.length > 0 ? valid : [fallbackCode]
    })
  }, [documentTypeCode, documentTypeOptions, selectedDocumentTypeCode])

  const inputId = `${id || resultFieldId || "chart-attachment-upload"}-file`
  const fileTooLarge = Boolean(
    selectedFile && Number(maxFileSizeBytes) > 0 && selectedFile.size > Number(maxFileSizeBytes)
  )
  const hasUploadRuntime = Boolean(selectedFile && runtime.endpoint && runtime.jwToken && !fileTooLarge)
  const canUpload = Boolean(hasUploadRuntime && selectedDocumentType && !busy)
  const batchLimit = Math.max(1, Number(maxBatchTypes) || 1)
  const allBatchDocumentTypes = availableDocumentTypes.slice(0, batchLimit)
  const canRunSelectedBatch = Boolean(
    enableBatchTest && hasUploadRuntime && batchConfirmed && selectedBatchDocumentTypes.length > 0 && !busy
  )
  const canRunAllBatch = Boolean(
    enableBatchTest && hasUploadRuntime && batchConfirmed && allBatchDocumentTypes.length > 0 && !busy
  )

  const recordResult = (nextResult) => {
    setResult(nextResult)
    persistChartAttachmentResult(setFormData, resultFieldId, nextResult)
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setBatchProgress(null)
    setBatchConfirmed(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadAttachmentForType = async (targetDocumentType, source = "chart-attachment-upload") => {
    const startedAt = Date.now()
    const document = {
      documentId: 0,
      patientId: Number(runtime.patientId),
      ...(attachToEncounter && runtime.encounterId != null
        ? { encounterId: Number(runtime.encounterId) }
        : {}),
      note: String(note || defaultNote || selectedFile.name),
      documentType: targetDocumentType,
    }

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
        source,
        ok: Boolean(response?.ok),
        status: response?.status ?? null,
        statusText: response?.statusText || "",
        contentType: response?.headers?.get ? response.headers.get("content-type") : null,
        body: responseBody,
        endpoint: runtime.endpoint,
        patientId: runtime.patientId,
        encounterId: attachToEncounter ? runtime.encounterId : null,
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
      return nextResult
    } catch (error) {
      return {
        source,
        ok: false,
        status: null,
        statusText: "",
        body: null,
        endpoint: runtime.endpoint,
        patientId: runtime.patientId,
        encounterId: attachToEncounter ? runtime.encounterId : null,
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
      }
    }
  }

  const uploadAttachment = async () => {
    if (!canUpload || !selectedFile || !selectedDocumentType) return
    setBusy(true)
    setBatchProgress(null)
    try {
      recordResult(await uploadAttachmentForType(selectedDocumentType))
    } finally {
      setBusy(false)
    }
  }

  const runAttachmentBatch = async (targetTypes, mode) => {
    if (!selectedFile || busy || !batchConfirmed || !hasUploadRuntime) return
    const limitedTypes = targetTypes.slice(0, batchLimit)
    if (limitedTypes.length === 0) return
    const startedAt = Date.now()
    const results = []
    cancelBatchRef.current = false
    setBusy(true)
    setBatchProgress({ mode, completed: 0, total: limitedTypes.length, succeeded: 0, failed: 0, currentCode: limitedTypes[0].code })
    try {
      for (let index = 0; index < limitedTypes.length; index += 1) {
        if (cancelBatchRef.current) break
        const targetType = limitedTypes[index]
        setBatchProgress((current) => ({ ...current, currentCode: targetType.code }))
        const entry = await uploadAttachmentForType(targetType, "chart-attachment-upload-batch-item")
        entry.batchIndex = index + 1
        results.push(entry)
        const succeeded = results.filter((item) => item.ok).length
        setBatchProgress({
          mode,
          completed: results.length,
          total: limitedTypes.length,
          succeeded,
          failed: results.length - succeeded,
          currentCode: index + 1 < limitedTypes.length ? limitedTypes[index + 1].code : "",
        })
        if (!cancelBatchRef.current && index + 1 < limitedTypes.length) {
          await waitForAttachmentBatchDelay(batchDelayMs)
        }
      }
      const succeeded = results.filter((item) => item.ok).length
      const cancelled = cancelBatchRef.current
      recordResult({
        source: "chart-attachment-upload-batch",
        ok: !cancelled && results.length === limitedTypes.length && succeeded === results.length,
        batchMode: mode,
        cancelled,
        requestedCount: limitedTypes.length,
        attemptedCount: results.length,
        succeededCount: succeeded,
        failedCount: results.length - succeeded,
        availableDocumentTypeCount: availableDocumentTypes.length,
        truncatedByMaxBatchTypes: targetTypes.length > limitedTypes.length,
        maxBatchTypes: batchLimit,
        delayMs: Number(batchDelayMs) || 0,
        endpoint: runtime.endpoint,
        patientId: runtime.patientId,
        encounterId: attachToEncounter ? runtime.encounterId : null,
        userProfileId: runtime.userProfileId,
        file: {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type || "application/octet-stream",
        },
        startedAt: new Date(startedAt).toISOString(),
        receivedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        results,
      })
    } finally {
      setBusy(false)
      cancelBatchRef.current = false
    }
  }

  const toggleBatchDocumentType = (_event, option) => {
    if (!option?.key) return
    const code = String(option.key)
    setSelectedBatchTypeCodes((current) => option.selected
      ? Array.from(new Set([...current.map(String), code]))
      : current.map(String).filter((entry) => entry !== code))
  }

  const downloadBatchResults = (format) => {
    if (!result || result.source !== "chart-attachment-upload-batch" || typeof window === "undefined") return
    const rows = Array.isArray(result.results) ? result.results : []
    const isCsv = format === "csv"
    const content = isCsv
      ? [
          ["index", "documentTypeCode", "documentTypeDisplay", "ok", "status", "documentId", "encounterId", "durationMs", "error"],
          ...rows.map((entry, index) => [
            entry.batchIndex || index + 1,
            entry.document?.documentType?.code,
            entry.document?.documentType?.display,
            entry.ok,
            entry.status,
            entry.body?.documentId,
            entry.body?.encounterId ?? entry.encounterId,
            entry.durationMs,
            entry.error,
          ]),
        ].map((row) => row.map(escapeAttachmentCsvCell).join(",")).join("\r\n")
      : JSON.stringify(result, null, 2)
    const BlobClass = window.Blob
    const urlApi = window.URL
    if (!BlobClass || !urlApi?.createObjectURL || !window.document?.createElement) return
    const url = urlApi.createObjectURL(new BlobClass([content], { type: isCsv ? "text/csv;charset=utf-8" : "application/json;charset=utf-8" }))
    const link = window.document.createElement("a")
    link.href = url
    link.download = `mois-attachment-batch-${Date.now()}.${isCsv ? "csv" : "json"}`
    link.click()
    setTimeout(() => urlApi.revokeObjectURL(url), 0)
  }

  const isBatchResult = result?.source === "chart-attachment-upload-batch"
  const statusLabel = !result
    ? "Not tested"
    : isBatchResult
      ? `Batch finished: ${result.succeededCount || 0} succeeded, ${result.failedCount || 0} failed${result.cancelled ? " (cancelled)" : ""}`
    : result.ok
      ? `Upload succeeded${result.status ? ` (${result.status})` : ""}`
      : result.status
        ? `Upload failed (${result.status})`
        : "Upload request failed"
  const statusColor = !result
    ? "#605e5c"
    : result.ok
      ? "#107c10"
      : isBatchResult && Number(result.succeededCount) > 0
        ? "#8a6d1d"
        : "#a4262c"
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
          Patient ID: {runtime.patientId ?? "Unavailable"} · Encounter ID: {attachToEncounter ? (runtime.encounterId ?? "Unavailable") : "Not requested"} · User profile ID: {runtime.userProfileId ?? "Unavailable"}
        </Fluent.Text>
        {attachToEncounter && runtime.encounterId == null ? (
          <Fluent.MessageBar messageBarType={Fluent.MessageBarType.warning}>
            This form was not opened with an encounter. The attachment can still be added to the chart, but it will not be encounter-linked.
          </Fluent.MessageBar>
        ) : null}
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
        {enableBatchTest ? (
          <div style={{ marginTop: 6, padding: 12, border: "1px solid #d2d0ce", background: "#ffffff" }}>
            <Fluent.Stack tokens={{ childrenGap: 9 }}>
              <Fluent.Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                Optional document-type batch test
              </Fluent.Text>
              <Fluent.MessageBar messageBarType={Fluent.MessageBarType.severeWarning}>
                Each attempted type creates a separate chart document immediately. Use only on a synthetic patient. “All types” will attempt {allBatchDocumentTypes.length}{availableDocumentTypes.length > batchLimit ? ` of ${availableDocumentTypes.length} (limited by maxBatchTypes)` : ""} uploads sequentially.
              </Fluent.MessageBar>
              <Fluent.Dropdown
                label="Document types for selected-subset test"
                multiSelect
                selectedKeys={selectedBatchTypeCodes}
                options={documentTypeOptions.length > 0
                  ? documentTypeOptions
                  : [{ key: documentTypeCode, text: documentTypeDisplay || documentTypeCode }]}
                disabled={busy}
                onChange={toggleBatchDocumentType}
              />
              <Fluent.Checkbox
                label="I confirm this is a synthetic test patient and understand that every attempt creates a chart document."
                checked={batchConfirmed}
                disabled={busy}
                onChange={(_event, checked) => setBatchConfirmed(Boolean(checked))}
              />
              <Fluent.Stack horizontal wrap tokens={{ childrenGap: 8 }}>
                <Fluent.DefaultButton
                  text={`Run selected subset (${selectedBatchDocumentTypes.length})`}
                  disabled={!canRunSelectedBatch}
                  onClick={() => runAttachmentBatch(selectedBatchDocumentTypes, "selected")}
                />
                <Fluent.DefaultButton
                  text={`Run all document types (${allBatchDocumentTypes.length})`}
                  disabled={!canRunAllBatch}
                  onClick={() => runAttachmentBatch(allBatchDocumentTypes, "all")}
                />
                <Fluent.DefaultButton
                  text="Cancel batch"
                  disabled={!busy || !batchProgress}
                  onClick={() => { cancelBatchRef.current = true }}
                />
              </Fluent.Stack>
              {batchProgress ? (
                <div role="status" aria-live="polite" style={{ fontSize: 12 }}>
                  Batch {batchProgress.completed}/{batchProgress.total} · {batchProgress.succeeded} succeeded · {batchProgress.failed} failed
                  {batchProgress.currentCode ? ` · Current: ${batchProgress.currentCode}` : ""}
                </div>
              ) : null}
            </Fluent.Stack>
          </div>
        ) : null}
        <div role="status" aria-live="polite" style={{ color: statusColor, fontWeight: 600 }}>
          {busy ? (batchProgress ? "Running attachment batch..." : "Uploading attachment...") : statusLabel}
          {result?.durationMs != null ? ` in ${result.durationMs} ms` : ""}
        </div>
        {result?.error ? <Fluent.Text styles={{ root: { color: "#a4262c" } }}>{result.error}</Fluent.Text> : null}
        {result?.diagnostic ? <Fluent.Text variant="small">{result.diagnostic}</Fluent.Text> : null}
        {isBatchResult && Array.isArray(result.results) ? (
          <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #edebe9" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 5 }}>#</th>
                  <th style={{ textAlign: "left", padding: 5 }}>Document type</th>
                  <th style={{ textAlign: "left", padding: 5 }}>Result</th>
                  <th style={{ textAlign: "left", padding: 5 }}>Document ID</th>
                  <th style={{ textAlign: "left", padding: 5 }}>Encounter</th>
                  <th style={{ textAlign: "left", padding: 5 }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((entry, index) => (
                  <tr key={`${entry.document?.documentType?.code || "type"}-${index}`} style={{ borderTop: "1px solid #edebe9" }}>
                    <td style={{ padding: 5 }}>{entry.batchIndex || index + 1}</td>
                    <td style={{ padding: 5 }}>{entry.document?.documentType?.display || entry.document?.documentType?.code || "Unknown"}</td>
                    <td style={{ padding: 5, color: entry.ok ? "#107c10" : "#a4262c" }}>{entry.ok ? `HTTP ${entry.status || "OK"}` : (entry.error || `HTTP ${entry.status || "failed"}`)}</td>
                    <td style={{ padding: 5 }}>{entry.body?.documentId ?? "—"}</td>
                    <td style={{ padding: 5 }}>{entry.body?.encounterId ?? entry.encounterId ?? "—"}</td>
                    <td style={{ padding: 5 }}>{entry.durationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {isBatchResult ? (
          <Fluent.Stack horizontal tokens={{ childrenGap: 8 }}>
            <Fluent.DefaultButton text="Download batch JSON" onClick={() => downloadBatchResults("json")} />
            <Fluent.DefaultButton text="Download batch CSV" onClick={() => downloadBatchResults("csv")} />
          </Fluent.Stack>
        ) : null}
        {showResponseBody && result ? (
          <pre style={{ margin: 0, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </Fluent.Stack>
    </div>
  )
}
