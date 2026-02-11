/**
 * GuidelineLink Component
 * Guideline button that will display the passed url in a new window
 */

import React from 'react';
import { Text } from '@fluentui/react';
import { useTheme } from '../context/MoisContext';

export interface GuidelineLinkProps {
  /** Link URL (preferred prop name) */
  href?: string;
  /** Backwards-compatible alias for href */
  url?: string;
  /** Link text shown on the button */
  label?: string;
  /** Link target */
  target?: "_blank" | "_self" | "_parent" | "_top";
}

/**
 * GuidelineLink - Opens a URL in the selected target
 *
 * A small button with a "?" that opens external guidelines/documentation
 */
export const GuidelineLink: React.FC<GuidelineLinkProps> = ({ href, url, label, target = "_blank" }) => {
  const theme = useTheme();
  const resolvedHref = href ?? url ?? "";
  const resolvedLabel = label ?? "?";
  const isDisabled = !resolvedHref;

  return (
    <button
      type="button"
      disabled={isDisabled}
      style={{
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        background: theme.semanticColors.primaryButtonBackground,
        alignSelf: 'flex-start',  // Prevent stretching in flex containers
        // Match original browser button styling
        padding: '1px 6px',
        borderWidth: '2px',
        borderStyle: 'outset',
        borderColor: 'rgb(0, 0, 0)',
        opacity: isDisabled ? 0.6 : 1,
      }}
      onClick={() => {
        if (!resolvedHref) return;
        window.open(resolvedHref, target);
      }}
    >
      <Text
        styles={{
          root: {
            color: theme.semanticColors.primaryButtonText,
          },
        }}
      >
        <b>{resolvedLabel}</b>
      </Text>
    </button>
  );
};

export default GuidelineLink;
