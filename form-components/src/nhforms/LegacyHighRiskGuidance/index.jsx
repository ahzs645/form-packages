const DEFAULT_INTERVENTIONS = [
  "Medication options - as per physician order: often require rapid tranquilization (IM)",
  "Code white team response",
  "Security if available",
  "Search and secure belongings",
  "Advanced restrating options: seclusion, mechanical, rapid tranquilization (IM)",
  "Constant care provider - if patient placed in 4 point restraint or seclusion",
  "Patient/client transfer to tertiary/regional facility",
  "RCMP Assistance",
]

const normalizeList = (items, fallback) => {
  if (!Array.isArray(items) || items.length === 0) return fallback
  const normalized = items.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
  return normalized.length > 0 ? normalized : fallback
}

function LegacyHighRiskGuidance({
  id = "legacyHighRiskGuidance",
  treatmentPlanModule = "CHARTACTION",
  interventions = DEFAULT_INTERVENTIONS,
}) {
  const interventionItems = normalizeList(interventions, DEFAULT_INTERVENTIONS)

  return (
    <div id={id} data-field-id={id}>
      <ol type="1">
        <li>
          <strong>Immediately notify supervisor (Managers, Team Leads, In-Charge, or PCC)</strong>
        </li>
        <li>
          <strong>Compliant</strong>
          <br />
          <ol type="a">
            <li>Recommended aggressive behaviour alert is activated</li>
            <li>
              Treatment plan includes interventions for de-escalation etc.
              <LinkToMois moisModule={treatmentPlanModule} title={`Open ${treatmentPlanModule} in MOIS`} />
            </li>
          </ol>
        </li>
        <li>
          <strong>Non-Compliant</strong>
          <br />
          <ol type="a">
            <li>Aggressive behaviour alert is activated</li>
            <li>
              Treatment plan includes interventions which decrease aggression/violence and address patient and staff safety{" "}
              <LinkToMois moisModule={treatmentPlanModule} title={`Open ${treatmentPlanModule} in MOIS`} />
            </li>
          </ol>
        </li>
        <li>
          <strong>
            Consider the following interventions. This is not an inclusive or prioritized list and all interventions may not be required.
          </strong>
          <br />
          <ul type="disc">
            {interventionItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </li>
      </ol>
    </div>
  )
}
