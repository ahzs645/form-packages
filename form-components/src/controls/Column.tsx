/**
 * Column Component
 * Experimental: This control arranges subcontrols in a vertical column.
 * It is part of the "Flex" Layout style.
 */

import React from 'react';
import { TextField } from '@fluentui/react';

export interface ColumnProps {
  /** A functional component or interior controls */
  children?: React.ReactNode | (() => React.ReactNode);
  /** Archetype fields. Overrides child controls. */
  fields?: object;
  /** Height for the column(s). If not specified, then the display will use whatever height is required. */
  height?: number;
  /** Show only selected fields in the order */
  layoutOrder?: string | { [layoutId: string]: number } | string[];
  /** Override section settings for all interior controls */
  section?: any;
  /** Wrap controls if not enough vertical space is available. */
  wrap?: boolean;
  /** Flex grow factor */
  flex?: number;
  /** Minimum width */
  minWidth?: number | string;
  /** Maximum width */
  maxWidth?: number | string;
  /** Order in flex layout */
  order?: number;
}

export const Column: React.FC<ColumnProps> = ({
  children,
  height,
  wrap = false,
  flex,
  minWidth = 80,
  maxWidth,
  order,
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'column',
    justifyContent: 'space-between',
    height: height ? `${height}px` : undefined,
    flexWrap: wrap ? 'wrap' : undefined,
  };

  const columnStyle: React.CSSProperties = {
    breakInside: 'avoid',
    margin: '0px 10px',
    order: order,
    flex: flex ? `${flex} ${flex} 0px` : undefined,
    minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth,
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
  };

  const innerStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'column',
    minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth,
  };

  const contentStyle: React.CSSProperties = {
    flex: '2 1 0%',
    display: 'flex',
    flexFlow: 'wrap',
    minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth,
  };

  // If children is a function, call it
  const content = typeof children === 'function' ? children() : children;

  return (
    <div style={columnStyle}>
      <div style={innerStyle}>
        <div style={contentStyle}>
          {content}
        </div>
      </div>
      <div style={{ clear: 'both' }} />
    </div>
  );
};

// Container for multiple columns
export interface ColumnsProps {
  children?: React.ReactNode;
  height?: number;
}

export const Columns: React.FC<ColumnsProps> = ({ children, height }) => {
  const style: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'column',
    justifyContent: 'space-between',
    height: height ? `${height}px` : undefined,
  };

  return (
    <div>
      <div style={style}>
        {children}
      </div>
    </div>
  );
};

// Demo component for the example
export const ColumnDemo: React.FC = () => {
  return (
    <Columns>
      <Column order={1} flex={2} minWidth={80} maxWidth={160}>
        <TextField
          label="Full name"
          value="MICKEY BOB MOUSE"
          readOnly
          borderless
        />
      </Column>
      <Column order={2} flex={5} minWidth={480}>
        <TextField
          label="Address"
          value={`2251 Disney Road\nPrince George, BC\nCanada V3L 2K2`}
          readOnly
          borderless
          multiline
          rows={3}
        />
      </Column>
    </Columns>
  );
};

export default Column;
