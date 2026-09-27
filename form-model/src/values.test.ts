import { describe, expect, it } from "vitest";

import { normalizeOption, readBoolean, readChoice, readDate } from "./values";
import { VALUE_CASES, type ValueCase } from "./values.cases";

function run(testCase: ValueCase): unknown {
  switch (testCase.fn) {
    case "normalizeOption":
      return normalizeOption(testCase.args[0]);
    case "readBoolean":
      return readBoolean(testCase.args[0], testCase.args[1] as Parameters<typeof readBoolean>[1]);
    case "readChoice":
      return readChoice(testCase.args[0], testCase.args[1] as Parameters<typeof readChoice>[1]);
    case "readDate":
      return readDate(testCase.args[0]);
  }
}

describe("values", () => {
  it.each(VALUE_CASES.map((testCase) => [`${testCase.fn}: ${testCase.name}`, testCase] as const))("%s", (_name, testCase) => {
    expect(run(testCase)).toEqual(testCase.expected);
  });

  it("returns a copy of a Date, never the caller's instance", () => {
    const source = new Date(2026, 0, 15);
    const read = readDate(source);
    expect(read).toEqual(source);
    expect(read).not.toBe(source);
  });

  it("reads a date-only string as the same local calendar day", () => {
    const date = readDate("2026-03-08");
    expect([date?.getFullYear(), date?.getMonth(), date?.getDate(), date?.getHours()]).toEqual([2026, 2, 8, 0]);
  });

  it("gives every option a code that round-trips through readChoice", () => {
    const options = VALUE_CASES.filter((testCase) => testCase.fn === "normalizeOption").map((testCase) => testCase.args[0]);
    for (const option of options) {
      const normalized = normalizeOption(option);
      if (!normalized.code) continue;
      expect(readChoice(normalized.code, [option])[0]?.code).toBe(normalized.code);
    }
  });
});
