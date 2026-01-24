/**
 * Heading Component
 * Heading component. This is less prominent than a subtitle.
 */

import React, { Children } from 'react';
import { Stack, Label } from '@fluentui/react';

export interface HeadingProps {
  /** Child controls are indented below the label */
  children?: React.ReactNode;
  /** Heading text */
  label?: string;
  /** Override style for label control */
  labelStyles?: React.CSSProperties;
  /** Show link to MOIS windows client module */
  moisModule?: string | null;
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
  text,
  style,
}) => {
  // Support deprecated 'text' prop
  const headingText = label || text;

  const handleMoisClick = () => {
    if (moisModule) {
      console.log(`Navigate to MOIS module: ${moisModule}`);
      // In real implementation, this would navigate to the MOIS module
    }
  };

  const stackStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '4px',
    ...style,
  };

  const childrenWrapperStyles: React.CSSProperties = {
    marginLeft: '2em',
  };

  return (
    <>
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
        <Label style={labelStyles}>{headingText}</Label>
        {moisModule && (
          <button
            onClick={handleMoisClick}
            style={{
              backgroundColor: 'transparent',
              border: '0px',
              cursor: 'pointer',
              padding: 0,
            }}
            title={`Link to MOIS: ${moisModule}`}
          >
            <div style={{ marginTop: '4px' }}>
              <img
                src="./img/GotoRecord.png"
                alt="Link to Mois"
                style={{ width: '16px' }}
                onError={(e) => {
                  // Fallback if image doesn't load - show an icon
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = '<span style="font-size: 14px; color: #0078d4;">&#8599;</span>';
                }}
              />
            </div>
          </button>
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
