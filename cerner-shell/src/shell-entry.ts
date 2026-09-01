import {
  buildAppLinkHref,
  buildPollBlob,
  buildPollParameterString,
  buildTargetUrl,
  decideTier,
  launchPanelStrings,
  parsePollReply,
  type PollConfig,
  type ShellConfig,
} from "./shell-core";

/**
 * Browser entry for the shell page. Expects the host HTML to define
 * window.CERNER_SHELL_CONFIG (see index.html) before this script runs.
 */

declare global {
  interface Window {
    CERNER_SHELL_CONFIG?: ShellConfig;
  }
}

function renderError(message: string): void {
  const root = document.getElementById("shell-root");
  if (root) root.textContent = message;
}

function renderLaunchPanel(config: ShellConfig, href: string): void {
  const root = document.getElementById("shell-root");
  if (!root) return;
  const strings = launchPanelStrings(config);
  root.innerHTML = "";

  const heading = document.createElement("h1");
  heading.textContent = strings.title;
  const message = document.createElement("p");
  message.textContent = strings.message;
  const anchor = document.createElement("a");
  anchor.id = "shell-launch-link";
  anchor.className = "shell-launch-button";
  anchor.href = href;
  anchor.textContent = strings.buttonLabel;

  root.appendChild(heading);
  root.appendChild(message);
  root.appendChild(anchor);

  anchor.click();
}

interface XmlCclRequestLike {
  open(method: string, url: string, async: boolean): void;
  setBlobIn?(blob: string): void;
  send(body?: string): void;
  onreadystatechange: (() => void) | null;
  readyState: number;
  status: number;
  responseText: string;
}

function readContextIds(search: string): { personId: number; encntrId: number } {
  const grab = (name: string): number => {
    const match = new RegExp("[?&]" + name + "=(\\d+)").exec(search);
    return match ? parseInt(match[1], 10) : 0;
  };
  return { personId: grab("personId"), encntrId: grab("encounterId") };
}

/**
 * On the launch-out tier, watch the form store for a submission marker so
 * the clinician sees completion without leaving PowerChart. Callback-based
 * on purpose: this runs in the legacy IE control without a Promise polyfill.
 */
function startSubmissionPolling(poll: PollConfig, search: string): void {
  const external = (window as { external?: { XMLCclRequest?: () => XmlCclRequestLike } }).external;
  const factory = external && external.XMLCclRequest;
  if (typeof factory !== "function") return;
  const ids = readContextIds(search);
  if (ids.encntrId <= 0) return;

  const status = document.createElement("p");
  status.id = "shell-poll-status";
  status.textContent = "Waiting for the form to be submitted…";
  const root = document.getElementById("shell-root");
  if (root) root.appendChild(status);

  const script = poll.scriptName || "nh_wf_entry:group1";
  let inFlight = false;
  const tick = function (): void {
    if (inFlight) return;
    inFlight = true;
    try {
      const request = factory();
      request.onreadystatechange = function (): void {
        if (request.readyState !== 4) return;
        inFlight = false;
        if (request.status === 200 && parsePollReply(request.responseText)) {
          status.textContent = "Submitted ✓";
          status.className = "shell-poll-done";
          window.clearInterval(timer);
        }
      };
      request.open("GET", script, true);
      if (typeof request.setBlobIn === "function") {
        request.setBlobIn(buildPollBlob(poll, ids.personId, ids.encntrId));
      }
      request.send(buildPollParameterString(ids.personId, ids.encntrId));
    } catch (_e) {
      inFlight = false;
    }
  };
  const timer = window.setInterval(tick, poll.intervalMs || 15000);
  tick();
}

function main(): void {
  const config = window.CERNER_SHELL_CONFIG;
  if (!config || !config.playerUrl) {
    renderError("Shell configuration missing: CERNER_SHELL_CONFIG.playerUrl is required.");
    return;
  }
  const search = window.location.search;
  if (decideTier(window) === "modern") {
    window.location.replace(buildTargetUrl(config.playerUrl, search, config.formId));
  } else {
    const url = buildTargetUrl(config.launchOutUrl || config.playerUrl, search, config.formId);
    renderLaunchPanel(config, buildAppLinkHref(url));
    if (config.poll && config.poll.refName) {
      startSubmissionPolling(config.poll, search);
    }
  }
}

// The PowerChart host finishes wiring native bridges after document scripts
// start; deferring one macrotask before touching anything host-provided is
// the established safe pattern.
setTimeout(main, 0);
