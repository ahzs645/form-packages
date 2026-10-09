import type { PromptValue } from "./types";

/**
 * Prompt-line parsing for XMLCclRequest.send() and the web path's
 * `parameters=` field.
 *
 * Pages quote strings three ways — carets (`^MINE^`, Clinical Office and
 * most Cerner samples), single quotes (`'MINE'`, easy-ccl-request) and double
 * quotes — and send numbers bare. A caret-quoted value may itself contain
 * commas (Clinical Office's trailing `^{"mode":...}^` config JSON), so the
 * split honours quotes. Bare `true` / `false` are CCL keywords for 1 / 0.
 */
export function parsePromptLine(line: string): PromptValue[] {
  const values: PromptValue[] = [];
  let i = 0;
  const text = line ?? "";
  if (!text.trim()) return values;
  while (i <= text.length) {
    while (i < text.length && text[i] === " ") i++;
    const quote = text[i];
    if (quote === "^" || quote === "'" || quote === '"') {
      const end = text.indexOf(quote, i + 1);
      const close = end === -1 ? text.length : end;
      values.push(text.slice(i + 1, close));
      i = close + 1;
      while (i < text.length && text[i] !== ",") i++;
    } else {
      let end = text.indexOf(",", i);
      if (end === -1) end = text.length;
      values.push(bareValue(text.slice(i, end).trim()));
      i = end;
    }
    if (i >= text.length) break;
    i++; // skip comma
    if (i === text.length) values.push("");
  }
  return values;
}

function bareValue(token: string): PromptValue {
  if (/^[+-]?\d+(\.\d+)?$/.test(token)) return Number(token);
  const lower = token.toLowerCase();
  if (lower === "true") return 1;
  if (lower === "false") return 0;
  return token;
}

/** Context variables PowerChart substitutes inside send() before CCL sees the prompts. */
export const CONTEXT_TOKENS = ["$PAT_PersonId$", "$VIS_EncntrId$", "$USR_PersonId$", "$USR_PositionCd$", "$PAT_PPRCode$", "$APP_AppName$"] as const;

/**
 * Substitute PowerChart's context variables, case-insensitively. Ids arrive
 * as `.00` floats the way the client formats them. Only the in-PowerChart
 * transport does this; over Discern Web Services the tokens reach CCL as
 * literal text, which is a real-world bug class worth reproducing.
 */
export function substituteContextTokens(
  line: string,
  context: { personId: number; encntrId: number; prsnlId: number; positionCd: number; appName?: string },
): string {
  const values: Record<string, string> = {
    "$PAT_PERSONID$": `${context.personId}.00`,
    "$VIS_ENCNTRID$": `${context.encntrId}.00`,
    "$USR_PERSONID$": `${context.prsnlId}.00`,
    "$USR_POSITIONCD$": `${context.positionCd}.00`,
    "$PAT_PPRCODE$": "0.00",
    "$APP_APPNAME$": context.appName ?? "PowerChart",
  };
  return line.replace(/\$[A-Za-z]+_[A-Za-z]+\$/g, (token) => values[token.toUpperCase()] ?? token);
}

/** A prompt value as a number (CCL's implicit conversion: non-numeric text is 0). */
export function promptNumber(value: PromptValue | undefined): number {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `name:group1 "arg" 12` → program plus its own prompt values (Clinical Office executes names verbatim). */
export function splitProgramInvocation(name: string): { program: string; prompts: PromptValue[] } {
  const trimmed = name.trim();
  const space = trimmed.search(/\s/);
  if (space === -1) return { program: trimmed, prompts: [] };
  const rest = trimmed.slice(space).trim().replace(/\s+go$/i, "");
  const prompts: PromptValue[] = [];
  let i = 0;
  while (i < rest.length) {
    while (i < rest.length && /[\s,]/.test(rest[i])) i++;
    if (i >= rest.length) break;
    const quote = rest[i];
    if (quote === "^" || quote === "'" || quote === '"') {
      const end = rest.indexOf(quote, i + 1);
      const close = end === -1 ? rest.length : end;
      prompts.push(rest.slice(i + 1, close));
      i = close + 1;
    } else {
      let end = i;
      while (end < rest.length && !/[\s,]/.test(rest[end])) end++;
      prompts.push(bareValue(rest.slice(i, end)));
      i = end;
    }
  }
  return { program: trimmed.slice(0, space), prompts };
}

/** Lower-case and drop the `:groupN` suffix: how two spellings of one program are compared. */
export function programKey(name: string): string {
  return name.trim().toLowerCase().replace(/:group\d+$/, "");
}
