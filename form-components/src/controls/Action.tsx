/**
 * Action Component
 * Action.Bar, Action.Button and specific action buttons like Action.Refresh
 */

import React, { useState } from 'react';
import { IconButton, IIconProps, Stack, Toggle, MessageBar, MessageBarType } from '@fluentui/react';

export interface ActionButtonProps {
  /** Icon name from Fluent UI icons */
  iconName?: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Title/tooltip text */
  title?: string;
  /** Handler for edit action (alternative to onClick) */
  onEdit?: () => void;
}

export interface ActionBarProps {
  /** Child elements (typically Action buttons) */
  children?: React.ReactNode;
  /** Whether the bar is hidden */
  hidden?: boolean;
  /** Direct handler for Refresh button */
  onRefresh?: () => void;
  /** Direct handler for Edit button */
  onEdit?: () => void;
  /** Direct handler for Accept button */
  onAccept?: () => void;
  /** Direct handler for Add button */
  onAdd?: () => void;
  /** Direct handler for Cancel button */
  onCancel?: () => void;
  /** Direct handler for Delete button */
  onDelete?: () => void;
  /** Direct handler for Info button */
  onInfo?: () => void;
  /** Style override */
  style?: React.CSSProperties;
  /** MOIS module identifier */
  moisModule?: string;
}

// Action.Bar - Container for action buttons
const Bar: React.FC<ActionBarProps> = ({
  children,
  hidden,
  onRefresh,
  onEdit,
  onAccept,
  onAdd,
  onCancel,
  onDelete,
  onInfo,
  style,
}) => {
  // If hidden, don't render anything
  if (hidden) {
    return null;
  }

  // If handlers are passed directly, render the corresponding buttons
  const hasDirectHandlers = onRefresh || onEdit || onAccept || onAdd || onCancel || onDelete || onInfo;

  return (
    <div style={{ display: 'flex', flexFlow: 'row', ...style }}>
      {hasDirectHandlers ? (
        <>
          {onRefresh && <Refresh onClick={onRefresh} />}
          {onEdit && <Edit onClick={onEdit} />}
          {onAccept && <CheckMark onClick={onAccept} />}
          {onAdd && <Add onClick={onAdd} />}
          {onCancel && <Cancel onClick={onCancel} />}
          {onDelete && <Delete onClick={onDelete} />}
          {onInfo && <Info onClick={onInfo} />}
        </>
      ) : (
        children
      )}
    </div>
  );
};

// Action.Button - Generic icon button
const Button: React.FC<ActionButtonProps> = ({
  iconName = 'Add',
  onClick,
  disabled,
  ariaLabel,
  title,
}) => {
  const iconProps: IIconProps = { iconName };

  return (
    <IconButton
      iconProps={iconProps}
      onClick={onClick}
      disabled={disabled}
      ariaLabel={ariaLabel || iconName}
      title={title}
    />
  );
};

// Specific action buttons
const Refresh: React.FC<Omit<ActionButtonProps, 'iconName'>> = (props) => (
  <Button iconName="Refresh" ariaLabel="Refresh" {...props} />
);

const Edit: React.FC<Omit<ActionButtonProps, 'iconName'>> = (props) => (
  <Button iconName="Edit" ariaLabel="Edit" {...props} />
);

const CheckMark: React.FC<Omit<ActionButtonProps, 'iconName'>> = (props) => (
  <Button iconName="CheckMark" ariaLabel="Check" {...props} />
);

const Add: React.FC<Omit<ActionButtonProps, 'iconName'>> = (props) => (
  <Button iconName="Add" ariaLabel="Add" {...props} />
);

const Cancel: React.FC<Omit<ActionButtonProps, 'iconName'>> = (props) => (
  <Button iconName="Cancel" ariaLabel="Cancel" {...props} />
);

const Delete: React.FC<Omit<ActionButtonProps, 'iconName'>> = (props) => (
  <Button iconName="Delete" ariaLabel="Delete" {...props} />
);

const Info: React.FC<Omit<ActionButtonProps, 'iconName'>> = (props) => (
  <Button iconName="Info" ariaLabel="Info" {...props} />
);

// Accept - alias for CheckMark (used in some examples)
const Accept: React.FC<Omit<ActionButtonProps, 'iconName'> & { onAccept?: () => void }> = ({ onAccept, onClick, ...props }) => (
  <Button iconName="Accept" ariaLabel="Accept" onClick={onAccept || onClick} {...props} />
);

// GotoRecord - Custom button with image
const GotoRecord: React.FC<Omit<ActionButtonProps, 'iconName'>> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: 'transparent',
        border: '0px',
        cursor: 'pointer',
      }}
    >
      <div style={{ marginTop: '4px' }}>
        <img
          src="./img/GotoRecord.png"
          alt="Link to Mois"
          style={{ width: '16px' }}
        />
      </div>
    </button>
  );
};

// LinkToMois - Link to MOIS module (uses same GotoRecord image as Heading)
const LinkToMois: React.FC<Omit<ActionButtonProps, 'iconName'> & { moisModule: string; objectId?: number }> = ({
  moisModule,
  objectId,
  onClick,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      console.log('Navigate to MOIS module:', moisModule, objectId);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Link to Mois`}
      aria-label={`Open ${moisModule} in MOIS`}
      style={{
        backgroundColor: 'transparent',
        border: '0px',
        cursor: 'pointer',
      }}
    >
      <div style={{ marginTop: '4px' }}>
        <img
          src="./img/GotoRecord.png"
          alt="Link to Mois"
          style={{ width: '16px' }}
        />
      </div>
    </button>
  );
};

// Toast item interface for stacking toasts
interface ToastItem {
  id: number;
  message: string;
  type: MessageBarType;
}

// Demo component for first example with Toggle to hide/show buttons and toast notifications
export const ActionDemo1: React.FC = () => {
  const [hidden, setHidden] = useState(false);
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

  const handleAccept = () => {
    showToast('accept', MessageBarType.info);
  };

  const handleCancel = () => {
    showToast('cancel', MessageBarType.info);
  };

  const handleInfo = () => {
    showToast('info', MessageBarType.info);
  };

  return (
    <Stack>
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

      <Toggle
        label="Hide me"
        offText="Visible"
        onText="Hidden"
        checked={hidden}
        onChange={(_, checked) => setHidden(checked || false)}
      />
      {!hidden && (
        <Bar>
          <CheckMark onClick={handleAccept} />
          <Cancel onClick={handleCancel} />
          <Info onClick={handleInfo} />
        </Bar>
      )}
    </Stack>
  );
};

// Demo component for second example with all action buttons
export const ActionDemo2: React.FC = () => {
  return (
    <Bar>
      <Refresh />
      <Edit />
      <CheckMark />
      <Add />
      <Cancel />
      <Delete />
      <GotoRecord />
      <Info />
    </Bar>
  );
};

// Demo component for third example with custom button and toast
export const ActionDemo3: React.FC = () => {
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

  const handleAirplane = () => {
    showToast('airplane', MessageBarType.info);
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

      <Bar>
        <Button iconName="Airplane" onClick={handleAirplane} />
        <GotoRecord />
      </Bar>
    </>
  );
};

// Export Action namespace with all sub-components
export const Action = {
  Bar,
  Button,
  Refresh,
  Edit,
  CheckMark,
  Accept,
  Add,
  Cancel,
  Delete,
  Info,
  GotoRecord,
  LinkToMois,
};

// Also export sub-components individually for direct use
export const ActionBar = Bar;
export const ActionButton = Button;
export const ActionRefresh = Refresh;
export const ActionEdit = Edit;
export const ActionCheckMark = CheckMark;
export const ActionAccept = Accept;
export const ActionAdd = Add;
export const ActionCancel = Cancel;
export const ActionDelete = Delete;
export const ActionInfo = Info;
export const ActionGotoRecord = GotoRecord;
export const ActionLinkToMois = LinkToMois;

export default Action;
