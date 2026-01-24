/**
 * SubForm Component
 * Sub-form with optional focus trap. If a default action is given then the
 * subform is inline and that action is taken when focus leaves the subform. If
 * there is no default action, then the subform will be a modal dialog.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogType,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  IconButton,
  TextField,
  Dropdown,
  Label,
  IDialogContentProps,
  FocusTrapZone,
  IDropdownOption,
  Stack,
} from '@fluentui/react';
import { useActiveData, produce, useTheme } from '../context/MoisContext';
import { Column } from './Column';
import { SimpleCodeSelect } from './SimpleCodeSelect';
import { TextArea } from './TextArea';
import { ButtonBar } from './ButtonBar';
import { SaveButton } from '../components/SaveButton';
import { Action } from './Action';

export interface SubFormProps {
  /** Child controls to render in the subform */
  children: React.ReactNode;
  /** Minimum width for the subform container */
  minWidth?: string | number;
  /** Props for the dialog content when in modal mode */
  dialogContentProps?: IDialogContentProps;
  /** Hidden fields are not shown at all */
  hidden?: boolean;
  /** Initial value for tempArea storage */
  initialTempArea?: any;
  /** If true, renders inline instead of as a modal dialog */
  inline?: boolean;
  /** Label for this subform */
  label?: string;
  /** Lock policy for the subform */
  lockPolicy?: string;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Default action when focus leaves (makes subform inline) */
  onDefaultAction?: () => void;
  /** Advanced: Override section settings */
  section?: any;
  /** Custom styles for the container */
  style?: React.CSSProperties;
  /** Temporary storage area for subform data */
  tempArea?: any;
}

/**
 * SubForm - Sub-form with optional focus trap and modal/inline modes
 */
export const SubForm: React.FC<SubFormProps> = ({
  children,
  minWidth,
  dialogContentProps,
  hidden = false,
  inline = false,
  label,
  moisModule,
  onCancel,
  onDefaultAction,
  style,
}) => {
  const theme = useTheme();

  // When hidden=true, don't render anything
  if (hidden) return null;

  // For inline mode WITHOUT onDefaultAction, apply the theme's inlineSubformStyle (papayawhip border)
  // When onDefaultAction is provided, it's an "immediate update" style without the border
  const inlineStyle = (inline && !onDefaultAction) ? { ...theme.mois.inlineSubformStyle, ...style } : style;

  const containerStyle: React.CSSProperties = {
    ...(minWidth ? { minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth } : {}),
    ...inlineStyle,
  };

  if (inline) {
    // Inline mode with focus trap and papayawhip border
    return (
      <FocusTrapZone
        isClickableOutsideFocusTrap
        forceFocusInsideTrap={false}
      >
        <div style={containerStyle} data-component="SubForm">
          {label && (
            <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}>
              {label}
            </div>
          )}
          {children}
        </div>
      </FocusTrapZone>
    );
  }

  // Modal mode - render as Dialog when not inline and not hidden
  const defaultDialogContentProps: IDialogContentProps = {
    type: DialogType.normal,
    title: label ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {label}
        {moisModule && (
          <button style={{ backgroundColor: 'transparent', border: 0, cursor: 'pointer' }}>
            <div style={{ marginTop: '4px' }}>
              <img src="./img/GotoRecord.png" alt="Link to Mois" style={{ width: '16px' }} />
            </div>
          </button>
        )}
      </div>
    ) as any : undefined,
    ...dialogContentProps,
  };

  return (
    <Dialog
      hidden={false}
      onDismiss={onCancel}
      dialogContentProps={defaultDialogContentProps}
      minWidth={typeof minWidth === 'number' ? minWidth : parseInt(String(minWidth)) || 480}
    >
      <div style={containerStyle} data-component="SubForm">
        {children}
      </div>
    </Dialog>
  );
};

// Shared dropdown options
const yesNoOptions: IDropdownOption[] = [
  { key: '', text: 'Please select' },
  { key: 'Y', text: 'Yes' },
  { key: 'N', text: 'No' },
  { key: 'U', text: 'Unknown' },
];

const genderOptions: IDropdownOption[] = [
  { key: '', text: 'Please select' },
  { key: 'M', text: 'Male' },
  { key: 'F', text: 'Female' },
  { key: 'NB', text: 'Non-binary' },
  { key: 'O', text: 'Other' },
];

/**
 * SubFormDemo1 - Modal pop-up dialog example
 */
export const SubFormDemo1: React.FC = () => {
  const [fd] = useActiveData();
  const [showDialog, setShowDialog] = useState(false);
  const [comment, setComment] = useState('');

  return (
    <>
      <SaveButton
        text="Show Dialog"
        onClick={() => setShowDialog(true)}
      />

      <SubForm
        label="Enter new contents"
        moisModule="demographics"
        hidden={!showDialog}
        minWidth={480}
        onCancel={() => setShowDialog(false)}
      >
        <Column>
          <SimpleCodeSelect
            size="small"
            label="Ready to chose?"
            fieldId="input2choice"
            codeSystem="MOIS-YESNOUNKNOWN"
          />
          <TextArea
            size="medium"
            label="Comments"
            multiline
            fieldId="input2comments"
          />
        </Column>
        <ButtonBar horizontalAlign="end">
          <PrimaryButton
            text="Save"
            onClick={() => {
              setComment(fd?.field?.data?.input2comments || '');
              setShowDialog(false);
            }}
          />
          <DefaultButton text="Cancel" onClick={() => setShowDialog(false)} />
        </ButtonBar>
      </SubForm>

      <TextArea
        size="large"
        multiline
        label="Last comment"
        readOnly
        value={comment}
      />
    </>
  );
};

/**
 * SubFormDemo2 - Inline with focus trap (dropdown + textarea example)
 */
export const SubFormDemo2: React.FC = () => {
  const [fd] = useActiveData();
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState('');

  if (!editing) {
    return (
      <TextArea
        label="Last comment"
        size="large"
        multiline
        readOnly
        value={comment}
        actions={{ onEdit: () => setEditing(true) }}
      />
    );
  }

  return (
    <SubForm label="Inline example" inline hidden={!editing} minWidth={300} onCancel={() => setEditing(false)}>
      <Column>
        <SimpleCodeSelect
          size="small"
          label="Ready to chose?"
          fieldId="input1choice"
          codeSystem="MOIS-YESNOUNKNOWN"
        />
        <TextArea
          size="medium"
          label="Comments"
          multiline
          fieldId="input1comments"
        />
        <Action.Bar
          onAccept={() => {
            setComment(fd?.field?.data?.input1comments || '');
            setEditing(false);
          }}
          onCancel={() => {
            setEditing(false);
          }}
        />
      </Column>
    </SubForm>
  );
};

/**
 * SubFormDemo3 - Inline with immediate update (dropdown example)
 */
export const SubFormDemo3: React.FC = () => {
  const fieldName = 'inlineImmediateUpdate';
  const label = 'Prefered gender';
  const codeSystem = 'MOIS-PREFERREDGENDER';

  const [fd, setFd] = useActiveData();
  const [editing, setEditing] = useState<{ code: string; display: string; system: string } | null>(null);
  const [gender, setGender] = useState({
    code: '',
    display: '',
    system: codeSystem,
  });

  const handleSelection = (id: string) => {
    setGender(fd?.field?.data?.[id]);
    setEditing(null);
  };

  const handleCancelSelection = (id: string) => {
    setGender(editing!);
    setFd(
      produce((draft: any) => {
        draft.field.data[id] = editing;
      })
    );
    setEditing(null);
  };

  return (
    <>
      {!editing ? (
        <>
          <SimpleCodeSelect
            id={fieldName}
            label={label}
            placeholder="Gender not recorded"
            actions={{ onEdit: () => setEditing(gender) }}
            readOnly
          />
        </>
      ) : (
        <SubForm inline hidden={!editing} onDefaultAction={() => {}}>
          <SimpleCodeSelect
            id={fieldName}
            label={label}
            codeSystem={codeSystem}
            actions={{
              onCancel: () => handleCancelSelection(fieldName),
              onAccept: () => handleSelection(fieldName),
            }}
          />
        </SubForm>
      )}
    </>
  );
};

export default SubForm;
