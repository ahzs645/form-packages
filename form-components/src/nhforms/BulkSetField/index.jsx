const { useEffect, useMemo } = React
const { Checkbox, DefaultButton, MessageBar, MessageBarType, PrimaryButton, Stack, Text } = Fluent

/**
 * Section-level control that writes one value into a list of enrolled questions.
 *
 * This reproduces two legacy MOIS Dynamic Form behaviours that share a single
 * shape — one control setting N fields at once:
 *
 *   str_action_default   "Apply defaults to All"  (54 controls across 10 forms)
 *     Each enrolled question carries its own default, so every row supplies a
 *     `value`.
 *
 *   str_action_noredflag "No Red Flags" / "Likely Negative"  (5 controls)
 *     Every enrolled question is asserted to the same negative answer, so rows
 *     omit `value` and fall back to `assertValue`. Legacy paired this with a
 *     warning driven by
 *       IF (str_action_noredflag = 'Y' and (str_field_0001 = 'Y' or ...), 1, 0)
 *     which is the `contradictionMode` prop here.
 *
 * The control persists its own answer (legacy records carry fids and store
 * ^on^/^off^ values such as Y/N or YES/NO), so `controlFieldId` is a real field.
 * Prior values captured for reversal live in field.status — the session channel
 * used by FormSessionRuntime and SubformScoring — so they are never written to
 * the patient record.
 */
const normalizeBulkTargets = (targets, assertValue) => {
  if (!Array.isArray(targets)) return []
  return targets
    .map((target) => {
      if (!target || typeof target !== "object") return null
      const fieldId = String(target.fieldId || target.targetFieldId || "").trim()
      if (!fieldId) return null
      const raw = target.value !== undefined && target.value !== null && target.value !== ""
        ? target.value
        : assertValue
      if (raw === undefined || raw === null || raw === "") return null
      return { fieldId, value: String(raw) }
    })
    .filter(Boolean)
}

const isBlankAnswer = (value) => (
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0)
)

const comparableAnswer = (value) => {
  if (value === undefined || value === null) return ""
  if (typeof value === "object") {
    return String(value.value ?? value.code ?? value.display ?? value.text ?? "")
  }
  return String(value)
}

function BulkSetField({
  id = "bulkSetField",
  controlFieldId,
  label = "Apply defaults to All",
  helpText = "",
  affordance = "checkbox",
  buttonType = "default",
  applyLabel = "",
  targets = [],
  assertValue = "",
  onValue = "Y",
  offValue = "N",
  onlyFillEmpty = false,
  reversible = true,
  contradictionMode = "warn",
  contradictionMessage = "Some answers below no longer match this selection.",
  readOnly = false,
  disabled = false,
}) {
  const [fd, setFd] = useActiveData()
  const effectiveControlFieldId = controlFieldId || id
  const fieldData = fd?.field?.data ?? {}
  const isDisabled = readOnly || disabled

  const normalizedTargets = useMemo(
    () => normalizeBulkTargets(targets, assertValue),
    [targets, assertValue]
  )

  const isApplied = comparableAnswer(fieldData[effectiveControlFieldId]) === String(onValue)

  const contradictedFieldIds = useMemo(() => {
    if (!isApplied || contradictionMode === "off") return []
    return normalizedTargets
      .filter((target) => comparableAnswer(fieldData[target.fieldId]) !== target.value)
      .map((target) => target.fieldId)
  }, [contradictionMode, fieldData, isApplied, normalizedTargets])

  const writeControl = (draft, value) => {
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
    if (!draft.field.status || typeof draft.field.status !== "object") draft.field.status = {}
    if (!draft.formData || typeof draft.formData !== "object") draft.formData = {}
    draft.field.data[effectiveControlFieldId] = value
    draft.formData[effectiveControlFieldId] = value
  }

  const apply = () => {
    if (isDisabled) return
    setFd((draft) => {
      writeControl(draft, onValue)
      const previous = {}
      normalizedTargets.forEach((target) => {
        const current = draft.field.data[target.fieldId]
        if (onlyFillEmpty && !isBlankAnswer(current)) return
        previous[target.fieldId] = current === undefined ? null : current
        draft.field.data[target.fieldId] = target.value
        draft.formData[target.fieldId] = target.value
      })
      draft.field.status[effectiveControlFieldId] = { appliedPrevious: previous }
    })
  }

  const unapply = () => {
    if (isDisabled) return
    setFd((draft) => {
      writeControl(draft, offValue)
      const previous = reversible
        ? draft.field.status?.[effectiveControlFieldId]?.appliedPrevious
        : null
      if (previous && typeof previous === "object") {
        Object.entries(previous).forEach(([fieldId, value]) => {
          if (value === null) {
            delete draft.field.data[fieldId]
            delete draft.formData[fieldId]
            return
          }
          draft.field.data[fieldId] = value
          draft.formData[fieldId] = value
        })
      }
      if (draft.field.status) delete draft.field.status[effectiveControlFieldId]
    })
  }

  // Legacy showed a warning banner and left the answers alone; "clear-control"
  // is the stricter reading where the assertion retracts itself once it is
  // contradicted. There is no submission-blocking channel at this layer.
  const shouldClearControl = contradictionMode === "clear-control" && contradictedFieldIds.length > 0
  useEffect(() => {
    if (!shouldClearControl || isDisabled) return
    setFd((draft) => {
      writeControl(draft, offValue)
      if (draft.field.status) delete draft.field.status[effectiveControlFieldId]
    })
    // writeControl closes over effectiveControlFieldId, which is in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldClearControl, isDisabled, offValue, effectiveControlFieldId])

  const showWarning = contradictionMode === "warn" && contradictedFieldIds.length > 0
  const ButtonComponent = buttonType === "primary" ? PrimaryButton : DefaultButton

  return (
    <div
      data-field-id={effectiveControlFieldId}
      data-component="BulkSetField"
      style={{ margin: "8px 10px" }}
    >
      <Stack tokens={{ childrenGap: 6 }}>
        {affordance === "button" ? (
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }} wrap>
            <ButtonComponent
              text={applyLabel || label}
              disabled={isDisabled}
              onClick={isApplied && reversible ? unapply : apply}
            />
            {isApplied ? (
              <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                Applied to {normalizedTargets.length} question
                {normalizedTargets.length === 1 ? "" : "s"}
              </Text>
            ) : null}
          </Stack>
        ) : (
          <Checkbox
            label={label}
            checked={isApplied}
            disabled={isDisabled}
            onChange={(_, checked) => (checked ? apply() : unapply())}
          />
        )}
        {helpText ? (
          <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
            {helpText}
          </Text>
        ) : null}
        {showWarning ? (
          <MessageBar messageBarType={MessageBarType.warning} isMultiline={false}>
            {contradictionMessage}
          </MessageBar>
        ) : null}
      </Stack>
    </div>
  )
}
