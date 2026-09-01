import {
  getCustomResult,
  type CclClient,
  type ChartContext,
  type MPageResponse,
} from "@webforms/cerner-core";
import {
  createNewDocumentAsync,
  launchPowerFormAsync,
  openPatientTabAsync,
} from "fluent-cerner-js";

/**
 * Chart-action layer for Tier 1: what the player can ask PowerChart itself to
 * do, on top of (not instead of) our CCL transport.
 *
 * - Launch/open actions ride fluent-cerner-js (MIT), which wraps
 *   MPAGES_EVENT / DiscernObjectFactory and resolves { inPowerChart: false }
 *   gracefully outside PowerChart.
 * - Filing the completed form's *content* is not a client bridge — that is
 *   our entry script's write-document custom script (mmf_publish_ce
 *   server-side), so it goes through the CclClient.
 */

export interface DiscernActionResult {
  action: string;
  ok: boolean;
  inPowerChart: boolean;
  detail: string;
}

/**
 * Launch a blank PowerForm for the chart in context.
 * `powerFormId` is DCP_FORMS_REF_ID from DCP_FORMS_REF — ask the apps team
 * for the id of the form to launch, or query that table in the domain.
 */
export async function launchPowerForm(
  context: ChartContext,
  powerFormId: number,
): Promise<DiscernActionResult> {
  const result = await launchPowerFormAsync(
    "new form",
    context.personId,
    context.encntrId,
    powerFormId,
  );
  // The POWERFORM MPAGES_EVENT reports nothing back; success means the event fired.
  return {
    action: "Launch PowerForm " + powerFormId,
    ok: result.inPowerChart,
    inPowerChart: result.inPowerChart,
    detail: result.eventString,
  };
}

/**
 * Open a new dynamic document workspace.
 * `referenceTemplateId` is DD_REF_TEMPLATE_ID from DD_REF_TEMPLATE; the
 * optional `noteTypeCd` is a code set 72 value (supplying it switches the
 * bridge to the by-template-and-note-type call).
 */
export async function openDynDoc(
  context: ChartContext,
  referenceTemplateId: number,
  noteTypeCd?: number,
): Promise<DiscernActionResult> {
  const result = await createNewDocumentAsync(
    "by reference template",
    context.personId,
    context.encntrId,
    referenceTemplateId,
    noteTypeCd,
  );
  return {
    action: "Open DynDoc template " + referenceTemplateId,
    ok: result.success,
    inPowerChart: result.inPowerChart,
    detail: result.success ? "document workspace opened" : "no response from DYNDOC",
  };
}

export async function openPatientTab(
  context: ChartContext,
  tab: string,
): Promise<DiscernActionResult> {
  const result = await openPatientTabAsync(context.personId, context.encntrId, tab);
  return {
    action: "Open patient tab " + tab,
    ok: !result.badInput,
    inPowerChart: result.inPowerChart,
    detail: result.eventString,
  };
}

export interface FileFormDocumentInput {
  title: string;
  /** HTML body of the note; multi-line content must already be markup, not raw newlines. */
  html: string;
  /** Event code display key (code set 72) the document files under. */
  eventKey?: string;
  /** Note format cdf_meaning (code set 23). */
  noteFormat?: string;
  /**
   * When set, the same round-trip also writes a submission marker to the
   * form store — the row the Tier-2 launch-out shell polls for.
   */
  formId?: string;
}

export interface FileFormDocumentResult extends DiscernActionResult {
  response?: MPageResponse;
}

/**
 * File the rendered form into the chart as a clinical document through the
 * entry script's write-document custom script (server-side mmf_publish_ce).
 */
export async function fileFormDocument(
  client: CclClient,
  context: ChartContext,
  input: FileFormDocumentInput,
): Promise<FileFormDocumentResult> {
  const script = [
    {
      name: "nh_wf_write_document:group1",
      id: "file-document",
      run: "post" as const,
      parameters: {
        eventKey: input.eventKey ?? "WEBFORMDOC",
        title: input.title,
        document: input.html,
        noteFormat: input.noteFormat ?? "AH",
      },
    },
  ];
  if (input.formId) {
    script.push({
      name: "nh_wf_form_store:group1",
      id: "submission-marker",
      run: "post" as const,
      parameters: {
        action: "w",
        data: [
          {
            refName: input.formId,
            refTask: "submission",
            description: input.title,
            parentEntityId: context.encntrId,
            parentEntityName: "ENCOUNTER",
            refText: JSON.stringify({ filedAt: new Date().toISOString() }),
          },
        ],
      } as never,
    });
  }
  const response = await client.execute({
    patientSource: [{ personId: context.personId, encntrId: context.encntrId }],
    customScript: { script },
  });
  const errors = response.errors ?? [];
  const scriptResult = getCustomResult<{ status?: string; parentEventId?: number }>(
    response,
    "file-document",
  );
  const ok =
    errors.length === 0 && (!scriptResult?.status || scriptResult.status === "success");
  return {
    action: "File document “" + input.title + "”",
    ok,
    inPowerChart: client.inPowerChart,
    detail: ok
      ? "filed" +
        (scriptResult?.parentEventId ? " (event " + scriptResult.parentEventId + ")" : "")
      : errors.map((e) => e.message).join("; ") || scriptResult?.status || "unknown failure",
    response,
  };
}

/** Render captured form answers as a simple HTML table for the filed note. */
export function formDataToNoteHtml(title: string, data: Record<string, unknown>): string {
  const rows = Object.entries(data)
    .filter(([key, value]) => !key.startsWith("_") && value !== undefined && value !== "")
    .map(([key, value]) => {
      const rendered =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      return "<tr><td><b>" + escapeHtml(key) + "</b></td><td>" + escapeHtml(rendered) + "</td></tr>";
    })
    .join("");
  return "<h2>" + escapeHtml(title) + "</h2><table>" + rows + "</table>";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
