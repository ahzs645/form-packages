import { hydrateFhirResource, resolveSmartLaunchContext, FHIR_JSON_ACCEPT } from "@webforms/cerner-core";
import FHIR from "fhirclient/browser";
import type Client from "fhirclient/Client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import "./smart-app.css";
import { useSmartStyle } from "./use-smart-style";

/**
 * SMART app page: the FHIR read/write half of the Cerner target.
 *
 * Two entry modes:
 *  - OAuth redirect landing after smart-launch.html (FHIR.oauth2.ready) —
 *    the path Cerner Ignite will use.
 *  - ?open=1 — no-auth client against the public SMART R4 sandbox, so the
 *    whole read→hydrate→write pipeline is testable today.
 *
 * Both of the launch-context flags the EHR returns with the token are
 * honoured: `need_patient_banner` decides whether we draw a banner of our own
 * (an EHR that already shows the patient must not get a second one stacked
 * under its), and `smart_style_url` re-themes `.smart-root` to whatever the
 * host published.
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

  // Defaults until the token response lands: our own banner, our own look.
  const launch = useMemo(
    () => resolveSmartLaunchContext({ client, search: window.location.search }),
    [client],
  );
  const smartStyle = useSmartStyle(launch.smartStyleUrl);

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

  const body = error ? (
    <div className="smart-error">SMART connection failed: {error}</div>
  ) : !patient ? (
    <div>Connecting to the FHIR server…</div>
  ) : (
    <>
      {/* need_patient_banner=false means the EHR frame around us already
          shows this patient; drawing ours would stack a second banner. */}
      {launch.needPatientBanner ? (
        <div className="smart-banner">
          <b>{patientDisplayName(patient)}</b>
          <span className="smart-banner__detail">
            Patient/{patient.id} · {patient.gender ?? "?"} · born {patient.birthDate ?? "?"}
          </span>
        </div>
      ) : null}
      <p className="smart-note">
        Connected via {new URLSearchParams(window.location.search).get("open") === "1"
          ? "open sandbox (" + OPEN_SERVER + ")"
          : "SMART OAuth launch"}
        . The write below runs the same hydration the Cerner Ignite path will use
        (subject/encounter auto-filled).
      </p>
      <button className="smart-action" disabled={busy} onClick={writeQuestionnaireResponse}>
        Write QuestionnaireResponse
      </button>
      {writeResult ? (
        <p className={writeResult.startsWith("Created") ? "smart-success" : "smart-error"}>
          {writeResult}
        </p>
      ) : null}
    </>
  );

  return (
    <div className="smart-root" style={smartStyle}>
      {body}
    </div>
  );
};

const container = document.getElementById("root");
if (container) createRoot(container).render(<SmartApp />);
