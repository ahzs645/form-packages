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
import { useCodeList, SectionContextValue } from '../context/MoisContext';
import { useArchetypeBinding, codeOf, toCodedValue, ArchetypeBinding } from './archetype-binding';
import { DateSelect } from '../controls/DateSelect';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';

// ============================================================================
// Section-aware data access
// ============================================================================

const useChartPreferenceBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ArchetypeBinding =>
  useArchetypeBinding({
    exampleData: (activeData) =>
      activeData.example?.demographics?.preferences?.[0]
      || activeData.example?.chartPreference,
    exampleTarget: (draft) => {
      draft.example = draft.example || {};
      return draft.example.demographics?.preferences?.[0]
        ?? (draft.example.chartPreference = draft.example.chartPreference || {});
    },
    section: sectionOverride,
  });

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
