/**
 * NHForms Types
 *
 * Type definitions for the NHForms component loader.
 */

import type React from 'react';
import type { ScopeBuilder } from '@mois/form-engine-core';

/**
 * Component source definition
 */
export interface ComponentSource {
  /** Component name (folder name) */
  name: string;

  /** JSX source code */
  code: string;

  /** Optional identity metadata */
  identity?: ComponentIdentity;
}

/**
 * Component identity metadata (from Identity.json)
 */
export interface ComponentIdentity {
  name: string;
  title: string;
  description?: string;
  version?: { major: number; minor: number; patch: number };
  type?: string;
  owner?: string;
  author?: string;
  publisher?: string;
  components?: string[];
  requiredFormViewerVersion?: { major: number; minor: number; patch: number };
  requiredMoisVersion?: { major: number; minor: number; patch: number };
}

/**
 * Component loader configuration
 */
export interface ComponentLoaderConfig {
  /** Scope builder for executing component code */
  scopeBuilder: ScopeBuilder;

  /** Babel instance for transformation */
  babel: any;

  /** Enable two-pass loading for cross-references (default: true) */
  enableCrossReferences?: boolean;

  /** Additional scope items to include */
  additionalScope?: Record<string, any>;
}

/**
 * Component loader result
 */
export interface ComponentLoaderResult {
  /** Loaded components keyed by name */
  components: Record<string, React.ComponentType<any> | any>;

  /** Errors encountered during loading */
  errors: Array<{ name: string; error: Error }>;

  /** Component metadata */
  metadata: Record<string, ComponentIdentity>;
}
