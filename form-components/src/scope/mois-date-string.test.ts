import { describe, expect, it } from "vitest";
import { moisGetDateString } from "./mois-date-string";

// The engine's getDateString (SMOIS main.a75cc6b1.chunk.js, module 27): the
// local calendar date, joined with the separator (default ".").
describe("moisGetDateString", () => {
  it("formats the local calendar date with the engine's default separator", () => {
    expect(moisGetDateString(new Date(2026, 9, 12, 23, 30))).toBe("2026.10.12");
  });

  it("uses the local date late in the evening, not the UTC date", () => {
    const evening = new Date(2026, 9, 12, 23, 59);
    expect(moisGetDateString(evening, "-")).toBe("2026-10-12");
  });

  it("pads month and day and reads year-month-day strings on the local calendar", () => {
    expect(moisGetDateString("2026-3-5", "-")).toBe("2026-03-05");
    expect(moisGetDateString("2026.11.18", "/")).toBe("2026/11/18");
  });

  it("returns an empty string for no date", () => {
    expect(moisGetDateString(null)).toBe("");
    expect(moisGetDateString("")).toBe("");
  });
});
