// Read-only source inspection. Capability metadata is supplied by the builder's
// shared registry and serialized in the export, not inferred from local arrays.
const PatientContextDiagnostics = ({
  title = "Patient Context Diagnostics",
  engineVersion = "",
  capabilities = [],
  sampleLimit = 3,
}) => {
  const sd = useSourceData()
  const direct = sd?.patient
  const queried = sd?.queryResult?.patient?.[0]
  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  const patient = isRecord(direct) ? direct : isRecord(queried) ? queried : null
  const source = patient === direct ? "patient" : "queryResult.patient[0]"
  const [filter, setFilter] = React.useState("")
  const limit = Number.isFinite(Number(sampleLimit)) ? Math.max(1, Math.min(10, Math.floor(Number(sampleLimit)))) : 3
  const labels = { "read-write": "Read + write", "read-only": "Read only", "not-queried": "Not queried by default" }
  const registry = new Map((Array.isArray(capabilities) ? capabilities : [])
    .filter((entry) => entry && typeof entry.collection === "string")
    .map((entry) => [entry.collection, entry]))
  const collections = [...new Set([
    ...registry.keys(),
    ...Object.keys(patient || {}).filter((key) => Array.isArray(patient[key])),
  ])].sort()
  const textValue = (value) => {
    if (value == null) return "—"
    if (isRecord(value)) return String(value.text ?? value.display ?? value.code ?? "—")
    return typeof value === "string" || typeof value === "number" ? String(value) : "—"
  }
  // Bound depth, keys, strings, and array entries before serialization; charts
  // can contain large attachment payloads and occasionally circular objects.
  const sampleText = (record) => {
    const seen = new WeakSet()
    const compact = (value, depth = 0) => {
      if (typeof value === "string") return value.length > 300 ? value.slice(0, 300) + "… [truncated]" : value
      if (typeof value === "bigint") return String(value)
      if (value === null || typeof value !== "object") return value
      if (seen.has(value)) return "[circular reference]"
      if (depth >= 3) return "[nested content omitted]"
      seen.add(value)
      if (Array.isArray(value)) return value.slice(0, 5).map((entry) => compact(entry, depth + 1))
      return Object.fromEntries(Object.keys(value).slice(0, 15).map((key) => [key, compact(value[key], depth + 1)]))
    }
    try { return JSON.stringify(compact(record), null, 2) ?? "null" }
    catch { return "Sample could not be displayed." }
  }
  const cellStyle = { padding: "10px 12px", textAlign: "left", verticalAlign: "top", borderBottom: "1px solid #cbd5e1" }
  const visible = collections.filter((key) => key.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <section aria-label={title} style={{ padding: 16, color: "#172033", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8 }}>
      <h2 style={{ margin: "0 0 8px" }}>{title}</h2>
      {patient ? (
        <p><strong>{textValue(patient.name)}</strong> · Chart {textValue(patient.chartNumber)} · Patient ID {textValue(patient.patientId)}<br />Source: <code>{source}</code></p>
      ) : <p role="status">No active patient context. Select a patient with Use Active, then open Preview.</p>}
      <p>API capability snapshot{engineVersion ? ` · MOIS engine ${engineVersion}` : " unavailable"}. Read only means no write adapter is mapped. Live write evidence applies only to the named operations and tested payloads. Access labels do not establish your current user's permissions. This panel does not write to the chart.</p>
      <p>Unavailable means no collection was supplied; empty means an array with zero records. Imported records can appear locally even when MOIS does not query them.</p>
      <label style={{ display: "block", marginBottom: 12 }}>Filter collections{" "}
        <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="e.g. observations" style={{ padding: 6, maxWidth: "100%" }} />
      </label>
      <p>{visible.length} of {collections.length} collection types · Samples show up to {limit} records with long or nested content shortened.</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <caption style={{ textAlign: "left", fontWeight: 600, paddingBottom: 8 }}>Active patient collection diagnostics</caption>
          <thead><tr>{["Collection", "MOIS API access", "Availability", "Count", "Sample records"].map((label) => <th key={label} scope="col" style={cellStyle}>{label}</th>)}</tr></thead>
          <tbody>{visible.map((key) => {
            const value = patient?.[key]
            const isArray = Array.isArray(value)
            const availability = value == null ? "Unavailable" : !isArray ? "Invalid: expected array" : value.length ? "Available" : "Empty"
            const capability = registry.get(key)
            return <tr key={`${textValue(patient?.patientId)}:${key}`} data-collection={key}>
              <th scope="row" style={cellStyle}><code>{key}</code></th>
              <td style={cellStyle}>{labels[capability?.access] || "Unclassified"}{capability?.liveReadVerified ? <div>Live read verified</div> : null}{capability?.liveVerifiedWriteFields?.length ? <div>Live write/read-back reported: {capability.liveVerifiedWriteFields.join(", ")}</div> : capability?.discoveredMutationFields?.length ? <div>Write API discovered · execution unverified</div> : null}{capability?.note ? <details><summary>Access details</summary><p>{capability.note}</p></details> : null}</td>
              <td style={cellStyle}>{availability}</td>
              <td style={cellStyle}>{isArray ? value.length : "—"}</td>
              <td style={cellStyle}>{isArray && value.length > 0 ? <details><summary>Show samples</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: 520, maxHeight: 320, overflow: "auto" }}>{value.slice(0, limit).map(sampleText).join("\n\n")}</pre></details> : "—"}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
      {visible.length === 0 ? <p role="status">No matching collections.</p> : null}
    </section>
  )
}
