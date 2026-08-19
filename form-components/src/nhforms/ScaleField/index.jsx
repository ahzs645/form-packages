const { useEffect } = React
const {
  Stack,
  Label,
  Text,
  StackItem,
  TooltipHost,
  ChoiceGroup,
} = Fluent

/**
 * ScaleField - A configurable scale input component for form builder
 *
 * This component bridges the form builder's scale field configuration
 * to a HoNOS-style scale UI with horizontal radio buttons and tooltips.
 *
 * Props:
 * - fieldId: string - The field identifier for data binding
 * - label: string - The field label/question text
 * - options: Array<{ value: number, label: string, description?: string }> - Scale options
 * - showLegend: boolean - Whether to show the legend row above
 * - showInlineLabels: boolean - Whether to show inline option labels beside radio controls
 * - showEndpointLabels: boolean - Whether to show first/last descriptions beneath the scale
 * - showTooltip: boolean - Whether to show the row tooltip when descriptions exist
 * - tooltipMode: "all" | "option" - Whether tooltips show all definitions or only the hovered option
 * - disableHorizontalScroll: boolean - Let a parent provide one shared horizontal scrollbar
 * - required: boolean - Whether the field is required
 * - readOnly: boolean - Whether the field is read-only
 */

// Styles
const LABEL_STYLE = {
  root: {
    margin: "0px 0px 0px 0px",
    width: "100%",
    fontSize: 14,
    lineHeight: "18px",
    fontWeight: 600,
  },
}

const LABEL_COLUMN_STYLE = {
  root: {
    minWidth: 140,
    width: "clamp(170px, 34%, 360px)",
    maxWidth: 360,
    paddingRight: 8,
    boxSizing: "border-box",
  },
}

const CHOICE_FIELD_STYLE = {
  root: {
    padding: "0px 6px 3px 6px",
    minWidth: 46,
    flex: "1 1 0",
    boxSizing: "border-box",
    textAlign: "center",
  },
}

const choiceGroupStyles = {
  flexContainer: {
    display: "flex",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    width: "100%",
    gap: "4px",
  },
}

const _getInlineMinWidth = (optionCount) => Math.max(360, optionCount * 64 + 170)

const _renderOptionTooltipContent = (description) => (
  <div style={{ maxWidth: 320, padding: "6px 8px", lineHeight: "16px" }}>
    {description}
  </div>
)

// Legend component for showing option labels above the scale
const ScaleFieldLegend = ({ options }) => {
  const inlineMinWidth = _getInlineMinWidth(options.length)
  const legendRowStyle = {
    root: {
      display: "flex",
      flexWrap: "nowrap",
      justifyContent: "space-between",
      width: "100%",
      gap: "4px",
    },
  }

  const legendItemStyle = {
    padding: "2px 6px 0px 6px",
    minWidth: 46,
    flex: "1 1 0",
    boxSizing: "border-box",
    textAlign: "center",
    fontSize: "10px",
    lineHeight: "14px",
  }

  return (
    <Stack horizontal style={{ minWidth: inlineMinWidth, margin: "0px 0px 8px 0px" }}>
      <StackItem disableShrink styles={LABEL_COLUMN_STYLE}>
        <Label styles={LABEL_STYLE}>&nbsp;</Label>
      </StackItem>
      <StackItem grow>
        <Stack horizontal styles={legendRowStyle}>
          {options.map((opt, i) => {
            const label = opt.label || opt.value

            return (
              <div key={i} style={legendItemStyle}>
                <Text style={{ fontSize: "inherit", lineHeight: "inherit" }}>
                  <b>{label}</b>
                </Text>
              </div>
            )
          })}
        </Stack>
      </StackItem>
    </Stack>
  )
}

// Tooltip content showing all option descriptions
const ScaleFieldTooltip = ({ options }) => {
  if (!options || options.length === 0) return null

  return (
    <div style={{ padding: "8px" }}>
      {options.map((opt, i) => (
        <Stack horizontal key={i} styles={{ root: { paddingBottom: 5 } }}>
          <StackItem styles={{ root: { minWidth: 30, fontWeight: 600 } }}>
            {opt.value}
          </StackItem>
          <StackItem>{opt.description || opt.label}</StackItem>
        </Stack>
      ))}
    </div>
  )
}

const ScaleFieldEndpointLabels = ({ options, textColor }) => {
  if (!options || options.length === 0) return null
  const firstDescription = options[0]?.description
  const lastDescription = options.length > 1 ? options[options.length - 1]?.description : null
  if (!firstDescription && !lastDescription) return null

  return (
    <Stack
      horizontal
      style={{
        minWidth: _getInlineMinWidth(options.length),
        marginTop: 2,
      }}
    >
      <StackItem disableShrink styles={LABEL_COLUMN_STYLE}>
        <span aria-hidden="true">&nbsp;</span>
      </StackItem>
      <StackItem grow>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            padding: "0px 6px 2px 6px",
            color: textColor,
            fontSize: 11,
            lineHeight: "15px",
          }}
        >
          <span style={{ maxWidth: "45%", textAlign: "left" }}>{firstDescription}</span>
          <span style={{ maxWidth: "45%", textAlign: "right" }}>{lastDescription}</span>
        </div>
      </StackItem>
    </Stack>
  )
}

// Main ScaleField component
const ScaleField = ({
  fieldId,
  label,
  options,
  showLegend = false,
  showInlineLabels = true,
  showEndpointLabels = false,
  showTooltip = false,
  tooltipMode = "all",
  disableHorizontalScroll = false,
  required = false,
  readOnly: readOnlyProp = false,
  disabled = false,
}) => {
  // Authorship/lock rules arrive as a dynamic `disabled` expression from the
  // exporter; fold it into the static readOnly behavior.
  const readOnly = readOnlyProp || disabled
  const [fieldData, setFieldData] = useActiveData(fd => fd?.field?.data || {})
  const theme = useTheme()

  // Default options if none provided (0-5 scale)
  const scaleOptions = options && options.length > 0 ? options : [
    { value: 0, label: "0", description: "None" },
    { value: 1, label: "1", description: "Mild" },
    { value: 2, label: "2", description: "Moderate" },
    { value: 3, label: "3", description: "Moderately Severe" },
    { value: 4, label: "4", description: "Severe" },
  ]

  // Convert options to ChoiceGroup format
  const normalizedTooltipMode = tooltipMode === "option" ? "option" : "all"
  // opt.key wins over the numeric value so distinct options may share a score
  // (HoNOS "9" = Unknown stores key "9" but scores 0, legacy parity).
  const choiceOptions = scaleOptions.map(opt => ({
    key: opt.key ?? String(opt.value),
    text: showInlineLabels ? (opt.label ?? String(opt.value)) : "",
    onRenderField:
      showTooltip && normalizedTooltipMode === "option" && (opt.description || opt.label)
        ? (optionProps, defaultRender) => (
            <TooltipHost
              tooltipProps={{
                onRenderContent: () => _renderOptionTooltipContent(opt.description || opt.label),
              }}
            >
              <span style={{ cursor: "help", display: "inline-block" }}>
                {defaultRender ? defaultRender(optionProps) : null}
              </span>
            </TooltipHost>
          )
        : undefined,
    styles: CHOICE_FIELD_STYLE,
  }))

  // Get current value from field data
  const currentData = fieldData?.[fieldId] || { selectedKey: null, value: null }

  // Initialize field data if needed
  useEffect(() => {
    if (!fieldData?.[fieldId]) {
      setFieldData({
        [fieldId]: {
          selectedKey: null,
          value: null,
          response: null,
        }
      })
    }
  }, [fieldId, fieldData, setFieldData])

  // Handle selection change
  const handleChange = (ev, option) => {
    if (readOnly) return

    const selectedOption = scaleOptions.find(o => (o.key ?? String(o.value)) === option.key)

    setFieldData({
      [fieldId]: {
        selectedKey: option.key,
        value: selectedOption?.value ?? parseInt(option.key, 10),
        response: selectedOption?.label || option.key,
        detailResponse: selectedOption?.description || selectedOption?.label || option.key,
      }
    })
  }

  // Styling based on selection state
  const containerStyle = {
    backgroundColor: currentData.selectedKey
      ? theme.semanticColors.bodyBackground
      : "#FBFBFB",
    padding: "6px 0px 6px 8px",
    marginBottom: "1px",
    borderRadius: "4px",
  }

  const hasDescriptions = scaleOptions.some(opt => opt.description)
  const shouldShowAllTooltip = showTooltip && hasDescriptions && normalizedTooltipMode === "all"
  const inlineMinWidth = _getInlineMinWidth(scaleOptions.length)
  const fieldContent = (
    <Stack horizontal verticalAlign="center" style={{ minWidth: inlineMinWidth }}>
      <StackItem disableShrink styles={LABEL_COLUMN_STYLE}>
        <Label
          styles={LABEL_STYLE}
          required={required}
        >
          {label}
        </Label>
      </StackItem>
      <StackItem grow>
        <ChoiceGroup
          key={`scale-${fieldId}-${currentData.selectedKey ?? "empty"}`}
          options={choiceOptions}
          selectedKey={currentData.selectedKey}
          onChange={handleChange}
          disabled={readOnly}
          required={required}
          styles={choiceGroupStyles}
        />
      </StackItem>
    </Stack>
  )

  return (
    <div style={{ overflowX: disableHorizontalScroll ? "visible" : "auto" }}>
      {showLegend && <ScaleFieldLegend options={scaleOptions} />}

      <div style={containerStyle}>
        {shouldShowAllTooltip ? (
          <TooltipHost
            id={`tooltip_${fieldId}`}
            tooltipProps={{
              onRenderContent: () => <ScaleFieldTooltip options={scaleOptions} />,
            }}
          >
            {fieldContent}
          </TooltipHost>
        ) : fieldContent}
        {showEndpointLabels && (
          <ScaleFieldEndpointLabels
            options={scaleOptions}
            textColor={theme.semanticColors.bodySubtext}
          />
        )}
      </div>
    </div>
  )
}

// Export for use in forms
ScaleField.Legend = ScaleFieldLegend
ScaleField.Tooltip = ScaleFieldTooltip
ScaleField.EndpointLabels = ScaleFieldEndpointLabels
