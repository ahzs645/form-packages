/**
 * GuidelineLink Component
 * Guideline button that will display the passed url in a new window
 */

import React from 'react';
import { Text } from '@fluentui/react';
import { useTheme } from '../context/MoisContext';

export interface GuidelineLinkProps {
  /** URL to open in new window (required) */
  url: string;
}

/**
 * GuidelineLink - Opens a URL in a new window
 *
 * A small button with a "?" that opens external guidelines/documentation
 */
export const GuidelineLink: React.FC<GuidelineLinkProps> = ({ url }) => {
  const theme = useTheme();

  return (
    <button
      style={{
        cursor: 'pointer',
        background: theme.semanticColors.primaryButtonBackground,
        alignSelf: 'flex-start',  // Prevent stretching in flex containers
        // Match original browser button styling
        padding: '1px 6px',
        borderWidth: '2px',
        borderStyle: 'outset',
        borderColor: 'rgb(0, 0, 0)',
      }}
      onClick={() => window.open(url, '_blank')}
    >
      <Text
        styles={{
          root: {
            color: theme.semanticColors.primaryButtonText,
          },
        }}
      >
        <b>?</b>
      </Text>
    </button>
  );
};

export default GuidelineLink;
