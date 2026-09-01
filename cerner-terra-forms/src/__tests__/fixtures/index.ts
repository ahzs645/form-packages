import type { BuilderField } from "@webforms/form-model";
import { allFieldKindsFixture } from "./all-field-kinds";

export { allFieldKindsFixture };
export { default as allFieldKinds } from "./all-field-kinds";

/**
 * Distinct authorable field kinds present in the coverage fixture, in first-seen
 * order. "Kind" here means the BuilderField `type` discriminator (the 28
 * BUILDER_FIELD_TYPES), not the narrower 18-member ParsedField `ComponentKind`
 * — the renderer switches on the builder type, so that is what coverage is
 * measured against.
 */
export function getFixtureFieldKinds(fields: readonly BuilderField[] = allFieldKindsFixture): string[] {
  const kinds: string[] = [];
  for (const field of fields) {
    if (!kinds.includes(field.type)) kinds.push(field.type);
  }
  return kinds;
}

/**
 * Distinct `choiceStyle` values present on the fixture's choice fields, in
 * first-seen order. Choice is the most common kind in real forms and its style
 * variants are the renderer's most consequential sub-decision, so they get
 * their own coverage accessor.
 */
export function getFixtureChoiceStyles(fields: readonly BuilderField[] = allFieldKindsFixture): string[] {
  const styles: string[] = [];
  for (const field of fields) {
    if (field.type !== "choice") continue;
    const style = field.choiceStyle ?? "findCode";
    if (!styles.includes(style)) styles.push(style);
  }
  return styles;
}
