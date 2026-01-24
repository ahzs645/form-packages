/**
 * DeterminantsOfHealth Edit Dialog
 * Dialog for editing Determinants of Health observations
 *
 * Uses reusable controls: MoisDialog, LayoutItem, Linear
 */

import React, { useState, useEffect } from 'react';
import { MoisDialog } from '../components/MoisDialog';
import { MoisDropdown } from '../components/MoisDropdown';
import { LayoutItem } from '../controls/LayoutItem';
import { Linear } from '../controls/Linear';

export interface DohObservation {
  observationId?: number;
  observationCode?: string;
  description?: string;
  value?: string;
  collectedDateTime?: string;
}

export interface DeterminantsOfHealthEditDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  title: string;
  observations: DohObservation[];
  onSave: (updates: DohObservation[]) => void;
}

// Convert description to a friendly label (title case)
const toFriendlyLabel = (description: string): string => {
  return description
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const DeterminantsOfHealthEditDialog: React.FC<DeterminantsOfHealthEditDialogProps> = ({
  isOpen,
  onDismiss,
  title,
  observations,
  onSave,
}) => {
  const [editedObservations, setEditedObservations] = useState<DohObservation[]>(observations);

  // Reset state when dialog opens with new data
  useEffect(() => {
    if (isOpen) {
      setEditedObservations(observations);
    }
  }, [isOpen, observations]);

  const handleValueChange = (index: number, newValue: string) => {
    setEditedObservations(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: newValue };
      return updated;
    });
  };

  const handleConfirm = () => {
    onSave(editedObservations);
  };

  return (
    <MoisDialog
      isOpen={isOpen}
      onDismiss={onDismiss}
      title={title}
      confirmText="Ok"
      onConfirm={handleConfirm}
      minWidth="600px"
    >
      <Linear>
        {editedObservations.map((obs, index) => (
          <LayoutItem
            key={obs.observationCode || index}
            label={toFriendlyLabel(obs.description || '')}
            labelPosition="left"
            size="medium"
          >
            <MoisDropdown
              selectedKey={obs.value}
              options={[
                { key: obs.value || '', text: obs.value || '' },
              ]}
              size="medium"
              onChange={(_, option) => option && handleValueChange(index, option.key as string)}
            />
          </LayoutItem>
        ))}
      </Linear>
    </MoisDialog>
  );
};

export default DeterminantsOfHealthEditDialog;
