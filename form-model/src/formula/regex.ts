/**
 * Regular expressions in formulas: `replaceMatches(text, regex, substitution)`
 * (FHIRPath, https://hl7.org/fhirpath/#replacematchesregex--string-substitution-string--string).
 *
 * A formula runs on every keystroke, in the builder and in the exported MOIS
 * form, on patterns that come from imported questionnaires or a form's
 * author. A JavaScript regular expression backtracks, so a pattern such as
 * `(a+)+$` takes exponential time on a long enough answer. Both engines run
 * this module (FormulaKit is generated from the reference evaluator), and
 * both refuse the same patterns, so they cannot disagree:
 *
 * - at most 200 characters, and it must compile as a JavaScript `u` pattern;
 * - no back-references (`\1`, `\k<name>`) and no look-around (`(?=`, `(?!`,
 *   `(?<=`, `(?<!`);
 * - no quantifier on a group that itself repeats or has alternatives
 *   (`(a+)+`, `(a|ab)*`, `(\w*){2,}`): the exponential cases;
 * - no two repeating parts side by side with nothing required between them
 *   (`\d+\d*`, `.*.*`, `(\d+)(\d+)`): the polynomial ones;
 * - the text is at most 4,096 characters (a longer answer gives blank).
 *
 * The flags are `g` (every match), `s` (FHIRPath's "single line" mode: `.`
 * matches a line break) and `u` (Unicode). FHIRPath recommends the PCRE
 * flavour but lets platforms use their own; this is JavaScript's, the one
 * fhirpath.js uses. The substitution is JavaScript's too: `$1`, `$<name>`,
 * `$&` and `$$`; the `${name}` of the FHIRPath specification's example is
 * literal text (as in fhirpath.js).
 *
 * Keep it plain ECMAScript: it is bundled into the NHForms FormulaKit.
 */

export const FORMULA_REGEX_MAX_LENGTH = 200;
export const FORMULA_REGEX_MAX_TEXT = 4096;
export const FORMULA_REGEX_FLAGS = "gsu";

/** A `{n,m}` repeat counts as unbounded above this many extra repetitions. */
const BOUNDED_REPEAT = 20;

const compiled = new Map<string, RegExp | string>();

interface Group {
  /** Some part of it repeats without a small bound, at any depth. */
  repeats: boolean;
  /** It has `|` at its own level. */
  alternation: boolean;
  /** In the current alternative: a repeating part with nothing required after it yet. */
  pending: boolean;
  /** In the current alternative: something required that does not repeat has been met. */
  separated: boolean;
  /** Some alternative starts with a repeating part (before anything required). */
  leading: boolean;
  /** Some finished alternative ends with a repeating part. */
  trailing: boolean;
  /** Every finished alternative has something required that does not repeat. */
  separatedAll: boolean;
}

const newGroup = (): Group => ({ repeats: false, alternation: false, pending: false, separated: false, leading: false, trailing: false, separatedAll: true });

/** Ends the current alternative of a group. */
function endAlternative(group: Group): void {
  if (group.pending) group.trailing = true;
  if (!group.separated) group.separatedAll = false;
  group.pending = false;
  group.separated = false;
}

const SIDE_BY_SIDE =
  "Two repeating parts sit side by side with nothing required between them (\\d+\\d*, .*.*), which can take very long to match; put a fixed character between them or merge them.";
const NESTED =
  "A group that repeats has a repeating part or alternatives inside it ((a+)+, (a|ab)*), which can take very long to match; write alternatives of single characters as a class ([ab]+ for (a|b)+).";

/**
 * Why a pattern is refused (invalid, too long, or one that can backtrack
 * catastrophically), or null when it is safe to run. The answer is cached.
 */
export function formulaRegexProblem(pattern: string): string | null {
  const result = compileFormulaRegex(pattern);
  return typeof result === "string" ? result : null;
}

/** The compiled pattern, or why it is refused. */
export function compileFormulaRegex(pattern: string): RegExp | string {
  const cached = compiled.get(pattern);
  if (cached !== undefined) return cached;
  const result = analyse(pattern);
  if (compiled.size > 256) compiled.clear();
  compiled.set(pattern, result);
  return result;
}

/**
 * `replaceMatches(text, regex, substitution)` on plain values: null when the
 * text or the regex is blank, when the pattern is refused or the text is too
 * long. A blank substitution removes the matches. An empty result is blank.
 */
export function replaceFormulaMatches(text: string, pattern: string, substitution: string): string | null {
  if (text.length > FORMULA_REGEX_MAX_TEXT) return null;
  const regex = compileFormulaRegex(pattern);
  if (typeof regex === "string") return null;
  regex.lastIndex = 0;
  const out = text.replace(regex, substitution);
  return out === "" ? null : out;
}

function analyse(pattern: string): RegExp | string {
  if (pattern.length === 0) return "The pattern is empty.";
  if (pattern.length > FORMULA_REGEX_MAX_LENGTH) return `The pattern is longer than ${FORMULA_REGEX_MAX_LENGTH} characters.`;
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, FORMULA_REGEX_FLAGS);
  } catch (error) {
    return `The pattern is not a valid regular expression (${error instanceof Error ? error.message : String(error)}).`;
  }
  const problem = backtrackingProblem(pattern);
  return problem ?? regex;
}

/** Walks the (already valid) pattern once, tracking groups, repeats and alternatives. */
function backtrackingProblem(pattern: string): string | null {
  const stack: Group[] = [newGroup()];
  const top = () => stack[stack.length - 1];
  let index = 0;

  /** A part that is not a group: a character, a class or an escape, with its quantifier. */
  const placeAtom = (unbounded: boolean, optional: boolean): string | null => {
    const group = top();
    if (unbounded) {
      if (group.pending) return SIDE_BY_SIDE;
      if (!group.separated) group.leading = true;
      group.repeats = true;
      group.pending = true;
    } else if (!optional) {
      group.pending = false;
      group.separated = true;
    }
    return null;
  };

  /** The quantifier at `index`, if any, and where it ends. */
  const quantifier = (): { unbounded: boolean; optional: boolean; repeats: boolean; end: number } | null => {
    const char = pattern[index];
    let end = index + 1;
    let result: { unbounded: boolean; optional: boolean; repeats: boolean } | null = null;
    if (char === "*") result = { unbounded: true, optional: true, repeats: true };
    else if (char === "+") result = { unbounded: true, optional: false, repeats: true };
    else if (char === "?") result = { unbounded: false, optional: true, repeats: false };
    else if (char === "{") {
      const match = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(index));
      if (!match) return null;
      const min = Number(match[1]);
      const max = match[2] === undefined ? min : match[3] === "" ? Infinity : Number(match[3]);
      end = index + match[0].length;
      result = { unbounded: max - min > BOUNDED_REPEAT, optional: min === 0, repeats: max > 1 };
    }
    if (!result) return null;
    if (pattern[end] === "?") end += 1; // lazy: the same backtracking
    return { ...result, end };
  };

  while (index < pattern.length) {
    const char = pattern[index];
    if (char === "(") {
      if (pattern.startsWith("(?=", index) || pattern.startsWith("(?!", index) || pattern.startsWith("(?<=", index) || pattern.startsWith("(?<!", index)) {
        return "The pattern looks ahead or behind ((?=, (?!, (?<=, (?<!), which formulas do not allow.";
      }
      stack.push(newGroup());
      index = pattern.startsWith("(?:", index) ? index + 3 : pattern.startsWith("(?<", index) ? pattern.indexOf(">", index) + 1 : index + 1;
      continue;
    }
    if (char === "|") {
      top().alternation = true;
      endAlternative(top());
      index += 1;
      continue;
    }
    if (char === "^" || char === "$") {
      index += 1;
      continue;
    }
    if (char === ")") {
      const group = stack.pop()!;
      if (stack.length === 0) return "The pattern's groups are unbalanced.";
      endAlternative(group);
      index += 1;
      const repeat = quantifier();
      if (repeat) index = repeat.end;
      const parent = top();
      if (repeat?.repeats) {
        if (group.repeats || group.alternation) return NESTED;
        const problem = placeAtom(repeat.unbounded, repeat.optional);
        if (problem) return problem;
        continue;
      }
      // Not repeated (or only optional): the group's own parts meet its neighbours.
      if (parent.pending && group.leading) return SIDE_BY_SIDE;
      if (group.repeats) parent.repeats = true;
      if (!parent.separated && group.leading) parent.leading = true;
      const separates = group.separatedAll && !repeat?.optional;
      parent.pending = group.trailing || (!separates && parent.pending);
      if (separates) parent.separated = true;
      continue;
    }

    let atomEnd = index + 1;
    if (char === "\\") {
      const next = pattern[index + 1] ?? "";
      if (/[1-9]/.test(next) || next === "k") return "The pattern refers back to a group (\\1, \\k<name>), which formulas do not allow.";
      atomEnd = index + 2;
      if ((next === "u" || next === "p" || next === "P") && pattern[index + 2] === "{") atomEnd = pattern.indexOf("}", index) + 1;
      else if (next === "u") atomEnd = index + 6;
      else if (next === "x") atomEnd = index + 4;
      else if (next === "c") atomEnd = index + 3;
    } else if (char === "[") {
      let cursor = index + 1;
      if (pattern[cursor] === "^") cursor += 1;
      while (cursor < pattern.length && pattern[cursor] !== "]") cursor += pattern[cursor] === "\\" ? 2 : 1;
      atomEnd = cursor + 1;
    }
    index = atomEnd;
    const repeat = quantifier();
    if (repeat) index = repeat.end;
    const problem = placeAtom(Boolean(repeat?.unbounded), Boolean(repeat?.optional));
    if (problem) return problem;
  }
  return stack.length === 1 ? null : "The pattern's groups are unbalanced.";
}
