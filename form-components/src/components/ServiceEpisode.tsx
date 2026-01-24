/**
 * ServiceEpisode Component
 * Provide dropdown selection of a single service episode. The initial data is
 * obtained from the patient object.
 */

import React from 'react';
import { ListSelection, ListSelectionProps } from '../controls/ListSelection';

/** Service episode data type */
export interface ServiceEpisodeData {
  serviceEpisodeId?: number;
  startDate?: string;
  endDate?: string;
  service?: {
    code: string;
    display: string;
    system?: string;
  };
  serviceMrp?: {
    code: string;
    display: string;
    system?: string;
  };
}

export interface ServiceEpisodeProps {
  /** Active field name */
  fieldId?: string;
  /** Source and active field name */
  id?: string;
  /** Label for this field */
  label?: string;
  /** Compare function for initial sorting of the list */
  listCompare?: (a: any, b: any) => number;
  /** Override Props for the Mois ListSelection control */
  listSelectionProps?: Partial<ListSelectionProps>;
  /** A readOnly control is always view only */
  readOnly?: boolean;
  /** Change selection button text */
  selectText?: string;
  /** Type of selection */
  selectionType?: 'none' | 'single' | 'multiple';
}

// Default sort: by start date descending
const startDateDesc = (a: ServiceEpisodeData, b: ServiceEpisodeData): number => {
  return -(a.startDate || '').localeCompare(b.startDate || '');
};

// Pre-configured columns for service episode data
const serviceEpisodeColumns = [
  {
    id: 'serviceEpisodeId',
    type: 'key',
  },
  {
    title: 'Start',
    id: 'startDate',
    type: 'date',
  },
  {
    title: 'End',
    id: 'endDate',
    type: 'date',
  },
  {
    title: 'Service Episode',
    id: 'service',
    type: 'code',
    size: 'large',
  },
  {
    title: 'Service MRP',
    id: 'serviceMrp',
    type: 'code',
    size: 'small',
  },
];

/**
 * ServiceEpisode - A pre-configured ListSelection for service episodes.
 * This is a thin wrapper around ListSelection with service episode columns.
 */
export const ServiceEpisode: React.FC<ServiceEpisodeProps> = ({
  id = 'serviceEpisodes',
  fieldId,
  label,
  readOnly = false,
  selectText = 'Select service episodes',
  selectionType = 'single',
  listCompare = startDateDesc,
  listSelectionProps = {},
}) => {
  return (
    <ListSelection
      id={id}
      fieldId={fieldId}
      label={label}
      selectionType={selectionType}
      columns={serviceEpisodeColumns as any}
      selectText={selectText}
      readOnly={readOnly}
      listCompare={listCompare}
      {...listSelectionProps}
    />
  );
};

export default ServiceEpisode;
