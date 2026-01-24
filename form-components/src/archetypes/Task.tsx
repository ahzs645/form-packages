/**
 * Task Archetype
 * The Task archetype displays information about tasks assigned to a user.
 * Tasks are attached to MOIS objects.
 */

import React, { useCallback } from 'react';
import { IDropdownOption } from '@fluentui/react';
import { LayoutItem } from '../components/Layout';
import { useActiveData, useCodeList } from '../context/MoisContext';
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
// Hooks
// ============================================================================

const useTaskData = (): [TaskData, (updates: Partial<TaskData>) => void] => {
  const [activeData, setActiveData] = useActiveData();
  const data = (activeData as any).example?.task;

  // Memoize setData to prevent infinite re-renders
  const setData = useCallback((updates: Partial<TaskData>) => {
    setActiveData((current: any) => ({
      ...current,
      example: {
        ...current.example,
        task: { ...current.example?.task, ...updates },
      },
    }));
  }, [setActiveData]);

  return [data || defaultTask, setData];
};

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

const createdDate: React.FC<{ index?: number }> = ({ index }) => {
  const [data, setData] = useTaskData();

  return (
    <LayoutItem label="Created date" size="small" index={index}>
      <DateSelect
        inline
        value={data?.createdDate ? formatDate(data.createdDate) : ''}
        size="small"
        onChange={(dateStr) => {
          if (dateStr) {
            // Convert from YYYY.MM.DD to YYYY-MM-DD
            setData({ createdDate: dateStr.replace(/\./g, '-') });
          }
        }}
      />
    </LayoutItem>
  );
};

const description: React.FC<{ index?: number }> = ({ index }) => {
  const [data, setData] = useTaskData();

  return (
    <LayoutItem label="Task" size="medium" index={index}>
      <MoisTextField
        value={data?.description || ''}
        size="medium"
        onChange={(_, val) => setData({ description: val || '' })}
      />
    </LayoutItem>
  );
};

const dueDate: React.FC<{ index?: number }> = ({ index }) => {
  const [data, setData] = useTaskData();

  return (
    <LayoutItem label="Due date" size="small" index={index}>
      <DateSelect
        inline
        value={data?.dueDate ? formatDate(data.dueDate) : ''}
        size="small"
        onChange={(dateStr) => {
          if (dateStr) {
            // Convert from YYYY.MM.DD to YYYY-MM-DD
            setData({ dueDate: dateStr.replace(/\./g, '-') });
          }
        }}
      />
    </LayoutItem>
  );
};

const note: React.FC<{ index?: number }> = ({ index }) => {
  const [data, setData] = useTaskData();

  return (
    <LayoutItem label="Detail" size="max" index={index}>
      <MoisTextField
        value={data?.note || ''}
        size="max"
        multiline
        onChange={(_, val) => setData({ note: val || '' })}
      />
    </LayoutItem>
  );
};

const patientName: React.FC<{ index?: number }> = ({ index }) => {
  const [data] = useTaskData();

  return (
    <LayoutItem label="Patient name" size="medium" index={index}>
      <MoisTextField
        value={data?.patientName || ''}
        size="medium"
        readOnly
        borderless
      />
    </LayoutItem>
  );
};

const priority: React.FC<{ index?: number }> = ({ index }) => {
  const [data, setData] = useTaskData();
  const options = useCodeList('MOIS-TASKPRIORITY');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  return (
    <LayoutItem label="Priority" size="medium" index={index}>
      <MoisDropdown
        fieldId="priority"
        codeSystem="MOIS-TASKPRIORITY"
        selectedKey={data?.priority?.code || undefined}
        options={dropdownOptions}
        size="medium"
        onChange={(_, option) => {
          if (option) {
            setData({
              priority: {
                code: String(option.key),
                display: option.text,
                system: 'MOIS-TASKPRIORITY',
              },
            });
          }
        }}
      />
    </LayoutItem>
  );
};

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
// All Component
// ============================================================================

const All: React.FC = () => {
  return (
    <div>
      <Fields.createdDate />
      <Fields.description />
      <Fields.dueDate />
      <Fields.note />
      <Fields.patientName />
      <Fields.priority />
    </div>
  );
};

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
