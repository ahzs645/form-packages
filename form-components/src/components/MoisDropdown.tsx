/**
 * MOIS Dropdown/Select Component
 * A styled dropdown that integrates with the MOIS form system
 */

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { Dropdown, IDropdownOption, IDropdownStyles } from '@fluentui/react';
import { useSection, useActiveData, useCodeList } from '../context/MoisContext';

export interface MoisDropdownProps {
  fieldId?: string;
  sourceId?: string;
  label?: string;
  codeSystem?: string;
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  required?: boolean;
  onChange?: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
  index?: number | string;
  layoutId?: string;
  [key: string]: any;
}

// Define size map outside component to maintain stable reference
const sizeMap: Record<string, { minWidth: number | string; maxWidth?: number | string; flex: string }> = {
  tiny: { minWidth: 50, maxWidth: 80, flex: '1 1 0px' },
  small: { minWidth: 80, maxWidth: 160, flex: '2 2 0px' },
  medium: { minWidth: 160, maxWidth: 320, flex: '3 3 0px' },
  large: { minWidth: 320, maxWidth: 480, flex: '4 4 0px' },
  max: { minWidth: 480, flex: '5 5 0px' },
};

// Static dropdown styles to avoid recreating on each render
const dropdownStyles: Partial<IDropdownStyles> = {
  root: { width: '100%' },
};

// Empty options array for when no codeSystem is provided
const emptyOptions: IDropdownOption[] = [];

export const MoisDropdown: React.FC<MoisDropdownProps> = ({
  fieldId,
  sourceId,
  label,
  codeSystem,
  size = 'small',
  value: propValue,
  defaultValue,
  placeholder = 'Please select',
  readOnly = false,
  disabled = false,
  required = false,
  onChange,
  index,
  layoutId,
  ...rest
}) => {
  const section = useSection();
  const [activeData] = useActiveData();
  const codeList = useCodeList(codeSystem || '');

  // Get value from props or activeData
  const value = propValue ?? (fieldId && section.activeSelector
    ? (section.activeSelector(activeData) as any)?.[fieldId]
    : fieldId ? (activeData as any).formData?.[fieldId] : undefined) ?? defaultValue ?? '';

  // Memoize options to prevent recreating array on every render
  const options: IDropdownOption[] = useMemo(() => {
    if (rest.options) {
      return rest.options;
    }
    if (codeSystem && codeList.length > 0) {
      return codeList.map(item => ({
        key: item.code,
        text: item.display,
      }));
    }
    return emptyOptions;
  }, [rest.options, codeSystem, codeList]);

  // Use ref to hold the latest onChange without causing re-renders
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Stable handleChange that doesn't depend on onChange prop
  const handleChange = useCallback((
    event: React.FormEvent<HTMLDivElement>,
    option?: IDropdownOption
  ) => {
    if (onChangeRef.current) {
      onChangeRef.current(event, option);
    }
  }, []);

  // Memoize size configuration
  const sizeConfig = useMemo(() => {
    return sizeMap[size] || (typeof size === 'string' ? { minWidth: size, maxWidth: size, flex: '1' } : sizeMap.small);
  }, [size]);

  // Memoize wrapper style
  const wrapperStyle: React.CSSProperties = useMemo(() => ({
    display: 'flex',
    flexFlow: 'column',
    flex: sizeConfig.flex,
    minWidth: sizeConfig.minWidth,
    maxWidth: sizeConfig.maxWidth,
    width: sizeConfig.maxWidth,
  }), [sizeConfig]);

  return (
    <div style={wrapperStyle}>
      <Dropdown
        label={label}
        selectedKey={value || undefined}
        options={options}
        placeholder={placeholder}
        disabled={disabled || readOnly}
        required={required}
        onChange={handleChange}
        styles={dropdownStyles}
        {...rest}
      />
    </div>
  );
};

export default MoisDropdown;
