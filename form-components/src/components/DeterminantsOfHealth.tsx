/**
 * DeterminantsOfHealth Component
 * Display a list of Determinants of Health records.
 * By default, it will display all initial data from the patient object.
 *
 * Uses reusable controls: LayoutItem, Action.Bar
 */

import React, { useState } from 'react';
import { useActiveData } from '../context/MoisContext';
import { DeterminantsOfHealthEditDialog } from '../dialogs/DeterminantsOfHealthEditDialog';

// Import reusable controls
import { LayoutItem } from '../controls/LayoutItem';

// Observation data interface
export interface Observation {
  observationId?: number;
  observationCode?: string;
  description?: string;
  value?: string;
  collectedDate?: string;
  collectedDateTime?: string;
  codedValue?: {
    code: string;
    display: string;
    system: string;
  };
}

// Observation panel interface
export interface ObservationPanel {
  observationPanelId?: number;
  panelName?: {
    code: string;
    display: string;
    system: string;
  };
  observations?: Observation[];
  collectedDate?: string;
}

export interface DeterminantsOfHealthProps {
  /** Determinants of Health Reference Code */
  dohRefCode: string;
  /** Overrides for dialog content properties */
  dialogContentProps?: any;
  /** Active field name where the selected items will be stored */
  fieldId?: string;
  /** Label for this field */
  label?: string;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** Text to display when there are no observations for the DOH reference code */
  notDocumentedText?: string;
  /** Text on selection button (if any) */
  selectionText?: string;
  /** Type of selection */
  selectionType?: 'none' | 'single' | 'multiple';
  /** Source field name for the list of observations */
  sourceId?: string;
}

// Helper to get observations from active data filtered by dohRefCode
const useDeterminantsData = (dohRefCode: string): Observation[] => {
  const [activeData] = useActiveData();
  const observationPanels = (activeData as any).example?.observationPanels as ObservationPanel[] || [];

  // Find panels matching the dohRefCode
  const matchingPanels = observationPanels.filter(
    panel => panel.panelName?.code === dohRefCode
  );

  // Get the most recent observation for each observation code
  const observationMap = new Map<string, Observation>();

  matchingPanels.forEach(panel => {
    panel.observations?.forEach(obs => {
      if (obs.observationCode) {
        const existing = observationMap.get(obs.observationCode);
        if (!existing || (obs.collectedDateTime && existing.collectedDateTime &&
            new Date(obs.collectedDateTime) > new Date(existing.collectedDateTime))) {
          observationMap.set(obs.observationCode, obs);
        }
      }
    });
  });

  return Array.from(observationMap.values());
};

export const DeterminantsOfHealth: React.FC<DeterminantsOfHealthProps> = ({
  dohRefCode,
  dialogContentProps,
  fieldId = 'determinantOfHealth',
  label,
  moisModule,
  notDocumentedText = 'Not documented',
  selectionText = 'Select items',
  selectionType = 'none',
  sourceId = 'observations',
}) => {
  const observations = useDeterminantsData(dohRefCode);
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDismiss = () => {
    setIsEditing(false);
  };

  const handleSave = (updatedObservations: Observation[]) => {
    // TODO: Save the updated observations
    setIsEditing(false);
  };

  // Render the grid content
  const renderGrid = () => {
    if (observations.length === 0) {
      return <span>{notDocumentedText}</span>;
    }

    return (
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '120px 400px 200px' }}>
        {observations.map((obs, index) => (
          <React.Fragment key={obs.observationCode || index}>
            <span></span>
            <span>{obs.description || '-'}</span>
            <span>{obs.value || '-'}</span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <>
      <DeterminantsOfHealthEditDialog
        isOpen={isEditing}
        onDismiss={handleDismiss}
        title={label || 'Edit'}
        observations={observations}
        onSave={handleSave}
      />
      <LayoutItem
        label={label}
        labelPosition="left"
        actions={{ onEdit: handleEdit }}
        moisModule={moisModule}
      >
        {renderGrid()}
      </LayoutItem>
    </>
  );
};

export default DeterminantsOfHealth;
