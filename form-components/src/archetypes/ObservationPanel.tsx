/**
 * ObservationPanel Archetype
 * Components for displaying and updating observation panel/lab panel data.
 * An observation panel contains one or more observations.
 *
 * Uses reusable controls: ListSelection (for observations table)
 *
 * MOIS parity notes (see ChartPreference.tsx for the reference port):
 * - Every field passes a stable fieldId (its Fields-map key) so section
 *   fieldPlacement can select and position it (`<Grid placement=...>`).
 * - `All` renders the fields as a Fragment in placement order — fields must be
 *   direct grid children for per-field gridArea to work.
 * - Fields read/write through the section's activeSelector when one is set,
 *   falling back to the JSON example data (example.observationPanel) for
 *   gallery demos.
 */

import React, { useCallback } from 'react';
import { IDropdownOption, CommandButton, IColumn } from '@fluentui/react';
import { LayoutItem, ArchAll, AuditStamp } from '../components/Layout';
import { useActiveData, useCodeList, SectionContextValue } from '../context/MoisContext';
import { useArchetypeBinding, codeOf, ArchetypeBinding } from './archetype-binding';
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

// ============================================================================
// Section-aware data access
// ============================================================================

const useObservationPanelBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ArchetypeBinding =>
  useArchetypeBinding({
    exampleData: (activeData) => activeData.example?.observationPanel,
    exampleTarget: (draft) => {
      draft.example = draft.example || {};
      return (draft.example.observationPanel = draft.example.observationPanel || {});
    },
    section: sectionOverride,
  });

// Legacy example-data hook, kept solely for Link (whose internals are part of
// the frozen archetype contract and only ever read the demo record).
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

interface FieldProps {
  index?: number | string;
  section?: Partial<SectionContextValue>;
  [key: string]: any;
}

const makeTextField = (
  fieldId: string,
  label: string,
  size: 'tiny' | 'small' | 'medium' | 'large' | 'max',
  options: { multiline?: boolean; placeholder?: string } = {}
): React.FC<FieldProps> => {
  const TextFieldComponent: React.FC<FieldProps> = ({ index, section, ...rest }) => {
    const { data, setField } = useObservationPanelBinding(section);
    // A size override from the Grid (e.g. size="100%") must reach the inner
    // control too, or its own wrapper re-clamps inside the stretched LayoutItem.
    const effectiveSize = (rest.size as typeof size | undefined) ?? size;

    return (
      <LayoutItem fieldId={fieldId} label={label} size={size} index={index} section={section} {...rest}>
        <MoisTextField
          value={data?.[fieldId] || ''}
          size={effectiveSize}
          {...(options.placeholder ? { placeholder: options.placeholder } : {})}
          {...(options.multiline ? { multiline: true } : {})}
          onChange={(_, val) => setField(fieldId, val || '')}
        />
      </LayoutItem>
    );
  };
  TextFieldComponent.displayName = `ObservationPanel.${fieldId}`;
  return TextFieldComponent;
};

// Observations table - uses ListSelection for consistent styling
// (ListSelection renders its own LayoutItem with this fieldId, so it
// participates in section fieldPlacement like any other field.)
const observations: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationPanelBinding(section);

  return (
    <ListSelection
      fieldId="observations"
      items={data?.observations || []}
      columns={observationColumns}
      selectionType="none"
      selectText="View observations"
      labelPosition="none"
      index={index as any}
      section={section}
      {...rest}
    />
  );
};

const panelName: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationPanelBinding(section);
  const options = useCodeList('MOIS-PANELNAME');

  const dropdownOptions: IDropdownOption[] = [
    { key: 'CBC w/ Diff', text: 'CBC w/ Diff' },
    { key: 'Basic Metabolic Panel', text: 'Basic Metabolic Panel' },
    { key: 'Comprehensive Metabolic Panel', text: 'Comprehensive Metabolic Panel' },
    { key: 'Lipid Panel', text: 'Lipid Panel' },
    { key: 'Liver Function Panel', text: 'Liver Function Panel' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];

  const effectiveSize = (rest.size as 'tiny' | 'small' | 'medium' | 'large' | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="panelName" label="Panel name" size="medium" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="panelName"
        selectedKey={codeOf(data?.panelName)}
        options={dropdownOptions}
        size={effectiveSize}
        onChange={(_, option) => setField('panelName', String(option?.key || ''))}
      />
    </LayoutItem>
  );
};

const orderDateTime = makeTextField('orderDateTime', 'Ordered', 'small', { placeholder: 'yyyy-mm-ddThh:mm:ss' });
const collectedDateTime = makeTextField('collectedDateTime', 'Collected', 'small', { placeholder: 'yyyy-mm-ddThh:mm:ss' });
const specimenReceivedDateTime = makeTextField('specimenReceivedDateTime', 'Specimen received', 'small', { placeholder: 'yyyy-mm-ddThh:mm:ss' });
const placerReferenceNumber = makeTextField('placerReferenceNumber', 'Placer reference', 'medium');
const fillerReferenceNumber = makeTextField('fillerReferenceNumber', 'Filler reference', 'medium');
const orderedBy = makeTextField('orderedBy', 'Ordered by', 'medium');
const orderingSystem = makeTextField('orderingSystem', 'Ordering system', 'medium');
const reportedDateTime = makeTextField('reportedDateTime', 'Reported', 'small', { placeholder: 'yyyy-mm-ddThh:mm:ss' });
const status = makeTextField('status', 'Result status', 'medium');
const collectedComment = makeTextField('collectedComment', 'Comment at collection', 'medium');
const facility = makeTextField('facility', 'Facility', 'medium');
const copyTo = makeTextField('copyTo', 'Copies to', 'medium');
const notes = makeTextField('notes', 'Notes', 'max', { multiline: true });
const interfaceType = makeTextField('interfaceType', 'Interface type', 'medium');

const messageSequenceNumber: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationPanelBinding(section);
  const effectiveSize = (rest.size as 'tiny' | 'small' | 'medium' | 'large' | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="messageSequenceNumber" label="Sequence in bundle" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.messageSequenceNumber ? String(data.messageSequenceNumber) : ''}
        readOnly
        borderless
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const collectionVolume = makeTextField('collectionVolume', 'Collection volume', 'medium');
const collectedBy = makeTextField('collectedBy', 'Collected by', 'medium');
const specimenSource = makeTextField('specimenSource', 'Specimen source', 'medium');
const orderingSource = makeTextField('orderingSource', 'Ordering source', 'medium');
const universalServiceCode = makeTextField('universalServiceCode', 'Universal service code', 'medium');
const orderingProviderRef = makeTextField('orderingProviderRef', 'Ordering provider reference', 'medium');
const diagnosticServiceSection = makeTextField('diagnosticServiceSection', 'Diagnostic service section', 'medium');

const stamp: React.FC<FieldProps> = ({ index, ...props }) => {
  return <AuditStamp fieldId="stamp" index={index} {...props} />;
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
// All Component (renders the placed fields, or every field with no placement)
// ============================================================================

const All: React.FC<any> = (props) => {
  return <ArchAll fields={Fields} {...props} />;
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
