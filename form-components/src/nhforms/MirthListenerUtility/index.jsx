const { useMemo, useState } = React

// Names are prefixed mirthUtility* because several component sources can be
// concatenated into one exported form bundle; top-level identifiers must not
// collide with HttpJsonTestPanel's helpers.
const MIRTH_UTILITY_DEFAULT_SITES = [
  { id: "test-ip", label: "Test server — 10.171.20.220", url: "http://10.171.20.220:7900/webforms/" },
  { id: "mirthc", label: "mirthc.northernhealth.ca", url: "http://mirthc.northernhealth.ca:7900/webforms/" },
  { id: "mirthc1", label: "mirthc1.northernhealth.ca", url: "http://mirthc1.northernhealth.ca:7900/webforms/" },
]

const MIRTH_UTILITY_SEND_METHODS = [
  { id: "fetch", label: "fetch (CORS) — reads the listener response", contentType: "application/json" },
  { id: "fetch-no-cors", label: "fetch (no-cors) — fire and forget, response is opaque", contentType: "text/plain" },
  { id: "xhr", label: "XMLHttpRequest — reads the listener response", contentType: "application/json" },
  { id: "beacon", label: "navigator.sendBeacon — queued by the browser, no response", contentType: "text/plain" },
]

const MIRTH_UTILITY_PAYLOAD_MODES = [
  { id: "ping", label: "Connectivity ping (synthetic, no identifiers)" },
  { id: "notification", label: "Mirth notification sample (schemaVersion 2)" },
]

const mirthUtilityNormalizeUrl = (value) => {
  const trimmed = String(value || "").trim()
  if (!trimmed) return ""
  try {
    const url = new URL(trimmed)
    if (url.pathname === "/webforms") url.pathname = "/webforms/"
    return url.toString()
  } catch (_error) {
    return trimmed.replace(/\/webforms$/i, "/webforms/")
  }
}

const mirthUtilityFormatBody = (value) => {
  if (value == null || value === "") return "No response body"
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch (_error) {
    return String(value)
  }
}

const mirthUtilityParseBody = (text) => {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (_error) {
    return text.length > 20000 ? `${text.slice(0, 20000)}...[truncated]` : text
  }
}

const mirthUtilityPersistResult = (setFormData, fieldId, result) => {
  if (!fieldId || typeof setFormData !== "function") return
  setFormData(produce((draft) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    draft.field.data[fieldId] = result
    if (draft.formData && typeof draft.formData === "object") draft.formData[fieldId] = result
  }))
}

const mirthUtilityBuildTemplate = (mode, eventName, sd) => {
  const form = {
    path: sd?.formParams?.formPath,
    name: sd?.formObject?.Identity?.name || sd?.formParams?.formPath,
  }
  if (mode === "notification") {
    // Mirrors samples/listener-event.json from the Mirth export package: a
    // blind saved-record ping — instance identifiers only, no answers, no PHN.
    return {
      schemaVersion: 2,
      event: eventName || "webform-submit",
      eventId: "utility-test-webform-12345-revision-1",
      source: "webforms-mirth-listener-utility",
      sentAt: "(stamped at send time)",
      chartId: 700001,
      definitionId: 101,
      webformId: 12345,
      documentId: 54321,
      revisionId: "2030-01-02 03:04:05",
    }
  }
  return {
    event: eventName || "webform-connectivity-test",
    source: "webforms-mirth-listener-utility",
    test: true,
    sentAt: "(stamped at send time)",
    form,
  }
}

const mirthUtilitySelectStyle = {
  width: "100%",
  padding: "5px 6px",
  border: "1px solid #8a8886",
  borderRadius: 2,
  background: "#fff",
  fontSize: 13,
  fontFamily: "inherit",
}

/**
 * MirthListenerUtility — developer utility for the Mirth webforms HTTP
 * listener. Lets the tester pick the site (test IP, mirthc, mirthc1, or a
 * custom URL), preview and edit the exact JSON that will be posted, choose how
 * it is sent (fetch CORS, fetch no-cors, XMLHttpRequest, sendBeacon), and
 * sign & send it. The signed stamp and sentAt are applied at send time.
 */
const MirthListenerUtility = ({
  id,
  title = "Mirth listener utility",
  sites = MIRTH_UTILITY_DEFAULT_SITES,
  defaultSiteId = "mirthc1",
  eventName = "webform-connectivity-test",
  requestTimeoutMs = 15000,
  responseFieldId = "mirthUtilityLastResult",
  signButtonText = "Sign & Send",
  includeSignedStamp = true,
  showResponseBody = true,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const siteList = Array.isArray(sites) && sites.length > 0 ? sites : MIRTH_UTILITY_DEFAULT_SITES
  const initialSiteId = siteList.some((site) => site.id === defaultSiteId) ? defaultSiteId : siteList[0].id
  const [siteId, setSiteId] = useState(initialSiteId)
  const [customUrl, setCustomUrl] = useState("")
  const [sendMethod, setSendMethod] = useState("fetch")
  const [payloadMode, setPayloadMode] = useState("ping")
  const [payloadText, setPayloadText] = useState(() =>
    JSON.stringify(mirthUtilityBuildTemplate("ping", eventName, sd), null, 2)
  )
  const [busy, setBusy] = useState(false)
  const storedResult = responseFieldId ? fd?.field?.data?.[responseFieldId] : null
  const [result, setResult] = useState(() => storedResult || null)

  const selectedSite = siteList.find((site) => site.id === siteId)
  const targetUrl = useMemo(
    () => mirthUtilityNormalizeUrl(siteId === "custom" ? customUrl : selectedSite?.url),
    [siteId, customUrl, selectedSite]
  )
  const methodInfo = MIRTH_UTILITY_SEND_METHODS.find((method) => method.id === sendMethod)
    || MIRTH_UTILITY_SEND_METHODS[0]

  const payloadIssue = useMemo(() => {
    try {
      JSON.parse(payloadText)
      return ""
    } catch (error) {
      return `Payload is not valid JSON: ${error?.message || error}`
    }
  }, [payloadText])

  const resetPayload = (mode) => {
    setPayloadMode(mode)
    setPayloadText(JSON.stringify(mirthUtilityBuildTemplate(mode, eventName, sd), null, 2))
  }

  const stampPayload = () => {
    const parsed = JSON.parse(payloadText)
    const stamped = typeof parsed === "object" && parsed !== null ? parsed : { value: parsed }
    stamped.sentAt = new Date().toISOString()
    if (includeSignedStamp) {
      stamped.signed = {
        by: sd?.userProfile?.identity?.fullName || sd?.userProfile?.loginName || "unknown",
        at: stamped.sentAt,
      }
    }
    return JSON.stringify(stamped)
  }

  const finishSend = (nextResult) => {
    setResult(nextResult)
    mirthUtilityPersistResult(setFormData, responseFieldId, nextResult)
  }

  const signAndSend = async () => {
    if (!targetUrl || busy || payloadIssue) return
    const startedAt = Date.now()
    const timeoutMs = Math.max(1000, Number(requestTimeoutMs) || 15000)
    const baseResult = {
      source: "mirth-listener-utility",
      outputId: id || "mirth-listener-utility",
      endpointUrl: targetUrl,
      method: "POST",
      sendMethod: methodInfo.id,
      responseFieldId: responseFieldId || undefined,
    }
    setBusy(true)
    try {
      const body = stampPayload()
      if (methodInfo.id === "beacon") {
        const canBeacon = typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
        if (!canBeacon) throw new Error("navigator.sendBeacon is not available in this MOIS runtime.")
        const queued = navigator.sendBeacon(targetUrl, new Blob([body], { type: methodInfo.contentType }))
        finishSend({
          ...baseResult,
          ok: queued,
          status: null,
          statusText: queued ? "Queued by the browser" : "The browser refused to queue the beacon",
          body: null,
          error: queued ? undefined : "sendBeacon returned false",
          diagnostic: "sendBeacon never exposes the listener response; confirm receipt in the Mirth dashboard.",
          receivedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        })
        return
      }
      if (methodInfo.id === "xhr") {
        const xhrResult = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open("POST", targetUrl, true)
          xhr.timeout = timeoutMs
          xhr.setRequestHeader("Content-Type", methodInfo.contentType)
          xhr.onload = () => resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            statusText: xhr.statusText || "",
            contentType: xhr.getResponseHeader ? xhr.getResponseHeader("content-type") : null,
            body: mirthUtilityParseBody(xhr.responseText),
          })
          xhr.ontimeout = () => reject(new Error(`Request timed out after ${timeoutMs} ms`))
          xhr.onerror = () => reject(new Error("Network error (no HTTP response was readable)"))
          xhr.send(body)
        })
        finishSend({
          ...baseResult,
          ...xhrResult,
          error: xhrResult.ok ? undefined : `HTTP ${xhrResult.status || "error"}`,
          receivedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        })
        return
      }
      const fetchJson = typeof window !== "undefined" && typeof window.fetch === "function"
        ? window.fetch.bind(window)
        : null
      if (!fetchJson) throw new Error("Browser fetch is not available in this MOIS runtime.")
      const AbortControllerClass = typeof window.AbortController === "function" ? window.AbortController : null
      const controller = AbortControllerClass ? new AbortControllerClass() : null
      const timeout = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null
      try {
        const response = await fetchJson(targetUrl, {
          method: "POST",
          headers: { "Content-Type": methodInfo.contentType },
          body,
          ...(methodInfo.id === "fetch-no-cors" ? { mode: "no-cors" } : {}),
          ...(controller ? { signal: controller.signal } : {}),
        })
        if (methodInfo.id === "fetch-no-cors") {
          finishSend({
            ...baseResult,
            ok: true,
            status: null,
            statusText: "Sent (opaque no-cors response)",
            body: null,
            diagnostic: "no-cors hides the listener response and status; confirm receipt in the Mirth dashboard.",
            receivedAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
          })
          return
        }
        let text = ""
        try {
          text = await response.text()
        } catch (_error) {
          text = ""
        }
        finishSend({
          ...baseResult,
          ok: Boolean(response?.ok),
          status: response?.status ?? null,
          statusText: response?.statusText || "",
          contentType: response?.headers?.get ? response.headers.get("content-type") : null,
          body: mirthUtilityParseBody(text),
          error: response?.ok ? undefined : `HTTP ${response?.status || "error"}`,
          receivedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        })
      } finally {
        if (timeout) window.clearTimeout(timeout)
      }
    } catch (error) {
      const aborted = error?.name === "AbortError"
      finishSend({
        ...baseResult,
        ok: false,
        status: null,
        statusText: "",
        body: null,
        error: aborted
          ? `Request timed out after ${timeoutMs} ms`
          : (error?.message || String(error)),
        diagnostic: "No HTTP response was readable. Check network access, mixed-content policy, and Mirth CORS OPTIONS handling; fetch (no-cors) or sendBeacon can bypass CORS reads.",
        receivedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      })
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = !result
    ? "Not sent"
    : result.ok
      ? `Success${result.status ? ` (${result.status})` : ""}${result.statusText && !result.status ? ` — ${result.statusText}` : ""}`
      : result.status
        ? `Failed (${result.status})`
        : "Connection failed"
  const statusColor = !result ? "#605e5c" : result.ok ? "#107c10" : "#a4262c"
  const responseText = useMemo(() => mirthUtilityFormatBody(result?.body), [result?.body])

  return (
    <div
      data-mirth-listener-utility={id || "mirth-listener-utility"}
      style={{ border: "1px solid #d2d0ce", padding: 12, background: "#faf9f8" }}
    >
      <Fluent.Stack tokens={{ childrenGap: 10 }}>
        <Fluent.Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>{title}</Fluent.Text>

        <div>
          <Fluent.Label>Site</Fluent.Label>
          <select
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            style={mirthUtilitySelectStyle}
            aria-label="Mirth listener site"
          >
            {siteList.map((site) => (
              <option key={site.id} value={site.id}>{`${site.label} — ${site.url}`}</option>
            ))}
            <option value="custom">Custom URL...</option>
          </select>
          {siteId === "custom" ? (
            <div style={{ marginTop: 6 }}>
              <Fluent.TextField
                value={customUrl}
                onChange={(_event, value) => setCustomUrl(value || "")}
                placeholder="http://mirthc1.northernhealth.ca:7900/webforms/"
                ariaLabel="Custom listener URL"
              />
            </div>
          ) : null}
          <Fluent.Text variant="small" styles={{ root: { color: "#605e5c", wordBreak: "break-all" } }}>
            {targetUrl || "No listener URL configured"}
          </Fluent.Text>
        </div>

        <div>
          <Fluent.Label>Send method</Fluent.Label>
          <select
            value={sendMethod}
            onChange={(event) => setSendMethod(event.target.value)}
            style={mirthUtilitySelectStyle}
            aria-label="Send method"
          >
            {MIRTH_UTILITY_SEND_METHODS.map((method) => (
              <option key={method.id} value={method.id}>{method.label}</option>
            ))}
          </select>
        </div>

        <div>
          <Fluent.Label>Payload</Fluent.Label>
          <select
            value={payloadMode}
            onChange={(event) => resetPayload(event.target.value)}
            style={mirthUtilitySelectStyle}
            aria-label="Payload template"
          >
            {MIRTH_UTILITY_PAYLOAD_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>{mode.label}</option>
            ))}
          </select>
          <textarea
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            rows={10}
            spellCheck={false}
            aria-label="JSON payload preview"
            style={{
              width: "100%",
              marginTop: 6,
              padding: 6,
              border: `1px solid ${payloadIssue ? "#a4262c" : "#8a8886"}`,
              borderRadius: 2,
              fontFamily: "Consolas, Menlo, monospace",
              fontSize: 12,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          {payloadIssue ? (
            <Fluent.Text variant="small" styles={{ root: { color: "#a4262c" } }}>{payloadIssue}</Fluent.Text>
          ) : (
            <Fluent.Text variant="small" styles={{ root: { color: "#605e5c" } }}>
              {`POST ${targetUrl || "(no URL)"} as ${methodInfo.contentType}. sentAt${includeSignedStamp ? " and the signed stamp are" : " is"} applied when you press ${signButtonText}.`}
            </Fluent.Text>
          )}
          <div style={{ marginTop: 4 }}>
            <Fluent.DefaultButton text="Reset payload" onClick={() => resetPayload(payloadMode)} disabled={busy} />
          </div>
        </div>

        <div role="status" aria-live="polite" style={{ color: statusColor, fontWeight: 600 }}>
          {busy ? "Sending..." : statusLabel}
          {result?.durationMs != null && !busy ? ` in ${result.durationMs} ms` : ""}
        </div>
        {result?.error ? <Fluent.Text styles={{ root: { color: "#a4262c" } }}>{result.error}</Fluent.Text> : null}
        {result?.diagnostic ? <Fluent.Text variant="small">{result.diagnostic}</Fluent.Text> : null}
        {showResponseBody && result ? (
          <pre style={{ margin: 0, maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11 }}>
            {responseText}
          </pre>
        ) : null}

        <Fluent.PrimaryButton
          text={busy ? "Sending..." : signButtonText}
          onClick={signAndSend}
          disabled={busy || !targetUrl || Boolean(payloadIssue)}
        />
      </Fluent.Stack>
    </div>
  )
}
