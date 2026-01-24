/**
 * Transformer Types
 *
 * Type definitions for the code transformation system.
 */

import type React from 'react';
import type { ScopeBuilder } from '../scope/types';

/**
 * Options for code transformation
 */
export interface TransformOptions {
  /** Babel instance for JSX transformation */
  babel: any;

  /** Scope builder to use for execution context */
  scopeBuilder: ScopeBuilder;

  /** Callback when InitialData is extracted from form code */
  onInitialData?: (data: Record<string, any>) => void;

  /** File name hint for Babel (affects error messages) */
  filename?: string;
}

/**
 * Result of code transformation
 */
export interface TransformResult {
  /** The compiled React component */
  component: React.FC;

  /** Any InitialData extracted from the form code */
  initialData?: Record<string, any>;

  /** Warnings generated during transformation */
  warnings: string[];
}

/**
 * Form transformer interface
 */
export interface FormTransformer {
  /**
   * Transform JSX/TSX code string into a React component
   */
  transform(code: string, options: TransformOptions): TransformResult;

  /**
   * Check if code defines a FormComponent (full form vs simple JSX)
   */
  isFormCode(code: string): boolean;
}
