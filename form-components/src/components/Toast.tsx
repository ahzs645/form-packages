/**
 * Toast Component
 * A reusable toast/notification component using Fluent UI MessageBar.
 * Can be used throughout the application for temporary messages.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MessageBar, MessageBarType, IconButton } from '@fluentui/react';

export interface ToastProps {
  /** The message to display */
  message: string;
  /** The type of message bar (info, success, warning, error, etc) */
  type?: MessageBarType;
  /** Whether the toast is visible */
  visible?: boolean;
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss after this many milliseconds (0 = no auto-dismiss) */
  autoDismiss?: number;
  /** Position from top */
  top?: number;
  /** Position from right */
  right?: number;
  /** Width of the toast */
  width?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = MessageBarType.info,
  visible = true,
  onDismiss,
  autoDismiss = 3000,
  top = 120,
  right = 50,
  width = 400,
}) => {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  useEffect(() => {
    if (isVisible && autoDismiss > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoDismiss, onDismiss]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!isVisible) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top,
    right,
    zIndex: 1950,
    width,
  };

  return (
    <div style={containerStyle}>
      <MessageBar
        messageBarType={type}
        isMultiline={false}
        onDismiss={handleDismiss}
        dismissButtonAriaLabel="Close"
      >
        {message}
      </MessageBar>
    </div>
  );
};

// Hook to easily manage toast state
export interface ToastState {
  message: string;
  type: MessageBarType;
  visible: boolean;
}

export const useToast = (autoDismiss = 3000) => {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: MessageBarType.info,
    visible: false,
  });

  const showToast = useCallback((message: string, type: MessageBarType = MessageBarType.info) => {
    setToast({ message, type, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const showInfo = useCallback((message: string) => showToast(message, MessageBarType.info), [showToast]);
  const showSuccess = useCallback((message: string) => showToast(message, MessageBarType.success), [showToast]);
  const showWarning = useCallback((message: string) => showToast(message, MessageBarType.warning), [showToast]);
  const showError = useCallback((message: string) => showToast(message, MessageBarType.error), [showToast]);

  return {
    toast,
    showToast,
    hideToast,
    showInfo,
    showSuccess,
    showWarning,
    showError,
    autoDismiss,
  };
};

export default Toast;
