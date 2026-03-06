const { useState, useEffect, useMemo } = React

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

/**
 * FindCodeSelect
 * Hybrid between FindCode and SimpleCodeSelect:
 * - Search/filter while typing
 * - Dropdown-style selection UI
 */
const FindCodeSelect = ({
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
  showOtherOption = false,
  size = 'medium',
  value,
  style,
}) => {
  const [selectedValue, setSelectedValue] = useState(value ?? defaultValue ?? null)
  const [searchText, setSearchText] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value ?? null)
    }
  }, [value])

  const codeListFromContext = useCodeList(codeSystem || '')

  const items = useMemo(() => {
    if (Array.isArray(optionList)) {
      if (optionList.length > 0) {
        return optionList.map(normalizeOption)
      }
      return codeListFromContext.map(normalizeOption)
    }

    if (optionList && typeof optionList === 'object') {
      return Object.entries(optionList).map(([code, display]) =>
        normalizeOption({ code, display })
      )
    }

    return codeListFromContext.map(normalizeOption)
  }, [optionList, codeListFromContext])

  const selectedCode = selectedValue?.[codeId] ?? selectedValue?.code ?? null
  const selectedKey = selectedCode == null ? undefined : String(selectedCode)
  const hasSearchText = String(searchText || '').trim().length > 0
  const comboSelectedKey = hasSearchText ? undefined : selectedKey

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
      const hidden = filteringActive && key !== selectedKey && !candidateKeys.has(key)
      return {
        key,
        text,
        data: { item, index },
        hidden,
      }
    })
  }, [candidateKeys, codeId, items, onRenderSelected, searchText, selectedKey])

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
      setSelectedValue(selectedItem)
      setSearchText('')

      const mapped = mapCandidateSavedValue
        ? mapCandidateSavedValue(selectedItem, codeSystem || selectedItem?.system || '', codeId)
        : defaultMapCandidateSavedValue(selectedItem, codeSystem || selectedItem?.system || '', codeId, onRenderSelected)

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

      setSelectedValue(freeTextItem)
      setSearchText('')

      const mapped = mapCandidateSavedValue
        ? mapCandidateSavedValue(freeTextItem, codeSystem || '', codeId)
        : defaultMapCandidateSavedValue(freeTextItem, codeSystem || '', codeId, onRenderSelected)

      onChange?.(mapped)
      return
    }

    if (!option && !freeText) {
      setSelectedValue(null)
      setSearchText('')
      onChange?.({
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

  const showChildren = selectedValue &&
    conditionalCodes.includes(String(selectedValue?.[codeId] ?? selectedValue?.code ?? ''))

  const isEmpty = !selectedValue && !searchText
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

        {isFocused && !selectedValue && !searchText && searchPrompt && (
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
