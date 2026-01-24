/**
 * Header Component
 * A sticky header that stays on the top of the form.
 *
 * The Header component provides a container for content that should
 * remain visible at the top of the form while scrolling.
 *
 * Enhanced to match original MOIS behavior:
 * - Uses useTheme for background color
 * - Uses useSourceData for isPrinting check
 * - Centers Title components within the header
 */

import React from 'react';
import { Stack } from '@fluentui/react';
import { useTheme, useSourceData } from '../context/MoisContext';
import { Title } from './Title';

export interface HeaderProps {
  /** Child content to render inside the header */
  children?: React.ReactNode;
  /** Top offset for sticky positioning */
  top?: number;
  /** Bottom margin below the header */
  marginBottom?: string;
}

/**
 * Header - Sticky header container
 *
 * When the form is being printed, the header is rendered without
 * sticky positioning for proper print layout.
 */
export const Header: React.FC<HeaderProps> = ({
  children,
  top = 0,
  marginBottom = '2em',
}) => {
  const theme = useTheme();
  const sourceData = useSourceData();
  const isPrinting = sourceData.lifecycleState.isPrinting;

  // Center Title components within the header
  const processedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === Title) {
      return (
        <div style={{ textAlign: 'center', margin: '15px' }}>
          {child}
        </div>
      );
    }
    return child;
  });

  if (isPrinting) {
    return (
      <div style={{ marginBottom: '2em' }}>
        <Stack>{processedChildren}</Stack>
      </div>
    );
  }

  return (
    <div
      id="headerBlock"
      style={{
        position: 'sticky',
        top,
        zIndex: 950,
        background: theme.palette.white,
        marginBottom,
      }}
    >
      <Stack>{processedChildren}</Stack>
    </div>
  );
};

/**
 * HeaderDemo - Demo showing a typical header with patient banner
 */
export const HeaderDemo: React.FC = () => {
  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 400,
    color: 'rgb(50, 49, 48)',
    display: 'inline',
    margin: '15px',
    textAlign: 'center',
    background: 'rgb(255, 255, 255)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 'bold',
    marginRight: '10px',
  };

  const bannerStyle: React.CSSProperties = {
    borderWidth: '1px 1px 2px',
    borderStyle: 'solid',
    borderColor: '#edebe9 #edebe9 #0078d4',
    padding: '5px 10px',
    background: '#00bcf2',
  };

  const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <Stack>
      <Stack.Item>
        <span style={labelStyle}>{label}</span>
      </Stack.Item>
      <Stack.Item>
        <span style={valueStyle}>{value}</span>
      </Stack.Item>
    </Stack>
  );

  return (
    <Header>
      <span style={titleStyle}><b>This Title is Always Visible</b></span>
      <Stack.Item>
        <div style={bannerStyle}>
          <Stack horizontal horizontalAlign="space-between">
            <InfoItem label="Chart" value="10012" />
            <InfoItem label="Patient name" value="MICKEY BOB MOUSE" />
            <InfoItem label="Born" value="1969.02.11  56 years" />
            <InfoItem label="Gender" value="M" />
            <InfoItem label="Health No." value="9151 065 434" />
            <InfoItem label="Preferred phone" value="(250) 960-9564 Home" />
          </Stack>
        </div>
      </Stack.Item>
    </Header>
  );
};

export default Header;
