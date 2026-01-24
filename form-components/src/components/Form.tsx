/**
 * Form Component
 * The Form wrapper. This must be the outermost component of all forms.
 *
 * The form component establishes the context for a form, including the
 * source data, active data, lifecycle management, and session communications.
 */

import React from 'react';
import { Stack } from '@fluentui/react';

/** Lock policy type */
export type LockPolicy = 'document' | 'encounter' | 'patient';

/** Section info for form-wide settings */
export interface SectionInfo {
  readOnlyOptions?: {
    borderless?: boolean;
  };
}

export interface FormProps {
  /** Form contents. There must be at least two controls in the form. */
  children: React.ReactNode;
  /**
   * Lock policy:
   * - "document" will warn when a form is opened for modification twice at the same time
   * - "encounter" will warn if the same form type is created/modified twice on one encounter
   * - "patient" will warn if the same form type is created/modified twice on one patient
   */
  lockPolicy?: LockPolicy;
  /** Max width */
  maxWidth?: string;
  /** Extra bottom padding if there is a sticky element other than Footer */
  paddingBottom?: number;
  /** Extra top padding if there is a sticky element other than Header */
  paddingTop?: number;
  /**
   * Override section settings for the entire form.
   * For backward compatibility, readOnlyOptions.borderless is set to false.
   */
  section?: SectionInfo;
}

/**
 * Form - Root form container
 *
 * The Form control is the wrapper control for a MOIS web form.
 * It contains all other Components.
 */
export const Form: React.FC<FormProps> = ({
  children,
  lockPolicy,
  maxWidth = '950px',
  paddingBottom = 0,
  paddingTop = 0,
  section = { readOnlyOptions: { borderless: false } },
}) => {
  return (
    <div>
      <Stack
        style={{
          maxWidth,
          margin: 'auto',
          paddingTop,
          paddingBottom,
        }}
      >
        {children}
      </Stack>
    </div>
  );
};

export default Form;
