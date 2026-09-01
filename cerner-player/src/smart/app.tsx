import { hydrateFhirResource, FHIR_JSON_ACCEPT } from "@webforms/cerner-core";
import FHIR from "fhirclient";
import type Client from "fhirclient/lib/Client";
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

/**
 * SMART app page: the FHIR read/write half of the Cerner target.
 *
 * Two entry modes:
 *  - OAuth redirect landing after smart-launch.html (FHIR.oauth2.ready) —
 *    the path Cerner Ignite will use.
 *  - ?open=1 — no-auth client against the public SMART R4 sandbox, so the
 *    whole read→hydrate→write pipeline is testable today.
 */

const OPEN_SERVER = "https://r4.smarthealthit.org";

interface HumanName {
  text?: string;
  given?: string[];
  family?: string;
}

interface PatientResource {
  id?: string;
  name?: HumanName[];
  birthDate?: string;
  gender?: string;
}

function patientDisplayName(patient: PatientResource | null): string {
  const name = patient?.name?.[0];
  if (!name) return "(unnamed patient)";
  return name.text ?? [...(name.given ?? []), name.family ?? ""].join(" ").trim();
}

async function connect(): Promise<{ client: Client; patient: PatientResource }> {
  const params = new URLSearchParams(window.location.search);
  if (params.get("open") === "1") {
    const client = FHIR.client({ serverUrl: OPEN_SERVER });
    const requestedId = params.get("patient");
    if (requestedId) {
      const patient = (await client.request("Patient/" + requestedId)) as PatientResource;
      return { client, patient };
    }
    const bundle = (await client.request("Patient?_count=1")) as {
      entry?: Array<{ resource: PatientResource }>;
    };
    const patient = bundle.entry?.[0]?.resource;
    if (!patient) throw new Error("The open sandbox returned no patients");
    return { client, patient };
  }
  const client = await FHIR.oauth2.ready();
  const patient = (await client.patient.read()) as PatientResource;
  return { client, patient };
}

const SmartApp: React.FC = () => {
  const [client, setClient] = useState<Client | null>(null);
  const [patient, setPatient] = useState<PatientResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writeResult, setWriteResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    connect().then(
      ({ client: connected, patient: read }) => {
        setClient(connected);
        setPatient(read);
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  const writeQuestionnaireResponse = useCallback(() => {
    if (!client || !patient?.id) return;
    setBusy(true);
    setWriteResult(null);
    const resource = hydrateFhirResource(
      {
        resourceType: "QuestionnaireResponse",
        status: "completed",
        authored: new Date().toISOString(),
        item: [
          {
            linkId: "reason",
            text: "Reason for visit",
            answer: [{ valueString: "Newborn discharge follow-up" }],
          },
        ],
      },
      {
        patientId: patient.id,
        encounterId: client.encounter?.id ?? undefined,
        practitionerId: undefined,
      },
    );
    client
      .create(resource as never, { headers: { Accept: FHIR_JSON_ACCEPT } })
      .then(
        (created) =>
          setWriteResult(
            "Created QuestionnaireResponse/" + (created as { id?: string }).id,
          ),
        (e) => setWriteResult("Write failed: " + (e instanceof Error ? e.message : String(e))),
      )
      .finally(() => setBusy(false));
  }, [client, patient]);

  if (error) return <div style={{ color: "#a4262c" }}>SMART connection failed: {error}</div>;
  if (!patient) return <div>Connecting to the FHIR server…</div>;

  return (
    <div>
      <div
        style={{
          background: "#2a5785",
          color: "#fff",
          margin: "-16px -16px 16px",
          padding: "10px 16px",
        }}
      >
        <b>{patientDisplayName(patient)}</b>
        <span style={{ fontSize: 12, marginLeft: 16 }}>
          Patient/{patient.id} · {patient.gender ?? "?"} · born {patient.birthDate ?? "?"}
        </span>
      </div>
      <p style={{ fontSize: 13 }}>
        Connected via {new URLSearchParams(window.location.search).get("open") === "1"
          ? "open sandbox (" + OPEN_SERVER + ")"
          : "SMART OAuth launch"}
        . The write below runs the same hydration the Cerner Ignite path will use
        (subject/encounter auto-filled).
      </p>
      <button disabled={busy} onClick={writeQuestionnaireResponse} style={{ padding: "6px 16px" }}>
        Write QuestionnaireResponse
      </button>
      {writeResult ? (
        <p style={{ color: writeResult.startsWith("Created") ? "#1e6b1e" : "#a4262c" }}>
          {writeResult}
        </p>
      ) : null}
    </div>
  );
};

const container = document.getElementById("root");
if (container) createRoot(container).render(<SmartApp />);
