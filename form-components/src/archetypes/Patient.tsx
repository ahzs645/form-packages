/**
 * Patient Archetype
 *
 * The Patient archetype defines standard field appearance and options for
 * fields in the MOIS patient object. It includes demographics, contact info,
 * insurance details, and administrative data.
 *
 * Uses reusable controls: Action.Edit (for edit buttons)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { IDropdownOption, Checkbox, PrimaryButton, Label, IconButton } from '@fluentui/react';
import { LayoutItem, AuditStamp } from '../components/Layout';
import { useActiveData, useCodeList, PatientData } from '../context/MoisContext';
import { DateSelect } from '../controls/DateSelect';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';
import { InsuranceEditDialog } from '../dialogs/InsuranceEditDialog';
import { EthnicityEditDialog } from '../dialogs/EthnicityEditDialog';
import { TelecomEditDialog } from '../dialogs/TelecomEditDialog';
import { NameBlock as NameBlockComponent } from '../components/NameBlock';
import { Action } from '../controls/Action';

// ============================================================================
// Default Patient Data
// ============================================================================

const defaultPatient: PatientData = {
  patientId: 500063,
  chartNumber: 10012,
  name: { text: 'MICRO ALPHONSE MOUSE', first: 'MICRO', middle: 'ALPHONSE', family: 'MOUSE' },
  dob: '1969-02-11',
  gender: 'M',
  active: { code: 'A', display: 'Active Patient', system: 'MOIS-PATIENTSTATUS' },
  activeChanged: '2015-03-11',
  firstNationStatus: null,
  maritalStatus: { code: 'M', display: 'Married', system: 'MOIS-MARITALSTATUS' },
  preferredGender: { code: 'M', display: 'MALE', system: 'MOIS-PREFERREDGENDER' },
  genotypicGender: { code: 'M', display: 'MALE', system: 'MOIS-GENOTYPICGENDER' },
  preferredPhone: { code: '1', display: 'Home', system: 'MOIS-PREFERREDPHONE' },
  telecom: {
    homePhone: '(250) 960-9564',
    homeMessage: 'N',
    workPhone: '',
    workExt: '',
    workMessage: 'N',
    cellPhone: '',
    pagerNumber: '',
    homeEmail: '',
    workEmail: '',
  },
  address: {
    line1: '2251 Disney Road',
    line2: '',
    city: 'Prince George',
    province: 'BC',
    postalCode: 'V3L 2K2',
    country: 'Canada',
    text: '2251 Disney Road\nPrince George, BC\nCanada V3L 2K2',
  },
  healthNumber: '9151065434',
  healthNumberBy: 'BC',
  insuranceBy: { code: 'BC', display: 'British Columbia', system: 'MOIS-INSURANCEBY' },
  insuranceNumber: '9151065434',
  insuranceDependent: '00',
  lastContactDate: '2017-07-07',
  stamp: {
    createdDate: '2015.03.11 - 14:58',
    createdBy: 'Alyssa',
    modifiedDate: '2017.03.30 - 12:27',
    modifiedBy: 'ADMINISTRATOR',
  },
};

// ============================================================================
// Hooks
// ============================================================================

const usePatientData = (): [any, (updates: any) => void] => {
  const [activeData, setActiveData] = useActiveData();
  // Use demographics from JSON (primary) or fall back to patient
  const data = (activeData as any).example?.demographics || (activeData as any).example?.patient;

  // Memoize setData to prevent infinite re-renders
  const setData = useCallback((updates: any) => {
    setActiveData((current: any) => ({
      ...current,
      example: {
        ...current.example,
        patient: { ...current.example?.patient, ...updates },
      },
    }));
  }, [setActiveData]);

  return [data || defaultPatient, setData];
};

// ============================================================================
// Date/Time Helpers
// ============================================================================

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  } catch {
    return dateStr;
  }
};

const calculateAge = (birthDate: string | null | undefined): string => {
  if (!birthDate) return '';
  try {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} years`;
  } catch {
    return '';
  }
};

// ============================================================================
// Field Components
// ============================================================================

const active: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Current status" size="small" index={index}>
      <MoisDropdown
        fieldId="active"
        codeSystem="MOIS-PATIENTSTATUS"
        selectedKey={data?.active?.code || undefined}
        size="small"
        onChange={(_, option) => {
          if (option) setData({ active: { code: option.key, display: option.text, system: 'MOIS-PATIENTSTATUS' } });
        }}
      />
    </LayoutItem>
  );
};

const activeChanged: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();

  return (
    <LayoutItem label="Effective date" size="small" index={index}>
      <DateSelect inline value={formatDate(data?.activeChanged)} onChange={() => {}} size="small" />
    </LayoutItem>
  );
};

const address: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();

  return (
    <LayoutItem label="Address" size="medium" index={index}>
      <MoisTextField
        value={data?.address?.text || ''}
        multiline
        rows={4}
        readOnly
        borderless
        tabIndex={-1}
        size="medium"
      />
    </LayoutItem>
  );
};

const administrativeGender: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Administrative gender" size="medium" index={index}>
      <MoisDropdown
        fieldId="gender"
        codeSystem="MOIS-ADMINISTRATIVEGENDER"
        selectedKey={data?.gender || undefined}
        size="medium"
        onChange={(_, option) => {
          if (option) setData({ gender: option.key });
        }}
      />
    </LayoutItem>
  );
};

const adopted: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Adopted" size="small" index={index}>
      <MoisDropdown
        fieldId="adopted"
        codeSystem="MOIS-YESNOFULL"
        selectedKey={data?.adopted?.code || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          if (option) setData({ adopted: { code: option.key, display: option.text, system: 'MOIS-YESNOFULL' } });
        }}
      />
    </LayoutItem>
  );
};

const age: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();

  return (
    <LayoutItem label="Age" size="small" index={index}>
      <MoisTextField value={calculateAge(data?.dob)} readOnly borderless tabIndex={-1} size="small" />
    </LayoutItem>
  );
};

const birthDate: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();
  const ageStr = calculateAge(data?.dob);

  return (
    <LayoutItem label={`Birth date${ageStr ? ` (${ageStr})` : ''}`} size="medium" index={index}>
      <DateSelect inline value={formatDate(data?.dob)} onChange={() => {}} size="medium" />
    </LayoutItem>
  );
};

const chartLocation: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Chart location" size="small" index={index}>
      <MoisTextField
        value={data?.chartLocation || ''}
        size="small"
        onChange={(_, val) => setData({ chartLocation: val || '' })}
      />
    </LayoutItem>
  );
};

const chartNumber: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();

  return (
    <LayoutItem label="Chart No." size="tiny" index={index}>
      <MoisTextField value={String(data?.chartNumber ?? '')} readOnly borderless tabIndex={-1} size="tiny" />
    </LayoutItem>
  );
};

const city: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="City" size="medium" index={index}>
      <MoisTextField
        value={data?.address?.city || ''}
        autoComplete="new-password"
        size="medium"
        onChange={(_, val) => setData({
          address: { ...data?.address, city: val || '' }
        })}
      />
    </LayoutItem>
  );
};

const countryOfOrigin: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Country of origin" size="small" index={index}>
      <MoisTextField
        value={data?.countryOfOrigin?.display || ''}
        placeholder="Please search"
        size="small"
        onChange={(_, val) => setData({ countryOfOrigin: { display: val || '' } })}
      />
    </LayoutItem>
  );
};

const deceasedDate: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();

  return (
    <LayoutItem label="Deceased date" size="small" index={index}>
      <DateSelect inline value={formatDate(data?.deceasedDate)} onChange={() => {}} size="small" />
    </LayoutItem>
  );
};

const expandedTelecom: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const preferredPhone = data?.preferredPhone?.code || '1'; // Default to Home

  // Checkbox styles matching .root-264
  const checkboxStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flex: '2 2 0px',
    minWidth: 80,
    maxWidth: 160,
    paddingTop: 5,
  };

  // Phone column width: small (160) + tiny (80) + margin (10) = 250px
  const phoneColumnStyle: React.CSSProperties = {
    breakInside: 'avoid',
    margin: '0 10px',
    maxWidth: 250,
  };

  return (
    <div style={{ breakInside: 'avoid', margin: '8px 0' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        alignItems: 'start',
        minWidth: 320
      }}>
        {/* Row 1: Mobile checkbox + Cell phone with labels */}
        <div style={{ breakInside: 'avoid', margin: '0 10px' }}>
          <Label>Preferred</Label>
          <div style={checkboxStyle}>
            <Checkbox
              label="Mobile"
              checked={preferredPhone === '3'}
              onChange={() => setData({ preferredPhone: { code: '3', display: 'Cell', system: 'MOIS-PREFERREDPHONE' } })}
            />
          </div>
        </div>
        <div style={phoneColumnStyle}>
          <MoisTextField
            label="Phone"
            value={data?.telecom?.cellPhone || ''}
            autoComplete="new-password"
            size="small"
            onChange={(_, val) => setData({ telecom: { ...data?.telecom, cellPhone: val || '' } })}
          />
        </div>

        {/* Row 2: Home checkbox + Home phone */}
        <div style={{ breakInside: 'avoid', margin: '0 10px' }}>
          <div style={checkboxStyle}>
            <Checkbox
              label="Home"
              checked={preferredPhone === '1'}
              onChange={() => setData({ preferredPhone: { code: '1', display: 'Home', system: 'MOIS-PREFERREDPHONE' } })}
            />
          </div>
        </div>
        <div style={{ ...phoneColumnStyle, paddingTop: 4 }}>
          <MoisTextField
            value={data?.telecom?.homePhone || ''}
            autoComplete="new-password"
            size="small"
            onChange={(_, val) => setData({ telecom: { ...data?.telecom, homePhone: val || '' } })}
          />
        </div>

        {/* Row 3: Work checkbox + Work phone + Ext */}
        <div style={{ breakInside: 'avoid', margin: '0 10px' }}>
          <div style={checkboxStyle}>
            <Checkbox
              label="Work"
              checked={preferredPhone === '2'}
              onChange={() => setData({ preferredPhone: { code: '2', display: 'Work', system: 'MOIS-PREFERREDPHONE' } })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', margin: '0 10px', paddingTop: 4 }}>
          <MoisTextField
            value={data?.telecom?.workPhone || ''}
            autoComplete="new-password"
            size="small"
            onChange={(_, val) => setData({ telecom: { ...data?.telecom, workPhone: val || '' } })}
          />
          <div style={{ marginLeft: 10 }}>
            <MoisTextField
              value={data?.telecom?.workExt || ''}
              autoComplete="new-password"
              size="tiny"
              onChange={(_, val) => setData({ telecom: { ...data?.telecom, workExt: val || '' } })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const facilityCode: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const options = useCodeList('MOIS-FACILITYCODE');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  return (
    <LayoutItem label="Facility " size="small" index={index}>
      <MoisDropdown
        fieldId="facilityCode"
        codeSystem="MOIS-FACILITYCODE"
        selectedKey={data?.facilityCode?.code || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          if (option) setData({ facilityCode: { code: option.key, display: option.text, system: 'MOIS-FACILITYCODE' } });
        }}
      />
    </LayoutItem>
  );
};

const first: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="First name" size="medium" index={index}>
      <MoisTextField
        value={data?.name?.first || ''}
        required
        autoComplete="new-password"
        size="medium"
        onChange={(_, val) => setData({
          name: { ...data?.name, first: val || '' }
        })}
      />
    </LayoutItem>
  );
};

const firstNationStatus: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const options = useCodeList('MOIS-FIRSTNATIONSTATUS');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  return (
    <LayoutItem label="First nation status" size="small" index={index}>
      <MoisDropdown
        fieldId="firstNationStatus"
        codeSystem="MOIS-FIRSTNATIONSTATUS"
        selectedKey={data?.firstNationStatus?.code || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          if (option) setData({ firstNationStatus: { code: option.key, display: option.text, system: 'MOIS-FIRSTNATIONSTATUS' } });
        }}
      />
    </LayoutItem>
  );
};

const genderComment: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Gender comment" size="large" index={index}>
      <MoisTextField
        value={data?.genderComment || ''}
        size="large"
        onChange={(_, val) => setData({ genderComment: val || '' })}
      />
    </LayoutItem>
  );
};

const generalPractitioner: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Provider" size="medium" index={index}>
      <MoisTextField
        value={data?.generalPractitioner?.display || ''}
        placeholder="Please search"
        size="medium"
        onChange={(_, val) => setData({ generalPractitioner: { display: val || '' } })}
      />
    </LayoutItem>
  );
};

const genotypicGender: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const options = useCodeList('MOIS-GENOTYPICGENDER');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  return (
    <LayoutItem label="Genotypic gender" size="small" index={index}>
      <MoisDropdown
        fieldId="genotypicGender"
        codeSystem="MOIS-GENOTYPICGENDER"
        selectedKey={data?.genotypicGender?.code || undefined}
        size="small"
        onChange={(_, option) => {
          if (option) setData({ genotypicGender: { code: option.key, display: option.text, system: 'MOIS-GENOTYPICGENDER' } });
        }}
      />
    </LayoutItem>
  );
};

const healthNumber: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Health number" size="small" index={index}>
      <MoisTextField
        value={data?.healthNumber || ''}
        size="small"
        onChange={(_, val) => setData({ healthNumber: val || '' })}
      />
    </LayoutItem>
  );
};

const healthNumberBy: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Health number by" size="small" index={index}>
      <MoisTextField
        value={data?.healthNumberBy || ''}
        size="small"
        onChange={(_, val) => setData({ healthNumberBy: val || '' })}
      />
    </LayoutItem>
  );
};

const homeEmail: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Home email" size="large" index={index}>
      <MoisTextField
        value={data?.telecom?.homeEmail || ''}
        autoComplete="new-password"
        size="large"
        onChange={(_, val) => setData({
          telecom: { ...data?.telecom, homeEmail: val || '' }
        })}
      />
    </LayoutItem>
  );
};

const insurance: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const displayValue = data?.insuranceBy?.code
    ? `${data.insuranceBy.code}: ${data.insuranceNumber || ''}`
    : '';

  const handleSave = (updates: any) => {
    setData(updates);
  };

  return (
    <>
      <LayoutItem label="Insurance" size="medium" index={index}>
        <MoisTextField value={displayValue} readOnly borderless tabIndex={-1} size="medium" />
        <Action.Edit onEdit={() => setIsDialogOpen(true)} />
      </LayoutItem>
      <InsuranceEditDialog
        isOpen={isDialogOpen}
        onDismiss={() => setIsDialogOpen(false)}
        data={data}
        onSave={handleSave}
      />
    </>
  );
};

const insuranceBenefitSource: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Benefit source" size="small" index={index}>
      <MoisTextField
        value={data?.insuranceBenefitSource || ''}
        size="small"
        onChange={(_, val) => setData({ insuranceBenefitSource: val || '' })}
      />
    </LayoutItem>
  );
};

const insuranceButton: React.FC<any> = ({ index, ...props }) => {
  return (
    <div style={{ breakInside: 'avoid', margin: '8px 0' }}>
      <div style={{ display: 'flex', flexFlow: 'wrap', minWidth: 200 }}>
        <div style={{ flex: '2 1 0%', display: 'flex', flexFlow: 'wrap', minWidth: 200 }}>
          <div>
            <div style={{ height: 29 }} />
            <PrimaryButton text="Check Eligibility" />
          </div>
        </div>
      </div>
      <div style={{ clear: 'both' }}></div>
    </div>
  );
};

const insuranceBy: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const options = useCodeList('MOIS-INSURANCEBY');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  return (
    <LayoutItem label="Insurer" size="small" index={index}>
      <MoisDropdown
        fieldId="insuranceBy"
        codeSystem="MOIS-INSURANCEBY"
        selectedKey={data?.insuranceBy?.code || undefined}
        size="small"
        onChange={(_, option) => {
          if (option) setData({ insuranceBy: { code: option.key, display: option.text, system: 'MOIS-INSURANCEBY' } });
        }}
      />
    </LayoutItem>
  );
};

const insuranceDependent: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Dep. no." size="tiny" index={index}>
      <MoisTextField
        value={data?.insuranceDependent || ''}
        size="tiny"
        onChange={(_, val) => setData({ insuranceDependent: val || '' })}
      />
    </LayoutItem>
  );
};

const insuranceNumber: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Insurance number" size="small" index={index}>
      <MoisTextField
        value={data?.insuranceNumber || ''}
        size="small"
        onChange={(_, val) => setData({ insuranceNumber: val || '' })}
      />
    </LayoutItem>
  );
};

const insuranceText: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();
  const displayValue = data?.insuranceBy?.code
    ? `${data.insuranceBy.code}: ${data.insuranceNumber || ''}`
    : '';

  return (
    <LayoutItem label="Insurance" size="medium" index={index}>
      <MoisTextField
        value={displayValue}
        size="medium"
        onChange={() => {}}
      />
    </LayoutItem>
  );
};

const language: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="First language" size="small" index={index}>
      <MoisTextField
        value={data?.language?.display || ''}
        placeholder="Please search"
        size="small"
        onChange={(_, val) => setData({ language: { display: val || '' } })}
      />
    </LayoutItem>
  );
};

const lastContactDate: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();

  return (
    <LayoutItem label="Last contact date" size="small" index={index}>
      <DateSelect inline value={formatDate(data?.lastContactDate)} onChange={() => {}} disabled size="small" />
    </LayoutItem>
  );
};

const family: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Family name" size="medium" index={index}>
      <MoisTextField
        value={data?.name?.family || ''}
        required
        autoComplete="new-password"
        size="medium"
        onChange={(_, val) => setData({
          name: { ...data?.name, family: val || '' }
        })}
      />
    </LayoutItem>
  );
};

const locationCode: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const options = useCodeList('MOIS-LOCATIONCODE');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  return (
    <LayoutItem label="Location" size="small" index={index}>
      <MoisDropdown
        fieldId="locationCode"
        codeSystem="MOIS-LOCATIONCODE"
        selectedKey={data?.locationCode?.code || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          if (option) setData({ locationCode: { code: option.key, display: option.text, system: 'MOIS-LOCATIONCODE' } });
        }}
      />
    </LayoutItem>
  );
};

const maritalStatus: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const options = useCodeList('MOIS-MARITALSTATUS');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  return (
    <LayoutItem label="Marital status" size="small" index={index}>
      <MoisDropdown
        fieldId="maritalStatus"
        codeSystem="MOIS-MARITALSTATUS"
        selectedKey={data?.maritalStatus?.code || undefined}
        size="small"
        onChange={(_, option) => {
          if (option) setData({ maritalStatus: { code: option.key, display: option.text, system: 'MOIS-MARITALSTATUS' } });
        }}
      />
    </LayoutItem>
  );
};

const middle: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Middle name" size="medium" index={index}>
      <MoisTextField
        value={data?.name?.middle || ''}
        autoComplete="new-password"
        size="medium"
        onChange={(_, val) => setData({
          name: { ...data?.name, middle: val || '' }
        })}
      />
    </LayoutItem>
  );
};

const multipleBirth: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Multiple birth" size="small" index={index}>
      <MoisDropdown
        fieldId="multipleBirth"
        codeSystem="MOIS-YESNO"
        selectedKey={data?.multipleBirth?.code || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          if (option) setData({ multipleBirth: { code: option.key, display: option.text, system: 'MOIS-YESNO' } });
        }}
      />
    </LayoutItem>
  );
};

const name: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();

  return (
    <LayoutItem label="Name" size="medium" index={index}>
      <MoisTextField value={data?.name?.text || ''} readOnly borderless tabIndex={-1} size="medium" />
    </LayoutItem>
  );
};

const nickName: React.FC<any> = ({ index, ...props }) => {
  const [data] = usePatientData();

  return (
    <LayoutItem label="Alias" size="medium" index={index}>
      <MoisTextField value={data?.nickName?.text || ''} readOnly borderless tabIndex={-1} size="medium" />
    </LayoutItem>
  );
};

const note: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="General notes" size="medium" index={index}>
      <MoisTextField
        value={data?.note || ''}
        multiline
        rows={8}
        size="medium"
        onChange={(_, val) => setData({ note: val || '' })}
      />
    </LayoutItem>
  );
};

const preferredGender: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Preferred gender" size="small" index={index}>
      <MoisDropdown
        fieldId="preferredGender"
        codeSystem="MOIS-PREFERREDGENDER"
        selectedKey={data?.preferredGender?.code || undefined}
        size="small"
        onChange={(_, option) => {
          if (option) setData({ preferredGender: { code: option.key, display: option.text, system: 'MOIS-PREFERREDGENDER' } });
        }}
      />
    </LayoutItem>
  );
};

const preferredPhone: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Preferred phone" size="small" index={index}>
      <MoisDropdown
        fieldId="preferredPhone"
        codeSystem="MOIS-PREFERREDPHONE"
        selectedKey={data?.preferredPhone?.code || undefined}
        size="small"
        onChange={(_, option) => {
          if (option) setData({ preferredPhone: { code: option.key, display: option.text, system: 'MOIS-PREFERREDPHONE' } });
        }}
      />
    </LayoutItem>
  );
};

const province: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Province" size="medium" index={index}>
      <MoisTextField
        value={data?.address?.province || ''}
        autoComplete="new-password"
        size="medium"
        onChange={(_, val) => setData({
          address: { ...data?.address, province: val || '' }
        })}
      />
    </LayoutItem>
  );
};

const postalCode: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Postal code" size="medium" index={index}>
      <MoisTextField
        value={data?.address?.postalCode || ''}
        autoComplete="new-password"
        size="medium"
        onChange={(_, val) => setData({
          address: { ...data?.address, postalCode: val || '' }
        })}
      />
    </LayoutItem>
  );
};

const race1: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = (updates: any) => {
    setData({
      race1: {
        display: updates.race,
        relation: updates.relation,
        selfIdentified: updates.selfIdentified,
      },
    });
  };

  return (
    <>
      <div style={{ display: 'flex' }}>
        <LayoutItem label="Ethnicity 1" size="medium" index={index}>
          <MoisTextField
            value={data?.race1?.display || ''}
            readOnly
            borderless
            tabIndex={-1}
            prefix="SELF"
            size="medium"
          />
          <Action.Edit onEdit={() => setIsDialogOpen(true)} />
        </LayoutItem>
      </div>
      <EthnicityEditDialog
        isOpen={isDialogOpen}
        onDismiss={() => setIsDialogOpen(false)}
        data={{
          relation: data?.race1?.relation || 'SELF',
          race: data?.race1?.display || '',
          selfIdentified: data?.race1?.selfIdentified || false,
        }}
        onSave={handleSave}
        fieldLabel="Ethnicity 1"
      />
    </>
  );
};

const race2: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = (updates: any) => {
    setData({
      race2: {
        display: updates.race,
        relation: updates.relation,
        selfIdentified: updates.selfIdentified,
      },
    });
  };

  return (
    <>
      <div style={{ display: 'flex' }}>
        <LayoutItem label="Ethnicity 2" size="medium" index={index}>
          <MoisTextField
            value={data?.race2?.display || ''}
            readOnly
            borderless
            tabIndex={-1}
            size="medium"
          />
          <Action.Edit onEdit={() => setIsDialogOpen(true)} />
        </LayoutItem>
      </div>
      <EthnicityEditDialog
        isOpen={isDialogOpen}
        onDismiss={() => setIsDialogOpen(false)}
        data={{
          relation: data?.race2?.relation || '',
          race: data?.race2?.display || '',
          selfIdentified: data?.race2?.selfIdentified || false,
        }}
        onSave={handleSave}
        fieldLabel="Ethnicity 2"
      />
    </>
  );
};

const race3: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = (updates: any) => {
    setData({
      race3: {
        display: updates.race,
        relation: updates.relation,
        selfIdentified: updates.selfIdentified,
      },
    });
  };

  return (
    <>
      <div style={{ display: 'flex' }}>
        <LayoutItem label="Ethnicity 3" size="medium" index={index}>
          <MoisTextField
            value={data?.race3?.display || ''}
            readOnly
            borderless
            tabIndex={-1}
            size="medium"
          />
          <Action.Edit onEdit={() => setIsDialogOpen(true)} />
        </LayoutItem>
      </div>
      <EthnicityEditDialog
        isOpen={isDialogOpen}
        onDismiss={() => setIsDialogOpen(false)}
        data={{
          relation: data?.race3?.relation || '',
          race: data?.race3?.display || '',
          selfIdentified: data?.race3?.selfIdentified || false,
        }}
        onSave={handleSave}
        fieldLabel="Ethnicity 3"
      />
    </>
  );
};

const religion: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Religion" size="small" index={index}>
      <MoisTextField
        value={data?.religion || ''}
        size="small"
        onChange={(_, val) => setData({ religion: val || '' })}
      />
    </LayoutItem>
  );
};

const shortNote: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Short note" size="medium" index={index}>
      <MoisTextField
        value={data?.shortNote || ''}
        size="medium"
        onChange={(_, val) => setData({ shortNote: val || '' })}
      />
    </LayoutItem>
  );
};

const serviceCenter: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();

  return (
    <LayoutItem label="Service center" size="small" index={index}>
      <MoisDropdown
        fieldId="serviceCenter"
        codeSystem="MOIS-SERVICECENTER"
        selectedKey={data?.serviceCenter?.code || undefined}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          if (option) setData({ serviceCenter: { code: option.key, display: option.text, system: 'MOIS-SERVICECENTER' } });
        }}
      />
    </LayoutItem>
  );
};

const stamp: React.FC<any> = ({ index, ...props }) => {
  return <AuditStamp index={index} {...props} />;
};

const telecom: React.FC<any> = ({ index, ...props }) => {
  const [data, setData] = usePatientData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const telecomText = data?.telecom?.homePhone
    ? `Home: ${data.telecom.homePhone} Leave msg: ${data.telecom.homeMessage === 'Y' ? 'Yes' : 'No'}\n`
    : '';

  const handleSave = (updates: any) => {
    setData({ telecom: { ...data?.telecom, ...updates } });
  };

  return (
    <>
      <LayoutItem label="Contact" size="medium" index={index}>
        <MoisTextField
          value={telecomText}
          multiline
          rows={5}
          readOnly
          borderless
          tabIndex={-1}
          size="medium"
        />
        <Action.Edit onEdit={() => setIsDialogOpen(true)} />
      </LayoutItem>
      <TelecomEditDialog
        isOpen={isDialogOpen}
        onDismiss={() => setIsDialogOpen(false)}
        data={data?.telecom || {}}
        onSave={handleSave}
      />
    </>
  );
};

// ============================================================================
// Fields Collection
// ============================================================================

const Fields = {
  active,
  activeChanged,
  address,
  administrativeGender,
  adopted,
  age,
  birthDate,
  chartLocation,
  chartNumber,
  city,
  countryOfOrigin,
  deceasedDate,
  expandedTelecom,
  facilityCode,
  first,
  firstNationStatus,
  genderComment,
  generalPractitioner,
  genotypicGender,
  healthNumber,
  healthNumberBy,
  homeEmail,
  insurance,
  insuranceBenefitSource,
  insuranceButton,
  insuranceBy,
  insuranceDependent,
  insuranceNumber,
  insuranceText,
  language,
  lastContactDate,
  family,
  locationCode,
  maritalStatus,
  middle,
  multipleBirth,
  name,
  nickName,
  note,
  preferredGender,
  preferredPhone,
  province,
  postalCode,
  race1,
  race2,
  race3,
  religion,
  shortNote,
  serviceCenter,
  stamp,
  telecom,
};

// ============================================================================
// All Component (renders ALL fields)
// ============================================================================

const All: React.FC<any> = (props) => {
  return (
    <div>
      <Fields.active {...props} />
      <Fields.activeChanged {...props} />
      <Fields.address {...props} />
      <Fields.administrativeGender {...props} />
      <Fields.adopted {...props} />
      <Fields.age {...props} />
      <Fields.birthDate {...props} />
      <Fields.chartLocation {...props} />
      <Fields.chartNumber {...props} />
      <Fields.city {...props} />
      <Fields.countryOfOrigin {...props} />
      <Fields.deceasedDate {...props} />
      <Fields.expandedTelecom {...props} />
      <Fields.facilityCode {...props} />
      <Fields.first {...props} />
      <Fields.firstNationStatus {...props} />
      <Fields.genderComment {...props} />
      <Fields.generalPractitioner {...props} />
      <Fields.genotypicGender {...props} />
      <Fields.healthNumber {...props} />
      <Fields.healthNumberBy {...props} />
      <Fields.homeEmail {...props} />
      <Fields.insurance {...props} />
      <Fields.insuranceBenefitSource {...props} />
      <Fields.insuranceButton {...props} />
      <Fields.insuranceBy {...props} />
      <Fields.insuranceDependent {...props} />
      <Fields.insuranceNumber {...props} />
      <Fields.insuranceText {...props} />
      <Fields.language {...props} />
      <Fields.lastContactDate {...props} />
      <Fields.family {...props} />
      <Fields.locationCode {...props} />
      <Fields.maritalStatus {...props} />
      <Fields.middle {...props} />
      <Fields.multipleBirth {...props} />
      <Fields.name {...props} />
      <Fields.nickName {...props} />
      <Fields.note {...props} />
      <Fields.preferredGender {...props} />
      <Fields.preferredPhone {...props} />
      <Fields.province {...props} />
      <Fields.postalCode {...props} />
      <Fields.race1 {...props} />
      <Fields.race2 {...props} />
      <Fields.race3 {...props} />
      <Fields.religion {...props} />
      <Fields.shortNote {...props} />
      <Fields.serviceCenter {...props} />
      <Fields.stamp {...props} />
      <Fields.telecom {...props} />
    </div>
  );
};

// ============================================================================
// NameBlock Component - Uses the shared NameBlock component
// ============================================================================

const NameBlock: React.FC<any> = (props) => {
  const [data] = usePatientData();

  // Map patient data to the format expected by NameBlockComponent
  const patient = data ? {
    chartNumber: data.chartNumber,
    name: data.name,
    birthDate: data.dob,
    administrativeGender: { code: data.gender },
    healthNumber: data.healthNumber,
    telecom: data.telecom,
    preferredPhone: data.preferredPhone,
  } : undefined;

  return <NameBlockComponent patient={patient} {...props} />;
};

// ============================================================================
// Export
// ============================================================================

export const Patient = {
  ...Fields,
  All,
  Fields,
  NameBlock,
};

export default Patient;
