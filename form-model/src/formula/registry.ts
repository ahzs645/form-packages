/**
 * Every formula function any engine in the repo supports today, with its
 * signature, meaning and per-target support.
 *
 * `engines` records where the function exists today (so a converter or a
 * migration can tell a builder-only helper from a runtime one). `targets`:
 * `native` means the target has the function (or an exact equivalent),
 * `changed` means a converter can rewrite it with a reported approximation or
 * only in certain shapes, `unsupported` means the target cannot express it and
 * the converter must report a loss. Each target's capability file in
 * lib/targets/capabilities is authoritative (for Cerner the equation
 * converter's table, for FHIR the FHIRPath compiler's); the columns here
 * mirror them, and lib/__tests__/formula-registry-capabilities.test.ts fails
 * when one disagrees. The `mois` column is `native` throughout because
 * FormulaKit is generated from the reference evaluator, except zScore, whose
 * growth tables the exported form does not carry, and latest(), which reads
 * the chart by MOIS observation code and so only where one is known. `documents` has no table:
 * document fill runs the reference evaluator.
 */

import type { FormulaBinaryOp, FormulaUnaryOp, FormulaValueType } from "./ast";

export type FormulaTarget = "mois" | "cerner" | "alayacare" | "fhir" | "docmosis" | "documents";
export type FormulaTargetSupport = "native" | "changed" | "unsupported";

export const FORMULA_TARGETS: readonly FormulaTarget[] = ["mois", "cerner", "alayacare", "fhir", "docmosis", "documents"];

/** Where a function exists in the legacy engines. */
export type FormulaEngine =
  | "lib/expressions"
  | "FormulaKit"
  | "SubformScoring"
  | "LayoutTable"
  | "cerner-equation"
  | "chart-value"
  | "new";

/**
 * Parameter kinds for type checking. `numbers` accepts lists (flattened),
 * `unit` / `units` are duration unit names, `scoreMap` is a literal map or a
 * checkbox's points.
 */
export type FormulaParamType = "number" | "numbers" | "text" | "boolean" | "date" | "unit" | "units" | "scoreMap" | "observation" | "options" | "any";

export interface FormulaFunctionParam {
  name: string;
  type: FormulaParamType;
  optional?: boolean;
  /** Repeats for every remaining argument. */
  rest?: boolean;
}

export type FormulaFunctionCategory = "logic" | "missing" | "choice" | "math" | "aggregate" | "text" | "date" | "clinical" | "chart";

export interface FormulaFunctionSpec {
  name: string;
  /** Other spellings the parser accepts (`Math.round`, Cerner `SQR`). Matched exactly, then case-insensitively. */
  aliases: readonly string[];
  category: FormulaFunctionCategory;
  params: readonly FormulaFunctionParam[];
  minArgs: number;
  /** `null` for variadic functions. */
  maxArgs: number | null;
  /** `branches` = the common type of the value arguments (iif, coalesce, ifPresent). */
  result: FormulaValueType | "branches";
  /** Arguments are evaluated only when needed (iif, coalesce, ifPresent). */
  lazy?: boolean;
  /** `propagate`: a missing input gives a missing result. `handles`: the function defines its own answer. */
  missing: "propagate" | "handles";
  description: string;
  engines: readonly FormulaEngine[];
  targets: Readonly<Record<FormulaTarget, FormulaTargetSupport>>;
}

type Support = Readonly<Record<FormulaTarget, FormulaTargetSupport>>;

const support = (
  mois: FormulaTargetSupport,
  cerner: FormulaTargetSupport,
  alayacare: FormulaTargetSupport,
  fhir: FormulaTargetSupport,
  docmosis: FormulaTargetSupport,
  documents: FormulaTargetSupport = "native",
): Support => ({ mois, cerner, alayacare, fhir, docmosis, documents });

const n = (name: string, extra: Partial<FormulaFunctionParam> = {}): FormulaFunctionParam => ({ name, type: "number", ...extra });
const d = (name: string, extra: Partial<FormulaFunctionParam> = {}): FormulaFunctionParam => ({ name, type: "date", ...extra });
const any = (name: string, extra: Partial<FormulaFunctionParam> = {}): FormulaFunctionParam => ({ name, type: "any", ...extra });

const U = "unsupported" as const;
const C = "changed" as const;
const N = "native" as const;

export const FORMULA_FUNCTIONS: readonly FormulaFunctionSpec[] = [
  // ── Logic and missing values ────────────────────────────────────────────
  {
    name: "iif",
    aliases: [],
    category: "logic",
    params: [{ name: "test", type: "boolean" }, any("then"), any("else", { optional: true })],
    minArgs: 2,
    maxArgs: 3,
    result: "branches",
    lazy: true,
    missing: "handles",
    description: "`then` when the test holds, `else` (blank when omitted) when it does not, blank when the test is unknown. Parses to the conditional node, like `test ? then : else`.",
    engines: ["lib/expressions", "FormulaKit", "SubformScoring"],
    targets: support(N, C, C, N, C),
  },
  {
    name: "coalesce",
    aliases: [],
    category: "missing",
    params: [any("values", { rest: true })],
    minArgs: 1,
    maxArgs: null,
    result: "branches",
    lazy: true,
    missing: "handles",
    description: "The first argument that has a value, or blank.",
    engines: ["lib/expressions", "FormulaKit"],
    targets: support(N, C, C, N, C),
  },
  {
    name: "hasValue",
    aliases: [],
    category: "missing",
    params: [any("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "boolean",
    missing: "handles",
    description: "Whether the value is answered: false for blank, whitespace-only text and empty lists; true for `false` and `0`.",
    engines: ["lib/expressions", "FormulaKit"],
    targets: support(N, U, C, N, C),
  },
  {
    name: "ifPresent",
    aliases: [],
    category: "missing",
    params: [any("value"), any("then"), any("else", { optional: true })],
    minArgs: 2,
    maxArgs: 3,
    result: "branches",
    lazy: true,
    missing: "handles",
    description: "`then` when the value is answered, otherwise `else` (blank when omitted). From chart value formulas.",
    engines: ["chart-value"],
    targets: support(N, U, U, N, N),
  },
  {
    name: "countTrue",
    aliases: [],
    category: "logic",
    params: [any("values", { rest: true })],
    minArgs: 1,
    maxArgs: null,
    result: "number",
    missing: "handles",
    description: "How many values are yes: `true`, 1, and the text or codes true / Y / Yes (any case). Blank values count as not yes; lists are flattened.",
    engines: ["FormulaKit"],
    targets: support(N, U, U, N, U),
  },

  // ── Choices ─────────────────────────────────────────────────────────────
  {
    name: "score",
    aliases: [],
    category: "choice",
    params: [any("answer"), { name: "scores", type: "scoreMap", optional: true }],
    minArgs: 1,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "The score of a choice answer: looked up by code, then value, then label in the option score map (the field's own options when the map is omitted). A multi-select sums its choices; a checkbox scores 1 (or the given points) when checked and 0 when not; an answer with no score reads as its number, else 0.",
    engines: ["lib/expressions", "FormulaKit", "cerner-equation"],
    targets: support(N, N, N, N, U),
  },
  {
    name: "contains",
    aliases: [],
    category: "choice",
    params: [any("collection"), any("value")],
    minArgs: 2,
    maxArgs: 2,
    result: "boolean",
    missing: "handles",
    description: "List membership for lists and multi-select answers (coded answers match by code, value or label); case-insensitive substring for text. False when either side is blank.",
    engines: ["lib/expressions", "FormulaKit"],
    targets: support(N, U, U, N, U),
  },

  // ── Aggregates ──────────────────────────────────────────────────────────
  {
    name: "sum",
    aliases: [],
    category: "aggregate",
    params: [{ name: "values", type: "numbers", rest: true }],
    minArgs: 1,
    maxArgs: null,
    result: "number",
    missing: "handles",
    description: "The total of the answered values; lists are flattened, blanks are skipped, blank when nothing is answered.",
    engines: ["LayoutTable"],
    targets: support(N, C, N, N, U),
  },
  {
    name: "min",
    aliases: ["Math.min"],
    category: "aggregate",
    params: [{ name: "values", type: "numbers", rest: true }],
    minArgs: 1,
    maxArgs: null,
    result: "number",
    missing: "handles",
    description: "The smallest answered value; blanks are skipped, blank when nothing is answered.",
    engines: ["FormulaKit", "SubformScoring", "LayoutTable"],
    targets: support(N, U, U, N, U),
  },
  {
    name: "max",
    aliases: ["Math.max"],
    category: "aggregate",
    params: [{ name: "values", type: "numbers", rest: true }],
    minArgs: 1,
    maxArgs: null,
    result: "number",
    missing: "handles",
    description: "The largest answered value; blanks are skipped, blank when nothing is answered.",
    engines: ["FormulaKit", "SubformScoring", "LayoutTable"],
    targets: support(N, U, U, N, U),
  },

  // ── Numbers ─────────────────────────────────────────────────────────────
  {
    name: "round",
    aliases: ["Math.round"],
    category: "math",
    params: [n("value"), n("digits", { optional: true })],
    minArgs: 1,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "Rounds to `digits` decimal places (0 when omitted; negative rounds to tens, hundreds…). Halves round up (towards +∞), decimal-exact: round(1.005, 2) is 1.01.",
    engines: ["lib/expressions", "FormulaKit", "SubformScoring", "LayoutTable"],
    targets: support(N, U, U, N, U),
  },
  {
    name: "floor",
    aliases: ["Math.floor"],
    category: "math",
    params: [n("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "The largest whole number not above the value.",
    engines: ["lib/expressions", "FormulaKit", "SubformScoring", "LayoutTable"],
    targets: support(N, C, U, N, C),
  },
  {
    name: "ceil",
    aliases: ["Math.ceil", "ceiling"],
    category: "math",
    params: [n("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "The smallest whole number not below the value.",
    engines: ["SubformScoring", "LayoutTable"],
    targets: support(N, U, U, N, U),
  },
  {
    name: "trunc",
    aliases: ["Math.trunc", "truncate"],
    category: "math",
    params: [n("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "The whole-number part, dropping the fraction towards zero.",
    engines: ["LayoutTable"],
    targets: support(N, U, U, N, U),
  },
  {
    name: "abs",
    aliases: ["Math.abs"],
    category: "math",
    params: [n("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "The absolute value.",
    engines: ["SubformScoring", "LayoutTable"],
    targets: support(N, C, U, N, U),
  },
  {
    name: "mod",
    aliases: [],
    category: "math",
    params: [n("value"), n("divisor")],
    minArgs: 2,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "The remainder of value ÷ divisor, with the sign of the value (the `%` operator). Blank for a zero divisor.",
    engines: ["FormulaKit", "SubformScoring"],
    targets: support(N, U, U, N, U),
  },
  {
    name: "power",
    aliases: ["Math.pow", "pow"],
    category: "math",
    params: [n("base"), n("exponent")],
    minArgs: 2,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "base raised to exponent (the `^` operator). Blank when the result is not a real number.",
    engines: ["lib/expressions", "FormulaKit", "LayoutTable", "cerner-equation"],
    targets: support(N, N, U, N, U),
  },
  {
    name: "sqrt",
    aliases: ["Math.sqrt", "SQR"],
    category: "math",
    params: [n("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "The square root; blank for a negative value. Cerner Equation Tool spells it SQR.",
    engines: ["LayoutTable", "cerner-equation"],
    targets: support(N, N, U, N, U),
  },
  {
    name: "ln",
    aliases: ["Math.log", "LOG", "log"],
    category: "math",
    params: [n("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "The natural logarithm; blank for zero or a negative value. Cerner Equation Tool spells it Log.",
    engines: ["lib/expressions", "FormulaKit", "LayoutTable", "cerner-equation"],
    targets: support(N, N, U, N, U),
  },
  {
    name: "log10",
    aliases: ["Math.log10", "LOG10"],
    category: "math",
    params: [n("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "The base-10 logarithm; blank for zero or a negative value.",
    engines: ["LayoutTable", "cerner-equation"],
    targets: support(N, N, U, N, U),
  },
  {
    name: "exp",
    aliases: ["Math.exp"],
    category: "math",
    params: [n("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "e raised to the value.",
    engines: ["lib/expressions", "FormulaKit", "LayoutTable"],
    targets: support(N, U, U, N, U),
  },
  {
    name: "number",
    aliases: ["Number", "parseFloat", "toNumber"],
    category: "math",
    params: [any("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "The value read as a number (numeric text, a choice's numeric code, yes/no as 1/0); blank when it is not numeric.",
    engines: ["new"],
    targets: support(N, U, U, N, U),
  },

  // ── Text ────────────────────────────────────────────────────────────────
  {
    name: "text",
    aliases: ["String", "toString"],
    category: "text",
    params: [any("value")],
    minArgs: 1,
    maxArgs: 1,
    result: "text",
    missing: "handles",
    description: "The value as text: a choice's label, a date as YYYY-MM-DD, a list joined with \", \". Empty text when blank.",
    engines: ["lib/expressions", "FormulaKit"],
    targets: support(N, U, U, N, N),
  },
  {
    name: "concat",
    aliases: [],
    category: "text",
    params: [any("parts", { rest: true })],
    minArgs: 1,
    maxArgs: null,
    result: "text",
    missing: "handles",
    description: "Joins the parts as text (read like text()); blank parts add nothing, blank when every part is blank. Legacy `\"a\" + [x]` text joins parse to this.",
    engines: ["chart-value"],
    targets: support(N, U, U, N, N),
  },
  {
    name: "substring",
    aliases: [],
    category: "text",
    params: [any("text"), n("start"), n("length", { optional: true })],
    minArgs: 2,
    maxArgs: 3,
    result: "text",
    missing: "propagate",
    description: "Part of the text (read like text()) from character `start` (counted from 0), `length` characters long or to the end. Blank when `start` is outside the text, and when `length` is 0 or negative. FHIRPath substring().",
    engines: ["new"],
    targets: support(N, U, U, N, U),
  },
  {
    name: "upper",
    aliases: [],
    category: "text",
    params: [any("text")],
    minArgs: 1,
    maxArgs: 1,
    result: "text",
    missing: "propagate",
    description: "The text (read like text()) in upper case. FHIRPath upper().",
    engines: ["new"],
    targets: support(N, U, U, N, U),
  },
  {
    name: "lower",
    aliases: [],
    category: "text",
    params: [any("text")],
    minArgs: 1,
    maxArgs: 1,
    result: "text",
    missing: "propagate",
    description: "The text (read like text()) in lower case. FHIRPath lower().",
    engines: ["new"],
    targets: support(N, U, U, N, U),
  },
  {
    name: "replaceMatches",
    aliases: [],
    category: "text",
    params: [any("text"), { name: "regex", type: "text" }, { name: "substitution", type: "text" }],
    minArgs: 3,
    maxArgs: 3,
    result: "text",
    missing: "propagate",
    description: "The text (read like text()) with every match of the regular expression replaced by the substitution (`$1`, `$<name>` name a group; a blank substitution removes the matches). JavaScript regular expressions in single-line Unicode mode; a pattern that could take very long to match (nested or side-by-side repeats, back-references, look-around), an invalid one, or a text over 4,096 characters gives blank. FHIRPath replaceMatches().",
    engines: ["new"],
    targets: support(N, U, U, N, U),
  },

  // ── Dates ───────────────────────────────────────────────────────────────
  {
    name: "today",
    aliases: [],
    category: "date",
    params: [],
    minArgs: 0,
    maxArgs: 0,
    result: "date",
    missing: "handles",
    description: "Today's local calendar date.",
    engines: ["lib/expressions", "FormulaKit"],
    targets: support(N, C, U, N, C),
  },
  {
    name: "now",
    aliases: [],
    category: "date",
    params: [],
    minArgs: 0,
    maxArgs: 0,
    result: "datetime",
    missing: "handles",
    description: "The current date and time.",
    engines: ["new"],
    targets: support(N, C, U, N, U),
  },
  {
    name: "dateAdd",
    aliases: [],
    category: "date",
    params: [d("date"), n("amount"), { name: "unit", type: "unit" }],
    minArgs: 3,
    maxArgs: 3,
    // A date, or a date and time when `date` has a time (types.ts).
    result: "date",
    missing: "propagate",
    description: "The date moved by a whole number of days, weeks, months or years (negative moves back; a fraction is dropped), with FHIRPath calendar semantics: a month or year that lands on a day the month lacks gives the month's last day (31 January + 1 month is 28 or 29 February). A date and time keeps its time of day. FHIRPath `date + 2 years`.",
    engines: ["new"],
    targets: support(N, U, U, C, U),
  },
  {
    name: "durationBetween",
    aliases: [],
    category: "date",
    params: [d("from"), d("to", { optional: true }), { name: "unit", type: "unit", optional: true }],
    minArgs: 1,
    maxArgs: 3,
    result: "duration",
    missing: "handles",
    description: "Elapsed time from `from` to `to` (today when omitted or blank) in days, weeks, months or years (days when omitted). Date-only inputs count whole calendar days; a time on either side counts exact time. Weeks, months and years are exact fractions; floor() or round() them.",
    engines: ["lib/expressions", "FormulaKit"],
    targets: support(N, C, U, U, C),
  },
  {
    name: "durationText",
    aliases: [],
    category: "date",
    params: [d("from"), d("to", { optional: true }), { name: "units", type: "units", optional: true }],
    minArgs: 1,
    maxArgs: 3,
    result: "text",
    missing: "handles",
    description: "A cascading breakdown such as \"2 months, 3 weeks\" over the listed units (\"years,months\" when omitted); `to` defaults to today. Empty text when a date is invalid.",
    engines: ["lib/expressions", "FormulaKit"],
    targets: support(N, U, U, U, U),
  },
  {
    name: "daysBetween",
    aliases: [],
    category: "date",
    params: [d("from"), d("to", { optional: true })],
    minArgs: 1,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "Whole calendar days from `from` to `to` (today when omitted); times of day are ignored.",
    engines: ["lib/expressions"],
    targets: support(N, C, U, U, U),
  },
  {
    name: "monthsBetween",
    aliases: [],
    category: "date",
    params: [d("from"), d("to", { optional: true })],
    minArgs: 1,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "Whole calendar months from `from` to `to` (today when omitted).",
    engines: ["lib/expressions"],
    targets: support(N, C, U, U, U),
  },
  {
    name: "daysSince",
    aliases: [],
    category: "date",
    params: [d("date"), d("reference", { optional: true })],
    minArgs: 1,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "Whole days from the date to the reference (now when omitted): calendar days when both are dates, else completed 24-hour days.",
    engines: ["FormulaKit"],
    targets: support(N, C, U, U, U),
  },
  {
    name: "monthsSince",
    aliases: [],
    category: "date",
    params: [d("date"), d("reference", { optional: true })],
    minArgs: 1,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "Whole calendar months from the date to the reference (now when omitted).",
    engines: ["FormulaKit"],
    targets: support(N, U, U, U, U),
  },
  {
    name: "weekdaysBetween",
    aliases: [],
    category: "date",
    params: [d("from"), d("to"), { name: "skip", type: "any", optional: true }],
    minArgs: 2,
    maxArgs: 3,
    result: "number",
    missing: "propagate",
    description: "Monday–Friday days from `from` to `to`, counting both ends, less the weekday dates in `skip` (a list or comma-separated text). Blank when a date is missing or the range runs backwards.",
    engines: ["lib/expressions", "FormulaKit"],
    targets: support(N, U, U, U, U),
  },
  {
    name: "ageYears",
    aliases: [],
    category: "date",
    params: [d("birthDate"), d("asOf", { optional: true })],
    minArgs: 1,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "Completed years from the birth date to `asOf` (today when omitted or blank).",
    engines: ["new"],
    targets: support(N, C, U, U, C),
  },

  // ── Clinical ────────────────────────────────────────────────────────────
  {
    name: "bmi",
    aliases: [],
    category: "clinical",
    params: [n("weightKg"), n("heightCm")],
    minArgs: 2,
    maxArgs: 2,
    result: "number",
    missing: "propagate",
    description: "Body mass index: weight (kg) ÷ height (m)²; blank unless both are positive.",
    engines: ["lib/expressions"],
    targets: support(N, C, U, N, U),
  },
  {
    name: "zScore",
    aliases: [],
    category: "clinical",
    params: [any("measurement")],
    minArgs: 1,
    maxArgs: 1,
    result: "number",
    missing: "propagate",
    description: "A WHO/CDC growth z-score. Needs the growth reference tables, so the host supplies it through the evaluator's `functions`; blank without it.",
    engines: ["lib/expressions"],
    targets: support(U, U, U, U, U, "changed"),
  },

  // ── The patient's chart ─────────────────────────────────────────────────
  {
    name: "latest",
    aliases: [],
    category: "chart",
    params: [{ name: "observation", type: "observation" }, { name: "options", type: "options", optional: true }],
    minArgs: 1,
    maxArgs: 2,
    // A number when the result is numeric, else its text or choice; a fallback gives its own type.
    result: "unknown",
    missing: "handles",
    description:
      'The patient\'s latest charted result for an observation: `latest({"loinc": "29463-7"}, {"withinMinutes": 1440, "fallback": 0})`. The observation is named like a chart binding (`loinc`, `mois`, `dta` for a Cerner DTA, `system` + `code`, `concept`, and a `unit` results must be in); the options are `withinMinutes`, `aheadMinutes`, `statuses`, `fallback` and `required`. With no result in the window and no fallback it reads like an unanswered field, and a required result that is missing makes the formula incomplete. See chart-results.ts.',
    engines: ["cerner-equation", "new"],
    // MOIS: read by MOIS observation code (a LOINC or DTA through the crosswalk). Cerner: an equation component
    // over the DTA. FHIR: an x-fhir-query variable over a LOINC (or other queryable) code.
    targets: support(C, C, U, C, U, U),
  },
];

const BY_NAME = new Map<string, FormulaFunctionSpec>();
const BY_ALIAS = new Map<string, FormulaFunctionSpec>();
const BY_LOWER = new Map<string, FormulaFunctionSpec>();
for (const spec of FORMULA_FUNCTIONS) {
  BY_NAME.set(spec.name, spec);
  for (const alias of spec.aliases) BY_ALIAS.set(alias, spec);
}
for (const spec of FORMULA_FUNCTIONS) {
  for (const name of [spec.name, ...spec.aliases]) {
    const lower = name.toLowerCase();
    if (!BY_LOWER.has(lower)) BY_LOWER.set(lower, spec);
  }
}

/** A function by canonical name or alias; exact spelling first, then any case (`Sqr`, `Log10`). */
export function findFormulaFunction(name: string): FormulaFunctionSpec | undefined {
  return BY_NAME.get(name) ?? BY_ALIAS.get(name) ?? BY_LOWER.get(name.toLowerCase());
}

/** Whether `count` arguments fit the function's arity. */
export function formulaArityError(spec: FormulaFunctionSpec, count: number): string | null {
  if (count >= spec.minArgs && (spec.maxArgs === null || count <= spec.maxArgs)) return null;
  const expected =
    spec.maxArgs === null
      ? `at least ${spec.minArgs}`
      : spec.minArgs === spec.maxArgs
        ? `${spec.minArgs}`
        : `${spec.minArgs} to ${spec.maxArgs}`;
  return `${spec.name}() takes ${expected} argument${expected === "1" ? "" : "s"}, not ${count}.`;
}

export interface FormulaOperatorSpec {
  op: FormulaBinaryOp | FormulaUnaryOp | "?:";
  arity: 1 | 2 | 3;
  description: string;
  targets: Readonly<Record<FormulaTarget, FormulaTargetSupport>>;
}

/**
 * Operators, with the same per-target support as the functions. The AlayaCare
 * and Docmosis columns of the binary operators and `!` follow those targets'
 * operator tables (lib/targets/capabilities/{alayacare,docmosis}.ts): an
 * AlayaCare score only adds answers, weighs one by a number (`*`, a negative
 * number) and joins blank guards (`&&`, `||`).
 */
export const FORMULA_OPERATORS: readonly FormulaOperatorSpec[] = [
  { op: "+", arity: 2, description: "Addition (numbers only; join text with concat()).", targets: support(N, N, N, N, U) },
  { op: "-", arity: 2, description: "Subtraction.", targets: support(N, N, U, N, U) },
  { op: "*", arity: 2, description: "Multiplication.", targets: support(N, N, C, N, U) },
  { op: "/", arity: 2, description: "Division; blank for a zero divisor.", targets: support(N, N, U, N, U) },
  { op: "%", arity: 2, description: "Remainder, like mod(); blank for a zero divisor.", targets: support(N, U, U, N, U) },
  { op: "^", arity: 2, description: "Power, like power().", targets: support(N, N, U, C, U) },
  { op: "==", arity: 2, description: "Equal (coded answers match by code, value or label; numeric text equals its number).", targets: support(N, N, U, N, C) },
  { op: "!=", arity: 2, description: "Not equal.", targets: support(N, C, U, N, C) },
  { op: "<", arity: 2, description: "Less than (numbers, dates, or text); unknown when a side is blank.", targets: support(N, N, U, N, U) },
  { op: "<=", arity: 2, description: "Less than or equal.", targets: support(N, N, U, N, U) },
  { op: ">", arity: 2, description: "Greater than.", targets: support(N, N, U, N, U) },
  { op: ">=", arity: 2, description: "Greater than or equal.", targets: support(N, N, U, N, U) },
  { op: "&&", arity: 2, description: "And (three-valued: false wins over unknown).", targets: support(N, N, C, N, U) },
  { op: "||", arity: 2, description: "Or (three-valued: true wins over unknown).", targets: support(N, N, C, N, U) },
  { op: "!", arity: 1, description: "Not; unknown stays unknown.", targets: support(N, U, U, N, C) },
  { op: "-", arity: 1, description: "Negation.", targets: support(N, N, C, N, U) },
  { op: "+", arity: 1, description: "Read as a number.", targets: support(N, C, U, C, U) },
  { op: "?:", arity: 3, description: "Conditional, like iif().", targets: support(N, C, C, N, C) },
];

/** Duration units accepted by durationBetween / durationText, with their singular spellings. */
export const FORMULA_DURATION_UNITS: Readonly<Record<string, "days" | "weeks" | "months" | "years">> = {
  day: "days",
  days: "days",
  week: "weeks",
  weeks: "weeks",
  month: "months",
  months: "months",
  year: "years",
  years: "years",
};
