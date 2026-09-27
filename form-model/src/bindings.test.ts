import { describe, expect, it } from "vitest";

import {
  BINDING_LOINC_SYSTEM as LOINC,
  BINDING_MOIS_OBSERVATION_SYSTEM as MOIS,
  fieldBindingPatch,
  inferFieldBindingShape,
  moisReadPathsOf,
  readFieldBinding,
  readFieldBindingDetails,
  writeFieldBinding,
  type BuilderFieldBinding,
  type FieldBindingCatalog,
  type FieldBindingShape,
} from "./bindings";

/** A small stand-in for the app catalog (lib/field-bindings.ts). */
const CATALOG: FieldBindingCatalog = {
  conceptForPath: (path) =>
    path === "patient.healthNumber" ? { concept: "patient.phn" }
      : path === "patient.birthDate.ageMonths" ? { concept: "patient.age", variant: "months" }
        : path === "patient.birthDate.ageYears" ? { concept: "patient.age" }
          : path === "patient.observations[observationCode=22732].value" ? { concept: "vital.weight" }
            : null,
  pathForConcept: (concept, variant) =>
    concept === "patient.phn" ? "patient.healthNumber"
      : concept === "patient.age" ? (variant === "months" ? "patient.birthDate.ageMonths" : "patient.birthDate.ageYears")
        : concept === "vital.weight" ? "patient.observations[observationCode=22732].value"
          : null,
  conceptForAlayaCare: (setting) =>
    setting.fieldType === "demographics" && setting.demographicsFieldName === "uid" ? "patient.phn"
      : setting.fieldType === "vital" && setting.vitalType === "weight" ? "vital.weight"
        : null,
  conceptParts: (concept) =>
    concept === "patient.phn" ? { read: true }
      : concept === "vital.weight" ? { read: true, write: { code: "22732", system: MOIS, unit: "kg", codings: [{ code: "29463-7", system: LOINC }], valueType: "NUMERIC" } }
        : null,
  observationIdentity: (coding) =>
    coding.system === MOIS && coding.code === "22732" ? { concept: "vital.weight", codings: [{ code: "29463-7", system: LOINC }], unit: "kg" }
      : coding.system === LOINC && coding.code === "29463-7" ? { concept: "vital.weight", codings: [{ code: "22732", system: MOIS }], unit: "kg" }
        : null,
  observationForDta: (dta) =>
    dta.mnemonic === "Weight Measured" ? { code: "22732", system: MOIS, unit: "kg", codings: [{ code: "29463-7", system: LOINC }], concept: "vital.weight" } : null,
  queryPath: (query) => `patient.chart.query.q${query.system}|${query.code}`,
};

const WEIGHT_OBSERVATION = { code: "29463-7", system: LOINC, unit: "kg", codings: [{ code: "22732", system: MOIS }] };

type ReadCase = { name: string; value: object; shape?: FieldBindingShape; catalog?: boolean; expected: BuilderFieldBinding | null };

const READ_CASES: ReadCase[] = [
  // --- sourceConfig ---------------------------------------------------------
  {
    name: "sourceConfig text path",
    value: { id: "a", type: "text", sourceConfig: { paths: ["webform.provider.name"], format: "text", mode: "initial" } },
    expected: { read: { paths: ["webform.provider.name"], mode: "initial", presentation: "shown", format: "text" } },
  },
  {
    name: "sourceConfig with fallback, coding, sync, backing and a transform",
    value: { id: "a", type: "choice", sourceConfig: { paths: ["webform.encounter.location", "encounter.location"], format: "coding", mode: "sync", fallback: "Unknown", presentation: "backing", valueTransform: "exists" } },
    expected: { read: { paths: ["webform.encounter.location", "encounter.location"], mode: "sync", presentation: "backing", fallback: "Unknown", format: "coding", transform: "exists" } },
  },
  { name: "cleared sourceConfig", value: { id: "a", type: "text", sourceConfig: null }, expected: null },
  { name: "sourceConfig without paths", value: { id: "a", type: "text", sourceConfig: { paths: [], mode: "initial" } }, expected: null },
  {
    name: "legacy datetime format",
    value: { id: "a", type: "datetime", sourceConfig: { paths: ["webform.encounter.appointmentDateTime"], format: "datetime", mode: "initial" } },
    expected: { read: { paths: ["webform.encounter.appointmentDateTime"], mode: "initial", presentation: "shown", format: "dateTime" } },
  },
  {
    name: "blank and null fallbacks are none",
    value: { id: "a", type: "text", sourceConfig: { paths: ["patient.name.first"], fallback: null } },
    expected: { read: { paths: ["patient.name.first"], mode: "initial", presentation: "shown" } },
  },
  {
    name: "chart query",
    value: { id: "a", type: "number", sourceConfig: { paths: ["patient.chart.query.q7b"], mode: "sync", format: "text", chartQuery: { kind: "Observation", system: LOINC, code: "8480-6", unit: "mm[Hg]", encounter: "selected", lookBackDays: 30 } } },
    expected: { read: { observation: { code: "8480-6", system: LOINC, unit: "mm[Hg]" }, query: { encounter: "selected", lookBackDays: 30 }, mode: "sync", presentation: "shown", format: "text" } },
  },
  {
    name: "observation value path",
    value: { id: "w", type: "number", sourceConfig: { paths: ["patient.observations[observationCode=61838].value"] } },
    expected: { read: { observation: { code: "61838", system: MOIS }, mode: "initial", presentation: "shown" } },
  },
  {
    name: "catalog: a path that is a concept's own path becomes the concept",
    value: { id: "phn", type: "text", sourceConfig: { paths: ["patient.healthNumber"], format: "text", mode: "initial" } },
    catalog: true,
    expected: { read: { concept: "patient.phn", mode: "initial", presentation: "shown", format: "text" } },
  },
  {
    name: "catalog: fallback paths stay as the override",
    value: { id: "phn", type: "text", sourceConfig: { paths: ["patient.healthNumber", "patient.insuranceNumber"] } },
    catalog: true,
    expected: { read: { concept: "patient.phn", paths: ["patient.healthNumber", "patient.insuranceNumber"], mode: "initial", presentation: "shown" } },
  },
  {
    name: "catalog: a derived value's variant",
    value: { id: "age", type: "number", sourceConfig: { paths: ["patient.birthDate.ageMonths"] } },
    catalog: true,
    expected: { read: { concept: "patient.age", variant: "months", mode: "initial", presentation: "shown" } },
  },
  {
    name: "catalog: an observation path is the observation, LOINC first",
    value: { id: "w", type: "number", sourceConfig: { paths: ["patient.observations[observationCode=22732].value"] } },
    catalog: true,
    expected: { read: { concept: "vital.weight", observation: WEIGHT_OBSERVATION, mode: "initial", presentation: "shown" } },
  },

  // --- moisOutput -----------------------------------------------------------
  {
    name: "moisOutput observation",
    value: { id: "a", type: "text", moisOutput: { enabled: true, kind: "observation", observationCode: "1231", valueType: "text", description: "CRP" } },
    expected: { write: { observation: { code: "1231", system: MOIS, valueType: "TEXT" }, when: "submit" } },
  },
  {
    name: "moisOutput without kind or enabled (HFC)",
    value: { id: "a", type: "text", moisOutput: { observationCode: "9", description: "Lungs", valueType: "TEXT", valueTemplate: "See report", reportFieldId: "r" } },
    expected: { write: { observation: { code: "9", system: MOIS, valueType: "TEXT" }, when: "submit" } },
  },
  {
    name: "moisOutput dcoObservation alias with LOINC and units",
    value: { id: "a", type: "number", moisOutput: { enabled: true, kind: "dcoObservation", observationCode: "128", loincCode: "4548-4", units: "%", valueType: "NUMERIC" } },
    expected: { write: { observation: { code: "4548-4", system: LOINC, unit: "%", codings: [{ code: "128", system: MOIS }], valueType: "NUMERIC" }, when: "submit" } },
  },
  { name: "moisOutput switched off", value: { id: "a", type: "text", moisOutput: { enabled: false, kind: "observation", observationCode: "1" } }, expected: null },
  { name: "moisOutput document comment is not a chart binding", value: { id: "a", type: "text", moisOutput: { enabled: true, kind: "documentComment", commentTemplate: "x" } }, expected: null },
  {
    name: "catalog: moisOutput names its concept",
    value: { id: "w", type: "number", moisOutput: { enabled: true, kind: "observation", observationCode: "22732", valueType: "NUMERIC" } },
    catalog: true,
    expected: { write: { concept: "vital.weight", observation: { ...WEIGHT_OBSERVATION, valueType: "NUMERIC" }, when: "submit" } },
  },

  // --- measurementConfig ----------------------------------------------------
  {
    name: "past measurement with history and auto-fill",
    value: { id: "a", type: "text", measurementConfig: { enabled: true, observationCode: "951", autoFillFromHistory: true, showHistory: true, persistenceMode: "formOnly", valueType: "NUMERIC" } },
    expected: { read: { observation: { code: "951", system: MOIS }, mode: "initial", presentation: "shown", history: true } },
  },
  {
    name: "past measurement history only",
    value: { id: "a", type: "text", measurementConfig: { enabled: true, observationCode: "951", persistenceMode: "formOnly" } },
    expected: { read: { observation: { code: "951", system: MOIS }, mode: "none", presentation: "shown", history: true } },
  },
  {
    name: "past measurement bringForward false does not fill",
    value: { id: "a", type: "text", measurementConfig: { enabled: true, observationCode: "951", autoFillFromHistory: true, bringForward: false, showHistory: false } },
    expected: null,
  },
  {
    name: "past measurement that writes",
    value: { id: "a", type: "text", measurementConfig: { enabled: true, observationCode: "61838", persistenceMode: "observationAndForm", saveUnits: "mmHg", valueType: "TEXT", showHistory: false } },
    expected: { write: { observation: { code: "61838", system: MOIS, unit: "mmHg", valueType: "TEXT" }, when: "submit" } },
  },
  {
    name: "read-only past measurement never writes",
    value: { id: "a", type: "text", disabled: true, measurementConfig: { enabled: true, observationCode: "61838", persistenceMode: "observationAndForm", showHistory: false } },
    expected: null,
  },
  { name: "disabled past measurement", value: { id: "a", type: "text", measurementConfig: { enabled: false, observationCode: "1" } }, expected: null },
  {
    name: "the field's own output wins over the measurement write",
    value: { id: "a", type: "number", moisOutput: { enabled: true, kind: "observation", observationCode: "1948", valueType: "NUMERIC" }, measurementConfig: { enabled: true, observationCode: "1948", persistenceMode: "observationAndForm", showHistory: false } },
    expected: { write: { observation: { code: "1948", system: MOIS, valueType: "NUMERIC" }, when: "submit" } },
  },

  // --- moisConfig -----------------------------------------------------------
  {
    name: "chart mutation",
    value: { id: "a", type: "text", moisConfig: { localWrite: { targetId: "legacy" }, writeBinding: { targetId: "patient.preferredName", payloadField: "text", contextIdPath: "patient.patientId" } } },
    expected: { write: { mutation: { id: "patient.preferredName", payloadField: "text", contextIdPath: "patient.patientId" }, when: "submit" } },
  },
  { name: "a save key and module link are not chart bindings", value: { id: "a", type: "text", moisConfig: { localWrite: { targetId: "legacy" }, navigation: { moisModule: "MEASUREMENTS" } } }, expected: null },

  // --- table columns ----------------------------------------------------------
  {
    name: "column moisTargetId",
    value: { id: "c", label: "Name", type: "text", dataPath: "name", moisTargetId: "patient.name.first" },
    expected: { read: { paths: ["patient.name.first"], mode: "initial", presentation: "shown" } },
  },
  {
    name: "column binding",
    value: { id: "c", label: "Weight", type: "number", binding: { write: { observation: { code: "22732", system: MOIS }, when: "submit" } } },
    shape: "tableColumn",
    expected: { write: { observation: { code: "22732", system: MOIS }, when: "submit" } },
  },

  // --- layout cells ------------------------------------------------------------
  {
    name: "layout cell bound live with a fallback",
    value: { id: "c1", kind: "field", fieldId: "createdBy", inputType: "text", sourcePaths: ["webform.provider.name", "userProfile.identity.fullName"], sourceFormat: "text", sourceFallback: "Unknown" },
    expected: { read: { paths: ["webform.provider.name", "userProfile.identity.fullName"], mode: "sync", presentation: "shown", fallback: "Unknown", format: "text" } },
  },
  {
    name: "layout cell filled once, defaultValue as its fallback",
    value: { id: "c1", kind: "field", fieldId: "visit", inputType: "text", sourcePaths: ["webform.encounter.visitCode"], sourceMode: "initial", sourceFormat: "visitCode", defaultValue: "N/A" },
    expected: { read: { paths: ["webform.encounter.visitCode"], mode: "initial", presentation: "shown", fallback: "N/A", format: "visitCode" } },
  },
  {
    name: "layout cell filled once from the clock is a default answer",
    value: { id: "c1", kind: "field", fieldId: "formDate", inputType: "date", sourcePaths: ["system.currentDate"], sourceMode: "initial" },
    expected: null,
  },
  {
    name: "static text cell with a single source path",
    value: { id: "c1", kind: "text", sourcePath: "webform.encounter.date" },
    expected: { read: { paths: ["webform.encounter.date"], mode: "sync", presentation: "shown" } },
  },
  {
    name: "field-list child observation output",
    value: { id: "n", fieldId: "n", inputType: "number", moisOutput: { enabled: true, kind: "observation", observationCode: "7" } },
    expected: { write: { observation: { code: "7", system: MOIS }, when: "submit" } },
  },

  // --- product stores ----------------------------------------------------------
  {
    name: "catalog: library mapping alone binds its catalog parts",
    value: { id: "w", type: "number", crossPlatformMappingId: "vital.weight" },
    catalog: true,
    expected: {
      read: { concept: "vital.weight", mode: "initial", presentation: "shown" },
      write: { concept: "vital.weight", observation: { ...WEIGHT_OBSERVATION, valueType: "NUMERIC" }, when: "submit" },
    },
  },
  {
    name: "catalog: library mapping names the concept of its stores",
    value: { id: "phn", type: "text", crossPlatformMappingId: "patient.phn", sourceConfig: { paths: ["patient.healthNumber"], presentation: "backing" } },
    catalog: true,
    expected: { read: { concept: "patient.phn", mode: "initial", presentation: "backing" } },
  },
  {
    name: "catalog: AlayaCare demographics",
    value: { id: "phn", type: "text", alayaCareConfig: { fieldType: "demographics", demographicsFieldName: "uid", demographicsInputType: "text" } },
    catalog: true,
    expected: { read: { concept: "patient.phn", mode: "initial", presentation: "shown" } },
  },
  {
    name: "catalog: AlayaCare vital",
    value: { id: "w", type: "number", alayaCareConfig: { fieldType: "vital", vitalType: "weight" } },
    catalog: true,
    expected: { write: { concept: "vital.weight", observation: { ...WEIGHT_OBSERVATION, valueType: "NUMERIC" }, when: "submit" } },
  },
  {
    name: "catalog: Cerner DTA in the reviewed crosswalk",
    value: { id: "w", type: "number", cernerConfig: { version: 1, sourceKind: "powerform", formName: "", sectionName: "", inputType: 2, inputRefSeq: 1, preferences: {}, dta: { mnemonic: "Weight Measured", description: "Weight", resultType: "NUMERIC" } } },
    catalog: true,
    expected: { write: { concept: "vital.weight", observation: WEIGHT_OBSERVATION, when: "submit" } },
  },
  {
    name: "FHIR observation extraction",
    value: { id: "q", type: "number", fhirConfig: { code: [{ system: LOINC, code: "8302-2", display: "Height" }], observationExtract: true, unit: { system: "http://unitsofmeasure.org", code: "cm" } } },
    expected: { write: { observation: { code: "8302-2", system: LOINC, unit: "cm" }, when: "submit" } },
  },
  { name: "a FHIR item code alone is not a binding", value: { id: "q", type: "number", fhirConfig: { code: [{ system: LOINC, code: "8302-2" }] } }, expected: null },
];

describe("readFieldBinding", () => {
  it.each(READ_CASES.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    const reading = readFieldBindingDetails(testCase.value, { shape: testCase.shape, catalog: testCase.catalog ? CATALOG : null });
    expect(reading.binding).toEqual(testCase.expected);
    expect(reading.unknown).toEqual([]);
  });

  it("lists product-only settings and unknown store shapes", () => {
    const reading = readFieldBindingDetails({
      id: "a",
      type: "text",
      sourceConfig: { paths: ["patient.name.first"], mode: "always", colour: "red" },
      alayaCareConfig: { fieldType: "demographics", demographicsFieldName: "tenant_tag" },
      cernerConfig: { dta: { mnemonic: "Pain Score", description: "Pain" } },
      moisOutput: { enabled: true, kind: "documentComment" },
    });
    expect(reading.targetOnly).toEqual([
      "moisOutput.documentComment",
      "alayaCareConfig.demographics:tenant_tag",
      "cernerConfig.dta:Pain Score",
    ]);
    expect(reading.unknown).toEqual(["sourceConfig.colour", "sourceConfig.mode=always"]);
  });

  it("infers the store from the object", () => {
    expect(inferFieldBindingShape({ id: "a", type: "text" })).toBe("field");
    expect(inferFieldBindingShape({ id: "a", kind: "text", rawType: "text" })).toBe("field");
    expect(inferFieldBindingShape({ id: "c", type: "text", dataPath: "x" })).toBe("tableColumn");
    expect(inferFieldBindingShape({ id: "c", type: "checkbox" })).toBe("tableColumn");
    expect(inferFieldBindingShape({ id: "c", kind: "field", fieldId: "x" })).toBe("layoutCell");
    expect(inferFieldBindingShape({ fieldId: "x", inputType: "text" })).toBe("layoutCellField");
  });

  it("resolves the MOIS paths a read names", () => {
    expect(moisReadPathsOf({ concept: "patient.phn", mode: "initial", presentation: "shown" }, CATALOG)).toEqual(["patient.healthNumber"]);
    expect(moisReadPathsOf({ observation: WEIGHT_OBSERVATION, mode: "initial", presentation: "shown" })).toEqual(["patient.observations[observationCode=22732].value"]);
    expect(moisReadPathsOf({ concept: "unknown.concept", mode: "initial", presentation: "shown" }, CATALOG)).toEqual([]);
  });
});

describe("writeFieldBinding", () => {
  it("writing back what was read changes only `binding`", () => {
    for (const testCase of READ_CASES) {
      const catalog = testCase.catalog ? CATALOG : null;
      const shape = testCase.shape;
      const binding = readFieldBinding(testCase.value, { shape, catalog });
      const written = writeFieldBinding(testCase.value, binding, { shape, catalog }) as Record<string, unknown>;
      const { binding: stored, ...rest } = written;
      const { binding: _original, ...originalRest } = testCase.value as Record<string, unknown>;
      expect(rest, testCase.name).toEqual(originalRest);
      expect(stored ?? null, testCase.name).toEqual(binding);
      expect(readFieldBinding(written, { shape, catalog }), testCase.name).toEqual(binding);
    }
  });

  it("writes a new read as sourceConfig on a field, and clears it", () => {
    const field = { id: "a", type: "text" };
    const binding: BuilderFieldBinding = { read: { concept: "patient.phn", mode: "sync", presentation: "backing", fallback: "none" } };
    const written = writeFieldBinding(field, binding, { catalog: CATALOG });
    expect(written).toEqual({
      id: "a",
      type: "text",
      sourceConfig: { paths: ["patient.healthNumber"], mode: "sync", presentation: "backing", fallback: "none" },
      binding,
    });
    expect(readFieldBinding(written, { catalog: CATALOG })).toEqual(binding);
    const cleared = writeFieldBinding(written, null, { catalog: CATALOG });
    expect(cleared).toEqual({ id: "a", type: "text", sourceConfig: null });
    expect(readFieldBinding(cleared, { catalog: CATALOG })).toBeNull();
  });

  it("changes one setting of a read without rewriting the others", () => {
    const field = { id: "a", type: "choice", sourceConfig: { paths: ["webform.encounter.location"], format: "coding", mode: "initial", fallback: "X" } };
    const binding = readFieldBinding(field)!;
    const written = writeFieldBinding(field, { ...binding, read: { ...binding.read!, mode: "sync" } });
    expect(written.sourceConfig).toEqual({ paths: ["webform.encounter.location"], format: "coding", mode: "sync", fallback: "X" });
  });

  it("writes a new observation as moisOutput, and switches it off", () => {
    const field: Record<string, unknown> = { id: "w", type: "number" };
    const binding: BuilderFieldBinding = { write: { observation: { code: "29463-7", system: LOINC, unit: "kg", valueType: "NUMERIC" }, when: "submit" } };
    const written = writeFieldBinding(field, binding, { catalog: CATALOG });
    expect(written.moisOutput).toEqual({ kind: "observation", enabled: true, observationCode: "22732", loincCode: "29463-7", units: "kg", valueType: "NUMERIC" });
    expect(readFieldBinding(written, { catalog: CATALOG })).toEqual({
      write: { concept: "vital.weight", observation: { ...WEIGHT_OBSERVATION, valueType: "NUMERIC" }, when: "submit" },
    });
    const off = writeFieldBinding(written, null, { catalog: CATALOG });
    expect(off.moisOutput).toEqual({ ...(written.moisOutput as object), enabled: false });
    expect(readFieldBinding(off, { catalog: CATALOG })).toBeNull();
  });

  it("keeps a LOINC-only write in the binding when MOIS has no code for it", () => {
    const binding: BuilderFieldBinding = { write: { observation: { code: "8302-2", system: LOINC }, when: "submit" } };
    const written = writeFieldBinding({ id: "h", type: "number" }, binding);
    expect(written).toEqual({ id: "h", type: "number", binding });
    expect(readFieldBinding(written)).toEqual(binding);
  });

  it("writes a past measurement's persistence where it lives", () => {
    const field = { id: "bp", type: "text", measurementConfig: { enabled: true, observationCode: "61838", persistenceMode: "formOnly", showHistory: true } };
    const binding = readFieldBinding(field)!;
    const written = writeFieldBinding(field, { ...binding, write: { observation: { code: "61838", system: MOIS }, when: "submit" } }, { writeStore: "measurementConfig" });
    expect(written.measurementConfig).toEqual({ ...field.measurementConfig, persistenceMode: "observationAndForm" });
    expect(written).not.toHaveProperty("moisOutput");
    const reverted = writeFieldBinding(written, binding, { writeStore: "measurementConfig" });
    expect(reverted.measurementConfig).toEqual(field.measurementConfig);
  });

  it("stores a column binding with moisTargetId as the read mirror", () => {
    const column = { id: "c", label: "Name", type: "text", dataPath: "name" };
    const binding: BuilderFieldBinding = {
      read: { paths: ["patient.name.first", "patient.name.text"], mode: "sync", presentation: "shown" },
      write: { observation: { code: "7", system: MOIS }, when: "submit" },
    };
    const written = writeFieldBinding(column, binding);
    expect(written).toEqual({ ...column, moisTargetId: "patient.name.first", binding });
    expect(readFieldBinding(written)).toEqual(binding);
    // A newer edit of the legacy picker wins for the read, and only the read.
    const edited = { ...written, moisTargetId: "patient.healthNumber" };
    expect(readFieldBinding(edited)).toEqual({
      read: { paths: ["patient.healthNumber"], mode: "initial", presentation: "shown" },
      write: binding.write,
    });
    const cleared = writeFieldBinding(written, null);
    expect(cleared).toEqual(column);
  });

  it("mirrors a layout cell read into its source keys", () => {
    const cell = { id: "c1", kind: "field", fieldId: "who", inputType: "text", defaultValue: "Unknown" };
    const binding: BuilderFieldBinding = { read: { paths: ["webform.provider.name"], mode: "initial", presentation: "shown", fallback: "Unknown", format: "text" } };
    const written = writeFieldBinding(cell, binding);
    expect(written).toEqual({ ...cell, sourcePaths: ["webform.provider.name"], sourceMode: "initial", sourceFormat: "text", binding });
    expect(readFieldBinding(written)).toEqual(binding);
    expect(writeFieldBinding(written, null)).toEqual(cell);
  });

  it("takes a newer legacy edit over a stale stored binding, part by part", () => {
    const field = writeFieldBinding<Record<string, unknown>>({ id: "a", type: "number" }, {
      read: { paths: ["patient.name.first"], mode: "initial", presentation: "shown" },
      write: { observation: { code: "1", system: MOIS }, when: "submit" },
    });
    const edited = { ...field, moisOutput: { ...(field.moisOutput as object), observationCode: "2" } };
    expect(readFieldBinding(edited)).toEqual({
      read: { paths: ["patient.name.first"], mode: "initial", presentation: "shown" },
      write: { observation: { code: "2", system: MOIS }, when: "submit" },
    });
    const cleared = { ...field, sourceConfig: null };
    expect(readFieldBinding(cleared)).toEqual({ write: { observation: { code: "1", system: MOIS }, when: "submit" } });
  });

  it("keeps a concept the legacy stores cannot say", () => {
    const binding: BuilderFieldBinding = { read: { concept: "practice.site-name", paths: ["webform.encounter.location"], mode: "initial", presentation: "shown" } };
    const written = writeFieldBinding({ id: "s", type: "text" }, binding, { catalog: CATALOG });
    expect(readFieldBinding(written, { catalog: CATALOG })).toEqual(binding);
  });

  it("unlinks a library mapping when the concept changes", () => {
    const field = { id: "phn", type: "text", crossPlatformMappingId: "patient.phn", sourceConfig: { paths: ["patient.healthNumber"] } };
    const written = writeFieldBinding(field, { read: { paths: ["patient.name.first"], mode: "initial", presentation: "shown" } }, { catalog: CATALOG });
    expect(written.crossPlatformMappingId).toBeNull();
    expect(written.sourceConfig).toEqual({ paths: ["patient.name.first"] });
  });

  it("returns a patch of changed keys", () => {
    const field = { id: "a", type: "text", label: "A", sourceConfig: { paths: ["patient.name.first"] } };
    expect(fieldBindingPatch(field, null)).toEqual({ sourceConfig: null });
    const binding: BuilderFieldBinding = { read: { paths: ["patient.name.first"], mode: "sync", presentation: "shown" } };
    expect(fieldBindingPatch(field, binding)).toEqual({ sourceConfig: { paths: ["patient.name.first"], mode: "sync" }, binding });
    const stored = writeFieldBinding(field, binding);
    expect(fieldBindingPatch(stored, null)).toEqual({ sourceConfig: null, binding: null });
  });

  it("does not modify the object it writes to", () => {
    const field = { id: "a", type: "text", sourceConfig: { paths: ["patient.name.first"], mode: "initial" as const } };
    const snapshot = JSON.parse(JSON.stringify(field));
    writeFieldBinding(field, { read: { paths: ["patient.name.family"], mode: "sync", presentation: "backing" } });
    expect(field).toEqual(snapshot);
  });
});
