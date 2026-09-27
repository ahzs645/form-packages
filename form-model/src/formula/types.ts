/**
 * Static types for stored formulas: `inferFormulaType` and `checkFormula`.
 *
 * Field references take their type from the field (a builder field type such
 * as `number` or `choice`, or a formula value type). Unknown types never
 * produce errors; the checker only reports what it can prove.
 */

import {
  formulaExpr,
  type FormulaDiagnostic,
  type FormulaNode,
  type FormulaValueType,
  type StoredFormula,
  FORMULA_ARITHMETIC_OPS,
  FORMULA_COMPARISON_OPS,
  FORMULA_VALUE_TYPES,
} from "./ast";
import { FORMULA_DURATION_UNITS, findFormulaFunction, formulaArityError, type FormulaParamType } from "./registry";

export interface FormulaTypeEnv {
  /** A builder field type (`number`, `choice`, `booleanYesNo`…) or a formula value type. */
  fieldType?(fieldId: string): string | undefined;
  /** The type of a template slot or chart path. */
  paramType?(name: string): string | undefined;
  /** Every field the formula may read; references outside it are errors. */
  fieldIds?: Iterable<string>;
  /** The field that owns the formula; reading it is an error. */
  selfId?: string;
}

const FIELD_TYPE_TO_VALUE_TYPE: Readonly<Record<string, FormulaValueType>> = {
  number: "number",
  slider: "number",
  rating: "number",
  text: "text",
  textarea: "text",
  email: "text",
  phone: "text",
  url: "text",
  hyperlink: "text",
  password: "text",
  richText: "text",
  barcode: "text",
  time: "text",
  booleanYesNo: "boolean",
  booleanSingle: "boolean",
  date: "date",
  datetime: "datetime",
  dateTime: "datetime",
  choice: "coded",
  scale: "coded",
  multiselect: "list",
  checklist: "list",
};

/** The formula value type a field of this builder type holds. */
export function formulaValueTypeForFieldType(fieldType: string | undefined): FormulaValueType {
  if (!fieldType) return "unknown";
  if ((FORMULA_VALUE_TYPES as readonly string[]).includes(fieldType)) return fieldType as FormulaValueType;
  return FIELD_TYPE_TO_VALUE_TYPE[fieldType] ?? "unknown";
}

const NUMERIC_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** The common type of several branches; blanks (`unknown`) defer to the others. */
function unifyTypes(types: FormulaValueType[]): FormulaValueType {
  const known = types.filter((type) => type !== "unknown");
  if (known.length === 0) return "unknown";
  const first = known[0];
  if (known.every((type) => type === first)) return first;
  if (known.every((type) => type === "number" || type === "duration")) return "number";
  if (known.every((type) => type === "date" || type === "datetime")) return "datetime";
  return "unknown";
}

function typeOfNode(node: FormulaNode, env: FormulaTypeEnv): FormulaValueType {
  switch (node.kind) {
    case "number":
      return "number";
    case "text":
      return "text";
    case "boolean":
      return "boolean";
    case "null":
      return "unknown";
    case "ref":
      return formulaValueTypeForFieldType(env.fieldType?.(node.id));
    case "param":
      return formulaValueTypeForFieldType(env.paramType?.(node.name));
    case "list":
      return "list";
    case "map":
      return "unknown";
    case "unary":
      return node.op === "!" ? "boolean" : "number";
    case "binary":
      return (FORMULA_ARITHMETIC_OPS as readonly string[]).includes(node.op) ? "number" : "boolean";
    case "if":
      return unifyTypes([typeOfNode(node.then, env), typeOfNode(node.else, env)]);
    case "call": {
      const spec = findFormulaFunction(node.fn);
      if (!spec) return "unknown";
      if (spec.result !== "branches") return spec.result;
      const valueArgs = node.fn === "iif" ? node.args.slice(1) : node.fn === "ifPresent" ? node.args.slice(1) : node.args;
      return unifyTypes(valueArgs.map((arg) => typeOfNode(arg, env)));
    }
    default:
      return "unknown";
  }
}

/** The value type the formula produces, from its operators, functions and the types of the fields it reads. */
export function inferFormulaType(formula: StoredFormula | FormulaNode, env: FormulaTypeEnv = {}): FormulaValueType {
  return typeOfNode(formulaExpr(formula), env);
}

const isDateType = (type: FormulaValueType) => type === "date" || type === "datetime";

/**
 * A reference to a time answer (builder type `time`, stored as "14:30"). It
 * reads as text everywhere except arithmetic: `+` over it is not a text join,
 * and arithmetic on it is a `date-arithmetic` error (a time is not a number).
 */
export function isTimeReference(node: FormulaNode, env: FormulaTypeEnv = {}): boolean {
  if (node.kind === "ref") return env.fieldType?.(node.id) === "time";
  if (node.kind === "param") return env.paramType?.(node.name) === "time";
  return false;
}

function describeType(type: FormulaValueType): string {
  switch (type) {
    case "coded":
      return "a choice";
    case "list":
      return "a list";
    case "datetime":
      return "a date and time";
    case "boolean":
      return "yes/no";
    default:
      return `a ${type}`;
  }
}

function checkArgument(
  node: FormulaNode,
  paramType: FormulaParamType,
  fn: string,
  env: FormulaTypeEnv,
  report: (severity: FormulaDiagnostic["severity"], code: string, message: string, extra?: Partial<FormulaDiagnostic>) => void,
): void {
  const type = typeOfNode(node, env);
  switch (paramType) {
    case "number":
    case "numbers":
      if (isDateType(type)) {
        report("error", "argument-type", `${fn}() needs a number, not ${describeType(type)}; use durationBetween() for dates.`, { fn });
      } else if (type === "list" && paramType === "number") {
        report("warning", "argument-type", `${fn}() reads a list as a number only when it has one item; use score() or countTrue() for multi-select answers.`, { fn });
      } else if (node.kind === "text" && !NUMERIC_TEXT.test(node.value.trim())) {
        report("error", "argument-type", `${fn}() needs a number, not the text ${JSON.stringify(node.value)}.`, { fn });
      }
      return;
    case "date":
      if (type === "number" || type === "boolean" || type === "duration" || type === "list") {
        report("error", "argument-type", `${fn}() needs a date, not ${describeType(type)}.`, { fn });
      }
      return;
    case "unit":
    case "units":
      if (node.kind === "text") {
        const parts = paramType === "units" ? node.value.split(",") : [node.value];
        const unknown = parts.map((part) => part.trim()).filter((part) => !FORMULA_DURATION_UNITS[part.toLowerCase()]);
        if (unknown.length > 0) {
          report("error", "unit", `${fn}() does not know the unit ${JSON.stringify(unknown[0])}; use days, weeks, months or years.`, { fn });
        }
      } else if (type !== "text" && type !== "unknown") {
        report("error", "unit", `${fn}() needs a unit name such as "days", not ${describeType(type)}.`, { fn });
      }
      return;
    case "scoreMap":
      if (node.kind !== "map" && node.kind !== "number" && type !== "unknown") {
        report("error", "argument-type", `${fn}() needs an option score map such as {"Yes": 1} or a checkbox's points.`, { fn });
      }
      return;
    default:
      return;
  }
}

/**
 * Diagnostics for a formula: unknown functions and fields, wrong arity,
 * text or dates in arithmetic, incompatible comparisons, bad duration units.
 */
export function checkFormula(formula: StoredFormula | FormulaNode, env: FormulaTypeEnv = {}): FormulaDiagnostic[] {
  const diagnostics: FormulaDiagnostic[] = [];
  const knownIds = env.fieldIds ? new Set(env.fieldIds) : null;
  const report = (severity: FormulaDiagnostic["severity"], code: string, message: string, extra: Partial<FormulaDiagnostic> = {}) => {
    const duplicate = diagnostics.some((entry) => entry.code === code && entry.message === message);
    if (!duplicate) diagnostics.push({ severity, code, message, ...extra });
  };

  const visit = (node: FormulaNode): void => {
    switch (node.kind) {
      case "ref":
        if (env.selfId !== undefined && node.id === env.selfId) {
          report("error", "self-reference", `The formula reads its own field [${node.id}].`, { ref: node.id });
        } else if (knownIds && !knownIds.has(node.id)) {
          report("error", "unknown-reference", `There is no field [${node.id}] on this form.`, { ref: node.id });
        }
        return;
      case "param":
        if (!env.paramType?.(node.name)) {
          report("warning", "unbound-param", `{${node.name}} is a template slot; bind it to a field before using the formula.`);
        }
        return;
      case "unary":
        visit(node.operand);
        if (node.op !== "!") checkArithmeticOperand(node.operand, node.op);
        return;
      case "binary":
        visit(node.left);
        visit(node.right);
        if ((FORMULA_ARITHMETIC_OPS as readonly string[]).includes(node.op)) {
          checkArithmeticOperand(node.left, node.op);
          checkArithmeticOperand(node.right, node.op);
        } else if ((FORMULA_COMPARISON_OPS as readonly string[]).includes(node.op)) {
          checkComparison(node.left, node.right, node.op);
        } else {
          checkCondition(node.left, node.op);
          checkCondition(node.right, node.op);
        }
        return;
      case "if":
        visit(node.test);
        visit(node.then);
        visit(node.else);
        checkCondition(node.test, "iif");
        return;
      case "list":
        node.items.forEach(visit);
        return;
      case "map":
        node.entries.forEach((entry) => visit(entry.value));
        return;
      case "call": {
        node.args.forEach(visit);
        const spec = findFormulaFunction(node.fn);
        if (!spec) {
          report("error", "unknown-function", `${node.fn}() is not a formula function.`, { fn: node.fn });
          return;
        }
        const arity = formulaArityError(spec, node.args.length);
        if (arity) report("error", "arity", arity, { fn: spec.name });
        node.args.forEach((arg, index) => {
          const param = spec.params[index] ?? spec.params.find((entry) => entry.rest);
          if (param) checkArgument(arg, param.type, spec.name, env, report);
        });
        if (spec.name === "score" && node.args.length > 0) {
          const answerType = typeOfNode(node.args[0], env);
          if (answerType === "number" || answerType === "text" || isDateType(answerType)) {
            report("warning", "score-argument", `score() reads choices and checkboxes; ${describeType(answerType)} scores as its own number.`, { fn: "score" });
          }
        }
        return;
      }
      default:
        return;
    }
  };

  const checkArithmeticOperand = (operand: FormulaNode, op: string) => {
    const type = typeOfNode(operand, env);
    if (operand.kind === "text") {
      if (!NUMERIC_TEXT.test(operand.value.trim())) {
        report("error", "text-arithmetic", `"${op}" works on numbers; join text with concat() or text().`);
      }
    } else if (isTimeReference(operand, env)) {
      report("error", "date-arithmetic", `"${op}" does not work on times; a time is not a number, and time arithmetic is not supported.`);
    } else if (type === "text") {
      report("warning", "text-arithmetic", `"${op}" reads text as a number (blank when it is not numeric); join text with concat().`);
    } else if (isDateType(type)) {
      report("error", "date-arithmetic", `"${op}" does not work on dates; use durationBetween() or daysBetween().`);
    } else if (type === "list") {
      report("warning", "list-arithmetic", `"${op}" reads a multi-select answer only when one item is chosen; use score() or countTrue().`);
    } else if (type === "coded") {
      report("warning", "coded-arithmetic", `"${op}" reads a choice by its numeric code; use score() for option scores.`);
    }
  };

  const checkComparison = (left: FormulaNode, right: FormulaNode, op: string) => {
    const a = typeOfNode(left, env);
    const b = typeOfNode(right, env);
    const pair = (x: FormulaValueType, y: FormulaValueType) => (a === x && b === y) || (a === y && b === x);
    if ((isDateType(a) && (b === "number" || b === "duration" || b === "boolean")) || (isDateType(b) && (a === "number" || a === "duration" || a === "boolean"))) {
      report("error", "compare-types", `"${op}" compares ${describeType(a)} with ${describeType(b)}; they can never match.`);
    } else if (op !== "==" && op !== "!=" && (a === "boolean" || b === "boolean") && !pair("boolean", "boolean")) {
      report("warning", "compare-types", `"${op}" orders yes/no answers as 1 and 0.`);
    }
  };

  const checkCondition = (node: FormulaNode, op: string) => {
    const type = typeOfNode(node, env);
    if (type === "text" || isDateType(type) || type === "list") {
      report("warning", "condition-type", `${op === "iif" ? "The iif() test" : `"${op}"`} treats ${describeType(type)} as yes when it has a value.`);
    }
  };

  visit(formulaExpr(formula));
  return diagnostics;
}
