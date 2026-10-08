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

  /** Callback when preview scope has to substitute an unresolved symbol */
  onMissingSymbol?: (symbolName: string) => void;

  /**
   * Callback when the form code cannot be compiled. The returned component
   * still renders the bare message; this carries the stack and the failing
   * line of the generated code so a host can show where it broke.
   */
  onCompileError?: (error: FormCompileError) => void;

  /** File name hint for Babel (affects error messages) */
  filename?: string;
}

/**
 * A form that failed to compile: during the Babel transform, or while
 * evaluating the transformed code (a ReferenceError at top level, say).
 */
export interface FormCompileError {
  phase: 'transform' | 'evaluate';
  message: string;
  stack?: string;
  /** 1-based line in the code the failure points at: the form code for a
   *  transform error, the transformed code for an evaluate error. */
  line?: number;
  column?: number;
  /** A few lines around `line`, with the failing line marked `>`. */
  snippet?: string;
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
