/**
 * LayoutItem Component
 * Centralized wrapper for form field layout - handles labels, sizing, layout modes, and actions.
 * This control manages the layout of edit or display fields and optional
 * decorators: a label, an action bar, and/or an annotation.
 */

import React from 'react';
import { Label, TextField, IconButton, DatePicker, ILabelProps } from '@fluentui/react';
import { useSection, useTheme } from '../context/MoisContext';
import { Linear } from './Linear';
import { Action, ActionBarProps } from './Action';

export interface LayoutItemChildProps {
  disabled?: boolean;
  hidden?: boolean;
  isEmpty?: boolean;
  isComplete?: boolean;
  label?: string;
  labelPosition?: 'top' | 'left' | 'none' | 'heading';
  layoutId?: string;
  placement?: string | number;
  readOnly?: boolean;
  size?: string | React.CSSProperties;
}

export interface LayoutItemProps {
  /** The functional component to layout - can be ReactNode or render function */
  children?: React.ReactNode | ((props: LayoutItemChildProps) => React.ReactNode);
  /** If present, an action bar will appear after the sub-controls. Can be ReactNode or action handlers object */
  actions?: React.ReactNode | Omit<ActionBarProps, 'children' | 'style'>;
  /** Disabled state */
  disabled?: boolean;
  /** Default layoutId if layoutId is not specified */
  fieldId?: string;
  /** Hidden fields are not shown at all */
  hidden?: boolean;
  /** Source and active field name */
  id?: string;
  /** Index used to distinguish rows/columns in grid and flowsheet layouts */
  index?: number;
  /** Indicates that the field is "empty" */
  isEmpty?: boolean;
  /** Override section completion status */
  isComplete?: boolean;
  /** Normal label for this control */
  label?: string;
  /** Override default label position */
  labelPosition?: 'top' | 'left' | 'none' | 'heading';
  /** Override label properties */
  labelProps?: ILabelProps;
  /** Field identifier if only selected fields are shown */
  layoutId?: string;
  /** Override for wrapper style */
  layoutStyle?: React.CSSProperties;
  /** Optional link to a MOIS windows client module */
  moisModule?: string;
  /** Suppress showing a top label */
  noTopLabel?: boolean;
  /** Annotation text */
  note?: string;
  /** Override field placement */
  placement?: string | number;
  /** A readOnly control is always view only */
  readOnly?: boolean;
  /** Mark field as required */
  required?: boolean;
  /** Deprecated: Override for wrapper style */
  rootStyle?: React.CSSProperties;
  /** Advanced: Override section settings */
  section?: any;
  /** Size of control container */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | React.CSSProperties;
}

/**
 * LayoutItem - Manages the layout of edit or display fields
 */
export const LayoutItem: React.FC<LayoutItemProps> = ({
  children,
  actions,
  disabled,
  fieldId,
  hidden: hiddenProp,
  id,
  index,
  isEmpty,
  isComplete: isCompleteProp,
  label: labelProp,
  labelPosition,
  labelProps,
  layoutId,
  layoutStyle,
  moisModule,
  noTopLabel,
  note,
  placement: placementProp,
  readOnly: readOnlyProp,
  required,
  rootStyle,
  section: sectionOverride,
  size = 'medium',
}) => {
  // Get section context (with optional overrides)
  const sectionContext = useSection(sectionOverride);
  const theme = useTheme();

  // Compute the layout ID
  const computedLayoutId = layoutId ?? fieldId ?? id;
  // Stable field marker used by renderer->PDF sync click detection.
  const syncFieldId = fieldId ?? id ?? computedLayoutId;
  const key = `${computedLayoutId}${index ?? ''}`;

  // Get layout from section context
  const layout = sectionContext.layout;

  // Check if this field should be shown based on fieldPlacement
  if (sectionContext.fieldPlacement && computedLayoutId && !sectionContext.fieldPlacement[computedLayoutId]) {
    return null;
  }

  // Get placement from section context if not specified
  const placement = placementProp ?? sectionContext.fieldPlacement?.[computedLayoutId ?? ''];

  // Determine readOnly and isComplete from section context
  const isComplete = isCompleteProp ?? false;
  const readOnly = readOnlyProp ?? isComplete;
  let hidden = hiddenProp;
  let label = labelProp;

  // Handle empty field display in read-only mode
  if (isEmpty && readOnly) {
    if (sectionContext.readOnlyOptions?.emptyLabel) {
      label = sectionContext.readOnlyOptions.emptyLabel;
    }
    if (sectionContext.readOnlyOptions?.emptyHidden) {
      hidden = sectionContext.readOnlyOptions.emptyHidden;
    }
  }

  // Get size styles from theme
  const getSizeStyles = (): React.CSSProperties => {
    if (typeof size === 'object') return size;
    return theme.mois.sizes[size] ?? theme.mois.sizes.medium;
  };

  const sizeStyles = getSizeStyles();

  // Check if this is a full-width size
  const isFullWidth = size === 'max' ||
    (typeof size === 'object' && (size.width === '100%' || (typeof size.flex === 'string' && size.flex.includes('100%'))));

  // Determine label position based on layout mode
  let effectiveLabelPosition = labelPosition;
  let useColumnLayout = true; // Default to column layout

  switch (layout) {
    case 'linear':
      effectiveLabelPosition = labelPosition ?? 'left';
      useColumnLayout = false; // Only linear uses row wrap
      break;
    case 'grid':
      effectiveLabelPosition = labelPosition ?? 'top';
      break;
    case 'flex':
      effectiveLabelPosition = labelPosition ?? 'top';
      break;
    case 'flowsheet':
      effectiveLabelPosition = labelPosition ?? 'none';
      break;
    case 'headings':
      effectiveLabelPosition = labelPosition ?? 'heading';
      break;
    default:
      effectiveLabelPosition = labelPosition ?? 'top';
  }

  // Container margin based on layout
  // For linear: vertical margin for spacing between items
  // For non-linear: horizontal margin only
  const containerMargin = layout === 'linear' ? '8px 0px' : '0 10px';

  // Build container styles
  const containerStyles: React.CSSProperties = {
    breakInside: 'avoid',
    margin: containerMargin,
    ...layoutStyle,
    ...rootStyle,
  };

  // Apply placement
  if (placement) {
    if (layout === 'grid') {
      containerStyles.gridArea = String(placement);
    } else {
      containerStyles.order = typeof placement === 'number' ? placement : parseInt(placement, 10);
    }
  }

  // Apply size to container (except for linear layout with left label)
  if (layout !== 'linear' && effectiveLabelPosition !== 'left') {
    Object.assign(containerStyles, sizeStyles);
  }

  // Label styles for left position (matches source: float left with constrained width)
  const leftLabelStyles = {
    root: {
      minWidth: theme.mois.defaultCommonControlStyle.minLabelWidth,
      maxWidth: theme.mois.defaultCommonControlStyle.maxLabelWidth,
      marginRight: '10px',
      float: 'left' as const,
    },
  };

  // Determine what labels to show
  // noTopLabel suppresses ALL LayoutItem labels (both top and left) - child handles its own label
  const showTopLabel = label && effectiveLabelPosition === 'top' && !noTopLabel;
  const showLeftLabel = label && effectiveLabelPosition === 'left' && !noTopLabel;
  const isHeadingLabel = effectiveLabelPosition === 'heading';

  // Child props to pass down (for render prop pattern)
  const childProps: LayoutItemChildProps = {
    disabled,
    hidden,
    isEmpty,
    isComplete,
    label,
    labelPosition: effectiveLabelPosition,
    layoutId: computedLayoutId,
    placement,
    readOnly,
    size,
  };

  // Render children (supports render prop pattern)
  const renderChildren = () => {
    if (typeof children === 'function') {
      return children(childProps);
    }
    return children;
  };

  // Helper function to render actions
  const renderActionsBar = () => {
    // Check if actions is an object with action handlers (not a React element)
    const isActionsObject = actions && typeof actions === 'object' && !React.isValidElement(actions);

    if (isActionsObject || moisModule) {
      return (
        <Action.Bar
          {...(isActionsObject ? (actions as ActionBarProps) : {})}
          moisModule={moisModule}
        />
      );
    }

    // Otherwise render as-is (ReactNode)
    if (actions) {
      return (
        <div style={{ display: 'flex', flexFlow: 'row' }}>
          {actions}
          {/* Also show MOIS link if moisModule is set */}
          {moisModule && <Action.LinkToMois moisModule={moisModule} />}
        </div>
      );
    }

    return null;
  };

  // Hidden handling
  if (hidden) {
    if (layout === 'linear') return null;
    return <div key={key} style={containerStyles} />;
  }

  // Heading label mode
  if (isHeadingLabel) {
    return (
      <div key={key} style={{ padding: '12px 0', ...containerStyles }} data-field-id={syncFieldId}>
        <Label required={required} disabled={disabled} {...labelProps}>
          {label}
        </Label>
      </div>
    );
  }

  // For left label, use a flex row layout with wrapping
  if (showLeftLabel) {
    return (
      <div style={containerStyles} data-field-id={syncFieldId}>
        <div style={{ display: 'flex', flexFlow: 'row wrap', alignItems: 'flex-start' }}>
          {/* Left label */}
          <Label
            required={required}
            disabled={disabled}
            styles={{
              root: {
                minWidth: theme.mois.defaultCommonControlStyle.minLabelWidth,
                maxWidth: theme.mois.defaultCommonControlStyle.maxLabelWidth,
                marginRight: '10px',
                padding: '5px 0px',
                flex: '0 0 auto',
              },
            }}
            {...labelProps}
          >
            {label}
          </Label>

          {/* Field wrapper - wraps below label when space is tight */}
          <div
            style={{
              flex: '2 1 160px',
              display: 'flex',
              flexFlow: 'row wrap',
              minWidth: '160px',
            }}
          >
            {/* Inner field container */}
            <div
              style={{
                flex: '1 1 0px',
                display: 'flex',
                flexFlow: 'row wrap',
                minWidth: '0px',
                width: '100%',
              }}
            >
              {renderChildren()}

              {/* Actions - render as Action.Bar if it's an object with handlers, otherwise render as-is */}
              {(actions || moisModule) && renderActionsBar()}
            </div>

            {/* Note */}
            {note && (
              <div style={{ flex: '1', margin: '5px', marginLeft: '10px' }}>
                {note}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default rendering (top label or no label)
  return (
    <div style={containerStyles} data-field-id={syncFieldId}>
      {/* Top label */}
      {showTopLabel && (
        <Label required={required} disabled={disabled} {...labelProps}>
          {label}
        </Label>
      )}

      {/* Field wrapper */}
      <div
        style={{
          display: 'flex',
          flexFlow: useColumnLayout ? 'column' : 'row wrap',
          minWidth: isFullWidth ? 0 : (sizeStyles.minWidth ?? '0px'),
          width: '100%',
          maxWidth: isFullWidth ? 'none' : undefined,
        }}
      >
        {/* Inner field container */}
        <div
          style={{
            flex: isFullWidth ? '1 1 100%' : '1 1 0px',
            display: 'flex',
            flexFlow: 'row wrap',
            minWidth: isFullWidth ? 0 : (sizeStyles.minWidth ?? '0px'),
            width: '100%',
            maxWidth: isFullWidth ? 'none' : undefined,
          }}
        >
          {renderChildren()}

          {/* Actions - render as Action.Bar if it's an object with handlers, otherwise render as-is */}
          {(actions || moisModule) && renderActionsBar()}
        </div>

        {/* Note */}
        {note && (
          <div style={{ flex: '1', margin: '5px', marginLeft: '10px' }}>
            {note}
          </div>
        )}
      </div>

      <div style={{ clear: 'both' }} />
    </div>
  );
};

/**
 * LayoutItemDemo1 - Typical use showing various LayoutItem configurations
 */
export const LayoutItemDemo1: React.FC = () => {
  return (
    <Linear>
      <LayoutItem label="A text field with max width" size="medium">
        <TextField styles={{ root: { width: '100%' } }} />
      </LayoutItem>

      <LayoutItem label="Label on the left" labelPosition="left" size="large">
        <TextField />
      </LayoutItem>

      <LayoutItem label="Label on top with note" labelPosition="top" size="large" note="note">
        <TextField />
      </LayoutItem>

      <LayoutItem
        noTopLabel
        label="Label part of control with an action"
        size="large"
        actions={<IconButton iconProps={{ iconName: 'Refresh' }} />}
      >
        <TextField />
      </LayoutItem>
    </Linear>
  );
};

/**
 * LayoutItemDemo2 - Just a label (no children)
 */
export const LayoutItemDemo2: React.FC = () => {
  return (
    <Linear>
      <LayoutItem label="This just a label" size="medium" />
    </Linear>
  );
};

/**
 * LayoutItemDemo3 - Multiple controls in one LayoutItem
 */
export const LayoutItemDemo3: React.FC = () => {
  return (
    <Linear>
      <LayoutItem label="Lots of Controls" size="large">
        <LayoutItem size="small" labelPosition="none">
          <DatePicker
            placeholder="YYYY.MM.DD"
            styles={{
              root: { flex: '2 2 0px', minWidth: 80, maxWidth: 160, position: 'relative', display: 'flex', alignItems: 'center' }
            }}
          />
        </LayoutItem>
        <LayoutItem size="small" labelPosition="none">
          <TextField placeholder="Numeric" />
        </LayoutItem>
        <LayoutItem size="medium" labelPosition="none">
          <TextField placeholder="Text" />
        </LayoutItem>
      </LayoutItem>
    </Linear>
  );
};

/**
 * LayoutItemDemo4 - Label and basic text
 */
export const LayoutItemDemo4: React.FC = () => {
  return (
    <Linear>
      <LayoutItem label="This just some text" size="medium">
        Just some text
      </LayoutItem>
    </Linear>
  );
};

export default LayoutItem;
