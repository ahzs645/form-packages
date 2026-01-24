/**
 * AssociatedParty Archetype
 * The AssociatedParty archetype defines components for displaying and updating
 * Associated parties or Contacts of a chart
 */

import React from 'react';
import { Checkbox, IDropdownOption } from '@fluentui/react';
import {
  useActiveData,
  useSection,
  useCodeList,
  useEffectOnce,
  produce,
  AssociatedPartyData,
} from '../context/MoisContext';
import { LayoutItem, Grid, Row, AuditStamp } from '../components/Layout';
import { MoisTextField } from '../components/MoisTextField';
import { MoisDropdown } from '../components/MoisDropdown';

// ============================================================================
// Field Components
// ============================================================================

interface FieldProps {
  index?: number | string;
  [key: string]: any;
}

const attachmentCount: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  // Show empty string if attachmentCount is 0 or falsy
  const displayValue = data.attachmentCount ? String(data.attachmentCount) : '';

  return (
    <LayoutItem label="Attached" size="tiny" fieldId="attachmentCount" index={index}>
      <MoisTextField
        fieldId="attachmentCount"
        value={displayValue}
        readOnly
        borderless
        size="tiny"
        {...props}
      />
    </LayoutItem>
  );
};

const name: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="Name" size="small" fieldId="name" index={index}>
      <MoisTextField
        fieldId="name"
        value={data.name ?? ''}
        size="small"
        onChange={(_, val) => {
          setActiveData({ name: val } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const relationshipCode: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="Relationship" size="small" fieldId="relationshipCode" index={index}>
      <MoisTextField
        fieldId="relationshipCode"
        value={data.relationshipCode ?? ''}
        placeholder="Please search"
        size="small"
        onChange={(_, val) => {
          setActiveData({ relationshipCode: val } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const relationshipType: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="Role" size="small" fieldId="relationshipType" index={index}>
      <MoisDropdown
        fieldId="relationshipType"
        codeSystem="MOIS-RELATIONSHIPTYPE"
        value={data.relationshipType}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          setActiveData({ relationshipType: option?.key as string } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const homePhone: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="Home Phone" size="small" fieldId="homePhone" index={index}>
      <MoisTextField
        fieldId="homePhone"
        value={data.homePhone ?? ''}
        size="small"
        onChange={(_, val) => {
          setActiveData({ homePhone: val } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const workPhone: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="Work Phone" size="small" fieldId="workPhone" index={index}>
      <MoisTextField
        fieldId="workPhone"
        value={data.workPhone ?? ''}
        size="small"
        onChange={(_, val) => {
          setActiveData({ workPhone: val } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const workExt: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="Ext." size="small" fieldId="workExt" index={index}>
      <MoisTextField
        fieldId="workExt"
        value={data.workExt ?? ''}
        size="small"
        onChange={(_, val) => {
          setActiveData({ workExt: val } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const note: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="General notes" size="max" fieldId="note" index={index}>
      <MoisTextField
        fieldId="note"
        value={data.note ?? ''}
        multiline
        rows={3}
        size="max"
        onChange={(_, val) => {
          setActiveData({ note: val } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const preferredPhone: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="Preferred phone" size="small" fieldId="preferredPhone" index={index}>
      <MoisDropdown
        fieldId="preferredPhone"
        codeSystem="MOIS-PREFERREDPHONE"
        value={data.preferredPhone}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          setActiveData({ preferredPhone: option?.key as string } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const includeOnDemographics: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="Show on demographics" size="small" fieldId="includeOnDemographics" index={index}>
      <MoisDropdown
        fieldId="includeOnDemographics"
        codeSystem="MOIS-YESNO"
        value={data.includeOnDemographics}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          setActiveData({ includeOnDemographics: option?.key as string } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const isMemberOfCareTeam: React.FC<FieldProps> = ({ index, ...props }) => {
  const section = useSection();
  const [activeData, setActiveData] = useActiveData();
  const data = section.activeSelector ? section.activeSelector(activeData) : {} as AssociatedPartyData;

  return (
    <LayoutItem label="Show on care plan" size="small" fieldId="isMemberOfCareTeam" index={index}>
      <MoisDropdown
        fieldId="isMemberOfCareTeam"
        codeSystem="MOIS-YESNO"
        value={data.isMemberOfCareTeam}
        placeholder="Please select"
        size="small"
        onChange={(_, option) => {
          setActiveData({ isMemberOfCareTeam: option?.key as string } as any);
        }}
        {...props}
      />
    </LayoutItem>
  );
};

const stamp: React.FC<FieldProps> = ({ index, ...props }) => {
  return <AuditStamp index={index} {...props} />;
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
// All Component (renders all fields)
// ============================================================================

const All: React.FC<any> = (props) => {
  return (
    <div>
      <Fields.attachmentCount {...props} />
      <Fields.name {...props} />
      <Fields.relationshipCode {...props} />
      <Fields.relationshipType {...props} />
      <Fields.homePhone {...props} />
      <Fields.workPhone {...props} />
      <Fields.workExt {...props} />
      <Fields.note {...props} />
      <Fields.preferredPhone {...props} />
      <Fields.includeOnDemographics {...props} />
      <Fields.isMemberOfCareTeam {...props} />
      <Fields.stamp {...props} />
    </div>
  );
};

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
        <div>
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
        </div>
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
