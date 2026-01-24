/**
 * CloseButton Component
 * Close button utilizing Fluent's DefaultButton.
 */

import React, { useState, useCallback } from 'react';
import { DefaultButton, MessageBarType } from '@fluentui/react';
import { Toast } from './Toast';
import { useButtonSize, ButtonSize } from '../context/MoisContext';

export type SimpleHandler = () => void;

export interface CloseButtonProps {
  /** Indicate whether the button is disabled or not */
  disabled?: boolean;
  /** A callback when button is clicked. Default is onClose */
  onClick?: () => void;
  /** Function called when the close button is clicked. Default is to close the window */
  onClose?: SimpleHandler;
  /** Button size (min, tiny, small, medium, large, max) */
  size?: ButtonSize;
  /** Button text */
  text?: string;
}

export const CloseButton: React.FC<CloseButtonProps> = ({
  disabled = false,
  onClick,
  onClose,
  size = 'small',
  text = 'Close',
}) => {
  const [showToast, setShowToast] = useState(false);

  // Get theme-based button styles (centralized)
  const buttonStyles = useButtonSize(size);

  // Only show default toast if no custom handler is provided
  const hasCustomHandler = onClick || onClose;

  const handleClick = useCallback(() => {
    // Call onClick if provided
    if (onClick) {
      onClick();
    } else if (onClose) {
      // Fall back to onClose
      onClose();
    } else {
      // Only show default toast if no handler provided
      setShowToast(true);
    }
  }, [onClick, onClose]);

  const handleToastDismiss = useCallback(() => {
    setShowToast(false);
  }, []);

  return (
    <>
      <DefaultButton
        data-automation-id="close"
        text={text}
        disabled={disabled}
        onClick={handleClick}
        styles={buttonStyles}
      />
      {!hasCustomHandler && (
        <Toast
          message="Close button pressed"
          type={MessageBarType.info}
          visible={showToast}
          onDismiss={handleToastDismiss}
          autoDismiss={3000}
        />
      )}
    </>
  );
};

export default CloseButton;
