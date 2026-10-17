import { describe, expect, it } from "vitest";
import {
  COMPONENT_KINDS,
  componentImplementationsMatch,
  componentKindCode,
  componentKindOfLegacyKey,
  componentKindOwner,
  readComponent,
  scaleRatings,
  writeComponent,
  writeComponentImplementation,
} from "./components";
import type { BuilderField } from "./index";

const component = (overrides: Partial<BuilderField>): BuilderField => ({ id: "c1", type: "component", label: "Component", ...overrides });

describe("readComponent: the MOIS store", () => {
  it("reads a MultiTargetChoiceField as a tick-box group with its boxes and their MOIS columns", () => {
    const read = readComponent(component({
      componentKey: "MultiTargetChoiceField",
      componentProps: {
        options: [
          { code: "str_field_1", display: "School", target: { fieldId: "s1_str_field_1", mode: "yesNo", value: "YES", offValue: "NO" } },
          { code: "str_field_2", display: "Parent", target: { fieldId: "s1_str_field_2", mode: "yesNo" }, force: { fieldId: "other", value: "Y" }, visibleWhen: { controllerFieldId: "x" } },
        ],
      },
    }));
    expect(read).toMatchObject({ kind: "checkboxGroup", store: "legacy", legacyKey: "MultiTargetChoiceField", implementations: { mois: { as: "component", key: "MultiTargetChoiceField" } } });
    expect(read?.props).toEqual({
      multiple: true,
      options: [
        { value: "str_field_1", label: "School", target: { fieldId: "s1_str_field_1", mode: "yesNo", value: "YES", offValue: "NO" } },
        { value: "str_field_2", label: "Parent", target: { fieldId: "s1_str_field_2", mode: "yesNo" }, effect: { fieldId: "other" }, conditional: true },
      ],
    });
  });

  it("reads HonosQuestion by its export: a scored rating by default, the legend, the total and the submit button", () => {
    const rating = readComponent(component({ componentKey: "HonosQuestion", componentProps: { tooltip: [{ rating: 0, description: "No problems." }] } }));
    expect(rating?.kind).toBe("scoredQuestion");
    expect(rating?.legacyKey).toBe("HonosQuestion#Scale5");
    expect((rating?.props.ratings as Array<{ value: string; score: number; description?: string }>).map((entry) => [entry.value, entry.score, entry.description ?? null])).toEqual([
      ["0", 0, "No problems."], ["1", 1, null], ["2", 2, null], ["3", 3, null], ["4", 4, null], ["9", 0, null],
    ]);
    expect(readComponent(component({ componentKey: "HonosQuestion", componentProps: { nhformsExport: "Scale5Legend" } }))?.kind).toBe("scaleLegend");
    expect(readComponent(component({ componentKey: "HonosQuestion", componentProps: { nhformsExport: "HonosFinalScore", scoredQuestionIds: ["1", "2"], questionIds: ["1", "2", "3"] } }))).toMatchObject({
      kind: "scoreTotal",
      props: { questionIds: ["1", "2"] },
      implementations: { mois: { as: "component", key: "HonosFinalScore" } },
    });
    expect(readComponent(component({ componentKey: "HonosQuestion", componentProps: { nhformsExport: "Scale5SubmitButton" } }))?.kind).toBe("submitButton");
  });

  it("reads observation history from every history component, with its observation codes", () => {
    expect(readComponent(component({ componentKey: "ObservationChart", componentProps: { observationCodes: ["61839"], observationCode: "61839", maxPoints: 30 } }))?.props).toEqual({ codes: ["61839"], display: "chart", maxRows: 30 });
    expect(readComponent(component({ componentKey: "FocusedObservationHistory", componentProps: { watchFields: [{ observationCode: "22732" }, { observationCode: "61826" }], maxRows: 5 } }))?.props).toEqual({ codes: ["22732", "61826"], display: "focused", maxRows: 5 });
    expect(readComponent(component({ componentKey: "Whatever", componentProps: { nhformsExport: "FlowSheet", rows: [{ code: "128" }, { code: "----" }, { kind: "medication", match: "C09" }, { code: "1950" }] } }))?.props).toMatchObject({ codes: ["128", "1950"], display: "flowsheet" });
  });

  it("folds retired keys and reads a rich-text export under any key", () => {
    expect(readComponent(component({ componentKey: "MoisMarkdownBlock", componentProps: { source: "**Hi**" } }))).toMatchObject({ kind: "richText", props: { source: "**Hi**" }, implementations: { mois: { key: "RichMarkdownBlock" } } });
    expect(readComponent(component({ componentKey: "Legacy", componentProps: { nhformsExport: "RichMarkdownBlock", source: "x" } }))?.kind).toBe("richText");
  });

  it("names every other component by its product: mois:<Key>, cerner:<Key>, and the PowerChart pairs as neutral kinds", () => {
    expect(readComponent(component({ componentKey: "PlannedActions" }))).toMatchObject({ kind: "mois:PlannedActions", implementations: { mois: { as: "component", key: "PlannedActions" } } });
    const pair = { systolic: { id: "s", type: "number", label: "Systolic" }, diastolic: { id: "d", type: "number", label: "Diastolic" } } as const;
    const bp = readComponent(component({ componentKey: "CernerBloodPressure", cernerConfig: { version: 1, sourceKind: "authored", formName: "", sectionName: "", importStatus: "lossy", inputType: 0, inputRefSeq: 0, preferences: {}, bloodPressure: pair as never } }));
    expect(bp).toMatchObject({ kind: "bloodPressure", props: pair });
    // A Cerner control has no MOIS component.
    expect(bp?.implementations.mois).toBeUndefined();
    expect(componentKindOfLegacyKey("CernerSomethingNew")).toBe("cerner:CernerSomethingNew");
    expect(componentKindOwner("bloodPressure")).toBe("cerner");
    expect(componentKindOwner("mois:PlannedActions")).toBe("mois");
    expect(componentKindOwner("scoredQuestion")).toBeUndefined();
  });

  it("reads a chart-list component as the chart list, and ChartRecordTable on another collection as MOIS's own", () => {
    expect(readComponent(component({ componentKey: "ChartRecordTable", componentProps: { source: "allergies" } }))?.kind).toBe("chartList");
    expect(readComponent(component({ componentKey: "Allergies" }))?.kind).toBe("chartList");
    expect(readComponent(component({ componentKey: "ChartRecordTable", componentProps: { source: "goals" } }))?.kind).toBe("mois:ChartRecordTable");
  });

  it("is null for any other field", () => {
    expect(readComponent({ id: "t", type: "text", label: "Text", componentKey: "ObservationChart" })).toBeNull();
    expect(readComponent(component({}))).toBeNull();
  });
});

describe("readComponent: the neutral store", () => {
  it("reads a component authored for no MOIS component from `component`", () => {
    expect(readComponent(component({ component: { kind: "observationHistory", props: { codes: ["1950"] }, implementations: { fhir: { as: "omit", fallback: "none" } } } }))).toEqual({
      kind: "observationHistory",
      props: { codes: ["1950"] },
      implementations: { fhir: { as: "omit", fallback: "none" } },
      legacyKey: null,
      store: "component",
    });
  });

  it("keeps the stored implementations while the MOIS component still names the same kind", () => {
    const read = readComponent(component({ componentKey: "ObservationChart", componentProps: { observationCode: "1" }, component: { kind: "observationHistory", implementations: { cerner: { as: "omit", fallback: "placeholder" } } } }));
    expect(read).toMatchObject({ store: "component", implementations: { cerner: { as: "omit", fallback: "placeholder" }, mois: { key: "ObservationChart" } } });
  });

  it("lets the edited MOIS component win when the kinds disagree, without the other kind's choices", () => {
    const read = readComponent(component({ componentKey: "FormVersion", component: { kind: "observationHistory", implementations: { cerner: { as: "omit", fallback: "placeholder" } } } }));
    expect(read).toMatchObject({ kind: "formVersion", store: "legacy" });
    expect(read?.implementations.cerner).toBeUndefined();
  });

  it("reads alayaCareConfig.fieldType as the AlayaCare implementation, over a stored one", () => {
    const read = readComponent(component({
      componentKey: "PlannedActions",
      alayaCareConfig: { fieldType: "care_plan" },
      component: { kind: "mois:PlannedActions", implementations: { alayacare: { as: "omit", fallback: "none" } } },
    }));
    expect(read?.implementations.alayacare).toEqual({ as: "fieldType", fieldType: "care_plan" });
  });
});

describe("writers", () => {
  it("stores one target's implementation without touching the MOIS component", () => {
    const field = component({ componentKey: "MultiTargetChoiceField", componentProps: { options: [] } });
    const patch = writeComponentImplementation(field, "fhir", { as: "decompose", variant: "checkboxes" });
    expect(patch).toEqual({ component: { kind: "checkboxGroup", implementations: { fhir: { as: "decompose", variant: "checkboxes" } } } });
    const next = { ...field, ...patch };
    expect(readComponent(next)?.implementations.fhir).toEqual({ as: "decompose", variant: "checkboxes" });
    // Clearing goes back to the default.
    expect(writeComponentImplementation(next, "fhir", null)).toEqual({ component: { kind: "checkboxGroup" } });
  });

  it("mirrors an AlayaCare field type into alayaCareConfig.fieldType, and removes it when cleared", () => {
    const field = component({ componentKey: "DrawerDiagramField", alayaCareConfig: { fieldTag: "tag" } });
    const patch = writeComponentImplementation(field, "alayacare", { as: "fieldType", fieldType: "drawing" });
    expect(patch.alayaCareConfig).toEqual({ fieldTag: "tag", fieldType: "drawing" });
    const next = { ...field, ...patch };
    expect(readComponent(next)?.implementations.alayacare).toEqual({ as: "fieldType", fieldType: "drawing" });
    const cleared = writeComponentImplementation(next, "alayacare", { as: "omit", fallback: "placeholder" });
    expect(cleared.alayaCareConfig).toEqual({ fieldTag: "tag" });
    expect(readComponent({ ...next, ...cleared })?.implementations.alayacare).toEqual({ as: "omit", fallback: "placeholder" });
  });

  it("writes a new component with its MOIS component as the mirror", () => {
    expect(writeComponent({ id: "n", type: "text", label: "New" }, {
      kind: "observationHistory",
      implementations: { mois: { as: "component", key: "ObservationChart", props: { observationCode: "1950" } } },
    })).toEqual({
      type: "component",
      component: { kind: "observationHistory", implementations: { mois: { as: "component", key: "ObservationChart", props: { observationCode: "1950" } } } },
      componentKey: "ObservationChart",
      componentProps: { observationCode: "1950" },
    });
  });

  it("is a no-op for a field that is not a component", () => {
    expect(writeComponentImplementation({ id: "t", type: "text", label: "T" }, "fhir", null)).toEqual({});
  });
});

describe("vocabulary", () => {
  it("names each neutral kind once, with codes safe for loss codes", () => {
    const ids = COMPONENT_KINDS.map((kind) => kind.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(componentKindCode("mois:HFC_PT_ASMT_SnapShot")).toBe("mois.HFC-PT-ASMT-SnapShot");
    expect(componentImplementationsMatch({ as: "omit", fallback: "none" }, { as: "omit", fallback: "none" })).toBe(true);
    expect(componentImplementationsMatch({ as: "omit", fallback: "none" }, { as: "omit", fallback: "placeholder" })).toBe(false);
    expect(scaleRatings(10).map((rating) => rating.value)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });
});
