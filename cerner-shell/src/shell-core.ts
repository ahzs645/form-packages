/**
 * Tier-dispatch logic for the generic Cerner MPage shell.
 *
 * This module is bundled to ES5 for the legacy IE control, so nothing here
 * may use Promises, generators, or post-ES5 library APIs. The shell is the
 * one artifact deployed to Cerner's content server; everything it launches
 * is configuration.
 */

export interface ShellConfig {
  /** Absolute URL of the Tier-1 player (our origin or the content server). */
  playerUrl: string;
  /**
   * Absolute URL opened in the workstation's default browser for the IE
   * launch-out tier. Defaults to playerUrl.
   */
  launchOutUrl?: string;
  /** Form definition id/name appended to both URLs as formId. */
  formId?: string;
  /** Optional page title shown on the launch-out panel. */
  title?: string;
  /** When set, the launch-out panel polls the form store for a submission marker. */
  poll?: PollConfig;
}

export type ShellTier = "modern" | "legacy";

export interface ShellHostLike {
  document?: unknown;
  location?: { search?: string };
}

/** documentMode is only present (as a number) on the legacy IE control. */
export function decideTier(host: ShellHostLike): ShellTier {
  try {
    const doc = host.document as { documentMode?: unknown } | undefined;
    return typeof (doc && doc.documentMode) === "number" ? "legacy" : "modern";
  } catch {
    return "modern";
  }
}

/**
 * Build the URL the tier target is opened with, forwarding the shell's own
 * query string (personId/encounterId/userId arrive there when the host
 * launches us with context) and appending the configured formId.
 */
export function buildTargetUrl(base: string, search: string | undefined, formId?: string): string {
  const parts: string[] = [];
  const trimmedSearch = search && search.charAt(0) === "?" ? search.substring(1) : search || "";
  if (trimmedSearch) parts.push(trimmedSearch);
  if (formId) parts.push("formId=" + encodeURIComponent(formId));
  if (parts.length === 0) return base;
  const joiner = base.indexOf("?") === -1 ? "?" : "&";
  return base + joiner + parts.join("&");
}

/**
 * APPLINK href for opening a URL in the workstation's default browser
 * (mode 100). Invoked by assigning to a real anchor and clicking it — the
 * pattern that works reliably across PowerChart browser controls, where a
 * bare APPLINK() call may not resolve.
 */
export function buildAppLinkHref(url: string): string {
  return "javascript:APPLINK(100,'" + url.replace(/'/g, "%27") + "','')";
}

export interface PollConfig {
  /** Form-store key identifying this form's submission marker. */
  refName: string;
  /** Defaults to "submission". */
  refTask?: string;
  /** Entry script; defaults to nh_wf_entry:group1. */
  scriptName?: string;
  /** Poll interval ms; defaults to 15000. */
  intervalMs?: number;
}

/**
 * Request blob asking the form store whether a submission marker exists for
 * this encounter. Hand-built JSON (ES5, no serializer options needed — all
 * values here are ASCII and ids are stringified with .0 for f8 typing).
 */
export function buildPollBlob(config: PollConfig, personId: number, encntrId: number): string {
  return (
    '{"payload":{"patientSource":[{"personId":' +
    personId +
    '.0,"encntrId":' +
    encntrId +
    '.0}],"customScript":{"script":[{"name":"nh_wf_form_store:group1",' +
    '"id":"poll","run":"pre","parameters":{"action":"r","data":[{"refName":"' +
    config.refName +
    '","refTask":"' +
    (config.refTask || "submission") +
    '","parentEntityId":' +
    encntrId +
    ".0}]}}]}}}"
  );
}

export function buildPollParameterString(personId: number, encntrId: number): string {
  return (
    "^MINE^," + personId + "," + encntrId + ',0,0,^{"mode":"CHART","hexMode":false}^'
  );
}

/** True when the poll reply carries at least one stored submission row. */
export function parsePollReply(responseText: string): boolean {
  try {
    // eslint-disable-next-line no-control-regex
    const parsed = JSON.parse(responseText.replace(/[\x00-\x1f]/g, ""));
    const buckets = [parsed.customPre, parsed.customPost];
    for (let b = 0; b < buckets.length; b++) {
      const bucket = buckets[b];
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        if (bucket[i].id === "poll" && bucket[i].data && bucket[i].data.rows) {
          for (let r = 0; r < bucket[i].data.rows.length; r++) {
            if (bucket[i].data.rows[r].refText) return true;
          }
        }
      }
    }
  } catch (_e) {
    /* unreadable reply = not submitted */
  }
  return false;
}

export interface LaunchPanelStrings {
  title: string;
  message: string;
  buttonLabel: string;
}

export function launchPanelStrings(config: ShellConfig): LaunchPanelStrings {
  return {
    title: config.title || "Web Form",
    message:
      "This form opens in your web browser. If it did not open automatically, " +
      "use the button below.",
    buttonLabel: "Open form",
  };
}
