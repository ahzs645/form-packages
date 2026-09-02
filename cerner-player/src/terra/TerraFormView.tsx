import { TerraBase } from "@webforms/cerner-terra";
import { TerraFormRenderer, getTerraCompatibilityReport } from "@webforms/cerner-terra-forms";
import type { BuilderField } from "@webforms/form-model";
import React, { useEffect, useMemo, useState } from "react";

/**
 * Renders a builder document natively with Terra components — the Cerner
 * render target, as opposed to the MOIS path (generated JSX played by the
 * MOIS runtime). Selected with ?render=terra.
 */
/**
 * Messages exchanged with a parent window when the document comes from it
 * (`?documentSource=parent`) — how the builder previews this target: it
 * embeds the built player in an iframe and posts the live builder fields.
 */
export const TERRA_PARENT_READY = "webforms-terra:ready";
export const TERRA_PARENT_DOCUMENT = "webforms-terra:document";

interface ParentDocumentMessage {
  type: typeof TERRA_PARENT_DOCUMENT;
  fields: BuilderField[];
  /** CSS zoom for the whole form, 1 = 100%. */
  zoom?: number;
}

export const TerraFormView: React.FC<{ documentUrl: string; fromParent?: boolean }> = ({
  documentUrl,
  fromParent = false,
}) => {
  const [fields, setFields] = useState<BuilderField[] | null>(null);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fromParent) return;
    const onMessage = (event: MessageEvent<ParentDocumentMessage>) => {
      // Only the embedding window may supply the document.
      if (event.source !== window.parent) return;
      if (event.data?.type !== TERRA_PARENT_DOCUMENT || !Array.isArray(event.data.fields)) return;
      setFields(event.data.fields);
      if (typeof event.data.zoom === "number" && event.data.zoom > 0) setZoom(event.data.zoom);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: TERRA_PARENT_READY }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [fromParent]);

  useEffect(() => {
    if (fromParent) return;
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
  }, [documentUrl, fromParent]);

  const report = useMemo(
    () => (fields ? getTerraCompatibilityReport(fields) : null),
    [fields],
  );

  if (error) return <div style={{ color: "#e50000" }}>Terra render failed: {error}</div>;
  if (!fields || !report) return <div>{fromParent ? "Waiting for the form definition…" : "Loading form definition…"}</div>;

  return (
    <TerraBase>
      <div style={{ zoom }}>
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
      </div>
    </TerraBase>
  );
};
