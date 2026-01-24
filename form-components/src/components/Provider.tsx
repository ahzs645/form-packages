/**
 * Provider Component
 * Select internal provider. The default value is the desktop provider at the
 * time the form was opened. Parameters are the same as FindCode.
 */

import React from 'react';
import { FindCode, FindCodeProps } from '../controls/FindCode';

/** Provider types */
export type ProviderType =
  | 'PROVIDER'
  | 'ORGANIZATION'
  | 'ORGROLE'
  | 'PROVIDER EXTERNAL'
  | 'PROVIDER CLINIC'
  | 'ORGANIZATION EXTERNAL';

/** Provider data from source */
export interface ProviderData {
  name: string;
  code: string;
  source?: string;
  sourceId?: string;
  providerType?: string;
}

export interface ProviderProps {
  /** Default value for the provider field */
  defaultValue?: any;
  /** Active field name */
  fieldId?: string;
  /** Function to get candidate providers based on search */
  getCandidates?: (items: ProviderData[], searchText: string) => ProviderData[];
  /** Label for this field */
  label?: string;
  /** Custom render function for candidates in dropdown */
  onRenderCandidate?: (candidate: ProviderData) => React.ReactNode;
  /** Custom render function for selected value display */
  onRenderSelected?: (value: ProviderData) => string;
  /** Type of provider to filter by */
  providerType?: ProviderType;
  /** A readOnly control is always view only */
  readOnly?: boolean;
  /** Is this field required to have a value? */
  required?: boolean;
  /** Override props for the underlying FindCode control */
  findCodeProps?: Partial<FindCodeProps>;
  /** Provider list (if not using source data) */
  providers?: ProviderData[];
}

// Default getCandidates: filter by name starting with search text
const nameStartsWith = (items: ProviderData[], searchText: string): ProviderData[] => {
  return items
    .filter((item) => item.name?.toLowerCase().startsWith(searchText.toLowerCase()))
    .slice(0, 10);
};

// Default render for candidate items
const defaultRenderCandidate = (item: ProviderData): React.ReactNode => {
  return item.name;
};

// Default render for selected value
const defaultRenderSelected = (item: ProviderData): string => {
  return item.name;
};

/**
 * Provider - A pre-configured FindCode for provider selection.
 * This is a thin wrapper around FindCode with provider-specific defaults.
 */
export const Provider: React.FC<ProviderProps> = ({
  defaultValue,
  fieldId = 'providerName',
  getCandidates = nameStartsWith,
  label = 'Desktop provider',
  onRenderCandidate = defaultRenderCandidate,
  onRenderSelected = defaultRenderSelected,
  providerType = 'PROVIDER',
  readOnly = false,
  required = false,
  findCodeProps = {},
  providers = [],
}) => {
  // Filter providers by type if provided
  const filteredProviders = providers.filter(
    (p) => !p.providerType || p.providerType === providerType
  );

  // Map providers to option list format for FindCode
  const optionList = filteredProviders.map((provider) => ({
    code: provider.code,
    display: provider.name,
    name: provider.name,
    source: provider.source,
    sourceId: provider.sourceId,
  }));

  return (
    <FindCode
      fieldId={fieldId}
      label={label}
      readOnly={readOnly}
      required={required}
      optionList={optionList}
      defaultValue={defaultValue}
      getCandidates={getCandidates as any}
      onRenderCandidate={onRenderCandidate as any}
      onRenderSelected={onRenderSelected as any}
      {...findCodeProps}
    />
  );
};

export default Provider;
