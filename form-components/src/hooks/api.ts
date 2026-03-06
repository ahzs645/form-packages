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
}

export interface MutationState<T = any> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

export type MutationResult<T = any> = [
  (variables?: any) => Promise<T>,
  MutationState<T>
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
 * Mock useQuery hook for form preview
 * Returns a tuple [data, refetch] to match MOIS useQuery API.
 * The data is a deep proxy so any property chain access returns safe empty values.
 */
export const useQuery = <T = any>(_query: string, _variables?: any): [T, () => void] => {
  const [, setLoading] = React.useState(false);

  const refetch = React.useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      console.log('[Mock useQuery] refetch called');
    }, 100);
  }, []);

  return [createDeepProxy() as T, refetch];
};

/**
 * Mock useMutation hook for form preview
 * Returns [mutateFunction, { data, loading, error }] like Apollo Client
 */
export const useMutation = <T = any>(_mutation: string): MutationResult<T> => {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<T | undefined>(undefined);

  const mutate = React.useCallback(async (variables?: any): Promise<T> => {
    setLoading(true);
    console.log('[Mock useMutation] called with:', variables);

    return new Promise((resolve) => {
      setTimeout(() => {
        setLoading(false);
        const result = {} as T;
        setData(result);
        resolve(result);
      }, 100);
    });
  }, []);

  // Return as array [mutateFunction, state] like Apollo Client
  return [
    mutate,
    {
      data,
      loading,
      error: undefined,
    },
  ];
};

export default { useQuery, useMutation };
