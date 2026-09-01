import { describe, expect, it } from "vitest";
import { BUILDER_FIELD_TYPES } from "@webforms/form-model";
import type { BuilderField, ComponentKind, ParsedField } from "@webforms/form-model";
// lib/ lives outside this package; the repo-root vitest.config.ts maps "@" to
// the repo root, so the real conversion function is importable here.
import { builderFieldToParsedField } from "@/lib/builder-parsed-field";
import { allFieldKindsFixture, getFixtureChoiceStyles, getFixtureFieldKinds } from "./fixtures";

/**
 * Validates the coverage fixture itself, not a renderer — the Cerner Terra
 * renderer does not exist yet. These assertions are what keep the fixture
 * honest as the renderer lands: if someone deletes the checkbox-style choice
 * field or renames a section child, this fails before the renderer test does.
 */

const TIER_1_KINDS = [
  "section",
  "text",
  "textarea",
  "number",
  "date",
  "booleanYesNo",
  "booleanSingle",
  "choice",
] as const;

const TIER_2_KINDS = ["heading", "hyperlink", "richText", "computed", "component"] as const;

const TIER_3_KINDS = ["time", "datetime", "table", "layoutTable"] as const;

const REQUIRED_CHOICE_STYLES = [
  "findCode",
  "simpleCodeSelect",
  "radio",
  "checkbox",
  "dropdown",
] as const;

const COMPONENT_KINDS: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
  "text",
  "number",
  "boolean",
  "choice",
  "date",
  "time",
  "table",
  "layoutTable",
  "component",
  "rating",
  "slider",
  "scale",
  "matrix",
  "barcode",
  "file",
  "signature",
  "section",
  "heading",
]);

const fieldsById = new Map(allFieldKindsFixture.map((field) => [field.id, field]));

function parseAll(): ParsedField[] {
  return allFieldKindsFixture.map((field, index) => builderFieldToParsedField(field, index));
}

function childIdsOf(field: BuilderField): string[] {
  if (field.type === "section") return field.sectionConfig?.childFieldIds ?? [];
  if (field.type === "heading") return field.headingConfig?.childFieldIds ?? [];
  return [];
}

describe("cerner-terra all-field-kinds fixture", () => {
  it("has unique, non-empty ids and labels", () => {
    expect(allFieldKindsFixture.length).toBeGreaterThan(0);
    expect(fieldsById.size).toBe(allFieldKindsFixture.length);
    for (const field of allFieldKindsFixture) {
      expect(field.id.trim()).not.toBe("");
      expect(field.label.trim()).not.toBe("");
    }
  });

  it("only uses authorable builder field types", () => {
    const authorable = new Set<string>(BUILDER_FIELD_TYPES);
    for (const field of allFieldKindsFixture) {
      expect(authorable.has(field.type), `${field.id} has unknown type ${field.type}`).toBe(true);
    }
  });

  it("converts through builderFieldToParsedField without throwing", () => {
    expect(() => parseAll()).not.toThrow();
  });

  it("produces a well-formed ParsedField for every fixture field", () => {
    const parsed = parseAll();
    expect(parsed).toHaveLength(allFieldKindsFixture.length);

    parsed.forEach((field, index) => {
      const source = allFieldKindsFixture[index];
      expect(field.id).toBe(source.id);
      expect(field.label.trim()).not.toBe("");
      expect(field.rawType).toBeTruthy();
      expect(typeof field.required).toBe("boolean");
      expect(
        COMPONENT_KINDS.has(field.kind),
        `${field.id} parsed to unknown ComponentKind ${field.kind}`
      ).toBe(true);
    });
  });

  it("covers every Tier 1 field kind", () => {
    const kinds = new Set(getFixtureFieldKinds());
    for (const kind of TIER_1_KINDS) {
      expect(kinds.has(kind), `Tier 1 kind missing from fixture: ${kind}`).toBe(true);
    }
  });

  it("covers every Tier 2 field kind", () => {
    const kinds = new Set(getFixtureFieldKinds());
    for (const kind of TIER_2_KINDS) {
      expect(kinds.has(kind), `Tier 2 kind missing from fixture: ${kind}`).toBe(true);
    }
  });

  it("covers every Tier 3 field kind", () => {
    const kinds = new Set(getFixtureFieldKinds());
    for (const kind of TIER_3_KINDS) {
      expect(kinds.has(kind), `Tier 3 kind missing from fixture: ${kind}`).toBe(true);
    }
  });

  it("covers every required choice style", () => {
    const styles = new Set(getFixtureChoiceStyles());
    for (const style of REQUIRED_CHOICE_STYLES) {
      expect(styles.has(style), `choice style missing from fixture: ${style}`).toBe(true);
    }
    // Every choice style survives the conversion onto the parsed field.
    const parsedChoiceStyles = new Set(
      parseAll()
        .filter((field) => field.kind === "choice")
        .map((field) => field.choiceStyle)
    );
    for (const style of REQUIRED_CHOICE_STYLES) {
      expect(parsedChoiceStyles.has(style), `choice style lost in parse: ${style}`).toBe(true);
    }
  });

  it("gives every choice field at least two options", () => {
    for (const field of allFieldKindsFixture) {
      if (field.type !== "choice") continue;
      expect((field.options ?? []).length, `${field.id} needs options`).toBeGreaterThanOrEqual(2);
    }
  });

  it("resolves every section and heading childFieldId to a real field", () => {
    let containers = 0;
    for (const field of allFieldKindsFixture) {
      const childIds = childIdsOf(field);
      if (field.type === "section" || field.type === "heading") containers += 1;
      for (const childId of childIds) {
        expect(fieldsById.has(childId), `${field.id} claims unknown child ${childId}`).toBe(true);
        expect(childId, `${field.id} claims itself as a child`).not.toBe(field.id);
      }
    }
    expect(containers).toBeGreaterThan(0);
    // The section fixture must actually exercise nesting, not just declare it.
    const sections = allFieldKindsFixture.filter((field) => field.type === "section");
    expect(sections.length).toBeGreaterThanOrEqual(1);
    for (const section of sections) {
      expect(childIdsOf(section).length).toBeGreaterThan(0);
    }
  });

  it("never lets two containers claim the same child", () => {
    const claims = new Map<string, string>();
    for (const field of allFieldKindsFixture) {
      for (const childId of childIdsOf(field)) {
        const previous = claims.get(childId);
        expect(previous, `${childId} claimed by both ${previous} and ${field.id}`).toBeUndefined();
        claims.set(childId, field.id);
      }
    }
  });

  it("carries childFieldIds through to the parsed section and heading", () => {
    const parsed = parseAll();
    for (const [index, field] of allFieldKindsFixture.entries()) {
      if (field.type !== "section" && field.type !== "heading") continue;
      expect(parsed[index].childFieldIds).toEqual(childIdsOf(field));
    }
  });

  it("exercises the cross-cutting field features the renderer must honour", () => {
    const parsed = parseAll();
    const byId = new Map(parsed.map((field) => [field.id, field]));

    expect(parsed.some((field) => field.required)).toBe(true);
    expect(parsed.some((field) => Boolean(field.helpText))).toBe(true);
    expect(parsed.some((field) => Boolean(field.placeholder))).toBe(true);
    expect(parsed.some((field) => field.disabled === true)).toBe(true);
    expect(parsed.some((field) => Boolean(field.prefill))).toBe(true);

    // width set to a fraction (not just "auto"/"full")
    const fractionWidths = new Set(["1/2", "1/3", "2/3", "1/4", "3/4"]);
    expect(parsed.some((field) => fractionWidths.has(String(field.width)))).toBe(true);

    // labelPosition overrides
    const labelPositions = new Set(parsed.map((field) => field.labelPosition).filter(Boolean));
    expect(labelPositions.size).toBeGreaterThanOrEqual(2);

    // show-when visibility referencing another real field
    const conditional = parsed.filter(
      (field) => field.visibility && field.visibility.type !== "always"
    );
    expect(conditional.length).toBeGreaterThan(0);
    for (const field of conditional) {
      const controllerId = field.visibility?.controllerId;
      expect(controllerId, `${field.id} visibility has no controller`).toBeTruthy();
      expect(
        fieldsById.has(String(controllerId)),
        `${field.id} visibility references unknown field ${controllerId}`
      ).toBe(true);
      for (const condition of field.visibility?.additionalConditions ?? []) {
        expect(
          fieldsById.has(condition.controllerId),
          `${field.id} visibility references unknown field ${condition.controllerId}`
        ).toBe(true);
      }
    }

    // validation rules survive normalization
    const validated = parsed.filter((field) => (field.validation?.rules ?? []).length > 0);
    expect(validated.length).toBeGreaterThan(0);

    // the computed field references fields that exist in the fixture
    const computed = byId.get("apgar_total");
    expect(computed?.computedExpression).toBeTruthy();
    for (const referenced of String(computed?.computedExpression).matchAll(/\[([^\]]+)\]/g)) {
      expect(
        fieldsById.has(referenced[1]),
        `computed expression references unknown field ${referenced[1]}`
      ).toBe(true);
    }

    // the component field carries a componentKey
    const component = parsed.find((field) => field.kind === "component");
    expect(component?.componentKey).toBeTruthy();
  });

  it("keeps clinical content on the fields rather than placeholder text", () => {
    for (const field of allFieldKindsFixture) {
      expect(field.label).not.toMatch(/^Field \d+$/);
      for (const option of field.options ?? []) {
        const label = typeof option === "string" ? option : option.label;
        expect(label).not.toMatch(/^Option \d+$/);
      }
    }
  });
});
