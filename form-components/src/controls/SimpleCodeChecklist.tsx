/**
 * SimpleCodeChecklist Component
 * Shows all simple code values and lets the user choose one or more items
 * using radio buttons or check marks.
 */

import React, { useState } from 'react';
import {
  Checkbox,
  TextField,
  IChoiceGroupOption,
} from '@fluentui/react';
import { LayoutItem } from './LayoutItem';
import { OptionChoice } from './OptionChoice';
import { useCodeList } from '../context/MoisContext';
import { useActiveDataForForms } from '../hooks/form-state';

export interface Coding {
  code: string | null;
  display: string | null;
  system?: string;
}

export interface SimpleCodeChecklistProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Allow selection by first character of code values */
  autoHotKey?: boolean;
  /** Child controls are shown when one of the conditionCodes is met */
  children?: React.ReactNode;
  /** Code system to use for the dropdown options */
  codeSystem?: string;
  /** If selected key is in this list, it will display the child controls */
  conditionalCodes?: string[];
  /** Override props for option container */
  containerProps?: any;
  /** Initial selected value(s) */
  defaultValue?: Coding | Coding[];
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
  /** Label position relative to field contents */
  labelPosition?: 'top' | 'left' | 'none';
  /** Identifier for selective layout */
  layoutId?: string;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** Use vertical layout for options */
  multiline?: boolean;
  /** Annotation shown near the control */
  note?: string;
  /** Object with codes for the checklist */
  optionList?: Record<string, string> | IChoiceGroupOption[];
  /** Override props for option controls */
  optionProps?: any;
  /** Size of individual options */
  optionSize?: string | React.CSSProperties;
  /** Placeholder text for "other" field */
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
  /** Type of selection: "none" | "single" | "multiple" */
  selectionType?: 'none' | 'single' | 'multiple';
  /** If true, "Other" option will be added */
  showOtherOption?: boolean;
  /** Source field name */
  sourceId?: string;
}

/**
 * SimpleCodeChecklist - Code value selection with radio buttons or checkboxes
 */
export const SimpleCodeChecklist: React.FC<SimpleCodeChecklistProps> = ({
  actions,
  label,
  optionList,
  codeSystem,
  selectionType = 'single',
  multiline = false,
  disabled = false,
  fieldId,
  hidden = false,
  id,
  index,
  isComplete,
  labelPosition,
  layoutId,
  moisModule,
  note,
  placement,
  readOnly,
  required = false,
  section,
  showOtherOption = false,
  placeholder = 'Other',
  defaultValue,
  children,
  conditionalCodes,
}) => {
  // Get code list from codeSystem if provided and optionList is not
  const codeListItems = useCodeList(codeSystem || '');
  const [activeData, setActiveData] = useActiveDataForForms();
  const effectiveFieldId = fieldId || id;

  // Helper to get value from activeData
  const getValueFromActiveData = (): Coding | Coding[] | null => {
    if (effectiveFieldId && activeData?.field?.data) {
      return (activeData.field.data as any)[effectiveFieldId] ?? null;
    }
    return null;
  };

  const activeValue = getValueFromActiveData();

  const [selectedKey, setSelectedKey] = useState<string | undefined>(() => {
    // Check activeData first
    if (activeValue && !Array.isArray(activeValue)) {
      return activeValue.code ?? undefined;
    }
    if (defaultValue && !Array.isArray(defaultValue)) {
      return defaultValue.code ?? undefined;
    }
    return undefined;
  });

  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => {
    // Check activeData first
    if (activeValue && Array.isArray(activeValue)) {
      return activeValue.map(c => c.code).filter((c): c is string => c !== null);
    }
    if (defaultValue && Array.isArray(defaultValue)) {
      return defaultValue.map(c => c.code).filter((c): c is string => c !== null);
    }
    return [];
  });

  const [otherText, setOtherText] = useState('');

  // Helper to update activeData
  const updateActiveData = (value: Coding | Coding[] | null) => {
    if (effectiveFieldId) {
      setActiveData((draft: any) => {
        if (!draft.field) draft.field = { data: {}, status: {}, history: [] };
        if (!draft.field.data) draft.field.data = {};
        draft.field.data[effectiveFieldId] = value;
      });
    }
  };

  // Derive effective selected value(s) from activeData or local state
  const effectiveSelectedKey = (() => {
    if (activeValue && !Array.isArray(activeValue)) {
      return activeValue.code ?? selectedKey;
    }
    return selectedKey;
  })();

  const effectiveSelectedKeys = (() => {
    if (activeValue && Array.isArray(activeValue)) {
      return activeValue.map(c => c.code).filter((c): c is string => c !== null);
    }
    return selectedKeys;
  })();

  const isEmpty = selectionType === 'multiple'
    ? effectiveSelectedKeys.length === 0
    : effectiveSelectedKey === undefined;

  // Convert optionList or codeSystem to options array
  const getOptions = (): IChoiceGroupOption[] => {
    // If optionList is provided, use it
    if (optionList) {
      if (Array.isArray(optionList)) {
        return optionList;
      }
      // Convert object to array
      return Object.entries(optionList).map(([code, display]) => ({
        key: code,
        text: display,
      }));
    }

    // If codeSystem is provided, use code list from context
    if (codeSystem && codeListItems.length > 0) {
      return codeListItems.map(item => ({
        key: item.code,
        text: item.display,
      }));
    }

    return [];
  };

  const options = getOptions();

  const handleCheckboxChange = (key: string, checked?: boolean) => {
    let newKeys: string[];
    if (checked) {
      newKeys = [...effectiveSelectedKeys, key];
    } else {
      newKeys = effectiveSelectedKeys.filter(k => k !== key);
    }
    setSelectedKeys(newKeys);
    // Update activeData with array of Coding objects
    const codings: Coding[] = newKeys.map(k => {
      const opt = options.find(o => o.key === k);
      return {
        code: k,
        display: opt?.text || k,
        system: codeSystem,
      };
    });
    updateActiveData(codings.length > 0 ? codings : null);
  };

  const showChildren = conditionalCodes && effectiveSelectedKey && conditionalCodes.includes(effectiveSelectedKey);

  const handleOptionChoiceChange = (ev: any, option: IChoiceGroupOption) => {
    setSelectedKey(option?.key);
    // Update activeData with Coding object
    if (option?.key) {
      updateActiveData({
        code: option.key,
        display: option.text || option.key,
        system: codeSystem,
      });
    } else {
      updateActiveData(null);
    }
  };

  const renderSingleSelect = () => (
    <OptionChoice
      displayStyle="radio"
      options={options}
      selectedKey={effectiveSelectedKey}
      onChange={handleOptionChoiceChange}
      disabled={disabled}
      required={required}
      multiline={multiline}
      labelPosition="none"
    />
  );

  const renderMultiSelect = () => (
    <div
      style={{
        display: multiline ? 'flex' : 'grid',
        flexDirection: multiline ? 'column' : undefined,
        gridTemplateColumns: multiline ? undefined : 'repeat(2, 1fr)',
        gap: '8px 40px',
        width: '100%',
      }}
    >
      {options.map((option, idx) => (
        <Checkbox
          key={`${option.key}-${idx}`}
          label={option.text}
          checked={effectiveSelectedKeys.includes(option.key)}
          onChange={(ev, checked) => handleCheckboxChange(option.key, checked)}
          disabled={disabled}
        />
      ))}
    </div>
  );

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
    >
      {selectionType === 'multiple' ? renderMultiSelect() : renderSingleSelect()}
      {showChildren && children}
    </LayoutItem>
  );
};

/**
 * SimpleCodeChecklistDemo1 - Basic usage with marital status (single select)
 */
export const SimpleCodeChecklistDemo1: React.FC = () => {
  const options: Record<string, string> = {
    'C': 'Common-Law',
    'D': 'Divorced',
    'M': 'Married',
    'O': 'Other',
    'S': 'Single',
  };

  return (
    <SimpleCodeChecklist
      label="Marital status"
      fieldId="maritalStatus"
      optionList={options}
      selectionType="single"
      required
      defaultValue={{ code: 'M', display: 'Married', system: 'MOIS-MARITALSTATUS' }}
    />
  );
};

/**
 * SimpleCodeChecklistDemo2 - Multiple selection example
 */
export const SimpleCodeChecklistDemo2: React.FC = () => {
  const options: Record<string, string> = {
    'ENG': 'English',
    'FRE': 'French',
    'SPA': 'Spanish',
    'CHI': 'Chinese',
    'OTH': 'Other',
  };

  return (
    <SimpleCodeChecklist
      label="Languages spoken"
      fieldId="languages"
      optionList={options}
      selectionType="multiple"
      defaultValue={[
        { code: 'ENG', display: 'English', system: 'MOIS-LANGUAGE' },
        { code: 'FRE', display: 'French', system: 'MOIS-LANGUAGE' },
      ]}
    />
  );
};

/**
 * SimpleCodeChecklistDemo3 - Vertical layout (multiline)
 */
export const SimpleCodeChecklistDemo3: React.FC = () => {
  const options: Record<string, string> = {
    'Y': 'Yes',
    'N': 'No',
    'U': 'Unknown',
  };

  return (
    <SimpleCodeChecklist
      label="Has allergies?"
      fieldId="hasAllergies"
      optionList={options}
      selectionType="single"
      multiline
    />
  );
};

export default SimpleCodeChecklist;
