/**
 * SignButton Component
 * Sign/Unsign button utilizing Fluent's DefaultButton
 */

import React, { useEffect, useState } from 'react';
import {
  DefaultButton,
  PrimaryButton,
  Stack,
  Dialog,
  DialogType,
  DialogFooter,
  TextField,
  Text,
} from '@fluentui/react';
import { useActiveData, useButtonSize, ButtonSize, useSourceData } from '../context/MoisContext';
import {
  applyShimmedMoisLifecyclePreviewState,
  emitMoisPreviewDiagnosticEvent,
  recordMoisRuntimeAction,
} from '../runtime/mois-contract';

export interface SignButtonProps {
  /** Ask for signing reason. Default is false */
  askSignReason?: boolean;
  /** Ask for Unsigning reason. Default is true */
  askUnsignReason?: boolean;
  /** Indicate whether the button is disabled or not */
  disabled?: boolean;
  /** A callback to override click action. Default is to take the onSign action */
  onClick?: () => void;
  /** Callback to override sign action. Shimmed-style (sourceData, activeData) callbacks are also supported. */
  onSign?: (reason?: string, sourceData?: any, activeData?: any) => void;
  /** Button size (min, tiny, small, medium, large, max) */
  size?: ButtonSize;
}

const dialogContentProps = {
  type: DialogType.normal,
  title: 'Signature Record',
};

const modalProps = {
  isBlocking: true,
};

export const SignButton: React.FC<SignButtonProps> = ({
  askSignReason = false,
  askUnsignReason = true,
  disabled = false,
  onClick,
  onSign,
  size = 'small',
}) => {
  // Get theme-based button styles
  const buttonStyles = useButtonSize(size);
  const sourceData = useSourceData();
  const [activeData, setActiveData] = useActiveData();
  const sourceRecordState = sourceData?.webform?.recordState;
  const [optimisticRecordState, setOptimisticRecordState] = useState<string | null>(null);
  const isSigned = (optimisticRecordState ?? sourceRecordState) === 'SIGNED';
  const [showDialog, setShowDialog] = useState(false);
  const [reason, setReason] = useState('');
  const sectionComplete = activeData?.uiState?.sections?.[0]?.isComplete;
  const canUseShimmedSignatureFlow =
    sourceData?.webform?.isDraft === 'N'
    && sectionComplete !== false
    && Boolean(sourceData?.formParams?.webformId || sourceData?.formParams?.documentId);
  const buttonDisabled = disabled || !canUseShimmedSignatureFlow;
  const userName = sourceData?.userProfile?.identity?.fullName ?? 'Preview User';

  useEffect(() => {
    setOptimisticRecordState(null);
  }, [sourceRecordState, sourceData?.formParams?.webformId, sourceData?.formParams?.documentId]);

  const currentDate = new Date();
  const formattedDate = `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${String(currentDate.getDate()).padStart(2, '0')}`;
  const formattedTime = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`;

  const applyPreviewSignatureAction = (nextSigned: boolean, signatureReason?: string) => {
    const action = nextSigned ? 'sign' : 'unsign';
    const recordState = nextSigned ? 'SIGNED' : 'UNSIGNED';
    const signatureRecord = {
      documentId: sourceData?.formParams?.documentId ?? sourceData?.webform?.documentId ?? null,
      recordState,
      note: signatureReason ?? '',
    };

    applyShimmedMoisLifecyclePreviewState(sourceData, action, { signatureRecord });
    setActiveData((draft: any) => {
      draft.uiState = draft.uiState || { sections: {} };
      draft.uiState.sections = draft.uiState.sections || {};
      draft.uiState.sections[0] = {
        ...(draft.uiState.sections[0] || {}),
        isComplete: nextSigned,
      };
      recordMoisRuntimeAction(draft, action, { signatureRecord });
    });
    setOptimisticRecordState(recordState);
    emitMoisPreviewDiagnosticEvent({
      severity: 'info',
      source: 'sign-button-preview',
      message: `Preview ${nextSigned ? 'signed' : 'unsigned'} the form using Shimmed MOIS recordState semantics.`,
      path: 'SignButton',
      detail: { signatureRecord },
    });
  };

  const runSignAction = (signatureReason?: string) => {
    const nextSigned = !isSigned;
    if (onSign) {
      if (onSign.length >= 2) {
        (onSign as any)(sourceData, activeData);
      } else {
        onSign(signatureReason, sourceData, activeData);
      }
      setOptimisticRecordState(nextSigned ? 'SIGNED' : 'UNSIGNED');
      return;
    }

    applyPreviewSignatureAction(nextSigned, signatureReason);
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if ((!isSigned && askSignReason) || (isSigned && askUnsignReason)) {
      setShowDialog(true);
      return;
    }

    runSignAction();
  };

  const handleSign = () => {
    runSignAction(reason);
    setShowDialog(false);
    setReason('');
  };

  const handleCancel = () => {
    setShowDialog(false);
    setReason('');
  };

  return (
    <>
      <DefaultButton
        text={isSigned ? 'Unsign' : 'Sign'}
        disabled={buttonDisabled}
        onClick={handleClick}
        styles={buttonStyles}
      />

      {/* Signature Dialog */}
      <Dialog
        hidden={!showDialog}
        onDismiss={handleCancel}
        dialogContentProps={dialogContentProps}
        modalProps={modalProps}
      >
        <Stack tokens={{ childrenGap: 12 }}>
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <Stack.Item styles={{ root: { width: '120px' } }}>
              <Text>User Name:</Text>
            </Stack.Item>
            <Stack.Item>
              <Text>{userName}</Text>
            </Stack.Item>
          </Stack>
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <Stack.Item styles={{ root: { width: '120px' } }}>
              <Text>Date:</Text>
            </Stack.Item>
            <Stack.Item>
              <Text>{formattedDate}</Text>
            </Stack.Item>
          </Stack>
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <Stack.Item styles={{ root: { width: '120px' } }}>
              <Text>Time:</Text>
            </Stack.Item>
            <Stack.Item>
              <Text>{formattedTime}</Text>
            </Stack.Item>
          </Stack>
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <Stack.Item styles={{ root: { width: '120px' } }}>
              <Text>Reason: (Optional)</Text>
            </Stack.Item>
            <Stack.Item grow>
              <TextField
                multiline
                rows={3}
                value={reason}
                onChange={(_, newValue) => setReason(newValue || '')}
              />
            </Stack.Item>
          </Stack>
        </Stack>
        <DialogFooter>
          <PrimaryButton onClick={handleSign} text={isSigned ? 'Unsign' : 'Sign'} />
          <DefaultButton onClick={handleCancel} text="Cancel" />
        </DialogFooter>
      </Dialog>
    </>
  );
};

export default SignButton;
