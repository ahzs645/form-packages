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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

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
import { applyShimmedMoisLifecyclePreviewState } from '../runtime/mois-contract';
import { SubTitle } from '../controls/SubTitle';
import { FluentNamespace } from '../scope/fluent-namespace';
import { LinkToMois } from '../components/LinkToMois';
import { DateSelect } from '../controls/DateSelect';
import { DateTimeSelect } from '../controls/DateTimeSelect';
import { TimeSelect } from '../controls/TimeSelect';
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
import {
  getAuthorshipLockInfo,
  registerAuthorshipRowTarget,
  prepareAuthorshipPersist,
  commitPreparedAuthorshipPersist,
  releasePreparedAuthorshipClaim,
} from '../authorship';
import { recordMoisRuntimeAction } from '../runtime/mois-contract';

// Import pre-transpiled component sources (Next.js doesn't support Vite's import.meta.glob).
// Transpilation happens at generation time so @babel/standalone stays out of this
// bundle and off the main thread. Regenerate with: node scripts/generate-nhforms-sources.js
import { compiledComponentModules, componentDefinedNames } from './component-compiled.generated';

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
  applyShimmedMoisLifecyclePreviewState(sd, 'saveDraft', data);
  if (data?.formData && typeof fd?.setFormData === 'function') {
    fd.setFormData((draft: any) => {
      draft.field = draft.field || { data: {}, status: {}, history: [] };
      draft.field.data = { ...(draft.field?.data || {}), ...data.formData };
      recordMoisRuntimeAction(draft, 'saveDraft', data);
    });
  }
  triggerToast('Draft saved');
  return Promise.resolve(true);
};

const saveSubmit = async (sd: any, fd: any, data: any) => {
  console.log('saveSubmit called', { sd, fd, data });
  applyShimmedMoisLifecyclePreviewState(sd, 'saveSubmit', data);
  if (data?.formData && typeof fd?.setFormData === 'function') {
    fd.setFormData((draft: any) => {
      draft.field = draft.field || { data: {}, status: {}, history: [] };
      draft.field.data = { ...(draft.field?.data || {}), ...data.formData };
      recordMoisRuntimeAction(draft, 'saveSubmit', data);
    });
  }
  triggerToast('Submitted');
  return Promise.resolve(true);
};

// Real MOIS signature is signSubmit(note, sd, fd, options); the legacy
// 3-arg (sd, fd, data) form is still accepted for older saved forms.
const signSubmit = async (noteOrSd: any, sdOrFd: any, fdOrData: any, maybeData?: any) => {
  const hasNote = typeof noteOrSd === 'string';
  const sd = hasNote ? sdOrFd : noteOrSd;
  const fd = hasNote ? fdOrData : sdOrFd;
  const data = hasNote ? maybeData : fdOrData;
  console.log('signSubmit called', { sd, fd, data });
  applyShimmedMoisLifecyclePreviewState(sd, 'signSubmit', data);
  if (data?.formData && typeof fd?.setFormData === 'function') {
    fd.setFormData((draft: any) => {
      draft.field = draft.field || { data: {}, status: {}, history: [] };
      draft.field.data = { ...(draft.field?.data || {}), ...data.formData };
      recordMoisRuntimeAction(draft, 'signSubmit', data);
    });
  }
  triggerToast('Signed and submitted');
  return Promise.resolve(true);
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
    TimeSelect,
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
    getAuthorshipLockInfo,
    registerAuthorshipRowTarget,
    prepareAuthorshipPersist,
    commitPreparedAuthorshipPersist,
    releasePreparedAuthorshipClaim,

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
    saveSubmit,
    signSubmit,

    // Markdown component for rendering markdown content
    Markdown,
    ReactMarkdown,
    remarkGfm,
    rehypeRaw,

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
 * Execute pre-transpiled component code with the NHForms scope and extract
 * defined components
 * @param compiledCode - Babel output from component-compiled.generated.ts
 * @param additionalComponents - Components already loaded that can be referenced
 * @param definedNames - Identifiers the component's own source declares
 */
function loadComponentCode(
  compiledCode: string,
  componentName: string,
  additionalComponents: Record<string, any> = {},
  definedNames: ReadonlySet<string> = new Set(),
): Record<string, any> {
  const scope = buildNHFormsScope(additionalComponents);

  // Components to extract from the executed code
  const extractNames = [
    // HonosQuestion exports
    'Scale5', 'Scale10', 'Scale5Legend', 'Scale10Legend', 'Scale5QuestionList', 'Scale5SubmitButton',
    'Scale5ToolTip', 'HonosFinalScore',
    // List components
    'Allergies', 'Conditions', 'Goals', 'LongTermMedications',
    'ServiceEpisodes', 'ServiceRequests', 'Connections', 'Occupations',
    'EducationHistory', 'PlannedActions', 'ReferralSource', 'Occupant',
    // Filter functions from ServiceEpisodes and ServiceRequests
    'activeServiceEpisodes', 'activeServiceRequests', 'orderDateDesc',
    // Other components
    'AliasIdList', 'Ethnicity', 'RelationshipStatus', 'FirstNationsStatus', 'FindCodeSelect', 'PastMeasurementField',
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
    // FormSessionRuntime exports
    'FormSessionProvider', 'cloneFormSessionState', 'mergeFormSessionState', 'useFormSessionData',
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
    // Attestation sign-off exports
    'AttestationSignOff',
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

    // Build injection code for additional components (cross-references).
    // Only inject components the file doesn't declare itself, to avoid duplicate
    // declarations; definedNames is precomputed at generation time.
    const injectionCode = Object.keys(additionalComponents)
      .filter(name => !definedNames.has(name))
      .map(name => `let ${name} = __scope__.${name};`)  // Use 'let' to allow reassignment by component code
      .join('\n');

    // Use 'with' statement to inject scope (like form tester does)
    // Injected components become closure variables available at render time
    // eslint-disable-next-line no-new-func
    const fn = new Function('__scope__', `
      with (__scope__) {
        ${injectionCode}
        const __exports__ = {};
        ${compiledCode}
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
 * Filled by loadAllComponents(); exported below via a lazy proxy.
 */
const nhformsComponentGroupsInternal: Record<string, Record<string, any>> = {};

function createRegistryModuleAlias(displayName: string, exports: Record<string, any>): Record<string, any> {
  const RegistryModulePreview: React.FC = () => React.createElement(
    'div',
    {
      style: {
        padding: '8px',
        color: '#0f5132',
        background: '#d1e7dd',
        border: '1px solid #badbcc',
        borderRadius: '4px',
        fontSize: '12px',
      },
    },
    `${displayName} registry module loaded`
  );
  RegistryModulePreview.displayName = `${displayName}RegistryModulePreview`;
  return { ...exports, All: RegistryModulePreview };
}

function applyRegistryModuleAliases(registry: Record<string, any>): void {
  registry.CommonSchemaDefn = createRegistryModuleAlias('CommonSchemaDefn', {
    commonSchemaDefn: registry.commonSchemaDefn,
    nameBlockSchema: registry.nameBlockSchema,
    NameBlockFields: registry.NameBlockFields,
    formHistorySchema: registry.formHistorySchema,
    makeValueSetOptions: registry.makeValueSetOptions,
    makeTextObsUpdates: registry.makeTextObsUpdates,
    makeCodedObsUpdates: registry.makeCodedObsUpdates,
    makeObsUpdatesFromVs: registry.makeObsUpdatesFromVs,
    ynuaOptions: registry.ynuaOptions,
  });

  registry.FormSessionRuntime = createRegistryModuleAlias('FormSessionRuntime', {
    FormSessionProvider: registry.FormSessionProvider,
    cloneFormSessionState: registry.cloneFormSessionState,
    mergeFormSessionState: registry.mergeFormSessionState,
    useFormSessionData: registry.useFormSessionData,
  });

  registry.UseChangeWatch = createRegistryModuleAlias('UseChangeWatch', {
    useChangeWatch: registry.useChangeWatch,
  });
}

/**
 * Load all NHForms components with two-pass loading for cross-references
 * Pass 1: Load all components (some may have missing dependencies)
 * Pass 2: Re-load components with registry available for cross-references
 */
function loadAllComponents(): Record<string, any> {
  const componentSources: Array<{ name: string; code: string; definedNames: ReadonlySet<string> }> = [];

  // Collect all pre-transpiled component sources from generated file
  for (const [path, code] of Object.entries(compiledComponentModules)) {
    const match = path.match(/\.\/([^/]+)\/index\.jsx$/);
    if (match) {
      componentSources.push({
        name: match[1],
        code: code as string,
        definedNames: new Set(componentDefinedNames[path] ?? []),
      });
    }
  }

  // Pass 1: Load all components without cross-references
  // Record each component's own exports (before cross-references pollute the scope)
  for (const { name, code, definedNames } of componentSources) {
    const components = loadComponentCode(code, name, {}, definedNames);
    Object.assign(nhformsRegistry, components);
    nhformsComponentGroupsInternal[name] = { ...components };
  }

  // Pass 2: Re-load all components with registry available
  // Components can now reference each other via the registry
  for (const { name, code, definedNames } of componentSources) {
    const components = loadComponentCode(code, name, nhformsRegistry, definedNames);
    Object.assign(nhformsRegistry, components);
  }

  applyRegistryModuleAliases(nhformsRegistry);

  // Summary log (single line instead of verbose per-component logs)
  console.log(`NHForms: Loaded ${Object.keys(nhformsRegistry).length} exports from ${componentSources.length} components`);
  return { ...nhformsRegistry };
}

// Lazy loading: executing all 62 components (twice, for cross-references) is
// expensive enough to jank the main thread, so it is deferred from module
// initialization to the first property access on nhformsComponents /
// nhformsComponentGroups. Callers that control timing (e.g. a route that knows
// it will render NHForms content) can call ensureNhformsComponentsLoaded()
// explicitly to choose when the cost is paid.
let loadedNhformsComponents: Record<string, any> | null = null;

export function ensureNhformsComponentsLoaded(): Record<string, any> {
  if (!loadedNhformsComponents) {
    loadedNhformsComponents = loadAllComponents();
  }
  return loadedNhformsComponents;
}

// Proxy that behaves like the loaded record but triggers the load on first use.
// ownKeys/getOwnPropertyDescriptor are implemented so spreads and Object.keys
// (e.g. buildScope's `...nhformsComponents`) see the real entries.
function lazyRecord<T extends Record<string, any>>(load: () => T): T {
  return new Proxy({} as T, {
    get: (_target, prop) => Reflect.get(load(), prop),
    has: (_target, prop) => Reflect.has(load(), prop),
    ownKeys: () => Reflect.ownKeys(load()),
    getOwnPropertyDescriptor: (_target, prop) => {
      const desc = Object.getOwnPropertyDescriptor(load(), prop);
      return desc ? { ...desc, configurable: true } : undefined;
    },
  });
}

export const nhformsComponents: Record<string, any> = lazyRecord(ensureNhformsComponentsLoaded);

export const nhformsComponentGroups: Record<string, Record<string, any>> = lazyRecord(() => {
  ensureNhformsComponentsLoaded();
  return nhformsComponentGroupsInternal;
});

export default nhformsComponents;
