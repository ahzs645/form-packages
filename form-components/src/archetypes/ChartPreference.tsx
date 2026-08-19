/**
 * ChartPreference Archetype
 * Components for displaying and updating user preferences, consents, directives, etc.
 *
 * MOIS parity notes (verified against the SMOIS FormTester bundle):
 * - Every field passes a stable fieldId (its Fields-map key) so section
 *   fieldPlacement can select and position it (`<Grid placement=...>`).
 * - `All` renders the fields as a Fragment in placement order — fields must be
 *   direct grid children for per-field gridArea to work.
 * - Fields read/write through the section's activeSelector when one is set
 *   (e.g. a SubForm editing fd.preferenceEdit), storing coded values as
 *   { code, display, system } objects like the real engine. Without a custom
 *   section they fall back to the JSON example data for gallery demos.
 */

import React from 'react';
import { IDropdownOption } from '@fluentui/react';
import { LayoutItem, ArchAll, AuditStamp } from '../components/Layout';
import {
  useActiveData,
  useSection,
  useCodeList,
  ChartPreferenceData,
  SectionContextValue,
} from '../context/MoisContext';
import { useActiveDataSlice } from '../hooks/form-state';
import { getSectionActiveTarget, writeSectionActiveFieldValue } from '../runtime/mois-contract';
import { DateSelect } from '../controls/DateSelect';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';

// ============================================================================
// Section-aware data access
// ============================================================================

interface ChartPreferenceBinding {
  data: Record<string, any> | undefined;
  setField: (fieldId: string, value: unknown) => void;
}

/**
 * Resolve where this field reads and writes.
 *
 * When the enclosing section supplies a custom activeSelector (a SubForm
 * editing fd.preferenceEdit, a list row, ...), bind to the form-state store
 * through the section contract — the same store and write path the standard
 * controls use. Otherwise keep the legacy MoisContext example-data binding so
 * standalone gallery previews stay populated and interactive.
 */
const useChartPreferenceBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ChartPreferenceBinding => {
  const section = useSection(sectionOverride);

  // Form-state store (what the compiled form's useActiveData writes into).
  const [slice, setFormData] = useActiveDataSlice((data: any) => ({
    target: getSectionActiveTarget(data, section),
    defaultTarget: data?.field?.data ?? data,
  }));
  const hasCustomTarget = slice.target != null && slice.target !== slice.defaultTarget;

  // MoisContext demo store (gallery example data).
  const [moisActiveData, setMoisActiveData] = useActiveData();
  const exampleData: ChartPreferenceData | undefined =
    (moisActiveData as any).example?.demographics?.preferences?.[0]
    || (moisActiveData as any).example?.chartPreference;

  const setField = React.useCallback((fieldId: string, value: unknown) => {
    if (hasCustomTarget) {
      setFormData((draft: any) => {
        writeSectionActiveFieldValue(draft, section, fieldId, value);
      });
      return;
    }
    setMoisActiveData((draft: any) => {
      draft.example = draft.example || {};
      const target = draft.example.demographics?.preferences?.[0]
        ?? (draft.example.chartPreference = draft.example.chartPreference || {});
      target[fieldId] = value;
    });
  }, [hasCustomTarget, section, setFormData, setMoisActiveData]);

  return {
    data: hasCustomTarget ? (slice.target as Record<string, any>) : (exampleData as any),
    setField,
  };
};

/** MOIS stores coded values as { code, display, system }; demos may hold bare codes. */
const codeOf = (value: any): string =>
  (value && typeof value === 'object' ? value.code : value) ?? '';

const toCodedValue = (
  option: IDropdownOption | undefined,
  system: string
): { code: string; display: string; system: string } | null =>
  option && option.key !== ''
    ? { code: String(option.key), display: option.text, system }
    : null;

const usePleaseSelectOptions = (codeSystem: string): IDropdownOption[] => {
  const options = useCodeList(codeSystem);
  return [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];
};

// ============================================================================
// Field Components
// ============================================================================

interface FieldProps {
  index?: number | string;
  section?: Partial<SectionContextValue>;
  [key: string]: any;
}

const makeCodedField = (
  fieldId: string,
  label: string,
  codeSystem: string,
  size: 'tiny' | 'small' | 'medium' | 'large',
  codeSystemProp?: string
): React.FC<FieldProps> => {
  const CodedField: React.FC<FieldProps> = ({ index, section, ...rest }) => {
    const { data, setField } = useChartPreferenceBinding(section);
    const effectiveSystem = (codeSystemProp && rest[codeSystemProp]) || codeSystem;
    const dropdownOptions = usePleaseSelectOptions(effectiveSystem);
    if (codeSystemProp) delete rest[codeSystemProp];

    return (
      <LayoutItem fieldId={fieldId} label={label} size={size} index={index} section={section} {...rest}>
        <MoisDropdown
          fieldId={fieldId}
          codeSystem={effectiveSystem}
          selectedKey={codeOf(data?.[fieldId])}
          options={dropdownOptions}
          size={size}
          onChange={(_, option) => setField(fieldId, toCodedValue(option, effectiveSystem))}
        />
      </LayoutItem>
    );
  };
  CodedField.displayName = `ChartPreference.${fieldId}`;
  return CodedField;
};

const makeTextField = (
  fieldId: string,
  label: string,
  size: 'tiny' | 'small' | 'medium' | 'large',
  options: { multiline?: boolean; readOnly?: boolean } = {}
): React.FC<FieldProps> => {
  const TextFieldComponent: React.FC<FieldProps> = ({ index, section, ...rest }) => {
    const { data, setField } = useChartPreferenceBinding(section);
    const rawValue = data?.[fieldId];
    const value = rawValue === null || rawValue === undefined ? '' : String(rawValue);

    return (
      <LayoutItem fieldId={fieldId} label={label} size={size} index={index} section={section} {...rest}>
        <MoisTextField
          value={value}
          size={size}
          {...(options.multiline ? { multiline: true, rows: 3 } : {})}
          {...(options.readOnly
            ? { readOnly: true, borderless: true, tabIndex: -1 }
            : { onChange: (_: unknown, val?: string) => setField(fieldId, val || '') })}
        />
      </LayoutItem>
    );
  };
  TextFieldComponent.displayName = `ChartPreference.${fieldId}`;
  return TextFieldComponent;
};

const makeDateField = (
  fieldId: string,
  label: string
): React.FC<FieldProps> => {
  const DateFieldComponent: React.FC<FieldProps> = ({ index, section, ...rest }) => {
    const { data, setField } = useChartPreferenceBinding(section);

    return (
      <LayoutItem fieldId={fieldId} label={label} size="small" index={index} section={section} {...rest}>
        <DateSelect
          inline
          value={data?.[fieldId] || ''}
          size="small"
          onChange={(date) => setField(fieldId, date)}
        />
      </LayoutItem>
    );
  };
  DateFieldComponent.displayName = `ChartPreference.${fieldId}`;
  return DateFieldComponent;
};

const attachmentCount = makeTextField('attachmentCount', 'Attached', 'tiny', { readOnly: true });
const codedSubject = makeCodedField('codedSubject', 'Subject code', 'MOIS-PREFSUBJECTCODE', 'medium', 'subjectCodeSystem');
const classification = makeCodedField('classification', 'Classification', 'MOIS-PREFERENCECLASSIFICATION', 'small');
const encounterId = makeTextField('encounterId', 'Encounter Id', 'tiny', { readOnly: true });
const endDate = makeDateField('endDate', 'End date');
const includeOnDemographics = makeCodedField('includeOnDemographics', 'Show on demo.', 'MOIS-YESNO', 'small');
const instruction = makeCodedField('instruction', 'Instruction', 'MOIS-PREFERENCEINSTRUCTION', 'medium', 'instructionCodeSystem');
const instructionDetail = makeTextField('instructionDetail', 'Instruction detail', 'medium', { multiline: true });
const patientId = makeTextField('patientId', 'Patient Id', 'tiny', { readOnly: true });
const preference = makeTextField('preference', 'Preference', 'medium');
const preferenceType = makeCodedField('preferenceType', 'Preference type', 'MOIS-PREFERENCETYPE', 'small');
const reason = makeCodedField('reason', 'Reason', 'MOIS-PREFERENCEREASON', 'medium');
const reasonDetail = makeTextField('reasonDetail', 'Reason detail', 'medium', { multiline: true });
const sensitive = makeCodedField('sensitive', 'Sensitive', 'MOIS-YESNO', 'small');
const stamp: React.FC<FieldProps> = ({ index, ...props }) => {
  return <AuditStamp fieldId="stamp" index={index} {...props} />;
};
const startDate = makeDateField('startDate', 'Start date');
const subjectCodeType = makeCodedField('subjectCodeType', 'Code type', 'MOIS-PREFERENCECODETYPE', 'small');
const subjectConceptName = makeTextField('subjectConceptName', 'Concept', 'medium');
const subjectDetail = makeTextField('subjectDetail', 'Subject detail', 'medium', { multiline: true });

// ============================================================================
// Fields Collection
// ============================================================================

const Fields = {
  attachmentCount,
  codedSubject,
  classification,
  encounterId,
  endDate,
  includeOnDemographics,
  instruction,
  instructionDetail,
  patientId,
  preference,
  preferenceType,
  reason,
  reasonDetail,
  sensitive,
  stamp,
  startDate,
  subjectCodeType,
  subjectConceptName,
  subjectDetail,
};

// ============================================================================
// All Component (renders the placed fields, or every field with no placement)
// ============================================================================

const All: React.FC<any> = (props) => {
  return <ArchAll fields={Fields} {...props} />;
};

// ============================================================================
// Export
// ============================================================================

export const ChartPreference = {
  ...Fields,
  All,
  Fields,
};

export default ChartPreference;
