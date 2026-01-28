/**
 * NHForms Component Metadata Loader
 *
 * This file re-exports from the bundler-specific entry point.
 *
 * Bundler Support:
 * - Next.js/webpack: Uses pre-generated sources from component-sources.generated.ts (default)
 * - Vite: Uses import.meta.glob for automatic component discovery
 *
 * Import paths:
 * - Next.js (default):   import { ... } from '@mois/form-components/nhforms/metadata'
 * - Vite (explicit):     import { ... } from '@mois/form-components/nhforms/metadata/vite'
 *
 * If using Next.js, run this command after adding/modifying components:
 *   node scripts/generate-nhforms-sources.js
 */

// Default export uses Next.js-compatible version (pre-generated sources)
// For Vite, use the /nhforms/metadata/vite export path instead
export * from './component-metadata.next';
export { default } from './component-metadata.next';
