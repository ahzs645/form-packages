/**
 * Report-body formats.
 *
 * An observation's long-form `report` can be authored in two places — a
 * subform's completion output, or a workflow report over top-level fields —
 * and both should be able to produce the same text. A format fixes the shape of
 * one line: what it prints, how the prompt and value are separated, and how far
 * it is indented. Pick a format on either surface and the bodies match.
 *
 * The alternative to a format is `reportTemplate`, a hand-written body with
 * `{{token}}` substitution, for anything these shapes don't cover.
 */

export type ReportItemFormat = "promptAnswer" | "promptScore";

export interface ReportItemFormatSpec {
  /** Menu label for the format pickers. */
  label: string;
  /** One-line explanation shown beside the picker. */
  description: string;
  /**
   * What each line prints for its value. "answer" uses the chosen option's
   * display text; "score" uses its numeric score. Only meaningful where the
   * item has coded options — a plain field prints its own value either way.
   */
  value: "answer" | "score";
  /** Between prompt and value. */
  separator: string;
  /** Prefixed to every item line. */
  indent: string;
}

export const REPORT_ITEM_FORMATS: Record<ReportItemFormat, ReportItemFormatSpec> = {
  promptAnswer: {
    label: "Prompt and answer",
    description: "One “Prompt: answer” line per answered item, using each option’s display text.",
    value: "answer",
    separator: ": ",
    indent: "",
  },
  promptScore: {
    label: "Prompt and score",
    description:
      "One indented “Prompt : score” line per answered item. This is also the shape MOIS’s own calculator engine wrote, so these rows line up with observations carried over from a dynamic form.",
    value: "score",
    separator: " : ",
    indent: "    ",
  },
};

export const REPORT_ITEM_FORMAT_IDS = Object.keys(REPORT_ITEM_FORMATS) as ReportItemFormat[];

export function isReportItemFormat(value: unknown): value is ReportItemFormat {
  return typeof value === "string" && value in REPORT_ITEM_FORMATS;
}

/** The format's spec, or `promptAnswer`'s when unset or unrecognized. */
export function resolveReportItemFormat(value: unknown): ReportItemFormatSpec {
  return isReportItemFormat(value) ? REPORT_ITEM_FORMATS[value] : REPORT_ITEM_FORMATS.promptAnswer;
}
