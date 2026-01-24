/**
 * Title Component
 * Large title, generally used to show form's title
 */

import React from 'react';
import { Text, IFontStyles } from '@fluentui/react';
import { useTheme } from '../context/MoisContext';

export interface TitleProps {
  /** The title is in the body of the control */
  children?: string | React.ReactElement | (string | React.ReactElement)[];
  /** Alternative title location */
  label?: string | React.ReactElement | (string | React.ReactElement)[];
  /** Props for the contained Text control */
  textProps?: any;
  /** Size of the text, it follows the variant property from Fluent Text. */
  variant?: keyof IFontStyles;
}

/**
 * Title - Large title, generally used to show form's title
 */
export const Title: React.FC<TitleProps> = ({
  children,
  label,
  textProps,
  variant = 'large',
}) => {
  const theme = useTheme();
  const content = label ?? children;

  return (
    <Text
      variant={variant}
      styles={theme.mois.titleStyles}
      {...textProps}
    >
      <b>{content}</b>
    </Text>
  );
};

/**
 * TitleDemo1 - Typical use
 */
export const TitleDemo1: React.FC = () => {
  return (
    <Title>Lorem Ipsum Dolor Sit Amet</Title>
  );
};

export default Title;
