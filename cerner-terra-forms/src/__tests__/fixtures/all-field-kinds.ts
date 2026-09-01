import type { BuilderField } from "@webforms/form-model";

/**
 * Coverage fixture for the Cerner Terra render target.
 *
 * One authored form ("Newborn Admission & Discharge Record") that exercises
 * every builder field kind the Terra renderer has to map, with realistic
 * Northern Health maternity/newborn content so the rendered output is
 * inspectable by a clinician rather than a wall of "Field 1"/"Option 1".
 *
 * Structure (childFieldIds are authoritative — see lib/field-traversal.ts):
 *
 *   section  sec_maternal ─┬─ text/number/date/time/datetime/choice/boolean/textarea
 *   section  sec_newborn  ─┬─ heading hdg_newborn_measurements ─┬─ number x3 + computed
 *                          └─ choice/boolean/component/table/layoutTable/richText/hyperlink
 *
 * No field is claimed by two containers: the section owns the heading, the
 * heading owns its own children.
 *
 * Cross-cutting features deliberately covered (the renderer must honour these
 * independently of the field kind):
 *   - required               → mother_full_name, delivery_date
 *   - helpText               → mother_phn (helpPosition below_input), gravida
 *   - placeholder            → mother_full_name, labour_notes
 *   - width fractions        → 1/2, 1/3, 2/3, full
 *   - labelPosition          → "left" on chart_mrn, "none" on discharge_instructions
 *   - read-only / disabled   → chart_mrn (disabled + prefill), discharge_instructions
 *   - visibility (show-when) → gbs_prophylaxis_notes shows when gbs_status equals "positive"
 *                              (multi-condition: also requires delivery_date filled)
 *   - validation rules       → mother_phn (pattern/minLength/maxLength), apgar scores (min/max)
 */
export const allFieldKindsFixture: BuilderField[] = [
  // ───────────────────────── Section 1: maternal / delivery ─────────────────
  {
    id: "sec_maternal",
    label: "Maternal & Delivery History",
    type: "section",
    sectionConfig: {
      title: "Maternal & Delivery History",
      description: "Completed by the attending RN from the perinatal record.",
      collapsible: true,
      defaultCollapsed: false,
      layoutType: "grid",
      gridColumns: 2,
      rowSeparators: true,
      childFieldIds: [
        "mother_full_name",
        "mother_phn",
        "chart_mrn",
        "delivery_date",
        "birth_time",
        "admission_datetime",
        "gravida",
        "para",
        "delivery_type",
        "maternal_blood_type",
        "maternal_allergies",
        "gbs_status",
        "gbs_prophylaxis_notes",
        "delivery_complications",
        "labour_notes",
      ],
    },
  },

  // text — required + placeholder + half width
  {
    id: "mother_full_name",
    label: "Mother's Full Name",
    type: "text",
    required: true,
    placeholder: "Last, First Middle",
    width: "1/2",
    labelPosition: "top",
    textConfig: { maxCharLimit: 120, showCharLimit: true },
  },

  // text — helpText + validation rules
  {
    id: "mother_phn",
    label: "Personal Health Number (PHN)",
    type: "text",
    width: "1/2",
    helpText: "10-digit BC PHN from the CareCard or the ADT banner.",
    helpPosition: "below_input",
    placeholder: "9999999999",
    validation: {
      rules: [
        { type: "minLength", value: 10, message: "A BC PHN is exactly 10 digits." },
        { type: "maxLength", value: 10, message: "A BC PHN is exactly 10 digits." },
        { type: "pattern", value: "^\\d{10}$", message: "Digits only — no spaces or dashes." },
      ],
      customError: "Enter a valid 10-digit BC Personal Health Number.",
    },
  },

  // text — read-only / disabled, prefilled from the chart, left-labelled
  {
    id: "chart_mrn",
    label: "Facility MRN",
    type: "text",
    disabled: true,
    width: "1/2",
    labelPosition: "left",
    prefill: "UHNBC-0043921",
    helpText: "Populated from the encounter; not editable on this form.",
  },

  // date — required
  {
    id: "delivery_date",
    label: "Date of Delivery",
    type: "date",
    required: true,
    width: "1/3",
    dateConfig: {
      dateFormat: "yyyy-MM-dd",
      disableFutureDates: true,
      prefillToday: true,
      showAge: false,
    },
  },

  // time
  {
    id: "birth_time",
    label: "Time of Birth",
    type: "time",
    width: "1/3",
    timeConfig: { format: "24h" },
  },

  // datetime
  {
    id: "admission_datetime",
    label: "Nursery Admission Date & Time",
    type: "datetime",
    width: "1/3",
    dateConfig: { withTime: true, dateFormat: "yyyy-MM-dd", disableFutureDates: true },
  },

  // number — with helpText and spin controls
  {
    id: "gravida",
    label: "Gravida",
    type: "number",
    width: "1/3",
    helpText: "Total number of pregnancies, including this one.",
    numberConfig: {
      typeNumber: "number",
      buttonControls: true,
      storeAsNumber: true,
      spinButtonProps: { min: 1, max: 20, step: 1 },
    },
  },

  // number
  {
    id: "para",
    label: "Para",
    type: "number",
    width: "1/3",
    numberConfig: {
      typeNumber: "number",
      storeAsNumber: true,
      spinButtonProps: { min: 0, max: 20, step: 1 },
    },
  },

  // choice — dropdown
  {
    id: "delivery_type",
    label: "Type of Delivery",
    type: "choice",
    choiceStyle: "dropdown",
    width: "1/2",
    options: [
      { label: "Spontaneous vaginal", value: "SVD" },
      { label: "Assisted vaginal — vacuum", value: "VAC" },
      { label: "Assisted vaginal — forceps", value: "FOR" },
      { label: "Caesarean — elective", value: "CS-ELECT" },
      { label: "Caesarean — emergency", value: "CS-EMERG" },
    ],
  },

  // choice — simpleCodeSelect (coded single-select against a MOIS code system)
  {
    id: "maternal_blood_type",
    label: "Maternal Blood Type & Rh",
    type: "choice",
    choiceStyle: "simpleCodeSelect",
    width: "1/2",
    codeSystem: "MOIS-BLOODTYPE",
    autoHotKey: true,
    options: [
      { label: "O negative", value: "O-" },
      { label: "O positive", value: "O+" },
      { label: "A negative", value: "A-" },
      { label: "A positive", value: "A+" },
      { label: "B negative", value: "B-" },
      { label: "B positive", value: "B+" },
      { label: "AB negative", value: "AB-" },
      { label: "AB positive", value: "AB+" },
    ],
  },

  // choice — multiselect
  {
    id: "maternal_allergies",
    label: "Known Maternal Allergies",
    type: "choice",
    choiceStyle: "multiselect",
    width: "full",
    showOtherOption: true,
    options: [
      { label: "No known allergies", value: "NKA" },
      { label: "Penicillin", value: "PCN" },
      { label: "Sulfa drugs", value: "SULFA" },
      { label: "Latex", value: "LATEX" },
      { label: "Codeine / opioids", value: "OPIOID" },
    ],
  },

  // booleanYesNo — the controller for the visibility rule below
  {
    id: "gbs_status",
    label: "Group B Streptococcus screen positive?",
    type: "booleanYesNo",
    width: "1/2",
    booleanLabels: { on: "Positive", off: "Negative" },
    booleanNeutralMode: "initial",
  },

  // textarea — visibility (show-when), multi-condition
  {
    id: "gbs_prophylaxis_notes",
    label: "Intrapartum Antibiotic Prophylaxis Given",
    type: "textarea",
    width: "full",
    helpText: "Agent, dose, and time of the last pre-delivery dose.",
    visibility: {
      type: "equals",
      controllerId: "gbs_status",
      value: "positive",
      match: "all",
      additionalConditions: [{ type: "filled", controllerId: "delivery_date" }],
      hiddenAnswerPolicy: "clear",
    },
    textareaConfig: { rows: 3, multiline: true, resizable: true },
  },

  // choice — findCode (terminology lookup, no inline option list is authoritative)
  {
    id: "delivery_complications",
    label: "Delivery Complications",
    type: "choice",
    choiceStyle: "findCode",
    width: "full",
    codeSystem: "MOIS-ICD9",
    options: [
      { label: "Shoulder dystocia", value: "660.4" },
      { label: "Postpartum haemorrhage", value: "666.1" },
      { label: "Third or fourth degree laceration", value: "664.2" },
      { label: "Meconium-stained liquor", value: "656.83" },
    ],
  },

  // textarea — placeholder + character limit
  {
    id: "labour_notes",
    label: "Labour & Delivery Narrative",
    type: "textarea",
    width: "full",
    placeholder: "Onset, augmentation, analgesia, and any deviations from the care plan…",
    textareaConfig: {
      rows: 6,
      multiline: true,
      resizable: true,
      maxCharLimit: 4000,
      showCharLimit: true,
      labelPosition: "top",
    },
  },

  // ───────────────────────── Section 2: newborn ─────────────────────────────
  {
    id: "sec_newborn",
    label: "Newborn Assessment & Discharge",
    type: "section",
    sectionConfig: {
      title: "Newborn Assessment & Discharge",
      description: "Complete before transfer to the postpartum unit.",
      collapsible: true,
      defaultCollapsed: false,
      layoutType: "stacked",
      childFieldIds: [
        "hdg_newborn_measurements",
        "feeding_method",
        "newborn_risk_factors",
        "vitamin_k_given",
        "newborn_weight_trend",
        "newborn_feed_log",
        "newborn_id_band",
        "discharge_instructions",
        "perinatal_guideline_link",
      ],
    },
  },

  // heading — owns the measurement block
  {
    id: "hdg_newborn_measurements",
    label: "Birth Measurements & Apgar",
    type: "heading",
    headingConfig: {
      childFieldIds: ["birth_weight_g", "apgar_1min", "apgar_5min", "apgar_total"],
    },
  },

  // number — unit suffix
  {
    id: "birth_weight_g",
    label: "Birth Weight",
    type: "number",
    width: "1/3",
    numberConfig: {
      typeNumber: "number",
      suffix: "g",
      storeAsNumber: true,
      spinButtonProps: { min: 300, max: 7000, step: 5 },
    },
  },

  // number — validation min/max
  {
    id: "apgar_1min",
    label: "Apgar Score — 1 minute",
    type: "number",
    width: "1/3",
    numberConfig: { typeNumber: "number", storeAsNumber: true, spinButtonProps: { min: 0, max: 10, step: 1 } },
    validation: {
      rules: [
        { type: "min", value: 0, message: "Apgar scores run 0–10." },
        { type: "max", value: 10, message: "Apgar scores run 0–10." },
      ],
    },
  },

  // number — validation min/max
  {
    id: "apgar_5min",
    label: "Apgar Score — 5 minutes",
    type: "number",
    width: "1/3",
    numberConfig: { typeNumber: "number", storeAsNumber: true, spinButtonProps: { min: 0, max: 10, step: 1 } },
    validation: {
      rules: [
        { type: "min", value: 0, message: "Apgar scores run 0–10." },
        { type: "max", value: 10, message: "Apgar scores run 0–10." },
      ],
    },
  },

  // computed — references the two Apgar fields, with interpretation ranges
  {
    id: "apgar_total",
    label: "Apgar Total (1 min + 5 min)",
    type: "computed",
    width: "1/3",
    computedConfig: {
      expression: "[apgar_1min] + [apgar_5min]",
      precision: 0,
      resultType: "number",
      displayStyle: "field",
      calculationPolicy: "always-calculated",
      incompleteBehavior: "show-text",
      incompleteText: "—",
      showInterpretation: true,
      interpretation: {
        label: "Interpretation",
        ranges: [
          { min: 0, max: 6, label: "Low", description: "Escalate to the paediatrician on call." },
          { min: 7, max: 13, label: "Moderate", description: "Repeat assessment at 10 minutes." },
          { min: 14, max: 20, label: "Reassuring", description: "Routine newborn care." },
        ],
      },
    },
  },

  // choice — radio
  {
    id: "feeding_method",
    label: "Feeding Method at Discharge",
    type: "choice",
    choiceStyle: "radio",
    choiceAnswerLayout: "inline",
    width: "full",
    options: [
      { label: "Exclusively breastfed", value: "BREAST" },
      { label: "Breast milk + formula supplement", value: "MIXED" },
      { label: "Formula only", value: "FORMULA" },
      { label: "Expressed breast milk by tube", value: "EBM-TUBE" },
    ],
  },

  // choice — checkbox (scored, multi-select)
  {
    id: "newborn_risk_factors",
    label: "Newborn Risk Factors Identified",
    type: "choice",
    choiceStyle: "checkbox",
    choiceAnswerLayout: "columns-2",
    width: "full",
    showOtherOption: true,
    options: [
      { label: "Preterm (< 37 weeks)", value: "PRETERM", score: 2 },
      { label: "Small for gestational age", value: "SGA", score: 2 },
      { label: "Maternal diabetes (GDM or pre-existing)", value: "MAT-DM", score: 1 },
      { label: "Prolonged rupture of membranes (> 18 h)", value: "PROM", score: 1 },
      { label: "Hypothermia on admission", value: "HYPOTHERM", score: 1 },
      { label: "Jaundice requiring phototherapy", value: "JAUNDICE", score: 1 },
    ],
  },

  // booleanSingle — a single checkbox attestation
  {
    id: "vitamin_k_given",
    label: "Vitamin K (phytonadione) 1 mg IM administered",
    type: "booleanSingle",
    width: "full",
    booleanLabels: { on: "Given", off: "Not given" },
  },

  // component — host component keyed into the shared registry
  {
    id: "newborn_weight_trend",
    label: "Newborn Weight Trend",
    type: "component",
    width: "full",
    componentKey: "ObservationChart",
    componentTitle: "Newborn Weight Trend",
    componentDescription: "Charted weights since birth, against the WHO 0–2 y growth reference.",
    componentProps: {
      observationCode: "WEIGHT",
      units: "g",
      maxPoints: 14,
    },
  },

  // table — repeating rows
  {
    id: "newborn_feed_log",
    label: "Feeding & Output Log",
    type: "table",
    width: "full",
    tableConfig: {
      mode: "inline",
      orientation: "horizontal",
      allowAddRows: true,
      allowRemoveRows: true,
      allowEditRows: true,
      initialRows: 1,
      maxRows: 24,
      addButtonText: "Add feed",
      modalTitle: "Feed record",
      columns: [
        { id: "feed_time", label: "Time", type: "time", showInTable: true, showInModal: true },
        {
          id: "feed_type",
          label: "Type",
          type: "choice",
          choiceStyle: "dropdown",
          options: [
            { label: "Breast", value: "BREAST" },
            { label: "Expressed breast milk", value: "EBM" },
            { label: "Formula", value: "FORMULA" },
          ],
          showInTable: true,
          showInModal: true,
        },
        {
          id: "feed_volume_ml",
          label: "Volume (mL)",
          type: "number",
          numberConfig: { typeNumber: "number", storeAsNumber: true, spinButtonProps: { min: 0, max: 200, step: 1 } },
          showInTable: true,
          showInModal: true,
        },
        { id: "void_stool", label: "Void / Stool", type: "text", showInTable: true, showInModal: true },
        { id: "latch_adequate", label: "Latch adequate", type: "booleanYesNo", showInTable: true, showInModal: true },
      ],
      uniqueBy: ["feed_time"],
    },
  },

  // layoutTable — static printable grid with embedded inputs
  {
    id: "newborn_id_band",
    label: "Identification Band Verification",
    type: "layoutTable",
    width: "full",
    layoutTableConfig: {
      bordered: true,
      compact: true,
      fullWidth: true,
      cellPadding: 6,
      borderColor: "#000000",
      pageBreakInsideAvoid: true,
      showLabel: true,
      rows: [
        {
          id: "id_band_row_header",
          cells: [
            { id: "id_band_header_check", kind: "text", text: "Check", header: true, width: "45%" },
            { id: "id_band_header_nurse", kind: "text", text: "Verified by", header: true, width: "35%" },
            { id: "id_band_header_time", kind: "text", text: "Time", header: true, width: "20%" },
          ],
        },
        {
          id: "id_band_row_applied",
          cells: [
            { id: "id_band_applied_label", kind: "text", text: "Two ID bands applied to infant" },
            {
              id: "id_band_applied_by",
              kind: "field",
              fieldId: "id_band_applied_by",
              label: "Verified by",
              inputType: "text",
            },
            {
              id: "id_band_applied_time",
              kind: "field",
              fieldId: "id_band_applied_time",
              label: "Time",
              inputType: "time",
            },
          ],
        },
        {
          id: "id_band_row_matched",
          cells: [
            { id: "id_band_matched_label", kind: "text", text: "Infant band matched to mother band at discharge" },
            {
              id: "id_band_matched_by",
              kind: "field",
              fieldId: "id_band_matched_by",
              label: "Verified by",
              inputType: "text",
            },
            {
              id: "id_band_matched_time",
              kind: "field",
              fieldId: "id_band_matched_time",
              label: "Time",
              inputType: "time",
            },
          ],
        },
      ],
    },
  },

  // richText — read-only rendered markdown, label suppressed
  {
    id: "discharge_instructions",
    label: "Discharge Teaching",
    type: "richText",
    width: "full",
    labelPosition: "none",
    disabled: true,
    richTextConfig: {
      readOnly: true,
      borderless: true,
      startingMode: "preview",
      source: [
        "### Before you go home",
        "",
        "- Feed on demand — at least **8 feeds in 24 hours**.",
        "- Expect one wet diaper per day of life, up to six per day by day 5.",
        "- Place your baby **on their back** to sleep, in their own crib.",
        "- Book the public-health nurse visit within **48 hours** of discharge.",
        "",
        "Call the Maternity Unit or go to Emergency for fever, poor feeding,",
        "worsening jaundice, or fewer wet diapers than expected.",
      ].join("\n"),
    },
  },

  // hyperlink
  {
    id: "perinatal_guideline_link",
    label: "Perinatal Services BC — Newborn Guidelines",
    type: "hyperlink",
    width: "full",
    hyperlinkConfig: {
      href: "https://www.perinatalservicesbc.ca/health-professionals/guidelines/newborn",
      label: "Open the Newborn Guidelines",
      target: "_blank",
      displayStyle: "inline",
    },
  },
];

export default allFieldKindsFixture;
