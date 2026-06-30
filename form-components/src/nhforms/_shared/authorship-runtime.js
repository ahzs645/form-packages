/**
 * __nhAuth — self-contained field/row authorship runtime for NHForms components.
 *
 * WHY THIS EXISTS
 * Real MOIS runs every form by concatenating all component sources + the form
 * into ONE string, transpiling once, and executing it inside a fixed-arg
 * Function(React, Fabric, Fluent, MoisControl, MoisFunction, MoisActions,
 * MoisHooks, Mois) wrapper. It does NOT inject the webforms authorship engine
 * (prepareAuthorshipPersist / getAuthorshipLockInfo are undefined there), so the
 * preview-only engine is dormant on export. This runtime is INLINED into each
 * authorship-aware component's source (prepended by the nhforms generator and
 * the Vite loader for any component that references `__nhAuth`) so the logic
 * actually executes inside real MOIS.
 *
 * COLLISION SAFETY
 * Everything lives inside a single anonymous IIFE that assigns `window.__nhAuth`
 * exactly once (idempotent). There are NO top-level declarations, so prepending
 * this snippet to several components — all concatenated into one scope by real
 * MOIS — can never produce a duplicate-declaration SyntaxError.
 *
 * SCOPE / LIMITS (see docs runtime/mois-locking-signing-audit.md)
 * - Advisory, client-side only: MOIS stores `field.data.__authorship` as an
 *   opaque blob and enforces nothing server-side. Not a security boundary.
 * - A component can only enforce read-only on inputs IT renders. Authored values
 *   must live inside an authorship-aware component, not as loose native fields.
 * - Claims persist in `field.data.__authorship` (that is what MOIS saves).
 *
 * Mirror of packages/form-components/src/authorship.ts — keep in rough sync.
 */
;(function () {
  if (typeof window === "undefined" || !window || window.__nhAuth) return;

  var DEFAULT_WINDOW_HOURS = 72;

  function isNonEmpty(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  }

  function buildKey(q) {
    q = q || {};
    if (q.scope === "row") {
      return "row:" + (q.componentId || "component") + ":" + (q.rowKey || q.fieldId || "");
    }
    return "field:" + (q.fieldId || q.rowKey || q.componentId || "");
  }

  function normalizeStore(input) {
    var claims = {};
    if (input && typeof input === "object" && input.claims && typeof input.claims === "object") {
      Object.keys(input.claims).forEach(function (k) {
        var c = input.claims[k];
        if (c && typeof c === "object") {
          var ck = c.claimKey || k;
          if (ck) claims[ck] = c;
        }
      });
    }
    return { version: 1, claims: claims };
  }

  function readStore(state) {
    var data =
      state && state.field && state.field.data
        ? state.field.data
        : state && state.formData
          ? state.formData
          : null;
    return normalizeStore(data && data.__authorship);
  }

  function addHoursIso(ts, hours) {
    var d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) return undefined;
    return new Date(d.getTime() + hours * 3600000).toISOString();
  }

  function pad2(n) {
    return String(n).length < 2 ? "0" + n : String(n);
  }

  function formatTimestamp(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return (
      d.getFullYear() +
      "." + pad2(d.getMonth() + 1) +
      "." + pad2(d.getDate()) +
      " - " + pad2(d.getHours()) +
      ":" + pad2(d.getMinutes())
    );
  }

  function sameActor(claim, actor) {
    if (!claim || !actor) return false;
    if (
      actor.ownerId !== undefined && actor.ownerId !== null &&
      claim.ownerId !== undefined && claim.ownerId !== null
    ) {
      return String(actor.ownerId) === String(claim.ownerId);
    }
    return !!actor.ownerName && !!claim.ownerName && actor.ownerName === claim.ownerName;
  }

  // Identity is read from the genuine MOIS session. Prefer sd.userProfile so the
  // live actor matches the visible logged-in profile; fall back to sd.auth for
  // runtimes that only expose the auth id.
  function actorFrom(sd, state) {
    var ownerId =
      sd && sd.userProfile && sd.userProfile.userProfileId !== undefined && sd.userProfile.userProfileId !== null
          ? sd.userProfile.userProfileId
          : sd && sd.auth && sd.auth.userProfileId !== undefined && sd.auth.userProfileId !== null
            ? sd.auth.userProfileId
            : undefined;
    var ownerName =
      (state && state.field && state.field.data && state.field.data.createdBy) ||
      (sd && sd.userProfile && sd.userProfile.identity && sd.userProfile.identity.fullName) ||
      (sd && sd.webform && sd.webform.provider && sd.webform.provider.name) ||
      "";
    return { ownerId: ownerId, ownerName: ownerName };
  }

  function resolveNow(sd, opts) {
    var raw =
      opts && opts.now !== undefined && opts.now !== null
        ? opts.now
        : sd && sd.previewOptions
          ? sd.previewOptions.authorshipNow
          : undefined;
    return raw ? new Date(raw) : new Date();
  }

  // Read: compute lock state for a target. `opts` carries the current actor
  // (ownerId/ownerName) and an optional `now` override (preview clock).
  // A "pending" claim (lock-on-save, not yet saved) is NOT enforced.
  function lockInfo(state, sd, query, opts) {
    opts = opts || {};
    var store = readStore(state);
    var claim = store.claims[buildKey(query)];
    if (!claim || claim.status === "unlocked" || claim.status === "pending") return { locked: false };

    var ownerName = claim.ownerName || "Unknown";
    var ts = formatTimestamp(claim.timestamp);
    var actor = { ownerId: opts.ownerId, ownerName: opts.ownerName };
    var isOwner = sameActor(claim, actor);
    var editableUntil = claim.editableUntil || addHoursIso(claim.claimedAt || claim.timestamp, DEFAULT_WINDOW_HOURS);
    var now = resolveNow(sd, opts);
    var euDate = editableUntil ? new Date(editableUntil) : null;
    var expired = !!euDate && !isNaN(euDate.getTime()) && now.getTime() > euDate.getTime();

    if (claim.status !== "signed" && isOwner && !expired) {
      var untilSelf = formatTimestamp(editableUntil);
      return {
        locked: false,
        claim: claim,
        isOwner: true,
        expired: false,
        ownerName: ownerName,
        note: untilSelf ? "Locked to you until " + untilSelf : "Locked to you",
      };
    }

    var label = claim.status === "signed"
      ? "Signed by"
      : expired
        ? "Editing window expired for"
        : "Locked by";
    return {
      locked: true,
      claim: claim,
      isOwner: isOwner,
      expired: expired,
      ownerName: ownerName,
      note: ts ? label + " " + ownerName + " at " + ts : label + " " + ownerName,
    };
  }

  // Write: mutate a produce() draft to upsert/refresh the current actor's claim
  // for a target. Returns true when the claim store changed. Call inside the
  // component's own setFormData(produce(draft => ...)) on value change.
  function claim(draft, sd, query, value, policy, opts) {
    opts = opts || {};
    policy = policy || {};
    if (policy.enabled === false) return false;
    if (!draft || typeof draft !== "object") return false;
    if (!draft.field) draft.field = { data: {}, status: {}, history: [] };
    if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {};

    var store = normalizeStore(draft.field.data.__authorship);
    var key = buildKey(query);
    var existing = store.claims[key];
    var actor = actorFrom(sd, draft);
    var now = resolveNow(sd, opts);
    var nowIso = now.toISOString();
    var windowHours =
      typeof policy.editableWindowHours === "number" && policy.editableWindowHours > 0
        ? policy.editableWindowHours
        : DEFAULT_WINDOW_HOURS;

    var lockOn = policy.lockOn || "edit";
    // lock-on-edit enforces immediately; lock-on-save/submit/sign records a
    // non-enforced "pending" claim that a later save promotes to "locked".
    var pending = lockOn !== "edit";

    // Enforcement: a signed claim is terminal; a LOCKED claim owned by someone
    // else blocks until its window expires; a PENDING claim is not yet enforced
    // so anyone may take it over.
    if (existing && existing.status === "signed") return false;
    if (existing && existing.status === "locked" && !sameActor(existing, actor)) {
      var lockedUntil = existing.editableUntil || addHoursIso(existing.claimedAt || existing.timestamp, DEFAULT_WINDOW_HOURS);
      var lockedUntilDate = lockedUntil ? new Date(lockedUntil) : null;
      var lockExpired = !!lockedUntilDate && !isNaN(lockedUntilDate.getTime()) && now.getTime() > lockedUntilDate.getTime();
      if (!lockExpired) return false;
    }

    var ownerRefresh = existing && existing.status !== "unlocked" && sameActor(existing, actor);
    if (ownerRefresh) {
      // Owner edit: refresh value/timestamp, keep the original window. A claim
      // already promoted to locked/signed stays so; a pending one stays pending.
      var keepStatus = (existing.status === "locked" || existing.status === "signed")
        ? existing.status
        : (pending ? "pending" : "locked");
      store.claims[key] = Object.assign({}, existing, {
        status: keepStatus,
        timestamp: nowIso,
        lastSavedAt: nowIso,
        currentValue: value,
        ownerName: actor.ownerName || existing.ownerName,
        ownerId: actor.ownerId !== undefined && actor.ownerId !== null ? actor.ownerId : existing.ownerId,
      });
    } else {
      // New / taken-over / released claim: only claim a meaningful value.
      if (!isNonEmpty(value)) return false;
      store.claims[key] = {
        claimKey: key,
        scope: query.scope === "row" ? "row" : "field",
        fieldId: query.fieldId,
        rowKey: query.rowKey,
        componentId: query.componentId,
        ownerName: actor.ownerName,
        ownerId: actor.ownerId,
        timestamp: nowIso,
        claimedAt: nowIso,
        lastSavedAt: nowIso,
        editableUntil: addHoursIso(nowIso, windowHours),
        status: pending ? "pending" : "locked",
        lockOn: lockOn,
        editableWindowHours: windowHours,
        currentValue: value,
      };
    }

    draft.field.data.__authorship = store;
    return true;
  }

  function policyAppliesToAction(lockOn, action) {
    lockOn = lockOn || "save";
    if (action === "save") return lockOn === "save";
    if (action === "submit") return lockOn === "save" || lockOn === "submit";
    if (action === "sign") return true; // a sign finalizes everything pending
    return false;
  }

  // Lock-on-save: promote the current actor's PENDING claims to locked/signed.
  // Pure — returns { changed, formData, nextState }; commitSave persists it.
  // Called by save components (UnsavedChangesGuard / SaveOnClose) at save time.
  function prepareSave(state, sd, action) {
    action = action || "save";
    var fieldData = state && state.field && state.field.data ? state.field.data : {};
    var nextFieldData;
    try {
      nextFieldData = JSON.parse(JSON.stringify(fieldData));
    } catch (e) {
      nextFieldData = Object.assign({}, fieldData);
    }
    var store = normalizeStore(nextFieldData.__authorship);
    var actor = actorFrom(sd, state);
    var nowIso = new Date().toISOString();
    var changed = false;

    Object.keys(store.claims).forEach(function (k) {
      var c = store.claims[k];
      if (!c || c.status !== "pending") return;
      if (!sameActor(c, actor)) return;
      if (!policyAppliesToAction(c.lockOn || "save", action)) return;
      var windowHours =
        typeof c.editableWindowHours === "number" && c.editableWindowHours > 0
          ? c.editableWindowHours
          : DEFAULT_WINDOW_HOURS;
      var nextStatus = action === "sign" || c.lockOn === "sign" ? "signed" : "locked";
      // The owner-editable window starts when the claim actually locks (now).
      store.claims[k] = Object.assign({}, c, {
        status: nextStatus,
        timestamp: nowIso,
        lastSavedAt: nowIso,
        claimedAt: nowIso,
        editableUntil: addHoursIso(nowIso, windowHours),
      });
      changed = true;
    });

    if (changed) nextFieldData.__authorship = store;
    return {
      changed: changed,
      formData: nextFieldData,
      nextState: Object.assign({}, state, {
        field: Object.assign({}, state && state.field ? state.field : { status: {}, history: [] }, { data: nextFieldData }),
      }),
    };
  }

  function commitSave(state, prepared) {
    if (!prepared || !prepared.changed) return prepared ? prepared.nextState : undefined;
    if (state && typeof state.setFormData === "function") {
      state.setFormData(prepared.nextState);
    }
    return prepared.nextState;
  }

  // Release (unlock) a claim on a produce() draft. Returns true if it changed.
  function release(draft, query) {
    if (!draft || !draft.field || !draft.field.data) return false;
    var store = normalizeStore(draft.field.data.__authorship);
    var key = buildKey(query);
    var current = store.claims[key];
    if (!current || current.status === "unlocked") return false;
    store.claims[key] = Object.assign({}, current, {
      status: "unlocked",
      releasedAt: new Date().toISOString(),
    });
    draft.field.data.__authorship = store;
    return true;
  }

  window.__nhAuth = {
    version: 1,
    buildKey: buildKey,
    lockInfo: lockInfo,
    claim: claim,
    release: release,
    actor: actorFrom,
    formatTimestamp: formatTimestamp,
    // lock-on-save
    prepareSave: prepareSave,
    commitSave: commitSave,
  };
})();
