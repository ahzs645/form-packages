/**
 * Correspondence Archetype
 * Components for displaying and updating patient correspondence records
 * (email, phone, video, etc.) related to an encounter.
 *
 * MOIS parity notes:
 * - Every field passes a stable fieldId (its Fields-map key) so section
 *   fieldPlacement can select and position it (`<Grid placement=...>`).
 * - `All` renders the fields as a Fragment in placement order — fields must be
 *   direct grid children for per-field gridArea to work.
 * - Fields read/write through the section's activeSelector when one is set;
 *   without a custom section they fall back to the JSON example data
 *   (encounter.correspondences[0], then correspondence) for gallery demos.
 *
 * Uses reusable controls: DateTimeSelect (for when field)
 */

import React from 'react';
import { LayoutItem, ArchAll } from '../components/Layout';
import { SectionContextValue } from '../context/MoisContext';
import { useArchetypeBinding, ArchetypeBinding } from './archetype-binding';
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
// Section-aware data access
// ============================================================================

const useCorrespondenceBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ArchetypeBinding =>
  useArchetypeBinding({
    // Use encounter.correspondences[0] from JSON (primary) or fall back to correspondence
    exampleData: (activeData) =>
      activeData.example?.encounter?.correspondences?.[0]
      || activeData.example?.correspondence
      || defaultCorrespondence,
    exampleTarget: (draft) => {
      draft.example = draft.example || {};
      return draft.example.encounter?.correspondences?.[0]
        ?? (draft.example.correspondence = draft.example.correspondence || {});
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

const contact: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useCorrespondenceBinding(section);

  return (
    <LayoutItem fieldId="contact" label="Contact" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.contact || ''}
        size="medium"
        onChange={(_, val) => setField('contact', val || '')}
      />
    </LayoutItem>
  );
};
contact.displayName = 'Correspondence.contact';

const direction: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useCorrespondenceBinding(section);

  return (
    <LayoutItem fieldId="direction" label="Direction" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.direction || ''}
        size="small"
        onChange={(_, val) => setField('direction', val || '')}
      />
    </LayoutItem>
  );
};
direction.displayName = 'Correspondence.direction';

const note: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useCorrespondenceBinding(section);

  return (
    <LayoutItem fieldId="note" label="Note" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.note || ''}
        multiline
        rows={3}
        size="medium"
        onChange={(_, val) => setField('note', val || '')}
      />
    </LayoutItem>
  );
};
note.displayName = 'Correspondence.note';

// When field - uses DateTimeSelect for date and time handling
const when: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = useCorrespondenceBinding(section);

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
      setField('when', newDate.toISOString());
    } else {
      setField('when', null);
    }
  };

  return (
    <DateTimeSelect
      label="When"
      fieldId="when"
      index={index as number | undefined}
      section={section}
      defaultValue={getDefaultDate()}
      defaultTime={getDefaultTime()}
      size="medium"
      onChange={handleChange}
      {...rest}
    />
  );
};
when.displayName = 'Correspondence.when';

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
// All Component (renders the placed fields, or every field with no placement)
// ============================================================================

const All: React.FC<any> = (props) => {
  return <ArchAll fields={Fields} {...props} />;
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
