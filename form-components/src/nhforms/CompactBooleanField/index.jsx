/**
 * CompactBooleanField - Yes/No button component with custom label support
 *
 * Features:
 * - Styled Yes/No toggle buttons
 * - Custom label support (e.g., "Normal"/"Abnormal", "Yes"/"No")
 * - Size variants (normal, small)
 * - Card container styling option
 * - Dark mode support via theme
 * - Integration with form data via useActiveData
 */

const { useMemo, useCallback } = React
const {
  Stack,
  Label,
  Text,
} = Fluent

// ================================================
// Type definitions (JSDoc for documentation)
// ================================================

/**
 * @typedef {Object} BooleanLabels
 * @property {string} on - Label for "yes" state (default: "Yes")
 * @property {string} off - Label for "no" state (default: "No")
 */

/**
 * @typedef {'normal' | 'small'} ButtonSize
 */

// ================================================
// Styles
// ================================================

const getButtonStyles = (isSelected, isDarkMode, size = 'normal') => {
  const sizeStyles = size === 'small'
    ? { padding: '2px 8px', fontSize: '11px' }
    : { padding: '4px 10px', fontSize: '12px' }

  return {
    ...sizeStyles,
    fontWeight: 600,
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    backgroundColor: isSelected
      ? '#0078d4'                              // Selected: Fluent blue
      : (isDarkMode ? '#333' : '#e0e0e0'),    // Unselected: gray
    color: isSelected
      ? '#fff'                                 // Selected: white text
      : (isDarkMode ? '#ccc' : '#666'),        // Unselected: gray text
  }
}

const getCardContainerStyles = (isDarkMode) => ({
  padding: '8px 12px',
  borderRadius: '6px',
  border: `1px solid ${isDarkMode ? '#404040' : '#e0e0e0'}`,
  backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
})

const getFieldContainerStyles = (isDarkMode, showCard) => {
  if (showCard) {
    return getCardContainerStyles(isDarkMode)
  }
  return {
    padding: '4px 0',
  }
}

// ================================================
// Helper Functions
// ================================================

/**
 * Decode PDF name hex encoding (#XX sequences) that may appear in labels.
 * PDF names encode special characters as #XX where XX is the hex ASCII code.
 * For example, "/" (ASCII 47 = 0x2F) is encoded as "#2F".
 * @param {string} value
 * @returns {string}
 */
const decodePDFHex = (value) => {
  if (!value || typeof value !== 'string') return value
  // Decode all #XX hex sequences (case-insensitive)
  let decoded = value
  let prevDecoded = ""
  while (prevDecoded !== decoded) {
    prevDecoded = decoded
    decoded = decoded.replace(/#([0-9A-Fa-f]{2})/gi, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16))
    })
  }
  return decoded
}

/**
 * Get boolean labels with defaults
 * @param {BooleanLabels} [labels]
 * @returns {{ yesLabel: string, noLabel: string }}
 */
const getBooleanLabels = (labels) => ({
  yesLabel: decodePDFHex(labels?.on || 'Yes'),
  noLabel: decodePDFHex(labels?.off || 'No'),
})

/**
 * Normalize a value to 'yes', 'no', or null
 * @param {any} value
 * @returns {'yes' | 'no' | null}
 */
const normalizeValue = (value) => {
  if (value === true || value === 'yes' || value === 'Y' || value === 1) {
    return 'yes'
  }
  if (value === false || value === 'no' || value === 'N' || value === 0) {
    return 'no'
  }
  return null
}

// ================================================
// Sub-components
// ================================================

/**
 * YesNoButtons - Reusable Yes/No button pair component
 *
 * @param {Object} props
 * @param {string} [props.yesLabel="Yes"] - Label for yes button
 * @param {string} [props.noLabel="No"] - Label for no button
 * @param {'yes' | 'no' | null} [props.value] - Current value
 * @param {(value: 'yes' | 'no' | null) => void} props.onChange - Change handler
 * @param {ButtonSize} [props.size="normal"] - Button size
 * @param {boolean} [props.disabled] - Disable buttons
 * @param {boolean} [props.isDarkMode] - Dark mode flag
 * @param {boolean} [props.allowDeselect=true] - Allow clicking selected option to deselect
 */
const YesNoButtons = ({
  yesLabel = 'Yes',
  noLabel = 'No',
  value,
  onChange,
  size = 'normal',
  disabled = false,
  isDarkMode = false,
  allowDeselect = true,
}) => {
  const normalized = normalizeValue(value)

  const handleYesClick = useCallback(() => {
    if (!disabled) {
      // If already selected and allowDeselect is true, deselect (set to null)
      if (normalized === 'yes' && allowDeselect) {
        onChange(null)
      } else {
        onChange('yes')
      }
    }
  }, [disabled, normalized, allowDeselect, onChange])

  const handleNoClick = useCallback(() => {
    if (!disabled) {
      // If already selected and allowDeselect is true, deselect (set to null)
      if (normalized === 'no' && allowDeselect) {
        onChange(null)
      } else {
        onChange('no')
      }
    }
  }, [disabled, normalized, allowDeselect, onChange])

  const yesButtonStyle = {
    ...getButtonStyles(normalized === 'yes', isDarkMode, size),
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }

  const noButtonStyle = {
    ...getButtonStyles(normalized === 'no', isDarkMode, size),
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }

  return (
    <Stack horizontal tokens={{ childrenGap: 4 }}>
      <button
        type="button"
        style={yesButtonStyle}
        onClick={handleYesClick}
        disabled={disabled}
        aria-pressed={normalized === 'yes'}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        style={noButtonStyle}
        onClick={handleNoClick}
        disabled={disabled}
        aria-pressed={normalized === 'no'}
      >
        {noLabel}
      </button>
    </Stack>
  )
}

/**
 * CompactBooleanField - Full boolean field with label and Yes/No buttons
 *
 * @param {Object} props
 * @param {string} props.fieldId - Field ID for form data storage
 * @param {string} [props.label] - Field label
 * @param {BooleanLabels} [props.booleanLabels] - Custom button labels
 * @param {ButtonSize} [props.buttonSize="normal"] - Button size (normal or small)
 * @param {'full' | '1/2' | '1/3' | '2/3' | '1/4' | '3/4'} [props.size] - Field width for grid layout
 * @param {boolean} [props.showCard=false] - Show card container
 * @param {boolean} [props.disabled] - Disable field
 * @param {boolean} [props.required] - Mark as required
 * @param {'left' | 'top' | 'right'} [props.labelPosition="left"] - Label position
 * @param {string} [props.note] - Annotation/note text
 * @param {boolean} [props.allowDeselect=true] - Allow clicking selected option to deselect
 * @param {string} [props.sourceFieldId] - Original PDF field ID (for PDF sync highlighting when this is a controller)
 */
const CompactBooleanField = ({
  fieldId,
  label,
  booleanLabels,
  buttonSize = 'normal',
  size,
  showCard = false,
  disabled = false,
  required = false,
  labelPosition = 'left',
  note,
  allowDeselect = true,
  sourceFieldId,
  ...props
}) => {
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  const { yesLabel, noLabel } = getBooleanLabels(booleanLabels)

  // Get current value from form data
  const currentValue = fd?.field?.data?.[fieldId]
  const normalized = normalizeValue(currentValue)

  // Handle value change
  const handleChange = useCallback((newValue) => {
    if (!fd?.setFormData) return

    // Store as boolean or null (for deselected state)
    let storedValue
    if (newValue === null) {
      storedValue = null  // Deselected
    } else {
      storedValue = newValue === 'yes'  // true or false
    }

    fd.setFormData({
      ...fd,
      field: {
        ...fd.field,
        data: {
          ...fd.field?.data,
          [fieldId]: storedValue,
        },
      },
    })
  }, [fd, fieldId])

  // Styles
  const baseContainerStyle = getFieldContainerStyles(isDarkMode, showCard)

  // Add width styling for grid layout
  const getWidthStyle = (sizeValue) => {
    if (!sizeValue || sizeValue === 'full') return {}
    const widthMap = {
      '1/2': '50%',
      '1/3': '33.333%',
      '2/3': '66.666%',
      '1/4': '25%',
      '3/4': '75%',
    }
    return { width: widthMap[sizeValue] || '100%', flexShrink: 0 }
  }

  const containerStyle = { ...baseContainerStyle, ...getWidthStyle(size) }

  const themeLabelMinWidth = theme?.mois?.defaultCommonControlStyle?.minLabelWidth ?? 240
  const themeLabelMaxWidth = theme?.mois?.defaultCommonControlStyle?.maxLabelWidth ?? themeLabelMinWidth
  const isLeftLabel = labelPosition === 'left'
  const labelStyle = {
    root: {
      fontWeight: 600,
      marginRight: isLeftLabel ? '10px' : 0,
      marginBottom: labelPosition === 'top' ? '4px' : 0,
      minWidth: isLeftLabel ? themeLabelMinWidth : 'auto',
      maxWidth: isLeftLabel ? themeLabelMaxWidth : undefined,
      padding: isLeftLabel ? '5px 0px' : undefined,
      flex: isLeftLabel ? '0 0 auto' : undefined,
    },
  }

  const noteStyle = {
    fontSize: '11px',
    color: isDarkMode ? '#888' : '#666',
    marginTop: '4px',
  }

  const isHorizontal = labelPosition === 'left' || labelPosition === 'right'

  const fieldContent = (
    <>
      {label && labelPosition !== 'right' && (
        <Label styles={labelStyle}>
          {label}
          {required && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
        </Label>
      )}
      <YesNoButtons
        yesLabel={yesLabel}
        noLabel={noLabel}
        value={normalized}
        onChange={handleChange}
        size={buttonSize}
        disabled={disabled}
        isDarkMode={isDarkMode}
        allowDeselect={allowDeselect}
      />
      {label && labelPosition === 'right' && (
        <Label styles={{ ...labelStyle, root: { ...labelStyle.root, marginLeft: '12px', marginRight: 0 } }}>
          {label}
          {required && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
        </Label>
      )}
    </>
  )

  return (
    <div id={fieldId} style={containerStyle} data-field-id={fieldId} data-source-field-id={sourceFieldId || undefined}>
      {isHorizontal ? (
        <div style={{ display: 'flex', flexFlow: 'row wrap', alignItems: 'flex-start' }}>
          {fieldContent}
        </div>
      ) : (
        <Stack tokens={{ childrenGap: 4 }}>
          {fieldContent}
        </Stack>
      )}
      {note && (
        <div style={noteStyle}>{note}</div>
      )}
    </div>
  )
}

/**
 * CompactBooleanGroup - Group of boolean fields with shared styling
 *
 * @param {Object} props
 * @param {string} [props.title] - Group title
 * @param {boolean} [props.showCard=true] - Show card container for group
 * @param {React.ReactNode} props.children - CompactBooleanField children
 */
const CompactBooleanGroup = ({
  title,
  showCard = true,
  children,
  ...props
}) => {
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  const containerStyle = showCard
    ? {
        ...getCardContainerStyles(isDarkMode),
        padding: '12px 16px',
      }
    : {}

  const titleStyle = {
    fontWeight: 600,
    fontSize: '14px',
    marginBottom: '12px',
    color: isDarkMode ? '#e0e0e0' : '#333',
  }

  return (
    <div style={containerStyle}>
      {title && <div style={titleStyle}>{title}</div>}
      <Stack tokens={{ childrenGap: 8 }}>
        {children}
      </Stack>
    </div>
  )
}

/**
 * CompactBooleanChecklist - Multiple boolean fields rendered as a checklist
 *
 * @param {Object} props
 * @param {string} props.id - Base ID for field storage
 * @param {Array<{ id: string, label: string, booleanLabels?: BooleanLabels }>} props.fields - Field definitions
 * @param {string} [props.title] - Checklist title
 * @param {ButtonSize} [props.size="small"] - Button size for all fields
 * @param {boolean} [props.showCard=true] - Show card container
 * @param {BooleanLabels} [props.defaultLabels] - Default labels for all fields
 * @param {boolean} [props.allowDeselect=true] - Allow clicking selected option to deselect
 */
const CompactBooleanChecklist = ({
  id,
  fields = [],
  title,
  size = 'small',
  showCard = true,
  defaultLabels,
  allowDeselect = true,
  ...props
}) => {
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  // Get all values from form data
  const getValues = () => {
    try {
      const data = fd?.field?.data?.[id]
      if (data && typeof data === 'object') {
        return data
      }
    } catch (e) {
      console.log('Error getting values:', e)
    }
    return {}
  }

  const values = getValues()

  // Handle value change for a field
  const handleChange = useCallback((fieldId, newValue) => {
    if (!fd?.setFormData) return

    const currentData = fd?.field?.data?.[id] || {}

    // Store as boolean or null (for deselected state)
    let storedValue
    if (newValue === null) {
      storedValue = null  // Deselected
    } else {
      storedValue = newValue === 'yes'  // true or false
    }

    fd.setFormData({
      ...fd,
      field: {
        ...fd.field,
        data: {
          ...fd.field?.data,
          [id]: {
            ...currentData,
            [fieldId]: storedValue,
          },
        },
      },
    })
  }, [fd, id])

  const containerStyle = showCard
    ? {
        ...getCardContainerStyles(isDarkMode),
        padding: '12px 16px',
      }
    : {}

  const titleStyle = {
    fontWeight: 600,
    fontSize: '14px',
    marginBottom: '12px',
    color: isDarkMode ? '#e0e0e0' : '#333',
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
    borderBottom: `1px solid ${isDarkMode ? '#333' : '#f0f0f0'}`,
  }

  const lastRowStyle = {
    ...rowStyle,
    borderBottom: 'none',
  }

  const labelStyle = {
    fontSize: '13px',
    color: isDarkMode ? '#ccc' : '#333',
    flex: 1,
  }

  const { yesLabel: defaultYes, noLabel: defaultNo } = getBooleanLabels(defaultLabels)

  return (
    <div style={containerStyle}>
      {title && <div style={titleStyle}>{title}</div>}
      {fields.map((field, idx) => {
        const { yesLabel, noLabel } = field.booleanLabels
          ? getBooleanLabels(field.booleanLabels)
          : { yesLabel: defaultYes, noLabel: defaultNo }

        const isLast = idx === fields.length - 1

        return (
          <div key={field.id} style={isLast ? lastRowStyle : rowStyle}>
            <span style={labelStyle}>{field.label}</span>
            <YesNoButtons
              yesLabel={yesLabel}
              noLabel={noLabel}
              value={normalizeValue(values[field.id])}
              onChange={(val) => handleChange(field.id, val)}
              size={size}
              isDarkMode={isDarkMode}
              allowDeselect={allowDeselect}
            />
          </div>
        )
      })}
    </div>
  )
}

/**
 * Schema definition for CompactBooleanField data
 */
const CompactBooleanFieldSchema = {
  type: 'boolean',
}

/**
 * Schema definition for CompactBooleanChecklist data
 */
const CompactBooleanChecklistSchema = {
  type: 'object',
  additionalProperties: {
    type: 'boolean',
  },
}

/**
 * Pre-built boolean label sets
 */
const BooleanLabelPresets = {
  /** Standard Yes/No */
  yesNo: { on: 'Yes', off: 'No' },
  /** Normal/Abnormal for medical assessments */
  normalAbnormal: { on: 'Normal', off: 'Abnormal' },
  /** Abnormal/Normal (reversed) */
  abnormalNormal: { on: 'Abnormal', off: 'Normal' },
  /** Present/Absent */
  presentAbsent: { on: 'Present', off: 'Absent' },
  /** Positive/Negative */
  positiveNegative: { on: 'Positive', off: 'Negative' },
  /** True/False */
  trueFalse: { on: 'True', off: 'False' },
  /** Completed/Incomplete */
  completedIncomplete: { on: 'Completed', off: 'Incomplete' },
  /** Active/Inactive */
  activeInactive: { on: 'Active', off: 'Inactive' },
  /** Enabled/Disabled */
  enabledDisabled: { on: 'Enabled', off: 'Disabled' },
  /** Pass/Fail */
  passFail: { on: 'Pass', off: 'Fail' },
}

// ================================================
// CompactChoiceField - Multi-option button selection
// ================================================

/**
 * OptionButtons - Reusable multi-option button component
 *
 * @param {Object} props
 * @param {Array<{ key: string, text: string }>} props.options - Options to display
 * @param {string | string[] | null} props.value - Current selected value(s)
 * @param {(value: string | string[] | null) => void} props.onChange - Change handler
 * @param {'single' | 'multiple'} [props.selectionType='single'] - Selection mode
 * @param {ButtonSize} [props.size='normal'] - Button size
 * @param {boolean} [props.disabled] - Disable buttons
 * @param {boolean} [props.isDarkMode] - Dark mode flag
 * @param {boolean} [props.allowDeselect=true] - Allow deselection in single mode
 * @param {boolean} [props.wrap=true] - Allow buttons to wrap to next line
 */
const OptionButtons = ({
  options = [],
  value,
  onChange,
  selectionType = 'single',
  size = 'normal',
  disabled = false,
  isDarkMode = false,
  allowDeselect = true,
  wrap = true,
}) => {
  const isMultiple = selectionType === 'multiple'

  // Normalize value to array for consistent handling
  const selectedValues = useMemo(() => {
    if (value === null || value === undefined) return []
    if (Array.isArray(value)) return value
    return [value]
  }, [value])

  const isSelected = useCallback((optionKey) => {
    return selectedValues.includes(optionKey)
  }, [selectedValues])

  const handleClick = useCallback((optionKey) => {
    if (disabled) return

    if (isMultiple) {
      // Multi-select: toggle the option
      const newValues = isSelected(optionKey)
        ? selectedValues.filter(v => v !== optionKey)
        : [...selectedValues, optionKey]
      onChange(newValues.length > 0 ? newValues : null)
    } else {
      // Single-select: select or deselect
      if (isSelected(optionKey) && allowDeselect) {
        onChange(null)
      } else {
        onChange(optionKey)
      }
    }
  }, [disabled, isMultiple, isSelected, selectedValues, allowDeselect, onChange])

  const containerStyle = {
    display: 'flex',
    flexWrap: wrap ? 'wrap' : 'nowrap',
    gap: '4px',
  }

  return (
    <div style={containerStyle}>
      {options.map((option) => {
        const selected = isSelected(option.key)
        const buttonStyle = {
          ...getButtonStyles(selected, isDarkMode, size),
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }

        return (
          <button
            key={option.key}
            type="button"
            style={buttonStyle}
            onClick={() => handleClick(option.key)}
            disabled={disabled}
            aria-pressed={selected}
          >
            {option.text}
          </button>
        )
      })}
    </div>
  )
}

/**
 * CompactChoiceField - Multi-option field with button selection
 *
 * @param {Object} props
 * @param {string} props.fieldId - Field ID for form data storage
 * @param {string} [props.label] - Field label
 * @param {Array<{ key: string, text: string }>} [props.optionList] - Options to display
 * @param {'single' | 'multiple'} [props.selectionType='single'] - Selection mode
 * @param {ButtonSize} [props.size='normal'] - Button size
 * @param {boolean} [props.showCard=false] - Show card container
 * @param {boolean} [props.disabled] - Disable field
 * @param {boolean} [props.required] - Mark as required
 * @param {'left' | 'top' | 'right'} [props.labelPosition='top'] - Label position
 * @param {string} [props.note] - Annotation/note text
 * @param {boolean} [props.allowDeselect=true] - Allow deselection in single mode
 * @param {boolean} [props.wrap=true] - Allow buttons to wrap
 */
const CompactChoiceField = ({
  fieldId,
  label,
  optionList = [],
  selectionType = 'single',
  size = 'normal',
  showCard = false,
  disabled = false,
  required = false,
  labelPosition = 'top',
  note,
  allowDeselect = true,
  wrap = true,
  ...props
}) => {
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false

  // Get current value from form data
  const currentValue = fd?.field?.data?.[fieldId]

  // Handle value change
  const handleChange = useCallback((newValue) => {
    if (!fd?.setFormData) return

    fd.setFormData({
      ...fd,
      field: {
        ...fd.field,
        data: {
          ...fd.field?.data,
          [fieldId]: newValue,
        },
      },
    })
  }, [fd, fieldId])

  // Styles
  const containerStyle = getFieldContainerStyles(isDarkMode, showCard)

  const themeLabelMinWidth = theme?.mois?.defaultCommonControlStyle?.minLabelWidth ?? 240
  const themeLabelMaxWidth = theme?.mois?.defaultCommonControlStyle?.maxLabelWidth ?? themeLabelMinWidth
  const isLeftLabel = labelPosition === 'left'
  const labelStyle = {
    root: {
      fontWeight: 600,
      marginRight: isLeftLabel ? '10px' : 0,
      marginBottom: labelPosition === 'top' ? '4px' : 0,
      minWidth: isLeftLabel ? themeLabelMinWidth : 'auto',
      maxWidth: isLeftLabel ? themeLabelMaxWidth : undefined,
      padding: isLeftLabel ? '5px 0px' : undefined,
      flex: isLeftLabel ? '0 0 auto' : undefined,
    },
  }

  const noteStyle = {
    fontSize: '11px',
    color: isDarkMode ? '#888' : '#666',
    marginTop: '4px',
  }

  const isHorizontal = labelPosition === 'left' || labelPosition === 'right'

  const choiceContent = (
    <>
      {label && labelPosition !== 'right' && (
        <Label styles={labelStyle}>
          {label}
          {required && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
        </Label>
      )}
      <OptionButtons
        options={optionList}
        value={currentValue}
        onChange={handleChange}
        selectionType={selectionType}
        size={size}
        disabled={disabled}
        isDarkMode={isDarkMode}
        allowDeselect={allowDeselect}
        wrap={wrap}
      />
      {label && labelPosition === 'right' && (
        <Label styles={{ ...labelStyle, root: { ...labelStyle.root, marginLeft: '12px', marginRight: 0 } }}>
          {label}
          {required && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
        </Label>
      )}
    </>
  )

  return (
    <div id={fieldId} style={containerStyle} data-field-id={fieldId}>
      {isHorizontal ? (
        <div style={{ display: 'flex', flexFlow: 'row wrap', alignItems: 'flex-start' }}>
          {choiceContent}
        </div>
      ) : (
        <Stack tokens={{ childrenGap: 4 }}>
          {choiceContent}
        </Stack>
      )}
      {note && (
        <div style={noteStyle}>{note}</div>
      )}
    </div>
  )
}

/**
 * Schema definition for CompactChoiceField data (single select)
 */
const CompactChoiceFieldSchema = {
  type: ['string', 'null'],
}

/**
 * Schema definition for CompactChoiceField data (multi select)
 */
const CompactChoiceFieldMultiSchema = {
  type: ['array', 'null'],
  items: { type: 'string' },
}
