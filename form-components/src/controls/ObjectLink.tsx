/**
 * ObjectLink Component
 * Link to a MOIS object by type and ID
 */

import React from 'react';
import { ActionButton, Label } from '@fluentui/react';

export interface ObjectLinkProps {
  /** Object ID to link to */
  objectId?: number;
  /** Object type name */
  objectType?: string;
  /** Field ID for object type in active data */
  objectTypeFieldId?: string;
  /** Object type identifier */
  objectTypeId?: string;
  /** Source ID for object type */
  objectTypeSourceId?: string;
  /** Active field name */
  fieldId?: string;
  /** Source and active field name */
  id?: string;
  /** Source field name */
  sourceId?: string;
  /** Click handler */
  onClick?: () => void;
  /** Placeholder text when not linked */
  placeholder?: string;
  /** Label for this field */
  label?: string;
  /** Label position */
  labelPosition?: 'top' | 'left' | 'none';
  /** Style override */
  style?: React.CSSProperties;
}

/**
 * ObjectLink - Link to a MOIS object
 *
 * Displays a link button that can navigate to a MOIS object
 * identified by type and ID.
 */
export const ObjectLink: React.FC<ObjectLinkProps> = ({
  objectId,
  objectType,
  onClick,
  placeholder = 'Not linked',
  label,
  labelPosition = 'top',
  style,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (objectId && objectType) {
      console.log(`Navigate to ${objectType}: ${objectId}`);
    }
  };

  const containerStyles: React.CSSProperties = {
    breakInside: 'avoid',
    margin: '8px 0px',
    ...style,
  };

  const wrapperStyles: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'wrap',
    minWidth: '80px',
  };

  const fieldWrapperStyles: React.CSSProperties = {
    flex: '2 1 0%',
    display: 'flex',
    flexFlow: 'wrap',
    minWidth: '80px',
  };

  // Determine the display text
  let displayText: string;
  if (!objectType) {
    displayText = 'Nothing linked';
  } else if (!objectId) {
    displayText = placeholder;
  } else {
    displayText = `${objectType}: ${objectId}`;
  }

  return (
    <div style={containerStyles}>
      {label && labelPosition !== 'none' && (
        <Label>{label}</Label>
      )}
      <div style={wrapperStyles}>
        <div style={fieldWrapperStyles}>
          <ActionButton
            onClick={handleClick}
            disabled={!objectId}
            iconProps={{ iconName: 'PreviewLink' }}
          >
            {displayText}
          </ActionButton>
        </div>
      </div>
      <div style={{ clear: 'both' }} />
    </div>
  );
};

export default ObjectLink;
