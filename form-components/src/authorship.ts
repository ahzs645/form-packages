import { preparePortableAuthorship } from "./runtime/authorship-persist";

export type AuthorshipScope = 'field' | 'row';
export type AuthorshipLockOn = 'save' | 'sign' | 'submit';
export type AuthorshipState = 'pending' | 'locked' | 'signed' | 'unlocked';

export interface AuthorshipPolicy {
  enabled?: boolean;
  granularity?: AuthorshipScope;
  lockOn?: AuthorshipLockOn;
  editableWindowHours?: number;
  showStatusColumn?: boolean;
}

export interface AuthorshipClaim {
  claimKey: string;
  scope: AuthorshipScope;
  fieldId?: string;
  rowKey?: string;
  componentId?: string;
  ownerName?: string;
  ownerId?: string | number;
  timestamp?: string;
  claimedAt?: string;
  lastSavedAt?: string;
  editableUntil?: string;
  editableWindowHours?: number;
  status: AuthorshipState;
  lockOn: AuthorshipLockOn;
  releasedAt?: string;
  releasedBy?: string;
  sourceValue?: any;
  currentValue?: any;
}

export interface AuthorshipStore {
  version: 1;
  claims: Record<string, AuthorshipClaim>;
}

export interface AuthorshipLockInfo {
  locked: boolean;
  claim?: AuthorshipClaim;
  note?: string;
  ownerName?: string;
  timestamp?: string;
  editableUntil?: string;
  isOwner?: boolean;
  expired?: boolean;
}

export interface AuthorshipFieldTarget {
  fieldId: string;
  policy: Required<AuthorshipPolicy>;
}

export interface AuthorshipRowTarget {
  componentId: string;
  fieldId: string;
  rowIds: string[];
  policy: Required<AuthorshipPolicy>;
}

export interface AuthorshipTargetRegistry {
  version: 1;
  fields: Record<string, AuthorshipFieldTarget>;
  rows: Record<string, AuthorshipRowTarget>;
}

export type AuthorshipPersistAction = 'save' | 'submit' | 'sign';

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const DEFAULT_EDITABLE_WINDOW_HOURS = 72;

const getRememberedPreviewAuthorshipStore = () => {
  if (typeof globalThis === 'undefined') return undefined;
  const value = (globalThis as any).__MOIS_PREVIEW_SOURCE_FORM_DATA__;
  return value && typeof value === 'object' ? (value as any).__authorship : undefined;
};

export const DEFAULT_AUTHORSHIP_POLICY: Required<AuthorshipPolicy> = {
  enabled: false,
  granularity: 'field',
  lockOn: 'save',
  editableWindowHours: DEFAULT_EDITABLE_WINDOW_HOURS,
  showStatusColumn: false,
};

export const normalizeAuthorshipPolicy = (policy?: AuthorshipPolicy): Required<AuthorshipPolicy> => ({
  enabled: policy?.enabled === true,
  granularity: policy?.granularity === 'row' ? 'row' : 'field',
  lockOn: policy?.lockOn === 'sign' || policy?.lockOn === 'submit' ? policy.lockOn : 'save',
  editableWindowHours:
    typeof policy?.editableWindowHours === 'number' && Number.isFinite(policy.editableWindowHours) && policy.editableWindowHours > 0
      ? policy.editableWindowHours
      : DEFAULT_EDITABLE_WINDOW_HOURS,
  showStatusColumn: policy?.showStatusColumn === true,
});

export const formatAuthorshipTimestamp = (timestamp?: string) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} - ${hh}:${min}`;
};

// Normalization is a pure function of its input, and read paths call it on
// every access (getAuthorshipStore runs per claim lookup). Caching by input
// identity keeps claim-object identity stable across reads of unchanged state,
// which subscription slices rely on for equality. The cached store must be
// treated as immutable — writers go through setFormData drafts, never by
// mutating a normalized store in place.
const normalizedAuthorshipStoreCache = new WeakMap<object, AuthorshipStore>();

export const normalizeAuthorshipStore = (input?: any): AuthorshipStore => {
  const cacheable = !!input && typeof input === 'object';
  if (cacheable) {
    const cached = normalizedAuthorshipStoreCache.get(input);
    if (cached) return cached;
  }
  const normalized = buildNormalizedAuthorshipStore(input);
  if (cacheable) {
    normalizedAuthorshipStoreCache.set(input, normalized);
  }
  return normalized;
};

const buildNormalizedAuthorshipStore = (input?: any): AuthorshipStore => {
  const normalizeClaim = (key: string, value: any): AuthorshipClaim | null => {
    if (!value || typeof value !== 'object') return null;
    const claimKey = String(value.claimKey || value.key || key || value.fieldId || value.rowKey || '');
    if (!claimKey) return null;
    const timestamp = value.timestamp;
    const claimedAt = value.claimedAt || timestamp;
    return {
      claimKey,
      scope: value.scope === 'row' ? 'row' : 'field',
      fieldId: value.fieldId,
      rowKey: value.rowKey,
      componentId: value.componentId,
      ownerName: value.ownerName,
      ownerId: value.ownerId,
      timestamp,
      claimedAt,
      lastSavedAt: value.lastSavedAt || timestamp,
      editableUntil: value.editableUntil,
      editableWindowHours: value.editableWindowHours,
      status: value.status === 'pending' || value.status === 'signed' || value.status === 'unlocked' ? value.status : 'locked',
      lockOn: value.lockOn === 'sign' || value.lockOn === 'submit' ? value.lockOn : 'save',
      releasedAt: value.releasedAt,
      releasedBy: value.releasedBy,
      sourceValue: value.sourceValue,
      currentValue: value.currentValue,
    };
  };

  if (input && typeof input === 'object' && input.version === 1 && input.claims && typeof input.claims === 'object') {
    const claims: Record<string, AuthorshipClaim> = {};
    Object.entries(input.claims as Record<string, any>).forEach(([key, value]) => {
      const claim = normalizeClaim(key, value);
      if (claim) claims[claim.claimKey] = claim;
    });
    return {
      version: 1,
      claims,
    };
  }

  const claims: Record<string, AuthorshipClaim> = {};

  if (Array.isArray(input?.claims)) {
    input.claims.forEach((claim: any) => {
      const normalized = normalizeClaim('', claim);
      if (normalized) claims[normalized.claimKey] = normalized;
    });
  } else if (input && typeof input === 'object') {
    Object.entries(input as Record<string, any>).forEach(([key, value]) => {
      const normalized = normalizeClaim(key, value);
      if (normalized) claims[normalized.claimKey] = normalized;
    });
  }

  return { version: 1, claims };
};

export const buildAuthorshipClaimKey = ({
  scope,
  fieldId,
  rowKey,
  componentId,
}: {
  scope: AuthorshipScope;
  fieldId?: string;
  rowKey?: string;
  componentId?: string;
}) => {
  if (scope === 'row') {
    return `row:${componentId || 'component'}:${rowKey || fieldId || ''}`;
  }
  return `field:${fieldId || rowKey || componentId || ''}`;
};

export const isNonEmptyValue = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((entry) => isNonEmptyValue(entry));
  if (typeof value === 'object') return Object.values(value).some((entry) => isNonEmptyValue(entry));
  return true;
};

export const stripAuthorshipMetadata = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map((entry) => stripAuthorshipMetadata(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== '__authorship')
        .map(([key, nested]) => [key, stripAuthorshipMetadata(nested)])
    );
  }
  return value;
};

export const valuesMatch = (left: any, right: any) => {
  return JSON.stringify(stripAuthorshipMetadata(left ?? null)) === JSON.stringify(stripAuthorshipMetadata(right ?? null));
};

export const hasMeaningfulAuthorshipChange = (currentValue: any, baseValue: any) => {
  return !valuesMatch(currentValue, baseValue)
    && (isNonEmptyValue(currentValue) || isNonEmptyValue(baseValue));
};

export const getAuthorshipOwnerName = (sourceData?: any, activeData?: any, fallback?: string) => {
  return (
    fallback
    || sourceData?.userProfile?.identity?.fullName
    || activeData?.field?.data?.createdBy
    || activeData?.formData?.createdBy
    || sourceData?.webform?.provider?.name
    || sourceData?.webform?.encounter?.attendingProvider?.display
    || ''
  );
};

export const getAuthorshipStore = (state?: any): AuthorshipStore => {
  const store = normalizeAuthorshipStore(
    state?.field?.data?.__authorship
    ?? state?.formData?.__authorship
  );
  if (Object.keys(store.claims).length > 0) return store;
  const rememberedPreviewStore = normalizeAuthorshipStore(getRememberedPreviewAuthorshipStore());
  if (Object.keys(rememberedPreviewStore.claims).length > 0) return rememberedPreviewStore;
  return store;
};

export const getAuthorshipClaim = (
  state: any,
  query: { scope: AuthorshipScope; fieldId?: string; rowKey?: string; componentId?: string }
) => {
  const store = getAuthorshipStore(state);
  const claimKey = buildAuthorshipClaimKey(query);
  return store.claims[claimKey];
};

export const isClaimLocked = (claim?: AuthorshipClaim) => {
  return !!claim && claim.status !== 'unlocked' && claim.status !== 'pending';
};

const addHoursIso = (timestamp: string | undefined, hours: number) => {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(date.getTime())) return undefined;
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
};

const isSameAuthorshipActor = (
  claim?: AuthorshipClaim,
  actor?: string | { ownerName?: string; ownerId?: string | number }
) => {
  if (!claim || !actor) return false;
  if (typeof actor === 'string') {
    return !!claim.ownerName && claim.ownerName === actor;
  }
  if (actor.ownerId !== undefined && claim.ownerId !== undefined) {
    return String(actor.ownerId) === String(claim.ownerId);
  }
  return !!actor.ownerName && !!claim.ownerName && actor.ownerName === claim.ownerName;
};

export const getAuthorshipLockInfo = (
  state: any,
  query: { scope: AuthorshipScope; fieldId?: string; rowKey?: string; componentId?: string },
  currentUser?: string | { ownerName?: string; ownerId?: string | number; now?: Date | string | number },
  options?: { now?: Date | string | number }
): AuthorshipLockInfo => {
  const claim = getAuthorshipClaim(state, query);
  return getAuthorshipLockInfoForClaim(claim, currentUser, options);
};

/**
 * Lock info computed from an already-resolved claim. Lets subscription-slice
 * consumers select the (identity-stable) claim and derive lock info at render
 * time without needing the whole form state.
 */
export const getAuthorshipLockInfoForClaim = (
  claim: AuthorshipClaim | undefined,
  currentUser?: string | { ownerName?: string; ownerId?: string | number; now?: Date | string | number },
  options?: { now?: Date | string | number }
): AuthorshipLockInfo => {
  if (!isClaimLocked(claim)) return { locked: false };
  const ownerName = claim?.ownerName || 'Unknown';
  const timestamp = formatAuthorshipTimestamp(claim?.timestamp);
  const isOwner = isSameAuthorshipActor(claim, currentUser);
  const editableUntil = claim?.editableUntil || addHoursIso(claim?.claimedAt || claim?.timestamp, DEFAULT_EDITABLE_WINDOW_HOURS);
  const editableUntilDate = editableUntil ? new Date(editableUntil) : null;
  const currentUserNow = typeof currentUser === 'object' ? currentUser.now : undefined;
  const now = options?.now ? new Date(options.now) : currentUserNow ? new Date(currentUserNow) : new Date();
  const expired = !!editableUntilDate && !Number.isNaN(editableUntilDate.getTime()) && now.getTime() > editableUntilDate.getTime();

  if (claim?.status !== 'signed' && isOwner && !expired) {
    const until = formatAuthorshipTimestamp(editableUntil);
    return {
      locked: false,
      claim,
      ownerName,
      timestamp,
      editableUntil: until,
      isOwner,
      expired,
      note: until ? `Locked to you until ${until}` : `Locked to you`,
    };
  }

  const actionLabel = claim?.status === 'signed'
    ? 'Signed by'
    : expired
      ? 'Editing window expired for'
      : 'Locked by';
  return {
    locked: true,
    claim,
    ownerName,
    timestamp,
    editableUntil: formatAuthorshipTimestamp(editableUntil),
    isOwner,
    expired,
    note: timestamp ? `${actionLabel} ${ownerName} at ${timestamp}` : `${actionLabel} ${ownerName}`,
  };
};

export const normalizeAuthorshipTargetRegistry = (input?: any): AuthorshipTargetRegistry => {
  const registry: AuthorshipTargetRegistry = {
    version: 1,
    fields: {},
    rows: {},
  };

  if (!input || typeof input !== 'object') {
    return registry;
  }

  if (input.fields && typeof input.fields === 'object') {
    Object.entries(input.fields).forEach(([fieldId, value]) => {
      if (!fieldId || !value || typeof value !== 'object') return;
      registry.fields[fieldId] = {
        fieldId,
        policy: normalizeAuthorshipPolicy((value as any).policy ?? value),
      };
    });
  }

  if (input.rows && typeof input.rows === 'object') {
    Object.entries(input.rows).forEach(([componentId, value]) => {
      if (!componentId || !value || typeof value !== 'object') return;
      const fieldId = String((value as any).fieldId || '');
      const rowIds = Array.isArray((value as any).rowIds)
        ? (value as any).rowIds
            .map((rowId: unknown) => String(rowId || '').trim())
            .filter(Boolean)
        : [];
      if (!fieldId || rowIds.length === 0) return;
      registry.rows[componentId] = {
        componentId,
        fieldId,
        rowIds,
        policy: normalizeAuthorshipPolicy((value as any).policy ?? value),
      };
    });
  }

  return registry;
};

const policiesMatch = (left?: AuthorshipPolicy, right?: AuthorshipPolicy) => {
  const normalizedLeft = normalizeAuthorshipPolicy(left);
  const normalizedRight = normalizeAuthorshipPolicy(right);
  return (
    normalizedLeft.enabled === normalizedRight.enabled
    && normalizedLeft.granularity === normalizedRight.granularity
    && normalizedLeft.lockOn === normalizedRight.lockOn
    && normalizedLeft.editableWindowHours === normalizedRight.editableWindowHours
  );
};

const getMutableAuthorshipRegistry = (state: any): AuthorshipTargetRegistry => {
  if (!state.uiState || typeof state.uiState !== 'object') {
    state.uiState = { sections: {} };
  }
  const existing = state.uiState.__authorshipTargets;
  if (
    existing
    && typeof existing === 'object'
    && existing.version === 1
    && existing.fields
    && typeof existing.fields === 'object'
    && existing.rows
    && typeof existing.rows === 'object'
  ) {
    return existing as AuthorshipTargetRegistry;
  }
  const registry = normalizeAuthorshipTargetRegistry(existing);
  state.uiState.__authorshipTargets = registry;
  return registry;
};

export const registerAuthorshipFieldTarget = (
  state: any,
  fieldId?: string,
  policy?: AuthorshipPolicy
) => {
  if (!state || typeof state !== 'object') return false;
  const normalizedFieldId = String(fieldId || '').trim();
  if (!normalizedFieldId) return false;
  const registry = getMutableAuthorshipRegistry(state);
  const normalizedPolicy = normalizeAuthorshipPolicy(policy);

  if (!normalizedPolicy.enabled || normalizedPolicy.granularity !== 'field') {
    if (!registry.fields[normalizedFieldId]) return false;
    delete registry.fields[normalizedFieldId];
    return true;
  }

  const current = registry.fields[normalizedFieldId];
  if (current && policiesMatch(current.policy, normalizedPolicy)) {
    return false;
  }

  registry.fields[normalizedFieldId] = {
    fieldId: normalizedFieldId,
    policy: normalizedPolicy,
  };
  return true;
};

export const registerAuthorshipRowTarget = (
  state: any,
  input: {
    componentId?: string;
    fieldId?: string;
    rowIds?: string[];
    policy?: AuthorshipPolicy;
  }
) => {
  if (!state || typeof state !== 'object') return false;
  const componentId = String(input.componentId || '').trim();
  if (!componentId) return false;
  const registry = getMutableAuthorshipRegistry(state);
  const normalizedPolicy = normalizeAuthorshipPolicy(input.policy);

  if (!normalizedPolicy.enabled || normalizedPolicy.granularity !== 'row') {
    if (!registry.rows[componentId]) return false;
    delete registry.rows[componentId];
    return true;
  }

  const fieldId = String(input.fieldId || '').trim();
  const rowIds = Array.isArray(input.rowIds)
    ? input.rowIds.map((rowId) => String(rowId || '').trim()).filter(Boolean)
    : [];

  if (!fieldId || rowIds.length === 0) {
    if (!registry.rows[componentId]) return false;
    delete registry.rows[componentId];
    return true;
  }

  const current = registry.rows[componentId];
  const rowIdsMatch = current && JSON.stringify(current.rowIds) === JSON.stringify(rowIds);
  if (current && current.fieldId === fieldId && rowIdsMatch && policiesMatch(current.policy, normalizedPolicy)) {
    return false;
  }

  registry.rows[componentId] = {
    componentId,
    fieldId,
    rowIds,
    policy: normalizedPolicy,
  };
  return true;
};

export const mergeAuthorshipStore = (target: any, store?: AuthorshipStore) => {
  const normalized = normalizeAuthorshipStore(store);
  if (!target || typeof target !== 'object') return target;
  if (!target.__authorship || typeof target.__authorship !== 'object') {
    target.__authorship = normalized;
  } else {
    target.__authorship = normalized;
  }
  return target;
};

export const syncAuthorshipMirrors = <T extends { field?: { data?: Record<string, any> }; formData?: Record<string, any> }>(state: T): T => {
  if (!state || typeof state !== 'object') return state;
  const nextState = state as any;
  const fieldData = nextState.field?.data && typeof nextState.field.data === 'object' ? nextState.field.data : {};
  const currentFormData = nextState.formData && typeof nextState.formData === 'object' ? nextState.formData : {};
  const nextAuthorship = normalizeAuthorshipStore(
    currentFormData.__authorship ?? fieldData.__authorship
  );
  const nextFieldData = {
    ...deepClone(fieldData),
    __authorship: nextAuthorship,
  };

  const mirroredFormData = {
    ...deepClone(currentFormData),
    ...deepClone(fieldData),
    __authorship: nextAuthorship,
  };

  return {
    ...nextState,
    field: {
      ...(nextState.field && typeof nextState.field === 'object'
        ? nextState.field
        : { status: {}, history: [] }),
      data: nextFieldData,
    },
    formData: mirroredFormData,
  };
};

export const createAuthorshipClaim = ({
  scope,
  fieldId,
  rowKey,
  componentId,
  lockOn,
  ownerName,
  ownerId,
  timestamp,
  editableWindowHours,
  currentValue,
  sourceValue,
  status,
}: {
  scope: AuthorshipScope;
  fieldId?: string;
  rowKey?: string;
  componentId?: string;
  lockOn?: AuthorshipLockOn;
  ownerName?: string;
  ownerId?: string | number;
  timestamp?: string;
  editableWindowHours?: number;
  currentValue?: any;
  sourceValue?: any;
  status?: AuthorshipState;
}): AuthorshipClaim => {
  const resolvedLockOn = lockOn ?? 'save';
  const claimKey = buildAuthorshipClaimKey({ scope, fieldId, rowKey, componentId });
  const claimedAt = timestamp ?? new Date().toISOString();
  const windowHours =
    typeof editableWindowHours === 'number' && Number.isFinite(editableWindowHours) && editableWindowHours > 0
      ? editableWindowHours
      : DEFAULT_EDITABLE_WINDOW_HOURS;
  return {
    claimKey,
    scope,
    fieldId,
    rowKey,
    componentId,
    ownerName,
    ownerId,
    timestamp: claimedAt,
    claimedAt,
    lastSavedAt: claimedAt,
    editableUntil: addHoursIso(claimedAt, windowHours),
    status: status ?? (resolvedLockOn === 'save' ? 'locked' : 'signed'),
    lockOn: resolvedLockOn,
    currentValue,
    sourceValue,
  };
};

export const upsertAuthorshipClaim = (
  state: any,
  claim: AuthorshipClaim
) => {
  if (!state || typeof state !== 'object') return state;
  const store = normalizeAuthorshipStore(state.field?.data?.__authorship ?? state.formData?.__authorship);
  store.claims[claim.claimKey] = claim;
  if (!state.field) {
    state.field = { data: {}, status: {}, history: [] };
  }
  if (!state.field.data || typeof state.field.data !== 'object') {
    state.field.data = {};
  }
  if (!state.formData || typeof state.formData !== 'object') {
    state.formData = {};
  }
  state.field.data.__authorship = store;
  state.formData.__authorship = store;
  return state;
};

export const clearAuthorshipClaim = (
  state: any,
  query: { scope: AuthorshipScope; fieldId?: string; rowKey?: string; componentId?: string },
  releasedBy?: string
) => {
  if (!state || typeof state !== 'object') return state;
  const store = normalizeAuthorshipStore(state.field?.data?.__authorship ?? state.formData?.__authorship);
  const claimKey = buildAuthorshipClaimKey(query);
  const current = store.claims[claimKey];
  if (!current) return state;
  store.claims[claimKey] = {
    ...current,
    status: 'unlocked',
    releasedAt: new Date().toISOString(),
    releasedBy,
  };
  if (!state.field) {
    state.field = { data: {}, status: {}, history: [] };
  }
  if (!state.field.data || typeof state.field.data !== 'object') {
    state.field.data = {};
  }
  if (!state.formData || typeof state.formData !== 'object') {
    state.formData = {};
  }
  state.field.data.__authorship = store;
  state.formData.__authorship = store;
  return state;
};

const ensurePersistableState = (input?: any) => {
  const nextState = syncAuthorshipMirrors(deepClone(input || {}));
  if (!nextState.field || typeof nextState.field !== 'object') {
    nextState.field = { data: {}, status: {}, history: [] };
  }
  if (!nextState.field.data || typeof nextState.field.data !== 'object') {
    nextState.field.data = {};
  }
  if (!nextState.formData || typeof nextState.formData !== 'object') {
    nextState.formData = {};
  }
  if (!nextState.uiState || typeof nextState.uiState !== 'object') {
    nextState.uiState = { sections: {} };
  }
  return nextState;
};

export const prepareAuthorshipPersist = (
  sourceData: any,
  activeData: any,
  action: AuthorshipPersistAction,
  overrides?: { ownerName?: string; ownerId?: string | number; now?: Date | string | number }
) => {
  const nextState = ensurePersistableState(activeData);
  const now = overrides?.now ?? sourceData?.previewOptions?.authorshipNow ?? new Date();
  const prepared = preparePortableAuthorship(
    nextState.field.data,
    sourceData?.sourceFormData || {},
    normalizeAuthorshipTargetRegistry(nextState.uiState?.__authorshipTargets),
    {
      ownerName: getAuthorshipOwnerName(sourceData, nextState, overrides?.ownerName),
      ownerId: overrides?.ownerId ?? sourceData?.userProfile?.userProfileId ?? sourceData?.auth?.userProfileId,
    },
    action, new Date(now).toISOString()
  );
  nextState.field.data = prepared.formData;
  nextState.formData = { ...nextState.formData, ...prepared.formData };
  return { ...prepared, nextState };
};

export const commitPreparedAuthorshipPersist = (activeData: any, prepared: { nextState?: any; changed?: boolean } | undefined) => {
  if (!prepared?.changed) return prepared?.nextState;
  if (typeof activeData?.setFormData === 'function' && prepared.nextState) {
    activeData.setFormData(prepared.nextState);
  }
  return prepared?.nextState;
};

export const releasePreparedAuthorshipClaim = (
  state: any,
  query: { scope: AuthorshipScope; fieldId?: string; rowKey?: string; componentId?: string },
  mode: 'unlock' | 'unsign',
  releasedBy?: string
) => {
  if (!state || typeof state !== 'object') return state;
  const store = normalizeAuthorshipStore(state.field?.data?.__authorship ?? state.formData?.__authorship);
  const claimKey = buildAuthorshipClaimKey(query);
  const current = store.claims[claimKey];
  if (!current) return state;

  if (mode === 'unsign' && current.status !== 'signed') {
    return state;
  }
  if (mode === 'unlock' && current.lockOn !== 'save') {
    return state;
  }

  return clearAuthorshipClaim(state, query, releasedBy);
};
