import { describe, expect, it } from "vitest";
import type { BuilderField } from "./index";
import {
  FHIR_SIGNATURE_REQUIRED_URL,
  appendLifecycleEntry,
  fromFhirQuestionnaireStatus,
  isPublishedForm,
  lifecycleRequiresSignature,
  normalizeBuilderFormLifecycle,
  readFhirSignatureRequirement,
  readFormLifecycle,
  readFormLifecycleDetails,
  resolveBuilderFormStatus,
  toFhirQuestionnaireStatus,
} from "./lifecycle";

describe("form lifecycle", () => {
  it("treats an unmarked form as a draft, never as published", () => {
    // Every document written before lifecycle existed has none. Defaulting the
    // other way would silently mark the whole existing library as approved.
    expect(resolveBuilderFormStatus(undefined)).toBe("draft");
    expect(resolveBuilderFormStatus(null)).toBe("draft");
    expect(isPublishedForm(undefined)).toBe(false);
    expect(isPublishedForm({ status: "retired" })).toBe(false);
    expect(isPublishedForm({ status: "published" })).toBe(true);
  });

  it("falls back to draft for a status it does not recognise", () => {
    expect(resolveBuilderFormStatus({ status: "live" } as never)).toBe("draft");
    expect(normalizeBuilderFormLifecycle({ status: "live" })?.status).toBe("draft");
  });

  it("maps to and from FHIR's publication status", () => {
    expect(toFhirQuestionnaireStatus({ status: "draft" })).toBe("draft");
    expect(toFhirQuestionnaireStatus({ status: "published" })).toBe("active");
    expect(toFhirQuestionnaireStatus({ status: "retired" })).toBe("retired");
    expect(toFhirQuestionnaireStatus(undefined)).toBe("draft");

    expect(fromFhirQuestionnaireStatus("active")).toBe("published");
    expect(fromFhirQuestionnaireStatus("retired")).toBe("retired");
    expect(fromFhirQuestionnaireStatus("draft")).toBe("draft");
    // "unknown" asserts nothing about the form being live, so it is not published.
    expect(fromFhirQuestionnaireStatus("unknown")).toBe("draft");
    expect(fromFhirQuestionnaireStatus(undefined)).toBe("draft");
  });

  it("keeps only well-formed dates", () => {
    const lifecycle = normalizeBuilderFormLifecycle({
      status: "published",
      approvalDate: "2026-03-01",
      lastReviewDate: "not a date",
      effectiveStart: "2026-04-01T00:00:00Z",
      effectiveEnd: "  2026-12-31  ",
    });
    expect(lifecycle).toEqual({
      status: "published",
      approvalDate: "2026-03-01",
      // A datetime is not a FHIR `date`; passing it through would emit invalid FHIR.
      effectiveEnd: "2026-12-31",
    });
  });

  it("drops change-log entries that carry no usable status or timestamp", () => {
    const lifecycle = normalizeBuilderFormLifecycle({
      status: "draft",
      changeLog: [
        { at: "2026-01-01T00:00:00Z", status: "draft", note: "created" },
        { at: "2026-02-01T00:00:00Z", status: "nonsense" },
        { status: "published" },
        "junk",
      ],
    });
    expect(lifecycle?.changeLog).toEqual([
      { at: "2026-01-01T00:00:00Z", status: "draft", note: "created" },
    ]);
  });

  it("appends history rather than replacing it", () => {
    const first = appendLifecycleEntry(undefined, {
      status: "draft",
      at: "2026-01-01T00:00:00Z",
      note: "first pass",
    });
    const second = appendLifecycleEntry(first, {
      status: "published",
      at: "2026-02-01T00:00:00Z",
      version: "1.2.0",
      by: "A. Author",
    });

    expect(second.status).toBe("published");
    expect(second.changeLog).toEqual([
      { at: "2026-01-01T00:00:00Z", status: "draft", note: "first pass" },
      { at: "2026-02-01T00:00:00Z", status: "published", version: "1.2.0", by: "A. Author" },
    ]);
    // The earlier value is untouched, so history cannot be rewritten in place.
    expect(first.changeLog).toHaveLength(1);
  });

  it("carries the dates through when a transition is recorded", () => {
    const published = appendLifecycleEntry(
      { status: "draft", approvalDate: "2026-03-01" },
      { status: "published", at: "2026-03-02T00:00:00Z" },
    );
    expect(published.approvalDate).toBe("2026-03-01");
  });
});

// ---------------------------------------------------------------------------
// readFormLifecycle: locks, signing, authorship and approval
// ---------------------------------------------------------------------------

function field(partial: Partial<BuilderField> & Pick<BuilderField, "id" | "type">): BuilderField {
  return { label: partial.id, ...partial } as BuilderField;
}

function section(id: string, childFieldIds: string[], extra: Partial<NonNullable<BuilderField["sectionConfig"]>> = {}): BuilderField {
  return field({ id, type: "section", sectionConfig: { title: id, childFieldIds, ...extra } });
}

const SIGNATURE_TYPE = { system: "urn:iso-astm:E1762-95:2013", code: "1.2.840.10065.1.12.1.1", display: "Author's Signature" };

describe("readFormLifecycle: shapes it never throws on", () => {
  it("reads nothing into the defaults", () => {
    const empty = {
      status: "draft",
      signing: { mode: null, requireRequiredAnswers: false, signatureTypes: [] },
      fields: [],
      authorship: [],
      approval: null,
      targetOptions: [],
    };
    for (const document of [undefined, null, {}, { fields: "x" }, { fields: [null, 5, "a", { id: 3 }] }, [] as never]) {
      expect(readFormLifecycle(document as never)).toEqual(empty);
    }
  });

  it("lists odd stored values as unknown and keeps reading", () => {
    const details = readFormLifecycleDetails(
      {
        fields: [
          section("s", ["a"], { authorshipPolicy: "yes" as never }),
          field({ id: "a", type: "text", lockWhenSigned: "no" as never, lockWhenSectionComplete: 0 as never }),
        ],
      },
      { preview: { footerButtons: "sign", lockPolicy: "field" }, alayaCareFormSettings: { approveAutomatically: "yes", requiresClockIn: 1 } },
    );
    expect(details.unknown).toEqual([
      { store: "sectionConfig.authorshipPolicy", fieldId: "s", key: "authorshipPolicy", value: "yes" },
      { store: "field.lockWhenSigned", fieldId: "a", key: "lockWhenSigned", value: "no" },
      { store: "field.lockWhenSectionComplete", fieldId: "a", key: "lockWhenSectionComplete", value: 0 },
      { store: "preview.footerButtons", key: "footerButtons", value: "sign" },
      { store: "preview.lockPolicy", key: "lockPolicy", value: "field" },
      { store: "alayaCareFormSettings", key: "approveAutomatically", value: "yes" },
      { store: "alayaCareFormSettings", key: "requiresClockIn", value: 1 },
    ]);
    // Anything but `false` locks, as the MOIS export reads it.
    expect(details.lifecycle.fields).toEqual([
      { fieldId: "a", whenSigned: true, whenSectionComplete: true, condition: null, ownedBy: null },
    ]);
    expect(details.lifecycle.signing.mode).toBeNull();
    expect(details.lifecycle.approval).toBeNull();
  });
});

describe("readFormLifecycle: field locks", () => {
  it("locks every answer field after signing and section completion unless it opts out", () => {
    const lifecycle = readFormLifecycle({
      fields: [
        section("s", ["a", "b", "c", "h", "link", "note", "editable", "table", "widget"]),
        field({ id: "a", type: "text" }),
        field({ id: "b", type: "number", lockWhenSigned: false }),
        field({ id: "c", type: "date", lockWhenSectionComplete: false, lockWhenSigned: true }),
        field({ id: "h", type: "heading" }),
        field({ id: "link", type: "hyperlink" }),
        field({ id: "note", type: "richText" }),
        field({ id: "editable", type: "richText", richTextConfig: { readOnly: false } as never }),
        field({ id: "table", type: "table" }),
        field({ id: "widget", type: "component", componentKey: "EditableTable" }),
      ],
    });
    expect(lifecycle.fields.map((entry) => [entry.fieldId, entry.whenSigned, entry.whenSectionComplete])).toEqual([
      ["a", true, true],
      ["b", false, true],
      ["c", true, false],
      ["editable", true, true],
      ["table", true, true],
      ["widget", true, true],
    ]);
  });

  it("reads the lock condition, converting a legacy lockWhen with its controller's kind", () => {
    const group = { match: "all" as const, conditions: [{ controllerFieldId: "done", condition: { type: "filled" as const } }] };
    const details = readFormLifecycleDetails({
      fields: [
        field({ id: "done", type: "booleanYesNo" }),
        field({ id: "stored", type: "text", lockCondition: group }),
        field({ id: "legacy", type: "text", lockWhen: { field: "done", operator: "truthy" } }),
        field({ id: "empty", type: "text", lockCondition: { match: "all", conditions: [] } }),
      ],
    });
    const byId = Object.fromEntries(details.lifecycle.fields.map((entry) => [entry.fieldId, entry.condition]));
    expect(byId.stored).toEqual(group);
    expect(byId.legacy).toEqual({ match: "all", conditions: [{ controllerFieldId: "done", condition: { type: "boolean-yes" } }] });
    expect(byId.empty).toBeNull();
    expect(details.sources).toEqual(["field.lockCondition", "field.lockWhen"]);
  });
});

describe("readFormLifecycle: authorship", () => {
  it("reads an enabled section policy, normalised as the MOIS runtime does, and marks the answers it owns", () => {
    const lifecycle = readFormLifecycle({
      fields: [
        section("notes", ["n1", "n2", "missing"], {
          authorshipPolicy: { enabled: true, granularity: "field", lockOn: "later" as never, editableWindowHours: -4 },
        }),
        field({ id: "n1", type: "text" }),
        field({ id: "n2", type: "textarea" }),
        section("rows", ["grid"], { authorshipPolicy: { enabled: true, granularity: "row", lockOn: "sign", editableWindowHours: 24, showStatusColumn: true } }),
        field({ id: "grid", type: "table" }),
        section("off", ["x"], { authorshipPolicy: { enabled: false, granularity: "field" } }),
        field({ id: "x", type: "text" }),
      ],
    });
    expect(lifecycle.authorship).toEqual([
      { scope: "section", id: "notes", fieldIds: ["n1", "n2"], granularity: "field", lockOn: "save", editableWindowHours: 72, showStatusColumn: false },
      { scope: "section", id: "rows", fieldIds: ["grid"], granularity: "row", lockOn: "sign", editableWindowHours: 24, showStatusColumn: true },
    ]);
    // Row ownership is the table's own; only field ownership wraps the answers.
    expect(lifecycle.fields.map((entry) => [entry.fieldId, entry.ownedBy])).toEqual([
      ["n1", "notes"],
      ["n2", "notes"],
      ["grid", null],
      ["x", null],
    ]);
  });

  it("takes the layout draft's policy first, as the MOIS export does", () => {
    const details = readFormLifecycleDetails({
      fields: [
        section("s", ["a"], { authorshipPolicy: { enabled: false } }),
        field({ id: "a", type: "text" }),
      ],
      drafts: [{ key: "builder-section-s", authorshipPolicy: { enabled: true, lockOn: "submit" } }],
    });
    expect(details.lifecycle.authorship).toEqual([
      { scope: "section", id: "s", fieldIds: ["a"], granularity: "field", lockOn: "submit", editableWindowHours: 72, showStatusColumn: false },
    ]);
    expect(details.sources).toEqual(["layoutDraft.authorshipPolicy"]);
  });

  it("groups a section's fields as the MOIS export does: following fields without childFieldIds, first claim wins", () => {
    const policy = { enabled: true };
    const lifecycle = readFormLifecycle({
      fields: [
        section("first", ["shared"], { authorshipPolicy: policy }),
        section("second", ["shared", "own"], { authorshipPolicy: policy }),
        field({ id: "shared", type: "text" }),
        field({ id: "own", type: "text" }),
        section("inferred", [], { authorshipPolicy: policy }),
        field({ id: "after1", type: "text" }),
        field({ id: "after2", type: "number" }),
        section("next", []),
        field({ id: "later", type: "text" }),
      ],
    });
    expect(lifecycle.authorship.map((entry) => [entry.id, entry.fieldIds])).toEqual([
      ["first", ["shared"]],
      ["second", ["own"]],
      ["inferred", ["after1", "after2"]],
    ]);
  });

  it("reads a component's own row policy", () => {
    const lifecycle = readFormLifecycle({
      fields: [
        field({ id: "panel", type: "component", componentKey: "PanelEntryGrid", componentProps: { authorshipPolicy: { enabled: true, granularity: "row" } } }),
        field({ id: "quiet", type: "component", componentKey: "ObservationPanelEditor", componentProps: { authorshipPolicy: { enabled: false, granularity: "row" } } }),
      ],
    });
    expect(lifecycle.authorship).toEqual([
      { scope: "component", id: "panel", fieldIds: ["panel"], granularity: "row", lockOn: "save", editableWindowHours: 72, showStatusColumn: false },
    ]);
  });
});

describe("readFormLifecycle: signing", () => {
  const fields = [field({ id: "a", type: "text", required: true })];

  it("says nothing about signing when no store does", () => {
    const lifecycle = readFormLifecycle({ fields });
    expect(lifecycle.signing).toEqual({ mode: null, requireRequiredAnswers: false, signatureTypes: [] });
    expect(lifecycleRequiresSignature(lifecycle)).toBe(false);
  });

  it("reads the MOIS footer: Sign & Save by default, a separate Sign button, or no signature", () => {
    const mode = (footerButtons: unknown) => readFormLifecycle({ fields }, { preview: { footerButtons } }).signing.mode;
    expect(mode({})).toBe("with-submit");
    expect(mode({ showSubmit: true, submitAutoSign: true, showSign: true })).toBe("with-submit");
    expect(mode({ submitAutoSign: false, showSign: true })).toBe("after-submit");
    expect(mode({ submitAutoSign: false, signedSignButton: true })).toBe("after-submit");
    expect(mode({ submitAutoSign: false })).toBe("none");
    expect(mode({ showSubmit: false, showSave: true })).toBe("none");
    expect(mode({ showSubmit: false, showSign: true })).toBe("after-submit");
  });

  it("reads an imported Questionnaire's signature requirement from the preserved root, and an item's as a FHIR option", () => {
    const signature = { url: FHIR_SIGNATURE_REQUIRED_URL, valueCodeableConcept: { coding: [SIGNATURE_TYPE] } };
    const details = readFormLifecycleDetails({
      fields: [
        field({ id: "a", type: "text", fhirConfig: { questionnaireRoot: { extension: [{ url: "other" }, signature] } } }),
        field({ id: "b", type: "text", fhirConfig: { preservedExtensions: [signature] } }),
      ],
    });
    expect(details.lifecycle.signing).toEqual({ mode: "with-submit", requireRequiredAnswers: false, signatureTypes: [SIGNATURE_TYPE] });
    expect(details.lifecycle.targetOptions).toEqual([{ target: "fhir", setting: "signatureRequired", value: [SIGNATURE_TYPE], fieldId: "b" }]);
    expect(details.sources).toEqual(["fhirConfig.questionnaireRoot", "fhirConfig.preservedExtensions"]);
    expect(readFhirSignatureRequirement([{ url: FHIR_SIGNATURE_REQUIRED_URL }])).toEqual([]);
    expect(readFhirSignatureRequirement([{ url: "other" }])).toBeNull();
    expect(readFhirSignatureRequirement("nope")).toBeNull();
  });

  it("lets the MOIS footer the caller passes decide the mode over the Questionnaire's provenance", () => {
    const withRoot = [field({ id: "a", type: "text", fhirConfig: { questionnaireRoot: { extension: [{ url: FHIR_SIGNATURE_REQUIRED_URL }] } } })];
    expect(readFormLifecycle({ fields: withRoot }, { preview: { footerButtons: { submitAutoSign: false } } }).signing.mode).toBe("none");
    expect(readFormLifecycle({ fields: withRoot }, { preview: { footerButtons: { submitAutoSign: false, showSign: true } } }).signing.mode).toBe("after-submit");
  });

  it("reads the PowerForm's required hard stop, with the author's PowerForm setting first", () => {
    const root = (formRoot: Record<string, unknown>) =>
      readFormLifecycle({ fields: [field({ id: "a", type: "text", cernerConfig: { formRoot } as never })] }).signing.requireRequiredAnswers;
    expect(root({ formFlags: "1" })).toBe(true);
    expect(root({ formFlags: "3" })).toBe(true);
    expect(root({ formFlags: "2" })).toBe(false);
    expect(root({ formFlags: "0", enforceRequired: true })).toBe(true);
    expect(root({ formFlags: "0", exportSettings: { powerform: { enforceRequired: true } } })).toBe(true);
    expect(root({ formFlags: "1", exportSettings: { powerform: { enforceRequired: false } } })).toBe(false);
    expect(root({ formFlags: "0", exportSettings: { powerform: { formFlags: "1" } } })).toBe(true);
    expect(root({ formFlags: "junk" })).toBe(false);
  });

  it("keeps the done-charting indicator and the MOIS form lock as product options", () => {
    const lifecycle = readFormLifecycle(
      { fields: [field({ id: "a", type: "text", cernerConfig: { formRoot: { doneChartingAllowed: true } } as never })] },
      { preview: { lockPolicy: "document" } },
    );
    expect(lifecycle.targetOptions).toEqual([
      { target: "mois", setting: "lockPolicy", value: "document" },
      { target: "cerner", setting: "doneChartingAllowed", value: true },
    ]);
  });
});

describe("readFormLifecycle: approval and status", () => {
  it("reads AlayaCare's approval setting and keeps clock-in and visit link as AlayaCare options", () => {
    expect(readFormLifecycle({}, { alayaCareFormSettings: { approveAutomatically: true } }).approval).toEqual({ mode: "automatic" });
    const reviewed = readFormLifecycle({}, { alayaCareFormSettings: { approveAutomatically: false, requiresClockIn: true, visitLinkRequired: true } });
    expect(reviewed.approval).toEqual({ mode: "reviewer" });
    expect(reviewed.targetOptions).toEqual([
      { target: "alayacare", setting: "requiresClockIn", value: true },
      { target: "alayacare", setting: "visitLinkRequired", value: true },
    ]);
    expect(readFormLifecycle({}, { alayaCareFormSettings: { requiresClockIn: false } }).targetOptions).toEqual([]);
    expect(readFormLifecycleDetails({}, { alayaCareFormSettings: "on" }).unknown).toEqual([
      { store: "alayaCareFormSettings", key: "alayaCareFormSettings", value: "on" },
    ]);
  });

  it("carries the publication status, draft when absent", () => {
    expect(readFormLifecycle({ lifecycle: { status: "published" } }).status).toBe("published");
    expect(readFormLifecycle({ lifecycle: "live" }).status).toBe("draft");
  });
});
