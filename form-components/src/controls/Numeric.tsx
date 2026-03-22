/**
 * Numeric Component
 * Numeric value control for 'Number' type fields
 */

import React, { useState, useCallback, useMemo } from 'react';
import { TextField, SpinButton, ISpinButtonProps, ITextFieldProps } from '@fluentui/react';
import { LayoutItem } from './LayoutItem';
import { useTheme, useSourceData, useSection } from '../context/MoisContext';
import { useActiveDataForForms } from '../hooks/form-state';
import { getAuthorshipLockInfo, registerAuthorshipFieldTarget } from '../authorship';

export interface NumericProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Add button controls to Numeric (SpinButton) */
  buttonControls?: boolean;
  /** Default value */
  defaultValue?: number | string;
  /** Indicate whether the field is disabled or not */
  disabled?: boolean;
  /** Active field name */
  fieldId?: string;
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
  /** Additional field ids that should mirror this field's value. */
  linkedFieldIds?: string[];
  /** Label position relative to field contents */
  labelPosition?: 'top' | 'left' | 'none';
  /** Identifier for selective layout */
  layoutId?: string;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** Annotation shown near the control */
  note?: string;
  /** Custom validation function */
  onValidate?: (value: string) => string;
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
  /** Advanced: Override section settings */
  section?: any;
  /** Size indicator */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | React.CSSProperties;
  /** Source field name */
  sourceId?: string;
  /** Override default props for SpinButton control */
  spinButtonProps?: Partial<ISpinButtonProps>;
  /** Override default props for TextField control when not using SpinButton mode */
  textFieldProps?: ITextFieldProps;
  /** Store value as number instead of string */
  storeAsNumber?: boolean;
  /** Type of value to validate */
  typeNumber?: 'number' | 'decimal' | 'year';
  /** Current value */
  value?: number | string;
  /** Change handler */
  onChange?: (value: number | string | undefined) => void;
  /** Style override */
  style?: React.CSSProperties;
  /** Render just the input without wrapper divs (for composition) */
  inline?: boolean;
}

/**
 * Numeric - Numeric value control
 *
 * A control for entering and validating numeric values.
 * Supports integer, decimal, and year validation.
 * Can optionally use SpinButton controls for increment/decrement.
 */
export const Numeric: React.FC<NumericProps> = ({
  actions,
  buttonControls = false,
  defaultValue,
  disabled,
  fieldId,
  hidden,
  id,
  index,
  inline,
  isComplete,
  label,
  linkedFieldIds,
  labelPosition,
  layoutId,
  moisModule,
  note,
  onValidate,
  placeholder,
  placement,
  readOnly,
  required,
  section,
  size = 'small',
  sourceId,
  spinButtonProps,
  textFieldProps,
  storeAsNumber,
  typeNumber = 'number',
  value,
  onChange,
  style,
}) => {
  const theme = useTheme();
  const sourceData = useSourceData();
  const sectionContext = useSection();
  const [activeData, setActiveData] = useActiveDataForForms();
  React.useEffect(() => {
    const targetFieldId = sourceId || id || fieldId;
    if (!targetFieldId) return;
    setActiveData((draft: any) => {
      registerAuthorshipFieldTarget(draft, targetFieldId, sectionContext.authorshipPolicy);
    });
  }, [fieldId, id, sectionContext.authorshipPolicy, setActiveData, sourceId]);
  const authorshipLockInfo = sectionContext.authorshipPolicy?.enabled
    ? getAuthorshipLockInfo(activeData, { scope: 'field', fieldId: sourceId || id || fieldId }, sourceData?.userProfile?.identity?.fullName)
    : { locked: false };
  const effectiveReadOnly = !!readOnly || !!authorshipLockInfo.locked;

  // Get effective sourceId (from explicit prop, id prop, or fieldId)
  const effectiveSourceId = sourceId || id || fieldId;
  const activeValue = effectiveSourceId ? activeData?.field?.data?.[effectiveSourceId] : undefined;

  // Get initial value from source data if sourceId is provided
  const sourceValue = useMemo(() => {
    if (!effectiveSourceId) return undefined;

    // Use section's sourceSelector if available
    const sourceSelector = sectionContext?.sourceSelector || ((sd: any) => sd?.patient);
    const sourceObj = sourceSelector(sourceData);

    if (sourceObj && effectiveSourceId in sourceObj) {
      const val = sourceObj[effectiveSourceId];
      return val !== undefined && val !== null ? val : undefined;
    }
    return undefined;
  }, [effectiveSourceId, sourceData, sectionContext]);

  // Determine initial value: value prop > sourceValue > defaultValue > ''
  const initialValue = useMemo(() => {
    if (value !== undefined) return String(value);
    if (activeValue !== undefined && activeValue !== null) return String(activeValue);
    if (sourceValue !== undefined) return String(sourceValue);
    if (defaultValue !== undefined) return String(defaultValue);
    return '';
  }, [value, activeValue, sourceValue, defaultValue]);

  const [localValue, setLocalValue] = useState<string>(initialValue);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const displayValue = value !== undefined
    ? String(value)
    : activeValue !== undefined && activeValue !== null
      ? String(activeValue)
      : (sourceValue !== undefined && localValue === '' ? String(sourceValue) : localValue);

  const updateActiveValue = useCallback((rawValue: string) => {
    if (!effectiveSourceId) return;
    if (effectiveReadOnly) return;
    setActiveData((draft: any) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] };
      if (!draft.field.data) draft.field.data = {};
      if (!rawValue) {
        draft.field.data[effectiveSourceId] = null;
        (linkedFieldIds ?? []).forEach((linkedFieldId) => {
          if (!linkedFieldId || linkedFieldId === effectiveSourceId) return;
          draft.field.data[linkedFieldId] = null;
        });
        return;
      }
      const nextValue = storeAsNumber
        ? (typeNumber === 'decimal' ? parseFloat(rawValue) : parseInt(rawValue, 10))
        : rawValue;
      draft.field.data[effectiveSourceId] = nextValue;
      (linkedFieldIds ?? []).forEach((linkedFieldId) => {
        if (!linkedFieldId || linkedFieldId === effectiveSourceId) return;
        draft.field.data[linkedFieldId] = nextValue;
      });
    });
  }, [effectiveSourceId, linkedFieldIds, setActiveData, storeAsNumber, typeNumber, effectiveReadOnly]);

  // Get size styles from theme
  const getSizeStyles = (): React.CSSProperties => {
    if (typeof size === 'object') return size;
    return theme.mois.sizes[size] ?? theme.mois.sizes.small;
  };

  // Validation function
  const validate = useCallback((val: string): string => {
    if (onValidate) {
      return onValidate(val);
    }

    if (!val) return '';

    switch (typeNumber) {
      case 'number':
        if (!/^[0-9]*$/.test(val.trim())) {
          return 'Not a whole number';
        }
        break;
      case 'decimal':
        if (!/^(\d+)?([.]?\d*)?$/.test(val.trim())) {
          return 'Not a decimal number';
        }
        break;
      case 'year':
        // Original regex: /^(19|20)[0-9][0-9]$/
        if (!/^(19|20)[0-9][0-9]$/.test(val.trim())) {
          return 'Not a year';
        }
        break;
    }
    return '';
  }, [typeNumber, onValidate]);

  const handleChange = useCallback((_: any, newValue?: string) => {
    const val = newValue || '';
    setLocalValue(val);

    const error = validate(val);
    setErrorMessage(error);

    if (!error) {
      updateActiveValue(val);
    }

    if (!error && onChange) {
      if (storeAsNumber && val) {
        onChange(typeNumber === 'decimal' ? parseFloat(val) : parseInt(val, 10));
      } else {
        onChange(val || undefined);
      }
    }
  }, [validate, onChange, storeAsNumber, typeNumber]);

  const handleSpinChange = useCallback((_: any, newValue?: string) => {
    const val = newValue || '';
    setLocalValue(val);
    updateActiveValue(val);

    if (onChange) {
      if (storeAsNumber && val) {
        onChange(typeNumber === 'decimal' ? parseFloat(val) : parseInt(val, 10));
      } else {
        onChange(val || undefined);
      }
    }
  }, [onChange, storeAsNumber, typeNumber, updateActiveValue]);

  const isEmpty = !displayValue || displayValue.trim() === '';

  const fieldStyles = {
    root: getSizeStyles() as any,
  };

  // Inline mode: render just the input without LayoutItem wrapper
  if (inline) {
    if (buttonControls && !effectiveReadOnly) {
      const defaultSpinProps: Partial<ISpinButtonProps> = {
        min: typeNumber === 'year' ? 1900 : undefined,
        max: typeNumber === 'year' ? 2100 : undefined,
        step: typeNumber === 'decimal' ? 0.1 : 1,
      };
      return (
        <SpinButton
          value={displayValue}
          disabled={disabled}
          onChange={handleSpinChange}
          {...defaultSpinProps}
          {...spinButtonProps}
          styles={{
            root: { width: '100%' },
            ...spinButtonProps?.styles,
          }}
        />
      );
    }
    return (
      <TextField
        id={fieldId}
        value={displayValue}
        onChange={handleChange}
        disabled={disabled}
        readOnly={effectiveReadOnly}
        placeholder={placeholder}
        errorMessage={errorMessage}
        borderless={effectiveReadOnly}
        tabIndex={effectiveReadOnly ? -1 : undefined}
        styles={{
          root: { width: '100%' },
          field: effectiveReadOnly ? { backgroundColor: 'transparent' } : undefined,
        }}
        {...textFieldProps}
      />
    );
  }

  // SpinButton mode
  if (buttonControls && !effectiveReadOnly) {
    const defaultSpinProps: Partial<ISpinButtonProps> = {
      min: typeNumber === 'year' ? 1900 : undefined,
      max: typeNumber === 'year' ? 2100 : undefined,
      step: typeNumber === 'decimal' ? 0.1 : 1,
    };

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
        readOnly={effectiveReadOnly}
        required={required}
        section={section}
        size={size}
        layoutStyle={typeof style === 'object' ? style : undefined}
      >
        <SpinButton
          value={displayValue}
          disabled={disabled}
          onChange={handleSpinChange}
          {...defaultSpinProps}
          {...spinButtonProps}
          styles={{
            ...fieldStyles,
            ...spinButtonProps?.styles,
          }}
        />
      </LayoutItem>
    );
  }

  // TextField mode (default)
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
      readOnly={effectiveReadOnly}
      required={required}
      section={section}
      size={size}
      layoutStyle={typeof style === 'object' ? style : undefined}
    >
      <TextField
        id={fieldId}
        value={displayValue}
        onChange={handleChange}
        disabled={disabled}
        readOnly={effectiveReadOnly}
        placeholder={placeholder}
        errorMessage={errorMessage}
        borderless={effectiveReadOnly}
        tabIndex={effectiveReadOnly ? -1 : undefined}
        styles={{
          ...fieldStyles,
          field: effectiveReadOnly ? { backgroundColor: 'transparent' } : undefined,
        }}
        {...textFieldProps}
      />
    </LayoutItem>
  );
};

export default Numeric;
