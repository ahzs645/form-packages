const { useEffect, useMemo } = React

// The formula engine lives in FormulaKit (shared with EditableTable formula
// columns). Read it only at call time: component files load in no fixed order.
const _toNumericValue = (value) => FormulaKit.toNumericValue(value)
const _toComparableValue = (value) => FormulaKit.toComparableValue(value)
const _hasValue = (value) => FormulaKit.hasValue(value)
const _extractComputedReferences = (expression) => FormulaKit.extractReferences(expression)
const _roundComputedValue = (value, precision) => FormulaKit.roundValue(value, precision)
const _evaluateComputedExpression = (expression, valuesByFieldId, currentFieldId) =>
  FormulaKit.evaluate(expression, valuesByFieldId, currentFieldId)
const _hasAllReferencedValues = (expression, valuesByFieldId) =>
  FormulaKit.hasAllReferencedValues(expression, valuesByFieldId)

const _toDisplayValue = (value, precision, resultType) => {
  if (typeof value === "string") return value
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (!Number.isFinite(value)) return ""
  if (Number.isFinite(precision) && precision >= 0) {
    const rounded = value.toFixed(Math.round(precision))
    return resultType === "text" ? rounded : String(Number(rounded))
  }
  return String(value)
}

const _getInterpretationRange = (value, interpretation) => {
  if (!Number.isFinite(value) || !Array.isArray(interpretation?.ranges)) return null
  return interpretation.ranges.find((range) => {
    const min = Number(range?.min)
    const max = Number(range?.max)
    const passesMin = !Number.isFinite(min) || value >= min
    const passesMax = !Number.isFinite(max) || value <= max
    return passesMin && passesMax
  }) ?? null
}

const _normalizeCalculationPolicy = (value) => {
  if (value === "calculated-until-overridden" || value === "suggested-calculation") return value
  return "always-calculated"
}

const _computedFieldState = (valuesByFieldId, fieldId) => {
  const state = valuesByFieldId?.__computedFieldState?.[fieldId]
  return state && typeof state === "object" ? state : null
}

const _computedFieldIsOverridden = (valuesByFieldId, fieldId) =>
  _computedFieldState(valuesByFieldId, fieldId)?.overridden === true

const _shouldApplyComputedValue = (calculationPolicy, isOverridden) => {
  const policy = _normalizeCalculationPolicy(calculationPolicy)
  if (policy === "suggested-calculation") return false
  if (policy === "calculated-until-overridden") return !isOverridden
  return true
}

const _toEditableComputedValue = (value) => {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return _toComparableValue(value) === value ? String(value) : String(_toComparableValue(value) ?? "")
}

const _normalizeComputedDisplayStyle = (displayStyle) =>
  displayStyle === "compact" || displayStyle === "prominent" ? displayStyle : "field"

const ComputedValuePresentation = ({
  fieldId,
  label,
  value,
  displayStyle = "field",
  displaySuffix = "",
  labelPosition = "left",
  placeholder = "Calculated automatically",
  readOnly = true,
  required = false,
  size,
  onChange,
  isDarkMode = false,
  numeric = false,
  resetAction = null,
}) => {
  const normalizedStyle = _normalizeComputedDisplayStyle(displayStyle)

  // Editable calculations retain the regular field control regardless of the
  // chosen summary style, so override and suggestion policies remain usable.
  if (normalizedStyle === "field" || readOnly === false) {
    // The reset sits inside the box at the far right. Fluent paints the suffix
    // slot grey with 10px padding; the wrapper covers that so the icon reads
    // as part of the input rather than an add-on button.
    const renderSuffix = resetAction
      ? () => {
        const { IconButton, TooltipHost } = Fluent
        return (
          <div style={{ display: "flex", alignItems: "center", alignSelf: "stretch", margin: "0 -10px", padding: "0 2px", background: isDarkMode ? "#1f1f1f" : "#ffffff" }}>
            {displaySuffix ? <span style={{ marginRight: 4 }}>{displaySuffix}</span> : null}
            <TooltipHost content={resetAction.tooltip}>
              <IconButton
                iconProps={{ iconName: "Refresh" }}
                ariaLabel={resetAction.tooltip}
                onClick={resetAction.onReset}
                styles={{ root: { width: 26, height: 26 }, icon: { fontSize: 13 } }}
              />
            </TooltipHost>
          </div>
        )
      }
      : undefined
    const textFieldProps = renderSuffix
      ? { onRenderSuffix: renderSuffix }
      : displaySuffix ? { suffix: displaySuffix } : undefined
    if (numeric) {
      // Stored as text: Numeric's storeAsNumber would turn "7." into 7 while
      // typing. Formulas read numeric text as numbers.
      return (
        <Numeric
          fieldId={fieldId}
          label={label}
          value={value}
          onChange={onChange}
          labelPosition={labelPosition}
          placeholder={placeholder}
          readOnly={readOnly}
          required={required}
          size={size}
          typeNumber="decimal"
          textFieldProps={textFieldProps}
        />
      )
    }
    return (
      <TextArea
        fieldId={fieldId}
        label={label}
        value={value}
        onChange={onChange}
        labelPosition={labelPosition}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        size={size}
        textFieldProps={textFieldProps}
      />
    )
  }

  const isProminent = normalizedStyle === "prominent"
  const displayValue = value === undefined || value === null || value === ""
    ? "Incomplete"
    : String(value)
  const containerStyle = isProminent
    ? {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: "12px",
        padding: "12px 14px",
        borderRadius: "6px",
        border: `1px solid ${isDarkMode ? "#2a5a8c" : "#b8d4f0"}`,
        backgroundColor: isDarkMode ? "#1a3a5c" : "#e6f2ff",
      }
    : {
        display: "flex",
        alignItems: "baseline",
        gap: "6px",
        padding: "4px 0",
        fontSize: "13px",
      }

  return (
    <div style={containerStyle}>
      <span style={{
        color: isDarkMode ? "#a0a0a0" : "#666666",
        fontWeight: isProminent ? 600 : 500,
        flexShrink: 0,
      }}>
        {label}:
      </span>
      <span style={{
        fontWeight: isProminent ? 700 : 400,
        fontSize: isProminent ? "16px" : "13px",
        fontStyle: displayValue === "Incomplete" ? "italic" : "normal",
      }}>
        {displayValue}{displayValue !== "Incomplete" && displaySuffix ? ` ${displaySuffix}` : ""}
      </span>
    </div>
  )
}

const ComputedField = ({
  fieldId,
  label,
  expression,
  precision,
  resultType = "number",
  displayStyle = "field",
  displaySuffix = "",
  calculationPolicy = "always-calculated",
  labelPosition = "left",
  placeholder = "Calculated automatically",
  size,
  required = false,
  readOnly: readOnlyProp,
  disabled = false,
  showInterpretation = false,
  interpretation,
  // Legacy calculators (BPI Severity/Interference/Relief, PEG, DLQI) pair
  //   IF (IsNull(...), 'Incomplete', '')
  // with mirrored visible expressions so a partial total never shows and never
  // persists. "compute-anyway" is the default so existing forms are unchanged.
  incompleteBehavior = "compute-anyway",
  incompleteText = "Incomplete",
  resolvedValue,
  presentationOnly = false,
  isDarkMode = false,
  // Prior observations are display-only. They never seed the calculated field
  // and never participate in its MOIS write.
  showHistory = false,
  historyObservationCode = "",
  historyLoincCode = "",
  historyUnits = "",
  historyMaxRows = 1,
  graphLinkText = "Graph",
  graphHref = "",
}) => {
  // Authorship/lock rules arrive as a dynamic `disabled` expression from the
  // exporter; fold it into readOnly.
  const readOnly = disabled ? true : readOnlyProp
  const theme = useTheme()
  const [fd, setFd] = useActiveData()
  const valuesByFieldId = fd?.field?.data || {}
  const policy = _normalizeCalculationPolicy(calculationPolicy)
  const isOverridden = _computedFieldIsOverridden(valuesByFieldId, fieldId)

  const computedValue = useMemo(
    () => presentationOnly
      ? resolvedValue
      : _evaluateComputedExpression(expression, valuesByFieldId, fieldId),
    [expression, fieldId, presentationOnly, resolvedValue, valuesByFieldId]
  )

  const roundedValue = useMemo(
    () => _roundComputedValue(computedValue, precision),
    [computedValue, precision]
  )

  const isIncomplete = useMemo(
    () => (
      incompleteBehavior !== "compute-anyway" &&
      !_hasAllReferencedValues(expression, valuesByFieldId)
    ),
    [expression, incompleteBehavior, valuesByFieldId]
  )

  const storedValue = useMemo(() => {
    // A partial total must not reach the patient record, so an incomplete
    // calculation persists null regardless of which incomplete style is used.
    if (isIncomplete) return null
    if (typeof roundedValue === "string" || typeof roundedValue === "boolean") return roundedValue
    if (!Number.isFinite(roundedValue)) return null
    if (resultType === "text") {
      return _toDisplayValue(roundedValue, precision, "text")
    }
    return roundedValue
  }, [isIncomplete, precision, resultType, roundedValue])

  const displayValue = useMemo(() => {
    if (isIncomplete) return incompleteBehavior === "show-text" ? incompleteText : ""
    // String/boolean results (e.g. iif chains returning "LOW"/"HIGH") must
    // render, not just persist — Number.isFinite alone blanked them.
    if (typeof roundedValue === "string") return roundedValue
    if (typeof roundedValue === "boolean") return String(roundedValue)
    if (!Number.isFinite(roundedValue)) return ""
    return _toDisplayValue(roundedValue, precision, resultType)
  }, [incompleteBehavior, incompleteText, isIncomplete, precision, resultType, roundedValue])

  const currentValue = valuesByFieldId?.[fieldId]
  const enteredDisplayValue = _toEditableComputedValue(currentValue)
  const renderedValue = policy === "always-calculated" ? displayValue : enteredDisplayValue
  const externallyReadOnly = readOnly === true
  const canEdit = policy !== "always-calculated" && !externallyReadOnly
  // LayoutItem owns the left-label column used by TextArea and measurement
  // fields. Supplemental rows live outside that control, so derive the same
  // column width from the MOIS theme instead of using an unrelated fixed inset.
  const labelColumnWidth = theme?.mois?.defaultCommonControlStyle?.minLabelWidth ?? 240
  const supplementalInset = labelPosition !== "left"
    ? 0
    : typeof labelColumnWidth === "number"
      ? `${labelColumnWidth + 10}px`
      : `calc(${labelColumnWidth} + 10px)`

  const canShowInterpretation = useMemo(
    () => Boolean(showInterpretation && _hasAllReferencedValues(expression, valuesByFieldId)),
    [expression, showInterpretation, valuesByFieldId]
  )

  const interpretationValue = policy === "always-calculated"
    ? roundedValue
    : _toNumericValue(currentValue)
  const interpretationRange = useMemo(
    () => canShowInterpretation ? _getInterpretationRange(interpretationValue, interpretation) : null,
    [canShowInterpretation, interpretation, interpretationValue]
  )

  useEffect(() => {
    if (presentationOnly) return
    if (!fieldId) return
    if (!_shouldApplyComputedValue(policy, isOverridden)) return
    setFd((draft) => {
      if (!draft.field) {
        draft.field = { data: {}, status: {}, history: [] }
      }
      if (!draft.field.data || typeof draft.field.data !== "object") {
        draft.field.data = {}
      }
      const stateContainer = draft.field.data.__computedFieldState && typeof draft.field.data.__computedFieldState === "object"
        ? draft.field.data.__computedFieldState
        : {}
      const previousState = stateContainer[fieldId]
      const valueMatches = draft.field.data[fieldId] === storedValue
      const stateMatches = previousState?.overridden === false
        && previousState?.policy === policy
        && previousState?.lastCalculatedValue === storedValue
      if (valueMatches && stateMatches) return
      draft.field.data[fieldId] = storedValue
      stateContainer[fieldId] = {
        overridden: false,
        policy,
        lastCalculatedValue: storedValue,
      }
      draft.field.data.__computedFieldState = stateContainer
    })
  // The generated form's parent useOnLoad effect can run after this child
  // effect and replace field data with InitialData/sourceFormData. Track the
  // persisted value itself so an owned calculation repairs that late seed on
  // the next render. Suggested values and user overrides still opt out through
  // _shouldApplyComputedValue above.
  }, [currentValue, fieldId, isOverridden, policy, presentationOnly, setFd, storedValue])

  const markOverridden = () => {
    if (!fieldId || !canEdit) return
    setFd((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const stateContainer = draft.field.data.__computedFieldState && typeof draft.field.data.__computedFieldState === "object"
        ? draft.field.data.__computedFieldState
        : {}
      stateContainer[fieldId] = {
        overridden: true,
        policy,
        lastCalculatedValue: storedValue,
      }
      draft.field.data.__computedFieldState = stateContainer
    })
  }

  const useCalculatedValue = () => {
    if (!fieldId || !canEdit) return
    setFd((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const stateContainer = draft.field.data.__computedFieldState && typeof draft.field.data.__computedFieldState === "object"
        ? draft.field.data.__computedFieldState
        : {}
      draft.field.data[fieldId] = storedValue
      stateContainer[fieldId] = {
        overridden: policy === "suggested-calculation",
        policy,
        lastCalculatedValue: storedValue,
      }
      draft.field.data.__computedFieldState = stateContainer
    })
  }

  // Legacy hid the score control outright until every item was answered. All
  // hooks above have already run, so bailing out here is safe.
  if (isIncomplete && incompleteBehavior === "hide") return null

  return (
    <div>
      <ComputedValuePresentation
        fieldId={fieldId}
        label={label}
        value={renderedValue}
        onChange={markOverridden}
        displayStyle={displayStyle}
        labelPosition={labelPosition}
        placeholder={placeholder}
        readOnly={!canEdit}
        required={required}
        size={size}
        displaySuffix={displaySuffix}
        isDarkMode={isDarkMode}
        numeric={resultType !== "text" && canEdit}
        resetAction={policy === "calculated-until-overridden" && isOverridden && canEdit && !presentationOnly
          ? {
              onReset: useCalculatedValue,
              tooltip: displayValue
                ? `Reset to the calculated value (${displayValue})`
                : "Reset to the calculation (it has no value until its inputs are filled in)",
            }
          : null}
      />
      {showHistory && (historyObservationCode || historyLoincCode) ? (
        <div
          data-computed-observation-history
          style={{ marginTop: 4, marginLeft: supplementalInset }}
        >
          <ObservationValueDisplay
            labelPosition="none"
            observationCode={historyObservationCode}
            loincCode={historyLoincCode}
            units={historyUnits}
            maxRows={historyMaxRows}
            graphLinkText={graphLinkText}
            graphHref={graphHref}
            presentation="measurement-summary"
          />
        </div>
      ) : null}
      {!presentationOnly && policy === "suggested-calculation" ? (
        <div style={{ marginTop: 4, marginLeft: supplementalInset, display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#475569" }}>
          <span><strong>Suggested:</strong> {displayValue || "Unavailable until inputs are complete"}</span>
          {displayValue && canEdit ? (
            <button type="button" onClick={useCalculatedValue} style={{ border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", padding: "2px 8px", cursor: "pointer" }}>
              Use suggestion
            </button>
          ) : null}
        </div>
      ) : null}
      {!presentationOnly && interpretationRange ? (
        <div style={{ marginTop: 4, marginLeft: supplementalInset, fontSize: 12, color: "#475569" }}>
          <strong>{interpretation?.label || "Interpretation"}:</strong> {interpretationRange.label}
          {interpretationRange.description ? <span> - {interpretationRange.description}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
