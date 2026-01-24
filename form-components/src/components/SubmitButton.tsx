import React from 'react';
import { PrimaryButton } from '@fluentui/react';
import { useButtonSize, ButtonSize } from '../context/MoisContext';

export interface SubmitButtonProps {
  /** Should the form be automatically signed when submitted? */
  autoSign?: boolean;
  /** Indicate whether the button is disabled or not */
  disabled?: boolean;
  /** Callback to build saveData for saveSubmit or signSubmit action */
  getSaveData?: (sourceData: any, formData: any) => any;
  /** Should the window immediately closed after submission? */
  noClose?: boolean;
  /** A callback to override click action */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Callback to override submit action */
  onSubmit?: (sourceData: any, activeData: any, autoSign: boolean, noClose: boolean, getSaveData: any) => void;
  /** Button text if form is already submitted */
  reviseText?: string;
  /** Button size (min, tiny, small, medium, large, max) */
  size?: ButtonSize;
  /** Button text */
  text?: string;
}

/**
 * SubmitButton - Submit form button utilizing Fluent's PrimaryButton
 */
export const SubmitButton: React.FC<SubmitButtonProps> = ({
  autoSign = false,
  disabled = false,
  getSaveData,
  noClose = false,
  onClick,
  onSubmit,
  reviseText = 'Revise',
  size = 'small',
  text = 'Submit',
}) => {
  // Get theme-based button styles (centralized)
  const buttonStyles = useButtonSize(size);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    } else if (onSubmit) {
      // In full implementation, this would call onSubmit with sourceData, activeData, etc.
      console.log('Submit clicked - autoSign:', autoSign, 'noClose:', noClose);
    }
  };

  return (
    <PrimaryButton
      data-automation-id="submit"
      text={text}
      disabled={disabled}
      onClick={handleClick}
      styles={buttonStyles}
    />
  );
};

export default SubmitButton;
