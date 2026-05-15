/**
 * SaveButton Component
 * Save draft button utilizing Fluent's DefaultButton
 */

import React, { useState } from 'react';
import { DefaultButton, MessageBar, MessageBarType } from '@fluentui/react';
import { useActiveData, useButtonSize, ButtonSize, useSourceData } from '../context/MoisContext';
import {
  applyShimmedMoisLifecyclePreviewState,
  recordMoisRuntimeAction,
} from '../runtime/mois-contract';

export interface SaveButtonProps {
  /** Indicate whether the button is disabled or not */
  disabled?: boolean;
  /** Legacy NHForms label prop alias for text */
  label?: string;
  /** Legacy NHForms save type hint */
  saveType?: string;
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
  label,
  onClick,
  onSave,
  size = 'small',
  saveType,
  text = 'Save draft',
}) => {
  const [showToast, setShowToast] = useState(false);
  const sourceData = useSourceData();
  const [activeData, setActiveData] = useActiveData();

  // Get theme-based button styles (centralized)
  const buttonStyles = useButtonSize(size);

  const applyDefaultSave = () => {
    const payload = getSaveData?.() ?? { formData: activeData?.field?.data ?? {} };
    const buttonText = (label ?? text).toLowerCase();
    const action = saveType === 'draft'
      ? 'saveDraft'
      : saveType || buttonText.includes('submit')
        ? 'signSubmit'
        : 'saveDraft';
    applyShimmedMoisLifecyclePreviewState(sourceData, action, payload);
    setActiveData((draft: any) => {
      draft.field = draft.field || { data: {}, status: {}, history: [] };
      if (payload?.formData) {
        draft.field.data = { ...(draft.field?.data || {}), ...payload.formData };
      }
      recordMoisRuntimeAction(draft, action, payload);
    });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onSave) {
      onSave();
    } else {
      applyDefaultSave();
    }
  };

  return (
    <>
      <DefaultButton
        data-automation-id="save"
        text={label ?? text}
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
