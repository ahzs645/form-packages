import { describe, expect, it } from "vitest";
import {
  getAuthorshipLockInfo,
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
});
