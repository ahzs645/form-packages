import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";

import * as values from "@/packages/form-model/src/values";
import { VALUE_CASES, type ValueCase } from "@/packages/form-model/src/values.cases";
// @ts-expect-error -- plain .mjs build script, no type declarations
import { renderValueKitSource as renderValueKitSourceUntyped } from "@/scripts/generate-value-kit.mjs";

const renderValueKitSource = renderValueKitSourceUntyped as () => Promise<{ source: string; exportedNames: string[] }>;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kitSource = fs.readFileSync(path.join(NH, "ValueKit", "index.jsx"), "utf8");

type Kit = typeof values;

// Same bare-global contract the injected NHForms runtime uses.
function loadValueKit(): Kit {
  const compiled = Babel.transform(kitSource, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`${compiled};\nreturn ValueKit;`)() as Kit;
}

function run(kit: Kit, testCase: ValueCase): unknown {
  switch (testCase.fn) {
    case "normalizeOption":
      return kit.normalizeOption(testCase.args[0]);
    case "readBoolean":
      return kit.readBoolean(testCase.args[0], testCase.args[1] as Parameters<Kit["readBoolean"]>[1]);
    case "readChoice":
      return kit.readChoice(testCase.args[0], testCase.args[1] as Parameters<Kit["readChoice"]>[1]);
    case "readDate":
      return kit.readDate(testCase.args[0]);
  }
}

const ValueKit = loadValueKit();

describe("ValueKit parity with form-model values.ts", () => {
  it("exports the same helpers", () => {
    expect(Object.keys(ValueKit).sort()).toEqual(Object.keys(values).sort());
  });

  it.each(VALUE_CASES.map((testCase) => [`${testCase.fn}: ${testCase.name}`, testCase] as const))("%s", (_name, testCase) => {
    const kitResult = run(ValueKit, testCase);
    expect(kitResult).toEqual(run(values, testCase));
    expect(kitResult).toEqual(testCase.expected);
  });

  it("is generated from the current values.ts", async () => {
    const { source } = await renderValueKitSource();
    expect(kitSource, "run `pnpm generate:nhforms` after editing values.ts").toBe(source);
  });
});
