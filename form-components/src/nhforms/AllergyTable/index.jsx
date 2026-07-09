
if (typeof AllergyTable === "undefined") {
  window.AllergyTable = null
}

/**
 * AllergyTable - Chart allergies plus form-reported additions.
 *
 * Thin preset over ChartRecordTable with source="allergies": the chart list
 * reads the active patient's allergies from the full-chart query
 * (sourceData.patient.allergies) with a native REACTION_RISKS module link,
 * and additions are captured as structured rows in this form's field data.
 * MOIS has no allergy chart mutation, so in-form rows travel with the signed
 * form rather than writing the chart's allergy table directly.
 */
AllergyTable = ({
  id = "allergyTable",
  label = "Allergies",
  chartLabel,
  reportedLabel = "New allergies reported on this form",
  showChartAllergies = true,
  allowAdd = true,
  readOnly = false,
  maxRows = 10,
  addButtonText = "+ Add allergy",
  emptyStateText = "No new allergies reported",
  chartPlaceholder = "No allergies recorded in this chart",
  ...props
}) => {
  return (
    <ChartRecordTable
      source="allergies"
      id={id}
      label={label}
      chartLabel={chartLabel}
      reportedLabel={reportedLabel}
      showChartRecords={showChartAllergies}
      allowAdd={allowAdd}
      readOnly={readOnly}
      maxRows={maxRows}
      addButtonText={addButtonText}
      emptyStateText={emptyStateText}
      chartPlaceholder={chartPlaceholder}
      {...props}
    />
  )
}
