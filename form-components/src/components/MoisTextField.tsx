/**
 * MOIS TextField Component
 * A styled text field that integrates with the MOIS form system
 */

import React from 'react';
import { TextField, Label, ITextFieldStyles } from '@fluentui/react';
import { useSection, useActiveData, useSourceData, useTheme } from '../context/MoisContext';
import { getAuthorshipLockInfo, registerAuthorshipFieldTarget } from '../authorship';

export interface MoisTextFieldProps {
  fieldId?: string;
  sourceId?: string;
  label?: string;
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  readOnly?: boolean;
  borderless?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  onChange?: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void;
  index?: number | string;
  layoutId?: string;
  [key: string]: any;
}

const sizeMap: Record<string, { minWidth: number | string; maxWidth?: number | string; flex: string }> = {
  tiny: { minWidth: 50, maxWidth: 80, flex: '1 1 0px' },
  small: { minWidth: 80, maxWidth: 160, flex: '2 2 0px' },
  medium: { minWidth: 160, maxWidth: 320, flex: '3 3 0px' },
  large: { minWidth: 320, maxWidth: 480, flex: '4 4 0px' },
  max: { minWidth: 480, flex: '5 5 0px' },
};

export const MoisTextField: React.FC<MoisTextFieldProps> = ({
  fieldId,
  sourceId,
  label,
  size = 'medium',
  value: propValue,
  defaultValue,
  placeholder,
  readOnly = false,
  borderless = false,
  disabled = false,
  multiline = false,
  rows = 3,
  required = false,
  onChange,
  index,
  layoutId,
  ...rest
}) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const sourceData = useSourceData();
  const theme = useTheme();
  React.useEffect(() => {
    const targetFieldId = fieldId || sourceId || layoutId;
    if (!targetFieldId) return;
    setActiveData((draft: any) => {
      registerAuthorshipFieldTarget(draft, targetFieldId, section.authorshipPolicy);
    });
  }, [fieldId, layoutId, section.authorshipPolicy, setActiveData, sourceId]);
  const authorshipLockInfo = section.authorshipPolicy?.enabled
    ? getAuthorshipLockInfo(activeData, { scope: 'field', fieldId: fieldId || sourceId || layoutId }, sourceData?.userProfile?.identity?.fullName)
    : { locked: false };
  const effectiveReadOnly = readOnly || !!authorshipLockInfo.locked;

  // Get value from props or activeData
  const value = propValue ?? (fieldId && section.activeSelector
    ? (section.activeSelector(activeData) as any)?.[fieldId]
    : fieldId ? (activeData as any).formData?.[fieldId] : undefined) ?? defaultValue ?? '';

  // Handle change
  const handleChange = (
    event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ) => {
    if (onChange) {
      onChange(event, newValue);
    }
  };

  const textFieldStyles: Partial<ITextFieldStyles> = {
    root: {
      width: '100%',
    },
    fieldGroup: borderless ? {
      border: 'none',
      selectors: {
        ':after': { border: 'none' },
      },
    } : undefined,
  };

  // Get size configuration
  const sizeConfig = sizeMap[size] || (typeof size === 'string' ? { minWidth: size, maxWidth: size, flex: '1' } : sizeMap.medium);

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'column',
    flex: sizeConfig.flex,
    minWidth: sizeConfig.minWidth,
    maxWidth: sizeConfig.maxWidth,
  };

  return (
    <div style={wrapperStyle}>
      <TextField
        label={label}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        readOnly={effectiveReadOnly}
        disabled={disabled}
        borderless={borderless}
        multiline={multiline}
        rows={multiline ? rows : undefined}
        required={required}
        styles={textFieldStyles}
        description={authorshipLockInfo.note}
        tabIndex={effectiveReadOnly ? -1 : 0}
        {...rest}
      />
    </div>
  );
};

export default MoisTextField;
