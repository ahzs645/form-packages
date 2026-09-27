/**
 * The EMR-neutral stored formula: a versioned, typed expression tree.
 *
 * Plain JSON only (no classes, no functions), so a formula can be saved on a
 * field, sent to the MOIS runtime as data and compared structurally. The text
 * authors type is an editing view: `parseFormula` turns it into this tree and
 * `printFormula` turns the tree back into canonical text.
 *
 * Semantics: docs/starlight/src/content/docs/architecture/formula-semantics.md
 */

export type FormulaValueType =
  | "number"
  | "text"
  | "boolean"
  | "date"
  | "datetime"
  | "duration"
  | "coded"
  | "list"
  | "unknown";

export const FORMULA_VALUE_TYPES: readonly FormulaValueType[] = [
  "number",
  "text",
  "boolean",
  "date",
  "datetime",
  "duration",
  "coded",
  "list",
  "unknown",
];

/** `-x` (negation), `+x` (read as a number), `!x` (logical not). */
export type FormulaUnaryOp = "-" | "+" | "!";

export type FormulaArithmeticOp = "+" | "-" | "*" | "/" | "%" | "^";
export type FormulaComparisonOp = "==" | "!=" | "<" | "<=" | ">" | ">=";
export type FormulaLogicalOp = "&&" | "||";
export type FormulaBinaryOp = FormulaArithmeticOp | FormulaComparisonOp | FormulaLogicalOp;

export const FORMULA_ARITHMETIC_OPS: readonly FormulaArithmeticOp[] = ["+", "-", "*", "/", "%", "^"];
export const FORMULA_COMPARISON_OPS: readonly FormulaComparisonOp[] = ["==", "!=", "<", "<=", ">", ">="];
export const FORMULA_LOGICAL_OPS: readonly FormulaLogicalOp[] = ["&&", "||"];

export interface FormulaMapEntry {
  key: string;
  value: FormulaNode;
}

export type FormulaNode =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "null" }
  /** A field on the form, by id. Structural, so renaming a field can rewrite it. */
  | { kind: "ref"; id: string }
  /**
   * A named input bound outside the formula: a calculation-library template
   * slot (`{weight}`, `{0}`) or a chart path in a chart value formula
   * (`{patient.name.first}`). Bind with `bindFormulaParams` before storing a
   * template on a field.
   */
  | { kind: "param"; name: string }
  /** A literal list, e.g. the values in `contains(["often", "very-often"], [q1])`. */
  | { kind: "list"; items: FormulaNode[] }
  /** A literal map, e.g. the option score map in `score([q1], {"Yes": 2})`. */
  | { kind: "map"; entries: FormulaMapEntry[] }
  | { kind: "unary"; op: FormulaUnaryOp; operand: FormulaNode }
  | { kind: "binary"; op: FormulaBinaryOp; left: FormulaNode; right: FormulaNode }
  /** A registry function by its canonical name (aliases are resolved by the parser). */
  | { kind: "call"; fn: string; args: FormulaNode[] }
  /** The conditional: `iif(test, then, else)` and `test ? then : else` both parse to this. */
  | { kind: "if"; test: FormulaNode; then: FormulaNode; else: FormulaNode };

export type FormulaNodeKind = FormulaNode["kind"];

export interface StoredFormula {
  v: 1;
  expr: FormulaNode;
  /** The type the author expects; the field's precision and display follow from it. */
  resultType?: FormulaValueType;
}

export interface FormulaDiagnostic {
  severity: "error" | "warning";
  /** Stable machine-readable code, e.g. `unknown-function`, `text-join`. */
  code: string;
  message: string;
  /** Character offsets into the parsed text, when the diagnostic came from the parser. */
  start?: number;
  end?: number;
  /** The field reference or function the diagnostic is about. */
  ref?: string;
  fn?: string;
}

export function isStoredFormula(value: unknown): value is StoredFormula {
  return Boolean(
    value
      && typeof value === "object"
      && (value as StoredFormula).v === 1
      && (value as StoredFormula).expr
      && typeof (value as StoredFormula).expr === "object",
  );
}

export function formulaExpr(formula: StoredFormula | FormulaNode): FormulaNode {
  return isStoredFormula(formula) ? formula.expr : formula;
}

/** Every child of a node, in evaluation order. */
export function formulaChildren(node: FormulaNode): FormulaNode[] {
  switch (node.kind) {
    case "list":
      return node.items;
    case "map":
      return node.entries.map((entry) => entry.value);
    case "unary":
      return [node.operand];
    case "binary":
      return [node.left, node.right];
    case "call":
      return node.args;
    case "if":
      return [node.test, node.then, node.else];
    default:
      return [];
  }
}

/** Visit every node, parents before children. */
export function walkFormula(formula: StoredFormula | FormulaNode, visit: (node: FormulaNode) => void): void {
  const stack: FormulaNode[] = [formulaExpr(formula)];
  while (stack.length > 0) {
    const node = stack.pop()!;
    visit(node);
    const children = formulaChildren(node);
    for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
  }
}

/** Field ids the formula reads, in first-use order. */
export function formulaReferences(formula: StoredFormula | FormulaNode): string[] {
  const ids: string[] = [];
  walkFormula(formula, (node) => {
    if (node.kind === "ref" && !ids.includes(node.id)) ids.push(node.id);
  });
  return ids;
}

/** Template slots and chart paths (`param` nodes) the formula reads, in first-use order. */
export function formulaParams(formula: StoredFormula | FormulaNode): string[] {
  const names: string[] = [];
  walkFormula(formula, (node) => {
    if (node.kind === "param" && !names.includes(node.name)) names.push(node.name);
  });
  return names;
}

/** Canonical function names the formula calls, in first-use order (`iif` for conditionals). */
export function formulaFunctions(formula: StoredFormula | FormulaNode): string[] {
  const names: string[] = [];
  walkFormula(formula, (node) => {
    const name = node.kind === "call" ? node.fn : node.kind === "if" ? "iif" : null;
    if (name && !names.includes(name)) names.push(name);
  });
  return names;
}

/** Rebuild a tree bottom-up; `transform` receives each node with its children already rebuilt. */
export function mapFormula(node: FormulaNode, transform: (node: FormulaNode) => FormulaNode): FormulaNode {
  let rebuilt: FormulaNode;
  switch (node.kind) {
    case "list":
      rebuilt = { kind: "list", items: node.items.map((item) => mapFormula(item, transform)) };
      break;
    case "map":
      rebuilt = { kind: "map", entries: node.entries.map((entry) => ({ key: entry.key, value: mapFormula(entry.value, transform) })) };
      break;
    case "unary":
      rebuilt = { kind: "unary", op: node.op, operand: mapFormula(node.operand, transform) };
      break;
    case "binary":
      rebuilt = { kind: "binary", op: node.op, left: mapFormula(node.left, transform), right: mapFormula(node.right, transform) };
      break;
    case "call":
      rebuilt = { kind: "call", fn: node.fn, args: node.args.map((arg) => mapFormula(arg, transform)) };
      break;
    case "if":
      rebuilt = {
        kind: "if",
        test: mapFormula(node.test, transform),
        then: mapFormula(node.then, transform),
        else: mapFormula(node.else, transform),
      };
      break;
    default:
      rebuilt = node;
  }
  return transform(rebuilt);
}

/**
 * Rename field references (`{ oldId: newId }`); ids not in the map are kept.
 * This is what makes a stored formula rename-safe.
 */
export function renameFormulaReferences(formula: StoredFormula, renames: Readonly<Record<string, string>>): StoredFormula {
  const expr = mapFormula(formula.expr, (node) =>
    node.kind === "ref" && Object.prototype.hasOwnProperty.call(renames, node.id) ? { kind: "ref", id: renames[node.id] } : node,
  );
  return { ...formula, expr };
}

/**
 * Inline option score maps into bare `score([id])` calls, so the formula runs
 * where the fields' options are not at hand (the exported MOIS form). Calls
 * that already pass a map, and fields without a non-empty map, are left alone.
 */
export function inlineScoreMaps(
  formula: StoredFormula,
  scoreMaps: Readonly<Record<string, Readonly<Record<string, number>>>>,
): StoredFormula {
  const expr = mapFormula(formula.expr, (node) => {
    if (node.kind !== "call" || node.fn !== "score" || node.args.length !== 1 || node.args[0].kind !== "ref") return node;
    const map = Object.prototype.hasOwnProperty.call(scoreMaps, node.args[0].id) ? scoreMaps[node.args[0].id] : undefined;
    const keys = map ? Object.keys(map).filter((key) => Number.isFinite(map[key])) : [];
    if (!map || keys.length === 0) return node;
    const entries: FormulaMapEntry[] = keys.map((key) => ({ key, value: { kind: "number", value: map[key] } }));
    return { kind: "call", fn: "score", args: [node.args[0], { kind: "map", entries }] };
  });
  return { ...formula, expr };
}

/**
 * Bind template slots: a string binds the slot to that field id, a node
 * replaces it outright. Unbound slots stay as `param` nodes.
 */
export function bindFormulaParams(
  formula: StoredFormula,
  bindings: Readonly<Record<string, string | FormulaNode>>,
): StoredFormula {
  const expr = mapFormula(formula.expr, (node) => {
    if (node.kind !== "param" || !Object.prototype.hasOwnProperty.call(bindings, node.name)) return node;
    const binding = bindings[node.name];
    return typeof binding === "string" ? { kind: "ref", id: binding } : binding;
  });
  return { ...formula, expr };
}
