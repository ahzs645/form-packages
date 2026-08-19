/**
 * Patient Archetype
 *
 * The Patient archetype defines standard field appearance and options for
 * fields in the MOIS patient object. It includes demographics, contact info,
 * insurance details, and administrative data.
 *
 * Uses reusable controls: Action.Edit (for edit buttons)
 *
 * MOIS parity notes (verified against the SMOIS FormTester bundle):
 * - Every field passes a stable fieldId (its Fields-map key) so section
 *   fieldPlacement can select and position it (`<Grid placement=...>`).
 * - `All` renders the fields as a Fragment in placement order — fields must be
 *   direct grid children for per-field gridArea to work.
 * - Fields read/write through the section's activeSelector when one is set,
 *   falling back to the JSON example demographics for gallery demos.
 */

import React, { useState } from 'react';
import { IDropdownOption, Checkbox, PrimaryButton, Label } from '@fluentui/react';
import { LayoutItem, ArchAll, AuditStamp } from '../components/Layout';
import { useCodeList, PatientData, SectionContextValue } from '../context/MoisContext';
import { useArchetypeBinding, codeOf, toCodedValue, ArchetypeBinding } from './archetype-binding';
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
// Section-aware data access
// ============================================================================

const usePatientBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ArchetypeBinding =>
  useArchetypeBinding({
    exampleData: (activeData) =>
      activeData.example?.demographics
      || activeData.example?.patient
      || defaultPatient,
    exampleTarget: (draft) => {
      draft.example = draft.example || {};
      return draft.example.demographics
        ?? (draft.example.patient = draft.example.patient || {});
    },
    section: sectionOverride,
  });

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

interface FieldProps {
  index?: number | string;
  section?: Partial<SectionContextValue>;
  [key: string]: any;
}

const active: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="active" label="Current status" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="active"
        codeSystem="MOIS-PATIENTSTATUS"
        selectedKey={codeOf(data?.active) || undefined}
        size={effectiveSize}
        onChange={(_, option) => setField('active', toCodedValue(option, 'MOIS-PATIENTSTATUS'))}
      />
    </LayoutItem>
  );
};

const activeChanged: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="activeChanged" label="Effective date" size="small" index={index} section={section} {...rest}>
      <DateSelect inline value={formatDate(data?.activeChanged)} onChange={() => {}} size={effectiveSize} />
    </LayoutItem>
  );
};

// Composite chart-status editor. The vendor's test_demographic_mutations form
// renders <Mois.Patient.status /> and saves fd.field.data.active +
// fd.field.data.activeChanged through changePatient, so status is the
// active/activeChanged pair, not a third field.
// NOTE: the children carry their own fieldIds ("active"/"activeChanged"), so
// a section fieldPlacement that names only "status" would hide both — place
// "active" and "activeChanged" individually instead.
const status: React.FC<FieldProps> = ({ index, ...props }) => {
  const Active = active;
  const ActiveChanged = activeChanged;
  return (
    <>
      <Active index={index} {...props} />
      <ActiveChanged index={index} {...props} />
    </>
  );
};

const address: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="address" label="Address" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.address?.text || ''}
        multiline
        rows={4}
        readOnly
        borderless
        tabIndex={-1}
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const administrativeGender: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="administrativeGender" label="Administrative gender" size="medium" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="gender"
        codeSystem="MOIS-ADMINISTRATIVEGENDER"
        selectedKey={data?.gender || undefined}
        size={effectiveSize}
        onChange={(_, option) => {
          if (option) setField('gender', option.key);
        }}
      />
    </LayoutItem>
  );
};

const adopted: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="adopted" label="Adopted" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="adopted"
        codeSystem="MOIS-YESNOFULL"
        selectedKey={codeOf(data?.adopted) || undefined}
        placeholder="Please select"
        size={effectiveSize}
        onChange={(_, option) => setField('adopted', toCodedValue(option, 'MOIS-YESNOFULL'))}
      />
    </LayoutItem>
  );
};

const age: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="age" label="Age" size="small" index={index} section={section} {...rest}>
      <MoisTextField value={calculateAge(data?.dob)} readOnly borderless tabIndex={-1} size={effectiveSize} />
    </LayoutItem>
  );
};

const birthDate: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);
  const ageStr = calculateAge(data?.dob);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="birthDate" label={`Birth date${ageStr ? ` (${ageStr})` : ''}`} size="medium" index={index} section={section} {...rest}>
      <DateSelect inline value={formatDate(data?.dob)} onChange={() => {}} size={effectiveSize} />
    </LayoutItem>
  );
};

const chartLocation: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="chartLocation" label="Chart location" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.chartLocation || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('chartLocation', val || '')}
      />
    </LayoutItem>
  );
};

const chartNumber: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="chartNumber" label="Chart No." size="tiny" index={index} section={section} {...rest}>
      <MoisTextField value={String(data?.chartNumber ?? '')} readOnly borderless tabIndex={-1} size={effectiveSize} />
    </LayoutItem>
  );
};

const city: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="city" label="City" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.address?.city || ''}
        autoComplete="new-password"
        size={effectiveSize}
        onChange={(_, val) => setField('address', { ...data?.address, city: val || '' })}
      />
    </LayoutItem>
  );
};

const countryOfOrigin: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="countryOfOrigin" label="Country of origin" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.countryOfOrigin?.display || ''}
        placeholder="Please search"
        size={effectiveSize}
        onChange={(_, val) => setField('countryOfOrigin', { display: val || '' })}
      />
    </LayoutItem>
  );
};

const deceasedDate: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="deceasedDate" label="Deceased date" size="small" index={index} section={section} {...rest}>
      <DateSelect inline value={formatDate(data?.deceasedDate)} onChange={() => {}} size={effectiveSize} />
    </LayoutItem>
  );
};

const expandedTelecom: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const preferredPhone = codeOf(data?.preferredPhone) || '1'; // Default to Home

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
              onChange={() => setField('preferredPhone', { code: '3', display: 'Cell', system: 'MOIS-PREFERREDPHONE' })}
            />
          </div>
        </div>
        <div style={phoneColumnStyle}>
          <MoisTextField
            label="Phone"
            value={data?.telecom?.cellPhone || ''}
            autoComplete="new-password"
            size="small"
            onChange={(_, val) => setField('telecom', { ...data?.telecom, cellPhone: val || '' })}
          />
        </div>

        {/* Row 2: Home checkbox + Home phone */}
        <div style={{ breakInside: 'avoid', margin: '0 10px' }}>
          <div style={checkboxStyle}>
            <Checkbox
              label="Home"
              checked={preferredPhone === '1'}
              onChange={() => setField('preferredPhone', { code: '1', display: 'Home', system: 'MOIS-PREFERREDPHONE' })}
            />
          </div>
        </div>
        <div style={{ ...phoneColumnStyle, paddingTop: 4 }}>
          <MoisTextField
            value={data?.telecom?.homePhone || ''}
            autoComplete="new-password"
            size="small"
            onChange={(_, val) => setField('telecom', { ...data?.telecom, homePhone: val || '' })}
          />
        </div>

        {/* Row 3: Work checkbox + Work phone + Ext */}
        <div style={{ breakInside: 'avoid', margin: '0 10px' }}>
          <div style={checkboxStyle}>
            <Checkbox
              label="Work"
              checked={preferredPhone === '2'}
              onChange={() => setField('preferredPhone', { code: '2', display: 'Work', system: 'MOIS-PREFERREDPHONE' })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', margin: '0 10px', paddingTop: 4 }}>
          <MoisTextField
            value={data?.telecom?.workPhone || ''}
            autoComplete="new-password"
            size="small"
            onChange={(_, val) => setField('telecom', { ...data?.telecom, workPhone: val || '' })}
          />
          <div style={{ marginLeft: 10 }}>
            <MoisTextField
              value={data?.telecom?.workExt || ''}
              autoComplete="new-password"
              size="tiny"
              onChange={(_, val) => setField('telecom', { ...data?.telecom, workExt: val || '' })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const facilityCode: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const options = useCodeList('MOIS-FACILITYCODE');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="facilityCode" label="Facility " size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="facilityCode"
        codeSystem="MOIS-FACILITYCODE"
        selectedKey={codeOf(data?.facilityCode) || undefined}
        placeholder="Please select"
        size={effectiveSize}
        onChange={(_, option) => setField('facilityCode', toCodedValue(option, 'MOIS-FACILITYCODE'))}
      />
    </LayoutItem>
  );
};

const first: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="first" label="First name" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.name?.first || ''}
        required
        autoComplete="new-password"
        size={effectiveSize}
        onChange={(_, val) => setField('name', { ...data?.name, first: val || '' })}
      />
    </LayoutItem>
  );
};

const firstNationStatus: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const options = useCodeList('MOIS-FIRSTNATIONSTATUS');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="firstNationStatus" label="First nation status" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="firstNationStatus"
        codeSystem="MOIS-FIRSTNATIONSTATUS"
        selectedKey={codeOf(data?.firstNationStatus) || undefined}
        placeholder="Please select"
        size={effectiveSize}
        onChange={(_, option) => setField('firstNationStatus', toCodedValue(option, 'MOIS-FIRSTNATIONSTATUS'))}
      />
    </LayoutItem>
  );
};

const genderComment: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'large';

  return (
    <LayoutItem fieldId="genderComment" label="Gender comment" size="large" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.genderComment || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('genderComment', val || '')}
      />
    </LayoutItem>
  );
};

const generalPractitioner: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="generalPractitioner" label="Provider" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.generalPractitioner?.display || ''}
        placeholder="Please search"
        size={effectiveSize}
        onChange={(_, val) => setField('generalPractitioner', { display: val || '' })}
      />
    </LayoutItem>
  );
};

const genotypicGender: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const options = useCodeList('MOIS-GENOTYPICGENDER');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="genotypicGender" label="Genotypic gender" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="genotypicGender"
        codeSystem="MOIS-GENOTYPICGENDER"
        selectedKey={codeOf(data?.genotypicGender) || undefined}
        size={effectiveSize}
        onChange={(_, option) => setField('genotypicGender', toCodedValue(option, 'MOIS-GENOTYPICGENDER'))}
      />
    </LayoutItem>
  );
};

const healthNumber: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="healthNumber" label="Health number" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.healthNumber || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('healthNumber', val || '')}
      />
    </LayoutItem>
  );
};

const healthNumberBy: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="healthNumberBy" label="Health number by" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.healthNumberBy || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('healthNumberBy', val || '')}
      />
    </LayoutItem>
  );
};

const homeEmail: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'large';

  return (
    <LayoutItem fieldId="homeEmail" label="Home email" size="large" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.telecom?.homeEmail || ''}
        autoComplete="new-password"
        size={effectiveSize}
        onChange={(_, val) => setField('telecom', { ...data?.telecom, homeEmail: val || '' })}
      />
    </LayoutItem>
  );
};

const insurance: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const displayValue = data?.insuranceBy?.code
    ? `${data.insuranceBy.code}: ${data.insuranceNumber || ''}`
    : '';

  const handleSave = (updates: any) => {
    Object.entries(updates).forEach(([key, value]) => setField(key, value));
  };

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <>
      <LayoutItem fieldId="insurance" label="Insurance" size="medium" index={index} section={section} {...rest}>
        <MoisTextField value={displayValue} readOnly borderless tabIndex={-1} size={effectiveSize} />
        <Action.Edit onEdit={() => setIsDialogOpen(true)} />
      </LayoutItem>
      <InsuranceEditDialog
        isOpen={isDialogOpen}
        onDismiss={() => setIsDialogOpen(false)}
        data={data ?? {}}
        onSave={handleSave}
      />
    </>
  );
};

const insuranceBenefitSource: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="insuranceBenefitSource" label="Benefit source" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.insuranceBenefitSource || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('insuranceBenefitSource', val || '')}
      />
    </LayoutItem>
  );
};

const insuranceButton: React.FC<FieldProps> = ({ index, section, ...rest }) => {
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

const insuranceBy: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const options = useCodeList('MOIS-INSURANCEBY');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="insuranceBy" label="Insurer" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="insuranceBy"
        codeSystem="MOIS-INSURANCEBY"
        selectedKey={codeOf(data?.insuranceBy) || undefined}
        size={effectiveSize}
        onChange={(_, option) => setField('insuranceBy', toCodedValue(option, 'MOIS-INSURANCEBY'))}
      />
    </LayoutItem>
  );
};

const insuranceDependent: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="insuranceDependent" label="Dep. no." size="tiny" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.insuranceDependent || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('insuranceDependent', val || '')}
      />
    </LayoutItem>
  );
};

const insuranceNumber: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="insuranceNumber" label="Insurance number" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.insuranceNumber || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('insuranceNumber', val || '')}
      />
    </LayoutItem>
  );
};

const insuranceText: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);
  const displayValue = data?.insuranceBy?.code
    ? `${data.insuranceBy.code}: ${data.insuranceNumber || ''}`
    : '';

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="insuranceText" label="Insurance" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={displayValue}
        size={effectiveSize}
        onChange={() => {}}
      />
    </LayoutItem>
  );
};

const language: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="language" label="First language" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.language?.display || ''}
        placeholder="Please search"
        size={effectiveSize}
        onChange={(_, val) => setField('language', { display: val || '' })}
      />
    </LayoutItem>
  );
};

const lastContactDate: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="lastContactDate" label="Last contact date" size="small" index={index} section={section} {...rest}>
      <DateSelect inline value={formatDate(data?.lastContactDate)} onChange={() => {}} disabled size={effectiveSize} />
    </LayoutItem>
  );
};

const family: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="family" label="Family name" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.name?.family || ''}
        required
        autoComplete="new-password"
        size={effectiveSize}
        onChange={(_, val) => setField('name', { ...data?.name, family: val || '' })}
      />
    </LayoutItem>
  );
};

const locationCode: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const options = useCodeList('MOIS-LOCATIONCODE');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="locationCode" label="Location" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="locationCode"
        codeSystem="MOIS-LOCATIONCODE"
        selectedKey={codeOf(data?.locationCode) || undefined}
        placeholder="Please select"
        size={effectiveSize}
        onChange={(_, option) => setField('locationCode', toCodedValue(option, 'MOIS-LOCATIONCODE'))}
      />
    </LayoutItem>
  );
};

const maritalStatus: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const options = useCodeList('MOIS-MARITALSTATUS');

  const dropdownOptions: IDropdownOption[] = options.map(opt => ({
    key: opt.code,
    text: opt.display,
  }));

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="maritalStatus" label="Marital status" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="maritalStatus"
        codeSystem="MOIS-MARITALSTATUS"
        selectedKey={codeOf(data?.maritalStatus) || undefined}
        size={effectiveSize}
        onChange={(_, option) => setField('maritalStatus', toCodedValue(option, 'MOIS-MARITALSTATUS'))}
      />
    </LayoutItem>
  );
};

const middle: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="middle" label="Middle name" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.name?.middle || ''}
        autoComplete="new-password"
        size={effectiveSize}
        onChange={(_, val) => setField('name', { ...data?.name, middle: val || '' })}
      />
    </LayoutItem>
  );
};

const multipleBirth: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="multipleBirth" label="Multiple birth" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="multipleBirth"
        codeSystem="MOIS-YESNO"
        selectedKey={codeOf(data?.multipleBirth) || undefined}
        placeholder="Please select"
        size={effectiveSize}
        onChange={(_, option) => setField('multipleBirth', toCodedValue(option, 'MOIS-YESNO'))}
      />
    </LayoutItem>
  );
};

const name: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="name" label="Name" size="medium" index={index} section={section} {...rest}>
      <MoisTextField value={data?.name?.text || ''} readOnly borderless tabIndex={-1} size={effectiveSize} />
    </LayoutItem>
  );
};

const nickName: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="nickName" label="Alias" size="medium" index={index} section={section} {...rest}>
      <MoisTextField value={data?.nickName?.text || ''} readOnly borderless tabIndex={-1} size={effectiveSize} />
    </LayoutItem>
  );
};

const note: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="note" label="General notes" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.note || ''}
        multiline
        rows={8}
        size={effectiveSize}
        onChange={(_, val) => setField('note', val || '')}
      />
    </LayoutItem>
  );
};

const preferredGender: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="preferredGender" label="Preferred gender" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="preferredGender"
        codeSystem="MOIS-PREFERREDGENDER"
        selectedKey={codeOf(data?.preferredGender) || undefined}
        size={effectiveSize}
        onChange={(_, option) => setField('preferredGender', toCodedValue(option, 'MOIS-PREFERREDGENDER'))}
      />
    </LayoutItem>
  );
};

const preferredPhone: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="preferredPhone" label="Preferred phone" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="preferredPhone"
        codeSystem="MOIS-PREFERREDPHONE"
        selectedKey={codeOf(data?.preferredPhone) || undefined}
        size={effectiveSize}
        onChange={(_, option) => setField('preferredPhone', toCodedValue(option, 'MOIS-PREFERREDPHONE'))}
      />
    </LayoutItem>
  );
};

const province: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="province" label="Province" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.address?.province || ''}
        autoComplete="new-password"
        size={effectiveSize}
        onChange={(_, val) => setField('address', { ...data?.address, province: val || '' })}
      />
    </LayoutItem>
  );
};

const postalCode: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="postalCode" label="Postal code" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.address?.postalCode || ''}
        autoComplete="new-password"
        size={effectiveSize}
        onChange={(_, val) => setField('address', { ...data?.address, postalCode: val || '' })}
      />
    </LayoutItem>
  );
};

const race1: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = (updates: any) => {
    setField('race1', {
      display: updates.race,
      relation: updates.relation,
      selfIdentified: updates.selfIdentified,
    });
  };

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <>
      <LayoutItem fieldId="race1" label="Ethnicity 1" size="medium" index={index} section={section} {...rest}>
        <MoisTextField
          value={data?.race1?.display || ''}
          readOnly
          borderless
          tabIndex={-1}
          prefix="SELF"
          size={effectiveSize}
        />
        <Action.Edit onEdit={() => setIsDialogOpen(true)} />
      </LayoutItem>
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

const race2: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = (updates: any) => {
    setField('race2', {
      display: updates.race,
      relation: updates.relation,
      selfIdentified: updates.selfIdentified,
    });
  };

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <>
      <LayoutItem fieldId="race2" label="Ethnicity 2" size="medium" index={index} section={section} {...rest}>
        <MoisTextField
          value={data?.race2?.display || ''}
          readOnly
          borderless
          tabIndex={-1}
          size={effectiveSize}
        />
        <Action.Edit onEdit={() => setIsDialogOpen(true)} />
      </LayoutItem>
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

const race3: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = (updates: any) => {
    setField('race3', {
      display: updates.race,
      relation: updates.relation,
      selfIdentified: updates.selfIdentified,
    });
  };

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <>
      <LayoutItem fieldId="race3" label="Ethnicity 3" size="medium" index={index} section={section} {...rest}>
        <MoisTextField
          value={data?.race3?.display || ''}
          readOnly
          borderless
          tabIndex={-1}
          size={effectiveSize}
        />
        <Action.Edit onEdit={() => setIsDialogOpen(true)} />
      </LayoutItem>
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

const religion: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="religion" label="Religion" size="small" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.religion || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('religion', val || '')}
      />
    </LayoutItem>
  );
};

const shortNote: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <LayoutItem fieldId="shortNote" label="Short note" size="medium" index={index} section={section} {...rest}>
      <MoisTextField
        value={data?.shortNote || ''}
        size={effectiveSize}
        onChange={(_, val) => setField('shortNote', val || '')}
      />
    </LayoutItem>
  );
};

const serviceCenter: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);

  const effectiveSize = (rest.size as string | undefined) ?? 'small';

  return (
    <LayoutItem fieldId="serviceCenter" label="Service center" size="small" index={index} section={section} {...rest}>
      <MoisDropdown
        fieldId="serviceCenter"
        codeSystem="MOIS-SERVICECENTER"
        selectedKey={codeOf(data?.serviceCenter) || undefined}
        placeholder="Please select"
        size={effectiveSize}
        onChange={(_, option) => setField('serviceCenter', toCodedValue(option, 'MOIS-SERVICECENTER'))}
      />
    </LayoutItem>
  );
};

const stamp: React.FC<FieldProps> = ({ index, ...props }) => {
  return <AuditStamp fieldId="stamp" index={index} {...props} />;
};

const telecom: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data, setField } = usePatientBinding(section);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const telecomText = data?.telecom?.homePhone
    ? `Home: ${data.telecom.homePhone} Leave msg: ${data.telecom.homeMessage === 'Y' ? 'Yes' : 'No'}\n`
    : '';

  const handleSave = (updates: any) => {
    setField('telecom', { ...data?.telecom, ...updates });
  };

  const effectiveSize = (rest.size as string | undefined) ?? 'medium';

  return (
    <>
      <LayoutItem fieldId="telecom" label="Contact" size="medium" index={index} section={section} {...rest}>
        <MoisTextField
          value={telecomText}
          multiline
          rows={5}
          readOnly
          borderless
          tabIndex={-1}
          size={effectiveSize}
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
  status,
  telecom,
};

// ============================================================================
// All Component (renders the placed fields, or every field with no placement)
// ============================================================================

const All: React.FC<any> = (props) => <ArchAll fields={Fields} {...props} />;

// ============================================================================
// NameBlock Component - Uses the shared NameBlock component
// ============================================================================

const NameBlock: React.FC<any> = (props) => {
  const { data } = usePatientBinding(props.section);

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
