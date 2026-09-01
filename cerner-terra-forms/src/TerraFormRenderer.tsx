import type { BuilderField } from "@webforms/form-model";
import React, { useCallback, useMemo, useState } from "react";

import { getTerraCompatibilityReport } from "./compatibility";
import { TerraField } from "./TerraField";

/**
 * Renders a whole form definition with Terra components — the Cerner
 * counterpart to the MOIS renderer and the AlayaCare preview.
 *
 * Unlike the MOIS target, this consumes the form *model* directly rather than
 * generated JSX, which is what lets one definition render natively on a
 * second platform.
 */

export interface TerraFormRendererProps {
  fields: BuilderField[];
  /** Controlled answers, keyed by field id. */
  values?: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
  /** Show the per-field reason for anything Terra cannot render. */
  showUnsupported?: boolean;
}

/**
 * Sections own their children through `sectionConfig.childFieldIds`, so a flat
 * field list has to be grouped before rendering. Fields claimed by a section
 * are rendered inside it; anything unclaimed renders at the top level, which
 * keeps imported documents with inconsistent section metadata renderable.
 */
function groupBySection(fields: BuilderField[]): Array<{
  section: BuilderField | null;
  children: BuilderField[];
}> {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const claimed = new Set<string>();
  const groups: Array<{ section: BuilderField | null; children: BuilderField[] }> = [];

  for (const field of fields) {
    if (field.type !== "section") continue;
    const children: BuilderField[] = [];
    for (const childId of field.sectionConfig?.childFieldIds ?? []) {
      const child = byId.get(childId);
      if (child && !claimed.has(childId)) {
        claimed.add(childId);
        children.push(child);
      }
    }
    groups.push({ section: field, children });
  }

  const loose = fields.filter(
    (field) => field.type !== "section" && !claimed.has(field.id),
  );
  if (loose.length > 0) groups.unshift({ section: null, children: loose });

  return groups;
}

export const TerraFormRenderer: React.FC<TerraFormRendererProps> = ({
  fields,
  values,
  onChange,
  readOnly,
  showUnsupported = true,
}) => {
  const [internal, setInternal] = useState<Record<string, unknown>>({});
  const answers = values ?? internal;

  const handleChange = useCallback(
    (fieldId: string, value: unknown) => {
      const next = { ...answers, [fieldId]: value };
      if (values === undefined) setInternal(next);
      onChange?.(next);
    },
    [answers, onChange, values],
  );

  const groups = useMemo(() => groupBySection(fields), [fields]);
  const report = useMemo(() => getTerraCompatibilityReport(fields), [fields]);

  const renderField = (field: BuilderField) => {
    if (!showUnsupported) {
      const item = report.items.find((entry) => entry.fieldId === field.id);
      if (item && !item.supported) return null;
    }
    return (
      <TerraField
        key={field.id}
        field={field}
        value={answers[field.id]}
        onChange={handleChange}
        readOnly={readOnly}
      />
    );
  };

  return (
    <div data-terra-form>
      {groups.map((group, index) => (
        <section key={group.section?.id ?? `loose-${index}`} data-terra-section>
          {group.section ? renderField(group.section) : null}
          {group.children.map(renderField)}
        </section>
      ))}
    </div>
  );
};
