// MOIS 2.30.31 evidence: main.a75cc6b1.chunk.js queryGraphQL export accepts
// (operationName, jwToken, apiServer, query, variables, statusSetter,
//  resultCallback, errorDispatch, { formParams }) and returns data or null.
// Use that host transport; never invent an endpoint or expose credentials.
const PatientContextQueryTest = ({ collections = [] }) => {
  const sd = useSourceData()
  const patient = sd?.patient ?? sd?.queryResult?.patient?.[0]
  const patientId = Number(patient?.patientId ?? sd?.formParams?.patientId)
  const settings = typeof sd?.useAppSettings === "function" ? sd.useAppSettings() : null
  const auth = sd?.auth || settings?.auth || {}
  const hostQuery = typeof queryGraphQL === "function" ? queryGraphQL : null
  const ready = Boolean(hostQuery && auth.jwToken && auth.apiServer && Number.isInteger(patientId) && patientId > 0)
  const [state, setState] = React.useState({ patientId, busy: false, message: "No live checks run yet.", rows: [], hasRun: false, schemaFields: [] })
  const epoch = React.useRef(0)
  const busy = React.useRef(false)
  React.useEffect(() => {
    epoch.current += 1
    busy.current = false
    setState({ patientId, busy: false, message: "No live checks run yet.", rows: [], hasRun: false, schemaFields: [] })
    return () => { epoch.current += 1; busy.current = false }
  }, [patientId, auth.jwToken, auth.apiServer])
  const current = state.patientId === patientId ? state : { busy: false, message: "No live checks run yet.", rows: [] }
  const validName = (value) => typeof value === "string" && /^[_A-Za-z][_0-9A-Za-z]*$/.test(value)
  const namedType = (type) => {
    let item = type
    for (let depth = 0; item?.ofType && depth < 10; depth += 1) item = item.ofType
    return item
  }
  const isList = (type) => type?.kind === "LIST" || (type?.kind === "NON_NULL" && type.ofType?.kind === "LIST")
  const requiredArgs = (field) => (field?.args || []).some((arg) => arg.type?.kind === "NON_NULL" && arg.defaultValue == null)
  const typeRef = "kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } }"
  const schemaQuery = `query InspectPatientContextType($name: String!) { __type(name: $name) { name fields { name args { name defaultValue type { ${typeRef} } } type { ${typeRef} } } } }`
  const readableError = (value) => String(value || "Unknown query error").split(String(auth.jwToken || "\u0000")).join("[redacted]").slice(0, 1200)

  const run = async () => {
    if (!ready || busy.current) return
    busy.current = true
    const runId = ++epoch.current
    const active = () => epoch.current === runId
    let rows = []
    let schemaFields = []
    const update = (message, running = true) => {
      if (active()) setState({ patientId, busy: running, message, rows: [...rows], hasRun: true, schemaFields })
    }
    const request = async (operation, query, variables) => {
      if (!active()) throw new Error("Stopped")
      let status = {}
      let notification = null
      let timer
      try {
        const data = await Promise.race([
          hostQuery(operation, auth.jwToken, auth.apiServer, query, variables,
            (change) => { status = typeof change === "function" ? change(status) : change },
            () => {}, (event) => { notification = event }, { formParams: { ...sd?.formParams, patientId } }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Query timed out after 30 seconds.")), 30000) }),
        ])
        if (!active()) throw new Error("Stopped")
        const detail = status?.detailErrors || notification?.detailErrors || []
        const error = detail.map((entry) => entry.message).filter(Boolean).join("; ") || status?.error || notification?.message
        if (!data || error) throw new Error(error || "MOIS returned no data.")
        return data
      } finally { clearTimeout(timer) }
    }
    update("Inspecting the live Patient schema…")
    try {
      const schema = await request("InspectPatientContextType", schemaQuery, { name: "Patient" })
      const fields = schema?.__type?.fields
      if (!Array.isArray(fields)) throw new Error("Patient schema was not returned. Introspection may be disabled or unavailable to this login. No collection probes were attempted.")
      schemaFields = fields.map((field) => ({ name: field.name, type: field.type, args: (field.args || []).map((arg) => ({ name: arg.name, type: arg.type, required: arg.type?.kind === "NON_NULL" && arg.defaultValue == null })) }))
      const fieldMap = new Map(fields.filter((field) => validName(field.name)).map((field) => [field.name, field]))
      const targets = [...new Set([
        ...(Array.isArray(collections) ? collections.filter(validName) : []),
        ...Object.keys(patient || {}).filter((key) => validName(key) && Array.isArray(patient[key])),
        ...fields.filter((field) => validName(field.name) && isList(field.type)).map((field) => field.name),
      ])].sort().slice(0, 64)
      const types = new Map()
      for (const key of targets) {
        if (!active()) break
        const field = fieldMap.get(key)
        if (!field) {
          rows.push({ key, status: "Not exposed in Patient schema", count: "—" })
          update(`Checked ${rows.length} of ${targets.length} collections`)
          continue
        }
        if (!isList(field.type) || requiredArgs(field)) {
          rows.push({ key, status: requiredArgs(field) ? "Skipped: requires arguments" : "Skipped: not a collection", count: "—" })
          update(`Checked ${rows.length} of ${targets.length} collections`)
          continue
        }
        const resultType = namedType(field.type)
        let query = ""
        try {
          let selection = ""
          if (["OBJECT", "INTERFACE", "UNION"].includes(resultType?.kind)) {
            selection = " { __typename }"
            if (resultType.kind === "OBJECT" && validName(resultType.name)) {
              if (!types.has(resultType.name)) {
                const info = await request("InspectPatientContextType", schemaQuery, { name: resultType.name })
                types.set(resultType.name, info?.__type?.fields || [])
              }
              const preferred = /(^.*Id$|^name$|^description$|^value$|^code$|^status$|Date$)/
              // Request small identifying fields, not document bodies, file
              // payloads, or arbitrary scalar data exposed by introspection.
              const scalarFields = types.get(resultType.name).filter((item) => validName(item.name) && preferred.test(item.name) && !requiredArgs(item) && !isList(item.type) && ["SCALAR", "ENUM"].includes(namedType(item.type)?.kind))
              scalarFields.sort((a, b) => a.name.localeCompare(b.name))
              selection = ` { __typename ${scalarFields.slice(0, 8).map((item) => item.name).join(" ")} }`
            }
          } else if (!["SCALAR", "ENUM"].includes(resultType?.kind)) {
            throw new Error("Unsupported or incomplete GraphQL field type.")
          }
          query = `query ProbePatientContext($patientId: Int) { patient(id: $patientId) { patientId ${key}${selection} } }`
          update(`Querying ${key} (${rows.length + 1} of ${targets.length})…`)
          const data = await request("ProbePatientContext", query, { patientId })
          const returned = data?.patient?.[0]
          if (!returned || Number(returned.patientId) !== patientId) throw new Error("MOIS did not return the requested patient.")
          const records = returned[key]
          rows.push({ key, query, status: Array.isArray(records) ? records.length ? "Read succeeded" : "Read succeeded: empty" : "Returned null or non-array", count: Array.isArray(records) ? records.length : "—", sample: Array.isArray(records) ? JSON.stringify(records.slice(0, 3), (_, value) => typeof value === "string" && value.length > 300 ? value.slice(0, 300) + "…" : value, 2) : "" })
        } catch (error) {
          if (!active()) break
          rows.push({ key, query, status: "Query failed", count: "—", error: readableError(error.message) })
        }
        update(`Checked ${rows.length} of ${targets.length} collections`)
      }
      update("Live checks complete. Results are from explicit reads, separate from the initial chart load.", false)
    } catch (error) {
      update(readableError(error.message), false)
    } finally { if (active()) busy.current = false }
  }
  const stop = () => {
    epoch.current += 1
    busy.current = false
    setState((previous) => ({ ...previous, busy: false, message: "Stopped. Any request already sent may finish; its result will be ignored." }))
  }
  const report = JSON.stringify({
    reportType: "mois-patient-context-live-query",
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    status: current.message,
    schemaFields: current.schemaFields || [],
    results: current.rows.map(({ key, status, count, query, error }) => ({ collection: key, status, count, query, error })),
  }, null, 2)
  const downloadReport = () => {
    if (!current.hasRun || current.busy) return
    const urlApi = window.URL
    if (!window.Blob || !urlApi?.createObjectURL) return
    const url = urlApi.createObjectURL(new window.Blob([report], { type: "application/json;charset=utf-8" }))
    const link = window.document.createElement("a")
    link.href = url
    link.download = `mois-live-query-results-${Date.now()}.json`
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => urlApi.revokeObjectURL(url), 1000)
  }
  return <section aria-label="Live MOIS query test" style={{ padding: 16, border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 16 }}>
    <h2>Live MOIS query test</h2>
    <p>Patient: {patient?.name?.text || "—"} · Chart {patient?.chartNumber || "—"} · Patient ID {Number.isInteger(patientId) ? patientId : "—"}</p>
    <p>Run explicit reads against this patient's chart using your current MOIS login. The form inspects the live schema, then queries up to 64 collections one at a time. It does not save or modify chart records.</p>
    {!ready ? <p>Live checks require the exported form running inside an authenticated MOIS instance. Builder preview cannot perform these checks.</p> : null}
    <button type="button" disabled={!ready || current.busy} onClick={run}>Run live chart checks</button>{" "}
    {current.busy ? <button type="button" onClick={stop}>Stop checks</button> : null}
    {" "}<button type="button" disabled={!current.hasRun || current.busy} onClick={downloadReport}>Download results JSON</button>
    <p role="status" aria-live="polite">{current.message}</p>
    {current.hasRun && !current.busy ? <details><summary>JSON report (copy or download)</summary>
      <p>Includes schema fields, counts, queries and errors. Patient identity, record samples and login credentials are excluded. Nothing is sent automatically.</p>
      <textarea aria-label="Live query results JSON" readOnly value={report} rows={12} style={{ width: "100%", fontFamily: "monospace" }} />
    </details> : null}
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}>
      <caption>Explicit live query results</caption>
      <thead><tr><th>Collection</th><th>Result</th><th>Count</th><th>Evidence</th></tr></thead>
      <tbody>{current.rows.map((row) => <tr key={row.key}><th scope="row">{row.key}</th><td>{row.status}</td><td>{row.count}</td><td>
        {row.error ? <p>{row.error}</p> : null}
        {row.query ? <details><summary>Query sent</summary><pre style={{ whiteSpace: "pre-wrap" }}>{row.query}</pre></details> : null}
        {row.sample ? <details><summary>Returned samples</summary><pre style={{ whiteSpace: "pre-wrap", maxHeight: 250, overflow: "auto" }}>{row.sample}</pre></details> : null}
      </td></tr>)}</tbody>
    </table></div>
  </section>
}
