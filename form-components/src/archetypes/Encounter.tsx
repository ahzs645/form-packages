/**
 * Encounter Archetype
 *
 * The Encounter Archetype defines standard field appearance and options for
 * fields in the MOIS encounter object. The encounter object can represent an
 * appointment slot, an appointment, an ongoing encounter, or the record of an
 * earlier encounter.
 *
 * MOIS creates appointment slots when appointment booking is handled by an
 * external system, such as myHealthKey. A reserved slot will have a date and
 * duration and a provider, but will not be assigned to a chart.
 *
 * An appointment is indicated by an assigned chart, but no status set.
 *
 * Encounters in progress and completed are indicated by the status being set
 * and the document status values "Complete" and "Incomplete".
 *
 * Uses reusable controls: ButtonBar (for action buttons)
 *
 * MOIS parity notes (see ChartPreference.tsx for the reference port):
 * - Every field passes a stable fieldId (its Fields-map key) so section
 *   fieldPlacement can select and position it (`<Grid placement=...>`).
 * - `All` renders the fields as a Fragment in placement order via ArchAll.
 * - Fields read/write through the section's activeSelector when one is set,
 *   falling back to the JSON example data (`example.encounter`) for gallery
 *   demos.
 */

import React from 'react';
import { IconButton, TooltipHost } from '@fluentui/react';
import { LayoutItem, ArchAll, AuditStamp } from '../components/Layout';
import { EncounterData, SectionContextValue } from '../context/MoisContext';
import { useArchetypeBinding, codeOf, toCodedValue, ArchetypeBinding } from './archetype-binding';
import { DateTimeSelect } from '../controls/DateTimeSelect';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';
import { ButtonBar as ButtonBarControl } from '../controls/ButtonBar';

// ============================================================================
// Default Encounter Data
// ============================================================================

const defaultEncounter: EncounterData = {
  encounterId: 500634,
  patientId: 500063,
  chartNumber: 10012,
  className: 'Encounter',
  appointmentDateTime: '2016-06-23T10:00:00',
  arrivedDateTime: null,
  attachmentCount: null,
  attendingProvider: null,
  billingStatus: { code: 'I', display: 'Incomplete', system: 'MOIS-BILLINGSTATUS' },
  callingCenter: null,
  cancelledDateTime: null,
  chartAssignedDateTime: '2016-06-23T13:20:02',
  dischargeDateTime: null,
  documentStatus: { code: 'I', display: 'Incomplete', system: 'MOIS-DOCUMENTSTATUS' },
  encompassingEncounterId: null,
  encompassingEncounterIdent: null,
  encounterFormCount: null,
  groupVisitId: null,
  healthIssues: [{ code: 'V6511', display: 'PED PRE-BRTH VST-PARENT', system: 'ICD-9' }, null, null, null, null],
  inRoomDateTime: null,
  location: null,
  name: { first: 'MICKEY', family: 'MOUSE', text: 'MICKEY MOUSE' },
  officeNote: null,
  payor: { code: null, display: null, system: 'MOIS-FUNDINGSOURCE' },
  priority: { code: null, display: null, system: 'VALUESET:ENCOUNTER.PRIORITY' },
  providerId: 500011,
  resourceId: null,
  roomNumber: null,
  seenDateTime: null,
  services: [{ code: '36301', display: 'NP - VISIT IN OFFICE (AGE 2 - 59)', system: 'USER', count: null, phase: 'ONETIME' }, null, null, null],
  status: { code: null, display: null, system: 'MOIS-ENCOUNTERSTATUS' },
  taskCount: null,
  timeSlots: 3,
  visitCode: { code: 'SA', display: 'Short Assessment', system: 'MOIS-VISITCODE' },
  visitMode: { code: '140182721000087101', display: 'DIRECT ENCOUNTER WITH CLIENT ALONE', system: 'MOIS-VISITMODE' },
  visitReason1: { code: null, display: 'Assessment', system: 'MOIS-VISITREASON' } as any,
  visitReason2: { code: null, display: null, system: 'MOIS-VISITREASON' } as any,
  stamp: {
    createdDate: '2016.06.23 - 13:20',
    createdBy: 'ADMINISTRATOR',
    modifiedDate: '2021.03.17 - 12:03',
    modifiedBy: 'ADMINISTRATOR',
  },
};

// ============================================================================
// Section-aware data access
// ============================================================================

const useEncounterBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ArchetypeBinding =>
  useArchetypeBinding({
    exampleData: (activeData) => activeData.example?.encounter ?? defaultEncounter,
    exampleTarget: (draft) => {
      draft.example = draft.example || {};
      return (draft.example.encounter = draft.example.encounter || {});
    },
    section: sectionOverride,
  });

// ============================================================================
// Date/Time Helpers
// ============================================================================

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  } catch {
    return dateStr;
  }
};

const parseDateTime = (dateStr: string | null): { date: string; time: string } => {
  if (!dateStr) return { date: '', time: '' };
  try {
    const dateObj = new Date(dateStr);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return {
      date: `${year}.${month}.${day}`,
      time: `${hours}:${minutes}`,
    };
  } catch {
    return { date: '', time: '' };
  }
};

// ============================================================================
// Field Components
// ============================================================================

interface FieldProps {
  index?: number | string;
  section?: Partial<SectionContextValue>;
  [key: string]: any;
}

/** Read-only date+time field rendered through DateTimeSelect (which carries
 * its own placement-aware LayoutItem, so it gets the fieldId directly). */
const makeReadOnlyDateTimeField = (
  fieldId: keyof EncounterData & string,
  label: string
): React.FC<FieldProps> => {
  const DateTimeField: React.FC<FieldProps> = ({ index, section, ...rest }) => {
    const { data } = useEncounterBinding(section);
    const { date, time } = parseDateTime((data?.[fieldId] as string | null) ?? null);

    return (
      <DateTimeSelect
        fieldId={fieldId}
        label={label}
        index={index as number | undefined}
        section={section}
        defaultValue={date}
        defaultTime={time}
        size="medium"
        readOnly
        {...rest}
      />
    );
  };
  DateTimeField.displayName = `Encounter.${fieldId}`;
  return DateTimeField;
};

const appointmentDateTime = makeReadOnlyDateTimeField('appointmentDateTime', 'Scheduled');
const arrivedDateTime = makeReadOnlyDateTimeField('arrivedDateTime', 'Arrived');

const attachmentCount: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="attachmentCount" label="Attached" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.attachmentCount ?? 0)} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const attendingProvider: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="attendingProvider" label="Attending" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.attendingProvider?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => setField(
          'attendingProvider',
          val ? { code: null, display: val, system: 'MOIS-PROVIDER' } : null
        )}
      />
    </LayoutItem>
  );
};

const billingStatus: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="billingStatus" label="Billing status" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="billingStatus"
        codeSystem="MOIS-BILLINGSTATUS"
        selectedKey={codeOf(data?.billingStatus) || undefined}
        size="small"
        onChange={(_, option) => setField('billingStatus', toCodedValue(option, 'MOIS-BILLINGSTATUS'))}
      />
    </LayoutItem>
  );
};

const callingCenter: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="callingCenter" label="Calling centre" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.callingCenter?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => setField(
          'callingCenter',
          val ? { code: null, display: val, system: 'MOIS-CITY' } : null
        )}
      />
    </LayoutItem>
  );
};

const cancelledDateTime = makeReadOnlyDateTimeField('cancelledDateTime', 'Cancelled');
const chartAssignedDateTime = makeReadOnlyDateTimeField('chartAssignedDateTime', 'Chart assigned');

const chartNumber: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="chartNumber" label="Chart No." size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.chartNumber ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const dischargeDateTime = makeReadOnlyDateTimeField('dischargeDateTime', 'Discharged');

const documentStatus: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="documentStatus" label="Doc. Status" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="documentStatus"
        codeSystem="MOIS-DOCUMENTSTATUS"
        selectedKey={codeOf(data?.documentStatus) || undefined}
        size="small"
        onChange={(_, option) => setField('documentStatus', toCodedValue(option, 'MOIS-DOCUMENTSTATUS'))}
      />
    </LayoutItem>
  );
};

const encompassingEncounterId: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="encompassingEncounterId" label="Encompassing Encounter" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.encompassingEncounterId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const encompassingEncounterIdent: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="encompassingEncounterIdent" label="Encounter Reference" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.encompassingEncounterIdent || ''}
        size="small"
        onChange={(_, val) => setField('encompassingEncounterIdent', val || null)}
      />
    </LayoutItem>
  );
};

const encounterFormCount: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="encounterFormCount" label="Attached forms" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.encounterFormCount ?? 0)} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const encounterId: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="encounterId" label="Encounter Id" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.encounterId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const groupVisitId: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="groupVisitId" label="Group visit Id" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.groupVisitId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const healthIssue: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);
  const firstIssue = data?.healthIssues?.[0];

  return (
    <LayoutItem fieldId="healthIssue" label="Health issue" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={firstIssue?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => {
          const newIssues = [...(data?.healthIssues || [null, null, null, null, null])];
          newIssues[0] = val ? { code: null, display: val, system: 'ICD-9' } : null;
          setField('healthIssues', newIssues);
        }}
      />
    </LayoutItem>
  );
};

const inRoomDateTime = makeReadOnlyDateTimeField('inRoomDateTime', 'In room');

const location: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="location" label="Location" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.location || ''}
        size="medium"
        onChange={(_, val) => setField('location', val || null)}
      />
    </LayoutItem>
  );
};

const name: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="name" label="Patient name" size="medium" index={index} section={section} {...rest}>
      <MoisTextField value={data?.name?.text || ''} readOnly borderless size="medium" />
    </LayoutItem>
  );
};

const officeNote: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="officeNote" label="Office note" size="max" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.officeNote || ''}
        multiline
        rows={3}
        size="max"
        onChange={(_, val) => setField('officeNote', val || null)}
      />
    </LayoutItem>
  );
};

const patientId: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="patientId" label="Patient Id" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.patientId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const payor: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="payor" label="Payor" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="payor"
        codeSystem="MOIS-FUNDINGSOURCE"
        selectedKey={codeOf(data?.payor) || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => setField('payor', toCodedValue(option, 'MOIS-FUNDINGSOURCE'))}
      />
    </LayoutItem>
  );
};

const priority: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="priority" label="Priority" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="priority"
        codeSystem="VALUESET:ENCOUNTER.PRIORITY"
        selectedKey={codeOf(data?.priority) || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => setField('priority', toCodedValue(option, 'VALUESET:ENCOUNTER.PRIORITY'))}
      />
    </LayoutItem>
  );
};

const providerId: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="providerId" label="Provider Id" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.providerId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const resourceId: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="resourceId" label="Resource Id" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.resourceId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const roomNumber: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="roomNumber" label="Room" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.roomNumber || ''}
        size="small"
        onChange={(_, val) => setField('roomNumber', val || null)}
      />
    </LayoutItem>
  );
};

const seenDateTime = makeReadOnlyDateTimeField('seenDateTime', 'Seen');

const service: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);
  const firstService = data?.services?.[0];

  return (
    <LayoutItem fieldId="service" label="Service" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={firstService?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => {
          const newServices = [...(data?.services || [null, null, null, null])];
          newServices[0] = val ? { code: null, display: val, system: 'USER', count: null, phase: 'ONETIME' } : null;
          setField('services', newServices);
        }}
      />
    </LayoutItem>
  );
};

const status: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="status" label="Status" size="medium" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="status"
        codeSystem="MOIS-ENCOUNTERSTATUS"
        selectedKey={codeOf(data?.status) || undefined}
        placeholder="Please select"
        size="medium"
        onChange={(_, option) => setField('status', toCodedValue(option, 'MOIS-ENCOUNTERSTATUS'))}
      />
    </LayoutItem>
  );
};

const stamp: React.FC<FieldProps> = ({ index, ...props }) => {
  return <AuditStamp fieldId="stamp" index={index} {...props} />;
};

const taskCount: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="taskCount" label="Tasks" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.taskCount ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const timeSlots: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="timeSlots" label="Slots" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.timeSlots ?? '')} readOnly borderless tabIndex={-1} size="tiny" />
    </LayoutItem>
  );
};

const visitCode: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="visitCode" label="Code" size="medium" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="visitCode"
        codeSystem="MOIS-VISITCODE"
        selectedKey={codeOf(data?.visitCode) || undefined}
        size="medium"
        onChange={(_, option) => setField('visitCode', toCodedValue(option, 'MOIS-VISITCODE'))}
      />
    </LayoutItem>
  );
};

const visitMode: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="visitMode" label="Mode" size="medium" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="visitMode"
        codeSystem="MOIS-VISITMODE"
        selectedKey={codeOf(data?.visitMode) || undefined}
        dropdownWidth="auto"
        size="medium"
        onChange={(_, option) => setField('visitMode', toCodedValue(option, 'MOIS-VISITMODE'))}
      />
    </LayoutItem>
  );
};

const visitReason1: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="visitReason1" label="Visit reason" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.visitReason1?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => setField(
          'visitReason1',
          { code: null, display: val || null, system: 'MOIS-VISITREASON' }
        )}
      />
    </LayoutItem>
  );
};

const visitReason2: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useEncounterBinding(section);

  return (
    <LayoutItem fieldId="visitReason2" label="Secondary visit reason" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.visitReason2?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => setField(
          'visitReason2',
          { code: null, display: val || null, system: 'MOIS-VISITREASON' }
        )}
      />
    </LayoutItem>
  );
};

// ============================================================================
// Fields Collection
// ============================================================================

const Fields = {
  appointmentDateTime,
  arrivedDateTime,
  attachmentCount,
  attendingProvider,
  billingStatus,
  callingCenter,
  cancelledDateTime,
  chartAssignedDateTime,
  chartNumber,
  dischargeDateTime,
  documentStatus,
  encompassingEncounterId,
  encompassingEncounterIdent,
  encounterFormCount,
  encounterId,
  groupVisitId,
  healthIssue,
  inRoomDateTime,
  location,
  name,
  officeNote,
  patientId,
  payor,
  priority,
  providerId,
  resourceId,
  roomNumber,
  seenDateTime,
  service,
  status,
  stamp,
  taskCount,
  timeSlots,
  visitCode,
  visitMode,
  visitReason1,
  visitReason2,
};

// ============================================================================
// Column Definitions (for grid/table views)
// ============================================================================

const Columns = {
  encounterId: { title: 'ID', id: 'encounterId', type: 'hidden' },
  patientId: { title: 'Patient Id', id: 'patientId', type: 'hidden' },
  appointmentDateTime: { title: 'Date', id: 'appointmentDateTime', type: 'date', size: 'small' },
  attendingProvider: { title: 'Attending', id: 'attendingProvider', type: 'string', size: 'small' },
  serviceGroupName: { title: 'Category', id: 'serviceGroupName', type: 'string', size: 'small' },
  healthIssue1: { title: 'Health issue', id: 'healthIssue1', type: 'code', size: 'small' },
  callingCenter: { title: 'Calling center', id: 'callingCenter', type: 'string', size: 'small' },
  name: { title: 'Patient name', id: 'name', type: 'string', size: 'small' },
  patientAge: { title: 'Age', id: 'patientAge', type: 'string', size: 'tiny' },
  patientAdministrativeGender: { title: 'Gender', id: 'patientAdministrativeGender', type: 'code', size: 'tiny' },
  providerName: { title: 'Provider', id: 'providerName', type: 'action', size: 'small' },
  visitCode: { title: 'Code', id: 'visitCode', type: 'code', size: 'tiny' },
  visitMode: { title: 'Mode', id: 'visitMode', type: 'code', size: 'tiny' },
  status: { title: 'Status', id: 'status', type: 'code', size: 'tiny' },
  service1: { title: 'Service', id: 'service1', type: 'code', size: 'small' },
  timeSlots: { title: 'Slots', id: 'timeSlots', type: 'number', size: 'tiny' },
  visitReason1: { title: 'Visit reason', id: 'visitReason1', type: 'code', size: 'small' },
};

// ============================================================================
// Button Components
// ============================================================================

const OpenButton: React.FC<any> = ({ encounter, formParams }) => {
  return (
    <TooltipHost content="Open encounter">
      <IconButton
        iconProps={{ iconName: 'OpenFile' }}
        onClick={() => {
          console.log('Open encounter:', encounter?.encounterId || formParams?.encounterId);
        }}
      />
    </TooltipHost>
  );
};

const AddFormButton: React.FC<any> = ({ encounter, formParams, displayAddFormButton = true }) => {
  if (!displayAddFormButton) return null;

  const encounterId = encounter?.encounterId ?? formParams?.encounterId ?? 0;

  return (
    <TooltipHost content={encounterId ? "Attach new web form to encounter" : "Create new web form"}>
      <IconButton
        iconProps={{ iconName: 'AddNotes' }}
        menuProps={{
          items: [
            { key: 'form1', text: 'Web Form 1', iconProps: { iconName: 'OpenEnrollment' } },
            { key: 'form2', text: 'Web Form 2', iconProps: { iconName: 'OpenEnrollment' } },
          ],
        }}
        onRenderMenuIcon={() => null}
      />
    </TooltipHost>
  );
};

// EncounterButtonBar - uses standard ButtonBar control
const EncounterButtonBar: React.FC<any> = (props) => {
  return (
    <ButtonBarControl gap={4} padding={0}>
      <OpenButton {...props} />
      <AddFormButton {...props} />
    </ButtonBarControl>
  );
};

const Button = {
  Bar: EncounterButtonBar,
  Open: OpenButton,
  AddForm: AddFormButton,
};

// ============================================================================
// All Component (renders the placed fields, or every field with no placement)
// ============================================================================

const All: React.FC<any> = (props) => <ArchAll fields={Fields} {...props} />;

// ============================================================================
// Export
// ============================================================================

// Re-export individual field components at the top level
export const Encounter = {
  // Spread field components for direct access like Encounter.status
  ...Fields,
  // Named sub-objects
  All,
  Button,
  Columns,
  Fields,
  // Specific commonly used fields for explicit access
  date: appointmentDateTime,
  encounterId,
  stamp,
  status,
  type: visitCode,
};

export default Encounter;
