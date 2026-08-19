import { describe, expect, it } from "vitest";
import { extractMutationFieldName } from "../api";

describe("mock useMutation field echo", () => {
  it("extracts the GraphQL field a mutation document selects", () => {
    // Operation name and field name differ across the engine's mutations, so
    // the field (what the vendor forms' result checks read) is what matters.
    expect(
      extractMutationFieldName(
        `mutation updateConnection($patientId: Int!, $connection: ConnectionInput!) {
          changeConnection(patientId: $patientId, connection: $connection) {
            patientId
          }
        }`
      )
    ).toBe("changeConnection");
    expect(
      extractMutationFieldName(
        `mutation createPreference($patientId: Int!, $chartPreference: ChartPreferenceInput!) {
          changeChartPreference(patientId: $patientId, chartPreference: $chartPreference) { patientId }
        }`
      )
    ).toBe("changeChartPreference");
    expect(extractMutationFieldName("not a graphql document")).toBeNull();
  });
});
