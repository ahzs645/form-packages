import { describe, expect, it } from "vitest";

import * as defaults from "./defaults";
import { DEFAULT_CASES, type DefaultCase } from "./defaults.cases";

export function runDefaultCase(kit: typeof defaults, testCase: DefaultCase): unknown {
  switch (testCase.fn) {
    case "read":
      return kit.readDefaultAnswer(...testCase.args);
    case "write":
      return kit.writeDefaultAnswer(...testCase.args);
    case "patch":
      return kit.defaultAnswerPatch(...testCase.args);
    case "resolve":
      return kit.resolveDefaultAnswer(...testCase.args);
    case "temporal":
      return kit.temporalKindOf(...testCase.args);
  }
}

describe("default answers", () => {
  it.each(DEFAULT_CASES.map((testCase) => [`${testCase.fn}: ${testCase.name}`, testCase] as const))("%s", (_name, testCase) => {
    expect(runDefaultCase(defaults, testCase)).toEqual(testCase.expected);
  });

  it("reads back what it writes, for every kind and shape", () => {
    const answers: defaults.BuilderDefaultAnswer[] = [
      { kind: "literal", value: "x" },
      { kind: "today" },
      { kind: "now" },
      { kind: "chart", concept: "patient.phn", paths: ["patient.phn"] },
      { kind: "lastObservation", code: "WEIGHT", system: "MOIS", lookbackDays: 14 },
    ];
    const shapes: Array<[defaults.DefaultAnswerShape, object]> = [
      ["field", { id: "a", type: "date", prefill: "2026-01-01" }],
      ["tableColumn", { id: "a", type: "date", withTime: true, prefill: { kind: "today" } }],
      ["layoutCell", { id: "a", kind: "field", fieldId: "a", inputType: "date", defaultValue: "2026-01-01" }],
      ["subformEntry", { id: "a", type: "date", defaultValue: "__today", defaultFromObservation: { observationCode: "X" } }],
    ];
    for (const [shape, fieldLike] of shapes) {
      for (const answer of answers) {
        const written = defaults.writeDefaultAnswer(fieldLike, answer, { shape });
        expect(defaults.readDefaultAnswer(written, { shape }), `${shape} ${answer.kind}`).toEqual(answer);
      }
      const cleared = defaults.writeDefaultAnswer(fieldLike, null, { shape });
      expect(defaults.readDefaultAnswer(cleared, { shape }), `${shape} cleared`).toBeNull();
    }
  });

  it("never returns the stored object itself", () => {
    const value = ["a"];
    const field = { id: "a", type: "choice", prefill: value };
    const read = defaults.readDefaultAnswer(field);
    expect(read).toEqual({ kind: "literal", value: ["a"] });
    expect((read as { value: unknown }).value).not.toBe(value);
    expect(defaults.resolveDefaultAnswer(read, { now: new Date() })).not.toBe((read as { value: unknown }).value);
  });

  it("does not modify the object it writes to", () => {
    const field = { id: "d", type: "date", prefill: "2026-01-01", dateConfig: { dateFormat: "yyyy-MM-dd" as const } };
    const snapshot = JSON.parse(JSON.stringify(field));
    defaults.writeDefaultAnswer(field, { kind: "today" });
    expect(field).toEqual(snapshot);
  });
});
