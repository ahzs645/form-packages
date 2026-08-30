import { describe, expect, it } from "vitest";
import { BUILDER_FIELD_TYPES } from "./field-types";
import {
  BUILDER_FIELD_AUTHORING_CONTRACTS,
  buildBuilderFieldAuthoringSchema,
  getBuilderFieldAuthoringDefaults,
  validateBuilderFieldAuthoringValue,
} from "./field-authoring-contracts";

describe("builder field authoring contracts", () => {
  it("covers every canonical field type automatically", () => {
    expect(Object.keys(BUILDER_FIELD_AUTHORING_CONTRACTS)).toEqual([...BUILDER_FIELD_TYPES]);
  });

  it("provides a closed discriminated choice schema and matching defaults", () => {
    const schema = buildBuilderFieldAuthoringSchema("choice") as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
      additionalProperties: boolean;
    };

    expect(schema.properties.type.const).toBe("choice");
    expect(schema.properties.choiceStyle.enum).toContain("radio");
    expect(schema.required).toEqual(expect.arrayContaining(["id", "label", "type", "options", "choiceStyle"]));
    expect(schema.additionalProperties).toBe(false);
    expect(getBuilderFieldAuthoringDefaults("choice")).toEqual({
      options: ["Option 1", "Option 2"],
      choiceStyle: "findCode",
    });
  });

  it("rejects guessed foreign properties and accepts canonical choice vocabulary", () => {
    const base = {
      id: "contact_method",
      label: "Contact method",
      type: "choice" as const,
      options: ["Phone", "Email"],
    };
    expect(validateBuilderFieldAuthoringValue({ ...base, display: "radio" }, "choice")).toEqual(
      expect.arrayContaining([expect.stringContaining("display is not an authorable property")]),
    );
    expect(validateBuilderFieldAuthoringValue({ ...base, choiceStyle: "radio" }, "choice")).toEqual([]);
  });
});
