
const MseLick = () => (<>

        <SimpleCodeChecklist
          fieldId='alertness'
          label='Alertness'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-ALERTNESS"
          optionList={[
            {
              key: "Conscious - Orientated to person",
              text: "Conscious - Orientated to person",
            },
            {
              key: "Conscious - Orientated to place",
              text: "Conscious - Orientated to place",
            },
            {
              key: "Conscious - Orientated to time",
              text: "Conscious - Orientated to time",
            },
            {
              key: "Conscious - Aware of why they are here",
              text: "Conscious - Aware of why they are here",
            },
            {
              key: "Not-Conscious - Easily aroused",
              text: "Not-Conscious - Easily aroused",
            },
            {
              key: "Not-Conscious - Arouses to verbal stimuli",
              text: "Not-Conscious - Arouses to verbal stimuli",
            },
            {
              key: "Not-Conscious - Arouses to tactile stimuli",
              text: "Not-Conscious - Arouses to tactile stimuli",
            },
            {
              key: "Not-Conscious - Arouses to pain stimuli",
              text: "Not-Conscious - Arouses to pain stimuli",
            },
            { key: "Unable to arouse", text: "Unable to arouse" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='cognitiveIssues'
          label='Cognitive issues'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-COGNITIVE"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Confused", text: "Confused" },
            { key: "Daydreaming", text: "Daydreaming" },
            { key: "Lack of abstract thought", text: "Lack of abstract thought" },
            { key: "Poor attention span", text: "Poor attention span" },
            { key: "Poor concentration", text: "Poor concentration" },
            { key: "Poor memory", text: "Poor memory" },
            { key: "Unable to generate ideas", text: "Unable to generate ideas" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='memoryIssues'
          label='Memory issues'
          selectionType="multiple"
          optionSize="small"
          codeSystem="MSE-MEMORY"
          optionList={[
            { key: "None", text: "None" },
            { key: "Short term", text: "Short term" },
            { key: "Long term", text: "Long term" },
          ]}
        />
        <TextArea
          fieldId='memoryIssueDuration'
          label='Length of duration of memory issues'
          size="medium"
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='awarenessOfIllness'
          label='Awareness of illness'
        />
        <SimpleCodeChecklist
          fieldId='selfConcept'
          label='Self-Concept'
          optionSize="small"
          codeSystem="MSE-SELFCONCEPT"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Overly self critical", text: "Overly self critical" },
            { key: "Poor self image", text: "Poor self image" },
          ]}
        />
</>)

const MseLickSchema = {
  'alertness':            { $ref: "#/definitions/codings" },
  'cognitiveIssues':      { $ref: "#/definitions/codings" },
  'memoryIssues':         { $ref: "#/definitions/codings" },
  'memoryIssueDuration':  { type: "string" },
  'awarenessOfIllness':   { $ref: "#/definitions/ynu" },
  'selfConcept':          { $ref: "#/definitions/coding" },
}

const mseLickPrompts = {
  'alertness':            "Alertness",
  'cognitiveIssues':      "Cognitive issues",
  'memoryIssues':         "Memory issues",
  'memoryIssueDuration':  "Memory issue duration",  // Note: text
  'awarenessOfIllness':   "Awareness of illness",
  'selfConcept':          "Self-Concept",
}
