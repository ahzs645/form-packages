/**
 * Reading and writing a formula store (contract F1 of the neutral form model).
 *
 * Every store keeps its formula text and may keep a `formulaTree`. The tree is
 * the source of truth and the text is its mirror, printed with `printFormula`.
 * Writers that do not know the tree yet (importers, older editors, text
 * rewrites such as score back-fill) change only the text, so a reader trusts
 * the tree only while the stored text is still its printed form; otherwise the
 * text is newer and is parsed again with the form's context.
 */

import { isStoredFormula, type FormulaDiagnostic, type StoredFormula } from "./ast";
import { parseFormula, type ParseFormulaOptions } from "./parse";
import { printFormula } from "./print";

export interface FormulaStoreText {
  /** The stored formula text (`expression`, `formula`, …). */
  text?: string | null;
  /** The stored tree (`formulaTree`), when the store has one. */
  tree?: unknown;
}

export interface FormulaStoreReading {
  formula: StoredFormula | null;
  /** `tree`: the stored tree; `text`: the text parsed now; `none`: no formula. */
  source: "tree" | "text" | "none";
  errors: FormulaDiagnostic[];
  warnings: FormulaDiagnostic[];
}

/**
 * The formula a store holds: the stored tree when its printed text matches
 * the stored text (or there is no text), else the text parsed with `options`
 * (`fieldIds`, `fieldType`, `dialect`). Never throws.
 */
export function readFormulaStore(store: FormulaStoreText, options: ParseFormulaOptions = {}): FormulaStoreReading {
  const text = typeof store.text === "string" ? store.text.trim() : "";
  const tree = isStoredFormula(store.tree) ? store.tree : null;
  if (tree && (!text || printFormula(tree) === text)) return { formula: tree, source: "tree", errors: [], warnings: [] };
  if (!text) return { formula: null, source: "none", errors: [], warnings: [] };
  const parsed = parseFormula(text, options);
  return { formula: parsed.formula, source: "text", errors: parsed.errors, warnings: parsed.warnings };
}

export interface FormulaStoreWrite {
  /** The text to store: the printed tree, or the text as given when it does not parse. */
  text: string;
  /** The tree to store; null when the text is empty or does not parse. */
  tree: StoredFormula | null;
  errors: FormulaDiagnostic[];
  warnings: FormulaDiagnostic[];
}

/**
 * What a writer stores for edited formula text: the parsed tree and its
 * printed text, so the two stay mirrors. Text that does not parse (or is
 * empty) is stored as given, without a tree.
 */
export function writeFormulaStore(text: string, options: ParseFormulaOptions = {}): FormulaStoreWrite {
  const source = typeof text === "string" ? text : "";
  if (!source.trim()) return { text: source, tree: null, errors: [], warnings: [] };
  const parsed = parseFormula(source, options);
  if (!parsed.formula) return { text: source, tree: null, errors: parsed.errors, warnings: parsed.warnings };
  return { text: printFormula(parsed.formula), tree: parsed.formula, errors: [], warnings: parsed.warnings };
}
