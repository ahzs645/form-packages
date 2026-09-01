import type { BuilderField } from "@webforms/form-model";

import { resolveTerraControl, type TerraControl } from "./control-types";

/**
 * Pre-render compatibility report, the analogue of
 * `getAlayaCareCompatibilityReport`. A target that silently drops fields is
 * worse than one that refuses to render them, so unsupported fields are
 * reported with a reason before anything is emitted.
 */

export interface TerraCompatibilityItem {
  fieldId: string;
  fieldLabel: string;
  supported: boolean;
  control: TerraControl | null;
  reason?: string;
}

export interface TerraCompatibilityReport {
  items: TerraCompatibilityItem[];
  supportedCount: number;
  unsupportedCount: number;
  /** Distinct controls the form needs — useful for coverage tests. */
  controls: TerraControl[];
}

export function getTerraCompatibilityReport(
  fields: BuilderField[],
): TerraCompatibilityReport {
  const items: TerraCompatibilityItem[] = fields.map((field) => {
    const resolved = resolveTerraControl(field);
    return {
      fieldId: field.id,
      fieldLabel: field.label,
      supported: resolved.control !== null,
      control: resolved.control,
      reason: resolved.reason,
    };
  });

  const controls = new Set<TerraControl>();
  for (const item of items) {
    if (item.control) controls.add(item.control);
  }

  return {
    items,
    supportedCount: items.filter((item) => item.supported).length,
    unsupportedCount: items.filter((item) => !item.supported).length,
    controls: [...controls].sort(),
  };
}

/** Human-readable summary for the export/preview UI. */
export function formatTerraCompatibilityMessage(
  report: TerraCompatibilityReport,
): string {
  if (report.unsupportedCount === 0) {
    return `All ${report.supportedCount} fields render with Terra components.`;
  }
  const lines = report.items
    .filter((item) => !item.supported)
    .map((item) => `• ${item.fieldLabel || item.fieldId}: ${item.reason ?? "unsupported"}`);
  return [
    `${report.unsupportedCount} of ${report.items.length} fields cannot render with Terra:`,
    ...lines,
  ].join("\n");
}
