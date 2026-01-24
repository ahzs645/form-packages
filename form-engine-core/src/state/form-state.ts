/**
 * Form State Management
 *
 * Provides global form data state for useActiveData in forms.
 * This matches the mois-form-tester pattern for form state management.
 */

import React from 'react';
import { produce } from 'immer';
import type { FormData, FormDataSetter, FormDataWithSetter } from './types';

// Global form data state (shared across all form components)
let globalFormData: FormData = {
  field: { data: {}, status: {} },
  uiState: { sections: {} },
};

let globalFormDataListeners: Array<() => void> = [];

// Global InitialData from form code (used to populate sourceFormData)
let globalInitialData: Record<string, any> = {};

/**
 * Set the InitialData from form code (called by code-transformer after form execution)
 */
export const setInitialData = (data: Record<string, any>) => {
  globalInitialData = data || {};
};

/**
 * Get the InitialData (used by context providers to merge into sourceFormData)
 */
export const getInitialData = (): Record<string, any> => {
  return globalInitialData;
};

/**
 * Initialize/reset form data (called when a form loads)
 */
export const initFormData = () => {
  globalFormData = {
    field: { data: {}, status: {} },
    uiState: { sections: {} },
  };
  globalInitialData = {};
  globalFormDataListeners.forEach(listener => listener());
};

/**
 * Custom useActiveData that matches mois-form-tester pattern exactly.
 *
 * Returns [formDataWithSetter, setFormData] where:
 * - formDataWithSetter has setFormData attached so forms can use fd.setFormData(...)
 * - setFormData accepts either an immer updater function or a partial object
 */
export const useActiveDataForForms = (selector?: (data: FormData) => any): [any, FormDataSetter] => {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // Subscribe to form data changes
  React.useEffect(() => {
    globalFormDataListeners.push(forceUpdate);
    return () => {
      globalFormDataListeners = globalFormDataListeners.filter(l => l !== forceUpdate);
    };
  }, []);

  // Create setFormData function
  const setFormData = React.useCallback<FormDataSetter>((updater) => {
    if (typeof updater === 'function') {
      // Check if updater is a curried producer (created by calling produce(fn) with just a function)
      // A curried producer returns a new state when called with a base state
      // A recipe function mutates a draft and returns undefined
      try {
        const result = updater(globalFormData);
        if (result !== undefined && typeof result === 'object') {
          // It's a curried producer - use the result directly
          globalFormData = result as FormData;
        } else {
          // It's a recipe function - wrap with produce
          globalFormData = produce(globalFormData, updater);
        }
      } catch {
        // If calling directly fails, try with produce
        globalFormData = produce(globalFormData, updater);
      }
    } else {
      globalFormData = { ...globalFormData, ...updater };
    }
    // Notify all listeners
    globalFormDataListeners.forEach(listener => listener());
  }, []);

  // Attach setFormData to formData so forms can use fd.setFormData
  const formDataWithSetter: FormDataWithSetter = { ...globalFormData, setFormData };

  if (selector) {
    return [
      selector(globalFormData),
      (updates: any) => {
        setFormData(produce((draft: FormData) => {
          const target = selector(draft);
          Object.assign(target, updates);
        }));
      }
    ];
  }

  return [formDataWithSetter, setFormData];
};

/**
 * Get the current form data (for use outside of React components)
 */
export const getFormData = (): FormData => globalFormData;
