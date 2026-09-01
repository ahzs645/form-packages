import { TerraBase } from "@webforms/cerner-terra";
import { TerraFormRenderer, getTerraCompatibilityReport } from "@webforms/cerner-terra-forms";
import type { BuilderField } from "@webforms/form-model";
import React, { useEffect, useMemo, useState } from "react";

/**
 * Renders a builder document natively with Terra components — the Cerner
 * render target, as opposed to the MOIS path (generated JSX played by the
 * MOIS runtime). Selected with ?render=terra.
 */
export const TerraFormView: React.FC<{ documentUrl: string }> = ({ documentUrl }) => {
  const [fields, setFields] = useState<BuilderField[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(documentUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} loading ${documentUrl}`);
        return response.json();
      })
      .then((json: unknown) => {
        if (cancelled) return;
        const record = json as {
          workspaceDocument?: { document?: { fields?: BuilderField[] } };
          document?: { fields?: BuilderField[] };
          fields?: BuilderField[];
        };
        const loaded =
          record.workspaceDocument?.document?.fields ??
          record.document?.fields ??
          record.fields;
        if (!loaded) throw new Error("No fields found in the document");
        setFields(loaded);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [documentUrl]);

  const report = useMemo(
    () => (fields ? getTerraCompatibilityReport(fields) : null),
    [fields],
  );

  if (error) return <div style={{ color: "#e50000" }}>Terra render failed: {error}</div>;
  if (!fields || !report) return <div>Loading form definition…</div>;

  return (
    <TerraBase>
      <div
        style={{
          background: "#f4f4f4",
          border: "1px solid #dedfe0",
          fontSize: 12,
          marginBottom: 12,
          padding: "6px 10px",
        }}
      >
        Terra render target — {report.supportedCount} of {report.items.length} fields
        supported, {report.controls.length} distinct controls
        {report.unsupportedCount > 0 ? ` · ${report.unsupportedCount} unsupported` : ""}
      </div>
      <TerraFormRenderer fields={fields} />
    </TerraBase>
  );
};
