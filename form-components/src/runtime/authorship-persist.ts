/**
 * Portable, closure-free persistence engine. The exporter embeds this function
 * verbatim so package preview and exported forms execute the same contract.
 * Document signatures enforce document read-only state; they never replace
 * contribution owners or make an ownership claim permanently signed.
 */
export function preparePortableAuthorship(
  data: any, source: any, registry: any, actor: any,
  action: string, nowIso: string
): { changed: boolean; formData: any; store: any } {
  const formData = JSON.parse(JSON.stringify(data || {}));
  const store = { version: 1, claims: { ...(formData.__authorship?.claims || {}) } };
  const now = new Date(nowIso).getTime();
  let changed = false;
  const meaningful = (value: any): boolean => {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.some(meaningful);
    if (typeof value === "object") return Object.values(value).some(meaningful);
    return true;
  };
  const sameOwner = (claim: any) => claim.ownerId != null && actor.ownerId != null
    ? String(claim.ownerId) === String(actor.ownerId)
    : !!claim.ownerName && claim.ownerName === actor.ownerName;
  const applies = (lockOn: string) => action === "sign" || lockOn === "save"
    || (action === "submit" && lockOn === "submit");
  const windowHours = (policy: any) => Number.isFinite(policy.editableWindowHours) && policy.editableWindowHours > 0
    ? policy.editableWindowHours : 72;
  const claimValue = (key: string, identity: any, policy: any, value: any, previous: any) => {
    const existing = store.claims[key];
    if (!policy?.enabled && (!existing || existing.status === "unlocked")) return;
    const differs = JSON.stringify(value ?? null) !== JSON.stringify(previous ?? null)
      && (meaningful(value) || meaningful(previous));
    if (!differs) return;
    if (existing && existing.status !== "unlocked" && existing.status !== "pending") {
      const until = existing.editableUntil || new Date(new Date(existing.claimedAt || existing.timestamp).getTime() + 72 * 3600000).toISOString();
      if (existing.status === "signed" || !sameOwner(existing) || now > new Date(until).getTime()) return;
    }
    const keep = existing && existing.status !== "unlocked" && sameOwner(existing);
    const lockOn = policy.lockOn || "save";
    store.claims[key] = {
      ...(keep ? existing : {}), ...identity, claimKey: key,
      ownerId: actor.ownerId, ownerName: actor.ownerName,
      lockOn: keep ? existing.lockOn : lockOn, editableWindowHours: keep ? windowHours(existing) : windowHours(policy),
      status: keep && existing.status === "locked" ? "locked" : "pending",
      claimedAt: keep ? existing.claimedAt : nowIso,
      timestamp: nowIso, lastSavedAt: nowIso,
      editableUntil: keep ? existing.editableUntil : undefined,
      currentValue: value, sourceValue: previous,
    };
    changed = true;
  };
  for (const target of Object.values(registry?.fields || {}) as any[]) {
    if (target.policy?.granularity === "row") continue;
    const related = target.relatedFieldIds || [];
    const pick = (values: any) => related.length
      ? Object.fromEntries(related.filter((id: string) => meaningful(values?.[id])).map((id: string) => [id, values[id]]))
      : values?.[target.fieldId];
    claimValue("field:" + target.fieldId, { scope: "field", fieldId: target.fieldId }, target.policy, pick(formData), pick(source));
  }
  for (const target of Object.values(registry?.rows || {}) as any[]) {
    const rowAt = (values: any, id: string) => Array.isArray(values)
      ? values.find((row: any) => row?._rowId === id) : values?.[id];
    for (const rowId of target.rowIds || []) {
      claimValue("row:" + target.componentId + ":" + rowId,
        { scope: "row", componentId: target.componentId, rowKey: rowId }, target.policy,
        rowAt(formData[target.fieldId], rowId), rowAt(source?.[target.fieldId], rowId));
    }
  }
  // Finalize pending contributions even when a different clinician submits or
  // signs. The original author remains the owner; an unchanged draft is not
  // attributed to the signer. Start the edit window at first enforcement.
  for (const key of Object.keys(store.claims)) {
    const claim = store.claims[key];
    if (claim?.status !== "pending" || !applies(claim.lockOn || "save")) continue;
    store.claims[key] = {
      ...claim, status: "locked", claimedAt: nowIso, timestamp: nowIso,
      lastSavedAt: nowIso, editableUntil: new Date(now + windowHours(claim) * 3600000).toISOString(),
    };
    changed = true;
  }
  if (changed) formData.__authorship = store;
  return { changed, formData, store };
}
