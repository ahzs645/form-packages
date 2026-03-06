/**
 * DateSelect Component
 * Date picker control with MOIS styling
 */

import React, { useEffect, useState } from 'react';
import { DatePicker, Label, Stack, Toggle, IDatePickerProps } from '@fluentui/react';
import { LayoutItem } from '../controls/LayoutItem';
import { useActiveDataForForms } from '../hooks/form-state';

export interface DateSelectProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Show border around entry field */
  borderless?: boolean;
  /** Add button controls to DateSelect */
  buttonControls?: boolean;
  /** Override props to underlying Fluent component */
  datePickerProps?: Partial<IDatePickerProps>;
  /** Optional mapping for composite date fields (day/month/year PDF fields) */
  componentFields?: Array<{
    fieldId: string;
    role: "day" | "month" | "year" | string;
  }>;
  /** Initial date value in formats: YYYY-MM-DD, YYYY/MM/DD, or YYYY.MM.DD */
  defaultValue?: string;
  /** Indicate whether the field is disabled or not */
  disabled?: boolean;
  /** Active field name */
  fieldId?: string;
  /** Hidden fields are not shown at all */
  hidden?: boolean;
  /** Source and active field name */
  id?: string;
  /** List index used to distinguish rows/columns in grid and flowsheet layouts */
  index?: number;
  /** Override section completion status */
  isComplete?: boolean;
  /** Label for this field */
  label?: string;
  /** Additional field ids that should mirror this field's value. */
  linkedFieldIds?: string[];
  /** Label position relative to field contents */
  labelPosition?: 'top' | 'left' | 'none';
  /** Identifier for selective layout */
  layoutId?: string;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** Annotation shown near the control */
  note?: string;
  /** onChange callback for updating value */
  onChange?: (value: any) => void;
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
  section?: any;
  /** Flag that if set will cause the age to be displayed in the label */
  showAge?: boolean;
  /** Size indicator */
  size?: string | React.CSSProperties;
  /** Source field name */
  sourceId?: string;
  /** Value for this field */
  value?: string;
  /** Render just the input without wrapper divs (for composition) */
  inline?: boolean;
}

const formatDate = (date?: Date): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const parseDate = (dateStr: string): Date | undefined => {
  if (!dateStr) return undefined;
  // Support YYYY-MM-DD, YYYY/MM/DD, or YYYY.MM.DD
  const normalized = dateStr.replace(/[\/\.]/g, '-');
  const parts = normalized.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return undefined;
};

const buildDateFromComponents = (
  componentFields: DateSelectProps["componentFields"],
  fieldData: Record<string, any> | undefined
): string => {
  if (!Array.isArray(componentFields) || componentFields.length === 0 || !fieldData) {
    return "";
  }

  const byRole = new Map<string, string>();
  componentFields.forEach((component) => {
    const rawValue = fieldData[component.fieldId];
    if (rawValue === undefined || rawValue === null) return;
    const value = String(rawValue).trim();
    if (!value) return;
    byRole.set(component.role, value);
  });

  const year = byRole.get("year");
  const month = byRole.get("month");
  const day = byRole.get("day");

  if (!year || !month || !day) return "";

  const normalizedYear = year.padStart(4, "0");
  const normalizedMonth = month.padStart(2, "0");
  const normalizedDay = day.padStart(2, "0");
  return `${normalizedYear}.${normalizedMonth}.${normalizedDay}`;
};

export const DateSelect: React.FC<DateSelectProps> = ({
  actions,
  borderless,
  componentFields,
  datePickerProps,
  defaultValue,
  disabled,
  fieldId,
  hidden,
  id,
  index,
  inline,
  isComplete,
  label,
  linkedFieldIds,
  labelPosition,
  layoutId,
  moisModule,
  note,
  onChange,
  placeholder = 'YYYY.MM.DD',
  placement,
  readOnly,
  refresh,
  required,
  section,
  size = 'small',
  sourceId,
  value,
}) => {
  const [activeData, setActiveData] = useActiveDataForForms();
  const effectiveFieldId = fieldId || id;
  const activeValue = effectiveFieldId ? activeData?.field?.data?.[effectiveFieldId] : undefined;
  const compositeValue = buildDateFromComponents(componentFields, activeData?.field?.data);
  const resolvedValue =
    value ||
    (typeof activeValue === 'string' ? activeValue : '') ||
    compositeValue ||
    defaultValue ||
    '';
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    parseDate(resolvedValue)
  );

  useEffect(() => {
    setSelectedDate(parseDate(resolvedValue));
  }, [resolvedValue]);

  if (hidden) return null;

  const handleDateChange = (date: Date | null | undefined) => {
    setSelectedDate(date || undefined);
    const formatted = date ? formatDate(date) : '';

    if (effectiveFieldId) {
      setActiveData((draft: any) => {
        if (!draft.field) draft.field = { data: {}, status: {}, history: [] };
        if (!draft.field.data) draft.field.data = {};
        draft.field.data[effectiveFieldId] = formatted || null;
        (linkedFieldIds ?? []).forEach((linkedFieldId) => {
          if (!linkedFieldId || linkedFieldId === effectiveFieldId) return;
          draft.field.data[linkedFieldId] = formatted || null;
        });

        if (Array.isArray(componentFields) && componentFields.length > 0) {
          const parsed = formatted
            ? (() => {
                const normalized = formatted.replace(/[\/\.]/g, "-");
                const [year, month, day] = normalized.split("-");
                return { year, month, day };
              })()
            : null;

          componentFields.forEach((component: { fieldId: string; role: string }) => {
            if (!component?.fieldId) return;
            const nextValue = parsed ? parsed[component.role as "year" | "month" | "day"] ?? null : null;
            draft.field.data[component.fieldId] = nextValue;
          });
        }
      });
    }

    if (onChange) {
      onChange(formatted);
    }
  };

  // The core DatePicker element
  const datePickerElement = (
    <DatePicker
      value={selectedDate}
      onSelectDate={handleDateChange}
      placeholder={placeholder}
      disabled={disabled || readOnly}
      borderless={borderless || readOnly}
      formatDate={formatDate}
      allowTextInput={true}
      disableAutoFocus={true}
      parseDateFromString={(str) => parseDate(str) || null}
      tabIndex={readOnly ? -1 : undefined}
      styles={{
        root: { flex: '2 2 0', minWidth: '80px', maxWidth: '160px' },
        textField: { width: '100%' },
      }}
      {...datePickerProps}
    />
  );

  // Inline mode: render DatePicker that fills its container
  if (inline) {
    return (
      <DatePicker
        value={selectedDate}
        onSelectDate={handleDateChange}
        placeholder={placeholder}
        disabled={disabled || readOnly}
        borderless={borderless || readOnly}
        formatDate={formatDate}
        allowTextInput={true}
        disableAutoFocus={true}
        parseDateFromString={(str) => parseDate(str) || null}
        tabIndex={readOnly ? -1 : undefined}
        styles={{
          root: { width: '100%' },
          textField: { width: '100%' },
        }}
        {...datePickerProps}
      />
    );
  }

  // Use LayoutItem for consistent layout handling
  return (
    <LayoutItem
      actions={actions}
      disabled={disabled}
      fieldId={fieldId}
      hidden={hidden}
      id={id}
      index={index}
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
      size={size as 'small' | 'medium' | 'large' | 'max' | React.CSSProperties}
    >
      {datePickerElement}
    </LayoutItem>
  );
};

// Demo 1: Typical use
export const DateSelectDemo1: React.FC = () => {
  return <DateSelect label="Select your favorite date" />;
};

// Demo 2: Readonly/locked state with toggle
export const DateSelectDemo2: React.FC = () => {
  const [isReadOnly, setIsReadOnly] = useState(true);

  return (
    <Stack>
      <Toggle
        label="Lock"
        checked={isReadOnly}
        onText="Readonly"
        offText="Editable"
        onChange={(_, checked) => setIsReadOnly(checked || false)}
      />
      <DateSelect
        label="Select your favorite date"
        readOnly={isReadOnly}
        borderless={isReadOnly}
      />
    </Stack>
  );
};

// Demo 3: Birthday entry
export const DateSelectDemo3: React.FC = () => {
  return <DateSelect label="Enter a birth date" />;
};

// Demo 4: Start/End date range
export const DateSelectDemo4: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  return (
    <>
      <DateSelect
        label="Start date"
        datePickerProps={{
          maxDate: endDate,
          onSelectDate: (date) => setStartDate(date || undefined),
        }}
      />
      <DateSelect
        label="End date"
        datePickerProps={{
          minDate: startDate,
          onSelectDate: (date) => setEndDate(date || undefined),
        }}
      />
    </>
  );
};

// Demo 5: Future date (appointment)
export const DateSelectDemo5: React.FC = () => {
  return (
    <DateSelect
      label="Appointment date"
      datePickerProps={{
        minDate: new Date(),
      }}
    />
  );
};

export default DateSelect;
