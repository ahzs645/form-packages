/**
 * @mois/form-engine-core
 *
 * Generic form rendering engine with JSX transformation and state management.
 */

// Transformer
export { createComponentFromCode, isFormCode } from './transformer/code-transformer';
export type { TransformOptions, TransformResult, FormTransformer } from './transformer/types';

// State
export {
  initFormData,
  useActiveDataForForms,
  getFormData,
  setInitialData,
  getInitialData,
} from './state/form-state';
export type { FormData, FormDataSetter, FormDataWithSetter } from './state/types';

// Scope
export { BaseScopeBuilder } from './scope/base-scope-builder';
export { FluentNamespace, FluentActionButton } from './scope/fluent-namespace';
export type { ScopeConfig, ScopeBuilder } from './scope/types';

// Context
export { createFormContext, FormProvider, useSourceData, useFormData } from './context/form-context';
export type { FormContextValue, FormProviderProps } from './context/types';

// Runtime
export { ErrorBoundary } from './runtime/error-boundary';
export { LivePreview } from './runtime/live-preview';
