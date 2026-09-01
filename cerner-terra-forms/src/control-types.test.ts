import type { BuilderField } from "@webforms/form-model";
import { describe, expect, it } from "vitest";

import { resolveChoiceControl, resolveTerraControl } from "./control-types";

const field = (overrides: Partial<BuilderField>): BuilderField =>
  ({ id: "f1", label: "Field", type: "text", ...overrides }) as BuilderField;

describe("resolveTerraControl", () => {
  it("maps the simple input types", () => {
    expect(resolveTerraControl(field({ type: "text" })).control).toBe("text");
    expect(resolveTerraControl(field({ type: "textarea" })).control).toBe("textarea");
    expect(resolveTerraControl(field({ type: "number" })).control).toBe("number");
    expect(resolveTerraControl(field({ type: "date" })).control).toBe("date");
    expect(resolveTerraControl(field({ type: "datetime" })).control).toBe("datetime");
    expect(resolveTerraControl(field({ type: "time" })).control).toBe("time");
  });

  it("routes email, phone and url through the text control", () => {
    for (const type of ["email", "phone", "url"] as const) {
      expect(resolveTerraControl(field({ type })).control).toBe("text");
    }
  });

  it("maps the two boolean shapes differently", () => {
    expect(resolveTerraControl(field({ type: "booleanSingle" })).control).toBe("checkbox");
    expect(resolveTerraControl(field({ type: "booleanYesNo" })).control).toBe("radio-group");
  });

  it("maps structural and display kinds", () => {
    expect(resolveTerraControl(field({ type: "section" })).control).toBe("section");
    expect(resolveTerraControl(field({ type: "heading" })).control).toBe("heading");
    expect(resolveTerraControl(field({ type: "hyperlink" })).control).toBe("hyperlink");
    expect(resolveTerraControl(field({ type: "richText" })).control).toBe("rich-text");
    expect(resolveTerraControl(field({ type: "computed" })).control).toBe("computed-display");
    expect(resolveTerraControl(field({ type: "table" })).control).toBe("table");
  });

  it("degrades a MOIS component to a named placeholder rather than dropping it", () => {
    const resolved = resolveTerraControl(
      field({ type: "component", componentKey: "HonosQuestion" }),
    );
    expect(resolved.control).toBe("component-placeholder");
  });

  it("reports a reason for kinds with no Terra equivalent", () => {
    const resolved = resolveTerraControl(field({ type: "signature" }));
    expect(resolved.control).toBeNull();
    expect(resolved.source).toBe("unsupported");
    expect(resolved.reason).toMatch(/Signature/);
  });

  it("lets an author override win over inference", () => {
    const resolved = resolveTerraControl({
      ...field({ type: "text" }),
      terraConfig: { control: "textarea" },
    } as BuilderField);
    expect(resolved).toMatchObject({ control: "textarea", source: "override" });
  });
});

describe("resolveChoiceControl", () => {
  const choice = (overrides: Partial<BuilderField>) =>
    field({ type: "choice", options: ["A", "B"], ...overrides });

  it("maps each authored style to its Terra control", () => {
    expect(resolveChoiceControl(choice({ choiceStyle: "radio" }))).toBe("radio-group");
    expect(resolveChoiceControl(choice({ choiceStyle: "checkbox" }))).toBe("checkbox-group");
    expect(resolveChoiceControl(choice({ choiceStyle: "dropdown" }))).toBe("select");
    expect(resolveChoiceControl(choice({ choiceStyle: "simpleCodeSelect" }))).toBe("select");
    expect(resolveChoiceControl(choice({ choiceStyle: "findCode" }))).toBe("select-search");
    expect(resolveChoiceControl(choice({ choiceStyle: "multiselect" }))).toBe("select-search");
  });

  it("picks a control by list length when no style is authored", () => {
    expect(resolveChoiceControl(choice({ options: ["A", "B", "C"] }))).toBe("radio-group");
    const long = Array.from({ length: 12 }, (_, i) => `Option ${i}`);
    expect(resolveChoiceControl(choice({ options: long }))).toBe("select-search");
  });

  it("resolves through resolveTerraControl with choice-style provenance", () => {
    const resolved = resolveTerraControl(choice({ choiceStyle: "findCode" }));
    expect(resolved).toMatchObject({ control: "select-search", source: "choice-style" });
  });
});
