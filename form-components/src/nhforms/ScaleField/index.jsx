const { useEffect } = React
const {
  Stack,
  Label,
  Text,
  StackItem,
  TooltipHost,
  Separator,
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

// Legend component for showing option labels above the scale
const ScaleFieldLegend = ({ options }) => {
  const inlineMinWidth = _getInlineMinWidth(options.length)
  const legendRowStyle = {
    root: {
      justifyContent: "space-between",
      width: "100%",
    },
  }

  const legendStyle = {
    padding: "2px 6px 0px 6px",
    minWidth: 46,
    textAlign: "center",
    fontSize: "10px",
    lineHeight: "14px",
  }

  return (
    <div style={{ margin: "0px 0px 8px 0px", overflowX: "auto" }}>
      <Stack horizontal style={{ minWidth: inlineMinWidth }}>
        <StackItem disableShrink styles={LABEL_COLUMN_STYLE}>
          <Label styles={LABEL_STYLE}>&nbsp;</Label>
        </StackItem>
        <StackItem grow>
          <Stack horizontal styles={legendRowStyle} tokens={{ padding: 5 }}>
            {options.map((opt, i) => (
              <Text key={i} style={legendStyle}>
                <b>{opt.description || opt.label}</b>
              </Text>
            ))}
          </Stack>
        </StackItem>
      </Stack>
    </div>
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

// Main ScaleField component
const ScaleField = ({
  fieldId,
  label,
  options,
  showLegend = false,
  showInlineLabels = true,
  required = false,
  readOnly = false,
}) => {
  const [fieldData, setFieldData] = useActiveData(fd => fd.field.data)
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
  const choiceOptions = scaleOptions.map(opt => ({
    key: String(opt.value),
    text: showInlineLabels ? String(opt.value) : "",
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

    const selectedOption = scaleOptions.find(o => String(o.value) === option.key)

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

  // Check if any option has a description for tooltip
  const hasDescriptions = scaleOptions.some(opt => opt.description)
  const inlineMinWidth = _getInlineMinWidth(scaleOptions.length)

  return (
    <div>
      {showLegend && <ScaleFieldLegend options={scaleOptions} />}

      <div style={containerStyle}>
        <TooltipHost
          id={`tooltip_${fieldId}`}
          tooltipProps={
            hasDescriptions
              ? {
                  onRenderContent: () => <ScaleFieldTooltip options={scaleOptions} />,
                }
              : undefined
          }
        >
          <div style={{ overflowX: "auto" }}>
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
                <OptionChoice
                  inline
                  displayStyle="radio"
                  id={`scale-${fieldId}`}
                  options={choiceOptions}
                  selectedKey={currentData.selectedKey}
                  onChange={handleChange}
                  disabled={readOnly}
                  controlStyles={choiceGroupStyles}
                />
              </StackItem>
            </Stack>
          </div>
        </TooltipHost>
      </div>
    </div>
  )
}

// Export for use in forms
ScaleField.Legend = ScaleFieldLegend
ScaleField.Tooltip = ScaleFieldTooltip
