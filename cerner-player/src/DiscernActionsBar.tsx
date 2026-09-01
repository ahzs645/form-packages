import { useActiveDataForForms } from "@mois/form-components";
import { DefaultButton, PrimaryButton } from "@fluentui/react/lib/Button";
import type { CclClient, ChartContext } from "@webforms/cerner-core";
import React, { useCallback, useRef, useState } from "react";

import {
  fileFormDocument,
  formDataToNoteHtml,
  launchPowerForm,
  openDynDoc,
  type DiscernActionResult,
} from "./discern-actions";

interface DiscernActionsBarProps {
  client: CclClient | null;
  context: ChartContext;
  formTitle: string;
  formId?: string;
  /** Demo ids; real deployments carry these in the form's binding config. */
  powerFormId?: number;
  dynDocTemplateId?: number;
}

/**
 * Chart-action strip shown under the form when a PowerChart bridge (real or
 * mocked) is present. Must render inside FormStateProvider so it can snapshot
 * the live answers for the filed document.
 */
export const DiscernActionsBar: React.FC<DiscernActionsBarProps> = ({
  client,
  context,
  formTitle,
  formId,
  powerFormId = 1001,
  dynDocTemplateId = 2002,
}) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiscernActionResult | null>(null);
  const [activeData] = useActiveDataForForms();
  const activeDataRef = useRef(activeData);
  activeDataRef.current = activeData;

  const run = useCallback(async (work: () => Promise<DiscernActionResult>) => {
    setBusy(true);
    try {
      setResult(await work());
    } catch (error) {
      setResult({
        action: "Chart action",
        ok: false,
        inPowerChart: true,
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const onFileDocument = useCallback(() => {
    if (!client) return;
    const snapshot = activeDataRef.current as
      | { field?: { data?: Record<string, unknown> } }
      | null;
    const data = snapshot?.field?.data ?? {};
    void run(() =>
      fileFormDocument(client, context, {
        title: formTitle,
        html: formDataToNoteHtml(formTitle, data),
        formId,
      }),
    );
  }, [client, context, formTitle, formId, run]);

  return (
    <div
      style={{
        alignItems: "center",
        background: "#f2f6fa",
        border: "1px solid #c7d6e4",
        borderRadius: 2,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 16,
        padding: "8px 12px",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, marginRight: 4 }}>Chart actions</span>
      <PrimaryButton
        disabled={busy || !client}
        text="File to chart as document"
        onClick={onFileDocument}
      />
      <DefaultButton
        disabled={busy}
        text="Launch PowerForm"
        onClick={() => void run(() => launchPowerForm(context, powerFormId))}
      />
      <DefaultButton
        disabled={busy}
        text="Open DynDoc"
        onClick={() => void run(() => openDynDoc(context, dynDocTemplateId))}
      />
      {result ? (
        <span
          style={{
            color: result.ok ? "#1e6b1e" : "#a4262c",
            fontSize: 12,
            marginLeft: "auto",
            maxWidth: "50%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={result.detail}
        >
          {result.action}: {result.ok ? "ok" : "failed"}
          {result.inPowerChart ? "" : " (not in PowerChart)"} — {result.detail}
        </span>
      ) : null}
    </div>
  );
};
