/**
 * NHForms Components Auto-Loader (Next.js/webpack version)
 *
 * Uses pre-generated component sources for compatibility with Next.js/webpack.
 * This file is used when building with Next.js or other webpack-based bundlers.
 *
 * For Vite, use index.vite.ts instead (supports auto-discovery).
 *
 * To update component sources after adding/modifying components:
 *   node scripts/generate-nhforms-sources.js
 */

import React from 'react';
import { produce } from 'immer';
import * as FluentUI from '@fluentui/react';
import * as Babel from '@babel/standalone';

// Import hooks and components directly from source files to avoid circular dependency
// (build-scope.ts imports nhformsComponents, so we can't import from ../lib which loads build-scope)
import {
  useSourceData,
  useTheme,
  useCodeList,
  useSection,
  useActivityOptions,
} from '../context/MoisContext';
import { SimpleCodeSelect } from '../controls/SimpleCodeSelect';
import { SimpleCodeChecklist } from '../controls/SimpleCodeChecklist';
import { ListSelection } from '../controls/ListSelection';
import { TextArea } from '../controls/TextArea';
import { Linear } from '../controls/Linear';
import { LayoutItem } from '../controls/LayoutItem';
import { useActiveDataForForms } from '../hooks/form-state';
import { useOnLoad, useOnRefresh, useMutation } from '../hooks/mock-hooks';
import { SubmitButton, NameBlock, Form } from '../components';
import { SubTitle } from '../controls/SubTitle';
import { FluentNamespace } from '../scope/fluent-namespace';
import { LinkToMois } from '../components/LinkToMois';
import { DateSelect } from '../controls/DateSelect';
import { DateTimeSelect } from '../controls/DateTimeSelect';
import { Title } from '../controls/Title';
import { Header } from '../controls/Header';
import { Column } from '../controls/Column';
import { Row } from '../controls/Row';
import { Action } from '../controls/Action';
import { ButtonBar } from '../controls/ButtonBar';
import { SubForm } from '../controls/SubForm';
import { Heading } from '../controls/Heading';
import { MoisExtended } from '../scope/mois-namespaces';
import { Patient } from '../archetypes/Patient';
import { Connection } from '../archetypes/Connection';
import { Observation } from '../archetypes/Observation';
import { ObservationPanel } from '../archetypes/ObservationPanel';
import { Query } from '../archetypes/Query';
import { SaveStatus } from '../components/SaveStatus';
import { OptionChoice } from '../controls/OptionChoice';
import { Numeric } from '../controls/Numeric';

// Import pre-generated component sources (Next.js doesn't support Vite's import.meta.glob)
// Regenerate with: node scripts/generate-nhforms-sources.js
import { componentModules } from './component-sources.generated';

// Shared utility functions used across NHForms components (from CommonSchemaDefn)
const selectAll = () => true;
const startDateDesc = (a: any, b: any) => -a.startDate?.localeCompare(b.startDate || '') || 0;

// Date/time utility functions used by HFC components
const getDateString = (date: Date, separator: string = '-'): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${separator}${month}${separator}${day}`;
};

const getTimeString = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const getDateTimeString = (date: Date): string => {
  return `${getDateString(date, '-')}T${getTimeString(date)}`;
};

// Mock refresh function for forms
const refresh = (sd: any) => {
  console.log('refresh called', sd);
  triggerToast('Refreshing...');
};

// Mock saveDraft function for forms
const saveDraft = async (sd: any, fd: any, data: any) => {
  console.log('saveDraft called', { sd, fd, data });
  triggerToast('Draft saved');
  return Promise.resolve();
};

// Simple Markdown component for rendering markdown text in NHForms components
const Markdown: React.FC<{ source?: string; children?: string }> = ({ source, children }) => {
  const text = source || children || '';
  // Basic markdown to HTML conversion for common patterns
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // Bold
    .replace(/\*(.+?)\*/g, '<em>$1</em>')              // Italic
    .replace(/^- (.+)$/gm, '<li>$1</li>')             // List items
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')       // Wrap list items
    .replace(/\n/g, '<br />');                         // Line breaks
  return React.createElement('div', {
    className: 'markdown-content',
    style: { fontSize: '12px', color: '#605e5c' },
    dangerouslySetInnerHTML: { __html: html }
  });
};

// Trigger toast notification via window event
const triggerToast = (message: string) => {
  window.dispatchEvent(new CustomEvent('mois-toast', { detail: message }));
};

// Build the scope that NHForms components expect
// additionalComponents allows injecting already-loaded components for cross-references
const buildNHFormsScope = (additionalComponents: Record<string, any> = {}) => {
  // Define MoisHooks locally to avoid circular dependency
  const MoisHooks = {
    useActivityOptions,
    useSourceData,
    useActiveData: useActiveDataForForms,
    useCodeList,
    useSection,
    useTheme,
  };

  // Define MoisFunction locally
  const MoisFunction = {
    notify: (opts: any) => {
      const message = typeof opts === 'string' ? opts : opts?.message || 'Notification';
      triggerToast(message);
    },
    save: () => triggerToast('Save called'),
    close: () => triggerToast('Close called'),
    print: () => triggerToast('Print called'),
    sign: () => triggerToast('Sign called'),
    refresh: () => triggerToast('Refresh called'),
    // mapSourceToActive - creates a mapping function for ListSelection columns
    mapSourceToActive: (columns: any[]) => {
      return (item: any) => {
        const result: any = {};
        for (const col of columns) {
          if (col.onColumnMap) {
            result[col.id] = col.onColumnMap(item);
          } else {
            result[col.id] = item[col.id];
          }
        }
        return result;
      };
    },
  };

  // Define MoisControl locally (uses FluentUI components)
  const MoisControl = {
    TextArea,
    SimpleText: FluentUI.TextField,
    TextField: FluentUI.TextField,
    Dropdown: FluentUI.Dropdown,
    ComboBox: FluentUI.ComboBox,
    Checkbox: FluentUI.Checkbox,
    Radio: FluentUI.ChoiceGroup,
    DatePicker: FluentUI.DatePicker,
    Toggle: FluentUI.Toggle,
    Button: FluentUI.DefaultButton,
    SubmitButton,
    LayoutItem,
  };

  return {
    // React
    React,
    useState: React.useState,
    useEffect: React.useEffect,
    useMemo: React.useMemo,
    useCallback: React.useCallback,
    useRef: React.useRef,

    // Fluent UI namespace (components expect Fluent.Stack, Fluent.Label, etc.)
    Fluent: FluentNamespace,

    // Individual Fluent components (some components use them directly)
    ...FluentUI,

    // MOIS hooks
    useActiveData: useActiveDataForForms,
    useSourceData,
    useTheme,
    useCodeList,
    useSection,
    useActivityOptions,
    useOnLoad,
    useOnRefresh,
    useMutation,

    // MOIS namespaces
    MoisHooks,
    MoisFunction,
    MoisControl,
    // Full Mois namespace with archetypes
    Mois: {
      ...MoisExtended,
      Connection,
      Observation,
      ObservationPanel,
      Patient: {
        ...Patient,
        ...MoisExtended.Patient,
      },
      Query,
    },

    // MOIS components that NHForms components use
    SimpleCodeSelect,
    SimpleCodeChecklist,
    ListSelection,
    TextArea,
    SubmitButton,
    SubTitle,
    Linear,
    LinkToMois,
    LayoutItem,
    NameBlock,
    Form,
    DateSelect,
    DateTimeSelect,
    Title,
    Header,
    Column,
    Row,
    Action,
    ButtonBar,
    SubForm,
    Heading,
    SaveStatus,
    OptionChoice,
    Numeric,

    // Shared utility functions (from CommonSchemaDefn)
    selectAll,
    startDateDesc,

    // Date/time utility functions
    getDateString,
    getTimeString,
    getDateTimeString,

    // Form action functions
    refresh,
    saveDraft,

    // Markdown component for rendering markdown content
    Markdown,

    // Immer
    produce,

    // JavaScript globals
    Object, Array, console, JSON, Math, Date, String, Number, Boolean,
    parseInt, parseFloat, isNaN, undefined,
    window: typeof window !== 'undefined' ? window : {},

    // Additional components loaded from other NHForms files (for cross-references)
    ...additionalComponents,
  };
};

/**
 * Execute component code with the NHForms scope and extract defined components
 * @param additionalComponents - Components already loaded that can be referenced
 */
function loadComponentCode(code: string, componentName: string, additionalComponents: Record<string, any> = {}): Record<string, any> {
  const scope = buildNHFormsScope(additionalComponents);

  // Components to extract from the executed code
  const extractNames = [
    // HonosQuestion exports
    'Scale5', 'Scale10', 'Scale5Legend', 'Scale10Legend', 'Scale5QuestionList', 'Scale5SubmitButton',
    'Scale5ToolTip', 'HonosFinalScore',
    // MSE exports
    'MseSpeech', 'MseThought', 'MseAffect', 'MsePerception', 'MseStamp',
    'MseAbc', 'MseEr', 'MseLick',
    // List components
    'Allergies', 'Conditions', 'Goals', 'LongTermMedications',
    'ServiceEpisodes', 'ServiceRequests', 'Connections', 'Occupations',
    'EducationHistory', 'PlannedActions', 'ReferralSource', 'Occupant',
    // Filter functions from ServiceEpisodes and ServiceRequests
    'activeServiceEpisodes', 'activeServiceRequests', 'orderDateDesc',
    // Other components
    'AliasIdList', 'Ethnicity', 'RelationshipStatus', 'FirstNationsStatus',
    // HFC components
    'HFC_PT_ASMT_PatientAssessment', 'HFC_PT_ASMT_PatientSummary', 'HFC_PT_ASMT_SnapShot',
    // Utility components
    'NewTextArea', 'useChangeWatch',
    // Shared variables from Ethnicity used by FirstNationsStatus
    'firstNationsEthnicityReferenceSet', 'firstNationEthnicityCodes',
    // Schema and utilities from CommonSchemaDefn
    'CommonSchemaDefn', 'Schema', 'Fields', 'Columns', 'Prompts',
    'commonSchemaDefn', 'nameBlockSchema', 'NameBlockFields', 'formHistorySchema',
    // ScaleField exports
    'ScaleField', 'ScaleFieldLegend', 'ScaleFieldTooltip',
    // EditableTable exports
    'EditableTable', 'EditableTableSchema', 'createTableColumns',
    // ScoringModule exports
    'ScoringModule', 'ScoringModuleSchema', 'createScoringQuestion', 'createScoringTotal', 'createScoringConfig',
    // SubformScoring exports
    'SubformScoring',
    // PDF regeneration exports
    'PdfRegenerator',
    // CompactBooleanField exports
    'CompactBooleanField', 'CompactBooleanGroup', 'CompactBooleanChecklist', 'YesNoButtons',
    'BooleanLabelPresets', 'ControllerLabelPresets',
    'CompactBooleanFieldSchema', 'CompactBooleanChecklistSchema',
    // CompactChoiceField exports (multi-option button selection)
    'CompactChoiceField', 'OptionButtons', 'CompactChoiceFieldSchema', 'CompactChoiceFieldMultiSchema',
    'ConditionalGroup', 'ConditionalField', 'LogicGateProvider', 'useConditionalVisibility',
    // SaveOnClose exports
    'SaveOnClose', 'useSaveOnClose',
    // SignaturePad exports
    'SignaturePad',
    // Utility functions from CommonSchemaDefn
    'makeValueSetOptions', 'makeTextObsUpdates', 'makeCodedObsUpdates', 'makeObsUpdatesFromVs',
    'ynuaOptions',
    // GraphQL Fields definitions from list components
    'firstNationsStatusPatientFields', 'firstNationsStatusSchema',
    'PlannedActionsFields', 'AliasIdListFields', 'AllergiesFields',
    'ConditionsFields', 'ConnectionsFields', 'GoalsFields',
    'LongTermMedicationsFields', 'ServiceEpisodesFields', 'ServiceRequestsFields',
    'OccupationsFields', 'EducationHistoryFields', 'ReferralSourceFields',
    // Also extract the component name itself (folder name)
    componentName,
  ];

  try {
    // Transform JSX/TSX to JavaScript using Babel
    const transformed = Babel.transform(code, {
      presets: ['react', 'typescript'],
      filename: `${componentName}.tsx`
    }).code;

    if (!transformed) {
      console.warn(`Failed to transform NHForms component ${componentName}: empty result`);
      return {};
    }

    // Create a proxy that returns placeholders for undefined properties
    const createPlaceholder = (name: string): any => {
      const PlaceholderComponent: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
        React.createElement('div', { 'data-missing': name, style: { display: 'contents' } }, children);
      PlaceholderComponent.displayName = `Placeholder_${name}`;
      return PlaceholderComponent;
    };

    const scopeProxy = new Proxy(scope, {
      get(target, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop in target) return (target as any)[prop as string];
        // Return placeholder for missing components (silently)
        return createPlaceholder(String(prop));
      },
      has(target, prop) {
        if (typeof prop === 'symbol') return false;
        // Only return true for properties actually in the scope
        // This allows locally defined variables to shadow scope variables
        return prop in target;
      }
    });

    // Build extraction code
    const extractCode = extractNames.map(name =>
      `try { if (typeof ${name} !== 'undefined') __exports__.${name} = ${name}; } catch(e) {}`
    ).join('\n');

    // Build injection code for additional components (cross-references)
    // Only inject components that are NOT defined in this file to avoid duplicate declarations
    // Check if the component is defined in the source code
    const isDefinedInCode = (name: string) => {
      // Check for various declaration patterns
      const patterns = [
        new RegExp(`const\\s+${name}\\s*=`),
        new RegExp(`function\\s+${name}\\s*\\(`),
        new RegExp(`let\\s+${name}\\s*=`),
        new RegExp(`var\\s+${name}\\s*=`),
        // Also detect direct assignment pattern used by some NHForms components:
        // e.g., "Allergies = ({...}) => {...}" at start of line or after newline
        new RegExp(`(?:^|\\n)\\s*${name}\\s*=\\s*\\(`),
      ];
      return patterns.some(p => p.test(code));
    };

    const injectionCode = Object.keys(additionalComponents).length > 0
      ? Object.keys(additionalComponents)
          .filter(name => !isDefinedInCode(name))  // Only inject if not defined in this file
          .map(name => `let ${name} = __scope__.${name};`)  // Use 'let' to allow reassignment by component code
          .join('\n')
      : '';

    // Use 'with' statement to inject scope (like form tester does)
    // Injected components become closure variables available at render time
    // eslint-disable-next-line no-new-func
    const fn = new Function('__scope__', `
      with (__scope__) {
        ${injectionCode}
        const __exports__ = {};
        ${transformed}
        ${extractCode}
        return __exports__;
      }
    `);

    const exports = fn(scopeProxy);

    // Filter out undefined values and placeholders
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(exports)) {
      if (value === undefined) continue;

      // Include functions (components and utility functions) that aren't placeholders
      if (typeof value === 'function') {
        // Skip placeholder components
        if (value.name === 'PlaceholderComponent') continue;
        // Skip placeholder functions returned by proxy
        if ((value as any).displayName?.startsWith('Placeholder_')) continue;
        result[key] = value;
      }
      // Also include arrays and objects (shared data like firstNationEthnicityCodes)
      else if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        result[key] = value;
      }
      // Include primitive values (strings, numbers) for schema constants
      else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value;
      }
    }

    return result;
  } catch (error) {
    console.warn(`Failed to load NHForms component ${componentName}:`, error);
    return {};
  }
}

// Global registry for NHForms components - allows components to reference each other at render time
const nhformsRegistry: Record<string, any> = {};
if (typeof window !== 'undefined') {
  (window as any).__nhformsRegistry__ = nhformsRegistry;
}

/**
 * Map from component folder name to the exports it provides.
 * e.g., { "HonosQuestion": { Scale5: ..., Scale5Legend: ..., ... } }
 * This allows the component gallery to look up exports by folder name.
 */
export const nhformsComponentGroups: Record<string, Record<string, any>> = {};

/**
 * Load all NHForms components with two-pass loading for cross-references
 * Pass 1: Load all components (some may have missing dependencies)
 * Pass 2: Re-load components with registry available for cross-references
 */
function loadAllComponents(): Record<string, any> {
  const componentSources: Array<{ name: string; code: string }> = [];

  // Collect all component sources from generated file
  for (const [path, code] of Object.entries(componentModules)) {
    const match = path.match(/\.\/([^/]+)\/index\.jsx$/);
    if (match) {
      componentSources.push({ name: match[1], code: code as string });
    }
  }

  // Pass 1: Load all components without cross-references
  // Record each component's own exports (before cross-references pollute the scope)
  for (const { name, code } of componentSources) {
    const components = loadComponentCode(code, name, {});
    Object.assign(nhformsRegistry, components);
    nhformsComponentGroups[name] = { ...components };
  }

  // Pass 2: Re-load all components with registry available
  // Components can now reference each other via the registry
  for (const { name, code } of componentSources) {
    const components = loadComponentCode(code, name, nhformsRegistry);
    Object.assign(nhformsRegistry, components);
  }

  // Summary log (single line instead of verbose per-component logs)
  console.log(`NHForms: Loaded ${Object.keys(nhformsRegistry).length} exports from ${componentSources.length} components`);
  return { ...nhformsRegistry };
}

// Load all components once at module initialization
export const nhformsComponents = loadAllComponents();

// Also export individual component groups for convenience
export const {
  // HonosQuestion components
  Scale5,
  Scale10,
  Scale5Legend,
  Scale10Legend,
  Scale5QuestionList,
  Scale5SubmitButton,
  Scale5ToolTip,
  HonosFinalScore,
  // MSE components
  MseSpeech,
  MseThought,
  MseAffect,
  MsePerception,
  MseStamp,
  MseAbc,
  MseEr,
  MseLick,
  // List components
  Allergies,
  Conditions,
  Goals,
  LongTermMedications,
  ServiceEpisodes,
  ServiceRequests,
  Connections,
  Occupations,
  EducationHistory,
  PlannedActions,
  ReferralSource,
  Occupant,
  // Other components
  AliasIdList,
  Ethnicity,
  RelationshipStatus,
  FirstNationsStatus,
  // HFC components
  HFC_PT_ASMT_PatientAssessment,
  HFC_PT_ASMT_PatientSummary,
  HFC_PT_ASMT_SnapShot,
  // Utility components
  NewTextArea,
  useChangeWatch,
  // ScaleField
  ScaleField,
  // EditableTable
  EditableTable,
  EditableTableSchema,
  createTableColumns,
  // ScoringModule
  ScoringModule,
  ScoringModuleSchema,
  createScoringQuestion,
  createScoringTotal,
  createScoringConfig,
  // SubformScoring
  SubformScoring,
  // PDF regeneration
  PdfRegenerator,
  // CompactBooleanField
  CompactBooleanField,
  CompactBooleanGroup,
  CompactBooleanChecklist,
  YesNoButtons,
  BooleanLabelPresets,
  ControllerLabelPresets,
  CompactBooleanFieldSchema,
  CompactBooleanChecklistSchema,
  // CompactChoiceField (multi-option button selection)
  CompactChoiceField,
  OptionButtons,
  CompactChoiceFieldSchema,
  CompactChoiceFieldMultiSchema,
  ConditionalGroup,
  ConditionalField,
  LogicGateProvider,
  useConditionalVisibility,
  // SaveOnClose
  SaveOnClose,
  useSaveOnClose,
  // Utility functions from CommonSchemaDefn
  makeValueSetOptions,
  makeTextObsUpdates,
  makeCodedObsUpdates,
  makeObsUpdatesFromVs,
  ynuaOptions,
  commonSchemaDefn,
  nameBlockSchema,
  NameBlockFields,
  formHistorySchema,
  // Filter functions from ServiceEpisodes and ServiceRequests
  activeServiceEpisodes,
  activeServiceRequests,
  orderDateDesc,
  // GraphQL Fields definitions from list components
  firstNationsStatusPatientFields,
  firstNationsStatusSchema,
  PlannedActionsFields,
  AliasIdListFields,
  AllergiesFields,
  ConditionsFields,
  ConnectionsFields,
  GoalsFields,
  LongTermMedicationsFields,
  ServiceEpisodesFields,
  ServiceRequestsFields,
  OccupationsFields,
  EducationHistoryFields,
  ReferralSourceFields,
} = nhformsComponents;

export default nhformsComponents;
