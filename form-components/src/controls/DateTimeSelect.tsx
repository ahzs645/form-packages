/**
 * DateTimeSelect Component
 * The DateTimeSelect control is used to display and edit date-time elements. *EXPERIMENTAL
 * Composes DateSelect and TimeSelect components.
 */

import React, { useState } from 'react';
import { IDatePickerProps } from '@fluentui/react';
import { DateSelect } from './DateSelect';
import { TimeSelect } from '../controls/TimeSelect';
import { LayoutItem } from '../controls/LayoutItem';

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
  const [dateValue, setDateValue] = useState<string | undefined>(defaultValue);
  const [timeValue, setTimeValue] = useState<string>(defaultTime);

  if (hidden) return null;

  const handleDateChange = (value: string) => {
    setDateValue(value);
    onChange?.({ date: value, time: timeValue });
  };

  const handleTimeChange = (_: any, value: string) => {
    setTimeValue(value);
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
