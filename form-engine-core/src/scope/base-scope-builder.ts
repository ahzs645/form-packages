/**
 * Base Scope Builder
 *
 * Extensible scope builder for creating runtime execution scopes.
 * Extend this class to create domain-specific scope builders.
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useReducer,
  useContext,
  useLayoutEffect,
  useImperativeHandle,
  useDebugValue,
  Fragment,
  createElement,
  cloneElement,
  createContext,
  forwardRef,
  memo,
  lazy,
  Suspense,
} from 'react';
import type { ScopeConfig, ScopeBuilder } from './types';

/**
 * Default JavaScript globals to expose in scope
 */
const defaultGlobals: Record<string, any> = {
  // Core objects
  Object,
  Array,
  String,
  Number,
  Boolean,
  Symbol,
  BigInt,
  Math,
  Date,
  RegExp,
  Error,
  TypeError,
  RangeError,
  JSON,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Promise,
  Proxy,
  Reflect,

  // Array methods and utilities
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURI,
  decodeURI,
  encodeURIComponent,
  decodeURIComponent,

  // Console for debugging
  console,

  // Timers
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,

  // Browser globals (for DOM access in forms)
  document: typeof document !== 'undefined' ? document : undefined,
  window: typeof window !== 'undefined' ? window : undefined,

  // Common constants
  undefined,
  NaN,
  Infinity,
};

/**
 * Get React hooks from React instance
 */
const getReactHooks = (reactInstance: typeof React) => ({
  useState: reactInstance.useState,
  useEffect: reactInstance.useEffect,
  useMemo: reactInstance.useMemo,
  useCallback: reactInstance.useCallback,
  useRef: reactInstance.useRef,
  useReducer: reactInstance.useReducer,
  useContext: reactInstance.useContext,
  useLayoutEffect: reactInstance.useLayoutEffect,
  useImperativeHandle: reactInstance.useImperativeHandle,
  useDebugValue: reactInstance.useDebugValue,
});

/**
 * Default empty scope configuration
 */
const defaultConfig: ScopeConfig = {
  react: React,
  uiComponents: {},
  hooks: {},
  namespaces: {},
  components: {},
  utilities: {},
  globals: defaultGlobals,
};

/**
 * Base scope builder class
 *
 * Provides the foundation for creating execution scopes.
 * Extend this class and override the constructor to add domain-specific components.
 *
 * @example
 * ```typescript
 * class MoisScopeBuilder extends BaseScopeBuilder {
 *   constructor() {
 *     super({
 *       uiComponents: FluentNamespace,
 *       hooks: { useSourceData, useActiveData },
 *       namespaces: { Mois, Pe },
 *       components: { Section, Header },
 *     });
 *   }
 * }
 * ```
 */
export class BaseScopeBuilder implements ScopeBuilder {
  protected config: ScopeConfig;

  constructor(config: Partial<ScopeConfig> = {}) {
    this.config = {
      ...defaultConfig,
      ...config,
      // Deep merge nested objects
      uiComponents: { ...defaultConfig.uiComponents, ...config.uiComponents },
      hooks: { ...defaultConfig.hooks, ...config.hooks },
      namespaces: { ...defaultConfig.namespaces, ...config.namespaces },
      components: { ...defaultConfig.components, ...config.components },
      utilities: { ...defaultConfig.utilities, ...config.utilities },
      globals: { ...defaultConfig.globals, ...config.globals },
    };
  }

  /**
   * Build the complete scope object for form execution
   */
  buildScope(): Record<string, any> {
    const { react, uiComponents, hooks, namespaces, components, utilities, globals } = this.config;

    return {
      // React core
      React: react,
      ...getReactHooks(react),

      // React utilities
      Fragment,
      createElement,
      cloneElement,
      createContext,
      forwardRef,
      memo,
      lazy,
      Suspense,

      // UI components
      ...uiComponents,

      // Hooks
      ...hooks,

      // Namespaces
      ...namespaces,

      // Components
      ...components,

      // Utilities
      ...utilities,

      // Globals
      ...globals,
    };
  }

  /**
   * Extend the scope with additional configuration
   */
  extend(config: Partial<ScopeConfig>): ScopeBuilder {
    return new BaseScopeBuilder({
      ...this.config,
      uiComponents: { ...this.config.uiComponents, ...config.uiComponents },
      hooks: { ...this.config.hooks, ...config.hooks },
      namespaces: { ...this.config.namespaces, ...config.namespaces },
      components: { ...this.config.components, ...config.components },
      utilities: { ...this.config.utilities, ...config.utilities },
      globals: { ...this.config.globals, ...config.globals },
    });
  }

  /**
   * Get the current scope configuration
   */
  getConfig(): ScopeConfig {
    return { ...this.config };
  }
}
