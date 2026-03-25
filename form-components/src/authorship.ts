export type AuthorshipScope = 'field' | 'row';
export type AuthorshipLockOn = 'save' | 'sign' | 'submit';
export type AuthorshipState = 'locked' | 'signed' | 'unlocked';

export interface AuthorshipPolicy {
  enabled?: boolean;
  granularity?: AuthorshipScope;
  lockOn?: AuthorshipLockOn;
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

export const DEFAULT_AUTHORSHIP_POLICY: Required<AuthorshipPolicy> = {
  enabled: false,
  granularity: 'field',
  lockOn: 'save',
};

export const normalizeAuthorshipPolicy = (policy?: AuthorshipPolicy): Required<AuthorshipPolicy> => ({
  enabled: policy?.enabled === true,
  granularity: policy?.granularity === 'row' ? 'row' : 'field',
  lockOn: policy?.lockOn === 'sign' || policy?.lockOn === 'submit' ? policy.lockOn : 'save',
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

export const normalizeAuthorshipStore = (input?: any): AuthorshipStore => {
  if (input && typeof input === 'object' && input.version === 1 && input.claims && typeof input.claims === 'object') {
    return {
      version: 1,
      claims: deepClone(input.claims),
    };
  }

  const claims: Record<string, AuthorshipClaim> = {};

  if (Array.isArray(input?.claims)) {
    input.claims.forEach((claim: any) => {
      if (!claim || typeof claim !== 'object') return;
      const claimKey = String(claim.claimKey || claim.key || claim.fieldId || claim.rowKey || '');
      if (!claimKey) return;
      claims[claimKey] = {
        claimKey,
        scope: claim.scope === 'row' ? 'row' : 'field',
        fieldId: claim.fieldId,
        rowKey: claim.rowKey,
        componentId: claim.componentId,
        ownerName: claim.ownerName,
        ownerId: claim.ownerId,
        timestamp: claim.timestamp,
        status: claim.status === 'signed' || claim.status === 'unlocked' ? claim.status : 'locked',
        lockOn: claim.lockOn === 'sign' || claim.lockOn === 'submit' ? claim.lockOn : 'save',
        releasedAt: claim.releasedAt,
        releasedBy: claim.releasedBy,
        sourceValue: claim.sourceValue,
        currentValue: claim.currentValue,
      };
    });
  } else if (input && typeof input === 'object') {
    Object.entries(input as Record<string, any>).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return;
      const claimValue = value as Record<string, any>;
      claims[key] = {
        claimKey: key,
        scope: claimValue.scope === 'row' ? 'row' : 'field',
        fieldId: claimValue.fieldId,
        rowKey: claimValue.rowKey,
        componentId: claimValue.componentId,
        ownerName: claimValue.ownerName,
        ownerId: claimValue.ownerId,
        timestamp: claimValue.timestamp,
        status: claimValue.status === 'signed' || claimValue.status === 'unlocked' ? claimValue.status : 'locked',
        lockOn: claimValue.lockOn === 'sign' || claimValue.lockOn === 'submit' ? claimValue.lockOn : 'save',
        releasedAt: claimValue.releasedAt,
        releasedBy: claimValue.releasedBy,
        sourceValue: claimValue.sourceValue,
        currentValue: claimValue.currentValue,
      };
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

export const isNonEmptyValue = (value: any) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
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
  if (!isNonEmptyValue(currentValue)) return false;
  return !valuesMatch(currentValue, baseValue);
};

export const getAuthorshipOwnerName = (sourceData?: any, activeData?: any, fallback?: string) => {
  return (
    fallback
    || activeData?.field?.data?.createdBy
    || activeData?.formData?.createdBy
    || sourceData?.userProfile?.identity?.fullName
    || sourceData?.webform?.provider?.name
    || sourceData?.webform?.encounter?.attendingProvider?.display
    || ''
  );
};

export const getAuthorshipStore = (state?: any): AuthorshipStore => {
  const store = normalizeAuthorshipStore(state?.field?.data?.__authorship ?? state?.formData?.__authorship);
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
  return !!claim && claim.status !== 'unlocked';
};

export const getAuthorshipLockInfo = (
  state: any,
  query: { scope: AuthorshipScope; fieldId?: string; rowKey?: string; componentId?: string },
  currentUserName?: string
): AuthorshipLockInfo => {
  const claim = getAuthorshipClaim(state, query);
  if (!isClaimLocked(claim)) return { locked: false };
  const ownerName = claim?.ownerName || 'Unknown';
  const timestamp = formatAuthorshipTimestamp(claim?.timestamp);
  const actionLabel = claim?.status === 'signed' ? 'Signed by' : 'Locked by';
  return {
    locked: true,
    claim,
    ownerName,
    timestamp,
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
  currentValue?: any;
  sourceValue?: any;
  status?: AuthorshipState;
}): AuthorshipClaim => {
  const resolvedLockOn = lockOn ?? 'save';
  const claimKey = buildAuthorshipClaimKey({ scope, fieldId, rowKey, componentId });
  return {
    claimKey,
    scope,
    fieldId,
    rowKey,
    componentId,
    ownerName,
    ownerId,
    timestamp: timestamp ?? new Date().toISOString(),
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

const shouldApplyPolicyForAction = (policy: Required<AuthorshipPolicy>, action: AuthorshipPersistAction) => {
  if (!policy.enabled) return false;
  if (action === 'save') return policy.lockOn === 'save';
  if (action === 'submit') return policy.lockOn === 'save' || policy.lockOn === 'submit';
  return policy.lockOn === 'save' || policy.lockOn === 'sign';
};

const nextClaimStatusForAction = (
  action: AuthorshipPersistAction,
  currentClaim?: AuthorshipClaim
): AuthorshipState => {
  if (action === 'sign') return 'signed';
  if (currentClaim?.status === 'signed') return 'signed';
  return 'locked';
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
  overrides?: { ownerName?: string; ownerId?: string | number }
) => {
  const nextState = ensurePersistableState(activeData);
  const registry = normalizeAuthorshipTargetRegistry(nextState.uiState?.__authorshipTargets);
  const store = normalizeAuthorshipStore(nextState.field.data.__authorship ?? nextState.formData.__authorship);
  const currentFormData = nextState.field.data;
  const sourceFormData =
    sourceData?.sourceFormData && typeof sourceData.sourceFormData === 'object'
      ? sourceData.sourceFormData
      : {};
  const ownerName = getAuthorshipOwnerName(sourceData, nextState, overrides?.ownerName);
  const ownerId = overrides?.ownerId ?? sourceData?.userProfile?.userProfileId;
  let changed = false;

  Object.values(registry.fields).forEach((target) => {
    const policy = normalizeAuthorshipPolicy(target.policy);
    if (!shouldApplyPolicyForAction(policy, action)) return;

    const currentValue = currentFormData[target.fieldId];
    const sourceValue = sourceFormData?.[target.fieldId];
    const claimKey = buildAuthorshipClaimKey({ scope: 'field', fieldId: target.fieldId });
    const existingClaim = store.claims[claimKey];
    const hasChange = hasMeaningfulAuthorshipChange(currentValue, sourceValue);

    if (!hasChange) {
      if (action === 'sign' && existingClaim && existingClaim.lockOn === 'save' && existingClaim.status !== 'unlocked') {
        const nextStatus = nextClaimStatusForAction(action, existingClaim);
        if (existingClaim.status !== nextStatus) {
          store.claims[claimKey] = {
            ...existingClaim,
            status: nextStatus,
            timestamp: new Date().toISOString(),
            currentValue,
            sourceValue,
          };
          changed = true;
        }
      }
      return;
    }

    store.claims[claimKey] = createAuthorshipClaim({
      scope: 'field',
      fieldId: target.fieldId,
      lockOn: policy.lockOn,
      ownerName,
      ownerId,
      currentValue,
      sourceValue,
      status: nextClaimStatusForAction(action, existingClaim),
    });
    changed = true;
  });

  Object.values(registry.rows).forEach((target) => {
    const policy = normalizeAuthorshipPolicy(target.policy);
    if (!shouldApplyPolicyForAction(policy, action)) return;

    const currentRows =
      currentFormData?.[target.fieldId] && typeof currentFormData[target.fieldId] === 'object'
        ? currentFormData[target.fieldId]
        : {};
    const sourceRows =
      sourceFormData?.[target.fieldId] && typeof sourceFormData[target.fieldId] === 'object'
        ? sourceFormData[target.fieldId]
        : {};

    target.rowIds.forEach((rowId) => {
      const currentValue = currentRows?.[rowId];
      const sourceValue = sourceRows?.[rowId];
      const claimKey = buildAuthorshipClaimKey({ scope: 'row', rowKey: rowId, componentId: target.componentId });
      const existingClaim = store.claims[claimKey];
      const hasChange = hasMeaningfulAuthorshipChange(currentValue, sourceValue);

      if (!hasChange) {
        if (action === 'sign' && existingClaim && existingClaim.lockOn === 'save' && existingClaim.status !== 'unlocked') {
          const nextStatus = nextClaimStatusForAction(action, existingClaim);
          if (existingClaim.status !== nextStatus) {
            store.claims[claimKey] = {
              ...existingClaim,
              status: nextStatus,
              timestamp: new Date().toISOString(),
              currentValue,
              sourceValue,
            };
            changed = true;
          }
        }
        return;
      }

      store.claims[claimKey] = createAuthorshipClaim({
        scope: 'row',
        rowKey: rowId,
        componentId: target.componentId,
        lockOn: policy.lockOn,
        ownerName,
        ownerId,
        currentValue,
        sourceValue,
        status: nextClaimStatusForAction(action, existingClaim),
      });
      changed = true;
    });
  });

  if (changed) {
    nextState.field.data.__authorship = store;
    nextState.formData = {
      ...deepClone(nextState.formData),
      ...deepClone(nextState.field.data),
      __authorship: store,
    };
  }

  return {
    changed,
    nextState,
    formData: nextState.field.data,
    store,
  };
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
