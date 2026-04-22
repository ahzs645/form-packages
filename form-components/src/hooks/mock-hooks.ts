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
import { useMutation as useMutationImpl, type QueryTuple } from './api';
import {
  emitMoisNavigateEvent,
  registerMoisFormLock,
  releaseMoisFormLock,
  testMoisFormLock,
} from '../runtime/mois-contract';

/**
 * useOnLoad - Called when a form loads
 * Passes sourceData and formData (with setFormData) to the callback
 */
export const useOnLoad = (callback?: (sourceData: any, formData: any) => void) => {
  const sourceData = useSourceData();
  const [formData, setFormData] = useActiveDataForForms();
  const callbackRef = React.useRef(callback);
  const formDataRef = React.useRef(formData);

  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  React.useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  React.useEffect(() => {
    if (typeof callbackRef.current === 'function') {
      callbackRef.current(sourceData, { ...formDataRef.current, setFormData });
    }
  }, [sourceData, setFormData]);
};

/**
 * useOnRefresh - Called when form data should be refreshed
 */
export const useOnRefresh = (callback?: (sourceData: any, formData: any) => void) => {
  const sourceData = useSourceData();
  const [formData, setFormData] = useActiveDataForForms();
  const callbackRef = React.useRef(callback);
  const formDataRef = React.useRef(formData);

  React.useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  React.useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  React.useEffect(() => {
    if (typeof callbackRef.current === 'function') {
      callbackRef.current(sourceData, { ...formDataRef.current, setFormData });
    }
  }, [sourceData, setFormData]);
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
 * Shimmed MOIS returns [queryResult, status, reload].
 */
export const useQuery = (_query?: string, _variables?: any): QueryTuple<any> => {
  const sourceData = useSourceData();
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState('ready');
  const reload = React.useCallback(() => {
    setLoading(true);
    setStatus('loading');
    console.log('[Mock useQuery] refetch called');
    setTimeout(() => {
      setLoading(false);
      setStatus('ready');
    }, 100);
  }, []);
  return [
    sourceData.queryResult || {},
    { loading, error: undefined, status },
    reload,
  ];
};

/**
 * useFormLock - Lock management for forms
 */
export const useFormLock = (lockPolicy?: any) => {
  const lockPolicyRef = React.useRef(lockPolicy);
  const lockName = lockPolicy?.name;

  React.useEffect(() => {
    lockPolicyRef.current = lockPolicy;
  }, [lockPolicy]);

  React.useEffect(() => {
    if (!lockPolicy) return undefined;

    registerMoisFormLock(lockPolicy, 'useFormLock');

    return () => {
      releaseMoisFormLock(lockPolicyRef.current?.scope ?? lockPolicy.scope, 'useFormLock');
    };
  }, [lockName]);

  return "";
};

/**
 * testLock - Test if a lock is active
 */
export const testLock = (lockOrScope?: any) => testMoisFormLock(lockOrScope);

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
    const detail = target
      ? { action: 'navigate-record', target, moisModule: moisModule ?? null }
      : { action: 'navigate-module', moisModule: moisModule ?? null };
    emitMoisNavigateEvent(detail);
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
