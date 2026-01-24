/**
 * Context Types
 *
 * Type definitions for form context providers.
 */

import type React from 'react';
import type { FormData, FormDataSetter } from '../state/types';

/**
 * Generic form context value
 */
export interface FormContextValue<TSource = any> {
  /** Source data (read-only context from server) */
  sourceData: TSource;

  /** Active/form data (mutable form state) */
  formData: FormData;

  /** Update form data using Immer producer or partial object */
  setFormData: FormDataSetter;

  /** Reset form to initial state */
  resetForm: () => void;
}

/**
 * Props for form provider component
 */
export interface FormProviderProps<TSource = any> {
  children: React.ReactNode;
  sourceData?: Partial<TSource>;
  initialFormData?: Partial<FormData>;
}
