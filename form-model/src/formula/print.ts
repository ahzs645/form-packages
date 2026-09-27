/**
 * `printFormula`: a stored formula → canonical text in the `[fieldId]`
 * syntax, with the fewest parentheses that keep the tree's shape.
 *
 * `parseFormula(printFormula(f)).formula.expr` deep-equals `f.expr` for every
 * tree the parser produces. (Two shapes the parser never produces print as
 * their canonical form: a unary minus over a number literal, which is
 * stored as a signed number, and the `iif` call, which is stored as the
 * conditional node.) `resultType` is not part of the text; pass it back as
 * a parse option.
 */

import { formulaExpr, type FormulaBinaryOp, type FormulaNode, type StoredFormula } from "./ast";

const FORMULA_REF_CHAR = /[\p{L}\p{N}_.:-]/u;

const PRECEDENCE: Record<FormulaBinaryOp, number> = {
  "||": 2,
  "&&": 3,
  "==": 4,
  "!=": 4,
  "<": 5,
  "<=": 5,
  ">": 5,
  ">=": 5,
  "+": 6,
  "-": 6,
  "*": 7,
  "/": 7,
  "%": 7,
  "^": 9,
};
const UNARY = 8;
const POWER = 9;
const PRIMARY = 10;

function precedence(node: FormulaNode): number {
  if (node.kind === "binary") return PRECEDENCE[node.op];
  if (node.kind === "unary") return UNARY;
  if (node.kind === "number" && (node.value < 0 || Object.is(node.value, -0))) return UNARY;
  return PRIMARY;
}

function printNumber(value: number): string {
  if (!Number.isFinite(value)) return "null";
  return String(value);
}

function escapeRef(id: string): string {
  let out = "";
  for (const char of id) out += FORMULA_REF_CHAR.test(char) ? char : `\\${char}`;
  return out;
}

const REF_LIKE = /^[\p{L}\p{N}_.:-]+$/u;

function wrap(text: string, needed: boolean): string {
  return needed ? `(${text})` : text;
}

function printNode(node: FormulaNode): string {
  switch (node.kind) {
    case "number":
      return printNumber(node.value);
    case "text":
      return JSON.stringify(node.value);
    case "boolean":
      return node.value ? "true" : "false";
    case "null":
      return "null";
    case "ref":
      return `[${escapeRef(node.id)}]`;
    case "param":
      return `{${node.name}}`;
    case "list": {
      const items = node.items.map(printNode);
      // `[1]` would read back as the field [1].
      if (items.length === 1 && REF_LIKE.test(items[0])) return `[(${items[0]})]`;
      return `[${items.join(", ")}]`;
    }
    case "map":
      return `{${node.entries.map((entry) => `${JSON.stringify(entry.key)}: ${printNode(entry.value)}`).join(", ")}}`;
    case "unary": {
      const operand = node.operand;
      // A signed literal under a unary operator keeps its own parentheses.
      const needs = precedence(operand) < UNARY || (operand.kind === "number" && node.op !== "!") || (operand.kind === "unary" && operand.op !== "!" && node.op !== "!");
      return `${node.op}${wrap(printNode(operand), needs)}`;
    }
    case "binary": {
      const own = PRECEDENCE[node.op];
      const leftPrecedence = precedence(node.left);
      const rightPrecedence = precedence(node.right);
      const leftNeeds = node.op === "^" ? leftPrecedence <= POWER : leftPrecedence < own;
      const rightNeeds = node.op === "^" ? rightPrecedence < UNARY : rightPrecedence <= own;
      return `${wrap(printNode(node.left), leftNeeds)} ${node.op} ${wrap(printNode(node.right), rightNeeds)}`;
    }
    case "if":
      return `iif(${printNode(node.test)}, ${printNode(node.then)}, ${printNode(node.else)})`;
    case "call":
      return `${node.fn}(${node.args.map(printNode).join(", ")})`;
    default:
      return "null";
  }
}

/** Canonical text for a stored formula (or a bare node). */
export function printFormula(formula: StoredFormula | FormulaNode): string {
  return printNode(formulaExpr(formula));
}
