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
 */

import React, { useCallback } from 'react';
import { IDropdownOption, IconButton, TooltipHost } from '@fluentui/react';
import { LayoutItem, AuditStamp } from '../components/Layout';
import { useActiveData, useCodeList, EncounterData, CodeValue } from '../context/MoisContext';
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
// Hooks
// ============================================================================

const useEncounterData = (): [EncounterData, (updates: Partial<EncounterData>) => void] => {
  const [activeData, setActiveData] = useActiveData();
  const data = (activeData as any).example?.encounter as EncounterData | undefined;

  // Memoize setData to prevent infinite re-renders
  const setData = useCallback((updates: Partial<EncounterData>) => {
    setActiveData((current: any) => ({
      ...current,
      example: {
        ...current.example,
        encounter: { ...current.example?.encounter, ...updates },
      },
    }));
  }, [setActiveData]);

  return [data || defaultEncounter, setData];
};

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

const appointmentDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();
  const { date, time } = parseDateTime(data?.appointmentDateTime);

  return (
    <DateTimeSelect
      label="Scheduled"
      index={index}
      defaultValue={date}
      defaultTime={time}
      size="medium"
      readOnly
    />
  );
};

const arrivedDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();
  const { date, time } = parseDateTime(data?.arrivedDateTime);

  return (
    <DateTimeSelect
      label="Arrived"
      index={index}
      defaultValue={date}
      defaultTime={time}
      size="medium"
      readOnly
    />
  );
};

const attachmentCount: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Attached" size="tiny" index={index}>
      <MoisTextField value={String(data?.attachmentCount ?? 0)} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const attendingProvider: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Attending" size="medium" index={index}>
      <MoisTextField
        value={data?.attendingProvider?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => setData({
          attendingProvider: val ? { code: null, display: val, system: 'MOIS-PROVIDER' } : null
        })}
      />
    </LayoutItem>
  );
};

const billingStatus: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Billing status" size="small" index={index}>
      <MoisDropdown
        fieldId="billingStatus"
        codeSystem="MOIS-BILLINGSTATUS"
        selectedKey={data?.billingStatus?.code || undefined}
        size="small"
        onChange={(_, option) => {
          if (option) {
            setData({
              billingStatus: {
                code: option.key as string,
                display: option.text,
                system: 'MOIS-BILLINGSTATUS',
              },
            });
          }
        }}
      />
    </LayoutItem>
  );
};

const callingCenter: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Calling centre" size="medium" index={index}>
      <MoisTextField
        value={data?.callingCenter?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => setData({
          callingCenter: val ? { code: null, display: val, system: 'MOIS-CITY' } : null
        })}
      />
    </LayoutItem>
  );
};

const cancelledDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();
  const { date, time } = parseDateTime(data?.cancelledDateTime);

  return (
    <DateTimeSelect
      label="Cancelled"
      index={index}
      defaultValue={date}
      defaultTime={time}
      size="medium"
      readOnly
    />
  );
};

const chartAssignedDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();
  const { date, time } = parseDateTime(data?.chartAssignedDateTime);

  return (
    <DateTimeSelect
      label="Chart assigned"
      index={index}
      defaultValue={date}
      defaultTime={time}
      size="medium"
      readOnly
    />
  );
};

const chartNumber: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Chart No." size="tiny" index={index}>
      <MoisTextField value={String(data?.chartNumber ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const dischargeDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();
  const { date, time } = parseDateTime(data?.dischargeDateTime);

  return (
    <DateTimeSelect
      label="Discharged"
      index={index}
      defaultValue={date}
      defaultTime={time}
      size="medium"
      readOnly
    />
  );
};

const documentStatus: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Doc. Status" size="small" index={index}>
      <MoisDropdown
        fieldId="documentStatus"
        codeSystem="MOIS-DOCUMENTSTATUS"
        selectedKey={data?.documentStatus?.code || undefined}
        size="small"
        onChange={(_, option) => {
          if (option) {
            setData({
              documentStatus: {
                code: option.key as string,
                display: option.text,
                system: 'MOIS-DOCUMENTSTATUS',
              },
            });
          }
        }}
      />
    </LayoutItem>
  );
};

const encompassingEncounterId: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Encompassing Encounter" size="tiny" index={index}>
      <MoisTextField value={String(data?.encompassingEncounterId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const encompassingEncounterIdent: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Encounter Reference" size="small" index={index}>
      <MoisTextField
        value={data?.encompassingEncounterIdent || ''}
        size="small"
        onChange={(_, val) => setData({ encompassingEncounterIdent: val || null })}
      />
    </LayoutItem>
  );
};

const encounterFormCount: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Attached forms" size="tiny" index={index}>
      <MoisTextField value={String(data?.encounterFormCount ?? 0)} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const encounterId: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Encounter Id" size="tiny" index={index}>
      <MoisTextField value={String(data?.encounterId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const groupVisitId: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Group visit Id" size="tiny" index={index}>
      <MoisTextField value={String(data?.groupVisitId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const healthIssue: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();
  const firstIssue = data?.healthIssues?.[0];

  return (
    <LayoutItem label="Health issue" size="medium" index={index}>
      <MoisTextField
        value={firstIssue?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => {
          const newIssues = [...(data?.healthIssues || [null, null, null, null, null])];
          newIssues[0] = val ? { code: null, display: val, system: 'ICD-9' } : null;
          setData({ healthIssues: newIssues });
        }}
      />
    </LayoutItem>
  );
};

const inRoomDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();
  const { date, time } = parseDateTime(data?.inRoomDateTime);

  return (
    <DateTimeSelect
      label="In room"
      index={index}
      defaultValue={date}
      defaultTime={time}
      size="medium"
      readOnly
    />
  );
};

const location: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Location" size="medium" index={index}>
      <MoisTextField
        value={data?.location || ''}
        size="medium"
        onChange={(_, val) => setData({ location: val || null })}
      />
    </LayoutItem>
  );
};

const name: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Patient name" size="medium" index={index}>
      <MoisTextField value={data?.name?.text || ''} readOnly borderless size="medium" />
    </LayoutItem>
  );
};

const officeNote: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Office note" size="max" index={index}>
      <MoisTextField
        value={data?.officeNote || ''}
        multiline
        rows={3}
        size="max"
        onChange={(_, val) => setData({ officeNote: val || null })}
      />
    </LayoutItem>
  );
};

const patientId: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Patient Id" size="tiny" index={index}>
      <MoisTextField value={String(data?.patientId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const payor: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Payor" size="small" index={index}>
      <MoisDropdown
        fieldId="payor"
        codeSystem="MOIS-FUNDINGSOURCE"
        selectedKey={data?.payor?.code || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          if (option) {
            setData({
              payor: {
                code: option.key as string,
                display: option.text,
                system: 'MOIS-FUNDINGSOURCE',
              },
            });
          }
        }}
      />
    </LayoutItem>
  );
};

const priority: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Priority" size="small" index={index}>
      <MoisDropdown
        fieldId="priority"
        codeSystem="VALUESET:ENCOUNTER.PRIORITY"
        selectedKey={data?.priority?.code || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          if (option) {
            setData({
              priority: {
                code: option.key as string,
                display: option.text,
                system: 'VALUESET:ENCOUNTER.PRIORITY',
              },
            });
          }
        }}
      />
    </LayoutItem>
  );
};

const providerId: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Provider Id" size="tiny" index={index}>
      <MoisTextField value={String(data?.providerId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const resourceId: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Resource Id" size="tiny" index={index}>
      <MoisTextField value={String(data?.resourceId ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const roomNumber: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Room" size="small" index={index}>
      <MoisTextField
        value={data?.roomNumber || ''}
        size="small"
        onChange={(_, val) => setData({ roomNumber: val || null })}
      />
    </LayoutItem>
  );
};

const seenDateTime: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();
  const { date, time } = parseDateTime(data?.seenDateTime);

  return (
    <DateTimeSelect
      label="Seen"
      index={index}
      defaultValue={date}
      defaultTime={time}
      size="medium"
      readOnly
    />
  );
};

const service: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();
  const firstService = data?.services?.[0];

  return (
    <LayoutItem label="Service" size="medium" index={index}>
      <MoisTextField
        value={firstService?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => {
          const newServices = [...(data?.services || [null, null, null, null])];
          newServices[0] = val ? { code: null, display: val, system: 'USER', count: null, phase: 'ONETIME' } : null;
          setData({ services: newServices as any });
        }}
      />
    </LayoutItem>
  );
};

const status: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Status" size="medium" index={index}>
      <MoisDropdown
        fieldId="status"
        codeSystem="MOIS-ENCOUNTERSTATUS"
        selectedKey={data?.status?.code || undefined}
        placeholder="Please select"
        size="medium"
        onChange={(_, option) => {
          if (option) {
            setData({
              status: {
                code: option.key as string,
                display: option.text,
                system: 'MOIS-ENCOUNTERSTATUS',
              },
            });
          }
        }}
      />
    </LayoutItem>
  );
};

const stamp: React.FC<any> = ({ index, ...props }) => {
  return <AuditStamp index={index} {...props} />;
};

const taskCount: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Tasks" size="tiny" index={index}>
      <MoisTextField value={String(data?.taskCount ?? '')} readOnly borderless size="tiny" />
    </LayoutItem>
  );
};

const timeSlots: React.FC<any> = ({ index, ...props }) => {
  const [data] = useEncounterData();

  return (
    <LayoutItem label="Slots" size="tiny" index={index}>
      <MoisTextField value={String(data?.timeSlots ?? '')} readOnly borderless tabIndex={-1} size="tiny" />
    </LayoutItem>
  );
};

const visitCode: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Code" size="medium" index={index}>
      <MoisDropdown
        fieldId="visitCode"
        codeSystem="MOIS-VISITCODE"
        selectedKey={data?.visitCode?.code || undefined}
        size="medium"
        onChange={(_, option) => {
          if (option) {
            setData({
              visitCode: {
                code: option.key as string,
                display: option.text,
                system: 'MOIS-VISITCODE',
              },
            });
          }
        }}
      />
    </LayoutItem>
  );
};

const visitMode: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Mode" size="medium" index={index}>
      <MoisDropdown
        fieldId="visitMode"
        codeSystem="MOIS-VISITMODE"
        selectedKey={data?.visitMode?.code || undefined}
        dropdownWidth="auto"
        size="medium"
        onChange={(_, option) => {
          if (option) {
            setData({
              visitMode: {
                code: option.key as string,
                display: option.text,
                system: 'MOIS-VISITMODE',
              },
            });
          }
        }}
      />
    </LayoutItem>
  );
};

const visitReason1: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Visit reason" size="medium" index={index}>
      <MoisTextField
        value={data?.visitReason1?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => setData({
          visitReason1: { code: null, display: val || null, system: 'MOIS-VISITREASON' } as any
        })}
      />
    </LayoutItem>
  );
};

const visitReason2: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useEncounterData();

  return (
    <LayoutItem label="Secondary visit reason" size="medium" index={index}>
      <MoisTextField
        value={data?.visitReason2?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => setData({
          visitReason2: { code: null, display: val || null, system: 'MOIS-VISITREASON' } as any
        })}
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
// All Component (renders ALL fields)
// ============================================================================

const All: React.FC<any> = (props) => {
  return (
    <div>
      <Fields.appointmentDateTime {...props} />
      <Fields.arrivedDateTime {...props} />
      <Fields.attachmentCount {...props} />
      <Fields.attendingProvider {...props} />
      <Fields.billingStatus {...props} />
      <Fields.callingCenter {...props} />
      <Fields.cancelledDateTime {...props} />
      <Fields.chartAssignedDateTime {...props} />
      <Fields.chartNumber {...props} />
      <Fields.dischargeDateTime {...props} />
      <Fields.documentStatus {...props} />
      <Fields.encompassingEncounterId {...props} />
      <Fields.encompassingEncounterIdent {...props} />
      <Fields.encounterFormCount {...props} />
      <Fields.encounterId {...props} />
      <Fields.groupVisitId {...props} />
      <Fields.healthIssue {...props} />
      <Fields.inRoomDateTime {...props} />
      <Fields.location {...props} />
      <Fields.name {...props} />
      <Fields.officeNote {...props} />
      <Fields.patientId {...props} />
      <Fields.payor {...props} />
      <Fields.priority {...props} />
      <Fields.providerId {...props} />
      <Fields.resourceId {...props} />
      <Fields.roomNumber {...props} />
      <Fields.seenDateTime {...props} />
      <Fields.service {...props} />
      <Fields.status {...props} />
      <Fields.stamp {...props} />
      <Fields.taskCount {...props} />
      <Fields.timeSlots {...props} />
      <Fields.visitCode {...props} />
      <Fields.visitMode {...props} />
      <Fields.visitReason1 {...props} />
      <Fields.visitReason2 {...props} />
    </div>
  );
};

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
