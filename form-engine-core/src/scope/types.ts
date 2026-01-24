/**
 * Scope Types
 *
 * Type definitions for the extensible scope builder pattern.
 */

import type React from 'react';

/**
 * Configuration for building a component execution scope
 */
export interface ScopeConfig {
  /** React library instance */
  react: typeof React;

  /** UI framework components (Fluent, Material, etc.) */
  uiComponents: Record<string, React.ComponentType<any> | any>;

  /** Form-specific hooks (useActiveData, useSourceData, etc.) */
  hooks: Record<string, (...args: any[]) => any>;

  /** Domain namespaces (Mois, Pe, etc.) */
  namespaces: Record<string, any>;

  /** Additional components to include in scope */
  components: Record<string, React.ComponentType<any> | any>;

  /** Utility functions */
  utilities: Record<string, (...args: any[]) => any>;

  /** JavaScript globals to expose (Object, Array, Math, etc.) */
  globals: Record<string, any>;
}

/**
 * Scope builder interface for creating runtime execution scopes
 */
export interface ScopeBuilder {
  /**
   * Build the complete scope object for form execution
   */
  buildScope(): Record<string, any>;

  /**
   * Extend the scope with additional configuration
   */
  extend(config: Partial<ScopeConfig>): ScopeBuilder;

  /**
   * Get the current scope configuration
   */
  getConfig(): ScopeConfig;
}
