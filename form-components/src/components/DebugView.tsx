/**
 * DebugView Component
 * A form debugging aid that shows all or a portion of source or active data.
 * This information will not be shown in production builds.
 */

import React, { useState } from 'react';
import { Text, Icon } from '@fluentui/react';
import { useActiveData, useSourceData, useSection, SectionContextValue } from '../context/MoisContext';

export interface DebugViewProps {
  /** Source or active data */
  dataType?: 'source' | 'active';
  /** Portions of the selected information can be replaced using this object */
  excluded?: Record<string, any>;
  /** Active field name. If specified, only show selected object */
  fieldId?: string;
  /** Hide control */
  hidden?: boolean;
  /** Source and active field name. If specified, only show selected object */
  id?: string;
  /** List index used to distinguish rows/columns in grid and flowsheet layouts */
  index?: number;
  /** Identifier for selective layout. Defaults to fieldId if given or sourceId */
  layoutId?: string;
  /** Override field placement */
  placement?: string | number;
  /** Indicates that the value should be kept up to date with changes */
  refresh?: boolean;
  /** Advanced: Override section settings */
  section?: Partial<SectionContextValue>;
  /** Normally this control is only shown in debug and test builds, but that can be changed */
  showInProduction?: boolean;
  /** Source field name */
  sourceId?: string;
}

export const DebugView: React.FC<DebugViewProps> = ({
  dataType = 'active',
  excluded = {
    patient: '...',
    optionLists: '...',
    formObject: '...',
    queryResult: '...',
  },
  fieldId,
  hidden = false,
  id,
  index,
  layoutId,
  placement,
  refresh,
  section,
  showInProduction = false,
  sourceId,
}) => {
  // Resolve field IDs
  const resolvedSourceId = sourceId ?? id ?? null;
  const resolvedFieldId = fieldId ?? id ?? null;

  const [activeData] = useActiveData();
  const sourceData = useSourceData();
  const sectionContext = useSection(section);

  const [isCollapsed, setIsCollapsed] = useState(true);

  // Don't show if hidden
  if (hidden) return null;

  // In production, only show if showInProduction is true
  // For the styleguide, we always show it (simulating non-production)
  const isProduction = false; // Styleguide is always in dev mode
  if (isProduction && !showInProduction) return null;

  // Don't show during printing
  if (sourceData.lifecycleState?.isPrinting) return null;

  try {
    let data: any;
    let displayFieldName: string | null = null;

    if (dataType === 'active') {
      if (resolvedFieldId) {
        const activeSelector = sectionContext.activeSelector;
        data = activeSelector ? activeSelector(activeData)?.[resolvedFieldId] : (activeData as any)?.[resolvedFieldId];
        displayFieldName = resolvedFieldId;
      } else {
        data = activeData;
      }
    } else {
      if (resolvedSourceId) {
        const sourceSelector = sectionContext.sourceSelector;
        data = sourceSelector ? sourceSelector(sourceData)?.[resolvedSourceId] : (sourceData as any)?.[resolvedSourceId];
        displayFieldName = resolvedSourceId;
      } else {
        data = sourceData;
      }
    }

    // Apply exclusions - use Object.keys to avoid prototype chain issues
    let displayData: any = {};
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      displayData = data;
    } else {
      try {
        const keys = Object.keys(data);
        for (const key of keys) {
          if (excluded[key] !== undefined) {
            displayData[key] = excluded[key];
          } else {
            // Try to get the value, handle potential errors
            try {
              displayData[key] = data[key];
            } catch {
              displayData[key] = '[Error reading value]';
            }
          }
        }
      } catch {
        displayData = { error: 'Could not enumerate object properties' };
      }
    }

    const containerStyle: React.CSSProperties = {
      padding: '4px',
      border: '1px solid rgb(0, 0, 0)',
      boxShadow: 'grey 2px 2px 4px inset',
      background: 'rgb(223, 246, 221)', // Light green success background
      color: 'rgb(50, 49, 48)',
    };

    const headerStyle: React.CSSProperties = {
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
    };

    return (
      <div style={containerStyle}>
        <Text
          variant="large"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={headerStyle}
        >
          <Icon
            iconName={isCollapsed ? 'ChevronDown' : 'ChevronUp'}
            style={{ margin: '5px' }}
          />
          Selected {dataType} data{displayFieldName ? `[${displayFieldName}]` : ''}
        </Text>
        {!isCollapsed && (
          <pre style={{ margin: '8px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {(() => {
              try {
                return JSON.stringify(displayData, (key, value) => {
                  // Handle functions and other non-serializable values
                  if (typeof value === 'function') return '[Function]';
                  if (value === undefined) return '[undefined]';
                  return value;
                }, '  ');
              } catch (e) {
                return `[Error serializing: ${e}]`;
              }
            })()}
          </pre>
        )}
      </div>
    );
  } catch (error) {
    return (
      <>
        <h3>
          Error getting selected {dataType} data{' '}
          {(resolvedFieldId || resolvedSourceId) ? `[${resolvedFieldId || resolvedSourceId}]` : ''}
        </h3>
        <pre>{JSON.stringify(error, null, '  ')}</pre>
      </>
    );
  }
};

// Wrapper component that shows both active and source views (for live preview)
const DebugViewAll: React.FC = () => {
  return (
    <>
      <DebugView showInProduction />
      <DebugView showInProduction dataType="source" />
    </>
  );
};

// Attach All to DebugView for archetype pattern
(DebugView as any).All = DebugViewAll;

export default DebugView;
