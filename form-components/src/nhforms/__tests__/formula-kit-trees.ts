/**
 * Test support for the containers that evaluate formula trees through
 * FormulaKit (EditableTable, RepeatForEachTable, LayoutTable, SubformScoring,
 * ScoringModule).
 *
 * `loadFormulaKit()` evaluates the real FormulaKit source (generated from
 * packages/form-model/src/formula/kit.ts). `withTreeSupport` guarantees the
 * tree API (`evaluateTree`, `parse`, `hasAllReferencedValues` over a tree),
 * taking it from kit.ts itself when a kit predates it; `withoutTreeSupport`
 * removes it, for the containers' legacy text path.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";

import * as referenceKit from "@/packages/form-model/src/formula/kit";

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const readNhformsSource = (name: string) => fs.readFileSync(path.join(NH, name, "index.jsx"), "utf8");

export type FormulaKitLike = Record<string, unknown>;

/** The real FormulaKit, as the runtime loads it (one bare global). */
export function loadFormulaKit(): FormulaKitLike {
  const compiled = Babel.transform(readNhformsSource("FormulaKit"), { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function("React", `${compiled};\nreturn FormulaKit;`)({}) as FormulaKitLike;
}

/** The kit with tree support: its own when it has it, else kit.ts's. */
export function withTreeSupport(kit: FormulaKitLike = loadFormulaKit()): FormulaKitLike {
  if (typeof kit.evaluateTree === "function" && typeof kit.parse === "function") return kit;
  return {
    ...kit,
    evaluateTree: referenceKit.evaluateTree,
    parse: referenceKit.parse,
    hasAllReferencedValues: referenceKit.hasAllReferencedValues,
  };
}

/** The kit as it was before trees: `evaluate` and `hasAllReferencedValues` on text only. */
export function withoutTreeSupport(kit: FormulaKitLike = loadFormulaKit()): FormulaKitLike {
  const { evaluateTree: _evaluateTree, parse: _parse, ...rest } = kit;
  return rest;
}

/** Wrap a kit so every evaluateTree and parse call is recorded. */
export function recordingKit(kit: FormulaKitLike): FormulaKitLike & { calls: { evaluateTree: unknown[][]; parse: unknown[][] } } {
  const calls = { evaluateTree: [] as unknown[][], parse: [] as unknown[][] };
  return {
    ...kit,
    calls,
    evaluateTree: (...args: unknown[]) => {
      calls.evaluateTree.push(args);
      return (kit.evaluateTree as (...inner: unknown[]) => unknown)(...args);
    },
    parse: (...args: unknown[]) => {
      calls.parse.push(args);
      return (kit.parse as (...inner: unknown[]) => unknown)(...args);
    },
  };
}
