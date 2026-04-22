import type { SectionContextValue } from "../context/MoisContext";

export type MoisRuntimeActionName =
  | "saveDraft"
  | "saveSubmit"
  | "sign"
  | "unsign"
  | "signSubmit"
  | "print-started"
  | "submit-print-started"
  | "printed"
  | "print-error"
  | "print-cancelled"
  | "closeForm"
  | "cancelForm";

export interface MoisRuntimeActionRecord {
  action: MoisRuntimeActionName;
  payload: unknown;
  timestamp: string;
}

export interface MoisRuntimeDebugState {
  lastAction: MoisRuntimeActionRecord | null;
  actionHistory: MoisRuntimeActionRecord[];
}

type LifecycleAction =
  | "saveDraft"
  | "saveSubmit"
  | "sign"
  | "unsign"
  | "signSubmit"
  | "print-started"
  | "submit-print-started"
  | "printed"
  | "print-error"
  | "print-cancelled"
  | "closeForm"
  | "cancelForm";

export type MoisFormLockEventType = "registered" | "released" | "tested" | "cleared";

export interface MoisFormLockPolicy {
  name?: string;
  scope?: unknown;
  myAction?: unknown;
  otherAction?: unknown;
  [key: string]: unknown;
}

export interface MoisFormLockRecord {
  key: string;
  name: string;
  scope: unknown;
  policy: MoisFormLockPolicy;
  active: boolean;
  registeredAt: string;
  releasedAt?: string;
  source?: string;
}

export interface MoisFormLockEventRecord {
  type: MoisFormLockEventType;
  key: string;
  name: string;
  scope: unknown;
  timestamp: string;
  source?: string;
  matched?: boolean;
}

export interface MoisFormLockState {
  activeLocks: MoisFormLockRecord[];
  events: MoisFormLockEventRecord[];
}

export interface MoisFormLockEventDetail extends MoisFormLockEventRecord {
  state: MoisFormLockState;
}

const formLockRegistry = new Map<string, MoisFormLockRecord>();
let formLockEvents: MoisFormLockEventRecord[] = [];

function emitMoisRuntimeEvent(detail: MoisRuntimeDebugState) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("mois:runtime", {
      detail: cloneValue(detail),
    })
  );
}

function emitMoisFormLockEvent(event: MoisFormLockEventRecord) {
  if (typeof window === "undefined") return;

  const detail: MoisFormLockEventDetail = {
    ...cloneValue(event),
    state: getMoisFormLockState(),
  };

  window.dispatchEvent(new CustomEvent("mois:form-lock", { detail }));
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

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function readLockScope(lockOrScope: unknown) {
  if (
    lockOrScope
    && typeof lockOrScope === "object"
    && Object.prototype.hasOwnProperty.call(lockOrScope, "scope")
  ) {
    return (lockOrScope as MoisFormLockPolicy).scope;
  }

  return lockOrScope;
}

function readLockName(lockOrScope: unknown, fallbackKey: string) {
  if (
    lockOrScope
    && typeof lockOrScope === "object"
    && typeof (lockOrScope as MoisFormLockPolicy).name === "string"
    && (lockOrScope as MoisFormLockPolicy).name
  ) {
    return (lockOrScope as MoisFormLockPolicy).name as string;
  }

  return fallbackKey;
}

export function getMoisFormLockKey(lockOrScope: unknown) {
  const scope = readLockScope(lockOrScope);
  return stableStringify(scope);
}

export function getMoisFormLockState(): MoisFormLockState {
  return {
    activeLocks: Array.from(formLockRegistry.values()).map((record) => cloneValue(record)),
    events: formLockEvents.map((event) => cloneValue(event)),
  };
}

function pushFormLockEvent(event: MoisFormLockEventRecord) {
  formLockEvents = [...formLockEvents, cloneValue(event)].slice(-25);
  emitMoisFormLockEvent(event);
}

export function registerMoisFormLock(lockPolicy: MoisFormLockPolicy | null | undefined, source = "useFormLock") {
  if (!lockPolicy || typeof lockPolicy !== "object") return null;

  const key = getMoisFormLockKey(lockPolicy);
  const name = readLockName(lockPolicy, key);
  const scope = cloneValue(readLockScope(lockPolicy));
  const now = new Date().toISOString();
  const existing = formLockRegistry.get(key);
  const record: MoisFormLockRecord = {
    key,
    name,
    scope,
    policy: cloneValue(lockPolicy),
    active: true,
    registeredAt: existing?.active ? existing.registeredAt : now,
    source,
  };

  formLockRegistry.set(key, record);
  pushFormLockEvent({
    type: "registered",
    key,
    name,
    scope,
    timestamp: now,
    source,
    matched: Boolean(existing?.active),
  });
  emitMoisPreviewDiagnosticEvent({
    severity: "info",
    source: "form-lock-preview",
    message: `Registered MOIS form lock "${name}".`,
    path: key,
    detail: { lockPolicy },
  });

  return cloneValue(record);
}

export function releaseMoisFormLock(lockOrScope: unknown, source = "useFormLock") {
  const key = getMoisFormLockKey(lockOrScope);
  const existing = formLockRegistry.get(key);
  const name = existing?.name ?? readLockName(lockOrScope, key);
  const scope = existing?.scope ?? cloneValue(readLockScope(lockOrScope));
  const now = new Date().toISOString();

  if (existing) {
    formLockRegistry.delete(key);
  }

  pushFormLockEvent({
    type: "released",
    key,
    name,
    scope,
    timestamp: now,
    source,
    matched: Boolean(existing),
  });
  emitMoisPreviewDiagnosticEvent({
    severity: existing ? "info" : "warning",
    source: "form-lock-preview",
    message: existing
      ? `Released MOIS form lock "${name}".`
      : `Release requested for an unknown MOIS form lock "${name}".`,
    path: key,
    detail: { lockOrScope },
  });

  return existing
    ? cloneValue({ ...existing, active: false, releasedAt: now })
    : null;
}

export function testMoisFormLock(lockOrScope?: unknown) {
  const hasLock = lockOrScope === undefined
    ? formLockRegistry.size > 0
    : formLockRegistry.has(getMoisFormLockKey(lockOrScope));
  const key = lockOrScope === undefined ? "*" : getMoisFormLockKey(lockOrScope);
  const name = lockOrScope === undefined ? "any-lock" : readLockName(lockOrScope, key);

  pushFormLockEvent({
    type: "tested",
    key,
    name,
    scope: lockOrScope === undefined ? "*" : cloneValue(readLockScope(lockOrScope)),
    timestamp: new Date().toISOString(),
    source: "testLock",
    matched: hasLock,
  });

  return hasLock;
}

export function clearMoisFormLocks(emitEvent = false) {
  formLockRegistry.clear();
  formLockEvents = [];
  if (!emitEvent) return;
  pushFormLockEvent({
    type: "cleared",
    key: "*",
    name: "all-locks",
    scope: "*",
    timestamp: new Date().toISOString(),
    source: "clearMoisFormLocks",
    matched: true,
  });
}

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

export function applyShimmedMoisLifecyclePreviewState(
  sourceData: any,
  action: LifecycleAction,
  payload?: any
) {
  if (!sourceData || typeof sourceData !== "object") return sourceData;

  const lifecycleState = {
    ...(sourceData.lifecycleState && typeof sourceData.lifecycleState === "object" ? sourceData.lifecycleState : {}),
  };
  const webform = {
    ...(sourceData.webform && typeof sourceData.webform === "object" ? sourceData.webform : {}),
  };
  const formParams = {
    ...(sourceData.formParams && typeof sourceData.formParams === "object" ? sourceData.formParams : {}),
  };

  if (webform.webformId !== undefined && formParams.webformId === undefined) {
    formParams.webformId = webform.webformId;
  }
  if (webform.documentId !== undefined && formParams.documentId === undefined) {
    formParams.documentId = webform.documentId;
  }

  switch (action) {
    case "print-started":
      lifecycleState.isPrinting = true;
      lifecycleState.isSubmitting = false;
      break;
    case "submit-print-started":
      lifecycleState.isPrinting = true;
      lifecycleState.isSubmitting = true;
      break;
    case "printed":
    case "print-error":
    case "print-cancelled":
      lifecycleState.isPrinting = false;
      lifecycleState.isSubmitting = false;
      break;
    case "saveDraft":
      lifecycleState.isLoading = false;
      lifecycleState.isMutating = false;
      webform.isDraft = "Y";
      webform.recordState = webform.recordState === "SIGNED" ? "SIGNED" : "UNSIGNED";
      sourceData.sourceFormData = cloneValue(payload?.formData ?? sourceData.sourceFormData ?? {});
      break;
    case "saveSubmit":
      lifecycleState.isLoading = false;
      lifecycleState.isMutating = false;
      webform.isDraft = "N";
      webform.recordState = webform.recordState === "SIGNED" ? "SIGNED" : "UNSIGNED";
      sourceData.sourceFormData = cloneValue(payload?.formData ?? sourceData.sourceFormData ?? {});
      break;
    case "sign":
      lifecycleState.isLoading = false;
      lifecycleState.isMutating = false;
      webform.isDraft = "N";
      webform.recordState = "SIGNED";
      webform.isLockedToUser = "Y";
      if (payload?.formData) {
        sourceData.sourceFormData = cloneValue(payload.formData);
      }
      break;
    case "unsign":
      lifecycleState.isLoading = false;
      lifecycleState.isMutating = false;
      webform.recordState = "UNSIGNED";
      webform.isLockedToUser = "N";
      if (!webform.isDraft) {
        webform.isDraft = "N";
      }
      if (payload?.formData) {
        sourceData.sourceFormData = cloneValue(payload.formData);
      }
      break;
    case "signSubmit":
      lifecycleState.isLoading = false;
      lifecycleState.isMutating = false;
      webform.isDraft = "N";
      webform.recordState = "SIGNED";
      webform.isLockedToUser = "Y";
      sourceData.sourceFormData = cloneValue(payload?.formData ?? sourceData.sourceFormData ?? {});
      break;
    case "closeForm":
      lifecycleState.closeRequested = true;
      break;
    case "cancelForm":
      lifecycleState.closeRequested = true;
      lifecycleState.cancelled = true;
      break;
  }

  sourceData.lifecycleState = lifecycleState;
  sourceData.webform = webform;
  sourceData.formParams = formParams;
  return sourceData;
}

export function emitMoisNavigateEvent(detail: unknown) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent("send-session-message", { detail }));
  window.dispatchEvent(new CustomEvent("mois:navigate", { detail }));
}

export function emitMoisPreviewDiagnosticEvent(detail: {
  severity: "error" | "warning" | "info";
  source: string;
  message: string;
  path?: string;
  detail?: unknown;
}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mois:preview-diagnostic", { detail }));
}
