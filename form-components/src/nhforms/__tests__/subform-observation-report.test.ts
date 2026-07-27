/**
 * A subform observation authors its own report body from the named formats in
 * REPORT_ITEM_FORMATS. A webform sends an explicit ObservationInput, so nothing
 * upstream fills `report` in — whatever these formats print is what the chart
 * shows.
 *
 * `promptScore` also reproduces what MOIS's own CALCULATOR save path used to
 * write for dynamic forms (see formid 104, PATIENT HEALTH QUESTIONNAIRE, whose
 * DataWindow carries no report logic at all — nine numeric columns and a sum),
 * so a migrated questionnaire keeps reading the same.
 *
 * The helper is evaluated out of the component source the same way MOIS runs
 * it: transpiled, executed in one injected scope with bare globals.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Babel from "@babel/standalone";
import React from "react";
import { produce } from "immer";

const NH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(NH, "SubformScoring", "index.jsx"), "utf8");

const FluentStub = new Proxy(
  {},
  {
    get: () => (props: { children?: React.ReactNode }) => React.createElement("div", null, props.children),
  }
);

type ObservationUpdate = { observationCode: string; value: string; report?: string; description: string };

function loadBuilder(): (outputs: unknown[], context: unknown) => ObservationUpdate[] {
  const compiled = Babel.transform(source, { presets: ["react"], filename: "index.jsx" }).code ?? "";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function(
    "React",
    "Fluent",
    "useActiveData",
    "useSourceData",
    "produce",
    "getDateTimeString",
    `${compiled}\n; return _buildSubformObservationUpdates;`
  );
  return factory(
    React,
    FluentStub,
    () => [{ field: { data: {} } }, () => {}],
    () => ({}),
    produce,
    () => "2026-07-26 09:00:00"
  );
}

const buildUpdates = loadBuilder();

const PHQ9_QUESTIONS = [
  { id: "phq2_q1", label: "a. Little interest or pleasure in doing things." },
  { id: "phq2_q2", label: "b. Feeling down, depressed, or hopeless." },
  { id: "phq9_q3", label: "c. Trouble falling/staying asleep, sleeping too much." },
];

const SHARED_OPTIONS = [
  { key: "0", text: "Not at all", score: 0 },
  { key: "1", text: "Several days", score: 1 },
  { key: "2", text: "More than half the days", score: 2 },
  { key: "3", text: "Nearly every day", score: 3 },
];

function scoringContext(answers: Record<string, string>) {
  const scoreMap = new Map(
    PHQ9_QUESTIONS.map((question) => [
      question.id,
      new Map(SHARED_OPTIONS.map((option) => [option.key, option.score])),
    ])
  );
  return {
    answers,
    questions: PHQ9_QUESTIONS,
    sharedOptions: SHARED_OPTIONS,
    scoreMap,
    calculatedTotals: { phq9_total: { score: 4 } },
  };
}

const TOTAL_OUTPUT = {
  id: "score_43894",
  observationCode: "43894",
  description: "PHQ-9 TOTAL SCORE",
  source: "total",
  totalId: "phq9_total",
  valueType: "NUMERIC",
};

describe("subform observation report formats", () => {
  it("promptScore writes a heading, then an indented `prompt : score` line per item", () => {
    const [update] = buildUpdates(
      [{ ...TOTAL_OUTPUT, reportFormat: "promptScore", reportHeading: "PATIENT HEALTH QUESTIONNAIRE" }],
      scoringContext({ phq2_q1: "0", phq2_q2: "1", phq9_q3: "3" })
    );

    expect(update.value).toBe("4");
    expect(update.report).toBe(
      [
        "PATIENT HEALTH QUESTIONNAIRE",
        "    a. Little interest or pleasure in doing things. : 0",
        "    b. Feeling down, depressed, or hopeless. : 1",
        "    c. Trouble falling/staying asleep, sleeping too much. : 3",
      ].join("\n")
    );
  });

  it("promptAnswer prints each option's display text instead of its score", () => {
    const [update] = buildUpdates(
      [{ ...TOTAL_OUTPUT, reportFormat: "promptAnswer" }],
      scoringContext({ phq2_q1: "0", phq9_q3: "3" })
    );

    expect(update.report).toBe(
      [
        "a. Little interest or pleasure in doing things.: Not at all",
        "c. Trouble falling/staying asleep, sleeping too much.: Nearly every day",
      ].join("\n")
    );
  });

  it("skips unanswered items instead of emitting empty prompts", () => {
    const [update] = buildUpdates(
      [{ ...TOTAL_OUTPUT, reportFormat: "promptScore" }],
      scoringContext({ phq2_q2: "2" })
    );

    expect(update.report).toBe("    b. Feeling down, depressed, or hopeless. : 2");
  });

  it("formats data-entry fields too, resolving scale options to their descriptions", () => {
    const dataEntryFields = [
      { id: "phq_heading", label: "Section", type: "heading" },
      {
        id: "phq_q1",
        label: "a. Little interest or pleasure in doing things.",
        type: "scale",
        scaleOptions: [
          { value: 0, label: "0", description: "Not at all" },
          { value: 2, label: "2", description: "More than half the days" },
        ],
      },
    ];
    const context = {
      dataEntryFields,
      dataEntryValues: { phq_q1: 2 },
      calculatedExpressions: { phq_total: 2 },
    };
    const output = {
      id: "phq9_total",
      observationCode: "43894",
      description: "Patient Health Questionnaire 9",
      source: "calculation",
      calculationId: "phq_total",
    };

    const [scored] = buildUpdates([{ ...output, reportFormat: "promptScore" }], context);
    expect(scored.report).toBe("    a. Little interest or pleasure in doing things. : 2");

    const [answered] = buildUpdates([{ ...output, reportFormat: "promptAnswer" }], context);
    expect(answered.report).toBe("a. Little interest or pleasure in doing things.: More than half the days");
  });

  it("leaves the custom template path untouched when no format is set", () => {
    const [update] = buildUpdates(
      [{ ...TOTAL_OUTPUT, reportTemplate: "Score {{phq9_total}} recorded" }],
      scoringContext({ phq2_q1: "1" })
    );

    expect(update.report).toBe("Score 4 recorded");
  });

  it("omits report entirely when a format has nothing to print", () => {
    const [update] = buildUpdates(
      [{ ...TOTAL_OUTPUT, reportFormat: "promptAnswer" }],
      scoringContext({})
    );

    expect(update.report).toBeUndefined();
  });
});
