// @vitest-environment happy-dom
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import {
  applyPreviewChartMutation,
  overlayPreviewChartMutations,
  resetPreviewChartMutations,
} from "../preview-chart-store";
import { useSourceData } from "../../context/MoisContext";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CHANGE_CONNECTION = `mutation updateConnection($patientId: Int!, $connection: ConnectionInput!) {
  changeConnection(patientId: $patientId, connection: $connection) { patientId }
}`;

const CHANGE_PREFERENCE = `mutation createPreference($patientId: Int!, $chartPreference: ChartPreferenceInput!) {
  changeChartPreference(patientId: $patientId, chartPreference: $chartPreference) { patientId }
}`;

const CHANGE_PATIENT = `mutation changePatient($patientId: Int!, $patientUpdate: PatientInput!) {
  changePatient(patientId: $patientId, newPatient: $patientUpdate) { patientId }
}`;

const ADD_OBSERVATION = `mutation addObservationHistory($observation: ObservationInput!) {
  addObservation(observation: $observation) { observationId }
}`;

const basePatient = () => ({
  patientId: 1001,
  name: { text: "MOUSE, MICKEY", first: "MICKEY", family: "MOUSE" },
  religion: "None recorded",
  connections: [
    { connectionId: 7, name: "EXISTING, ONE", connectionType: { code: "GP" } },
  ],
  preferences: [{ chartPreferenceId: 31, preference: "MOST" }],
  observations: [{ observationId: 501, value: "4.5" }],
});

beforeEach(() => {
  resetPreviewChartMutations();
});

describe("preview chart store", () => {
  it("returns engine-shaped list results keyed by the GraphQL field", () => {
    const result = applyPreviewChartMutation(CHANGE_CONNECTION, {
      patientId: 1001,
      connection: { connectionId: 0, comment: "new" },
    });
    // The engine reads result.field[0]; the vendor idiom checks result?.field.
    expect(result.changeConnection).toEqual([{ patientId: 1001 }]);
  });

  it("creates with an assigned id, updates by id, deletes by negative id", () => {
    applyPreviewChartMutation(CHANGE_CONNECTION, {
      patientId: 1001,
      connection: { connectionId: 0, name: "NEW, PROVIDER" },
    });
    let patient = overlayPreviewChartMutations(basePatient());
    expect(patient.connections).toHaveLength(2);
    const created = patient.connections.find((row: any) => row.name === "NEW, PROVIDER") as any;
    expect(created.connectionId).toBeGreaterThan(900000);

    applyPreviewChartMutation(CHANGE_CONNECTION, {
      patientId: 1001,
      connection: { connectionId: 7, comment: "updated" },
    });
    patient = overlayPreviewChartMutations(basePatient());
    const updated = patient.connections.find((row: any) => row.connectionId === 7) as any;
    expect(updated.comment).toBe("updated");
    expect(updated.name).toBe("EXISTING, ONE");

    // The vendor delete idiom: connectionId * -1, rest of the payload empty.
    applyPreviewChartMutation(CHANGE_CONNECTION, {
      patientId: 1001,
      connection: { connectionId: -7 },
    });
    patient = overlayPreviewChartMutations(basePatient());
    expect(patient.connections.some((row: any) => row.connectionId === 7)).toBe(false);
    expect(patient.connections).toHaveLength(1);
  });

  it("applies the same convention to chart preferences", () => {
    applyPreviewChartMutation(CHANGE_PREFERENCE, {
      patientId: 1001,
      chartPreference: { chartPreferenceId: -31 },
    });
    const patient = overlayPreviewChartMutations(basePatient());
    expect(patient.preferences).toHaveLength(0);
  });

  it("merges changePatient fields and recomputes name.text like serve-local", () => {
    applyPreviewChartMutation(CHANGE_PATIENT, {
      patientId: 1001,
      patientUpdate: { religion: "Jedi", name: { first: "MINNIE" } },
    });
    const patient = overlayPreviewChartMutations(basePatient());
    expect(patient.religion).toBe("Jedi");
    expect((patient.name as any).first).toBe("MINNIE");
    expect((patient.name as any).text).toBe("MOUSE, MINNIE");
  });

  it("addObservation returns the record itself and upserts by observationId", () => {
    const result = applyPreviewChartMutation(ADD_OBSERVATION, {
      observation: { observationId: 0, observationCode: "118", value: "5.1" },
    }) as any;
    expect(result.addObservation.value).toBe("5.1");
    expect(result.addObservation.status).toBe("F");
    const patient = overlayPreviewChartMutations(basePatient());
    expect(patient.observations).toHaveLength(2);
    // New observations lead, matching serve-local's descending sort intent.
    expect((patient.observations[0] as any).observationCode).toBe("118");
  });

  it("reset restores the baseline chart", () => {
    applyPreviewChartMutation(CHANGE_CONNECTION, {
      patientId: 1001,
      connection: { connectionId: -7 },
    });
    resetPreviewChartMutations();
    const base = basePatient();
    expect(overlayPreviewChartMutations(base)).toBe(base);
  });
});

describe("useSourceData round-trip", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
  });

  it("re-renders consumers with the mutated chart", async () => {
    const ConnectionCount = () => {
      const sd = useSourceData();
      const rows = Array.isArray((sd as any).patient?.connections)
        ? (sd as any).patient.connections
        : [];
      return <div data-testid="count">{`connections:${rows.length}`}</div>;
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<ConnectionCount />);
    });
    const before = Number(container.textContent?.split(":")[1]);

    await act(async () => {
      applyPreviewChartMutation(CHANGE_CONNECTION, {
        patientId: 1001,
        connection: { connectionId: 0, name: "ROUND, TRIP" },
      });
    });

    expect(container.textContent).toBe(`connections:${before + 1}`);
  });
});
