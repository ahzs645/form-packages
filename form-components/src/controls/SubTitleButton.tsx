/**
 * SubTitleButton Component
 * Close button utilizing Fluent's DefaultButton
 */

import React from 'react';
import { DefaultButton, IButtonStyles } from '@fluentui/react';

export interface SubTitleButtonProps {
  /** Indicate whether the button is disabled or not */
  disabled?: boolean;
  /** Icon name */
  iconName?: string;
  /** Icon props */
  iconProps?: any;
  /** A callback when button is clicked. Default is onClose */
  onClick?: () => void;
  /** Button size */
  size?: string;
  /** Button text */
  text?: string;
}

/**
 * SubTitleButton - Button for use in subtitle areas
 */
export const SubTitleButton: React.FC<SubTitleButtonProps> = ({
  disabled = false,
  iconName,
  iconProps,
  onClick,
  size = 'tiny',
  text,
}) => {
  // Square button styling matching reference
  const buttonStyles: IButtonStyles = {
    root: {
      minWidth: 30,
      width: text ? 'auto' : 34,
      height: 32,
      padding: text ? '0 16px' : 0,
      margin: '8px 10px 8px 8px',
      maxWidth: 'calc(100% - 16px)',
      borderRadius: 2,
    },
    flexContainer: {
      justifyContent: 'center',
    },
  };

  // Merge iconName into iconProps if provided
  const mergedIconProps = iconName
    ? { iconName, ...iconProps }
    : iconProps;

  return (
    <DefaultButton
      text={text}
      iconProps={mergedIconProps}
      onClick={onClick}
      disabled={disabled}
      styles={buttonStyles}
    />
  );
};

/**
 * SubTitleButtonDemo1 - Typical use with icon
 */
export const SubTitleButtonDemo1: React.FC = () => {
  return (
    <SubTitleButton
      iconName="AddFriend"
    />
  );
};

export default SubTitleButton;
