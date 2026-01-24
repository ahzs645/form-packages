/**
 * NHForms Component Metadata Loader (Next.js/webpack version)
 *
 * Uses pre-generated component sources and identities for compatibility
 * with Next.js/webpack builds.
 *
 * For Vite, use component-metadata.vite.ts instead (supports auto-discovery).
 *
 * To update after adding/modifying components:
 *   node scripts/generate-nhforms-sources.js
 */

// Import pre-generated sources (Next.js doesn't support Vite's import.meta.glob)
import { componentModules, componentIdentities } from './component-sources.generated';

export interface NHFormsComponentMetadata {
  /** Folder/component name */
  name: string;
  /** Human-readable title from Identity.json */
  title: string;
  /** Description from Identity.json */
  description: string;
  /** Version string (major.minor.patch) */
  version: string;
  /** Component type */
  type: string;
  /** Owner organization */
  owner: string;
  /** Source code (raw JSX) */
  sourceCode: string;
  /** Category derived from component name patterns */
  category: 'HoNOS' | 'MSE' | 'Lists' | 'Demographics' | 'Tables' | 'Other';
}

/**
 * Determine component category based on name patterns
 */
function getCategory(name: string): NHFormsComponentMetadata['category'] {
  if (name.startsWith('Honos') || name.includes('Scale5')) {
    return 'HoNOS';
  }
  if (name.startsWith('Mse')) {
    return 'MSE';
  }
  if (['Allergies', 'Conditions', 'Goals', 'LongTermMedications', 'ServiceEpisodes',
       'ServiceRequests', 'Connections', 'Occupations', 'EducationHistory',
       'PlannedActions', 'ReferralSource'].includes(name)) {
    return 'Lists';
  }
  if (['AliasIdList', 'Ethnicity', 'RelationshipStatus', 'FirstNationsStatus'].includes(name)) {
    return 'Demographics';
  }
  if (name.startsWith('HFC_PT_ASMT') || name === 'NewTextArea' || name === 'UseChangeWatch') {
    return 'Other';
  }
  if (name === 'EditableTable') {
    return 'Tables';
  }
  return 'Other';
}

/**
 * Load metadata for all NHForms components
 */
function loadAllMetadata(): NHFormsComponentMetadata[] {
  const components: NHFormsComponentMetadata[] = [];

  for (const [name, identity] of Object.entries(componentIdentities)) {
    // Find matching source code
    const sourceKey = `./${name}/index.jsx`;
    const sourceCode = componentModules[sourceKey] || '';

    components.push({
      name,
      title: identity.title || name,
      description: identity.description || '',
      version: identity.version
        ? `${identity.version.major}.${identity.version.minor}.${identity.version.patch}`
        : '1.0.0',
      type: identity.type || 'component',
      owner: identity.owner || 'Unknown',
      sourceCode,
      category: getCategory(name),
    });
  }

  // Sort by category then by name
  components.sort((a, b) => {
    if (a.category !== b.category) {
      const categoryOrder = ['HoNOS', 'MSE', 'Lists', 'Demographics', 'Tables', 'Other'];
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  console.log(`Loaded metadata for ${components.length} NHForms components`);
  return components;
}

// Load all metadata at module initialization
export const nhformsMetadata = loadAllMetadata();

// Group by category for navigation
export const nhformsMetadataByCategory = nhformsMetadata.reduce((acc, comp) => {
  if (!acc[comp.category]) {
    acc[comp.category] = [];
  }
  acc[comp.category].push(comp);
  return acc;
}, {} as Record<string, NHFormsComponentMetadata[]>);

export default nhformsMetadata;
