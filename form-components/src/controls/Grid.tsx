/**
 * Grid Component
 * Experimental: This control arranges subcontrols in a "grid" Layout style.
 */

import React from 'react';
import { TextField, Dropdown, IDropdownOption } from '@fluentui/react';
import { useTheme } from '../context/MoisContext';

export interface GridProps {
  /** A functional component or interior controls */
  children?: React.ReactNode | (() => React.ReactNode);
  /** Column template. eg: "repeat(4,1fr)" */
  columnTemplate?: string;
  /** Archetype fields. Overrides child controls. */
  fields?: object;
  /** Gap size between rows and columns. eg: "10px" or "5px 10px" */
  gap?: string;
  /** Show only selected fields in the specified locations */
  placement?: string | { [layoutId: string]: string };
  /** Override section settings for all interior controls */
  section?: any;
}

export interface GridItemProps {
  /** Grid area (row-start / col-start / row-end / col-end) */
  gridArea?: string;
  /** Size indicator - uses theme sizes */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max';
  /** Flex grow/shrink factor (overrides size) */
  flex?: number;
  /** Minimum width (overrides size) */
  minWidth?: number | string;
  /** Maximum width (overrides size) */
  maxWidth?: number | string;
  /** Children */
  children?: React.ReactNode;
}

export const GridItem: React.FC<GridItemProps> = ({
  gridArea,
  size = 'small',
  flex,
  minWidth,
  maxWidth,
  children,
}) => {
  const theme = useTheme();

  // Get size styles from theme
  const themeSize = theme.mois.sizes[size] ?? theme.mois.sizes.small;

  // Allow prop overrides
  const effectiveFlex = flex ?? (themeSize.flex ? parseInt(String(themeSize.flex).split(' ')[0]) : 2);
  const effectiveMinWidth = minWidth ?? (themeSize as any).minWidth ?? '80px';
  const effectiveMaxWidth = maxWidth ?? (themeSize as any).maxWidth ?? '160px';

  const containerStyle: React.CSSProperties = {
    breakInside: 'avoid',
    margin: '0px 10px',
    gridArea: gridArea,
    flex: `${effectiveFlex} ${effectiveFlex} 0px`,
    minWidth: typeof effectiveMinWidth === 'number' ? `${effectiveMinWidth}px` : effectiveMinWidth,
    maxWidth: typeof effectiveMaxWidth === 'number' ? `${effectiveMaxWidth}px` : effectiveMaxWidth,
  };

  const innerStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'column',
    minWidth: typeof effectiveMinWidth === 'number' ? `${effectiveMinWidth}px` : effectiveMinWidth,
  };

  const contentStyle: React.CSSProperties = {
    flex: '2 1 0%',
    display: 'flex',
    flexFlow: 'wrap',
    minWidth: typeof effectiveMinWidth === 'number' ? `${effectiveMinWidth}px` : effectiveMinWidth,
  };

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>
        <div style={contentStyle}>
          {children}
        </div>
      </div>
      <div style={{ clear: 'both' }} />
    </div>
  );
};

/**
 * Parse a placement string template into a map of fieldId -> gridArea
 *
 * Example placement string:
 * ```
 * name  name    ----
 * ----  address address
 * phone address address
 * ```
 *
 * This creates:
 * - name: "1 / 1 / 2 / 3" (row 1, columns 1-2)
 * - address: "2 / 2 / 4 / 4" (rows 2-3, columns 2-3)
 * - phone: "3 / 1 / 4 / 2" (row 3, column 1)
 */
const parsePlacement = (placement: string): Map<string, string> => {
  const result = new Map<string, string>();
  const lines = placement.trim().split('\n');

  // Parse the grid into a 2D array of field names
  const grid: string[][] = lines.map(line =>
    line.trim().split(/\s+/).filter(cell => cell.length > 0)
  );

  if (grid.length === 0) return result;

  const numRows = grid.length;
  const numCols = Math.max(...grid.map(row => row.length));

  // Normalize grid to have consistent columns
  const normalizedGrid = grid.map(row => {
    while (row.length < numCols) row.push('----');
    return row;
  });

  // Track which cells have been processed
  const processed = new Set<string>();

  // Find bounding box for each unique field name
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const fieldName = normalizedGrid[row][col];

      // Skip empty cells or already processed fields
      if (fieldName === '----' || fieldName === '-' || result.has(fieldName)) {
        continue;
      }

      // Find the extent of this field
      let rowEnd = row + 1;
      let colEnd = col + 1;

      // Extend right
      while (colEnd < numCols && normalizedGrid[row][colEnd] === fieldName) {
        colEnd++;
      }

      // Extend down (checking all columns in the span)
      let canExtendDown = true;
      while (canExtendDown && rowEnd < numRows) {
        for (let c = col; c < colEnd; c++) {
          if (normalizedGrid[rowEnd][c] !== fieldName) {
            canExtendDown = false;
            break;
          }
        }
        if (canExtendDown) rowEnd++;
      }

      // Grid area format: row-start / col-start / row-end / col-end (1-indexed)
      const gridArea = `${row + 1} / ${col + 1} / ${rowEnd + 1} / ${colEnd + 1}`;
      result.set(fieldName, gridArea);
    }
  }

  return result;
};

export const Grid: React.FC<GridProps> = ({
  children,
  columnTemplate = 'repeat(4, 1fr)',
  gap = '10px',
  placement,
  fields,
}) => {
  const theme = useTheme();

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: gap,
    gridTemplateColumns: columnTemplate,
  };

  // Helper to wrap content in GridItem-like container
  const wrapInGridItem = (content: React.ReactNode, gridArea: string, size: string = 'small') => {
    const themeSize = theme.mois.sizes[size as keyof typeof theme.mois.sizes] ?? theme.mois.sizes.small;

    const containerStyle: React.CSSProperties = {
      breakInside: 'avoid',
      margin: '0px 10px',
      gridArea: gridArea,
      flex: themeSize.flex || '2 2 0px',
      minWidth: (themeSize as any).minWidth || '80px',
      maxWidth: (themeSize as any).maxWidth || '160px',
    };

    const innerStyle: React.CSSProperties = {
      display: 'flex',
      flexFlow: 'column',
      minWidth: (themeSize as any).minWidth || '80px',
    };

    const contentStyle: React.CSSProperties = {
      flex: '2 1 0%',
      display: 'flex',
      flexFlow: 'wrap',
      minWidth: (themeSize as any).minWidth || '80px',
    };

    return (
      <div key={gridArea} style={containerStyle}>
        <div style={innerStyle}>
          <div style={contentStyle}>
            {content}
          </div>
        </div>
        <div style={{ clear: 'both' }} />
      </div>
    );
  };

  // Parse placement if provided
  const placementMap = placement && typeof placement === 'string'
    ? parsePlacement(placement)
    : null;

  let renderedContent: React.ReactNode;

  // If fields prop is provided with placement, render fields from the fields object
  if (fields && placementMap && placementMap.size > 0) {
    const fieldsObj = fields as Record<string, React.FC | (() => React.ReactNode)>;
    renderedContent = Array.from(placementMap.entries()).map(([fieldName, gridArea]) => {
      const FieldComponent = fieldsObj[fieldName];
      if (!FieldComponent) {
        // Field not found - render nothing for this slot
        return null;
      }
      // Call the field function/component to get the rendered element
      const fieldElement = typeof FieldComponent === 'function'
        ? React.createElement(FieldComponent as React.FC)
        : FieldComponent;
      // Get size from field metadata (fieldSize property) or default to 'small'
      const fieldSize = (FieldComponent as any).fieldSize || 'small';
      return wrapInGridItem(fieldElement, gridArea, fieldSize);
    }).filter(Boolean);
  } else {
    // If children is a function, call it
    const content = typeof children === 'function' ? children() : children;

    // If we have placement with children, wrap children and apply gridArea
    if (placementMap && placementMap.size > 0) {
      renderedContent = React.Children.map(content, (child) => {
        if (!React.isValidElement(child)) return child;

        const childProps = child.props as any;
        const fieldId = childProps.fieldId || childProps.layoutId || childProps.id;

        if (fieldId && placementMap.has(fieldId)) {
          const gridArea = placementMap.get(fieldId)!;
          const size = childProps.size || 'small';
          return wrapInGridItem(child, gridArea, size);
        }

        return child;
      });
    } else {
      renderedContent = content;
    }
  }

  return (
    <div>
      <div style={gridStyle}>
        {renderedContent}
      </div>
    </div>
  );
};

// Demo 1: Typical use with positioned fields
export const GridDemo1: React.FC = () => {
  return (
    <Grid columnTemplate="repeat(4, 1fr)">
      <GridItem gridArea="3 / 1 / 4 / 2" size="small">
        <TextField
          label="Phone"
          value="250-960-9564"
          readOnly
          borderless
        />
      </GridItem>
      <GridItem gridArea="1 / 1 / 2 / 3" size="medium">
        <TextField
          label="Full name"
          value="MICKEY BOB MOUSE"
          readOnly
          borderless
        />
      </GridItem>
      <GridItem gridArea="2 / 2 / 4 / 4" size="large">
        <TextField
          label="Address"
          value={`2251 Disney Road\nPrince George, BC\nCanada V3L 2K2`}
          readOnly
          borderless
          multiline
          rows={3}
        />
      </GridItem>
    </Grid>
  );
};

// Demo 2: Custom controls with form fields
export const GridDemo2: React.FC = () => {
  const statusOptions: IDropdownOption[] = [
    { key: 'active', text: 'Active Patient' },
    { key: 'inactive', text: 'Inactive Patient' },
  ];

  const fnStatusOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    { key: 'yes', text: 'Yes' },
    { key: 'no', text: 'No' },
  ];

  return (
    <Grid columnTemplate="repeat(3, 1fr)">
      <GridItem gridArea="1 / 1 / 2 / 2" size="medium">
        <TextField label="First name" required />
      </GridItem>
      <GridItem gridArea="1 / 2 / 2 / 3" size="medium">
        <TextField label="Middle name" />
      </GridItem>
      <GridItem gridArea="1 / 3 / 2 / 4" size="medium">
        <TextField label="Family name" required />
      </GridItem>
      <GridItem gridArea="2 / 1 / 3 / 2" size="small">
        <Dropdown
          label="Current status"
          options={statusOptions}
          defaultSelectedKey="active"
        />
      </GridItem>
      <GridItem gridArea="2 / 2 / 3 / 3" size="small">
        <TextField label="Parent phone" />
      </GridItem>
      <GridItem gridArea="2 / 3 / 3 / 4" size="small">
        <Dropdown
          label="First nation status"
          options={fnStatusOptions}
          defaultSelectedKey=""
        />
      </GridItem>
    </Grid>
  );
};

export default Grid;
