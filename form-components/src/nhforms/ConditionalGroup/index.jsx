/**
 * ConditionalGroup - Logic Gate System for Conditional Field Visibility
 *
 * Features:
 * - Controller field-based visibility using CompactBooleanField
 * - Nested conditional groups up to 5 levels deep
 * - Field-level visibility modes (inherit, always, controller)
 * - Parent chain visibility checking (all parent gates must be satisfied)
 * - Customizable container and content styling via props
 * - Dark mode support
 *
 * Usage:
 * <ConditionalGroup
 *   id="headNeck"
 *   controllerLabel="Head/Neck Abnormal?"
 *   showWhen="yes"
 *   booleanLabels={{ on: "Abnormal", off: "Normal" }}
 * >
 *   <ConditionalField fieldId="details">
 *     <TextField label="Details" />
 *   </ConditionalField>
 *   <ConditionalGroup id="eyes" controllerLabel="Eye Issues?" showWhen="yes">
 *     <TextField label="Eye Details" />
 *   </ConditionalGroup>
 * </ConditionalGroup>
 */

const { useMemo, useCallback, useContext, createContext } = React
const {
  Stack,
  Label,
  Text,
} = Fluent

// ================================================
// Constants
// ================================================

/** Maximum nesting depth for conditional groups */
const MAX_SUBGROUP_DEPTH = 5

// ================================================
// Type definitions (JSDoc for documentation)
// ================================================

/**
 * @typedef {'yes' | 'no'} ShowWhenValue
 */

/**
 * @typedef {'inherit' | 'always' | 'controller'} FieldVisibilityMode
 */

/**
 * @typedef {Object} FieldVisibilityRule
 * @property {FieldVisibilityMode} mode - Visibility mode
 * @property {string} [controllerFieldId] - Controller field ID (if mode is 'controller')
 * @property {ShowWhenValue} [showWhen] - Show when value (if mode is 'controller')
 */

/**
 * @typedef {Object} BranchingRule
 * @property {string} controllerFieldId - The Yes/No field that controls visibility
 * @property {ShowWhenValue} showWhen - Show children when controller is 'yes' or 'no'
 * @property {Record<string, FieldVisibilityRule>} [fieldRules] - Per-field visibility overrides
 * @property {string} [inheritedFromParent] - Parent subgroup ID if cascaded
 */

/**
 * @typedef {Object} BooleanLabels
 * @property {string} on - Label for "yes" state
 * @property {string} off - Label for "no" state
 */

/**
 * @typedef {Object} LogicGateContextValue
 * @property {number} depth - Current nesting depth
 * @property {string[]} parentChain - Array of parent group IDs
 * @property {(groupId: string) => boolean} isGroupVisible - Check if a group is visible
 * @property {(groupId: string) => any} getControllerValue - Get controller value for a group
 * @property {Record<string, BranchingRule>} rules - All branching rules by group ID
 */

// ================================================
// Context
// ================================================

const LogicGateContext = createContext({
  depth: 0,
  parentChain: [],
  isGroupVisible: () => true,
  getControllerValue: () => null,
  rules: {},
})

// ================================================
// Helper Functions
// ================================================

/**
 * Normalize a value to 'yes', 'no', or null
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

/**
 * Check if controller value matches the showWhen condition
 */
const checkControllerMatch = (controllerValue, showWhen) => {
  const normalized = normalizeValue(controllerValue)
  if (normalized === null) return false // No value = not visible
  return normalized === showWhen
}

/**
 * Merge style objects, handling undefined values
 */
const mergeStyles = (...styles) => {
  return styles.reduce((acc, style) => {
    if (!style) return acc
    return { ...acc, ...style }
  }, {})
}

// ================================================
// Main Components
// ================================================

/**
 * LogicGateProvider - Root provider for the logic gate system
 *
 * Wrap your form with this to enable conditional visibility across all nested groups.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
const LogicGateProvider = ({ children }) => {
  const [fd] = useActiveData()

  // Get controller value for a group from form data
  const getControllerValue = useCallback((groupId) => {
    return fd?.field?.data?.[`${groupId}_controller`]
  }, [fd])

  // Rules are stored in form data under _logicGateRules
  const rules = fd?.field?.data?._logicGateRules || {}

  // Check if a group is visible based on its parent chain
  const isGroupVisible = useCallback((groupId) => {
    const rule = rules[groupId]
    if (!rule) return true // No rule = always visible

    const controllerValue = getControllerValue(groupId)
    return checkControllerMatch(controllerValue, rule.showWhen)
  }, [rules, getControllerValue])

  const contextValue = useMemo(() => ({
    depth: 0,
    parentChain: [],
    isGroupVisible,
    getControllerValue,
    rules,
  }), [isGroupVisible, getControllerValue, rules])

  return (
    <LogicGateContext.Provider value={contextValue}>
      {children}
    </LogicGateContext.Provider>
  )
}

/**
 * ConditionalGroup - A group with conditional visibility based on a controller field
 *
 * Uses CompactBooleanField for the controller, ensuring consistent styling.
 *
 * @param {Object} props
 * @param {string} props.id - Unique group ID
 * @param {string} props.controllerLabel - Label for the controller Yes/No field
 * @param {ShowWhenValue} [props.showWhen="yes"] - Show children when controller is 'yes' or 'no'
 * @param {BooleanLabels} [props.booleanLabels] - Custom labels for Yes/No buttons
 * @param {'normal' | 'small'} [props.controllerSize="normal"] - Size of controller buttons
 * @param {boolean} [props.showCard=true] - Show card container
 * @param {boolean} [props.showController=true] - Show the controller header
 * @param {boolean} [props.required] - Mark controller as required
 * @param {string} [props.note] - Note text for controller
 * @param {string} [props.title] - Optional title for the group content
 * @param {Object} [props.containerProps] - Props to pass to the outer container
 * @param {Object} [props.containerStyle] - Style overrides for outer container
 * @param {Object} [props.contentProps] - Props to pass to the content container
 * @param {Object} [props.contentStyle] - Style overrides for content container
 * @param {Object} [props.controllerProps] - Props to pass to CompactBooleanField
 * @param {number} [props.childrenGap=8] - Gap between children (Stack tokens)
 * @param {string} [props.contentPadding] - Padding for content area
 * @param {boolean} [props.indentChildren=false] - Add left border indent for hierarchy
 * @param {boolean} [props.showHiddenIndicator=true] - Show indicator when content is hidden
 * @param {string} [props.sourceFieldId] - Original PDF field ID for PDF sync highlighting
 * @param {React.ReactNode} props.children - Child content (shown when condition is met)
 */
const ConditionalGroup = ({
  id,
  controllerLabel,
  showWhen = 'yes',
  booleanLabels,
  controllerSize = 'normal',
  showCard = true,
  showController = true,
  required = false,
  note,
  title,
  containerProps = {},
  containerStyle: containerStyleOverride,
  contentProps = {},
  contentStyle: contentStyleOverride,
  controllerProps = {},
  childrenGap = 8,
  contentPadding,
  indentChildren = false,
  showHiddenIndicator = true,
  sourceFieldId,
  children,
  ...props
}) => {
  const [fd] = useActiveData()
  const theme = useTheme()
  const isDarkMode = theme?.isInverted || false
  const parentContext = useContext(LogicGateContext)

  // Check nesting depth
  const currentDepth = parentContext.depth + 1
  if (currentDepth > MAX_SUBGROUP_DEPTH) {
    console.warn(`ConditionalGroup: Maximum nesting depth (${MAX_SUBGROUP_DEPTH}) exceeded for group "${id}"`)
    return null
  }

  // Check if all parent groups are visible
  const parentChain = [...parentContext.parentChain, id]
  const allParentsVisible = parentContext.parentChain.every(parentId => {
    return parentContext.isGroupVisible(parentId)
  })

  // If any parent is not visible, don't render this group at all
  if (!allParentsVisible) {
    return null
  }

  // Controller field ID
  const controllerFieldId = `${id}_controller`

  // Get current controller value
  const controllerValue = fd?.field?.data?.[controllerFieldId]
  const isVisible = checkControllerMatch(controllerValue, showWhen)

  // Handle controller change
  const handleControllerChange = useCallback((newValue) => {
    if (!fd?.setFormData) return

    fd.setFormData({
      ...fd,
      field: {
        ...fd.field,
        data: {
          ...fd.field?.data,
          [controllerFieldId]: newValue,
        },
      },
    })
  }, [fd, controllerFieldId])

  // Create child context
  const childContext = useMemo(() => ({
    depth: currentDepth,
    parentChain,
    isGroupVisible: (groupId) => {
      // Check this group first
      if (groupId === id) {
        return isVisible
      }
      // Then check parent context
      return parentContext.isGroupVisible(groupId)
    },
    getControllerValue: (groupId) => {
      if (groupId === id) {
        return controllerValue
      }
      return parentContext.getControllerValue(groupId)
    },
    rules: parentContext.rules,
  }), [currentDepth, parentChain, id, isVisible, controllerValue, parentContext])

  // Styles
  const baseContainerStyle = showCard ? {
    border: `1px solid ${isDarkMode ? '#404040' : '#e0e0e0'}`,
    borderRadius: '6px',
    backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
    marginBottom: '12px',
    overflow: 'hidden',
  } : {
    marginBottom: '12px',
  }

  const containerStyle = mergeStyles(baseContainerStyle, containerStyleOverride)

  // Controller wrapper style
  const controllerWrapperStyle = {
    padding: '8px 12px',
    backgroundColor: isDarkMode ? '#252525' : '#f5f5f5',
    borderBottom: isVisible ? `1px solid ${isDarkMode ? '#404040' : '#e0e0e0'}` : 'none',
  }

  // Content area style
  const defaultPadding = showCard ? '12px 16px' : (indentChildren ? '8px 0 8px 16px' : '8px 0')
  const baseContentStyle = {
    padding: contentPadding || defaultPadding,
    borderLeft: indentChildren && !showCard ? `3px solid ${isDarkMode ? '#0078d4' : '#0078d4'}` : 'none',
    marginLeft: indentChildren && !showCard ? '8px' : 0,
    backgroundColor: showCard && isDarkMode ? '#1a1a1a' : 'transparent',
  }

  const contentStyle = mergeStyles(baseContentStyle, contentStyleOverride)

  const titleStyle = {
    fontWeight: 600,
    fontSize: '14px',
    color: isDarkMode ? '#e0e0e0' : '#333',
    marginBottom: '12px',
  }

  const hiddenIndicatorStyle = {
    padding: '8px 12px',
    fontSize: '12px',
    color: isDarkMode ? '#666' : '#999',
    fontStyle: 'italic',
    backgroundColor: isDarkMode ? '#1a1a1a' : '#fafafa',
  }

  // Depth indicator style (visual hierarchy)
  const depthIndicatorStyle = currentDepth > 1 ? {
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    borderLeftColor: isDarkMode
      ? `hsl(${210 + (currentDepth * 15)}, 60%, 40%)`
      : `hsl(${210 + (currentDepth * 15)}, 70%, 50%)`,
  } : {}

  return (
    <LogicGateContext.Provider value={childContext}>
      <div
        style={mergeStyles(containerStyle, showCard ? depthIndicatorStyle : {})}
        data-conditional-group={id}
        data-depth={currentDepth}
        {...containerProps}
      >
        {showController && (
          <div style={controllerWrapperStyle}>
            <CompactBooleanField
              fieldId={controllerFieldId}
              label={controllerLabel}
              booleanLabels={booleanLabels}
              size={controllerSize}
              showCard={false}
              required={required}
              note={note}
              labelPosition="left"
              sourceFieldId={sourceFieldId}
              {...controllerProps}
            />
          </div>
        )}

        {isVisible ? (
          <div style={contentStyle} {...contentProps}>
            {title && <div style={titleStyle}>{title}</div>}
            <Stack tokens={{ childrenGap }}>
              {children}
            </Stack>
          </div>
        ) : (
          showHiddenIndicator && controllerValue !== undefined && controllerValue !== null && (
            <div style={hiddenIndicatorStyle}>
              Content hidden (select "{showWhen === 'yes'
                ? (booleanLabels?.on || 'Yes')
                : (booleanLabels?.off || 'No')}" to show)
            </div>
          )
        )}
      </div>
    </LogicGateContext.Provider>
  )
}

/**
 * Check if a choice field value matches any of the specified option values
 * Handles both single values (string) and multi-select values (array)
 */
const checkChoiceMatch = (fieldValue, optionValues, invert = false) => {
  if (fieldValue === null || fieldValue === undefined) {
    return invert // If no value and inverted (not-selected), return true
  }

  // Handle array values (multi-select fields)
  if (Array.isArray(fieldValue)) {
    const hasMatch = optionValues.some(opt => fieldValue.includes(opt))
    return invert ? !hasMatch : hasMatch
  }

  // Handle single value
  const hasMatch = optionValues.includes(fieldValue)
  return invert ? !hasMatch : hasMatch
}

/**
 * ConditionalField - A field wrapper with visibility rules
 *
 * @param {Object} props
 * @param {string} props.fieldId - Field ID
 * @param {FieldVisibilityMode} [props.mode="inherit"] - Visibility mode
 * @param {string} [props.controllerFieldId] - Controller field ID (if mode is 'controller')
 * @param {ShowWhenValue} [props.showWhen] - Show when value (if mode is 'controller' for boolean)
 * @param {string[]} [props.optionValues] - Option values to match (for choice fields)
 * @param {boolean} [props.invertMatch=false] - Invert the match (show when NOT matching)
 * @param {boolean} [props.showWhenNull=false] - Show content when controller value is null/undefined (for hide rules)
 * @param {Object} [props.containerStyle] - Style overrides for wrapper
 * @param {Object} [props.containerProps] - Props to pass to wrapper
 * @param {React.ReactNode} props.children - Field content
 */
const ConditionalField = ({
  fieldId,
  mode = 'inherit',
  controllerFieldId,
  showWhen = 'yes',
  optionValues,
  invertMatch = false,
  showWhenNull = false,
  containerStyle,
  containerProps = {},
  children,
  ...props
}) => {
  const [fd] = useActiveData()
  const parentContext = useContext(LogicGateContext)

  // Determine visibility based on mode
  let isVisible = true

  if (mode === 'always') {
    // Always visible regardless of parent gates
    isVisible = true
  } else if (mode === 'controller' && controllerFieldId) {
    const controllerValue = fd?.field?.data?.[controllerFieldId]

    // DEBUG: Log ConditionalField controller evaluation
    console.log('[ConditionalField] mode=controller', { controllerFieldId, showWhen, controllerValue, optionValues, invertMatch, showWhenNull, fieldId, formDataKeys: Object.keys(fd?.field?.data || {}) })

    // If optionValues is provided, use choice matching instead of boolean matching
    if (optionValues && optionValues.length > 0) {
      isVisible = checkChoiceMatch(controllerValue, optionValues, invertMatch)
    } else {
      // Boolean matching (yes/no)
      // When controller is null/unset, field is hidden (both show and hide rules)
      isVisible = showWhenNull
        ? (normalizeValue(controllerValue) === null ? true : checkControllerMatch(controllerValue, showWhen))
        : checkControllerMatch(controllerValue, showWhen)
    }

    // DEBUG: Log visibility result
    console.log('[ConditionalField] isVisible:', isVisible)
  } else {
    // Inherit - check if all parent groups are visible
    isVisible = parentContext.parentChain.every(parentId => {
      return parentContext.isGroupVisible(parentId)
    })
  }

  if (!isVisible) {
    return null
  }

  if (containerStyle || Object.keys(containerProps).length > 0) {
    return (
      <div style={containerStyle} {...containerProps}>
        {children}
      </div>
    )
  }

  return <>{children}</>
}

/**
 * useLogicGate - Hook to access logic gate context
 *
 * @returns {LogicGateContextValue}
 */
const useLogicGate = () => {
  return useContext(LogicGateContext)
}

/**
 * useIsVisible - Hook to check if current context is visible
 *
 * @returns {boolean}
 */
const useIsVisible = () => {
  const context = useContext(LogicGateContext)
  return context.parentChain.every(parentId => context.isGroupVisible(parentId))
}

/**
 * useConditionalVisibility - Hook to check visibility for a specific condition
 *
 * @param {string} controllerFieldId - Controller field ID to check
 * @param {ShowWhenValue} showWhen - Show when value
 * @returns {boolean}
 */
const useConditionalVisibility = (controllerFieldId, showWhen = 'yes') => {
  const [fd] = useActiveData()
  const controllerValue = fd?.field?.data?.[controllerFieldId]
  return checkControllerMatch(controllerValue, showWhen)
}

// ================================================
// Schema & Utilities
// ================================================

/**
 * Schema for ConditionalGroup controller data
 */
const ConditionalGroupSchema = {
  type: 'object',
  properties: {
    _logicGateRules: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          controllerFieldId: { type: 'string' },
          showWhen: { enum: ['yes', 'no'] },
          inheritedFromParent: { type: 'string' },
        },
      },
    },
  },
  additionalProperties: {
    type: 'boolean', // Controller values are stored as booleans
  },
}

/**
 * Helper to create a branching rule
 */
const createBranchingRule = (def) => ({
  controllerFieldId: def.controllerFieldId || `${def.groupId}_controller`,
  showWhen: def.showWhen || 'yes',
  fieldRules: def.fieldRules || {},
  inheritedFromParent: def.inheritedFromParent,
})

/**
 * Helper to generate JSX code for a conditional group structure
 *
 * @param {Object} config - Group configuration
 * @returns {string} - JSX code string
 */
const generateConditionalGroupJSX = (config) => {
  const indent = (level) => '  '.repeat(level)

  const generateGroup = (group, level = 0) => {
    const props = [
      `id="${group.id}"`,
      `controllerLabel="${group.controllerLabel}"`,
    ]

    if (group.showWhen && group.showWhen !== 'yes') {
      props.push(`showWhen="${group.showWhen}"`)
    }
    if (group.booleanLabels) {
      props.push(`booleanLabels={{ on: "${group.booleanLabels.on}", off: "${group.booleanLabels.off}" }}`)
    }
    if (group.showCard === false) {
      props.push(`showCard={false}`)
    }
    if (group.indentChildren) {
      props.push(`indentChildren`)
    }
    if (group.childrenGap && group.childrenGap !== 8) {
      props.push(`childrenGap={${group.childrenGap}}`)
    }
    if (group.title) {
      props.push(`title="${group.title}"`)
    }

    let jsx = `${indent(level)}<ConditionalGroup\n`
    jsx += props.map(p => `${indent(level + 1)}${p}`).join('\n')
    jsx += `\n${indent(level)}>\n`

    // Add fields
    if (group.fields) {
      for (const field of group.fields) {
        if (field.mode && field.mode !== 'inherit') {
          jsx += `${indent(level + 1)}<ConditionalField fieldId="${field.id}" mode="${field.mode}">\n`
          jsx += `${indent(level + 2)}<${field.component || 'TextField'} fieldId="${field.id}" label="${field.label || field.id}" />\n`
          jsx += `${indent(level + 1)}</ConditionalField>\n`
        } else {
          jsx += `${indent(level + 1)}<${field.component || 'TextField'} fieldId="${field.id}" label="${field.label || field.id}" />\n`
        }
      }
    }

    // Add nested groups
    if (group.children) {
      for (const child of group.children) {
        jsx += generateGroup(child, level + 1)
      }
    }

    jsx += `${indent(level)}</ConditionalGroup>\n`
    return jsx
  }

  let result = `<LogicGateProvider>\n`
  result += generateGroup(config, 1)
  result += `</LogicGateProvider>`

  return result
}

/**
 * Pre-built controller label presets for common use cases
 * These match the BooleanLabelPresets from CompactBooleanField
 */
const ControllerLabelPresets = {
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
  /** Applicable/Not Applicable */
  applicable: { on: 'Yes', off: 'N/A' },
  /** Completed/Pending */
  completed: { on: 'Done', off: 'Pending' },
  /** Checked/Unchecked */
  checked: { on: 'Checked', off: 'Not Checked' },
}
