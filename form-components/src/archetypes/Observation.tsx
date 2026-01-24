/**
 * Observation Archetype
 * Components for displaying and updating observation/lab result data.
 *
 * Uses reusable controls: ButtonBar (for link buttons grouping)
 */

import React, { useState, useCallback } from 'react';
import { IDropdownOption, CommandButton, Pivot, PivotItem } from '@fluentui/react';
import { LayoutItem, AuditStamp } from '../components/Layout';
import { useActiveData, useCodeList } from '../context/MoisContext';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';
import { ButtonBar } from '../controls/ButtonBar';

// Observation data interface
export interface ObservationData {
  observationId: number;
  patientId: number;
  orderId: number | null;
  encounterId: number | null;
  panelName: string | null;
  sequenceInPanel: number | null;
  placerReference: string | null;
  copiesTo: string | null;
  className: string;
  description: string;
  observationCode: string;
  loincCode: string;
  observationClass: string;
  value: string;
  units: string;
  valueType: string;
  status: string;
  collectedDateTime: string | null;
  performedDateTime: string | null;
  performedBy: string | null;
  reportedBy: string | null;
  collectedBy: string | null;
  comment: string | null;
  report: string | null;
  interfaceNotes: string | null;
  abnormalFlag: { code: string; display: string; system: string } | null;
  recordState: { code: string; display: string; system: string } | null;
  referenceRangeText: string | null;
  rangeNormalLow: string | null;
  rangeNormalHigh: string | null;
  rangeVeryLow: string | null;
  rangeVeryHigh: string | null;
  rangeAbsurdLow: string | null;
  rangeAbsurdHigh: string | null;
  attachmentCount: number | null;
  stamp: {
    createTime: string;
    createUser: string;
    modifyTime: string | null;
    modifyUser: string | null;
  };
}

// Default observation data for examples
const defaultObservation: ObservationData = {
  observationId: 502222,
  patientId: 500063,
  orderId: null,
  encounterId: null,
  panelName: 'CBC w/ Diff',
  sequenceInPanel: 1,
  placerReference: '',
  copiesTo: '',
  className: 'Observation',
  description: 'WBC',
  observationCode: '288',
  loincCode: '26464-8',
  observationClass: 'HEM/BC',
  value: '5.0',
  units: 'x10(9)/L',
  valueType: 'NUMERIC',
  status: 'F',
  collectedDateTime: '2018-04-20T09:10:00',
  performedDateTime: '2018-04-20T11:19:00',
  performedBy: null,
  reportedBy: null,
  collectedBy: 'LEEDHAM Carter',
  comment: null,
  report: '',
  interfaceNotes: '',
  abnormalFlag: { code: '', display: '', system: 'MOIS-ABNORMALFLAG' },
  recordState: { code: 'SIGNED', display: 'Signed', system: 'MOIS-RECORDSTATE' },
  referenceRangeText: null,
  rangeNormalLow: '4.0',
  rangeNormalHigh: '10.0',
  rangeVeryLow: null,
  rangeVeryHigh: null,
  rangeAbsurdLow: null,
  rangeAbsurdHigh: null,
  attachmentCount: null,
  stamp: {
    createTime: '2019-05-16T08:47:25',
    createUser: 'INTERFACE',
    modifyTime: null,
    modifyUser: null,
  },
};

// Helper to get observation data from active data
const useObservationData = (): [ObservationData, (updates: Partial<ObservationData>) => void] => {
  const [activeData, setActiveData] = useActiveData();
  const data = (activeData as any).example?.observation as ObservationData | undefined;

  // Memoize setData to prevent infinite re-renders
  const setData = useCallback((updates: Partial<ObservationData>) => {
    setActiveData((current: any) => ({
      ...current,
      example: {
        ...current.example,
        observation: { ...current.example?.observation, ...updates },
      },
    }));
  }, [setActiveData]);

  return [data || defaultObservation, setData];
};

// ============================================================================
// Field Components
// ============================================================================

// Link button fields
const patient: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem size="small" index={index}>
      <CommandButton
        iconProps={{ iconName: 'PreviewLink' }}
        text={`Patient: ${data?.patientId || 'Not linked'}`}
      />
    </LayoutItem>
  );
};

const order: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem size="small" index={index}>
      <CommandButton
        iconProps={{ iconName: 'PreviewLink' }}
        text={data?.orderId ? `Order: ${data.orderId}` : 'Order: Not linked'}
        disabled={!data?.orderId}
      />
    </LayoutItem>
  );
};

const encounter: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem size="small" index={index}>
      <CommandButton
        iconProps={{ iconName: 'PreviewLink' }}
        text={data?.encounterId ? `Encounter: ${data.encounterId}` : 'Encounter: Not linked'}
        disabled={!data?.encounterId}
      />
    </LayoutItem>
  );
};

const panel: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem size="small" index={index}>
      <CommandButton
        iconProps={{ iconName: 'RowsGroup' }}
        text={data?.panelName ? `Panel: ${data.panelName}` : 'Panel: Not linked'}
        disabled={!data?.panelName}
      />
    </LayoutItem>
  );
};

const sequenceInPanel: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem label="Sequence in panel" size="tiny" index={index}>
      <MoisTextField
        value={data?.sequenceInPanel ? String(data.sequenceInPanel) : ''}
        readOnly
        borderless
        size="tiny"
      />
    </LayoutItem>
  );
};

const placerReference: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Placer reference" size="medium" index={index}>
      <MoisTextField
        value={data?.placerReference || ''}
        size="medium"
        onChange={(_, val) => setData({ placerReference: val || '' })}
      />
    </LayoutItem>
  );
};

const copiesTo: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Copies to" size="medium" index={index}>
      <MoisTextField
        value={data?.copiesTo || ''}
        size="medium"
        onChange={(_, val) => setData({ copiesTo: val || '' })}
      />
    </LayoutItem>
  );
};

const status: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Status" size="tiny" index={index}>
      <MoisTextField
        value={data?.status || ''}
        size="tiny"
        onChange={(_, val) => setData({ status: val || '' })}
      />
    </LayoutItem>
  );
};

const performedDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Performed" size="small" index={index}>
      <MoisTextField
        value={data?.performedDateTime || ''}
        placeholder="yyyy-mm-ddThh:mm:ss"
        size="small"
        onChange={(_, val) => setData({ performedDateTime: val || '' })}
      />
    </LayoutItem>
  );
};

const performedBy: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Performed by" size="small" index={index}>
      <MoisTextField
        value={data?.performedBy || ''}
        size="small"
        onChange={(_, val) => setData({ performedBy: val || '' })}
      />
    </LayoutItem>
  );
};

const reportedBy: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Reporter" size="small" index={index}>
      <MoisTextField
        value={data?.reportedBy || ''}
        size="small"
        onChange={(_, val) => setData({ reportedBy: val || '' })}
      />
    </LayoutItem>
  );
};

const observationCode: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Code" size="tiny" index={index}>
      <MoisTextField
        value={data?.observationCode || ''}
        size="tiny"
        onChange={(_, val) => setData({ observationCode: val || '' })}
      />
    </LayoutItem>
  );
};

const description: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Description" size="medium" index={index}>
      <MoisTextField
        value={data?.description || ''}
        size="medium"
        onChange={(_, val) => setData({ description: val || '' })}
      />
    </LayoutItem>
  );
};

const observationClass: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Classification" size="small" index={index}>
      <MoisTextField
        value={data?.observationClass || ''}
        size="small"
        onChange={(_, val) => setData({ observationClass: val || '' })}
      />
    </LayoutItem>
  );
};

const loincCode: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="LOINC code" size="tiny" index={index}>
      <MoisTextField
        value={data?.loincCode || ''}
        size="tiny"
        onChange={(_, val) => setData({ loincCode: val || '' })}
      />
    </LayoutItem>
  );
};

const valueType: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Value type" size="tiny" index={index}>
      <MoisTextField
        value={data?.valueType || ''}
        size="tiny"
        onChange={(_, val) => setData({ valueType: val || '' })}
      />
    </LayoutItem>
  );
};

const value: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="value" size="medium" index={index}>
      <MoisTextField
        value={data?.value || ''}
        size="medium"
        onChange={(_, val) => setData({ value: val || '' })}
      />
    </LayoutItem>
  );
};

const units: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Units" size="tiny" index={index}>
      <MoisTextField
        value={data?.units || ''}
        size="tiny"
        onChange={(_, val) => setData({ units: val || '' })}
      />
    </LayoutItem>
  );
};

const comment: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Comment" size="max" index={index}>
      <MoisTextField
        value={data?.comment || ''}
        multiline
        size="max"
        onChange={(_, val) => setData({ comment: val || '' })}
      />
    </LayoutItem>
  );
};

const report: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();
  const [selectedKey, setSelectedKey] = useState('Edit');

  return (
    <LayoutItem label="Report" size="max" index={index}>
      <div style={{ margin: '-6px 0 0', flex: '1 1 auto' }}>
        <Pivot
          selectedKey={selectedKey}
          onLinkClick={(item) => setSelectedKey(item?.props.itemKey || 'Edit')}
        >
          <PivotItem headerText="Preview" itemKey="Preview">
            <div style={{ margin: '15px 0' }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{data?.report || ''}</div>
            </div>
          </PivotItem>
          <PivotItem headerText="Edit" itemKey="Edit">
            <div style={{ margin: '15px 0' }}>
              <LayoutItem size="max" index={0}>
                <MoisTextField
                  value={data?.report || ''}
                  multiline
                  rows={6}
                  size="max"
                  onChange={(_, val) => setData({ report: val || '' })}
                />
              </LayoutItem>
            </div>
          </PivotItem>
        </Pivot>
      </div>
    </LayoutItem>
  );
};

const abnormalFlag: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();
  const options = useCodeList('MOIS-ABNORMALFLAG');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.filter(opt => opt.code !== '').map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Flag" index={index}>
      <MoisDropdown
        selectedKey={data?.abnormalFlag?.code || ''}
        options={dropdownOptions}
        onChange={(_, option) => {
          const selected = options.find(o => o.code === option?.key);
          setData({
            abnormalFlag: selected ? { code: selected.code, display: selected.display, system: selected.system } : null,
          });
        }}
      />
    </LayoutItem>
  );
};

const interfaceNotes: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Interface notes" size="medium" index={index}>
      <MoisTextField
        value={data?.interfaceNotes || ''}
        size="medium"
        onChange={(_, val) => setData({ interfaceNotes: val || '' })}
      />
    </LayoutItem>
  );
};

const referenceRangeText: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();

  return (
    <LayoutItem label="Reference range" size="small" index={index}>
      <MoisTextField
        value={data?.referenceRangeText || ''}
        size="small"
        onChange={(_, val) => setData({ referenceRangeText: val || '' })}
      />
    </LayoutItem>
  );
};

const rangeNormalLow: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem label="Low normal" size="small" index={index}>
      <MoisTextField
        value={data?.rangeNormalLow || ''}
        readOnly
        borderless
        size="small"
      />
    </LayoutItem>
  );
};

const rangeNormalHigh: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem label="High normal" size="small" index={index}>
      <MoisTextField
        value={data?.rangeNormalHigh || ''}
        readOnly
        borderless
        size="small"
      />
    </LayoutItem>
  );
};

const rangeVeryLow: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem label="Very low" size="small" index={index}>
      <MoisTextField
        value={data?.rangeVeryLow || ''}
        readOnly
        borderless
        size="small"
      />
    </LayoutItem>
  );
};

const rangeVeryHigh: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem label="Very high" size="small" index={index}>
      <MoisTextField
        value={data?.rangeVeryHigh || ''}
        readOnly
        borderless
        size="small"
      />
    </LayoutItem>
  );
};

const rangeAbsurdLow: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem label="Absurdly low" size="small" index={index}>
      <MoisTextField
        value={data?.rangeAbsurdLow || ''}
        readOnly
        borderless
        size="small"
      />
    </LayoutItem>
  );
};

const rangeAbsurdHigh: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem label="Absurdly high" size="small" index={index}>
      <MoisTextField
        value={data?.rangeAbsurdHigh || ''}
        readOnly
        borderless
        size="small"
      />
    </LayoutItem>
  );
};

const attachmentCount: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationData();

  return (
    <LayoutItem label="Attachments" size="tiny" index={index}>
      <MoisTextField
        value={data?.attachmentCount ? String(data.attachmentCount) : ''}
        readOnly
        borderless
        size="tiny"
      />
    </LayoutItem>
  );
};

const recordState: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationData();
  const options = useCodeList('MOIS-RECORDSTATE');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Record state" index={index}>
      <MoisDropdown
        selectedKey={data?.recordState?.code || ''}
        options={dropdownOptions}
        onChange={(_, option) => {
          const selected = options.find(o => o.code === option?.key);
          setData({
            recordState: selected ? { code: selected.code, display: selected.display, system: selected.system } : null,
          });
        }}
      />
    </LayoutItem>
  );
};

const stamp: React.FC<any> = ({ index, ...props }) => {
  return <AuditStamp index={index} {...props} />;
};

// ============================================================================
// Fields Collection
// ============================================================================

const Fields = {
  patient,
  order,
  encounter,
  panel,
  sequenceInPanel,
  placerReference,
  copiesTo,
  status,
  performedDateTime,
  performedBy,
  reportedBy,
  observationCode,
  description,
  observationClass,
  loincCode,
  valueType,
  value,
  units,
  comment,
  report,
  abnormalFlag,
  interfaceNotes,
  referenceRangeText,
  rangeNormalLow,
  rangeNormalHigh,
  rangeVeryLow,
  rangeVeryHigh,
  rangeAbsurdLow,
  rangeAbsurdHigh,
  attachmentCount,
  recordState,
  stamp,
};

// ============================================================================
// LinksBar - Groups navigation link buttons together
// ============================================================================

const LinksBar: React.FC<any> = (props) => {
  const [data] = useObservationData();

  return (
    <ButtonBar gap={4} padding="8px 0">
      <CommandButton
        iconProps={{ iconName: 'PreviewLink' }}
        text={`Patient: ${data?.patientId || 'Not linked'}`}
      />
      <CommandButton
        iconProps={{ iconName: 'PreviewLink' }}
        text={data?.orderId ? `Order: ${data.orderId}` : 'Order: Not linked'}
        disabled={!data?.orderId}
      />
      <CommandButton
        iconProps={{ iconName: 'PreviewLink' }}
        text={data?.encounterId ? `Encounter: ${data.encounterId}` : 'Encounter: Not linked'}
        disabled={!data?.encounterId}
      />
      <CommandButton
        iconProps={{ iconName: 'RowsGroup' }}
        text={data?.panelName ? `Panel: ${data.panelName}` : 'Panel: Not linked'}
        disabled={!data?.panelName}
      />
    </ButtonBar>
  );
};

// ============================================================================
// All Component (renders all fields in correct order)
// ============================================================================

const All: React.FC<any> = (props) => {
  return (
    <div>
      <LinksBar {...props} />
      <Fields.sequenceInPanel {...props} />
      <Fields.placerReference {...props} />
      <Fields.copiesTo {...props} />
      <Fields.status {...props} />
      <Fields.performedDateTime {...props} />
      <Fields.performedBy {...props} />
      <Fields.reportedBy {...props} />
      <Fields.observationCode {...props} />
      <Fields.description {...props} />
      <Fields.observationClass {...props} />
      <Fields.loincCode {...props} />
      <Fields.valueType {...props} />
      <Fields.value {...props} />
      <Fields.units {...props} />
      <Fields.comment {...props} />
      <Fields.report {...props} />
      <Fields.abnormalFlag {...props} />
      <Fields.interfaceNotes {...props} />
      <Fields.referenceRangeText {...props} />
      <Fields.rangeNormalLow {...props} />
      <Fields.rangeNormalHigh {...props} />
      <Fields.rangeVeryLow {...props} />
      <Fields.rangeVeryHigh {...props} />
      <Fields.rangeAbsurdLow {...props} />
      <Fields.rangeAbsurdHigh {...props} />
      <Fields.attachmentCount {...props} />
      <Fields.recordState {...props} />
      <Fields.stamp {...props} />
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export const Observation = {
  ...Fields,
  All,
  Fields,
  LinksBar,
};

export default Observation;
