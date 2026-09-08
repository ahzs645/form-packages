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

const { useMemo, useCallback, useContext, createContext, useEffect, useRef } = React
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
  if (value && typeof value === 'object') {
    return normalizeValue(value.code ?? value.display ?? value.value ?? value.text ?? value.label)
  }
  if (value === true || value === 'yes' || value === 'Y' || value === 1) {
    return 'yes'
  }
  if (value === false || value === 'no' || value === 'N' || value === 0) {
    return 'no'
  }
  return null
}

const readControllerValue = (data, fieldId) => {
  if (!data || !fieldId) return undefined
  if (Object.prototype.hasOwnProperty.call(data, fieldId)) return data[fieldId]
  if (typeof data !== 'object') return undefined

  for (const value of Object.values(data)) {
    if (value && typeof value === 'object') {
      const nestedValue = readControllerValue(value, fieldId)
      if (nestedValue !== undefined) return nestedValue
    }
  }

  return undefined
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
    const rule = fd?.field?.data?._logicGateRules?.[groupId]
    return fd?.field?.data?.[rule?.controllerFieldId || `${groupId}_controller`]
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
 * @param {string} [props.controllerFieldId] - Existing field ID to use as the controller instead of `${id}_controller`
 * @param {string} [props.sourceFieldId] - Original PDF field ID for PDF sync highlighting
 * @param {'buttons' | 'checkbox'} [props.displayStyle] - Display style for the controller field
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
  showHiddenIndicator = false,
  controllerFieldId: controllerFieldIdProp,
  sourceFieldId,
  displayStyle,
  children,
  ...props
}) => {
  const contentRef = useRef(null)
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
  const controllerFieldId = controllerFieldIdProp || `${id}_controller`

  // Get current controller value
  const controllerValue = fd?.field?.data?.[controllerFieldId]
  // For checkbox-style controllers, the initial null/undefined state is semantically
  // "unchecked" (i.e. false/"no"). Treat it as such so showWhen="no" gates open by default.
  // Button-style controllers keep null as "no selection made" (gate stays closed).
  const effectiveValue = displayStyle === 'checkbox' && (controllerValue === null || controllerValue === undefined)
    ? false
    : controllerValue
  const isVisible = checkControllerMatch(effectiveValue, showWhen)

  // Handle controller change
  const handleControllerChange = useCallback((newValue) => {
    if (!fd?.setFormData) return

    // Produce recipe writing only this field — never spread the fd snapshot
    // into setFormData (whole-state object payloads clobber concurrent writes).
    fd.setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[controllerFieldId] = newValue
    }))
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
    boxSizing: 'border-box',
    maxWidth: '100%',
    minWidth: 0,
  }

  const contentStyle = mergeStyles(baseContentStyle, contentStyleOverride)

  useEffect(() => {
    if (!isVisible || typeof window === 'undefined') return
    const contentNode = contentRef.current
    if (!contentNode || typeof contentNode.querySelectorAll !== 'function') return

    const reportOverflow = () => {
      const groupRect = contentNode.getBoundingClientRect()
      const clippedField = Array.from(contentNode.querySelectorAll('[data-field-id]')).find((fieldNode) => {
        const rect = fieldNode.getBoundingClientRect()
        return rect.right > groupRect.right + 1 || rect.left < groupRect.left - 1 || fieldNode.scrollWidth > fieldNode.clientWidth + 1
      })

      if (!clippedField) return

      window.dispatchEvent(new CustomEvent('mois:preview-diagnostic', {
        detail: {
          severity: 'warning',
          source: 'ConditionalGroup',
          message: `Conditional group "${id}" contains field "${clippedField.getAttribute('data-field-id') || 'unknown'}" that overflows its visible container and may render clipped.`,
          path: `ConditionalGroup.${id}`,
        },
      }))
    }

    const frame = window.requestAnimationFrame(reportOverflow)
    return () => window.cancelAnimationFrame(frame)
  }, [id, isVisible, children])

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

  // When the controller is rendered elsewhere in the form, a closed group has
  // no UI of its own. Avoid leaving an empty card/bottom margin in the layout.
  if (!showController && !isVisible && !showHiddenIndicator) {
    return null
  }

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
              displayStyle={displayStyle}
              {...controllerProps}
            />
          </div>
        )}

        {isVisible ? (
          <div style={contentStyle} {...contentProps} ref={contentRef}>
            {title && <div style={titleStyle}>{title}</div>}
            <Stack tokens={{ childrenGap }}>
              {children}
            </Stack>
          </div>
        ) : (
          showHiddenIndicator && effectiveValue !== undefined && effectiveValue !== null && (
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

  const normalizeComparableValues = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => normalizeComparableValues(entry))
    }
    if (value && typeof value === 'object') {
      return [value.code, value.display, value.value, value.text]
        .filter((entry) => entry !== null && entry !== undefined)
        .map((entry) => String(entry))
    }
    return [String(value)]
  }

  const normalizedOptionValues = optionValues.map((entry) => String(entry))
  const fieldValues = normalizeComparableValues(fieldValue)

  // Handle array values (multi-select fields)
  const hasMatch = normalizedOptionValues.some(opt => fieldValues.includes(opt))
  return invert ? !hasMatch : hasMatch
}

const normalizeComparableValue = (value) => {
  if (value && typeof value === 'object') {
    return value.code ?? value.display ?? value.value ?? value.text ?? ''
  }
  return value
}

const checkComparisonMatch = (fieldValue, operator, expectedValue) => {
  const normalized = normalizeComparableValue(fieldValue)
  if (operator === 'filled') {
    if (Array.isArray(normalized)) return normalized.length > 0
    if (normalized && typeof normalized === 'object') return Object.keys(normalized).length > 0
    return normalized !== null && normalized !== undefined && String(normalized).trim() !== ''
  }
  if (operator === 'empty') {
    return !checkComparisonMatch(fieldValue, 'filled', expectedValue)
  }
  if (normalized === null || normalized === undefined || normalized === '') return false

  if (operator && operator.startsWith('number-')) {
    // Numbers when both sides are numeric, dates otherwise: cross-field rules
    // are mostly date order ("discharge before admission"), and Number() of an
    // ISO date is NaN. Mirrors toOrderedPair in @webforms/form-model.
    let left = Number(normalized)
    const expected = normalizeComparableValue(expectedValue)
    if (expected == null || String(expected).trim() === '') return false
    let right = Number(expected)
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      left = Date.parse(String(normalized))
      right = Date.parse(String(expected))
    }
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false
    if (operator === 'number-gt') return left > right
    if (operator === 'number-gte') return left >= right
    if (operator === 'number-lt') return left < right
    if (operator === 'number-lte') return left <= right
    return left === right
  }

  const left = String(normalized)
  const right = String(normalizeComparableValue(expectedValue) ?? '')
  return operator === 'not-equals' ? left !== right : left === right
}

/**
 * Evaluate one multi-condition entry ({controllerFieldId, type, optionValues?, value?})
 * against a field-value getter. Mirrors the builder's FieldLinkCondition types;
 * kept module-level (pure) so the node test harness can execute it directly.
 */
const evaluateConditionEntry = (entry, getFieldValue) => {
  if (entry && Array.isArray(entry.conditions)) return evaluateConditionEntries(entry.conditions, entry.match, getFieldValue)
  if (!entry || !entry.controllerFieldId || !entry.type) return false
  const fieldValue = getFieldValue(entry.controllerFieldId)
  const type = entry.type
  if (type === 'choice-selected') return checkChoiceMatch(fieldValue, entry.optionValues ?? [], false)
  if (type === 'choice-not-selected') return checkChoiceMatch(fieldValue, entry.optionValues ?? [], true)
  if (type === 'boolean-yes') return checkControllerMatch(fieldValue, 'yes')
  if (type === 'boolean-no') return checkControllerMatch(fieldValue, 'no')
  // equals / not-equals / filled / empty / number-* share the comparison matcher.
  // compareFieldId makes the right-hand side another answer instead of a
  // constant, which is what a cross-field rule needs. An unanswered compare
  // field means no match, so a half-filled form raises nothing.
  const compareFieldId = entry.compareFieldId || entry.valueFieldId
  if (compareFieldId) {
    const compareValue = getFieldValue(compareFieldId)
    if (!checkComparisonMatch(compareValue, 'filled', null)) return false
    return checkComparisonMatch(fieldValue, type, compareValue)
  }
  return checkComparisonMatch(fieldValue, type, entry.value)
}

/** Combine entries with match='all' (default) or 'any'. Empty entries = no match. */
const evaluateConditionEntries = (entries, match, getFieldValue) => {
  if (!Array.isArray(entries) || entries.length === 0) return false
  return match === 'any'
    ? entries.some((entry) => evaluateConditionEntry(entry, getFieldValue))
    : entries.every((entry) => evaluateConditionEntry(entry, getFieldValue))
}

const READ_ONLY_NATIVE_ELEMENTS = new Set(['input', 'textarea'])
const DISABLED_NATIVE_ELEMENTS = new Set(['button', 'fieldset', 'input', 'optgroup', 'option', 'select', 'textarea'])

const cloneWithProtection = (children, overrides) => {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child

    if (child.type === React.Fragment) {
      return React.cloneElement(child, {
        children: cloneWithProtection(child.props.children, overrides),
      })
    }

    if (typeof child.type === 'string') {
      const nextProps = {}
      if (READ_ONLY_NATIVE_ELEMENTS.has(child.type) && overrides.readOnly !== undefined) {
        nextProps.readOnly = overrides.readOnly
      }
      if (DISABLED_NATIVE_ELEMENTS.has(child.type) && overrides.disabled !== undefined) {
        nextProps.disabled = overrides.disabled
      }
      if (!READ_ONLY_NATIVE_ELEMENTS.has(child.type) && !DISABLED_NATIVE_ELEMENTS.has(child.type) && child.props.children) {
        nextProps.children = cloneWithProtection(child.props.children, overrides)
      }
      return Object.keys(nextProps).length > 0 ? React.cloneElement(child, nextProps) : child
    }

    return React.cloneElement(child, {
      ...(overrides.readOnly !== undefined ? { readOnly: overrides.readOnly } : {}),
      ...(overrides.disabled !== undefined ? { disabled: overrides.disabled } : {}),
    })
  })
}

/**
 * ConditionalReadOnly - applies or clears input protection while preserving content visibility.
 *
 * @param {Object} props
 * @param {Array<Object>} props.conditions - Field-link conditions to evaluate
 * @param {'all' | 'any'} [props.match='all'] - How multiple conditions combine
 * @param {'set-readonly' | 'clear-readonly'} [props.action='set-readonly']
 * @param {'readOnly' | 'disabled' | 'both'} [props.protectionMode='both']
 * @param {Array<Object>} [props.rules] - Ordered protection rules; supersedes the single-rule props
 * @param {React.ReactNode} props.children
 */
const ConditionalReadOnly = ({
  conditions,
  match = 'all',
  action = 'set-readonly',
  protectionMode = 'both',
  locked = false,
  rules,
  children,
}) => {
  const [fd] = useActiveData()
  const orderedRules = Array.isArray(rules) && rules.length > 0
    ? rules
    : [{ conditions, match, action, protectionMode }]
  const overrides = orderedRules.reduce((next, rule) => {
    const conditionMet = evaluateConditionEntries(
      rule.conditions,
      rule.match || 'all',
      (id) => readControllerValue(fd?.field?.data, id)
    )
    if (!conditionMet) return next

    const override = rule.action !== 'clear-readonly'
    const mode = rule.protectionMode || 'both'
    if (mode === 'readOnly' || mode === 'both') next.readOnly = override
    if (mode === 'disabled' || mode === 'both') next.disabled = override
    return next
  }, {})

  if (locked) { overrides.readOnly = true; overrides.disabled = true }
  if (overrides.readOnly === undefined && overrides.disabled === undefined) return <>{children}</>

  const protectedChildren = cloneWithProtection(children, overrides)
  const usesDisabledFallback = overrides.disabled === true

  if (!usesDisabledFallback) return <>{protectedChildren}</>

  return (
    <fieldset
      disabled
      aria-disabled='true'
      data-conditional-read-only='true'
      style={{
        border: 0,
        margin: 0,
        minInlineSize: 0,
        padding: 0,
        width: '100%',
      }}
    >
      {protectedChildren}
    </fieldset>
  )
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
 * @param {'preserve' | 'clear'} [props.hiddenAnswerPolicy='preserve'] - Whether a hidden field's answer is retained
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
  operator,
  compareValue,
  conditions,
  match = 'all',
  visibilityRules,
  invertMatch = false,
  showWhenNull = false,
  hiddenAnswerPolicy = 'preserve',
  containerStyle,
  containerProps = {},
  children,
  ...props
}) => {
  const [fd, setFormData] = useActiveData()
  const parentContext = useContext(LogicGateContext)

  // Determine visibility based on mode
  let isVisible = true

  if (Array.isArray(visibilityRules) && visibilityRules.length) {
    const matches = rule => evaluateConditionEntries(rule.conditions, rule.match, id => readControllerValue(fd?.field?.data, id))
    const shows = visibilityRules.filter(rule => rule.action === 'show')
    isVisible = (!shows.length || shows.some(matches)) && !visibilityRules.some(rule => rule.action === 'hide' && matches(rule))
  } else if (mode === 'always') {
    // Always visible regardless of parent gates
    isVisible = true
  } else if (mode === 'controller' && Array.isArray(conditions) && conditions.length > 0) {
    // Multi-condition rules (any/all over several controllers).
    const matches = evaluateConditionEntries(conditions, match, (id) => readControllerValue(fd?.field?.data, id))
    isVisible = invertMatch ? !matches : matches
  } else if (mode === 'controller' && controllerFieldId) {
    const controllerValue = readControllerValue(fd?.field?.data, controllerFieldId)

    // If optionValues is provided, use choice matching instead of boolean matching
    if (optionValues && optionValues.length > 0) {
      isVisible = checkChoiceMatch(controllerValue, optionValues, invertMatch)
    } else if (operator) {
      const matches = checkComparisonMatch(controllerValue, operator, compareValue)
      isVisible = invertMatch ? !matches : matches
    } else {
      // Boolean matching (yes/no)
      // When controller is null/unset, field is hidden (both show and hide rules)
      isVisible = showWhenNull
        ? (normalizeValue(controllerValue) === null ? true : checkControllerMatch(controllerValue, showWhen))
        : checkControllerMatch(controllerValue, showWhen)
    }
  } else {
    // Inherit - check if all parent groups are visible
    isVisible = parentContext.parentChain.every(parentId => {
      return parentContext.isGroupVisible(parentId)
    })
  }
  const wasVisibleRef = useRef(isVisible)

  // Hiding a field must also withdraw its STAGED chart writes. Observation /
  // narrative components stage payloads in __componentPayloads keyed by field
  // id; when this wrapper hides the child it UNMOUNTS, so nothing else can
  // clear a payload staged before the controller flipped (e.g. veteran
  // category picked, then veteran status set to No — legacy forms skipped the
  // write by evaluating the condition at submit). This wrapper stays mounted
  // while hiding, so it clears the entry here. Page unmounts (PageSelect)
  // unmount this wrapper too, so cross-page payloads are never touched.
  // Previously-SAVED chart observations stay untouched — hiding withdraws the
  // pending write, it does not delete history (legacy parity).
  useEffect(() => {
    const becameHidden = wasVisibleRef.current && !isVisible
    wasVisibleRef.current = isVisible
    if (isVisible || !fieldId) return

    const activeFieldData = fd?.field?.data
    const activePayloads = activeFieldData?.__componentPayloads
    const shouldClearAnswer =
      becameHidden &&
      hiddenAnswerPolicy === 'clear' &&
      activeFieldData?.[fieldId] !== undefined
    const hasStagedDco =
      activePayloads?.dcoUpdatesByComponent?.[fieldId] !== undefined
    const hasStagedWebformUpdate =
      activePayloads?.webformUpdatesByComponent?.[fieldId] !== undefined

    // Real MOIS attaches its React setter directly to ActiveData. Avoid
    // scheduling a curried Immer update when the initially-hidden wrapper has
    // no answer or staged payload to withdraw; a large form can contain
    // hundreds of these wrappers before any child has mounted.
    if (!shouldClearAnswer && !hasStagedDco && !hasStagedWebformUpdate) return

    setFormData(produce((draft) => {
      if (becameHidden && hiddenAnswerPolicy === 'clear' && draft?.field?.data) {
        delete draft.field.data[fieldId]
      }
      const payloads = draft?.field?.data?.__componentPayloads
      if (!payloads) return
      if (payloads.dcoUpdatesByComponent && payloads.dcoUpdatesByComponent[fieldId] !== undefined) {
        delete payloads.dcoUpdatesByComponent[fieldId]
      }
      if (payloads.webformUpdatesByComponent && payloads.webformUpdatesByComponent[fieldId] !== undefined) {
        delete payloads.webformUpdatesByComponent[fieldId]
      }
    }))
  }, [fd, isVisible, fieldId, hiddenAnswerPolicy, setFormData])

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

/** Field-level extension. Uses MOIS props and narrow state recipes; never patches native controls. */
const ConditionalFieldBehavior = ({ fieldId, rules = [], validations = [], optionRules = [], translations = {}, baseText = {}, required: baseRequired = false, requiredCapable = true, readOnly = false, locked = false, copyEnabled = true, children }) => {
  const [fd, setFd] = useActiveData()
  const getValue = (id) => readControllerValue(fd?.field?.data, id)
  const matches = (group) => evaluateConditionEntries(group?.conditions, group?.match, getValue)
  const locale = fd?.field?.status?.__formLocale || ''
  const text = translations[locale] || {}
  let required = baseRequired
  rules.forEach(rule => {
    if (matches(rule)) {
      if (rule.action === 'set-required') required = requiredCapable
      if (rule.action === 'clear-required') required = false
    }
  })
  const value = getValue(fieldId)
  const isEmpty = candidate => !checkMeaningfulAnswer(candidate)
  const copyRule = [...rules].reverse().find(rule => rule.action === 'copy-value' && rule.copyFromFieldId !== fieldId && matches(rule))
  const source = copyRule ? getValue(copyRule.copyFromFieldId) : undefined
  const copyState = fd?.field?.data?.__fieldCopyState?.[fieldId]
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  useEffect(() => {
    if (!copyEnabled || !copyRule || readOnly || locked || source === undefined || equal(value, source)) return
    const policy = copyRule.copyPolicy || 'when-empty'
    const userEdited = copyState?.edited || (copyState && !equal(value, copyState.value))
    const mayCopy = policy === 'always' || (policy === 'until-edited' ? !userEdited && (copyState || isEmpty(value)) : isEmpty(value))
    const setter = fd?.setFormData || setFd
    if (typeof setter !== 'function') return
    if (!mayCopy && !(policy === 'until-edited' && userEdited && !copyState?.edited)) return
    setter(produce(draft => {
      if (!draft.field) draft.field = { data: {}, status: {} }
      if (!draft.field.data) draft.field.data = {}
      const latestValue = readControllerValue(draft.field.data, fieldId)
      const latestSource = readControllerValue(draft.field.data, copyRule.copyFromFieldId)
      if (!equal(latestValue, value) || !equal(latestSource, source)) return
      if (!draft.field.data.__fieldCopyState) draft.field.data.__fieldCopyState = {}
      if (mayCopy) {
        draft.field.data[fieldId] = JSON.parse(JSON.stringify(source))
        draft.field.data.__fieldCopyState[fieldId] = { value: source, edited: false }
      } else draft.field.data.__fieldCopyState[fieldId] = { ...copyState, edited: true }
    }))
  }, [fd, setFd, fieldId, copyRule, source, value, readOnly, locked, copyEnabled])
  const errors = isEmpty(value) ? [] : validations.filter(rule => !matches(rule.validWhen)).map(rule => rule.translations?.[locale] || rule.message)
  const translateString = (value) => {
    if (typeof value !== 'string') return value
    for (const key of ['label', 'helpText', 'placeholder']) if (baseText[key] && value === baseText[key] && text[key]) return text[key]
    return value
  }
  const adapt = nodes => React.Children.map(nodes, child => {
    if (typeof child === 'string') return translateString(child)
    if (!React.isValidElement(child)) return child
    const props = {}
    if (typeof child.type === 'string' || child.type === React.Fragment) {
      if (child.props.children) props.children = adapt(child.props.children)
      if (['input', 'select', 'textarea'].includes(child.type)) { props.required = required; if (locked || readOnly) { props.disabled = true; if (child.type !== 'select') props.readOnly = true } }
    } else {
      props.required = required
      if (locked || readOnly) { props.readOnly = true; props.disabled = true }
      if (child.props.onValidate || validations.length) props.onValidate = candidate => {
        const prior = child.props.onValidate?.(candidate)
        if (prior) return prior
        if (isEmpty(candidate)) return undefined
        return validations.find(rule => !evaluateConditionEntries(rule.validWhen.conditions, rule.validWhen.match, id => id === fieldId ? candidate : getValue(id)))?.translations?.[locale] || validations.find(rule => !evaluateConditionEntries(rule.validWhen.conditions, rule.validWhen.match, id => id === fieldId ? candidate : getValue(id)))?.message
      }
      for (const key of ['label', 'placeholder', 'note']) if (typeof child.props[key] === 'string') props[key] = translateString(child.props[key])
      for (const key of ['options', 'codes', 'codeList', 'optionList']) {
        const rawOptions = child.props[key]
        if (!rawOptions || typeof rawOptions !== 'object') continue
        const options = Array.isArray(rawOptions) ? rawOptions : Object.entries(rawOptions).map(([key, text]) => ({ key, text }))
        props[key] = options.flatMap(option => {
          const stored = typeof option === 'string' ? option : option.code ?? option.key ?? option.value ?? option.text
          const rule = optionRules.find(rule => rule.value === String(stored))
          if (rule?.showWhen && !matches(rule.showWhen)) return []
          const translated = text.options?.[stored] || text.options?.[typeof option === "string" ? option : option.text ?? option.display ?? option.label]
          if (typeof option === 'string') return [{ key: option, text: translated || option, code: option, display: translated || option, disabled: rule?.disableWhen ? matches(rule.disableWhen) : false }]
          return [{ ...option, ...(translated ? { ...(option.text !== undefined ? { text: translated } : {}), ...(option.display !== undefined ? { display: translated } : {}), ...(option.label !== undefined ? { label: translated } : {}) } : {}), ...(rule?.disableWhen ? { disabled: matches(rule.disableWhen) } : {}) }]
        })
      }
      if (child.props.children) props.children = adapt(child.props.children)
      if (optionRules.length && Array.isArray(props.optionList) && child.props.fieldId === fieldId) return <ConditionalChoiceOptions {...child.props} {...props} />
    }
    return React.cloneElement(child, props)
  })
  return <>{adapt(children)}{errors.length > 0 && <div role='alert' style={{ color: '#a4262c', fontSize: 12 }}>{errors.join(' ')}</div>}</>
}

const FormLanguageSelector = ({ languages = [] }) => {
  const [fd, setFd] = useActiveData()
  return <label style={{ display: 'block', margin: '8px 0' }}>Language <select aria-label='Form language' value={fd?.field?.status?.__formLocale || ''} onChange={event => {
    const locale = event.target.value
    const setter = fd?.setFormData || setFd
    setter(produce(draft => {
      if (!draft.field) draft.field = { data: {}, status: {} }
      if (!draft.field.status) draft.field.status = {}
      draft.field.status.__formLocale = locale
    }))
  }}><option value=''>Default</option>{languages.map(locale => <option key={locale} value={locale}>{locale}</option>)}</select></label>
}

/** Submit validation reads current answers directly, including fields on unmounted pages. */
const validateFieldBehaviors = (configs, values, locale = '', uiTranslations = {}) => {
  const copyResult = resolveFieldCopies(configs, values)
  if (copyResult.error) return [{ id: '_form', message: copyResult.error }]
  const getValue = id => readControllerValue(values, id)
  const matches = group => evaluateConditionEntries(group?.conditions, group?.match, getValue)
  const empty = value => !checkMeaningfulAnswer(value)
  const translate = source => uiTranslations[locale]?.[source] || source
  return configs.flatMap(config => {
    const showRules = config.rules.filter(rule => rule.action === 'show')
    const hidden = config.hidden || (config.gates || []).some(gate => !matches(gate)) || (showRules.length > 0 && !showRules.some(matches)) || config.rules.some(rule => rule.action === 'hide' && matches(rule))
    if (hidden) return []
    let required = config.required
    config.rules.forEach(rule => {
      if (matches(rule)) {
        if (rule.action === 'set-required') required = config.requiredCapable !== false
        if (rule.action === 'clear-required') required = false
      }
    })
    const value = getValue(config.fieldId)
    if (empty(value)) return required ? [{ id: config.fieldId, message: translate(config.label + ' is required') }] : []
    const errors = config.validations.filter(rule => !matches(rule.validWhen)).map(rule => ({ id: config.fieldId, message: rule.translations?.[locale] || rule.message }))
    const selected = Array.isArray(value) ? value : [value]
    if (config.optionRules.some(rule => selected.some(option => String(normalizeComparableValue(option)) === rule.value) && ((rule.showWhen && !matches(rule.showWhen)) || (rule.disableWhen && matches(rule.disableWhen))))) {
      errors.push({ id: config.fieldId, message: translate(config.label + ': choose an available option') })
    }
    return errors
  })
}

// Choice extension owns per-option disabling, which the faithful MOIS controls
// do not implement uniformly. Values retain their original codes when translated.
const checkMeaningfulAnswer = value => {
  if (Array.isArray(value)) return value.some(checkMeaningfulAnswer)
  const normalized = normalizeComparableValue(value)
  return normalized !== undefined && normalized !== null && String(normalized).trim() !== ''
}
const ConditionalChoiceOptions = ({ fieldId, label, optionList, selectionType, required, readOnly, disabled, codeSystem, placeholder }) => {
  const [fd, setFd] = useActiveData()
  const current = readControllerValue(fd?.field?.data, fieldId)
  const multiple = selectionType === 'multiple'
  const selected = (Array.isArray(current) ? current : [current]).filter(v => v != null).map(v => String(normalizeComparableValue(v)))
  const options = optionList.map(option => ({ ...option, code: String(option.code ?? option.key ?? option.value), display: option.display ?? option.text ?? option.label }))
  return <label style={{ display: 'block', margin: '8px 0' }}>{label}{required ? ' *' : ''}<select aria-label={label || fieldId} required={required} disabled={readOnly || disabled} multiple={multiple} value={multiple ? selected : selected[0] || ''} style={{ display: 'block', padding: 6, minWidth: 180 }} onChange={event => {
    const values = Array.from(event.target.selectedOptions).filter(option => !option.disabled && option.value !== '').map(option => {
      const source = options.find(item => item.code === option.value)
      return { code: source.code, display: source.display, ...(codeSystem ? { system: codeSystem } : {}) }
    })
    const setter = fd?.setFormData || setFd
    setter(produce(draft => {
      if (!draft.field) draft.field = { data: {}, status: {} }
      if (!draft.field.data) draft.field.data = {}
      draft.field.data[fieldId] = multiple ? values : values[0] || null
    }))
  }}>{!multiple && <option value=''>{placeholder || 'Select…'}</option>}{options.map(option => <option key={option.code} value={option.code} disabled={option.disabled}>{option.display}</option>)}</select></label>
}

/** Resolve all copy rules together, including targets on pages that are unmounted. */
const resolveFieldCopies = (configs, original, locks = {}) => {
  const next = JSON.parse(JSON.stringify(original || {}))
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  for (let pass = 0; pass < Math.min(configs.length + 2, 100); pass++) {
    const before = JSON.stringify(next)
    for (const config of configs) {
      if (locks[config.fieldId]) continue
      const matches = rule => evaluateConditionEntries(rule.conditions, rule.match, id => readControllerValue(next, id))
      let protectedField = false
      config.rules.forEach(rule => { if (matches(rule) && ['set-readonly', 'clear-readonly'].includes(rule.action)) protectedField = rule.action === 'set-readonly' })
      if (protectedField) continue
      const rule = [...config.rules].reverse().find(rule => rule.action === 'copy-value' && rule.copyFromFieldId !== config.fieldId && matches(rule))
      if (!rule) continue
      const source = readControllerValue(next, rule.copyFromFieldId)
      const value = readControllerValue(next, config.fieldId)
      if (source === undefined || same(source, value)) continue
      const state = next.__fieldCopyState?.[config.fieldId]
      const edited = state?.edited || (state && !same(value, state.value))
      const policy = rule.copyPolicy || 'when-empty'
      const mayCopy = policy === 'always' || (policy === 'until-edited' ? !edited && (state || !checkMeaningfulAnswer(value)) : !checkMeaningfulAnswer(value))
      if (mayCopy) {
        next[config.fieldId] = JSON.parse(JSON.stringify(source))
        next.__fieldCopyState = { ...next.__fieldCopyState, [config.fieldId]: { value: source, edited: false } }
      } else if (policy === 'until-edited' && edited && !state?.edited) next.__fieldCopyState = { ...next.__fieldCopyState, [config.fieldId]: { ...state, edited: true } }
    }
    if (before === JSON.stringify(next)) return { values: next, error: '' }
  }
  return { values: original, error: 'Copy rules did not settle. Check the dependency map for a cycle.' }
}
const FormBehaviorRuntime = ({ configs, locks = {} }) => {
  const [fd, setFd] = useActiveData()
  const result = resolveFieldCopies(configs, fd?.field?.data, locks)
  const changed = JSON.stringify(result.values) !== JSON.stringify(fd?.field?.data || {})
  useEffect(() => {
    if (!changed || result.error) return
    const setter = fd?.setFormData || setFd
    if (typeof setter !== 'function') return
    setter(produce(draft => {
      const fresh = resolveFieldCopies(configs, draft?.field?.data, locks)
      if (fresh.error || !draft?.field?.data) return
      for (const config of configs) if (JSON.stringify(draft.field.data[config.fieldId]) !== JSON.stringify(fresh.values[config.fieldId])) draft.field.data[config.fieldId] = fresh.values[config.fieldId]
      if (fresh.values.__fieldCopyState) draft.field.data.__fieldCopyState = fresh.values.__fieldCopyState
    }))
  }, [fd, setFd, configs, locks, changed, result.error])
  return result.error ? <div role='alert'>{result.error}</div> : null
}
