import React from 'react';
import { Stack, Text } from '@fluentui/react';
import { LayoutProps } from '../types';

export interface SectionProps extends LayoutProps {
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  activeSelector?: (formData: any) => any;
}

/**
 * Section - Container for grouping form fields
 *
 * Provides:
 * - Optional title
 * - Collapsible behavior
 * - Active data selection for child fields
 */
export const Section: React.FC<SectionProps> = ({
  title,
  collapsible = false,
  defaultExpanded = true,
  children
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <Stack
      tokens={{ childrenGap: 16 }}
      styles={{
        root: {
          padding: 16,
          border: '1px solid #edebe9',
          borderRadius: 4,
          marginBottom: 16
        }
      }}
    >
      {title && (
        <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
          {title}
        </Text>
      )}
      {(!collapsible || expanded) && children}
    </Stack>
  );
};

export default Section;
