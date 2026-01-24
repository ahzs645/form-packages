/**
 * SaveButton Component
 * Save draft button utilizing Fluent's DefaultButton
 */

import React, { useState } from 'react';
import { DefaultButton, MessageBar, MessageBarType } from '@fluentui/react';
import { useButtonSize, ButtonSize } from '../context/MoisContext';

export interface SaveButtonProps {
  /** Indicate whether the button is disabled or not */
  disabled?: boolean;
  /** Callback to build saveData for saveSubmit or signSubmit action */
  getSaveData?: () => any;
  /** A callback when button is clicked */
  onClick?: () => void;
  /** Function called when save button is clicked */
  onSave?: () => void;
  /** Button size (min, tiny, small, medium, large, max) */
  size?: ButtonSize;
  /** Button text */
  text?: string;
}

const toastContainerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '120px',
  right: '50px',
  zIndex: 1950,
  width: '400px',
};

export const SaveButton: React.FC<SaveButtonProps> = ({
  disabled,
  getSaveData,
  onClick,
  onSave,
  size = 'small',
  text = 'Save draft',
}) => {
  const [showToast, setShowToast] = useState(false);

  // Get theme-based button styles (centralized)
  const buttonStyles = useButtonSize(size);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onSave) {
      onSave();
    } else {
      // Default save action - show toast notification
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  return (
    <>
      <DefaultButton
        data-automation-id="save"
        text={text}
        disabled={disabled}
        onClick={handleClick}
        styles={buttonStyles}
      />
      {showToast && (
        <div style={toastContainerStyle}>
          <MessageBar
            messageBarType={MessageBarType.info}
            isMultiline={false}
            onDismiss={() => setShowToast(false)}
            dismissButtonAriaLabel="Close"
          >
            Save button clicked
          </MessageBar>
        </div>
      )}
    </>
  );
};

export default SaveButton;
