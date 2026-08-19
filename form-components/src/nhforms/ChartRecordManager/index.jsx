
if (typeof ChartRecordManager === "undefined") {
  window.ChartRecordManager = null
}
if (typeof ChartRecordEditor === "undefined") {
  window.ChartRecordEditor = null
}
if (typeof ChartRecordList === "undefined") {
  window.ChartRecordList = null
}
if (typeof ChartRecordCreateButton === "undefined") {
  window.ChartRecordCreateButton = null
}

/**
 * ChartRecordManager - Full CRUD over a writable chart collection, composed
 * from existing pieces rather than re-implemented:
 *
 * - ChartRecordTable renders the collection (its presets supply columns) and
 *   gains an Actions column through its onEditRecord/onDeleteRecord props.
 * - The SubformScoring data-entry modal is driven through its controlled
 *   props (isOpen/onOpenChange, hideTriggerButton, dataEntryValueRoot) and
 *   executes the MOIS write action on Complete — same executor, same
 *   payloadMap/payloadDefaults contract as subform write actions.
 * - The record-id convention does the rest: create sends no id (server
 *   defaults it to 0), edit seeds the record's id, delete sends the negated
 *   id. See the write registry's recordIdKey.
 *
 * Behavior is modeled on the vendor's Bright Health CRUD test forms
 * (test_connections / test_chart_preference): template-prefilled create
 * buttons, per-row Action.Bar, confirm-before-delete, edits in a scratch
 * store that never touches parent form data, stay-open on mutation error,
 * and refresh(sd) after every successful write.
 *
 * This file defines both packagings of the same machinery:
 * - `ChartRecordManager` — the all-in-one composite field.
 * - `ChartRecordList` + `ChartRecordCreateButton` + `ChartRecordEditor` —
 *   the decomposed builder pieces: the table, each template button, and the
 *   editor modal as separate form fields, coordinated through a managerId
 *   channel (default: the shared `source`), so authors arrange them freely
 *   on the canvas.
 */

// Writable collections this manager understands, with their registry write
// target and record-id key. deleteVerified mirrors the registry's recordIdKey
// presence: the negative-id delete convention is vendor/engine-verified for
// connections and preferences only — prescriptions and long-term medications
// stay create/update until a delete is verified.
// A lockstep test keeps this map aligned with lib/mois-write-action-registry.
const CHART_RECORD_MANAGER_TARGETS = {
  connections: {
    writeTarget: "connection.changeConnection",
    recordIdKey: "connectionId",
    deleteVerified: true,
  },
  preferences: {
    writeTarget: "chartPreference.changeChartPreference",
    recordIdKey: "chartPreferenceId",
    deleteVerified: true,
  },
  prescriptions: {
    writeTarget: "prescription.updatePrescription",
    recordIdKey: "prescriptionId",
    deleteVerified: false,
  },
  // longTermMedications is deliberately absent: the chart rows carry
  // longTermMedicationId but LongTermMedicationInput takes medicationId, and
  // that id round-trip is unverified — add it once the mapping is confirmed.
}

// List-row properties that must never reach a mutation payload. `key` is the
// list-selection row key; the vendor form strips it (and connection `name`,
// which the server derives from the linked provider) before saving.
const _chartRecordManagerStripKeys = {
  connections: ["key", "name"],
  default: ["key"],
}

// Vendor-informed default modal fields per collection: coded columns get
// real coded editors (choice + codeSystem serializes {code, display, system})
// instead of free text. `provider` is deliberately absent from the
// connections defaults — it needs a provider search control; authors add it
// (or map it) explicitly when required.
// Widths mirror the vendor dialogs' compact two-column grid: paired dates
// and yes/no fields sit side by side (width "half" — the data-entry renderer
// already understands it); detail textareas span the row.
const _chartRecordManagerDefaultFieldPresets = {
  connections: [
    { id: "connectionType", label: "Role", type: "choice", codeSystem: "MOIS-CONNECTIONTYPE", width: "half" },
    { id: "providerType", label: "Provider type", type: "choice", codeSystem: "MOIS-CONNECTIONPROVIDERTYPE", width: "half" },
    { id: "startDate", label: "Start date", type: "date", width: "half" },
    { id: "stopDate", label: "End date", type: "date", width: "half" },
    { id: "stopReason", label: "Stopped reason", type: "choice", codeSystem: "AIHS-STOPREASON" },
    { id: "stopNote", label: "Stopped note", type: "textarea" },
    { id: "comment", label: "Comment", type: "textarea" },
    { id: "includeOnDemographics", label: "Show on demographics", type: "choice", codeSystem: "MOIS-YESNO", width: "half" },
    { id: "isCareTeamMember", label: "Care team member", type: "choice", codeSystem: "MOIS-YESNO", width: "half" },
  ],
  preferences: [
    { id: "classification", label: "Classification", type: "choice", codeSystem: "MOIS-PREFERENCECLASSIFICATION", width: "half" },
    { id: "preferenceType", label: "Subject type", type: "choice", codeSystem: "MOIS-PREFERENCETYPE", width: "half" },
    { id: "preference", label: "Preference", type: "text" },
    { id: "subjectDetail", label: "Subject detail", type: "textarea" },
    { id: "instruction", label: "Instruction", type: "choice", codeSystem: "MOIS-PREFINST" },
    { id: "reason", label: "Reason", type: "choice", codeSystem: "MOIS-PREFERENCEREASON" },
    { id: "startDate", label: "Start date", type: "date", width: "half" },
    { id: "endDate", label: "End date", type: "date", width: "half" },
    { id: "sensitive", label: "Sensitive", type: "choice", codeSystem: "MOIS-YESNO", width: "half" },
    { id: "includeOnDemographics", label: "Show on demo.", type: "choice", codeSystem: "MOIS-YESNO", width: "half" },
  ],
}

// Derive a usable modal field set from the collection's table columns when
// the author has not configured one and no vendor-informed preset exists:
// visible data columns become text/date fields; key/hidden/action columns
// are skipped.
const _chartRecordManagerDefaultFields = (source) => {
  const fieldPreset = _chartRecordManagerDefaultFieldPresets[source]
  if (fieldPreset) return fieldPreset
  const preset = _chartRecordTablePresets[source] || {}
  const columns = preset.columns || []
  return columns
    .filter((col) => col.id && col.type !== "key" && col.type !== "hidden" && col.type !== "action")
    .map((col) => ({
      id: col.id,
      label: col.title || col.id,
      type: col.type === "date" ? "date" : "text",
    }))
}

/**
 * Cascade rules applied when a modal field changes, recreating the vendor
 * forms' dynamics: changing the connection type looks up its default provider
 * type in MOIS-CONNECTIONTYPEDEFAULT, and changing the provider type clears
 * the selected provider (test_connections); the preference instruction list
 * is layered per classification/subject (test_chart_preference — see
 * _chartRecordManagerFieldTransforms).
 * Rule shape: { when, setFromOptionList: { field, optionList, displayList }, clear: [ids] }
 */
const _chartRecordManagerDefaultCascades = {
  connections: [
    {
      when: "connectionType",
      setFromOptionList: {
        field: "providerType",
        optionList: "MOIS-CONNECTIONTYPEDEFAULT",
        displayList: "MOIS-CONNECTIONPROVIDERTYPE",
      },
    },
    { when: "providerType", clear: ["provider"] },
  ],
}

const _chartRecordManagerApplyCascades = (cascades, fieldId, value, draft, sd) => {
  let next = draft
  for (const rule of cascades) {
    if (!rule || rule.when !== fieldId) continue
    const spec = rule.setFromOptionList
    if (spec) {
      const code = value && typeof value === "object" ? value.code : value
      const mapped = code != null ? sd?.optionLists?.[spec.optionList]?.[code] : undefined
      if (mapped !== undefined && next[spec.field]?.code !== mapped) {
        next = {
          ...next,
          [spec.field]: {
            code: mapped,
            display: sd?.optionLists?.[spec.displayList]?.[mapped] ?? mapped,
            system: spec.displayList ?? spec.optionList,
          },
        }
      }
    }
    if (Array.isArray(rule.clear)) {
      for (const clearId of rule.clear) {
        if (next[clearId] !== undefined) next = { ...next, [clearId]: undefined }
      }
    }
  }
  return next
}

/**
 * Per-source dynamic field adjustments driven by the current draft. The
 * preference instruction picklist is layered exactly like the vendor's
 * findInstructionCodeSystem: MOIS-PREFINST:{classification}:{subject},
 * falling back to MOIS-PREFINST:{classification}.
 */
const _chartRecordManagerFieldTransforms = {
  preferences: (fields, draft, sd) =>
    fields.map((field) => {
      if (field.id !== "instruction") return field
      const classification = draft?.classification?.code ?? draft?.classification
      if (!classification) return field
      const subject = draft?.codedSubject?.code ?? draft?.subjectConceptName
      const layered = `MOIS-PREFINST:${classification}:${subject}`
      const fallback = `MOIS-PREFINST:${classification}`
      const codeSystem =
        subject && sd?.optionLists?.[layered] !== undefined
          ? layered
          : sd?.optionLists?.[fallback] !== undefined
            ? fallback
            : field.codeSystem
      return codeSystem === field.codeSystem ? field : { ...field, codeSystem }
    }),
}

/**
 * Editor coordination channel. The decomposed builder pieces
 * (ChartRecordList rows, ChartRecordCreateButton) are independent fields on
 * the form; they reach "their" ChartRecordEditor through this module-level
 * registry keyed by managerId. Every piece defaults its managerId to its
 * `source`, so one editor + one list + any number of buttons per collection
 * wire themselves with zero configuration; explicit managerId separates two
 * groups over the same collection.
 */
const __chartRecordEditorChannels = {}

const _chartRecordEditorRegister = (managerId, handler) => {
  __chartRecordEditorChannels[managerId] = handler
  return () => {
    if (__chartRecordEditorChannels[managerId] === handler) {
      delete __chartRecordEditorChannels[managerId]
    }
  }
}

const openChartRecordEditor = (managerId, request) => {
  const handler = __chartRecordEditorChannels[managerId]
  if (handler) {
    handler(request)
  } else {
    console.warn(
      `ChartRecordEditor "${managerId}" is not on this form — add a Chart Record Editor field with managerId "${managerId}" (or matching source).`
    )
  }
}

/**
 * ChartRecordEditor - the create/edit modal, delete confirm, and MOIS write
 * action for one chart collection. Renders nothing until a request arrives on
 * its channel (from ChartRecordList, ChartRecordCreateButton, or the
 * composite ChartRecordManager). One editor serves any number of triggers.
 */
ChartRecordEditor = ({
  id,
  source = "connections",
  managerId,
  writeTarget,
  recordIdKey,
  dataEntryFields,
  payloadMap,
  payloadDefaults = {},
  modalTitle,
  completeButtonText = "Save",
  confirmDeleteTitle = "Confirm delete",
  confirmDeleteText = "Delete the selected record from the chart?",
  cascades,
  stripKeys,
}) => {
  const sd = useSourceData()
  const [fd] = useActiveData()

  const resolvedManagerId = managerId || source
  const targetInfo = CHART_RECORD_MANAGER_TARGETS[source] || {}
  const resolvedWriteTarget = writeTarget || targetInfo.writeTarget || null
  const resolvedRecordIdKey = recordIdKey || targetInfo.recordIdKey || null
  const resolvedStripKeys =
    stripKeys || _chartRecordManagerStripKeys[source] || _chartRecordManagerStripKeys.default

  const writeDefinition = resolvedWriteTarget ? MOIS_WRITE_MUTATIONS[resolvedWriteTarget] : null

  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [draft, setDraft] = React.useState({})

  const resolvedCascades =
    Array.isArray(cascades) ? cascades : _chartRecordManagerDefaultCascades[source] || []

  // Template creates fix some fields (classification, subject, ...) and hide
  // them — the vendor's per-button Grid placement. Carried per open request.
  const [openMeta, setOpenMeta] = React.useState(null)

  const resolvedFields = React.useMemo(() => {
    let baseFields =
      Array.isArray(dataEntryFields) && dataEntryFields.length > 0
        ? dataEntryFields
        : _chartRecordManagerDefaultFields(source)
    if (Array.isArray(openMeta?.hiddenFieldIds) && openMeta.hiddenFieldIds.length > 0) {
      const hidden = new Set(openMeta.hiddenFieldIds)
      baseFields = baseFields.filter((field) => !hidden.has(field?.id))
    }
    const transform = _chartRecordManagerFieldTransforms[source]
    return transform ? transform(baseFields, draft, sd) : baseFields
  }, [dataEntryFields, source, draft, sd, openMeta])

  // payloadMap maps payload keys onto modal field ids. With none configured,
  // every modal field maps onto the payload key of the same name.
  const resolvedPayloadMap = React.useMemo(() => {
    if (payloadMap && Object.keys(payloadMap).length > 0) return payloadMap
    const identity = {}
    for (const field of resolvedFields) {
      if (field?.id) identity[field.id] = field.id
    }
    return identity
  }, [payloadMap, resolvedFields])

  // Edit carries the full record as payload defaults so unmapped fields are
  // preserved on update (the vendor form sends the whole record back).
  const [openDefaults, setOpenDefaults] = React.useState(null)
  const [pendingDelete, setPendingDelete] = React.useState(null)

  // Hook order must be stable, so the delete runner is created even when the
  // target is unresolved; the guard below never lets it fire in that case.
  const [runDeleteMutation] = useMutation(
    writeDefinition?.document ?? "mutation chartRecordManagerNoop { __typename }",
    { auth: sd?.auth, operationName: resolvedWriteTarget || "chartRecordManagerNoop" },
    sd?.errorDispatch
  )

  const chartRefresh = React.useCallback(() => {
    if (typeof refresh === "function") refresh(sd)
  }, [sd])

  const stripRecord = React.useCallback(
    (record) => {
      const cleaned = { ...(record || {}) }
      for (const stripKey of resolvedStripKeys) delete cleaned[stripKey]
      return cleaned
    },
    [resolvedStripKeys]
  )

  const openForCreate = React.useCallback(
    (request) => {
      const merged = { ...payloadDefaults, ...(request?.defaults || {}) }
      // Seed mapped defaults into the draft so the modal SHOWS the template's
      // prefilled values (the vendor's PreferenceButton subform does); the
      // rest of the defaults still travel in the payload unmapped.
      const seeded = {}
      for (const [payloadKey, fieldId] of Object.entries(resolvedPayloadMap)) {
        if (merged[payloadKey] !== undefined) seeded[fieldId] = merged[payloadKey]
      }
      setDraft(seeded)
      setOpenDefaults(merged)
      setOpenMeta({
        hiddenFieldIds: Array.isArray(request?.hiddenFieldIds) ? request.hiddenFieldIds : null,
        title: typeof request?.title === "string" && request.title ? request.title : null,
      })
      setIsModalOpen(true)
    },
    [payloadDefaults, resolvedPayloadMap]
  )

  const openForEdit = React.useCallback(
    (record) => {
      const cleaned = stripRecord(record)
      const seeded = {}
      for (const [payloadKey, fieldId] of Object.entries(resolvedPayloadMap)) {
        if (cleaned[payloadKey] !== undefined) seeded[fieldId] = cleaned[payloadKey]
      }
      setDraft(seeded)
      setOpenDefaults(cleaned)
      setOpenMeta(null)
      setIsModalOpen(true)
    },
    [resolvedPayloadMap, stripRecord]
  )

  const handleConfirmDelete = React.useCallback(async () => {
    const record = pendingDelete
    setPendingDelete(null)
    if (!record || !writeDefinition || !resolvedRecordIdKey) return
    const recordId = Number(record[resolvedRecordIdKey])
    if (!Number.isFinite(recordId) || recordId <= 0) return
    const contextId = _resolveWriteActionId(writeDefinition.idVariable, { patientIdPath: undefined }, {
      sd,
      fd,
      sourceData: sd,
      formData: fd?.field?.data,
      patient: sd?.patient,
    })
    // The server contract: a negative record id is a delete marker.
    const variables = writeDefinition.buildVariables(contextId, {
      [resolvedRecordIdKey]: -Math.abs(recordId),
    })
    const result = await runDeleteMutation(variables)
    if (result) chartRefresh()
  }, [pendingDelete, writeDefinition, resolvedRecordIdKey, sd, fd, runDeleteMutation, chartRefresh])

  // Serve requests from the channel: any list or button on the form that
  // shares this editor's managerId drives this one modal instance.
  React.useEffect(
    () =>
      _chartRecordEditorRegister(resolvedManagerId, (request) => {
        if (!request) return
        if (request.kind === "create") openForCreate(request)
        else if (request.kind === "edit") openForEdit(request.record)
        else if (request.kind === "delete") setPendingDelete(request.record)
      }),
    [resolvedManagerId, openForCreate, openForEdit]
  )

  const dataEntryConfig = React.useMemo(() => {
    const [resource, mutation] = (resolvedWriteTarget || ".").split(".")
    return {
      fields: resolvedFields,
      calculations: [],
      action:
        resolvedWriteTarget && writeDefinition
          ? {
              kind: "moisMutation",
              resource,
              mutation,
              payloadMap: resolvedPayloadMap,
              payloadDefaults: openDefaults || payloadDefaults,
            }
          : undefined,
    }
  }, [resolvedWriteTarget, writeDefinition, resolvedFields, resolvedPayloadMap, openDefaults, payloadDefaults])

  return (
    <>
      {isModalOpen ? (
        <SubformScoring
          id={`${id || resolvedManagerId}Editor`}
          mode="data-entry"
          title={
            openMeta?.title
            || modalTitle
            || `Edit ${_chartRecordTablePresets[source]?.label || source}`
          }
          hideTriggerButton
          isOpen={isModalOpen}
          onOpenChange={(nextOpen) => {
            setIsModalOpen(nextOpen)
            if (!nextOpen) {
              setOpenDefaults(null)
              setOpenMeta(null)
            }
          }}
          dataEntryConfig={dataEntryConfig}
          dataEntryValueRoot={draft}
          onDataEntryValueChange={(fieldId, value) =>
            setDraft((current) =>
              _chartRecordManagerApplyCascades(
                resolvedCascades,
                fieldId,
                value,
                { ...current, [fieldId]: value },
                sd
              )
            )
          }
          completeButtonText={completeButtonText}
          persistNestedFields={false}
          bringForward={false}
          onCommitToParent={() => {
            // Runs only after the write action succeeded (a mutation error
            // records the failure and keeps the modal open).
            chartRefresh()
          }}
        />
      ) : null}

      {pendingDelete ? (
        // Mounted only while pending (not hidden-toggled): a closed-but-
        // mounted blocking Dialog leaves its focus trap eating outside
        // clicks until the close animation completes.
        <Fluent.Dialog
          hidden={false}
          onDismiss={() => setPendingDelete(null)}
          dialogContentProps={{
            type: Fluent.DialogType.normal,
            title: confirmDeleteTitle,
            subText: confirmDeleteText,
          }}
          modalProps={{ isBlocking: true, styles: { main: { maxWidth: "450px" } } }}
        >
          <Fluent.DialogFooter>
            <Fluent.PrimaryButton text="Confirm" onClick={handleConfirmDelete} />
            <Fluent.DefaultButton text="Cancel" onClick={() => setPendingDelete(null)} />
          </Fluent.DialogFooter>
        </Fluent.Dialog>
      ) : null}
    </>
  )
}

/**
 * ChartRecordList - the record table as its own builder field: the
 * collection list with per-row Edit/Delete actions routed to the
 * ChartRecordEditor sharing its managerId (default: the source).
 */
ChartRecordList = ({
  source = "connections",
  managerId,
  label,
  allowEdit = true,
  allowDelete,
  columns,
  filterPred,
  listCompare,
  selectionType = "none",
  ...props
}) => {
  const resolvedManagerId = managerId || source
  const targetInfo = CHART_RECORD_MANAGER_TARGETS[source] || {}
  const resolvedAllowDelete =
    typeof allowDelete === "boolean" ? allowDelete : targetInfo.deleteVerified === true
  const hasWriteTarget = Boolean(targetInfo.writeTarget)

  return (
    <ChartRecordTable
      source={source}
      label={label}
      columns={columns}
      filterPred={filterPred}
      listCompare={listCompare}
      selectionType={selectionType}
      onEditRecord={
        allowEdit && hasWriteTarget
          ? (record) => openChartRecordEditor(resolvedManagerId, { kind: "edit", record })
          : undefined
      }
      onDeleteRecord={
        resolvedAllowDelete && hasWriteTarget
          ? (record) => openChartRecordEditor(resolvedManagerId, { kind: "delete", record })
          : undefined
      }
      {...props}
    />
  )
}

/**
 * ChartRecordCreateButton - one template-prefilled create button as its own
 * builder field (the vendor PreferenceButton, decomposed): opens the
 * ChartRecordEditor sharing its managerId, seeded with this button's
 * defaults. Place as many as needed, anywhere on the form.
 */
ChartRecordCreateButton = ({
  source = "preferences",
  managerId,
  label,
  text,
  defaults = {},
  hiddenFieldIds,
  createTitle,
  fullWidth = false,
}) => {
  const resolvedManagerId = managerId || source
  return (
    // Natural width by default — a lone field row must not stretch the button
    // edge to edge (the vendor button rows are compact). fullWidth opts into
    // spanning the row for authors who want a banner-style action.
    <div
      style={
        fullWidth
          ? { display: "flex", width: "100%" }
          : { display: "inline-flex", maxWidth: "100%" }
      }
    >
      <Fluent.DefaultButton
        styles={fullWidth ? { root: { width: "100%" } } : undefined}
        text={text || label || `New ${(_chartRecordTablePresets[source]?.label || source).replace(/s$/, "").toLowerCase()}`}
        onClick={() =>
          openChartRecordEditor(resolvedManagerId, {
            kind: "create",
            defaults,
            hiddenFieldIds,
            title: createTitle,
          })
        }
      />
    </div>
  )
}

/**
 * ChartRecordManager - the all-in-one composite: list + create buttons +
 * editor in one field, for forms that don't need the pieces arranged
 * separately. Uses a private channel id so it never collides with
 * standalone pieces on the same form.
 */
ChartRecordManager = ({
  id = "chartRecordManager",
  label,
  source = "connections",
  writeTarget,
  recordIdKey,
  dataEntryFields,
  payloadMap,
  payloadDefaults = {},
  templates = [],
  allowCreate = true,
  allowEdit = true,
  allowDelete,
  newButtonText,
  modalTitle,
  completeButtonText = "Save",
  confirmDeleteTitle = "Confirm delete",
  confirmDeleteText = "Delete the selected record from the chart?",
  cascades,
  stripKeys,
  columns,
  filterPred,
  listCompare,
  selectionType = "none",
  ...props
}) => {
  const managerId = `__composite:${id}:${source}`

  const createButtons = allowCreate
    ? (Array.isArray(templates) && templates.length > 0
        ? templates.map((template, index) => ({
            key: `template-${index}`,
            text: template?.label || `New ${source}`,
            defaults: template?.defaults || {},
            hiddenFieldIds: template?.hiddenFieldIds,
            createTitle: template?.createTitle,
          }))
        : [
            {
              key: "new",
              text: newButtonText || `New ${(_chartRecordTablePresets[source]?.label || source).replace(/s$/, "").toLowerCase()}`,
              defaults: {},
            },
          ])
    : []

  return (
    <Fluent.Stack tokens={{ childrenGap: 10 }}>
      <ChartRecordList
        source={source}
        managerId={managerId}
        label={label}
        allowEdit={allowEdit}
        allowDelete={allowDelete}
        columns={columns}
        filterPred={filterPred}
        listCompare={listCompare}
        selectionType={selectionType}
        {...props}
      />

      {createButtons.length > 0 ? (
        <Fluent.Stack horizontal tokens={{ childrenGap: 8 }} wrap>
          {createButtons.map((button) => (
            <ChartRecordCreateButton
              key={button.key}
              source={source}
              managerId={managerId}
              text={button.text}
              defaults={button.defaults}
              hiddenFieldIds={button.hiddenFieldIds}
              createTitle={button.createTitle}
            />
          ))}
        </Fluent.Stack>
      ) : null}

      <ChartRecordEditor
        id={id}
        source={source}
        managerId={managerId}
        writeTarget={writeTarget}
        recordIdKey={recordIdKey}
        dataEntryFields={dataEntryFields}
        payloadMap={payloadMap}
        payloadDefaults={payloadDefaults}
        modalTitle={modalTitle}
        completeButtonText={completeButtonText}
        confirmDeleteTitle={confirmDeleteTitle}
        confirmDeleteText={confirmDeleteText}
        cascades={cascades}
        stripKeys={stripKeys}
      />
    </Fluent.Stack>
  )
}
