import { describe, expect, it } from "vitest";
import {
  appendLifecycleEntry,
  fromFhirQuestionnaireStatus,
  isPublishedForm,
  normalizeBuilderFormLifecycle,
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
