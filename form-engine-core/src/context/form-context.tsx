/**
 * Generic Form Context
 *
 * Provides a base form context that can be extended for specific domains.
 */

import React, { createContext, useContext, useCallback } from 'react';
import { produce } from 'immer';
import type { FormData, FormDataSetter } from '../state/types';
import type { FormContextValue, FormProviderProps } from './types';

/**
 * Default form data structure
 */
const defaultFormData: FormData = {
  field: { data: {}, status: {} },
  uiState: { sections: {} },
};

/**
 * Create a form context with optional typed source data
 */
export function createFormContext<TSource = any>() {
  const SourceDataContext = createContext<TSource | undefined>(undefined);
  const FormDataContext = createContext<{
    formData: FormData;
    setFormData: FormDataSetter;
    resetForm: () => void;
  } | undefined>(undefined);

  /**
   * Form provider component
   */
  const FormProvider: React.FC<FormProviderProps<TSource>> = ({
    children,
    sourceData,
    initialFormData,
  }) => {
    const [formData, setFormDataState] = React.useState<FormData>(() => ({
      ...defaultFormData,
      ...initialFormData,
      field: {
        data: { ...defaultFormData.field.data, ...initialFormData?.field?.data },
        status: { ...defaultFormData.field.status, ...initialFormData?.field?.status },
      },
      uiState: {
        sections: { ...defaultFormData.uiState.sections, ...initialFormData?.uiState?.sections },
      },
    }));

    const setFormData = useCallback<FormDataSetter>((updater) => {
      if (typeof updater === 'function') {
        setFormDataState(current => {
          try {
            const result = updater(current);
            if (result !== undefined && typeof result === 'object') {
              return result as FormData;
            }
            return produce(current, updater);
          } catch {
            return produce(current, updater);
          }
        });
      } else {
        setFormDataState(current => ({ ...current, ...updater }));
      }
    }, []);

    const resetForm = useCallback(() => {
      setFormDataState({
        ...defaultFormData,
        ...initialFormData,
      });
    }, [initialFormData]);

    return (
      <SourceDataContext.Provider value={sourceData as TSource}>
        <FormDataContext.Provider value={{ formData, setFormData, resetForm }}>
          {children}
        </FormDataContext.Provider>
      </SourceDataContext.Provider>
    );
  };

  /**
   * Hook to access source data
   */
  const useSourceData = (): TSource => {
    const context = useContext(SourceDataContext);
    if (context === undefined) {
      throw new Error('useSourceData must be used within a FormProvider');
    }
    return context;
  };

  /**
   * Hook to access form data
   */
  const useFormData = (): FormContextValue<TSource> => {
    const sourceData = useContext(SourceDataContext);
    const formContext = useContext(FormDataContext);

    if (formContext === undefined) {
      throw new Error('useFormData must be used within a FormProvider');
    }

    return {
      sourceData: sourceData as TSource,
      formData: formContext.formData,
      setFormData: formContext.setFormData,
      resetForm: formContext.resetForm,
    };
  };

  return {
    FormProvider,
    useSourceData,
    useFormData,
    SourceDataContext,
    FormDataContext,
  };
}

// Default form context for simple use cases
const defaultContext = createFormContext<any>();
export const FormProvider = defaultContext.FormProvider;
export const useSourceData = defaultContext.useSourceData;
export const useFormData = defaultContext.useFormData;
