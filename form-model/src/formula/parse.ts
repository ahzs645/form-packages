/**
 * `parseFormula`: formula text in any dialect authored in this repo → a
 * stored formula tree.
 *
 * Accepted dialects (see formula-semantics.md for the full list):
 * - builder / FormulaKit / lib/expressions: `[fieldId]` refs, helpers,
 *   `&& || !`, `? :`, `== != === !==`, JSON list and map literals
 *   (`contains(["a","b"], [q])`, `score([q], {"Yes": 2})`);
 * - legacy bare identifiers (`phq_q1 + phq_q2`), resolved against
 *   `options.fieldIds` when given;
 * - Cerner Equation Tool infix: `^`, `=`, `AND` / `OR`, `SQR()`, `Log()`,
 *   `Log10()`; an `OR` between two values (not conditions) is Cerner's
 *   "first that has a value" and becomes `coalesce()`;
 * - LayoutTable: `sum(a, b-c)` with bare hyphenated ids and `Math.*`;
 *   with `dialect: "layoutTable"` a missing answer reads as 0;
 * - FHIR-translated `and` / `or` / `not`;
 * - calculation-library and chart-value templates: `{slot}` / `{chart.path}`.
 *
 * Legacy text joins (`"Score: " + [x]`) become `concat()`, because `+` is
 * numeric only in the stored model.
 */

import {
  type FormulaBinaryOp,
  type FormulaDiagnostic,
  type FormulaMapEntry,
  type FormulaNode,
  type FormulaValueType,
  type StoredFormula,
} from "./ast";
import { findFormulaFunction, formulaArityError } from "./registry";
import { inferFormulaType, isTimeReference, type FormulaTypeEnv } from "./types";

export type FormulaDialect = "builder" | "layoutTable" | "chartValue";

export interface ParseFormulaOptions {
  /** Known field ids: bare identifiers resolve against them, and unknown ones are errors. */
  fieldIds?: Iterable<string>;
  /** Field types, so `[first] + [last]` over text fields reads as a text join. */
  fieldType?(fieldId: string): string | undefined;
  /**
   * `layoutTable`: LayoutTable computed cells, where a missing answer counts
   * as 0 and `sum(a, b-c)` lists bare ids. `chartValue`: chart value
   * formulas, where `{path}` slots are text and `+` joins.
   */
  dialect?: FormulaDialect;
  /** Stored on the result as `resultType`. */
  resultType?: FormulaValueType;
  /**
   * Names of host functions (`FormulaEnv.functions`) the formula may call
   * besides the registry's. They parse as calls with any number of arguments.
   */
  hostFunctions?: Iterable<string>;
}

export interface ParseFormulaResult {
  formula: StoredFormula | null;
  errors: FormulaDiagnostic[];
  warnings: FormulaDiagnostic[];
}

// ── Lexer ───────────────────────────────────────────────────────────────────

type TokenType = "num" | "str" | "ref" | "param" | "ident" | "op" | "eof";

interface Token {
  type: TokenType;
  value: string;
  number?: number;
  start: number;
  end: number;
}

class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number,
    readonly code = "syntax",
  ) {
    super(message);
  }
}

/** Characters a `[fieldId]` may hold unescaped; anything else is written `\x`. */
export const FORMULA_REF_CHAR = /[\p{L}\p{N}_.:-]/u;
/** Characters a `{slot}` name may hold. */
export const FORMULA_PARAM_CHAR = /[\p{L}\p{N}_.-]/u;

const OPERATORS = ["===", "!==", "**", "==", "!=", "<=", ">=", "<>", "&&", "||", "=", "<", ">", "+", "-", "*", "/", "%", "^", "!", "?", ":", "(", ")", ",", "[", "]", "{", "}"];
const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*/;
const SIMPLE_ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", "0": "\0" };

function scanBracketed(text: string, open: number, close: string, charTest: RegExp, allowEscapes: boolean): { value: string; end: number } | null {
  let index = open + 1;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  let value = "";
  while (index < text.length) {
    const char = text[index];
    if (allowEscapes && char === "\\" && index + 1 < text.length) {
      value += text[index + 1];
      index += 2;
      continue;
    }
    if (!charTest.test(char)) break;
    value += char;
    index += 1;
  }
  while (index < text.length && /\s/.test(text[index])) index += 1;
  if (value === "" || text[index] !== close) return null;
  return { value, end: index + 1 };
}

function readString(text: string, start: number): Token {
  const quote = text[start];
  let index = start + 1;
  let value = "";
  while (index < text.length) {
    const char = text[index];
    if (char === quote) return { type: "str", value, start, end: index + 1 };
    if (char === "\\") {
      const next = text[index + 1];
      if (next === undefined) break;
      if (next === "u") {
        const braced = /^\{([0-9a-fA-F]{1,6})\}/.exec(text.slice(index + 2));
        const plain = /^[0-9a-fA-F]{4}/.exec(text.slice(index + 2));
        if (braced) {
          value += String.fromCodePoint(parseInt(braced[1], 16));
          index += 2 + braced[0].length;
          continue;
        }
        if (plain) {
          value += String.fromCharCode(parseInt(plain[0], 16));
          index += 6;
          continue;
        }
        throw new FormulaSyntaxError("Invalid \\u escape in text.", index, index + 2);
      }
      if (next === "x") {
        const hex = /^[0-9a-fA-F]{2}/.exec(text.slice(index + 2));
        if (!hex) throw new FormulaSyntaxError("Invalid \\x escape in text.", index, index + 2);
        value += String.fromCharCode(parseInt(hex[0], 16));
        index += 4;
        continue;
      }
      value += SIMPLE_ESCAPES[next] ?? next;
      index += 2;
      continue;
    }
    value += char;
    index += 1;
  }
  throw new FormulaSyntaxError("The text is missing its closing quote.", start, text.length);
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const token = readString(text, index);
      tokens.push(token);
      index = token.end;
      continue;
    }
    if (char === "[") {
      const ref = scanBracketed(text, index, "]", FORMULA_REF_CHAR, true);
      if (ref) {
        tokens.push({ type: "ref", value: ref.value, start: index, end: ref.end });
        index = ref.end;
        continue;
      }
    }
    if (char === "{") {
      const param = scanBracketed(text, index, "}", FORMULA_PARAM_CHAR, false);
      if (param) {
        tokens.push({ type: "param", value: param.value, start: index, end: param.end });
        index = param.end;
        continue;
      }
    }
    const rest = text.slice(index);
    const number = /\d|\./.test(char) ? NUMBER.exec(rest) : null;
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) throw new FormulaSyntaxError(`${number[0]} is too large.`, index, index + number[0].length);
      const end = index + number[0].length;
      if (end < text.length && /[A-Za-z_$]/.test(text[end])) {
        throw new FormulaSyntaxError(`Missing an operator after ${number[0]}.`, index, end + 1);
      }
      tokens.push({ type: "num", value: number[0], number: value, start: index, end });
      index = end;
      continue;
    }
    const ident = IDENT.exec(rest);
    if (ident) {
      tokens.push({ type: "ident", value: ident[0], start: index, end: index + ident[0].length });
      index += ident[0].length;
      continue;
    }
    const operator = OPERATORS.find((op) => rest.startsWith(op));
    if (operator) {
      tokens.push({ type: "op", value: operator, start: index, end: index + operator.length });
      index += operator.length;
      continue;
    }
    if (char === ";") throw new FormulaSyntaxError("A formula is a single expression; remove the “;”.", index, index + 1);
    if (char === "&" || char === "|") {
      throw new FormulaSyntaxError(`Use “${char}${char}” for ${char === "&" ? "and" : "or"}, or concat() to join text.`, index, index + 1);
    }
    throw new FormulaSyntaxError(`Unexpected “${char}”.`, index, index + 1);
  }
  tokens.push({ type: "eof", value: "", start: text.length, end: text.length });
  return tokens;
}

// ── Parser ──────────────────────────────────────────────────────────────────

const BINARY_ALIASES: Record<string, FormulaBinaryOp> = {
  "===": "==",
  "=": "==",
  "!==": "!=",
  "<>": "!=",
  "**": "^",
};

const isWord = (token: Token, word: string) => token.type === "ident" && token.value.toLowerCase() === word;

const LAYOUT_SUM_ID = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

class Parser {
  private index = 0;
  readonly warnings: FormulaDiagnostic[] = [];
  private readonly knownIds: Set<string> | null;
  private readonly hostFunctions: Set<string> | null;
  private readonly typeEnv: FormulaTypeEnv;

  constructor(
    private readonly tokens: Token[],
    private readonly options: ParseFormulaOptions,
  ) {
    this.knownIds = options.fieldIds ? new Set(options.fieldIds) : null;
    this.hostFunctions = options.hostFunctions ? new Set(options.hostFunctions) : null;
    this.typeEnv = {
      fieldType: options.fieldType,
      paramType: options.dialect === "chartValue" ? () => "text" : undefined,
    };
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const token = this.peek();
    if (this.index < this.tokens.length - 1) this.index += 1;
    return token;
  }

  private isOp(value: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.type === "op" && token.value === value;
  }

  private expectOp(value: string, context: string): Token {
    const token = this.peek();
    if (token.type === "op" && token.value === value) return this.next();
    throw new FormulaSyntaxError(`Expected “${value}” ${context}, found ${describeToken(token)}.`, token.start, token.end);
  }

  private warn(code: string, message: string, token?: Token, extra: Partial<FormulaDiagnostic> = {}) {
    if (this.warnings.some((entry) => entry.code === code && entry.message === message)) return;
    this.warnings.push({ severity: "warning", code, message, ...(token ? { start: token.start, end: token.end } : {}), ...extra });
  }

  parse(): FormulaNode {
    const node = this.parseConditional();
    const token = this.peek();
    if (token.type !== "eof") throw new FormulaSyntaxError(`Unexpected ${describeToken(token)}.`, token.start, token.end);
    return node;
  }

  private parseConditional(): FormulaNode {
    const test = this.parseOr();
    if (!this.isOp("?")) return test;
    this.next();
    const then = this.parseConditional();
    this.expectOp(":", "in “test ? then : else”");
    const otherwise = this.parseConditional();
    return { kind: "if", test, then, else: otherwise };
  }

  private parseOr(): FormulaNode {
    let left = this.parseAnd();
    for (;;) {
      const token = this.peek();
      if (!(token.type === "op" && token.value === "||") && !isWord(token, "or")) return left;
      this.next();
      const right = this.parseAnd();
      if (token.value === "OR" && !this.isBooleanish(left) && !this.isBooleanish(right)) {
        // Cerner Equation Tool: OR between two values takes the first that evaluates.
        this.warn("or-coalesce", "OR between two values reads as coalesce(): the first that has a value.", token);
        left = { kind: "call", fn: "coalesce", args: [left, right] };
      } else {
        left = { kind: "binary", op: "||", left, right };
      }
    }
  }

  private parseAnd(): FormulaNode {
    let left = this.parseEquality();
    for (;;) {
      const token = this.peek();
      if (!(token.type === "op" && token.value === "&&") && !isWord(token, "and")) return left;
      this.next();
      left = { kind: "binary", op: "&&", left, right: this.parseEquality() };
    }
  }

  private parseEquality(): FormulaNode {
    let left = this.parseRelational();
    for (;;) {
      const token = this.peek();
      if (token.type !== "op" || !["==", "!=", "===", "!==", "=", "<>"].includes(token.value)) return left;
      this.next();
      const op = (BINARY_ALIASES[token.value] ?? token.value) as FormulaBinaryOp;
      left = { kind: "binary", op, left, right: this.parseRelational() };
    }
  }

  private parseRelational(): FormulaNode {
    let left = this.parseAdditive();
    for (;;) {
      const token = this.peek();
      if (token.type !== "op" || !["<", "<=", ">", ">="].includes(token.value)) return left;
      this.next();
      left = { kind: "binary", op: token.value as FormulaBinaryOp, left, right: this.parseAdditive() };
    }
  }

  private parseAdditive(): FormulaNode {
    let left = this.parseMultiplicative();
    for (;;) {
      const token = this.peek();
      if (token.type !== "op" || (token.value !== "+" && token.value !== "-")) return left;
      this.next();
      const right = this.parseMultiplicative();
      if (token.value === "+" && (this.isTextual(left) || this.isTextual(right))) {
        this.warn("text-join", "“+” with text joins text; it is stored as concat() because “+” adds numbers only.", token);
        const parts = [left, right].flatMap((part) => (part.kind === "call" && part.fn === "concat" ? part.args : [part]));
        left = { kind: "call", fn: "concat", args: parts };
      } else {
        left = { kind: "binary", op: token.value as FormulaBinaryOp, left, right };
      }
    }
  }

  private parseMultiplicative(): FormulaNode {
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (token.type !== "op" || !["*", "/", "%"].includes(token.value)) return left;
      this.next();
      left = { kind: "binary", op: token.value as FormulaBinaryOp, left, right: this.parseUnary() };
    }
  }

  private startsOperand(offset: number): boolean {
    const token = this.peek(offset);
    if (token.type === "eof") return false;
    if (token.type === "op") return ["(", "[", "{", "!", "-", "+"].includes(token.value);
    if (token.type === "ident") return !isWord(token, "and") && !isWord(token, "or");
    return true;
  }

  private parseUnary(): FormulaNode {
    const token = this.peek();
    const notWord = isWord(token, "not") && !this.knownIds?.has(token.value) && this.startsOperand(1);
    if ((token.type === "op" && ["-", "+", "!"].includes(token.value)) || notWord) {
      this.next();
      const operand = this.parseUnary();
      if (notWord || token.value === "!") return { kind: "unary", op: "!", operand };
      if (operand.kind === "number") {
        // Signed literals are stored as numbers: -3, not negate(3).
        return { kind: "number", value: token.value === "-" && operand.value !== 0 ? -operand.value : operand.value };
      }
      return { kind: "unary", op: token.value as "-" | "+", operand };
    }
    return this.parsePower();
  }

  private parsePower(): FormulaNode {
    const base = this.parsePrimary();
    const token = this.peek();
    if (token.type === "op" && (token.value === "^" || token.value === "**")) {
      this.next();
      return { kind: "binary", op: "^", left: base, right: this.parseUnary() };
    }
    return base;
  }

  private parsePrimary(): FormulaNode {
    const token = this.next();
    switch (token.type) {
      case "num":
        return { kind: "number", value: token.number! };
      case "str":
        return { kind: "text", value: token.value };
      case "ref":
        if (this.knownIds && !this.knownIds.has(token.value)) {
          this.warn("unknown-reference", `There is no field [${token.value}] on this form.`, token, { ref: token.value });
        }
        return { kind: "ref", id: token.value };
      case "param":
        return { kind: "param", name: token.value };
      case "ident":
        return this.parseIdentifier(token);
      case "op":
        if (token.value === "(") {
          const inner = this.parseConditional();
          this.expectOp(")", "to close “(”");
          return inner;
        }
        if (token.value === "[") return this.parseList(token);
        if (token.value === "{") return this.parseMap(token);
        break;
      default:
        break;
    }
    throw new FormulaSyntaxError(
      token.type === "eof" ? "The formula ends too early." : `Unexpected ${describeToken(token)}.`,
      token.start,
      token.end,
    );
  }

  private parseList(open: Token): FormulaNode {
    const items: FormulaNode[] = [];
    while (!this.isOp("]")) {
      items.push(this.parseConditional());
      if (this.isOp(",")) {
        this.next();
        continue;
      }
      if (!this.isOp("]")) {
        const token = this.peek();
        throw new FormulaSyntaxError(`Expected “,” or “]” in the list opened at ${open.start}, found ${describeToken(token)}.`, token.start, token.end);
      }
    }
    this.next();
    return { kind: "list", items };
  }

  private parseMap(open: Token): FormulaNode {
    const entries: FormulaMapEntry[] = [];
    while (!this.isOp("}")) {
      const keyToken = this.next();
      if (keyToken.type !== "str" && keyToken.type !== "ident" && keyToken.type !== "num") {
        throw new FormulaSyntaxError(`Expected a key in the map opened at ${open.start}, found ${describeToken(keyToken)}.`, keyToken.start, keyToken.end);
      }
      this.expectOp(":", `after the key ${JSON.stringify(keyToken.value)}`);
      const key = keyToken.type === "num" ? String(keyToken.number) : keyToken.value;
      const value = this.parseConditional();
      const existing = entries.findIndex((entry) => entry.key === key);
      if (existing >= 0) entries.splice(existing, 1);
      entries.push({ key, value });
      if (this.isOp(",")) {
        this.next();
        continue;
      }
      if (!this.isOp("}")) {
        const token = this.peek();
        throw new FormulaSyntaxError(`Expected “,” or “}” in the map opened at ${open.start}, found ${describeToken(token)}.`, token.start, token.end);
      }
    }
    this.next();
    return { kind: "map", entries };
  }

  private parseIdentifier(token: Token): FormulaNode {
    const name = token.value;
    if (this.isOp("(")) return this.parseCall(token);
    if (name === "true" || name === "false") return { kind: "boolean", value: name === "true" };
    if (name === "null") return { kind: "null" };
    if (name === "undefined") {
      this.warn("undefined-literal", "undefined reads as null (blank).", token);
      return { kind: "null" };
    }
    if (name === "Math.PI") return { kind: "number", value: Math.PI };
    if (name === "Math.E") return { kind: "number", value: Math.E };
    if (this.knownIds) {
      if (this.knownIds.has(name)) return { kind: "ref", id: name };
      if (findFormulaFunction(name)) {
        throw new FormulaSyntaxError(`${name} is a function; write ${name}(…).`, token.start, token.end, "unknown-reference");
      }
      throw new FormulaSyntaxError(`There is no field “${name}” on this form.`, token.start, token.end, "unknown-reference");
    }
    if (name.startsWith("Math.") || findFormulaFunction(name) || ["and", "or", "not"].includes(name.toLowerCase())) {
      throw new FormulaSyntaxError(`${name} cannot be read as a field; write fields as [${name}].`, token.start, token.end);
    }
    this.warn("bare-reference", "Bare identifiers are read as field references; write them as [fieldId].", token);
    return { kind: "ref", id: name };
  }

  private parseCall(nameToken: Token): FormulaNode {
    const spec = findFormulaFunction(nameToken.value);
    const host = !spec && this.hostFunctions?.has(nameToken.value);
    if (!spec && !host) {
      throw new FormulaSyntaxError(`${nameToken.value}() is not a formula function.`, nameToken.start, nameToken.end, "unknown-function");
    }
    this.expectOp("(", `after ${nameToken.value}`);
    const args: FormulaNode[] = [];
    while (!this.isOp(")")) {
      args.push(this.parseConditional());
      if (this.isOp(",")) {
        this.next();
        continue;
      }
      if (!this.isOp(")")) {
        const token = this.peek();
        throw new FormulaSyntaxError(`Expected “,” or “)” in ${nameToken.value}(…), found ${describeToken(token)}.`, token.start, token.end);
      }
    }
    const close = this.next();
    if (!spec) return { kind: "call", fn: nameToken.value, args };
    const arity = formulaArityError(spec, args.length);
    if (arity) throw new FormulaSyntaxError(arity, nameToken.start, close.end, "arity");
    if (spec.name === "iif") return { kind: "if", test: args[0], then: args[1], else: args[2] ?? { kind: "null" } };
    return { kind: "call", fn: spec.name, args };
  }

  private isTextual(node: FormulaNode): boolean {
    if (node.kind === "text") return true;
    if (node.kind === "ref" && !this.options.fieldType) return false;
    // A time answer ("14:30") is stored as text but is not text to `+`:
    // `[time] + 30` is arithmetic (blank, and checkFormula's date-arithmetic
    // error), never the join "14:3030". A text operand on the other side still joins.
    if (isTimeReference(node, this.typeEnv)) return false;
    return inferFormulaType(node, this.typeEnv) === "text";
  }

  private isBooleanish(node: FormulaNode): boolean {
    return inferFormulaType(node, this.typeEnv) === "boolean";
  }
}

function describeToken(token: Token): string {
  if (token.type === "eof") return "the end of the formula";
  if (token.type === "str") return `the text ${JSON.stringify(token.value)}`;
  if (token.type === "ref") return `[${token.value}]`;
  if (token.type === "param") return `{${token.value}}`;
  return `“${token.value}”`;
}

/** LayoutTable's `sum(a, b-c, [d])` shorthand: a flat list of ids that may be bare and hyphenated. */
function layoutSumShorthand(text: string, options: ParseFormulaOptions): FormulaNode | null {
  const match = /^\s*sum\s*\(([\s\S]*)\)\s*$/i.exec(text);
  if (!match) return null;
  const ids = match[1].split(",").map((part) => part.trim().replace(/^\[([^\]]+)\]$/, "$1").trim());
  if (ids.length === 0 || !ids.every((id) => LAYOUT_SUM_ID.test(id))) return null;
  const known = options.fieldIds ? new Set(options.fieldIds) : null;
  const compound = ids.filter((id) => /[-.]/.test(id));
  if (options.dialect !== "layoutTable" && (compound.length === 0 || !known || !compound.every((id) => known.has(id)))) return null;
  return { kind: "call", fn: "sum", args: ids.map((id) => ({ kind: "ref", id })) };
}

/** LayoutTable reads a missing answer as 0; make that explicit, except inside sum(), which skips blanks anyway. */
function missingAsZero(node: FormulaNode): FormulaNode {
  const wrap = (current: FormulaNode, insideSum: boolean): FormulaNode => {
    if (current.kind === "ref") {
      return insideSum ? current : { kind: "call", fn: "coalesce", args: [current, { kind: "number", value: 0 }] };
    }
    if (current.kind === "call") {
      const sum = current.fn === "sum";
      return { kind: "call", fn: current.fn, args: current.args.map((arg) => wrap(arg, sum)) };
    }
    return mapFormulaChildren(current, (child) => wrap(child, false));
  };
  return wrap(node, false);
}

function mapFormulaChildren(node: FormulaNode, transform: (child: FormulaNode) => FormulaNode): FormulaNode {
  switch (node.kind) {
    case "list":
      return { kind: "list", items: node.items.map(transform) };
    case "map":
      return { kind: "map", entries: node.entries.map((entry) => ({ key: entry.key, value: transform(entry.value) })) };
    case "unary":
      return { kind: "unary", op: node.op, operand: transform(node.operand) };
    case "binary":
      return { kind: "binary", op: node.op, left: transform(node.left), right: transform(node.right) };
    case "call":
      return { kind: "call", fn: node.fn, args: node.args.map(transform) };
    case "if":
      return { kind: "if", test: transform(node.test), then: transform(node.then), else: transform(node.else) };
    default:
      return node;
  }
}

/** Parse formula text into a stored formula. Never throws. */
export function parseFormula(text: string, options: ParseFormulaOptions = {}): ParseFormulaResult {
  const source = typeof text === "string" ? text : "";
  if (!source.trim()) {
    return { formula: null, errors: [{ severity: "error", code: "empty", message: "Enter a formula." }], warnings: [] };
  }
  const warnings: FormulaDiagnostic[] = [];
  try {
    let expr = layoutSumShorthand(source, options);
    if (!expr) {
      const parser = new Parser(tokenize(source), options);
      expr = parser.parse();
      warnings.push(...parser.warnings);
    }
    if (options.dialect === "layoutTable") {
      const wrapped = missingAsZero(expr);
      if (JSON.stringify(wrapped) !== JSON.stringify(expr)) {
        warnings.push({
          severity: "warning",
          code: "missing-as-zero",
          message: "LayoutTable reads a missing answer as 0; the references are wrapped in coalesce(…, 0). Non-numeric text, which LayoutTable also read as 0, is blank instead.",
        });
      }
      expr = wrapped;
    }
    const formula: StoredFormula = { v: 1, expr };
    if (options.resultType) formula.resultType = options.resultType;
    return { formula, errors: [], warnings };
  } catch (error) {
    if (error instanceof FormulaSyntaxError) {
      return {
        formula: null,
        errors: [{ severity: "error", code: error.code, message: error.message, start: error.start, end: error.end }],
        warnings,
      };
    }
    return { formula: null, errors: [{ severity: "error", code: "syntax", message: String((error as Error)?.message ?? error) }], warnings };
  }
}

/** Parse, throwing on errors; for tests and trusted, known-good text. */
export function parseFormulaOrThrow(text: string, options: ParseFormulaOptions = {}): StoredFormula {
  const result = parseFormula(text, options);
  if (!result.formula) throw new Error(result.errors.map((entry) => entry.message).join(" "));
  return result.formula;
}
