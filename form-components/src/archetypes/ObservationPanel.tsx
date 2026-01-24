/**
 * ObservationPanel Archetype
 * Components for displaying and updating observation panel/lab panel data.
 * An observation panel contains one or more observations.
 *
 * Uses reusable controls: ListSelection (for observations table)
 */

import React, { useCallback } from 'react';
import { IDropdownOption, CommandButton, IColumn } from '@fluentui/react';
import { LayoutItem, AuditStamp } from '../components/Layout';
import { useActiveData, useCodeList } from '../context/MoisContext';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';
import { ListSelection } from '../controls/ListSelection';

// Observation item in panel
export interface ObservationItem {
  observationId: number;
  collectedDateTime: string | null;
  observationCode: string;
  description: string;
  value: string;
  abnormalFlag: string | null;
}

// ObservationPanel data interface
export interface ObservationPanelData {
  observationPanelId: number;
  panelName: string;
  orderDateTime: string | null;
  collectedDateTime: string | null;
  specimenReceivedDateTime: string | null;
  placerReferenceNumber: string | null;
  fillerReferenceNumber: string | null;
  orderedBy: string | null;
  orderingSystem: string | null;
  reportedDateTime: string | null;
  status: string | null;
  collectedComment: string | null;
  facility: string | null;
  copyTo: string | null;
  notes: string | null;
  interfaceType: string | null;
  messageSequenceNumber: number | null;
  collectionVolume: string | null;
  collectedBy: string | null;
  specimenSource: string | null;
  orderingSource: string | null;
  universalServiceCode: string | null;
  orderingProviderRef: string | null;
  diagnosticServiceSection: string | null;
  observations: ObservationItem[];
  stamp: {
    createTime: string;
    createUser: string;
    modifyTime: string | null;
    modifyUser: string | null;
  };
}

// Helper to get observation panel data from active data (data comes from MoisContext)
const useObservationPanelData = (): [ObservationPanelData, (updates: Partial<ObservationPanelData>) => void] => {
  const [activeData, setActiveData] = useActiveData();
  const data = (activeData as any).example?.observationPanel as ObservationPanelData;

  // Memoize setData to prevent infinite re-renders
  const setData = useCallback((updates: Partial<ObservationPanelData>) => {
    setActiveData((current: any) => ({
      ...current,
      example: {
        ...current.example,
        observationPanel: { ...current.example?.observationPanel, ...updates },
      },
    }));
  }, [setActiveData]);

  return [data, setData];
};

// ============================================================================
// Pre-configured columns for observations table
// ============================================================================

const observationColumns: IColumn[] = [
  { key: 'collectedDateTime', name: 'Date', fieldName: 'collectedDateTime', minWidth: 130, maxWidth: 130 },
  { key: 'observationCode', name: 'Code', fieldName: 'observationCode', minWidth: 50, maxWidth: 50 },
  { key: 'description', name: 'Test name', fieldName: 'description', minWidth: 200, maxWidth: 280, isMultiline: true },
  { key: 'value', name: 'Value', fieldName: 'value', minWidth: 150, maxWidth: 180, isMultiline: true },
  {
    key: 'abnormalFlag',
    name: 'Flag',
    fieldName: 'abnormalFlag',
    minWidth: 25,
    maxWidth: 30,
    onRender: (item: any) => {
      // abnormalFlag can be a string or {code, display, system} object
      const flag = item?.abnormalFlag;
      if (!flag) return null;
      if (typeof flag === 'string') return flag;
      return flag.display || flag.code || '';
    }
  },
];

// ============================================================================
// Field Components
// ============================================================================

// Observations table - uses ListSelection for consistent styling
const observations: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationPanelData();

  return (
    <ListSelection
      fieldId="observations"
      items={data?.observations || []}
      columns={observationColumns}
      selectionType="none"
      selectText="View observations"
      labelPosition="none"
      {...props}
    />
  );
};

const panelName: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();
  const options = useCodeList('MOIS-PANELNAME');

  const dropdownOptions: IDropdownOption[] = [
    { key: 'CBC w/ Diff', text: 'CBC w/ Diff' },
    { key: 'Basic Metabolic Panel', text: 'Basic Metabolic Panel' },
    { key: 'Comprehensive Metabolic Panel', text: 'Comprehensive Metabolic Panel' },
    { key: 'Lipid Panel', text: 'Lipid Panel' },
    { key: 'Liver Function Panel', text: 'Liver Function Panel' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  return (
    <LayoutItem label="Panel name" size="medium" index={index}>
      <MoisDropdown
        selectedKey={data?.panelName || ''}
        options={dropdownOptions}
        size="medium"
        onChange={(_, option) => setData({ panelName: String(option?.key || '') })}
      />
    </LayoutItem>
  );
};

const orderDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Ordered" size="small" index={index}>
      <MoisTextField
        value={data?.orderDateTime || ''}
        placeholder="yyyy-mm-ddThh:mm:ss"
        size="small"
        onChange={(_, val) => setData({ orderDateTime: val || '' })}
      />
    </LayoutItem>
  );
};

const collectedDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Collected" size="small" index={index}>
      <MoisTextField
        value={data?.collectedDateTime || ''}
        placeholder="yyyy-mm-ddThh:mm:ss"
        size="small"
        onChange={(_, val) => setData({ collectedDateTime: val || '' })}
      />
    </LayoutItem>
  );
};

const specimenReceivedDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Specimen received" size="small" index={index}>
      <MoisTextField
        value={data?.specimenReceivedDateTime || ''}
        placeholder="yyyy-mm-ddThh:mm:ss"
        size="small"
        onChange={(_, val) => setData({ specimenReceivedDateTime: val || '' })}
      />
    </LayoutItem>
  );
};

const placerReferenceNumber: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Placer reference" size="medium" index={index}>
      <MoisTextField
        value={data?.placerReferenceNumber || ''}
        size="medium"
        onChange={(_, val) => setData({ placerReferenceNumber: val || '' })}
      />
    </LayoutItem>
  );
};

const fillerReferenceNumber: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Filler reference" size="medium" index={index}>
      <MoisTextField
        value={data?.fillerReferenceNumber || ''}
        size="medium"
        onChange={(_, val) => setData({ fillerReferenceNumber: val || '' })}
      />
    </LayoutItem>
  );
};

const orderedBy: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Ordered by" size="medium" index={index}>
      <MoisTextField
        value={data?.orderedBy || ''}
        size="medium"
        onChange={(_, val) => setData({ orderedBy: val || '' })}
      />
    </LayoutItem>
  );
};

const orderingSystem: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Ordering system" size="medium" index={index}>
      <MoisTextField
        value={data?.orderingSystem || ''}
        size="medium"
        onChange={(_, val) => setData({ orderingSystem: val || '' })}
      />
    </LayoutItem>
  );
};

const reportedDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Reported" size="small" index={index}>
      <MoisTextField
        value={data?.reportedDateTime || ''}
        placeholder="yyyy-mm-ddThh:mm:ss"
        size="small"
        onChange={(_, val) => setData({ reportedDateTime: val || '' })}
      />
    </LayoutItem>
  );
};

const status: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Result status" size="medium" index={index}>
      <MoisTextField
        value={data?.status || ''}
        size="medium"
        onChange={(_, val) => setData({ status: val || '' })}
      />
    </LayoutItem>
  );
};

const collectedComment: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Comment at collection" size="medium" index={index}>
      <MoisTextField
        value={data?.collectedComment || ''}
        size="medium"
        onChange={(_, val) => setData({ collectedComment: val || '' })}
      />
    </LayoutItem>
  );
};

const facility: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Facility" size="medium" index={index}>
      <MoisTextField
        value={data?.facility || ''}
        size="medium"
        onChange={(_, val) => setData({ facility: val || '' })}
      />
    </LayoutItem>
  );
};

const copyTo: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Copies to" size="medium" index={index}>
      <MoisTextField
        value={data?.copyTo || ''}
        size="medium"
        onChange={(_, val) => setData({ copyTo: val || '' })}
      />
    </LayoutItem>
  );
};

const notes: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Notes" size="max" index={index}>
      <MoisTextField
        value={data?.notes || ''}
        multiline
        size="max"
        onChange={(_, val) => setData({ notes: val || '' })}
      />
    </LayoutItem>
  );
};

const interfaceType: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Interface type" size="medium" index={index}>
      <MoisTextField
        value={data?.interfaceType || ''}
        size="medium"
        onChange={(_, val) => setData({ interfaceType: val || '' })}
      />
    </LayoutItem>
  );
};

const messageSequenceNumber: React.FC<any> = ({ index, ...props }) => {
  const [data] = useObservationPanelData();

  return (
    <LayoutItem label="Sequence in bundle" size="small" index={index}>
      <MoisTextField
        value={data?.messageSequenceNumber ? String(data.messageSequenceNumber) : ''}
        readOnly
        borderless
        size="small"
      />
    </LayoutItem>
  );
};

const collectionVolume: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Collection volume" size="medium" index={index}>
      <MoisTextField
        value={data?.collectionVolume || ''}
        size="medium"
        onChange={(_, val) => setData({ collectionVolume: val || '' })}
      />
    </LayoutItem>
  );
};

const collectedBy: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Collected by" size="medium" index={index}>
      <MoisTextField
        value={data?.collectedBy || ''}
        size="medium"
        onChange={(_, val) => setData({ collectedBy: val || '' })}
      />
    </LayoutItem>
  );
};

const specimenSource: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Specimen source" size="medium" index={index}>
      <MoisTextField
        value={data?.specimenSource || ''}
        size="medium"
        onChange={(_, val) => setData({ specimenSource: val || '' })}
      />
    </LayoutItem>
  );
};

const orderingSource: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Ordering source" size="medium" index={index}>
      <MoisTextField
        value={data?.orderingSource || ''}
        size="medium"
        onChange={(_, val) => setData({ orderingSource: val || '' })}
      />
    </LayoutItem>
  );
};

const universalServiceCode: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Universal service code" size="medium" index={index}>
      <MoisTextField
        value={data?.universalServiceCode || ''}
        size="medium"
        onChange={(_, val) => setData({ universalServiceCode: val || '' })}
      />
    </LayoutItem>
  );
};

const orderingProviderRef: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Ordering provider reference" size="medium" index={index}>
      <MoisTextField
        value={data?.orderingProviderRef || ''}
        size="medium"
        onChange={(_, val) => setData({ orderingProviderRef: val || '' })}
      />
    </LayoutItem>
  );
};

const diagnosticServiceSection: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useObservationPanelData();

  return (
    <LayoutItem label="Diagnostic service section" size="medium" index={index}>
      <MoisTextField
        value={data?.diagnosticServiceSection || ''}
        size="medium"
        onChange={(_, val) => setData({ diagnosticServiceSection: val || '' })}
      />
    </LayoutItem>
  );
};

const stamp: React.FC<any> = ({ index, ...props }) => {
  return <AuditStamp index={index} {...props} />;
};

// Link component - shows a button linking to the panel
const Link: React.FC<{ observationPanelId?: number; index?: number }> = ({ observationPanelId, index, ...props }) => {
  const [data] = useObservationPanelData();
  const panelId = observationPanelId || data?.observationPanelId;

  return (
    <LayoutItem size="small" index={index}>
      <CommandButton
        iconProps={{ iconName: 'RowsGroup' }}
        text={`Panel: ${data?.panelName || 'Unknown'}`}
        disabled={!panelId}
      />
    </LayoutItem>
  );
};

// ============================================================================
// Fields Collection
// ============================================================================

const Fields = {
  observations,
  panelName,
  orderDateTime,
  collectedDateTime,
  specimenReceivedDateTime,
  placerReferenceNumber,
  fillerReferenceNumber,
  orderedBy,
  orderingSystem,
  reportedDateTime,
  status,
  collectedComment,
  facility,
  copyTo,
  notes,
  interfaceType,
  messageSequenceNumber,
  collectionVolume,
  collectedBy,
  specimenSource,
  orderingSource,
  universalServiceCode,
  orderingProviderRef,
  diagnosticServiceSection,
  stamp,
};

// ============================================================================
// All Component (renders all fields in correct order)
// ============================================================================

const All: React.FC<any> = (props) => {
  return (
    <div>
      <Fields.observations {...props} />
      <Fields.panelName {...props} />
      <Fields.orderDateTime {...props} />
      <Fields.collectedDateTime {...props} />
      <Fields.specimenReceivedDateTime {...props} />
      <Fields.placerReferenceNumber {...props} />
      <Fields.fillerReferenceNumber {...props} />
      <Fields.orderedBy {...props} />
      <Fields.orderingSystem {...props} />
      <Fields.reportedDateTime {...props} />
      <Fields.status {...props} />
      <Fields.collectedComment {...props} />
      <Fields.facility {...props} />
      <Fields.copyTo {...props} />
      <Fields.notes {...props} />
      <Fields.interfaceType {...props} />
      <Fields.messageSequenceNumber {...props} />
      <Fields.collectionVolume {...props} />
      <Fields.collectedBy {...props} />
      <Fields.specimenSource {...props} />
      <Fields.orderingSource {...props} />
      <Fields.universalServiceCode {...props} />
      <Fields.orderingProviderRef {...props} />
      <Fields.diagnosticServiceSection {...props} />
      <Fields.stamp {...props} />
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export const ObservationPanel = {
  ...Fields,
  All,
  Link,
  Fields,
};

export default ObservationPanel;
