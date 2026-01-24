/**
 * Linear Component
 * Arranges subcontrols in a vertical column. Linear is the default
 * layout for a form.
 */

import React, { useMemo } from 'react';
import { Stack, IStackProps } from '@fluentui/react';
import { SectionProvider, SectionContextValue, useTheme } from '../context/MoisContext';

// Convert layoutOrder to fieldPlacement map (1-based indexing for CSS order)
function parseLayoutOrder(
  layoutOrder?: string | { [layoutId: string]: number } | string[]
): Record<string, number> | undefined {
  if (!layoutOrder) return undefined;

  if (typeof layoutOrder === 'string') {
    // Parse comma-separated string: "field1, field2, field3"
    const fields = layoutOrder.split(',').map(s => s.trim());
    return fields.reduce((acc, field, idx) => {
      acc[field] = idx + 1; // 1-based for CSS order
      return acc;
    }, {} as Record<string, number>);
  }

  if (Array.isArray(layoutOrder)) {
    // Array of field names
    return layoutOrder.reduce((acc, field, idx) => {
      acc[field] = idx + 1; // 1-based for CSS order
      return acc;
    }, {} as Record<string, number>);
  }

  // Already a placement map
  return layoutOrder;
}

export interface LinearProps {
  /** A functional component or interior controls */
  children?: React.ReactNode | ((props: any) => React.ReactNode);
  /** Archetype fields. Overrides child controls. */
  fields?: Record<string, any>;
  /** Show only selected fields in the order given */
  layoutOrder?: string | { [layoutId: string]: number } | string[];
  /** Override section settings for all interior controls */
  section?: Partial<SectionContextValue>;
  /** Advanced: Override Stack props */
  stackProps?: IStackProps;
  /** Style override */
  style?: React.CSSProperties;
}

/**
 * Linear - Vertical column layout
 *
 * This control arranges subcontrols in a vertical column. Linear is the default
 * layout for a form. You can use this control explicitly for a subform or to
 * have a form section with user customizable contents.
 */
export const Linear: React.FC<LinearProps> = ({
  children,
  fields,
  layoutOrder,
  section,
  stackProps,
  style,
}) => {
  // Convert layoutOrder to fieldPlacement
  const fieldPlacement = useMemo(() => parseLayoutOrder(layoutOrder), [layoutOrder]);
  const theme = useTheme();

  // Handle functional children (matches reference SafeChildren)
  const renderChildren = () => {
    if (typeof children === 'function') {
      return children({ fields, section });
    }
    return children;
  };

  // Use gap for consistent spacing (margins don't collapse in flex containers)
  const linearStackProps = {
    ...theme.mois.defaultStackProps,
    tokens: { ...theme.mois.defaultStackProps?.tokens, childrenGap: 8 },
    ...stackProps,
  };

  return (
    <SectionProvider
      {...section}
      layout="linear"
      fieldPlacement={fieldPlacement}
    >
      <Stack
        {...linearStackProps}
        style={style}
      >
        {renderChildren()}
      </Stack>
    </SectionProvider>
  );
};

// Demo component matching the source example
export const LinearDemo: React.FC = () => {
  // Import here to avoid circular dependency
  const { TextArea } = require('./TextArea');

  return (
    <Linear layoutOrder="name, address">
      <TextArea
        label="Phone"
        fieldId="phone"
        size="small"
        readOnly
        defaultValue="250-555-1234"
      />
      <TextArea
        label="Full name"
        fieldId="name"
        size="small"
        readOnly
        defaultValue="MICKEY BOB MOUSE"
      />
      <TextArea
        label="Address"
        fieldId="address"
        size="large"
        readOnly
        multiline
        rows={3}
        defaultValue={`2251 Disney Road\nPrince George, BC\nCanada V3L 2K2`}
      />
    </Linear>
  );
};

export default Linear;
