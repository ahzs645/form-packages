/**
 * Footer Component
 * Sticky footer container for form actions.
 *
 * SMOIS parity evidence: Footer `Fe` in
 * ~/github/smois/build/static/js/main.a75cc6b1.chunk.js uses a vertical Stack,
 * the theme pageBottomMargin fallback, and a non-sticky printing branch.
 */

import React from 'react';
import { Stack, DefaultButton, PrimaryButton } from '@fluentui/react';
import { useSourceData, useTheme } from '../context/MoisContext';

export interface FooterProps {
  /** Child controls are contained inside the Footer */
  children: React.ReactNode;
  /** Bottom padding */
  bottom?: number;
  /** Background color */
  background?: string;
}

export const Footer: React.FC<FooterProps> = ({
  children,
  bottom,
  background,
}) => {
  const sourceData = useSourceData();
  const theme = useTheme();

  if (sourceData.lifecycleState.isPrinting) {
    return (
      <div>
        <Stack>{children}</Stack>
      </div>
    );
  }

  return (
    <div
      id="footerBlock"
      style={{
        position: 'sticky',
        bottom: bottom ?? theme.mois.pageBottomMargin ?? 0,
        zIndex: 950,
      }}
    >
      <Stack styles={background ? { root: { background } } : undefined}>
        {children}
      </Stack>
    </div>
  );
};

// Demo component for the example
export const FooterDemo: React.FC = () => {
  return (
    <Footer>
      <DefaultButton text="Save draft" />
      <DefaultButton text="Refresh" />
      <DefaultButton text="Close" />
      <PrimaryButton text="Submit" />
    </Footer>
  );
};

export default Footer;
