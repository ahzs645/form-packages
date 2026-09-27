import { getOptionLabel, getOptionValue } from "./choice-options";
import type {
  BuilderChoiceOption,
  BuilderField,
  BuilderFieldTranslation,
  BuilderLayoutTableCell,
  BuilderLayoutTableCellField,
} from "./index";

/**
 * Translations as neutral intent: the text a form shows in each language
 * (docs/.../architecture/translations.md, the "Translations" concept of the
 * neutral form model).
 *
 * One store holds the author's text: `translations` on a field (and on a
 * layout-table answer cell), keyed by BCP-47 language tag, with the label,
 * help text, placeholder and each option's label keyed by the option's stored
 * value. The form's interface strings (buttons, page names, page-flow and
 * error-summary text) live in `design.uiTranslations`, and validation messages
 * carry their own `translations` (read by readFieldValidation); both are read
 * here for the form's language list.
 *
 * Older writers left other spellings, all read here and never written:
 *
 * - option labels keyed by the option's label (the old inspector editor, the
 *   translation CSV and the FHIR importer), which a label rename detached;
 * - language tags in other casing or with `_` (`fr_ca`, `FR-ca`);
 * - an empty entry that only names a language (the Translations panel's
 *   "Add language" marker), which counts toward the form's languages but
 *   holds no text;
 * - blank strings, and `translations: null`.
 *
 * Import provenance is not intent: a FHIR item's preserved `_text` or
 * option `_display` is lifted into `translations` on import, and the FHIR
 * exporter regenerates both from the neutral text, so a translation the author
 * deleted never comes back from provenance.
 *
 * Readers never throw: an entry or key they do not understand is kept (an
 * option key that matches no option stays as written) and reported in
 * `unknown` by the Details reader.
 */

/** The text parts of a field in one language, in the stored shape. */
export type FieldTranslation = BuilderFieldTranslation;
/** Language tag → the field's text in that language. */
export type FieldTranslations = Record<string, FieldTranslation>;

/** The text parts a translation can hold. */
export const FIELD_TRANSLATION_PARTS = ["label", "helpText", "placeholder", "options"] as const;
export type FieldTranslationPart = (typeof FIELD_TRANSLATION_PARTS)[number];

/** A spelling the reader accepted that the writer no longer writes. */
export type FieldTranslationLegacy = "option-label-key" | "language-tag" | "empty-entry" | "blank-text";

/** What a translated item is on the form, which decides where each target shows its text. */
export type TranslationItemKind = "question" | "section" | "heading" | "display" | "layout-cell";

/** An option as the reader matches translation keys: the stored value and the label. */
export interface TranslationOptionRef {
  value: string;
  label: string;
}

/** Anything that stores `translations`: a field, a layout cell or a field-list child. */
export interface TranslatableFieldLike {
  type?: string;
  translations?: unknown;
  options?: readonly BuilderChoiceOption[] | null;
  scaleConfig?: { options?: readonly unknown[] | null } | null;
  /** A layout cell's options. */
  optionList?: readonly unknown[] | null;
}

export interface ReadFieldTranslationsOptions {
  /** The options to match keys against; defaults to the field's own (`options`, a scale's, or a cell's `optionList`). */
  options?: readonly unknown[] | null;
}

export interface FieldTranslationDetails {
  /** Canonical tags, only languages with some text, options keyed by stored value. */
  translations: FieldTranslations;
  /** Every language the field names, including an entry with no text, first-seen order. */
  languages: string[];
  /** Older spellings read (see the module comment). */
  legacy: FieldTranslationLegacy[];
  /**
   * Entry keys and option keys the reader did not match: `fr-CA.options.<key>`
   * for an option key that is neither a stored value nor a label, and
   * `fr-CA.<key>` for an entry key that is not a text part. Unmatched option
   * keys are kept; other keys are not text and are left out.
   */
  unknown: string[];
}

const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/;

/**
 * A language tag in BCP-47's conventional casing: `fr_ca` → `fr-CA`,
 * `ZH-hant-tw` → `zh-Hant-TW`. A value that is not shaped like a tag is kept
 * as written (trimmed) so no text is lost; a blank or non-string value is null.
 */
export function canonicalLanguageTag(tag: unknown): string | null {
  if (typeof tag !== "string") return null;
  const trimmed = tag.trim();
  if (!trimmed) return null;
  const dashed = trimmed.replace(/_/g, "-");
  if (!LANGUAGE_TAG_PATTERN.test(dashed)) return trimmed;
  const [language, ...rest] = dashed.split("-");
  let privateUse = language.toLowerCase() === "x";
  const subtags = rest.map((subtag) => {
    if (privateUse) return subtag.toLowerCase();
    if (subtag.length === 1) {
      privateUse = subtag.toLowerCase() === "x";
      return subtag.toLowerCase();
    }
    if (subtag.length === 2 && /^[A-Za-z]{2}$/.test(subtag)) return subtag.toUpperCase();
    if (subtag.length === 4 && /^[A-Za-z]{4}$/.test(subtag)) return subtag[0].toUpperCase() + subtag.slice(1).toLowerCase();
    return subtag.toLowerCase();
  });
  return [language.toLowerCase(), ...subtags].join("-");
}

/** Whether a tag is shaped like a BCP-47 language tag (what the editors accept). */
export function isLanguageTag(tag: unknown): boolean {
  const canonical = canonicalLanguageTag(tag);
  return canonical !== null && /^(?:[a-z]{2,3}|x)(?:-[A-Za-z0-9]{1,8})*$/.test(canonical);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Text that shows: a string with something besides white space, kept as written. */
function textOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** The options a field's translations are keyed against. */
export function translationOptionsOf(field: TranslatableFieldLike, override?: readonly unknown[] | null): TranslationOptionRef[] {
  const source = override
    ?? (field.options?.length ? field.options : null)
    ?? (field.scaleConfig?.options?.length ? field.scaleConfig.options : null)
    ?? (field.optionList?.length ? field.optionList : null)
    ?? [];
  const refs: TranslationOptionRef[] = [];
  for (const option of source) {
    if (option === null || option === undefined) continue;
    try {
      const typed = option as BuilderChoiceOption;
      const value = getOptionValue(typed);
      const label = getOptionLabel(typed);
      if (value || label) refs.push({ value: value || label, label });
    } catch {
      // An option shape the value readers do not know: nothing to key against.
    }
  }
  return refs;
}

interface OptionKeyResolver {
  resolve(key: string): { key: string; via: "value" | "label" | "unknown" };
}

function optionKeyResolver(options: readonly TranslationOptionRef[]): OptionKeyResolver {
  const values = new Set(options.map((option) => option.value));
  const byLabel = new Map<string, string | null>();
  for (const option of options) {
    if (!option.label) continue;
    // A label two options share cannot say which option it meant.
    byLabel.set(option.label, byLabel.has(option.label) && byLabel.get(option.label) !== option.value ? null : option.value);
  }
  return {
    resolve(key) {
      if (values.has(key)) return { key, via: "value" };
      const labelled = byLabel.get(key) ?? byLabel.get(key.trim());
      if (labelled) return { key: labelled, via: "label" };
      return { key, via: "unknown" };
    },
  };
}

function normalizeEntry(
  language: string,
  raw: unknown,
  resolver: OptionKeyResolver | null,
  notes: { legacy: Set<FieldTranslationLegacy>; unknown: string[] }
): FieldTranslation {
  const entry: FieldTranslation = {};
  if (!isRecord(raw)) {
    if (raw !== undefined && raw !== null) notes.unknown.push(language);
    return entry;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (key === "label" || key === "helpText" || key === "placeholder") {
      const text = textOf(value);
      if (text !== undefined) entry[key] = text;
      else if (typeof value === "string") notes.legacy.add("blank-text");
      else if (value !== undefined && value !== null) notes.unknown.push(`${language}.${key}`);
      continue;
    }
    if (key === "options") {
      if (value === undefined || value === null) continue;
      if (!isRecord(value)) {
        notes.unknown.push(`${language}.options`);
        continue;
      }
      const byValue: Record<string, string> = {};
      const byLabel: Record<string, string> = {};
      for (const [optionKey, optionText] of Object.entries(value)) {
        const text = textOf(optionText);
        if (text === undefined) {
          if (typeof optionText === "string") notes.legacy.add("blank-text");
          else if (optionText !== undefined && optionText !== null) notes.unknown.push(`${language}.options.${optionKey}`);
          continue;
        }
        const resolved = resolver ? resolver.resolve(optionKey) : { key: optionKey, via: "value" as const };
        if (resolved.via === "label") {
          notes.legacy.add("option-label-key");
          byLabel[resolved.key] ??= text;
        } else {
          if (resolved.via === "unknown") notes.unknown.push(`${language}.options.${optionKey}`);
          byValue[resolved.key] = text;
        }
      }
      // A value key wins over a label key naming the same option.
      const options = { ...byLabel, ...byValue };
      if (Object.keys(options).length) entry.options = options;
      continue;
    }
    notes.unknown.push(`${language}.${key}`);
  }
  return entry;
}

function mergeEntries(primary: FieldTranslation, secondary: FieldTranslation): FieldTranslation {
  const merged: FieldTranslation = { ...secondary, ...primary };
  if (primary.options || secondary.options) merged.options = { ...secondary.options, ...primary.options };
  return merged;
}

/** Whether an entry holds any text. */
export function translationHasText(entry: FieldTranslation | null | undefined): boolean {
  if (!entry) return false;
  return Boolean(
    textOf(entry.label) || textOf(entry.helpText) || textOf(entry.placeholder)
      || Object.values(entry.options ?? {}).some((text) => textOf(text))
  );
}

/** The parts of an entry that hold text. */
export function translatedParts(entry: FieldTranslation | null | undefined): FieldTranslationPart[] {
  if (!entry) return [];
  return FIELD_TRANSLATION_PARTS.filter((part) =>
    part === "options" ? Object.values(entry.options ?? {}).some((text) => textOf(text)) : Boolean(textOf(entry[part]))
  );
}

/** A field's translations with the stores and spellings they came from. */
export function readFieldTranslationDetails(
  field: TranslatableFieldLike | null | undefined,
  options: ReadFieldTranslationsOptions = {}
): FieldTranslationDetails {
  const legacy = new Set<FieldTranslationLegacy>();
  const unknown: string[] = [];
  const empty: FieldTranslationDetails = { translations: {}, languages: [], legacy: [], unknown: [] };
  if (!field) return empty;
  const raw = field.translations;
  if (raw === undefined || raw === null) return empty;
  if (!isRecord(raw)) return { ...empty, unknown: ["translations"] };

  const optionRefs = translationOptionsOf(field, options.options);
  const resolver = optionRefs.length ? optionKeyResolver(optionRefs) : null;
  const languages: string[] = [];
  const entries = new Map<string, { entry: FieldTranslation; exact: boolean }>();
  for (const [rawTag, rawEntry] of Object.entries(raw)) {
    const language = canonicalLanguageTag(rawTag);
    if (!language) {
      unknown.push(rawTag);
      continue;
    }
    const exact = language === rawTag;
    if (!exact) legacy.add("language-tag");
    const entry = normalizeEntry(language, rawEntry, resolver, { legacy, unknown });
    if (!languages.includes(language)) languages.push(language);
    const existing = entries.get(language);
    if (!existing) entries.set(language, { entry, exact });
    // The entry already spelled canonically wins; the other fills its gaps.
    else if (exact && !existing.exact) entries.set(language, { entry: mergeEntries(entry, existing.entry), exact });
    else existing.entry = mergeEntries(existing.entry, entry);
  }

  const translations: FieldTranslations = {};
  for (const language of languages) {
    const entry = entries.get(language)?.entry;
    if (entry && translationHasText(entry)) translations[language] = entry;
    else legacy.add("empty-entry");
  }
  return { translations, languages, legacy: [...legacy], unknown };
}

/** A field's translations: canonical language tags, text only, options keyed by stored value. */
export function readFieldTranslations(
  field: TranslatableFieldLike | null | undefined,
  options: ReadFieldTranslationsOptions = {}
): FieldTranslations {
  return readFieldTranslationDetails(field, options).translations;
}

/**
 * The stored `translations` for a field: the one spelling (canonical tags,
 * options keyed by stored value, languages with text only), or null when no
 * language has text. Pass the result as the field's `translations`.
 */
export function writeFieldTranslations(
  field: TranslatableFieldLike | null | undefined,
  translations: unknown,
  options: ReadFieldTranslationsOptions = {}
): FieldTranslations | null {
  const next = readFieldTranslations({ ...(field ?? {}), translations }, options);
  return Object.keys(next).length ? next : null;
}

/** `writeFieldTranslations` as a patch for `onUpdateField`. */
export function fieldTranslationsPatch(
  field: TranslatableFieldLike | null | undefined,
  translations: unknown,
  options: ReadFieldTranslationsOptions = {}
): { translations: FieldTranslations | null } {
  return { translations: writeFieldTranslations(field, translations, options) };
}

/** What `setFieldTranslationText` changes: one text part, or one option's label. */
export type FieldTranslationEdit =
  | { part: "label" | "helpText" | "placeholder"; text: string }
  | { part: "option"; value: string; text: string };

/**
 * One edit to a field's translations, for editors that write on every
 * keystroke: the text is kept as typed (a trailing space survives), a blank
 * text removes the part, and a language left without text is removed.
 * Returns the stored value (`null` when nothing is left).
 */
export function setFieldTranslationText(
  field: TranslatableFieldLike,
  language: string,
  edit: FieldTranslationEdit,
  options: ReadFieldTranslationsOptions = {}
): FieldTranslations | null {
  const tag = canonicalLanguageTag(language);
  const current = readFieldTranslations(field, options);
  if (!tag) return Object.keys(current).length ? current : null;
  const entry: FieldTranslation = { ...current[tag] };
  if (edit.part === "option") {
    const optionTexts = { ...entry.options };
    if (textOf(edit.text)) optionTexts[edit.value] = edit.text;
    else delete optionTexts[edit.value];
    if (Object.keys(optionTexts).length) entry.options = optionTexts;
    else delete entry.options;
  } else if (textOf(edit.text)) {
    entry[edit.part] = edit.text;
  } else {
    delete entry[edit.part];
  }
  return writeFieldTranslations(field, { ...current, [tag]: entry }, options);
}

/** A field's translations with one language removed. */
export function removeFieldTranslationLanguage(
  field: TranslatableFieldLike,
  language: string,
  options: ReadFieldTranslationsOptions = {}
): FieldTranslations | null {
  const tag = canonicalLanguageTag(language);
  const next = { ...readFieldTranslations(field, options) };
  if (tag) delete next[tag];
  return Object.keys(next).length ? next : null;
}

/**
 * An option's label in one language: by the option's stored value, then (for
 * a key the reader could not match to an option) by its label.
 */
export function optionTranslationOf(
  entry: FieldTranslation | null | undefined,
  option: { value?: string | null; label?: string | null }
): string | undefined {
  const texts = entry?.options;
  if (!texts) return undefined;
  const byValue = option.value ? textOf(texts[option.value]) : undefined;
  if (byValue !== undefined) return byValue;
  return option.label ? textOf(texts[option.label]) : undefined;
}

// --- The whole form ---------------------------------------------------------

/** One field or cell with text in another language. */
export interface FormTranslationItem {
  /** The field's id, or a layout cell's answer field id. */
  fieldId: string;
  /** The base text, for messages. */
  label: string;
  kind: TranslationItemKind;
  /** The layout table a cell sits in. */
  containerId?: string;
  translations: FieldTranslations;
}

/** A validation message's translations (stored on the rule; see readFieldValidation). */
export interface FormValidationMessageTranslation {
  fieldId: string;
  ruleId: string;
  /** Language → message. */
  translations: Record<string, string>;
}

export interface FormTranslations {
  /** Every language the form uses, canonical, first-seen order: fields and cells, validation messages, interface strings. */
  languages: string[];
  /** Fields and layout cells with text in some language, in document order. */
  items: FormTranslationItem[];
  validationMessages: FormValidationMessageTranslation[];
  /** Language → base text → translated text (`design.uiTranslations`). */
  interfaceStrings: Record<string, Record<string, string>>;
}

export interface FormTranslationsDocument {
  fields: readonly BuilderField[];
  design?: { uiTranslations?: unknown } | null;
}

const DISPLAY_TYPES = new Set(["richText", "hyperlink", "image", "divider", "spacer"]);

export function translationItemKind(type: string | undefined): TranslationItemKind {
  if (type === "section") return "section";
  if (type === "heading") return "heading";
  if (type && DISPLAY_TYPES.has(type)) return "display";
  return "question";
}

function cellAnswers(cell: BuilderLayoutTableCell): Array<BuilderLayoutTableCell | BuilderLayoutTableCellField> {
  const answers: Array<BuilderLayoutTableCell | BuilderLayoutTableCellField> = [];
  if (cell.fieldId) answers.push(cell);
  for (const child of cell.fields ?? []) if (child?.fieldId) answers.push(child);
  return answers;
}

/** Interface strings with canonical tags and text only. */
export function readInterfaceTranslations(value: unknown): { strings: Record<string, Record<string, string>>; languages: string[] } {
  const strings: Record<string, Record<string, string>> = {};
  const languages: string[] = [];
  if (!isRecord(value)) return { strings, languages };
  for (const [rawTag, table] of Object.entries(value)) {
    const language = canonicalLanguageTag(rawTag);
    if (!language) continue;
    if (!languages.includes(language)) languages.push(language);
    if (!isRecord(table)) continue;
    for (const [source, text] of Object.entries(table)) {
      const translated = textOf(text);
      if (translated === undefined) continue;
      (strings[language] ??= {})[source] ??= translated;
    }
  }
  return { strings, languages };
}

/** Every translation on a form, for converters and the Export review. */
export function readFormTranslations(document: FormTranslationsDocument): FormTranslations {
  const languages: string[] = [];
  const note = (language: string) => {
    if (!languages.includes(language)) languages.push(language);
  };
  const items: FormTranslationItem[] = [];
  const validationMessages: FormValidationMessageTranslation[] = [];

  for (const field of document.fields ?? []) {
    if (!field) continue;
    const details = readFieldTranslationDetails(field);
    details.languages.forEach(note);
    if (Object.keys(details.translations).length) {
      items.push({
        fieldId: field.id,
        label: field.label || field.id,
        kind: translationItemKind(field.type),
        translations: details.translations,
      });
    }
    for (const rule of field.behavior?.validations ?? []) {
      const texts: Record<string, string> = {};
      for (const [rawTag, text] of Object.entries(isRecord(rule?.translations) ? rule.translations : {})) {
        const language = canonicalLanguageTag(rawTag);
        const translated = textOf(text);
        if (!language || translated === undefined) continue;
        note(language);
        texts[language] ??= translated;
      }
      if (Object.keys(texts).length) validationMessages.push({ fieldId: field.id, ruleId: rule.id, translations: texts });
    }
    for (const row of field.layoutTableConfig?.rows ?? []) {
      for (const cell of row?.cells ?? []) {
        if (!cell) continue;
        for (const answer of cellAnswers(cell)) {
          const cellDetails = readFieldTranslationDetails(answer as TranslatableFieldLike);
          cellDetails.languages.forEach(note);
          if (!Object.keys(cellDetails.translations).length) continue;
          items.push({
            fieldId: answer.fieldId!,
            label: answer.label || answer.fieldId!,
            kind: "layout-cell",
            containerId: field.id,
            translations: cellDetails.translations,
          });
        }
      }
    }
  }

  const interfaceTranslations = readInterfaceTranslations(document.design?.uiTranslations);
  interfaceTranslations.languages.forEach(note);
  return { languages, items, validationMessages, interfaceStrings: interfaceTranslations.strings };
}

/** What a form holds in one language, or across all when `language` is absent: for loss messages. */
export interface FormTranslationCounts {
  /** Fields and cells with text. */
  items: number;
  validationMessages: number;
  interfaceStrings: number;
}

export function countFormTranslations(translations: FormTranslations, language?: string): FormTranslationCounts {
  const has = (record: Record<string, unknown>) => (language ? language in record : Object.keys(record).length > 0);
  return {
    items: translations.items.filter((item) => has(item.translations)).length,
    validationMessages: translations.validationMessages.filter((message) => has(message.translations)).length,
    interfaceStrings: language
      ? Object.keys(translations.interfaceStrings[language] ?? {}).length
      : new Set(Object.values(translations.interfaceStrings).flatMap((table) => Object.keys(table))).size,
  };
}

/** Whether the form has any translated text (a language named with no text does not count). */
export function formHasTranslations(translations: FormTranslations): boolean {
  const counts = countFormTranslations(translations);
  return counts.items + counts.validationMessages + counts.interfaceStrings > 0;
}
