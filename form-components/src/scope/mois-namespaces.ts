/**
 * MOIS Namespaces
 *
 * Provides MOIS-specific namespaces and mock data for form rendering.
 * These match the structure expected by mois-form-tester.
 */

import React from 'react';
import {
  TextField,
  DatePicker,
  DefaultButton,
  ChoiceGroup,
  Dropdown,
  ComboBox,
  Checkbox,
  Toggle,
} from '@fluentui/react';

// Import hooks directly from MoisContext to avoid circular dependency
import {
  useSourceData,
  useActiveData,
  useCodeList,
  useSection,
  useTheme,
  useActivityOptions,
  useOptionLists,
} from '../context/MoisContext';

// Import controls directly from source files to avoid circular dependency
// Note: src/controls/ is at ../../controls/ from src/lib/code-scope/
import { Header } from '../controls/Header';
import { Footer } from '../controls/Footer';
import { Title } from '../controls/Title';
import { Section } from '../components/Layout';
import { TextArea } from '../controls/TextArea';
import { Action } from '../controls/Action';
import { ButtonBar } from '../controls/ButtonBar';
import { Column } from '../controls/Column';
import { DateSelect } from '../controls/DateSelect';
import { DateTimeSelect } from '../controls/DateTimeSelect';
import { FlowSheet } from '../controls/FlowSheet';
import { Grid } from '../controls/Grid';
import { LayoutItem } from '../controls/LayoutItem';
import { Linear } from '../controls/Linear';
import { ListSelection } from '../controls/ListSelection';
import { Markdown } from '../controls/Markdown';
import { OptionChoice } from '../controls/OptionChoice';
import { Row } from '../controls/Row';
import { SimpleCodeChecklist } from '../controls/SimpleCodeChecklist';
import { SimpleCodeSelect } from '../controls/SimpleCodeSelect';
import { SubForm } from '../controls/SubForm';
import { SubTitleButton } from '../controls/SubTitleButton';
import { Watermark } from '../controls/Watermark';

// Import components directly from source files
import { SaveButton } from '../components/SaveButton';
import { CloseButton } from '../components/CloseButton';
import { RefreshButton } from '../components/RefreshButton';
import { SignButton } from '../components/SignButton';
import { Page } from '../components/Page';
import { PageSelect } from '../components/PageSelect';
import { LinkToMois } from '../components/LinkToMois';
import { DebugView } from '../components/DebugView';
import { FormCreationHistory } from '../components/FormCreationHistory';
import { FormVersion } from '../components/FormVersion';
import { BenefitPlans } from '../components/BenefitPlans';
import { Contact } from '../components/Contact';
import { DeterminantsOfHealth } from '../components/DeterminantsOfHealth';
import { EncounterNotes } from '../components/EncounterNotes';

// Components from src/components - import directly to avoid circular dependency
// (components/index.ts exports NHFormsComponentsPage which imports nhforms-components
//  which imports mois-namespaces, creating a circular import)
import { Form } from '../components/Form';
import { NameBlock } from '../components/NameBlock';
import { SubmitButton } from '../components/SubmitButton';
import { PrintButton } from '../components/PrintButton';
import { FormImage } from '../components/FormImage';

// Trigger toast notification via window event (connects to App.tsx toast system)
const triggerToast = (message: string) => {
  window.dispatchEvent(new CustomEvent('mois-toast', { detail: message }));
};

/**
 * MoisFunction - MOIS API functions available in code
 */
export const MoisFunction = {
  notify: (opts: any) => {
    console.log('MoisFunction.notify called with:', JSON.stringify(opts));
    const message = typeof opts === 'string' ? opts : opts?.message || 'Notification';
    console.log('Toast message:', message);
    triggerToast(message);
  },
  save: () => { console.log('Save called'); triggerToast('Save called'); },
  close: () => { console.log('Close called'); triggerToast('Close called'); },
  print: () => { console.log('Print called'); triggerToast('Print called'); },
  sign: () => { console.log('Sign called'); triggerToast('Sign called'); },
  refresh: () => { console.log('Refresh called'); triggerToast('Refresh called'); },
};

/**
 * MoisHooks - Re-export hooks for Mois namespace
 */
export const MoisHooks = {
  useActivityOptions,
  useSourceData,
  useActiveData,
  useCodeList,
  useSection,
  useTheme,
};

/**
 * NameBlockFields - Mock patient name block data
 */
export const NameBlockFields = {
  name: () => React.createElement('span', { style: { fontWeight: 600 } }, 'Test Patient'),
  birthDate: () => React.createElement('span', null, '1990-01-01'),
  age: () => React.createElement('span', null, '34'),
  gender: () => React.createElement('span', null, 'Male'),
  chartNumber: () => React.createElement('span', null, 'TEST-001'),
  insuranceNumber: () => React.createElement('span', null, '1234567890'),
  address: () => React.createElement('span', null, '123 Test Street'),
  phone: () => React.createElement('span', null, '(555) 123-4567'),
};

/**
 * MoisControl - MOIS form controls
 */
export const MoisControl = {
  TextArea,
  SimpleText: TextField,
  TextField,
  Dropdown,
  ComboBox,
  Checkbox,
  Radio: ChoiceGroup,
  DatePicker,
  Toggle,
  Button: DefaultButton,
  SubmitButton,
  SaveButton,
  PrintButton,
  SignButton,
  RefreshButton,
  CloseButton,
  Form,
  Page,
  PageSelect,
  FormImage,
  LinkToMois,
};

/**
 * Pe - Patient/Encounter fields namespace
 */
// Required field background color (matches theme.mois.requiredBackground)
const REQUIRED_BACKGROUND = '#FFF4CE';

// Helper to create field components with size metadata and required styling
const createField = (
  component: any,
  props: Record<string, any>,
  size: 'tiny' | 'small' | 'medium' | 'large' | 'max' = 'small'
) => {
  const field = (fieldProps: any) => {
    // Apply required background styling for empty required fields
    const isRequired = props.required || fieldProps?.required;
    const styles = isRequired ? {
      fieldGroup: { backgroundColor: REQUIRED_BACKGROUND },
      ...fieldProps?.styles,
    } : fieldProps?.styles;

    return React.createElement(component, { ...props, ...fieldProps, styles });
  };
  (field as any).fieldSize = size;
  return field;
};

export const Pe = {
  Patient: {
    Fields: {
      name: createField(TextField, { label: 'Name' }, 'medium'),
      first: createField(TextField, { label: 'First name', required: true, autoComplete: 'new-password' }, 'medium'),
      middle: createField(TextField, { label: 'Middle name', autoComplete: 'new-password' }, 'medium'),
      family: createField(TextField, { label: 'Family name', required: true, autoComplete: 'new-password' }, 'medium'),
      birthDate: createField(DatePicker, { label: 'Birth Date' }, 'medium'),
      insuranceNumber: createField(TextField, { label: 'Insurance #' }, 'small'),
      insurance: createField(TextField, { label: 'Insurance' }, 'medium'),
      address: createField(TextField, { label: 'Address', multiline: true }, 'medium'),
      phone: createField(TextField, { label: 'Phone' }, 'small'),
      active: createField(Dropdown, { label: 'Current status', options: [{ key: 'active', text: 'Active Patient' }, { key: 'inactive', text: 'Inactive Patient' }], defaultSelectedKey: 'active' }, 'small'),
      firstNationStatus: createField(Dropdown, { label: 'First nation status', options: [{ key: '', text: 'Please select' }, { key: 'yes', text: 'Yes' }, { key: 'no', text: 'No' }] }, 'small'),
    },
  },
  Encounter: {
    Fields: {
      appointmentDateTime: (props: any) => React.createElement(TextField, { label: 'Appointment', type: 'datetime-local', ...props }),
      visitCode: (props: any) => React.createElement(TextField, { label: 'Visit Code', ...props }),
      visitMode: (props: any) => React.createElement(TextField, { label: 'Visit Mode', ...props }),
      visitReason: (props: any) => React.createElement(TextField, { label: 'Visit Reason', ...props }),
      status: (props: any) => React.createElement(TextField, { label: 'Status', ...props }),
      provider: (props: any) => React.createElement(TextField, { label: 'Provider', ...props }),
    },
  },
};

/**
 * MoisExtended - Extended Mois namespace (matching mois-form-tester)
 */
export const MoisExtended = {
  Form,
  Header,
  Footer,
  Title,
  Section,
  TextArea,
  SimpleText: TextField,
  NameBlock,
  QuickNav: () => React.createElement('div', { 'data-component': 'QuickNav' }, 'QuickNav'),
  SubmitButton,
  SaveButton,
  PrintButton,
  CloseButton,
  NameBlockFields,
  nameBlockFields: NameBlockFields,
  Query: {
    nameBlockFields: `patientId chartNumber name { text first middle family } birthDate administrativeGender { code display }`,
    fullChartFields: `patientId chartNumber name { text first middle family } birthDate administrativeGender { code display } telecom { homePhone workPhone cellPhone } insuranceNumber maritalStatus { code display }`,
  },
  Control: MoisControl,
  Patient: {
    Query: {
      nameBlockFields: `patientId chartNumber name { text first middle family } birthDate administrativeGender { code display } educationLevel { code display }`,
      fullChartFields: `patientId chartNumber name { text first middle family } birthDate administrativeGender { code display } telecom { homePhone workPhone cellPhone } insuranceNumber maritalStatus { code display } educationLevel { code display }`,
    },
    Fields: Pe.Patient.Fields,
    NameBlock,
    nameBlockFields: NameBlockFields,
    NameBlockFields,
  },
  Encounter: {
    Query: {},
    Fields: Pe.Encounter.Fields,
  },
  navigate: (module: string, params: any) => console.log('Mois.navigate:', module, params),
  print: () => window.print(),
  close: () => console.log('Mois.close called'),
  formatDate: (date: any) => date ? new Date(date).toLocaleDateString() : '',
  formatDateTime: (date: any) => date ? new Date(date).toLocaleString() : '',
  formatCurrency: (amount: any) => amount ? `$${Number(amount).toFixed(2)}` : '$0.00',
  config: {},
  settings: {},
  patient: {},
  encounter: {},
  user: {},
};

/**
 * AihsControls - AIHS form controls namespace
 * Contains all form controls used in AIHS forms
 */
export const AihsControls = {
  // Layout controls
  Header,
  Footer,
  Title,
  Section,
  Grid,
  Row,
  Column,
  LayoutItem,
  Linear,

  // Input controls
  TextArea,
  DateSelect,
  DateTimeSelect,
  SimpleCodeSelect,
  SimpleCodeChecklist,
  ListSelection,
  OptionChoice,
  Markdown,

  // Action controls
  Action,
  ButtonBar,
  SubForm,
  SubTitleButton,
  Watermark,
  FlowSheet,

  // Fluent UI controls (direct access)
  TextField,
  Dropdown,
  ComboBox,
  Checkbox,
  Toggle,
  DatePicker,
  ChoiceGroup,
};

/**
 * AihsActions - AIHS action functions namespace
 * Contains functions for form actions like save, sign, print, etc.
 */
export const AihsActions = {
  save: () => { console.log('AihsActions.save called'); triggerToast('Saving...'); },
  saveDraft: () => { console.log('AihsActions.saveDraft called'); triggerToast('Saving draft...'); },
  saveSubmit: () => { console.log('AihsActions.saveSubmit called'); triggerToast('Submitting...'); },
  sign: () => { console.log('AihsActions.sign called'); triggerToast('Signing...'); },
  signSubmit: () => { console.log('AihsActions.signSubmit called'); triggerToast('Sign and submit...'); },
  unsign: () => { console.log('AihsActions.unsign called'); triggerToast('Unsigning...'); },
  close: () => { console.log('AihsActions.close called'); triggerToast('Closing...'); },
  cancel: () => { console.log('AihsActions.cancel called'); triggerToast('Cancelling...'); },
  print: () => { console.log('AihsActions.print called'); window.print(); },
  refresh: () => { console.log('AihsActions.refresh called'); triggerToast('Refreshing...'); },
  reload: () => { console.log('AihsActions.reload called'); triggerToast('Reloading...'); },
  notify: (opts: any) => {
    const message = typeof opts === 'string' ? opts : opts?.message || 'Notification';
    triggerToast(message);
  },
  showValidationErrors: (errors: any[]) => {
    console.log('AihsActions.showValidationErrors called', errors);
    triggerToast(`Validation errors: ${errors?.length || 0}`);
  },
};

/**
 * AihsFunctions - AIHS utility functions namespace
 * Contains utility functions for formatting, validation, etc.
 */
export const AihsFunctions = {
  // Date formatting
  formatDate: (date: any) => date ? new Date(date).toLocaleDateString() : '',
  formatDateTime: (date: any) => date ? new Date(date).toLocaleString() : '',
  getDateString: (date: any) => date ? new Date(date).toISOString().split('T')[0] : '',
  getTimeString: (date: any) => date ? new Date(date).toTimeString().split(' ')[0] : '',
  getDateTimeString: (date: any) => date ? new Date(date).toISOString() : '',
  parseDate: (str: string) => str ? new Date(str) : null,

  // Number formatting
  formatCurrency: (amount: any) => amount ? `$${Number(amount).toFixed(2)}` : '$0.00',

  // Phone formatting
  formatPhoneNumber: (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  },

  // Insurance number formatting
  formatInsuranceNumber: (num: string) => {
    if (!num) return '';
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return num;
  },

  // PHN (Personal Health Number) utilities
  cleanPhn: (phn: string) => phn ? phn.replace(/\D/g, '') : '',
  validPhn: (phn: string) => {
    const cleaned = phn ? phn.replace(/\D/g, '') : '';
    return cleaned.length === 10;
  },
  displayHealthNumber: (phn: string) => {
    if (!phn) return '';
    const cleaned = phn.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return phn;
  },

  // Age calculations
  getAge: (birthDate: any) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  },
  getAgeInYears: (birthDate: any) => {
    const age = AihsFunctions.getAge(birthDate);
    return typeof age === 'number' ? age : 0;
  },

  // Code list utilities
  codeListFromOptionList: (optionList: any[]) => {
    return (optionList || []).map((opt: any) => ({
      code: opt.code || opt.value,
      display: opt.display || opt.text || opt.label,
      system: opt.system || '',
    }));
  },
  fluentOptionsFromCodeList: (codeList: any[]) => {
    return (codeList || []).map((item: any) => ({
      key: item.code,
      text: item.display,
    }));
  },
  dropdownsFromOptionList: (optionList: any[]) => {
    return (optionList || []).map((opt: any) => ({
      key: opt.code || opt.value,
      text: opt.display || opt.text || opt.label,
    }));
  },

  // Misc utilities
  produce: (base: any, recipe: (draft: any) => void) => {
    // Simplified produce - in real app would use immer
    const draft = JSON.parse(JSON.stringify(base));
    recipe(draft);
    return draft;
  },
  makeIndex: (arr: any[], key: string) => {
    return (arr || []).reduce((acc: any, item: any) => {
      acc[item[key]] = item;
      return acc;
    }, {});
  },
};
