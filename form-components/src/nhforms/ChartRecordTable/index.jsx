
if (typeof ChartRecordTable === "undefined") {
  window.ChartRecordTable = null
}

/**
 * ChartRecordTable - Generic chart-collection browser with optional in-form
 * additions, reusing the MOIS-native machinery end to end:
 *
 * - Reading: every collection in the full-chart GraphQL query
 *   (Mois.Patient.Query.fullChart) is available as sourceData.patient[source];
 *   ListSelection renders it, so `source` can be allergies,
 *   longTermMedications, prescriptions, conditions, connections, goals,
 *   serviceRequests, serviceEpisodes, preferences, ...
 * - Native add/edit: the preset moisModule link (Action.LinkToMois) opens the
 *   real MOIS module for the collection so chart records are added/edited
 *   natively. For sources with supported GraphQL mutations (medications,
 *   preferences, connections, demographics) use a subform data-entry module
 *   with a moisMutation action instead.
 * - In-form additions: optional EditableTable rows stored in this form's
 *   field data for collections (like allergies) that have no chart mutation.
 */
ChartRecordTable = ({
  source = "allergies",
  id,
  fieldId,
  sourceId,
  label,
  chartLabel,
  reportedLabel,
  showChartRecords = true,
  allowAdd = false,
  selectionType = "none",
  selectText,
  readOnly = false,
  maxRows = 10,
  addButtonText = "+ Add row",
  emptyStateText = "No new rows reported",
  chartPlaceholder = "No matching items in chart",
  columns,
  entryColumns,
  moisModule,
  filterPred,
  listCompare,
  sourceMap,
  ...props
}) => {
  const preset = _chartRecordTablePresets[source] || {}
  const resolvedId = id || `${source}Reported`
  const resolvedLabel = typeof label === "undefined" ? preset.label || source : label
  const resolvedChartColumns = columns || preset.columns || _chartRecordTableGenericColumns
  const resolvedEntryColumns = entryColumns || preset.entryColumns || _chartRecordTableGenericEntryColumns
  const resolvedMoisModule = typeof moisModule === "undefined" ? preset.moisModule : moisModule
  const resolvedFieldId = fieldId || source
  const resolvedSourceId = sourceId || source
  const resolvedSourceMap = sourceMap || preset.sourceMap

  return (
    <Fluent.Stack tokens={{ childrenGap: 10 }}>
      {resolvedLabel ? (
        <Fluent.Label styles={{ root: { fontWeight: 600 } }}>{resolvedLabel}</Fluent.Label>
      ) : null}

      {showChartRecords ? (
        <ListSelection
          fieldId={resolvedFieldId}
          sourceId={resolvedSourceId}
          label={chartLabel || preset.chartLabel}
          selectionType={selectionType}
          selectText={selectText || preset.selectText}
          columns={resolvedChartColumns}
          moisModule={resolvedMoisModule}
          placeholder={chartPlaceholder}
          filterPred={filterPred}
          listCompare={listCompare}
          sourceMap={resolvedSourceMap}
        />
      ) : null}

      {allowAdd ? (
        <EditableTable
          id={resolvedId}
          label={reportedLabel || preset.reportedLabel || "Reported on this form"}
          columns={resolvedEntryColumns}
          initialRows={0}
          maxRows={maxRows}
          addButtonText={preset.addButtonText || addButtonText}
          emptyStateText={preset.emptyStateText || emptyStateText}
          readOnly={readOnly}
          allowAddRows={!readOnly}
          allowEditRows={!readOnly}
          allowDeleteRows={!readOnly}
          uniqueBy={preset.uniqueBy || []}
          {...props}
        />
      ) : null}
    </Fluent.Stack>
  )
}

const _chartRecordTableGenericColumns = [
  { title: "Date", id: "startDate", type: "date" },
  { title: "Description", id: "description", type: "string" },
  { title: "Comment", id: "comment", type: "string" },
]

const _chartRecordTableGenericEntryColumns = [
  { id: "description", label: "Description", type: "text", rows: 1, required: true },
  { id: "startDate", label: "Date", type: "date" },
  { id: "comment", label: "Comment", type: "text", rows: 1 },
]

// Column shapes follow the real MOIS full-chart GraphQL schema
// (Mois.Patient.Query.fullChartFields); coded values render via display text.
const _chartRecordTablePresets = {
  allergies: {
    label: "Allergies",
    reportedLabel: "New allergies reported on this form",
    addButtonText: "+ Add allergy",
    emptyStateText: "No new allergies reported",
    moisModule: "REACTION_RISKS",
    uniqueBy: ["substance"],
    columns: [
      { id: "allergyId", type: "key" },
      { title: "Onset", id: "startDate", type: "date" },
      { title: "Agent", id: "substance", type: "string" },
      { title: "Type", id: "intoleranceType", type: "string" },
      { title: "Reactions", id: "reactions", type: "string" },
      { title: "Comment", id: "comment", type: "string" },
    ],
    entryColumns: [
      { id: "substance", label: "Agent / substance", type: "text", rows: 1, required: true, placeholder: "e.g. PENICILLIN" },
      { id: "reactions", label: "Reactions", type: "text", rows: 1, placeholder: "e.g. PRURITIC RASH, NAUSEA" },
      { id: "intoleranceType", label: "Type", type: "dropdown", options: ["ALLERGY", "INTOLERANCE", "ADVERSE REACTION"] },
      { id: "severity", label: "Severity", type: "dropdown", options: ["MILD", "MODERATE", "SEVERE"] },
      { id: "startDate", label: "Onset", type: "date" },
      { id: "comment", label: "Comment", type: "text", rows: 1 },
    ],
  },
  longTermMedications: {
    label: "Long-term medications",
    reportedLabel: "Medication changes reported on this form",
    addButtonText: "+ Add medication",
    emptyStateText: "No medication changes reported",
    uniqueBy: ["medication"],
    columns: [
      { id: "longTermMedicationId", type: "key" },
      { title: "Start", id: "startDate", type: "date" },
      { title: "Medication", id: "medication", type: "string" },
      { title: "Dose / frequency", id: "doseFrequency", type: "string" },
      { title: "End", id: "endDate", type: "date" },
      { title: "Ordered by", id: "orderedBy", type: "string" },
    ],
    entryColumns: [
      { id: "medication", label: "Medication", type: "text", rows: 1, required: true },
      { id: "doseFrequency", label: "Dose / frequency", type: "text", rows: 1 },
      { id: "startDate", label: "Start", type: "date" },
      { id: "comment", label: "Comment", type: "text", rows: 1 },
    ],
  },
  prescriptions: {
    label: "Prescriptions",
    columns: [
      { id: "prescriptionId", type: "key" },
      { title: "Ordered", id: "orderDate", type: "date" },
      { title: "Medication", id: "medication", type: "string" },
      { title: "Generic", id: "genericName", type: "string" },
      { title: "Type", id: "type", type: "string" },
    ],
  },
  conditions: {
    label: "Conditions / health issues",
    columns: [
      { id: "conditionId", type: "key" },
      { title: "Start", id: "startDate", type: "date" },
      { title: "Condition", id: "condition", type: "string" },
      { title: "Resolved", id: "resolveDate", type: "date" },
      { title: "Comment", id: "comment", type: "string" },
    ],
  },
  connections: {
    label: "Connections / care team",
    columns: [
      { id: "connectionId", type: "key" },
      { title: "Start", id: "startDate", type: "date" },
      { title: "Name", id: "name", type: "string" },
      { title: "Type", id: "connectionType", type: "string" },
      { title: "Provider", id: "provider", type: "string" },
    ],
  },
  goals: {
    label: "Goals",
    moisModule: "GOALS",
    columns: [
      { id: "goalId", type: "key" },
      { title: "Start", id: "startDate", type: "date" },
      { title: "Goal", id: "goal", type: "string" },
      { title: "Expected outcome", id: "expectedOutcome", type: "string" },
      { title: "End", id: "endDate", type: "date" },
    ],
  },
  serviceRequests: {
    label: "Service requests / referrals",
    columns: [
      { id: "serviceRequestId", type: "key" },
      { title: "Ordered", id: "orderDate", type: "date" },
      { title: "Order", id: "order", type: "string" },
      { title: "Status", id: "status", type: "string" },
      { title: "Ordered by", id: "orderedBy", type: "string" },
    ],
  },
  serviceEpisodes: {
    label: "Service episodes",
    columns: [
      { id: "serviceEpisodeId", type: "key" },
      { title: "Start", id: "startDate", type: "date" },
      { title: "Service", id: "service", type: "string" },
      { title: "End", id: "endDate", type: "date" },
      { title: "Note", id: "note", type: "string" },
    ],
  },
  occupations: {
    label: "Employment history",
    selectText: "Select specific employment",
    columns: [
      { id: "occupationId", type: "key" },
      { title: "Start", id: "startDate", type: "date" },
      { title: "End", id: "endDate", type: "date" },
      { title: "Description", id: "classification", type: "code", size: "medium" },
      { title: "Employer", id: "employer", type: "string", size: "small" },
      { title: "Hours/week", id: "hoursPerWeek", type: "number", size: "tiny" },
    ],
  },
  educations: {
    label: "Education history",
    selectText: "Select relevant education",
    columns: [
      { id: "educationId", type: "key" },
      { title: "Start", id: "startDate", type: "date" },
      { title: "Stop", id: "stopDate", type: "date" },
      { title: "Educational Institution", id: "educationalInstitution", type: "code", size: "medium" },
      { title: "Level of Education", id: "educationLevel", type: "code" },
    ],
  },
  aliasIdentifiers: {
    label: "Alias patient identifiers",
    columns: [
      { id: "aliasIdentifierId", type: "key" },
      { title: "Type", id: "idType", type: "string" },
      { title: "Identifier", id: "identifier", type: "string" },
      { title: "Effective date", id: "effectiveDate", type: "date" },
      { title: "Comment", id: "comment", type: "string" },
    ],
    sourceMap: (alias) => ({
      aliasIdentifierId: alias.aliasIdentifierId,
      effectiveDate: alias.effectiveDate,
      idType: alias.identifierType?.display,
      identifier: alias.identifier,
      comment: alias.comment,
    }),
  },
  preferences: {
    label: "Preferences & consents",
    columns: [
      { title: "Start", id: "startDate", type: "date" },
      { title: "Preference", id: "preference", type: "string" },
      { title: "Classification", id: "classification", type: "string" },
      { title: "Instruction", id: "instruction", type: "string" },
    ],
  },
}
