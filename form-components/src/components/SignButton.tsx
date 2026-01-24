/**
 * SignButton Component
 * Sign/Unsign button utilizing Fluent's DefaultButton
 */

import React, { useState } from 'react';
import {
  DefaultButton,
  PrimaryButton,
  Stack,
  Dialog,
  DialogType,
  DialogFooter,
  TextField,
  Text,
  MessageBar,
  MessageBarType,
} from '@fluentui/react';
import { useButtonSize, ButtonSize } from '../context/MoisContext';

export interface SignButtonProps {
  /** Ask for signing reason. Default is false */
  askSignReason?: boolean;
  /** Ask for Unsigning reason. Default is true */
  askUnsignReason?: boolean;
  /** Indicate whether the button is disabled or not */
  disabled?: boolean;
  /** A callback to override click action. Default is to take the onSign action */
  onClick?: () => void;
  /** Callback to override sign action. Default is the sign or unsign action */
  onSign?: (reason?: string) => void;
  /** Button size (min, tiny, small, medium, large, max) */
  size?: ButtonSize;
}

const toastContainerStyle: React.CSSProperties = {
  position: 'fixed',
  top: '120px',
  right: '50px',
  zIndex: 1950,
  width: '400px',
};

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
  const [isSigned, setIsSigned] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [reason, setReason] = useState('');

  const currentDate = new Date();
  const formattedDate = `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${String(currentDate.getDate()).padStart(2, '0')}`;
  const formattedTime = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`;

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (onSign) {
      // Check if we need to show the reason dialog
      if ((!isSigned && askSignReason) || (isSigned && askUnsignReason)) {
        setShowDialog(true);
      } else {
        onSign();
        setIsSigned(!isSigned);
      }
    } else {
      // Demo behavior - show dialog if askSignReason is true, otherwise toast
      if (askSignReason) {
        setShowDialog(true);
      } else {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    }
  };

  const handleSign = () => {
    if (onSign) {
      onSign(reason);
    }
    setIsSigned(!isSigned);
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
        disabled={disabled}
        onClick={handleClick}
        styles={buttonStyles}
      />

      {/* Toast notification */}
      {showToast && (
        <div style={toastContainerStyle}>
          <MessageBar
            messageBarType={MessageBarType.info}
            isMultiline={false}
            onDismiss={() => setShowToast(false)}
            dismissButtonAriaLabel="Close"
          >
            Signature not possible here
          </MessageBar>
        </div>
      )}

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
              <Text>ADMINISTRATOR</Text>
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
