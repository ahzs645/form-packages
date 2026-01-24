/**
 * HouseholdOccupant Component
 * Display a list of persons living with the patient (household occupants) as
 * recorded in the chart. By default, it will display all recorded entries and
 * then the user can choose selected co-occupants for display on the form.
 *
 * This control is a rename of the 'Occupant' control (now deprecated).
 */

import React from 'react';
import { ListSelection, ListSelectionProps } from '../controls/ListSelection';

export interface HouseholdOccupantData {
  householdOccupantId: number;
  className?: string;
  startDate?: string;
  stopDate?: string;
  occupantRelationship?: {
    code: string;
    display: string;
    system: string;
  };
  note?: string;
  quantity?: number;
  patientId?: number;
}

export interface HouseholdOccupantProps {
  /** Active field name. */
  fieldId?: string;
  /** Source and active field name. */
  id?: string;
  /** Label for this field. */
  label?: string;
  /** Override Props for the Mois ListSelection control. */
  listSelectionProps?: Partial<ListSelectionProps>;
  /** Placeholder text is shown when the field is empty. */
  placeholder?: string;
  /** Change selection button text. */
  selectText?: string;
  /** Type of selection. */
  selectionType?: 'none' | 'single' | 'multiple';
}

// Pre-configured columns for household occupant data
const householdOccupantColumns = [
  {
    id: 'householdOccupantId',
    type: 'key',
  },
  {
    title: 'From',
    id: 'startDate',
    type: 'date',
  },
  {
    title: 'To',
    id: 'stopDate',
    type: 'date',
  },
  {
    title: 'Relationship',
    id: 'occupantRelationship',
    type: 'code',
    size: 'medium',
  },
  {
    title: 'Note',
    id: 'note',
    type: 'string',
  },
];

/**
 * HouseholdOccupant - A pre-configured ListSelection for household occupants.
 * This is a thin wrapper around ListSelection with household-specific columns.
 */
export const HouseholdOccupant: React.FC<HouseholdOccupantProps> = ({
  id = 'householdOccupants',
  fieldId,
  label = 'Household occupants',
  placeholder = 'No record of who is living with patient',
  selectText = 'Select specific household occupants',
  selectionType = 'multiple',
  listSelectionProps = {},
}) => {
  return (
    <ListSelection
      id={id}
      fieldId={fieldId}
      label={label}
      placeholder={placeholder}
      selectText={selectText}
      selectionType={selectionType}
      columns={householdOccupantColumns as any}
      {...listSelectionProps}
    />
  );
};

// Deprecated alias
export const Occupant = HouseholdOccupant;

export default HouseholdOccupant;
