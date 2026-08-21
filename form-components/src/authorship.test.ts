import { describe, expect, it } from "vitest";
import {
  getAuthorshipLockInfo,
  hasMeaningfulAuthorshipChange,
  prepareAuthorshipPersist,
  syncAuthorshipMirrors,
} from "./authorship";

describe("syncAuthorshipMirrors", () => {
  it("returns mirrored data without mutating frozen state", () => {
    const authorship = Object.freeze({ version: 1 as const, claims: Object.freeze({}) });
    const frozenState = Object.freeze({
      field: Object.freeze({
        data: Object.freeze({
          fieldOnly: "field",
          __authorship: authorship,
        }),
        status: Object.freeze({ dirty: false }),
        history: Object.freeze([]),
      }),
      formData: Object.freeze({
        formOnly: "form",
        __authorship: authorship,
      }),
      uiState: Object.freeze({ sections: Object.freeze({}) }),
    });

    const nextState = syncAuthorshipMirrors(frozenState);

    expect(nextState).not.toBe(frozenState);
    expect(nextState.field.data).toEqual({
      fieldOnly: "field",
      __authorship: { version: 1, claims: {} },
    });
    expect(nextState.formData).toEqual({
      formOnly: "form",
      fieldOnly: "field",
      __authorship: { version: 1, claims: {} },
    });
    expect(nextState.field.data).not.toBe(frozenState.field.data);
    expect(nextState.formData).not.toBe(frozenState.formData);
  });
});

describe("multi-author editable windows", () => {
  const sourceData = {
    sourceFormData: {},
    userProfile: {
      userProfileId: 1,
      identity: { fullName: "NURSE MORGAN" },
    },
  };

  const activeData = {
    field: {
      data: {
        clinicalNote: "Initial note",
      },
      status: {},
      history: [],
    },
    formData: {
      clinicalNote: "Initial note",
    },
    uiState: {
      sections: {},
      __authorshipTargets: {
        version: 1,
        fields: {
          clinicalNote: {
            fieldId: "clinicalNote",
            policy: {
              enabled: true,
              granularity: "field",
              lockOn: "save",
              editableWindowHours: 72,
            },
          },
        },
        rows: {},
      },
    },
  };

  it("lets the claiming user edit before expiry but locks the field to other users", () => {
    const prepared = prepareAuthorshipPersist(sourceData, activeData, "save", {
      now: "2026-06-01T10:00:00.000Z",
    });

    expect(prepared.changed).toBe(true);
    const ownerInfo = getAuthorshipLockInfo(
      prepared.nextState,
      { scope: "field", fieldId: "clinicalNote" },
      { ownerName: "NURSE MORGAN", ownerId: 1, now: "2026-06-02T10:00:00.000Z" }
    );
    expect(ownerInfo.locked).toBe(false);

    const otherUserInfo = getAuthorshipLockInfo(
      prepared.nextState,
      { scope: "field", fieldId: "clinicalNote" },
      { ownerName: "DR. PREVIEW USER", ownerId: 2, now: "2026-06-02T10:00:00.000Z" }
    );
    expect(otherUserInfo.locked).toBe(true);
    expect(otherUserInfo.note).toContain("Locked by NURSE MORGAN");
  });

  it("expires only the claimed field after the editable window", () => {
    const prepared = prepareAuthorshipPersist(sourceData, activeData, "save", {
      now: "2026-06-01T10:00:00.000Z",
    });

    const expiredInfo = getAuthorshipLockInfo(
      prepared.nextState,
      { scope: "field", fieldId: "clinicalNote" },
      { ownerName: "NURSE MORGAN", ownerId: 1, now: "2026-06-05T10:00:00.000Z" }
    );
    expect(expiredInfo.locked).toBe(true);
    expect(expiredInfo.expired).toBe(true);

    const unclaimedFieldInfo = getAuthorshipLockInfo(
      prepared.nextState,
      { scope: "field", fieldId: "sharedNote" },
      { ownerName: "DR. PREVIEW USER", ownerId: 2, now: "2026-06-05T10:00:00.000Z" }
    );
    expect(unclaimedFieldInfo.locked).toBe(false);
  });

  it("uses the active session identity instead of a persisted createdBy label", () => {
    const prepared = prepareAuthorshipPersist(
      {
        sourceFormData: {},
        userProfile: { userProfileId: 9, identity: { fullName: "CURRENT CLINICIAN" } },
      },
      {
        ...activeData,
        field: { ...activeData.field, data: { ...activeData.field.data, createdBy: "ORIGINAL AUTHOR" } },
      },
      "save",
      { now: "2026-06-01T10:00:00.000Z" }
    );

    expect(prepared.store.claims["field:clinicalNote"].ownerName).toBe("CURRENT CLINICIAN");
    expect(prepared.store.claims["field:clinicalNote"].ownerId).toBe(9);
  });

  it("records clearing an existing authored value as a meaningful change", () => {
    const prepared = prepareAuthorshipPersist(
      {
        sourceFormData: { clinicalNote: "Saved value" },
        userProfile: { userProfileId: 1, identity: { fullName: "NURSE MORGAN" } },
      },
      {
        ...activeData,
        field: { ...activeData.field, data: { clinicalNote: "" } },
        formData: { clinicalNote: "" },
      },
      "save",
      { now: "2026-06-01T10:00:00.000Z" }
    );

    expect(prepared.changed).toBe(true);
    expect(prepared.store.claims["field:clinicalNote"].currentValue).toBe("");
    expect(prepared.store.claims["field:clinicalNote"].sourceValue).toBe("Saved value");
  });

  it("ignores structural changes whose nested values are all empty", () => {
    expect(hasMeaningfulAuthorshipChange({}, { text: "", number: "" })).toBe(false);
    expect(hasMeaningfulAuthorshipChange([], [{ text: "" }])).toBe(false);
    expect(hasMeaningfulAuthorshipChange({}, { text: "Saved value" })).toBe(true);
  });

  it("preserves independent row ownership across reloads and user swaps", () => {
    const rowPolicy = {
      enabled: true,
      granularity: "row" as const,
      lockOn: "save" as const,
      editableWindowHours: 72,
    };
    const firstState = {
      field: { data: { rows: { row_a: { note: "A row" } } }, status: {}, history: [] },
      formData: { rows: { row_a: { note: "A row" } } },
      uiState: {
        sections: {},
        __authorshipTargets: {
          version: 1 as const,
          fields: {},
          rows: {
            clinicalRows: { componentId: "clinicalRows", fieldId: "rows", rowIds: ["row_a"], policy: rowPolicy },
          },
        },
      },
    };
    const firstSave = prepareAuthorshipPersist(
      { sourceFormData: {}, userProfile: { userProfileId: 1, identity: { fullName: "USER A" } } },
      firstState,
      "save",
      { now: "2026-06-01T10:00:00.000Z" }
    );

    const savedSourceForB = JSON.parse(JSON.stringify(firstSave.formData));
    const reloadedForB = firstSave.nextState;
    reloadedForB.field.data.rows.row_b = { note: "B row" };
    reloadedForB.formData.rows.row_b = { note: "B row" };
    reloadedForB.uiState.__authorshipTargets.rows.clinicalRows.rowIds.push("row_b");
    const secondSave = prepareAuthorshipPersist(
      {
        sourceFormData: savedSourceForB,
        userProfile: { userProfileId: 2, identity: { fullName: "USER B" } },
      },
      reloadedForB,
      "save",
      { now: "2026-06-01T11:00:00.000Z" }
    );

    const claims = secondSave.store.claims;
    expect(claims["row:clinicalRows:row_a"]).toMatchObject({ ownerId: 1, ownerName: "USER A" });
    expect(claims["row:clinicalRows:row_b"]).toMatchObject({ ownerId: 2, ownerName: "USER B" });
    expect(
      getAuthorshipLockInfo(
        secondSave.nextState,
        { scope: "row", componentId: "clinicalRows", rowKey: "row_a" },
        { ownerId: 2, ownerName: "USER B", now: "2026-06-01T12:00:00.000Z" }
      ).locked
    ).toBe(true);
    expect(
      getAuthorshipLockInfo(
        secondSave.nextState,
        { scope: "row", componentId: "clinicalRows", rowKey: "row_b" },
        { ownerId: 2, ownerName: "USER B", now: "2026-06-01T12:00:00.000Z" }
      ).locked
    ).toBe(false);
  });

  it("keeps submit ownership separate from explicit signing", () => {
    const saved = prepareAuthorshipPersist(sourceData, activeData, "save", {
      now: "2026-06-01T10:00:00.000Z",
    });
    const submitted = prepareAuthorshipPersist(
      { ...sourceData, sourceFormData: saved.formData },
      saved.nextState,
      "submit",
      { now: "2026-06-01T11:00:00.000Z" }
    );
    const signed = prepareAuthorshipPersist(
      { ...sourceData, sourceFormData: submitted.formData },
      submitted.nextState,
      "sign",
      { now: "2026-06-01T12:00:00.000Z" }
    );

    expect(submitted.store.claims["field:clinicalNote"].status).toBe("locked");
    expect(signed.store.claims["field:clinicalNote"].status).toBe("signed");
  });
});
