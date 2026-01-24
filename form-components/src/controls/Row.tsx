/**
 * Row Component
 * Horizontal row layout for arranging subcontrols
 */

import React, { useMemo } from 'react';
import { SectionProvider, SectionContextValue } from '../context/MoisContext';

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

export interface RowProps {
  /** A functional component or interior controls */
  children?: React.ReactNode | (() => React.ReactNode);
  /** Archetype fields. Overrides child controls. */
  fields?: object;
  /** Row content justification */
  justifyContent?: 'flex-start' | 'flex-end' | 'start' | 'end' | 'left' | 'right' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  /** Show only selected fields in the order given. This prop can either be a string with comma separated layoutIds, a list of layoutIds, or an object with attributes given the layout order for each layoutId. If not specified, than all child controls will be shown in the order they are defined. */
  layoutOrder?: string | { [layoutId: string]: number } | string[];
  /** Override section settings for all interior controls */
  section?: Partial<SectionContextValue>;
  /** Should controls wrap if not enough space is available? */
  wrap?: boolean;
  /** Style override */
  style?: React.CSSProperties;
}

/**
 * Row - Horizontal row layout
 *
 * Experimental: This control arranges subcontrols in a horizontal row. It is part of the
 * "Flex" Layout style.
 */
export const Row: React.FC<RowProps> = ({
  children,
  fields,
  justifyContent = 'flex-start',
  layoutOrder,
  section,
  wrap = false,
  style,
}) => {
  // Convert layoutOrder to fieldPlacement
  const fieldPlacement = useMemo(() => parseLayoutOrder(layoutOrder), [layoutOrder]);

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexFlow: wrap ? 'row wrap' : 'row nowrap',
    justifyContent,
    ...style,
  };

  // Render children (supports function children)
  const renderChildren = () => {
    if (typeof children === 'function') {
      return children();
    }
    return children;
  };

  return (
    <SectionProvider
      {...section}
      layout="flex"
      fieldPlacement={fieldPlacement}
    >
      <div style={containerStyles}>
        {renderChildren()}
      </div>
    </SectionProvider>
  );
};

/**
 * RowDemo1 - Example use with children
 */
export const RowDemo1: React.FC = () => {
  // Import here to avoid circular dependency
  const { TextArea } = require('./TextArea');

  return (
    <Row layoutOrder="name, phone">
      <TextArea
        fieldId="phone"
        label="Phone"
        size="small"
        readOnly
        borderless
        defaultValue="250-960-9564"
      />
      <TextArea
        fieldId="name"
        label="Full name"
        size="small"
        readOnly
        borderless
        defaultValue="MICKEY BOB MOUSE"
      />
    </Row>
  );
};

/**
 * RowDemo2 - Example using field prop with DateTimeSelect and Dropdown
 */
export const RowDemo2: React.FC = () => {
  // Import from lib to use the composed DateTimeSelect
  const { TextArea } = require('./TextArea');
  const { DateTimeSelect } = require('./DateTimeSelect');
  const { SimpleCodeSelect } = require('./SimpleCodeSelect');

  return (
    <Row layoutOrder="scheduled, patientName, status">
      <DateTimeSelect
        fieldId="scheduled"
        label="Scheduled"
        size="medium"
        defaultValue="2017.07.07"
        defaultTime="00:00"
      />
      <TextArea
        fieldId="patientName"
        label="Patient name"
        size="medium"
        readOnly
        borderless
        defaultValue="MICKEY MOUSE"
      />
      <SimpleCodeSelect
        fieldId="status"
        label="Status"
        size="medium"
        options={[
          { key: 'admitted', text: 'Admitted' },
          { key: 'discharged', text: 'Discharged' },
          { key: 'transferred', text: 'Transferred' },
        ]}
        defaultSelectedKey="discharged"
      />
    </Row>
  );
};

export default Row;
