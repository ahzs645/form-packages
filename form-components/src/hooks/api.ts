/**
 * Mock API Module
 * Provides stub implementations of useQuery and useMutation for form preview
 */

import React from 'react';

export interface QueryResult<T = any> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
  status: string;
}

export interface MutationState<T = any> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  status: string;
}

export interface MoisQueryStatus {
  loading: boolean;
  error: Error | undefined;
  status: string;
}

export interface MoisMutationStatus {
  loading: boolean;
  error: Error | undefined;
  status: string;
}

export type QueryTuple<T = any> = [T, MoisQueryStatus, () => void];

export type MutationResult<T = any> = [
  (variables?: any) => Promise<T>,
  T | undefined,
  MoisMutationStatus
];

/**
 * Creates a proxy that returns empty values for any property access,
 * preventing crashes when form code accesses nested query data that doesn't exist.
 */
const createDeepProxy = (): any => {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (typeof prop === 'symbol') {
        if (prop === Symbol.toPrimitive) return () => '';
        if (prop === Symbol.iterator) return [][Symbol.iterator];
        return undefined;
      }
      if (prop === 'toString' || prop === 'valueOf') return () => '';
      if (prop === 'length') return 0;
      // Array methods that return arrays
      if (prop === 'map' || prop === 'filter' || prop === 'slice' ||
          prop === 'concat' || prop === 'flatMap') {
        return () => [];
      }
      // Array methods that return single values - return proxy to prevent crashes
      if (prop === 'find' || prop === 'reduce') return () => createDeepProxy();
      // Array methods that return booleans/numbers
      if (prop === 'some' || prop === 'includes') return () => false;
      if (prop === 'every') return () => true;
      if (prop === 'indexOf') return () => -1;
      if (prop === 'forEach') return () => {};
      // Object.keys support
      if (prop === 'keys') return () => [];
      if (prop === 'entries') return () => [];
      if (prop === 'values') return () => [];
      return createDeepProxy();
    },
  };
  return new Proxy({}, handler);
};

/**
 * Mock useQuery hook for form preview.
 * Shimmed MOIS returns [queryResult, status, reload].
 * The data is a deep proxy so any property chain access returns safe empty values.
 */
export const useQuery = <T = any>(_query: string, _variables?: any): QueryTuple<T> => {
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState('ready');

  const reload = React.useCallback(() => {
    setLoading(true);
    setStatus('loading');
    setTimeout(() => {
      setLoading(false);
      setStatus('ready');
      console.log('[Mock useQuery] refetch called');
    }, 100);
  }, []);

  return [
    createDeepProxy() as T,
    { loading, error: undefined, status },
    reload,
  ];
};

/**
 * Mock useMutation hook for form preview
 * Shimmed MOIS returns [mutateFunction, queryResult, status].
 */
export const useMutation = <T = any>(_mutation: string): MutationResult<T> => {
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState('ready');
  const [data, setData] = React.useState<T | undefined>(undefined);

  const mutate = React.useCallback(async (variables?: any): Promise<T> => {
    setLoading(true);
    setStatus('loading');
    console.log('[Mock useMutation] called with:', variables);

    return new Promise((resolve) => {
      setTimeout(() => {
        setLoading(false);
        setStatus('ready');
        const result = {} as T;
        setData(result);
        resolve(result);
      }, 100);
    });
  }, []);

  return [
    mutate,
    data,
    {
      loading,
      error: undefined,
      status,
    },
  ];
};

export default { useQuery, useMutation };
