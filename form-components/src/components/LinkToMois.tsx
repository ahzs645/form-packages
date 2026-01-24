/**
 * LinkToMois Component
 * Action button with special icon that will link the corresponding UI element to Mois
 *
 * Extracted from MOIS Form Tester styleguide
 */

import React from 'react';
import { useSourceData } from '../context/MoisContext';
import { useMoisNavigate } from '../hooks/mock-hooks';

export interface LinkToMoisProps {
  /** MOIS module name to tell windows client where to navigate for editing */
  moisModule: string;
  /** The ID of the specific item to link to within the module */
  objectId?: number;
}

// Module name to object type mapping
const MODULE_TO_OBJECT_TYPE: Record<string, string> = {
  'ADVERSE_EVENTS': 'AdverseEvent',
  'CHARTACTION': 'ChartAction',
  'CHARTBARRIER': 'ChartBarrier',
  'CHARTMAR': 'ChartMar',
  'CHARTNEED': 'ChartNeed',
  'CHARTPREFERENCE': 'ChartPreference',
  'CHARTRESOURCE': 'ChartResource',
  'CONSULTS': 'Consult',
  'DEMOGRAPHICS': 'Demographics',
  'DETERHEALTH': 'DeterHealth',
  'DOCUMENT': 'Document',
  'ENCOUNTERS': 'Encounter',
  'FACILITY ADMISSIONS': 'FacilityAdmission',
  'FAMILY HISTORY': 'FamilyHistory',
  'GOALS': 'Goal',
  'HEALTH ISSUE': 'HealthIssue',
  'IMAGING': 'Imaging',
  'INTERVENTIONS': 'Intervention',
  'LONG TERM MEDS': 'LongTermMed',
  'MEASUREMENTS': 'Measurement',
  'MESSAGE': 'Message',
  'ORDERS': 'Order',
  'PRESCRIPTION': 'Prescription',
  'PROCEDURES': 'Procedure',
  'REACTION_RISKS': 'ReactionRisk',
  'SERVICE_EPISODES': 'ServiceEpisode',
  'SERVICE_REQUESTS': 'ServiceRequest',
  'SOCIAL HISTORY': 'SocialHistory',
};

// Available chart link modules
export const MOIS_MODULES = Object.keys(MODULE_TO_OBJECT_TYPE) as readonly string[];

export type MoisModule = keyof typeof MODULE_TO_OBJECT_TYPE;

export const LinkToMois: React.FC<LinkToMoisProps> = ({
  moisModule,
  objectId,
}) => {
  const navigate = useMoisNavigate(moisModule);
  const sourceData = useSourceData();

  // Look up object type from module name (case-insensitive)
  const objectType = MODULE_TO_OBJECT_TYPE[moisModule?.toUpperCase()];

  // Warn if module name not recognized
  if (objectType === undefined) {
    console.warn('Missing or unexpected module name in LinkToMois: ', moisModule);
  }

  // Build navigation target if we have both objectId and objectType
  let target: { objectType: string; objectId: number } | undefined;
  if (objectId && objectType) {
    target = {
      objectType,
      objectId,
    };
  }

  const handleClick = () => {
    navigate(target);
  };

  return (
    <button
      hidden={sourceData.lifecycleState.isPrinting}
      style={{
        backgroundColor: 'Transparent',
        border: '0',
        cursor: 'pointer',
      }}
      onClick={handleClick}
    >
      <div style={{ marginTop: '4px' }}>
        <img
          style={{ width: '16px' }}
          src="./img/GotoRecord.png"
          alt="Link to Mois"
        />
      </div>
    </button>
  );
};

export default LinkToMois;
