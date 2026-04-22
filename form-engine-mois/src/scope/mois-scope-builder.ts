/**
 * MOIS Scope Builder
 *
 * Extends BaseScopeBuilder with all MOIS-specific components, hooks, and namespaces.
 * This provides the full scope needed to render MOIS web forms.
 */

import { BaseScopeBuilder, FluentNamespace } from '@mois/form-engine-core';
import type { ScopeConfig } from '@mois/form-engine-core';
import {
  getAuthorshipLockInfo,
  registerAuthorshipRowTarget,
  prepareAuthorshipPersist,
  commitPreparedAuthorshipPersist,
  releasePreparedAuthorshipClaim,
  applyShimmedMoisLifecyclePreviewState,
  emitMoisPreviewDiagnosticEvent,
  recordMoisRuntimeAction,
} from '@mois/form-components';

// Re-export types
export type { ScopeConfig };

/**
 * Configuration options for MoisScopeBuilder
 */
export interface MoisScopeBuilderOptions {
  /** Additional components to include in scope */
  additionalComponents?: Record<string, any>;

  /** NHForms components to include */
  nhformsComponents?: Record<string, any>;

  /** Identity object for the form */
  identity?: {
    title: string;
    name: string;
    description?: string;
    version?: { major: number; minor: number; patch: number };
  };
}

/**
 * Default Identity object for forms
 */
const defaultIdentity = {
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
};

/**
 * Date/time helper functions
 */
const dateHelpers = {
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
};

/**
 * Form action stubs
 */
const formActions = {
  saveDraft: (sd: any, fd: any, data: any) => {
    console.log('saveDraft called', { sd, fd, data });
    applyShimmedMoisLifecyclePreviewState(sd, 'saveDraft', data);
    if (data?.formData && typeof fd?.setFormData === 'function') {
      fd.setFormData((draft: any) => {
        draft.field = draft.field || { data: {}, status: {}, history: [] };
        draft.field.data = { ...(draft.field?.data || {}), ...data.formData };
        recordMoisRuntimeAction(draft, 'saveDraft', data);
      });
    }
    return true;
  },
  closeForm: (sd?: any, fd?: any) => {
    console.log('closeForm called');
    applyShimmedMoisLifecyclePreviewState(sd, 'closeForm');
    if (typeof fd?.setFormData === 'function') {
      fd.setFormData((draft: any) => {
        recordMoisRuntimeAction(draft, 'closeForm', { requestedAt: new Date().toISOString() });
      });
    }
    emitMoisPreviewDiagnosticEvent({
      severity: 'warning',
      source: 'shimmed-close-preview',
      message: 'Browser preview cannot fully emulate Shimmed MOIS Electron close interception; window.close() may be ignored here.',
      path: 'closeForm',
    });
  },
  cancelForm: (sd?: any, fd?: any) => {
    console.log('cancelForm called');
    applyShimmedMoisLifecyclePreviewState(sd, 'cancelForm');
    if (typeof fd?.setFormData === 'function') {
      fd.setFormData((draft: any) => {
        recordMoisRuntimeAction(draft, 'cancelForm', { requestedAt: new Date().toISOString() });
      });
    }
    emitMoisPreviewDiagnosticEvent({
      severity: 'warning',
      source: 'shimmed-close-preview',
      message: 'Cancel in Shimmed MOIS dispatches form-canceled and relies on Electron close interception; browser preview records the request only.',
      path: 'cancelForm',
    });
  },
  saveSubmit: (sd: any, fd: any, data: any) => {
    console.log('saveSubmit called', { sd, fd, data });
    applyShimmedMoisLifecyclePreviewState(sd, 'saveSubmit', data);
    if (data?.formData && typeof fd?.setFormData === 'function') {
      fd.setFormData((draft: any) => {
        draft.field = draft.field || { data: {}, status: {}, history: [] };
        draft.field.data = { ...(draft.field?.data || {}), ...data.formData };
        recordMoisRuntimeAction(draft, 'saveSubmit', data);
      });
    }
    return true;
  },
  signSubmit: (sd: any, fd: any, data: any) => {
    console.log('signSubmit called', { sd, fd, data });
    applyShimmedMoisLifecyclePreviewState(sd, 'signSubmit', data);
    if (data?.formData && typeof fd?.setFormData === 'function') {
      fd.setFormData((draft: any) => {
        draft.field = draft.field || { data: {}, status: {}, history: [] };
        draft.field.data = { ...(draft.field?.data || {}), ...data.formData };
        recordMoisRuntimeAction(draft, 'signSubmit', data);
      });
    }
    return true;
  },
  refresh: () => {
    console.log('refresh called');
  },
  getAuthorshipLockInfo,
  registerAuthorshipRowTarget,
  prepareAuthorshipPersist,
  commitPreparedAuthorshipPersist,
  releasePreparedAuthorshipClaim,
};

/**
 * Browser globals stubs
 */
const browserStubs = {
  alert: (msg: any) => console.log('Alert:', msg),
  confirm: () => true,
  prompt: () => 'user input',
};

/**
 * MOIS Scope Builder
 *
 * Creates a scope with all MOIS components and utilities.
 * Use this to render MOIS web forms in any application.
 *
 * @example
 * ```typescript
 * import { MoisScopeBuilder } from '@mois/form-engine-mois';
 * import { createComponentFromCode } from '@mois/form-engine-core';
 *
 * const scopeBuilder = new MoisScopeBuilder();
 * const FormComponent = createComponentFromCode(formCode, {
 *   babel: Babel,
 *   scopeBuilder,
 * });
 * ```
 */
export class MoisScopeBuilder extends BaseScopeBuilder {
  private options: MoisScopeBuilderOptions;

  constructor(options: MoisScopeBuilderOptions = {}) {
    // Initialize with base config
    super({
      uiComponents: {
        ...FluentNamespace,
        Fluent: FluentNamespace,
        Fabric: FluentNamespace,
        FluentUI: FluentNamespace,
      },
      utilities: {
        ...dateHelpers,
        ...formActions,
        ...browserStubs,
      },
      globals: {
        // Additional globals beyond base
        SelectableOptionMenuItemType: { Normal: 0, Divider: 1, Header: 2 },
      },
    });

    this.options = options;
  }

  /**
   * Configure MOIS-specific hooks
   *
   * Call this method with the hooks from the styleguide to enable full MOIS functionality.
   */
  withHooks(hooks: {
    useSourceData: any;
    useActiveData: any;
    useCodeList: any;
    useSection: any;
    useTheme: any;
    useActivityOptions?: any;
    useEffectOnce?: any;
    useOnLoad?: any;
    useOnRefresh?: any;
    usePrinting?: any;
    useMutation?: any;
    useQuery?: any;
    useFormLock?: any;
    testLock?: any;
    useHotKey?: any;
    useMoisNavigate?: any;
    useSetting?: any;
    useTempData?: any;
    useConfirmUnload?: any;
  }): MoisScopeBuilder {
    this.config.hooks = {
      ...this.config.hooks,
      ...hooks,
    };
    return this;
  }

  /**
   * Configure MOIS namespaces
   */
  withNamespaces(namespaces: {
    Mois?: any;
    MoisFunction?: any;
    MoisHooks?: any;
    MoisControl?: any;
    Pe?: any;
    NameBlockFields?: any;
  }): MoisScopeBuilder {
    this.config.namespaces = {
      ...this.config.namespaces,
      ...namespaces,
    };
    return this;
  }

  /**
   * Configure MOIS components
   */
  withComponents(components: Record<string, any>): MoisScopeBuilder {
    this.config.components = {
      ...this.config.components,
      ...components,
    };
    return this;
  }

  /**
   * Add NHForms components
   */
  withNHFormsComponents(nhformsComponents: Record<string, any>): MoisScopeBuilder {
    this.config.components = {
      ...this.config.components,
      ...nhformsComponents,
    };
    return this;
  }

  /**
   * Build the complete scope object for MOIS form execution
   */
  override buildScope(): Record<string, any> {
    const baseScope = super.buildScope();

    return {
      ...baseScope,
      // Add Identity
      Identity: this.options.identity || defaultIdentity,
      // Add any additional components from options
      ...this.options.additionalComponents,
      ...this.options.nhformsComponents,
    };
  }
}
