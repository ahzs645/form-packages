/**
 * Scoring subforms arrive in two spellings: the builder's (an option
 * `{ id, label, score }`, a total term naming its answer field
 * `answerFieldId`) and the runtime's, which the subform library, legacy
 * SubformScoring components and older saves use (an option
 * `{ key, text, score }`, a term naming its question `questionId`). The
 * builder edits only its own spelling; the MOIS exporter
 * (scoring-renderer.ts) reads either, so converting changes nothing it emits:
 * an option's `key` becomes its `id`, which the exporter reads back as the
 * key when there is none, and a question's term names that question's
 * answer field, which the exporter maps back to the question.
 */
import type { ScoreTotalTerm } from "./index";
import type { GroupLayoutDraft, ModuleConfig, ModuleQuestionConfig, QuestionOptionConfig, ScoreTotalConfig, ScoringModuleConfig } from "./layout";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/** One answer option in the builder's spelling. Unchanged (same object) when already in it. */
export function normalizeScoringOption(option: unknown, index: number): QuestionOptionConfig {
  const record = isRecord(option) ? option : {};
  const hasBuilderShape = typeof record.id === "string" && typeof record.label === "string" && !("key" in record) && !("text" in record);
  if (hasBuilderShape) return option as QuestionOptionConfig;
  const { key, text: optionText, ...rest } = record;
  // The exporter's key is key, then state, then id: keep that order.
  const id = text(key) ?? text(rest.state) ?? text(rest.id) ?? `opt_${index}`;
  const label = text(optionText) ?? text(rest.label) ?? text(rest.state) ?? id;
  const score = Number(rest.score);
  return { ...rest, id, label, score: Number.isFinite(score) ? score : 0 } as QuestionOptionConfig;
}

/** A total's term in the builder's spelling: a question named by id becomes its answer field. */
function normalizeScoringTerm(term: unknown, questionsById: ReadonlyMap<string, ModuleQuestionConfig>): ScoreTotalTerm {
  const record = isRecord(term) ? term : {};
  if (typeof record.answerFieldId === "string" && record.answerFieldId) return term as ScoreTotalTerm;
  const questionId = text(record.questionId) ?? text(record.question_id);
  const fieldId = text(record.fieldId) ?? text(record.field_id) ?? (questionId ? questionsById.get(questionId)?.fieldId : undefined);
  // A question with no answer field keeps its question reference, which the exporter reads too.
  if (!fieldId) return term as ScoreTotalTerm;
  const { questionId: _questionId, question_id: _questionIdSnake, fieldId: _fieldId, field_id: _fieldIdSnake, ...rest } = record;
  return { ...rest, answerFieldId: fieldId } as unknown as ScoreTotalTerm;
}

/**
 * A scoring config in the builder's spelling (options and total terms).
 * Unchanged (same object) when there was nothing to convert.
 */
export function normalizeScoringConfig<T extends Pick<ScoringModuleConfig, "questions" | "totals" | "sharedOptions"> | null | undefined>(scoring: T): T {
  if (!scoring) return scoring;
  let changed = false;
  const sharedOptions = Array.isArray(scoring.sharedOptions)
    ? scoring.sharedOptions.map((option, index) => {
        const normalized = normalizeScoringOption(option, index);
        if (normalized !== option) changed = true;
        return normalized;
      })
    : scoring.sharedOptions;
  const questions = (scoring.questions ?? []).map((question) => {
    if (!Array.isArray(question.options)) return question;
    const options = question.options.map((option, index) => {
      const normalized = normalizeScoringOption(option, index);
      if (normalized !== option) changed = true;
      return normalized;
    });
    return options.some((option, index) => option !== question.options![index]) ? { ...question, options } : question;
  });
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const totals = (scoring.totals ?? []).map((total: ScoreTotalConfig) => {
    if (!Array.isArray(total.terms)) return total;
    const terms = total.terms.map((term) => normalizeScoringTerm(term, questionsById));
    if (terms.every((term, index) => term === total.terms[index])) return total;
    changed = true;
    return { ...total, terms };
  });
  return changed ? ({ ...scoring, questions, totals, ...(sharedOptions ? { sharedOptions } : {}) } as T) : scoring;
}

/** A section module (and its extra subforms) with scoring in the builder's spelling. Same object when unchanged. */
export function normalizeScoringInModule<T extends ModuleConfig | null | undefined>(module: T): T {
  if (!module) return module;
  const scoring = normalizeScoringConfig(module.scoring);
  let extrasChanged = false;
  const extras = module.additionalSubformModules?.map((extra) => {
    const normalized = normalizeScoringInModule(extra);
    if (normalized !== extra) extrasChanged = true;
    return normalized;
  });
  if (scoring === module.scoring && !extrasChanged) return module;
  return {
    ...module,
    ...(scoring !== module.scoring ? { scoring } : {}),
    ...(extrasChanged ? { additionalSubformModules: extras } : {}),
  };
}

/** Drafts with scoring subforms in the builder's spelling. The same array when nothing changed. */
export function normalizeScoringInDrafts<T extends Pick<GroupLayoutDraft, "moduleConfig">>(drafts: readonly T[]): T[] {
  let changed = false;
  const next = drafts.map((draft) => {
    const moduleConfig = normalizeScoringInModule(draft.moduleConfig);
    if (moduleConfig === draft.moduleConfig) return draft;
    changed = true;
    return { ...draft, moduleConfig };
  });
  return changed ? next : (drafts as T[]);
}
