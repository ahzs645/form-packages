import { describe, expect, it } from "vitest";
import {
  FORM_CONCEPTS,
  TARGET_IDS,
  enabledExportTargets,
  exportTargetRole,
  formLogicOf,
  isTargetId,
  lossSeverityFor,
  normalizeExportTargetsSetting,
  resolveExportTargets,
  type ConversionLoss,
  type ExportTargetsSetting,
} from "./targets";

const loss = (overrides: Partial<ConversionLoss>): ConversionLoss => ({
  target: "alayacare",
  concept: "condition",
  level: "dropped",
  code: "alayacare.example",
  detail: "Left out.",
  severity: "meaning",
  ...overrides,
});

describe("target vocabulary", () => {
  it('passes the current named-condition library to every converter', () => {
    const conditions = [{ id: 'current-rule', name: 'Current rule', group: { match: 'all' as const, conditions: [] } }];
    expect(formLogicOf({ document: { branchingRules: {}, conditions } }).conditions).toBe(conditions);
    expect(formLogicOf({ document: { branchingRules: {} } })).not.toHaveProperty('conditions');
  });
  it("lists every target and concept once", () => {
    expect(new Set(TARGET_IDS).size).toBe(TARGET_IDS.length);
    expect(new Set(FORM_CONCEPTS).size).toBe(FORM_CONCEPTS.length);
    expect(TARGET_IDS).toContain("documents");
    expect(isTargetId("mois")).toBe(true);
    expect(isTargetId("epic")).toBe(false);
    expect(isTargetId(undefined)).toBe(false);
  });
});

describe("lossSeverityFor", () => {
  const setting: ExportTargetsSetting = { primary: "mois", secondary: ["alayacare"] };

  it("blocks a meaning loss on the primary target and warns elsewhere", () => {
    expect(lossSeverityFor(loss({ target: "mois" }), setting)).toBe("block");
    expect(lossSeverityFor(loss({ target: "alayacare" }), setting)).toBe("warn");
    // A target the form does not list still warns rather than blocks.
    expect(lossSeverityFor(loss({ target: "fhir" }), setting)).toBe("warn");
  });

  it("treats presentation losses as information on every target", () => {
    for (const target of TARGET_IDS) {
      expect(lossSeverityFor(loss({ target, severity: "presentation" }), { primary: target })).toBe("info");
    }
  });
});

describe("export targets setting", () => {
  it("cleans a saved setting", () => {
    expect(normalizeExportTargetsSetting(undefined)).toBeNull();
    expect(normalizeExportTargetsSetting({ primary: "epic" })).toBeNull();
    expect(normalizeExportTargetsSetting([])).toBeNull();
    expect(normalizeExportTargetsSetting({ primary: "cerner" })).toEqual({ primary: "cerner" });
    expect(
      normalizeExportTargetsSetting({ primary: "cerner", secondary: ["fhir", "cerner", "epic", "mois", "fhir"] })
    ).toEqual({ primary: "cerner", secondary: ["mois", "fhir"] });
    expect(normalizeExportTargetsSetting({ primary: "fhir", secondary: "mois" })).toEqual({ primary: "fhir" });
  });

  it("falls back to the current export mode, then MOIS", () => {
    expect(resolveExportTargets(undefined)).toEqual({ primary: "mois" });
    expect(resolveExportTargets({ exportTargets: null }, "alayacare")).toEqual({ primary: "alayacare" });
    expect(resolveExportTargets({}, "not-a-target")).toEqual({ primary: "mois" });
    expect(resolveExportTargets({ exportTargets: { primary: "fhir", secondary: ["mois"] } }, "alayacare")).toEqual({
      primary: "fhir",
      secondary: ["mois"],
    });
  });

  it("lists enabled targets primary first and names each target's role", () => {
    const setting: ExportTargetsSetting = { primary: "fhir", secondary: ["mois", "documents"] };
    expect(enabledExportTargets(setting)).toEqual(["fhir", "mois", "documents"]);
    expect(exportTargetRole("fhir", setting)).toBe("primary");
    expect(exportTargetRole("documents", setting)).toBe("secondary");
    expect(exportTargetRole("cerner", setting)).toBeNull();
  });

  it("survives a JSON round trip unchanged", () => {
    const setting: ExportTargetsSetting = { primary: "alayacare", secondary: ["mois"] };
    expect(normalizeExportTargetsSetting(JSON.parse(JSON.stringify(setting)))).toEqual(setting);
  });
});
