/**
 * SaveStatus Component
 * Show a small block with save status and basic audit information
 */

import React from 'react';
import { Text } from '@fluentui/react';

export interface SaveStatusProps {
  /** Show information even when form has never been saved */
  noHide?: boolean;
  /** Display size */
  size?: 'small' | 'medium' | 'large';
  /** Save status - determines what message to show */
  status?: 'never-saved' | 'saved' | 'modified';
  /** Last saved date */
  lastSaved?: Date | string;
  /** Last saved by user */
  lastSavedBy?: string;
}

export const SaveStatus: React.FC<SaveStatusProps> = ({
  noHide = false,
  size = 'medium',
  status = 'never-saved',
  lastSaved,
  lastSavedBy,
}) => {
  const getStatusMessage = () => {
    switch (status) {
      case 'never-saved':
        return noHide ? 'Not saved' : '';
      case 'saved':
        if (lastSaved && lastSavedBy) {
          const dateStr = lastSaved instanceof Date
            ? lastSaved.toLocaleString()
            : lastSaved;
          return `Saved: ${dateStr} by ${lastSavedBy}`;
        }
        return 'Saved';
      case 'modified':
        return 'Unsaved changes';
      default:
        return noHide ? 'Not saved' : '';
    }
  };

  const message = getStatusMessage();

  // Hide if no message and noHide is false
  if (!message) {
    return null;
  }

  const getFontSize = () => {
    switch (size) {
      case 'small': return '12px';
      case 'large': return '16px';
      default: return '14px';
    }
  };

  return (
    <Text
      style={{
        color: 'white',
        fontSize: getFontSize(),
        marginLeft: '8px',
        alignSelf: 'center',
      }}
    >
      {message}
    </Text>
  );
};

export default SaveStatus;
