/**
 * Task Archetype
 * The Task archetype displays information about tasks assigned to a user.
 * Tasks are attached to MOIS objects.
 *
 * MOIS parity notes:
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
import { LayoutItem, ArchAll } from '../components/Layout';
import { useCodeList, SectionContextValue } from '../context/MoisContext';
import { useArchetypeBinding, codeOf, toCodedValue, ArchetypeBinding } from './archetype-binding';
import { DateSelect } from '../controls/DateSelect';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';

// ============================================================================
// Task Data Interface
// ============================================================================

interface TaskData {
  taskId: number;
  documentId: number | null;
  encounterId?: number | null;
  patientId: number;
  patientName: string;
  createdDate: string;
  dueDate: string;
  description: string;
  note: string;
  priority: { code: string; display: string; system: string } | null;
  isAcknowledged?: { code: string; display: string; system: string } | null;
  isComplete?: { code: string; display: string; system: string } | null;
  completedBy: string | null;
  completedDate: string | null;
  requestorId: number | null;
  assignedUserId?: number | null;
  assignedUser?: {
    identity: { fullName: string; signature: string };
    loginName: string;
    providerId: number;
    userProfileId: number;
    userRoleId: number;
  } | null;
}

// ============================================================================
// Default Task Data
// ============================================================================

const defaultTask: TaskData = {
  taskId: 500047,
  documentId: 500376,
  patientId: 500063,
  patientName: 'MICKEY MOUSE',
  createdDate: '2021-03-16',
  dueDate: '2021-03-16',
  description: 'testing task',
  note: 'this is a testing task',
  priority: null,
  completedBy: null,
  completedDate: null,
  requestorId: 500033,
};

// ============================================================================
// Section-aware data access
// ============================================================================

const useTaskBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ArchetypeBinding =>
  useArchetypeBinding({
    exampleData: (activeData) => activeData.example?.task ?? defaultTask,
    exampleTarget: (draft) => {
      draft.example = draft.example || {};
      return (draft.example.task = draft.example.task || {});
    },
    section: sectionOverride,
  });

// ============================================================================
// Date Formatting
// ============================================================================

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  } catch {
    return '';
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

const createdDate: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useTaskBinding(section);

  return (
    <LayoutItem fieldId="createdDate" label="Created date" size="small" index={index} section={section} {...rest}>
      <DateSelect
        inline
        value={data?.createdDate ? formatDate(data.createdDate) : ''}
        size="small"
        onChange={(dateStr) => {
          if (dateStr) {
            // Convert from YYYY.MM.DD to YYYY-MM-DD
            setField('createdDate', dateStr.replace(/\./g, '-'));
          }
        }}
      />
    </LayoutItem>
  );
};
createdDate.displayName = 'Task.createdDate';

const description: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useTaskBinding(section);

  return (
    <LayoutItem fieldId="description" label="Task" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.description || ''}
        size="medium"
        onChange={(_, val) => setField('description', val || '')}
      />
    </LayoutItem>
  );
};
description.displayName = 'Task.description';

const dueDate: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useTaskBinding(section);

  return (
    <LayoutItem fieldId="dueDate" label="Due date" size="small" index={index} section={section} {...rest}>
      <DateSelect
        inline
        value={data?.dueDate ? formatDate(data.dueDate) : ''}
        size="small"
        onChange={(dateStr) => {
          if (dateStr) {
            // Convert from YYYY.MM.DD to YYYY-MM-DD
            setField('dueDate', dateStr.replace(/\./g, '-'));
          }
        }}
      />
    </LayoutItem>
  );
};
dueDate.displayName = 'Task.dueDate';

const note: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useTaskBinding(section);

  return (
    <LayoutItem fieldId="note" label="Detail" size="max" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.note || ''}
        size="max"
        multiline
        onChange={(_, val) => setField('note', val || '')}
      />
    </LayoutItem>
  );
};
note.displayName = 'Task.note';

const patientName: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useTaskBinding(section);

  return (
    <LayoutItem fieldId="patientName" label="Patient name" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.patientName || ''}
        size="medium"
        readOnly
        borderless
      />
    </LayoutItem>
  );
};
patientName.displayName = 'Task.patientName';

const priority: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useTaskBinding(section);
  const options = useCodeList('MOIS-TASKPRIORITY');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  return (
    <LayoutItem fieldId="priority" label="Priority" size="medium" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="priority"
        codeSystem="MOIS-TASKPRIORITY"
        selectedKey={codeOf(data?.priority) || undefined}
        options={dropdownOptions}
        size="medium"
        onChange={(_, option) => {
          if (option) {
            setField('priority', toCodedValue(option, 'MOIS-TASKPRIORITY'));
          }
        }}
      />
    </LayoutItem>
  );
};
priority.displayName = 'Task.priority';

// ============================================================================
// Fields Collection
// ============================================================================

const Fields = {
  createdDate,
  description,
  dueDate,
  note,
  patientName,
  priority,
};

// ============================================================================
// Column Definitions (for table views)
// ============================================================================

const Columns = {
  taskId: {
    title: 'ID',
    id: 'taskId',
    type: 'hidden',
  },
  documentId: {
    title: 'Document ID',
    id: 'documentId',
    type: 'hidden',
  },
  encounterId: {
    title: 'Encounter ID',
    id: 'encounterId',
    type: 'hidden',
  },
  patientId: {
    title: 'Patient ID',
    id: 'patientId',
    type: 'hidden',
  },
  assignee: {
    title: 'Assignee',
    id: 'assignee',
    type: 'string',
    size: 'small',
  },
  createdDate: {
    title: 'Created',
    id: 'createdDate',
    type: 'date',
    size: 'tiny',
  },
  description: {
    title: 'Task',
    id: 'description',
    type: 'string',
    size: 'small',
  },
  dueDate: {
    title: 'Due',
    id: 'dueDate',
    type: 'date',
    size: 'tiny',
  },
  isAcknowledged: {
    title: 'Ack.',
    id: 'isAcknowledged',
    type: 'code',
    size: 'tiny',
  },
  isComplete: {
    title: 'Com.',
    id: 'isComplete',
    type: 'code',
    size: 'tiny',
  },
  note: {
    title: 'Detail',
    id: 'note',
    type: 'string',
    size: 'large',
  },
  patientName: {
    title: 'Patient name',
    id: 'patientName',
    type: 'string',
    size: 'small',
  },
  priority: {
    title: 'Priority',
    id: 'priority',
    type: 'code',
    size: 'tiny',
  },
};

// ============================================================================
// All Component (renders the placed fields, or every field with no placement)
// ============================================================================

const All: React.FC<any> = (props) => <ArchAll fields={Fields} {...props} />;

// ============================================================================
// Task Archetype Export
// ============================================================================

export const Task = {
  All,
  Columns,
  Fields,
  createdDate: Fields.createdDate,
  description: Fields.description,
  dueDate: Fields.dueDate,
  note: Fields.note,
  patientName: Fields.patientName,
  priority: Fields.priority,
};

export default Task;
