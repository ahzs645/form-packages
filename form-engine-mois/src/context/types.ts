/**
 * MOIS Context Types
 *
 * Type definitions for MOIS-specific data structures.
 */

/**
 * Patient data structure
 */
export interface PatientData {
  patientId?: string;
  name?: {
    given?: string;
    family?: string;
    full?: string;
  };
  dob?: string;
  gender?: string;
  telecom?: Array<{ system: string; value: string }>;
  address?: Array<{ line?: string[]; city?: string; state?: string; postalCode?: string }>;
  encounters?: any[];
  conditions?: any[];
  connections?: any[];
  allergies?: any[];
}

/**
 * Encounter data structure
 */
export interface EncounterData {
  encounterId?: string;
  type?: string;
  status?: string;
  date?: string;
}

/**
 * Webform data structure
 */
export interface WebformData {
  isDraft?: boolean;
  recordState?: string;
  encounter?: any;
  provider?: any;
  observationPanels?: any[];
}

/**
 * User profile data structure
 */
export interface UserProfileData {
  userProfileId?: string;
  identity?: any;
  desktopProvider?: any;
}

/**
 * Code list item structure
 */
export interface CodeListItem {
  code: string;
  display: string;
  system: string;
  category?: string;
}

/**
 * MOIS source data structure
 */
export interface MoisSourceData {
  patient?: PatientData;
  encounter?: EncounterData;
  webform?: WebformData;
  formParams?: Record<string, any>;
  auth?: { jwToken?: string; apiServer?: string };
  optionLists?: Record<string, CodeListItem[]>;
  lifecycleState?: { isLoading?: boolean; isPrinting?: boolean; isMutating?: boolean };
  userProfile?: UserProfileData;
  queryResult?: {
    patient?: any[];
    conditions?: any[];
    observations?: any[];
    allergies?: any[];
    connections?: any[];
  };
}

/**
 * Section context value
 */
export interface SectionContextValue {
  sectionNum: number;
  layout: 'linear' | 'grid' | 'flex' | 'flowsheet' | 'headings';
  fieldPlacement?: Record<string, string | number>;
  readOnlyOptions?: { borderless?: boolean; emptyLabel?: string; emptyHidden?: boolean };
  activeSelector?: (fd: any) => any;
  statusSelector?: (fd: any) => any;
  sourceSelector?: (sd: any) => any;
  sectionComplete?: (sd: any, ad: any, sectionNum: number) => boolean;
  focusZoneRoot?: HTMLElement | null;
}
