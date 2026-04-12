/**
 * TimeSelect Component
 * Time input control for hours and minutes - EXPERIMENTAL
 */

import React, { useState, useCallback, useEffect } from 'react';
import { MaskedTextField, Label, ITextFieldProps } from '@fluentui/react';
import { LayoutItem } from './LayoutItem';
import { useTheme, useSection } from '../context/MoisContext';
import { useActiveDataForForms } from '../hooks/form-state';
import {
  readSectionActiveFieldValue,
  readSectionFieldStatus,
  writeSectionActiveFieldValue,
  writeSectionFieldError,
} from '../runtime/mois-contract';

export interface TimeSelectProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Show border around entry field */
  borderless?: boolean;
  /** Default value for the time field */
  defaultValue?: string;
  /** Indicate whether the field is disabled or not */
  disabled?: boolean;
  /** Active field name */
  fieldId?: string;
  /** Hidden fields are not shown at all */
  hidden?: boolean;
  /** Source and active field name */
  id?: string;
  /** List index used to distinguish rows/columns in grid and flowsheet layouts */
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
  /** onChange callback for updating value */
  onChange?: (ev: any, value: string) => void;
  /** Placeholder text */
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
  /** Override default props for TextField control */
  textFieldProps?: ITextFieldProps;
  /** Validate on keystroke instead of blur */
  validateOnKeyStroke?: boolean;
  /** Value for this field */
  value?: string;
  /** Render just the input without wrapper divs (for composition) */
  inline?: boolean;
}

/**
 * TimeSelect - Time input control for hours and minutes
 *
 * The TimeSelect control is used to display and edit time elements.
 * *EXPERIMENTAL
 */
export const TimeSelect: React.FC<TimeSelectProps> = ({
  actions,
  borderless,
  defaultValue = '',
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
  onChange,
  placeholder = 'HH:mm',
  placement,
  readOnly,
  refresh,
  required,
  section,
  size = 'small',
  sourceId,
  textFieldProps,
  validateOnKeyStroke,
  value: controlledValue,
}) => {
  const sectionContext = useSection(section);
  const [activeData, setActiveData] = useActiveDataForForms();
  const effectiveFieldId = sourceId || fieldId || id;
  const activeValue = effectiveFieldId
    ? readSectionActiveFieldValue(activeData, sectionContext, effectiveFieldId)
    : undefined;
  const resolvedValue = controlledValue !== undefined
    ? controlledValue
    : (typeof activeValue === 'string' ? activeValue : defaultValue);
  const [internalValue, setInternalValue] = useState(resolvedValue);
  const statusEntry = effectiveFieldId
    ? readSectionFieldStatus(activeData, sectionContext, effectiveFieldId)
    : undefined;
  const error =
    statusEntry && typeof statusEntry === 'object' && typeof statusEntry.errorMessage === 'string'
      ? statusEntry.errorMessage
      : undefined;
  const theme = useTheme();

  useEffect(() => {
    if (controlledValue === undefined) {
      setInternalValue(resolvedValue);
    }
  }, [controlledValue, resolvedValue]);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  // Get size styles from theme (applied directly to MaskedTextField)
  const getSizeStyles = (): React.CSSProperties => {
    if (typeof size === 'object') return size;
    return theme.mois.sizes[size] ?? theme.mois.sizes.small;
  };

  // Validate time format (HH:mm)
  const validateTime = useCallback((timeStr: string): string | undefined => {
    if (!timeStr) return undefined;

    // Allow partial input while typing
    if (timeStr.length < 5) return undefined;

    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(timeStr)) {
      return 'Invalid time format (HH:mm)';
    }
    return undefined;
  }, []);

  const handleChange = useCallback((
    event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ) => {
    const val = newValue || '';

    if (controlledValue === undefined) {
      setInternalValue(val);
    }

    if (validateOnKeyStroke) {
      if (effectiveFieldId) {
        setActiveData((draft: any) => {
          writeSectionFieldError(draft, sectionContext, effectiveFieldId, validateTime(val));
        });
      }
    }

    if (effectiveFieldId) {
      setActiveData((draft: any) => {
        writeSectionActiveFieldValue(draft, sectionContext, effectiveFieldId, val || null, linkedFieldIds ?? []);
      });
    }

    onChange?.(event, val);
  }, [controlledValue, effectiveFieldId, linkedFieldIds, onChange, sectionContext, setActiveData, validateOnKeyStroke, validateTime]);

  const handleBlur = useCallback(() => {
    if (!validateOnKeyStroke) {
      if (effectiveFieldId) {
        setActiveData((draft: any) => {
          writeSectionFieldError(draft, sectionContext, effectiveFieldId, validateTime(value));
        });
      }
    }
  }, [effectiveFieldId, sectionContext, setActiveData, validateOnKeyStroke, validateTime, value]);

  if (hidden) {
    return null;
  }

  // The masked text field element - used in both inline and wrapped modes
  const maskedTextFieldElement = (
    <MaskedTextField
      mask="**:**"
      maskChar="0"
      maskFormat={{ '*': /[0-9]/ }}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled || readOnly}
      readOnly={readOnly}
      borderless={borderless || readOnly}
      errorMessage={error}
      required={required}
      tabIndex={readOnly ? -1 : undefined}
      styles={{ root: getSizeStyles() as any }}
      onGetErrorMessage={(val) => {
        return /^(2[0-3]|[01]?[0-9]):([0-5]?[0-9])$/.test(val.trim())
          ? undefined
          : 'Not a valid hour';
      }}
      validateOnFocusOut={!validateOnKeyStroke}
      {...textFieldProps}
    />
  );

  // Inline mode: just render the MaskedTextField without wrappers
  if (inline) {
    return maskedTextFieldElement;
  }

  // Use LayoutItem for consistent layout handling
  return (
    <LayoutItem
      actions={actions}
      disabled={disabled}
      fieldId={fieldId}
      hidden={hidden}
      id={id}
      index={index}
      isComplete={isComplete}
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
    >
      {maskedTextFieldElement}
    </LayoutItem>
  );
};

// Demo component
export const TimeSelectDemo1: React.FC = () => {
  return (
    <TimeSelect
      label="this is for hours and minutes"
      defaultValue="02:34"
    />
  );
};

export default TimeSelect;
