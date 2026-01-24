/**
 * NHForms Component Metadata Loader
 *
 * This file re-exports from the bundler-specific entry point.
 *
 * Bundler Support:
 * - Vite: Uses import.meta.glob for automatic discovery (default)
 * - Next.js/webpack: Uses pre-generated sources from component-sources.generated.ts
 *
 * Import paths:
 * - Vite (auto):         import { ... } from '@mois/form-components/nhforms/metadata'
 * - Next.js (explicit):  import { ... } from '@mois/form-components/nhforms/metadata/next'
 *
 * If using Next.js, run this command after adding/modifying components:
 *   node scripts/generate-nhforms-sources.js
 */

// Default export uses Vite-specific features (import.meta.glob)
// For Next.js, use the /nhforms/metadata/next export path instead
export * from './component-metadata.vite';
export { default } from './component-metadata.vite';
