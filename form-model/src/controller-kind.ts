import type { VisibilityControllerKindLookup } from "./conditions";
import { FIELD_TYPE_PROFILES, neutralAnswerTypeOf, type NeutralAnswerType } from "./field-types";

/**
 * Controller kind: what a field is when a condition reads it — the one
 * reading every target's condition converter uses
 * (docs/.../architecture/resolved-form.md, "Controller kind").
 * This module imports the field-type tables only, so conditions.ts can use it.
 */

/**
 * What a field is when a condition reads it. Only `boolean`, `checkbox` and
 * `choice` change how a comparison converts (`visibilityRuleToFieldLinkConditions`):
 *
 * - `boolean`: a Yes/No question. "No" is an answered No.
 * - `checkbox`: a single tick box. It compares like a Yes/No, except that a
 *   box nobody touched is unticked (`emptyIsNo`). Kept distinct from
 *   `boolean` everywhere so every target reads the same rule the same way.
 * - `choice`: a single or multiple choice, or a matrix; option matching
 *   normalizes coded answers.
 * - `number`, `date`, `datetime`, `time`, `text`: compared as written.
 * - `table`: a repeating table (it controls logic only through "has rows").
 */
export type ControllerKind = "boolean" | "checkbox" | "choice" | "number" | "date" | "datetime" | "time" | "text" | "table";

/** Any field shape a condition may name: a builder field, a table column or nested projection, or a lowered/parsed field (`kind`, `booleanStyle`). */
export interface ControllerKindInput {
  type?: string | null;
  kind?: string | null;
  booleanStyle?: string | null;
  choiceStyle?: string | null;
  dateConfig?: { withTime?: boolean } | null;
  richTextConfig?: { readOnly?: boolean } | null;
}

// No module-level computation: the generated NHForms kits bundle this module's
// importers and must tree-shake whatever they do not call.
const isBuilderType = (type: string): boolean => Object.prototype.hasOwnProperty.call(FIELD_TYPE_PROFILES, type);
const isNumberAnswer = (answer: NeutralAnswerType): boolean => answer === "number" || answer === "scale" || answer === "computed";

/** A lowered or parsed field's kind (lib/mois-export/lower-field.ts, ParsedField) read as a controller kind. */
function controllerKindOfKind(input: ControllerKindInput): ControllerKind | undefined {
  const kind = input.kind ?? undefined;
  if (kind === "boolean") return input.booleanStyle && input.booleanStyle !== "yesNo" ? "checkbox" : "boolean";
  if (kind === "choice" || kind === "matrix") return "choice";
  if (kind === "number" || kind === "rating" || kind === "slider" || kind === "scale") return "number";
  if (kind === "date" || kind === "datetime" || kind === "time" || kind === "text" || kind === "table") return kind;
  return undefined;
}

/**
 * The one controller-kind reading (see `ControllerKind`). A builder field is
 * read from its neutral answer type; a table column's `checkbox` is a single
 * tick box; a lowered or parsed field from its `kind`. Undefined for a field
 * that stores no answer a condition can compare (a section, a heading, a
 * component) or an unknown shape.
 */
export function controllerKindOf(field: ControllerKindInput | null | undefined): ControllerKind | undefined {
  if (!field) return undefined;
  const type = field.type ?? undefined;
  if (type === "checkbox") return "checkbox"; // a table column's single tick box
  if (type === "multiselect") return "choice"; // a layout cell's multi select
  if (type && isBuilderType(type)) {
    if (type === "matrix") return "choice";
    if (type === "table") return "table";
    const answer = neutralAnswerTypeOf(field as Parameters<typeof neutralAnswerTypeOf>[0]);
    if (answer === "yesNo") return "boolean";
    if (answer === "boolean") return "checkbox";
    if (answer === "singleChoice" || answer === "multipleChoice") return "choice";
    if (answer && isNumberAnswer(answer)) return "number";
    if (answer === "date") return "date";
    if (answer === "dateTime") return "datetime";
    if (answer === "time") return "time";
    if (answer) return "text";
    // No answer of its own: a lowered field may still say what it holds.
    return controllerKindOfKind(field);
  }
  return controllerKindOfKind(field);
}

/** `controllerKindOf` over a set of fields, as the lookup the condition converters take. Earlier fields win on a repeated id. */
export function controllerKindLookupOf(
  fields: Iterable<(ControllerKindInput & { id?: string | null }) | null | undefined>,
): VisibilityControllerKindLookup & ((id: string) => ControllerKind | undefined) {
  const kinds = new Map<string, ControllerKind | undefined>();
  for (const field of fields) {
    if (field?.id && !kinds.has(field.id)) kinds.set(field.id, controllerKindOf(field));
  }
  return (id: string) => kinds.get(id);
}


/**
 * The kind a condition lookup reports for a field: `controllerKindOf`, under
 * the name callers used before it.
 * @deprecated Use `controllerKindOf` / `controllerKindLookupOf`.
 */
export function conditionControllerKindOf(field: ControllerKindInput | null | undefined): string | undefined {
  return controllerKindOf(field);
}
