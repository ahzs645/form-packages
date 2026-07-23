export interface BuilderInvestigationTab {
  id: string;
  label: string;
}

export const INVESTIGATION_FORM_TAB_NAMES = [
  "Physiology",
  "Medication",
  "History / Physical",
  "Investigation",
  "Review",
  "Information",
] as const;

export const DEFAULT_INVESTIGATION_FORM_TABS: BuilderInvestigationTab[] =
  INVESTIGATION_FORM_TAB_NAMES.map((label, index) => ({
    id: `tab-${index + 1}`,
    label,
  }));

function cleanLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function cleanId(value: unknown, fallback: string, usedIds: Set<string>): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const base = raw || fallback;
  if (!usedIds.has(base)) return base;

  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (usedIds.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export function createDefaultInvestigationTabs(): BuilderInvestigationTab[] {
  return DEFAULT_INVESTIGATION_FORM_TABS.map((tab) => ({ ...tab }));
}

export function createInvestigationTabId(tabs: BuilderInvestigationTab[]): string {
  const usedIds = new Set(tabs.map((tab) => tab.id));
  let index = tabs.length + 1;
  let id = `tab-${index}`;
  while (usedIds.has(id)) {
    index += 1;
    id = `tab-${index}`;
  }
  return id;
}

export function normalizeInvestigationTabs(
  value: unknown,
  options?: { legacyPageNames?: string[] }
): BuilderInvestigationTab[] {
  const source =
    Array.isArray(value) && value.length > 0
      ? value
      : Array.isArray(options?.legacyPageNames) && options.legacyPageNames.length > 0
        ? options.legacyPageNames
        : DEFAULT_INVESTIGATION_FORM_TABS;

  const usedIds = new Set<string>();
  const tabs = source
    .map((entry, index) => {
      const defaultTab = DEFAULT_INVESTIGATION_FORM_TABS[index];
      const fallbackId = defaultTab?.id ?? `tab-${index + 1}`;
      const fallbackLabel = defaultTab?.label ?? `Tab ${index + 1}`;

      if (typeof entry === "string") {
        const id = cleanId(undefined, fallbackId, usedIds);
        usedIds.add(id);
        return {
          id,
          label: cleanLabel(entry, fallbackLabel),
        };
      }

      if (!entry || typeof entry !== "object") return null;
      const tab = entry as Partial<BuilderInvestigationTab>;
      const id = cleanId(tab.id, fallbackId, usedIds);
      usedIds.add(id);
      return {
        id,
        label: cleanLabel(tab.label, fallbackLabel),
      };
    })
    .filter((tab): tab is BuilderInvestigationTab => tab !== null);

  return tabs.length > 0 ? tabs : createDefaultInvestigationTabs();
}

export function normalizeInvestigationTabAssignments(
  value: unknown,
  tabs: BuilderInvestigationTab[],
  options?: {
    draftKeys?: string[];
    legacyPageAssignments?: Record<string, number | null>;
  }
): Record<string, string | null> {
  const validTabIds = new Set(tabs.map((tab) => tab.id));
  const firstTabId = tabs[0]?.id ?? null;
  const next: Record<string, string | null> = {};

  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value as Record<string, unknown>).forEach(([key, rawTabId]) => {
      if (rawTabId === null) {
        next[key] = null;
        return;
      }
      if (typeof rawTabId === "string" && validTabIds.has(rawTabId)) {
        next[key] = rawTabId;
      }
    });
  }

  options?.draftKeys?.forEach((draftKey) => {
    const current = next[draftKey];
    if (current === null || (typeof current === "string" && validTabIds.has(current))) {
      return;
    }

    const legacyPage = options.legacyPageAssignments?.[draftKey];
    if (typeof legacyPage === "number" && legacyPage >= 1) {
      const legacyTab = tabs[legacyPage - 1];
      if (legacyTab) {
        next[draftKey] = legacyTab.id;
        return;
      }
    }

    next[draftKey] = firstTabId;
  });

  return next;
}
