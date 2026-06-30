/**
 * Footer Component
 * Sticky footer container for form actions
 */

import React from 'react';
import { Stack, DefaultButton, PrimaryButton } from '@fluentui/react';

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
  bottom = 0,
  background,
}) => {
  const footerStyle: React.CSSProperties = {
    position: 'sticky',
    bottom: `${bottom}px`,
    zIndex: 950,
  };

  return (
    <div id="footerBlock" style={footerStyle}>
      <Stack horizontal tokens={{ childrenGap: 8 }} styles={{ root: { background } }}>
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
