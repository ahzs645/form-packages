/**
 * Telecom Edit Dialog
 * Dialog for editing patient contact information (phones, emails)
 *
 * Uses reusable controls: MoisDialog, LayoutItem, Linear
 */

import React, { useState, useEffect } from 'react';
import { Checkbox } from '@fluentui/react';
import { MoisDialog } from '../components/MoisDialog';
import { MoisTextField } from '../components/MoisTextField';
import { LayoutItem } from '../controls/LayoutItem';
import { Linear } from '../controls/Linear';

export interface TelecomData {
  homePhone?: string;
  homeMessage?: string;
  workPhone?: string;
  workExt?: string;
  workMessage?: string;
  cellPhone?: string;
  pagerNumber?: string;
  faxNumber?: string;
  homeEmail?: string;
  workEmail?: string;
}

export interface TelecomEditDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  data: TelecomData;
  onSave: (updates: TelecomData) => void;
}

export const TelecomEditDialog: React.FC<TelecomEditDialogProps> = ({
  isOpen,
  onDismiss,
  data,
  onSave,
}) => {
  const [homePhone, setHomePhone] = useState(data?.homePhone || '');
  const [homeMessage, setHomeMessage] = useState(data?.homeMessage === 'Y');
  const [workPhone, setWorkPhone] = useState(data?.workPhone || '');
  const [workExt, setWorkExt] = useState(data?.workExt || '');
  const [workMessage, setWorkMessage] = useState(data?.workMessage === 'Y');
  const [cellPhone, setCellPhone] = useState(data?.cellPhone || '');
  const [pagerNumber, setPagerNumber] = useState(data?.pagerNumber || '');
  const [faxNumber, setFaxNumber] = useState(data?.faxNumber || '');
  const [homeEmail, setHomeEmail] = useState(data?.homeEmail || '');
  const [workEmail, setWorkEmail] = useState(data?.workEmail || '');

  // Reset state when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      setHomePhone(data?.homePhone || '');
      setHomeMessage(data?.homeMessage === 'Y');
      setWorkPhone(data?.workPhone || '');
      setWorkExt(data?.workExt || '');
      setWorkMessage(data?.workMessage === 'Y');
      setCellPhone(data?.cellPhone || '');
      setPagerNumber(data?.pagerNumber || '');
      setFaxNumber(data?.faxNumber || '');
      setHomeEmail(data?.homeEmail || '');
      setWorkEmail(data?.workEmail || '');
    }
  }, [isOpen, data]);

  const handleConfirm = () => {
    onSave({
      homePhone,
      homeMessage: homeMessage ? 'Y' : 'N',
      workPhone,
      workExt,
      workMessage: workMessage ? 'Y' : 'N',
      cellPhone,
      pagerNumber,
      faxNumber,
      homeEmail,
      workEmail,
    });
  };

  return (
    <MoisDialog
      isOpen={isOpen}
      onDismiss={onDismiss}
      confirmText="Confirm"
      onConfirm={handleConfirm}
      minWidth="500px"
    >
      <Linear>
        {/* Home phone row */}
        <div style={{ display: 'flex', flexFlow: 'row', justifyContent: 'flex-start', alignItems: 'flex-end' }}>
          <LayoutItem noTopLabel size="small">
            <MoisTextField
              label="Home phone"
              value={homePhone}
              size="small"
              onChange={(_, val) => setHomePhone(val || '')}
            />
          </LayoutItem>
          <LayoutItem noTopLabel size="small" labelPosition="none">
            <Checkbox
              label="Leave message"
              checked={homeMessage}
              onChange={(_, checked) => setHomeMessage(!!checked)}
              styles={{ root: { marginBottom: '5px' } }}
            />
          </LayoutItem>
        </div>

        {/* Work phone row */}
        <div style={{ display: 'flex', flexFlow: 'row', justifyContent: 'flex-start', alignItems: 'flex-end' }}>
          <LayoutItem noTopLabel size="small">
            <MoisTextField
              label="Work phone"
              value={workPhone}
              size="small"
              onChange={(_, val) => setWorkPhone(val || '')}
            />
          </LayoutItem>
          <LayoutItem noTopLabel size="tiny">
            <MoisTextField
              label="Ext."
              value={workExt}
              size="tiny"
              onChange={(_, val) => setWorkExt(val || '')}
            />
          </LayoutItem>
          <LayoutItem noTopLabel size="small" labelPosition="none">
            <Checkbox
              label="Leave message"
              checked={workMessage}
              onChange={(_, checked) => setWorkMessage(!!checked)}
              styles={{ root: { marginBottom: '5px' } }}
            />
          </LayoutItem>
        </div>

        {/* Cell phone */}
        <LayoutItem noTopLabel size="small">
          <MoisTextField
            label="Cell phone"
            value={cellPhone}
            size="small"
            onChange={(_, val) => setCellPhone(val || '')}
          />
        </LayoutItem>

        {/* Pager number */}
        <LayoutItem noTopLabel size="small">
          <MoisTextField
            label="Pager number"
            value={pagerNumber}
            size="small"
            onChange={(_, val) => setPagerNumber(val || '')}
          />
        </LayoutItem>

        {/* Fax number */}
        <LayoutItem noTopLabel size="small">
          <MoisTextField
            label="Fax number"
            value={faxNumber}
            size="small"
            onChange={(_, val) => setFaxNumber(val || '')}
          />
        </LayoutItem>

        {/* Home email */}
        <LayoutItem noTopLabel size="medium">
          <MoisTextField
            label="Home email"
            value={homeEmail}
            size="medium"
            onChange={(_, val) => setHomeEmail(val || '')}
          />
        </LayoutItem>

        {/* Work email */}
        <LayoutItem noTopLabel size="medium">
          <MoisTextField
            label="Work email"
            value={workEmail}
            size="medium"
            onChange={(_, val) => setWorkEmail(val || '')}
          />
        </LayoutItem>
      </Linear>
    </MoisDialog>
  );
};

export default TelecomEditDialog;
