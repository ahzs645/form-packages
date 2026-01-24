/**
 * MOIS Dialog Component
 * A styled modal dialog that follows the MOIS design patterns
 */

import React from 'react';
import {
  Dialog,
  DialogType,
  PrimaryButton,
  DefaultButton,
  Stack,
  IDialogContentProps,
  IModalProps,
} from '@fluentui/react';

export interface MoisDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  children: React.ReactNode;
  maxWidth?: number | string;
  minWidth?: number | string;
}

export const MoisDialog: React.FC<MoisDialogProps> = ({
  isOpen,
  onDismiss,
  title = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  children,
  maxWidth,
  minWidth = '600px',
}) => {
  const dialogContentProps: IDialogContentProps = {
    type: DialogType.normal,
    title,
    closeButtonAriaLabel: 'Close',
  };

  const modalProps: IModalProps = {
    isBlocking: false,
    styles: maxWidth ? {
      main: {
        maxWidth,
      },
    } : undefined,
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onDismiss();
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onDismiss}
      dialogContentProps={dialogContentProps}
      modalProps={modalProps}
      minWidth={minWidth}
    >
      <div>
        {children}
      </div>
      <div style={{ height: '1em' }} />
      <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }} styles={{ root: { paddingBottom: 0, background: 'white' } }}>
        <PrimaryButton text={confirmText} onClick={handleConfirm} />
        <DefaultButton text={cancelText} onClick={onDismiss} />
      </Stack>
    </Dialog>
  );
};

export default MoisDialog;
