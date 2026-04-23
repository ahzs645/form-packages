import { describe, expect, it } from "vitest";
import { buildScope } from "./build-scope";

describe("buildScope", () => {
  it("exposes core MOIS controls used by the developer component harness", () => {
    const scope = buildScope();

    expect(typeof scope.MoisDialog).toBe("function");
    expect(typeof scope.MoisDropdown).toBe("function");
    expect(typeof scope.MoisTextField).toBe("function");
    expect(scope.Identity.type).toBe("ATTACHMENT");
  });

  it("exposes NHForms helper modules under their Identity names", () => {
    const scope = buildScope();

    expect(typeof scope.CommonSchemaDefn?.All).toBe("function");
    expect(typeof scope.FormSessionRuntime?.All).toBe("function");
    expect(typeof scope.UseChangeWatch?.All).toBe("function");
    expect(scope.CommonSchemaDefn?.commonSchemaDefn).toBeTruthy();
    expect(typeof scope.FormSessionRuntime?.FormSessionProvider).toBe("function");
    expect(typeof scope.UseChangeWatch?.useChangeWatch).toBe("function");
    expect(typeof scope.MoisFunction?.Ajv).toBe("function");
    expect(typeof scope.MoisFunction?.showValidationErrors).toBe("function");
  });

  it("mutates preview lifecycle state using Shimmed save and sign semantics", () => {
    const scope = buildScope();
    const sourceData: any = {
      lifecycleState: { isLoading: true, isMutating: true, isPrinting: false },
      webform: { webformId: 11, documentId: 22, isDraft: "Y", recordState: "UNSIGNED" },
      formParams: { patientId: 33 },
    };
    const activeDraft: any = { field: { data: {}, status: {}, history: [] }, tempArea: {} };
    const formData = {
      setFormData: (updater: (draft: any) => void) => updater(activeDraft),
    };

    expect(scope.saveDraft(sourceData, formData, { formData: { score: 4 } })).toBe(true);
    expect(sourceData.webform).toMatchObject({ isDraft: "Y", recordState: "UNSIGNED" });
    expect(activeDraft.field.data).toMatchObject({ score: 4 });
    expect(activeDraft.tempArea.__moisRuntime.lastAction.action).toBe("saveDraft");

    expect(scope.signSubmit(sourceData, formData, { formData: { score: 5 } })).toBe(true);
    expect(sourceData.webform).toMatchObject({ isDraft: "N", recordState: "SIGNED", isLockedToUser: "Y" });
    expect(activeDraft.field.data).toMatchObject({ score: 5 });
    expect(activeDraft.tempArea.__moisRuntime.lastAction.action).toBe("signSubmit");

    expect(scope.unsign("needs revision", sourceData, formData)).toBe(true);
    expect(sourceData.webform).toMatchObject({ isDraft: "N", recordState: "UNSIGNED", isLockedToUser: "N" });
    expect(activeDraft.uiState.sections[0].isComplete).toBe(false);
    expect(activeDraft.tempArea.__moisRuntime.lastAction.action).toBe("unsign");
  });
});
