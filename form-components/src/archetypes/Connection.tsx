/**
 * Connection Archetype
 * Components for displaying and updating user connections.
 */

import React, { useCallback } from 'react';
import { IDropdownOption } from '@fluentui/react';
import { LayoutItem, AuditStamp } from '../components/Layout';
import { useActiveData, useCodeList } from '../context/MoisContext';
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

// Helper to get connection data from active data
const useConnectionData = (): [ConnectionData, (updates: Partial<ConnectionData>) => void] => {
  const [activeData, setActiveData] = useActiveData();
  const data = (activeData as any).example?.connection as ConnectionData | undefined;

  // Memoize setData to prevent infinite re-renders
  const setData = useCallback((updates: Partial<ConnectionData>) => {
    setActiveData((current: any) => ({
      ...current,
      example: {
        ...current.example,
        connection: { ...current.example?.connection, ...updates },
      },
    }));
  }, [setActiveData]);

  return [data || defaultConnection, setData];
};

// ============================================================================
// Field Components
// ============================================================================

const attachmentCount: React.FC<any> = ({ index, ...props }) => {
  const [data] = useConnectionData();
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

const comment: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();

  return (
    <LayoutItem label="General comment" size="max" index={index}>
      <MoisTextField
        value={data?.comment || ''}
        multiline
        rows={3}
        size="max"
        onChange={(_, val) => setData({ comment: val || '' })}
      />
    </LayoutItem>
  );
};

const connectionType: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();
  const options = useCodeList('MOIS-CONNECTIONTYPE');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Connection role" size="small" index={index}>
      <MoisDropdown
        selectedKey={data?.connectionType?.code || ''}
        options={dropdownOptions}
        size="small"
        onChange={(_, option) => {
          const selected = options.find(o => o.code === option?.key);
          setData({
            connectionType: selected ? { code: selected.code, display: selected.display, system: selected.system } : null,
          });
        }}
      />
    </LayoutItem>
  );
};

const includeOnDemographics: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();
  const options = useCodeList('MOIS-YESNO');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Show on demo." size="small" index={index}>
      <MoisDropdown
        selectedKey={data?.includeOnDemographics?.code || ''}
        options={dropdownOptions}
        size="small"
        onChange={(_, option) => {
          const selected = options.find(o => o.code === option?.key);
          setData({
            includeOnDemographics: selected ? { code: selected.code, display: selected.display, system: selected.system } : null,
          });
        }}
      />
    </LayoutItem>
  );
};

const isCareTeamMember: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();
  const options = useCodeList('MOIS-YESNO');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Care team member" size="small" index={index}>
      <MoisDropdown
        selectedKey={data?.isCareTeamMember?.code || ''}
        options={dropdownOptions}
        size="small"
        onChange={(_, option) => {
          const selected = options.find(o => o.code === option?.key);
          setData({
            isCareTeamMember: selected ? { code: selected.code, display: selected.display, system: selected.system } : null,
          });
        }}
      />
    </LayoutItem>
  );
};

const patientId: React.FC<any> = ({ index, ...props }) => {
  const [data] = useConnectionData();

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

const provider: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();

  return (
    <LayoutItem label="Connection" size="large" index={index}>
      <MoisTextField
        placeholder="Please search"
        value={data?.provider?.name || data?.name || ''}
        size="large"
        onChange={(_, val) => {
          setData({
            provider: data?.provider ? { ...data.provider, name: val || '' } : { code: null, name: val || '', source: '', sourceId: 0 },
            name: val || '',
          });
        }}
      />
    </LayoutItem>
  );
};

const providerType: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();
  const options = useCodeList('MOIS-CONNECTIONPROVIDERTYPE');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Connection resource" size="medium" index={index}>
      <MoisDropdown
        selectedKey={data?.providerType?.code || ''}
        options={dropdownOptions}
        size="medium"
        onChange={(_, option) => {
          const selected = options.find(o => o.code === option?.key);
          setData({
            providerType: selected ? { code: selected.code, display: selected.display, system: selected.system } : null,
          });
        }}
      />
    </LayoutItem>
  );
};

const name: React.FC<any> = ({ index, ...props }) => {
  const [data] = useConnectionData();

  return (
    <LayoutItem label="Provider name" size="medium" index={index}>
      <MoisTextField
        value={data?.name || ''}
        readOnly
        size="medium"
      />
    </LayoutItem>
  );
};

const stopDate: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();

  return (
    <LayoutItem label="End date" size="small" index={index}>
      <DateSelect
        inline
        value={data?.stopDate || ''}
        size="small"
        onChange={(date) => setData({ stopDate: date })}
      />
    </LayoutItem>
  );
};

const stopNote: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();

  return (
    <LayoutItem label="Stopped note" size="medium" index={index}>
      <MoisTextField
        value={data?.stopNote || ''}
        multiline
        rows={3}
        size="medium"
        onChange={(_, val) => setData({ stopNote: val || '' })}
      />
    </LayoutItem>
  );
};

const stopReason: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();
  const options = useCodeList('AIHS-STOPREASON');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Stopped reason" size="medium" index={index}>
      <MoisDropdown
        selectedKey={data?.stopReason?.code || ''}
        options={dropdownOptions}
        size="medium"
        onChange={(_, option) => {
          const selected = options.find(o => o.code === option?.key);
          setData({
            stopReason: selected ? { code: selected.code, display: selected.display, system: selected.system } : null,
          });
        }}
      />
    </LayoutItem>
  );
};

const stamp: React.FC<any> = ({ index, ...props }) => {
  return <AuditStamp index={index} {...props} />;
};

const startDate: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useConnectionData();

  return (
    <LayoutItem label="Start date" size="small" index={index}>
      <DateSelect
        inline
        value={data?.startDate || ''}
        size="small"
        onChange={(date) => setData({ startDate: date })}
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
// All Component (renders all fields)
// ============================================================================

const All: React.FC<any> = (props) => {
  return (
    <div>
      <Fields.attachmentCount {...props} />
      <Fields.comment {...props} />
      <Fields.connectionType {...props} />
      <Fields.includeOnDemographics {...props} />
      <Fields.isCareTeamMember {...props} />
      <Fields.patientId {...props} />
      <Fields.provider {...props} />
      <Fields.providerType {...props} />
      <Fields.name {...props} />
      <Fields.stopDate {...props} />
      <Fields.stopNote {...props} />
      <Fields.stopReason {...props} />
      <Fields.stamp {...props} />
      <Fields.startDate {...props} />
    </div>
  );
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
