import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";

import * as defaults from "@/packages/form-model/src/defaults";
import { DEFAULT_CASES, type DefaultCase } from "@/packages/form-model/src/defaults.cases";
// @ts-expect-error -- plain .mjs build script, no type declarations
import { renderDefaultsKitSource as renderDefaultsKitSourceUntyped } from "@/scripts/generate-defaults-kit.mjs";

const renderDefaultsKitSource = renderDefaultsKitSourceUntyped as () => Promise<{ source: string; exportedNames: string[] }>;

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kitSource = fs.readFileSync(path.join(NH, "DefaultsKit", "index.jsx"), "utf8");

type Kit = typeof defaults;

// Same bare-global contract the injected NHForms runtime uses.
function loadDefaultsKit(): Kit {
  const compiled = Babel.transform(kitSource, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`${compiled};\nreturn DefaultsKit;`)() as Kit;
}

function run(kit: Kit, testCase: DefaultCase): unknown {
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

const DefaultsKit = loadDefaultsKit();

describe("DefaultsKit parity with form-model defaults.ts", () => {
  it("exports the same helpers", () => {
    expect(Object.keys(DefaultsKit).sort()).toEqual(Object.keys(defaults).sort());
  });

  it.each(DEFAULT_CASES.map((testCase) => [`${testCase.fn}: ${testCase.name}`, testCase] as const))("%s", (_name, testCase) => {
    const kitResult = run(DefaultsKit, testCase);
    expect(kitResult).toEqual(run(defaults, testCase));
    expect(kitResult).toEqual(testCase.expected);
  });

  it("is generated from the current defaults.ts", async () => {
    const { source } = await renderDefaultsKitSource();
    expect(kitSource, "run `pnpm generate:nhforms` after editing defaults.ts").toBe(source);
  });
});
