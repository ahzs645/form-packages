import React from 'react';
import { PrimaryButton } from '@fluentui/react';
import { useActiveData, useButtonSize, ButtonSize, useSourceData } from '../context/MoisContext';

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
  const sourceData = useSourceData();
  const [activeData, setActiveData] = useActiveData();
  // Get theme-based button styles (centralized)
  const buttonStyles = useButtonSize(size);
  const isSubmitted = sourceData?.webform?.isDraft === 'N';
  const isSectionComplete = activeData?.uiState?.sections?.[0]?.isComplete !== false;
  const showRevise = isSubmitted && isSectionComplete;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    } else if (onSubmit) {
      onSubmit(sourceData, activeData, autoSign, noClose, getSaveData);
    }
  };

  const handleRevise = () => {
    setActiveData((draft: any) => {
      draft.uiState = draft.uiState || { sections: {} };
      draft.uiState.sections = draft.uiState.sections || {};
      draft.uiState.sections[0] = {
        ...(draft.uiState.sections[0] || {}),
        isComplete: false,
      };
    });
  };

  if (showRevise) {
    return (
      <PrimaryButton
        data-automation-id="revise"
        text={reviseText}
        disabled={disabled || Boolean(sourceData?.lifecycleState?.isLockedForUpdate)}
        onClick={handleRevise}
        styles={buttonStyles}
      />
    );
  }

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
