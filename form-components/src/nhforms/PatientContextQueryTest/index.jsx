// MOIS 2.30.31 evidence: main.a75cc6b1.chunk.js queryGraphQL export accepts
// (operationName, jwToken, apiServer, query, variables, statusSetter,
//  resultCallback, errorDispatch, { formParams }) and returns data or null.
// Use that host transport; never invent an endpoint or expose credentials.
const PatientContextQueryTest = ({ collections = [], writeTargets = [] }) => {
  const sd = useSourceData()
  const patient = sd?.patient ?? sd?.queryResult?.patient?.[0]
  const patientId = Number(patient?.patientId ?? sd?.formParams?.patientId)
  const settings = typeof sd?.useAppSettings === "function" ? sd.useAppSettings() : null
  const auth = sd?.auth || settings?.auth || {}
  const hostQuery = typeof queryGraphQL === "function" ? queryGraphQL : null
  const ready = Boolean(hostQuery && auth.jwToken && auth.apiServer && Number.isInteger(patientId) && patientId > 0)
  const [state, setState] = React.useState({ patientId, busy: false, message: "No live checks run yet.", rows: [], hasRun: false, schemaFields: [] })
  const [customQuery, setCustomQuery] = React.useState("query CustomPatientProbe($patientId: Int) { patient(id: $patientId) { patientId } }")
  const [customVariables, setCustomVariables] = React.useState('{"patientId":"$patientId"}')
  const [testContext, setTestContext] = React.useState("{}")
  const [writeSelection, setWriteSelection] = React.useState("all")
  const [writeOverrides, setWriteOverrides] = React.useState("{}")
  const uncertainWrite = React.useRef(false)
  const pendingWrites = React.useRef(0)
  const epoch = React.useRef(0)
  const busy = React.useRef(false)
  React.useEffect(() => {
    if (pendingWrites.current) uncertainWrite.current = true
    setTestContext("{}")
    setWriteOverrides("{}")
    setWriteSelection("all")
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
  const schemaQuery = `query InspectPatientContextType($name: String!) { __type(name: $name) { name kind fields { name args { name defaultValue type { ${typeRef} } } type { ${typeRef} } } inputFields { name defaultValue type { ${typeRef} } } enumValues { name } } }`
  const readableError = (value) => String(value || "Unknown query error").split(String(auth.jwToken || "\u0000")).join("[redacted]").slice(0, 1200)

  const run = async (mode = "reads") => {
    if (!ready || busy.current || (mode === "writes" && (uncertainWrite.current || pendingWrites.current))) return
    busy.current = true
    const runId = ++epoch.current
    const active = () => epoch.current === runId
    let rows = mode !== "reads" ? [...current.rows] : []
    let schemaFields = mode !== "reads" ? current.schemaFields || [] : []
    let createdIds = { ...(current.createdIds || {}) }
    let customResults = [...(current.customResults || [])]
    let rootResults = [...(current.rootResults || [])]
    let writeResults = [...(current.writeResults || [])]
    let missingExploration = current.missingExploration || null
    let apiInventory = current.apiInventory || null
    const update = (message, running = true) => {
      if (active()) setState({ patientId, busy: running, message, rows: [...rows], hasRun: true, schemaFields, apiInventory, writeResults: [...writeResults], createdIds: { ...createdIds }, rootResults: [...rootResults], customResults: [...customResults], missingExploration })
    }
    const request = async (operation, query, variables, mutation = false) => {
      if (!active()) throw new Error("Stopped")
      let status = {}
      let notification = null
      let timer
      try {
        if (mutation) pendingWrites.current += 1
        const transport = Promise.resolve().then(() => hostQuery(operation, auth.jwToken, auth.apiServer, query, variables,
            (change) => { status = typeof change === "function" ? change(status) : change },
            () => {}, (event) => { notification = event }, { formParams: { ...sd?.formParams, patientId } })).finally(() => { if (mutation) pendingWrites.current -= 1 })
        const data = await Promise.race([
          transport,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Query timed out after 30 seconds.")), 30000) }),
        ])
        if (!active()) throw new Error("Stopped")
        const detail = status?.detailErrors || notification?.detailErrors || []
        const error = detail.map((entry) => entry.message).filter(Boolean).join("; ") || status?.error || notification?.message
        if (!data || error) throw new Error(error || "MOIS returned no data.")
        return data
      } finally { clearTimeout(timer) }
    }
    update(mode === "api" ? "Inspecting root queries, mutations and input types…" : "Inspecting the live Patient schema…")
    try {
      if (mode === "missing") {
        const targets = {
          addressHistory: { names: ["AddressHistory", "HistoricalAddress", "PreviousAddress"], related: [] },
          administrationInstructions: { names: ["AdministrationInstruction"], related: ["DosageInstruction"] },
          adverseEvents: { names: ["AdverseEvent"], related: ["AdverseReaction"] },
          alerts: { names: ["Alert", "PatientAlert"], related: [] },
          dynamicForms: { names: ["DynamicForm"], related: ["Webform", "WebformDefinition", "WebformResource"] },
          familyHistory: { names: ["FamilyHistory", "FamilyHistoryRecord"], related: ["FamilyMemberHistory"] },
          imagingReports: { names: ["ImagingReport", "DiagnosticImagingReport"], related: ["DiagnosticReport"] },
          medicationAdministrations: { names: ["MedicationAdministration"], related: [] },
          serviceEvents: { names: ["ServiceEvent"], related: [] },
          socialHistory: { names: ["SocialHistory", "SocialHistoryRecord"], related: [] },
          standardForms: { names: ["StandardForm"], related: ["PaperFormTemplate", "Webform", "WebformDefinition"] },
        }
        const limits = { maxDepth: 6, maxStates: 10000, pathsPerCollection: 12, maxProbes: 60 }
        missingExploration = {
          status: "Inspecting output schema", limits, matchRules: targets,
          scope: "Read-only candidate-path exploration. Name/type matches are not proof of semantic equivalence. No matching path within these bounds is not proof the API lacks the data.",
          coverage: { completed: false, truncated: false, visitedStates: 0, probesSent: 0 },
          collections: Object.keys(targets).map((collection) => ({ collection, status: "Not completed", matchedOutputTypes: [], paths: [] })),
        }
        update("Inspecting the live output schema for the 11 missing collections…")
        // One schema snapshot makes the search reproducible and includes abstract
        // output types. Only the Query root is traversed; never the Mutation root.
        const query = `query ExploreMissingSchema { __schema { queryType { name } types { name kind fields { name args { name defaultValue type { ${typeRef} } } type { ${typeRef} } } possibleTypes { name kind } inputFields { name defaultValue type { ${typeRef} } } enumValues { name } } } }`
        const discovery = await request("ExploreMissingSchema", query, {})
        const schema = discovery?.__schema
        if (!schema?.queryType?.name || !Array.isArray(schema.types)) throw new Error("Output schema discovery unavailable. No alternate paths were tested.")
        const types = new Map(schema.types.filter((type) => validName(type.name)).map((type) => [type.name, type]))
        const root = types.get(schema.queryType.name)
        if (!Array.isArray(root?.fields)) throw new Error("Query root fields were not returned. Exploration is incomplete.")
        missingExploration.queryRoot = root.name
        missingExploration.schemaTypes = schema.types
        missingExploration.coverage.outputTypes = schema.types.filter((type) => ["OBJECT", "INTERFACE", "UNION"].includes(type.kind)).length
        const normalize = (name) => String(name).replace(/[^A-Za-z0-9]/g, "").toLowerCase().replace(/ies$/, "y").replace(/([^s])s$/, "$1")
        const matches = (value, names) => names.some((name) => normalize(value) === normalize(name))
        for (const row of missingExploration.collections) {
          row.matchedOutputTypes = schema.types.filter((type) => ["OBJECT", "INTERFACE", "UNION"].includes(type.kind) && matches(type.name, [row.collection, ...targets[row.collection].names, ...targets[row.collection].related])).map((type) => type.name)
        }
        const pathsByCollection = new Map(Object.keys(targets).map((key) => [key, []]))
        const queue = [{ type: root, path: [], ancestors: [root.name] }]
        let cursor = 0
        while (cursor < queue.length && cursor < limits.maxStates) {
          const item = queue[cursor++]
          missingExploration.coverage.visitedStates = cursor
          if (item.path.length >= limits.maxDepth) { if (item.type.fields?.length || item.type.possibleTypes?.length) missingExploration.coverage.truncated = true; continue }
          for (const field of item.type.fields || []) {
            if (!validName(field.name) || field.name.startsWith("__")) continue
            const targetType = namedType(field.type)
            const path = [...item.path, { kind: "field", name: field.name, type: field.type, args: field.args || [] }]
            for (const row of missingExploration.collections) {
              const spec = targets[row.collection]
              const exact = matches(field.name, [row.collection, ...spec.names]) || matches(targetType?.name, [row.collection, ...spec.names])
              const related = matches(field.name, spec.related) || matches(targetType?.name, spec.related)
              if (exact || related) pathsByCollection.get(row.collection).push({ path, relation: exact ? "Name/type match; equivalence unverified" : "Related API; equivalence unverified" })
            }
            if (["OBJECT", "INTERFACE", "UNION"].includes(targetType?.kind) && !item.ancestors.includes(targetType.name)) {
              const next = types.get(targetType.name)
              if (next) queue.push({ type: next, path, ancestors: [...item.ancestors, next.name] })
              else missingExploration.coverage.truncated = true
            }
          }
          for (const possible of item.type.possibleTypes || []) {
            const next = types.get(possible.name)
            if (next && !item.ancestors.includes(next.name)) {
              const path = [...item.path, { kind: "fragment", name: next.name }]
              for (const row of missingExploration.collections) {
                const spec = targets[row.collection]
                const exact = matches(next.name, [row.collection, ...spec.names])
                if (exact || matches(next.name, spec.related)) pathsByCollection.get(row.collection).push({ path, relation: exact ? "Name/type match; equivalence unverified" : "Related API; equivalence unverified" })
              }
              queue.push({ type: next, path, ancestors: [...item.ancestors, next.name] })
            }
          }
          // Bound both work and memory on a cyclic or unusually broad schema.
          if (queue.length > limits.maxStates * 2) { queue.length = limits.maxStates * 2; missingExploration.coverage.truncated = true }
        }
        if (cursor < queue.length) missingExploration.coverage.truncated = true
        const typeText = (type) => type.kind === "NON_NULL" ? typeText(type.ofType) + "!" : type.kind === "LIST" ? "[" + typeText(type.ofType) + "]" : type.name
        const recordIds = {
          webform: sd?.webform?.webformId || sd?.formParams?.webformId,
          document: patient?.documents?.[0]?.documentId,
          observation: patient?.observations?.[0]?.observationId,
          encounter: sd?.formParams?.encounterId || patient?.encounters?.[0]?.encounterId,
        }
        const catalogs = ["webformDefinition", "webformResource", "paperFormTemplate"]
        const rootRank = (entry) => entry.path[0].name === "patient" ? 0 : entry.path[0].args.some((arg) => arg.name === "patientId") ? 1 : catalogs.includes(entry.path[0].name) ? 2 : 3
        const cache = new Map()
        for (const row of missingExploration.collections) {
          if (!active()) return
          const candidates = pathsByCollection.get(row.collection).sort((a, b) => rootRank(a) - rootRank(b) || Number(a.relation.startsWith("Related")) - Number(b.relation.startsWith("Related")) || a.path.length - b.path.length)
          row.candidatePathsFound = candidates.length
          if (candidates.length > limits.pathsPerCollection) missingExploration.coverage.truncated = true
          for (const candidate of candidates.slice(0, limits.pathsPerCollection)) {
            if (!active()) return
            const { path } = candidate
            const entry = { path: path.map((hop) => hop.kind === "fragment" ? `... on ${hop.name}` : hop.name).join("."), relation: candidate.relation, status: "Not tested", arguments: path.filter((hop) => hop.kind === "field").map((hop) => ({ field: hop.name, args: hop.args })), scope: "Unresolved" }
            row.paths.push(entry)
            try {
              const top = path[0]
              const scopedByPatient = top.name === "patient" || top.args.some((arg) => arg.name === "patientId")
              const currentRecordId = Number(recordIds[top.name])
              const scopedByRecord = Number.isSafeInteger(currentRecordId) && currentRecordId > 0 && top.args.some((arg) => arg.name === "id")
              const catalog = catalogs.includes(top.name)
              entry.scope = scopedByPatient ? "Active patient" : scopedByRecord ? "One record from active context" : catalog ? "Form catalog; not a patient collection" : "Unresolved root scope"
              if (!scopedByPatient && !scopedByRecord && !catalog) throw new Error("Automatic read needs a patient filter or a known active-context record ID")
              const variables = {}
              const declarations = []
              const bindings = new Map()
              path.forEach((hop, index) => {
                if (hop.kind !== "field") return
                const args = []
                for (const arg of hop.args) {
                  let value
                  const scalar = namedType(arg.type)?.name
                  if (arg.name === "patientId" && ["Int", "Long", "ID"].includes(scalar)) value = patientId
                  else if (index === 0 && top.name === "patient" && arg.name === "id") value = patientId
                  else if (index === 0 && arg.name === "id" && scopedByRecord) value = currentRecordId
                  else if (index === 0 && arg.name === "webformDefinitionId") value = Number(sd?.webform?.webformDefinitionId || sd?.formParams?.webformDefinitionId) || undefined
                  else if (arg.name === "first" && scalar === "Int") value = 3
                  if (value === undefined) { if (arg.type.kind === "NON_NULL" && arg.defaultValue == null) throw new Error(`Needs argument ${hop.name}.${arg.name}`); continue }
                  const key = `p${index}_${arg.name}`
                  variables[key] = scalar === "ID" ? String(value) : value
                  declarations.push(`$${key}: ${typeText(arg.type)}`)
                  args.push(`${arg.name}: $${key}`)
                }
                bindings.set(index, args.length ? "(" + args.join(", ") + ")" : "")
              })
              const leaf = path[path.length - 1]
              const leafType = leaf.kind === "fragment" ? { kind: "OBJECT", name: leaf.name } : namedType(leaf.type)
              let selection = ""
              if (["OBJECT", "INTERFACE", "UNION"].includes(leafType?.kind)) {
                const small = (types.get(leafType.name)?.fields || []).filter((field) => /Id$|^code$|^status$/.test(field.name) && validName(field.name) && !requiredArgs(field) && !isList(field.type) && ["SCALAR", "ENUM"].includes(namedType(field.type)?.kind)).slice(0, 6)
                selection = leaf.kind === "fragment" ? small.map((field) => field.name).join(" ") : " { __typename " + small.map((field) => field.name).join(" ") + " }"
              }
              for (let index = path.length - 1; index >= 0; index -= 1) {
                const hop = path[index]
                if (hop.kind === "fragment") selection = `... on ${hop.name} { __typename ${selection} }`
                else selection = `${hop.name}${bindings.get(index) || ""}${selection}`
                if (index > 0 && path[index - 1].kind !== "fragment") {
                  const parentType = namedType(path[index - 1].type)
                  const patientCheck = parentType?.name === "Patient" && types.get("Patient")?.fields?.some((field) => field.name === "patientId") ? "patientId " : ""
                  selection = ` { __typename ${patientCheck}${selection} }`
                }
              }
              entry.query = `query ProbeMissingCollection${declarations.length ? "(" + declarations.join(", ") + ")" : ""} { ${selection} }`
              const key = JSON.stringify([entry.query, variables])
              let outcome = cache.get(key)
              if (!outcome) {
                if (missingExploration.coverage.probesSent >= limits.maxProbes) { missingExploration.coverage.truncated = true; entry.status = "Not tested: probe limit reached"; continue }
                missingExploration.coverage.probesSent += 1
                update(`Exploring ${row.collection}: ${entry.path}…`)
                try {
                  const data = await request("ProbeMissingCollection", entry.query, variables)
                  if (top.name === "patient") {
                    const charts = data.patient
                    if (!Array.isArray(charts) || !charts.length || charts.some((chart) => Number(chart.patientId) !== patientId)) throw new Error("Root did not return the active patient")
                  }
                  let values = [data]
                  let inaccessibleParent = false
                  let leafNull = false
                  for (let i = 0; i < path.length; i += 1) {
                    const hop = path[i]
                    if (hop.kind === "fragment") { values = values.filter((value) => value?.__typename === hop.name); if (!values.length) inaccessibleParent = true; continue }
                    const next = []
                    for (const value of values) {
                      const found = value?.[hop.name]
                      if (found == null) { if (i === path.length - 1) leafNull = true; else inaccessibleParent = true }
                      else if (Array.isArray(found)) { next.push(...found); if (!found.length && i < path.length - 1) inaccessibleParent = true }
                      else next.push(found)
                    }
                    values = next
                  }
                  outcome = { status: values.length ? "Read succeeded" : leafNull ? "Query succeeded; target null or omitted" : inaccessibleParent ? "Query succeeded; no parent records reached target" : "Read succeeded: empty", count: values.length, partialParentCoverage: inaccessibleParent || leafNull }
                } catch (error) { if (!active()) return; outcome = { status: "Read failed", error: readableError(error.message) } }
                cache.set(key, outcome)
              } else entry.reusedProbe = true
              Object.assign(entry, outcome)
            } catch (error) { if (!active()) return; entry.status = "Exposed path; needs arguments or scope"; entry.error = readableError(error.message) }
          }
          row.status = row.paths.some((entry) => entry.status.startsWith("Read succeeded") && !entry.relation.startsWith("Related")) ? "Candidate path read verified; equivalence unverified" : row.paths.some((entry) => entry.status.startsWith("Read succeeded")) ? "Related API explored; equivalence unverified" : candidates.length ? "Candidate paths explored; target read unresolved" : "No candidate path found within search bounds"
          update(`Explored ${row.collection}`)
        }
        missingExploration.coverage.completed = true
        missingExploration.status = "Exploration complete" + (missingExploration.coverage.truncated ? "; bounded search or probe limits reached" : "")
        update("Missing-collection exploration complete. Download results JSON; no writes were executed by this test.", false)
        return
      }
      if (mode === "custom") {
        const match = customQuery.trim().match(/^(query|mutation)\s+([_A-Za-z][_0-9A-Za-z]*)\b/)
        if (!match) throw new Error("Use a named query or mutation, for example query MyProbe { ... }")
        const mutation = match[1] === "mutation"
        if (mutation && (uncertainWrite.current || pendingWrites.current)) throw new Error("A previous write has an uncertain outcome; inspect the chart before reopening this form")
        const variables = JSON.parse(customVariables || "{}", (_key, value) => {
          if (value === "$patientId") return patientId
          if (typeof value === "string" && value.startsWith("$created.")) {
            const id = createdIds[value.slice(9)]
            if (!id) throw new Error(`No created record for ${value}`)
            return id
          }
          return value
        })
        if (!variables || typeof variables !== "object" || Array.isArray(variables)) throw new Error("Variables must be a JSON object")
        const row = { operation: match[2], kind: match[1], query: customQuery, status: "Sent; outcome pending", inputFields: Object.keys(variables) }
        customResults.push(row)
        update(`Running custom ${match[1]} ${match[2]}…`)
        try {
          const result = await request(match[2], customQuery, variables, mutation)
          row.status = mutation ? "Response received; persistence not independently verified" : "Query response received"
          row.resultFields = Object.keys(result)
          row.response = JSON.stringify(result, null, 2).split(String(auth.jwToken || "\u0000")).join("[redacted]")
        } catch (error) {
          row.status = mutation ? "Write outcome requires inspection" : "Query failed"
          row.error = readableError(error.message)
          if (mutation && /timed out|Stopped/.test(String(error.message))) uncertainWrite.current = true
        }
        update(row.status, false)
        return
      }
      if (mode === "roots") {
        if (!apiInventory?.queries?.length) throw new Error("Inspect read/write API first.")
        const firstId = (collection, key) => createdIds[key] || patient?.[collection]?.find((row) => Number(row[key]) > 0)?.[key]
        const definitionId = createdIds.webformDefinitionId || sd?.webform?.webformDefinitionId || sd?.formParams?.webformDefinitionId
        const varsByRoot = {
          document: { patientId, id: firstId("documents", "documentId") },
          documentSummary: { patientId, documentIds: firstId("documents", "documentId") ? [firstId("documents", "documentId")] : undefined },
          drugCode: { cdic: "WEBFORMS_TEST" },
          encounter: { patientId, first: 1 },
          findByName: { name: "WEBFORMS TEST", first: 1 },
          findMatchingPatients: { ident: { firstName: patient?.name?.first, familyName: patient?.name?.family, birthDate: patient?.birthDate }, first: 1 },
          observation: { id: firstId("observations", "observationId") },
          patient: { id: patientId },
          task: { patientId, first: 1 },
          quickEntry: { recordType: "Observation" },
          webform: { id: createdIds.webformId || sd?.webform?.webformId || sd?.formParams?.webformId },
          webformDefinition: { ...(definitionId ? { id: definitionId } : {}), first: 1 },
          webformResource: { webformDefinitionId: definitionId, first: 1 },
        }
        let configured
        try { configured = JSON.parse(writeOverrides || "{}") } catch (_) { throw new Error("Inputs must be valid JSON") }
        rootResults = []
        const typeText = (type) => type.kind === "NON_NULL" ? typeText(type.ofType) + "!" : type.kind === "LIST" ? "[" + typeText(type.ofType) + "]" : type.name
        for (const op of apiInventory.queries) {
          if (!active()) break
          const row = { operation: op.name, status: "Preparing" }
          rootResults.push(row)
          try {
            const supplied = configured?.["query:" + op.name]
            if (op.name === "findMatchingPatients" && !supplied && (!patient?.name?.first || !patient?.name?.family || !patient?.birthDate)) throw new Error("Identity matching needs firstName, familyName and birthDate; patientId alone was rejected by the live server. Provide query:findMatchingPatients variables.")
            const defaults = varsByRoot[op.name] || (op.args.some((arg) => arg.name === "first") ? { first: 1 } : {})
            const vars = Object.fromEntries(Object.entries(supplied || defaults).filter(([, value]) => value !== undefined))
            for (const arg of op.args) if (arg.type.kind === "NON_NULL" && arg.defaultValue == null && vars[arg.name] == null) throw new Error(`Needs ${arg.name}; provide query:${op.name} variables in test inputs`)
            for (const key of Object.keys(vars)) if (!op.args.some((arg) => arg.name === key)) throw new Error(`Unknown argument ${key}`)
            let selection = ""
            const resultType = namedType(op.type)
            if (["OBJECT", "INTERFACE", "UNION"].includes(resultType.kind)) {
              let fields = []
              if (resultType.kind === "OBJECT") {
                const result = await request("InspectPatientContextType", schemaQuery, { name: resultType.name })
                fields = (result?.__type?.fields || []).filter((f) => validName(f.name) && /Id$|^name$|^code$|^status$/.test(f.name) && !requiredArgs(f) && !isList(f.type) && ["SCALAR", "ENUM"].includes(namedType(f.type)?.kind)).slice(0, 8)
              }
              selection = ` { __typename ${fields.map((f) => f.name).join(" ")} }`
            }
            const args = op.args.filter((arg) => vars[arg.name] !== undefined)
            const declarations = args.map((arg) => `$${arg.name}: ${typeText(arg.type)}`).join(", ")
            const bindings = args.map((arg) => `${arg.name}: $${arg.name}`).join(", ")
            row.query = `query ProbeMoisRoot${declarations ? "(" + declarations + ")" : ""} { ${op.name}${bindings ? "(" + bindings + ")" : ""}${selection} }`
            update(`Querying root ${op.name}…`)
            const result = await request("ProbeMoisRoot", row.query, vars)
            row.status = result[op.name] == null ? "Returned null" : Array.isArray(result[op.name]) && !result[op.name].length ? "Read succeeded: empty" : "Read succeeded"
            row.count = Array.isArray(result[op.name]) ? result[op.name].length : null
          } catch (error) { row.status = row.query ? "Query failed" : "Not attempted"; row.error = readableError(error.message) }
          update(`Checked ${rootResults.length} root queries`)
        }
        update("Root query probes complete. These test the selected arguments and small scalar selections; returned records are not included in the report.", false)
        return
      }
      if (mode === "writes") {
        if (!apiInventory?.mutations?.length) throw new Error("Inspect read/write API first.")
        let overrides
        try { overrides = JSON.parse(writeOverrides || "{}") } catch (_) { throw new Error("Write inputs must be a JSON object keyed by mutation name.") }
        if (!overrides || Array.isArray(overrides) || typeof overrides !== "object") throw new Error("Write inputs must be a JSON object.")
        apiInventory = { ...apiInventory, executionStatus: "Write tests requested; see writeResults for actual outcomes" }
        const context = JSON.parse(testContext || "{}")
        if (!context || typeof context !== "object" || Array.isArray(context)) throw new Error("Test context must be a JSON object")
        const contextId = (key) => { const value = Number(context[key]); if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Set a valid ${key} in Test context, or provide explicit operation variables`); return value }
        const assignee = () => context.assignedTeamId ? { assignedTeamId: contextId("assignedTeamId") } : { assignedUserId: contextId("assignedUserId") }
        // Keep markers below common clinical text limits; previous ISO markers
        // were long enough to be truncated and could defeat ID recovery.
        const marker = `WEBFORMS TEST ${Date.now().toString(36)} ${Math.random().toString(36).slice(2, 6)}`
        const date = new Date().toISOString().slice(0, 10)
        const now = new Date().toISOString()
        const ids = createdIds
        const typeCache = new Map()
        const inputMap = new Map(apiInventory.inputTypes.map((type) => [type.name, type]))
        const typeText = (type) => type.kind === "NON_NULL" ? typeText(type.ofType) + "!" : type.kind === "LIST" ? "[" + typeText(type.ofType) + "]" : type.name
        const inspect = async (name) => {
          if (!typeCache.has(name)) {
            const result = await request("InspectPatientContextType", schemaQuery, { name })
            if (!result?.__type) throw new Error(`Cannot inspect result type ${name}`)
            typeCache.set(name, result.__type)
          }
          return typeCache.get(name)
        }
        // Reject unknown fields, missing required inputs and invalid enums locally.
        // Nullable schema fields may still have server-side business requirements.
        const validate = (value, type, path) => {
          if (value == null) { if (type.kind === "NON_NULL") throw new Error(`Missing required input ${path}`); return }
          if (type.kind === "NON_NULL") return validate(value, type.ofType, path)
          if (type.kind === "LIST") { if (!Array.isArray(value)) throw new Error(`${path} must be an array`); value.forEach((item, i) => validate(item, type.ofType, `${path}[${i}]`)); return }
          const spec = inputMap.get(type.name)
          if (type.kind === "INPUT_OBJECT") {
            if (!spec || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid input object ${path}`)
            for (const key of Object.keys(value)) if (!spec.inputFields.some((f) => f.name === key)) throw new Error(`Unknown input ${path}.${key}`)
            for (const field of spec.inputFields) if (field.defaultValue == null || value[field.name] !== undefined) validate(value[field.name], field.type, `${path}.${field.name}`)
          } else if (type.kind === "ENUM") {
            if (!spec?.enumValues.some((entry) => entry.name === value)) throw new Error(`Invalid enum ${path}`)
          } else if (["Int", "Long"].includes(type.name) && !Number.isSafeInteger(value)) throw new Error(`${path} must be an integer`)
          else if (type.name === "Float" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`${path} must be numeric`)
          else if (type.name === "Boolean" && typeof value !== "boolean") throw new Error(`${path} must be boolean`)
          else if (type.name === "String" && typeof value !== "string") throw new Error(`${path} must be text`)
        }
        const need = (name) => { if (!ids[name]) throw new Error(`Needs a successful ${name} creation earlier in this run, or explicit variable overrides`); return ids[name] }
        const observation = { observationId: 0, patientId, observationCode: "WEBFORMS_TEST", description: marker, valueType: "text", value: marker, status: "F", reportedDate: date }
        // Each recipe is an isolated API probe, not a production write adapter.
        // IDs for dependent updates/deletes are captured only from this run.
        const recipes = {
          addObservation: () => ({ observation }),
          changeAssociatedParty: () => ({ patientId, associatedParty: { associatedPartyId: 0, patientId, name: marker, note: marker } }),
          changeChartPreference: () => ({ patientId, chartPreference: { chartPreferenceId: 0, patientId, preference: marker, subjectDetail: marker, startDate: date } }),
          changeConnection: () => ({ patientId, connection: { connectionId: 0, patientId, provider: { name: marker, source: "FREE TEXT" }, comment: marker, startDate: date } }),
          changeDocument: () => ({ patientId, document: { documentId: 0, patientId, templateName: marker, note: marker, comment: marker, documentDate: date } }),
          changeHouseholdOccupant: () => ({ patientId, householdOccupant: { householdOccupantId: 0, patientId, quantity: 1, note: marker, startDate: date } }),
          changeLongTermMedication: () => ({ patientId, longTermMedication: { longTermMedicationId: 0, patientId, medication: marker, comment: "Synthetic test only", startDate: date } }),
          changeObservations: () => ({ patientId, observationChanges: [{ ...observation, observationId: need("observationId"), value: marker + " UPDATED" }] }),
          changeObservationPanels: () => ({ patientId, panelChanges: [{ observationPanelId: 0, patientId, panelName: context.panelName || { code: "4548-4", display: marker, system: "pCLOCD" }, notes: marker, status: "F", interfaceType: "WEBFORM" }] }),
          changePatient: () => ({ patientId, newPatient: { shortNote: marker } }),
          changePatientAddress: () => ({ patientId, newAddress: { line2: marker } }),
          changePatientContact: async () => {
            // MOIS rejected a partial contact object (str_phone1 NOT NULL).
            // Read fresh values and copy only fields in this instance's input type.
            const keys = (inputMap.get("ContactPointInput")?.inputFields || []).map((field) => field.name)
            if (!keys.includes("homePhone") || !keys.includes("homeMessage")) throw new Error("Contact input fields unavailable; supply complete variable overrides")
            const baseline = await request("ReadContactBeforeProbe", `query ReadContactBeforeProbe($patientId: Int!) { patient(id: $patientId) { patientId telecom { ${keys.join(" ")} } } }`, { patientId })
            const contact = baseline.patient?.find((record) => Number(record.patientId) === patientId)?.telecom
            if (!contact || contact.homePhone == null) throw new Error("Fresh homePhone is unavailable; provide a complete test contact payload")
            return { patientId, newContact: { ...Object.fromEntries(keys.filter((key) => Object.prototype.hasOwnProperty.call(contact, key)).map((key) => [key, contact[key]])), homeMessage: contact.homeMessage === "Y" ? "N" : "Y" } }
          },
          changePatientInsurance: () => ({ patientId, newInsurance: { insuranceNumber: "WF" + Date.now().toString(36).slice(-6) } }),
          changePatientName: () => ({ patientId, newUsualName: { first: patient?.name?.first || "WEBFORMS", family: patient?.name?.family || "TEST" }, newNickName: { first: "WEBFORMS", family: "TEST", text: marker } }),
          changePrescription: () => ({ patientId, prescription: { prescriptionId: 0, patientId, medication: marker, comment: "Synthetic test only", orderDate: date } }),
          changeFavouriteMedication: () => ({ favouriteMedication: { favouriteMedicationId: 0, medication: marker, comment: "Synthetic test only" } }),
          changePrescriptionLog: () => ({ patientId, prescriptionLog: { prescriptionLogId: 0, createdDate: now, method: marker, logItems: [{ prescriptionId: need("prescriptionId"), medication: marker }] } }),
          changeTask: () => ({ patientId, task: { taskId: 0, ...assignee(), description: marker, note: marker, createdDate: date } }),
          changeServiceEpisode: () => {
            if (!context.service?.code || !context.service?.system) throw new Error("Set service coding in Test context; the previous empty service payload failed with a server null-reference error")
            return { patientId, serviceEpisode: { serviceEpisodeId: 0, patientId, service: context.service, note: marker, startDate: date } }
          },
          changeServiceEvent: () => ({ serviceEpisodeId: need("serviceEpisodeId"), serviceEvent: { serviceEventId: 0, serviceEpisodeId: need("serviceEpisodeId") } }),
          createAppointment: () => ({ patientId, encounter: { encounterId: 0, patientId, providerId: contextId("providerId"), appointmentDateTime: now, officeNote: marker } }),
          changeEncounterNote: () => ({ patientId, encounterNote: { encounterNoteId: 0, encounterId: need("encounterId"), note: marker, noteCreationDate: date } }),
          createDocumentTask: () => ({ documentId: need("documentId"), newTask: { taskId: 0, ...assignee(), description: marker, note: marker } }),
          createEncounterTask: () => ({ encounterId: need("encounterId"), newTask: { taskId: 0, ...assignee(), description: marker, note: marker } }),
          createEncounterCorrespondence: () => ({ encounterId: need("encounterId"), correspondence: { correspondenceId: 0, when: now, person: "WEBFORMS TEST", note: marker } }),
          updateEncounter: () => ({ patientId, encounter: { encounterId: need("encounterId"), officeNote: marker + " UPDATED" } }),
          // SMOIS main.a75cc6b1 uses D / MOIS-ENCOUNTERSTATUS and SIGNED below.
          updateEncounterStatus: () => ({ patientId, encounterId: need("encounterId"), appointmentStatus: { code: "D", system: "MOIS-ENCOUNTERSTATUS" }, statusChangeDateTime: now }),
          registerNewPatient: () => ({ newPatient: { name: { first: "WEBFORMS", family: "TEST " + marker.slice(-6) }, note: marker } }),
          addWebformDefinition: () => ({ webform: { webformDefinitionId: 0, name: "webforms_test_" + Date.now().toString(36) + "_" + marker.slice(-4), title: marker, owner: "WEBFORMS TEST", active: "N", buildVersion: date.replace(/-/g, ""), type: "ATTACHMENT", formVersion: { major: 1, minor: 0, patch: 0 }, formdataSchema: "{}" } }),
          addWebformResource: () => ({ resource: { webformDefinitionId: need("webformDefinitionId"), pathname: "diagnostic-test.txt", type: "file", mediaType: "text/plain", encoding: "utf-8", contents: marker } }),
          addWebform: () => ({ webform: { webformId: 0, webformDefinitionId: need("webformDefinitionId"), patientId, isDraft: "Y", formdata: JSON.stringify({ diagnostic: marker }), note: marker } }),
          updateWebform: () => ({ webform: { webformId: need("webformId"), patientId, note: marker + " UPDATED", formdata: JSON.stringify({ diagnostic: marker, updated: true }) } }),
          updateWebformDefinition: () => ({ webformDefinition: { webformDefinitionId: need("webformDefinitionId"), title: marker + " UPDATED" } }),
          signWebform: () => ({ signatureRecord: { documentId: need("webformDocumentId"), recordState: "SIGNED", note: marker } }),
          paperFormParametersRx: async () => {
            const info = await inspect("PaperFormTemplate")
            const key = ["paperFormTemplateId", "templateId", "id"].find((name) => info.fields?.some((f) => f.name === name && !requiredArgs(f)))
            if (!key) throw new Error("Provide templateId and prescription in variable overrides; no template identifier found")
            const result = await request("ProbePaperTemplates", `query ProbePaperTemplates { paperFormTemplate { ${key} } }`, {})
            const templateId = Number(result.paperFormTemplate?.find((row) => Number(row[key]) > 0)?.[key])
            if (!templateId) throw new Error("No paper template returned; provide templateId and prescription in variable overrides")
            return { templateId, prescription: { prescriptionId: need("prescriptionId"), patientId, medication: marker } }
          },
          logMessage: () => ({ logMessage: marker }),
          deleteEncounterCorrespondence: () => ({ correspondenceId: need("correspondenceId") }),
          deleteWebform: () => ({ webformId: need("webformId"), leaveOrphanDocument: false }),
          deleteWebformDefinition: () => ({ id: need("webformDefinitionId") }),
        }
        const collectionByType = { ObservationPanel: "observationPanels", Correspondence: "correspondences", FavouriteMedication: "favouriteMedications", Observation: "observations", AssociatedParty: "contacts", ChartPreference: "preferences", Connection: "connections", Document: "documents", HouseholdOccupant: "householdOccupants", LongTermMedication: "longTermMedications", Prescription: "prescriptions", PrescriptionLog: "prescriptionLogs", ServiceEpisode: "serviceEpisodes", Encounter: "encounters" }
        const targetTypes = { changeObservationPanels: "ObservationPanel", changeFavouriteMedication: "FavouriteMedication", createEncounterCorrespondence: "Correspondence", addObservation: "Observation", changeAssociatedParty: "AssociatedParty", changeChartPreference: "ChartPreference", changeConnection: "Connection", changeDocument: "Document", changeHouseholdOccupant: "HouseholdOccupant", changeLongTermMedication: "LongTermMedication", changeObservations: "Observation", changePrescription: "Prescription", changePrescriptionLog: "PrescriptionLog", changeServiceEpisode: "ServiceEpisode", createAppointment: "Encounter" }
        const ownKeys = { ObservationPanel: "observationPanelId", Correspondence: "correspondenceId", Observation: "observationId", AssociatedParty: "associatedPartyId", ChartPreference: "chartPreferenceId", Connection: "connectionId", Document: "documentId", HouseholdOccupant: "householdOccupantId", LongTermMedication: "longTermMedicationId", Prescription: "prescriptionId", PrescriptionLog: "prescriptionLogId", ServiceEpisode: "serviceEpisodeId", ServiceEvent: "serviceEventId", Encounter: "encounterId", MoisTask: "taskId", FavouriteMedication: "favouriteMedicationId", Webform: "webformId", WebformDefinition: "webformDefinitionId" }
        const scalarSelection = async (typeName, recordIdKey = ownKeys[typeName]) => {
          const info = await inspect(typeName)
          const allowed = new Set([recordIdKey, ...(typeName === "Webform" ? ["documentId", "isDraft", "recordState"] : []), "patientId", "name", "title", "description", "value", "note", "notes", "comment", "medication", "preference", "subjectDetail", "method", "officeNote", "shortNote", "formdata"])
          return ["__typename", ...(info.fields || []).filter((f) => allowed.has(f.name) && !requiredArgs(f) && !isList(f.type) && ["SCALAR", "ENUM"].includes(namedType(f.type)?.kind)).map((f) => f.name)].join(" ")
        }
        const ordered = [...Object.keys(recipes), ...apiInventory.mutations.map((op) => op.name).filter((name) => !Object.prototype.hasOwnProperty.call(recipes, name))]
        const discovered = new Map(apiInventory.mutations.map((op) => [op.name, op]))
        for (const name of ordered) {
          if (!active()) break
          const op = discovered.get(name === "changeObservationPanels" ? "changeObservations" : name)
          if (!op || (writeSelection !== "all" && writeSelection !== name)) continue
          if (writeSelection === "all" && writeResults.some((result) => result.operation === name && result.sent)) continue
          const row = { operation: name, graphqlField: op.name, status: "Preparing", marker, verification: "Not performed", cleanup: "Test data is retained unless a dedicated delete probe succeeds" }
          writeResults.push(row)
          update(`Preparing ${name}…`)
          let sent = false
          try {
            if (name === "query") throw new Error("Query namespace on mutation root; not a write operation")
            if (name === "sendFax" && (writeSelection !== "sendFax" || !overrides.sendFax?.eFaxAccountId || !overrides.sendFax?.recipients?.some((recipient) => recipient.faxNumber))) throw new Error("Select sendFax individually and supply eFaxAccountId and explicit test recipients in variable overrides")
            const resolve = (value) => value === "$patientId" ? patientId : typeof value === "string" && value.startsWith("$created.") ? need(value.slice(9)) : Array.isArray(value) ? value.map(resolve) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)])) : value
            const vars = Object.prototype.hasOwnProperty.call(overrides, name) ? resolve(overrides[name]) : recipes[name] ? await recipes[name]() : null
            if (!vars || typeof vars !== "object" || Array.isArray(vars)) throw new Error("Needs explicit variable overrides for this operation")
            for (const key of Object.keys(vars)) if (!op.args.some((arg) => arg.name === key)) throw new Error(`Unknown argument ${key}`)
            for (const arg of op.args) if (arg.defaultValue == null || vars[arg.name] !== undefined) validate(vars[arg.name], arg.type, arg.name)
            const resultType = namedType(op.type)
            const targetType = targetTypes[name] || resultType.name
            const collection = collectionByType[targetType]
            let recordType = targetType
            let selection = ""
            let nested = false
            if (["OBJECT", "INTERFACE", "UNION"].includes(resultType.kind)) {
              selection = resultType.kind === "OBJECT" ? await scalarSelection(resultType.name) : "__typename"
              if (collection && resultType.name !== targetType) {
                const info = await inspect(resultType.name)
                const field = info.fields?.find((f) => f.name === collection && !requiredArgs(f))
                if (field) { recordType = namedType(field.type).name; selection += ` ${collection} { ${await scalarSelection(recordType, ownKeys[targetType])} }`; nested = true }
              }
              selection = ` { ${selection} }`
            }
            const args = op.args.filter((arg) => vars[arg.name] !== undefined)
            const declarations = args.map((arg) => `$${arg.name}: ${typeText(arg.type)}`).join(", ")
            const bindings = args.map((arg) => `${arg.name}: $${arg.name}`).join(", ")
            row.query = `mutation ProbeMoisWrite${declarations ? "(" + declarations + ")" : ""} { ${op.name}${bindings ? "(" + bindings + ")" : ""}${selection} }`
            // Payloads stay on screen only; reports include field names, not values.
            row.inputFields = Object.keys(vars)
            row.variables = vars
            const deleteSpec = { deleteWebform: ["webform", "webformId", vars.webformId], deleteWebformDefinition: ["webformDefinition", "webformDefinitionId", vars.id], deleteEncounterCorrespondence: ["encounter", "correspondenceId", vars.correspondenceId] }[name]
            if (deleteSpec) {
              const [rootName, key, deletedId] = deleteSpec
              const root = apiInventory.queries.find((operation) => operation.name === rootName)
              const arg = root?.args.find((argument) => argument.name === "id")
              if (arg) {
                const isCorrespondence = name === "deleteEncounterCorrespondence"
                const readId = isCorrespondence ? need("encounterId") : deletedId
                const query = `query VerifyMoisWrite($id: ${typeText(arg.type)}) { ${rootName}(id: $id) { ${isCorrespondence ? "encounterId correspondences { correspondenceId }" : key} } }`
                const before = await request("VerifyMoisWrite", query, { id: readId })
                const records = isCorrespondence ? (before[rootName] || []).flatMap((record) => record.correspondences || []) : before[rootName] || []
                row.deletePreviouslyPresent = records.some((record) => Number(record[key]) === Number(deletedId))
              }
            }
            row.status = "Sent; outcome pending"
            update(`Writing ${name}…`)
            sent = true
            row.sent = true
            const data = await request("ProbeMoisWrite", row.query, vars, true)
            const result = data[op.name]
            const deletion = { deleteWebform: ["webform", "webformId", vars.webformId], deleteWebformDefinition: ["webformDefinition", "webformDefinitionId", vars.id], deleteEncounterCorrespondence: ["encounter", "correspondenceId", vars.correspondenceId] }[name]
            if (deletion) {
              const [rootName, key, deletedId] = deletion
              const root = apiInventory.queries.find((operation) => operation.name === rootName)
              const arg = root?.args.find((argument) => argument.name === "id")
              if (arg) {
                const nestedDelete = name === "deleteEncounterCorrespondence"
                const readId = nestedDelete ? need("encounterId") : deletedId
                row.verificationQuery = `query VerifyMoisWrite($id: ${typeText(arg.type)}) { ${rootName}(id: $id) { ${nestedDelete ? "encounterId correspondences { correspondenceId }" : key} } }`
                const check = await request("VerifyMoisWrite", row.verificationQuery, { id: readId })
                const results = check[rootName]
                const records = nestedDelete && Array.isArray(results) ? results.flatMap((record) => record.correspondences || []) : results
                const validResponse = Array.isArray(records) && (!nestedDelete || results.some((record) => Number(record.encounterId) === readId))
                const absent = row.deletePreviouslyPresent && validResponse && !records.some((record) => Number(record[key]) === Number(deletedId))
                row.status = absent ? "Delete verified" : "Delete unverified"
                row.verification = absent ? "Verified: test record absent on independent read" : "Deletion unverified: record not established before deletion, still returned, or read response incomplete"
                row.recordId = deletedId
                row.cleanup = absent ? "This test record was deleted" : "Deletion not established"
                update(`Checked deletion ${name}`)
                continue
              }
            }
            row.status = result == null || (Array.isArray(result) && result.length === 0) ? "No result; persistence unverified" : "Mutation accepted; persistence unverified"
            const returned = Array.isArray(result) ? result : result == null ? [] : [result]
            if (returned.some((r) => r?.patientId != null && name !== "registerNewPatient" && Number(r.patientId) !== patientId)) throw new Error("Returned patient differs from the active chart")
            if (name === "registerNewPatient") {
              const returnedId = returned.length === 1 ? Number(returned[0]?.patientId) : 0
              const byId = Number.isSafeInteger(returnedId) && returnedId > 0
              const rootName = byId ? "patient" : "findByName"
              row.verificationQuery = byId ? `query VerifyMoisWrite($id: Int) { patient(id: $id) { patientId note } }` : `query VerifyMoisWrite($name: String, $first: Int) { findByName(name: $name, first: $first) { patientId note } }`
              const nameText = [vars.newPatient?.name?.first, vars.newPatient?.name?.family].filter(Boolean).join(" ")
              const check = await request("VerifyMoisWrite", row.verificationQuery, byId ? { id: returnedId } : { name: nameText, first: 10 })
              const matches = (check[rootName] || []).filter((record) => record.note === marker && Number(record.patientId) > 0)
              if (matches.length === 1) { row.recordId = Number(matches[0].patientId); ids.registeredPatientId = row.recordId; row.verification = "Verified: new patient note read back"; row.status = "Write verified" }
              else row.verification = "New patient not uniquely verified on independent read"
              update("Checked patient registration")
              continue
            }
            if (name === "addWebformResource") {
              row.verificationQuery = "query VerifyMoisResource($id: Int!) { webformResource(webformDefinitionId: $id) { webformResourceId webformDefinitionId pathname contents } }"
              const check = await request("VerifyMoisResource", row.verificationQuery, { id: vars.resource.webformDefinitionId })
              const matches = (check.webformResource || []).filter((record) => Number(record.webformDefinitionId) === Number(vars.resource.webformDefinitionId) && Number(record.webformResourceId) > 0 && record.pathname === vars.resource.pathname && record.contents === vars.resource.contents)
              const matched = matches.length === 1 && typeof vars.resource.pathname === "string" && typeof vars.resource.contents === "string"
              row.verification = matched ? "Verified: resource pathname and contents read back" : "Resource pathname and contents not uniquely verified on independent read"
              if (matched) { row.status = "Write verified"; row.recordId = Number(matches[0].webformResourceId); ids.webformResourceId = row.recordId }
              update("Checked webform resource")
              continue
            }
            const records = nested ? returned.flatMap((record) => record[collection] || []) : returned
            const idKey = ownKeys[targetType]
            const marked = records.filter((record) => Object.values(record || {}).some((value) => typeof value === "string" && value.includes(marker)))
            const candidate = marked.length === 1 ? marked[0] : !nested && records.length === 1 && !name.startsWith("delete") ? records[0] : null
            if (name === "addWebform" && Number(candidate?.documentId) > 0) ids.webformDocumentId = Number(candidate.documentId)
            if (idKey && Number(candidate?.[idKey]) > 0) { ids[idKey] = Number(candidate[idKey]); row.recordId = ids[idKey] }
            if (collection && !["correspondences", "favouriteMedications"].includes(collection) && idKey && !name.startsWith("delete")) {
              const readQuery = `query VerifyMoisWrite($patientId: Int) { patient(id: $patientId) { patientId ${collection} { ${await scalarSelection(recordType, ownKeys[targetType])} } } }`
              row.verificationQuery = readQuery
              const readData = await request("VerifyMoisWrite", readQuery, { patientId })
              const chart = readData.patient?.find((p) => Number(p.patientId) === patientId)
              const readRecords = chart?.[collection] || []
              const matches = readRecords.filter((r) => Object.values(r).some((value) => typeof value === "string" && value.includes(marker)))
              if (!row.recordId && matches.length === 1 && Number(matches[0][idKey]) > 0) { row.recordId = Number(matches[0][idKey]); ids[idKey] = row.recordId; row.idRecovery = "Unique marker found on independent read" }
              const record = row.recordId ? readRecords.find((r) => Number(r[idKey]) === row.recordId) : null
              const expected = name === "changeObservations" ? marker + " UPDATED" : marker
              row.verification = record && Object.values(record).some((value) => typeof value === "string" && value.includes(expected)) ? "Verified: test marker read back" : record ? "Record ID read back; test value not verified" : "Not found on independent read"
              if (row.verification === "Verified: test marker read back") row.status = "Write verified"
            } else {
              const rootForType = { Webform: "webform", WebformDefinition: "webformDefinition", MoisTask: "task", FavouriteMedication: "favouriteMedication", Correspondence: "encounter" }
              const rootName = rootForType[targetType]
              const rootOp = apiInventory.queries.find((q) => q.name === rootName)
              if (rootOp && (row.recordId || ["MoisTask", "FavouriteMedication"].includes(targetType)) && !name.startsWith("delete")) {
                const argName = targetType === "FavouriteMedication" ? "favouriteMedicationId" : "id"
                const arg = rootOp.args.find((a) => a.name === argName)
                if (arg) {
                  const readId = targetType === "Correspondence" ? need("encounterId") : row.recordId
                  const readSelection = targetType === "Correspondence" ? `encounterId correspondences { ${await scalarSelection(recordType, ownKeys[targetType])} }` : await scalarSelection(recordType, ownKeys[targetType])
                  row.verificationQuery = row.recordId ? `query VerifyMoisWrite($id: ${typeText(arg.type)}) { ${rootName}(${argName}: $id) { ${readSelection} } }` : targetType === "MoisTask" ? `query VerifyMoisWrite($patientId: Int) { task(patientId: $patientId) { ${readSelection} } }` : `query VerifyMoisWrite { favouriteMedication { ${readSelection} } }`
                  const readData = await request("VerifyMoisWrite", row.verificationQuery, row.recordId ? { id: readId } : targetType === "MoisTask" ? { patientId } : {})
                  const readRecords = targetType === "Correspondence" ? (readData[rootName] || []).flatMap((r) => r.correspondences || []) : readData[rootName] || []
                  const matches = readRecords.filter((r) => Object.values(r).some((value) => typeof value === "string" && value.includes(marker)))
                  if (!row.recordId && matches.length === 1 && Number(matches[0][idKey]) > 0) { row.recordId = Number(matches[0][idKey]); ids[idKey] = row.recordId; row.idRecovery = "Unique marker found on independent read" }
                  const record = row.recordId ? readRecords.find((r) => Number(r[idKey]) === row.recordId) : null
                  row.verification = record && Object.values(record).some((value) => typeof value === "string" && value.includes(marker)) ? "Verified: test marker read back" : record ? "Record ID read back; test value not verified" : "Not found on independent read"
                  if (row.verification === "Verified: test marker read back") row.status = "Write verified"
                  if (["updateWebform", "updateWebformDefinition", "signWebform"].includes(name)) {
                    const submitted = name === "updateWebform" ? vars.webform : name === "signWebform" ? vars.signatureRecord : vars.webformDefinition
                    const candidates = name === "updateWebform" ? ["formdata", "note", "isDraft"] : name === "signWebform" ? ["recordState"] : ["title", "name", "comment"]
                    const fields = candidates.filter((field) => submitted?.[field] !== undefined)
                    const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value
                    const matchesValue = (field) => {
                      if (!record) return false
                      if (field !== "formdata") return record[field] === submitted[field]
                      try { return JSON.stringify(canonical(JSON.parse(record[field]))) === JSON.stringify(canonical(JSON.parse(submitted[field]))) } catch (_) { return false }
                    }
                    row.verificationChecks = fields.map((field) => ({ field, matched: matchesValue(field) }))
                    const matched = fields.length > 0 && row.verificationChecks.every((check) => check.matched)
                    row.status = matched ? "Write verified" : "Mutation accepted; persistence unverified"
                    row.verification = matched ? "Verified: submitted update fields read back" : "Submitted update fields not independently verified; an unchanged marker is insufficient"
                  }
                }
              }
              if (name === "changePatientName" && vars.newNickName) {
                const fields = ["first", "family"].filter((key) => vars.newNickName[key] !== undefined)
                if (fields.length) {
                  row.verificationQuery = `query VerifyMoisWrite($patientId: Int!) { patient(id: $patientId) { patientId nickName { ${fields.join(" ")} text } } }`
                  const check = await request("VerifyMoisWrite", row.verificationQuery, { patientId })
                  const nickName = check.patient?.find((record) => Number(record.patientId) === patientId)?.nickName
                  row.verificationChecks = fields.map((field) => ({ field: `nickName.${field}`, matched: Boolean(nickName && nickName[field] === vars.newNickName[field]) }))
                  const matched = row.verificationChecks.every((check) => check.matched)
                  row.verification = matched ? "Verified: submitted nickname fields read back; formatted text and usual name not verified" : "Submitted nickname fields did not match independent read"
                  if (matched) row.status = "Write verified"
                }
              }
              const demographic = { changePatient: ["shortNote", null, vars.newPatient?.shortNote], changePatientAddress: ["address", "line2", vars.newAddress?.line2], changePatientContact: ["telecom", "homeMessage", vars.newContact?.homeMessage], changePatientInsurance: ["insuranceNumber", null, vars.newInsurance?.insuranceNumber] }[name]
              if (demographic && demographic[2] !== undefined) {
                const [field, child, expected] = demographic
                row.verificationQuery = `query VerifyMoisWrite($patientId: Int) { patient(id: $patientId) { patientId ${field}${child ? " { " + child + " }" : ""} } }`
                const readData = await request("VerifyMoisWrite", row.verificationQuery, { patientId })
                const chart = readData.patient?.find((p) => Number(p.patientId) === patientId)
                const value = child ? chart?.[field]?.[child] : chart?.[field]
                row.verification = value === expected ? "Verified: submitted field read back" : "Submitted field did not match independent read"
                if (value === expected) row.status = "Write verified"
              }
              if (row.verification === "Not performed") row.verification = rootOp ? "Read-back requires a usable record ID or supported marker search" : "No independent read-back adapter for this operation"
            }
          } catch (error) {
            row.status = sent ? "Write or verification error; inspect outcome" : "Not attempted"
            row.error = readableError(error.message)
            if (sent && /timed out|Stopped/.test(String(error.message))) {
              uncertainWrite.current = true
              row.status = "Outcome unknown; do not retry automatically"
              update(`Stopped after an uncertain ${name} result. Inspect the test chart before rerunning.`, false)
              break
            }
          }
          update(`Checked ${writeResults.length} write operations`)
        }
        update(uncertainWrite.current ? "Write run stopped with an unknown outcome. Download the report and inspect the test chart before reopening the form." : "Write probes complete. Download results JSON for accepted, verified, failed and unattempted operations. Test records and demographic changes may remain.", false)
        return
      }
      if (mode === "api") {
        apiInventory = { queries: [], mutations: [], inputTypes: [], executionStatus: "Discovery only; no mutations executed" }
        const roots = await request("InspectPatientContextRoots", "query InspectPatientContextRoots { __schema { queryType { name } mutationType { name } } }", {})
        if (!roots?.__schema?.queryType?.name) throw new Error("Root schema was not returned. API discovery is unavailable to this login.")
        for (const [kind, key] of [["queryType", "queries"], ["mutationType", "mutations"]]) {
          const name = roots.__schema[kind]?.name
          if (!name) continue
          const result = await request("InspectPatientContextType", schemaQuery, { name })
          if (!Array.isArray(result?.__type?.fields)) throw new Error(`Fields for ${name} were not returned.`)
          apiInventory[key] = result.__type.fields.map((field) => {
            const adapters = key === "mutations" ? (Array.isArray(writeTargets) ? writeTargets : []).filter((target) => (Array.isArray(target.graphqlField) ? target.graphqlField : [target.graphqlField]).includes(field.name)) : []
            return { name: field.name, type: field.type, args: field.args || [], adapters: adapters.map(({ id, runtimeStatus }) => ({ id, runtimeStatus })), executionStatus: "Not executed", coverage: key === "mutations" ? adapters.some((target) => target.runtimeStatus === "supported") ? "Mapped adapter; live write untested" : "Needs a dedicated write test" : "Discovered root query; not exercised by Patient collection checks" }
          })
        }
        const pending = []
        const enqueue = (type) => {
          const named = namedType(type)
          if (["INPUT_OBJECT", "ENUM"].includes(named?.kind) && validName(named?.name) && !pending.includes(named.name)) pending.push(named.name)
        }
        for (const operation of [...apiInventory.queries, ...apiInventory.mutations]) for (const arg of operation.args) enqueue(arg.type)
        let index = 0
        while (index < pending.length && index < 100 && active()) {
          const name = pending[index++]
          update(`Inspecting input type ${name} (${index})…`)
          const result = await request("InspectPatientContextType", schemaQuery, { name })
          if (!result?.__type) throw new Error(`Input type ${name} was not returned.`)
          const info = { name, kind: result.__type.kind, inputFields: result.__type.inputFields || [], enumValues: result.__type.enumValues || [] }
          apiInventory.inputTypes.push(info)
          for (const field of info.inputFields) enqueue(field.type)
        }
        apiInventory.uninspectedInputTypes = pending.slice(index)
        update(`API discovery complete: ${apiInventory.queries.length} root queries, ${apiInventory.mutations.length} mutations, ${apiInventory.inputTypes.length} input/enum types. No writes executed.`, false)
        return
      }
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
              const ownId = resultType.name[0].toLowerCase() + resultType.name.slice(1) + "Id"
              const rank = (name) => name === ownId ? 0 : ["name", "description", "code", "value", "status"].includes(name) ? 1 : name.endsWith("Date") ? 2 : 3
              scalarFields.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
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
      if (mode === "missing" && missingExploration && active()) { missingExploration.error = readableError(error.message); missingExploration.status = "Exploration incomplete" }
      if (mode === "api" && apiInventory) apiInventory.error = readableError(error.message)
      update(readableError(error.message), false)
    } finally { if (active()) busy.current = false }
  }
  const stop = () => {
    if (pendingWrites.current) uncertainWrite.current = true
    epoch.current += 1
    busy.current = false
    setState((previous) => ({ ...previous, missingExploration: previous.missingExploration && !previous.missingExploration.coverage.completed ? { ...previous.missingExploration, status: "Stopped; exploration incomplete" } : previous.missingExploration, customResults: (previous.customResults || []).map((row) => row.status === "Sent; outcome pending" ? { ...row, status: "Stopped; request may finish" } : row), writeResults: (previous.writeResults || []).map((row) => row.status === "Sent; outcome pending" ? { ...row, status: "Outcome unknown; request may finish" } : row), busy: false, message: "Stopped. Any request already sent may finish; its result will be ignored." }))
  }
  const report = JSON.stringify({
    reportType: "mois-patient-context-live-query",
    reportVersion: 5,
    diagnosticsRevision: "2026-09-10.2",
    missingCollectionExploration: current.missingExploration || null,
    writeResults: (current.writeResults || []).map(({ variables, ...result }) => result),
    rootQueryResults: current.rootResults || [],
    customOperations: (current.customResults || []).map(({ response, ...result }) => result),
    createdTestRecordIds: current.createdIds || {},
    generatedAt: new Date().toISOString(),
    status: current.message,
    schemaFields: current.schemaFields || [],
    apiInventory: current.apiInventory || null,
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
    <p>Run explicit reads against this patient's chart using your current MOIS login. The form inspects the live schema, then queries up to 64 collections one at a time. Read checks do not modify records. Run test writes explicitly sends synthetic mutations to this test chart, including demographic changes. Test records can remain after the run.</p>
    {!ready ? <p>Live checks require the exported form running inside an authenticated MOIS instance. Builder preview cannot perform these checks.</p> : null}
    <button type="button" disabled={!ready || current.busy} onClick={() => run("reads")}>Run live chart checks</button>{" "}
    <button type="button" disabled={!ready || current.busy} onClick={() => run("missing")}>Explore missing collections</button>{" "}
    <button type="button" disabled={!ready || current.busy} onClick={() => run("api")}>Inspect read/write API</button>{" "}
    <button type="button" disabled={!ready || current.busy || !current.apiInventory} onClick={() => run("roots")}>Test root queries</button>{" "}
    <button type="button" disabled={!ready || current.busy || !current.apiInventory || uncertainWrite.current || pendingWrites.current > 0} onClick={() => run("writes")}>Run test writes</button>{" "}
    <details><summary>Custom GraphQL probe</summary><p>Run a named query or mutation through this MOIS login. This supports additional fields and operations without rebuilding the form. Mutations execute immediately when Run custom operation is clicked. Responses appear here, but response values are excluded from the diagnostic report. Query text is included, so use variables for patient values.</p>
      <textarea aria-label="Custom GraphQL query" value={customQuery} disabled={current.busy} onChange={(event) => setCustomQuery(event.target.value)} rows={6} style={{ width: "100%", fontFamily: "monospace" }} />
      <textarea aria-label="Custom GraphQL variables" value={customVariables} disabled={current.busy} onChange={(event) => setCustomVariables(event.target.value)} rows={4} style={{ width: "100%", fontFamily: "monospace" }} />
      <button type="button" disabled={!ready || current.busy} onClick={() => run("custom")}>Run custom operation</button>
      {(current.customResults || []).map((row, index) => <details key={index}><summary>{row.operation} — {row.status}</summary>{row.error ? <p>{row.error}</p> : null}{row.response ? <textarea aria-label={`Custom response ${index + 1}`} readOnly value={row.response} rows={10} style={{ width: "100%", fontFamily: "monospace" }} /> : null}</details>)}
    </details>
    <label>Write operation <select aria-label="Write operation" value={writeSelection} disabled={current.busy} onChange={(event) => setWriteSelection(event.target.value)}><option value="all">All unattempted operations</option><option value="changeObservationPanels">changeObservations — separate panel probe</option>{(current.apiInventory?.mutations || []).map((operation) => <option key={operation.name} value={operation.name}>{operation.name}</option>)}</select></label>
    <details><summary>Test context</summary><p>Provide real test-instance IDs and codes once: providerId for appointments; assignedUserId or assignedTeamId for tasks; service with code/system/display for service episodes. Optional panelName overrides the vendor test panel coding. Missing context is reported before sending a write.</p>
      <textarea aria-label="Test context JSON" value={testContext} disabled={current.busy} onChange={(event) => setTestContext(event.target.value)} rows={5} style={{ width: "100%", fontFamily: "monospace" }} />
    </details>
    <details><summary>Write test inputs</summary>
      <button type="button" disabled={current.busy || writeSelection === "all" || !(current.writeResults || []).some((row) => row.operation === writeSelection && row.variables)} onClick={() => { const row = [...current.writeResults].reverse().find((entry) => entry.operation === writeSelection && entry.variables); setWriteOverrides(JSON.stringify({ [writeSelection]: row.variables }, null, 2)) }}>Load last inputs for selected operation</button><p>Default probes use a unique WEBFORMS TEST marker. For operations requiring local codes or IDs, provide complete GraphQL variables keyed by mutation name (or query:name for root reads). Overrides replace that operation's defaults. Use "$created.encounterId" (or another created ID key) to reference a record from this session and "$patientId" for the active chart. All unattempted skips previously sent mutations; choose one operation explicitly to retry it. Created IDs survive retries until the chart changes or the form closes. Fax delivery requires selecting sendFax individually and providing an account and explicit test recipients. Update and delete defaults target records created during this run.</p>
      <textarea aria-label="Write variable overrides JSON" value={writeOverrides} disabled={current.busy} onChange={(event) => setWriteOverrides(event.target.value)} rows={6} style={{ width: "100%", fontFamily: "monospace" }} />
    </details>
    {current.missingExploration ? <details open><summary>Missing collection exploration</summary>
      <p>{current.missingExploration.status}. This test reads schema metadata and candidate paths only. Related APIs are not assumed to contain equivalent records.</p>
      <p>Search bounds: depth {current.missingExploration.limits.maxDepth}, {current.missingExploration.limits.pathsPerCollection} paths per collection, {current.missingExploration.limits.maxProbes} reads. {current.missingExploration.coverage.probesSent} reads sent. {current.missingExploration.coverage.truncated ? "Limits reached; search is not exhaustive." : ""}</p>
      {current.missingExploration.error ? <p>{current.missingExploration.error}</p> : null}
      <ul>{current.missingExploration.collections.map((row) => <li key={row.collection}><strong>{row.collection}</strong> — {row.status}
        {row.paths.length ? <details><summary>Explored paths ({row.paths.length})</summary><ul>{row.paths.map((entry, index) => <li key={index}><code>{entry.path}</code> — {entry.status}{entry.count !== undefined ? ` · ${entry.count} returned` : ""}<p>{entry.scope}. {entry.relation}.</p>{entry.error ? <p>{entry.error}</p> : null}</li>)}</ul></details> : null}
      </li>)}</ul>
    </details> : null}
    {current.rootResults?.length ? <details open><summary>Root query results</summary><ul>{current.rootResults.map((row) => <li key={row.operation}><code>{row.operation}</code> — {row.status}{row.error ? <p>{row.error}</p> : null}</li>)}</ul></details> : null}
    {current.writeResults?.length ? <details open><summary>Write test results</summary><ul>{current.writeResults.map((row, index) => <li key={index}><code>{row.operation}</code> — {row.status}. {row.verification}{row.recordId ? ` · Test record ${row.recordId}` : ""}{row.error ? <p>{row.error}</p> : null}{row.variables ? <details><summary>Inputs sent (kept out of report)</summary><pre>{JSON.stringify(row.variables, null, 2)}</pre></details> : null}</li>)}</ul></details> : null}
    {current.busy ? <button type="button" onClick={stop}>Stop checks</button> : null}
    {" "}<button type="button" disabled={!current.hasRun || current.busy} onClick={downloadReport}>Download results JSON</button>
    <p role="status" aria-live="polite">{current.message}</p>
    {current.hasRun && !current.busy ? <details><summary>JSON report (copy or download)</summary>
      <p>Includes schema fields, counts, queries, errors, write outcomes, test markers and created record IDs. Input values and record samples are excluded. Server error messages may contain submitted values; review the JSON before sharing. Nothing is sent automatically.</p>
      <textarea aria-label="Live query results JSON" readOnly value={report} rows={12} style={{ width: "100%", fontFamily: "monospace" }} />
    </details> : null}
    {current.apiInventory ? <details><summary>Read/write API coverage</summary>
      <p>{current.apiInventory.queries.length} root queries · {current.apiInventory.mutations.length} mutations · {current.apiInventory.inputTypes.length} input/enum types. Discovery does not execute writes. The separate write results below record actual attempts.</p>
      <ul>{current.apiInventory.mutations.map((operation) => <li key={operation.name}><code>{operation.name}</code> — {current.writeResults?.filter((row) => row.operation === operation.name).slice(-1)[0]?.status || operation.coverage}</li>)}</ul>
      <details><summary>Operation arguments and input fields</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto" }}>{JSON.stringify({ operations: [...current.apiInventory.queries, ...current.apiInventory.mutations].map(({ name, args }) => ({ name, args })), inputTypes: current.apiInventory.inputTypes }, null, 2)}</pre>
      </details>
      {current.apiInventory.error ? <p>{current.apiInventory.error}</p> : null}
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
