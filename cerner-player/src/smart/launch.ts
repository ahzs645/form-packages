import FHIR from "fhirclient";

/**
 * SMART on FHIR EHR-launch endpoint. The EHR (Cerner Ignite once NH's
 * non-prod opens, or the public SMART launcher today) navigates here with
 * ?iss=&launch=; we authorize and land on smart-app.html.
 *
 * The client id is a placeholder until the Ignite app registration exists —
 * the SMART sandbox accepts any id. Scopes mirror the Ignite registration
 * checklist (reads + our three write targets).
 */
FHIR.oauth2
  .authorize({
    clientId: "webforms-player-dev",
    scope: [
      "launch",
      "openid",
      "fhirUser",
      "online_access",
      "user/Patient.read",
      "user/Encounter.read",
      "user/Observation.read",
      "user/Observation.write",
      "user/DocumentReference.read",
      "user/DocumentReference.write",
      "user/QuestionnaireResponse.read",
      "user/QuestionnaireResponse.write",
    ].join(" "),
    redirectUri: "smart-app.html",
  })
  .catch((error: unknown) => {
    const root = document.getElementById("root");
    if (root) {
      root.textContent =
        "SMART launch failed: " + (error instanceof Error ? error.message : String(error));
    }
  });
