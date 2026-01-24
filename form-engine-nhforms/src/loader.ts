/**
 * NHForms Component Loader
 *
 * Two-pass component loading system for NHForms components.
 * Supports cross-references between components.
 */

import React from 'react';
import type {
  ComponentSource,
  ComponentLoaderConfig,
  ComponentLoaderResult,
  ComponentIdentity,
} from './types';

/**
 * Global registry for loaded components (for cross-references)
 */
let globalRegistry: Record<string, any> = {};

/**
 * Get the global component registry
 */
export const getRegistry = (): Record<string, any> => ({ ...globalRegistry });

/**
 * Clear the global registry
 */
export const clearRegistry = (): void => {
  globalRegistry = {};
};

/**
 * Load a single component from source code
 */
const loadComponent = (
  source: ComponentSource,
  babel: any,
  scope: Record<string, any>,
  registry: Record<string, any>
): { exports: Record<string, any>; error?: Error } => {
  try {
    // Transform JSX to JavaScript
    const transformed = babel.transform(source.code, {
      presets: ['react', 'typescript'],
      filename: `${source.name}.tsx`,
    }).code;

    // Create scope with registry for cross-references
    const fullScope = {
      ...scope,
      ...registry,
    };

    // Create a proxy for undefined properties
    const createPlaceholder = (name: string): any => {
      const PlaceholderComponent: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
        React.createElement('div', { 'data-missing': name, style: { display: 'contents' } }, children);
      PlaceholderComponent.displayName = `Placeholder_${name}`;
      return PlaceholderComponent;
    };

    const scopeProxy = new Proxy(fullScope, {
      get(target, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop in target) return target[prop as string];
        return createPlaceholder(String(prop));
      },
      set(target, prop, value) {
        if (typeof prop === 'string') {
          (target as any)[prop] = value;
        }
        return true;
      },
      has(_target, prop) {
        if (typeof prop === 'symbol') return false;
        return true;
      },
    });

    // Execute the component code
    // eslint-disable-next-line no-new-func
    const fn = new Function('__scope__', `
      with (__scope__) {
        ${transformed}
        // Return all defined exports
        const exports = {};
        try { if (typeof ${source.name} !== 'undefined') exports['${source.name}'] = ${source.name}; } catch {}
        // Also check for common export patterns
        try { if (typeof default_ !== 'undefined') exports['default'] = default_; } catch {}
        return exports;
      }
    `);

    const exports = fn(scopeProxy);
    return { exports };
  } catch (error: any) {
    return { exports: {}, error };
  }
};

/**
 * Load NHForms components with two-pass loading for cross-references
 *
 * @param sources - Array of component sources to load
 * @param config - Loader configuration
 * @returns Loaded components and any errors
 *
 * @example
 * ```typescript
 * const sources = [
 *   { name: 'Scale5', code: scale5Code },
 *   { name: 'HonosQuestion', code: honosCode },
 * ];
 *
 * const { components, errors } = loadNHFormsComponents(sources, {
 *   babel: Babel,
 *   scopeBuilder: new MoisScopeBuilder(),
 * });
 * ```
 */
export const loadNHFormsComponents = (
  sources: ComponentSource[],
  config: ComponentLoaderConfig
): ComponentLoaderResult => {
  const { scopeBuilder, babel, enableCrossReferences = true, additionalScope = {} } = config;

  const baseScope = {
    ...scopeBuilder.buildScope(),
    ...additionalScope,
  };

  const components: Record<string, any> = {};
  const errors: Array<{ name: string; error: Error }> = [];
  const metadata: Record<string, ComponentIdentity> = {};

  // Store metadata
  for (const source of sources) {
    if (source.identity) {
      metadata[source.name] = source.identity;
    }
  }

  // Pass 1: Load all components independently
  for (const source of sources) {
    const result = loadComponent(source, babel, baseScope, {});
    if (result.error) {
      errors.push({ name: source.name, error: result.error });
    } else {
      Object.assign(components, result.exports);
    }
  }

  // Update global registry
  globalRegistry = { ...globalRegistry, ...components };

  // Pass 2: Re-load with cross-references (if enabled)
  if (enableCrossReferences) {
    for (const source of sources) {
      const result = loadComponent(source, babel, baseScope, components);
      if (result.error) {
        // Only add error if it wasn't already added in pass 1
        if (!errors.find(e => e.name === source.name)) {
          errors.push({ name: source.name, error: result.error });
        }
      } else {
        Object.assign(components, result.exports);
      }
    }

    // Update global registry with final components
    globalRegistry = { ...globalRegistry, ...components };
  }

  return { components, errors, metadata };
};

/**
 * Load a single NHForms component
 *
 * @param source - Component source to load
 * @param config - Loader configuration
 * @returns Component exports and any error
 */
export const loadSingleComponent = (
  source: ComponentSource,
  config: ComponentLoaderConfig
): { exports: Record<string, any>; error?: Error } => {
  const { scopeBuilder, babel, additionalScope = {} } = config;

  const scope = {
    ...scopeBuilder.buildScope(),
    ...additionalScope,
    ...globalRegistry,
  };

  return loadComponent(source, babel, scope, globalRegistry);
};
