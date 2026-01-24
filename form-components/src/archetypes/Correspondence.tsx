/**
 * Correspondence Archetype
 * Components for displaying and updating patient correspondence records
 * (email, phone, video, etc.) related to an encounter.
 *
 * Uses reusable controls: DateTimeSelect (for when field)
 */

import React, { useCallback } from 'react';
import { LayoutItem } from '../components/Layout';
import { useActiveData } from '../context/MoisContext';
import { MoisTextField } from '../components/MoisTextField';
import { DateTimeSelect } from '../controls/DateTimeSelect';

// Correspondence data interface
interface CorrespondenceData {
  correspondenceId: number;
  className: string;
  when: string;
  direction: string;
  person: string;
  contact: string;
  note: string;
  stamp: {
    createdDate: string;
    createdBy: string;
    modifiedDate: string;
    modifiedBy: string;
  };
}

const defaultCorrespondence: CorrespondenceData = {
  correspondenceId: 1,
  className: 'Correspondence',
  when: '2024-01-15T10:30:00',
  direction: 'Outgoing',
  person: 'John Smith',
  contact: 'Phone Call',
  note: 'Discussed treatment plan',
  stamp: {
    createdDate: '2024.01.15 - 10:30',
    createdBy: 'Dr. Smith',
    modifiedDate: '',
    modifiedBy: '',
  },
};

// ============================================================================
// Hooks
// ============================================================================

const useCorrespondenceData = (): [any, (updates: any) => void] => {
  const [activeData, setActiveData] = useActiveData();
  // Use encounter.correspondences[0] from JSON (primary) or fall back to correspondence
  const data = (activeData as any).example?.encounter?.correspondences?.[0]
    || (activeData as any).example?.correspondence;

  // Memoize setData to prevent infinite re-renders
  const setData = useCallback((updates: any) => {
    setActiveData((current: any) => ({
      ...current,
      example: {
        ...current.example,
        correspondence: { ...current.example?.correspondence, ...updates },
      },
    }));
  }, [setActiveData]);

  return [data || defaultCorrespondence, setData];
};

// ============================================================================
// Field Components
// ============================================================================

const contact: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useCorrespondenceData();

  return (
    <LayoutItem label="Contact" size="medium" index={index}>
      <MoisTextField
        value={data?.contact || ''}
        size="medium"
        onChange={(_, val) => setData({ contact: val || '' })}
      />
    </LayoutItem>
  );
};

const direction: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useCorrespondenceData();

  return (
    <LayoutItem label="Direction" size="small" index={index}>
      <MoisTextField
        value={data?.direction || ''}
        size="small"
        onChange={(_, val) => setData({ direction: val || '' })}
      />
    </LayoutItem>
  );
};

const note: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useCorrespondenceData();

  return (
    <LayoutItem label="Note" size="medium" index={index}>
      <MoisTextField
        value={data?.note || ''}
        multiline
        rows={3}
        size="medium"
        onChange={(_, val) => setData({ note: val || '' })}
      />
    </LayoutItem>
  );
};

// When field - uses DateTimeSelect for date and time handling
const when: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = useCorrespondenceData();

  // Parse date and time from the when field
  const getDefaultDate = () => {
    if (!data?.when) return undefined;
    try {
      const dateObj = new Date(data.when);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}.${month}.${day}`;
    } catch {
      return undefined;
    }
  };

  const getDefaultTime = () => {
    if (!data?.when) return '00:00';
    try {
      const dateObj = new Date(data.when);
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '00:00';
    }
  };

  const handleChange = (value: { date?: string; time?: string }) => {
    if (value.date) {
      // Combine date and time into ISO string
      const [year, month, day] = value.date.split('.').map(Number);
      const [hours, minutes] = (value.time || '00:00').split(':').map(Number);
      const newDate = new Date(year, month - 1, day, hours, minutes);
      setData({ when: newDate.toISOString() });
    } else {
      setData({ when: null });
    }
  };

  return (
    <DateTimeSelect
      label="When"
      fieldId="when"
      index={index}
      defaultValue={getDefaultDate()}
      defaultTime={getDefaultTime()}
      size="medium"
      onChange={handleChange}
      {...props}
    />
  );
};

// ============================================================================
// Fields Collection
// ============================================================================

const Fields = {
  contact,
  direction,
  note,
  when,
};

// Column definitions for grid/table views
const Columns = {
  correspondenceId: {
    title: 'ID',
    id: 'correspondenceId',
    type: 'hidden',
  },
  className: {
    title: 'Class name',
    id: 'className',
    type: 'hidden',
  },
  contact: {
    title: 'Contact',
    id: 'contact',
    type: 'string',
    size: 'small',
  },
  direction: {
    title: 'Direction',
    id: 'direction',
    type: 'string',
    size: 'small',
  },
  note: {
    title: 'Note',
    id: 'note',
    type: 'string',
    size: 'medium',
  },
  person: {
    title: 'Person',
    id: 'person',
    type: 'string',
    size: 'medium',
  },
  when: {
    title: 'When',
    id: 'when',
    type: 'date',
    size: 'small',
  },
};

// ============================================================================
// All Component (renders all fields)
// ============================================================================

const All: React.FC<any> = (props) => {
  return (
    <div>
      <Fields.contact {...props} />
      <Fields.direction {...props} />
      <Fields.note {...props} />
      <Fields.when {...props} />
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export const Correspondence = {
  ...Fields,
  All,
  Columns,
  Fields,
};

export default Correspondence;
