/**
 * Connection Archetype
 * Components for displaying and updating user connections.
 *
 * MOIS parity notes (same contract as ChartPreference):
 * - Every field passes a stable fieldId (its Fields-map key) so section
 *   fieldPlacement can select and position it (`<Grid placement=...>`).
 * - `All` renders the fields as a Fragment in placement order — fields must be
 *   direct grid children for per-field gridArea to work.
 * - Fields read/write through the section's activeSelector when one is set,
 *   storing coded values as { code, display, system } objects like the real
 *   engine. Without a custom section they fall back to the JSON example data
 *   for gallery demos.
 */

import React from 'react';
import { IDropdownOption } from '@fluentui/react';
import { LayoutItem, ArchAll, AuditStamp } from '../components/Layout';
import { useCodeList, SectionContextValue } from '../context/MoisContext';
import { useArchetypeBinding, codeOf, ArchetypeBinding } from './archetype-binding';
import { DateSelect } from '../controls/DateSelect';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';

// Connection data interface
export interface ConnectionData {
  connectionId: number;
  patientId: number;
  connectionType: { code: string; display: string; system: string } | null;
  providerType: { code: string; display: string; system: string } | null;
  provider: { code: string | null; name: string; source: string; sourceId: number } | null;
  name: string;
  includeOnDemographics: { code: string; display: string; system: string } | null;
  isCareTeamMember: { code: string; display: string; system: string } | null;
  startDate: string | null;
  stopDate: string | null;
  stopReason: { code: string; display: string; system: string } | null;
  stopNote: string | null;
  comment: string | null;
  attachmentCount: number | null;
  stamp: {
    createTime: string;
    createUser: string;
    modifyTime: string | null;
    modifyUser: string | null;
  };
}

// Default connection data for examples
const defaultConnection: ConnectionData = {
  connectionId: 500036,
  patientId: 500063,
  connectionType: { code: 'PRIMARY', display: 'Primary Provider', system: 'MOIS-CONNECTIONTYPE' },
  providerType: { code: '100', display: 'PROVIDER (EXT)', system: 'MOIS-CONNECTIONPROVIDERTYPE' },
  provider: { code: null, name: 'FERREIRA, Stephan', source: 'ProviderExternal', sourceId: 10003148 },
  name: 'FERREIRA, Stephan',
  includeOnDemographics: { code: 'Y', display: 'Yes', system: 'MOIS-YESNO' },
  isCareTeamMember: { code: 'N', display: 'No', system: 'MOIS-YESNO' },
  startDate: null,
  stopDate: null,
  stopReason: null,
  stopNote: null,
  comment: null,
  attachmentCount: null,
  stamp: {
    createTime: '2017-03-17T12:21:13',
    createUser: 'ADMINISTRATOR',
    modifyTime: null,
    modifyUser: null,
  },
};

// ============================================================================
// Section-aware data access
// ============================================================================

const useConnectionBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ArchetypeBinding =>
  useArchetypeBinding({
    exampleData: (activeData) => activeData.example?.connection ?? defaultConnection,
    exampleTarget: (draft) => {
      draft.example = draft.example || {};
      return (draft.example.connection = draft.example.connection || {});
    },
    section: sectionOverride,
  });

const usePleaseSelectOptions = (codeSystem: string) => {
  const options = useCodeList(codeSystem);
  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];
  return { options, dropdownOptions };
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
  size: 'tiny' | 'small' | 'medium' | 'large'
): React.FC<FieldProps> => {
  const CodedField: React.FC<FieldProps> = ({ index, section, ...rest }) => {
    const { data, setField } = useConnectionBinding(section);
    const { options, dropdownOptions } = usePleaseSelectOptions(codeSystem);

    return (
      <LayoutItem fieldId={fieldId} label={label} size={size} index={index} section={section} {...rest}>
        <MoisDropdown
          fieldId={fieldId}
          codeSystem={codeSystem}
          selectedKey={codeOf(data?.[fieldId])}
          options={dropdownOptions}
          size={size}
          onChange={(_, option) => {
            const selected = options.find(o => o.code === option?.key);
            setField(
              fieldId,
              selected
                ? { code: selected.code, display: selected.display, system: selected.system }
                : null
            );
          }}
        />
      </LayoutItem>
    );
  };
  CodedField.displayName = `Connection.${fieldId}`;
  return CodedField;
};

const attachmentCount: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useConnectionBinding(section);
  const displayValue = data?.attachmentCount ? String(data.attachmentCount) : '';

  return (
    <LayoutItem fieldId="attachmentCount" label="Attached" size="tiny" index={index} section={section} {...rest}>
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

const comment: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useConnectionBinding(section);

  return (
    <LayoutItem fieldId="comment" label="General comment" size="max" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.comment || ''}
        multiline
        rows={3}
        size="max"
        onChange={(_, val) => setField('comment', val || '')}
      />
    </LayoutItem>
  );
};

const connectionType = makeCodedField('connectionType', 'Connection role', 'MOIS-CONNECTIONTYPE', 'small');
const includeOnDemographics = makeCodedField('includeOnDemographics', 'Show on demo.', 'MOIS-YESNO', 'small');
const isCareTeamMember = makeCodedField('isCareTeamMember', 'Care team member', 'MOIS-YESNO', 'small');

const patientId: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useConnectionBinding(section);

  return (
    <LayoutItem fieldId="patientId" label="Patient Id" size="tiny" index={index} section={section} {...rest}>
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

const provider: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useConnectionBinding(section);

  return (
    <LayoutItem fieldId="provider" label="Connection" size="large" index={index} section={section} {...rest}>
      <MoisTextField
        placeholder="Please search"
        value={data?.provider?.name || data?.name || ''}
        size="large"
        onChange={(_, val) => {
          setField(
            'provider',
            data?.provider
              ? { ...data.provider, name: val || '' }
              : { code: null, name: val || '', source: '', sourceId: 0 }
          );
          setField('name', val || '');
        }}
      />
    </LayoutItem>
  );
};

const providerType = makeCodedField('providerType', 'Connection resource', 'MOIS-CONNECTIONPROVIDERTYPE', 'medium');

const name: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useConnectionBinding(section);

  return (
    <LayoutItem fieldId="name" label="Provider name" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.name || ''}
        readOnly
        size="medium"
      />
    </LayoutItem>
  );
};

const stopDate: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useConnectionBinding(section);

  return (
    <LayoutItem fieldId="stopDate" label="End date" size="small" index={index} section={section} {...rest}>
      <DateSelect
        inline
        value={data?.stopDate || ''}
        size="small"
        onChange={(date) => setField('stopDate', date)}
      />
    </LayoutItem>
  );
};

const stopNote: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useConnectionBinding(section);

  return (
    <LayoutItem fieldId="stopNote" label="Stopped note" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.stopNote || ''}
        multiline
        rows={3}
        size="medium"
        onChange={(_, val) => setField('stopNote', val || '')}
      />
    </LayoutItem>
  );
};

const stopReason = makeCodedField('stopReason', 'Stopped reason', 'AIHS-STOPREASON', 'medium');

const stamp: React.FC<FieldProps> = ({ index, ...props }) => {
  return <AuditStamp fieldId="stamp" index={index} {...props} />;
};

const startDate: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useConnectionBinding(section);

  return (
    <LayoutItem fieldId="startDate" label="Start date" size="small" index={index} section={section} {...rest}>
      <DateSelect
        inline
        value={data?.startDate || ''}
        size="small"
        onChange={(date) => setField('startDate', date)}
      />
    </LayoutItem>
  );
};

// ============================================================================
// Fields Collection
// ============================================================================

const Fields = {
  attachmentCount,
  comment,
  connectionType,
  includeOnDemographics,
  isCareTeamMember,
  patientId,
  provider,
  providerType,
  name,
  stopDate,
  stopNote,
  stopReason,
  stamp,
  startDate,
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

export const Connection = {
  ...Fields,
  All,
  Fields,
};

export default Connection;
