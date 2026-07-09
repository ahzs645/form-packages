const { useEffect, useMemo, useState } = React

const HTTP_JSON_RESULT_EVENT = "builder:http-json-result"

const readHttpJsonTestBody = async (response) => {
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

const formatHttpJsonTestResult = (value) => {
  if (value == null || value === "") return "No response body"
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch (_error) {
    return String(value)
  }
}

const persistHttpJsonTestResult = (setFormData, fieldId, result) => {
  if (!fieldId || typeof setFormData !== "function") return
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    draft.field.data[fieldId] = result
    if (draft.formData && typeof draft.formData === "object") draft.formData[fieldId] = result
  }))
}

const publishHttpJsonTestResult = (result) => {
  if (typeof window === "undefined") return
  const key = result?.outputId || "http-json"
  const previous = window.__builderHttpJsonResults && typeof window.__builderHttpJsonResults === "object"
    ? window.__builderHttpJsonResults
    : {}
  window.__builderHttpJsonResults = Object.assign({}, previous, { [key]: result })
  if (typeof window.CustomEvent === "function") {
    window.dispatchEvent(new window.CustomEvent(HTTP_JSON_RESULT_EVENT, { detail: result }))
  }
}

/**
 * HttpJsonTestPanel — exported MOIS diagnostics for HTTP JSON/Mirth outputs.
 *
 * The manual request is deliberately synthetic and contains no patient or form
 * answers. The panel also listens for the generated submit/sign workflow result
 * so a real listener response or browser error is visible after the action.
 */
const HttpJsonTestPanel = ({
  id,
  title = "Mirth HTTP listener test",
  endpointUrl = "http://10.171.20.220:7900/webforms",
  outputId = "",
  responseFieldId = "mirthLastResult",
  buttonText = "Send test request",
  eventName = "webform-connectivity-test",
  requestTimeoutMs = 15000,
  showManualTest = true,
  showResponseBody = true,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const effectiveOutputId = outputId || id || "http-json-test"
  const storedResult = responseFieldId ? fd?.field?.data?.[responseFieldId] : null
  const [result, setResult] = useState(() => storedResult || null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!storedResult || storedResult === result) return
    setResult(storedResult)
  }, [storedResult, result])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const handler = (event) => {
      const nextResult = event?.detail
      if (!nextResult || typeof nextResult !== "object") return
      if (outputId && nextResult.outputId !== outputId) return
      setResult(nextResult)
      persistHttpJsonTestResult(setFormData, responseFieldId, nextResult)
    }
    window.addEventListener(HTTP_JSON_RESULT_EVENT, handler)
    return () => window.removeEventListener(HTTP_JSON_RESULT_EVENT, handler)
  }, [outputId, responseFieldId, setFormData])

  const responseText = useMemo(() => formatHttpJsonTestResult(result?.body), [result?.body])

  const sendTest = async () => {
    if (!endpointUrl || busy) return
    const startedAt = Date.now()
    const AbortControllerClass = typeof window !== "undefined" && typeof window.AbortController === "function"
      ? window.AbortController
      : null
    const controller = AbortControllerClass ? new AbortControllerClass() : null
    const timeout = controller
      ? window.setTimeout(() => controller.abort(), Math.max(1000, Number(requestTimeoutMs) || 15000))
      : null
    setBusy(true)
    try {
      const fetchJson = typeof window !== "undefined" && typeof window.fetch === "function"
        ? window.fetch.bind(window)
        : null
      if (!fetchJson) throw new Error("Browser fetch is not available in this MOIS runtime.")
      const requestBody = {
        event: eventName || "webform-connectivity-test",
        source: "webforms-http-test-panel",
        test: true,
        sentAt: new Date().toISOString(),
        outputId: effectiveOutputId,
        form: {
          path: sd?.formParams?.formPath,
          name: sd?.formObject?.Identity?.name || sd?.formParams?.formPath,
        },
      }
      const response = await fetchJson(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        ...(controller ? { signal: controller.signal } : {}),
      })
      const body = await readHttpJsonTestBody(response)
      const nextResult = {
        source: "manual-test",
        outputId: effectiveOutputId,
        endpointUrl,
        method: "POST",
        ok: Boolean(response?.ok),
        status: response?.status ?? null,
        statusText: response?.statusText || "",
        contentType: response?.headers?.get ? response.headers.get("content-type") : null,
        body,
        receivedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        responseFieldId: responseFieldId || undefined,
      }
      if (!response?.ok) nextResult.error = `HTTP ${response?.status || "error"}`
      setResult(nextResult)
      persistHttpJsonTestResult(setFormData, responseFieldId, nextResult)
      publishHttpJsonTestResult(nextResult)
    } catch (error) {
      const aborted = error?.name === "AbortError"
      const nextResult = {
        source: "manual-test",
        outputId: effectiveOutputId,
        endpointUrl,
        method: "POST",
        ok: false,
        status: null,
        statusText: "",
        body: null,
        error: aborted
          ? `Request timed out after ${Math.max(1000, Number(requestTimeoutMs) || 15000)} ms`
          : (error?.message || String(error)),
        diagnostic: "No HTTP response was readable. Check network access, mixed-content policy, and Mirth CORS OPTIONS handling.",
        receivedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        responseFieldId: responseFieldId || undefined,
      }
      setResult(nextResult)
      persistHttpJsonTestResult(setFormData, responseFieldId, nextResult)
      publishHttpJsonTestResult(nextResult)
    } finally {
      if (timeout) window.clearTimeout(timeout)
      setBusy(false)
    }
  }

  const statusLabel = !result
    ? "Not tested"
    : result.ok
      ? `Success${result.status ? ` (${result.status})` : ""}`
      : result.status
        ? `Failed (${result.status})`
        : "Connection failed"
  const statusColor = !result ? "#605e5c" : result.ok ? "#107c10" : "#a4262c"

  return (
    <div
      data-http-json-test-panel={effectiveOutputId}
      style={{ border: "1px solid #d2d0ce", padding: 12, background: "#faf9f8" }}
    >
      <Fluent.Stack tokens={{ childrenGap: 8 }}>
        <Fluent.Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>{title}</Fluent.Text>
        <Fluent.Text variant="small" styles={{ root: { color: "#605e5c", wordBreak: "break-all" } }}>
          {endpointUrl || "No listener URL configured"}
        </Fluent.Text>
        <div role="status" aria-live="polite" style={{ color: statusColor, fontWeight: 600 }}>
          {busy ? "Sending test request..." : statusLabel}
          {result?.durationMs != null ? ` in ${result.durationMs} ms` : ""}
        </div>
        {result?.error ? <Fluent.Text styles={{ root: { color: "#a4262c" } }}>{result.error}</Fluent.Text> : null}
        {result?.diagnostic ? <Fluent.Text variant="small">{result.diagnostic}</Fluent.Text> : null}
        {showResponseBody && result ? (
          <pre style={{ margin: 0, maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11 }}>
            {responseText}
          </pre>
        ) : null}
        {showManualTest ? (
          <Fluent.DefaultButton
            text={busy ? "Sending..." : buttonText}
            onClick={sendTest}
            disabled={busy || !endpointUrl}
          />
        ) : null}
      </Fluent.Stack>
    </div>
  )
}
