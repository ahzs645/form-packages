/**
 * NHForms Component Metadata Loader (Vite version)
 *
 * Auto-discovers and loads Identity.json metadata from all NHForms components
 * using Vite's import.meta.glob feature.
 *
 * For Next.js/webpack, use component-metadata.next.ts instead.
 */

// Import all Identity.json files using Vite's glob import
const identityModules = import.meta.glob('./**/Identity.json', {
  eager: true,
}) as Record<string, { default?: any } & any>;

// Import all component source files as raw strings for displaying code
const componentSources = import.meta.glob('./**/index.jsx', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>;

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

  for (const [path, module] of Object.entries(identityModules)) {
    // Extract component name from path (e.g., "./HonosQuestion/Identity.json" -> "HonosQuestion")
    const match = path.match(/\.\/([^/]+)\/Identity\.json$/);
    if (!match) continue;

    const componentName = match[1];

    // Get the identity data (handle both default export and direct export)
    const identity = (module as any).default || module;

    // Find matching source code
    const sourceKey = `./${componentName}/index.jsx`;
    const sourceCode = componentSources[sourceKey] || '';

    components.push({
      name: componentName,
      title: identity.title || componentName,
      description: identity.description || '',
      version: identity.version
        ? `${identity.version.major}.${identity.version.minor}.${identity.version.patch}`
        : '1.0.0',
      type: identity.type || 'component',
      owner: identity.owner || 'Unknown',
      sourceCode,
      category: getCategory(componentName),
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
