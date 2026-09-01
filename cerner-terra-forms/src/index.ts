/**
 * Cerner Terra form render target.
 *
 * Renders a form definition with Terra components, the third target alongside
 * MOIS (lib/mois-export) and AlayaCare (lib/alayacare-*). Like AlayaCare it
 * consumes the shared form model rather than another target's output, so one
 * definition renders natively on each platform.
 */
export {
  resolveTerraControl,
  resolveChoiceControl,
  getTerraFieldConfig,
  UNSUPPORTED_REASONS,
  type ResolvedTerraControl,
  type TerraControl,
  type TerraControlSource,
  type TerraFieldConfig,
} from "./control-types";
export {
  getTerraCompatibilityReport,
  formatTerraCompatibilityMessage,
  type TerraCompatibilityItem,
  type TerraCompatibilityReport,
} from "./compatibility";
export { TerraField, type TerraFieldProps } from "./TerraField";
export { TerraFormRenderer, type TerraFormRendererProps } from "./TerraFormRenderer";
