/**
 * Observation Archetype
 * Components for displaying and updating observation/lab result data.
 *
 * Uses reusable controls: ButtonBar (for link buttons grouping)
 *
 * MOIS parity notes:
 * - Every field passes a stable fieldId (its Fields-map key) so section
 *   fieldPlacement can select and position it (`<Grid placement=...>`).
 * - `All` renders the fields as a Fragment in placement order — fields must be
 *   direct grid children for per-field gridArea to work.
 * - Fields read/write through the section's activeSelector when one is set,
 *   falling back to the JSON example data (activeData.example.observation)
 *   for gallery demos.
 */

import React, { useState } from 'react';
import { IDropdownOption, CommandButton, Pivot, PivotItem } from '@fluentui/react';
import { LayoutItem, ArchAll, AuditStamp } from '../components/Layout';
import { useCodeList, SectionContextValue } from '../context/MoisContext';
import { useArchetypeBinding, codeOf, ArchetypeBinding } from './archetype-binding';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';
import { ButtonBar } from '../controls/ButtonBar';
import { ListSelection } from '../controls/ListSelection';

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

// ============================================================================
// Section-aware data access
// ============================================================================

const useObservationBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ArchetypeBinding =>
  useArchetypeBinding({
    exampleData: (activeData) =>
      activeData.example?.observation ?? defaultObservation,
    exampleTarget: (draft) => {
      draft.example = draft.example || {};
      return (draft.example.observation = draft.example.observation || {});
    },
    section: sectionOverride,
  });

// ============================================================================
// Field Components
// ============================================================================

interface FieldProps {
  index?: number | string;
  section?: Partial<SectionContextValue>;
  [key: string]: any;
}

// Link button fields
const patient: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);

  return (
    <LayoutItem fieldId="patient" size="small" index={index} section={section} {...rest}>
      <CommandButton
        iconProps={{ iconName: 'PreviewLink' }}
        text={`Patient: ${data?.patientId || 'Not linked'}`}
      />
    </LayoutItem>
  );
};

const order: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);

  return (
    <LayoutItem fieldId="order" size="small" index={index} section={section} {...rest}>
      <CommandButton
        iconProps={{ iconName: 'PreviewLink' }}
        text={data?.orderId ? `Order: ${data.orderId}` : 'Order: Not linked'}
        disabled={!data?.orderId}
      />
    </LayoutItem>
  );
};

const encounter: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);

  return (
    <LayoutItem fieldId="encounter" size="small" index={index} section={section} {...rest}>
      <CommandButton
        iconProps={{ iconName: 'PreviewLink' }}
        text={data?.encounterId ? `Encounter: ${data.encounterId}` : 'Encounter: Not linked'}
        disabled={!data?.encounterId}
      />
    </LayoutItem>
  );
};

const panel: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);

  return (
    <LayoutItem fieldId="panel" size="small" index={index} section={section} {...rest}>
      <CommandButton
        iconProps={{ iconName: 'RowsGroup' }}
        text={data?.panelName ? `Panel: ${data.panelName}` : 'Panel: Not linked'}
        disabled={!data?.panelName}
      />
    </LayoutItem>
  );
};

const sequenceInPanel: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="sequenceInPanel" label="Sequence in panel" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.sequenceInPanel ? String(data.sequenceInPanel) : ''}
        readOnly
        borderless
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const placerReference: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="placerReference" label="Placer reference" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.placerReference || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('placerReference', val || '')}
      />
    </LayoutItem>
  );
};

const copiesTo: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="copiesTo" label="Copies to" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.copiesTo || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('copiesTo', val || '')}
      />
    </LayoutItem>
  );
};

const status: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="status" label="Status" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.status || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('status', val || '')}
      />
    </LayoutItem>
  );
};

const performedDateTime: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="performedDateTime" label="Performed" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.performedDateTime || ''}
        placeholder="yyyy-mm-ddThh:mm:ss"
        size={effectiveSize}
        onChange={(_, val) => setField('performedDateTime', val || '')}
      />
    </LayoutItem>
  );
};

const performedBy: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="performedBy" label="Performed by" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.performedBy || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('performedBy', val || '')}
      />
    </LayoutItem>
  );
};

const reportedBy: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="reportedBy" label="Reporter" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.reportedBy || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('reportedBy', val || '')}
      />
    </LayoutItem>
  );
};

const observationCode: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="observationCode" label="Code" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.observationCode || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('observationCode', val || '')}
      />
    </LayoutItem>
  );
};

const description: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="description" label="Description" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.description || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('description', val || '')}
      />
    </LayoutItem>
  );
};

const observationClass: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="observationClass" label="Classification" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.observationClass || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('observationClass', val || '')}
      />
    </LayoutItem>
  );
};

const loincCode: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="loincCode" label="LOINC code" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.loincCode || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('loincCode', val || '')}
      />
    </LayoutItem>
  );
};

const valueType: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="valueType" label="Value type" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.valueType || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('valueType', val || '')}
      />
    </LayoutItem>
  );
};

const value: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="value" label="value" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.value || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('value', val || '')}
      />
    </LayoutItem>
  );
};

const units: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="units" label="Units" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.units || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('units', val || '')}
      />
    </LayoutItem>
  );
};

const comment: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'max';

  return (
    <LayoutItem fieldId="comment" label="Comment" size="max" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.comment || ''}
        multiline
        size={effectiveSize}
        onChange={(_, val) => setField('comment', val || '')}
      />
    </LayoutItem>
  );
};

const report: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const [selectedKey, setSelectedKey] = useState('Edit');
  const effectiveSize = (rest.size as string | undefined) ?? 'max';

  return (
    <LayoutItem fieldId="report" label="Report" size="max" index={index} section={section} {...rest}>
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
                  size={effectiveSize}
                  onChange={(_, val) => setField('report', val || '')}
                />
              </LayoutItem>
            </div>
          </PivotItem>
        </Pivot>
      </div>
    </LayoutItem>
  );
};

const abnormalFlag: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const options = useCodeList('MOIS-ABNORMALFLAG');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.filter(opt => opt.code !== '').map(opt => ({ key: opt.code, text: opt.display })),
  ];
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="abnormalFlag" label="Flag" index={index} section={section} {...rest}>
      <MoisDropdown
        selectedKey={codeOf(data?.abnormalFlag)}
        options={dropdownOptions}
        size={effectiveSize}
        onChange={(_, option) => {
          const selected = options.find(o => o.code === option?.key);
          setField(
            'abnormalFlag',
            selected ? { code: selected.code, display: selected.display, system: selected.system } : null
          );
        }}
      />
    </LayoutItem>
  );
};

const interfaceNotes: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="interfaceNotes" label="Interface notes" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.interfaceNotes || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('interfaceNotes', val || '')}
      />
    </LayoutItem>
  );
};

const referenceRangeText: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="referenceRangeText" label="Reference range" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.referenceRangeText || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('referenceRangeText', val || '')}
      />
    </LayoutItem>
  );
};

const rangeNormalLow: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="rangeNormalLow" label="Low normal" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.rangeNormalLow || ''}
        readOnly
        borderless
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const rangeNormalHigh: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="rangeNormalHigh" label="High normal" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.rangeNormalHigh || ''}
        readOnly
        borderless
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const rangeVeryLow: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="rangeVeryLow" label="Very low" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.rangeVeryLow || ''}
        readOnly
        borderless
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const rangeVeryHigh: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="rangeVeryHigh" label="Very high" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.rangeVeryHigh || ''}
        readOnly
        borderless
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const rangeAbsurdLow: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="rangeAbsurdLow" label="Absurdly low" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.rangeAbsurdLow || ''}
        readOnly
        borderless
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const rangeAbsurdHigh: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="rangeAbsurdHigh" label="Absurdly high" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.rangeAbsurdHigh || ''}
        readOnly
        borderless
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const attachmentCount: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useObservationBinding(section);
  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="attachmentCount" label="Attachments" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.attachmentCount ? String(data.attachmentCount) : ''}
        readOnly
        borderless
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const recordState: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useObservationBinding(section);
  const options = useCodeList('MOIS-RECORDSTATE');

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];
  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="recordState" label="Record state" index={index} section={section} {...rest}>
      <MoisDropdown
        selectedKey={codeOf(data?.recordState)}
        options={dropdownOptions}
        size={effectiveSize}
        onChange={(_, option) => {
          const selected = options.find(o => o.code === option?.key);
          setField(
            'recordState',
            selected ? { code: selected.code, display: selected.display, system: selected.system } : null
          );
        }}
      />
    </LayoutItem>
  );
};

const stamp: React.FC<FieldProps> = ({ index, ...props }) => {
  return <AuditStamp fieldId="stamp" index={index} {...props} />;
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
// Columns / List - grid rendering for observation lists.
//
// The column specs below are a VERBATIM copy of the real MOIS engine's
// observation list columns (extracted from the SMOIS FormTester bundle,
// 02.31 era): observationId key, "Date" collectedDateTime, "Code"
// observationCode, "Test name" description, "Value" value, "Flag"
// abnormalFlag (rawcode). Do not add units/status/performed columns here —
// the real engine does not include them.
//
// The real build exports { ...fields, All, List, Fields }; List is a
// ready-made ListSelection over the observations collection using these
// columns. (The archetype docs additionally list Columns and LinksBar; this
// build ships neither, so treat those as preview/docs extras when authoring
// forms that must run in real MOIS.)
// ============================================================================

const observationListColumns = [
  { id: 'observationId', type: 'key' },
  { title: 'Date', id: 'collectedDateTime', type: 'date', size: 'small' },
  { title: 'Code', id: 'observationCode', type: 'string', size: 'tiny' },
  { title: 'Test name', id: 'description', type: 'string' },
  { title: 'Value', id: 'value', type: 'string', size: 'small' },
  { title: 'Flag', id: 'abnormalFlag', type: 'rawcode' },
];

const Columns = {
  observationId: observationListColumns[0],
  collectedDateTime: observationListColumns[1],
  observationCode: observationListColumns[2],
  description: observationListColumns[3],
  value: observationListColumns[4],
  abnormalFlag: observationListColumns[5],
};

const List: React.FC<any> = (props) => {
  return (
    <ListSelection
      sourceId="observations"
      fieldId="observations"
      columns={observationListColumns as any}
      {...props}
    />
  );
};

// ============================================================================
// LinksBar - Groups navigation link buttons together
// ============================================================================

const LinksBar: React.FC<any> = ({ section, ...props }) => {
  const { data } = useObservationBinding(section);

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
// All Component (renders the placed fields, or every field with no placement)
// ============================================================================

const All: React.FC<any> = (props) => {
  return <ArchAll fields={Fields} {...props} />;
};

// ============================================================================
// Export
// ============================================================================

export const Observation = {
  ...Fields,
  All,
  Columns,
  Fields,
  LinksBar,
  List,
};

export default Observation;
