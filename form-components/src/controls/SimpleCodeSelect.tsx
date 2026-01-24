/**
 * SimpleCodeSelect Component
 * Dropdown for selecting coded values with single/multiple selection support
 */

import React, { useState } from 'react';
import { Dropdown, IDropdownOption, TextField, Toggle, Stack } from '@fluentui/react';
import { LayoutItem } from './LayoutItem';
import { useTheme, useCodeList, useSection } from '../context/MoisContext';

export interface Coding {
  code: string | null;
  display: string;
  system?: string;
}

export interface CodeOption {
  code: string;
  display: string;
  order?: number;
  hotKey?: string;
}

export interface SimpleCodeSelectProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Use the first letter of the code as a hotkey */
  autoHotKey?: boolean;
  /** Show field without an enclosing border */
  borderless?: boolean;
  /** Child controls are shown when one of the conditionCodes is met */
  children?: React.ReactNode;
  /** Code system to use for the dropdown options */
  codeSystem?: string;
  /** If selected key is in this list, it will display the child controls */
  conditionalCodes?: string[];
  /** Default value */
  defaultValue?: Coding | Coding[] | string;
  /** Indicate whether the field is disabled or not */
  disabled?: boolean;
  /** Override default props for SimpleCodeSelect control */
  dropdownProps?: any;
  /** Override the default style for the contained dropdown */
  dropdownStyle?: React.CSSProperties;
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
  /** Label position relative to field contents */
  labelPosition?: 'top' | 'left' | 'none';
  /** Identifier for selective layout */
  layoutId?: string;
  /** Show multiple selected items in a list instead of in the dropdown box */
  listDisplay?: boolean;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** For single selection, disable automatic focus shift after hotkey selection */
  noAutoSkip?: boolean;
  /** Annotation shown near the control */
  note?: string;
  /** onChange callback */
  onChange?: (value: Coding | Coding[] | undefined, valueList?: Coding[], selected?: boolean) => void;
  /** List of code options */
  optionList?: CodeOption[] | Record<string, string> | IDropdownOption[];
  /** Override props for the TextField where "other" values are entered */
  otherFieldProps?: any;
  /** Placeholder string shown if no value has been selected */
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
  /** Type of selection */
  selectionType?: 'none' | 'single' | 'multiple';
  /** If set to true, "Other" option will be added */
  showOtherOption?: boolean;
  /** Size indicator */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | React.CSSProperties;
  /** Source field name */
  sourceId?: string;
  /** Current value */
  value?: Coding | Coding[];
  /** Style override */
  style?: React.CSSProperties;
  /** Render just the input without wrapper divs (for composition) */
  inline?: boolean;
}

/**
 * SimpleCodeSelect - Dropdown for selecting coded values
 *
 * The SimpleCodeSelect control handles selection of simple coded value(s) in Mois.
 * A simple code or codes is selected from a short list of options values from a single
 * code set. It can also have an "Other" option, that allows the user to type a custom
 * value outside of the coded values.
 *
 * Values are stored as a Coding or a list of Codings for multiselect.
 * "Other" values are stored with code: null for single selection and with
 * code: the same as the option text for multiple selection.
 */
export const SimpleCodeSelect: React.FC<SimpleCodeSelectProps> = ({
  actions,
  children,
  codeSystem,
  conditionalCodes = [],
  defaultValue,
  disabled,
  dropdownProps,
  dropdownStyle,
  fieldId,
  hidden,
  id,
  index,
  inline,
  isComplete,
  label,
  labelPosition,
  layoutId,
  listDisplay,
  moisModule,
  note,
  optionList = [],
  otherFieldProps,
  placeholder = 'Please select',
  placement,
  readOnly,
  required,
  section,
  selectionType = 'single',
  showOtherOption,
  size = 'medium',
  sourceId,
  value,
  onChange,
  style,
}) => {
  // Derive codeSystem from id if not explicitly provided
  // e.g., id="maritalStatus" → codeSystem="MOIS-MARITALSTATUS"
  const derivedCodeSystem = codeSystem || (id ? `MOIS-${id.replace(/([a-z])([A-Z])/g, '$1$2').toUpperCase()}` : '');

  // Get options from code system
  const codeListOptions = useCodeList(derivedCodeSystem);

  // Parse optionList into standardized format
  const parseOptions = (): CodeOption[] => {
    // If we have options from code list, use them
    if (derivedCodeSystem && codeListOptions.length > 0) {
      return codeListOptions.map(opt => ({
        code: opt.code,
        display: opt.display,
      }));
    }

    if (Array.isArray(optionList)) {
      // Check if it's IDropdownOption[] format
      if (optionList.length > 0 && 'key' in optionList[0] && 'text' in optionList[0]) {
        return (optionList as IDropdownOption[]).map(opt => ({
          code: String(opt.key),
          display: opt.text,
        }));
      }
      // It's CodeOption[] format
      return optionList as CodeOption[];
    }
    // It's Record<string, string> format
    return Object.entries(optionList).map(([code, display]) => ({
      code,
      display,
    }));
  };

  const parsedOptions = parseOptions();

  // Get initial selected keys
  const getInitialKeys = (): string[] => {
    const val = value || defaultValue;
    if (!val) return [];
    if (typeof val === 'string') return [val];
    if (Array.isArray(val)) return val.map(v => v.code || '').filter(Boolean);
    return val.code ? [val.code] : [];
  };

  const [selectedKeys, setSelectedKeys] = useState<string[]>(getInitialKeys());
  const [otherValue, setOtherValue] = useState<string>('');

  const isMultiple = selectionType === 'multiple';

  // Build dropdown options
  const buildOptions = (): IDropdownOption[] => {
    const options: IDropdownOption[] = parsedOptions.map(opt => ({
      key: opt.code,
      text: opt.display,
    }));

    if (showOtherOption) {
      options.push({ key: '__other__', text: 'Other' });
    }

    return options;
  };

  const options = buildOptions();

  // Handle selection change
  const handleChange = (_: any, option?: IDropdownOption) => {
    if (!option) return;

    let newKeys: string[];
    let selected = true;

    if (isMultiple) {
      if (selectedKeys.includes(option.key as string)) {
        newKeys = selectedKeys.filter(k => k !== option.key);
        selected = false;
      } else {
        newKeys = [...selectedKeys, option.key as string];
      }
    } else {
      newKeys = option.key === '' ? [] : [option.key as string];
    }

    setSelectedKeys(newKeys);

    if (onChange) {
      const codings = newKeys.map(key => {
        const opt = parsedOptions.find(o => o.code === key);
        return { code: key, display: opt?.display || key };
      });

      if (isMultiple) {
        const changedCoding = { code: option.key as string, display: option.text };
        onChange(changedCoding, codings, selected);
      } else {
        const key = newKeys[0];
        if (key) {
          const opt = parsedOptions.find(o => o.code === key);
          onChange({ code: key, display: opt?.display || key });
        } else {
          onChange(undefined);
        }
      }
    }
  };

  // Check if children should be shown
  const shouldShowChildren = () => {
    if (!conditionalCodes.length) return false;
    return selectedKeys.some(key => conditionalCodes.includes(key));
  };

  const isEmpty = selectedKeys.length === 0;
  const theme = useTheme();

  // Determine effective label position based on section layout
  const sectionContext = useSection(section);
  const effectiveLabelPosition = labelPosition ?? (
    sectionContext.layout === 'flex' ? 'top' :
    sectionContext.layout === 'linear' ? 'left' : 'top'
  );

  // Show label inside Fluent component when labelPosition is "top"
  // For 'top' position, the Fluent component handles the label
  // For 'left' position, LayoutItem renders the label
  const fluentLabel = effectiveLabelPosition === 'top' ? label : undefined;

  // Only suppress LayoutItem's label when labelPosition is 'top' (Fluent component handles it)
  const shouldSuppressLayoutItemLabel = effectiveLabelPosition === 'top';

  // Get size styles from theme
  const getSizeStyles = (): React.CSSProperties => {
    if (typeof size === 'object') return size;
    return theme.mois.sizes[size] ?? theme.mois.sizes.medium;
  };

  const sizeStyles = getSizeStyles();
  const dropdownWrapperStyles: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'column',
    width: isMultiple ? undefined : sizeStyles.maxWidth,
    ...sizeStyles,
    ...dropdownStyle,
  };

  // Inline mode: render just the Dropdown without LayoutItem wrapper
  if (inline) {
    if (readOnly) {
      const displayValue = isMultiple
        ? selectedKeys.map(k => parsedOptions.find(o => o.code === k)?.display || k).join(', ')
        : parsedOptions.find(o => o.code === selectedKeys[0])?.display || '';
      return (
        <TextField
          id={fieldId}
          value={displayValue}
          readOnly
          borderless
          placeholder={placeholder}
          styles={{
            root: { width: '100%' },
          }}
        />
      );
    }
    return (
      <Dropdown
        id={fieldId}
        selectedKey={isMultiple ? undefined : (selectedKeys[0] || null)}
        selectedKeys={isMultiple ? selectedKeys : undefined}
        multiSelect={isMultiple}
        onChange={handleChange}
        options={isMultiple ? options : [{ key: '', text: placeholder }, ...options]}
        disabled={disabled}
        placeholder={placeholder}
        styles={{
          root: { width: '100%' },
          ...dropdownProps?.styles,
        }}
        {...dropdownProps}
      />
    );
  }

  // ReadOnly mode - show TextField
  if (readOnly) {
    const displayValue = isMultiple
      ? selectedKeys.map(k => parsedOptions.find(o => o.code === k)?.display || k).join(', ')
      : parsedOptions.find(o => o.code === selectedKeys[0])?.display || '';

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
        layoutStyle={typeof style === 'object' ? style : undefined}
      >
        <div style={dropdownWrapperStyles}>
          <TextField
            id={fieldId}
            label={fluentLabel}
            value={displayValue}
            readOnly
            borderless
            placeholder={placeholder}
            styles={{
              root: { width: '100%' },
            }}
          />
        </div>
      </LayoutItem>
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
      noTopLabel={shouldSuppressLayoutItemLabel}
      note={note}
      placement={placement}
      readOnly={readOnly}
      required={required}
      section={section}
      size={size}
      layoutStyle={typeof style === 'object' ? style : undefined}
    >
      <div style={dropdownWrapperStyles}>
        <Dropdown
          id={fieldId}
          label={fluentLabel}
          selectedKey={isMultiple ? undefined : (selectedKeys[0] || null)}
          selectedKeys={isMultiple ? selectedKeys : undefined}
          multiSelect={isMultiple}
          onChange={handleChange}
          options={isMultiple ? options : [{ key: '', text: placeholder }, ...options]}
          disabled={disabled}
          placeholder={placeholder}
          styles={{
            root: { width: '100%' },
            ...dropdownProps?.styles,
          }}
          {...dropdownProps}
        />
        {showOtherOption && selectedKeys.includes('__other__') && (
          <TextField
            value={otherValue}
            onChange={(_, val) => setOtherValue(val || '')}
            placeholder="Other"
            styles={{
              root: { marginTop: '4px' },
            }}
            {...otherFieldProps}
          />
        )}
      </div>
      {shouldShowChildren() && children}
    </LayoutItem>
  );
};

// Demo option data
const maritalStatusOptions: IDropdownOption[] = [
  { key: 'S', text: 'Single' },
  { key: 'M', text: 'Married' },
  { key: 'D', text: 'Divorced' },
  { key: 'W', text: 'Widowed' },
];

const languageOptions: IDropdownOption[] = [
  { key: 'en', text: 'English' },
  { key: 'fr', text: 'French' },
  { key: 'es', text: 'Spanish' },
  { key: 'de', text: 'German' },
  { key: 'zh', text: 'Chinese' },
];

const firstNationOptions: IDropdownOption[] = [
  { key: 'unknown', text: 'Asked, but unknown' },
  { key: 'noIdentify', text: 'Asked, Does not identify as Aboriginal' },
  { key: 'notProvided', text: 'Asked, not provided' },
  { key: 'nonStatus', text: 'Non-status Indian' },
  { key: 'notAsked', text: 'Not Asked' },
  { key: 'status', text: 'Status Indian' },
  { key: 'unknownStatus', text: 'Unknown' },
];

const aliasIdOptions: IDropdownOption[] = [
  { key: 'DL', text: 'Driver\'s License' },
  { key: 'PP', text: 'Passport' },
  { key: 'HC', text: 'Health Card' },
  { key: 'SS', text: 'Social Security' },
];

const fundingOptions: IDropdownOption[] = [
  { key: 'AHS', text: 'Alberta Health Services' },
  { key: 'FNIHB', text: 'First Nations and Inuit Health Branch' },
  { key: 'WCB', text: 'Workers Compensation Board' },
  { key: 'PRIV', text: 'Private Insurance' },
];

const suicideRiskOptions: IDropdownOption[] = [
  { key: 'low', text: 'Low' },
  { key: 'moderate', text: 'Moderate' },
  { key: 'high', text: 'High' },
];

const insuranceOptions: IDropdownOption[] = [
  { key: 'BC', text: 'British Columbia' },
  { key: 'INS', text: 'Insurance' },
  { key: 'PAT', text: 'Patient Pay' },
  { key: 'WCB', text: 'Workers Compensation' },
  { key: 'AB', text: 'Alberta' },
  { key: 'MB', text: 'Manitoba' },
  { key: 'NB', text: 'New Brunswick' },
  { key: 'NL', text: 'Newfoundland / Labrador' },
  { key: 'NT', text: 'Northwest Territory' },
  { key: 'NS', text: 'Nova Scotia' },
  { key: 'NU', text: 'Nunavut' },
  { key: 'ON', text: 'Ontario' },
  { key: 'PE', text: 'Prince Edward Island' },
  { key: 'SK', text: 'Saskatchewan' },
  { key: 'YT', text: 'Yukon' },
];

const reserveOptions: IDropdownOption[] = [
  { key: 'BL', text: 'Burns Lake' },
  { key: 'FN', text: 'Fort Nelson' },
  { key: 'FSJ', text: 'Fort St. John' },
  { key: 'PG', text: 'Prince George' },
];

/**
 * SimpleCodeSelectDemo1 - Single selection (marital status)
 */
export const SimpleCodeSelectDemo1: React.FC = () => {
  return (
    <SimpleCodeSelect
      label="Marital status"
      defaultValue={{ code: 'M', display: 'Married' }}
      optionList={maritalStatusOptions}
    />
  );
};

/**
 * SimpleCodeSelectDemo2 - Multiple selection (languages)
 */
export const SimpleCodeSelectDemo2: React.FC = () => {
  return (
    <SimpleCodeSelect
      selectionType="multiple"
      label="Languages spoken"
      optionList={languageOptions}
    />
  );
};

/**
 * SimpleCodeSelectDemo3 - Lock/Writable toggle demo
 */
export const SimpleCodeSelectDemo3: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Toggle
        label="Lock"
        checked={isLocked}
        onChange={(_, checked) => setIsLocked(checked || false)}
        onText="Locked"
        offText="Writable"
      />
      <SimpleCodeSelect
        label="First nation status single select"
        optionList={firstNationOptions}
        readOnly={isLocked}
      />
      <SimpleCodeSelect
        label="Alias ID types multiselect"
        selectionType="multiple"
        optionList={aliasIdOptions}
        readOnly={isLocked}
      />
      <SimpleCodeSelect
        label="Funding source multiselect with list"
        selectionType="multiple"
        listDisplay
        optionList={fundingOptions}
        readOnly={isLocked}
      />
    </Stack>
  );
};

/**
 * SimpleCodeSelectDemo4 - With "Other" option (single select)
 */
export const SimpleCodeSelectDemo4: React.FC = () => {
  return (
    <SimpleCodeSelect
      label="First nation status"
      showOtherOption
      optionList={firstNationOptions}
    />
  );
};

/**
 * SimpleCodeSelectDemo5 - With "Other" option (multiple select)
 */
export const SimpleCodeSelectDemo5: React.FC = () => {
  return (
    <SimpleCodeSelect
      label="First nation status"
      selectionType="multiple"
      showOtherOption
      optionList={firstNationOptions}
    />
  );
};

/**
 * SimpleCodeSelectDemo6 - Conditional content (Reserve Name)
 */
export const SimpleCodeSelectDemo6: React.FC = () => {
  return (
    <SimpleCodeSelect
      label="Reserve Name"
      optionList={reserveOptions}
      conditionalCodes={['BL']}
    >
      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        Burns Lake is located in northern British Columbia.
      </div>
    </SimpleCodeSelect>
  );
};

/**
 * SimpleCodeSelectDemo7 - Custom required field styling
 */
export const SimpleCodeSelectDemo7: React.FC = () => {
  const [value, setValue] = useState<Coding | undefined>(undefined);

  const hasValue = value !== undefined && value.code !== '';

  return (
    <SimpleCodeSelect
      label="Suicide Risk"
      required
      value={value}
      onChange={(val) => setValue(val as Coding)}
      dropdownProps={{
        styles: {
          title: { backgroundColor: hasValue ? '#ffffff' : '#fff4ce' },
        },
      }}
      optionList={suicideRiskOptions}
    />
  );
};

/**
 * SimpleCodeSelectDemo8 - Using value prop (single select)
 */
export const SimpleCodeSelectDemo8: React.FC = () => {
  const [value, setValue] = useState<Coding | undefined>(undefined);

  return (
    <SimpleCodeSelect
      label="Select an insurance provider"
      optionList={insuranceOptions}
      value={value}
      onChange={(val) => setValue(val as Coding)}
    />
  );
};

/**
 * SimpleCodeSelectDemo9 - Using value prop with max 3 selections
 */
export const SimpleCodeSelectDemo9: React.FC = () => {
  const [values, setValues] = useState<Coding[]>([]);

  const handleChange = (option: Coding | Coding[] | undefined, newValueList?: Coding[], selected?: boolean) => {
    if (selected) {
      if (newValueList && newValueList.length > 3) return;
      setValues(newValueList || []);
    } else {
      setValues(newValueList || []);
    }
  };

  return (
    <SimpleCodeSelect
      label="Choose up to 3 insurance providers"
      selectionType="multiple"
      optionList={insuranceOptions}
      value={values}
      onChange={handleChange}
    />
  );
};

export default SimpleCodeSelect;
