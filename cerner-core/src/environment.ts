/**
 * Host-environment detection for the tiered rendering strategy.
 *
 * Runs in every tier, so the implementation must stay ES5-safe at runtime
 * (no Symbol/Map/modern array methods) — the legacy IE control executes this
 * before any dispatch decision has been made.
 */

export interface HostWindowLike {
  external?: unknown;
  document?: unknown;
}

/**
 * PowerChart injects XMLCclRequest onto window.external; its presence is the
 * one reliable in-PowerChart signal, and doubles as the authentication
 * context (a page that has it is running inside an authenticated session).
 */
export function isInPowerChart(win: HostWindowLike): boolean {
  try {
    const ext = win.external;
    if (!ext || (typeof ext !== "object" && typeof ext !== "function")) return false;
    return "XMLCclRequest" in (ext as object);
  } catch {
    return false;
  }
}

/** document.documentMode exists (as a number) only in Internet Explorer / legacy embedded controls. */
export function isLegacyInternetExplorer(win: HostWindowLike): boolean {
  try {
    const doc = win.document as { documentMode?: unknown } | undefined;
    return typeof (doc && doc.documentMode) === "number";
  } catch {
    return false;
  }
}

export type RenderTier = "modern" | "legacy";

export interface HostEnvironment {
  inPowerChart: boolean;
  legacyIe: boolean;
  tier: RenderTier;
}

export function detectHostEnvironment(win: HostWindowLike): HostEnvironment {
  const legacyIe = isLegacyInternetExplorer(win);
  return {
    inPowerChart: isInPowerChart(win),
    legacyIe,
    tier: legacyIe ? "legacy" : "modern",
  };
}
