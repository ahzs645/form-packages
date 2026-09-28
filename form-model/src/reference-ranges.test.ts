import { describe, expect, it } from "vitest";
import {
  describeReferenceRange,
  interpretReferenceRange,
  readReferenceRanges,
  selectReferenceRange,
  type ReferenceRangeBand,
} from "./reference-ranges";

describe("reference ranges", () => {
  it("reads the field's own ranges first, dropping bands with no limits", () => {
    const reading = readReferenceRanges({
      referenceRanges: [{ normal: { low: 60, high: 100 }, unit: "bpm" }, { unit: "bpm" } as ReferenceRangeBand],
      moisOutput: { enabled: true, kind: "observation", observationCode: "1", rangeNormalLow: "1" } as never,
    });
    expect(reading).toEqual({ source: "field", bands: [{ unit: "bpm", normal: { low: 60, high: 100 } }] });
  });

  it("reads a Cerner DTA's range table: the all-patient range, then the bands by sex and age", () => {
    const reading = readReferenceRanges({
      cernerConfig: {
        dta: {
          mnemonic: "Heart Rate",
          definition: {
            range: { units: "bpm", normalLow: 60, normalHigh: 100, criticalLow: 40, criticalHigh: 150, feasibleLow: 1, feasibleHigh: 300 },
            bands: [{ sex: "FEMALE", ageFrom: 0, ageFromUnits: "DAYS", ageTo: 28, ageToUnits: "DAYS", normalLow: 100, normalHigh: 180 }],
          },
        },
      } as never,
    });
    expect(reading.source).toBe("cerner-dta");
    expect(reading.bands).toEqual([
      { unit: "bpm", normal: { low: 60, high: 100 }, critical: { low: 40, high: 150 }, feasible: { low: 1, high: 300 } },
      { sex: "female", ageTo: { value: 28, unit: "days" }, normal: { low: 100, high: 180 } },
    ]);
  });

  it("reads a MOIS observation output's normal and absurd ranges", () => {
    expect(readReferenceRanges({ moisOutput: { enabled: true, kind: "observation", observationCode: "25", units: "kg", rangeNormalLow: "40", rangeAbsurdHigh: "400" } as never })).toEqual({
      source: "mois-output",
      bands: [{ unit: "kg", normal: { low: 40 }, feasible: { high: 400 } }],
    });
  });

  it("chooses the most specific band that applies, and says when the patient lacks what a band needs", () => {
    const bands: ReferenceRangeBand[] = [
      { normal: { low: 60, high: 100 } },
      { ageTo: { value: 28, unit: "days" }, normal: { low: 100, high: 180 } },
      { sex: "female", ageFrom: { value: 18, unit: "years" }, normal: { low: 65, high: 105 } },
    ];
    const newborn = { birthDate: "2026-09-20", asOf: "2026-09-27" };
    expect(selectReferenceRange(bands, newborn).band?.normal).toEqual({ low: 100, high: 180 });
    expect(selectReferenceRange(bands, { sex: "F", birthDate: "1980-01-01", asOf: "2026-09-27" }).band?.normal).toEqual({ low: 65, high: 105 });
    expect(selectReferenceRange(bands, { sex: "M", birthDate: "1980-01-01", asOf: "2026-09-27" }).band?.normal).toEqual({ low: 60, high: 100 });
    // With no all-patient band and no birth date, the answer depends on the patient.
    expect(selectReferenceRange(bands.slice(1), {}).status).toBe("needs-patient");
    expect(selectReferenceRange([], {}).status).toBe("none");
  });

  it("flags normal and critical results and questions an impossible value without refusing it", () => {
    const band: ReferenceRangeBand = { unit: "bpm", normal: { low: 60, high: 100 }, critical: { low: 40, high: 150 }, feasible: { low: 1, high: 300 } };
    expect(interpretReferenceRange(80, band)).toEqual({ flag: "normal", infeasible: null, nonlinear: null });
    expect(interpretReferenceRange(110, band).flag).toBe("high");
    expect(interpretReferenceRange(35, band).flag).toBe("critical-low");
    expect(interpretReferenceRange(900, band)).toEqual({ flag: "critical-high", infeasible: "above", nonlinear: null });
    expect(describeReferenceRange(110, band)).toBe("110 bpm is above normal (100 bpm).");
    expect(describeReferenceRange(900, band)).toBe("900 bpm is above the possible range (at most 300 bpm). Check the value.");
    expect(describeReferenceRange(80, band)).toBeNull();
  });

  it("reads a lab DTA's linear range as analytical limits and its service resource as a context", () => {
    const reading = readReferenceRanges({
      cernerConfig: {
        dta: {
          mnemonic: "Sodium Lvl",
          definition: {
            range: { units: "mmol/L", normalLow: 135, normalHigh: 145, linearLow: 100, linearHigh: 200 },
            bands: [{ ageFrom: 0, ageFromUnits: "YEARS", ageTo: 150, ageToUnits: "YEARS", normalLow: 133, normalHigh: 146, serviceResource: "Chem Analyzer 2" }],
          },
        },
      } as never,
    });
    expect(reading.bands).toEqual([
      { unit: "mmol/L", normal: { low: 135, high: 145 }, analytical: { low: 100, high: 200 } },
      { normal: { low: 133, high: 146 }, context: { performer: "Chem Analyzer 2" } },
    ]);
    // Nonlinear is its own finding, apart from the normal flag.
    expect(interpretReferenceRange(210, reading.bands[0])).toEqual({ flag: "high", infeasible: null, nonlinear: "above" });
  });

  it("applies a band with a context only where the caller states a matching one", () => {
    const performed: ReferenceRangeBand = { context: { performer: "Chem Analyzer 2" }, normal: { low: 133, high: 146 } };
    const general: ReferenceRangeBand = { normal: { low: 135, high: 145 } };
    // The context band is not a band for everyone.
    expect(selectReferenceRange([performed, general], {}).band).toBe(general);
    expect(selectReferenceRange([performed, general], { context: { performer: "chem analyzer 2" } }).band).toBe(performed);
    expect(selectReferenceRange([performed, general], { context: { performer: "Chem Analyzer 1" } }).band).toBe(general);
    expect(selectReferenceRange([performed], {}).status).toBe("needs-context");
    expect(selectReferenceRange([{ ...performed, sex: "female" }], { context: { performer: "Chem Analyzer 2" } }).status).toBe("needs-patient");
  });
});
