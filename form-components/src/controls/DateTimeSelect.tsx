/**
 * DateTimeSelect Component
 * The DateTimeSelect control is used to display and edit date-time elements. *EXPERIMENTAL
 * Composes DateSelect and TimeSelect components.
 */

import React, { useEffect, useState } from 'react';
import { IDatePickerProps } from '@fluentui/react';
import { DateSelect } from './DateSelect';
import { TimeSelect } from '../controls/TimeSelect';
import { LayoutItem } from '../controls/LayoutItem';
import { useActiveDataForForms } from '../hooks/form-state';

export interface DateTimeSelectProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Show border around entry field */
  borderless?: boolean;
  /** Override props to underlying DatePicker component */
  datePickerProps?: Partial<IDatePickerProps>;
  /** Initial date value YYYY-MM-DD, YYYY/MM/DD, or YYYY.MM.DD */
  defaultValue?: string;
  /** Default time value HH:MM */
  defaultTime?: string;
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
  /** onChange callback */
  onChange?: (value: { date?: string; time?: string }) => void;
  /** Placeholder string for date field */
  placeholder?: string;
  /** Override field placement */
  placement?: string | number;
  /** A readOnly control is always view only */
  readOnly?: boolean;
  /** Is this field required to have a value? */
  required?: boolean;
  /** Advanced: Override section settings */
  section?: any;
  /** Size indicator */
  size?: 'small' | 'medium' | 'large' | React.CSSProperties;
  /** Always place date over time (vertical layout) */
  vertical?: boolean;
}

export const DateTimeSelect: React.FC<DateTimeSelectProps> = ({
  actions,
  borderless,
  datePickerProps,
  defaultValue,
  defaultTime = '00:00',
  disabled,
  fieldId,
  hidden,
  id,
  index,
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
  required,
  section,
  size = 'medium',
  vertical,
}) => {
  const [activeData, setActiveData] = useActiveDataForForms();
  const effectiveFieldId = fieldId || id;
  const activeValue = effectiveFieldId ? activeData?.field?.data?.[effectiveFieldId] : undefined;
  const persistedDate = activeValue && typeof activeValue === 'object' && typeof activeValue.date === 'string'
    ? activeValue.date
    : undefined;
  const persistedTime = activeValue && typeof activeValue === 'object' && typeof activeValue.time === 'string'
    ? activeValue.time
    : undefined;
  const [dateValue, setDateValue] = useState<string | undefined>(persistedDate ?? defaultValue);
  const [timeValue, setTimeValue] = useState<string>(persistedTime ?? defaultTime);

  useEffect(() => {
    setDateValue(persistedDate ?? defaultValue);
  }, [defaultValue, persistedDate]);

  useEffect(() => {
    setTimeValue(persistedTime ?? defaultTime);
  }, [defaultTime, persistedTime]);

  if (hidden) return null;

  const updateActiveData = (nextDate?: string, nextTime?: string) => {
    if (!effectiveFieldId) return;
    setActiveData((draft: any) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] };
      if (!draft.field.data) draft.field.data = {};
      if (!nextDate && !nextTime) {
        draft.field.data[effectiveFieldId] = null;
        (linkedFieldIds ?? []).forEach((linkedFieldId) => {
          if (!linkedFieldId || linkedFieldId === effectiveFieldId) return;
          draft.field.data[linkedFieldId] = null;
        });
        return;
      }
      const nextValue = {
        date: nextDate,
        time: nextTime,
      };
      draft.field.data[effectiveFieldId] = nextValue;
      (linkedFieldIds ?? []).forEach((linkedFieldId) => {
        if (!linkedFieldId || linkedFieldId === effectiveFieldId) return;
        draft.field.data[linkedFieldId] = { ...nextValue };
      });
    });
  };

  const handleDateChange = (value: string) => {
    setDateValue(value);
    updateActiveData(value, timeValue);
    onChange?.({ date: value, time: timeValue });
  };

  const handleTimeChange = (_: any, value: string) => {
    setTimeValue(value);
    updateActiveData(dateValue, value);
    onChange?.({ date: dateValue, time: value });
  };

  // The inner date/time fields container
  const dateTimeContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: vertical ? 'column nowrap' : 'row wrap',
    gap: '0px 10px',
  };

  // The composite date-time input element
  const dateTimeElement = (
    <div style={dateTimeContainerStyle}>
      <div style={{ flex: '2 2 0', minWidth: '120px' }}>
        <DateSelect
          inline
          placeholder={placeholder}
          defaultValue={defaultValue}
          value={dateValue}
          disabled={disabled}
          readOnly={readOnly}
          borderless={borderless}
          required={required}
          onChange={handleDateChange}
          datePickerProps={datePickerProps}
        />
      </div>
      <div style={{ flex: '1 1 0', minWidth: '60px' }}>
        <TimeSelect
          inline
          defaultValue={defaultTime}
          value={timeValue}
          disabled={disabled}
          readOnly={readOnly}
          borderless={borderless}
          onChange={handleTimeChange}
        />
      </div>
    </div>
  );

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
      size={size}
    >
      {dateTimeElement}
    </LayoutItem>
  );
};

// Demo component for the example
export const DateTimeSelectDemo: React.FC = () => {
  return <DateTimeSelect label="this is for hours and minutes" />;
};

export default DateTimeSelect;
