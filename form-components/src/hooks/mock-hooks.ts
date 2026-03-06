/**
 * Mock Hooks for Forms
 *
 * Provides mock implementations of MOIS hooks that forms expect.
 * These hooks are used when rendering forms in the Playground/CodePreview.
 */

import React from 'react';
// Import directly from MoisContext to avoid circular dependency through lib/index
import { useSourceData } from '../context/MoisContext';
import { useActiveDataForForms } from './form-state';
// Import the proper useMutation from the API module
import { useMutation as useMutationImpl } from './api';

/**
 * useOnLoad - Called when a form loads
 * Passes sourceData and formData (with setFormData) to the callback
 */
export const useOnLoad = (callback?: (sourceData: any, formData: any) => void) => {
  const sourceData = useSourceData();
  const [formData, setFormData] = useActiveDataForForms();

  React.useEffect(() => {
    if (formData && typeof callback === 'function') {
      callback(sourceData, { ...formData, setFormData });
    }
  }, []);
};

/**
 * useOnRefresh - Called when form data should be refreshed
 */
export const useOnRefresh = (callback?: (sourceData: any, formData: any) => void) => {
  const sourceData = useSourceData();
  const [formData] = useActiveDataForForms();

  React.useEffect(() => {
    if (typeof callback === 'function') {
      callback(sourceData, formData);
    }
  }, []);
};

/**
 * usePrinting - Returns printing state
 */
export const usePrinting = () => ({ isPrinting: false, printOptions: {} });

/**
 * useMutation - GraphQL mutation hook
 * Uses the proper mock implementation from the API module
 */
export const useMutation = useMutationImpl;

/**
 * useQuery - GraphQL query hook
 * Returns sourceData.queryResult as query data so forms get mock data in preview mode.
 * Returns [data, refetch] tuple to match the MOIS useQuery API.
 */
export const useQuery = (_query?: string, _variables?: any): [any, () => void] => {
  const sourceData = useSourceData();
  const refetch = React.useCallback(() => {
    console.log('[Mock useQuery] refetch called');
  }, []);
  return [sourceData.queryResult || {}, refetch];
};

/**
 * useFormLock - Lock management for forms
 */
export const useFormLock = () => {};

/**
 * testLock - Test if a lock is active
 */
export const testLock = () => false;

/**
 * useHotKey - Register keyboard shortcuts
 */
export const useHotKey = () => {};

/**
 * useMoisNavigate - Navigation within MOIS
 * Returns a function that navigates to the specified target
 */
export const useMoisNavigate = (moisModule?: string) => {
  return (target?: { objectType: string; objectId: number }) => {
    if (target) {
      console.log(`Mois.navigate to ${target.objectType} with id ${target.objectId}`);
    } else if (moisModule) {
      console.log(`Mois.navigate to module: ${moisModule}`);
    }
  };
};

/**
 * useSetting - Get a setting value with default
 */
export const useSetting = (_section: string, _key: string, defaultValue: any) => defaultValue;

/**
 * useTempData - Temporary data storage for a form
 */
export const useTempData = (_key: string, initial: any) => {
  const [data, setData] = React.useState(initial);
  return [data, setData];
};

/**
 * useConfirmUnload - Confirm before leaving page with unsaved changes
 */
export const useConfirmUnload = () => {};
