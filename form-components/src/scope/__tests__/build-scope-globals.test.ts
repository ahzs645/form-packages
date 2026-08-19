import { describe, expect, it } from "vitest";
import { buildScope } from "../build-scope";
import { MoisFunction } from "../mois-namespaces";

describe("buildScope form globals", () => {
  it("exposes bare refresh(sd) as real MOIS does", () => {
    // The vendor's CRUD test forms (Bright Health test_connections /
    // test_chart_preference) call bare refresh(sd) after a mutation; real
    // MOIS provides it as a form global alongside saveDraft/saveSubmit.
    const scope = buildScope();
    expect(typeof scope.refresh).toBe("function");
    expect(scope.refresh).toBe(MoisFunction.refresh);
  });
});
