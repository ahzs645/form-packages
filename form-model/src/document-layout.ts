import { readChoice } from "./values";

/** EMR-neutral document behavior, separate from screen/navigation visibility. */
export interface DocumentLayout {
  text?: { fontSize: number; lineHeight: number; padding: number; backgroundColor?: string; overflow: "continue" | "block" };
  pageSelection?: { defaultValue: string; pagesByValue: Record<string, number[]> };
}

export function readDocumentLayout(field: { documentLayout?: DocumentLayout } | null | undefined): DocumentLayout | undefined {
  return field?.documentLayout;
}

/** Multiple selectors intersect. Missing answers use the declared initial state. */
export function selectedDocumentPages(
  pageCount: number,
  fields: Array<{ id: string; documentLayout?: DocumentLayout }>,
  values: Record<string, unknown>,
): number[] {
  let pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  for (const field of fields) {
    const selection = readDocumentLayout(field)?.pageSelection;
    if (!selection) continue;
    const answers = readChoice(values[field.id] ?? selection.defaultValue);
    const answer = answers.length === 1 ? answers[0].code : undefined;
    const selected = typeof answer === "string" && Object.prototype.hasOwnProperty.call(selection.pagesByValue, answer)
      ? selection.pagesByValue[answer] : undefined;
    if (!selected) throw new Error(`Choose a valid page selection for ${field.id}.`);
    pages = pages.filter((page) => selected.includes(page));
  }
  if (!pages.length) throw new Error("Select at least one document page.");
  return pages;
}
