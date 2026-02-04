/**
 * Form State Management
 *
 * Provides form data state for useActiveData in forms using React Context.
 * This matches the mois-form-tester pattern for form state management.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { produce } from 'immer';

// ============================================================================
// Types
// ============================================================================

interface FormDataState {
  field: { data: Record<string, any>; status: Record<string, any> };
  uiState: { sections: Record<string, any> };
  tempArea?: Record<string, any>;
}

interface FormStateContextValue {
  formData: FormDataState;
  setFormData: (updater: any) => void;
}

// ============================================================================
// Context
// ============================================================================

const FormStateContext = createContext<FormStateContextValue | null>(null);

// Global InitialData from form code (used to populate sourceFormData)
let globalInitialData: Record<string, any> = {};

// Global reference to current form data (for getFormData() and initFormData())
let currentFormData: FormDataState = {
  field: { data: {}, status: {} },
  uiState: { sections: {} },
};

// Global setter reference (set by FormStateProvider)
let globalSetFormData: ((updater: any) => void) | null = null;

/**
 * Set the InitialData from form code (called by code-transformer after form execution)
 * This merges the InitialData into form data so forms can access fd.field.data.*
 */
export const setInitialData = (data: Record<string, any>) => {
  globalInitialData = data || {};

  // Merge InitialData into form data so forms can access fd.field.data.*
  if (data && typeof data === 'object' && globalSetFormData) {
    globalSetFormData((prev: FormDataState) => ({
      ...prev,
      field: {
        ...prev.field,
        data: {
          ...prev.field.data,
          ...data,
        },
      },
    }));
  }
};

/**
 * Get the InitialData (used by MoisContext to merge into sourceFormData)
 */
export const getInitialData = (): Record<string, any> => {
  return globalInitialData;
};

/**
 * Initialize/reset form data (called when a form loads)
 */
export const initFormData = () => {
  globalInitialData = {};
  if (globalSetFormData) {
    globalSetFormData({
      field: { data: {}, status: {} },
      uiState: { sections: {} },
    });
  }
};

// ============================================================================
// Helper function to apply form data updates
// ============================================================================

const applyFormDataUpdate = (prevState: FormDataState, updater: any): FormDataState => {
  let newState: FormDataState;

  if (typeof updater === 'function') {
    try {
      // Always use immer to avoid mutating (possibly frozen) state directly.
      // This also supports curried producers returned by produce(fn).
      newState = produce(prevState, updater);
    } catch (e) {
      console.error('[setFormData] error applying updater:', e);
      return prevState;
    }
  } else if (updater && typeof updater === 'object') {
    // Plain object - shallow merge
    newState = { ...prevState, ...updater };
  } else {
    return prevState;
  }

  // Force a new object reference (like mois-form-tester does)
  // This ensures React detects the change and re-renders consumers
  return JSON.parse(JSON.stringify(newState));
};

/**
 * Form State Provider - wraps forms to provide state context
 */
export const FormStateProvider = ({ children }: { children: React.ReactNode }) => {
  const [formData, setFormDataState] = useState<FormDataState>({
    field: { data: {}, status: {} },
    // Initialize sections as an array with a default section that is NOT complete
    // This allows forms to check fd.uiState.sections[0].isComplete === false
    uiState: { sections: [{ isComplete: false }] },
  });

  // Track if we're currently in a render phase to defer setState calls during render
  const isRenderingRef = React.useRef(false);
  const pendingUpdatesRef = React.useRef<any[]>([]);

  // Process any pending updates (called after render via useEffect)
  React.useEffect(() => {
    isRenderingRef.current = false;
    if (pendingUpdatesRef.current.length > 0) {
      const updates = [...pendingUpdatesRef.current];
      pendingUpdatesRef.current = [];
      // Apply all pending updates
      updates.forEach(update => {
        setFormDataState(prev => applyFormDataUpdate(prev, update));
      });
    }
  });

  // Mark that we're rendering (this runs on every render)
  isRenderingRef.current = true;

  // Create setFormData function that handles various input types
  // Defers updates that happen during render to avoid React warnings
  const setFormData = useCallback((updater: any) => {
    // Debug: log when setFormData is called
    console.log('[setFormData] called', typeof updater);

    // If called during render, defer the update to after render
    if (isRenderingRef.current) {
      console.log('[setFormData] deferred (during render)');
      pendingUpdatesRef.current.push(updater);
      return;
    }

    setFormDataState(prev => applyFormDataUpdate(prev, updater));
  }, []);

  // Update global references
  React.useEffect(() => {
    currentFormData = formData;
    globalSetFormData = setFormData;
    return () => {
      globalSetFormData = null;
    };
  }, [formData, setFormData]);

  const contextValue = useMemo(() => ({
    formData,
    setFormData,
  }), [formData, setFormData]);

  return React.createElement(
    FormStateContext.Provider,
    { value: contextValue },
    children
  );
};

/**
 * Custom useActiveData that matches mois-form-tester pattern exactly.
 *
 * Returns [formDataWithSetter, setFormData] where:
 * - formDataWithSetter has setFormData attached so forms can use fd.setFormData(...)
 * - setFormData accepts either an immer updater function or a partial object
 */
export const useActiveDataForForms = (selector?: (data: any) => any): [any, (updater: any) => void] => {
  const context = useContext(FormStateContext);

  // Fallback for when used outside of FormStateProvider
  if (!context) {
    console.warn('useActiveDataForForms: No FormStateProvider found, state updates will not work');
    const emptyData = {
      field: { data: {}, status: {} },
      uiState: { sections: {} },
      setFormData: () => { console.log('[useActiveDataForForms] FALLBACK setFormData called - this is a no-op!'); },
    };
    return [emptyData, () => { console.log('[useActiveDataForForms] FALLBACK setter called - this is a no-op!'); }];
  }

  const { formData, setFormData } = context;

  // Attach setFormData to formData so forms can use fd.setFormData
  const formDataWithSetter = useMemo(() => ({
    ...formData,
    setFormData,
  }), [formData, setFormData]);

  if (selector) {
    return [
      selector(formData),
      (updates: any) => {
        setFormData(produce((draft: any) => {
          const target = selector(draft);
          Object.assign(target, updates);
        }));
      }
    ];
  }

  // Debug: Create a wrapped setter to trace calls
  const wrappedSetFormData = (updater: any) => {
    console.log('[useActiveDataForForms] setFd called with', typeof updater);
    setFormData(updater);
  };

  return [formDataWithSetter, wrappedSetFormData];
};

/**
 * Get the current form data (for use outside of React components)
 */
export const getFormData = () => currentFormData;
