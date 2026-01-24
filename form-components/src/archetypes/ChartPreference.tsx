/**
 * ChartPreference Archetype
 * Components for displaying and updating user preferences, consents, directives, etc.
 */

import React from 'react';
import { IDropdownOption } from '@fluentui/react';
import { LayoutItem, AuditStamp } from '../components/Layout';
import { useActiveData, useSourceData, useCodeList, ChartPreferenceData } from '../context/MoisContext';
import { DateSelect } from '../controls/DateSelect';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';

// ============================================================================
// Hook to get chart preference data from JSON
// ============================================================================

const useChartPreferenceData = (): ChartPreferenceData | undefined => {
  const [activeData] = useActiveData();
  // Use demographics.preferences[0] from JSON (primary) or fall back to chartPreference
  return (activeData as any).example?.demographics?.preferences?.[0]
    || (activeData as any).example?.chartPreference;
};

// ============================================================================
// Field Components
// ============================================================================

const attachmentCount: React.FC<any> = ({ index, ...props }) => {
  const data = useChartPreferenceData();
  const displayValue = data?.attachmentCount ? String(data.attachmentCount) : '';

  return (
    <LayoutItem label="Attached" size="tiny" index={index}>
      <MoisTextField
        value={displayValue}
        readOnly
        borderless
        tabIndex={-1}
        size="tiny"
      />
    </LayoutItem>
  );
};

const codedSubject: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();
  const options = useCodeList('MOIS-PREFSUBJECTCODE');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Subject code" size="medium" index={index}>
      <MoisDropdown
        fieldId="codedSubject"
        codeSystem="MOIS-PREFSUBJECTCODE"
        selectedKey={data?.codedSubject || ''}
        options={dropdownOptions}
        size="medium"
        onChange={(_, option) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, codedSubject: option?.key as string },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const classification: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();
  const options = useCodeList('MOIS-PREFERENCECLASSIFICATION');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Classification" size="small" index={index}>
      <MoisDropdown
        fieldId="classification"
        codeSystem="MOIS-PREFERENCECLASSIFICATION"
        selectedKey={data?.classification || ''}
        options={dropdownOptions}
        size="small"
        onChange={(_, option) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, classification: option?.key as string },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const encounterId: React.FC<any> = ({ index, ...props }) => {
  const data = useChartPreferenceData();

  return (
    <LayoutItem label="Encounter Id" size="tiny" index={index}>
      <MoisTextField
        value={data?.encounterId ? String(data.encounterId) : ''}
        readOnly
        borderless
        tabIndex={-1}
        size="tiny"
      />
    </LayoutItem>
  );
};

const endDate: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();

  return (
    <LayoutItem label="End date" size="small" index={index}>
      <DateSelect
        inline
        value={data?.endDate || ''}
        size="small"
        onChange={(date) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, endDate: date },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const includeOnDemographics: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();
  const options = useCodeList('MOIS-YESNO');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Show on demo." size="small" index={index}>
      <MoisDropdown
        fieldId="includeOnDemographics"
        codeSystem="MOIS-YESNO"
        selectedKey={data?.includeOnDemographics || ''}
        options={dropdownOptions}
        size="small"
        onChange={(_, option) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, includeOnDemographics: option?.key as string },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const instruction: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();
  const options = useCodeList('MOIS-PREFERENCEINSTRUCTION');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Instruction" size="medium" index={index}>
      <MoisDropdown
        fieldId="instruction"
        codeSystem="MOIS-PREFERENCEINSTRUCTION"
        selectedKey={data?.instruction || ''}
        options={dropdownOptions}
        size="medium"
        onChange={(_, option) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, instruction: option?.key as string },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};
const instructionDetail: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();

  return (
    <LayoutItem label="Instruction detail" size="medium" index={index}>
      <MoisTextField
        value={data?.instructionDetail || ''}
        multiline
        rows={3}
        size="medium"
        onChange={(_, val) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, instructionDetail: val || '' },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const patientId: React.FC<any> = ({ index, ...props }) => {
  const data = useChartPreferenceData();

  return (
    <LayoutItem label="Patient Id" size="tiny" index={index}>
      <MoisTextField
        value={data?.patientId ? String(data.patientId) : ''}
        readOnly
        borderless
        tabIndex={-1}
        size="tiny"
      />
    </LayoutItem>
  );
};

const preference: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();

  return (
    <LayoutItem label="Preference" size="medium" index={index}>
      <MoisTextField
        value={data?.preference || ''}
        size="medium"
        onChange={(_, val) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, preference: val || '' },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const preferenceType: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();
  const options = useCodeList('MOIS-PREFERENCETYPE');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Preference type" size="small" index={index}>
      <MoisDropdown
        selectedKey={data?.preferenceType || ''}
        options={dropdownOptions}
        size="small"
        onChange={(_, option) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, preferenceType: option?.key as string },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const reason: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();
  const options = useCodeList('MOIS-PREFERENCEREASON');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Reason" size="medium" index={index}>
      <MoisDropdown
        selectedKey={data?.reason || ''}
        options={dropdownOptions}
        size="medium"
        onChange={(_, option) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, reason: option?.key as string },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const reasonDetail: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();

  return (
    <LayoutItem label="Reason detail" size="medium" index={index}>
      <MoisTextField
        value={data?.reasonDetail || ''}
        multiline
        rows={3}
        size="medium"
        onChange={(_, val) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, reasonDetail: val || '' },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const sensitive: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();
  const options = useCodeList('MOIS-YESNO');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Sensitive" size="small" index={index}>
      <MoisDropdown
        selectedKey={data?.sensitive || ''}
        options={dropdownOptions}
        size="small"
        onChange={(_, option) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, sensitive: option?.key as string },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};
const stamp: React.FC<any> = ({ index, ...props }) => {
  return <AuditStamp index={index} {...props} />;
};

const startDate: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();

  return (
    <LayoutItem label="Start date" size="small" index={index}>
      <DateSelect
        inline
        value={data?.startDate || ''}
        size="small"
        onChange={(date) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, startDate: date },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const subjectCodeType: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();
  const options = useCodeList('MOIS-PREFERENCECODETYPE');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Code type" size="small" index={index}>
      <MoisDropdown
        selectedKey={data?.subjectCodeType || ''}
        options={dropdownOptions}
        size="small"
        onChange={(_, option) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, subjectCodeType: option?.key as string },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const subjectConceptName: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();

  return (
    <LayoutItem label="Concept" size="medium" index={index}>
      <MoisTextField
        value={data?.subjectConceptName || ''}
        size="medium"
        onChange={(_, val) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, subjectConceptName: val || '' },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

const subjectDetail: React.FC<any> = ({ index, ...props }) => {
  const [activeData, setActiveData] = useActiveData();
  const data = useChartPreferenceData();

  return (
    <LayoutItem label="Subject detail" size="medium" index={index}>
      <MoisTextField
        value={data?.subjectDetail || ''}
        multiline
        rows={3}
        size="medium"
        onChange={(_, val) => {
          setActiveData({
            example: {
              ...(activeData as any).example,
              chartPreference: { ...data, subjectDetail: val || '' },
            },
          } as any);
        }}
      />
    </LayoutItem>
  );
};

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
// All Component (renders all fields)
// ============================================================================

const All: React.FC<any> = (props) => {
  return (
    <div>
      <Fields.attachmentCount {...props} />
      <Fields.codedSubject {...props} />
      <Fields.classification {...props} />
      <Fields.encounterId {...props} />
      <Fields.endDate {...props} />
      <Fields.includeOnDemographics {...props} />
      <Fields.instruction {...props} />
      <Fields.instructionDetail {...props} />
      <Fields.patientId {...props} />
      <Fields.preference {...props} />
      <Fields.preferenceType {...props} />
      <Fields.reason {...props} />
      <Fields.reasonDetail {...props} />
      <Fields.sensitive {...props} />
      <Fields.stamp {...props} />
      <Fields.startDate {...props} />
      <Fields.subjectCodeType {...props} />
      <Fields.subjectConceptName {...props} />
      <Fields.subjectDetail {...props} />
    </div>
  );
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
