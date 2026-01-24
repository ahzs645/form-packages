import React from 'react';

export interface AuditStampData {
  createTime?: string | Date;
  createUser?: string;
  modifyTime?: string | Date;
  modifyUser?: string;
}

export interface AuditStampProps {
  /** The audit stamp data containing creation and modification info */
  data?: AuditStampData;
  /** Field ID for the stamp */
  fieldId?: string;
  /** Label for the field */
  label?: string;
  /** Size variant */
  size?: 'min' | 'tiny' | 'small' | 'medium' | 'large' | 'max';
  children?: React.ReactNode;
  [key: string]: any;
}

/**
 * Formats a date in MOIS format: YYYY.MM.DD - HH:mm
 */
function formatMoisDate(date: string | Date | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day}\u00A0-\u00A0${hours}:${minutes}`;
}

/**
 * AuditStamp
 * The AuditStamp control is used to display the audit stamp of a MOIS object
 *
 * The AuditStamp control is used to display the audit stamp of a MOIS object
 * in a manner compatible with the MOIS Layout controls.
 *
 */
export const AuditStamp: React.FC<AuditStampProps> = (props) => {
  const {
    data,
    fieldId = 'stamp',
    label = 'History',
    size = 'medium',
    children,
    ...rest
  } = props;

  // Default sample data for demonstration
  const stampData: AuditStampData = data || {
    createTime: '2015-03-11T14:58:00',
    createUser: 'Alyssa',
    modifyTime: '2017-03-30T12:27:00',
    modifyUser: 'ADMINISTRATOR'
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '5em 9em 1fr'
  };

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexFlow: 'wrap',
    minWidth: '160px',
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif",
    fontSize: '14px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } as React.CSSProperties;

  const innerWrapperStyle: React.CSSProperties = {
    flex: '2 1 0%',
    display: 'flex',
    flexFlow: 'wrap',
    minWidth: '160px'
  };

  return (
    <div data-component="AuditStamp" {...rest}>
      <div style={wrapperStyle}>
        <div style={innerWrapperStyle}>
          <div style={gridStyle}>
            <div>Created:</div>
            <div>{formatMoisDate(stampData.createTime)}</div>
            <div>{stampData.createUser}</div>
            <div>Modified:</div>
            <div>{formatMoisDate(stampData.modifyTime)}</div>
            <div>{stampData.modifyUser}</div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};

export default AuditStamp;
