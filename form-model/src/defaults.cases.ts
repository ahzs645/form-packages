/**
 * Shared cases for the default-answer reader, writer and resolver. The
 * TypeScript module (defaults.ts) and the generated NHForms DefaultsKit both
 * run this table, so the exported form seeds exactly what the builder reads.
 */
import type { BuilderDefaultAnswer, DefaultAnswerContext, ReadDefaultAnswerOptions, WriteDefaultAnswerOptions } from "./defaults";

export type DefaultCase =
  | { fn: "read"; name: string; args: [unknown, ReadDefaultAnswerOptions?]; expected: BuilderDefaultAnswer | null }
  | { fn: "write"; name: string; args: [object, BuilderDefaultAnswer | null, WriteDefaultAnswerOptions?]; expected: unknown }
  | { fn: "patch"; name: string; args: [object, BuilderDefaultAnswer | null, WriteDefaultAnswerOptions?]; expected: unknown }
  | { fn: "resolve"; name: string; args: [BuilderDefaultAnswer | null, DefaultAnswerContext]; expected: unknown }
  | { fn: "temporal"; name: string; args: [unknown]; expected: "date" | "dateTime" | "time" | null };

/** 27 September 2026, 14:05 local time. */
export const CASE_NOW = new Date(2026, 8, 27, 14, 5, 30);

const today = { kind: "today" } as const;
const now = { kind: "now" } as const;
const literal = (value: unknown) => ({ kind: "literal", value }) as BuilderDefaultAnswer;
const YES_NO_CODED = [{ value: "Y", label: "Yes" }, { value: "N", label: "No" }];

export const DEFAULT_CASES: DefaultCase[] = [
  // --- prefill (fields, table columns, layout cells) ---------------------
  { fn: "read", name: "prefill text", args: [{ id: "a", type: "text", prefill: "Y" }], expected: literal("Y") },
  { fn: "read", name: "prefill number", args: [{ id: "a", type: "number", prefill: 10 }], expected: literal(10) },
  { fn: "read", name: "prefill false is an answer", args: [{ id: "a", type: "booleanYesNo", prefill: false }], expected: literal(false) },
  { fn: "read", name: "prefill list", args: [{ id: "a", type: "choice", choiceStyle: "checkbox", prefill: ["x", "y"] }], expected: literal(["x", "y"]) },
  { fn: "read", name: "prefill coding", args: [{ id: "a", type: "component", prefill: { code: "E2E", display: "E2E" } }], expected: literal({ code: "E2E", display: "E2E" }) },
  { fn: "read", name: "blank prefill", args: [{ id: "a", type: "text", prefill: "" }], expected: null },
  { fn: "read", name: "null prefill", args: [{ id: "a", type: "text", prefill: null }], expected: null },
  { fn: "read", name: "empty list prefill", args: [{ id: "a", type: "choice", prefill: [] }], expected: null },
  { fn: "read", name: "no default", args: [{ id: "a", type: "text" }], expected: null },
  { fn: "read", name: "rich text content is not a default", args: [{ id: "a", type: "richText", prefill: "**Note**" }], expected: null },
  { fn: "read", name: "editable rich text keeps its default", args: [{ id: "a", type: "richText", richTextConfig: { readOnly: false }, prefill: "Draft" }], expected: literal("Draft") },
  { fn: "read", name: "heading text is not a default", args: [{ id: "a", type: "heading", prefill: "Title" }], expected: null },

  // --- dateConfig.prefillToday ---------------------------------------------
  { fn: "read", name: "date prefillToday", args: [{ id: "d", type: "date", dateConfig: { prefillToday: true } }], expected: today },
  { fn: "read", name: "date-time prefillToday is now", args: [{ id: "d", type: "datetime", dateConfig: { prefillToday: true } }], expected: now },
  { fn: "read", name: "date with time picker prefillToday is now", args: [{ id: "d", type: "date", dateConfig: { withTime: true, prefillToday: true } }], expected: now },
  { fn: "read", name: "a specific date wins over prefillToday", args: [{ id: "d", type: "date", prefill: "2026-08-18", dateConfig: { prefillToday: true } }], expected: literal("2026-08-18") },
  { fn: "read", name: "prefillToday false", args: [{ id: "d", type: "date", dateConfig: { prefillToday: false } }], expected: null },
  { fn: "read", name: "prefillToday on a text field is ignored", args: [{ id: "t", type: "text", dateConfig: { prefillToday: true } }], expected: null },
  { fn: "read", name: "parsed date field", args: [{ id: "d", kind: "date", rawType: "date", prefillToday: true, dateWithTime: false }], expected: today },
  { fn: "read", name: "parsed date-time field", args: [{ id: "d", kind: "date", rawType: "datetime", prefillToday: true, dateWithTime: true }], expected: now },
  { fn: "read", name: "parsed text field prefill", args: [{ id: "t", kind: "text", rawType: "text", prefill: "x" }], expected: literal("x") },

  // --- table columns ------------------------------------------------------
  { fn: "read", name: "column { kind: today } prefill", args: [{ id: "c", type: "date", prefill: { kind: "today" } }], expected: today },
  { fn: "read", name: "column date-time prefillToday", args: [{ id: "c", type: "date", withTime: true, dataPath: "when", dateConfig: { prefillToday: true } }], expected: now },
  { fn: "read", name: "checkbox column prefill", args: [{ id: "c", type: "checkbox", prefill: true }], expected: literal(true) },
  { fn: "read", name: "row-relative prefill is left to its runtime", args: [{ id: "c", type: "date", prefill: { kind: "nextDateAfterLastRow", sourceColumn: "Date" } }], expected: null },

  // --- subform data-entry entries -----------------------------------------
  { fn: "read", name: "entry __today", args: [{ id: "e", type: "date", defaultValue: "__today" }], expected: today },
  { fn: "read", name: "entry __now", args: [{ id: "e", type: "datetime", defaultValue: "__now" }], expected: now },
  { fn: "read", name: "entry literal", args: [{ id: "e", type: "choice", defaultValue: "leg" }], expected: literal("leg") },
  { fn: "read", name: "entry blank", args: [{ id: "e", type: "textarea", defaultValue: "" }], expected: null },
  { fn: "read", name: "entry { kind: today } (row editor)", args: [{ id: "Date", type: "date", defaultValue: { kind: "today" } }, { shape: "subformEntry" }], expected: today },
  { fn: "read", name: "entry nextDateAfterLastRow", args: [{ id: "Date", type: "date", defaultValue: { kind: "nextDateAfterLastRow", sourceColumn: "Date" } }, { shape: "subformEntry" }], expected: null },
  { fn: "read", name: "entry yes/no token", args: [{ id: "e", type: "booleanYesNo", options: YES_NO_CODED, defaultValue: "N" }], expected: literal(false) },
  { fn: "read", name: "entry yes/no label", args: [{ id: "e", type: "booleanYesNo", options: ["Yes", "No"], defaultValue: "yes" }], expected: literal(true) },
  { fn: "read", name: "entry text with the shape given", args: [{ id: "e", type: "text" }, { shape: "subformEntry" }], expected: null },
  { fn: "read", name: "defaultFromObservation", args: [{ id: "sdai_swollen", type: "number", defaultFromObservation: { observationCode: "61838" } }], expected: { kind: "lastObservation", code: "61838" } },
  { fn: "read", name: "defaultFromObservation wins over defaultValue", args: [{ id: "e", type: "number", defaultValue: 3, defaultFromObservation: { observationCode: "CRP" } }], expected: { kind: "lastObservation", code: "CRP" } },
  { fn: "read", name: "bringForward false turns the observation off", args: [{ id: "e", type: "number", defaultFromObservation: { observationCode: "CRP" } }, { bringForward: false }], expected: null },
  { fn: "read", name: "bringForward false keeps the other default", args: [{ id: "e", type: "number", defaultValue: 3, defaultFromObservation: { observationCode: "CRP" } }, { bringForward: false }], expected: literal(3) },
  { fn: "read", name: "defaultFromObservation with system and look-back", args: [{ id: "e", type: "number", defaultFromObservation: { observationCode: "4548-4", system: "http://loinc.org", lookbackDays: 90 } }], expected: { kind: "lastObservation", code: "4548-4", system: "http://loinc.org", lookbackDays: 90 } },

  // --- layout cells ---------------------------------------------------------
  { fn: "read", name: "cell bound to the clock in initial mode", args: [{ id: "c", kind: "field", fieldId: "formDate", inputType: "date", sourcePaths: ["system.currentDate"], sourceMode: "initial" }], expected: today },
  { fn: "read", name: "cell bound to the clock with time", args: [{ id: "c", kind: "field", fieldId: "at", inputType: "text", sourcePaths: ["system.currentDateTime", "system.currentDate"], sourceMode: "initial" }], expected: now },
  { fn: "read", name: "cell bound to the clock while live", args: [{ id: "c", kind: "field", fieldId: "formDate", inputType: "date", sourcePaths: ["system.currentDate"] }], expected: null },
  { fn: "read", name: "cell bound to the chart with a clock fallback", args: [{ id: "c", kind: "field", fieldId: "formDate", inputType: "date", sourcePaths: ["webform.documentDate", "webform.createdDate", "system.currentDate"], sourceMode: "initial" }], expected: null },
  { fn: "read", name: "bound cell's defaultValue is its fallback", args: [{ id: "c", kind: "field", fieldId: "who", inputType: "text", sourcePaths: ["userProfile.identity.fullName"], defaultValue: "Unknown" }], expected: null },
  { fn: "read", name: "field cell defaultValue", args: [{ id: "c", kind: "field", fieldId: "site", inputType: "text", defaultValue: "Clinic" }], expected: literal("Clinic") },
  { fn: "read", name: "field cell prefill wins over defaultValue", args: [{ id: "c", kind: "field", fieldId: "site", inputType: "text", prefill: "Home", defaultValue: "Clinic" }], expected: literal("Home") },
  { fn: "read", name: "field-list child defaultValue", args: [{ id: "n", fieldId: "n", inputType: "number", defaultValue: 0 }], expected: literal(0) },
  { fn: "read", name: "static text cell defaultValue is display text", args: [{ id: "c", kind: "text", defaultValue: "N/A" }], expected: null },
  { fn: "read", name: "computed cell defaultValue is display text", args: [{ id: "c", kind: "computed", fieldId: "total", formula: "a + b", defaultValue: 0 }], expected: null },

  // --- defaultAnswer and its mirrors ---------------------------------------
  { fn: "read", name: "stored literal with its mirror", args: [{ id: "a", type: "text", prefill: "x", defaultAnswer: literal("x") }], expected: literal("x") },
  { fn: "read", name: "a legacy edit after the descriptor wins", args: [{ id: "a", type: "text", prefill: "y", defaultAnswer: literal("x") }], expected: literal("y") },
  { fn: "read", name: "a legacy clear after the descriptor wins", args: [{ id: "a", type: "text", prefill: null, defaultAnswer: literal("x") }], expected: null },
  { fn: "read", name: "a legacy today switched off after the descriptor wins", args: [{ id: "d", type: "date", dateConfig: { prefillToday: false }, defaultAnswer: today }], expected: null },
  { fn: "read", name: "a descriptor written alone stands", args: [{ id: "a", type: "text", defaultAnswer: literal("x") }], expected: literal("x") },
  { fn: "read", name: "an undefined legacy key is absent", args: [{ id: "a", type: "text", prefill: undefined, defaultAnswer: literal("x") }], expected: literal("x") },
  { fn: "read", name: "a today descriptor alone on a date-time column", args: [{ id: "c", type: "date", withTime: true, dateConfig: { dateFormat: "yyyy-MM-dd" }, defaultAnswer: now }], expected: now },
  { fn: "read", name: "an entry descriptor alone", args: [{ id: "e", type: "date", defaultAnswer: today }, { shape: "subformEntry" }], expected: today },
  { fn: "read", name: "stored now on a date field", args: [{ id: "d", type: "date", dateConfig: { prefillToday: true }, defaultAnswer: now }], expected: now },
  { fn: "read", name: "stored today on a date-time field", args: [{ id: "d", type: "datetime", dateConfig: { prefillToday: true }, defaultAnswer: today }], expected: today },
  { fn: "read", name: "stored last observation on a field", args: [{ id: "w", type: "number", defaultAnswer: { kind: "lastObservation", code: "WEIGHT", lookbackDays: 30 } }], expected: { kind: "lastObservation", code: "WEIGHT", lookbackDays: 30 } },
  { fn: "read", name: "stored chart concept", args: [{ id: "p", type: "text", defaultAnswer: { kind: "chart", concept: "patient.phn" } }], expected: { kind: "chart", concept: "patient.phn" } },
  { fn: "read", name: "a malformed descriptor is ignored", args: [{ id: "a", type: "text", prefill: "x", defaultAnswer: { kind: "bogus" } }], expected: literal("x") },
  { fn: "read", name: "a blank literal descriptor is no default", args: [{ id: "a", type: "text", defaultAnswer: literal("") }], expected: null },
  { fn: "read", name: "stored entry descriptor with its mirror", args: [{ id: "e", type: "booleanYesNo", options: YES_NO_CODED, defaultValue: "Y", defaultAnswer: literal(true) }, { shape: "subformEntry" }], expected: literal(true) },
  { fn: "read", name: "stored entry observation with bringForward off", args: [{ id: "e", type: "number", defaultFromObservation: { observationCode: "CRP" }, defaultAnswer: { kind: "lastObservation", code: "CRP" } }, { shape: "subformEntry", bringForward: false }], expected: null },
  { fn: "read", name: "stored cell today over the clock binding", args: [{ id: "c", kind: "field", fieldId: "d", inputType: "date", sourcePaths: ["system.currentDate"], sourceMode: "initial", defaultAnswer: today }], expected: today },
  { fn: "read", name: "not an object", args: ["x"], expected: null },

  // --- write ---------------------------------------------------------------
  { fn: "write", name: "literal on a field", args: [{ id: "a", type: "text" }, literal("x")], expected: { id: "a", type: "text", prefill: "x", defaultAnswer: literal("x") } },
  {
    fn: "write",
    name: "today on a date field replaces a specific date",
    args: [{ id: "d", type: "date", prefill: "2026-01-02", dateConfig: { dateFormat: "yyyy-MM-dd" } }, today],
    expected: { id: "d", type: "date", dateConfig: { dateFormat: "yyyy-MM-dd", prefillToday: true }, defaultAnswer: today },
  },
  {
    fn: "write",
    name: "clearing a date default",
    args: [{ id: "d", type: "date", dateConfig: { prefillToday: true }, defaultAnswer: today }, null],
    expected: { id: "d", type: "date", dateConfig: {} },
  },
  {
    fn: "write",
    name: "last observation on a field has no legacy mirror",
    args: [{ id: "w", type: "number", prefill: 70 }, { kind: "lastObservation", code: "WEIGHT" }],
    expected: { id: "w", type: "number", defaultAnswer: { kind: "lastObservation", code: "WEIGHT" } },
  },
  {
    fn: "write",
    name: "now on a date-time column",
    args: [{ id: "c", type: "date", withTime: true, prefill: { kind: "today" } }, now, { shape: "tableColumn" }],
    expected: { id: "c", type: "date", withTime: true, dateConfig: { prefillToday: true }, defaultAnswer: now },
  },
  {
    fn: "write",
    name: "yes/no literal on an entry stores the option token",
    args: [{ id: "e", type: "booleanYesNo", options: YES_NO_CODED }, literal(false), { shape: "subformEntry" }],
    expected: { id: "e", type: "booleanYesNo", options: YES_NO_CODED, defaultValue: "N", defaultAnswer: literal(false) },
  },
  {
    fn: "write",
    name: "today on an entry",
    args: [{ id: "e", type: "date", defaultValue: "2026-01-01" }, today, { shape: "subformEntry" }],
    expected: { id: "e", type: "date", defaultValue: "__today", defaultAnswer: today },
  },
  {
    fn: "write",
    name: "last observation on an entry keeps the binding's aspect",
    args: [{ id: "e", type: "text", defaultValue: "x", defaultFromObservation: { observationCode: "CRP", aspect: "comment" } }, { kind: "lastObservation", code: "CRP", lookbackDays: 7 }, { shape: "subformEntry" }],
    expected: { id: "e", type: "text", defaultFromObservation: { observationCode: "CRP", lookbackDays: 7, aspect: "comment" }, defaultAnswer: { kind: "lastObservation", code: "CRP", lookbackDays: 7 } },
  },
  {
    fn: "write",
    name: "a fixed value on a clock-bound cell drops the binding",
    args: [{ id: "c", kind: "field", fieldId: "d", inputType: "date", sourcePaths: ["system.currentDate"], sourceMode: "initial", sourceFormat: "date" }, literal("2026-01-01")],
    expected: { id: "c", kind: "field", fieldId: "d", inputType: "date", prefill: "2026-01-01", defaultAnswer: literal("2026-01-01") },
  },
  {
    fn: "write",
    name: "a field cell's defaultValue moves to prefill",
    args: [{ id: "c", kind: "field", fieldId: "site", inputType: "text", defaultValue: "Clinic" }, literal("Home")],
    expected: { id: "c", kind: "field", fieldId: "site", inputType: "text", prefill: "Home", defaultAnswer: literal("Home") },
  },
  {
    fn: "write",
    name: "a chart-bound cell keeps its binding and fallback",
    args: [{ id: "c", kind: "field", fieldId: "who", inputType: "text", sourcePaths: ["userProfile.identity.fullName"], defaultValue: "Unknown" }, null],
    expected: { id: "c", kind: "field", fieldId: "who", inputType: "text", sourcePaths: ["userProfile.identity.fullName"], defaultValue: "Unknown" },
  },

  // --- patch ---------------------------------------------------------------
  {
    fn: "patch",
    name: "today patch on a date field",
    args: [{ id: "d", type: "date", prefill: "2026-01-02", dateConfig: { dateFormat: "yyyy-MM-dd" } }, today],
    expected: { prefill: null, dateConfig: { dateFormat: "yyyy-MM-dd", prefillToday: true }, defaultAnswer: today },
  },
  {
    fn: "patch",
    name: "clear patch",
    args: [{ id: "a", type: "text", prefill: "x", defaultAnswer: literal("x") }, null],
    expected: { prefill: null, defaultAnswer: null },
  },
  { fn: "patch", name: "unchanged patch is empty", args: [{ id: "a", type: "text", prefill: "x", defaultAnswer: literal("x") }, literal("x")], expected: {} },

  // --- resolve -------------------------------------------------------------
  { fn: "resolve", name: "literal", args: [literal(["a", "b"]), { now: CASE_NOW }], expected: ["a", "b"] },
  { fn: "resolve", name: "no default", args: [null, { now: CASE_NOW }], expected: undefined },
  { fn: "resolve", name: "today", args: [today, { now: CASE_NOW, fieldType: "date" }], expected: "2026-09-27" },
  { fn: "resolve", name: "today on a date-time", args: [today, { now: CASE_NOW, fieldType: "datetime" }], expected: "2026-09-27" },
  { fn: "resolve", name: "today on a time", args: [today, { now: CASE_NOW, fieldType: "time" }], expected: undefined },
  { fn: "resolve", name: "now", args: [now, { now: CASE_NOW }], expected: "2026-09-27T14:05" },
  { fn: "resolve", name: "now on a date", args: [now, { now: CASE_NOW, fieldType: "date" }], expected: "2026-09-27" },
  { fn: "resolve", name: "now on a time", args: [now, { now: CASE_NOW, fieldType: "time" }], expected: "14:05" },
  { fn: "resolve", name: "chart without a reader", args: [{ kind: "chart", concept: "patient.phn" }, { now: CASE_NOW }], expected: undefined },
  {
    fn: "resolve",
    name: "chart with a reader",
    args: [{ kind: "chart", concept: "patient.phn", paths: ["patient.phn"] }, { now: CASE_NOW, readChart: (target) => (target.paths?.[0] === "patient.phn" && target.concept === "patient.phn" ? "9876543210" : undefined) }],
    expected: "9876543210",
  },
  { fn: "resolve", name: "chart reader finds nothing", args: [{ kind: "chart", paths: ["x"] }, { now: CASE_NOW, readChart: () => "" }], expected: undefined },
  {
    fn: "resolve",
    name: "last observation",
    args: [{ kind: "lastObservation", code: "WEIGHT", system: "MOIS", lookbackDays: 30 }, { now: CASE_NOW, readLastObservation: (code, system, lookbackDays) => `${code}|${system}|${lookbackDays}` }],
    expected: "WEIGHT|MOIS|30",
  },
  { fn: "resolve", name: "last observation without a reader", args: [{ kind: "lastObservation", code: "WEIGHT" }, { now: CASE_NOW }], expected: undefined },

  // --- temporal kinds --------------------------------------------------------
  { fn: "temporal", name: "date field", args: [{ type: "date" }], expected: "date" },
  { fn: "temporal", name: "date field with a time picker", args: [{ type: "date", dateConfig: { withTime: true } }], expected: "dateTime" },
  { fn: "temporal", name: "date-time field", args: [{ type: "datetime" }], expected: "dateTime" },
  { fn: "temporal", name: "date-time column", args: [{ type: "date", withTime: true }], expected: "dateTime" },
  { fn: "temporal", name: "layout date cell", args: [{ kind: "field", inputType: "date" }], expected: "date" },
  { fn: "temporal", name: "time entry", args: [{ type: "time" }], expected: "time" },
  { fn: "temporal", name: "text field", args: [{ type: "text" }], expected: null },
];
