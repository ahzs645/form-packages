/**
 * DateTimeSelect Component
 * The DateTimeSelect control is used to display and edit date-time elements. *EXPERIMENTAL
 */

import React, { useEffect, useState } from 'react';
import { DatePicker, IDatePickerProps, MaskedTextField } from '@fluentui/react';
import { formatCanonicalDate, parseDateValue } from './DateSelect';
import { LayoutItem } from '../controls/LayoutItem';
import { useSourceData, useSection, useTheme } from '../context/MoisContext';
import { useActiveDataSlice } from '../hooks/form-state';
import {
  getSectionSourceTarget,
  readSectionActiveFieldValue,
  writeSectionActiveFieldValue,
} from '../runtime/mois-contract';

type SupportedDateFormat = 'yyyy.MM.dd' | 'dd/MM/yyyy' | 'MM-dd-yyyy' | 'yyyy-MM-dd';

const MIN_DATE = new Date(1900, 0, 1);
const MAX_DATE = new Date(2099, 11, 31);

const formatDisplayDate = (date: Date | undefined): string => {
  if (!date) return '';
  return formatCanonicalDate(date);
};

const normalizeTimeText = (value: string | undefined): string => {
  const raw = String(value ?? '').replace(/\s/g, '');
  const match = raw.match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return '00:00';
  const hours = Math.min(Math.max(Number(match[1]), 0), 23);
  const minutes = Math.min(Math.max(Number(match[2]), 0), 59);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatMaskedTime = (value: string | undefined): string => {
  const normalized = normalizeTimeText(value);
  const [hours, minutes] = normalized.split(':');
  return `${hours} : ${minutes}`;
};

const timeFromDate = (date: Date | undefined, fallback = '00:00'): string => {
  if (!date || Number.isNaN(date.getTime())) return normalizeTimeText(fallback);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const combineDateTime = (date: Date | undefined, timeText: string): string | null => {
  if (!date || Number.isNaN(date.getTime())) return null;
  const [hours, minutes] = normalizeTimeText(timeText).split(':').map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
};

const readDatePart = (
  value: unknown,
  dateFormat: SupportedDateFormat | undefined,
  defaultValue: string | undefined
): Date | undefined => {
  if (value && typeof value === 'object' && typeof (value as { date?: unknown }).date === 'string') {
    return parseDateValue((value as { date: string }).date, dateFormat);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return parseDateValue(value, dateFormat);
  }
  return parseDateValue(defaultValue ?? '', dateFormat);
};

const readTimePart = (value: unknown, defaultTime: string): string => {
  if (value && typeof value === 'object' && typeof (value as { time?: unknown }).time === 'string') {
    return normalizeTimeText((value as { time: string }).time);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return timeFromDate(parsed, defaultTime);
  }
  return normalizeTimeText(defaultTime);
};

export interface DateTimeSelectProps {
  /** Props for the attached action bar (eg: onEdit, onDelete, etc) */
  actions?: any;
  /** Show border around entry field */
  borderless?: boolean;
  /** Override props to underlying DatePicker component */
  datePickerProps?: Partial<IDatePickerProps>;
  /** Display format for the rendered date value */
  dateFormat?: SupportedDateFormat;
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
  /** Source field name */
  sourceId?: string;
  /** Always place date over time (vertical layout) */
  vertical?: boolean;
}

export const DateTimeSelect: React.FC<DateTimeSelectProps> = ({
  actions,
  borderless,
  datePickerProps,
  dateFormat,
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
  sourceId,
  vertical,
}) => {
  const effectiveFieldId = fieldId || id || sourceId || layoutId;
  const sectionContext = useSection(section);
  // Narrow subscription: re-renders only when this field's value changes.
  const [activeSlice, setActiveData] = useActiveDataSlice((data) => ({
    activeValue: readSectionActiveFieldValue(data, sectionContext, effectiveFieldId),
  }));
  const { activeValue } = activeSlice;
  const sourceData = useSourceData();
  const effectiveReadOnly = !!readOnly;
  const theme = useTheme();
  const sourceTarget = getSectionSourceTarget(sourceData, sectionContext);
  const sourceValue = sourceId || id ? sourceTarget?.[sourceId || id || ''] : undefined;
  const resolvedValue = activeValue ?? sourceValue;
  const resolvedDate = readDatePart(resolvedValue, dateFormat, defaultValue);
  const resolvedTime = readTimePart(resolvedValue, defaultTime);
  const [dateValue, setDateValue] = useState<Date | undefined>(resolvedDate);
  const [timeValue, setTimeValue] = useState<string>(resolvedTime);

  useEffect(() => {
    setDateValue(readDatePart(resolvedValue, dateFormat, defaultValue));
  }, [dateFormat, defaultValue, resolvedValue]);

  useEffect(() => {
    setTimeValue(readTimePart(resolvedValue, defaultTime));
  }, [defaultTime, resolvedValue]);

  useEffect(() => {
    if (!effectiveFieldId || !defaultValue || activeValue !== undefined || effectiveReadOnly) return;
    const parsedDefault = parseDateValue(defaultValue, dateFormat);
    if (!parsedDefault) return;
    const formatted = combineDateTime(parsedDefault, defaultTime);
    if (!formatted) return;

    setActiveData((draft: any) => {
      const currentValue = readSectionActiveFieldValue(draft, sectionContext, effectiveFieldId);
      if (currentValue !== undefined && currentValue !== null) return;
      writeSectionActiveFieldValue(draft, sectionContext, effectiveFieldId, formatted, linkedFieldIds ?? []);
    });
  }, [
    activeValue,
    dateFormat,
    defaultTime,
    defaultValue,
    effectiveFieldId,
    effectiveReadOnly,
    linkedFieldIds,
    sectionContext,
    setActiveData,
  ]);

  if (hidden) return null;

  const commitValue = (nextDate: Date | undefined, nextTime: string) => {
    if (effectiveReadOnly) return;
    const normalizedTime = normalizeTimeText(nextTime);
    const formatted = combineDateTime(nextDate, normalizedTime);
    setDateValue(nextDate);
    setTimeValue(normalizedTime);

    if (effectiveFieldId) {
      setActiveData((draft: any) => {
        writeSectionActiveFieldValue(draft, sectionContext, effectiveFieldId, formatted, linkedFieldIds ?? []);
      });
    }

    onChange?.({
      date: nextDate ? formatCanonicalDate(nextDate) : undefined,
      time: normalizedTime,
    });
  };

  const dateTimeContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: vertical ? 'column nowrap' : 'row wrap',
    gap: '0px 10px',
  };

  const dateTimeElement = (
    <div style={dateTimeContainerStyle}>
      <DatePicker
        disabled={disabled}
        styles={{ root: { flex: '2 2 0', minWidth: '120px' } }}
        disableAutoFocus
        placeholder={placeholder}
        allowTextInput
        formatDate={formatDisplayDate}
        parseDateFromString={(value) => parseDateValue(value, dateFormat) || null}
        minDate={MIN_DATE}
        maxDate={MAX_DATE}
        tabIndex={effectiveReadOnly ? -1 : undefined}
        value={dateValue}
        borderless={borderless ?? effectiveReadOnly}
        onSelectDate={(date) => commitValue(date || undefined, timeValue)}
        textField={{
          iconProps: effectiveReadOnly ? { iconName: '' } : undefined,
          readOnly: effectiveReadOnly,
          styles: {
            fieldGroup: {
              background: required && !dateValue ? theme.mois.requiredBackground : undefined,
            },
          },
        }}
        {...datePickerProps}
      />
      <MaskedTextField
        styles={{ root: { minWidth: '60px', flex: '1 1 0' } }}
        mask="** : **"
        maskChar="0"
        disabled={disabled}
        borderless={borderless ?? effectiveReadOnly}
        readOnly={effectiveReadOnly}
        tabIndex={effectiveReadOnly ? -1 : undefined}
        maskFormat={{ '*': /[0-9]/ }}
        validateOnFocusOut
        value={formatMaskedTime(timeValue)}
        onChange={(_, value) => {
          const nextTime = normalizeTimeText(value);
          commitValue(dateValue, nextTime);
        }}
        onGetErrorMessage={(value) => (
          /^(2[0-3]|[01]?[0-9])\s:\s([0-5]?[0-9])$/.test(value.trim())
            ? undefined
            : 'Not a valid hour'
        )}
      />
    </div>
  );

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
      readOnly={effectiveReadOnly}
      required={required}
      section={section}
      size={size}
    >
      {dateTimeElement}
    </LayoutItem>
  );
};

export const DateTimeSelectDemo: React.FC = () => {
  return <DateTimeSelect label="this is for hours and minutes" />;
};

export default DateTimeSelect;
