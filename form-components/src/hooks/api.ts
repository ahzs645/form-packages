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
 * Mock useQuery hook for form preview
 */
export const useQuery = <T = any>(_query: string, _variables?: any): QueryResult<T> => {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<T | undefined>(undefined);

  const refetch = React.useCallback(() => {
    setLoading(true);
    // Simulate async operation
    setTimeout(() => {
      setLoading(false);
      console.log('[Mock useQuery] refetch called');
    }, 100);
  }, []);

  return {
    data,
    loading,
    error: undefined,
    refetch,
  };
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
