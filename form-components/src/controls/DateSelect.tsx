/**
 * DateSelect Component
 * Date picker control with MOIS styling
 */

import React, { useEffect, useState } from 'react';
import { DatePicker, DefaultButton, IDatePickerProps, Stack, Toggle } from '@fluentui/react';
import { LayoutItem } from '../controls/LayoutItem';
import { useActiveDataForForms } from '../hooks/form-state';

type SupportedDateFormat = 'yyyy.MM.dd' | 'dd/MM/yyyy' | 'MM-dd-yyyy' | 'yyyy-MM-dd';
const DEFAULT_DATE_FORMAT: SupportedDateFormat = 'yyyy.MM.dd';
const DATE_PLACEHOLDER_MAP: Record<SupportedDateFormat, string> = {
  'yyyy.MM.dd': 'YYYY.MM.DD',
  'dd/MM/yyyy': 'DD/MM/YYYY',
  'MM-dd-yyyy': 'MM-DD-YYYY',
  'yyyy-MM-dd': 'YYYY-MM-DD',
};

export interface DateSelectProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Show border around entry field */
  borderless?: boolean;
  /** Add button controls to DateSelect */
  buttonControls?: boolean;
  /** Override props to underlying Fluent component */
  datePickerProps?: Partial<IDatePickerProps>;
  /** Display format for the rendered date value */
  dateFormat?: SupportedDateFormat;
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

export const formatCanonicalDate = (date?: Date): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const createDate = (year: number, month: number, day: number): Date | undefined => {
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return undefined;
  }
  return parsed;
};

const parseDateByFormat = (dateStr: string, format: SupportedDateFormat): Date | undefined => {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  if (!trimmed) return undefined;

  const separatorPattern = '[./-]';
  let match: RegExpMatchArray | null = null;
  switch (format) {
    case 'dd/MM/yyyy':
      match = trimmed.match(new RegExp(`^(\\d{1,2})${separatorPattern}(\\d{1,2})${separatorPattern}(\\d{4})$`));
      return match ? createDate(Number(match[3]), Number(match[2]), Number(match[1])) : undefined;
    case 'MM-dd-yyyy':
      match = trimmed.match(new RegExp(`^(\\d{1,2})${separatorPattern}(\\d{1,2})${separatorPattern}(\\d{4})$`));
      return match ? createDate(Number(match[3]), Number(match[1]), Number(match[2])) : undefined;
    case 'yyyy-MM-dd':
    case 'yyyy.MM.dd':
    default:
      match = trimmed.match(new RegExp(`^(\\d{4})${separatorPattern}(\\d{1,2})${separatorPattern}(\\d{1,2})$`));
      return match ? createDate(Number(match[1]), Number(match[2]), Number(match[3])) : undefined;
  }
};

export const parseDateValue = (
  dateStr: string,
  preferredFormat: SupportedDateFormat = DEFAULT_DATE_FORMAT
): Date | undefined => {
  if (!dateStr) return undefined;

  const formats = Array.from(new Set<SupportedDateFormat>([
    preferredFormat,
    DEFAULT_DATE_FORMAT,
    'yyyy-MM-dd',
    'dd/MM/yyyy',
    'MM-dd-yyyy',
  ]));

  for (const format of formats) {
    const parsed = parseDateByFormat(dateStr, format);
    if (parsed) return parsed;
  }

  return undefined;
};

const formatDisplayDate = (
  date: Date | undefined,
  format: SupportedDateFormat = DEFAULT_DATE_FORMAT
): string => {
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (format) {
    case 'dd/MM/yyyy':
      return `${day}/${month}/${year}`;
    case 'MM-dd-yyyy':
      return `${month}-${day}-${year}`;
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`;
    case 'yyyy.MM.dd':
    default:
      return `${year}.${month}.${day}`;
  }
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

const calculateAge = (date: Date | undefined): string => {
  if (!date) return '';
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDelta = today.getMonth() - date.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 ? `${age} years` : '';
};

export const DateSelect: React.FC<DateSelectProps> = ({
  actions,
  borderless,
  buttonControls,
  componentFields,
  datePickerProps,
  dateFormat = DEFAULT_DATE_FORMAT,
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
  placeholder,
  placement,
  readOnly,
  refresh,
  required,
  section,
  showAge,
  size = 'small',
  sourceId,
  value,
}) => {
  const [activeData, setActiveData] = useActiveDataForForms();
  const effectiveFieldId = fieldId || id;
  const activeValue = effectiveFieldId ? activeData?.field?.data?.[effectiveFieldId] : undefined;
  const compositeValue = buildDateFromComponents(componentFields, activeData?.field?.data);
  const resolvedValue =
    value !== undefined
      ? value
      : (typeof activeValue === 'string' ? activeValue : '') || compositeValue || defaultValue || '';
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    parseDateValue(resolvedValue, dateFormat)
  );
  const resolvedPlaceholder = placeholder ?? DATE_PLACEHOLDER_MAP[dateFormat] ?? DATE_PLACEHOLDER_MAP[DEFAULT_DATE_FORMAT];

  useEffect(() => {
    setSelectedDate(parseDateValue(resolvedValue, dateFormat));
  }, [dateFormat, resolvedValue]);

  useEffect(() => {
    if (!effectiveFieldId || value !== undefined || compositeValue || !defaultValue) return;
    if (
      typeof activeValue === 'string'
        ? activeValue.trim().length > 0
        : activeValue !== undefined && activeValue !== null
    ) {
      return;
    }

    const parsedDefault = parseDateValue(defaultValue, dateFormat);
    if (!parsedDefault) return;
    const formatted = formatCanonicalDate(parsedDefault);

    setActiveData((draft: any) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] };
      if (!draft.field.data) draft.field.data = {};

      const currentValue = draft.field.data?.[effectiveFieldId];
      if (
        typeof currentValue === 'string'
          ? currentValue.trim().length > 0
          : currentValue !== undefined && currentValue !== null
      ) {
        return;
      }

      draft.field.data[effectiveFieldId] = formatted;
      (linkedFieldIds ?? []).forEach((linkedFieldId) => {
        if (!linkedFieldId || linkedFieldId === effectiveFieldId) return;
        draft.field.data[linkedFieldId] = formatted;
      });

      if (Array.isArray(componentFields) && componentFields.length > 0) {
        const [year, month, day] = formatted.split('.');
        componentFields.forEach((component: { fieldId: string; role: string }) => {
          if (!component?.fieldId) return;
          const nextValue =
            component.role === 'year' ? year
              : component.role === 'month' ? month
                : component.role === 'day' ? day
                  : null;
          draft.field.data[component.fieldId] = nextValue;
        });
      }
    });
  }, [
    activeValue,
    componentFields,
    compositeValue,
    dateFormat,
    defaultValue,
    effectiveFieldId,
    linkedFieldIds,
    setActiveData,
    value,
  ]);

  if (hidden) return null;

  const handleDateChange = (date: Date | null | undefined) => {
    setSelectedDate(date || undefined);
    const formatted = date ? formatCanonicalDate(date) : '';

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

  const datePickerInput = (
    <DatePicker
      value={selectedDate}
      onSelectDate={handleDateChange}
      placeholder={resolvedPlaceholder}
      disabled={disabled || readOnly}
      borderless={borderless || readOnly}
      formatDate={(date) => formatDisplayDate(date, dateFormat)}
      allowTextInput={true}
      disableAutoFocus={true}
      parseDateFromString={(str) => parseDateValue(str, dateFormat) || null}
      tabIndex={readOnly ? -1 : undefined}
      styles={{
        root: { flex: '2 2 0', minWidth: '80px', maxWidth: '160px' },
        textField: { width: '100%' },
      }}
      {...datePickerProps}
    />
  );

  const datePickerElement = buttonControls && !inline ? (
    <div>
      {datePickerInput}
      {!readOnly && (
        <Stack horizontal tokens={{ childrenGap: 8 }} styles={{ root: { marginTop: 8 } }}>
          <DefaultButton text="Today" onClick={() => handleDateChange(new Date())} disabled={disabled} />
          <DefaultButton text="Clear" onClick={() => handleDateChange(null)} disabled={disabled} />
        </Stack>
      )}
    </div>
  ) : (
    datePickerInput
  );

  if (inline) {
    return (
      <DatePicker
        value={selectedDate}
        onSelectDate={handleDateChange}
        placeholder={resolvedPlaceholder}
        disabled={disabled || readOnly}
        borderless={borderless || readOnly}
        formatDate={(date) => formatDisplayDate(date, dateFormat)}
        allowTextInput={true}
        disableAutoFocus={true}
        parseDateFromString={(str) => parseDateValue(str, dateFormat) || null}
        tabIndex={readOnly ? -1 : undefined}
        styles={{
          root: { width: '100%' },
          textField: { width: '100%' },
        }}
        {...datePickerProps}
      />
    );
  }

  const resolvedLabel = showAge && label
    ? (() => {
        const age = calculateAge(selectedDate);
        return age ? `${label} (${age})` : label;
      })()
    : label;

  return (
    <LayoutItem
      actions={actions}
      disabled={disabled}
      fieldId={fieldId}
      hidden={hidden}
      id={id}
      index={index}
      isComplete={isComplete}
      label={resolvedLabel}
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
