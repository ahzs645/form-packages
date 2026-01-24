/**
 * Build Scope
 *
 * Creates the scope object with all available components, hooks, and utilities
 * for use in CodePreview live code blocks and the Playground.
 */

import React from 'react';
import { produce } from 'immer';
import {
  Stack,
  StackItem,
  Text,
  TextField,
  Dropdown,
  DatePicker,
  PrimaryButton,
  DefaultButton,
  SpinButton,
  Checkbox,
  Toggle,
  ChoiceGroup,
  ComboBox,
  Label,
  Separator,
  Persona,
  PersonaSize,
  Icon,
  IconButton,
  MessageBar,
  MessageBarType,
  Link,
  Panel,
  PanelType,
  Dialog,
  DialogType,
  DialogFooter,
  Pivot,
  PivotItem,
  Nav,
  SearchBox,
  ProgressIndicator,
  Breadcrumb,
  Callout,
  ColorPicker,
  CommandBar,
  DetailsList,
  DetailsListLayoutMode,
  DocumentCard,
  DocumentCardPreview,
  DocumentCardTitle,
  Facepile,
  FocusZone,
  FocusZoneDirection,
  FontIcon,
  GroupedList,
  HoverCard,
  Image,
  Layer,
  List,
  MaskedTextField,
  Modal,
  Overlay,
  OverflowSet,
  Rating,
  ResizeGroup,
  ScrollablePane,
  SelectionMode,
  Shimmer,
  Slider,
  Spinner,
  SpinnerSize,
  Sticky,
  StickyPositionType,
  SwatchColorPicker,
  TagPicker,
  TeachingBubble,
  ThemeProvider,
  TooltipHost,
  mergeStyles,
  mergeStyleSets,
} from '@fluentui/react';

// Import from lib/index
import {
  // Layout
  Section,
  LayoutItem,
  AuditStamp,
  // Controls
  Action,
  ActionDemo1,
  ActionDemo2,
  ActionDemo3,
  ActionBar,
  ActionButton,
  ActionRefresh,
  ActionEdit,
  ActionCheckMark,
  ActionAccept,
  ActionAdd,
  ActionCancel,
  ActionDelete,
  ActionInfo,
  ActionGotoRecord,
  ActionLinkToMois,
  ButtonBar,
  ButtonBarDemo,
  Column,
  Columns,
  ColumnDemo,
  DateSelect,
  DateSelectDemo1,
  DateSelectDemo2,
  DateSelectDemo3,
  DateSelectDemo4,
  DateSelectDemo5,
  DateTimeSelect,
  DateTimeSelectDemo,
  TimeSelect,
  TimeSelectDemo1,
  FlowSheet,
  FlowSheetDemo,
  Footer,
  FooterDemo,
  ControlGrid,
  GridItem,
  GridDemo1,
  GridDemo2,
  Header,
  HeaderDemo,
  Heading,
  LayoutItemDemo1,
  LayoutItemDemo2,
  LayoutItemDemo3,
  LayoutItemDemo4,
  Linear,
  LinearDemo,
  ListSelection,
  ListSelectionDemo1,
  ListSelectionDemo2,
  ListSelectionDemo3,
  ListSelectionDemo4,
  ListSelectionDemo5,
  ListSelectionDemo6,
  Markdown,
  Numeric,
  OptionChoice,
  OptionChoiceDemo1,
  OptionChoiceDemo2,
  OptionChoiceDemo3,
  ControlRow,
  RowDemo1,
  RowDemo2,
  SimpleCodeChecklist,
  SimpleCodeChecklistDemo1,
  SimpleCodeChecklistDemo2,
  SimpleCodeChecklistDemo3,
  SimpleCodeSelect,
  SimpleCodeSelectDemo1,
  SimpleCodeSelectDemo2,
  SimpleCodeSelectDemo3,
  SimpleCodeSelectDemo4,
  SimpleCodeSelectDemo5,
  SimpleCodeSelectDemo6,
  SimpleCodeSelectDemo7,
  SimpleCodeSelectDemo8,
  SimpleCodeSelectDemo9,
  SubForm,
  SubFormDemo1,
  SubFormDemo2,
  SubFormDemo3,
  SubTitleButton,
  SubTitleButtonDemo1,
  TextArea,
  TextAreaDemo1,
  TextAreaDemo2,
  TextAreaDemo3,
  TextAreaDemo4,
  TextAreaDemo5,
  TextAreaDemo6,
  TextAreaDemo7,
  Title,
  TitleDemo1,
  Watermark,
  WatermarkDemo1,
  FindCode,
  // Components
  BenefitPlans,
  CloseButton,
  Contact,
  DebugView,
  EncounterNotes,
  FormCreationHistory,
  FormVersion,
  LinkToMois,
  Page,
  PageSelector,
  PageSelect,
  RefreshButton,
  SaveButton,
  SaveStatus,
  SectionCompletionDemo,
  SignButton,
  Toast,
  // Archetypes
  AssociatedParty,
  ChartPreference,
  Connection,
  Correspondence,
  Encounter,
  Observation,
  ObservationPanel,
  Patient,
  Query,
  Task,
  // Hooks
  useSourceData,
  useCodeList,
  useSection,
  useTheme,
  useActivityOptions,
  useEffectOnce,
} from '../index';

// Import controls
import { Activity, ActivityLayout } from '../controls/ActivityLayout';

// Import components (from src/components)
import {
  Form,
  FormImage,
  HouseholdOccupant,
  Occupant,
  NameBlock,
  PageStepButton,
  PageStepProvider,
  NextStepButton,
  BackStepButton,
  PrintButton,
  Provider,
  ServiceEpisode,
  SubmitButton,
  UserProfile,
  DeterminantsOfHealth,
} from '../components';

// Import from code-scope modules
import { FluentNamespace, FluentActionButton } from './fluent-namespace';
import { useActiveDataForForms } from '../hooks/form-state';
import {
  useOnLoad,
  useOnRefresh,
  usePrinting,
  useMutation,
  useQuery,
  useFormLock,
  testLock,
  useHotKey,
  useMoisNavigate,
  useSetting,
  useTempData,
  useConfirmUnload,
} from '../hooks/mock-hooks';
import {
  MoisFunction,
  MoisHooks,
  MoisControl,
  MoisExtended,
  NameBlockFields,
  Pe,
} from './mois-namespaces';

// Import NHForms components (auto-discovered from nhforms-components folder)
import { nhformsComponents } from '../nhforms';

// Import SubTitle
import { SubTitle, SubTitleGroupProvider } from '../controls/SubTitle';

// Import GuidelineLink
import { GuidelineLink } from '../controls/GuidelineLink';

/**
 * SaveOnClose Component
 * Automatically saves form data as draft when the browser window/tab is closed.
 * This is defined here directly to ensure it's always available in scope.
 */
const SaveOnClose: React.FC<{ getSaveData?: () => any; disabled?: boolean }> = ({
  getSaveData,
  disabled = false,
}) => {
  React.useEffect(() => {
    if (disabled) return;

    const handleBeforeUnload = () => {
      // In preview mode, just log the save action
      console.log('[SaveOnClose] Would save draft on close');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [getSaveData, disabled]);

  return null;
};

/**
 * useSaveOnClose Hook
 * Hook version of SaveOnClose for more control.
 */
const useSaveOnClose = (getSaveData?: () => any, disabled = false) => {
  React.useEffect(() => {
    if (disabled) return;

    const handleBeforeUnload = () => {
      console.log('[useSaveOnClose] Would save draft on close');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [getSaveData, disabled]);
};

/**
 * Build the scope object with all available components and utilities
 */
export const buildScope = (): Record<string, any> => ({
  // React
  React,
  useState: React.useState,
  useEffect: React.useEffect,
  useMemo: React.useMemo,
  useCallback: React.useCallback,
  useRef: React.useRef,

  // Fluent UI Components
  Stack, Text, TextField, Dropdown, DatePicker,
  PrimaryButton, DefaultButton, SpinButton, Checkbox,
  Toggle, ChoiceGroup, ComboBox, Label, Separator,
  Persona, PersonaSize, Icon, IconButton, MessageBar, MessageBarType, Link,

  // Fluent UI Aliases
  Divider: Separator,

  // Layout
  Section,
  LayoutItem,
  AuditStamp,

  // MOIS Controls
  Action,
  ActionDemo1,
  ActionDemo2,
  ActionDemo3,
  ActionBar,
  ActionButton,
  ActionRefresh,
  ActionEdit,
  ActionCheckMark,
  ActionAccept,
  ActionAdd,
  ActionCancel,
  ActionDelete,
  ActionInfo,
  ActionGotoRecord,
  ActionLinkToMois,
  Activity,
  ActivityLayout,
  ButtonBar,
  ButtonBarDemo,
  Column,
  Columns,
  ColumnDemo,
  DateSelect,
  DateSelectDemo1,
  DateSelectDemo2,
  DateSelectDemo3,
  DateSelectDemo4,
  DateSelectDemo5,
  DateTimeSelect,
  DateTimeSelectDemo,
  TimeSelect,
  TimeSelectDemo1,
  FlowSheet,
  FlowSheetDemo,
  Footer,
  FooterDemo,
  Grid: ControlGrid,
  ControlGrid,
  GridItem,
  GridDemo1,
  GridDemo2,
  Header,
  HeaderDemo,
  Heading,
  LayoutItemDemo1,
  LayoutItemDemo2,
  LayoutItemDemo3,
  LayoutItemDemo4,
  Linear,
  LinearDemo,
  ListSelection,
  ListSelectionDemo1,
  ListSelectionDemo2,
  ListSelectionDemo3,
  ListSelectionDemo4,
  ListSelectionDemo5,
  ListSelectionDemo6,
  Markdown,
  Numeric,
  OptionChoice,
  OptionChoiceDemo1,
  OptionChoiceDemo2,
  OptionChoiceDemo3,
  Row: ControlRow,
  ControlRow,
  RowDemo1,
  RowDemo2,
  SimpleCodeChecklist,
  SimpleCodeChecklistDemo1,
  SimpleCodeChecklistDemo2,
  SimpleCodeChecklistDemo3,
  SimpleCodeSelect,
  SimpleCodeSelectDemo1,
  SimpleCodeSelectDemo2,
  SimpleCodeSelectDemo3,
  SimpleCodeSelectDemo4,
  SimpleCodeSelectDemo5,
  SimpleCodeSelectDemo6,
  SimpleCodeSelectDemo7,
  SimpleCodeSelectDemo8,
  SimpleCodeSelectDemo9,
  SubForm,
  SubFormDemo1,
  SubFormDemo2,
  SubFormDemo3,
  SubTitleButton,
  SubTitleButtonDemo1,
  TextArea,
  TextAreaDemo1,
  TextAreaDemo2,
  TextAreaDemo3,
  TextAreaDemo4,
  TextAreaDemo5,
  TextAreaDemo6,
  TextAreaDemo7,
  Title,
  TitleDemo1,
  Watermark,
  WatermarkDemo1,
  FindCode,

  // Components
  BenefitPlans,
  CloseButton,
  Contact,
  DebugView,
  EncounterNotes,
  FormCreationHistory,
  FormVersion,
  LinkToMois,
  Page,
  PageSelector,
  PageSelect,
  RefreshButton,
  SaveButton,
  SaveStatus,
  SectionCompletionDemo,
  SignButton,
  Toast,

  // Archetypes
  AssociatedParty,
  ChartPreference,
  Connection,
  Correspondence,
  Encounter,
  Observation,
  ObservationPanel,
  Patient,
  Query,
  Task,

  // Additional Components (from src/components)
  Form,
  FormImage,
  HouseholdOccupant,
  Occupant,
  NameBlock,
  PageStepButton,
  PageStepProvider,
  NextStepButton,
  BackStepButton,
  PrintButton,
  Provider,
  ServiceEpisode,
  SubmitButton,
  UserProfile,
  DeterminantsOfHealth,

  // Namespaces
  Mois: {
    ...MoisExtended,
    // Add archetypes that MoisExtended is missing
    AssociatedParty,
    ChartPreference,
    Connection,
    Correspondence,
    Encounter,  // Full archetype (replaces minimal mock in MoisExtended)
    Observation,
    ObservationPanel,
    // Patient: merge archetype with MoisExtended, but keep simple Fields for grid placement
    Patient: {
      ...Patient,              // Archetype properties
      ...MoisExtended.Patient, // Overwrites with simple Fields from Pe.Patient.Fields
    },
    Query,
    Task,
  },
  Fluent: FluentNamespace,
  Fabric: FluentNamespace,  // Alias for forms using Fabric.* syntax
  FluentUI: FluentNamespace, // Another common alias
  MoisFunction,
  MoisHooks,
  MoisControl,
  Pe,
  NameBlockFields,

  // MOIS Hooks
  useSourceData,
  useActiveData: useActiveDataForForms, // Use custom implementation for forms
  useCodeList,
  useSection,
  useTheme,
  useActivityOptions,
  useEffectOnce,
  useOnLoad,
  useOnRefresh,
  usePrinting,
  useMutation,
  useQuery,
  useFormLock,
  testLock,
  useHotKey,
  useMoisNavigate,
  useSetting,
  useTempData,
  useConfirmUnload,

  // Immer
  produce,

  // Additional Fluent UI components
  Panel, PanelType, Dialog, DialogType, DialogFooter,
  Pivot, PivotItem, Nav, SearchBox, ProgressIndicator,
  StackItem,
  FluentActionButton, // Fluent UI's ActionButton (distinct from MOIS ActionButton)
  Breadcrumb,
  Callout,
  ColorPicker,
  CommandBar,
  DetailsList,
  DetailsListLayoutMode,
  DocumentCard,
  DocumentCardPreview,
  DocumentCardTitle,
  Facepile,
  FocusZone,
  FocusZoneDirection,
  FontIcon,
  GroupedList,
  HoverCard,
  Image,
  Layer,
  List,
  MaskedTextField,
  Modal,
  Overlay,
  OverflowSet,
  Rating,
  ResizeGroup,
  ScrollablePane,
  SelectionMode,
  Shimmer,
  Slider,
  Spinner,
  SpinnerSize,
  Sticky,
  StickyPositionType,
  SwatchColorPicker,
  TagPicker,
  TeachingBubble,
  ThemeProvider,
  TooltipHost,
  mergeStyles,
  mergeStyleSets,
  // Enums
  SelectableOptionMenuItemType: { Normal: 0, Divider: 1, Header: 2 },

  // JavaScript globals
  Object, Array, console, JSON, Math, Date, String, Number, Boolean,
  parseInt, parseFloat, isNaN, undefined,
  setTimeout, setInterval, clearTimeout, clearInterval,
  // Browser globals for DOM access
  document: typeof document !== 'undefined' ? document : undefined,
  window: typeof window !== 'undefined' ? window : undefined,
  alert: (msg: any) => console.log('Alert:', msg),
  confirm: () => true,
  prompt: () => 'user input',

  // Mock Ajv (JSON Schema validator) for preview mode
  // In production, forms use the real Ajv library for validation before submit
  Ajv: class MockAjv {
    errors: any[] | null = null;
    constructor(_options?: any) {}
    validate(_schema: any, _data: any): boolean {
      // In preview mode, always return valid (we're not actually saving)
      this.errors = null;
      console.log('[Preview] Ajv validation skipped in preview mode');
      return true;
    }
    compile(_schema: any) {
      return (_data: any) => {
        this.errors = null;
        return true;
      };
    }
  },

  // Form action functions (standalone versions for direct calls)
  saveDraft: (sd: any, fd: any, data: any) => {
    console.log('saveDraft called', { sd, fd, data });
  },
  closeForm: () => {
    console.log('closeForm called');
  },
  saveSubmit: (sd: any, fd: any, data: any) => {
    console.log('saveSubmit called', { sd, fd, data });
  },

  // Date/Age/Time helper functions (from MoisFunction, exposed at root for convenience)
  getDateString: (date: any) => date ? new Date(date).toISOString().split('T')[0] : '',
  getTimeString: (date: any) => {
    if (!date) return '';
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },
  getDateTimeString: (date: any) => date ? new Date(date).toISOString() : '',
  getAge: (birthDate: any) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    let years = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      years--;
    }
    return `${years} years`;
  },

  // SubTitle component
  SubTitle,
  SubTitleGroupProvider,

  // GuidelineLink component
  GuidelineLink,

  // SaveOnClose component (explicit to ensure availability)
  SaveOnClose,
  useSaveOnClose,

  // Default Identity object for forms that reference Identity.title
  // In production, this would be loaded from Identity.json
  Identity: {
    title: 'Form Preview',
    name: 'FormPreview',
    description: '',
    version: { major: 1, minor: 0, patch: 0 },
    type: 'form',
    owner: 'Preview',
    author: 'Preview',
    publisher: 'Preview',
    requiredFormViewerVersion: { major: 0, minor: 1, patch: 0 },
    requiredMoisVersion: { major: 2, minor: 26, patch: 18 },
  },

  // NHForms components (auto-discovered from nhforms-components folder)
  // Adding new components to nhforms-components folder will automatically make them available
  ...nhformsComponents,
});

export default buildScope;
