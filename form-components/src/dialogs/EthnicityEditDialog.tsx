/**
 * Ethnicity Edit Dialog
 * Dialog for editing patient ethnicity/race information
 *
 * Uses reusable controls: MoisDialog, LayoutItem
 */

import React, { useState, useEffect } from 'react';
import { IDropdownOption, Checkbox } from '@fluentui/react';
import { MoisDialog } from '../components/MoisDialog';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';
import { LayoutItem } from '../controls/LayoutItem';

export interface EthnicityData {
  relation?: string;
  race?: string;
  selfIdentified?: boolean;
}

export interface EthnicityEditDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  data: EthnicityData;
  onSave: (updates: EthnicityData) => void;
  fieldLabel?: string; // e.g., "Ethnicity 1", "Ethnicity 2"
}

// Relation options for ethnicity
const relationOptions: IDropdownOption[] = [
  { key: 'SELF', text: 'SELF' },
  { key: 'MOTHER', text: 'MOTHER' },
  { key: 'FATHER', text: 'FATHER' },
  { key: 'GRANDPARENT', text: 'GRANDPARENT' },
];

export const EthnicityEditDialog: React.FC<EthnicityEditDialogProps> = ({
  isOpen,
  onDismiss,
  data,
  onSave,
  fieldLabel = 'Ethnicity',
}) => {
  const [relation, setRelation] = useState(data?.relation || 'SELF');
  const [race, setRace] = useState(data?.race || '');
  const [selfIdentified, setSelfIdentified] = useState(data?.selfIdentified || false);

  // Reset state when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      setRelation(data?.relation || 'SELF');
      setRace(data?.race || '');
      setSelfIdentified(data?.selfIdentified || false);
    }
  }, [isOpen, data]);

  const handleConfirm = () => {
    onSave({
      relation,
      race,
      selfIdentified,
    });
  };

  return (
    <MoisDialog
      isOpen={isOpen}
      onDismiss={onDismiss}
      confirmText="Confirm ethnicity"
      onConfirm={handleConfirm}
      minWidth="700px"
    >
      <div style={{ display: 'flex', flexFlow: 'row', justifyContent: 'flex-start', alignItems: 'flex-end' }}>
        <LayoutItem noTopLabel size="small">
          <MoisDropdown
            label="Relation"
            selectedKey={relation}
            options={relationOptions}
            size="small"
            onChange={(_, option) => option && setRelation(option.key as string)}
          />
        </LayoutItem>
        <LayoutItem noTopLabel size="medium">
          <MoisTextField
            label="Race"
            value={race}
            placeholder="Please search"
            size="medium"
            onChange={(_, val) => setRace(val || '')}
          />
        </LayoutItem>
        <LayoutItem noTopLabel size="small" labelPosition="none">
          <Checkbox
            label="Self identified"
            checked={selfIdentified}
            onChange={(_, checked) => setSelfIdentified(!!checked)}
            styles={{ root: { marginBottom: '5px' } }}
          />
        </LayoutItem>
      </div>
    </MoisDialog>
  );
};

export default EthnicityEditDialog;
