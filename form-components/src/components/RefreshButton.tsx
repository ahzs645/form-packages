/**
 * RefreshButton Component
 * Refresh button. When pushed, the refresh action is started which re-queries
 * the form patient data.
 */

import React from 'react';
import { DefaultButton } from '@fluentui/react';
import { useButtonSize, ButtonSize } from '../context/MoisContext';

export interface RefreshButtonProps {
  /** Indicate whether the button is disabled or not */
  disabled?: boolean;
  /** A callback when button is clicked. Default is refresh */
  onClick?: () => void;
  /** Function called when the refresh button is clicked. Default is the refresh action */
  onRefresh?: () => void;
  /** Button size (min, tiny, small, medium, large, max) */
  size?: ButtonSize;
  /** Button text */
  text?: string;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  disabled,
  onClick,
  onRefresh,
  size = 'small',
  text = 'Refresh',
}) => {
  // Get theme-based button styles (centralized)
  const buttonStyles = useButtonSize(size);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onRefresh) {
      onRefresh();
    } else {
      // Default refresh action - in real implementation would re-query form data
      console.log('Refresh action triggered');
    }
  };

  return (
    <DefaultButton
      data-automation-id="refresh"
      text={text}
      disabled={disabled}
      onClick={handleClick}
      styles={buttonStyles}
    />
  );
};

export default RefreshButton;
