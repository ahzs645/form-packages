import type { SectionContextValue } from "../context/MoisContext";

export type MoisRuntimeActionName = "saveDraft" | "saveSubmit" | "signSubmit";

export interface MoisRuntimeActionRecord {
  action: MoisRuntimeActionName;
  payload: unknown;
  timestamp: string;
}

export interface MoisRuntimeDebugState {
  lastAction: MoisRuntimeActionRecord | null;
  actionHistory: MoisRuntimeActionRecord[];
}

function emitMoisRuntimeEvent(detail: MoisRuntimeDebugState) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("mois:runtime", {
      detail: cloneValue(detail),
    })
  );
}

const createDefaultFieldContainer = () => ({
  data: {} as Record<string, unknown>,
  status: {} as Record<string, unknown>,
  history: [] as unknown[],
});

const cloneValue = <T,>(value: T): T => {
  if (value === undefined) {
    return value;
  }

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to the JSON clone.
    }
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
};

function ensureFieldContainer(draft: any) {
  if (!draft.field || typeof draft.field !== "object") {
    draft.field = createDefaultFieldContainer();
    return draft.field;
  }

  if (!draft.field.data || typeof draft.field.data !== "object") {
    draft.field.data = {};
  }

  if (!draft.field.status || typeof draft.field.status !== "object") {
    draft.field.status = {};
  }

  if (!Array.isArray(draft.field.history)) {
    draft.field.history = [];
  }

  return draft.field;
}

function resolveTarget(
  state: any,
  selector:
    | SectionContextValue["activeSelector"]
    | SectionContextValue["statusSelector"]
    | SectionContextValue["sourceSelector"]
    | undefined,
  fallback: (value: any) => any
) {
  if (typeof selector === "function") {
    try {
      const selected = selector(state);
      if (selected && typeof selected === "object") {
        return selected;
      }
    } catch {
      // Fall back to the default store when custom selectors throw.
    }
  }

  const selected = fallback(state);
  return selected && typeof selected === "object" ? selected : null;
}

function getActiveFallback(state: any) {
  return state?.field?.data ?? null;
}

function getStatusFallback(state: any) {
  return state?.field?.status ?? null;
}

function getSourceFallback(state: any) {
  return state ?? null;
}

export function getSectionActiveTarget(
  state: any,
  sectionContext?: Pick<SectionContextValue, "activeSelector">
) {
  return resolveTarget(state, sectionContext?.activeSelector, getActiveFallback);
}

export function getSectionStatusTarget(
  state: any,
  sectionContext?: Pick<SectionContextValue, "statusSelector">
) {
  return resolveTarget(state, sectionContext?.statusSelector, getStatusFallback);
}

export function getSectionSourceTarget(
  state: any,
  sectionContext?: Pick<SectionContextValue, "sourceSelector">
) {
  return resolveTarget(state, sectionContext?.sourceSelector, getSourceFallback);
}

export function readSectionActiveFieldValue(
  state: any,
  sectionContext: Pick<SectionContextValue, "activeSelector"> | undefined,
  fieldId: string | null | undefined
) {
  if (!fieldId) return undefined;
  const target = getSectionActiveTarget(state, sectionContext);
  return target ? target[fieldId] : undefined;
}

export function readSectionFieldStatus(
  state: any,
  sectionContext: Pick<SectionContextValue, "statusSelector"> | undefined,
  fieldId: string | null | undefined
) {
  if (!fieldId) return undefined;
  const target = getSectionStatusTarget(state, sectionContext);
  return target ? target[fieldId] : undefined;
}

export function readSectionSourceFieldValue(
  state: any,
  sectionContext: Pick<SectionContextValue, "sourceSelector"> | undefined,
  fieldId: string | null | undefined
) {
  if (!fieldId) return undefined;
  const target = getSectionSourceTarget(state, sectionContext);
  return target ? target[fieldId] : undefined;
}

export function writeSectionActiveFieldValue(
  draft: any,
  sectionContext: Pick<SectionContextValue, "activeSelector"> | undefined,
  fieldId: string,
  value: unknown,
  linkedFieldIds: string[] = []
) {
  const field = ensureFieldContainer(draft);
  const target =
    resolveTarget(draft, sectionContext?.activeSelector, getActiveFallback) ?? field.data;

  target[fieldId] = cloneValue(value);
  linkedFieldIds.forEach((linkedFieldId) => {
    if (!linkedFieldId || linkedFieldId === fieldId) return;
    target[linkedFieldId] = cloneValue(value);
  });
}

export function writeSectionFieldError(
  draft: any,
  sectionContext: Pick<SectionContextValue, "statusSelector"> | undefined,
  fieldId: string,
  errorMessage?: string | null
) {
  const field = ensureFieldContainer(draft);
  const target =
    resolveTarget(draft, sectionContext?.statusSelector, getStatusFallback) ?? field.status;
  const trimmedMessage = typeof errorMessage === "string" ? errorMessage.trim() : "";

  if (!trimmedMessage) {
    if (target[fieldId] && typeof target[fieldId] === "object") {
      const next = { ...target[fieldId] };
      delete next.errorMessage;
      if (Object.keys(next).length === 0) {
        delete target[fieldId];
      } else {
        target[fieldId] = next;
      }
    } else {
      delete target[fieldId];
    }
    return;
  }

  const existing =
    target[fieldId] && typeof target[fieldId] === "object" ? target[fieldId] : {};
  target[fieldId] = {
    ...existing,
    errorMessage: trimmedMessage,
  };
}

export function ensureMoisRuntimeDebugState(draft: any): MoisRuntimeDebugState {
  if (!draft.tempArea || typeof draft.tempArea !== "object") {
    draft.tempArea = {};
  }

  const existing = draft.tempArea.__moisRuntime;
  if (existing && typeof existing === "object") {
    if (!Array.isArray(existing.actionHistory)) {
      existing.actionHistory = [];
    }
    if (!("lastAction" in existing)) {
      existing.lastAction = null;
    }
    return existing as MoisRuntimeDebugState;
  }

  const next: MoisRuntimeDebugState = {
    lastAction: null,
    actionHistory: [],
  };
  draft.tempArea.__moisRuntime = next;
  return next;
}

export function recordMoisRuntimeAction(
  draft: any,
  action: MoisRuntimeActionName,
  payload: unknown
) {
  const debugState = ensureMoisRuntimeDebugState(draft);
  const entry: MoisRuntimeActionRecord = {
    action,
    payload: cloneValue(payload),
    timestamp: new Date().toISOString(),
  };

  debugState.lastAction = entry;
  debugState.actionHistory = [...debugState.actionHistory, entry].slice(-10);
  emitMoisRuntimeEvent(debugState);
}

export function emitMoisNavigateEvent(detail: unknown) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent("send-session-message", { detail }));
  window.dispatchEvent(new CustomEvent("mois:navigate", { detail }));
}
