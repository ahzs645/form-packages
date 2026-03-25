import { describe, expect, it } from "vitest";
import { syncAuthorshipMirrors } from "./authorship";

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
