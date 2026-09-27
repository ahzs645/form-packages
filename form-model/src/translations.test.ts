import { describe, expect, it } from "vitest";
import type { BuilderField } from "./index";
import {
  canonicalLanguageTag,
  countFormTranslations,
  fieldTranslationsPatch,
  formHasTranslations,
  isLanguageTag,
  optionTranslationOf,
  readFieldTranslationDetails,
  readFieldTranslations,
  readFormTranslations,
  removeFieldTranslationLanguage,
  setFieldTranslationText,
  translatedParts,
  translationItemKind,
  writeFieldTranslations,
} from "./translations";

function field(partial: Partial<BuilderField> & Pick<BuilderField, "id" | "type">): BuilderField {
  return { label: partial.id, ...partial } as BuilderField;
}

const colour = field({
  id: "colour",
  type: "choice",
  label: "Colour",
  options: [
    { value: "r", label: "Red" },
    { value: "b", label: "Blue" },
    "Green",
  ],
});

describe("canonicalLanguageTag", () => {
  it("writes BCP-47's conventional casing", () => {
    expect(canonicalLanguageTag("fr-CA")).toBe("fr-CA");
    expect(canonicalLanguageTag("fr_ca")).toBe("fr-CA");
    expect(canonicalLanguageTag(" FR ")).toBe("fr");
    expect(canonicalLanguageTag("zh-hant-tw")).toBe("zh-Hant-TW");
    expect(canonicalLanguageTag("es-419")).toBe("es-419");
    expect(canonicalLanguageTag("en-US-x-Clinic")).toBe("en-US-x-clinic");
  });

  it("keeps a value that is not a tag, and has nothing for blanks", () => {
    expect(canonicalLanguageTag("Français")).toBe("Français");
    expect(canonicalLanguageTag("")).toBeNull();
    expect(canonicalLanguageTag("  ")).toBeNull();
    expect(canonicalLanguageTag(42)).toBeNull();
  });

  it("accepts only tag-shaped input as a language", () => {
    expect(isLanguageTag("fr-CA")).toBe(true);
    expect(isLanguageTag("pa")).toBe(true);
    expect(isLanguageTag("Français")).toBe(false);
    expect(isLanguageTag("f")).toBe(false);
    expect(isLanguageTag("")).toBe(false);
  });
});

describe("readFieldTranslations", () => {
  it("reads the stored spelling unchanged", () => {
    const stored = { "fr-CA": { label: "Couleur", helpText: "Choisissez", placeholder: "…", options: { r: "Rouge" } } };
    expect(readFieldTranslations({ ...colour, translations: stored })).toEqual(stored);
    expect(readFieldTranslationDetails({ ...colour, translations: stored }).legacy).toEqual([]);
  });

  it("re-keys option labels by stored value, a value key winning over a label key", () => {
    const details = readFieldTranslationDetails({
      ...colour,
      translations: { "fr-CA": { options: { Red: "Rouge (libellé)", r: "Rouge", Blue: "Bleu", Green: "Vert" } } },
    });
    expect(details.translations).toEqual({ "fr-CA": { options: { r: "Rouge", b: "Bleu", Green: "Vert" } } });
    expect(details.legacy).toContain("option-label-key");
    expect(details.unknown).toEqual([]);
  });

  it("keeps an option key that matches no option, and reports it", () => {
    const details = readFieldTranslationDetails({ ...colour, translations: { fr: { options: { Purple: "Violet" } } } });
    expect(details.translations).toEqual({ fr: { options: { Purple: "Violet" } } });
    expect(details.unknown).toEqual(["fr.options.Purple"]);
  });

  it("does not guess an option from a label two options share", () => {
    const twins = field({ id: "twins", type: "choice", options: [{ value: "a", label: "Same" }, { value: "b", label: "Same" }] });
    expect(readFieldTranslations({ ...twins, translations: { fr: { options: { Same: "Pareil" } } } })).toEqual({
      fr: { options: { Same: "Pareil" } },
    });
  });

  it("merges language tags spelled two ways, the canonical spelling first", () => {
    const details = readFieldTranslationDetails({
      ...colour,
      translations: { fr_ca: { label: "Couleur (ancien)", helpText: "Aide" }, "fr-CA": { label: "Couleur" } },
    });
    expect(details.translations).toEqual({ "fr-CA": { label: "Couleur", helpText: "Aide" } });
    expect(details.languages).toEqual(["fr-CA"]);
    expect(details.legacy).toContain("language-tag");
  });

  it("names a language whose entry is empty without counting it as text", () => {
    const details = readFieldTranslationDetails({ ...colour, translations: { es: {}, fr: { label: " " } } });
    expect(details.translations).toEqual({});
    expect(details.languages).toEqual(["es", "fr"]);
    expect(details.legacy).toEqual(expect.arrayContaining(["empty-entry", "blank-text"]));
  });

  it("keeps text as typed, trailing spaces included", () => {
    expect(readFieldTranslations({ ...colour, translations: { fr: { label: "Nom " } } })).toEqual({ fr: { label: "Nom " } });
  });

  it("never throws on odd shapes", () => {
    expect(readFieldTranslations(null)).toEqual({});
    expect(readFieldTranslations({ translations: null })).toEqual({});
    expect(readFieldTranslationDetails({ translations: "fr" }).unknown).toEqual(["translations"]);
    const odd = readFieldTranslationDetails({
      translations: { fr: { label: 3, colour: "rouge", options: ["Rouge"] }, de: "Farbe", "": { label: "x" } },
    });
    expect(odd.translations).toEqual({});
    expect(odd.unknown).toEqual(expect.arrayContaining(["fr.label", "fr.colour", "fr.options", "de", ""]));
  });

  it("matches a scale's options and a layout cell's option list", () => {
    const scale = field({
      id: "pain",
      type: "scale",
      scaleConfig: { min: 0, max: 1, step: 1, options: [{ value: 0, label: "None" }, { value: 9, label: "Unknown", key: "9" }] },
      translations: { fr: { options: { None: "Aucune", Unknown: "Inconnu" } } },
    });
    expect(readFieldTranslations(scale)).toEqual({ fr: { options: { "0": "Aucune", "9": "Inconnu" } } });
    const cell = { optionList: [{ key: "Y", text: "Yes" }], translations: { fr: { options: { Yes: "Oui" } } } };
    expect(readFieldTranslations(cell)).toEqual({ fr: { options: { Y: "Oui" } } });
  });
});

describe("writing", () => {
  it("writes the one spelling, or null when nothing has text", () => {
    expect(writeFieldTranslations(colour, { FR: { label: "Couleur", options: { Blue: "Bleu", r: "" } }, es: {} })).toEqual({
      fr: { label: "Couleur", options: { b: "Bleu" } },
    });
    expect(writeFieldTranslations(colour, { fr: {} })).toBeNull();
    expect(fieldTranslationsPatch(colour, null)).toEqual({ translations: null });
  });

  it("writes what it read back unchanged", () => {
    const read = readFieldTranslations({ ...colour, translations: { fr_ca: { label: "Couleur", options: { Red: "Rouge" } } } });
    expect(writeFieldTranslations(colour, read)).toEqual(read);
  });

  it("edits one part at a time and drops a language left empty", () => {
    let current = setFieldTranslationText(colour, "fr-ca", { part: "label", text: "Couleur" });
    expect(current).toEqual({ "fr-CA": { label: "Couleur" } });
    current = setFieldTranslationText({ ...colour, translations: current }, "fr-CA", { part: "option", value: "r", text: "Rouge" });
    expect(current).toEqual({ "fr-CA": { label: "Couleur", options: { r: "Rouge" } } });
    current = setFieldTranslationText({ ...colour, translations: current }, "fr-CA", { part: "label", text: "" });
    current = setFieldTranslationText({ ...colour, translations: current }, "fr-CA", { part: "option", value: "r", text: "" });
    expect(current).toBeNull();
  });

  it("moves a legacy label key onto the stored value when an option is edited", () => {
    const legacy = { ...colour, translations: { fr: { options: { Blue: "Bleu" } } } };
    expect(setFieldTranslationText(legacy, "fr", { part: "option", value: "r", text: "Rouge" })).toEqual({
      fr: { options: { b: "Bleu", r: "Rouge" } },
    });
  });

  it("removes one language", () => {
    const both = { ...colour, translations: { fr: { label: "Couleur" }, es: { label: "Color" } } };
    expect(removeFieldTranslationLanguage(both, "FR")).toEqual({ es: { label: "Color" } });
    expect(removeFieldTranslationLanguage({ ...colour, translations: { fr: { label: "Couleur" } } }, "fr")).toBeNull();
  });
});

describe("option and part helpers", () => {
  it("finds an option's text by value, then by label", () => {
    const entry = { options: { r: "Rouge", Blue: "Bleu" } };
    expect(optionTranslationOf(entry, { value: "r", label: "Red" })).toBe("Rouge");
    expect(optionTranslationOf(entry, { value: "b", label: "Blue" })).toBe("Bleu");
    expect(optionTranslationOf(entry, { value: "g", label: "Green" })).toBeUndefined();
    expect(optionTranslationOf(undefined, { value: "r" })).toBeUndefined();
  });

  it("lists the parts with text", () => {
    expect(translatedParts({ label: "A", placeholder: " ", options: { a: "b" } })).toEqual(["label", "options"]);
    expect(translatedParts(null)).toEqual([]);
  });

  it("classifies items", () => {
    expect(translationItemKind("section")).toBe("section");
    expect(translationItemKind("heading")).toBe("heading");
    expect(translationItemKind("richText")).toBe("display");
    expect(translationItemKind("choice")).toBe("question");
  });
});

describe("readFormTranslations", () => {
  const document = {
    fields: [
      field({ id: "intro", type: "section", label: "Intro", translations: { fr: { label: "Introduction" } } }),
      field({ id: "marker", type: "text", translations: { "es-mx": {} } }),
      { ...colour, translations: { fr: { options: { Red: "Rouge" } } } },
      field({
        id: "dates",
        type: "date",
        behavior: {
          validations: [{ id: "v1", message: "Check dates", validWhen: { match: "all", conditions: [] }, translations: { de: "Daten prüfen", fr: "" } }],
        },
      }),
      field({
        id: "grid",
        type: "layoutTable",
        layoutTableConfig: {
          rows: [
            {
              id: "r1",
              cells: [
                { id: "c1", kind: "field", fieldId: "cellA", label: "Cell A", translations: { fr: { label: "Cellule A" } } },
                { id: "c2", kind: "fieldList", fields: [{ fieldId: "cellB", label: "Cell B", translations: { it: { label: "Cella B" } } }] },
              ],
            },
          ],
        } as unknown as BuilderField["layoutTableConfig"],
      }),
    ],
    design: { uiTranslations: { FR: { Submit: "Envoyer", Cancel: "" }, pt: {} } },
  };

  it("collects every language, item, message and interface string", () => {
    const result = readFormTranslations(document);
    expect(result.languages).toEqual(["fr", "es-MX", "de", "it", "pt"]);
    expect(result.items.map((item) => [item.fieldId, item.kind, item.containerId])).toEqual([
      ["intro", "section", undefined],
      ["colour", "question", undefined],
      ["cellA", "layout-cell", "grid"],
      ["cellB", "layout-cell", "grid"],
    ]);
    expect(result.items[1].translations).toEqual({ fr: { options: { r: "Rouge" } } });
    expect(result.validationMessages).toEqual([{ fieldId: "dates", ruleId: "v1", translations: { de: "Daten prüfen" } }]);
    expect(result.interfaceStrings).toEqual({ fr: { Submit: "Envoyer" } });
  });

  it("counts what each language holds", () => {
    const result = readFormTranslations(document);
    expect(countFormTranslations(result)).toEqual({ items: 4, validationMessages: 1, interfaceStrings: 1 });
    expect(countFormTranslations(result, "fr")).toEqual({ items: 3, validationMessages: 0, interfaceStrings: 1 });
    expect(formHasTranslations(result)).toBe(true);
  });

  it("has no translations when languages are only named", () => {
    const result = readFormTranslations({ fields: [field({ id: "a", type: "text", translations: { fr: {} } })], design: { uiTranslations: { fr: {} } } });
    expect(result.languages).toEqual(["fr"]);
    expect(formHasTranslations(result)).toBe(false);
  });
});
