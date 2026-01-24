/**
 * Contact Component
 * Display a list of patient associated parties (contacts). By default, it will
 * display all associated parties in the chart. The user can select from the list for
 * the form.
 */

import React from 'react';
import { ListSelection, ListSelectionProps } from '../controls/ListSelection';

// Contact/Associated party data interface
export interface ContactData {
  associatedPartyId: number;
  name: string;
  relationship: string;
  relationshipType: string;
  telecom?: {
    homePhone?: string;
    workPhone?: string;
    workExt?: string;
    cellPhone?: string;
    pagerNumber?: string;
  };
  preferredPhone?: { code: string };
  address?: { text: string };
}

export interface ContactProps {
  /** Active field name */
  fieldId?: string;
  /** Source and active field name */
  id?: string;
  /** Label for this field */
  label?: string;
  /** Override Props for the Mois ListSelection control */
  listSelectionProps?: Partial<ListSelectionProps>;
  /** Change selection button text */
  selectText?: string;
  /** Type of selection */
  selectionType?: 'none' | 'single' | 'multiple';
}

// Phone type mapping
const phoneTypes: Record<string, string> = {
  '1': 'homePhone',
  '2': 'workPhone',
  '3': 'cellPhone',
  '4': 'pagerNumber',
};

const phoneLabels: Record<string, string> = {
  '1': 'Home',
  '2': 'Work',
  '3': 'Cell',
  '4': 'Pager',
};

// Format a single phone number with label
const formatOneNumber = (contact: ContactData, phoneCode: string): string => {
  const phoneField = phoneTypes[phoneCode];
  const phone = contact.telecom?.[phoneField as keyof typeof contact.telecom];
  if (!phone) return '';

  const isPreferred = phoneCode === contact.preferredPhone?.code;
  const isWork = phoneCode === '2';
  let result = '';

  result += isPreferred ? '**' : '';
  result += phone;
  if (isWork && contact.telecom?.workExt) {
    result += ` Ext. ${contact.telecom.workExt}`;
  }
  result += ` ${phoneLabels[phoneCode]}`;
  result += isPreferred ? '**' : '';

  return result;
};

/**
 * Get formatted contact phone numbers as markdown string.
 * Exported for use in custom column rendering.
 */
export const getContactNumbers = (contact: ContactData): string => {
  let result = '';

  // First add preferred phone
  if (contact.preferredPhone?.code && contact.preferredPhone.code in phoneTypes) {
    result = formatOneNumber(contact, contact.preferredPhone.code);
  }

  // Then add other phones
  for (const code in phoneTypes) {
    if (code !== contact.preferredPhone?.code) {
      const formatted = formatOneNumber(contact, code);
      if (formatted) {
        if (result.length > 0) {
          result += '  \n';
        }
        result += formatted;
      }
    }
  }

  return result;
};

// Pre-configured columns for contact data
const contactColumns = [
  {
    id: 'associatedPartyId',
    type: 'key',
  },
  {
    title: 'Name',
    id: 'name',
    type: 'string',
    size: 'small',
  },
  {
    title: 'Relationship',
    id: 'relationship',
    type: 'string',
    size: 'small',
  },
  {
    title: 'Role',
    id: 'relationshipType',
    type: 'code',
  },
  {
    title: 'Phones',
    id: 'phones',
    type: 'markdown',
    compute: getContactNumbers,
  },
  {
    title: 'Address',
    id: 'address',
    type: 'text',
    compute: (item: ContactData) => item.address?.text || '',
  },
];

/**
 * Contact - A pre-configured ListSelection for patient associated parties.
 * This is a thin wrapper around ListSelection with contact-specific columns.
 */
export const Contact: React.FC<ContactProps> = ({
  selectText = 'Select contacts',
  id = 'contacts',
  fieldId,
  selectionType = 'multiple',
  label,
  listSelectionProps = {},
}) => {
  return (
    <ListSelection
      id={id}
      fieldId={fieldId}
      label={label}
      selectText={selectText}
      selectionType={selectionType}
      columns={contactColumns as any}
      {...listSelectionProps}
    />
  );
};

export default Contact;
