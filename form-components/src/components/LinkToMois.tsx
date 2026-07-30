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
  /** Optional click hook before MOIS navigation */
  onClick?: () => void;
  /** Optional style overrides */
  styles?: { root?: React.CSSProperties };
  /** Optional button title */
  title?: string;
}

/**
 * Module name to the MOIS record table the engine navigates to, mirroring the
 * engine's own LinkToMois map (MOIS Form Tester 2.30.31, verified against
 * data/mois-engine-manifest.json).
 *
 * The key set is the contract: the engine looks the uppercased module name up
 * in this exact map and warns "Missing or unexpected module name in
 * LinkToMois" for anything else, leaving the link inert. Do not add
 * speculative modules — SERVICE_EPISODES and SERVICE_REQUESTS were previously
 * listed here by symmetry with the fullChart query collections of the same
 * name, but MOIS has no such modules and both rendered dead links.
 *
 * A null value means the module supports navigation but has no per-record
 * target, so no objectType/objectId pair is built.
 */
const MODULE_TO_OBJECT_TYPE: Record<string, string | null> = {
  'ADVERSE_EVENTS': 'tdt_adverse_event',
  'CHARTACTION': 'tdt_action',
  'CHARTBARRIER': 'tdt_chart_barrier',
  'CHARTMAR': 'tdt_mar',
  'CHARTNEED': 'tdt_need',
  'CHARTPREFERENCE': 'tdt_chart_preference',
  'CHARTRESOURCE': 'tdt_chart_resource',
  'CHARTRISK': 'tdt_risk',
  'CONSULTS': 'tdt_consult',
  'DEMOGRAPHICS': null,
  'DETERHEALTH': null,
  'DOCUMENT': 'tdt_document',
  'ENCOUNTERS': 'tdt_encounter',
  'FACILITY ADMISSIONS': 'tdt_admission',
  'FAMILY HISTORY': 'tdt_family_hx',
  'GOALS': 'tdt_goal',
  'HEALTH ISSUE': 'tdt_health_issue',
  'IMAGING': 'tdt_image',
  'INTERVENTIONS': 'tdt_intervention',
  'LONG TERM MEDS': 'tdt_medication_lt',
  'MEASUREMENTS': 'tdt_measure',
  'MESSAGE': 'tdt_message',
  'ORDERS': 'tdt_order',
  'PRESCRIPTION': 'tdt_prescription',
  'PROCEDURES': 'tdt_procedure',
  'REACTION_RISKS': 'tdt_reaction_risk',
  'SOCIAL HISTORY': 'tdt_social_hx',
};

/** Author-facing labels; the engine's map carries table names, not display text. */
const MODULE_LABELS: Record<string, string> = {
  'ADVERSE_EVENTS': 'Adverse Event',
  'CHARTACTION': 'Chart Action',
  'CHARTBARRIER': 'Chart Barrier',
  'CHARTMAR': 'Chart MAR',
  'CHARTNEED': 'Chart Need',
  'CHARTPREFERENCE': 'Chart Preference',
  'CHARTRESOURCE': 'Chart Resource',
  'CHARTRISK': 'Chart Risk',
  'CONSULTS': 'Consult',
  'DEMOGRAPHICS': 'Demographics',
  'DETERHEALTH': 'Determinants of Health',
  'DOCUMENT': 'Document',
  'ENCOUNTERS': 'Encounter',
  'FACILITY ADMISSIONS': 'Facility Admission',
  'FAMILY HISTORY': 'Family History',
  'GOALS': 'Goal',
  'HEALTH ISSUE': 'Health Issue',
  'IMAGING': 'Imaging',
  'INTERVENTIONS': 'Intervention',
  'LONG TERM MEDS': 'Long Term Med',
  'MEASUREMENTS': 'Measurement',
  'MESSAGE': 'Message',
  'ORDERS': 'Order',
  'PRESCRIPTION': 'Prescription',
  'PROCEDURES': 'Procedure',
  'REACTION_RISKS': 'Reaction Risk',
  'SOCIAL HISTORY': 'Social History',
};

const PREVIEW_ONLY_MODULES = new Set([
  'LOGIC_TEST',
  'WEBFORM_TEST',
]);

// Available chart link modules
export const MOIS_MODULES = Object.keys(MODULE_TO_OBJECT_TYPE) as readonly string[];
export const MOIS_MODULE_LABELS: Record<string, string> = MODULE_LABELS;

export type MoisModule = keyof typeof MODULE_TO_OBJECT_TYPE;

export const LinkToMois: React.FC<LinkToMoisProps> = ({
  moisModule,
  objectId,
  onClick,
  styles,
  title,
}) => {
  const navigate = useMoisNavigate(moisModule);
  const sourceData = useSourceData();
  const normalizedModule = moisModule?.trim().toUpperCase() ?? '';

  // Look up object type from module name (case-insensitive)
  const objectType = MODULE_TO_OBJECT_TYPE[normalizedModule];
  const isPreviewOnlyModule = PREVIEW_ONLY_MODULES.has(normalizedModule);

  React.useEffect(() => {
    if (!normalizedModule || objectType !== undefined || isPreviewOnlyModule) return;
    console.warn('Missing or unexpected module name in LinkToMois: ', moisModule);
  }, [isPreviewOnlyModule, moisModule, normalizedModule, objectType]);

  // Build navigation target if we have both objectId and objectType
  let target: { objectType: string; objectId: number } | undefined;
  if (objectId && objectType) {
    target = {
      objectType,
      objectId,
    };
  }

  const handleClick = () => {
    onClick?.();
    navigate(target);
  };

  return (
    <button
      type="button"
      hidden={sourceData.lifecycleState?.isPrinting}
      style={{
        backgroundColor: 'Transparent',
        border: '0',
        cursor: 'pointer',
        ...(styles?.root ?? {}),
      }}
      onClick={handleClick}
      title={title ?? `Open ${moisModule || 'module'} in MOIS`}
      aria-label={title ?? `Open ${moisModule || 'module'} in MOIS`}
    >
      <div style={{ marginTop: '4px' }}>
        <img
          style={{ width: '16px' }}
          src="/img/GotoRecord.png"
          alt="Link to Mois"
        />
      </div>
    </button>
  );
};

export default LinkToMois;
