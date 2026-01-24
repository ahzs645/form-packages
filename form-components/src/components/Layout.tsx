/**
 * MOIS Layout Components
 * Grid, Row, Section, and LayoutItem components for form layout
 */

import React, { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { Label, Toggle, Dropdown, IDropdownOption } from '@fluentui/react';
import {
  SectionContext,
  SectionContextValue,
  useActiveData,
  useSourceData,
  useSection,
  useTheme,
  produce
} from '../context/MoisContext';

// ============================================================================
// Grid Component
// ============================================================================

export interface GridProps {
  children: ReactNode;
  columnTemplate?: string;
  placement?: string;
  gap?: string | number;
  style?: React.CSSProperties;
}

export const Grid: React.FC<GridProps> = ({
  children,
  columnTemplate = '1fr 1fr',
  placement,
  gap = 10,
  style,
}) => {
  const parentSection = useSection();

  // Parse placement string into gridTemplateAreas
  let gridTemplateAreas: string | undefined;
  if (placement) {
    const rows = placement.trim().split('\n').map(row => row.trim()).filter(Boolean);
    gridTemplateAreas = rows.map(row => `"${row}"`).join(' ');
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: typeof gap === 'number' ? `${gap}px` : gap,
    gridTemplateColumns: columnTemplate,
    ...(gridTemplateAreas && { gridTemplateAreas }),
    ...style,
  };

  // Provide grid layout context so LayoutItems know to apply flex sizing
  const gridSectionValue: SectionContextValue = {
    ...parentSection,
    layout: 'grid',
  };

  return (
    <SectionContext.Provider value={gridSectionValue}>
      <div style={gridStyle}>{children}</div>
    </SectionContext.Provider>
  );
};

// ============================================================================
// Row Component
// ============================================================================

export interface RowProps {
  children: ReactNode;
  gap?: string | number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  wrap?: boolean;
  style?: React.CSSProperties;
}

export const Row: React.FC<RowProps> = ({
  children,
  gap = 10,
  align = 'start',
  justify = 'flex-start',
  wrap = false,
  style,
}) => {
  const parentSection = useSection();

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: wrap ? 'row wrap' : 'row',
    justifyContent: justify,
    alignItems: align,
    gap: typeof gap === 'number' ? `${gap}px` : gap,
    ...style,
  };

  // Provide flex layout context so LayoutItems know to apply flex sizing
  const rowSectionValue: SectionContextValue = {
    ...parentSection,
    layout: 'flex',
  };

  return (
    <SectionContext.Provider value={rowSectionValue}>
      <div style={rowStyle}>{children}</div>
    </SectionContext.Provider>
  );
};

// ============================================================================
// Section Demo Component
// ============================================================================

// Demo 1: Name fields with source data
const SectionDemo: React.FC = () => {
  const nameFields = [
    { label: 'Prefix', value: '' },
    { label: 'First', value: 'MICKEY' },
    { label: 'Middle', value: 'BOB' },
    { label: 'Last', value: 'MOUSE' },
    { label: 'Suffix', value: '' },
  ];

  return (
    <div>
      {nameFields.map((field) => (
        <div key={field.label} style={{ breakInside: 'avoid', margin: '8px 0' }}>
          <label className="ms-Label" style={{ display: 'block', fontWeight: 600, padding: '5px 0' }}>
            {field.label}
          </label>
          <div style={{ display: 'flex', flexFlow: 'wrap', minWidth: '160px' }}>
            <div style={{ flex: '2 1 0%', display: 'flex', flexFlow: 'wrap', minWidth: '160px' }}>
              <input
                type="text"
                defaultValue={field.value}
                style={{
                  padding: '6px 8px',
                  border: '1px solid #8a8886',
                  borderRadius: '2px',
                  width: '100%',
                  outline: 'none',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Demo 2: Section completion toggles (exported for use in examples)
export const SectionCompletionDemo: React.FC = () => {
  const [section1Complete, setSection1Complete] = useState(false);
  const [section2Complete, setSection2Complete] = useState(false);

  const dropdownOptions: IDropdownOption[] = [
    { key: '', text: 'Please select' },
    { key: 'option1', text: 'Option 1' },
    { key: 'option2', text: 'Option 2' },
    { key: 'option3', text: 'Option 3' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
        <Toggle
          label="Section 1 complete"
          checked={section1Complete}
          onChange={(_, checked) => setSection1Complete(!!checked)}
          onText="Complete"
          offText="Editing"
        />
        <Toggle
          label="Section 2 complete"
          checked={section2Complete}
          onChange={(_, checked) => setSection2Complete(!!checked)}
          onText="Complete"
          offText="Editing"
        />
      </div>

      {/* Section 1 control */}
      <div>
        <div style={{ breakInside: 'avoid', margin: '8px 0' }}>
          <label className="ms-Label" style={{ display: 'block', fontWeight: 600, padding: '5px 0' }}>
            A control in section 1
          </label>
          <div style={{ display: 'flex', flexFlow: 'wrap', minWidth: '160px' }}>
            <div style={{ flex: '2 1 0%', display: 'flex', flexFlow: 'wrap', minWidth: '160px' }}>
              <div style={{ display: 'flex', flexFlow: 'column', width: '320px', flex: '3 3 0', minWidth: '160px', maxWidth: '320px' }}>
                <Dropdown
                  placeholder="Please select"
                  options={dropdownOptions}
                  disabled={section1Complete}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2 control */}
      <div>
        <div style={{ breakInside: 'avoid', margin: '8px 0' }}>
          <label className="ms-Label" style={{ display: 'block', fontWeight: 600, padding: '5px 0' }}>
            A control in section 2
          </label>
          <div style={{ display: 'flex', flexFlow: 'wrap', minWidth: '160px' }}>
            <div style={{ flex: '2 1 0%', display: 'flex', flexFlow: 'wrap', minWidth: '160px' }}>
              <div style={{ display: 'flex', flexFlow: 'column', width: '320px', flex: '3 3 0', minWidth: '160px', maxWidth: '320px' }}>
                <Dropdown
                  placeholder="Please select"
                  options={dropdownOptions}
                  disabled={section2Complete}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Section Component
// ============================================================================

export interface SectionProps {
  children: ReactNode;
  sectionNum?: number;
  layout?: 'linear' | 'grid' | 'flex' | 'flowsheet' | 'headings';
  fieldPlacement?: Record<string, string | number>;
  readOnlyOptions?: { emptyLabel?: string; emptyHidden?: boolean };
  activeSelector?: (fd: any) => any;
  statusSelector?: (fd: any) => any;
  sourceSelector?: (sd: any) => any;
  isComplete?: boolean;
  sectionComplete?: (sd: any, ad: any, sectionNum: number) => boolean;
  focusZone?: boolean;
}

export const Section: React.FC<SectionProps> = ({
  children,
  sectionNum = 0,
  layout = 'linear',
  fieldPlacement,
  readOnlyOptions = {},
  activeSelector,
  statusSelector,
  sourceSelector,
  isComplete,
  sectionComplete = () => false,
  focusZone = false,
}) => {
  const parentSection = useSection();
  const sourceData = useSourceData();
  const [activeData, setActiveData] = useActiveData();
  const ref = React.useRef<HTMLDivElement>(null);

  // Merge with parent section values
  const effectiveSectionNum = sectionNum ?? parentSection.sectionNum;
  const effectiveLayout = layout ?? parentSection.layout;
  const effectiveActiveSelector = activeSelector ?? parentSection.activeSelector;
  const effectiveIsComplete = isComplete ?? sectionComplete(sourceData, activeData, effectiveSectionNum);

  const sectionValue: SectionContextValue = {
    sectionNum: effectiveSectionNum,
    layout: effectiveLayout,
    fieldPlacement,
    readOnlyOptions,
    activeSelector: effectiveActiveSelector,
    statusSelector,
    sourceSelector,
    sectionComplete,
    focusZoneRoot: focusZone ? ref.current : parentSection.focusZoneRoot,
  };

  // Update uiState with section completion status
  useEffect(() => {
    setActiveData({
      uiState: {
        ...activeData.uiState,
        sections: {
          ...activeData.uiState.sections,
          [effectiveSectionNum]: { isComplete: effectiveIsComplete },
        },
      },
    } as any);
  }, [effectiveIsComplete, effectiveSectionNum]);

  // Demo content when no children provided
  if (!children) {
    return (
      <div ref={ref}>
        <SectionContext.Provider value={sectionValue}>
          <SectionDemo />
        </SectionContext.Provider>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <SectionContext.Provider value={sectionValue}>
        {children}
      </SectionContext.Provider>
    </div>
  );
};

// ============================================================================
// LayoutItem Component
// ============================================================================

export interface LayoutItemProps {
  children: ReactNode | ((props: LayoutItemRenderProps) => ReactNode);
  layoutId?: string;
  fieldId?: string;
  id?: string;
  label?: string;
  labelPosition?: 'top' | 'left' | 'none' | 'heading';
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | string;
  hidden?: boolean;
  readOnly?: boolean;
  required?: boolean;
  disabled?: boolean;
  placement?: string | number;
  section?: Partial<SectionContextValue>;
  style?: React.CSSProperties;
  index?: number | string;
  note?: ReactNode;
  noTopLabel?: boolean;
}

export interface LayoutItemRenderProps {
  fieldId?: string;
  label?: string;
  readOnly: boolean;
  disabled: boolean;
  section: SectionContextValue;
}

const sizeMap: Record<string, { minWidth: number | string; maxWidth?: number | string; flex: string }> = {
  tiny: { minWidth: 50, maxWidth: 80, flex: '1 1 0px' },
  small: { minWidth: 80, maxWidth: 160, flex: '2 2 0px' },
  medium: { minWidth: 160, maxWidth: 320, flex: '3 3 0px' },
  large: { minWidth: 320, maxWidth: 480, flex: '4 4 0px' },
  max: { minWidth: 480, flex: '5 5 0px' },
};

export const LayoutItem: React.FC<LayoutItemProps> = ({
  children,
  layoutId,
  fieldId,
  id,
  label,
  labelPosition,
  size = 'medium',
  hidden = false,
  readOnly: propReadOnly = false,
  required = false,
  disabled = false,
  placement,
  section: sectionOverrides,
  style,
  index,
  note,
  noTopLabel = false,
}) => {
  const section = useSection(sectionOverrides);
  const sourceData = useSourceData();
  const [activeData] = useActiveData();
  const theme = useTheme();

  const mId = layoutId ?? fieldId ?? id;
  const key = `${mId}${index ?? ''}`;

  // Determine read-only state
  const isComplete = section.sectionComplete(sourceData, activeData, section.sectionNum);
  const readOnly = propReadOnly || isComplete || sourceData.lifecycleState.isPrinting;

  // Handle hidden items
  if (hidden) {
    if (section.layout === 'linear') return null;
    return <div key={key} style={style} />;
  }

  // Get size configuration
  const sizeConfig = sizeMap[size] || (typeof size === 'string' ? { minWidth: size, maxWidth: size, flex: '1' } : sizeMap.medium);

  const margin = section.layout === 'linear' ? '8px 0' : '0 10px';
  const wrapperStyle: React.CSSProperties = {
    breakInside: 'avoid',
    margin,
    ...style,
  };

  const effectivePlacement = placement ?? section.fieldPlacement?.[mId ?? ''];
  
  let effectiveLabelPosition = labelPosition;
  let isColumn = true;

  switch (section.layout) {
    case 'linear':
      if (effectivePlacement) wrapperStyle.order = Number(effectivePlacement);
      effectiveLabelPosition = labelPosition ?? 'left';
      isColumn = false;
      break;
    case 'grid':
      if (effectivePlacement) wrapperStyle.gridArea = String(effectivePlacement);
      effectiveLabelPosition = labelPosition ?? 'top';
      break;
    case 'flex':
      if (effectivePlacement) wrapperStyle.order = Number(effectivePlacement);
      effectiveLabelPosition = labelPosition ?? 'top';
      break;
    case 'flowsheet':
      if (effectivePlacement) wrapperStyle.order = Number(effectivePlacement);
      effectiveLabelPosition = labelPosition ?? 'none';
      break;
    case 'headings':
      if (effectivePlacement) wrapperStyle.order = Number(effectivePlacement);
      effectiveLabelPosition = labelPosition ?? 'heading';
      break;
    default:
      effectiveLabelPosition = labelPosition ?? 'top';
  }

  if (mId) {
    wrapperStyle.gridArea = mId;
  }

  const isLeftLabel = label && effectiveLabelPosition === 'left';
  const isTopLabel = label && effectiveLabelPosition === 'top' && !noTopLabel;

  // Render heading style
  if (effectiveLabelPosition === 'heading') {
    return (
      <div key={key} style={{ padding: '12px 0', ...wrapperStyle }}>
        <Label required={required} disabled={disabled}>
          {label}
        </Label>
      </div>
    );
  }

  const leftLabelStyles = {
    root: {
      minWidth: theme.mois.defaultCommonControlStyle.minLabelWidth,
      maxWidth: theme.mois.defaultCommonControlStyle.maxLabelWidth,
      marginRight: 10,
      float: isLeftLabel ? 'left' : 'none',
    },
  };

  const renderProps: LayoutItemRenderProps = {
    fieldId,
    label,
    readOnly,
    disabled,
    section,
  };

  const content = typeof children === 'function' ? children(renderProps) : children;

  return (
    <div key={key} style={wrapperStyle}>
      {isTopLabel && (
        <Label required={required} disabled={disabled}>
          {label}
        </Label>
      )}
      {isLeftLabel && (
        <Label required={required} disabled={disabled} styles={leftLabelStyles}>
          {label}
        </Label>
      )}
      <div style={{
        display: 'flex',
        flexFlow: isColumn ? 'column' : 'row wrap',
        minWidth: sizeConfig.minWidth,
        alignItems: 'flex-start',
      }}>
        <div style={{
          flex: '2 1 0%', // Intermediate wrapper matches reference
          display: 'flex',
          flexFlow: 'wrap',
          minWidth: sizeConfig.minWidth,
        }}>
          <div style={{
            flex: sizeConfig.flex, // Inner content gets the specific size flex
            display: 'flex',
            flexFlow: 'wrap', // Match reference 'row wrap' (or inherited)
            gap: '0px 10px',
            minWidth: sizeConfig.minWidth,
            maxWidth: sizeConfig.maxWidth, // Content constrained here
          }}>
            {content}
          </div>
        </div>
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

// ============================================================================
// ArchFields Component (renders all fields for an archetype)
// ============================================================================

export interface ArchFieldsProps {
  fields: Record<string, React.FC<any>>;
  [key: string]: any;
}

export const ArchFields: React.FC<ArchFieldsProps> = ({ fields, ...props }) => {
  return (
    <div>
      {Object.entries(fields).map(([fieldName, FieldComponent]) => (
        <LayoutItem key={fieldName} fieldId={fieldName} label={formatLabel(fieldName)}>
          <FieldComponent {...props} />
        </LayoutItem>
      ))}
    </div>
  );
};

// Helper to convert camelCase to readable label
function formatLabel(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// ============================================================================
// AuditStamp Component
// ============================================================================

export interface AuditStampProps {
  /** Active field name */
  fieldId?: string;
  /** Source field name */
  sourceId?: string;
  /** Source and active field name */
  id?: string;
  /** Label for this field */
  label?: string;
  /** Size indicator */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | string;
  /** Label position relative to field contents */
  labelPosition?: 'top' | 'left' | 'none';
  /** List index used to distinguish rows/columns in grid and flowsheet layouts */
  index?: number | string;
  /** Identifier for selective layout */
  layoutId?: string;
  /** A readOnly control is always view only */
  readOnly?: boolean;
  /** Indicate whether the field is disabled or not */
  disabled?: boolean;
  /** Hidden fields are not shown at all */
  hidden?: boolean;
  /** Is this field required to have a value? */
  required?: boolean;
  /** Placeholder string shown if no value has been entered */
  placeholder?: string;
  /** Annotation shown near the control */
  note?: string;
  /** Override field placement */
  placement?: string | number;
  /** Override section completion status */
  isComplete?: boolean;
  /** Indicates that the value should be kept up to date with changes */
  refresh?: boolean;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Advanced: Override section settings */
  section?: any;
  [key: string]: any;
}

export const AuditStamp: React.FC<AuditStampProps> = ({
  fieldId = 'stamp',
  label = 'History',
  size = 'medium',
  index,
  hidden,
  ...props
}) => {
  const section = useSection();
  const [activeData] = useActiveData();

  // Don't render if hidden
  if (hidden) return null;

  // Get stamp data from activeSelector using fieldId
  const data = section.activeSelector ? section.activeSelector(activeData) : (activeData as any);
  const rawStamp = data?.[fieldId] || data?.stamp;

  // Format ISO datetime to display format (YYYY.MM.DD - HH:mm)
  const formatIsoDate = (isoStr: string | null | undefined): string => {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}.${month}.${day}\u00A0-\u00A0${hours}:${minutes}`;
    } catch {
      return isoStr;
    }
  };

  // Normalize stamp data to handle both JSON format (createTime/createUser) and legacy format (createdDate/createdBy)
  const stamp = rawStamp ? {
    createdDate: rawStamp.createTime ? formatIsoDate(rawStamp.createTime) : (rawStamp.createdDate || ''),
    createdBy: rawStamp.createUser || rawStamp.createdBy || '',
    modifiedDate: rawStamp.modifyTime ? formatIsoDate(rawStamp.modifyTime) : (rawStamp.modifiedDate || ''),
    modifiedBy: rawStamp.modifyUser || rawStamp.modifiedBy || '',
  } : {
    createdDate: '',
    createdBy: '',
    modifiedDate: '',
    modifiedBy: '',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '5em 9em 1fr',
  };

  return (
    <LayoutItem label={label} size={size} index={index}>
      <div style={gridStyle}>
        <div>Created:</div>
        <div>{stamp.createdDate}</div>
        <div>{stamp.createdBy}</div>
        <div>Modified:</div>
        <div>{stamp.modifiedDate}</div>
        <div>{stamp.modifiedBy}</div>
      </div>
    </LayoutItem>
  );
};

export default { Grid, Row, Section, SectionCompletionDemo, LayoutItem, ArchFields, AuditStamp };
