/**
 * SubTitle Component
 * Section subtitle with gray background, collapse functionality, and MOIS links
 */

import React, { useState, useCallback, useContext, createContext } from 'react';
import { Stack, Label, IconButton, IButtonStyles, ILabelStyles } from '@fluentui/react';

// Context for managing exclusive collapsed sections by groupId
interface SubTitleGroupContextType {
  expandedGroups: Record<string, string | null>;
  setExpandedInGroup: (groupId: string, sectionId: string | null) => void;
}

const SubTitleGroupContext = createContext<SubTitleGroupContextType>({
  expandedGroups: {},
  setExpandedInGroup: () => {},
});

// Provider for managing exclusive sections
export const SubTitleGroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, string | null>>({});

  const setExpandedInGroup = useCallback((groupId: string, sectionId: string | null) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: sectionId,
    }));
  }, []);

  return (
    <SubTitleGroupContext.Provider value={{ expandedGroups, setExpandedInGroup }}>
      {children}
    </SubTitleGroupContext.Provider>
  );
};

export interface SubTitleProps {
  /** Background color */
  background?: string;
  /** Child elements (content to collapse) */
  children?: React.ReactNode;
  /** Override collapse button styles */
  collapseButtonStyles?: IButtonStyles;
  /** Group ID for exclusive collapse (only one in group can be open) */
  groupId?: string;
  /** Controlled collapsed state */
  isCollapsed?: boolean;
  /** Subtitle text or React element (can include inline actions) */
  label?: React.ReactNode;
  /** Override label styles */
  labelStyles?: ILabelStyles;
  /** Link to MOIS module */
  moisModule?: string;
  /** Prevent scroll on expand */
  noScroll?: boolean;
  /** Render function for action buttons */
  onRenderActions?: () => React.ReactNode;
  /** Callback when collapse state changes */
  onToggleCollapsed?: (isCollapsed: boolean) => void;
  /** Initial collapsed state */
  startCollapsed?: boolean;
  /** @deprecated Use label */
  text?: string;
  /** Style override */
  style?: React.CSSProperties;
}

let sectionIdCounter = 0;

/**
 * SubTitle - Section subtitle with background and collapse
 *
 * More prominent than Heading, less prominent than Title.
 * Has a gray background to visually separate sections.
 * Supports collapse/expand, MOIS links, and action buttons.
 */
export const SubTitle: React.FC<SubTitleProps> = ({
  background = 'rgb(237, 235, 233)',
  children,
  collapseButtonStyles,
  groupId,
  isCollapsed: controlledCollapsed,
  label,
  labelStyles,
  moisModule,
  noScroll,
  onRenderActions,
  onToggleCollapsed,
  startCollapsed = false,
  text,
  style,
}) => {
  const labelContent = label || text;
  // Only show collapse if there are actual children (not empty/undefined)
  const hasCollapse = React.Children.count(children) > 0;

  // Check if label is a string or React element
  const isLabelString = typeof labelContent === 'string';

  // Generate unique section ID for group management
  const [sectionId] = useState(() => `subtitle-${++sectionIdCounter}`);

  // Group context for exclusive collapse
  const { expandedGroups, setExpandedInGroup } = useContext(SubTitleGroupContext);

  // Internal collapsed state
  const [internalCollapsed, setInternalCollapsed] = useState(startCollapsed);

  // Determine actual collapsed state (controlled or internal)
  const isCollapsed = controlledCollapsed !== undefined
    ? controlledCollapsed
    : (groupId && expandedGroups[groupId] !== undefined)
      ? expandedGroups[groupId] !== sectionId
      : internalCollapsed;

  // Handle toggle
  const handleToggle = useCallback(() => {
    const newCollapsed = !isCollapsed;

    if (controlledCollapsed === undefined) {
      setInternalCollapsed(newCollapsed);
    }

    // If in a group, update group state
    if (groupId) {
      setExpandedInGroup(groupId, newCollapsed ? null : sectionId);
    }

    onToggleCollapsed?.(newCollapsed);
  }, [isCollapsed, controlledCollapsed, groupId, sectionId, setExpandedInGroup, onToggleCollapsed]);

  // Handle MOIS link click
  const handleMoisLink = useCallback(() => {
    console.log('Navigate to MOIS module:', moisModule);
    // In actual implementation, this would trigger navigation
  }, [moisModule]);

  const containerStyles: React.CSSProperties = {
    width: '100%',
    backgroundColor: background,
    padding: '2px 5px',
    ...style,
  };

  const defaultCollapseButtonStyles: IButtonStyles = {
    root: {
      width: 24,
      height: 24,
      minWidth: 24,
      padding: 0,
      color: '#0078d4', // Blue theme primary
    },
    icon: {
      fontSize: 10,
      color: '#0078d4', // Blue theme primary
    },
    ...collapseButtonStyles,
  };

  const defaultLabelStyles: ILabelStyles = {
    root: {
      fontWeight: 600,
      fontSize: '14px',
      margin: 0,
      padding: 0,
      lineHeight: '24px',
    },
    ...labelStyles,
  };

  // Action bar container styles - flex-grow to push actions to the right
  const actionBarContainerStyles: React.CSSProperties = {
    flexGrow: 1,
    display: 'flex',
    flexFlow: 'row',
    justifyContent: 'flex-end',
  };

  return (
    <div style={containerStyles}>
      <Stack horizontal verticalAlign="center">
        {/* Collapse button */}
        {hasCollapse && (
          <IconButton
            iconProps={{ iconName: isCollapsed ? 'ChevronRight' : 'ChevronDown' }}
            styles={defaultCollapseButtonStyles}
            onClick={handleToggle}
            ariaLabel={isCollapsed ? 'Expand section' : 'Collapse section'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          />
        )}

        {/* Label - can be string or React element */}
        {isLabelString ? (
          <Label styles={defaultLabelStyles}>{labelContent}</Label>
        ) : (
          labelContent
        )}

        {/* MOIS module link */}
        {moisModule && (
          <button
            onClick={handleMoisLink}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '4px',
            }}
            aria-label={`Open ${moisModule} in MOIS`}
            title={`Open in MOIS: ${moisModule}`}
          >
            <img
              src="./img/GotoRecord.png"
              alt="Link to MOIS"
              style={{ width: '16px', height: '16px' }}
              onError={(e) => {
                // Fallback to icon if image doesn't load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </button>
        )}

        {/* Action buttons - with proper flex layout to push to right */}
        {onRenderActions && (
          <div style={actionBarContainerStyles}>
            {onRenderActions()}
          </div>
        )}
      </Stack>

      {/* Collapsible content */}
      {hasCollapse && !isCollapsed && (
        <div style={{ marginLeft: '2em' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default SubTitle;
