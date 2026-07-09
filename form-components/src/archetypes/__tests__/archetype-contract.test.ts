import { describe, expect, it } from "vitest";
import { Mois } from "../index";

/**
 * Parity checks against the REAL MOIS engine (SMOIS FormTester bundle,
 * 02.31 era) plus the archetype documentation. Exported forms reference these
 * members via the fixed Mois scope object at runtime, so a missing member is
 * a crash in real MOIS, not a type error.
 *
 * Verified against the real bundle:
 * - Observation exports { ...fields, All, List, Fields }; List is a
 *   ListSelection over the observations collection.
 * - ObservationPanel exports { ...fields, All, Link, Fields }.
 * - Columns and LinksBar on Observation are documented but NOT shipped in the
 *   02.31 build — preview provides them, but forms that must run in real MOIS
 *   should prefer All / List / Fields / field components.
 */
describe("Mois archetype namespace", () => {
  it("exposes the members shipped by the real engine", () => {
    expect(typeof Mois.Observation.All).toBe("function");
    expect(typeof Mois.Observation.List).toBe("function");
    expect(typeof Mois.Observation.Fields).toBe("object");
    expect(typeof Mois.ObservationPanel.All).toBe("function");
    expect(typeof Mois.ObservationPanel.Link).toBe("function");
    expect(typeof Mois.ObservationPanel.Fields).toBe("object");
    expect(typeof Mois.Task.All).toBe("function");
    expect(typeof Mois.Task.Columns).toBe("object");
    expect(typeof Mois.Patient.Query.fullChart).toBe("string");
  });

  it("keeps the docs-listed preview extras available", () => {
    expect(typeof Mois.Observation.LinksBar).toBe("function");
    expect(typeof Mois.Observation.Columns).toBe("object");
  });

  it("matches the real engine's observation list column specs verbatim", () => {
    const columns = Mois.Observation.Columns as Record<
      string,
      { title?: string; id: string; type: string; size?: string }
    >;
    // Exactly the six real columns — no units/status/performed extras.
    expect(Object.keys(columns)).toEqual([
      "observationId",
      "collectedDateTime",
      "observationCode",
      "description",
      "value",
      "abnormalFlag",
    ]);
    expect(columns.observationId).toEqual({ id: "observationId", type: "key" });
    expect(columns.collectedDateTime).toEqual({ title: "Date", id: "collectedDateTime", type: "date", size: "small" });
    expect(columns.observationCode).toEqual({ title: "Code", id: "observationCode", type: "string", size: "tiny" });
    expect(columns.description).toEqual({ title: "Test name", id: "description", type: "string" });
    expect(columns.value).toEqual({ title: "Value", id: "value", type: "string", size: "small" });
    expect(columns.abnormalFlag).toEqual({ title: "Flag", id: "abnormalFlag", type: "rawcode" });
  });

  it("keeps documented observation field components available", () => {
    for (const field of ["description", "observationCode", "loincCode", "value", "units", "status", "comment", "performedDateTime", "abnormalFlag"]) {
      expect(typeof (Mois.Observation as Record<string, unknown>)[field], field).toBe("function");
    }
  });
});
