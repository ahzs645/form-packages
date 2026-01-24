/**
 * Common Types for MOIS Form Components
 */

import { ReactNode, CSSProperties } from 'react';

/**
 * Base props for layout components
 */
export interface LayoutProps {
  /** Child elements */
  children?: ReactNode;
  /** Additional CSS styles */
  style?: CSSProperties;
  /** Additional CSS class name */
  className?: string;
  /** Whether the component is hidden */
  hidden?: boolean;
}

/**
 * Common props for form field components
 */
export interface FieldProps {
  /** Field name/key */
  name?: string;
  /** Field label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Error message */
  errorMessage?: string;
}
