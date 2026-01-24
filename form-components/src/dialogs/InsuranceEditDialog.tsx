/**
 * Insurance Edit Dialog
 * Dialog for editing patient insurance information
 *
 * Uses reusable controls: MoisDialog, LayoutItem
 */

import React, { useState, useEffect } from 'react';
import { IDropdownOption } from '@fluentui/react';
import { MoisDialog } from '../components/MoisDialog';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';
import { LayoutItem } from '../controls/LayoutItem';
import { useCodeList } from '../context/MoisContext';

export interface InsuranceData {
  insuranceBy?: { code: string; display: string; system: string } | null;
  insuranceNumber?: string;
  insuranceDependent?: string;
}

export interface InsuranceEditDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  data: InsuranceData;
  onSave: (updates: InsuranceData) => void;
}

export const InsuranceEditDialog: React.FC<InsuranceEditDialogProps> = ({
  isOpen,
  onDismiss,
  data,
  onSave,
}) => {
  const [insurerCode, setInsurerCode] = useState(data?.insuranceBy?.code || 'BC');
  const [insuranceNumber, setInsuranceNumber] = useState(data?.insuranceNumber || '');
  const [depNo, setDepNo] = useState(data?.insuranceDependent || '');
  const insurerOptions = useCodeList('MOIS-INSURANCEBY');

  // Reset state when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      setInsurerCode(data?.insuranceBy?.code || 'BC');
      setInsuranceNumber(data?.insuranceNumber || '');
      setDepNo(data?.insuranceDependent || '');
    }
  }, [isOpen, data]);

  const handleConfirm = () => {
    const selectedInsurer = insurerOptions.find(opt => opt.code === insurerCode);
    onSave({
      insuranceBy: selectedInsurer
        ? { code: selectedInsurer.code, display: selectedInsurer.display, system: 'MOIS-INSURANCEBY' }
        : data?.insuranceBy,
      insuranceNumber,
      insuranceDependent: depNo,
    });
  };

  const dropdownOptions: IDropdownOption[] = insurerOptions.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  return (
    <MoisDialog
      isOpen={isOpen}
      onDismiss={onDismiss}
      confirmText="Confirm insurance"
      onConfirm={handleConfirm}
    >
      <div style={{ display: 'flex', flexFlow: 'row', justifyContent: 'flex-start' }}>
        <LayoutItem noTopLabel size="small">
          <MoisDropdown
            label="Insurer"
            selectedKey={insurerCode}
            options={dropdownOptions}
            size="small"
            onChange={(_, option) => option && setInsurerCode(option.key as string)}
          />
        </LayoutItem>
        <LayoutItem noTopLabel size="small">
          <MoisTextField
            label="Insurance number"
            value={insuranceNumber}
            size="small"
            onChange={(_, val) => setInsuranceNumber(val || '')}
          />
        </LayoutItem>
        <LayoutItem noTopLabel size="tiny">
          <MoisTextField
            label="Dep. no."
            value={depNo}
            size="tiny"
            onChange={(_, val) => setDepNo(val || '')}
          />
        </LayoutItem>
      </div>
    </MoisDialog>
  );
};

export default InsuranceEditDialog;
