/**
 * TextArea Component
 * The TextArea control is used to display and edit text elements.
 */

import React, { useEffect, useState } from 'react';
import { TextField, Stack, Toggle, ITextFieldProps } from '@fluentui/react';
import { LayoutItem } from './LayoutItem';
import { useTheme, useSection, useSourceData } from '../context/MoisContext';
import { useActiveDataForForms } from '../hooks/form-state';
import { getAuthorshipLockInfo, registerAuthorshipFieldTarget } from '../authorship';
import {
  getSectionSourceTarget,
  readSectionActiveFieldValue,
  readSectionFieldStatus,
  writeSectionActiveFieldValue,
  writeSectionFieldError,
} from '../runtime/mois-contract';

export interface TextAreaProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Show border around entry field */
  borderless?: boolean;
  /** Set styles prop on FluentUI's TextField control */
  customStyles?: any;
  /** Initial value */
  defaultValue?: string;
  /** Indicate whether the field is disabled or not. */
  disabled?: boolean;
  /** Specify input field font size. Will be overwritten by textFieldProps */
  fieldFontSize?: string;
  /** Active field name. */
  fieldId?: string;
  /** Hidden fields are not shown at all */
  hidden?: boolean;
  /** Source and active field name. */
  id?: string;
  /** List index used to distinguish rows/columns in grid and flowsheet layouts */
  index?: number;
  /** Override section completion status */
  isComplete?: boolean;
  /** Label for this field. */
  label?: string;
  /** Additional field ids that should mirror this field's value. */
  linkedFieldIds?: string[];
  /** Label position relative to field contents. */
  labelPosition?: 'top' | 'left' | 'none';
  /** Override label properties */
  labelProps?: any;
  /** Identifier for selective layout. Defaults to fieldId if given or sourceId */
  layoutId?: string;
  /** Link to module in MOIS windows client. */
  moisModule?: string;
  /** Whether or not the text field is a multiline text area. */
  multiline?: boolean;
  /** Maximum number of characters allowed. */
  maxCharLimit?: number;
  /** Annotation shown near the control */
  note?: string;
  /** onChange callback for updating value (Overrides normal update processing) */
  onChange?: (ev: any, value: any) => void;
  /** function given a value returns an error message or undefined if valid */
  onValidate?: (value: string) => string | undefined;
  /** Placeholder string shown if no value has been entered. */
  placeholder?: string;
  /** Override field placement */
  placement?: string | number;
  /** A readOnly control is always view only. */
  readOnly?: boolean;
  /** Indicates that the value should be kept up to date with changes. */
  refresh?: boolean;
  /** Is this field required to have a value? */
  required?: boolean;
  /** Show a live character count when maxCharLimit is set. */
  showCharLimit?: boolean;
  /** For multiline text fields, specifies the initial number of rows shown. */
  rows?: number;
  /** Advanced: Override section settings */
  section?: any;
  /** Size indicator. */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | React.CSSProperties;
  /** Source field name. */
  sourceId?: string;
  /** custom tabIndex */
  tabIndex?: number;
  /** Override default props for TextField control. eg: textFieldProps={{ rows: 7 }} */
  textFieldProps?: ITextFieldProps;
  /** when given a onValidate function, does validation occur for each keystroke. Default is to validate on blur. */
  validateOnKeyStroke?: boolean;
  /** Value for this field */
  value?: string;
  /** Render just the input without wrapper divs (for composition) */
  inline?: boolean;
}

/**
 * TextArea - The TextArea control is used to display and edit text elements.
 */
export const TextArea: React.FC<TextAreaProps> = ({
  actions,
  borderless,
  customStyles,
  defaultValue,
  disabled,
  fieldFontSize,
  fieldId,
  hidden,
  id,
  index,
  inline,
  isComplete,
  label,
  linkedFieldIds,
  labelPosition,
  labelProps,
  layoutId,
  moisModule,
  multiline = false,
  maxCharLimit,
  note,
  onChange,
  onValidate,
  placeholder,
  placement,
  readOnly,
  refresh,
  required,
  showCharLimit,
  rows,
  section,
  size,
  sourceId,
  tabIndex,
  textFieldProps,
  validateOnKeyStroke,
  value,
}) => {
  const sectionContext = useSection(section);
  const [activeData, setActiveData] = useActiveDataForForms();
  const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? '');
  const sourceData = useSourceData();
  const effectiveMaxCharLimit =
    typeof maxCharLimit === 'number' && Number.isFinite(maxCharLimit) && maxCharLimit > 0
      ? Math.round(maxCharLimit)
      : undefined;
  const effectiveFieldId = fieldId || id || sourceId;
  const effectiveSourceId = sourceId || id || fieldId;
  const activeValue = effectiveFieldId
    ? readSectionActiveFieldValue(activeData, sectionContext, effectiveFieldId)
    : undefined;
  const persistedValue = typeof activeValue === 'string' ? activeValue : undefined;
  const sourceValue = (() => {
    if (!effectiveSourceId) return undefined;
    const sourceTarget = getSectionSourceTarget(sourceData, sectionContext);
    const value = sourceTarget?.[effectiveSourceId];
    return value !== undefined && value !== null ? String(value) : undefined;
  })();
  const statusEntry = effectiveFieldId
    ? readSectionFieldStatus(activeData, sectionContext, effectiveFieldId)
    : undefined;
  const errorMessage =
    statusEntry && typeof statusEntry === 'object' && typeof statusEntry.errorMessage === 'string'
      ? statusEntry.errorMessage
      : undefined;

  const displayValue = value !== undefined ? value : (persistedValue ?? sourceValue ?? internalValue);

  const handleChange = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    if (effectiveReadOnly) return;
    const rawValue = newValue ?? '';
    const val = effectiveMaxCharLimit ? rawValue.slice(0, effectiveMaxCharLimit) : rawValue;
    setInternalValue(val);

    if (effectiveFieldId) {
      setActiveData((draft: any) => {
        writeSectionActiveFieldValue(draft, sectionContext, effectiveFieldId, val, linkedFieldIds ?? []);
      });
    }

    if (onChange) {
      onChange(ev, val);
    }

    // Validate on keystroke if enabled
    if (onValidate && validateOnKeyStroke) {
      const error = onValidate(val);
      if (effectiveFieldId) {
        setActiveData((draft: any) => {
          writeSectionFieldError(draft, sectionContext, effectiveFieldId, error);
        });
      }
    }
  };

  const handleBlur = () => {
    // Validate on blur by default
    if (onValidate && !validateOnKeyStroke) {
      const error = onValidate(displayValue);
      if (effectiveFieldId) {
        setActiveData((draft: any) => {
          writeSectionFieldError(draft, sectionContext, effectiveFieldId, error);
        });
      }
    }
  };

  // Yellow highlight for required empty fields
  // Handle non-string values (e.g., numbers) by converting to string first
  const displayValueStr = displayValue != null ? String(displayValue) : '';
  const isEmpty = !displayValue || displayValueStr.trim() === '';
  const requiresHighlight = required && isEmpty;
  const description =
    showCharLimit && effectiveMaxCharLimit
      ? `${displayValueStr.length}/${effectiveMaxCharLimit}`
      : undefined;
  const theme = useTheme();

  // Determine effective label position based on section layout
  useEffect(() => {
    if (!effectiveFieldId) return;
    setActiveData((draft: any) => {
      registerAuthorshipFieldTarget(draft, effectiveFieldId, sectionContext.authorshipPolicy);
    });
  }, [effectiveFieldId, sectionContext.authorshipPolicy, setActiveData]);
  const authorshipLockInfo = sectionContext.authorshipPolicy?.enabled
    ? getAuthorshipLockInfo(activeData, { scope: 'field', fieldId: effectiveFieldId }, sourceData?.userProfile?.identity?.fullName)
    : { locked: false };
  const effectiveReadOnly = !!readOnly || !!authorshipLockInfo.locked;
  const effectiveLabelPosition = labelPosition ?? (
    sectionContext.layout === 'flex' ? 'top' :
    sectionContext.layout === 'linear' ? 'left' : 'top'
  );

  // Only show label inside Fluent component when labelPosition is "top"
  const fluentLabel = effectiveLabelPosition === 'top' ? label : undefined;

  // Get size styles from theme
  const getSizeStyles = (): React.CSSProperties => {
    if (typeof size === 'object') return size;
    const effectiveSizeKey = size ?? (multiline ? 'max' : 'medium');
    return theme.mois.sizes[effectiveSizeKey] ?? theme.mois.sizes.medium;
  };

  // Determine field background color
  const getFieldBackground = () => {
    if (requiresHighlight) return theme.mois.requiredBackground;
    if (effectiveReadOnly && !requiresHighlight) return 'transparent';
    return undefined;
  };

  const textFieldStyles = {
    root: getSizeStyles() as any,
    field: {
      backgroundColor: getFieldBackground(),
      ...(fieldFontSize ? { fontSize: fieldFontSize } : {}),
    },
    fieldGroup: {
      ...(requiresHighlight ? { backgroundColor: theme.mois.requiredBackground } : {}),
    },
    errorMessage: {
      paddingTop: 5,
      margin: 0,
    },
    ...customStyles,
  };

  // Determine size for LayoutItem - default to medium for single line, max for multiline
  const effectiveSize = size ?? (multiline ? 'max' : 'medium');

  // Only suppress LayoutItem's label when labelPosition is 'top' (TextField handles it)
  // For 'left' position, LayoutItem should render the label
  const shouldSuppressLayoutItemLabel = effectiveLabelPosition === 'top';

  // Inline mode: render TextField that fills its container
  if (inline) {
    return (
      <TextField
        id={fieldId || id}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        multiline={multiline}
        rows={multiline ? (rows ?? 3) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={effectiveReadOnly}
        borderless={borderless ?? effectiveReadOnly}
        tabIndex={effectiveReadOnly ? -1 : tabIndex}
        errorMessage={errorMessage}
        description={description}
        styles={{
          root: { width: '100%' },
          field: {
            backgroundColor: getFieldBackground(),
            ...(fieldFontSize ? { fontSize: fieldFontSize } : {}),
          },
          ...customStyles,
        }}
        {...textFieldProps}
      />
    );
  }

  return (
    <LayoutItem
      fieldId={fieldId}
      id={id}
      index={index}
      hidden={hidden}
      label={label}
      labelPosition={labelPosition}
      labelProps={labelProps}
      layoutId={layoutId}
      moisModule={moisModule}
      noTopLabel={shouldSuppressLayoutItemLabel}
      note={note}
      placement={placement}
      readOnly={effectiveReadOnly}
      required={required}
      section={section}
      size={effectiveSize}
      isEmpty={isEmpty}
      isComplete={isComplete}
      disabled={disabled}
      actions={actions}
    >
      <TextField
        id={fieldId || id}
        label={fluentLabel}
        required={required}
        disabled={disabled}
        readOnly={effectiveReadOnly}
        value={displayValue}
        // Note: We don't pass defaultValue because we always provide a controlled value
        // via displayValue. The defaultValue is already used to initialize internalValue.
        onChange={handleChange}
        onBlur={handleBlur}
        multiline={multiline}
        rows={multiline ? (rows ?? 3) : undefined}
        placeholder={placeholder}
        borderless={borderless ?? effectiveReadOnly}
        tabIndex={effectiveReadOnly ? -1 : tabIndex}
        errorMessage={errorMessage}
        description={description}
        styles={textFieldStyles}
        {...textFieldProps}
      />
    </LayoutItem>
  );
};

/**
 * TextAreaDemo1 - Typical use (single line)
 */
export const TextAreaDemo1: React.FC = () => {
  return (
    <TextArea
      fieldId="note"
      label="Additional Note"
    />
  );
};

/**
 * TextAreaDemo2 - Multiline typical use
 */
export const TextAreaDemo2: React.FC = () => {
  return (
    <TextArea
      fieldId="comments"
      label="Patient Comments"
      multiline
      placeholder="Please let us know of any issues with your appointment"
    />
  );
};

/**
 * TextAreaDemo3 - Lock/Readonly toggle
 */
export const TextAreaDemo3: React.FC = () => {
  const [locked, setLocked] = useState(true);

  return (
    <Stack>
      <Toggle
        label="Lock"
        checked={locked}
        onText="Readonly"
        offText="Writable"
        onChange={(_, checked) => setLocked(!!checked)}
      />
      <TextArea
        fieldId="progress"
        label="Progress notes"
        multiline
        required
        readOnly={locked}
        borderless={locked}
        placeholder="Unlock and type some text here to see completed appearance."
      />
    </Stack>
  );
};

/**
 * TextAreaDemo4 - Props passthrough with prefix
 */
export const TextAreaDemo4: React.FC = () => {
  return (
    <TextArea
      fieldId="doctorComments"
      multiline
      required
      labelPosition="none"
      placeholder=""
      textFieldProps={{
        prefix: "Dr. Smith's comments:",
        resizable: false,
      }}
    />
  );
};

/**
 * TextAreaDemo5 - Validation enabled
 */
export const TextAreaDemo5: React.FC = () => {
  const validateNumber = (value: string): string | undefined => {
    if (value && isNaN(Number(value))) {
      return 'Please enter a valid number';
    }
    return undefined;
  };

  return (
    <TextArea
      fieldId="numberField"
      placeholder="Enter a number"
      onValidate={validateNumber}
    />
  );
};

/**
 * TextAreaDemo6 - defaultValue set
 */
export const TextAreaDemo6: React.FC = () => {
  return (
    <TextArea
      fieldId="defaultField"
      defaultValue="Defaultwsdsd"
    />
  );
};

/**
 * TextAreaDemo7 - value parameter set (controlled)
 */
export const TextAreaDemo7: React.FC = () => {
  const [value, setValue] = useState('A string');

  return (
    <TextArea
      fieldId="controlledField"
      value={value}
      onChange={(_, newValue) => setValue(newValue)}
    />
  );
};

export default TextArea;
