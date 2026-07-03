/**
 * Form State Management
 *
 * Provides form data state for useActiveData in forms using React Context.
 * This matches the mois-form-tester pattern for form state management.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { produce, setAutoFreeze } from 'immer';
import { normalizeAuthorshipStore, syncAuthorshipMirrors } from '../authorship';
import { warnIfRenderPhaseWrite } from '../runtime/render-write-tripwire';

// ============================================================================
// Types
// ============================================================================

export interface FormDataState {
  field: { data: Record<string, any>; status: Record<string, any> };
  uiState: { sections: Record<string, any> | Array<any>; [key: string]: any };
  tempArea?: Record<string, any>;
  formData: Record<string, any>;
}

interface FormStateStore {
  getFormData: () => FormDataState;
  subscribe: (listener: () => void) => () => void;
  setFormData: (updater: any) => void;
}

// Our provider publishes a STABLE store object so consumers subscribe to state
// changes via useSyncExternalStore instead of context-value identity. This lets
// selector-based consumers skip re-renders when their slice didn't change.
// External override contexts (e.g. the eval'd FormSessionRuntime component)
// still provide the legacy changing {formData, setFormData} value — the hooks
// below handle both shapes.
interface FormStateContextValue {
  formData?: FormDataState;
  setFormData: (updater: any) => void;
  store?: FormStateStore;
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
  formData: {},
};

// Global setter reference (set by FormStateProvider)
let globalSetFormData: ((updater: any) => void) | null = null;

// Some legacy NHForms components still mutate nested values in place before
// committing them back through setFormData, so produced state must stay
// unfrozen. This used to be a side effect of deep-cloning every update in
// applyFormDataUpdate; the clone is gone for performance, so freezing has to
// be disabled explicitly.
setAutoFreeze(false);

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizeFormData = (input?: Partial<FormDataState> | null): FormDataState => {
  const field = input?.field && typeof input.field === 'object' ? input.field : {};
  const uiState = input?.uiState && typeof input.uiState === 'object' ? input.uiState : {};
  const sections = (uiState as any).sections ?? [{ isComplete: false }];
  const fieldData = deepClone((field as any).data || {});
  const currentFormData = input?.formData && typeof input.formData === 'object' ? input.formData : {};
  const mergedFormData = {
    ...deepClone(currentFormData),
    ...fieldData,
    __authorship: normalizeAuthorshipStore(currentFormData.__authorship ?? fieldData.__authorship),
  };

  return {
    field: {
      data: {
        ...fieldData,
        __authorship: mergedFormData.__authorship,
      },
      status: deepClone((field as any).status || {}),
    },
    uiState: {
      ...deepClone(uiState),
      sections: deepClone(sections),
    },
    tempArea: deepClone(input?.tempArea || {}),
    formData: mergedFormData,
  };
};

// Derived (normalized) view of the form state, cached by state-object identity.
// Every mounted control calls useActiveDataForForms, so without the cache this
// merge (spreads + authorship normalization) re-ran N-consumers × every update —
// it was the single hottest function in production traces. The WeakMap keys on
// the immutable state object from the provider, so one normalized view is built
// per state change and shared by all consumers, including external override
// contexts (e.g. SMOIS) whose providers we don't control.
const normalizedFormDataCache = new WeakMap<object, FormDataState>();

// normalizeAuthorshipStore rebuilds every claim object on each call; caching by
// input identity keeps the derived __authorship reference stable across state
// updates that didn't touch it (immer structural sharing preserves the input
// object), so subscription slices that select authorship claims stay equal.
const EMPTY_AUTHORSHIP_STORE = normalizeAuthorshipStore(undefined);
const authorshipStoreCache = new WeakMap<object, ReturnType<typeof normalizeAuthorshipStore>>();

const getNormalizedAuthorshipStore = (input: any) => {
  if (!input || typeof input !== 'object') return EMPTY_AUTHORSHIP_STORE;
  const cached = authorshipStoreCache.get(input);
  if (cached) return cached;
  const normalized = normalizeAuthorshipStore(input);
  authorshipStoreCache.set(input, normalized);
  return normalized;
};

const getNormalizedFormData = (formData: FormDataState): FormDataState => {
  const cacheable = typeof formData === 'object' && formData !== null;
  if (cacheable) {
    const cached = normalizedFormDataCache.get(formData);
    if (cached) return cached;
  }

  const normalized: FormDataState = {
    ...formData,
    field: formData.field || { data: {}, status: {} },
    uiState: {
      ...(formData.uiState || {}),
      sections: formData.uiState?.sections ?? {},
    },
    formData: {
      ...(formData.formData || {}),
      ...(formData.field?.data || {}),
      __authorship: getNormalizedAuthorshipStore(
        formData.formData?.__authorship ?? formData.field?.data?.__authorship
      ),
    },
  };

  if (cacheable) {
    normalizedFormDataCache.set(formData, normalized);
  }
  return normalized;
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
  formData: {},
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
      formData: {
        ...(prev.formData || {}),
        ...data,
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
      formData: {},
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
    // Plain object - shallow merge. Strip function-valued keys: callers that
    // spread a normalized fd snapshot (`setFormData({...fd, ...})`) would
    // otherwise persist the attached setFormData into state.
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(updater)) {
      if (typeof value !== 'function') sanitized[key] = value;
    }
    newState = { ...prevState, ...sanitized };
  } else {
    return prevState;
  }

  // Preserve no-op immer updates so derived effects can short-circuit correctly.
  if (newState === prevState) {
    return prevState;
  }

  // syncAuthorshipMirrors deep-clones field.data and formData (the slices
  // legacy components mutate in place), so the whole-state deepClone that used
  // to live here was redundant work proportional to the entire form state on
  // every update. State stays unfrozen via setAutoFreeze(false) above.
  return syncAuthorshipMirrors(newState);
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

  const pendingUpdatesRef = React.useRef<any[]>([]);

  // Compose all queued updates onto the latest state in one setState.
  const flushPendingUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0) return;
    const updates = pendingUpdatesRef.current;
    pendingUpdatesRef.current = [];
    setFormDataState(prev => updates.reduce((state, update) => applyFormDataUpdate(state, update), prev));
  }, []);

  // Safety net: drain any pending updates whenever the provider commits.
  React.useEffect(() => {
    flushPendingUpdates();
  });

  // Create setFormData function that handles various input types.
  //
  // Every update is deferred to a microtask, never applied synchronously.
  // Consumers re-render via the store subscription (useSyncExternalStore), NOT
  // as part of the provider's render pass, so a render-phase detection flag on
  // this component cannot see their renders: legacy/eval'd components that call
  // setFormData during render would hit setState-during-render of a foreign
  // component and loop (React #185). Unconditional deferral makes every call
  // safe regardless of caller context; composed no-op updates still bail in
  // applyFormDataUpdate (result === prev), so write-on-render components reach
  // a fixed point. React 18+ batches the microtask flush like any other update.
  const setFormData = useCallback((updater: any) => {
    if (process.env.NODE_ENV !== 'production') {
      warnIfRenderPhaseWrite();
    }
    pendingUpdatesRef.current.push(updater);
    queueMicrotask(flushPendingUpdates);
  }, [flushPendingUpdates]);

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

  // Store bridge: consumers read state via getFormData/subscribe
  // (useSyncExternalStore) rather than a changing context value, so components
  // that select a slice only re-render when that slice changes.
  const formDataRef = React.useRef(formData);
  const listenersRef = React.useRef(new Set<() => void>());
  React.useLayoutEffect(() => {
    formDataRef.current = formData;
    listenersRef.current.forEach((listener) => listener());
  }, [formData]);

  const store = useMemo<FormStateStore>(() => ({
    getFormData: () => formDataRef.current,
    subscribe: (listener: () => void) => {
      listenersRef.current.add(listener);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
    setFormData,
  }), [setFormData]);

  // Deliberately stable across state updates — subscription happens through the
  // store, not context identity.
  const contextValue = useMemo(() => ({
    setFormData,
    store,
  }), [setFormData, store]);

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

const noopSubscribe = () => () => {};
const noopSetFormData = () => {};

const EMPTY_ACTIVE_FORM_DATA: FormDataState = {
  field: { data: {}, status: {} },
  uiState: { sections: {} },
  formData: {},
};

const shallowEqual = (a: any, b: any): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
};

/**
 * Internal: resolve the form-state source and subscribe to it.
 *
 * With our provider (store present), subscription goes through
 * useSyncExternalStore against a stable store, so a `select`-ing consumer only
 * re-renders when its selected slice changes (compared with Object.is, then
 * shallow equality). Without a store (external override contexts like the
 * eval'd FormSessionRuntime provider), the changing context value drives
 * re-renders exactly as before.
 */
const useFormStateSelection = (select?: (data: FormDataState) => any): {
  context: FormStateContextValue | null;
  selection: any;
  setFormData: (updater: any) => void;
} => {
  const overrideContextObject = getOverrideFormStateContext();
  const overrideContextValue = useContext(overrideContextObject || FormStateContext);
  const defaultContextValue = useContext(FormStateContext);
  const context = overrideContextObject ? (overrideContextValue || defaultContextValue) : defaultContextValue;

  const store = context?.store ?? null;

  // Latest-ref pattern so inline selector lambdas don't destabilize the snapshot
  const selectRef = useRef(select);
  selectRef.current = select;
  const lastSelectionRef = useRef<{ value: any } | null>(null);

  const getStoreSelection = () => {
    const normalized = getNormalizedFormData(store!.getFormData());
    const sel = selectRef.current;
    if (!sel) return normalized;
    const next = sel(normalized);
    const prev = lastSelectionRef.current;
    if (prev && (Object.is(prev.value, next) || shallowEqual(prev.value, next))) {
      return prev.value;
    }
    lastSelectionRef.current = { value: next };
    return next;
  };
  const getEmptySelection = () => null;

  const storeSelection = useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? getStoreSelection : getEmptySelection,
    store ? getStoreSelection : getEmptySelection,
  );

  if (!context) {
    return { context: null, selection: undefined, setFormData: noopSetFormData };
  }

  if (store) {
    return { context, selection: storeSelection, setFormData: store.setFormData };
  }

  // Legacy path: changing context value (external override providers)
  const normalized = getNormalizedFormData(context.formData as FormDataState);
  return {
    context,
    selection: select ? select(normalized) : normalized,
    setFormData: context.setFormData,
  };
};

/**
 * Custom useActiveData that matches mois-form-tester pattern exactly.
 *
 * Returns [formDataWithSetter, setFormData] where:
 * - formDataWithSetter has setFormData attached so forms can use fd.setFormData(...)
 * - setFormData accepts either an immer updater function or a partial object
 *
 * With a selector, the component only re-renders when the selected slice
 * changes, and the returned setter writes into the selected slice.
 */
export const useActiveDataForForms = (selector?: (data: any) => any): [any, (updater: any) => void] => {
  const { context, selection, setFormData } = useFormStateSelection(selector);

  // Attach setFormData to formData so forms can use fd.setFormData
  const formDataWithSetter = useMemo(() => (
    selector ? selection : { ...(selection || {}), setFormData }
  ), [selector, selection, setFormData]);

  // Fallback for when used outside of FormStateProvider
  if (!context) {
    console.warn('useActiveDataForForms: No FormStateProvider found, state updates will not work');
    return [{ ...EMPTY_ACTIVE_FORM_DATA, setFormData: noopSetFormData }, noopSetFormData];
  }

  if (selector) {
    return [
      selection,
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
 * Subscribe to a slice of the form state. The component re-renders only when
 * the selected slice changes (Object.is, then shallow equality on the result).
 * Unlike useActiveDataForForms(selector), the returned setter is the plain
 * whole-state setFormData, so existing draft-updater write patterns
 * (`setFormData(draft => writeSectionActiveFieldValue(draft, ...))`) work
 * unchanged.
 */
export const useActiveDataSlice = <T,>(select: (data: FormDataState) => T): [T, (updater: any) => void] => {
  const { context, selection, setFormData } = useFormStateSelection(select);

  if (!context) {
    console.warn('useActiveDataSlice: No FormStateProvider found, state updates will not work');
    return [select(EMPTY_ACTIVE_FORM_DATA), noopSetFormData];
  }

  return [selection as T, setFormData];
};

/**
 * Get the current form data (for use outside of React components)
 */
export const getFormData = () => currentFormData;
