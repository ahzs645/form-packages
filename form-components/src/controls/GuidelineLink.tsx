/**
 * GuidelineLink Component
 * Guideline button that will display the passed url in a new window
 */

import React from 'react';
import { Link, Text } from '@fluentui/react';
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
  /** Visual treatment */
  appearance?: "button" | "inline";
}

/**
 * GuidelineLink - Opens a URL in the selected target
 *
 * A small button with a "?" that opens external guidelines/documentation
 */
export const GuidelineLink: React.FC<GuidelineLinkProps> = ({
  href,
  url,
  label,
  target = "_blank",
  appearance = "button",
}) => {
  const theme = useTheme();
  const resolvedHref = href ?? url ?? "";
  const resolvedLabel = label ?? "?";
  const isDisabled = !resolvedHref;

  if (appearance === "inline") {
    return isDisabled ? (
      <Text
        styles={{
          root: {
            color: theme.palette.neutralTertiary,
            opacity: 0.8,
          },
        }}
      >
        {resolvedLabel}
      </Text>
    ) : (
      <Link
        href={resolvedHref}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        underline
        styles={{
          root: {
            alignSelf: 'flex-start',
          },
        }}
      >
        {resolvedLabel}
      </Link>
    );
  }

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
