import type { BuilderField } from "./index";
import { walkStructure, type NeutralStructure, type StructureSection } from "./structure";

/**
 * Field notes: a free-text note an author keeps on any field (a question for
 * the clinical lead, a build instruction, something to test). Notes are
 * authoring metadata, the same on every target: no runtime draws them and no
 * native artifact carries them. They leave the builder only in reports a
 * person reads (the QA report, an export package's FIELD-NOTES.md), and only
 * the notes marked for export.
 *
 * Every container stores a member's note under the member's own `authorNote`
 * key (a table column, a layout cell, a subform entry's authored field), so
 * the regular nested-field adapters carry it and the structure walk finds it.
 */
export interface BuilderFieldNote {
  text: string;
  /** False keeps the note in the builder only. Absent means it is exported. */
  includeInExports?: boolean;
}

export interface FieldNote {
  text: string;
  includeInExports: boolean;
}

/** The field's note, or null when it has none (blank text is no note). */
export function readFieldNote(field: Pick<BuilderField, "authorNote"> | null | undefined): FieldNote | null {
  const note = field?.authorNote;
  if (!note || typeof note !== "object" || typeof note.text !== "string" || !note.text.trim()) return null;
  return { text: note.text, includeInExports: note.includeInExports !== false };
}

/** The stored note for an edit: null clears it; the default (exported) is left implicit. */
export function writeFieldNote(note: FieldNote | null): BuilderFieldNote | null {
  if (!note || !note.text.trim()) return null;
  return note.includeInExports ? { text: note.text } : { text: note.text, includeInExports: false };
}

/** One note, where it sits in the form. */
export interface FieldNoteEntry {
  fieldId: string;
  label: string;
  type: BuilderField["type"];
  text: string;
  includeInExports: boolean;
  /** The innermost section, by label; null for fields no section claims. */
  section: string | null;
  /** 0-based page. */
  page: number;
  /** The container (table, layout table, subform) a member note sits in. */
  container: string | null;
}

/**
 * Every field note in form order, nested members included. `exportedOnly`
 * leaves out the notes kept in the builder. Read the structure with the app's
 * adapters (`readBuilderFormStructure`), so container members are found.
 */
export function collectFieldNotes(
  structure: NeutralStructure,
  options: { exportedOnly?: boolean } = {},
): FieldNoteEntry[] {
  const entries: FieldNoteEntry[] = [];
  const seen = new Set<string>();
  const add = (field: BuilderField | null, section: StructureSection, container: string | null, isSection = false) => {
    const note = readFieldNote(field);
    if (!field || !note || seen.has(field.id)) return;
    if (options.exportedOnly && !note.includeInExports) return;
    seen.add(field.id);
    entries.push({
      fieldId: field.id,
      label: field.label?.trim() || field.id,
      type: field.type,
      text: note.text.trim(),
      includeInExports: note.includeInExports,
      section: isSection ? field.label?.trim() || null : section.id === null ? null : section.label,
      page: section.page,
      container,
    });
  };
  walkStructure(structure, (node, section) => {
    if (node.kind === "section") add(node.field, node, null, true);
    else if (node.kind === "field") add(node.field, section, null);
    else if (node.kind === "group") {
      add(node.field, section, null);
      node.members.forEach((member) => add(member.field, section, node.label));
    }
  });
  return entries;
}
