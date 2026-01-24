/**
 * MOIS Context
 * Context providers and hooks for MOIS forms
 */

export {
  // Core contexts
  SourceDataContext,
  ActiveDataContext,
  SectionContext,

  // Main provider
  MoisProvider,
  SectionProvider,
  DataProfileProvider,

  // Hooks
  useSourceData,
  useActiveData,
  useSection,
  useCodeList,
  useOptionLists,
  useEffectOnce,
  useTheme,
  useButtonSize,
  useActivityOptions,
  useDataProfile,

  // Hook namespace
  MoisHooks,

  // Default data
  defaultSourceData,

  // Utility
  produce,

  // Types
  type SourceData,
  type ActiveData,
  type SectionContextValue,
  type PatientData,
  type EncounterData,
  type ObservationData,
  type CodeListItem,
  type CodeValue,
  type ServiceValue,
  type ButtonSize,
  type ActivityOptions,
  type AppSettings,
  type BenefitPlanCoverage,
  type ContactData,
  type ConnectionData,
  type CorrespondenceData,
  type AssociatedPartyData,
  type AddressData,
  type TelecomData,
  type StampData,
  type ChartPreferenceData,
} from './MoisContext';
