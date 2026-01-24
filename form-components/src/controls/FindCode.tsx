/**
 * FindCode Component
 * The FindCode control is used to search and select codes.
 * As the user types, the list filters down to candidate codes that meet the search input.
 */

import React, { useState, useCallback, useRef } from 'react';
import { TextField, Callout, DirectionalHint, FocusZone } from '@fluentui/react';
import { useCodeList, useTheme } from '../context/MoisContext';
import { LayoutItem } from './LayoutItem';

/** Coding type with extended properties */
export interface CodingExtended {
  code: string | null;
  display: string | null;
  system: string;
  [key: string]: any;
}

/** Sorted option list type */
export type SortedOptionList = any[];

export interface FindCodeProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Show field without an enclosing border */
  borderless?: boolean;
  /** Child controls are shown when one of the conditionCodes is met */
  children?: React.ReactNode;
  /** Field name to use as the unique key in the candidates (default: "code") */
  codeId?: string;
  /** Code system to search */
  codeSystem?: string;
  /** If selected key is in this list, it will display the child controls */
  conditionalCodes?: string[];
  /** Initial selected value */
  defaultValue?: CodingExtended;
  /** Indicate whether the field is disabled */
  disabled?: boolean;
  /** Active field name */
  fieldId?: string;
  /** A function for filtering the selectable items based on search input */
  getCandidates?: (selectableItems: SortedOptionList, searchText: string) => SortedOptionList;
  /** Hidden fields are not shown at all */
  hidden?: boolean;
  /** Source and active field name */
  id?: string;
  /** List index for grid and flowsheet layouts */
  index?: number;
  /** Override section completion status */
  isComplete?: boolean;
  /** Label for this field */
  label?: string;
  /** Label position relative to control */
  labelPosition?: 'top' | 'left' | 'none';
  /** Identifier for selective layout */
  layoutId?: string;
  /** A function for mapping the selected item back to a persistent form */
  mapCandidateSavedValue?: (item: any, codeSystem: string, codeId: string) => CodingExtended;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** Annotation shown near the control */
  note?: string;
  /** onChange callback for updating value */
  onChange?: (value: CodingExtended) => void;
  /** A function for rendering the items in the list of candidates */
  onRenderCandidate?: (item: any, index: number) => React.ReactNode;
  /** String to display for selected candidate */
  onRenderSelected?: (selected: any) => string;
  /** Object with codes for the dropdown */
  optionList?: any[];
  /** Placeholder string shown if no value has been entered */
  placeholder?: string;
  /** Override field placement */
  placement?: string | number;
  /** A readOnly control is always view only */
  readOnly?: boolean;
  /** Indicates that the value should be kept up to date with changes */
  refresh?: boolean;
  /** Is this field required to have a value? */
  required?: boolean;
  /** Prompt that will appear under the search bar when focused */
  searchPrompt?: string;
  /** Advanced: Override section settings */
  section?: any;
  /** If set to true, the control will accept a free text value */
  showOtherOption?: boolean;
  /** Size indicator */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | React.CSSProperties;
  /** Source field name */
  sourceId?: string;
  /** Override properties of the base Fluent TextField control */
  textFieldProps?: any;
  /** Value for this field */
  value?: CodingExtended;
  /** Style override */
  style?: React.CSSProperties;
}

// Default getCandidates function - "starts with" search
const defaultGetCandidates = (selectableItems: SortedOptionList, searchText: string): SortedOptionList => {
  return selectableItems
    .filter((a) =>
      searchText
        ? a.display?.toLowerCase().startsWith(searchText.toLowerCase())
        : true
    )
    .slice(0, 10);
};

// Default onRenderCandidate function
const defaultRenderCandidate = (item: any, _index: number): React.ReactNode => {
  return <>{item.display}</>;
};

// Default onRenderSelected function
const defaultRenderSelected = (item: any): string => {
  return item?.display || '';
};

/**
 * FindCode - Search and select codes control
 *
 * @example
 * // Typical use with default search "starts with"
 * <FindCode
 *   id="visitReason"
 *   label="Visit reason"
 *   codeSystem="MOIS-VISITREASON"
 * />
 *
 * @example
 * // FindCode with a custom search "contains" and allowing free text entry
 * <FindCode
 *   id="visitReason"
 *   label="Visit reason"
 *   codeSystem="MOIS-VISITREASON"
 *   showOtherOption
 *   getCandidates={(items, search) => {
 *     if (!search || search.length < 1) return [];
 *     const match = search.toLowerCase();
 *     return items
 *       .filter((a) => match ? a.display.toLowerCase().indexOf(match) >= 0 : true)
 *       .slice(0, 10);
 *   }}
 * />
 *
 * @example
 * // FindCode with a scored search "best matching words"
 * // Candidates scored higher for more matching words, start of word matches,
 * // or if search matches the start of the display text. Try searching "in".
 * const initialBonus = 10;
 * const startOfWordBonus = 5;
 *
 * function scoreMatchingWords(wordList, text) {
 *   if (!text || text.length < 1) return 0;
 *   let score = 0;
 *   for (let i = 0; i < wordList.length; ++i) {
 *     const match = text.indexOf(wordList[i]);
 *     if (match === 0) score += initialBonus;
 *     if (match >= 0 && text[match - 1] === " ") score += startOfWordBonus;
 *     if (match >= 0) score += 1;
 *   }
 *   return score;
 * }
 *
 * <FindCode
 *   id="visitReason"
 *   label="Visit reason"
 *   codeSystem="MOIS-VISITREASON"
 *   getCandidates={(items, search) => {
 *     if (!search || search.length < 1) return [];
 *     const words = search.toUpperCase().split(" ");
 *     return items
 *       .map(item => ({ item, score: scoreMatchingWords(words, item.display) }))
 *       .filter(item => item.score > 0)
 *       .sort((a, b) => b.score - a.score)
 *       .slice(0, 10)
 *       .map(i => i.item);
 *   }}
 * />
 *
 * @example
 * // FindCode with a custom renderer showing category and code. Try searching "d".
 * const customRenderer = (item, index) => {
 *   return (
 *     <>
 *       {item.display}
 *       <div style={{ fontSize: "x-small", color: "blue" }}>
 *         {item.category}: {item.system} - {item.code}
 *       </div>
 *     </>
 *   );
 * };
 *
 * <FindCode
 *   id="visitReason"
 *   label="Visit reason"
 *   codeSystem="MOIS-VISITREASON"
 *   onRenderCandidate={customRenderer}
 * />
 *
 * @example
 * // FindCode with managed state
 * const [value, setValue] = React.useState();
 *
 * <FindCode
 *   fieldId="onChangeFindCode"
 *   label="Reserve"
 *   codeSystem="MOIS-FIRSTNATIONRESERVE"
 *   value={value}
 *   onChange={(option) => setValue(option)}
 * />
 *
 * @example
 * // FindCode with custom searchPrompt
 * <FindCode
 *   fieldId="customSearch"
 *   label="Custom Search Prompt"
 *   codeSystem="MOIS-FIRSTNATIONRESERVE"
 *   searchPrompt="This is a custom prompt"
 * />
 *
 * @example
 * // Using FindCode to find objects instead of codings
 * const providers = useSourceData().useAppSettings().providers;
 * const [fd] = useActiveData();
 *
 * <>
 *   <FindCode
 *     fieldId="providerFound"
 *     label="Choose a provider"
 *     optionList={providers}
 *     onRenderCandidate={(p) => p.name}
 *     onRenderSelected={(p) => p ? p.name : ""}
 *     codeId="providerId"
 *     getCandidates={(items, search) => {
 *       if (!search || search.length < 1) return [];
 *       const match = search.toLowerCase();
 *       return items
 *         .filter((p) => match ? p.name.toLowerCase().indexOf(match) >= 0 : true)
 *         .slice(0, 10);
 *     }}
 *   />
 *   <pre>{JSON.stringify(fd.field.data.providerFound, null, "  ")}</pre>
 * </>
 */
export const FindCode: React.FC<FindCodeProps> = ({
  actions,
  borderless = false,
  children,
  codeId = 'code',
  codeSystem,
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
  moisModule,
  note,
  onChange,
  onRenderCandidate = defaultRenderCandidate,
  onRenderSelected = defaultRenderSelected,
  optionList = [],
  placeholder = 'Please search',
  placement,
  readOnly = false,
  required = false,
  searchPrompt = 'Type to begin searching',
  section,
  showOtherOption = false,
  size = 'medium',
  textFieldProps,
  value,
  style,
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedValue, setSelectedValue] = useState<any>(value || defaultValue || null);
  const [isCalloutVisible, setIsCalloutVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textFieldRef = useRef<HTMLDivElement>(null);

  // Get code list from context if codeSystem is provided
  const codeListFromContext = useCodeList(codeSystem || '');

  // Use optionList prop if provided, otherwise use code list from context
  const items = optionList.length > 0 ? optionList : codeListFromContext;

  // Get candidates based on search text
  const candidates = getCandidates(items, searchText);

  // Handle input change
  const handleInputChange = useCallback((_event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    setSearchText(newValue || '');
    setIsCalloutVisible(true);
  }, []);

  // Handle candidate selection
  const handleSelect = useCallback((item: any) => {
    setSelectedValue(item);
    setSearchText('');
    setIsCalloutVisible(false);

    const coding: CodingExtended = {
      code: item[codeId] || item.code || null,
      display: onRenderSelected(item),
      system: codeSystem || item.system || '',
      ...item,
    };

    if (onChange) {
      onChange(coding);
    }
  }, [codeId, codeSystem, onChange, onRenderSelected]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (searchText.length > 0 || optionList.length > 0) {
      setIsCalloutVisible(true);
    }
  }, [searchText, optionList]);

  // Handle blur
  const handleBlur = useCallback(() => {
    // Delay to allow click on callout items
    setTimeout(() => {
      setIsFocused(false);
      setIsCalloutVisible(false);
    }, 200);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsCalloutVisible(false);
    }
  }, []);

  // Check if children should be shown based on conditionalCodes
  const showChildren = selectedValue && conditionalCodes.includes(selectedValue[codeId] || selectedValue.code);

  const theme = useTheme();

  // Get size styles from theme
  const getSizeStyles = (): React.CSSProperties => {
    if (typeof size === 'object') return size;
    return theme.mois.sizes[size] ?? theme.mois.sizes.medium;
  };

  // Display value
  const displayValue = selectedValue ? onRenderSelected(selectedValue) : searchText;
  const isEmpty = !selectedValue && !searchText;

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
      note={note}
      placement={placement}
      readOnly={readOnly}
      required={required}
      section={section}
      size={size}
      layoutStyle={style}
    >
      <div ref={textFieldRef} style={getSizeStyles()}>
        <TextField
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || readOnly}
          readOnly={readOnly}
          borderless={borderless}
          {...textFieldProps}
        />
      </div>

      {/* Search prompt shown when focused and no results yet */}
      {isFocused && searchPrompt && searchText.length === 0 && !selectedValue && textFieldRef.current && (
        <Callout
          target={textFieldRef.current}
          isBeakVisible={false}
          directionalHint={DirectionalHint.bottomLeftEdge}
          onDismiss={() => setIsFocused(false)}
          setInitialFocus={false}
          styles={{
            calloutMain: {
              padding: 0,
            },
          }}
        >
          <div style={{
            cursor: 'default',
            background: 'rgb(255, 255, 255)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'rgb(255, 255, 255) rgb(255, 255, 255) rgb(237, 235, 233)',
            padding: '8px',
            minWidth: 200,
          }}>
            {searchPrompt}
          </div>
        </Callout>
      )}

      {/* Callout with candidates */}
      {isCalloutVisible && textFieldRef.current && candidates.length > 0 && (
        <Callout
          target={textFieldRef.current}
          isBeakVisible={false}
          directionalHint={DirectionalHint.bottomLeftEdge}
          onDismiss={() => setIsCalloutVisible(false)}
          setInitialFocus={false}
          styles={{
            calloutMain: {
              padding: 0,
              maxHeight: 300,
              overflowY: 'auto',
            },
          }}
        >
          <FocusZone>
            <div style={{ minWidth: 200 }}>
              {candidates.map((item, idx) => (
                <div
                  key={item[codeId] || item.code || idx}
                  onClick={() => handleSelect(item)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelect(item)}
                  tabIndex={0}
                  role="option"
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #edebe9',
                    backgroundColor: 'white',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f2f1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  {onRenderCandidate(item, idx)}
                </div>
              ))}
            </div>
          </FocusZone>
        </Callout>
      )}

      {/* Show "Other" option for free text entry */}
      {showOtherOption && isCalloutVisible && searchText.length > 0 && candidates.length === 0 && (
        <Callout
          target={textFieldRef.current}
          isBeakVisible={false}
          directionalHint={DirectionalHint.bottomLeftEdge}
          onDismiss={() => setIsCalloutVisible(false)}
          setInitialFocus={false}
        >
          <div
            onClick={() => handleSelect({ code: 'OTHER', display: searchText, system: codeSystem || '' })}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              minWidth: 200,
            }}
          >
            Use "{searchText}" as free text
          </div>
        </Callout>
      )}

      {/* Conditional children */}
      {showChildren && children}
    </LayoutItem>
  );
};

export default FindCode;
