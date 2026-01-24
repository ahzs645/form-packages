/**
 * @mois/form-engine-mois
 *
 * MOIS-specific form components, hooks, and scope builder.
 */

// Scope
export { MoisScopeBuilder } from './scope/mois-scope-builder';
export type { MoisScopeBuilderOptions } from './scope/mois-scope-builder';

// Context types
export type {
  MoisSourceData,
  PatientData,
  EncounterData,
  WebformData,
  UserProfileData,
  CodeListItem,
  SectionContextValue,
} from './context/types';

// Re-export core utilities that are commonly used with MOIS
export {
  createComponentFromCode,
  BaseScopeBuilder,
  FluentNamespace,
  initFormData,
  useActiveDataForForms,
  ErrorBoundary,
  LivePreview,
} from '@mois/form-engine-core';
