import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as Babel from "@babel/standalone";
import React from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Pin a zone west of UTC so a UTC-midnight parse of "yyyy-MM-dd" (the evening
// before, locally) would be observable on any machine.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Vancouver";
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "PatientValueField", "index.jsx"), "utf8");
const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
const { computeAgeYears } = new Function("React", "Fluent", `${compiled};\nreturn { computeAgeYears };`)(React, {}) as {
  computeAgeYears: (birthValue: unknown, reference?: Date) => string;
};

describe("PatientValueField computeAgeYears", () => {
  it("does not tick over the evening before the birthday west of UTC", () => {
    const dayBeforeEvening = new Date(2026, 5, 22, 20, 0); // Jun 22 20:00 local = Jun 23 03:00Z
    expect(dayBeforeEvening.getTimezoneOffset()).toBeGreaterThan(0);
    expect(computeAgeYears("1960-06-23", dayBeforeEvening)).toBe("65");
    expect(computeAgeYears("1960-06-23", new Date(2026, 5, 23, 0, 5))).toBe("66");
  });

  it("treats a date-only birth date as a local calendar day in each accepted form", () => {
    const reference = new Date(2026, 5, 23, 9, 0);
    expect(computeAgeYears("2026-06-23", reference)).toBe("0"); // born today
    expect(computeAgeYears("2026-06-24", reference)).toBe(""); // not born yet
    expect(computeAgeYears("1960.06.24", reference)).toBe("65");
    expect(computeAgeYears("1960/06/23", reference)).toBe("66");
    expect(computeAgeYears({ value: "1960-06-23" }, reference)).toBe("66");
    expect(computeAgeYears("1960-02-30", reference)).toBe(""); // impossible date
  });

  it("still parses date-times and rejects missing or unparseable input", () => {
    const reference = new Date(2026, 5, 23, 9, 0);
    expect(computeAgeYears("1960-06-23T08:00:00", reference)).toBe("66");
    expect(computeAgeYears("", reference)).toBe("");
    expect(computeAgeYears("not-a-date", reference)).toBe("");
  });
});
