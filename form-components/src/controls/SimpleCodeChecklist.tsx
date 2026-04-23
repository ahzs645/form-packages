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
import { useCodeList, useSection } from '../context/MoisContext';
import { useActiveDataForForms } from '../hooks/form-state';
import { readSectionActiveFieldValue, writeSectionActiveFieldValue } from '../runtime/mois-contract';

export interface Coding {
  code: string | null;
  display: string | null;
  system?: string;
}

const OTHER_OPTION_KEY = "__mois_other__";

const normalizeSingleSelectionKey = (value: Coding | Coding[] | string | string[] | null | undefined): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : first?.code ?? first?.display ?? undefined;
  }
  return value.code ?? value.display ?? undefined;
};

const normalizeMultipleSelectionKeys = (value: Coding | Coding[] | string | string[] | null | undefined): string[] => {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : entry?.code ?? entry?.display ?? null))
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  const single = value.code ?? value.display ?? undefined;
  return single ? [single] : [];
};

const normalizeOptionKey = (value: unknown): string => String(value ?? "");

const findOtherText = (
  value: Coding | Coding[] | string | string[] | null | undefined,
  optionKeys: Set<string>
): string => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  for (const entry of values) {
    const key = typeof entry === "string" ? entry : entry?.code ?? entry?.display ?? "";
    if (key && !optionKeys.has(key) && key !== OTHER_OPTION_KEY) {
      return typeof entry === "string" ? entry : entry.display ?? entry.code ?? "";
    }
  }
  return "";
};

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
  sourceId,
}) => {
  // Get code list from codeSystem if provided and optionList is not
  const codeListItems = useCodeList(codeSystem || '');
  const [activeData, setActiveData] = useActiveDataForForms();
  const sectionContext = useSection(section);
  const effectiveFieldId = fieldId || id || sourceId || layoutId;
  const effectiveReadOnly = Boolean(readOnly || isComplete);
  const controlsDisabled = disabled || effectiveReadOnly;

  // Helper to get value from activeData
  const getValueFromActiveData = (): Coding | Coding[] | string | string[] | null => {
    if (effectiveFieldId) {
      return (readSectionActiveFieldValue(activeData, sectionContext, effectiveFieldId) as any) ?? null;
    }
    return null;
  };

  const activeValue = getValueFromActiveData();

  const [selectedKey, setSelectedKey] = useState<string | undefined>(() => {
    return normalizeSingleSelectionKey(activeValue) ?? normalizeSingleSelectionKey(defaultValue as Coding | Coding[] | undefined);
  });

  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => {
    const nextKeys = normalizeMultipleSelectionKeys(activeValue);
    return nextKeys.length > 0
      ? nextKeys
      : normalizeMultipleSelectionKeys(defaultValue as Coding | Coding[] | undefined);
  });

  const [otherText, setOtherText] = useState<string | null>(null);

  // Helper to update activeData
  const updateActiveData = (value: Coding | Coding[] | null) => {
    if (effectiveReadOnly) return;
    if (effectiveFieldId) {
      setActiveData((draft: any) => {
        writeSectionActiveFieldValue(draft, sectionContext, effectiveFieldId, value);
      });
    }
  };

  // Derive effective selected value(s) from activeData or local state
  const effectiveSelectedKey = (() => {
    return normalizeSingleSelectionKey(activeValue) ?? selectedKey;
  })();

  const effectiveSelectedKeys = (() => {
    const nextKeys = normalizeMultipleSelectionKeys(activeValue);
    return nextKeys.length > 0 ? nextKeys : selectedKeys;
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
  const renderedOptions = showOtherOption
    ? [
        ...options,
        ...(options.some((option) => normalizeOptionKey(option.key) === OTHER_OPTION_KEY)
          ? []
          : [{ key: OTHER_OPTION_KEY, text: "Other" }]),
      ]
    : options;
  const optionKeys = new Set(options.map((option) => normalizeOptionKey(option.key)));
  const displayOptionKeys = new Set(renderedOptions.map((option) => normalizeOptionKey(option.key)));
  const activeOtherText = findOtherText(activeValue, optionKeys);
  const resolvedOtherText = otherText ?? activeOtherText;
  const effectiveSingleSelectionKey =
    showOtherOption && effectiveSelectedKey && !displayOptionKeys.has(effectiveSelectedKey)
      ? OTHER_OPTION_KEY
      : effectiveSelectedKey;
  const effectiveMultipleSelectionKeys = showOtherOption
    ? Array.from(new Set(effectiveSelectedKeys.map((key) => displayOptionKeys.has(key) ? key : OTHER_OPTION_KEY)))
    : effectiveSelectedKeys;

  const buildCodingFromKey = (key: string, otherOverride = resolvedOtherText): Coding | null => {
    if (key === OTHER_OPTION_KEY) {
      const text = otherOverride.trim();
      return text ? { code: text, display: text, system: codeSystem } : null;
    }
    const opt = options.find((entry) => normalizeOptionKey(entry.key) === key);
    return {
      code: key,
      display: opt?.text || key,
      system: codeSystem,
    };
  };

  const commitOtherText = (text = resolvedOtherText) => {
    if (!showOtherOption || effectiveReadOnly) return;
    const trimmed = text.trim();
    if (selectionType === "multiple") {
      const nextKeys = effectiveMultipleSelectionKeys.includes(OTHER_OPTION_KEY)
        ? effectiveMultipleSelectionKeys
        : [...effectiveMultipleSelectionKeys, OTHER_OPTION_KEY];
      setSelectedKeys(nextKeys);
      const codings = nextKeys
        .map((key) => buildCodingFromKey(key, trimmed))
        .filter((entry): entry is Coding => Boolean(entry));
      updateActiveData(codings.length > 0 ? codings : null);
      return;
    }

    setSelectedKey(trimmed ? OTHER_OPTION_KEY : undefined);
    updateActiveData(trimmed ? { code: trimmed, display: trimmed, system: codeSystem } : null);
  };

  const handleCheckboxChange = (key: string, checked?: boolean) => {
    if (controlsDisabled) return;
    let newKeys: string[];
    if (checked) {
      newKeys = Array.from(new Set([...effectiveMultipleSelectionKeys, key]));
    } else {
      newKeys = effectiveMultipleSelectionKeys.filter(k => k !== key);
    }
    setSelectedKeys(newKeys);
    // Update activeData with array of Coding objects
    const codings: Coding[] = newKeys
      .map(k => buildCodingFromKey(k))
      .filter((entry): entry is Coding => Boolean(entry));
    updateActiveData(codings.length > 0 ? codings : null);
  };

  const showChildren = conditionalCodes && effectiveSelectedKey && conditionalCodes.includes(effectiveSelectedKey);

  const handleOptionChoiceChange = (ev: any, option: IChoiceGroupOption) => {
    if (controlsDisabled) return;
    const key = normalizeOptionKey(option?.key);
    setSelectedKey(key);
    // Update activeData with Coding object
    if (key === OTHER_OPTION_KEY) {
      commitOtherText(resolvedOtherText);
    } else if (key) {
      updateActiveData({
        code: key,
        display: option.text || key,
        system: codeSystem,
      });
    } else {
      updateActiveData(null);
    }
  };

  const renderSingleSelect = () => (
    <>
      <OptionChoice
        displayStyle="radio"
        options={renderedOptions}
        selectedKey={effectiveSingleSelectionKey}
        onChange={handleOptionChoiceChange}
        disabled={controlsDisabled}
        required={required}
        multiline={multiline}
        labelPosition="none"
      />
      {showOtherOption && effectiveSingleSelectionKey === OTHER_OPTION_KEY ? renderOtherInput() : null}
    </>
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
      {renderedOptions.map((option, idx) => (
        <Checkbox
          key={`${option.key}-${idx}`}
          label={option.text}
          checked={effectiveMultipleSelectionKeys.includes(normalizeOptionKey(option.key))}
          onChange={(ev, checked) => handleCheckboxChange(normalizeOptionKey(option.key), checked)}
          disabled={controlsDisabled}
        />
      ))}
      {showOtherOption && effectiveMultipleSelectionKeys.includes(OTHER_OPTION_KEY) ? renderOtherInput() : null}
    </div>
  );

  function renderOtherInput() {
    return (
      <TextField
        value={resolvedOtherText}
        placeholder={placeholder}
        disabled={controlsDisabled}
        readOnly={effectiveReadOnly}
        onChange={(_, value) => setOtherText(value ?? "")}
        onBlur={() => commitOtherText(resolvedOtherText)}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          if (event.key === "Enter") {
            commitOtherText(resolvedOtherText);
          }
        }}
        styles={{ root: { marginTop: 8, maxWidth: 320 } }}
      />
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
      readOnly={effectiveReadOnly}
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
