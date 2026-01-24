/**
 * NameBlock Component
 * Display essential information related to the patient in a banner format.
 *
 * Shows chart number, patient name, birth date, age, gender, health number,
 * and preferred phone in a horizontal layout with a cyan background.
 */

import React from 'react';
import { Stack, Text, TooltipHost, DirectionalHint } from '@fluentui/react';
import { useActiveData } from '../context/MoisContext';

/** Section info for override settings */
export interface SectionInfo {
  readOnlyOptions?: {
    borderless?: boolean;
  };
}

export interface NameBlockProps {
  /** Active field name */
  fieldId?: string;
  /** Override section completion status */
  isComplete?: boolean;
  /** Optional additional fields that can be added to the NameBlock. Field values take the form of {label: "Label", value: "Value"} */
  optionalFields?: { label: string; value: string }[];
  /** Override Patient to display. Default is the first patient object from the source data query result. */
  patient?: PatientInfo;
  /** Advanced: Override section settings */
  section?: SectionInfo;
}

export interface PatientInfo {
  patientId?: number;
  chartNumber?: number | string;
  name?: { text?: string; first?: string; middle?: string; family?: string };
  birthDate?: string;
  dob?: string;
  administrativeGender?: { code?: string; display?: string };
  preferredGender?: { code?: string; display?: string };
  gender?: string;
  healthNumber?: string;
  healthNumberBy?: string;
  insuranceNumber?: string;
  insuranceBy?: { code?: string; display?: string } | string;
  telecom?: {
    homePhone?: string;
    workPhone?: string;
    workExt?: string;
    cellPhone?: string;
  };
  preferredPhone?: { code?: string; display?: string } | string;
}

// Format date as YYYY.MM.DD
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

// Calculate age from birth date
const calculateAge = (dateStr?: string): string => {
  if (!dateStr) return '';
  const birthDate = new Date(dateStr);
  if (isNaN(birthDate.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age}\u00A0years`;
};

// Format health number with spaces (e.g., 9151 065 434 or BC: *9098 765 177)
const formatHealthNumber = (
  healthNumber?: string,
  insuranceNumber?: string,
  healthNumberBy?: string,
  insuranceBy?: { code?: string; display?: string } | string
): { display: string; isInsurance: boolean } => {
  // Determine if using insurance number vs health number
  const useInsurance = !healthNumber && !!insuranceNumber;
  const num = healthNumber || insuranceNumber || '';

  if (!num) {
    return { display: '<<< Unknown >>>', isInsurance: false };
  }

  // Format as groups of 4-3-3
  const cleaned = num.replace(/\D/g, '');
  let formatted = num;
  if (cleaned.length === 10) {
    formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  // Add prefix for insurance number
  if (useInsurance) {
    const byCode = typeof insuranceBy === 'object' ? insuranceBy?.code : insuranceBy;
    const prefix = byCode || healthNumberBy || '';
    return {
      display: prefix ? `${prefix}: *${formatted}` : `*${formatted}`,
      isInsurance: true
    };
  }

  return { display: formatted, isInsurance: false };
};

// Format phone number as (XXX) XXX-XXXX
const formatPhone = (phone: string): string => {
  if (!phone) return '';
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

// Get preferred phone from patient with extension support
const getPreferredPhone = (patient: PatientInfo): string => {
  const preferredCode = typeof patient.preferredPhone === 'object'
    ? patient.preferredPhone?.code
    : patient.preferredPhone;

  const telecom = patient.telecom || {};
  let phone = '';
  let type = '';
  let ext = '';

  switch (preferredCode) {
    case '1':
      phone = telecom.homePhone || '';
      type = 'Home';
      break;
    case '2':
      phone = telecom.workPhone || '';
      type = 'Work';
      ext = telecom.workExt || '';
      break;
    case '3':
      phone = telecom.cellPhone || '';
      type = 'Cell';
      break;
    default:
      phone = telecom.homePhone || telecom.cellPhone || telecom.workPhone || '';
      if (telecom.homePhone) {
        type = 'Home';
      } else if (telecom.cellPhone) {
        type = 'Cell';
      } else if (telecom.workPhone) {
        type = 'Work';
        ext = telecom.workExt || '';
      }
  }

  if (!phone) return ' ';

  const formattedPhone = formatPhone(phone);
  const extPart = ext ? ` Ext. ${ext}` : '';
  return `${formattedPhone}${extPart} ${type}`;
};

// Get display gender
const getGender = (patient: PatientInfo): string => {
  const adminGender = patient.administrativeGender?.code || patient.gender || '';
  const prefGender = patient.preferredGender?.code || '';

  if (!prefGender || adminGender === prefGender) {
    return adminGender;
  }
  return `${prefGender} (Preferred)`;
};

// Label component
const TextLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text variant="small" styles={{ root: { color: 'inherit' } }}>
    {children}
  </Text>
);

// Bold value component
const BoldValue: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text variant="small" styles={{ root: { color: 'inherit' } }}>
    <b style={{ margin: '0 10px 0 0' }}>{children}</b>
  </Text>
);

/**
 * NameBlock - Patient information banner
 *
 * Displays essential patient demographics in a horizontal banner
 * with a cyan background, typically used inside a Header component.
 */
export const NameBlock: React.FC<NameBlockProps> = ({
  fieldId = 'basicDemographics',
  isComplete,
  optionalFields,
  patient: patientProp,
  section,
}) => {
  const [activeData] = useActiveData();

  // Get patient from props, activeData demographics, or fall back to example
  const patient: PatientInfo = patientProp
    || (activeData as any)?.example?.demographics
    || (activeData as any)?.example?.patient
    || { name: { text: 'unknown' } };

  const chartNumber = patient.chartNumber || '';
  const birthDate = patient.birthDate || patient.dob || '';
  const formattedDate = formatDate(birthDate);
  const age = calculateAge(birthDate);
  const patientName = patient.name?.text || 'unknown';
  const preferredPhone = getPreferredPhone(patient);
  const gender = getGender(patient);
  const healthNumberInfo = formatHealthNumber(
    patient.healthNumber,
    patient.insuranceNumber,
    patient.healthNumberBy,
    patient.insuranceBy
  );

  // Banner styling
  const bannerStyle: React.CSSProperties = {
    borderWidth: '1px 1px 2px',
    borderStyle: 'solid',
    borderColor: '#edebe9 #edebe9 #0078d4',
    padding: '5px 10px',
    background: '#00bcf2',
  };

  const tokenGap = { childrenGap: 10 };

  return (
    <div className="ms-StackItem">
      <Stack style={bannerStyle}>
        <Stack horizontal horizontalAlign="space-between" tokens={tokenGap}>
          {/* Chart */}
          <Stack.Item>
            <Stack>
              <Stack.Item>
                <TextLabel>Chart</TextLabel>
              </Stack.Item>
              <Stack.Item>
                <BoldValue>{chartNumber}</BoldValue>
              </Stack.Item>
            </Stack>
          </Stack.Item>

          {/* Patient name */}
          <Stack.Item>
            <Stack>
              <Stack.Item>
                <TextLabel>Patient name</TextLabel>
              </Stack.Item>
              <Stack.Item>
                <BoldValue>{patientName}</BoldValue>
              </Stack.Item>
            </Stack>
          </Stack.Item>

          {/* Born + Age */}
          <Stack.Item>
            <Stack>
              <Stack.Item>
                <TextLabel>Born</TextLabel>
              </Stack.Item>
              <Stack.Item>
                <BoldValue>{formattedDate}</BoldValue>
                <BoldValue> {age}</BoldValue>
              </Stack.Item>
            </Stack>
          </Stack.Item>

          {/* Gender */}
          <Stack.Item>
            <Stack>
              <Stack.Item>
                <TextLabel>Gender</TextLabel>
              </Stack.Item>
              <Stack.Item>
                <BoldValue>{gender}</BoldValue>
              </Stack.Item>
            </Stack>
          </Stack.Item>

          {/* Health No. */}
          <Stack.Item>
            <Stack>
              <Stack.Item>
                <TextLabel>Health No.</TextLabel>
              </Stack.Item>
              <Stack.Item>
                <TooltipHost
                  content={healthNumberInfo.isInsurance ? 'Chart Insurance Number' : ''}
                  directionalHint={DirectionalHint.bottomCenter}
                >
                  <BoldValue>{healthNumberInfo.display}</BoldValue>
                </TooltipHost>
              </Stack.Item>
            </Stack>
          </Stack.Item>

          {/* Preferred phone */}
          <Stack.Item>
            <Stack>
              <Stack.Item>
                <TextLabel>Preferred phone</TextLabel>
              </Stack.Item>
              <Stack.Item>
                <BoldValue>{preferredPhone}</BoldValue>
              </Stack.Item>
            </Stack>
          </Stack.Item>

          {/* Optional fields */}
          {optionalFields?.map((field, index) => (
            <Stack.Item key={`opt-${index}`}>
              <Stack>
                <Stack.Item>
                  <TextLabel>{field.label}</TextLabel>
                </Stack.Item>
                <Stack.Item>
                  <BoldValue>{field.value}</BoldValue>
                </Stack.Item>
              </Stack>
            </Stack.Item>
          ))}
        </Stack>
      </Stack>
    </div>
  );
};

export default NameBlock;
