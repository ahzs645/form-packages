const DEFAULT_NON_COMPLIANT_INTERVENTIONS = [
  "Medication as per order",
  "Code white team response standyby",
  "Security notified of patient situation if necessary",
  "2 or 3 person approach with specific roles for each care provider",
  "Use of basic mechanical restraint options",
  "Relocate to a quieter area if possible",
  "Referral to additional clinical resources (I.E. aquired brain injury program, mental health & addictions, geriatritian, etc.)",
  "Client certified",
]

const DEFAULT_COMPLIANT_INTERVENTIONS = [
  "Ask patient/client how you can help? Information required? Basic needs met?",
  "Relocate to a quieter area if possible",
  "Determine if family member or significant other can assist",
  "Referral to additional clinical resources (I.E. aquired brain injury program, mental health & addictions, geriatritian, etc.)",
  "Offer alternative activities",
  "Involve family",
]

const normalizeList = (items, fallback) => {
  if (!Array.isArray(items) || items.length === 0) return fallback
  return items.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
}

function LegacyModerateRiskGuidance({
  id = "legacyModerateRiskGuidance",
  assessmentModule = "MEASUREMENTS",
  treatmentPlanModule = "CHARTACTION",
  nonCompliantInterventions = DEFAULT_NON_COMPLIANT_INTERVENTIONS,
  compliantInterventions = DEFAULT_COMPLIANT_INTERVENTIONS,
}) {
  const nonCompliant = normalizeList(nonCompliantInterventions, DEFAULT_NON_COMPLIANT_INTERVENTIONS)
  const compliant = normalizeList(compliantInterventions, DEFAULT_COMPLIANT_INTERVENTIONS)

  return (
    <div id={id} data-field-id={id}>
      <ol type="1">
        <li>
          <strong>Determine if patient/client is complian to simple requests</strong>
          {`: e.g. Please sit down" or "Please walk here". If patient/client is suffering cognitive impairment or has a language barrier, using hand gestures may be required`}
        </li>
        <li>
          <strong>Determine underlying causes using one or more of the following assessment tools</strong>
          {": "}
          <LinkToMois moisModule={assessmentModule} title={`Open ${assessmentModule} in MOIS`} />
          <br />
          <ol type="a">
            <li>PRISME</li>
            <li>MSE - Mental Status Exam</li>
            <li>CAM - Continuous Assessment Method</li>
          </ol>
        </li>
        <li>
          <strong>Non-Compliant</strong>
          <br />
          <ol type="a">
            <li>Alert place if clinical judgments indicates</li>
            <li>
              Treatment plan includes interventions to address potentially aggressive behaviours{" "}
              <LinkToMois moisModule={treatmentPlanModule} title={`Open ${treatmentPlanModule} in MOIS`} />
            </li>
          </ol>
        </li>
        <li>
          <strong>
            Consider the following interventions. This is not an inclusive or prioritized list and all interventions may not be required.
          </strong>
          <br />
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-evenly", border: "1px solid lightgrey", marginRight: 20 }}>
            <div style={{ width: "45%" }}>
              <p><strong>NON-COMPLIANT: CONSIDER THESE INTERVENTIONS</strong></p>
              <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                {nonCompliant.map((item) => <li key={item}>{item}</li>)}
                <li><b>Continually check for compliance</b></li>
              </ul>
            </div>
            <div style={{ width: "45%" }}>
              <p><strong>COMPLIANT: CONSIDER THESE INTERVENTIONS</strong></p>
              <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                {compliant.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </li>
      </ol>
    </div>
  )
}
