/**
 * ButtonBar Component
 * Horizontal button bar.
 *
 * SMOIS parity evidence: ButtonBar `q` in
 * ~/github/smois/build/static/js/main.a75cc6b1.chunk.js uses 10px Stack
 * padding, the `m` child gap, wrapping, and does not render while printing.
 */

import React, { useState } from 'react';
import { Stack, PrimaryButton, DefaultButton, MessageBar, MessageBarType } from '@fluentui/react';
import { useSourceData } from '../context/MoisContext';

export interface ButtonBarProps {
  /** Background color of the button bar */
  background?: string;
  /** Contained Buttons and other controls */
  children?: React.ReactNode;
  /** Horizontal alignment of contained buttons (eg: "start" or "end") */
  horizontalAlign?: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  /** Number of pixels to pad the bottom of the ButtonBar (default = 10px) */
  paddingBottom?: number;
  /** Gap between children */
  gap?: number;
  /** Padding around the button bar */
  padding?: string | number;
}

export const ButtonBar: React.FC<ButtonBarProps> = ({
  background,
  children,
  horizontalAlign = 'start',
  paddingBottom,
  gap,
  padding,
}) => {
  const sourceData = useSourceData();

  if (sourceData.lifecycleState.isPrinting) {
    return null;
  }

  return (
    <Stack
      horizontal
      horizontalAlign={horizontalAlign}
      verticalAlign="center"
      tokens={{
        padding: padding ?? '10px',
        childrenGap: gap ?? 'm',
      }}
      styles={{
        root: {
          background,
          paddingBottom,
        },
      }}
      wrap
    >
      {children}
    </Stack>
  );
};

// Toast item interface
interface ToastItem {
  id: number;
  message: string;
  type: MessageBarType;
}

// Demo component for the example
export const ButtonBarDemo: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [nextId, setNextId] = useState(1);

  const showToast = (message: string, type: MessageBarType = MessageBarType.info) => {
    const id = nextId;
    setNextId(prev => prev + 1);
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleSubmit = () => {
    showToast('Submitted', MessageBarType.info);
  };

  return (
    <>
      {/* Render stacked toasts */}
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            position: 'fixed',
            top: 120 + index * 50,
            right: 50,
            zIndex: 1950 - index,
            width: 400,
          }}
        >
          <MessageBar
            messageBarType={toast.type}
            isMultiline={false}
            onDismiss={() => dismissToast(toast.id)}
            dismissButtonAriaLabel="Close"
          >
            {toast.message}
          </MessageBar>
        </div>
      ))}

      <ButtonBar>
        <PrimaryButton text="Submit" onClick={handleSubmit} />
        <DefaultButton text="Sign" disabled />
        <DefaultButton text="Refresh" />
        <DefaultButton text="Close" />
      </ButtonBar>
    </>
  );
};

export default ButtonBar;
