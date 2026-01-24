/**
 * FormCreationHistory Component
 * Display form creation history, created at, created by, and date created
 */

import React from 'react';
import { TextField, Dropdown, IDropdownOption } from '@fluentui/react';
import { LayoutItem } from './Layout';
import { DateSelect } from '../controls/DateSelect';
import { useSourceData, useTheme } from '../context/MoisContext';

export interface FormCreationHistoryProps {
  /** Created by user name */
  createdBy?: string;
  /** Service location */
  serviceLocation?: string;
  /** Date created (YYYY.MM.DD format) */
  dateCreated?: string;
  /** Available service locations */
  serviceLocationOptions?: IDropdownOption[];
  /** Read only mode */
  readOnly?: boolean;
  /** Callback when created by changes */
  onCreatedByChange?: (value: string) => void;
  /** Callback when service location changes */
  onServiceLocationChange?: (value: string) => void;
  /** Callback when date created changes */
  onDateCreatedChange?: (date: string) => void;
}

// Default service locations
const defaultServiceLocations: IDropdownOption[] = [
  { key: 'FAMILY PRACTICE', text: 'FAMILY PRACTICE' },
  { key: 'NEPHROLOGY', text: 'NEPHROLOGY' },
  { key: 'CARDIOLOGY', text: 'CARDIOLOGY' },
  { key: 'EMERGENCY', text: 'EMERGENCY' },
];

// Format date to YYYY.MM.DD
const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

export const FormCreationHistory: React.FC<FormCreationHistoryProps> = ({
  createdBy: propCreatedBy,
  serviceLocation: propServiceLocation,
  dateCreated: propDateCreated,
  serviceLocationOptions = defaultServiceLocations,
  readOnly = false,
  onCreatedByChange,
  onServiceLocationChange,
  onDateCreatedChange,
}) => {
  const sourceData = useSourceData();
  const theme = useTheme();

  // Get values from props or source data
  const webform = (sourceData as any).webform;
  const userProfile = (sourceData as any).userProfile;

  const createdBy = propCreatedBy ?? userProfile?.identity?.fullName ?? 'ADMINISTRATOR';
  const serviceLocation = propServiceLocation ?? webform?.encounter?.location ?? 'FAMILY PRACTICE';

  // Get date created as string in YYYY.MM.DD format
  let dateCreated: string;
  if (propDateCreated) {
    dateCreated = propDateCreated;
  } else if (webform?.document?.stamp?.createTime) {
    dateCreated = formatDateString(new Date(webform.document.stamp.createTime));
  } else {
    dateCreated = formatDateString(new Date());
  }

  // Get size styles from theme for dropdown wrapper
  const sizeStyles = theme.mois.sizes.medium;
  const dropdownWrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'column',
    ...sizeStyles,
  };

  return (
    <div>
      {/* Created By */}
      <LayoutItem label="Created By" size="medium">
        <TextField
          value={createdBy}
          readOnly={readOnly}
          onChange={(_, val) => onCreatedByChange?.(val || '')}
          styles={{ root: { width: '100%' } }}
        />
      </LayoutItem>

      {/* Service Location */}
      <LayoutItem label="Service Location" size="medium">
        <div style={dropdownWrapperStyle}>
          <Dropdown
            selectedKey={serviceLocation}
            options={serviceLocationOptions}
            disabled={readOnly}
            onChange={(_, option) => onServiceLocationChange?.(option?.key as string || '')}
            styles={{ root: { width: '100%' } }}
          />
        </div>
      </LayoutItem>

      {/* Date Created */}
      <LayoutItem label="Date Created" size="medium">
        <DateSelect
          inline
          value={dateCreated}
          placeholder="YYYY.MM.DD"
          disabled={readOnly}
          onChange={(date) => onDateCreatedChange?.(date)}
          size="medium"
        />
      </LayoutItem>
    </div>
  );
};

export default FormCreationHistory;
