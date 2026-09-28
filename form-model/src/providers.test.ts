import { describe, expect, it } from "vitest";
import { FIELD_TYPE_PROFILES, NEUTRAL_ANSWER_TYPE_TO_FIELD_TYPE, neutralAnswerTypeOf } from "./field-types";
import {
  PROVIDER_DIRECTORY_SYSTEMS,
  providerAnswerFor,
  providerAnswerText,
  readProviderAnswer,
  searchProviderDirectory,
} from "./providers";

describe("provider answer type", () => {
  it("is its own neutral answer type, stored by the provider builder type", () => {
    expect(FIELD_TYPE_PROFILES.provider).toEqual({ role: "answer", answer: "provider" });
    expect(neutralAnswerTypeOf({ type: "provider" })).toBe("provider");
    expect(NEUTRAL_ANSWER_TYPE_TO_FIELD_TYPE.provider).toBe("provider");
  });
});

describe("readProviderAnswer", () => {
  it.each([
    ["the neutral Coding", { code: "500045", display: "SMITH, JOHN", system: "MOIS-PROVIDERS" }, { code: "500045", display: "SMITH, JOHN", system: "MOIS-PROVIDERS" }],
    ["a MOIS provider record", { providerId: 500045, name: "SMITH, JOHN", providerType: "PROVIDER" }, { code: "500045", display: "SMITH, JOHN" }],
    ["a FHIR valueReference", { valueReference: { reference: "Practitioner/77", display: "Dr Ng" } }, { code: "77", display: "Dr Ng", system: "Practitioner" }],
    ["a bare reference", { reference: "https://fhir.example/Practitioner/abc" }, { code: "abc", display: "abc", system: "Practitioner" }],
    ["a name typed as text", "SMITH, JOHN", { code: "", display: "SMITH, JOHN" }],
    ["the first of a list", [{ code: "1", display: "A" }], { code: "1", display: "A" }],
  ])("reads %s", (_name, value, expected) => {
    expect(readProviderAnswer(value)).toEqual(expected);
  });

  it.each([undefined, null, "", "   ", [], {}, { code: null, display: null, system: "" }])("reads %j as unanswered", (value) => {
    expect(readProviderAnswer(value)).toBeNull();
    expect(providerAnswerText(value)).toBe("");
  });

  it("gives text-only targets the provider's name", () => {
    expect(providerAnswerText({ code: "500045", display: "SMITH, JOHN" })).toBe("SMITH, JOHN");
    expect(providerAnswerText({ providerId: 1, name: "DR. PREVIEW USER" })).toBe("DR. PREVIEW USER");
  });
});

describe("provider directory search", () => {
  const directory = [
    { id: "1", name: "SMITH, JOHN" },
    { id: "2", name: "JONES, MARY" },
    { id: "3", name: "SMITHERS, ANNA" },
  ];

  it("matches the start of any word of the name, every word of the query", () => {
    expect(searchProviderDirectory(directory, "smi").map((entry) => entry.id)).toEqual(["1", "3"]);
    expect(searchProviderDirectory(directory, "john").map((entry) => entry.id)).toEqual(["1"]);
    expect(searchProviderDirectory(directory, "smi a").map((entry) => entry.id)).toEqual(["3"]);
    expect(searchProviderDirectory(directory, "").length).toBe(3);
    expect(searchProviderDirectory(directory, "", 2).length).toBe(2);
  });

  it("stores a directory entry as a Coding in its directory's system", () => {
    expect(providerAnswerFor(directory[0])).toEqual({ code: "1", display: "SMITH, JOHN", system: PROVIDER_DIRECTORY_SYSTEMS.preview });
    expect(providerAnswerFor(directory[0], "MOIS-PROVIDERS").system).toBe("MOIS-PROVIDERS");
  });
});
