import { describe, expect, it } from "vitest";

import { hydrateFhirResource } from "./fhir";

const context = {
  patientId: "12724066",
  encounterId: "97953477",
  practitionerId: "4122622",
  now: () => "2026-08-31T12:00:00.000Z",
};

describe("hydrateFhirResource", () => {
  it("fills subject and encounter on a QuestionnaireResponse", () => {
    const out = hydrateFhirResource({ resourceType: "QuestionnaireResponse" }, context);
    expect(out.subject).toEqual({ reference: "Patient/12724066" });
    expect(out.encounter).toEqual({ reference: "Encounter/97953477" });
    expect(out.context).toBeUndefined();
  });

  it("fills subject, context, and author on a DocumentReference", () => {
    const out = hydrateFhirResource({ resourceType: "DocumentReference" }, context);
    expect(out.subject).toEqual({ reference: "Patient/12724066" });
    expect(out.author).toEqual([{ reference: "Practitioner/4122622" }]);
    expect(out.context).toEqual({
      encounter: [{ reference: "Encounter/97953477" }],
      period: { start: "2026-08-31T12:00:00.000Z", end: "2026-08-31T12:00:00.000Z" },
    });
    expect(out.encounter).toBeUndefined();
  });

  it("fills subject and encounter on an Observation", () => {
    const out = hydrateFhirResource({ resourceType: "Observation" }, context);
    expect(out.subject).toEqual({ reference: "Patient/12724066" });
    expect(out.encounter).toEqual({ reference: "Encounter/97953477" });
    expect(out.author).toBeUndefined();
  });

  it("never overwrites caller-provided fields", () => {
    const out = hydrateFhirResource(
      {
        resourceType: "DocumentReference",
        subject: { reference: "Patient/other" },
        author: [{ reference: "Device/robot" }],
      },
      context,
    );
    expect(out.subject).toEqual({ reference: "Patient/other" });
    expect(out.author).toEqual([{ reference: "Device/robot" }]);
  });

  it("leaves gaps absent when context is missing rather than guessing", () => {
    const out = hydrateFhirResource({ resourceType: "QuestionnaireResponse" }, {});
    expect(out.subject).toBeUndefined();
    expect(out.encounter).toBeUndefined();
  });

  it("does not touch resource types outside the tables", () => {
    const resource = { resourceType: "Patient", name: [{ family: "Mouse" }] };
    expect(hydrateFhirResource(resource, context)).toEqual(resource);
  });

  it("does not mutate the input resource", () => {
    const resource = { resourceType: "Observation" as const };
    hydrateFhirResource(resource, context);
    expect(resource).toEqual({ resourceType: "Observation" });
  });
});
