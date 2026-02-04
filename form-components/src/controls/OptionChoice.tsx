/**
 * OptionChoice Component
 * Single boolean choice control. By default, the selection is stored as a
 * "MOIS-YESNO" coding.
 */

import React, { useState } from 'react';
import {
  Checkbox,
  Toggle,
  ChoiceGroup,
  IChoiceGroupOption,
} from '@fluentui/react';
import { LayoutItem } from './LayoutItem';
import { useActiveData } from '../context/MoisContext';

export interface OptionChoiceProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Conditional controls depending on "On choice" */
  children?: React.ReactNode;
  /** Override props for Fluent control */
  controlProps?: any;
  /** Override props for Fluent control styles */
  controlStyles?: any;
  /** Initial value. This is converted to a boolean using onGetValue(). */
  defaultValue?: any;
  /** Indicate whether the field is disabled or not. */
  disabled?: boolean;
  /** Selects appearance: "checkmark" | "toggle" | "radio" */
  displayStyle?: 'checkmark' | 'toggle' | 'radio';
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
  /** Label position relative to field contents. */
  labelPosition?: 'top' | 'left' | 'none';
  /** Identifier for selective layout. Defaults to fieldId if given or sourceId */
  layoutId?: string;
  /** Link to module in MOIS windows client. */
  moisModule?: string;
  /** Use vertical layout for options (stacked). When false, uses 2-column grid. */
  multiline?: boolean;
  /** Checkmark label for false option. Code: "N" */
  noText?: string;
  /** Annotation shown near the control */
  note?: string;
  /** onChange callback for updating value (Overrides normal update processing) */
  onChange?: (ev: any, value: any) => void;
  /** Callback to convert a code into a boolean */
  onGetValue?: (field: any) => boolean;
  /** Callback to convert stored value to a code. */
  onSetValue?: (setting: boolean) => any;
  /** Custom options for radio display. Overrides yesText/noText when provided. */
  options?: IChoiceGroupOption[];
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
  /** Advanced: Override section settings */
  section?: any;
  /** Currently selected key when using custom options */
  selectedKey?: string;
  /** Size indicator. */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | React.CSSProperties;
  /** Source field name. */
  sourceId?: string;
  /** Alternative to storing the selection in active data. */
  value?: any;
  /** Checkmark label for true option. Code: "Y" */
  yesText?: string;
  /** Render just the input without wrapper divs (for composition) */
  inline?: boolean;
}

/**
 * OptionChoice - Single choice control (boolean or custom options)
 */
export const OptionChoice: React.FC<OptionChoiceProps> = ({
  actions,
  controlProps,
  controlStyles,
  label,
  displayStyle = 'checkmark',
  yesText = 'Yes',
  noText = 'No',
  placeholder = 'Please choose',
  disabled = false,
  fieldId,
  hidden = false,
  id,
  index,
  inline,
  isComplete,
  labelPosition,
  layoutId,
  moisModule,
  multiline = true,
  note,
  options: customOptions,
  placement,
  readOnly,
  required = false,
  section,
  selectedKey: controlledSelectedKey,
  size,
  value,
  defaultValue,
  onChange,
  children,
}) => {
  // Use active data for shared state when fieldId is provided
  const [activeData, setActiveData] = useActiveData();
  const effectiveFieldId = fieldId || id;

  // Determine if we're using custom options mode
  const useCustomOptions = customOptions && customOptions.length > 0;

  // Get value from active data if fieldId is provided
  const getValueFromActiveData = (): boolean | null => {
    if (effectiveFieldId && activeData?.field?.data) {
      const storedValue = (activeData.field.data as any)[effectiveFieldId];
      if (storedValue === null || storedValue === undefined) return null;
      if (typeof storedValue === 'boolean') return storedValue;
      if (storedValue?.code === 'Y') return true;
      if (storedValue?.code === 'N') return false;
      return null;
    }
    return null;
  };

  // Determine initial checked state from value or defaultValue (for boolean mode)
  const getInitialState = (): boolean | null => {
    // First check active data
    const activeValue = getValueFromActiveData();
    if (activeValue !== null) return activeValue;

    const val = value !== undefined ? value : defaultValue;
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val;
    if (val?.code === 'Y') return true;
    if (val?.code === 'N') return false;
    return null;
  };

  // For custom options, get initial selected key
  const getInitialSelectedKey = (): string | undefined => {
    if (controlledSelectedKey !== undefined) return controlledSelectedKey;

    // Check active data first
    if (effectiveFieldId && activeData?.field?.data) {
      const storedValue = (activeData.field.data as any)[effectiveFieldId];
      if (storedValue !== null && storedValue !== undefined) {
        if (typeof storedValue === 'string') return storedValue;
        if (storedValue?.code) return storedValue.code;
      }
    }

    const val = value !== undefined ? value : defaultValue;
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') return val;
    if (val?.code) return val.code;
    return undefined;
  };

  // Get checked state - prefer active data, fall back to local state
  const activeChecked = getValueFromActiveData();
  const [localChecked, setLocalChecked] = useState<boolean | null>(getInitialState());
  const checked = effectiveFieldId ? (activeChecked ?? localChecked) : localChecked;

  const [internalSelectedKey, setInternalSelectedKey] = useState<string | undefined>(getInitialSelectedKey());

  // Use controlled or internal selected key
  const selectedKey = controlledSelectedKey !== undefined ? controlledSelectedKey : internalSelectedKey;

  const isEmpty = useCustomOptions ? selectedKey === undefined : checked === null;

  // Helper to update active data
  const updateActiveData = (newValue: boolean | null) => {
    if (effectiveFieldId) {
      setActiveData((draft: any) => {
        if (!draft.field) draft.field = { data: {}, status: {}, history: [] };
        if (!draft.field.data) draft.field.data = {};
        // Store as MOIS-YESNO coding
        if (newValue === null) {
          draft.field.data[effectiveFieldId] = null;
        } else {
          draft.field.data[effectiveFieldId] = {
            code: newValue ? 'Y' : 'N',
            display: newValue ? yesText : noText,
            system: 'MOIS-YESNO',
          };
        }
      });
    }
  };

  const handleCheckboxChange = (ev?: React.FormEvent<HTMLElement | HTMLInputElement>) => {
    // Cycle through: null -> true -> false -> null
    let newValue: boolean | null;
    if (checked === null) {
      newValue = true;
    } else if (checked === true) {
      newValue = false;
    } else {
      newValue = null;
    }
    setLocalChecked(newValue);
    updateActiveData(newValue);
    if (onChange) {
      onChange(ev, newValue);
    }
  };

  const handleToggleChange = (ev: React.MouseEvent<HTMLElement>, isChecked?: boolean) => {
    const newValue = isChecked ?? false;
    setLocalChecked(newValue);
    updateActiveData(newValue);
    if (onChange) {
      onChange(ev, newValue);
    }
  };

  const handleRadioChange = (ev?: React.FormEvent<HTMLElement | HTMLInputElement>, option?: IChoiceGroupOption) => {
    if (useCustomOptions) {
      // Custom options mode - return the selected option
      setInternalSelectedKey(option?.key);
      if (onChange) {
        onChange(ev, option);
      }
    } else {
      // Boolean mode - convert to boolean
      const newValue = option?.key === 'Y';
      setLocalChecked(newValue);
      updateActiveData(newValue);
      if (onChange) {
        onChange(ev, newValue);
      }
    }
  };

  const getCheckboxLabel = () => {
    if (checked === null) return placeholder;
    return checked ? yesText : noText;
  };

  const getToggleLabel = () => {
    if (checked === null) return placeholder;
    return checked ? yesText : noText;
  };

  // Use custom options or default Yes/No
  const radioOptions: IChoiceGroupOption[] = useCustomOptions
    ? customOptions
    : [
        { key: 'Y', text: yesText },
        { key: 'N', text: noText },
      ];

  const getSelectedRadioKey = (): string | undefined => {
    if (useCustomOptions) {
      return selectedKey;
    }
    if (checked === true) return 'Y';
    if (checked === false) return 'N';
    return undefined;
  };

  // Flex container styles based on multiline prop
  const getFlexContainerStyles = () => {
    if (multiline) {
      // Vertical stacked layout
      return {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
        alignItems: 'flex-start',
        width: '100%',
      };
    } else {
      // 2-column grid layout with column-first filling
      const numRows = Math.ceil(radioOptions.length / 2);
      return {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridAutoFlow: 'column' as const,
        gridTemplateRows: `repeat(${numRows}, auto)`,
        gap: '8px 40px',
        alignItems: 'flex-start',
        width: '100%',
      };
    }
  };

  const renderControl = () => {
    switch (displayStyle) {
      case 'toggle':
        return (
          <Toggle
            key={`toggle-${effectiveFieldId}-${checked}`}
            checked={checked ?? false}
            onChange={handleToggleChange}
            disabled={disabled}
            onText={yesText}
            offText={noText}
            label={getToggleLabel()}
            inlineLabel
          />
        );
      case 'radio':
        const radioKey = getSelectedRadioKey();
        return (
          <div style={{ width: '100%' }}>
            <ChoiceGroup
              key={`radio-${effectiveFieldId}-${radioKey}`}
              options={radioOptions}
              selectedKey={radioKey}
              onChange={handleRadioChange}
              disabled={disabled}
              required={required}
              styles={{
                flexContainer: getFlexContainerStyles(),
                ...controlStyles,
              }}
              {...controlProps}
            />
          </div>
        );
      case 'checkmark':
      default:
        const checkboxStyles = (styleProps: any) => {
          const isChecked = Boolean(styleProps?.checked || styleProps?.indeterminate);
          const defaultStyles = isChecked ? {} : { checkbox: { background: 'white' } };
          if (!controlStyles) return defaultStyles;
          const resolved = typeof controlStyles === 'function' ? controlStyles(styleProps) : controlStyles;
          return {
            ...defaultStyles,
            ...resolved,
            checkbox: {
              ...(defaultStyles as any).checkbox,
              ...(resolved as any)?.checkbox,
            },
          };
        };
        return (
          <Checkbox
            {...controlProps}
            key={`checkbox-${effectiveFieldId}-${checked}`}
            checked={checked === true}
            indeterminate={checked === null}
            onChange={handleCheckboxChange}
            disabled={disabled}
            label={getCheckboxLabel()}
            styles={checkboxStyles}
          />
        );
    }
  };

  // Inline mode: render just the control without LayoutItem wrapper
  if (inline) {
    return (
      <div style={{ width: '100%' }}>
        {renderControl()}
      </div>
    );
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
      note={note}
      placement={placement}
      readOnly={readOnly}
      required={required}
      section={section}
      size={size}
    >
      {renderControl()}
      {children}
    </LayoutItem>
  );
};

/**
 * OptionChoiceDemo1 - Typical use with checkbox - starts with "Please choose"
 */
export const OptionChoiceDemo1: React.FC = () => {
  return (
    <OptionChoice
      label="Show Additional Note?"
      displayStyle="checkmark"
    />
  );
};

/**
 * OptionChoiceDemo2 - Appearance variations (checkmark, toggle, radio)
 */
export const OptionChoiceDemo2: React.FC = () => {
  return (
    <>
      <OptionChoice
        label="Check mark"
        displayStyle="checkmark"
      />
      <OptionChoice
        label="Toggle control"
        displayStyle="toggle"
      />
      <OptionChoice
        label="Radio button (stacked)"
        displayStyle="radio"
        multiline={true}
      />
      <OptionChoice
        label="Radio button (grid)"
        displayStyle="radio"
        multiline={false}
      />
    </>
  );
};

/**
 * OptionChoiceDemo3 - Custom labels (On/Off instead of Yes/No)
 */
export const OptionChoiceDemo3: React.FC = () => {
  return (
    <OptionChoice
      label="Boolean switch"
      displayStyle="checkmark"
      yesText="On"
      noText="Off"
      placeholder="Not set"
    />
  );
};

export default OptionChoice;
