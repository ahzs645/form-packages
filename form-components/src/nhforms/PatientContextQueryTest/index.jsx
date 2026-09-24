// Portable suite executor: embedded with this component in exported MOIS forms.
// Uses only the host GraphQL transport and the live schema. No endpoint guessing.
const runPatientContextVariantSuite = async ({ request, patientId, patient, sourceProfile, context, plan, previous, active, emit, uncertain, uploadAttachment, priorProfiles = [] }) => {
  const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v))
  const subset = (actual, expected) => Array.isArray(expected) ? Array.isArray(actual) && actual.length === expected.length && expected.every((x, i) => subset(actual[i], x)) : expected && typeof expected === "object" ? Boolean(actual && Object.keys(expected).every((k) => Object.prototype.hasOwnProperty.call(actual, k) && subset(actual[k], expected[k]))) : actual === expected
  // Same-day date strings may come back with a time part; record the normalization instead of failing.
  const dateEquivalent = (actual, expected) => typeof actual === "string" && typeof expected === "string" && /^\d{4}-\d{2}-\d{2}/.test(actual) && /^\d{4}-\d{2}-\d{2}/.test(expected) && (expected.length === 10 ? actual.slice(0, 10) === expected : actual.slice(0, 19) === expected.slice(0, 19) || (!Number.isNaN(Date.parse(actual)) && Date.parse(actual) === Date.parse(expected)))
  // A created child/record ID supplied as 0 is matched by any generated ID.
  const seedMatch = (actual, expected, key = "") => Array.isArray(expected) ? Array.isArray(actual) && actual.length === expected.length && expected.every((x, i) => seedMatch(actual[i], x)) : expected && typeof expected === "object" ? Boolean(actual && Object.keys(expected).every((k) => Object.prototype.hasOwnProperty.call(actual, k) && seedMatch(actual[k], expected[k], k))) : expected === 0 && /Id$/.test(key) ? Number.isSafeInteger(Number(actual)) && Number(actual) >= 0 : actual === expected || dateEquivalent(actual, expected)
  const same = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
  const normalize = (v) => Array.isArray(v) ? v.map(normalize) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).filter((k) => k !== "__typename").sort().map((k) => [k, normalize(v[k])])) : v
  const named = (t) => t?.ofType ? named(t.ofType) : t
  const typeText = (t) => t.kind === "NON_NULL" ? typeText(t.ofType) + "!" : t.kind === "LIST" ? "[" + typeText(t.ofType) + "]" : t.name
  if (!plan?.profiles?.length) throw new Error("Re-export the updated diagnostics sample to include the comprehensive test plan")
  if (previous?.patientId != null && Number(previous.patientId) !== patientId) throw new Error("Saved suite progress belongs to another patient; no suite writes sent")
  const suite = previous || { revision: plan.revision, patientId, status: "Running", cases: [], ids: {}, origins: {}, created: [], fieldCoverage: [], manualCases: plan.manualCases, startedAt: new Date().toISOString() }
  suite.patientId = patientId; suite.status = "Running"
  const ctx = { ...context }, ids = suite.ids
  const prior = new Set(priorProfiles || [])
  const notify = () => { if (active()) emit({ ...suite, cases: [...suite.cases], ids: { ...ids } }) }
  const record = (row) => { const i = suite.cases.findIndex((x) => x.id === row.id); if (i < 0) suite.cases.push(row); else suite.cases[i] = row; notify(); return row }
  // A case is retried only when no request was sent for it; sent cases are never repeated automatically.
  const done = (id) => suite.cases.some((x) => x.id === id && (x.sent || !["Needs context", "Pending", "Running", "Stopped before result"].includes(x.status)))
  const fail = (reason) => { throw new Error(reason) }
  const positive = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0
  let mutationCount = 0
  const refs = "kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } }"
  const schema = (await request("SuiteSchema", `query SuiteSchema { __schema { queryType { name } mutationType { name } types { name kind fields { name args { name defaultValue type { ${refs} } } type { ${refs} } } inputFields { name defaultValue type { ${refs} } } enumValues { name } } } }`, {})).__schema
  if (!schema?.types || !schema.queryType || !schema.mutationType) fail("Complete live schema unavailable")
  const types = new Map(schema.types.map((t) => [t.name, t]))
  const queries = new Map((types.get(schema.queryType.name)?.fields || []).map((f) => [f.name, f]))
  const mutations = new Map((types.get(schema.mutationType.name)?.fields || []).filter((f) => f.name !== "query").map((f) => [f.name, f]))
  const refValue = (v, marker, recordId) => {
    const values = { patientId, date: new Date().toISOString().slice(0, 10), now: new Date().toISOString(), marker, slug: marker.toLowerCase().replace(/[^a-z0-9]+/g, "-"), buildDate: new Date().toISOString().slice(0, 10).replace(/-/g, ""), resourcePath: marker.replace(/ /g, "-") + ".txt", answers: JSON.stringify({ diagnostic: marker, retained: "preserve this answer" }), recordId }
    if (typeof v === "string" && v.startsWith("$")) {
      const key = v.slice(1), value = key.startsWith("context.") ? ctx[key.slice(8)] : key.startsWith("ids.") ? ids[key.slice(4)] : values[key]
      if (value === undefined || value === null) fail(`Needs ${key}`)
      return clone(value)
    }
    return Array.isArray(v) ? v.map((x) => refValue(x, marker, recordId)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, refValue(x, marker, recordId)])) : v
  }
  const validate = (v, t, path) => {
    if (v == null) { if (t.kind === "NON_NULL") fail(`Missing ${path}`); return }
    if (t.kind === "NON_NULL") return validate(v, t.ofType, path)
    if (t.kind === "LIST") { if (!Array.isArray(v)) fail(`${path} needs an array`); v.forEach((x, i) => validate(x, t.ofType, `${path}[${i}]`)); return }
    if (t.kind === "INPUT_OBJECT") {
      const fields = types.get(t.name)?.inputFields
      if (!fields || typeof v !== "object" || Array.isArray(v)) fail(`Missing input contract ${path}`)
      for (const k of Object.keys(v)) if (!fields.some((f) => f.name === k)) fail(`Unknown input ${path}.${k}`)
      for (const f of fields) if (f.defaultValue == null || v[f.name] !== undefined) validate(v[f.name], f.type, path + "." + f.name)
    } else if (t.kind === "ENUM" && !types.get(t.name)?.enumValues?.some((x) => x.name === v)) fail(`Invalid enum ${path}`)
    else if (["Int", "Long"].includes(t.name) && !Number.isSafeInteger(v)) fail(`Invalid integer ${path}`)
    else if (t.name === "Boolean" && typeof v !== "boolean") fail(`Invalid boolean ${path}`)
    else if (t.name === "String" && typeof v !== "string") fail(`Invalid text ${path}`)
  }
  const selection = (typeName, depth = 0, ancestors = []) => {
    const info = types.get(typeName)
    if (!info || depth > 6 || ancestors.includes(typeName)) return ""
    return (info.fields || []).filter((f) => !f.args?.some((a) => a.type.kind === "NON_NULL" && a.defaultValue == null)).flatMap((f) => {
      if (["patient", "encodedFile", "secondaryFile", "photo", "signature", "signatures", "requestor", "assignedUser"].includes(f.name)) return []
      const t = named(f.type)
      if (["SCALAR", "ENUM"].includes(t?.kind)) return [f.name]
      // Follow input-shaped objects and coded/audit values, not arbitrary chart relationships.
      const inputFields = types.get(typeName + "Input")?.inputFields || []
      if (!["stamp", "version", "formVersion", "codedValue"].includes(f.name) && !inputFields.some((x) => x.name === f.name) && !["Coding", "CodingReference"].includes(t?.name)) return []
      const sub = selection(t?.name, depth + 1, [...ancestors, typeName])
      return sub ? [`${f.name} { ${sub} }`] : []
    }).join(" ")
  }
  const call = async (field, args, fields, mutation = false, tag = "Read") => {
    const op = (mutation ? mutations : queries).get(field)
    if (!op) fail(`Not exposed in live schema: ${field}`)
    for (const k of Object.keys(args)) if (!op.args.some((a) => a.name === k)) fail(`Unknown argument ${field}.${k}`)
    for (const a of op.args) if (a.defaultValue == null || args[a.name] !== undefined) validate(args[a.name], a.type, a.name)
    const argsUsed = op.args.filter((a) => args[a.name] !== undefined), kind = mutation ? "mutation" : "query", name = "Suite" + tag
    const decl = argsUsed.map((a) => `$${a.name}: ${typeText(a.type)}`).join(", "), binds = argsUsed.map((a) => `${a.name}: $${a.name}`).join(", ")
    const object = ["OBJECT", "INTERFACE", "UNION"].includes(named(op.type)?.kind)
    if (mutation) { mutationCount += 1; const pending = [...suite.cases].reverse().find((x) => x.status === "Running" && x.operation === field); if (pending) { pending.sent = true; record(pending) } }
    return request(name, `${kind} ${name}${decl ? "(" + decl + ")" : ""} { ${field}${binds ? "(" + binds + ")" : ""}${object ? " { " + (fields || "__typename") + " }" : ""} }`, args, mutation)
  }
  const init = { id: "context", status: "Running", variant: "read context" }; record(init)
  try {
    const charts = (await call("patient", { id: patientId }, "patientId conditions { condition { code display system } certainty { code display system } } encounters { encounterId providerId status { code display system } } serviceEpisodes { serviceEpisodeId service { code display system } serviceMrp { code display system } serviceMrpId serviceEvents { service { code display system } } }", false, "Context")).patient
    if (charts?.length !== 1 || Number(charts[0].patientId) !== patientId) fail("Requested patient not uniquely returned")
    const chart = charts[0]
    const requestedEncounter = ctx.encounterId || patient?.encounterId
    const encounter = requestedEncounter ? chart.encounters?.find((x) => Number(x.encounterId) === Number(requestedEncounter)) : chart.encounters?.find((x) => positive(x.encounterId))
    if (requestedEncounter && !encounter) fail("Configured encounter does not belong to this patient")
    if (encounter) { ctx.encounterId = Number(encounter.encounterId); ctx.providerId ??= encounter.providerId }
    const profileId = ctx.userProfileId || sourceProfile?.userProfileId
    if (positive(profileId)) {
      const profiles = (await call("userProfile", { id: Number(profileId) }, "userProfileId loginName identity { fullName }", false, "Profile")).userProfile
      if (profiles?.length !== 1 || Number(profiles[0].userProfileId) !== Number(profileId)) fail("Test profile not uniquely returned")
      ctx.userProfileId = Number(profileId); ctx.userName = profiles[0].identity?.fullName
    }
    const issue = chart.conditions?.find((x) => x.condition?.code && x.condition?.system)
    if (issue) { ctx.healthIssue ??= issue.condition; ctx.certainty ??= issue.certainty }
    const episode = chart.serviceEpisodes?.find((x) => x.service?.code && positive(x.serviceMrpId) && x.serviceMrp?.system === "MOIS.USER" && String(x.serviceMrp.code) === String(x.serviceMrpId))
    if (episode) { ctx.service ??= episode.service; ctx.serviceMrp ??= episode.serviceMrp; ctx.serviceMrpId ??= episode.serviceMrpId }
    ctx.eventService ??= chart.serviceEpisodes?.flatMap((x) => x.serviceEvents || []).find((x) => x.service?.code)?.service
    // Status codings already used on this patient's encounters are instance-valid candidates.
    const statuses = (chart.encounters || []).map((x) => x.status).filter((x) => x?.code && x?.system)
    ctx.appointmentStatusCandidates = statuses.filter((x, i) => statuses.findIndex((y) => y.code === x.code && y.system === x.system) === i).map(clone)
    init.status = "Read verified"; init.contextFields = Object.keys(ctx); suite.context = clone(ctx)
  } catch (e) { init.status = "Needs context"; init.error = e.message; record(init); fail("Context verification failed; no suite writes sent: " + e.message) }
  record(init)
  const copyInput = (value, t, depth = 0) => {
    if (value == null || depth > 8) return value
    if (t.kind === "NON_NULL") return copyInput(value, t.ofType, depth)
    if (t.kind === "LIST") return Array.isArray(value) ? value.map((x) => copyInput(x, t.ofType, depth + 1)) : value
    if (t.kind !== "INPUT_OBJECT") return clone(value)
    return Object.fromEntries((types.get(t.name)?.inputFields || []).filter((f) => !["stamp", "patient"].includes(f.name) && Object.prototype.hasOwnProperty.call(value, f.name)).map((f) => [f.name, copyInput(value[f.name], f.type, depth + 1)]))
  }
  const withoutAudit = (v) => Array.isArray(v) ? v.map(withoutAudit) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => !["stamp", "__typename", "cursor"].includes(k)).map(([k, x]) => [k, withoutAudit(x)])) : v
  const diffs = (a, b, prefix = "") => {
    if (same(a, b)) return []
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diffs(a[k], b[k], prefix ? prefix + "." + k : k))
    return [prefix || "record"]
  }
  const tools = (p, marker) => {
    const fields = selection(p.type)
    const read = async (id = ids[p.key]) => {
      let wrapped = fields
      for (const path of [...p.path].reverse()) wrapped = `${path} { ${wrapped} }`
      if (p.readRoot === "patient") wrapped = "patientId " + wrapped
      if (p.readRoot === "encounter") wrapped = "patientId encounterId " + wrapped
      const args = refValue(p.readArgs, marker, id)
      const data = await call(p.readRoot, args, wrapped, false, "Verify")
      let records = data[p.readRoot]
      if (!Array.isArray(records)) fail("Read did not return a collection")
      if (["patient", "encounter"].includes(p.readRoot) && (records.length !== 1 || Number(records[0].patientId) !== patientId)) fail("Read returned a different or missing patient")
      if (p.readRoot === "encounter" && Number(records[0].encounterId) !== Number(ctx.encounterId)) fail("Read returned a different encounter")
      if (args.first && records.length >= args.first) fail("Read reached its page limit; complete pagination is required before writing")
      for (const path of p.path) {
        if (p.objectPath) { if (records.some((r) => !r[path] || typeof r[path] !== "object")) fail(`Missing read object ${path}`); records = records.map((r) => ({ ...r[path], patientId })) }
        else { if (records.some((r) => !Array.isArray(r[path]))) fail(`Missing read collection ${path}`); records = records.flatMap((r) => r[path]) }
      }
      if (records.some((r) => r.patientId != null && Number(r.patientId) !== patientId)) fail("Record patient differs from the active patient")
      return records
    }
    const mutArgs = (payload, create = false) => {
      const field = create ? p.create : p.update, op = mutations.get(field)
      if (!op) fail(`Not exposed in live schema: ${field}`)
      const arg = create ? p.inputArg : p.updateArg || p.inputArg
      return { ...(op.args.some((a) => a.name === "patientId") ? { patientId } : {}), ...refValue(create ? p.extraCreateArgs || p.extraArgs || {} : p.extraArgs || {}, marker, ids[p.key]), [arg]: (create ? p.inputList : p.updateList || p.inputList) ? [payload] : payload }
    }
    const inputArg = (create = false) => mutations.get(create ? p.create : p.update)?.args.find((a) => a.name === (create ? p.inputArg : p.updateArg || p.inputArg))
    return { fields, read, mutArgs, inputArg }
  }
  // Nested child/back-reference IDs become 0 so a cloned row is submitted as new.
  const zeroNestedIds = (value, depth = 0) => Array.isArray(value) ? value.map((x) => zeroNestedIds(x, depth + 1)) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, x]) => [k, depth > 0 && /Id$/.test(k) && k !== "patientId" && positive(x) ? 0 : zeroNestedIds(x, depth + 1)])) : value
  for (const [profileIndex, p] of plan.profiles.entries()) {
    if (!active() || uncertain()) break
    suite.progress = { group: profileIndex + 1, groups: plan.profiles.length, key: p.key }; notify()
    if (prior.has(p.key) && !suite.cases.some((x) => x.profile === p.key)) {
      record({ id: p.key + ".earlier-load", profile: p.key, status: "Skipped: started in an earlier load of this form", reason: "This browser recorded requests for this test group in an earlier load. They are not repeated, to avoid duplicate records and restoring to an intermediate value. Reconcile with that load's evidence file." })
      continue
    }
    const marker = suite.origins[p.key]?.marker || `WEBFORMS TEST ${Date.now().toString(36)} ${p.key}`
    const { fields, read, mutArgs, inputArg } = tools(p, marker)
    let origin = suite.origins[p.key], rows
    try {
      if (!fields) fail("No readable output fields")
      if (p.path.length && !queries.has(p.readRoot)) fail("No read route")
      rows = p.singletonCreate && !ids[p.key] ? [] : await read()
      for (const mode of p.create ? p.createModes || ["seed"] : []) {
        const id = `${p.key}.create.${mode}`
        if (done(id)) continue
        let row = { id, profile: p.key, operation: p.create, variant: "create " + mode, status: "Running", sent: false }; record(row)
        const before = rows
        try {
          let seed
          if (mode === "clone-existing") {
            // Copy every input-supported field of an existing positive-ID row, then
            // replace identity/marker fields. Tests whether a complete shape creates.
            const source = before.find((r) => positive(r[p.id]))
            if (!source) { row.status = "Needs context"; row.reason = "No existing positive-ID row to clone"; record(row); continue }
            seed = { ...zeroNestedIds(copyInput(source, named(inputArg(true)?.type))), ...refValue(p.seed, marker + " " + mode) }
            seed[p.id] = 0; row.clonedFrom = Number(source[p.id])
          } else seed = refValue(p.seed, marker + " " + mode)
          if (mode === "zero") seed[p.id] = 0
          if (mode === "null") seed[p.id] = null
          if (mode === "omitted") delete seed[p.id]
          const args = mutArgs(seed, true); let response, error
          row.inputFields = Object.keys(seed)
          const sentBefore = mutationCount
          try { response = await call(p.create, args, fieldsForMutation(p.create, p.type, fields), true, "Create") } catch (e) { error = e.message }
          row.sent = mutationCount > sentBefore
          if (!row.sent) { row.status = "Needs context"; row.error = error; record(row); continue }
          if (p.singletonCreate) {
            const candidates = response?.[p.create] || []
            const found = candidates.filter((r) => positive(r[p.id]) && Number(r.patientId) === patientId)
            if (found.length !== 1) fail("Creation outcome uncertain: no unique ID to independently read")
            ids[p.key] = Number(found[0][p.id])
          }
          rows = await read()
          if (uncertain()) fail("Write timed out; its eventual outcome is unknown")
          const beforeIds = new Set(before.map((r) => Number(r[p.id])))
          const scalarMarkers = Object.keys(seed).filter((k) => typeof seed[k] === "string" && seed[k].includes(marker))
          const candidates = rows.filter((r) => positive(r[p.id]) && !beforeIds.has(Number(r[p.id])) && (p.key === "events" ? Number(r.serviceEpisodeId) === ids.episodes && Number(r.objectId) === ctx.encounterId && r.objectType === seed.objectType && subset(r.service, seed.service) : scalarMarkers.length && scalarMarkers.every((k) => r[k] === seed[k])))
          const preserved = before.every((r) => same(withoutAudit(r), withoutAudit(rows.find((x) => Number(x[p.id]) === Number(r[p.id])))))
          if (candidates.length === 1 && rows.length === before.length + 1 && preserved) {
            const created = candidates[0]; ids[p.key] ||= Number(created[p.id]); row.inputChecks = Object.keys(seed).filter((k) => k !== p.id).map((k) => ({ field: k, matched: seedMatch(created[k], seed[k], k) })); row.status = row.inputChecks.every((x) => x.matched) ? error ? "Create verified after mutation error" : "Create verified" : "Created record identified; supplied fields differ"; row.recordId = Number(created[p.id]); row.changedFields = scalarMarkers
            suite.created.push({ profile: p.key, id: row.recordId, key: p.id, cleanup: p.delete ? "Pending deletion" : p.negativeIdDelete ? "Pending negative-ID delete test" : "No dedicated delete recipe; retained" })
            if (!origin) { origin = { marker, record: clone(created), id: ids[p.key] }; suite.origins[p.key] = origin }
          } else if (same(withoutAudit(rows), withoutAudit(before))) { row.status = error ? "Rejected; selected read unchanged" : "Create not verified" }
          else { row.status = "Unexpected read changes; profile stopped"; row.stopProfile = true }
          if (error) row.error = error
        } catch (e) { row.status = row.sent ? "Outcome requires inspection" : "Needs context"; row.error = e.message; if (row.sent) row.stopProfile = true }
        record(row)
        if (row.stopProfile || uncertain()) break
      }
      if (suite.cases.some((r) => r.profile === p.key && r.stopProfile)) continue
      if (!origin && p.existingFallback) {
        const selected = ctx[p.id] ? rows.find((r) => Number(r[p.id]) === Number(ctx[p.id])) : rows.find((r) => positive(r[p.id]))
        if (selected) { ids[p.key] = Number(selected[p.id]); origin = { marker, record: clone(selected), id: ids[p.key], existing: true }; suite.origins[p.key] = origin }
      }
      if (!origin) { record({ id: p.key + ".variants", profile: p.key, status: "Needs context", reason: "No independently verified positive-ID record for field variants", variants: p.fields }); continue }
      // Priority sequences (the pending task acknowledgement test) run before generic field variants.
      const metadataFirst = Boolean(p.taskMetadata?.runBeforeFields)
      if (metadataFirst) await taskMetadata(p, read, mutArgs, origin)
      if (suite.cases.some((r) => r.profile === p.key && r.stopProfile) || uncertain()) continue
      for (const field of p.fields) {
        if (!active() || uncertain()) break
        const arg = inputArg(), inputType = named(arg?.type), spec = types.get(inputType?.name)?.inputFields?.find((f) => f.name === field)
        if (!spec || !(field in origin.record)) { record({ id: `${p.key}.${field}`, profile: p.key, field, status: "Needs context", reason: "Field not exposed in both input and selected output" }); continue }
        const original = clone(origin.record[field]), t = named(spec.type)
        let values = p.extraFields?.[field] ? refValue(p.extraFields[field], marker) : null
        if (!values) {
          if (["isComplete", "isAcknowledged", "includeOnDemographics", "includeOnCarePlan"].includes(field)) values = [{ code: "Y", display: "Yes", system: "MOIS-YESNO" }, { code: "N", display: "No", system: "MOIS-YESNO" }]
          else if (["Date", "DateOnly", "DateTime"].includes(t?.name)) values = [t.name === "DateTime" ? new Date().toISOString() : new Date().toISOString().slice(0, 10)]
          else if (["Int", "Long", "Float", "Decimal"].includes(t?.name)) values = [typeof original === "number" ? original + 1 : 1]
          else if (t?.name === "Boolean") values = [!original]
          else if (t?.kind === "ENUM") values = (types.get(t.name)?.enumValues || []).map((x) => x.name).slice(0, 2)
          else if (field === "formdata") { let answers; try { answers = JSON.parse(original || "{}"); if (!answers || Array.isArray(answers) || typeof answers !== "object") throw 0 } catch (_) { fail("Existing answers are not a JSON object") }; values = [JSON.stringify({ ...answers, diagnostic: marker + " UPDATED", suiteVariant: true })] }
          else if (t?.name === "String") values = [marker + " " + field, marker + " " + field + " B"]
        }
        if (!values?.length) { record({ id: `${p.key}.${field}`, profile: p.key, field, status: "Needs context", reason: "Needs type-specific fixture/coding; no arbitrary code is generated" }); continue }
        const cases = [...values.map((value, i) => ({ variant: "set" + (i || ""), value })), { variant: "omit" }, ...(spec.type.kind !== "NON_NULL" ? [{ variant: "null", value: null }, { variant: "set-again", value: values[0] }] : []), ...(t.name === "String" && field !== "formdata" ? [{ variant: "empty", value: "" }] : []), { variant: "restore", value: original }]
        for (const variant of cases) {
          const caseId = `${p.key}.${field}.${variant.variant}`
          if (done(caseId)) continue
          if (!active() || uncertain()) break
          const result = await change(p, field, variant, caseId, read, mutArgs, origin)
          if (result.stopProfile) break
        }
        if (suite.cases.some((r) => r.profile === p.key && r.stopProfile)) break
      }
      if (suite.cases.some((r) => r.profile === p.key && r.stopProfile) || uncertain()) continue
      if (p.nestedDosage) await nestedDosage(p, read, mutArgs, origin)
      if (p.healthIssues) await eventChildren(p, read, mutArgs, origin)
      if (p.taskMetadata && !metadataFirst) await taskMetadata(p, read, mutArgs, origin)
      if (p.encounterStatus) await appointmentStatus(p, read, origin)
      if (p.lifecycle) await formLifecycle(p, read, mutArgs, origin)
      if (p.download) await download(p, read)
      if (p.rejectedUpdateProbe) await correspondenceUpdate(p, read, origin)
      // Dedicated deletion is performed after all profiles, preserving dependencies.
    } catch (e) { record({ id: p.key + ".setup", profile: p.key, status: "Needs context", error: e.message }) }
  }
  if (active() && !uncertain() && plan.attachmentUpload) await attachment()
  // Leave field-level coverage explicit, including inputs that need semantic values.
  const inputPaths = (t, prefix = "", ancestors = []) => {
    const type = named(t), info = types.get(type?.name)
    if (!info?.inputFields || ancestors.includes(type.name)) return []
    return info.inputFields.flatMap((f) => {
      const path = prefix ? prefix + "." + f.name : f.name
      const listType = f.type.kind === "NON_NULL" ? f.type.ofType : f.type
      return [{ ...f, path }, ...inputPaths(f.type, path + (listType.kind === "LIST" ? "[]" : ""), [...ancestors, type.name])]
    })
  }
  suite.fieldCoverage = [...mutations.values()].flatMap((op) => op.args.flatMap((arg) => inputPaths(arg.type).map((f) => {
    const cases = suite.cases.filter((r) => r.operation === op.name && (r.field === f.path || r.nestedField === f.path || r.fields?.includes(f.path)))
    return { operation: op.name, argument: arg.name, field: f.path, variants: ["set", "change", "omit", ...(f.type.kind !== "NON_NULL" ? ["null"] : []), "restore"], cases: cases.map((r) => r.id), status: cases.some((r) => r.sent) ? "See individual outcomes" : "Not exercised; needs a fixture or dedicated semantic recipe" }
  })))
  for (const p of [...plan.profiles].reverse().filter((p) => p.delete || p.negativeIdDelete)) {
    if (!active() || uncertain()) break
    if (suite.cases.some((r) => r.profile === p.key && r.stopProfile)) continue
    if (p.negativeIdDelete) { await negativeIdDelete(p); continue }
    for (const created of suite.created.filter((x) => x.profile === p.key)) {
      const id = `${p.key}.delete.${created.id}`
      if (done(id)) continue
      const row = { id, profile: p.key, operation: p.delete.operation, variant: "delete", recordId: created.id, status: "Needs context", reason: "Dedicated deletion verification is required" }
      // Specific root reads ensure we observe absence rather than a truncated list.
      try {
        let root = p.readRoot, args, sel
        if (p.key === "forms") { args = { id: created.id }; sel = "webformId patientId documentId" }
        else if (p.key === "definitions") { args = { id: created.id }; sel = "webformDefinitionId" }
        else if (p.key === "correspondence") { args = { id: ctx.encounterId, patientId }; sel = "encounterId patientId correspondences { correspondenceId }" }
        else fail("No exact-ID deletion read")
        const collect = (data) => p.key === "correspondence" ? data[root]?.length === 1 && Number(data[root][0].patientId) === patientId ? data[root][0].correspondences : undefined : data[root]
        const before = collect(await call(root, args, sel, false, "DeleteBefore"))
        if (!before?.some((r) => Number(r[p.id]) === created.id)) fail("Test record not present before delete")
        let error
        try { row.sent = true; await call(p.delete.operation, refValue(p.delete.args, "", created.id), "__typename", true, "Delete") } catch (e) { error = e.message }
        const after = collect(await call(root, args, sel, false, "DeleteAfter"))
        const absent = Array.isArray(after) && !after.some((r) => Number(r[p.id]) === created.id)
        row.status = absent && !uncertain() ? "Delete verified" : "Delete unverified"; if (error) row.error = error
        created.cleanup = row.status; row.reason = "Absence on exact-ID independent read; linked files/resources and physical erasure remain separate"
      } catch (e) { row.error = e.message; if (row.sent) row.status = "Outcome requires inspection" }
      record(row)
    }
  }
  suite.operationCoverage = [...mutations.keys()].map((operation) => ({ operation, cases: suite.cases.filter((x) => x.operation === operation).map((x) => x.id), status: suite.cases.some((x) => x.operation === operation && x.sent) ? "See case outcomes" : operation === "sendFax" ? "Separate explicit recipient test" : "No automatic recipe executed; use dedicated inputs or manual follow-up" }))
  suite.status = !active() ? "Stopped" : uncertain() ? "Stopped: uncertain write; inspect before further mutations" : "Finished; inspect failures and prerequisites"
  suite.completedAt = new Date().toISOString(); notify(); return suite

  // Vendor test forms delete connections/preferences by sending only the negated ID
  // (mois-module-writes "Record-ID conventions"). Only records created by this suite
  // are targeted, and an independent read decides the outcome.
  async function negativeIdDelete(p) {
    const origin = suite.origins[p.key], { read, mutArgs } = tools(p, origin?.marker || "")
    for (const created of suite.created.filter((x) => x.profile === p.key)) {
      const id = `${p.key}.negative-id-delete.${created.id}`
      if (done(id)) continue
      if (!active() || uncertain()) break
      const row = { id, profile: p.key, operation: p.update, variant: "negative-ID delete (vendor convention)", recordId: created.id, status: "Running", sent: false }; record(row)
      try {
        const before = await read(), target = before.find((r) => Number(r[p.id]) === created.id)
        if (!target) fail("Test record not present before delete")
        let error
        const sentBefore = mutationCount
        try { await call(p.update, mutArgs({ [p.id]: -created.id }), "__typename", true, "NegativeDelete") } catch (e) { error = e.message }
        row.sent = mutationCount > sentBefore
        if (!row.sent) { row.status = "Needs context"; row.error = error; record(row); continue }
        const after = await read(), still = after.find((r) => Number(r[p.id]) === created.id)
        const othersPreserved = before.filter((r) => Number(r[p.id]) !== created.id).every((r) => same(withoutAudit(r), withoutAudit(after.find((x) => Number(x[p.id]) === Number(r[p.id])))))
        row.otherRecordsPreserved = othersPreserved
        if (still) row.retainedChangedPaths = diffs(withoutAudit(target), withoutAudit(still))
        row.status = uncertain() ? "Outcome requires inspection" : !still && othersPreserved ? "Negative-ID delete verified" : !still ? "Record absent but other rows changed; inspect" : row.retainedChangedPaths.length ? "Record retained with changes; inspect stop/state fields" : error ? "Rejected; record unchanged" : "Record retained unchanged; negative-ID delete not supported here"
        row.reason = "Absence on independent collection read; soft deletion, history and desktop display remain separate"
        if (error) row.error = error
        created.cleanup = row.status
      } catch (e) { row.status = row.sent ? "Outcome requires inspection" : "Needs context"; row.error = e.message }
      record(row)
    }
  }
  function fieldsForMutation(operation, type, fields) { return named(mutations.get(operation)?.type)?.name === type ? fields : "__typename" }
  // `field` may be one input field or an array changed together (for example a
  // task's name/date pair); `variant.values` then maps each field to its value.
  async function change(p, field, variant, caseId, read, mutArgs, origin) {
    const targets = Array.isArray(field) ? field : [field]
    const want = (f) => variant.values ? variant.values[f] : variant.value
    const row = { id: caseId, profile: p.key, operation: p.update, field: targets.join("+"), ...(targets.length > 1 ? { fields: targets } : {}), nestedField: variant.nestedField, variant: variant.variant, status: "Running", sent: false }; record(row)
    try {
      const before = await read(), recordBefore = before.find((r) => Number(r[p.id]) === origin.id)
      if (!recordBefore) fail("Target missing from fresh read")
      const arg = mutations.get(p.update)?.args.find((a) => a.name === (p.updateArg || p.inputArg)), payload = copyInput(recordBefore, { ...named(arg?.type) })
      if (variant.prepare) variant.value = variant.prepare(clone(payload))
      if (variant.variant === "omit") { if (targets.every((f) => recordBefore[f] == null)) { row.status = "Not applicable: omitted field already null"; record(row); return row }; for (const f of targets) delete payload[f] }
      else { if (targets.every((f) => same(recordBefore[f], want(f)))) { row.status = "Not applicable: requested value already present"; record(row); return row }; for (const f of targets) payload[f] = clone(want(f)) }
      row.baselineValues = Object.fromEntries(targets.map((f) => [f, clone(recordBefore[f])]))
      row.sentValues = variant.variant === "omit" ? { omitted: targets } : Object.fromEntries(targets.map((f) => [f, clone(want(f))]))
      let error
      const sentBefore = mutationCount
      try { await call(p.update, mutArgs(payload), fieldsForMutation(p.update, p.type, selection(p.type)), true, "Change") } catch (e) { error = e.message }
      row.sent = mutationCount > sentBefore
      if (!row.sent) { row.status = "Needs context"; row.error = error; record(row); return row }
      const after = await read(), recordAfter = after.find((r) => Number(r[p.id]) === origin.id)
      if (!recordAfter) fail("Target missing after write")
      row.readBackValues = Object.fromEntries(targets.map((f) => [f, clone(recordAfter[f])]))
      const changed = diffs(withoutAudit(recordBefore), withoutAudit(recordAfter)); row.changedPaths = changed
      const otherPreserved = before.length === after.length && before.every((r) => {
        const found = after.find((x) => Number(x[p.id]) === Number(r[p.id])); if (!found) return false
        if (Number(r[p.id]) !== origin.id) return same(withoutAudit(r), withoutAudit(found))
        const a = withoutAudit(r), b = withoutAudit(found); for (const f of targets) { delete a[f]; delete b[f] }; return same(a, b)
      })
      row.otherSelectedFieldsAndMembershipPreserved = otherPreserved
      row.auditChangedPaths = diffs(recordBefore.stamp, recordAfter.stamp, "stamp")
      if (uncertain()) fail("Write timed out; read cannot settle eventual persistence")
      const matches = (f) => {
        if (variant.expectPreserved) return same(recordAfter[f], recordBefore[f])
        if (variant.generatedChildren) return matchEventChildren(recordAfter[f], variant.value, recordBefore[f], origin.id)
        if (subset(recordAfter[f], want(f))) return true
        if (dateEquivalent(recordAfter[f], want(f))) { (row.normalized ||= []).push({ field: f, sent: want(f), read: recordAfter[f] }); return true }
        return false
      }
      if (!otherPreserved) { row.status = "Unexpected changes; profile stopped"; row.stopProfile = true }
      else if (error && same(withoutAudit(recordBefore), withoutAudit(recordAfter))) row.status = "Rejected; selected read unchanged"
      else if (variant.variant === "omit") row.status = targets.every((f) => same(recordBefore[f], recordAfter[f])) ? "Omission preserved value" : targets.every((f) => recordAfter[f] === null) ? "Omission cleared value" : "Omission changed value"
      else if (targets.every(matches)) row.status = error ? "Write verified after mutation error" : variant.expectPreserved ? "Null preserved value" : variant.variant === "restore" ? "Restoration verified" : "Write verified"
      else if (same(recordBefore, recordAfter) || same(withoutAudit(recordBefore), withoutAudit(recordAfter))) row.status = error ? "Rejected; selected read unchanged" : "Write not applied"
      else { row.status = "Unexpected field value; profile stopped"; row.stopProfile = true }
      if (variant.variant === "restore" && targets.some((f) => !same(withoutAudit(recordAfter[f]), withoutAudit(origin.record[f])))) row.stopProfile = true
      if (error) row.error = error
    } catch (e) { row.status = row.sent ? "Outcome requires inspection" : "Needs context"; row.error = e.message; row.stopProfile = Boolean(row.sent) }
    record(row); return row
  }
  async function nestedDosage(p, read, mutArgs, origin) {
    const first = origin.record.drugDurations?.find((d) => positive(d.drugDurationId) && d.dosages?.some((x) => positive(x.dosageId) && typeof x.doseQuantity === "number"))
    if (!first) { record({ id: p.key + ".dosage.fixture", profile: p.key, field: "drugDurations", status: "Needs context", reason: "No existing positive-ID duration/dosage quantity; add a disposable dosing fixture to exercise nested writes" }); return }
    const dose = first.dosages.find((x) => positive(x.dosageId) && typeof x.doseQuantity === "number")
    for (const [name, quantity] of [["quantity-update", dose.doseQuantity + 1], ["quantity-restore", dose.doseQuantity]]) {
      const id = p.key + ".dosage." + name; if (done(id)) continue
      const variant = { variant: name, nestedField: "drugDurations[].dosages[].doseQuantity", prepare: (payload) => payload.drugDurations.map((d) => d.drugDurationId === first.drugDurationId ? { ...d, dosages: d.dosages.map((x) => x.dosageId === dose.dosageId ? { ...x, doseQuantity: quantity } : x) } : d) }
      const outcome = await change(p, "drugDurations", variant, id, read, mutArgs, origin)
      if (outcome.stopProfile || uncertain() || !active()) break
    }
  }
  async function eventChildren(p, read, mutArgs, origin) {
    if (!ctx.healthIssue?.code || !ctx.healthIssue?.system) { record({ id: p.key + ".children.fixture", profile: p.key, status: "Needs context", reason: "Needs a populated condition coding for the disposable event health-issue tests" }); return }
    const child = () => ({ serviceEventHealthIssueId: 0, serviceEventId: origin.id, healthIssue: clone(ctx.healthIssue), certainty: clone(ctx.certainty || { code: "Impression", display: "IMPRESSION", system: "MOIS-CONDITIONCERTAINTY" }) })
    const steps = [
      { variant: "add", prepare: () => [child()], generatedChildren: true },
      { variant: "certainty", prepare: (payload) => payload.healthIssues.map((x) => ({ ...x, certainty: { code: "Confirmed", display: "CONFIRMED", system: "MOIS-CONDITIONCERTAINTY" } })) },
      { variant: "mixed-add", prepare: (payload) => [...payload.healthIssues, child()], generatedChildren: true },
      { variant: "retain-one", prepare: (payload) => payload.healthIssues.slice(0, 1) },
      { variant: "omit" }, { variant: "null", value: null, expectPreserved: true },
      { variant: "empty", value: [] }, { variant: "recreate", prepare: () => [child()], generatedChildren: true },
      { variant: "restore", value: [] },
    ]
    for (const step of steps) {
      const id = p.key + ".healthIssues." + step.variant; if (done(id)) continue
      if (!active() || uncertain()) break
      const outcome = await change(p, "healthIssues", step, id, read, mutArgs, origin)
      if (outcome.stopProfile) break
    }
  }

  function matchEventChildren(actual, expected, before, eventId) {
    if (!Array.isArray(actual) || actual.length !== expected.length || new Set(actual.map((x) => x.serviceEventHealthIssueId)).size !== actual.length) return false
    const oldIds = new Set((before || []).map((x) => x.serviceEventHealthIssueId)), used = new Set()
    return expected.every((x) => {
      const fields = { ...x }; delete fields.serviceEventHealthIssueId
      const matches = actual.filter((a) => positive(a.serviceEventHealthIssueId) && !used.has(a.serviceEventHealthIssueId) && Number(a.serviceEventId) === eventId && (x.serviceEventHealthIssueId === 0 ? !oldIds.has(a.serviceEventHealthIssueId) : a.serviceEventHealthIssueId === x.serviceEventHealthIssueId) && subset(a, fields))
      if (matches.length !== 1) return false; used.add(matches[0].serviceEventHealthIssueId); return true
    })
  }
  async function attachment() {
    const id = "attachment.upload"; if (done(id)) return
    const row = { id, profile: "attachment", operation: "POST api/attachment/file", variant: "text file upload and independent metadata/binary read", status: "Running", sent: false }; record(row)
    try {
      if (!uploadAttachment || !positive(ctx.userProfileId)) fail("Needs host attachment transport and current user-profile ID")
      const marker = `WEBFORMS TEST ${Date.now().toString(36)} attachment`
      const read = async () => {
        const result = await call("patient", {id:patientId}, "patientId documents { documentId patientId note pathname }", false, "AttachmentRead")
        if (result.patient?.length !== 1 || Number(result.patient[0].patientId) !== patientId || !Array.isArray(result.patient[0].documents)) fail("Attachment patient read missing")
        return result.patient[0].documents
      }
      const before = await read(), document = {documentId:0,patientId,note:marker,documentType:{code:"NOTE",display:"Note / General Purpose Document",system:"MOIS-DOCUMENTTYPE"}}
      const content = marker + "\nSynthetic attachment test only.\n"
      let error; row.sent = true; record(row)
      try { await uploadAttachment(ctx.userProfileId, document, content) } catch (e) { error = e.message }
      const after = await read(), oldIds = new Set(before.map((x) => Number(x.documentId)))
      const added = after.filter((x) => !oldIds.has(Number(x.documentId)) && positive(x.documentId) && x.note === marker && Number(x.patientId) === patientId)
      const preserved = before.every((x) => same(x, after.find((y) => Number(y.documentId) === Number(x.documentId))))
      if (uncertain()) fail("Upload timed out; eventual persistence is unknown")
      if (added.length !== 1 || after.length !== before.length + 1 || !preserved) { row.status = error && same(before,after) ? "Rejected; selected read unchanged" : "Upload outcome requires inspection"; row.error = error; record(row); return }
      row.status = "Upload metadata verified"; row.recordId = Number(added[0].documentId); row.error = error
      suite.created.push({profile:"attachment",key:"documentId",id:row.recordId,cleanup:"No dedicated document deletion recipe; retained"}); record(row)
      const binary = {id:"attachment.encodedFile",profile:"attachment",operation:"document",variant:"uploaded content read",status:"Running"}; record(binary)
      try {
        const result = await call("document", {patientId,id:row.recordId}, "documentId patientId encodedFile", false, "AttachmentFile")
        const found = result.document?.find((x) => Number(x.documentId) === row.recordId && Number(x.patientId) === patientId)
        if (!found) fail("Uploaded document missing from exact-ID read")
        binary.status = found.encodedFile === content || typeof btoa === "function" && found.encodedFile === btoa(content) ? "Uploaded bytes verified" : found.encodedFile == null ? "No file value returned; alternate download route remains open" : "File value returned; content/encoding needs inspection"
      } catch (e) { binary.status = "Read failed"; binary.error = e.message } record(binary)
    } catch (e) { row.status = row.sent ? "Outcome requires inspection" : "Needs context"; row.error = e.message; record(row) }
  }
  // Task status metadata while both flags are Y. The plan orders the pending focused-52
  // case first: set acknowledgedBy + acknowledgedDate together (with completion
  // metadata populated, as in 51), independent read, populated-value omission,
  // explicit-null clear, set again, restore; then completion pair and single fields.
  async function taskMetadata(p, read, mutArgs, origin) {
    const spec = p.taskMetadata && typeof p.taskMetadata === "object" ? p.taskMetadata : {}
    const yes = { code: "Y", display: "Yes", system: "MOIS-YESNO" }
    const flags = spec.flags || ["isAcknowledged", "isComplete"]
    const pairs = spec.pairs || { acknowledgement: ["acknowledgedBy", "acknowledgedDate"], completion: ["completedBy", "completedDate"] }
    const sequence = spec.sequence || [{ pair: "completion", variants: ["set"] }, { pair: "acknowledgement", variants: ["set", "omit", "null", "set-again", "restore"] }, { pair: "completion", variants: ["omit", "null", "set-again", "restore"] }]
    const singles = spec.singleFieldVariants || ["set", "omit", "null", "restore"]
    const metadata = [...new Set(Object.values(pairs).flat())]
    const step = async (field, id, variant) => {
      if (done(id)) return true
      if (!active() || uncertain()) return false
      const result = await change(p, field, variant, id, read, mutArgs, origin)
      return !result.stopProfile
    }
    if (!ctx.userName) { record({ id: p.key + ".workflow.profile", profile: p.key, status: "Needs context", reason: "Needs current profile display name" }); return }
    const missing = [...flags, ...metadata].filter((f) => !(f in origin.record))
    if (missing.length) { record({ id: p.key + ".workflow.fields", profile: p.key, status: "Needs context", reason: "Not in selected task output: " + missing.join(", ") }); return }
    for (const f of flags) if (!await step(f, `${p.key}.workflow.${f}.enable`, { variant: "enable", value: yes })) return
    const current = (await read()).find((r) => Number(r[p.id]) === origin.id)
    if (!flags.every((f) => current?.[f]?.code === "Y")) { record({ id: p.key + ".workflow.prerequisite", profile: p.key, status: "Needs context", reason: "Both flags must independently read Y before metadata-under-completion variants" }); return }
    const today = new Date().toISOString().slice(0, 10)
    const valueFor = (f, variant) => variant === "null" ? null : variant === "restore" ? clone(origin.record[f] ?? null) : f.endsWith("By") ? ctx.userName : today
    for (const { pair, variants } of sequence) {
      const fields = pairs[pair]
      if (!fields?.length) continue
      for (const v of variants) {
        const variant = v === "omit" ? { variant: "omit" } : { variant: v, values: Object.fromEntries(fields.map((f) => [f, valueFor(f, v)])) }
        if (!await step(fields, `${p.key}.workflow.${pair}.${v}`, variant)) return
      }
    }
    for (const f of metadata) for (const v of singles) {
      const variant = v === "omit" ? { variant: "omit" } : { variant: v, value: valueFor(f, v) }
      if (!await step(f, `${p.key}.workflow.${f}.${v}`, variant)) return
    }
    for (const f of [...flags].reverse()) if (!await step(f, `${p.key}.workflow.${f}.restore`, { variant: "restore", value: origin.record[f] })) return
  }
  async function appointmentStatus(p, read, origin) {
    // Codes come from the current instance/context. Do not invent a status or use the active encounter.
    // Preference: explicit Test context, then a coding already used on this patient's
    // encounters, then the D / MOIS-ENCOUNTERSTATUS pair the SMOIS 2.30.31 bundle sends.
    const differs = (x) => x?.code && x?.system && !(origin.record.status?.code === x.code && origin.record.status?.system === x.system)
    const discovered = (ctx.appointmentStatusCandidates || []).find(differs)
    const coding = ctx.appointmentStatus || discovered || { code: "D", system: "MOIS-ENCOUNTERSTATUS" }
    const codingSource = ctx.appointmentStatus ? "Test context" : discovered ? "Existing encounter status on this patient" : "SMOIS bundle default (D / MOIS-ENCOUNTERSTATUS)"
    if (!coding?.code || !coding?.system) { record({ id: p.key + ".status.fixture", profile: p.key, operation: "updateEncounterStatus", status: "Needs context", reason: "Provide appointmentStatus with a valid current-instance coding; test targets only this suite's new appointment" }); return }
    for (const [variant, value] of [["set", coding], ["restore", origin.record.status]]) {
      const id = p.key + ".status." + variant; if (done(id)) continue
      if (!active() || uncertain()) break
      const row = { id, profile: p.key, operation: "updateEncounterStatus", field: "appointmentStatus", variant, codingSource: variant === "set" ? codingSource : "Original status of this suite's appointment", status: "Running", sent: false }; record(row)
      try {
        if (!value || typeof value !== "object") fail("No original status coding to restore")
        const before = await read(), old = before.find((r) => Number(r[p.id]) === origin.id)
        if (!old || origin.existing) fail("Requires a newly created test appointment")
        let error
        try { await call("updateEncounterStatus", { patientId, encounterId: origin.id, appointmentStatus: value, statusChangeDateTime: new Date().toISOString(), allEncompassed: false }, "__typename", true, "Status") } catch (e) { error = e.message }
        const after = await read(), updated = after.find((r) => Number(r[p.id]) === origin.id)
        row.changedPaths = diffs(withoutAudit(old), withoutAudit(updated)); row.error = error
        row.otherRecordsPreserved = before.length === after.length && before.filter((r) => Number(r[p.id]) !== origin.id).every((r) => same(withoutAudit(r), withoutAudit(after.find((x) => x[p.id] === r[p.id]))))
        row.status = !uncertain() && updated && subset(updated.status, value) && row.otherRecordsPreserved ? "Status verified; inspect timestamp effects" : "Status not verified"
        if (uncertain() || !row.otherRecordsPreserved || variant === "restore" && !subset(updated?.status, value)) row.stopProfile = true
      } catch (e) { row.status = row.sent ? "Outcome requires inspection" : "Needs context"; row.error = e.message; row.stopProfile = row.sent }
      record(row); if (row.stopProfile) break
    }
  }
  async function formLifecycle(p, read, mutArgs, origin) {
    const id = p.key + ".submit"
    if (!done(id)) await change(p, "isDraft", { variant: "submit", value: "N" }, id, read, mutArgs, origin)
    if (suite.cases.some((r) => r.profile === p.key && r.stopProfile) || uncertain()) return
    for (const state of ["SIGNED", "UNSIGNED"]) {
      const key = p.key + ".state." + state
      if (done(key)) continue
      const row = { id: key, profile: p.key, operation: "signWebform", variant: state, status: "Running", sent: false }; record(row)
      try {
        const before = (await read()).find((r) => Number(r[p.id]) === origin.id)
        if (before?.isDraft !== "N" || !positive(before.documentId)) fail("Requires independently verified non-draft form and linked document")
        let error
        try { row.sent = true; await call("signWebform", { signatureRecord: { documentId: before.documentId, recordState: state, note: "WEBFORMS TEST lifecycle" } }, "__typename", true, "Sign") } catch (e) { error = e.message }
        const after = (await read()).find((r) => Number(r[p.id]) === origin.id)
        row.answersPreserved = Boolean(after && before.formdata === after.formdata)
        row.status = after?.recordState === state && row.answersPreserved && !uncertain() ? "State verified" : "State not verified"; if (error) row.error = error
      } catch (e) { row.status = row.sent ? "Outcome requires inspection" : "Needs context"; row.error = e.message }
      record(row)
    }
  }
  async function download(p, read) {
    const id = p.key + ".encodedFile"; if (done(id)) return
    const row = { id, profile: p.key, variant: "read encodedFile", operation: "document", status: "Running" }; record(row)
    try {
      const docs = await read(), chosen = docs.find((x) => Number(x[p.id]) === ids[p.key])
      if (!chosen) fail("Needs a patient document")
      const info = types.get("Document")?.fields.find((f) => f.name === "encodedFile")
      if (!info || !["SCALAR", "ENUM"].includes(named(info.type)?.kind)) fail("No scalar encodedFile download route")
      const result = await call("document", { patientId, id: Number(chosen.documentId) }, "documentId patientId encodedFile", false, "File")
      const value = result.document?.find((r) => Number(r.patientId) === patientId && Number(r.documentId) === Number(chosen.documentId))
      if (!value) fail("Requested document not returned")
      row.status = value.encodedFile ? "File value returned; compare content" : "No file value returned"; row.characters = typeof value.encodedFile === "string" ? value.encodedFile.length : 0
    } catch (e) { row.status = "Needs context"; row.error = e.message } record(row)
    // Read-only: a pre-existing document with a stored file path shows whether GraphQL returns real bytes.
    const existingId = p.key + ".encodedFile.existing"; if (done(existingId) || !active()) return
    const existing = { id: existingId, profile: p.key, variant: "read encodedFile of a pre-existing document with a file path (read-only)", operation: "document", status: "Running" }; record(existing)
    try {
      const chosen = (await read()).find((x) => positive(x[p.id]) && Number(x[p.id]) !== ids[p.key] && (x.pathname || x.secondaryPathname))
      if (!chosen) fail("No pre-existing patient document with a file path; add a known attachment to test byte retrieval")
      const result = await call("document", { patientId, id: Number(chosen.documentId) }, "documentId patientId pathname encodedFile", false, "FileExisting")
      const value = result.document?.find((r) => Number(r.patientId) === patientId && Number(r.documentId) === Number(chosen.documentId))
      if (!value) fail("Requested document not returned")
      existing.recordId = Number(chosen.documentId); existing.characters = typeof value.encodedFile === "string" ? value.encodedFile.length : 0
      existing.status = value.encodedFile ? "File value returned for an existing document; evidence keeps only its size and prefix" : "No file value returned for a document with a file path; alternate download route remains open"
    } catch (e) { existing.status = "Needs context"; existing.error = e.message } record(existing)
  }
  async function correspondenceUpdate(p, read, origin) {
    const id = p.key + ".positive-id-update"; if (done(id)) return
    const row = { id, profile: p.key, operation: "createEncounterCorrespondence", variant: "positive-ID update candidate", status: "Running", sent: false }; record(row)
    try {
      const before = await read(), old = before.find((x) => Number(x[p.id]) === origin.id)
      if (!old) fail("Test correspondence missing")
      let error
      try { row.sent = true; await call(p.create, { encounterId: ctx.encounterId, correspondence: { correspondenceId: origin.id, note: origin.marker + " UPDATE" } }, "__typename", true, "CorrespondenceUpdate") } catch (e) { error = e.message }
      const after = await read(); row.status = error && same(withoutAudit(before), withoutAudit(after)) ? "Rejected; selected read unchanged" : "Inspect candidate update outcome"; row.error = error
    } catch (e) { row.status = row.sent ? "Outcome requires inspection" : "Needs context"; row.error = e.message } record(row)
  }
}

// MOIS 2.30.31 evidence: main.a75cc6b1.chunk.js queryGraphQL export accepts
// (operationName, jwToken, apiServer, query, variables, statusSetter,
//  resultCallback, errorDispatch, { formParams }) and returns data or null.
// Use that host transport; never invent an endpoint or expose credentials.
const PATIENT_CONTEXT_QUERY_TEST_VERSION = "2.1.0"
const PatientContextQueryTest = ({ collections = [], writeTargets = [], suitePlan = null }) => {
  const sd = useSourceData()
  const patient = sd?.patient ?? sd?.queryResult?.patient?.[0]
  const patientId = Number(patient?.patientId ?? sd?.formParams?.patientId)
  const settings = typeof sd?.useAppSettings === "function" ? sd.useAppSettings() : null
  const auth = sd?.auth || settings?.auth || {}
  const hostQuery = typeof queryGraphQL === "function" ? queryGraphQL : null
  const ready = Boolean(hostQuery && auth.jwToken && auth.apiServer && Number.isInteger(patientId) && patientId > 0)
  const [state, setState] = React.useState({ patientId, busy: false, message: "No live checks run yet.", rows: [], hasRun: false, schemaFields: [] })
  const exchanges = React.useRef([])
  const evidenceBytes = React.useRef(0)
  const evidenceTruncated = React.useRef(false)
  const [customQuery, setCustomQuery] = React.useState("query CustomPatientProbe($patientId: Int) { patient(id: $patientId) { patientId } }")
  const [customVariables, setCustomVariables] = React.useState('{"patientId":"$patientId"}')
  const [testContext, setTestContext] = React.useState("{}")
  const [writeSelection, setWriteSelection] = React.useState("all")
  const [writeOverrides, setWriteOverrides] = React.useState("{}")
  const uncertainWrite = React.useRef(false)
  const pendingWrites = React.useRef(0)
  const epoch = React.useRef(0)
  const busy = React.useRef(false)
  // Wrong-patient guard: suite and second-window writes require an explicit
  // confirmation for this exact patient ID; it resets whenever the chart changes.
  const [confirmedPatient, setConfirmedPatient] = React.useState(null)
  const [sessionTarget, setSessionTarget] = React.useState("")
  const [sessionObservation, setSessionObservation] = React.useState("")
  const [ledgerVersion, setLedgerVersion] = React.useState(0)
  const confirmed = Boolean(confirmedPatient && confirmedPatient.patientId === patientId)
  const revision = suitePlan?.revision || "2026-09-24.suite-2"
  // Per-browser record of which test groups already sent requests, so re-clicking after
  // an accidental close/reload never re-creates records. Values: group keys only.
  const ledgerKey = `webforms.patientContextSuite:${String(auth.apiServer || "")}:${patientId}:${revision}`
  const readLedger = () => { try { const value = JSON.parse(window.localStorage.getItem(ledgerKey) || "null"); return value && typeof value === "object" && !Array.isArray(value) ? value : null } catch (_) { return null } }
  const writeLedger = (value) => { try { if (value) window.localStorage.setItem(ledgerKey, JSON.stringify(value)); else window.localStorage.removeItem(ledgerKey) } catch (_) {} }
  React.useEffect(() => {
    if (pendingWrites.current) uncertainWrite.current = true
    exchanges.current = []; evidenceBytes.current = 0; evidenceTruncated.current = false
    setConfirmedPatient(null); setSessionTarget(""); setSessionObservation("")
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

  const run = async (mode = "reads", options = {}) => {
    if (!ready || busy.current || (["writes", "suite", "all", "session"].includes(mode) && (uncertainWrite.current || pendingWrites.current))) return
    if (["all", "suite", "session"].includes(mode) && !confirmed) { setState((previous) => ({ ...previous, message: "Confirm that this chart is the designated MOIS test patient before running writes." })); return }
    busy.current = true
    const runId = ++epoch.current
    const active = () => epoch.current === runId
    let rows = mode !== "reads" ? [...current.rows] : []
    let schemaFields = mode !== "reads" ? current.schemaFields || [] : []
    let createdIds = { ...(current.createdIds || {}) }
    let customResults = [...(current.customResults || [])]
    let rootResults = [...(current.rootResults || [])]
    let writeResults = [...(current.writeResults || [])]
    let suiteResults = current.suiteResults || null
    let suitePhase = null
    let phaseResults = [...(current.phaseResults || [])]
    let missingExploration = current.missingExploration || null
    let apiInventory = current.apiInventory || null
    let sessionTests = current.sessionTests || { rows: [] }
    let progress = null
    // A stored ledger applies only when this form load has no in-memory progress of its own.
    const earlierLoad = mode === "all" && !current.suiteResults && !(current.writeResults || []).some((row) => row.sent) ? readLedger() : null
    const testPatient = { patientId, chartNumber: patient?.chartNumber ?? null, confirmedAt: confirmedPatient?.at || null }
    const update = (message, running = true) => {
      if (active()) setState({ patientId, suiteResults, suitePhase, phaseResults, progress, sessionTests, testPatient, earlierLoad: earlierLoad || current.earlierLoad || null, busy: mode === "all" ? true : running, message, rows: [...rows], hasRun: true, schemaFields, apiInventory, writeResults: [...writeResults], createdIds: { ...createdIds }, rootResults: [...rootResults], customResults: [...customResults], missingExploration })
    }
    const persistLedger = () => {
      const existing = readLedger() || {}
      const verifierOps = new Set(suitePlan?.verifierOperations || [])
      writeLedger({ revision, patientId, updatedAt: new Date().toISOString(),
        profiles: [...new Set([...(existing.profiles || []), ...(suiteResults?.cases || []).filter((row) => row.sent && row.profile).map((row) => row.profile)])],
        verifierOps: [...new Set([...(existing.verifierOps || []), ...writeResults.filter((row) => row.sent && row.phase === "verifiers" && verifierOps.has(row.operation)).map((row) => row.operation)])] })
    }
    // Large file values (encodedFile) keep their size and a short prefix in the evidence.
    const redact = (value) => {
      const text = JSON.stringify(value, (key, item) => /jwToken|authorization|password|secret|accessToken|refreshToken|cookie/i.test(key) ? "[redacted]" : typeof item === "string" && item.length > 200000 ? { truncatedString: true, characters: item.length, prefix: item.slice(0, 120) } : item)
      return text ? JSON.parse(text.split(String(auth.jwToken || "\u0000")).join("[redacted]")) : value
    }
    const capture = (entry) => {
      if (!active() || mode !== "all" && mode !== "suite" && mode !== "session") return
      const safe = redact(entry), size = JSON.stringify(safe).length
      if (evidenceBytes.current + size > 25000000) { evidenceTruncated.current = true; return }
      exchanges.current.push(safe); evidenceBytes.current += size
    }
    const request = async (operation, query, variables, mutation = false) => {
      if (!active()) throw new Error("Stopped")
      const startedAt = new Date().toISOString()
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
        capture({ operation, query, variables, mutation, startedAt, receivedAt: new Date().toISOString(), data })
        return data
      } catch (error) {
        capture({ operation, query, variables, mutation, startedAt, error: readableError(error.message) })
        if (mutation && /timed out|Stopped/.test(String(error.message))) uncertainWrite.current = true
        throw error
      } finally { clearTimeout(timer) }
    }
    update(mode === "api" ? "Inspecting root queries, mutations and input types…" : "Inspecting the live Patient schema…")
    const uploadAttachment = async (profileId, document, content) => {
      if (!active() || uncertainWrite.current || pendingWrites.current) throw new Error("Stopped or unresolved write")
      const endpoint = String(auth.apiServer).replace(/\/?$/, "/") + `api/attachment/file/${profileId}/${patientId}/`
      const body = new window.FormData(); body.append("file", new window.Blob([content], {type:"text/plain"}), "webforms-suite-test.txt"); body.set("document", JSON.stringify(document))
      const startedAt = new Date().toISOString(); let timer
      try {
        pendingWrites.current += 1
        const transport = window.fetch(endpoint, {method:"POST",headers:{Authorization:`Bearer ${auth.jwToken}`},body}).then(async (response) => {
          const responseText = await response.text()
          capture({operation:"AttachmentUpload",method:"POST",path:"api/attachment/file",document,filename:"webforms-suite-test.txt",content,startedAt,status:response.status,responseText})
          if (!response.ok) throw new Error("Attachment upload returned HTTP " + response.status)
          return responseText
        }).finally(() => {pendingWrites.current -= 1})
        return await Promise.race([transport,new Promise((_,reject) => {timer=setTimeout(() => reject(new Error("Attachment upload timed out after 30 seconds.")),30000)})])
      } catch (e) {
        if (/timed out|Stopped/.test(e.message)) uncertainWrite.current = true
        capture({operation:"AttachmentUpload",document,content,startedAt,error:readableError(e.message)})
        throw e
      } finally { clearTimeout(timer) }
    }
    // Optional second-window checks. Never part of Run all remaining tests. Window A
    // creates and owns one disposable draft; window B may only write to a draft whose
    // saved answers carry this tool's sessionTestFixture flag on the same patient.
    const sessionStep = async (step) => {
      const me = Number(sd?.userProfile?.userProfileId || settings?.userProfile?.userProfileId) || null
      const windowRole = step === "lock-observe" ? "this window" : step.startsWith("B") ? "B (second window)" : "A (first window)"
      const row = { step, window: windowRole, userProfileId: me, startedAt: new Date().toISOString(), status: "Running", sent: false }
      const commit = (message) => { sessionTests = { ...sessionTests, rows: [...sessionTests.rows.filter((x) => x !== row), row] }; update(message || `Second-window step ${step}: ${row.status}`, !message ? false : true) }
      commit("Running second-window step " + step + "…")
      const fields = "webformId webformDefinitionId patientId documentId encounterId isDraft isLockedToUser recordState userId classVersion { major minor patch } version { major minor patch } formdata note stamp { createUser modifyUser modifyTime }"
      const readForm = async (id, tag) => {
        const data = await request("SessionRead" + tag, `query SessionRead${tag}($id: Int!) { webform(id: $id) { ${fields} } }`, { id })
        const found = (data?.webform || []).filter((record) => Number(record.webformId) === id)
        if (found.length !== 1) throw new Error("Form " + id + " was not uniquely returned")
        if (Number(found[0].patientId) !== patientId) throw new Error("That form belongs to another patient; nothing was sent")
        return found[0]
      }
      const answers = (record) => { try { const value = JSON.parse(record.formdata || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : null } catch (_) { return null } }
      const fixture = (record) => { const value = answers(record); if (!value || value.sessionTestFixture !== true) throw new Error("Target is not a disposable second-window draft created by this tool; nothing was sent"); return value }
      const input = (record, formdata, extra = {}) => ({ ...Object.fromEntries(["webformId", "webformDefinitionId", "patientId", "documentId", "encounterId", "isDraft", "isLockedToUser", "note"].filter((key) => record[key] !== undefined && record[key] !== null).map((key) => [key, record[key]])), formdata, ...extra })
      const write = async (webform, tag) => {
        row.sent = true; row.input = webform
        try { await request("SessionWrite" + tag, `mutation SessionWrite${tag}($webform: WebformInput!) { updateWebform(webform: $webform) { webformId } }`, { webform }, true); return null } catch (error) { if (uncertainWrite.current) throw error; return readableError(error.message) }
      }
      const marker = (label) => `WEBFORMS TEST ${Date.now().toString(36)} ${label}`
      const target = () => { const id = Number(sessionTarget || sessionTests.webformId); if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Enter the disposable draft's form ID (shown in window A after step A1)"); return id }
      try {
        if (step === "lock-observe") {
          const id = Number(sessionTarget) || Number(sd?.webform?.webformId || sd?.formParams?.webformId)
          if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Save this form once (or enter a saved form ID) so its lock state can be read")
          row.formId = id; row.read = await readForm(id, "Lock")
          row.hostSaysLocked = row.read.isLockedToUser
          row.runtimeLockTest = typeof testLock === "function" ? (() => { try { return testLock() } catch (error) { return "testLock failed: " + error.message } })() : "testLock not exposed in this runtime"
          row.observation = sessionObservation || "(not entered)"
          row.status = "Observation recorded"
        } else if (step === "A1") {
          if (sessionTests.webformId || sessionTests.definitionId) throw new Error("This window already created a disposable draft/definition; run A6 before creating another")
          const text = marker("second-window")
          const name = "webforms_session_" + Date.now().toString(36)
          const definition = { webformDefinitionId: 0, name, title: text, owner: "WEBFORMS TEST", active: "N", type: "ATTACHMENT", buildVersion: new Date().toISOString().slice(0, 10).replace(/-/g, ""), formVersion: { major: 1, minor: 0, patch: 0 }, formdataSchema: JSON.stringify({ type: "object", properties: { diagnostic: { type: "string" }, sessionA: { type: "string" }, sessionB: { type: "string" }, sessionB2: { type: "string" } } }) }
          row.sent = true
          const created = await request("SessionDefinition", "mutation SessionDefinition($webform: WebformDefinitionInput!) { addWebformDefinition(webform: $webform) { webformDefinitionId name } }", { webform: definition }, true)
          const defs = (created?.addWebformDefinition || []).filter((record) => record.name === name && Number(record.webformDefinitionId) > 0)
          if (defs.length !== 1) throw new Error("Definition creation did not return one positive ID; inspect before retrying")
          const definitionId = Number(defs[0].webformDefinitionId)
          sessionTests = { ...sessionTests, definitionId }
          const check = await request("SessionDefinitionRead", "query SessionDefinitionRead($id: Int) { webformDefinition(id: $id) { webformDefinitionId name } }", { id: definitionId })
          if (!(check?.webformDefinition || []).some((record) => Number(record.webformDefinitionId) === definitionId && record.name === name)) throw new Error("Created definition not found on independent read")
          const draft = await request("SessionDraft", "mutation SessionDraft($webform: WebformInput!) { addWebform(webform: $webform) { webformId patientId documentId } }", { webform: { webformId: 0, webformDefinitionId: definitionId, patientId, isDraft: "Y", formdata: JSON.stringify({ sessionTestFixture: true, diagnostic: text, sessionA: null, sessionB: null, sessionB2: null }), note: text } }, true)
          const forms = (draft?.addWebform || []).filter((record) => Number(record.webformId) > 0 && Number(record.patientId) === patientId)
          if (forms.length !== 1) throw new Error("Draft creation did not return one positive ID; inspect before retrying")
          const webformId = Number(forms[0].webformId)
          sessionTests = { ...sessionTests, webformId, definitionId }
          row.read = await readForm(webformId, "Created"); fixture(row.read)
          sessionTests = { ...sessionTests, webformId, definitionId }
          row.formId = webformId; row.definitionId = definitionId
          row.status = "Disposable draft created and independently read; enter form ID " + webformId + " in window B"
        } else if (step === "A2") {
          const id = target(); const record = await readForm(id, "Baseline"); fixture(record)
          sessionTests = { ...sessionTests, baseline: record, baselineAt: new Date().toISOString() }
          row.formId = id; row.read = record; row.status = "Baseline held in this window; now run B1 in the second window"
        } else if (step === "B1") {
          const id = target(); const before = await readForm(id, "BeforeB"); const value = fixture(before)
          const text = marker("window B")
          const error = await write(input(before, JSON.stringify({ ...value, sessionB: text })), "B")
          const after = await readForm(id, "AfterB"); row.formId = id; row.before = before; row.read = after; row.error = error
          row.status = answers(after)?.sessionB === text ? "Window B answer persisted; now run A3 in window A" : error ? "Window B write rejected" : "Window B answer not found on independent read"
        } else if (step === "A3") {
          const baseline = sessionTests.baseline
          if (!baseline) throw new Error("Run A2 in this window before B1, then A3")
          const id = Number(baseline.webformId), fresh = await readForm(id, "BeforeStale")
          row.interveningWriteObserved = fresh.formdata !== baseline.formdata
          if (!row.interveningWriteObserved) throw new Error("No second-window change since the A2 baseline; run B1 in window B first")
          const text = marker("window A stale")
          const error = await write(input(baseline, JSON.stringify({ ...fixture(baseline), sessionA: text })), "StaleA")
          const after = await readForm(id, "AfterStale"), result = answers(after) || {}
          const hasA = result.sessionA === text, hasB = typeof result.sessionB === "string" && result.sessionB.startsWith("WEBFORMS TEST")
          row.formId = id; row.before = fresh; row.read = after; row.error = error
          row.status = error && !hasA && hasB ? "Stale write rejected; window B answer preserved" : hasA && hasB ? "Both answers present after the stale write" : hasA ? "Lost update: stale write replaced the window B answer" : "Outcome requires inspection"
        } else if (step === "A4" || step === "A5") {
          const id = target(); const before = await readForm(id, "BeforeLock"); fixture(before)
          const lock = step === "A4" ? "Y" : "N"
          const error = await write(input(before, before.formdata, { isLockedToUser: lock }), step === "A4" ? "Lock" : "Unlock")
          const after = await readForm(id, "AfterLock"); row.formId = id; row.before = before; row.read = after; row.error = error
          row.status = after.isLockedToUser === lock ? `isLockedToUser=${lock} persisted` + (step === "A4" ? "; now run B2 in window B" : "") : error ? "Lock change rejected" : "Lock value not applied"
        } else if (step === "B2") {
          const id = target(); const before = await readForm(id, "BeforeLocked"); const value = fixture(before)
          row.lockedBefore = before.isLockedToUser; row.sameUserAsFormUser = me != null && Number(before.userId) === me
          if (before.isLockedToUser !== "Y") throw new Error("Draft is not locked (isLockedToUser is " + before.isLockedToUser + "); run A4 in window A first")
          const text = marker("window B while locked")
          const error = await write(input(before, JSON.stringify({ ...value, sessionB2: text }), { isLockedToUser: "Y" }), "Locked")
          const after = await readForm(id, "AfterLocked"); row.formId = id; row.before = before; row.read = after; row.error = error
          row.status = answers(after)?.sessionB2 === text ? "Write accepted while isLockedToUser=Y" : error ? "Write rejected while locked" : "Write not applied while locked"
        } else if (step === "A6") {
          const { webformId, definitionId } = sessionTests
          if (!webformId && !definitionId) throw new Error("This window has no disposable draft to delete")
          row.sent = true; row.deletions = []
          if (webformId) {
            fixture(await readForm(webformId, "BeforeDelete"))
            let error = null; try { await request("SessionDeleteForm", "mutation SessionDeleteForm($webformId: Int!, $leaveOrphanDocument: Boolean) { deleteWebform(webformId: $webformId, leaveOrphanDocument: $leaveOrphanDocument) { webformId } }", { webformId, leaveOrphanDocument: false }, true) } catch (e) { if (uncertainWrite.current) throw e; error = readableError(e.message) }
            const check = await request("SessionDeleteFormRead", "query SessionDeleteFormRead($id: Int!) { webform(id: $id) { webformId } }", { id: webformId })
            row.deletions.push({ webformId, error, status: Array.isArray(check?.webform) && !check.webform.some((record) => Number(record.webformId) === webformId) ? "Delete verified" : "Delete unverified" })
          }
          if (definitionId) {
            let error = null; try { await request("SessionDeleteDefinition", "mutation SessionDeleteDefinition($id: Int!) { deleteWebformDefinition(id: $id) { webformDefinitionId } }", { id: definitionId }, true) } catch (e) { if (uncertainWrite.current) throw e; error = readableError(e.message) }
            const check = await request("SessionDeleteDefinitionRead", "query SessionDeleteDefinitionRead($id: Int) { webformDefinition(id: $id) { webformDefinitionId } }", { id: definitionId })
            row.deletions.push({ definitionId, error, status: Array.isArray(check?.webformDefinition) && !check.webformDefinition.some((record) => Number(record.webformDefinitionId) === definitionId) ? "Delete verified" : "Delete unverified" })
          }
          row.status = row.deletions.every((entry) => entry.status === "Delete verified") ? "Disposable draft and definition deleted" : "Cleanup incomplete; inspect"
          if (row.status.startsWith("Disposable")) sessionTests = { ...sessionTests, webformId: null, definitionId: null, baseline: null }
        } else throw new Error("Unknown second-window step")
      } catch (error) {
        row.status = row.sent ? (uncertainWrite.current ? "Outcome unknown; do not repeat" : "Outcome requires inspection") : "Not sent: " + readableError(error.message)
        row.error = readableError(error.message)
      }
      row.completedAt = new Date().toISOString()
      commit()
    }
    const executePhase = async (mode) => {
      if (mode === "reads") rows = []
      if (mode === "suite") {
        suiteResults = await runPatientContextVariantSuite({ request, patientId, patient, sourceProfile: sd?.userProfile || settings?.userProfile, context: JSON.parse(testContext || "{}"), plan: suitePlan, previous: suiteResults, priorProfiles: earlierLoad?.profiles || [], active, uploadAttachment, uncertain: () => uncertainWrite.current || pendingWrites.current > 0, emit: (value) => {
          suiteResults = value; persistLedger()
          const last = value.cases[value.cases.length - 1]
          progress = { ...progress, group: value.progress?.group, groups: value.progress?.groups, groupKey: value.progress?.key, cases: value.cases.length, last: last ? last.id + " — " + last.status : null }
          update(`${progress.label || "Write variants"} · test group ${value.progress?.group || "—"} of ${value.progress?.groups || "—"}${value.progress?.key ? " (" + value.progress.key + ")" : ""} · ${value.cases.length} cases recorded`)
        } })
        update(suiteResults.status, false)
        return
      }
      if (mode === "session") {
        await sessionStep(options.step)
        return
      }
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
          goals: { names: ["Goal"], related: [] },
          goalLinks: { names: ["GoalLink"], related: ["attachedGoalId"] },
          needs: { names: ["Need"], related: [] },
          risks: { names: ["Risk", "ReactionRisk"], related: ["attachedReactionRiskId"] },
        }
        const limits = { maxDepth: 6, maxStates: 10000, pathsPerCollection: 12, maxProbes: 60 }
        missingExploration = {
          status: "Inspecting output schema", limits, matchRules: targets,
          scope: "Read-only candidate-path exploration. Name/type matches are not proof of semantic equivalence. No matching path within these bounds is not proof the API lacks the data.",
          coverage: { completed: false, truncated: false, visitedStates: 0, probesSent: 0 },
          collections: Object.keys(targets).map((collection) => ({ collection, status: "Not completed", matchedOutputTypes: [], paths: [] })),
        }
        update("Inspecting the live output schema for the missing collections…")
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
      if (mode === "writes" || mode === "verifiers") {
        if (!apiInventory?.mutations?.length) throw new Error("Inspect read/write API first.")
        // The one-click run re-exercises the corrected automatic verifiers (contact,
        // nickname, resource, changed-field and dedicated deletes) with default inputs only.
        const allowed = mode === "verifiers" ? suitePlan?.verifierOperations || [] : null
        const selected = (name) => allowed ? allowed.includes(name) : writeSelection === "all" || writeSelection === name
        if (allowed) {
          // paperFormParametersRx may only use a prescription this run created, never an existing chart row.
          const suitePrescription = (suiteResults?.created || []).find((entry) => entry.profile === "prescriptions" && Number(entry.id) > 0)
          if (!createdIds.prescriptionId && suitePrescription) createdIds = { ...createdIds, prescriptionId: Number(suitePrescription.id) }
          for (const operation of earlierLoad?.verifierOps || []) if (!writeResults.some((row) => row.operation === operation)) writeResults.push({ operation, phase: "verifiers", sentEarlierLoad: true, status: "Skipped: sent in an earlier load of this form; not repeated", verification: "Reconcile with that load's evidence file" })
        }
        let overrides
        try { overrides = allowed ? {} : JSON.parse(writeOverrides || "{}") } catch (_) { throw new Error("Write inputs must be a JSON object keyed by mutation name.") }
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
        const need = (name, available = ids) => { if (!available[name]) throw new Error(`Needs a successful ${name} creation earlier in this run, or explicit variable overrides`); return available[name] }
        const same = (actual, expected) => Array.isArray(expected) ? Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => same(actual[index], value)) : expected && typeof expected === "object" ? Boolean(actual && typeof actual === "object" && Object.keys(expected).every((key) => Object.prototype.hasOwnProperty.call(actual, key) && same(actual[key], expected[key]))) : actual === expected
        const eventFields = "serviceEventId serviceEpisodeId objectType objectTypeExt objectId service { code display system } phase { code display system } healthIssues { serviceEventHealthIssueId serviceEventId healthIssue { code display system } certainty { code display system } }"
        const eventRead = (operation) => `query ${operation}($patientId: Int!) { patient(id: $patientId) { patientId encounters { encounterId } serviceEpisodes { serviceEpisodeId serviceEvents { ${eventFields} } } } }`
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
          changePatientName: () => {
            // The one-click verifier never substitutes a placeholder usual name.
            if (allowed && (!patient?.name?.first || !patient?.name?.family)) throw new Error("Host patient first/family name unavailable; usual name cannot be preserved, so the nickname verifier was not sent")
            return { patientId, newUsualName: { first: patient?.name?.first || "WEBFORMS", family: patient?.name?.family || "TEST" }, newNickName: { first: "WEBFORMS", family: "TEST", text: marker } }
          },
          changePrescription: () => ({ patientId, prescription: { prescriptionId: 0, patientId, medication: marker, comment: "Synthetic test only", orderDate: date } }),
          changeFavouriteMedication: () => ({ favouriteMedication: { favouriteMedicationId: 0, medication: marker, comment: "Synthetic test only" } }),
          changePrescriptionLog: () => ({ patientId, prescriptionLog: { prescriptionLogId: 0, createdDate: now, method: marker, logItems: [{ prescriptionId: need("prescriptionId"), medication: marker }] } }),
          changeTask: () => ({ patientId, task: { taskId: 0, ...assignee(), description: marker, note: marker, createdDate: date } }),
          changeServiceEpisode: () => {
            if (!context.service?.code || !context.service?.system) throw new Error("Set service coding in Test context for the service-episode create probe")
            const serviceMrpId = contextId("serviceMrpId")
            if (context.serviceMrp?.system !== "MOIS.USER" || String(context.serviceMrp?.code) !== String(serviceMrpId)) throw new Error("Set serviceMrp coding with system MOIS.USER and a code matching serviceMrpId from this test instance")
            // This complete shape passed a live create and separate read on
            // 2026-09-10. The earlier service-only payload failed; which added
            // fields are mandatory is still unknown. Never reuse membership IDs.
            return { patientId, serviceEpisode: {
              serviceEpisodeId: 0, patientId, encounterId: null, startDate: date, endDate: null,
              service: context.service, serviceMrp: context.serviceMrp, serviceMrpId,
              stopReason: { code: null, display: null, system: null }, stopNote: null, note: marker,
              includeOnDemographics: { code: "N", display: "No", system: "MOIS-YESNO" },
              includeOnCarePlan: { code: "N", display: "No", system: "MOIS-YESNO" }, asMemberOfs: [],
            } }
          },
          changeServiceEvent: () => {
            const serviceEpisodeId = need("serviceEpisodeId")
            if (!context.eventService?.code || !context.eventService?.system) throw new Error("Set eventService coding in Test context; event service coding is separate from the parent episode service")
            // Complete create and INITIAL -> FOLLOWUP update passed live reads
            // on 2026-09-10. Use explicit encounter context, never a guessed ID.
            return { serviceEpisodeId, serviceEvent: {
              serviceEventId: 0, serviceEpisodeId, objectType: "tdt_encounter", objectTypeExt: null,
              objectId: contextId("serviceEventEncounterId"), service: context.eventService,
              phase: { code: "INITIAL", display: "Initial", system: "MOIS-SERVICEEVENTPHASE" }, healthIssues: [],
            } }
          },
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
          if (!op || !selected(name)) continue
          if ((allowed || writeSelection === "all") && writeResults.some((result) => result.operation === name && (result.sent || result.sentEarlierLoad))) continue
          const row = { operation: name, graphqlField: op.name, ...(allowed ? { phase: "verifiers" } : {}), status: "Preparing", marker, verification: "Not performed", cleanup: "Test data is retained unless a dedicated delete probe succeeds" }
          writeResults.push(row)
          update(`Preparing ${name}…`)
          let sent = false
          try {
            const inputIds = { ...ids }
            if (name === "changeServiceEpisode") delete ids.serviceEpisodeId
            if (name === "changeServiceEvent") delete ids.serviceEventId
            if (name === "query") throw new Error("Query namespace on mutation root; not a write operation")
            if (name === "sendFax" && (writeSelection !== "sendFax" || !overrides.sendFax?.eFaxAccountId || !overrides.sendFax?.recipients?.some((recipient) => recipient.faxNumber))) throw new Error("Select sendFax individually and supply eFaxAccountId and explicit test recipients in variable overrides")
            const resolve = (value) => value === "$patientId" ? patientId : typeof value === "string" && value.startsWith("$created.") ? need(value.slice(9), inputIds) : Array.isArray(value) ? value.map(resolve) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)])) : value
            const vars = Object.prototype.hasOwnProperty.call(overrides, name) ? resolve(overrides[name]) : recipes[name] ? await recipes[name]() : null
            if (!vars || typeof vars !== "object" || Array.isArray(vars)) throw new Error("Needs explicit variable overrides for this operation")
            for (const key of Object.keys(vars)) if (!op.args.some((arg) => arg.name === key)) throw new Error(`Unknown argument ${key}`)
            for (const arg of op.args) if (arg.defaultValue == null || vars[arg.name] !== undefined) validate(vars[arg.name], arg.type, arg.name)
            let eventBaseline = null
            let eventChildBaselineIds = new Set()
            let eventExpectedChildren
            if (name === "changeServiceEvent") {
              const event = vars.serviceEvent
              if (!event || !["serviceEventId", "serviceEpisodeId", "objectType", "objectTypeExt", "objectId", "service", "phase"].every((field) => Object.prototype.hasOwnProperty.call(event, field))) throw new Error("Supply all seven service-event identity, object, service and phase fields")
              if (!(vars.serviceEpisodeId > 0) || event.serviceEpisodeId !== vars.serviceEpisodeId || !Number.isSafeInteger(event.serviceEventId) || event.serviceEventId < 0) throw new Error("Use matching positive episode IDs and event ID 0 for create or its positive ID for update")
              if (event.serviceEventId === 0 && !Array.isArray(event.healthIssues)) throw new Error("Supply an explicit healthIssues array for event creation; omitted/null create semantics need a separate Custom GraphQL probe")
              if (event.objectType !== "tdt_encounter" || !(event.objectId > 0)) throw new Error("This runner verifies tdt_encounter links; use Custom GraphQL probe to explore other object types")
              const before = await request("ReadServiceEventBeforeProbe", eventRead("ReadServiceEventBeforeProbe"), { patientId })
              const charts = before.patient?.filter((record) => Number(record.patientId) === patientId) || []
              const parents = charts.length === 1 ? charts[0].serviceEpisodes?.filter((record) => Number(record.serviceEpisodeId) === vars.serviceEpisodeId) || [] : []
              if (parents.length !== 1 || !Array.isArray(parents[0].serviceEvents) || !charts[0].encounters?.some((record) => Number(record.encounterId) === event.objectId)) throw new Error("A fresh patient query must contain the target episode and encounter before sending an event write")
              eventBaseline = parents[0].serviceEvents
              eventChildBaselineIds = new Set(charts[0].serviceEpisodes.flatMap((episode) => episode.serviceEvents || []).flatMap((record) => record.healthIssues || []).map((child) => Number(child.serviceEventHealthIssueId)))
              if (event.serviceEventId > 0 && eventBaseline.filter((record) => Number(record.serviceEventId) === event.serviceEventId).length !== 1) throw new Error("The event to update must already belong to the target episode")
              // Live September 10 reads: omitted/null updates preserved the
              // existing list; [] cleared it. Verify preservation against the
              // fresh baseline, never against an echoed mutation response.
              const preserveChildren = event.serviceEventId > 0 && event.healthIssues == null
              eventExpectedChildren = preserveChildren ? eventBaseline.find((record) => Number(record.serviceEventId) === event.serviceEventId).healthIssues : event.healthIssues
              if (!Array.isArray(eventExpectedChildren)) throw new Error("A fresh healthIssues array is required to verify preserved child links")
              eventExpectedChildren = JSON.parse(JSON.stringify(eventExpectedChildren))
              row.healthIssueVerificationMode = preserveChildren ? "Preserve baseline list" : "Match submitted list"
            }
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
            if (name === "changeServiceEvent") selection = ` { ${eventFields} }`
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
            if (allowed) persistLedger()
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
            if (name === "changeServiceEpisode") {
              // Mutation output can echo unsaved values. Only release the parent
              // ID to dependent event probes after the separate read matches.
              const submitted = vars.serviceEpisode
              const episodeFields = "serviceEpisodeId patientId encounterId startDate endDate service { code display system } serviceMrp { code display system } serviceMrpId stopReason { code display system } stopNote note includeOnDemographics { code display system } includeOnCarePlan { code display system } asMemberOfs { asMemberOfId providerId }"
              row.verificationQuery = `query VerifyServiceEpisode($patientId: Int!) { patient(id: $patientId) { patientId serviceEpisodes { ${episodeFields} } } }`
              const check = await request("VerifyServiceEpisode", row.verificationQuery, { patientId })
              const episodes = check.patient?.find((record) => Number(record.patientId) === patientId)?.serviceEpisodes || []
              const returnedEpisodes = returned.flatMap((record) => record.serviceEpisodes || [])
              const returnedMatches = returnedEpisodes.filter((record) => record.note === submitted.note && Number(record.serviceEpisodeId) > 0)
              const expectedId = Number(submitted.serviceEpisodeId) > 0 ? Number(submitted.serviceEpisodeId) : returnedMatches.length === 1 ? Number(returnedMatches[0].serviceEpisodeId) : null
              const matches = episodes.filter((record) => Number(record.serviceEpisodeId) > 0 && (expectedId ? Number(record.serviceEpisodeId) === expectedId : typeof submitted.note === "string" && submitted.note.length > 0 && record.note === submitted.note))
              const record = matches.length === 1 ? matches[0] : null
              const fields = Object.keys(submitted).filter((field) => field !== "serviceEpisodeId")
              row.verificationChecks = fields.map((field) => ({ field: `serviceEpisode.${field}`, matched: Boolean(record && same(record[field], submitted[field])) }))
              const matched = fields.length > 0 && Number(record?.patientId) === patientId && row.verificationChecks.every((check) => check.matched)
              row.verification = matched ? "Verified: submitted episode fields read back" : "Submitted episode fields not independently verified"
              if (expectedId) row.recordId = expectedId
              if (matched) { row.status = "Write verified"; row.recordId = Number(record.serviceEpisodeId); ids.serviceEpisodeId = row.recordId }
              update("Checked service episode")
              continue
            }
            if (name === "changeServiceEvent") {
              const submitted = vars.serviceEvent
              row.verificationQuery = eventRead("VerifyServiceEvent")
              const check = await request("VerifyServiceEvent", row.verificationQuery, { patientId })
              const charts = check.patient?.filter((record) => Number(record.patientId) === patientId) || []
              const parents = charts.length === 1 ? charts[0].serviceEpisodes?.filter((record) => Number(record.serviceEpisodeId) === vars.serviceEpisodeId) || [] : []
              const events = parents.length === 1 && Array.isArray(parents[0].serviceEvents) ? parents[0].serviceEvents : []
              const beforeIds = new Set(eventBaseline.map((record) => Number(record.serviceEventId)))
              const fields = [...new Set([...Object.keys(submitted).filter((field) => field !== "serviceEventId"), "healthIssues"])]
              // Live evidence: child ID 0 becomes a positive ID; retained
              // positive IDs survive certainty updates and mixed-list adds.
              // Match new children uniquely by submitted fields and parent,
              // never by an echoed mutation ID or list position alone.
              const sameChildren = (actual, expected, eventId) => {
                if (expected == null) return actual === expected
                if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return false
                const actualIds = actual.map((child) => Number(child.serviceEventHealthIssueId))
                if (new Set(actualIds).size !== actual.length || !actualIds.every((id) => Number.isSafeInteger(id) && id > 0) || !actual.every((child) => Number(child.serviceEventId) === eventId)) return false
                const used = new Set()
                return expected.every((child) => {
                  const matches = actual.filter((record) => !used.has(Number(record.serviceEventHealthIssueId)) && (child.serviceEventHealthIssueId === 0 ? !eventChildBaselineIds.has(Number(record.serviceEventHealthIssueId)) : child.serviceEventHealthIssueId > 0 && Number(record.serviceEventHealthIssueId) === child.serviceEventHealthIssueId) && Object.keys(child).filter((key) => key !== "serviceEventHealthIssueId").every((key) => same(record[key], child[key])))
                  if (matches.length !== 1) return false
                  used.add(Number(matches[0].serviceEventHealthIssueId))
                  return true
                })
              }
              const matchesField = (record, field) => field === "healthIssues" ? sameChildren(record[field], eventExpectedChildren, Number(record.serviceEventId)) : same(record[field], submitted[field])
              const candidates = events.filter((record) => Number(record.serviceEventId) > 0 && (submitted.serviceEventId > 0 ? Number(record.serviceEventId) === submitted.serviceEventId : !beforeIds.has(Number(record.serviceEventId)) && fields.every((field) => matchesField(record, field))))
              const record = candidates.length === 1 ? candidates[0] : null
              const expectedIds = new Set([...beforeIds, ...(record ? [Number(record.serviceEventId)] : [])])
              const membershipMatches = events.length === expectedIds.size && new Set(events.map((event) => Number(event.serviceEventId))).size === events.length && events.every((event) => expectedIds.has(Number(event.serviceEventId)))
              row.verificationChecks = fields.map((field) => ({ field: `serviceEvent.${field}`, matched: Boolean(record && matchesField(record, field)) }))
              row.verificationChecks.push({ field: "serviceEvents.membership", matched: Boolean(record && membershipMatches) })
              const matched = row.verificationChecks.every((check) => check.matched)
              row.verification = matched ? "Verified: submitted event fields and expected child membership read back" : "Submitted event fields or expected child membership not independently verified"
              if (matched) { row.status = "Write verified"; row.recordId = Number(record.serviceEventId); ids.serviceEventId = row.recordId; row.healthIssueRecordIds = (record.healthIssues || []).map((child) => Number(child.serviceEventHealthIssueId)) }
              update("Checked service event")
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
    }
    try {
      const phases = mode === "all" ? ["api", "reads", "roots", "missing", "suite", "verifiers"] : [mode]
      const labels = { api: "API discovery", reads: "Direct chart reads", roots: "Root queries", missing: "Missing-route exploration", suite: "Write variants", verifiers: "Corrected verifier re-run" }
      for (const [index, phase] of phases.entries()) {
        if (!active()) break
        suitePhase = phase
        progress = mode === "all" ? { phase, index: index + 1, phases: phases.length, label: `Phase ${index + 1} of ${phases.length}: ${labels[phase]}`, startedAt: progress?.startedAt || new Date().toISOString() } : null
        const phaseResult = { phase, status: "Running", startedAt: new Date().toISOString() }; phaseResults.push(phaseResult)
        if (mode === "all") update(progress.label + "…")
        if (["suite", "verifiers"].includes(phase) && (uncertainWrite.current || pendingWrites.current)) { phaseResult.status = "Skipped: an earlier write has an unknown outcome"; phaseResult.completedAt = new Date().toISOString(); continue }
        if (phase === "verifiers" && phaseResults.some((entry) => entry.phase === "suite" && entry.status === "Failed" && /context|patient/i.test(entry.error || ""))) { phaseResult.status = "Skipped: the write-variant phase failed its patient/context check"; phaseResult.completedAt = new Date().toISOString(); continue }
        try { await executePhase(phase); phaseResult.status = "Finished; inspect case outcomes" } catch (error) {
          phaseResult.status = "Failed"; phaseResult.error = readableError(error.message)
          if (phase === "missing" && missingExploration) { missingExploration.error = readableError(error.message); missingExploration.status = "Exploration incomplete" }
          if (phase === "api" && apiInventory) apiInventory.error = readableError(error.message)
          update(readableError(error.message), false)
          if (mode !== "all") break
        } finally { phaseResult.completedAt = new Date().toISOString(); if (mode === "all") update("Completed " + (labels[phase] || phase), false) }
      }
      if (mode === "all" && progress) progress = { ...progress, finishedAt: new Date().toISOString(), label: "Run finished" }
    } finally {
      if (active()) { busy.current = false; setState((previous) => ({ ...previous, busy: false, progress: mode === "all" ? progress : previous.progress, message: mode === "all" ? "Run finished. Step 3: click Download full evidence JSON and send that file back." : previous.message })) }
    }
  }
  const stop = () => {
    if (pendingWrites.current) uncertainWrite.current = true
    epoch.current += 1
    busy.current = false
    setState((previous) => ({ ...previous, suiteResults: previous.suiteResults ? { ...previous.suiteResults, status: "Stopped; inspect any pending write", cases: previous.suiteResults.cases.map((r) => r.status === "Running" ? { ...r, status: r.sent ? "Outcome unknown; request may finish" : "Stopped before result" } : r) } : null, missingExploration: previous.missingExploration && !previous.missingExploration.coverage.completed ? { ...previous.missingExploration, status: "Stopped; exploration incomplete" } : previous.missingExploration, customResults: (previous.customResults || []).map((row) => row.status === "Sent; outcome pending" ? { ...row, status: "Stopped; request may finish" } : row), writeResults: (previous.writeResults || []).map((row) => row.status === "Sent; outcome pending" ? { ...row, status: "Outcome unknown; request may finish" } : row), sessionTests: previous.sessionTests ? { ...previous.sessionTests, rows: previous.sessionTests.rows.map((row) => row.status === "Running" ? { ...row, status: row.sent ? "Outcome unknown; request may finish" : "Stopped before result" } : row) } : previous.sessionTests, busy: false, message: "Stopped. Any request already sent may finish; its result will be ignored." }))
  }
  // Evidence summary: what ran, what needs attention, what was skipped and why, and
  // which checks are deferred (including the optional second-window tests).
  const valueKeys = ["sentValues", "baselineValues", "readBackValues", "normalized"]
  const withoutValues = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => !valueKeys.includes(key)))
  const suiteCases = current.suiteResults?.cases || []
  const verifierRows = (current.writeResults || []).filter((row) => row.phase === "verifiers")
  const sessionRows = current.sessionTests?.rows || []
  const deferredChecks = (suitePlan?.manualCases || []).map((item) => {
    const ran = sessionRows.filter((row) => (item.sessionSteps || []).includes(row.step))
    return { id: item.id, area: item.area, requires: item.requires || "separate check", inForm: Boolean(item.sessionSteps?.length), includedInRunAll: false, reason: item.reason,
      status: ran.length ? "Optional second-window steps recorded: " + ran.map((row) => row.step + " — " + row.status).join("; ") : item.deferredStatus || "Deferred: separate check" }
  })
  const exercised = new Set([...suiteCases.filter((row) => row.sent).map((row) => row.operation), ...verifierRows.filter((row) => row.sent).map((row) => row.operation)])
  const statusCounts = suiteCases.reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] || 0) + 1 }), {})
  const runSummary = current.hasRun ? {
    casesRecorded: suiteCases.length,
    casesWithRequestsSent: suiteCases.filter((row) => row.sent).length,
    statusCounts,
    needsAttention: [...suiteCases, ...verifierRows.map((row) => ({ id: "verifiers." + row.operation, status: row.status, error: row.error || (row.status === "Write verified" || row.status === "Delete verified" ? null : row.verification) }))]
      .filter((row) => /Rejected|not verified|unverified|Unexpected|inspect|Outcome unknown|differ|failed|not applied|changed value|retained|rejected|error/i.test(row.status || ""))
      .map(({ id, status, error, reason }) => ({ id, status, detail: error || reason || null })),
    skippedWithReason: [...suiteCases.filter((row) => /^(Needs context|Not applicable|Skipped|Stopped)/.test(row.status)).map(({ id, status, reason, error }) => ({ id, status, reason: reason || error || null })),
      ...verifierRows.filter((row) => /^(Not attempted|Skipped)/.test(row.status)).map((row) => ({ id: "verifiers." + row.operation, status: row.status, reason: row.error || row.verification || null })),
      ...(current.phaseResults || []).filter((phase) => /^Skipped/.test(phase.status)).map((phase) => ({ id: "phase." + phase.phase, status: phase.status, reason: phase.status }))],
    verifierReRun: verifierRows.map(({ operation, status, verification, recordId, error }) => ({ operation, status, verification, recordId: recordId ?? null, error: error || null })),
    mutationsNotExercised: (current.apiInventory?.mutations || []).map((operation) => operation.name).filter((name) => name !== "query" && !exercised.has(name)),
    deferredChecks,
  } : null
  const report = JSON.stringify({
    reportType: "mois-patient-context-live-query",
    reportVersion: 7,
    diagnosticsRevision: revision,
    componentVersion: PATIENT_CONTEXT_QUERY_TEST_VERSION,
    testPatient: current.testPatient || null,
    progress: current.progress || null,
    runSummary,
    deferredChecks,
    earlierLoadLedger: current.earlierLoad || null,
    phaseResults: current.phaseResults || [],
    comprehensiveSuite: current.suiteResults ? (({ context, origins, ...summary }) => ({ ...summary, cases: summary.cases.map(withoutValues) }))(current.suiteResults) : null,
    secondWindowTests: sessionRows.map(({ input, read, before, ...row }) => row),
    evidenceCapture: { exchanges: exchanges.current.length, truncated: evidenceTruncated.current, limitCharacters: 25000000 },
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
  const downloadReport = (full = false) => {
    if (!current.hasRun) return
    const urlApi = window.URL
    if (!window.Blob || !urlApi?.createObjectURL) return
    const fullReport = () => JSON.stringify({ ...JSON.parse(report), evidenceKind: "Full test-patient evidence: inputs, baseline/mutation/independent-read responses, failures, skipped cases with reasons and deferred checks. Credentials removed.",
      context: current.suiteResults?.context, origins: current.suiteResults?.origins,
      comprehensiveSuiteCasesWithValues: suiteCases, writeResultsWithInputs: current.writeResults || [], secondWindowTestsWithReads: sessionRows,
      exchanges: exchanges.current }, (key, value) => /jwToken|authorization|password|secret|accessToken|refreshToken|cookie/i.test(key) ? "[redacted]" : value, 2).split(String(auth.jwToken || "\u0000")).join("[redacted]")
    const url = urlApi.createObjectURL(new window.Blob([full ? fullReport() : report], { type: "application/json;charset=utf-8" }))
    const link = window.document.createElement("a")
    link.href = url
    link.download = `mois-live-query-${full ? "full-evidence" : "results"}-${Date.now()}.json`
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
    <div style={{ margin: "16px 0", padding: 12, background: "#f1f5f9", color: "#0f172a" }}>
      <h3>Comprehensive test suite · revision {revision} · component {PATIENT_CONTEXT_QUERY_TEST_VERSION}</h3>
      <ol>
        <li>Open this form on the designated MOIS test patient and tick the confirmation below.</li>
        <li>Click <strong>Run all remaining tests</strong> once and leave the form open until the status says the run finished.</li>
        <li>Click <strong>Download full evidence JSON</strong> and send that file back.</li>
      </ol>
      <p>The run performs API discovery, chart and root reads, missing-route exploration, every configured create/update/omission/null/empty/restore variant with an independent read after each write (starting with task acknowledgement name/date while both task flags are Y), then re-runs the corrected contact, nickname, resource and changed-field verifiers. Writes create synthetic records and change this test chart; restoration is attempted and reported. Checks that need a second window are listed below as optional and are never run by this button.</p>
      <label style={{ display: "block", margin: "8px 0" }}><input type="checkbox" aria-label="Confirm designated test patient" checked={confirmed} disabled={!ready || current.busy} onChange={(event) => setConfirmedPatient(event.target.checked ? { patientId, at: new Date().toISOString() } : null)} /> This is the designated MOIS test patient (Patient ID {Number.isInteger(patientId) ? patientId : "—"}, chart {patient?.chartNumber || "—"}). Test writes may change it.</label>
      {!current.suiteResults && !current.busy && readLedger()?.profiles?.length ? <p>An earlier load of this form in this browser already sent requests for {readLedger().profiles.length} test groups on this patient. Run all remaining tests skips those groups rather than repeating them. <button type="button" onClick={() => { writeLedger(null); setLedgerVersion(ledgerVersion + 1) }}>Forget earlier-load record</button></p> : null}
      <button type="button" disabled={!ready || current.busy || !suitePlan || !confirmed || uncertainWrite.current || pendingWrites.current > 0} onClick={() => run("all")}>Run all remaining tests</button>{" "}
      <button type="button" disabled={!current.hasRun} onClick={() => downloadReport(true)}>Download full evidence JSON</button>
      {current.progress ? <p aria-label="Run progress"><strong>{current.progress.label}</strong>{current.progress.group ? ` · test group ${current.progress.group} of ${current.progress.groups} (${current.progress.groupKey})` : ""}{current.progress.cases ? ` · ${current.progress.cases} cases recorded` : ""}{current.progress.last ? ` · last: ${current.progress.last}` : ""}</p> : null}
      <p>The full file contains test-patient values, exact inputs, responses and independent read-backs, failures, skipped cases with reasons and deferred checks, with credentials removed. Keep it private. Download a checkpoint while running if needed. Clicking again skips every case that already sent a request; missing context can be supplied under Test context.</p>
      {(current.phaseResults || []).filter((p) => p.status === "Failed" || /^Skipped/.test(p.status)).map((p, i) => <p key={i}>{p.phase}: {p.error || p.status}</p>)}
      {current.suiteResults ? <details open><summary>{current.suiteResults.cases.length} variant results · {current.suiteResults.status}</summary>
        <ul>{current.suiteResults.cases.map((row) => <li key={row.id}><code>{row.id}</code> — {row.status}{row.error || row.reason ? <p>{row.error || row.reason}</p> : null}</li>)}</ul>
        {verifierRows.length ? <details><summary>Corrected verifier re-run ({verifierRows.length})</summary><ul>{verifierRows.map((row) => <li key={row.operation}><code>{row.operation}</code> — {row.status}. {row.verification}{row.error ? <p>{row.error}</p> : null}</li>)}</ul></details> : null}
        <details><summary>Operations still unexercised</summary><ul>{(runSummary?.mutationsNotExercised || []).map((operation) => <li key={operation}><code>{operation}</code></li>)}</ul></details>
      </details> : null}
      <details><summary>Deferred and optional checks (not run by Run all remaining tests)</summary><ul>{deferredChecks.map((item) => <li key={item.id}><strong>{item.area}</strong> — {item.status}. {item.reason}</li>)}</ul></details>
    </div>
    <details style={{ margin: "16px 0", padding: 12, border: "1px dashed #94a3b8" }}><summary><strong>Optional — needs a second window, run later</strong> (form locking and simultaneous edits; not part of Run all remaining tests)</summary>
      <p>These checks need two MOIS windows open at the same time on this same test patient: window A and window B. Use a second login for window B when possible; a second window under the same login only shows same-user behaviour. Tick the test-patient confirmation in each window. Each window downloads its own full evidence JSON; send both files. Skipping this section leaves these checks reported as deferred.</p>
      <h4>Form lock observation</h4>
      <ol>
        <li>Window A: save this diagnostics form once, then keep it open.</li>
        <li>Window B: open that same saved form instance for this patient. Note whether MOIS shows it read-only, shows a lock notice, or allows editing.</li>
        <li>In each window, describe what MOIS showed in the box below and click <strong>Record lock state here</strong>. It reads the saved form record (isLockedToUser, state, audit stamp) and the runtime lock test when available.</li>
      </ol>
      <label>What MOIS showed in this window <textarea aria-label="Lock observation" value={sessionObservation} disabled={current.busy} onChange={(event) => setSessionObservation(event.target.value)} rows={2} style={{ width: "100%" }} /></label>
      <h4>Simultaneous edits and API lock on a disposable draft</h4>
      <ol>
        <li>Window A: <strong>A1</strong> creates a disposable draft form and definition on this patient and shows its form ID; then <strong>A2</strong> holds a baseline copy.</li>
        <li>Window B: enter that form ID below, then <strong>B1</strong> writes a window-B answer.</li>
        <li>Window A: <strong>A3</strong> writes from the stale A2 baseline and reports whether window B's answer was lost, preserved or rejected.</li>
        <li>Window A: <strong>A4</strong> sets isLockedToUser=Y. Window B: <strong>B2</strong> tries to write while locked. Window A: <strong>A5</strong> unlocks, then <strong>A6</strong> deletes the draft and definition with independent reads.</li>
      </ol>
      <label>Form ID for second-window steps <input aria-label="Second-window form ID" value={sessionTarget} disabled={current.busy} onChange={(event) => setSessionTarget(event.target.value.replace(/[^0-9]/g, ""))} /></label>
      {current.sessionTests?.webformId ? <p>This window's disposable draft: form ID <strong>{current.sessionTests.webformId}</strong> (definition {current.sessionTests.definitionId}).</p> : null}
      <p>{[["lock-observe", "Record lock state here"], ["A1", "A1 — Create disposable shared draft"], ["A2", "A2 — Hold baseline"], ["B1", "B1 — Write as window B"], ["A3", "A3 — Write from stale baseline"], ["A4", "A4 — Lock draft"], ["B2", "B2 — Try write while locked (window B)"], ["A5", "A5 — Unlock draft"], ["A6", "A6 — Delete draft and definition"]].map(([step, label]) => <React.Fragment key={step}><button type="button" disabled={!ready || current.busy || !confirmed || uncertainWrite.current || pendingWrites.current > 0} onClick={() => run("session", { step })}>{label}</button>{" "}</React.Fragment>)}</p>
      {sessionRows.length ? <ul>{sessionRows.map((row, index) => <li key={index}><code>{row.step}</code> ({row.window}) — {row.status}{row.error ? <p>{row.error}</p> : null}</li>)}</ul> : null}
    </details>
    <details><summary>Custom GraphQL probe</summary><p>Run a named query or mutation through this MOIS login. This supports additional fields and operations without rebuilding the form. Mutations execute immediately when Run custom operation is clicked. Responses appear here, but response values are excluded from the diagnostic report. Query text is included, so use variables for patient values.</p>
      <textarea aria-label="Custom GraphQL query" value={customQuery} disabled={current.busy} onChange={(event) => setCustomQuery(event.target.value)} rows={6} style={{ width: "100%", fontFamily: "monospace" }} />
      <textarea aria-label="Custom GraphQL variables" value={customVariables} disabled={current.busy} onChange={(event) => setCustomVariables(event.target.value)} rows={4} style={{ width: "100%", fontFamily: "monospace" }} />
      <button type="button" disabled={!ready || current.busy} onClick={() => run("custom")}>Run custom operation</button>
      {(current.customResults || []).map((row, index) => <details key={index}><summary>{row.operation} — {row.status}</summary>{row.error ? <p>{row.error}</p> : null}{row.response ? <textarea aria-label={`Custom response ${index + 1}`} readOnly value={row.response} rows={10} style={{ width: "100%", fontFamily: "monospace" }} /> : null}</details>)}
    </details>
    <label>Write operation <select aria-label="Write operation" value={writeSelection} disabled={current.busy} onChange={(event) => setWriteSelection(event.target.value)}><option value="all">All unattempted operations</option><option value="changeObservationPanels">changeObservations — separate panel probe</option>{(current.apiInventory?.mutations || []).map((operation) => <option key={operation.name} value={operation.name}>{operation.name}</option>)}</select></label>
    <details><summary>Test context</summary><p>The combined suite discovers patient-owned encounters, the current user profile and existing service/MRP codings. Set userProfileId if the host does not expose it; set appointmentStatus to a valid status coding to enable new-appointment status variants. Individual probes can also use real test-instance IDs and codes: providerId for appointments; assignedUserId or assignedTeamId for tasks; service coding, serviceMrp coding (MOIS.USER) and its matching serviceMrpId for service episodes. Events also need eventService coding and serviceEventEncounterId; a fresh read checks that the episode and encounter belong to this patient. These recipes use the complete shapes verified on September 10; minimum required fields remain unknown. Optional panelName overrides the vendor test panel coding. Missing context is reported before sending a write.</p>
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
    {" "}<button type="button" disabled={!current.hasRun || current.busy} onClick={() => downloadReport(false)}>Download results JSON</button>
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
