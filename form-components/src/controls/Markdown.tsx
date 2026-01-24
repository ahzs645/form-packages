/**
 * Markdown Component
 * Rich text display and edit control using Markdown syntax
 */

import React, { useState } from 'react';
import { Pivot, PivotItem, TextField } from '@fluentui/react';
import ReactMarkdown from 'react-markdown';
import { useTheme, useSection, useActiveData, useSourceData, SectionContextValue } from '../context/MoisContext';
import { LayoutItem, LayoutItemProps } from './LayoutItem';

export interface SectionInfo {
  name?: string;
  visible?: boolean;
  enabled?: boolean;
}

export interface MarkdownProps extends Omit<LayoutItemProps, 'children' | 'size'> {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** @deprecated Strikethrough is not supported in MOIS markdown */
  allowStrikethrough?: boolean;
  /** Use a borderless edit control */
  borderless?: boolean;
  /** Initial value for fields stored in active data */
  defaultValue?: string;
  /** Indicate whether the field is disabled or not */
  disabled?: boolean;
  /** Active field name */
  fieldId?: string;
  /** Height for the display and edit portion in pixels */
  height?: number;
  /** Hidden fields are not shown at all */
  hidden?: boolean;
  /** Source and active field name */
  id?: string;
  /** List index for grid and flowsheet layouts */
  index?: number;
  /** Override section completion status */
  isComplete?: boolean;
  /** Label for this field */
  label?: string;
  /** Label position relative to field contents */
  labelPosition?: 'top' | 'left' | 'none';
  /** Identifier for selective layout */
  layoutId?: string;
  /** Override properties of the base LayoutItem control */
  layoutProps?: any;
  /** Overrides for the ReactMarkdown component */
  markdownProps?: any;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** Annotation shown near the control */
  note?: string;
  /** Change function to update value parameter */
  onChange?: (ev: any, value: any) => void;
  /** Placeholder string shown if no value has been entered */
  placeholder?: string;
  /** Override field placement */
  placement?: string | number;
  /** A readOnly control is always view only */
  readOnly?: boolean;
  /** Indicates that the value should be kept up to date with changes */
  refresh?: boolean;
  /** Is this field required to have a value? */
  required?: boolean;
  /** Advanced: Override section settings */
  section?: Partial<SectionContextValue>;
  /** Size indicator */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | '100%' | React.CSSProperties;
  /** Markdown source text. If specified, the control will be read only */
  source?: string;
  /** Source field name */
  sourceId?: string;
  /** Controls whether the control starts in preview mode or edit mode */
  startingMode?: 'edit' | 'preview' | 'default';
  /** Markdown source text for controlled usage */
  value?: string;
  /** Style override */
  style?: React.CSSProperties;
}

// Full width styles for markdown elements
const fullWidthStyle: React.CSSProperties = {
  maxWidth: 'none',
  width: '100%',
};

// Default markdownProps without strikethrough support
// Ensures all block elements render at full width
const defaultMarkdownProps = {
  components: {
    p: ({ children, ...props }: any) => <p style={fullWidthStyle} {...props}>{children}</p>,
    div: ({ children, ...props }: any) => <div style={fullWidthStyle} {...props}>{children}</div>,
    ul: ({ children, ...props }: any) => <ul style={fullWidthStyle} {...props}>{children}</ul>,
    ol: ({ children, ...props }: any) => <ol style={fullWidthStyle} {...props}>{children}</ol>,
    blockquote: ({ children, ...props }: any) => <blockquote style={fullWidthStyle} {...props}>{children}</blockquote>,
    pre: ({ children, ...props }: any) => <pre style={{ ...fullWidthStyle, overflow: 'auto' }} {...props}>{children}</pre>,
  },
};

// MarkdownProps with strikethrough disabled (MOIS default)
const noStrikethroughProps = {
  components: {
    ...defaultMarkdownProps.components,
    del: ({ children }: { children?: React.ReactNode }) => (
      <span>~~{children}~~</span>
    ),
  },
};

/**
 * Markdown - Rich text display and edit control
 *
 * Displays markdown-formatted text as HTML using ReactMarkdown.
 * Supports headings, bold, italic, bullet points, and more.
 *
 * Data source resolution (matching MOIS original):
 * 1. Direct `source` or `value` prop
 * 2. Active data via `fieldId` (or `id` as fallback)
 * 3. Source data via `sourceId` (or `id` as fallback)
 * 4. `defaultValue` prop
 */
export const Markdown: React.FC<MarkdownProps> = (props) => {
  const {
    actions,
    allowStrikethrough,
    defaultValue,
    disabled,
    fieldId: fieldIdProp,
    height,
    hidden,
    id,
    index,
    isComplete,
    label,
    labelPosition,
    layoutId,
    layoutProps,
    markdownProps,
    moisModule,
    note,
    onChange,
    placeholder,
    placement,
    readOnly: readOnlyProp,
    required,
    section,
    size: sizeProp,
    source: sourceProp,
    sourceId: sourceIdProp,
    startingMode = 'default',
    value,
    style,
    ...rest
  } = props;

  const theme = useTheme();

  // Use id as fallback for fieldId and sourceId (matching MOIS original)
  const fieldId = fieldIdProp ?? id;
  const sourceId = sourceIdProp ?? id;

  // Get section context for selectors and layout
  const sectionContext = useSection(section);
  const { activeSelector, sourceSelector, layout } = sectionContext;

  // Get active and source data
  const [activeData] = useActiveData();
  const sourceData = useSourceData();

  // Apply selectors to get the relevant data objects
  const activeFieldData = activeSelector ? activeSelector(activeData) : activeData;
  const sourceFieldData = sourceSelector ? sourceSelector(sourceData) : sourceData;

  // Resolve the content value (matching MOIS original fallback chain):
  // source prop → value prop → fieldId from activeData → sourceId from sourceData → defaultValue → ""
  let source = sourceProp;
  let readOnly = readOnlyProp;

  // If value prop is provided, use it as source (controlled mode)
  if (value !== undefined) {
    source = value;
    // readOnly defaults to true if onChange is NOT provided (matching MOIS: readOnly ?? Boolean(onChange))
    readOnly = readOnly ?? !Boolean(onChange);
  } else if (source !== undefined) {
    // If source prop is explicitly provided, default to readOnly
    readOnly = readOnly ?? true;
  }

  // Resolve content from data sources if not directly provided
  const resolvedContent =
    source ??
    (fieldId && activeFieldData ? activeFieldData[fieldId] : null) ??
    (sourceId && sourceFieldData ? sourceFieldData[sourceId] : null) ??
    defaultValue ??
    '';

  // Track local state for editable mode
  const [localValue, setLocalValue] = useState(resolvedContent);

  // Determine final content
  const content = source ?? localValue;

  // isEmpty flag for LayoutItem
  const isEmpty = !Boolean(content);

  // Layout-aware size calculation (matching MOIS original):
  // size ?? (label || layout !== "grid" ? "max" : "100%")
  let size: MarkdownProps['size'] = sizeProp;
  if (size === undefined) {
    size = (label || layout !== 'grid') ? 'max' : '100%';
  }

  // Determine starting mode
  const effectiveStartingMode = startingMode === 'default'
    ? (content ? 'preview' : 'edit')
    : startingMode;

  const handleChange = (_: any, newValue?: string) => {
    setLocalValue(newValue || '');
    onChange?.(_, newValue);
  };

  // Merge markdownProps - use strikethrough support based on allowStrikethrough prop
  const effectiveMarkdownProps = allowStrikethrough
    ? { ...defaultMarkdownProps, ...markdownProps }
    : { ...noStrikethroughProps, ...markdownProps };

  // Height styles for the content area
  const heightStyles: React.CSSProperties = height
    ? { height: `${height}px`, overflow: 'auto' }
    : {};

  // Required field background
  const requiredStyles: React.CSSProperties = required && !content
    ? { background: theme.mois.requiredBackground }
    : {};

  // Disabled text color
  const disabledStyles: React.CSSProperties = disabled
    ? { color: theme.semanticColors.disabledText }
    : {};

  // Calculate rows for textarea
  const textareaRows = height
    ? Math.floor(height / theme.mois.textFieldRowHeight)
    : theme.mois.largeTextEditRowDefault;

  // Markdown content font styling (Times/serif as per MOIS reference)
  // Also ensure content fills full width with no max-width constraints
  const markdownFontStyles: React.CSSProperties = {
    fontFamily: 'Times, "Times New Roman", serif',
    maxWidth: 'none',
    width: '100%',
  };

  // Render the markdown content
  const renderMarkdownContent = () => {
    // Read-only mode or has source prop - just display markdown
    if (readOnly || sourceProp) {
      // If readOnly with no content, show placeholder
      if (!content) {
        return (
          <div style={{ width: '100%', margin: '5px 0 0', ...heightStyles, ...requiredStyles }}>
            {placeholder}
          </div>
        );
      }

      return (
        <div className="markdown-content" style={{ width: '100%', margin: '-8px 0 0', ...heightStyles, ...disabledStyles, ...markdownFontStyles }}>
          <ReactMarkdown {...effectiveMarkdownProps}>
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    // Editable mode - use Pivot with Preview/Edit tabs
    return (
      <div style={{ width: '100%', margin: '-6px 0 0', ...(typeof style === 'object' ? style : {}) }}>
        <Pivot defaultSelectedKey={effectiveStartingMode}>
          <PivotItem headerText="Preview" itemKey="preview">
            <div className="markdown-content" style={{ width: '100%', margin: '15px 0px', ...heightStyles, ...requiredStyles, ...markdownFontStyles }}>
              <ReactMarkdown {...effectiveMarkdownProps}>
                {content}
              </ReactMarkdown>
            </div>
          </PivotItem>
          <PivotItem headerText="Edit" itemKey="edit">
            <div style={{ width: '100%', margin: '15px 0px' }}>
              <TextField
                multiline
                rows={textareaRows}
                resizable={!height}
                value={content}
                onChange={handleChange}
                disabled={disabled}
                placeholder={placeholder}
                styles={{
                  root: {
                    width: '100%',
                    ...theme.mois.monospace,
                  },
                  fieldGroup: required && !content
                    ? { background: theme.mois.requiredBackground }
                    : undefined,
                }}
              />
            </div>
          </PivotItem>
        </Pivot>
      </div>
    );
  };

  // Determine if we want full width
  const isFullWidth = size === '100%' || size === 'max';

  // For full-width without label, render directly without LayoutItem to avoid flex constraints
  if (isFullWidth && !label && hidden !== true) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: 'none',
          gridColumn: '1 / -1',
        }}
      >
        {renderMarkdownContent()}
      </div>
    );
  }

  // Full width styles applied at multiple levels to ensure proper rendering
  const fullWidthStyles: React.CSSProperties = isFullWidth
    ? {
        margin: 0,
        gridColumn: '1 / -1',
        width: '100%',
        maxWidth: 'none',
        flex: '1 1 100%',
      }
    : {};

  // Compute size for LayoutItem
  const layoutItemSize = (() => {
    if (isFullWidth) {
      return fullWidthStyles;
    }
    if (typeof size === 'object') {
      return size as React.CSSProperties;
    }
    return size as LayoutItemProps['size'];
  })();

  // Wrapper style for content when full width
  const contentWrapperStyle: React.CSSProperties = isFullWidth
    ? { width: '100%', maxWidth: 'none', flex: '1 1 100%', minWidth: 0 }
    : {};

  // Wrap in LayoutItem (matching MOIS original)
  return (
    <LayoutItem
      actions={actions}
      disabled={disabled}
      fieldId={fieldId}
      hidden={hidden}
      id={id}
      index={index}
      isEmpty={isEmpty}
      isComplete={isComplete}
      label={label}
      labelPosition={labelPosition}
      layoutId={layoutId}
      moisModule={moisModule}
      note={note}
      placement={placement}
      readOnly={readOnly}
      required={required}
      section={section}
      size={layoutItemSize}
      {...layoutProps}
      layoutStyle={{ ...fullWidthStyles, ...layoutProps?.layoutStyle }}
      rootStyle={{ ...fullWidthStyles, ...layoutProps?.rootStyle }}
      {...rest}
    >
      <div style={contentWrapperStyle}>
        {renderMarkdownContent()}
      </div>
    </LayoutItem>
  );
};

export default Markdown;
