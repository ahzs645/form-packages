/**
 * FlowSheet Component
 * Flow sheet layout control that displays a list of controls for each element
 * in a data list in either row or column order.
 */

import React, { useMemo } from 'react';
import { Label, TextField, DatePicker } from '@fluentui/react';
import { useSourceData, useActiveData, useSection, SectionContextValue } from '../context/MoisContext';

export interface SectionInfo {
  readOnlyOptions?: {
    borderless?: boolean;
    emptyLabel?: string;
    emptyHidden?: boolean;
  };
  [key: string]: any;
}

export interface FlowSheetProps {
  /**
   * Uses:
   * 1. Function: Interior functional control that is called for each item in the list
   * 2. Object: Archetype fields
   */
  fields: ((props: any) => React.ReactElement[] | React.ReactNode) | object;
  /** FieldId to show items from a list in active data */
  fieldId?: string;
  /** Show only selected fields in the order given */
  layoutOrder?: string | { [layoutId: string]: number } | string[];
  /** If set, then all items except the last will be read only */
  lockHistory?: boolean;
  /** Section parameters for new section(s) enclosing the child controls */
  section?: SectionInfo;
  /** SourceId to show items from a list in the source data */
  sourceId?: string;
  /** Orientation. Vertical orientation has one item per row and horizontal orientation has one item per column. */
  vertical?: boolean;
}

// Helper to format date for display
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  } catch {
    return '';
  }
};

// Helper to convert layoutOrder to object form
const getLayoutOrderObject = (layoutOrder?: string | { [layoutId: string]: number } | string[]) => {
  if (!layoutOrder) return null;
  if (typeof layoutOrder === 'string') {
    return { [layoutOrder]: 0 };
  }
  if (Array.isArray(layoutOrder)) {
    return layoutOrder.reduce((acc, key, index) => {
      acc[key] = index;
      return acc;
    }, {} as { [layoutId: string]: number });
  }
  return layoutOrder;
};

export const FlowSheet: React.FC<FlowSheetProps> = ({
  fields,
  fieldId,
  layoutOrder,
  lockHistory = false,
  section,
  sourceId,
  vertical = false,
}) => {
  const sourceData = useSourceData();
  const [activeData] = useActiveData();
  const sectionContext = useSection(section);

  // Get the list of items to display
  const items = useMemo(() => {
    if (fieldId) {
      // Get from active data using activeSelector
      const selector = sectionContext.activeSelector || ((ad: any) => ad);
      const selectedData = selector(activeData);
      return selectedData?.[fieldId] || [];
    }
    if (sourceId) {
      // Get from source data using sourceSelector
      const selector = sectionContext.sourceSelector || ((sd: any) => sd);
      const selectedData = selector(sourceData);
      return selectedData?.[sourceId] || [];
    }
    return [];
  }, [fieldId, sourceId, activeData, sourceData, sectionContext]);

  // Calculate number of columns based on layoutOrder or fields
  const layoutOrderObj = getLayoutOrderObject(layoutOrder);
  const numColumns = useMemo(() => {
    if (layoutOrderObj) {
      return Object.keys(layoutOrderObj).length;
    }
    // Try to determine from fields function
    if (typeof fields === 'function') {
      const testResult = fields({});
      if (Array.isArray(testResult)) {
        return testResult.length;
      }
    }
    return 4; // Default
  }, [layoutOrderObj, fields]);

  // Grid styles based on orientation
  const gridStyle: React.CSSProperties = vertical
    ? {
        display: 'grid',
        margin: '8px 0',
        gridTemplateColumns: `repeat(${numColumns}, auto)`,
        gridAutoFlow: 'row',
        rowGap: '8px',
      }
    : {
        display: 'grid',
        margin: '8px 0',
        gridTemplateRows: `repeat(${numColumns}, auto)`,
        gridAutoColumns: '1fr',
        gridAutoFlow: 'column',
        rowGap: '10px',
      };

  // Read-only options from section
  const readOnlyOptions = section?.readOnlyOptions || sectionContext.readOnlyOptions || {} as SectionInfo['readOnlyOptions'];
  const isBorderless = readOnlyOptions?.borderless;

  // Render headers for vertical layout
  const renderHeaders = () => {
    if (!vertical || typeof fields !== 'function') return null;

    const testElements = fields({ index: -1 });
    if (!Array.isArray(testElements)) return null;

    return testElements.map((element: any, idx: number) => {
      const label = element?.props?.label || '';
      const size = element?.props?.size || 'small';
      const sizeStyles = getSizeStyles(size);

      return (
        <div
          key={`header-${idx}`}
          style={{
            padding: '12px 0',
            breakInside: 'avoid',
            margin: '0px 10px',
            ...sizeStyles,
          }}
        >
          <Label>{label}</Label>
        </div>
      );
    });
  };

  // Render each item row
  const renderItems = () => {
    if (!Array.isArray(items) || items.length === 0) return null;

    return items.map((item: any, itemIndex: number) => {
      const isReadOnly = lockHistory && itemIndex < items.length - 1;

      if (typeof fields === 'function') {
        const elements = fields({ index: itemIndex, ...item });
        if (!Array.isArray(elements)) return null;

        return elements.map((element: any, fieldIndex: number) => {
          const fieldKey = `${itemIndex}-${fieldIndex}`;
          const sourceId = element?.props?.sourceId;
          const value = sourceId ? item[sourceId] : '';
          const size = element?.props?.size || 'small';
          const sizeStyles = getSizeStyles(size);

          return (
            <FlowSheetCell
              key={fieldKey}
              value={value}
              isReadOnly={isReadOnly}
              isBorderless={isBorderless}
              sizeStyles={sizeStyles}
              element={element}
              item={item}
            />
          );
        });
      }

      return null;
    });
  };

  return (
    <div>
      <div style={gridStyle}>
        {renderHeaders()}
        {renderItems()}
      </div>
    </div>
  );
};

// Size styles mapping
const getSizeStyles = (size: string): React.CSSProperties => {
  switch (size) {
    case 'tiny':
      return { flex: '1 1 0px', minWidth: '50px', maxWidth: '80px' };
    case 'small':
      return { flex: '2 2 0px', minWidth: '80px', maxWidth: '160px' };
    case 'medium':
      return { flex: '3 3 0px', minWidth: '160px', maxWidth: '320px' };
    case 'large':
      return { flex: '4 4 0px', minWidth: '320px', maxWidth: '480px' };
    case 'max':
      return { flex: '5 5 0px', minWidth: '480px' };
    default:
      return { flex: '2 2 0px', minWidth: '80px', maxWidth: '160px' };
  }
};

// Individual cell component
interface FlowSheetCellProps {
  value: any;
  isReadOnly: boolean;
  isBorderless?: boolean;
  sizeStyles: React.CSSProperties;
  element: any;
  item?: any;
}

const FlowSheetCell: React.FC<FlowSheetCellProps> = ({
  value,
  isReadOnly,
  isBorderless,
  sizeStyles,
  element,
  item,
}) => {
  const containerStyle: React.CSSProperties = {
    breakInside: 'avoid',
    margin: '0px 10px',
    ...sizeStyles,
  };

  const innerStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'column',
    minWidth: sizeStyles.minWidth,
  };

  const contentStyle: React.CSSProperties = {
    flex: '2 1 0%',
    display: 'flex',
    flexFlow: 'wrap',
    minWidth: sizeStyles.minWidth,
  };

  // Determine the type of control to render
  const elementType = element?.type?.name || element?.type?.displayName || '';
  const displayValue = typeof value === 'object' ? value?.display || value?.value || '' : String(value ?? '');

  // Check if this is a date field
  const isDateField = elementType === 'DateSelect' || element?.props?.sourceId?.toLowerCase().includes('date');

  // For the editable row (last row), render the actual component
  if (!isReadOnly && element) {
    // Clone the element with the item data as defaultValue, remove label (headers are at top)
    const clonedElement = React.cloneElement(element, {
      ...element.props,
      label: undefined,  // Remove label - headers already shown at top
      defaultValue: value,
      readOnly: false,
    });

    return (
      <div style={containerStyle}>
        <div style={innerStyle}>
          <div style={contentStyle}>
            {clonedElement}
          </div>
        </div>
        <div style={{ clear: 'both' }} />
      </div>
    );
  }

  // For read-only rows, render plain text (no DatePicker with calendar)
  return (
    <div style={containerStyle}>
      <div style={innerStyle}>
        <div style={contentStyle}>
          {isDateField ? (
            // Plain text for dates - no calendar icon
            <TextField
              value={formatDate(displayValue)}
              readOnly={true}
              tabIndex={-1}
              borderless={isBorderless}
            />
          ) : (
            <TextField
              value={displayValue}
              readOnly={true}
              tabIndex={-1}
              borderless={isBorderless}
            />
          )}
        </div>
      </div>
      <div style={{ clear: 'both' }} />
    </div>
  );
};

// Demo component matching the original styleguide example
export const FlowSheetDemo: React.FC = () => {
  // Define the archetype fields for each observation row
  const ObservationArchetype = ({ index, ...props }: { index: number; [key: string]: any }) => {
    return [
      <MockDateSelect key={`date-${index}`} label="Reported" sourceId="collectedDateTime" size="small" {...props} />,
      <MockTextArea key={`code-${index}`} label="Code" sourceId="observationCode" size="tiny" {...props} />,
      <MockTextArea key={`desc-${index}`} label="Test name" sourceId="description" size="medium" {...props} />,
      <MockTextArea key={`value-${index}`} label="Value" sourceId="value" size="small" {...props} />,
    ];
  };

  return (
    <FlowSheet
      vertical
      lockHistory
      sourceId="observations"
      fields={ObservationArchetype}
      section={{
        readOnlyOptions: { borderless: true },
        sourceSelector: (sd: any) => sd.example?.observationPanel,
      }}
    />
  );
};

// Mock components for demo (matching original structure)
const MockDateSelect: React.FC<any> = () => null;
const MockTextArea: React.FC<any> = () => null;

export default FlowSheet;
