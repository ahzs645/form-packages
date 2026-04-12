/**
 * Heading Component
 * Heading component. This is less prominent than a subtitle.
 */

import React, { Children } from 'react';
import { Stack, Label } from '@fluentui/react';
import { LinkToMois } from '../components/LinkToMois';

export interface HeadingProps {
  /** Child controls are indented below the label */
  children?: React.ReactNode;
  /** Heading text */
  label?: string;
  /** Override style for label control */
  labelStyles?: React.CSSProperties;
  /** Show link to MOIS windows client module */
  moisModule?: string | null;
  /** Optional record id for record-specific MOIS navigation */
  objectId?: number;
  /** @deprecated Use label */
  text?: string;
  /** Style override */
  style?: React.CSSProperties;
}

/**
 * Heading - A heading component less prominent than a subtitle
 *
 * Used to organize form sections with optional MOIS module links
 * and indented child controls.
 */
export const Heading: React.FC<HeadingProps> = ({
  children,
  label,
  labelStyles = {},
  moisModule = null,
  objectId,
  text,
  style,
}) => {
  // Support deprecated 'text' prop
  const headingText = label || text;

  const childrenWrapperStyles: React.CSSProperties = {
    marginLeft: '2em',
  };

  return (
    <>
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }} style={style}>
        <Label style={labelStyles}>{headingText}</Label>
        {moisModule && (
          <LinkToMois moisModule={moisModule} objectId={objectId} />
        )}
      </Stack>
      {Children.count(children) > 0 && (
        <Stack style={childrenWrapperStyles}>
          {children}
        </Stack>
      )}
    </>
  );
};

export default Heading;
