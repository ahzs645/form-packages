/**
 * FormVersion Component
 * Display form version
 */

import React from 'react';
import { Text, ITextProps, IFontStyles } from '@fluentui/react';
import { useSourceData } from '../context/MoisContext';

export interface FormIdentity {
  /** Form name */
  formName?: string;
  /** Form version */
  version?: string;
}

export interface FormVersionProps {
  /** Form identity override */
  formIdentity?: FormIdentity;
  /** Do not show form version when printing */
  noPrint?: boolean;
  /** Override props of Fluent Text control used */
  textProps?: ITextProps;
  /** Size of the text, it follows the variant property from Fluent Text */
  variant?: keyof IFontStyles;
}

export const FormVersion: React.FC<FormVersionProps> = ({
  formIdentity: propFormIdentity,
  noPrint = false,
  textProps,
  variant = 'small',
}) => {
  const sourceData = useSourceData();

  // Get form identity from props or source data
  const webform = (sourceData as any).webform;

  const formName = propFormIdentity?.formName ?? webform?.document?.templateName ?? 'sample_form';
  const version = propFormIdentity?.version ?? webform?.document?.classVersion
    ? `${webform?.document?.classVersion?.major ?? 1}.${webform?.document?.classVersion?.minor ?? 2}.${webform?.document?.classVersion?.patch ?? 3}`
    : '1.2.3';

  // Build display text
  const displayText = formName ? `${formName} ${version}` : version;

  // Container style - right justified
  const containerStyle: React.CSSProperties = {
    display: 'block',
    textAlign: 'right',
    width: '100%',
  };

  return (
    <div style={containerStyle} className={noPrint ? 'no-print' : undefined}>
      <Text
        variant={variant}
        {...textProps}
      >
        {displayText}
      </Text>
    </div>
  );
};

export default FormVersion;
