import { describe, expect, it } from "vitest";

import { getOptionLabel, getOptionLabels, getOptionScore, getOptionValue } from "./choice-options";
import type { BuilderChoiceOption } from "./index";
import { NORMALIZE_OPTION_CASES } from "./values.cases";
import { normalizeOption } from "./values";

// Stored options come in every shape normalizeOption reads; the builder helpers
// take the union type, so the tests pass them through it.
const asOption = (value: unknown) => value as BuilderChoiceOption;

describe("getOptionValue and getOptionLabel read options the way normalizeOption does", () => {
  it.each(NORMALIZE_OPTION_CASES.map((entry) => [entry.name, entry.args[0]] as const))("%s", (_name, raw) => {
    const normalized = normalizeOption(raw);
    expect(getOptionValue(asOption(raw))).toBe(normalized.code);
    expect(getOptionLabel(asOption(raw))).toBe(normalized.display);
  });

  it("reads coded option shapes the older helpers returned blank for", () => {
    expect(getOptionValue(asOption({ code: "Y", display: "Yes" }))).toBe("Y");
    expect(getOptionLabel(asOption({ code: "Y", display: "Yes" }))).toBe("Yes");
    expect(getOptionValue(asOption({ key: "routine", text: "Routine" }))).toBe("routine");
    expect(getOptionLabel(asOption({ key: "routine", text: "Routine" }))).toBe("Routine");
  });

  it("treats a blank value as missing and falls back to the label", () => {
    expect(getOptionValue({ label: "Other", value: "" })).toBe("Other");
    expect(getOptionLabel(asOption({ display: "", code: "other" }))).toBe("other");
  });

  it("keeps a builder label cleared in an editor blank (the one difference from normalizeOption)", () => {
    expect(getOptionLabel({ label: "", value: "a" })).toBe("");
    expect(getOptionLabel({ label: "  ", value: "a" })).toBe("");
    expect(normalizeOption({ label: "", value: "a" }).display).toBe("a");
    expect(getOptionValue({ label: "", value: "a" })).toBe("a");
  });

  it("returns text for a numeric stored value and keeps a scale key as the code", () => {
    expect(getOptionValue(asOption(0))).toBe("0");
    expect(getOptionValue(asOption({ value: 0, label: "Unknown", key: "9" }))).toBe("9");
  });

  it("still repairs imported labels", () => {
    expect(getOptionLabel("hortness of breath")).toBe("Shortness of breath");
    expect(getOptionLabel({ label: "☐ Shortness of breath", value: "sob" })).toBe("Shortness of breath");
    expect(getOptionLabels(["A", { label: " ", value: "" }, { label: "B", value: "b" }])).toEqual(["A", "B"]);
  });

  it("leaves scores to getOptionScore (explicit scores only)", () => {
    expect(getOptionScore(asOption({ value: 2, label: "Moderate" }))).toBeUndefined();
    expect(getOptionScore({ label: "Moderate", score: 2 })).toBe(2);
  });
});
