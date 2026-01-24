/**
 * MOIS Scope Builder
 * Scope building utilities for form rendering
 */

// The main buildScope function that creates the full scope for form rendering
export { buildScope } from './build-scope';

// Fluent UI namespace helpers
export { FluentNamespace, FluentActionButton } from './fluent-namespace';

// MOIS namespace helpers
export {
  MoisFunction,
  MoisHooks,
  MoisControl,
  MoisExtended,
  NameBlockFields,
  Pe,
  AihsControls,
  AihsActions,
  AihsFunctions,
} from './mois-namespaces';

// Code transformer
export { createComponentFromCode } from './code-transformer';

// Live preview components
export { ErrorBoundary, LivePreview } from './components';
export type { LivePreviewProps } from './components';

// Re-export form state management from hooks
export {
  FormStateProvider,
  useActiveDataForForms,
  initFormData,
  setInitialData,
  getInitialData,
} from '../hooks';
