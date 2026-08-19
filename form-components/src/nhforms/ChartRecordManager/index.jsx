
if (typeof ChartRecordManager === "undefined") {
  window.ChartRecordManager = null
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

// Derive a usable modal field set from the collection's table columns when
// the author has not configured one: visible data columns become text/date
// fields; key/hidden/action columns are skipped.
const _chartRecordManagerDefaultFields = (source) => {
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
  stripKeys,
  columns,
  filterPred,
  listCompare,
  selectionType = "none",
  ...props
}) => {
  const sd = useSourceData()
  const [fd] = useActiveData()

  const targetInfo = CHART_RECORD_MANAGER_TARGETS[source] || {}
  const resolvedWriteTarget = writeTarget || targetInfo.writeTarget || null
  const resolvedRecordIdKey = recordIdKey || targetInfo.recordIdKey || null
  const resolvedAllowDelete =
    typeof allowDelete === "boolean" ? allowDelete : targetInfo.deleteVerified === true
  const resolvedStripKeys =
    stripKeys || _chartRecordManagerStripKeys[source] || _chartRecordManagerStripKeys.default

  const writeDefinition = resolvedWriteTarget ? MOIS_WRITE_MUTATIONS[resolvedWriteTarget] : null

  const resolvedFields = React.useMemo(
    () =>
      Array.isArray(dataEntryFields) && dataEntryFields.length > 0
        ? dataEntryFields
        : _chartRecordManagerDefaultFields(source),
    [dataEntryFields, source]
  )

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

  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [draft, setDraft] = React.useState({})
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
    (templateDefaults) => {
      setDraft({})
      setOpenDefaults({ ...payloadDefaults, ...(templateDefaults || {}) })
      setIsModalOpen(true)
    },
    [payloadDefaults]
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

  const createButtons = allowCreate
    ? (Array.isArray(templates) && templates.length > 0
        ? templates.map((template, index) => ({
            key: `template-${index}`,
            text: template?.label || `New ${source}`,
            defaults: template?.defaults || {},
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
      <ChartRecordTable
        source={source}
        label={label}
        columns={columns}
        filterPred={filterPred}
        listCompare={listCompare}
        selectionType={selectionType}
        onEditRecord={allowEdit && writeDefinition ? openForEdit : undefined}
        onDeleteRecord={
          resolvedAllowDelete && writeDefinition && resolvedRecordIdKey
            ? (record) => setPendingDelete(record)
            : undefined
        }
        {...props}
      />

      {createButtons.length > 0 && writeDefinition ? (
        <Fluent.Stack horizontal tokens={{ childrenGap: 8 }} wrap>
          {createButtons.map((button) => (
            <Fluent.DefaultButton
              key={button.key}
              text={button.text}
              onClick={() => openForCreate(button.defaults)}
            />
          ))}
        </Fluent.Stack>
      ) : null}

      {isModalOpen ? (
        <SubformScoring
          id={`${id}Editor`}
          mode="data-entry"
          title={modalTitle || `Edit ${_chartRecordTablePresets[source]?.label || source}`}
          hideTriggerButton
          isOpen={isModalOpen}
          onOpenChange={(nextOpen) => {
            setIsModalOpen(nextOpen)
            if (!nextOpen) setOpenDefaults(null)
          }}
          dataEntryConfig={dataEntryConfig}
          dataEntryValueRoot={draft}
          onDataEntryValueChange={(fieldId, value) =>
            setDraft((current) => ({ ...current, [fieldId]: value }))
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

      <Fluent.Dialog
        hidden={!pendingDelete}
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
    </Fluent.Stack>
  )
}
