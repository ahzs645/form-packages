/**
 * State Types
 *
 * Type definitions for form state management.
 */

/**
 * Default form data structure
 */
export interface FormData {
  field: {
    data: Record<string, any>;
    status: Record<string, any>;
  };
  uiState: {
    sections: Record<string | number, { isComplete?: boolean }>;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Form state setter function type
 */
export type FormDataSetter = (updater: ((draft: FormData) => void) | Partial<FormData>) => void;

/**
 * Form data with setter attached (for fd.setFormData pattern)
 */
export interface FormDataWithSetter extends FormData {
  setFormData: FormDataSetter;
}
