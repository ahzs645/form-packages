/**
 * MOIS Context System
 * Provides the core data context for MOIS form components
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { produce, Draft } from 'immer';
import { mockCodeLists } from './mockCodeLists';
import { getInitialData } from '../hooks/form-state';

// Import the complete example data for DebugView
import selectedActiveData from '../data/selected-active.json';
import selectedSourceData from '../data/selected-source.json';
import themeObject from '../data/theme-object.json';

// ============================================================================
// Types
// ============================================================================

// Note: EncounterData is defined later in this file with full detail

export interface SourceData {
  patient: {
    patientId: number;
    name: { text: string; first: string; middle?: string; family: string };
    dob: string;
    birthDate?: string;
    gender: string;
    administrativeGender?: { code: string; display: string; system?: string };
    educationLevel?: { code: string; display?: string; system?: string };
    telecom: { homePhone?: string; workPhone?: string; cellPhone?: string; email?: string };
    address: { text?: string; line1?: string; line2?: string; city?: string; province?: string; postalCode?: string; country?: string };
    encounters?: Partial<EncounterData>[];
    [key: string]: any;
  };
  encounter: {
    encounterId: number;
    type: string;
    status: string;
    date: string;
  };
  webform: {
    isDraft: string;
    recordState: string;
    encounter?: {
      appointmentDateTime?: string;
      visitCode?: { code: string; display: string };
      visitReason1?: { code?: string; display: string };
      location?: string;
      attendingProvider?: { code?: string; display: string };
      [key: string]: any;
    };
    provider?: { name: string; providerId?: number; [key: string]: any };
    observationPanels?: any[];
    [key: string]: any;
  };
  formParams: Record<string, any>;
  formObject?: {
    Identity: { title: string; name?: string; [key: string]: any };
    [key: string]: any;
  };
  sourceFormData?: Record<string, any>;
  auth: {
    jwToken: string;
    apiServer: string;
  };
  optionLists: Record<string, CodeListItem[]>;
  lifecycleState: {
    isLoading: boolean;
    isPrinting: boolean;
    isMutating?: boolean;
  };
  userProfile?: {
    userProfileId: number;
    identity: { fullName: string; [key: string]: any };
    desktopProvider: { name: string; providerId?: number; [key: string]: any };
    [key: string]: any;
  };
  example?: ExampleData;
  // queryResult contains data returned from GraphQL queries (e.g., from useQuery)
  // Components like HFC_PT_ASMT_PatientSummary access sd.queryResult.patient[0]
  queryResult?: {
    patient?: Array<{
      patientId: number;
      chartNumber?: number;
      name?: { text?: string; first?: string; middle?: string; family?: string };
      birthDate?: string;
      administrativeGender?: { code: string; display: string; system?: string };
      conditions?: Array<{
        conditionId: number;
        condition: { code?: string; display: string; system?: string };
        startDate?: string;
        resolveDate?: string | null;
        certainty?: { code: string; display: string; system?: string };
        severity?: { code: string; display: string; system?: string };
        [key: string]: any;
      }>;
      observations?: Array<{
        observationId: number;
        observationCode?: string;
        description?: string;
        value?: string;
        units?: string;
        collectedDateTime?: string;
        [key: string]: any;
      }>;
      allergies?: Array<{
        code?: string;
        intoleranceType?: string;
        startDate?: string;
        endDate?: string | null;
        substance?: string;
        reactions?: string;
        [key: string]: any;
      }>;
      connections?: Array<{
        connectionId: number;
        connectionType?: { code: string; display: string; system?: string };
        name?: string;
        startDate?: string;
        stopDate?: string | null;
        provider?: { code?: string | null; name: string; source?: string; sourceId?: number };
        providerType?: { code: string; display: string };
        includeOnDemographics?: { code: string; display: string; system?: string };
        isCareTeamMember?: { code: string; display: string; system?: string };
        [key: string]: any;
      }>;
      longTermMedications?: any[];
      [key: string]: any;
    }>;
    [key: string]: any;
  };
}

export interface BenefitPlanCoverage {
  source: string;
  plan: string;
  coverage: string;
}

export interface ContactData {
  associatedPartyId: number;
  name: string;
  relationship: string;
  relationshipType: string;
  telecom?: {
    homePhone?: string;
    workPhone?: string;
    workExt?: string;
    cellPhone?: string;
    pagerNumber?: string;
  };
  preferredPhone?: { code: string };
  address?: { text: string };
}

// DOH observation panel for DeterminantsOfHealth component
export interface DohObservationPanel {
  observationPanelId: number;
  panelName: {
    code: string;
    display: string;
    system: string;
  };
  observations: {
    observationId: number;
    observationCode: string;
    description: string;
    value: string;
    collectedDateTime: string;
    codedValue?: {
      code: string;
      display: string;
      system: string;
    };
  }[];
}

export interface ExampleData {
  // These properties are loaded from JSON and optional in fallback
  associatedParties?: AssociatedPartyData;
  encounter?: EncounterData;
  chartPreference?: ChartPreferenceData;
  correspondence?: CorrespondenceData;
  observation?: ObservationData;
  observationPanel?: ObservationPanelData;
  patient?: PatientData;
  demographics?: any;
  householdOccupants?: any[];
  observationPanels?: DohObservationPanel[];
  // These remain as hardcoded fallbacks (not yet in JSON)
  connection: ConnectionData;
  benefitPlanCoverages: BenefitPlanCoverage[];
  contacts: ContactData[];
}

// Observation item in panel
export interface ObservationItem {
  observationId: number;
  collectedDateTime: string | null;
  observationCode: string;
  description: string;
  value: string;
  abnormalFlag: string | null;
}

export interface ObservationPanelData {
  observationPanelId: number;
  panelName: string;
  orderDateTime: string | null;
  collectedDateTime: string | null;
  specimenReceivedDateTime: string | null;
  placerReferenceNumber: string | null;
  fillerReferenceNumber: string | null;
  orderedBy: string | null;
  orderingSystem: string | null;
  reportedDateTime: string | null;
  status: string | null;
  collectedComment: string | null;
  facility: string | null;
  copyTo: string | null;
  notes: string | null;
  interfaceType: string | null;
  messageSequenceNumber: number | null;
  collectionVolume: string | null;
  collectedBy: string | null;
  specimenSource: string | null;
  orderingSource: string | null;
  universalServiceCode: string | null;
  orderingProviderRef: string | null;
  diagnosticServiceSection: string | null;
  observations: ObservationItem[];
  stamp: {
    createTime: string;
    createUser: string;
    modifyTime: string | null;
    modifyUser: string | null;
  };
}

export interface ObservationData {
  observationId: number;
  patientId: number;
  orderId: number | null;
  encounterId: number | null;
  panelName: string | null;
  sequenceInPanel: number | null;
  placerReference: string | null;
  copiesTo: string | null;
  className: string;
  description: string;
  observationCode: string;
  loincCode: string;
  observationClass: string;
  value: string;
  units: string;
  valueType: string;
  status: string;
  collectedDateTime: string | null;
  performedDateTime: string | null;
  performedBy: string | null;
  reportedBy: string | null;
  collectedBy: string | null;
  comment: string | null;
  report: string | null;
  interfaceNotes: string | null;
  abnormalFlag: { code: string; display: string; system: string } | null;
  recordState: { code: string; display: string; system: string } | null;
  referenceRangeText: string | null;
  rangeNormalLow: string | null;
  rangeNormalHigh: string | null;
  rangeVeryLow: string | null;
  rangeVeryHigh: string | null;
  rangeAbsurdLow: string | null;
  rangeAbsurdHigh: string | null;
  attachmentCount: number | null;
  stamp: {
    createTime: string;
    createUser: string;
    modifyTime: string | null;
    modifyUser: string | null;
  };
}

export interface CorrespondenceData {
  correspondenceId: number;
  className: string;
  when: string | null;
  direction: string | null;
  person: string | null;
  contact: string | null;
  note: string | null;
  stamp: StampData;
}

export interface ConnectionData {
  connectionId: number;
  patientId: number;
  connectionType: { code: string; display: string; system: string } | null;
  providerType: { code: string; display: string; system: string } | null;
  provider: { code: string | null; name: string; source: string; sourceId: number } | null;
  name: string;
  includeOnDemographics: { code: string; display: string; system: string } | null;
  isCareTeamMember: { code: string; display: string; system: string } | null;
  startDate: string | null;
  stopDate: string | null;
  stopReason: { code: string; display: string; system: string } | null;
  stopNote: string | null;
  comment: string | null;
  attachmentCount: number | null;
  stamp: StampData;
}

export interface AssociatedPartyData {
  associatedPartyId: number;
  name: string;
  relationshipCode: string;
  relationshipType: string;
  homePhone: string;
  workPhone: string;
  workExt: string;
  note: string;
  preferredPhone: string;
  includeOnDemographics: string;
  isMemberOfCareTeam: string;
  attachmentCount: number;
  address: AddressData;
  telecom: TelecomData;
  stamp: StampData;
}

export interface AddressData {
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  text?: string;
}

export interface TelecomData {
  homePhone: string;
  homeMessage: string;
  workPhone: string;
  workExt: string;
  workMessage: string;
  cellPhone: string;
  pagerNumber: string;
  homeEmail: string;
  workEmail: string;
}

export interface StampData {
  createdDate: string;
  createdBy: string;
  modifiedDate: string;
  modifiedBy: string;
}

export interface CodeValue {
  code: string | null;
  display: string | null;
  system: string;
}

export interface ServiceValue extends CodeValue {
  count: number | null;
  phase: string;
}

export interface EncounterData {
  encounterId: number;
  patientId: number;
  chartNumber: number;
  className: string;
  appointmentDateTime: string | null;
  arrivedDateTime: string | null;
  attachmentCount: number | null;
  attendingProvider: CodeValue | null;
  billingStatus: CodeValue;
  callingCenter: CodeValue | null;
  cancelledDateTime: string | null;
  chartAssignedDateTime: string | null;
  dischargeDateTime: string | null;
  documentStatus: CodeValue;
  encompassingEncounterId: number | null;
  encompassingEncounterIdent: string | null;
  encounterFormCount: number | null;
  groupVisitId: number | null;
  healthIssues: (CodeValue | null)[];
  inRoomDateTime: string | null;
  location: string | null;
  name: { first: string; family: string; text: string };
  officeNote: string | null;
  payor: CodeValue;
  priority: CodeValue;
  providerId: number;
  resourceId: number | null;
  roomNumber: string | null;
  seenDateTime: string | null;
  services: (ServiceValue | null)[];
  status: CodeValue;
  taskCount: number | null;
  timeSlots: number;
  visitCode: CodeValue;
  visitMode: CodeValue;
  visitReason1: CodeValue;
  visitReason2: CodeValue;
  stamp: StampData;
  correspondences?: CorrespondenceData[];
}

export interface ChartPreferenceData {
  preferenceId: number;
  patientId: number;
  encounterId: number;
  preferenceType: string;
  preference: string;
  codedSubject: string;
  classification: string;
  instruction: string;
  instructionDetail: string;
  reason: string;
  reasonDetail: string;
  startDate: string;
  endDate: string;
  sensitive: string;
  includeOnDemographics: string;
  subjectCodeType: string;
  subjectConceptName: string;
  subjectDetail: string;
  attachmentCount: number;
  stamp: StampData;
}

export interface PatientData {
  patientId: number;
  chartNumber?: number;
  name: { text: string; first: string; middle?: string; family: string };
  nickName?: { text: string };
  dob: string;
  gender: string;
  active: CodeListItem | string;
  activeChanged?: string;
  firstNationStatus: CodeListItem | string | null;
  maritalStatus?: CodeListItem | null;
  preferredGender?: CodeListItem | null;
  genotypicGender?: CodeListItem | null;
  preferredPhone?: CodeListItem | null;
  telecom: TelecomData;
  address: AddressData;
  healthNumber?: string;
  healthNumberBy?: string;
  insuranceBy?: CodeListItem | null;
  insuranceNumber?: string;
  insuranceDependent?: string;
  insuranceBenefitSource?: string;
  facilityCode?: CodeListItem | null;
  locationCode?: CodeListItem | null;
  serviceCenter?: CodeListItem | null;
  chartLocation?: string;
  countryOfOrigin?: { display: string };
  language?: { display: string };
  generalPractitioner?: { display: string };
  adopted?: CodeListItem | null;
  multipleBirth?: CodeListItem | null;
  deceasedDate?: string;
  genderComment?: string;
  race1?: { display: string };
  race2?: { display: string };
  race3?: { display: string };
  religion?: string;
  shortNote?: string;
  note?: string;
  lastContactDate?: string;
  stamp: StampData;
}

export interface CodeListItem {
  code: string;
  display: string;
  system: string;
  category?: string;
  [key: string]: any;
}

export interface ActiveData {
  field?: {
    data: Record<string, any>;
    status: Record<string, any>;
    history: any[];
  };
  formData: Record<string, any>;
  uiState: {
    sections: Record<number | string, { isComplete?: boolean }>;
    editing?: boolean;
  };
  tempArea: Record<string, any>;
  setFormData: (updater: (draft: Draft<ActiveData>) => void) => void;
  example?: any; // Using 'any' to allow full JSON data
}

export interface SectionContextValue {
  sectionNum: number;
  layout: 'linear' | 'grid' | 'flex' | 'flowsheet' | 'headings';
  fieldPlacement?: Record<string, string | number>;
  readOnlyOptions: { borderless?: boolean; emptyLabel?: string; emptyHidden?: boolean };
  activeSelector?: (fd: any) => any;
  statusSelector?: (fd: any) => any;
  sourceSelector?: (sd: any) => any;
  sectionComplete: (sd: any, ad: any, sectionNum: number) => boolean;
  focusZoneRoot?: HTMLElement | null;
}

// ============================================================================
// Contexts
// ============================================================================

const SourceDataContext = createContext<SourceData | null>(null);
const ActiveDataContext = createContext<ActiveData | null>(null);
const SectionContext = createContext<SectionContextValue>({
  sectionNum: 0,
  layout: 'flex',
  readOnlyOptions: {},
  activeSelector: (fd: any) => fd?.field?.data ?? fd,
  sourceSelector: (sd: any) => sd?.patient ?? sd,
  sectionComplete: () => false,
});

// ============================================================================
// Mock Data
// ============================================================================

const defaultStamp: StampData = {
  createdDate: '2015.03.11 - 14:58',
  createdBy: 'Alyssa',
  modifiedDate: '2017.03.30 - 12:27',
  modifiedBy: 'ADMINISTRATOR',
};

// Removed defaultAssociatedParty - now using JSON data from selected-active.json
// Removed defaultChartPreference - now using JSON data from selected-active.json

// Removed defaultPatient - now using JSON data from selected-active.json

const defaultConnection: ConnectionData = {
  connectionId: 500036,
  patientId: 500063,
  connectionType: { code: 'PRIMARY', display: 'Primary Provider', system: 'MOIS-CONNECTIONTYPE' },
  providerType: { code: '100', display: 'PROVIDER (EXT)', system: 'MOIS-CONNECTIONPROVIDERTYPE' },
  provider: { code: null, name: 'FERREIRA, Stephan', source: 'ProviderExternal', sourceId: 10003148 },
  name: 'FERREIRA, Stephan',
  includeOnDemographics: { code: 'Y', display: 'Yes', system: 'MOIS-YESNO' },
  isCareTeamMember: { code: 'N', display: 'No', system: 'MOIS-YESNO' },
  startDate: null,
  stopDate: null,
  stopReason: null,
  stopNote: null,
  comment: null,
  attachmentCount: null,
  stamp: defaultStamp,
};

// Removed defaultCorrespondence - now using JSON data from selected-active.json
// Removed defaultObservation - now using JSON data from selected-active.json

// Removed defaultObservationPanel - now using JSON data from selected-active.json
// Removed defaultEncounter - now using JSON data from selected-active.json

export const defaultSourceData: SourceData = {
  patient: {
    patientId: 500063,
    name: { text: 'John Smith', first: 'John', family: 'Smith' },
    dob: '1980-01-15',
    birthDate: '1980-01-15',
    gender: 'male',
    administrativeGender: { code: 'M', display: 'Male', system: 'MOIS-GENDER' },
    educationLevel: { code: 'Post-Secondary', display: 'Post-Secondary Education', system: 'MOIS-EDUCATION' },
    telecom: { homePhone: '555-1234' },
    address: { text: '123 Main St, Calgary, AB' },
    // observations on patient for components that access sd.patient.observations
    observations: [
      {
        observationId: 600001,
        observationCode: '2455',
        description: 'Ejection Fraction',
        value: '55',
        units: '%',
        collectedDateTime: '2024-01-10T09:00:00',
      },
      {
        observationId: 600002,
        observationCode: '2455',
        description: 'Ejection Fraction',
        value: '50',
        units: '%',
        collectedDateTime: '2023-06-15T10:30:00',
      },
    ],
    // conditions on patient for components that access sd.patient.conditions
    conditions: [
      {
        conditionId: 500101,
        condition: { code: 'HTN', display: 'Hypertension', system: 'MOIS-CONDITION' },
        startDate: '2020-01-15',
        resolveDate: null,
        certainty: { code: 'C', display: 'Confirmed' },
        severity: { code: 'M', display: 'Moderate' },
      },
      {
        conditionId: 500102,
        condition: { code: 'DM2', display: 'Type 2 Diabetes', system: 'MOIS-CONDITION' },
        startDate: '2019-06-01',
        resolveDate: null,
        certainty: { code: 'C', display: 'Confirmed' },
        severity: { code: 'L', display: 'Mild' },
      },
    ],
    // connections on patient for components that access sd.patient.connections
    connections: [
      {
        connectionId: 500036,
        connectionType: { code: 'PRIMARY', display: 'Primary Provider', system: 'MOIS-CONNECTIONTYPE' },
        name: 'PRACTITIONER, GENERAL',
        startDate: '2020-01-01',
        stopDate: null,
        provider: { code: null, name: 'PRACTITIONER, GENERAL', source: 'ProviderExternal', sourceId: 10003148 },
        providerType: { code: '100', display: 'PROVIDER (EXT)' },
        includeOnDemographics: { code: 'Y', display: 'Yes', system: 'MOIS-YESNO' },
        isCareTeamMember: { code: 'N', display: 'No', system: 'MOIS-YESNO' },
      },
    ],
    // allergies on patient
    allergies: [
      {
        code: 'PNCLLN',
        intoleranceType: 'Allergy',
        startDate: '2015-03-20',
        endDate: null,
        substance: 'Penicillin',
        reactions: 'Rash, Hives',
      },
    ],
    longTermMedications: [],
    encounters: [
      {
        encounterId: 500634,
        appointmentDateTime: '2024-01-15T09:00:00',
        name: { first: 'John', family: 'Smith', text: 'John Smith' },
        status: { code: 'A', display: 'Arrived', system: 'MOIS-ENCOUNTERSTATUS' },
        billingStatus: { code: 'I', display: 'Incomplete', system: 'MOIS-BILLINGSTATUS' },
        documentStatus: { code: 'I', display: 'Incomplete', system: 'MOIS-DOCUMENTSTATUS' },
      },
      {
        encounterId: 500635,
        appointmentDateTime: '2024-01-10T14:30:00',
        name: { first: 'John', family: 'Smith', text: 'John Smith' },
        status: { code: 'D', display: 'Discharged', system: 'MOIS-ENCOUNTERSTATUS' },
        billingStatus: { code: 'B', display: 'Billed', system: 'MOIS-BILLINGSTATUS' },
        documentStatus: { code: 'C', display: 'Complete', system: 'MOIS-DOCUMENTSTATUS' },
      },
      {
        encounterId: 500636,
        appointmentDateTime: '2024-01-05T11:00:00',
        name: { first: 'John', family: 'Smith', text: 'John Smith' },
        status: { code: 'S', display: 'Seen', system: 'MOIS-ENCOUNTERSTATUS' },
        billingStatus: { code: 'B', display: 'Billed', system: 'MOIS-BILLINGSTATUS' },
        documentStatus: { code: 'C', display: 'Complete', system: 'MOIS-DOCUMENTSTATUS' },
      },
    ],
  },
  encounter: {
    encounterId: 500634,
    type: 'Office Visit',
    status: 'In Progress',
    date: '2024-01-15',
  },
  webform: {
    isDraft: 'Y',
    recordState: 'active',
    encounter: {
      appointmentDateTime: '2024-01-15T09:00:00',
      visitCode: { code: 'OV', display: 'Office Visit' },
      visitReason1: { code: 'FU', display: 'Follow Up' },
      location: 'Main Clinic',
      attendingProvider: { code: '500007', display: 'PRACTITIONER, GENERAL' },
    },
    provider: { name: 'PRACTITIONER, GENERAL', providerId: 500007 },
    observationPanels: [],
  },
  formParams: {
    patientId: 500063,
  },
  formObject: {
    Identity: { title: 'Form Preview', name: 'FormPreview' },
  },
  // sourceFormData should be empty by default so forms can detect "new form" vs "saved form"
  // Forms typically check: Object.keys(sd.sourceFormData).length > 0
  sourceFormData: {},
  auth: { jwToken: '', apiServer: '' },
  optionLists: {},
  lifecycleState: { isLoading: false, isPrinting: false, isMutating: false },
  // queryResult mirrors the patient data structure for components that access sd.queryResult.patient[0]
  queryResult: {
    patient: [
      {
        patientId: 500063,
        chartNumber: 10012,
        name: { text: 'John Smith', first: 'John', family: 'Smith' },
        birthDate: '1980-01-15',
        administrativeGender: { code: 'M', display: 'Male', system: 'MOIS-GENDER' },
        conditions: [
          {
            conditionId: 500101,
            condition: { code: 'HTN', display: 'Hypertension', system: 'MOIS-CONDITION' },
            startDate: '2020-01-15',
            resolveDate: null,
            certainty: { code: 'C', display: 'Confirmed', system: 'MOIS-CERTAINTY' },
            severity: { code: 'M', display: 'Moderate', system: 'MOIS-SEVERITY' },
          },
          {
            conditionId: 500102,
            condition: { code: 'DM2', display: 'Type 2 Diabetes', system: 'MOIS-CONDITION' },
            startDate: '2019-06-01',
            resolveDate: null,
            certainty: { code: 'C', display: 'Confirmed', system: 'MOIS-CERTAINTY' },
            severity: { code: 'L', display: 'Mild', system: 'MOIS-SEVERITY' },
          },
        ],
        observations: [
          {
            observationId: 600001,
            observationCode: '2455',
            description: 'Ejection Fraction',
            value: '55',
            units: '%',
            collectedDateTime: '2024-01-10T09:00:00',
          },
          {
            observationId: 600002,
            observationCode: '2455',
            description: 'Ejection Fraction',
            value: '50',
            units: '%',
            collectedDateTime: '2023-06-15T10:30:00',
          },
        ],
        allergies: [
          {
            code: 'PNCLLN',
            intoleranceType: 'Allergy',
            startDate: '2015-03-20',
            endDate: null,
            substance: 'Penicillin',
            reactions: 'Rash, Hives',
          },
        ],
        connections: [
          {
            connectionId: 500036,
            connectionType: { code: 'PRIMARY', display: 'Primary Provider', system: 'MOIS-CONNECTIONTYPE' },
            name: 'PRACTITIONER, GENERAL',
            startDate: '2020-01-01',
            stopDate: null,
            provider: { code: null, name: 'PRACTITIONER, GENERAL', source: 'ProviderExternal', sourceId: 10003148 },
            providerType: { code: '100', display: 'PROVIDER (EXT)' },
            includeOnDemographics: { code: 'Y', display: 'Yes', system: 'MOIS-YESNO' },
            isCareTeamMember: { code: 'N', display: 'No', system: 'MOIS-YESNO' },
          },
        ],
        longTermMedications: [],
      },
    ],
  },
  userProfile: {
    userProfileId: 500001,
    identity: { fullName: 'Dr. Jane Provider' },
    desktopProvider: { name: 'PRACTITIONER, GENERAL', providerId: 500007 },
  },
  // Only keep fallback data for components NOT using JSON yet
  example: {
    // Connection archetype - not yet in JSON
    connection: defaultConnection,
    // BenefitPlans component - not yet in JSON
    benefitPlanCoverages: [
      { source: 'BC Medical Service Plan', plan: 'Basic MSP Coverage', coverage: 'Standard' },
      { source: 'SunLife Insurance', plan: 'Enhanced Coverage', coverage: 'FULL' },
    ],
    // Contact component - not yet in JSON
    contacts: [
      {
        associatedPartyId: 500015,
        name: 'Amy Anxiety',
        relationship: 'Daughter',
        relationshipType: 'Emergency Contact',
        telecom: { homePhone: '(250) 960-1234', cellPhone: '(250) 555-5678' },
        preferredPhone: { code: '1' },
        address: { text: '2251 Disney Road\nPrince George, BC\nCanada V3L 2K2' },
      },
      {
        associatedPartyId: 500016,
        name: 'Minnie Mouse',
        relationship: 'Wife',
        relationshipType: 'Next of Kin',
        telecom: { homePhone: '(250) 960-9564', workPhone: '(250) 960-8888', workExt: '101', cellPhone: '(250) 555-1111' },
        preferredPhone: { code: '3' },
        address: { text: '2251 Disney Road\nPrince George, BC\nCanada V3L 2K2' },
      },
    ],
  },
};

// ============================================================================
// Hooks
// ============================================================================

// App settings type for useAppSettings hook
export interface AppSettings {
  providers: Array<{ providerId: number; name: string; [key: string]: any }>;
  userProfiles: any[];
  sitePreference: any[];
  userPreferences: Record<string, any>;
  serverInfo: {
    Database: string;
    Server: string;
    [key: string]: any;
  };
}

// Default app settings with mock providers
const defaultAppSettings: AppSettings = {
  providers: [
    { providerId: 500007, name: 'PRACTITIONER, GENERAL' },
    { providerId: 500016, name: 'HALLIWELL, A.' },
    { providerId: 500032, name: 'ADMINISTRATOR' },
    { providerId: 500045, name: 'SMITH, JOHN' },
    { providerId: 500046, name: 'JONES, MARY' },
    { providerId: 500047, name: 'WILLIAMS, DAVID' },
    { providerId: 500048, name: 'BROWN, SARAH' },
    { providerId: 500049, name: 'DAVIS, MICHAEL' },
    { providerId: 500050, name: 'WILSON, JENNIFER' },
    { providerId: 500051, name: 'TAYLOR, ROBERT' },
  ],
  userProfiles: [],
  sitePreference: [],
  userPreferences: {},
  serverInfo: {
    Database: 'moisdb_preview',
    Server: 'localhost',
  },
};

export interface SourceDataWithHooks extends SourceData {
  useAppSettings: () => AppSettings;
}

export function useSourceData(): SourceDataWithHooks {
  const context = useContext(SourceDataContext);
  const sourceData = context || defaultSourceData;

  return {
    ...sourceData,
    useAppSettings: () => defaultAppSettings,
  };
}

export function useActiveData<T = ActiveData>(selector?: (data: ActiveData) => T): [T & { setFormData: (updater: (draft: any) => void) => void }, (updater: (draft: any) => void) => void] {
  const context = useContext(ActiveDataContext);

  // Provide a fallback context for when used outside MoisProvider (like in form tester)
  const emptyData = {
    field: { data: {}, status: {}, history: [] },
    uiState: { sections: {} },
    formData: {},
    tempArea: {},
    setFormData: () => {}
  };

  const activeContext = context || emptyData as ActiveData;
  const setFormData = activeContext.setFormData;

  // Get the data (with optional selector)
  const rawData = selector ? selector(activeContext) : activeContext;

  // Attach setFormData to the data object so forms can use fd.setFormData
  const dataWithSetter = useMemo(() => ({
    ...rawData as any,
    setFormData,
  }), [rawData, setFormData]);

  return [dataWithSetter as T & { setFormData: (updater: (draft: any) => void) => void }, setFormData];
}

export function useSection(overrides?: Partial<SectionContextValue>): SectionContextValue {
  const context = useContext(SectionContext);

  return useMemo(() => ({
    sectionNum: overrides?.sectionNum ?? context.sectionNum,
    layout: overrides?.layout ?? context.layout,
    fieldPlacement: overrides?.fieldPlacement ?? context.fieldPlacement,
    readOnlyOptions: overrides?.readOnlyOptions ?? context.readOnlyOptions,
    activeSelector: overrides?.activeSelector ?? context.activeSelector,
    statusSelector: overrides?.statusSelector ?? context.statusSelector,
    sourceSelector: overrides?.sourceSelector ?? context.sourceSelector,
    sectionComplete: overrides?.sectionComplete ?? context.sectionComplete,
    focusZoneRoot: overrides?.focusZoneRoot ?? context.focusZoneRoot,
  }), [context, overrides]);
}

// Default fallback code list for unknown systems - defined outside component to maintain stable reference
const defaultCodeListFallback: CodeListItem[] = [
  { code: 'CODE1', display: 'Option 1', system: 'UNKNOWN' },
  { code: 'CODE2', display: 'Option 2', system: 'UNKNOWN' },
  { code: 'CODE3', display: 'Option 3', system: 'UNKNOWN' },
];

export function useCodeList(system: string): CodeListItem[] {
  const sourceData = useSourceData();

  // Memoize the result to prevent infinite re-renders
  return useMemo(() => {
    // Check optionLists first
    if (sourceData.optionLists[system]) {
      return sourceData.optionLists[system];
    }

    // Return mock data for common code systems (imported from mockCodeLists.ts)
    // Use the predefined fallback array to maintain stable reference
    return mockCodeLists[system] || defaultCodeListFallback;
  }, [sourceData.optionLists, system]);
}

export function useOptionLists() {
  return useSourceData().optionLists;
}

export function useEffectOnce(effect: () => void | (() => void)) {
  const hasRun = React.useRef(false);

  React.useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      return effect();
    }
  }, []);
}

export function useTheme() {
  // Return the theme from the JSON file
  // This includes palette, semanticColors, effects, spacing, and mois/aihs extensions
  return themeObject as typeof themeObject & {
    mois: typeof themeObject.mois;
    aihs: typeof themeObject.aihs;
    palette: typeof themeObject.palette;
    semanticColors: typeof themeObject.semanticColors;
  };
}

/** Button size type */
export type ButtonSize = 'min' | 'tiny' | 'small' | 'medium' | 'large' | 'max';

/**
 * Hook to get button styles from theme based on size
 * Centralizes button sizing logic for consistent styling across components
 */
export function useButtonSize(size: ButtonSize = 'small') {
  const theme = useTheme();
  const buttonSize = theme.mois.buttonSizes[size] || theme.mois.buttonSizes.small;
  return {
    root: { ...buttonSize, alignSelf: 'flex-start' as const },
  };
}

/** Activity layout options */
export interface ActivityOptions {
  orientation?: 'landscape' | 'portrait' | 'auto';
  navSize?: string;
  detailSize?: string;
  nameBlockSize?: string;
}

/**
 * Hook to manage activity layout state
 */
export function useActivityOptions(initialOptions: ActivityOptions = {}): ActivityOptions {
  const [options] = useState<ActivityOptions>({
    orientation: initialOptions.orientation || 'landscape',
    navSize: initialOptions.navSize || '200px',
    detailSize: initialOptions.detailSize || '300px',
    nameBlockSize: initialOptions.nameBlockSize || 'auto',
  });

  return options;
}

/**
 * MoisHooks namespace - provides hooks for MOIS components
 */
export const MoisHooks = {
  useActivityOptions,
};

// ============================================================================
// Data Profile Context (for switching between data profiles globally)
// ============================================================================

interface DataProfileContextValue {
  profileData: any;
  setProfileData: (data: any) => void;
  profileSourceData: any;
  setProfileSourceData: (data: any) => void;
}

const DataProfileContext = createContext<DataProfileContextValue>({
  profileData: selectedActiveData,
  setProfileData: () => {},
  profileSourceData: null,
  setProfileSourceData: () => {},
});

export function DataProfileProvider({ children }: { children: ReactNode }) {
  const [profileData, setProfileData] = useState<any>(selectedActiveData);
  const [profileSourceData, setProfileSourceData] = useState<any>(null);

  const value = useMemo(() => ({
    profileData,
    setProfileData,
    profileSourceData,
    setProfileSourceData,
  }), [profileData, profileSourceData]);

  return (
    <DataProfileContext.Provider value={value}>
      {children}
    </DataProfileContext.Provider>
  );
}

export function useDataProfile() {
  return useContext(DataProfileContext);
}

// ============================================================================
// Provider Component
// ============================================================================

interface MoisProviderProps {
  children: ReactNode;
  sourceData?: Partial<SourceData>;
}

export function MoisProvider({ children, sourceData: customSourceData }: MoisProviderProps) {
  // Get profile data from context (if available)
  const { profileData, profileSourceData } = useContext(DataProfileContext);
  const activeDataSource = profileData || selectedActiveData;

  const sourceData = useMemo(() => {
    const initialData = getInitialData();
    // Use profileSourceData if available, otherwise fall back to static JSON
    const baseSourceData = profileSourceData || selectedSourceData;
    return {
      ...defaultSourceData,
      // Merge in the source data (from profile or JSON file)
      ...(baseSourceData as any),
      ...customSourceData,
      // Merge InitialData from form code into sourceFormData
      sourceFormData: {
        ...(baseSourceData as any)?.sourceFormData,
        ...customSourceData?.sourceFormData,
        ...initialData,
      },
    };
  }, [customSourceData, profileSourceData]);

  // Initialize activeData with the profile data
  const [activeData, setActiveData] = useState<Omit<ActiveData, 'setFormData'>>({
    field: activeDataSource.field || { data: {}, status: {}, history: [] },
    formData: {},
    uiState: activeDataSource.uiState || { sections: {}, editing: false },
    tempArea: activeDataSource.tempArea || {},
    // Use the full example data from the profile
    example: activeDataSource.example || sourceData.example,
  });

  // Update activeData when profile changes
  useEffect(() => {
    setActiveData({
      field: activeDataSource.field || { data: {}, status: {}, history: [] },
      formData: {},
      uiState: activeDataSource.uiState || { sections: {}, editing: false },
      tempArea: activeDataSource.tempArea || {},
      example: activeDataSource.example || sourceData.example,
    });
  }, [activeDataSource, sourceData.example]);

  const setFormData = useCallback((updater: ((draft: Draft<ActiveData>) => void) | ((base: ActiveData) => ActiveData) | Partial<ActiveData>) => {
    setActiveData(current => {
      // Handle plain object updates (shallow merge)
      if (typeof updater !== 'function') {
        if (updater && typeof updater === 'object') {
          // Merge the object with current state
          return { ...current, ...updater } as ActiveData;
        }
        return current;
      }
      // Check if updater is a curried producer (created by calling produce(fn) with just a function)
      // A curried producer returns a new state when called with a base state
      // A recipe function mutates a draft and returns undefined
      try {
        const result = updater(current as any);
        if (result !== undefined && typeof result === 'object') {
          // It's a curried producer - use the result directly
          return result as ActiveData;
        }
      } catch {
        // Not a curried producer, fall through to recipe handling
      }
      // It's a recipe function - wrap with produce
      return produce(current, updater as any);
    });
  }, []);

  const activeDataValue: ActiveData = useMemo(() => ({
    ...activeData,
    setFormData,
  }), [activeData, setFormData]);

  return (
    <SourceDataContext.Provider value={sourceData}>
      <ActiveDataContext.Provider value={activeDataValue}>
        {children}
      </ActiveDataContext.Provider>
    </SourceDataContext.Provider>
  );
}

// ============================================================================
// Section Provider Component
// ============================================================================

export interface SectionProviderProps {
  children: React.ReactNode;
  layout?: SectionContextValue['layout'];
  fieldPlacement?: SectionContextValue['fieldPlacement'];
  readOnlyOptions?: SectionContextValue['readOnlyOptions'];
  activeSelector?: SectionContextValue['activeSelector'];
  sourceSelector?: SectionContextValue['sourceSelector'];
  statusSelector?: SectionContextValue['statusSelector'];
  sectionComplete?: SectionContextValue['sectionComplete'];
}

export function SectionProvider({
  children,
  layout,
  fieldPlacement,
  readOnlyOptions,
  activeSelector,
  sourceSelector,
  statusSelector,
  sectionComplete,
}: SectionProviderProps) {
  const parentSection = useContext(SectionContext);

  const value = useMemo<SectionContextValue>(() => ({
    sectionNum: parentSection.sectionNum + 1,
    layout: layout ?? parentSection.layout,
    fieldPlacement: fieldPlacement ?? parentSection.fieldPlacement,
    readOnlyOptions: readOnlyOptions ?? parentSection.readOnlyOptions,
    activeSelector: activeSelector ?? parentSection.activeSelector,
    sourceSelector: sourceSelector ?? parentSection.sourceSelector,
    statusSelector: statusSelector ?? parentSection.statusSelector,
    sectionComplete: sectionComplete ?? parentSection.sectionComplete,
    focusZoneRoot: parentSection.focusZoneRoot,
  }), [
    parentSection,
    layout,
    fieldPlacement,
    readOnlyOptions,
    activeSelector,
    sourceSelector,
    statusSelector,
    sectionComplete,
  ]);

  return (
    <SectionContext.Provider value={value}>
      {children}
    </SectionContext.Provider>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { SourceDataContext, ActiveDataContext, SectionContext };
export { produce };
