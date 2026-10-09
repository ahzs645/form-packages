import { describe, expect, expectTypeOf, it } from "vitest";

import type { ComponentKind } from "./document";
import {
  ALAYACARE_FIELD_TYPES,
  ALAYACARE_FIELD_TYPE_TO_FIELD_TYPE,
  BUILDER_FIELD_TYPES,
  CHOICE_DISPLAY_STYLE,
  CHOICE_PRESENTATIONS,
  CHOICE_PRESENTATION_TO_FHIR_ITEM_CONTROL,
  CHOICE_STYLES,
  CHOICE_STYLE_DISPLAY,
  DEFAULT_CHOICE_STYLE,
  EDITABLE_TABLE_COLUMN_TYPES,
  EDITABLE_TABLE_COLUMN_TYPE_TO_TABLE_COLUMN_TYPE,
  FHIR_ITEM_CONTROL_TO_CHOICE_PRESENTATION,
  FHIR_ITEM_TYPES,
  FHIR_ITEM_TYPE_TO_FIELD_TYPE,
  FHIR_ITEM_TYPE_TO_TABLE_COLUMN_TYPE,
  FIELD_TYPE_PROFILES,
  FIELD_TYPE_TO_ALAYACARE_FIELD_TYPE,
  FIELD_TYPE_TO_FHIR_ITEM_TYPE,
  FIELD_TYPE_TO_LAYOUT_CELL_INPUT_TYPE,
  FIELD_TYPE_TO_PARSED_KIND,
  FIELD_TYPE_TO_SUBFORM_ENTRY_TYPE,
  FIELD_TYPE_TO_TABLE_COLUMN_TYPE,
  FORMIO_COMPONENT_TYPES,
  FORMIO_COMPONENT_TYPE_TO_FIELD_TYPE,
  FORMIO_COMPONENT_TYPE_TO_TABLE_COLUMN_TYPE,
  LAYOUT_CELL_INPUT_TYPES,
  LAYOUT_CELL_INPUT_TYPE_TO_FIELD_TYPE,
  LAYOUT_CELL_INPUT_TYPE_TO_PARSED_KIND,
  NEUTRAL_ANSWER_TYPES,
  NEUTRAL_ANSWER_TYPE_TO_FIELD_TYPE,
  PARSED_FIELD_KINDS,
  PARSED_KIND_TO_FIELD_TYPE,
  SUBFORM_ENTRY_TYPES,
  SUBFORM_ENTRY_TYPE_TO_FIELD_TYPE,
  TABLE_COLUMN_TYPES,
  TABLE_COLUMN_TYPE_TO_EDITABLE_TABLE_COLUMN_TYPE,
  TABLE_COLUMN_TYPE_TO_FHIR_ITEM_TYPE,
  TABLE_COLUMN_TYPE_TO_FIELD_TYPE,
  choiceDisplayOf,
  choiceStyleFor,
  fhirItemTypeForField,
  fieldTypeForParsedField,
  isMultipleChoiceStyle,
  layoutCellInputTypeForField,
  neutralAnswerTypeOf,
  type ChoiceStyle,
  type FieldTypeInput,
} from "./field-types";
import type {
  BuilderField,
  BuilderFieldType,
  BuilderLayoutTableCellInputType,
  BuilderTableColumnType,
} from "./index";

const sorted = (values: Iterable<string>) => [...values].sort();

/** Every table keyed by one union, with the members its values must come from (null allowed when listed). */
const TABLES: Array<{
  name: string;
  keys: readonly string[];
  table: Record<string, unknown>;
  values: readonly string[];
  nullable: boolean;
}> = [
  { name: "field → neutral answer", keys: BUILDER_FIELD_TYPES, table: Object.fromEntries(Object.entries(FIELD_TYPE_PROFILES).map(([key, profile]) => [key, profile.answer])), values: NEUTRAL_ANSWER_TYPES, nullable: true },
  { name: "neutral answer → field", keys: NEUTRAL_ANSWER_TYPES, table: NEUTRAL_ANSWER_TYPE_TO_FIELD_TYPE, values: BUILDER_FIELD_TYPES, nullable: false },
  { name: "field → table column", keys: BUILDER_FIELD_TYPES, table: FIELD_TYPE_TO_TABLE_COLUMN_TYPE, values: TABLE_COLUMN_TYPES, nullable: true },
  { name: "table column → field", keys: TABLE_COLUMN_TYPES, table: TABLE_COLUMN_TYPE_TO_FIELD_TYPE, values: BUILDER_FIELD_TYPES, nullable: false },
  { name: "field → layout cell", keys: BUILDER_FIELD_TYPES, table: FIELD_TYPE_TO_LAYOUT_CELL_INPUT_TYPE, values: LAYOUT_CELL_INPUT_TYPES, nullable: true },
  { name: "layout cell → field", keys: LAYOUT_CELL_INPUT_TYPES, table: LAYOUT_CELL_INPUT_TYPE_TO_FIELD_TYPE, values: BUILDER_FIELD_TYPES, nullable: false },
  { name: "field → subform entry", keys: BUILDER_FIELD_TYPES, table: FIELD_TYPE_TO_SUBFORM_ENTRY_TYPE, values: SUBFORM_ENTRY_TYPES, nullable: true },
  { name: "subform entry → field", keys: SUBFORM_ENTRY_TYPES, table: SUBFORM_ENTRY_TYPE_TO_FIELD_TYPE, values: BUILDER_FIELD_TYPES, nullable: false },
  { name: "table column → EditableTable", keys: TABLE_COLUMN_TYPES, table: TABLE_COLUMN_TYPE_TO_EDITABLE_TABLE_COLUMN_TYPE, values: EDITABLE_TABLE_COLUMN_TYPES, nullable: false },
  { name: "EditableTable → table column", keys: EDITABLE_TABLE_COLUMN_TYPES, table: EDITABLE_TABLE_COLUMN_TYPE_TO_TABLE_COLUMN_TYPE, values: TABLE_COLUMN_TYPES, nullable: false },
  { name: "field → FHIR", keys: BUILDER_FIELD_TYPES, table: FIELD_TYPE_TO_FHIR_ITEM_TYPE, values: FHIR_ITEM_TYPES, nullable: false },
  { name: "FHIR → field", keys: FHIR_ITEM_TYPES, table: FHIR_ITEM_TYPE_TO_FIELD_TYPE, values: BUILDER_FIELD_TYPES, nullable: false },
  { name: "table column → FHIR", keys: TABLE_COLUMN_TYPES, table: TABLE_COLUMN_TYPE_TO_FHIR_ITEM_TYPE, values: FHIR_ITEM_TYPES, nullable: false },
  { name: "FHIR → table column", keys: FHIR_ITEM_TYPES, table: FHIR_ITEM_TYPE_TO_TABLE_COLUMN_TYPE, values: TABLE_COLUMN_TYPES, nullable: true },
  { name: "field → AlayaCare", keys: BUILDER_FIELD_TYPES, table: FIELD_TYPE_TO_ALAYACARE_FIELD_TYPE, values: ALAYACARE_FIELD_TYPES, nullable: true },
  { name: "AlayaCare → field", keys: ALAYACARE_FIELD_TYPES, table: ALAYACARE_FIELD_TYPE_TO_FIELD_TYPE, values: BUILDER_FIELD_TYPES, nullable: true },
  { name: "Form.io → field", keys: FORMIO_COMPONENT_TYPES, table: FORMIO_COMPONENT_TYPE_TO_FIELD_TYPE, values: BUILDER_FIELD_TYPES, nullable: true },
  { name: "Form.io → table column", keys: FORMIO_COMPONENT_TYPES, table: FORMIO_COMPONENT_TYPE_TO_TABLE_COLUMN_TYPE, values: TABLE_COLUMN_TYPES, nullable: true },
  { name: "field → parsed kind", keys: BUILDER_FIELD_TYPES, table: FIELD_TYPE_TO_PARSED_KIND, values: PARSED_FIELD_KINDS, nullable: false },
  { name: "layout cell → parsed kind", keys: LAYOUT_CELL_INPUT_TYPES, table: LAYOUT_CELL_INPUT_TYPE_TO_PARSED_KIND, values: PARSED_FIELD_KINDS, nullable: false },
  { name: "parsed kind → field", keys: PARSED_FIELD_KINDS, table: PARSED_KIND_TO_FIELD_TYPE, values: BUILDER_FIELD_TYPES, nullable: false },
  { name: "choice style → presentation", keys: CHOICE_STYLES, table: Object.fromEntries(Object.entries(CHOICE_STYLE_DISPLAY).map(([key, display]) => [key, display.presentation])), values: CHOICE_PRESENTATIONS, nullable: false },
  { name: "presentation → FHIR item control", keys: CHOICE_PRESENTATIONS, table: CHOICE_PRESENTATION_TO_FHIR_ITEM_CONTROL, values: Object.keys(FHIR_ITEM_CONTROL_TO_CHOICE_PRESENTATION), nullable: false },
];

describe("field type unions", () => {
  it("lists the builder, column, cell and parsed-kind unions exactly", () => {
    expectTypeOf<(typeof BUILDER_FIELD_TYPES)[number]>().toEqualTypeOf<BuilderFieldType>();
    expectTypeOf<(typeof TABLE_COLUMN_TYPES)[number]>().toEqualTypeOf<BuilderTableColumnType>();
    expectTypeOf<(typeof LAYOUT_CELL_INPUT_TYPES)[number]>().toEqualTypeOf<BuilderLayoutTableCellInputType>();
    expectTypeOf<(typeof PARSED_FIELD_KINDS)[number]>().toEqualTypeOf<ComponentKind>();
    expectTypeOf<ChoiceStyle>().toEqualTypeOf<NonNullable<BuilderField["choiceStyle"]>>();
  });

  it("has no duplicate members", () => {
    for (const list of [BUILDER_FIELD_TYPES, NEUTRAL_ANSWER_TYPES, TABLE_COLUMN_TYPES, LAYOUT_CELL_INPUT_TYPES, SUBFORM_ENTRY_TYPES, EDITABLE_TABLE_COLUMN_TYPES, FHIR_ITEM_TYPES, ALAYACARE_FIELD_TYPES, FORMIO_COMPONENT_TYPES, PARSED_FIELD_KINDS, CHOICE_STYLES, CHOICE_PRESENTATIONS]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});

describe.each(TABLES)("$name", ({ keys, table, values, nullable }) => {
  it("maps every member of its source union", () => {
    expect(sorted(Object.keys(table))).toEqual(sorted(keys));
  });

  it("maps only to members of its target union", () => {
    for (const [key, value] of Object.entries(table)) {
      if (value === null) {
        expect(nullable, `${key} maps to null`).toBe(true);
        continue;
      }
      expect(values, `${key} → ${String(value)}`).toContain(value);
    }
  });
});

describe("round trips", () => {
  it("returns to the same builder type through each container that holds it exactly", () => {
    // Types a container stores under another type's name, with the settings that restore them.
    const collapsed: Record<string, BuilderFieldType[]> = {
      tableColumn: ["datetime", "textarea", "email", "phone", "url"],
      layoutCell: ["datetime", "email", "phone", "url"],
      subformEntry: ["booleanSingle", "email", "phone", "url", "password", "barcode", "rating", "slider"],
      // A provider is a reference item; its referenceResource extension (Practitioner) restores it on import.
      fhir: ["booleanSingle", "email", "phone", "password", "barcode", "rating", "slider", "signature", "table", "layoutTable", "matrix", "component", "hyperlink", "richText", "scale", "computed", "provider"],
      alayaCare: ["booleanYesNo", "email", "phone", "url", "password", "barcode", "rating", "slider", "scale", "provider"],
      parsedKind: ["computed", "booleanYesNo", "datetime", "email", "phone", "url", "hyperlink", "textarea", "signature", "file", "password", "richText", "rating", "slider", "scale", "barcode", "provider"],
    };
    const routes: Array<[string, (type: BuilderFieldType) => BuilderFieldType | null]> = [
      ["tableColumn", (type) => { const column = FIELD_TYPE_TO_TABLE_COLUMN_TYPE[type]; return column && TABLE_COLUMN_TYPE_TO_FIELD_TYPE[column]; }],
      ["layoutCell", (type) => { const cell = FIELD_TYPE_TO_LAYOUT_CELL_INPUT_TYPE[type]; return cell && LAYOUT_CELL_INPUT_TYPE_TO_FIELD_TYPE[cell]; }],
      ["subformEntry", (type) => { const entry = FIELD_TYPE_TO_SUBFORM_ENTRY_TYPE[type]; return entry && SUBFORM_ENTRY_TYPE_TO_FIELD_TYPE[entry]; }],
      ["fhir", (type) => FHIR_ITEM_TYPE_TO_FIELD_TYPE[FIELD_TYPE_TO_FHIR_ITEM_TYPE[type]]],
      ["alayaCare", (type) => { const alaya = FIELD_TYPE_TO_ALAYACARE_FIELD_TYPE[type]; return alaya && ALAYACARE_FIELD_TYPE_TO_FIELD_TYPE[alaya]; }],
      ["parsedKind", (type) => PARSED_KIND_TO_FIELD_TYPE[FIELD_TYPE_TO_PARSED_KIND[type]]],
    ];
    for (const [route, roundTrip] of routes) {
      for (const type of BUILDER_FIELD_TYPES) {
        const back = roundTrip(type);
        if (back === null || collapsed[route].includes(type)) continue;
        expect(back, `${type} via ${route}`).toBe(type);
      }
    }
  });

  it("keeps the builder type through the parsed field when rawType carries it", () => {
    for (const type of BUILDER_FIELD_TYPES) {
      if (type === "booleanYesNo" || type === "booleanSingle") continue; // parsed rawType is "boolean"
      expect(fieldTypeForParsedField({ kind: FIELD_TYPE_TO_PARSED_KIND[type], rawType: type }), type).toBe(type);
    }
    expect(fieldTypeForParsedField({ kind: "text", rawType: "computed" })).toBe("computed");
    expect(fieldTypeForParsedField({ kind: "boolean", rawType: "boolean", booleanStyle: "yesNo" })).toBe("booleanYesNo");
    expect(fieldTypeForParsedField({ kind: "boolean", rawType: "boolean" })).toBe("booleanSingle");
    expect(fieldTypeForParsedField({ kind: "text", rawType: "checkbox" })).toBe("text");
  });

  it("returns every column type through EditableTable except yes/no", () => {
    for (const type of TABLE_COLUMN_TYPES) {
      const back = EDITABLE_TABLE_COLUMN_TYPE_TO_TABLE_COLUMN_TYPE[TABLE_COLUMN_TYPE_TO_EDITABLE_TABLE_COLUMN_TYPE[type]];
      expect(back, type).toBe(type === "booleanYesNo" ? "checkbox" : type);
    }
  });
});

describe("choice presentation", () => {
  it("draws every stored style the same way after a round trip", () => {
    for (const style of CHOICE_STYLES) {
      const display = CHOICE_STYLE_DISPLAY[style];
      expect(CHOICE_STYLE_DISPLAY[choiceStyleFor(display)], style).toEqual(display);
    }
  });

  it("stores each presentation and selection as a style of the same selection", () => {
    for (const selection of ["single", "multiple"] as const) {
      for (const presentation of CHOICE_PRESENTATIONS) {
        const style = CHOICE_DISPLAY_STYLE[selection][presentation];
        expect(CHOICE_STYLE_DISPLAY[style].selection).toBe(selection);
      }
    }
  });

  it("uses each context's default for an unset style", () => {
    expect(choiceDisplayOf(undefined)).toEqual({ presentation: "searchable", selection: "single" });
    expect(choiceDisplayOf(null, "tableColumn")).toEqual({ presentation: "dropdown", selection: "single" });
    expect(choiceDisplayOf("nonsense", "subformEntry")).toEqual(CHOICE_STYLE_DISPLAY[DEFAULT_CHOICE_STYLE.subformEntry]);
    expect(choiceDisplayOf("checkbox", "tableColumn")).toEqual({ presentation: "checklist", selection: "multiple" });
  });

  it("knows which styles allow several answers", () => {
    expect(CHOICE_STYLES.filter(isMultipleChoiceStyle)).toEqual(["multiselect", "checkbox"]);
    expect(isMultipleChoiceStyle(undefined)).toBe(false);
  });

  it("round-trips presentations through FHIR item controls", () => {
    for (const presentation of CHOICE_PRESENTATIONS) {
      expect(FHIR_ITEM_CONTROL_TO_CHOICE_PRESENTATION[CHOICE_PRESENTATION_TO_FHIR_ITEM_CONTROL[presentation]]).toBe(presentation);
    }
  });
});

describe("field-level refinements", () => {
  const field = (type: BuilderFieldType, extra: Partial<FieldTypeInput> & Record<string, unknown> = {}) => ({ type, ...extra });

  it("derives the neutral answer type from type and settings", () => {
    expect(neutralAnswerTypeOf(field("choice"))).toBe("singleChoice");
    expect(neutralAnswerTypeOf(field("choice", { choiceStyle: "checkbox" }))).toBe("multipleChoice");
    expect(neutralAnswerTypeOf(field("choice", { choiceStyle: "multiselect" }))).toBe("multipleChoice");
    expect(neutralAnswerTypeOf(field("date"))).toBe("date");
    expect(neutralAnswerTypeOf(field("date", { dateConfig: { withTime: true } }))).toBe("dateTime");
    expect(neutralAnswerTypeOf(field("richText"))).toBeNull();
    expect(neutralAnswerTypeOf(field("richText", { richTextConfig: { readOnly: false } }))).toBe("longText");
    expect(neutralAnswerTypeOf(field("email"))).toBe("text");
    expect(neutralAnswerTypeOf(field("section"))).toBeNull();
    for (const type of BUILDER_FIELD_TYPES) {
      const profile = FIELD_TYPE_PROFILES[type];
      expect(profile.answer === null, type).toBe(profile.role !== "answer");
    }
  });

  it("stores each neutral answer type as a builder type that reads back as it", () => {
    for (const answer of NEUTRAL_ANSWER_TYPES) {
      const type = NEUTRAL_ANSWER_TYPE_TO_FIELD_TYPE[answer];
      const settings = answer === "multipleChoice" ? { choiceStyle: "checkbox" } : {};
      expect(neutralAnswerTypeOf(field(type, settings)), answer).toBe(answer);
    }
  });

  it("refines FHIR item types from number, computed, date and rich-text settings", () => {
    expect(fhirItemTypeForField(field("number"))).toBe("integer");
    expect(fhirItemTypeForField(field("number", { numberConfig: { typeNumber: "decimal" } }))).toBe("decimal");
    expect(fhirItemTypeForField(field("computed"))).toBe("decimal");
    expect(fhirItemTypeForField(field("computed", { computedConfig: { resultType: "text" } }))).toBe("string");
    expect(fhirItemTypeForField(field("computed", { calculatedValue: { resultType: "text" }, computedConfig: { resultType: "number" } }))).toBe("string");
    expect(fhirItemTypeForField(field("computed", { numberConfig: { typeNumber: "number" } }))).toBe("integer");
    expect(fhirItemTypeForField(field("date", { dateConfig: { withTime: true } }))).toBe("dateTime");
    expect(fhirItemTypeForField(field("richText", { richTextConfig: { readOnly: false } }))).toBe("text");
    expect(fhirItemTypeForField(field("scale"))).toBe("choice");
  });

  it("uses choiceMulti for a multiple choice in a layout cell", () => {
    expect(layoutCellInputTypeForField(field("choice"))).toBe("choice");
    expect(layoutCellInputTypeForField(field("choice", { choiceStyle: "checkbox" }))).toBe("choiceMulti");
    expect(layoutCellInputTypeForField(field("table"))).toBeNull();
  });
});

describe("signature cells", () => {
  it("are a table column type and a layout cell input type that keep the signature field type", () => {
    expect(TABLE_COLUMN_TYPES).toContain("signature");
    expect(LAYOUT_CELL_INPUT_TYPES).toContain("signature");
    expect(FIELD_TYPE_TO_TABLE_COLUMN_TYPE.signature).toBe("signature");
    expect(FIELD_TYPE_TO_LAYOUT_CELL_INPUT_TYPE.signature).toBe("signature");
    expect(TABLE_COLUMN_TYPE_TO_FIELD_TYPE.signature).toBe("signature");
    expect(LAYOUT_CELL_INPUT_TYPE_TO_FIELD_TYPE.signature).toBe("signature");
    expect(layoutCellInputTypeForField({ type: "signature" })).toBe("signature");
  });

  it("is drawn by EditableTable, exported to FHIR as an attachment and read by the MOIS exporter as a signature", () => {
    expect(TABLE_COLUMN_TYPE_TO_EDITABLE_TABLE_COLUMN_TYPE.signature).toBe("signature");
    expect(EDITABLE_TABLE_COLUMN_TYPE_TO_TABLE_COLUMN_TYPE.signature).toBe("signature");
    expect(TABLE_COLUMN_TYPE_TO_FHIR_ITEM_TYPE.signature).toBe("attachment");
    expect(FIELD_TYPE_TO_FHIR_ITEM_TYPE.signature).toBe("attachment");
    expect(LAYOUT_CELL_INPUT_TYPE_TO_PARSED_KIND.signature).toBe("signature");
    expect(PARSED_KIND_TO_FIELD_TYPE[LAYOUT_CELL_INPUT_TYPE_TO_PARSED_KIND.signature]).toBe("signature");
    // A Form.io data grid's signature component is a signature column.
    expect(FORMIO_COMPONENT_TYPE_TO_TABLE_COLUMN_TYPE.signature).toBe("signature");
    // Subform entries still have no signature question.
    expect(FIELD_TYPE_TO_SUBFORM_ENTRY_TYPE.signature).toBeNull();
  });
});
