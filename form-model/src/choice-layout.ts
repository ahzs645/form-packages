/** Presentation only: answer identities and authored option order never change. */
export interface ChoiceGridSource {
  choiceAnswerLayout?: string;
  choiceAnswerOrder?: "row-first" | "column-first";
}

export function readChoiceGrid(source: ChoiceGridSource, answerCount: number) {
  const columns = source.choiceAnswerLayout === "vertical" ? 1 : Number(source.choiceAnswerLayout?.replace("columns-", ""));
  if (!Number.isInteger(columns) || columns < 1 || columns > 6) return null;
  return {
    columns,
    rows: Math.max(1, Math.ceil(answerCount / columns)),
    columnFirst: source.choiceAnswerOrder === "column-first",
  };
}
