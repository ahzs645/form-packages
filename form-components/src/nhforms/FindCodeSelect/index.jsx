const { useState, useEffect, useMemo } = React
const { ComboBox } = Fluent

const sizeMap = {
  tiny: { minWidth: 50, maxWidth: 80, flex: '1 1 0px' },
  small: { minWidth: 80, maxWidth: 160, flex: '2 2 0px' },
  medium: { minWidth: 160, maxWidth: 320, flex: '3 3 0px' },
  large: { minWidth: 320, maxWidth: 480, flex: '4 4 0px' },
  max: { minWidth: 480, flex: '5 5 0px' },
}

const defaultGetCandidates = (selectableItems, searchText) => {
  const match = String(searchText || '').trim().toLowerCase()
  return selectableItems
    .filter((item) => {
      if (!match) return true
      const text = String(item?.display ?? item?.text ?? '').toLowerCase()
      return text.startsWith(match)
    })
    .slice(0, 50)
}

const defaultRenderSelected = (item) => String(item?.display ?? item?.text ?? '')

const CONTROL_KEY_TOKENS = new Set([
  'Alt',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Backspace',
  'CapsLock',
  'Control',
  'Delete',
  'End',
  'Enter',
  'Escape',
  'Home',
  'Meta',
  'PageDown',
  'PageUp',
  'Shift',
  'Tab',
])

const isKeyboardToken = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return false
  if (CONTROL_KEY_TOKENS.has(text)) return true
  if (/^F\d{1,2}$/.test(text)) return true
  return false
}

const normalizeOption = (item) => {
  if (!item || typeof item !== 'object') {
    const text = String(item ?? '')
    return { code: text, display: text }
  }

  if ('display' in item || 'code' in item) {
    return {
      ...item,
      code: item.code ?? item.key ?? null,
      display: item.display ?? item.text ?? '',
    }
  }

  if ('key' in item || 'text' in item) {
    return {
      ...item,
      code: item.key ?? null,
      display: item.text ?? '',
    }
  }

  return item
}

const defaultMapCandidateSavedValue = (item, codeSystem, codeId, onRenderSelected) => {
  const code = item?.[codeId] ?? item?.code ?? item?.key ?? null
  return {
    ...item,
    code: code == null ? null : String(code),
    display: onRenderSelected(item) || null,
    system: codeSystem || item?.system || '',
  }
}

const normalizeSelectedValues = (rawValue, isMulti) => {
  if (isMulti) {
    if (Array.isArray(rawValue)) return rawValue.filter(Boolean)
    if (rawValue === undefined || rawValue === null || rawValue === '') return []
    return [rawValue]
  }

  if (Array.isArray(rawValue)) return rawValue[0] ?? null
  return rawValue ?? null
}

const getItemKey = (item, codeId, fallback) => {
  const rawKey = item?.[codeId] ?? item?.code ?? item?.key ?? fallback
  return rawKey == null ? null : String(rawKey)
}

const sameSelectedItem = (left, right, codeId) => {
  const leftKey = getItemKey(left, codeId, null)
  const rightKey = getItemKey(right, codeId, null)
  if (leftKey !== null || rightKey !== null) return leftKey === rightKey
  return String(left?.display ?? left?.text ?? '') === String(right?.display ?? right?.text ?? '')
}

const resolveItems = (optionList, fallbackItems = []) => {
  if (Array.isArray(optionList)) {
    if (optionList.length > 0) {
      return optionList.map(normalizeOption)
    }
    return fallbackItems.map(normalizeOption)
  }

  if (optionList && typeof optionList === 'object') {
    return Object.entries(optionList).map(([code, display]) =>
      normalizeOption({ code, display })
    )
  }

  return fallbackItems.map(normalizeOption)
}

const normalizeLookupName = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase()

const resolveLookupPath = (source, path) => {
  const segments = String(path || '').split('.').map((segment) => segment.trim()).filter(Boolean)
  if (!source || segments.length === 0) return undefined
  return segments.reduce((current, segment) => {
    if (current === undefined || current === null) return undefined
    if (Array.isArray(current) && /^\d+$/.test(segment)) return current[Number(segment)]
    return typeof current === 'object' ? current[segment] : undefined
  }, source)
}

const sourceEntries = (value) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).map(([code, entry]) => (
    entry && typeof entry === 'object'
      ? { ...entry, code: entry.code ?? entry.key ?? code }
      : { code, display: entry }
  ))
}

const sourceLookupItems = (source, lookupType, lookupSourcePaths = []) => {
  const normalized = normalizeLookupName(lookupType)
  const optionLists = source?.optionLists || {}
  const customSources = Array.isArray(lookupSourcePaths)
    ? lookupSourcePaths.map((path) => resolveLookupPath(source, path))
    : []
  const candidates = [
    source?.lookups?.[lookupType],
    source?.lookupValues?.[lookupType],
    source?.[`${lookupType}Options`],
    source?.[`${lookupType}s`],
    optionLists[lookupType],
    optionLists[lookupType?.toUpperCase?.()],
    optionLists[`MOIS-${lookupType?.toUpperCase?.()}`],
    ...customSources,
  ]
  if (normalized === 'servicelocation') {
    candidates.push(source?.serviceLocations, optionLists.SERVICELOCATION, optionLists.SERVICE_LOCATION, optionLists['MOIS-SERVICELOCATION'])
  }
  if (normalized === 'jorg') {
    candidates.push(source?.jorg, source?.organizations, optionLists.JORG, optionLists['MOIS-JORG'])
  }

  const seen = new Set()
  return candidates
    .flatMap(sourceEntries)
    .map(normalizeOption)
    .filter((item, index) => {
      const key = getItemKey(item, 'code', `__lookup_${index}`)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const valueForLookupTarget = (selected, targetId, targetLabel, fallback) => {
  if (!selected || typeof selected !== 'object') return fallback
  const normalizedLabel = normalizeLookupName(targetLabel)
  const directKeys = [targetId, targetId?.split('_').pop(), normalizedLabel]
  for (const key of directKeys) {
    if (key && selected[key] !== undefined && selected[key] !== null) return String(selected[key])
  }
  const aliasSets = [
    ['healthauthority', 'authority'],
    ['healthservicedeliveryarea', 'hsda'],
    ['branch'],
    ['responsibleservicedeliverylocation', 'servicedeliverylocation', 'sdl', 'location'],
  ]
  const aliases = aliasSets.find((items) => items.some((item) => normalizedLabel.includes(item))) ?? []
  for (const alias of aliases) {
    const matchingKey = Object.keys(selected).find((key) => normalizeLookupName(key) === alias)
    if (matchingKey && selected[matchingKey] != null) return String(selected[matchingKey])
  }
  return fallback
}

/**
 * Shared implementation used by the inline-option and code-list-backed variants.
 */
const FindCodeSelectBase = ({
  actions,
  borderless = false,
  children,
  codeId = 'code',
  codeSystem,
  comboBoxProps = {},
  comboBoxStyle,
  conditionalCodes = [],
  defaultValue,
  disabled = false,
  fieldId,
  getCandidates = defaultGetCandidates,
  hidden = false,
  id,
  index,
  isComplete,
  label,
  labelPosition,
  layoutId,
  mapCandidateSavedValue,
  moisModule,
  note,
  onChange,
  openOnFocus = false,
  onRenderCandidate,
  onRenderSelected = defaultRenderSelected,
  optionList = [],
  placeholder = 'Please search',
  placement,
  readOnly = false,
  required = false,
  searchPrompt = '',
  section,
  selectionType = 'single',
  showOtherOption = false,
  size = 'medium',
  value,
  style,
  fallbackItems = [],
}) => {
  const isMultiSelect = selectionType === 'multiple'
  const [selectedValue, setSelectedValue] = useState(
    normalizeSelectedValues(value ?? defaultValue, isMultiSelect)
  )
  const [searchText, setSearchText] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(normalizeSelectedValues(value, isMultiSelect))
    }
  }, [value, isMultiSelect])

  const items = useMemo(() => {
    return resolveItems(optionList, fallbackItems)
  }, [optionList, fallbackItems])

  const selectedItems = isMultiSelect ? selectedValue : selectedValue ? [selectedValue] : []
  const selectedKeys = selectedItems
    .map((item, index) => getItemKey(item, codeId, `__selected_${index}`))
    .filter(Boolean)
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys.join('|')])
  const selectedCode = !isMultiSelect ? selectedValue?.[codeId] ?? selectedValue?.code ?? null : null
  const selectedKey = selectedCode == null ? undefined : String(selectedCode)
  const hasSearchText = String(searchText || '').trim().length > 0
  const comboSelectedKey = hasSearchText ? undefined : isMultiSelect ? selectedKeys : selectedKey

  const candidates = useMemo(
    () => getCandidates(items, searchText),
    [getCandidates, items, searchText]
  )

  const candidateKeys = useMemo(() => {
    const keys = new Set()
    for (let i = 0; i < candidates.length; i += 1) {
      const item = candidates[i]
      const rawKey = item?.[codeId] ?? item?.code ?? item?.key ?? `__idx_${i}`
      keys.add(String(rawKey))
    }
    return keys
  }, [candidates, codeId])

  const options = useMemo(() => {
    const filteringActive = String(searchText || '').trim().length > 0
    return items.map((item, index) => {
      const rawKey = item?.[codeId] ?? item?.code ?? item?.key ?? `__idx_${index}`
      const key = String(rawKey)
      const text = onRenderSelected(item) || String(item?.display ?? item?.text ?? rawKey)
      const hidden = filteringActive && !selectedKeySet.has(key) && !candidateKeys.has(key)
      return {
        key,
        text,
        data: { item, index },
        hidden,
        selected: selectedKeySet.has(key),
      }
    })
  }, [candidateKeys, codeId, items, onRenderSelected, searchText, selectedKeySet])

  const handleInputValueChange = (rawText) => {
    const text = String(rawText ?? '')
    if (isKeyboardToken(text)) return
    setSearchText(text)
  }

  const handleKeyDown = (event) => {
    const key = event?.key
    const isDeleteKey = key === 'Backspace' || key === 'Delete'
    if (!isDeleteKey) return
    if (hasSearchText) return
    if (isMultiSelect) {
      if (!Array.isArray(selectedValue) || selectedValue.length === 0) return
      const nextValues = selectedValue.slice(0, -1)
      setSelectedValue(nextValues)
      onChange?.(nextValues)
      return
    }
    if (!selectedValue) return

    setSelectedValue(null)
    onChange?.({
      code: null,
      display: null,
      system: codeSystem || '',
    })
  }

  const handlePendingValueChanged = (_option, _index, pendingValue) => {
    if (typeof pendingValue === 'string' && !isKeyboardToken(pendingValue)) {
      setSearchText(pendingValue)
    }
  }

  const handleChange = (event, option, _index, freeformValue) => {
    const selectedItem = option?.data?.item

    if (selectedItem) {
      const mapped = mapCandidateSavedValue
        ? mapCandidateSavedValue(selectedItem, codeSystem || selectedItem?.system || '', codeId)
        : defaultMapCandidateSavedValue(selectedItem, codeSystem || selectedItem?.system || '', codeId, onRenderSelected)

      if (isMultiSelect) {
        const currentValues = Array.isArray(selectedValue) ? selectedValue : []
        const shouldSelect = option?.selected !== false
        const withoutItem = currentValues.filter((item) => !sameSelectedItem(item, mapped, codeId))
        const nextValues = shouldSelect ? [...withoutItem, mapped] : withoutItem
        setSelectedValue(nextValues)
        setSearchText('')
        onChange?.(nextValues)
        return
      }

      setSelectedValue(selectedItem)
      setSearchText('')
      onChange?.(mapped)
      return
    }

    const freeText = String(freeformValue ?? '').trim()

    if (showOtherOption && freeText.length > 0 && !isKeyboardToken(freeText)) {
      const freeTextItem = {
        [codeId]: null,
        code: null,
        display: freeText,
        system: codeSystem || '',
      }

      const mapped = mapCandidateSavedValue
        ? mapCandidateSavedValue(freeTextItem, codeSystem || '', codeId)
        : defaultMapCandidateSavedValue(freeTextItem, codeSystem || '', codeId, onRenderSelected)

      if (isMultiSelect) {
        const currentValues = Array.isArray(selectedValue) ? selectedValue : []
        const nextValues = [...currentValues, mapped]
        setSelectedValue(nextValues)
        setSearchText('')
        onChange?.(nextValues)
        return
      }

      setSelectedValue(freeTextItem)
      setSearchText('')
      onChange?.(mapped)
      return
    }

    if (!option && !freeText) {
      setSelectedValue(isMultiSelect ? [] : null)
      setSearchText('')
      onChange?.(isMultiSelect ? [] : {
        code: null,
        display: null,
        system: codeSystem || '',
      })
    }
  }

  const renderCandidateOption = (option) => {
    if (!option) return null
    if (!onRenderCandidate) return <>{option.text}</>
    const item = option?.data?.item
    const idx = option?.data?.index ?? 0
    return <>{onRenderCandidate(item, idx)}</>
  }

  const showChildren = !isMultiSelect && selectedValue &&
    conditionalCodes.includes(String(selectedValue?.[codeId] ?? selectedValue?.code ?? ''))

  const isEmpty = isMultiSelect
    ? (!Array.isArray(selectedValue) || selectedValue.length === 0) && !searchText
    : !selectedValue && !searchText
  const sectionLayout = section?.layout

  const effectiveLabelPosition = labelPosition ?? (
    sectionLayout === 'linear' ? 'left' : 'top'
  )

  const fluentLabel = effectiveLabelPosition === 'top' ? label : undefined
  const shouldSuppressLayoutItemLabel = effectiveLabelPosition === 'top'

  const getSizeStyles = () => {
    if (typeof size === 'object') return size
    return sizeMap[size] ?? sizeMap.medium
  }

  const sizeStyles = getSizeStyles()

  const wrapperStyle = {
    display: 'flex',
    flexFlow: 'column',
    width: sizeStyles.maxWidth,
    ...sizeStyles,
    ...comboBoxStyle,
  }

  const { styles: propStyles, ...restComboBoxProps } = comboBoxProps || {}
  const defaultComboStyles = {
    root: { width: '100%' },
    optionsContainerWrapper: { maxHeight: 320 },
  }

  let combinedStyles = defaultComboStyles
  if (propStyles) {
    if (typeof propStyles === 'function') {
      combinedStyles = propStyles
    } else {
      combinedStyles = {
        ...defaultComboStyles,
        ...propStyles,
      }
    }
  }

  if (borderless && typeof combinedStyles !== 'function') {
    combinedStyles = {
      ...combinedStyles,
      rootHovered: { borderColor: 'transparent' },
      rootFocused: { borderColor: 'transparent' },
    }
  }

  return (
    <LayoutItem
      actions={actions}
      disabled={disabled}
      fieldId={fieldId}
      hidden={hidden}
      id={id}
      index={index}
      isComplete={isComplete}
      isEmpty={isEmpty}
      label={label}
      labelPosition={labelPosition}
      layoutId={layoutId}
      moisModule={moisModule}
      noTopLabel={shouldSuppressLayoutItemLabel}
      note={note}
      placement={placement}
      readOnly={readOnly}
      required={required}
      section={section}
      size={size}
      layoutStyle={style}
    >
      <div style={wrapperStyle}>
        <ComboBox
          id={fieldId}
          label={fluentLabel}
          selectedKey={comboSelectedKey}
          multiSelect={isMultiSelect}
          options={options}
          placeholder={placeholder}
          disabled={disabled || readOnly}
          allowFreeform={showOtherOption}
          allowFreeInput
          autoComplete="on"
          openOnKeyboardFocus={openOnFocus}
          onChange={handleChange}
          onInputValueChange={handleInputValueChange}
          onPendingValueChanged={handlePendingValueChanged}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onRenderOption={renderCandidateOption}
          styles={combinedStyles}
          {...restComboBoxProps}
        />

        {isFocused && isEmpty && searchPrompt && (
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: '#605e5c',
            }}
          >
            {searchPrompt}
          </div>
        )}
      </div>

      {showChildren && children}
    </LayoutItem>
  )
}

const FindCodeSelectWithCodeList = (props) => {
  const codeListFromContext = useCodeList(props.codeSystem || '')
  return <FindCodeSelectBase {...props} fallbackItems={codeListFromContext} />
}

const FindCodeSelectWithSourceLookup = ({
  lookupType = '',
  lookupSourcePaths = [],
  targetFieldIds = [],
  targetLabels = {},
  ...props
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const effectiveFieldId = props.fieldId || props.id || 'findCodeSelect'
  const sourceItems = useMemo(
    () => sourceLookupItems(sd, lookupType, lookupSourcePaths),
    [lookupSourcePaths, lookupType, sd]
  )
  const fallbackItems = useMemo(
    () => resolveItems(props.optionList, []),
    [props.optionList]
  )
  const items = sourceItems.length > 0 ? sourceItems : fallbackItems
  const storedValue = fd?.field?.data?.[effectiveFieldId]
  const boundValue = useMemo(() => {
    if (props.value !== undefined || storedValue === undefined || storedValue === null || storedValue === '') {
      return props.value
    }
    if (typeof storedValue === 'object') return storedValue
    const text = String(storedValue)
    return items.find((item) => String(item?.code ?? item?.key ?? '') === text || String(item?.display ?? item?.text ?? '') === text)
      ?? { code: null, display: text }
  }, [items, props.value, storedValue])

  const handleChange = (nextValue) => {
    props.onChange?.(nextValue)
    const selected = Array.isArray(nextValue) ? nextValue[nextValue.length - 1] : nextValue
    const fallback = String(selected?.display ?? selected?.text ?? selected?.value ?? selected?.code ?? '')
    const targets = Array.isArray(targetFieldIds) && targetFieldIds.length > 0 ? targetFieldIds : [effectiveFieldId]
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== 'object') draft.field.data = {}
      targets.forEach((targetId) => {
        if (!targetId) return
        draft.field.data[targetId] = valueForLookupTarget(selected, targetId, targetLabels?.[targetId], fallback)
      })
    }))
  }

  return (
    <FindCodeSelectBase
      {...props}
      fieldId={effectiveFieldId}
      optionList={items}
      fallbackItems={[]}
      value={boundValue}
      showOtherOption={props.showOtherOption ?? true}
      onChange={handleChange}
    />
  )
}

/**
 * FindCodeSelect
 * Hybrid between FindCode and SimpleCodeSelect:
 * - Search/filter while typing
 * - Dropdown-style selection UI
 *
 * Important runtime behavior:
 * If explicit `optionList` values are provided, do not call `useCodeList`.
 * The exported MOIS runtime can provide inline options without a fully wired
 * code-list host context, and calling `useCodeList` in that path can fail.
 */
const FindCodeSelect = (props) => {
  const hasSourceLookup = Boolean(String(props?.lookupType ?? '').trim()) ||
    (Array.isArray(props?.lookupSourcePaths) && props.lookupSourcePaths.length > 0)
  if (hasSourceLookup) {
    return <FindCodeSelectWithSourceLookup {...props} />
  }

  const optionList = props?.optionList
  const hasExplicitOptionList = Array.isArray(optionList)
    ? optionList.length > 0
    : Boolean(optionList && typeof optionList === 'object')

  if (hasExplicitOptionList) {
    return <FindCodeSelectBase {...props} fallbackItems={[]} />
  }

  return <FindCodeSelectWithCodeList {...props} />
}
