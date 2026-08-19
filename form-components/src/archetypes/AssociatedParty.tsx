/**
 * AssociatedParty Archetype
 * The AssociatedParty archetype defines components for displaying and updating
 * Associated parties or Contacts of a chart
 *
 * MOIS parity notes (same contract as ChartPreference):
 * - Every field passes a stable fieldId (its Fields-map key) so section
 *   fieldPlacement can select and position it (`<Grid placement=...>`).
 * - `All` renders the fields as a Fragment in placement order — fields must be
 *   direct grid children for per-field gridArea to work.
 * - Fields read/write through the section's activeSelector when one is set,
 *   storing coded values as { code, display, system } objects like the real
 *   engine. Without a custom section they fall back to the JSON example data
 *   (example.associatedParties) for gallery demos.
 */

import React from 'react';
import { Checkbox, IDropdownOption } from '@fluentui/react';
import {
  useActiveData,
  useCodeList,
  useEffectOnce,
  produce,
  SectionContextValue,
} from '../context/MoisContext';
import { LayoutItem, ArchAll, Grid, Row, AuditStamp } from '../components/Layout';
import { useArchetypeBinding, codeOf, toCodedValue, ArchetypeBinding } from './archetype-binding';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';

// ============================================================================
// Section-aware data access
// ============================================================================

const useAssociatedPartyBinding = (
  sectionOverride?: Partial<SectionContextValue>
): ArchetypeBinding =>
  useArchetypeBinding({
    exampleData: (activeData) => activeData.example?.associatedParties,
    exampleTarget: (draft) => {
      draft.example = draft.example || {};
      return (draft.example.associatedParties = draft.example.associatedParties || {});
    },
    section: sectionOverride,
  });

const usePleaseSelectOptions = (codeSystem: string): IDropdownOption[] => {
  const options = useCodeList(codeSystem);
  return [
    { key: '', text: 'Please select' },
    ...options.map(opt => ({ key: opt.code, text: opt.display })),
  ];
};

/** Free-text fields may hold a coded object in the example data. */
const displayOf = (value: any): string =>
  value && typeof value === 'object'
    ? String(value.display ?? value.code ?? '')
    : value === null || value === undefined ? '' : String(value);

// ============================================================================
// Field Components
// ============================================================================

interface FieldProps {
  index?: number | string;
  section?: Partial<SectionContextValue>;
  [key: string]: any;
}

const makeCodedField = (
  fieldId: string,
  label: string,
  codeSystem: string,
  size: 'tiny' | 'small' | 'medium' | 'large'
): React.FC<FieldProps> => {
  const CodedField: React.FC<FieldProps> = ({ index, section, ...rest }) => {
    const { data, setField } = useAssociatedPartyBinding(section);
    const dropdownOptions = usePleaseSelectOptions(codeSystem);
    // A size override from the Grid (e.g. size="100%") must reach the inner
    // control too, or its own wrapper re-clamps inside the stretched LayoutItem.
    const effectiveSize = (rest.size as typeof size | undefined) ?? size;

    return (
      <LayoutItem fieldId={fieldId} label={label} size={size} index={index} section={section} {...rest}>
        <MoisDropdown
          fieldId={fieldId}
          codeSystem={codeSystem}
          selectedKey={codeOf(data?.[fieldId])}
          options={dropdownOptions}
          placeholder="Please select"
          size={effectiveSize}
          onChange={(_, option) => setField(fieldId, toCodedValue(option, codeSystem))}
        />
      </LayoutItem>
    );
  };
  CodedField.displayName = `AssociatedParty.${fieldId}`;
  return CodedField;
};

const makeTextField = (
  fieldId: string,
  label: string,
  size: 'tiny' | 'small' | 'medium' | 'large' | 'max',
  options: { multiline?: boolean; readOnly?: boolean; placeholder?: string } = {}
): React.FC<FieldProps> => {
  const TextFieldComponent: React.FC<FieldProps> = ({ index, section, ...rest }) => {
    const { data, setField } = useAssociatedPartyBinding(section);
    const value = displayOf(data?.[fieldId]);
    const effectiveSize = (rest.size as typeof size | undefined) ?? size;

    return (
      <LayoutItem fieldId={fieldId} label={label} size={size} index={index} section={section} {...rest}>
        <MoisTextField
          fieldId={fieldId}
          value={value}
          size={effectiveSize}
          {...(options.placeholder ? { placeholder: options.placeholder } : {})}
          {...(options.multiline ? { multiline: true, rows: 3 } : {})}
          {...(options.readOnly
            ? { readOnly: true, borderless: true, tabIndex: -1 }
            : { onChange: (_: unknown, val?: string) => setField(fieldId, val || '') })}
        />
      </LayoutItem>
    );
  };
  TextFieldComponent.displayName = `AssociatedParty.${fieldId}`;
  return TextFieldComponent;
};

const attachmentCount: React.FC<FieldProps> = ({ index, section, ...rest }) => {
  const { data } = useAssociatedPartyBinding(section);

  // Show empty string if attachmentCount is 0 or falsy
  const displayValue = data?.attachmentCount ? String(data.attachmentCount) : '';
  const effectiveSize = (rest.size as string | undefined) ?? 'tiny';

  return (
    <LayoutItem fieldId="attachmentCount" label="Attached" size="tiny" index={index} section={section} {...rest}>
      <MoisTextField
        fieldId="attachmentCount"
        value={displayValue}
        readOnly
        borderless
        tabIndex={-1}
        size={effectiveSize}
      />
    </LayoutItem>
  );
};

const name = makeTextField('name', 'Name', 'small');
const relationshipCode = makeTextField('relationshipCode', 'Relationship', 'small', { placeholder: 'Please search' });
const relationshipType = makeCodedField('relationshipType', 'Role', 'MOIS-RELATIONSHIPTYPE', 'small');
const homePhone = makeTextField('homePhone', 'Home Phone', 'small');
const workPhone = makeTextField('workPhone', 'Work Phone', 'small');
const workExt = makeTextField('workExt', 'Ext.', 'small');
const note = makeTextField('note', 'General notes', 'max', { multiline: true });
const preferredPhone = makeCodedField('preferredPhone', 'Preferred phone', 'MOIS-PREFERREDPHONE', 'small');
const includeOnDemographics = makeCodedField('includeOnDemographics', 'Show on demographics', 'MOIS-YESNO', 'small');
const isMemberOfCareTeam = makeCodedField('isMemberOfCareTeam', 'Show on care plan', 'MOIS-YESNO', 'small');

const stamp: React.FC<FieldProps> = ({ index, ...props }) => {
  return <AuditStamp fieldId="stamp" index={index} {...props} />;
};

// ============================================================================
// Fields Object
// ============================================================================

const Fields = {
  attachmentCount,
  name,
  relationshipCode,
  relationshipType,
  homePhone,
  workPhone,
  workExt,
  note,
  preferredPhone,
  includeOnDemographics,
  isMemberOfCareTeam,
  stamp,
};

// ============================================================================
// All Component (renders the placed fields, or every field with no placement)
// ============================================================================

const All: React.FC<any> = (props) => <ArchAll fields={Fields} {...props} />;

// ============================================================================
// Address Subform
// ============================================================================

interface AddressProps {
  label?: string;
  style?: React.CSSProperties;
  editSection?: string;
  [key: string]: any;
}

const Address: React.FC<AddressProps> = ({
  label = 'Address',
  style,
  editSection = 'associatedPartyEdit',
  ...props
}) => {
  const [activeData, setActiveData] = useActiveData();

  const initialAddress = {
    address: {
      line1: '',
      line2: '',
      city: '',
      province: '',
      postalCode: '',
      country: '',
    },
  };

  useEffectOnce(() => {
    setActiveData(produce((draft: any) => {
      if (!draft.tempArea) draft.tempArea = {};
      if (!draft.tempArea[editSection]) {
        draft.tempArea[editSection] = { ...initialAddress };
      }
    }) as any);
  });

  const addressData = (activeData as any).tempArea?.[editSection]?.address || initialAddress.address;

  const updateField = (field: string, value: string) => {
    setActiveData(produce((draft: any) => {
      if (!draft.tempArea) draft.tempArea = {};
      if (!draft.tempArea[editSection]) draft.tempArea[editSection] = { address: {} };
      draft.tempArea[editSection].address[field] = value;
    }) as any);
  };

  return (
    <div>
      <div>
        <div>
          <Grid columnTemplate="1fr 1fr" placement={`
            line1 line1
            line2 line2
            city province
            postalCode country
          `}>
            <LayoutItem fieldId="line1" layoutId="line1" size="large" labelPosition="none">
              <MoisTextField
                fieldId="line1"
                label="Address Line 1"
                value={addressData.line1}
                size="large"
                onChange={(_, val) => updateField('line1', val || '')}
              />
            </LayoutItem>

            <LayoutItem fieldId="line2" layoutId="line2" size="large" labelPosition="none">
              <MoisTextField
                fieldId="line2"
                label="Address Line 2"
                value={addressData.line2}
                size="large"
                onChange={(_, val) => updateField('line2', val || '')}
              />
            </LayoutItem>

            <LayoutItem fieldId="city" layoutId="city" size="small" labelPosition="none">
              <MoisTextField
                fieldId="city"
                label="City"
                value={addressData.city}
                size="small"
                onChange={(_, val) => updateField('city', val || '')}
              />
            </LayoutItem>

            <LayoutItem fieldId="postalCode" layoutId="postalCode" size="small" labelPosition="none">
              <MoisTextField
                fieldId="postalCode"
                label="Postal code"
                value={addressData.postalCode}
                size="small"
                onChange={(_, val) => updateField('postalCode', val || '')}
              />
            </LayoutItem>

            <LayoutItem fieldId="province" layoutId="province" size="small" labelPosition="none">
              <MoisTextField
                fieldId="province"
                label="Province"
                value={addressData.province}
                size="small"
                onChange={(_, val) => updateField('province', val || '')}
              />
            </LayoutItem>

            <LayoutItem fieldId="country" layoutId="country" size="small" labelPosition="none">
              <MoisTextField
                fieldId="country"
                label="Country"
                value={addressData.country}
                size="small"
                onChange={(_, val) => updateField('country', val || '')}
              />
            </LayoutItem>
          </Grid>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Telecom Subform
// ============================================================================

interface TelecomProps {
  label?: string;
  style?: React.CSSProperties;
  editSection?: string;
  [key: string]: any;
}

const Telecom: React.FC<TelecomProps> = ({
  label = 'Contact',
  style,
  editSection = 'associatedPartyEdit',
  ...props
}) => {
  const [activeData, setActiveData] = useActiveData();

  const initialTelecom = {
    telecom: {
      cellPhone: '',
      faxNumber: '',
      homeEmail: '',
      homeMessage: 'N',
      homePhone: '',
      pagerNumber: '',
      workEmail: '',
      workExt: '',
      workMessage: 'N',
      workPhone: '',
    },
  };

  useEffectOnce(() => {
    setActiveData(produce((draft: any) => {
      if (!draft.tempArea) draft.tempArea = {};
      if (!draft.tempArea[editSection]) {
        draft.tempArea[editSection] = { ...initialTelecom };
      }
    }) as any);
  });

  const telecomData = (activeData as any).tempArea?.[editSection]?.telecom || initialTelecom.telecom;

  const updateField = (field: string, value: string | boolean) => {
    setActiveData(produce((draft: any) => {
      if (!draft.tempArea) draft.tempArea = {};
      if (!draft.tempArea[editSection]) draft.tempArea[editSection] = { telecom: {} };
      draft.tempArea[editSection].telecom[field] = value;
    }) as any);
  };

  return (
    <div>
      <div>
        {/* Single-column Grid (no placement) so an outer Grid's fieldPlacement
            does not hide these subform LayoutItems (a Grid resets the
            fieldPlacement context; a Row inherits it). */}
        <Grid columnTemplate="1fr" gap={0}>
          {/* Home phone row */}
          <Row gap={0} align="end">
            <LayoutItem fieldId="homePhone" size="small" labelPosition="none">
              <MoisTextField
                fieldId="homePhone"
                label="Home phone"
                value={telecomData.homePhone}
                size="small"
                onChange={(_, val) => updateField('homePhone', val || '')}
              />
            </LayoutItem>
            <Checkbox
              label="Leave message"
              checked={telecomData.homeMessage === 'Y'}
              onChange={(_, checked) => updateField('homeMessage', checked ? 'Y' : 'N')}
            />
          </Row>

          {/* Work phone row */}
          <Row gap={0} align="end">
            <LayoutItem fieldId="workPhone" size="small" labelPosition="none">
              <MoisTextField
                fieldId="workPhone"
                label="Work phone"
                value={telecomData.workPhone}
                size="small"
                onChange={(_, val) => updateField('workPhone', val || '')}
              />
            </LayoutItem>
            <LayoutItem fieldId="workExt" size="tiny" labelPosition="none">
              <MoisTextField
                fieldId="workExt"
                label="Ext."
                value={telecomData.workExt}
                size="tiny"
                onChange={(_, val) => updateField('workExt', val || '')}
              />
            </LayoutItem>
            <Checkbox
              label="Leave message"
              checked={telecomData.workMessage === 'Y'}
              onChange={(_, checked) => updateField('workMessage', checked ? 'Y' : 'N')}
            />
          </Row>

          {/* Cell and pager row */}
          <Row gap={0}>
            <LayoutItem fieldId="cellPhone" size="small" labelPosition="none">
              <MoisTextField
                fieldId="cellPhone"
                label="Cell phone"
                value={telecomData.cellPhone}
                size="small"
                onChange={(_, val) => updateField('cellPhone', val || '')}
              />
            </LayoutItem>
            <LayoutItem fieldId="pagerNumber" size="small" labelPosition="none">
              <MoisTextField
                fieldId="pagerNumber"
                label="Pager number"
                value={telecomData.pagerNumber}
                size="small"
                onChange={(_, val) => updateField('pagerNumber', val || '')}
              />
            </LayoutItem>
          </Row>

          {/* Email row */}
          <Row gap={0}>
            <LayoutItem fieldId="homeEmail" size="large" labelPosition="none">
              <MoisTextField
                fieldId="homeEmail"
                label="Home email"
                value={telecomData.homeEmail}
                size="large"
                onChange={(_, val) => updateField('homeEmail', val || '')}
              />
            </LayoutItem>
            <LayoutItem fieldId="workEmail" size="large" labelPosition="none">
              <MoisTextField
                fieldId="workEmail"
                label="Work email"
                value={telecomData.workEmail}
                size="large"
                onChange={(_, val) => updateField('workEmail', val || '')}
              />
            </LayoutItem>
          </Row>
        </Grid>
      </div>
    </div>
  );
};

// ============================================================================
// Export AssociatedParty Archetype
// ============================================================================

export const AssociatedParty = {
  ...Fields,
  All,
  Address,
  Telecom,
  Fields,
};

export default AssociatedParty;
