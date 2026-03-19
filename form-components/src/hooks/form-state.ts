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
  uiState: { sections: Record<string, any> | Array<any>; [key: string]: any };
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

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizeFormData = (input?: Partial<FormDataState> | null): FormDataState => {
  const field = input?.field && typeof input.field === 'object' ? input.field : {};
  const uiState = input?.uiState && typeof input.uiState === 'object' ? input.uiState : {};
  const sections = (uiState as any).sections ?? [{ isComplete: false }];

  return {
    field: {
      data: deepClone((field as any).data || {}),
      status: deepClone((field as any).status || {}),
    },
    uiState: {
      ...deepClone(uiState),
      sections: deepClone(sections),
    },
    tempArea: deepClone(input?.tempArea || {}),
  };
};

const getOverrideFormStateContext = () => {
  if (typeof globalThis === 'undefined') return null;
  const maybeContext = (globalThis as any).__MOIS_FORM_STATE_CONTEXT__;
  if (!maybeContext || typeof maybeContext !== 'object') return null;
  if (!('Provider' in maybeContext) || !('Consumer' in maybeContext)) return null;
  return maybeContext as typeof FormStateContext;
};

const DEFAULT_FORM_STATE: Partial<FormDataState> = {
  field: { data: {}, status: {} },
  // Keep a stable default reference so provider rerenders do not wipe form state.
  uiState: { sections: [{ isComplete: false }] },
};

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
    globalSetFormData(normalizeFormData({
      field: { data: {}, status: {} },
      uiState: { sections: {} },
    }));
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

  // Preserve no-op immer updates so derived effects can short-circuit correctly.
  if (newState === prevState) {
    return prevState;
  }

  // Keep state unfrozen because some legacy NHForms components still mutate
  // nested values before committing them back through setFormData.
  return deepClone(newState);
};

/**
 * Form State Provider - wraps forms to provide state context
 */
const BaseFormStateProvider = ({
  children,
  initialFormData,
  registerGlobally,
}: {
  children: React.ReactNode;
  initialFormData?: Partial<FormDataState>;
  registerGlobally: boolean;
}) => {
  const [formData, setFormDataState] = useState<FormDataState>(() => normalizeFormData(initialFormData));

  // Track if we're currently in a render phase to defer setState calls during render
  const isRenderingRef = React.useRef(false);
  const pendingUpdatesRef = React.useRef<any[]>([]);

  React.useLayoutEffect(() => {
    isRenderingRef.current = false;
  });

  // Process any pending updates that were queued during render.
  React.useEffect(() => {
    if (pendingUpdatesRef.current.length > 0) {
      const updates = [...pendingUpdatesRef.current];
      pendingUpdatesRef.current = [];
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
    // If called during render, defer the update to after render
    if (isRenderingRef.current) {
      pendingUpdatesRef.current.push(updater);
      return;
    }

    setFormDataState(prev => applyFormDataUpdate(prev, updater));
  }, []);

  React.useEffect(() => {
    if (!initialFormData) return;
    setFormDataState(normalizeFormData(initialFormData));
  }, [initialFormData]);

  // Update global references
  React.useEffect(() => {
    if (!registerGlobally) return;
    currentFormData = formData;
    globalSetFormData = setFormData;
    return () => {
      globalSetFormData = null;
    };
  }, [formData, registerGlobally, setFormData]);

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

export const FormStateProvider = ({ children }: { children: React.ReactNode }) => React.createElement(
  BaseFormStateProvider,
  {
    registerGlobally: true,
    children,
    initialFormData: DEFAULT_FORM_STATE,
  }
);

export const LocalFormStateProvider = ({
  children,
  initialFormData,
}: {
  children: React.ReactNode;
  initialFormData?: Partial<FormDataState>;
}) => React.createElement(
  BaseFormStateProvider,
  { registerGlobally: false, initialFormData, children }
);

/**
 * Custom useActiveData that matches mois-form-tester pattern exactly.
 *
 * Returns [formDataWithSetter, setFormData] where:
 * - formDataWithSetter has setFormData attached so forms can use fd.setFormData(...)
 * - setFormData accepts either an immer updater function or a partial object
 */
export const useActiveDataForForms = (selector?: (data: any) => any): [any, (updater: any) => void] => {
  const overrideContextObject = getOverrideFormStateContext();
  const overrideContextValue = useContext(overrideContextObject || FormStateContext);
  const defaultContextValue = useContext(FormStateContext);
  const context = overrideContextObject ? (overrideContextValue || defaultContextValue) : defaultContextValue;

  // Fallback for when used outside of FormStateProvider
  if (!context) {
    console.warn('useActiveDataForForms: No FormStateProvider found, state updates will not work');
    const emptyData = {
      field: { data: {}, status: {} },
      uiState: { sections: {} },
      setFormData: () => {},
    };
    return [emptyData, () => {}];
  }

  const { formData, setFormData } = context;
  const normalizedFormData = useMemo(() => ({
    ...formData,
    field: formData.field || { data: {}, status: {} },
    uiState: {
      ...(formData.uiState || {}),
      sections: formData.uiState?.sections ?? {},
    },
  }), [formData]);

  // Attach setFormData to formData so forms can use fd.setFormData
  const formDataWithSetter = useMemo(() => ({
    ...normalizedFormData,
    setFormData,
  }), [normalizedFormData, setFormData]);

  if (selector) {
    return [
      selector(normalizedFormData),
      (updates: any) => {
        setFormData(produce((draft: any) => {
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
export const getFormData = () => currentFormData;
