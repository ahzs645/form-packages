/**
 * ListSelection Component
 * Supports selection from a list of items with multiple columns.
 *
 * Enhanced to match original MOIS behavior:
 * - Real-time selection sync with form state
 * - Theme integration
 * - filterPred, listCompare, detailsListProps support
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
  DefaultButton,
  DetailsRow,
  IDetailsRowProps,
  CheckboxVisibility,
  Selection,
  ConstrainMode,
} from '@fluentui/react';
import { LayoutItem } from './LayoutItem';
import { useTheme, useSourceData, useActiveData, useSection, produce } from '../context/MoisContext';

// Default filter predicate - accepts all items
const defaultFilterPred = () => true;

// Generate a unique key for an item based on its properties
function getItemKey(item: any): string {
  // Try common ID field patterns
  const idFields = ['id', 'key', 'longTermMedicationId', 'serviceRequestId', 'observationId', 'encounterId', 'plannedActionId', 'code'];
  for (const field of idFields) {
    if (item[field] !== undefined) {
      return String(item[field]);
    }
  }
  // Fallback to JSON stringify for uniqueness
  return JSON.stringify(item);
}

// Mock data for list sources
const mockListData: Record<string, any[]> = {
  longTermMedications: [
    { longTermMedicationId: 1, startDate: '2020-03-15', medication: 'BETA CAROTENE', doseFrequency: '1 cap daily', created: '2020-03-15 09:30:00' },
    { longTermMedicationId: 2, startDate: '2019-08-22', medication: 'ADVIL GEL CAPLETS', doseFrequency: 'po prn', created: '2019-08-22 14:15:00' },
    { longTermMedicationId: 3, startDate: '2017-05-30', medication: 'IBUPROFEN-600 TAB 600MG', doseFrequency: 'po q6h prn', created: '2017-05-30 13:24:17' },
    { longTermMedicationId: 4, startDate: '2021-01-10', medication: 'CALCIUM COMPLETE WITH MAGNESIUM AND VITAMIN C', doseFrequency: '1 tab daily', created: '2021-01-10 11:00:00' },
    { longTermMedicationId: 5, startDate: '2018-11-05', medication: 'VITAMIN B COMPLEX', doseFrequency: '1 cap daily', created: '2018-11-05 16:45:00' },
    { longTermMedicationId: 6, startDate: '2022-06-20', medication: 'MULTIVITAMIN AND MINERALS FOR WOMEN', doseFrequency: '1 tab daily', created: '2022-06-20 10:30:00' },
  ],
  serviceRequests: [
    { serviceRequestId: 1, orderDate: '2015-09-16', order: 'DIABETES, TYPE 2, - UNCOMPLICATED', orderedBy: 'HARPER, S.', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
    { serviceRequestId: 2, orderDate: '2016-07-12', order: 'ABDOMINAL ORGAN INJURY/LATE EFFECT', orderedBy: 'DR. pluto dog', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
    { serviceRequestId: 3, orderDate: '2017-03-14', order: 'HEAD LICE', orderedBy: 'MOISCON', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
    { serviceRequestId: 4, orderDate: '2017-03-14', order: 'DEPRESSIVE DISORDER, NOT ELSEWHERE CLASSIFIED', orderedBy: 'SAMWAYS, K.', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
  ],
  // Planned actions for PlannedActions component
  actions: [
    { plannedActionId: 1, startDate: '2024-01-15', endDate: '2024-06-15', action: 'Regular blood pressure monitoring', responsibility: 'Patient, Nurse', completedDate: null, isCompleted: { code: 'N', display: 'No', system: 'MOIS-YESNO' } },
    { plannedActionId: 2, startDate: '2024-02-01', endDate: '2024-12-31', action: 'Weight management program', responsibility: 'Patient, Dietitian', completedDate: null, isCompleted: { code: 'N', display: 'No', system: 'MOIS-YESNO' } },
    { plannedActionId: 3, startDate: '2023-06-01', endDate: '2024-01-01', action: 'Physical therapy sessions', responsibility: 'Physiotherapist', completedDate: '2024-01-01', isCompleted: { code: 'Y', display: 'Yes', system: 'MOIS-YESNO' } },
    { plannedActionId: 4, startDate: '2024-03-01', endDate: null, action: 'Annual wellness check', responsibility: 'Primary Care Provider', completedDate: null, isCompleted: { code: 'N', display: 'No', system: 'MOIS-YESNO' } },
  ],
};

export interface ListSelectionProps {
  /** Props for the attached action bar */
  actions?: any;
  /** Optional filter controls */
  children?: React.ReactNode;
  /** Array of column specifiers */
  columns?: IColumn[];
  /** Override DetailsList properties */
  detailsListProps?: any;
  /** Indicate whether disabled */
  disabled?: boolean;
  /** Text on done button */
  doneText?: string;
  /** Active field name */
  fieldId?: string;
  /** Predicate for filtering */
  filterPred?: (item: any) => boolean;
  /** Hidden fields are not shown */
  hidden?: boolean;
  /** Source and active field name */
  id?: string;
  /** List index */
  index?: number;
  /** Override section completion status */
  isComplete?: boolean;
  /** Array of items to display */
  items?: any[];
  /** Label for this field */
  label?: string;
  /** Label position */
  labelPosition?: 'none' | 'top' | 'left';
  /** Override label properties */
  labelProps?: any;
  /** Identifier for selective layout */
  layoutId?: string;
  /** Compare function for sorting */
  listCompare?: (a: any, b: any) => number;
  /** Link to MOIS module */
  moisModule?: string;
  /** Hide column headers */
  noHeaders?: boolean;
  /** Annotation text */
  note?: string;
  /** Placeholder string */
  placeholder?: string;
  /** Override field placement */
  placement?: string | number;
  /** Read only mode */
  readOnly?: boolean;
  /** Keep value up to date */
  refresh?: boolean;
  /** Required field */
  required?: boolean;
  /** Override section settings */
  section?: any;
  /** Text on select button */
  selectText?: string;
  /** Type of selection */
  selectionType?: 'none' | 'single' | 'multiple';
  /** Size indicator */
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'max' | React.CSSProperties;
  /** Source field name */
  sourceId?: string;
  /** Map from source to active list */
  sourceMap?: any;
  /** Start in selecting mode */
  initialSelecting?: boolean;
}

/**
 * ListSelection - Selection from a list with multiple columns
 */
export const ListSelection: React.FC<ListSelectionProps> = ({
  actions,
  children,
  label,
  labelProps,
  columns = [],
  detailsListProps,
  items: itemsProp,
  selectText = 'Change selection',
  doneText = 'Done',
  disabled,
  fieldId,
  filterPred = defaultFilterPred,
  hidden = false,
  id,
  index,
  isComplete: isCompleteProp,
  labelPosition,
  layoutId,
  listCompare,
  moisModule,
  note,
  placeholder = 'No matching items in chart',
  placement,
  readOnly: readOnlyProp,
  refresh,
  required,
  section: sectionProp,
  selectionType = 'none',
  size,
  sourceId,
  sourceMap,
  noHeaders = false,
  initialSelecting = false,
}) => {
  // Get theme for styling
  const theme = useTheme();

  // Get source data for lifecycle state (isPrinting)
  const sourceData = useSourceData();

  // Get active data and setter for real-time selection sync
  const [activeData, setActiveData] = useActiveData();

  // Get section context
  const section = useSection(sectionProp);

  // Resolve fieldId and sourceId from id prop if not specified
  const resolvedFieldId = fieldId ?? id ?? null;
  const resolvedSourceId = sourceId ?? id ?? null;
  const resolvedLayoutId = layoutId ?? resolvedFieldId ?? resolvedSourceId;

  // Determine if section is complete
  const isComplete = isCompleteProp ?? section.sectionComplete(sourceData, activeData, section.sectionNum);

  // Should refresh (sync source to active)
  const shouldRefresh = refresh ?? !isComplete;

  // ReadOnly defaults to true when selectionType is 'none', isComplete is true, or printing
  const readOnly = readOnlyProp ?? (selectionType === 'none' || isComplete || sourceData.lifecycleState.isPrinting);

  const [isSelecting, setIsSelecting] = useState(initialSelecting);

  // Get items from props, source data, or mock data
  const sourceItems = useMemo(() => {
    if (itemsProp && itemsProp.length > 0) {
      return itemsProp;
    }
    // Try to get items from mock data based on id
    const lookupId = resolvedSourceId || resolvedFieldId;
    if (lookupId && mockListData[lookupId]) {
      return mockListData[lookupId];
    }
    return [];
  }, [itemsProp, resolvedSourceId, resolvedFieldId]);

  // Apply filterPred, sourceMap, and listCompare to get processed items
  const processedItems = useMemo(() => {
    let items = sourceItems.filter(filterPred);

    // Apply sourceMap if provided
    if (sourceMap) {
      items = items.map(sourceMap);
    }

    // Apply listCompare if provided
    if (listCompare) {
      items = [...items].sort(listCompare);
    }

    return items;
  }, [sourceItems, filterPred, sourceMap, listCompare]);

  // Get selected items from active data (for real-time sync)
  const selectedFromActiveData = useMemo(() => {
    if (!resolvedFieldId) return [];
    const activeSelector = section.activeSelector || ((fd: any) => fd?.field?.data ?? fd);
    const fieldData = activeSelector(activeData);
    return fieldData?.[resolvedFieldId] ?? [];
  }, [resolvedFieldId, activeData, section.activeSelector]);

  // Local state for selected items (fallback when not using active data)
  const [localSelectedItems, setLocalSelectedItems] = useState<any[]>([]);

  // Use active data selection if fieldId is set, otherwise use local state
  const selectedItems = resolvedFieldId ? selectedFromActiveData : localSelectedItems;

  // Map selectionType prop to SelectionMode
  const getSelectionModeForType = (type: string) => {
    switch (type) {
      case 'multiple': return SelectionMode.multiple;
      case 'single': return SelectionMode.single;
      default: return SelectionMode.none;
    }
  };

  // Use refs to avoid recreating Selection on every render
  const isSelectingRef = useRef(isSelecting);
  const resolvedFieldIdRef = useRef(resolvedFieldId);
  const setActiveDataRef = useRef(setActiveData);
  const sectionActiveSelectorRef = useRef(section.activeSelector);

  // Keep refs up to date
  useEffect(() => {
    isSelectingRef.current = isSelecting;
  }, [isSelecting]);

  useEffect(() => {
    resolvedFieldIdRef.current = resolvedFieldId;
  }, [resolvedFieldId]);

  useEffect(() => {
    setActiveDataRef.current = setActiveData;
  }, [setActiveData]);

  useEffect(() => {
    sectionActiveSelectorRef.current = section.activeSelector;
  }, [section.activeSelector]);

  // Create selection object once - use refs for callbacks to avoid recreation
  const selection = useMemo(() => {
    const mode = getSelectionModeForType(selectionType);
    const sel = new Selection({
      getKey: getItemKey,
      selectionMode: mode,
      onSelectionChanged: () => {
        // Real-time selection sync to form state when selecting
        if (isSelectingRef.current) {
          const selected = sel.getSelection();
          const fieldId = resolvedFieldIdRef.current;
          if (fieldId) {
            // Sync to active data
            setActiveDataRef.current(produce((draft: any) => {
              const activeSelector = sectionActiveSelectorRef.current || ((fd: any) => fd?.field?.data ?? fd);
              const fieldData = activeSelector(draft);
              if (fieldData) {
                fieldData[fieldId] = selected;
              }
            }));
          } else {
            // Sync to local state
            setLocalSelectedItems(selected as any[]);
          }
        }
      },
    });
    return sel;
  // Only recreate Selection when selectionType changes
  }, [selectionType]);

  // Set items on selection when processedItems changes
  useEffect(() => {
    selection.setItems(processedItems, false);
  }, [processedItems, selection]);

  // Sync selection state when entering selecting mode
  useEffect(() => {
    if (isSelecting && selectedItems) {
      selection.setAllSelected(false);
      for (const item of selectedItems) {
        const key = getItemKey(item);
        selection.setKeySelected(key, true, false);
      }
    }
  // Only run when isSelecting changes, not when selection or selectedItems change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelecting]);

  // Items to display - all items when selecting or when selectionType is 'none', only selected items otherwise
  const displayItems = useMemo(() => {
    if (isSelecting) {
      return processedItems;
    }
    // When selectionType is 'none', show all items (display-only list)
    if (selectionType === 'none') {
      return processedItems;
    }
    // Apply listCompare to selected items if provided
    if (listCompare && selectedItems.length > 0) {
      return [...selectedItems].sort(listCompare);
    }
    return selectedItems;
  }, [isSelecting, processedItems, selectedItems, listCompare, selectionType]);

  const isEmpty = displayItems.length === 0 && !isSelecting;

  // Get column sizes from theme (centralized configuration)
  const columnSizes = theme.mois.columnSizes;

  // Convert columns from MDX format {id, title, type, size, compute, itemId, onColumnMap} to IColumn format
  const convertedColumns: IColumn[] = useMemo(() => {
    return columns.map((col: any) => {
      // If already in IColumn format (has key and name), return as-is
      if (col.key && col.name) {
        return col;
      }

      // Use itemId if provided, otherwise use id
      const fieldId = col.itemId || col.id;

      // Get size-based widths from theme or use defaults
      const sizeConfig = col.size ? columnSizes[col.size as keyof typeof columnSizes] : { minWidth: 100, maxWidth: 300 };

      // Convert from MDX format
      const converted: IColumn = {
        key: fieldId,
        name: col.title || '',
        fieldName: fieldId,
        minWidth: col.type === 'key' || col.type === 'hidden' ? 0 : sizeConfig.minWidth,
        maxWidth: col.type === 'key' || col.type === 'hidden' ? 0 : sizeConfig.maxWidth,
        isMultiline: true,
      };

      // Hide key and hidden columns
      if (col.type === 'key' || col.type === 'hidden') {
        converted.minWidth = 0;
        converted.maxWidth = 0;
        converted.isCollapsible = true;
        converted.data = { isHidden: true };
      }

      // Handle date types
      if (col.type === 'date') {
        converted.minWidth = 80;
        converted.maxWidth = 100;
      }
      if (col.type === 'dateTime') {
        converted.minWidth = 140;
        converted.maxWidth = 180;
      }

      // Handle computed columns (compute or onColumnMap)
      if (col.compute || col.onColumnMap) {
        const computeFn = col.compute || col.onColumnMap;
        converted.onRender = (item: any) => {
          try {
            return computeFn(item);
          } catch {
            return '';
          }
        };
      }
      return converted;
    }).filter((col: IColumn) => !col.data?.isHidden);
  }, [columns, columnSizes]);

  // Only add marginLeft when there's a label (matches source behavior using theme)
  const listContainerStyle: React.CSSProperties = label ? {
    marginLeft: theme.mois.subcontrolIndent,
  } : {};

  const getSelectionMode = () => {
    if (readOnly || !isSelecting) return SelectionMode.none;
    switch (selectionType) {
      case 'multiple': return SelectionMode.multiple;
      case 'single': return SelectionMode.single;
      default: return SelectionMode.none;
    }
  };

  const handleButtonClick = () => {
    setIsSelecting(!isSelecting);
  };

  // Render rows with alternating colors using theme
  const onRenderRow = useCallback((props?: IDetailsRowProps, defaultRender?: (props?: IDetailsRowProps) => JSX.Element | null) => {
    if (!props) return null;
    const rowIndex = props.itemIndex;
    const isEvenRow = rowIndex % 2 === 0;
    const customStyles = {
      root: {
        backgroundColor: isEvenRow ? theme.mois.zebraContrastBackground : '#ffffff',
        cursor: isSelecting ? 'pointer' : 'default',
      },
    };

    // data-selection-toggle enables click-to-select in FluentUI
    return (
      <div data-selection-toggle="true">
        <DetailsRow
          {...props}
          styles={customStyles}
        />
      </div>
    );
  }, [theme.mois.zebraContrastBackground, isSelecting]);

  // Custom header renderer for noHeaders
  const onRenderDetailsHeader = noHeaders ? () => null : undefined;

  // Only show button/label when NOT readOnly AND there are items
  const showSelectButton = !readOnly && processedItems.length > 0;

  return (
    <div style={hidden ? { display: 'none' } : {}}>
      {showSelectButton && (
        <LayoutItem
          actions={actions}
          disabled={disabled}
          fieldId={resolvedFieldId ?? undefined}
          hidden={false}
          id={id}
          index={index}
          isComplete={isComplete}
          isEmpty={isEmpty}
          label={label}
          labelPosition={labelPosition}
          labelProps={labelProps}
          layoutId={resolvedLayoutId ?? undefined}
          moisModule={moisModule}
          note={note}
          placement={placement}
          readOnly={readOnly}
          required={required}
          section={sectionProp}
          size={size}
        >
          <DefaultButton
            toggle
            iconProps={{ iconName: isSelecting ? 'Completed' : 'MultiSelect' }}
            text={isSelecting ? doneText : selectText}
            checked={isSelecting}
            onClick={handleButtonClick}
            disabled={disabled}
          />
        </LayoutItem>
      )}
      {isSelecting ? (
        <div style={listContainerStyle}>
          {children}
          <DetailsList
            columns={convertedColumns}
            items={processedItems}
            onRenderDetailsHeader={onRenderDetailsHeader}
            selection={selection}
            selectionMode={getSelectionMode()}
            selectionZoneProps={{
              selection,
              isSelectedOnFocus: false,
            }}
            onRenderRow={onRenderRow}
            checkboxVisibility={CheckboxVisibility.always}
            layoutMode={DetailsListLayoutMode.justified}
            compact
            constrainMode={ConstrainMode.horizontalConstrained}
            {...detailsListProps}
          />
        </div>
      ) : (
        <div style={listContainerStyle}>
          <DetailsList
            selectionMode={SelectionMode.none}
            items={displayItems}
            getKey={getItemKey}
            columns={convertedColumns}
            onRenderDetailsHeader={onRenderDetailsHeader}
            onRenderRow={onRenderRow}
            checkboxVisibility={CheckboxVisibility.hidden}
            layoutMode={DetailsListLayoutMode.justified}
            compact
            constrainMode={ConstrainMode.horizontalConstrained}
            {...detailsListProps}
          />
        </div>
      )}
      {processedItems.length === 0 && <div>{placeholder}</div>}
    </div>
  );
};

/**
 * ListSelectionDemo1 - Multiple selection example (Long Term Medications) - empty list
 */
export const ListSelectionDemo1: React.FC = () => {
  const columns: IColumn[] = [
    { key: 'startDate', name: 'Date', fieldName: 'startDate', minWidth: 100, maxWidth: 100 },
    { key: 'medication', name: 'Medication', fieldName: 'medication', minWidth: 340, maxWidth: 340, isMultiline: true },
    { key: 'doseFrequency', name: 'Dose Frequency', fieldName: 'doseFrequency', minWidth: 200, maxWidth: 200, isMultiline: true },
  ];

  return (
    <ListSelection
      label="Long Term Medications"
      columns={columns}
      items={[]}
      selectText="Refill medications"
      selectionType="multiple"
    />
  );
};

/**
 * ListSelectionDemo2 - Single selection example (Referral / Service Request) with data
 */
export const ListSelectionDemo2: React.FC = () => {
  const columns: IColumn[] = [
    { key: 'orderDate', name: 'Date', fieldName: 'orderDate', minWidth: 100, maxWidth: 100 },
    { key: 'order', name: 'Order', fieldName: 'order', minWidth: 195, maxWidth: 195, isMultiline: true },
    { key: 'orderedBy', name: 'Ordered by', fieldName: 'orderedBy', minWidth: 100, maxWidth: 100, isMultiline: true },
    { key: 'status', name: 'Status', fieldName: 'status', minWidth: 100, maxWidth: 100, isMultiline: true },
    { key: 'serviceRequestType', name: 'Type', fieldName: 'serviceRequestType', minWidth: 100, maxWidth: 100, isMultiline: true },
  ];

  const items = [
    { orderDate: '2015-09-16', order: 'DIABETES, TYPE 2, - UNCOMPLICATED', orderedBy: 'HARPER, S.', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
    { orderDate: '2016-07-12', order: 'ABDOMINAL ORGAN INJURY/LATE EFFECT', orderedBy: 'DR. pluto dog', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
    { orderDate: '2017-03-14', order: 'HEAD LICE', orderedBy: 'MOISCON', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
    { orderDate: '2017-03-14', order: 'DEPRESSIVE DISORDER, NOT ELSEWHERE CLASSIFIED', orderedBy: 'SAMWAYS, K.', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
  ];

  return (
    <ListSelection
      label="Referral / Service Request Reason"
      columns={columns}
      items={items}
      selectText="Change selection"
      selectionType="single"
    />
  );
};

/**
 * ListSelectionDemo5 - Multiple selection in selection mode (Long Term Medications with Done button)
 */
export const ListSelectionDemo5: React.FC = () => {
  const columns: IColumn[] = [
    { key: 'startDate', name: 'Date', fieldName: 'startDate', minWidth: 100, maxWidth: 100 },
    { key: 'medication', name: 'Medication', fieldName: 'medication', minWidth: 315, maxWidth: 315, isMultiline: true },
    { key: 'doseFrequency', name: 'Dose Frequency', fieldName: 'doseFrequency', minWidth: 180, maxWidth: 180, isMultiline: true },
  ];

  const items = [
    { startDate: '', medication: 'BETA CAROTENE', doseFrequency: '' },
    { startDate: '', medication: 'ADVIL GEL CAPLETS', doseFrequency: '' },
    { startDate: '2017-05-30', medication: 'IBUPROFEN-600 TAB 600MG', doseFrequency: 'po q6h prn' },
    { startDate: '', medication: 'CALCIUM COMPLETE WITH MAGNESIUM AND VITAMIN C', doseFrequency: '' },
    { startDate: '', medication: 'VITAMIN B COMPLEX', doseFrequency: '' },
    { startDate: '', medication: 'MULTIVITAMIN AND MINERALS FOR WOMEN', doseFrequency: '' },
  ];

  return (
    <ListSelection
      label="Long Term Medications"
      columns={columns}
      items={items}
      selectText="Change selection"
      selectionType="multiple"
      initialSelecting={true}
    />
  );
};

/**
 * ListSelectionDemo6 - Single selection in selection mode (Referral / Service Request with Done button)
 */
export const ListSelectionDemo6: React.FC = () => {
  const columns: IColumn[] = [
    { key: 'orderDate', name: 'Date', fieldName: 'orderDate', minWidth: 100, maxWidth: 100 },
    { key: 'order', name: 'Order', fieldName: 'order', minWidth: 195, maxWidth: 195, isMultiline: true },
    { key: 'orderedBy', name: 'Ordered by', fieldName: 'orderedBy', minWidth: 100, maxWidth: 100, isMultiline: true },
    { key: 'status', name: 'Status', fieldName: 'status', minWidth: 100, maxWidth: 100, isMultiline: true },
    { key: 'serviceRequestType', name: 'Type', fieldName: 'serviceRequestType', minWidth: 100, maxWidth: 100, isMultiline: true },
  ];

  const items = [
    { orderDate: '2015-09-16', order: 'DIABETES, TYPE 2, - UNCOMPLICATED', orderedBy: 'HARPER, S.', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
    { orderDate: '2016-07-12', order: 'ABDOMINAL ORGAN INJURY/LATE EFFECT', orderedBy: 'DR. pluto dog', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
    { orderDate: '2017-03-14', order: 'HEAD LICE', orderedBy: 'MOISCON', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
    { orderDate: '2017-03-14', order: 'DEPRESSIVE DISORDER, NOT ELSEWHERE CLASSIFIED', orderedBy: 'SAMWAYS, K.', status: 'In process, unspecified', serviceRequestType: 'Medical Consultation Request' },
  ];

  return (
    <ListSelection
      label="Referral / Service Request Reason"
      columns={columns}
      items={items}
      selectText="Change selection"
      selectionType="single"
      initialSelecting={true}
    />
  );
};

/**
 * ListSelectionDemo3 - Example with computed columns and data
 */
export const ListSelectionDemo3: React.FC = () => {
  const columns: IColumn[] = [
    { key: 'duration', name: 'Duration', fieldName: 'duration', minWidth: 100, maxWidth: 103, isMultiline: true },
    { key: 'medication', name: 'Medication', fieldName: 'medication', minWidth: 180, maxWidth: 180, isMultiline: true },
    { key: 'doseFrequency', name: 'Dose Frequency', fieldName: 'doseFrequency', minWidth: 180, maxWidth: 180, isMultiline: true },
    { key: 'created', name: 'Created', fieldName: 'created', minWidth: 180, maxWidth: 180 },
  ];

  const items = [
    {
      duration: '8 years',
      medication: 'IBUPROFEN-600 TAB 600MG',
      doseFrequency: 'po q6h prn',
      created: '2017-05-30 13:24:17',
    },
  ];

  return (
    <ListSelection
      label="Long Term Medications"
      columns={columns}
      items={items}
      selectText="Select medication"
      selectionType="multiple"
    />
  );
};

/**
 * ListSelectionDemo4 - Long list of code values
 */
export const ListSelectionDemo4: React.FC = () => {
  const columns: IColumn[] = [
    { key: 'code', name: 'Code', fieldName: 'code', minWidth: 180, maxWidth: 180, isMultiline: true },
    { key: 'display', name: 'Term', fieldName: 'display', minWidth: 290, maxWidth: 293, isMultiline: true },
    { key: 'system', name: 'System', fieldName: 'system', minWidth: 70, maxWidth: 70, isMultiline: true },
    { key: 'category', name: 'Category', fieldName: 'category', minWidth: 100, maxWidth: 100, isMultiline: true },
  ];

  const items = [
    { code: '116289008', display: 'ABDOMINAL BLOATING', system: 'SNOMED', category: 'FINDING' },
    { code: '19429009', display: 'CHRONIC ULCER OF SKIN', system: 'SNOMED', category: 'DISORDER' },
    { code: 'U71', display: 'CYSTITIS/URINARY INFECTION OTHER', system: 'ICPC2', category: 'INFECTIONS' },
    { code: '200767005', display: 'DANDRUFF', system: 'SNOMED', category: 'DISORDER' },
    { code: 'D41', display: 'DIAGNOSTIC RADIOLOGY/IMAGING', system: 'ICPC2', category: 'SCREENING/PREV' },
    { code: 'D56', display: 'DRESSING/PRESSURE/COMPRESS/TAMPONADE', system: 'ICPC2', category: 'MEDICATION/TX' },
    { code: '247332007', display: 'EAR FEELS FULL OF WATER', system: 'SNOMED', category: 'FINDING' },
    { code: 'D65', display: 'ENC/PROB INIT BY OTHER THAN PT/PROV', system: 'ICPC2', category: 'ADMINISTRATIVE' },
    { code: '286235751000087106', display: 'ENVIRONMENTAL INTOLERANCE', system: 'SNOMED', category: 'DISORDER' },
    { code: 'F13', display: 'EYE SENSATION ABNORMAL', system: 'ICPC2', category: 'SUBJECTIVE' },
  ];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'column',
    justifyContent: 'space-between',
    height: '400px',
    overflow: 'auto',
  };

  return (
    <div>
      <div style={containerStyle}>
        <div>
          <div style={{ marginLeft: '2em' }}>
            <DetailsList
              items={items}
              columns={columns}
              layoutMode={DetailsListLayoutMode.fixedColumns}
              selectionMode={SelectionMode.none}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListSelection;
