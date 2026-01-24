
const MseEr = () => (<>
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='suicidalIdeation'
          label='Suicidal ideations'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='safetyPlanAvailable'
          label='Safety plan available'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='suicideAttemptHistory'
          label='Suicide attempts in the past'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='suicideAttempt24hrs'
          label='Suicide attempts or significant intentional self-harm in 24 hours of admission'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='homicidalIdeation'
          label='Homicidal Ideations'
        />
        <SimpleCodeChecklist
          fieldId='selfHarm'
          label='Self-Harm'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-SELFHARM"
          optionList={[
            { key: "None", text: "None" },
            { key: "Burning", text: "Burning" },
            { key: "Cutting", text: "Cutting" },
          ]}
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='congruentInfo'
          label='Subjective and objective information congruent'
        />

        <SubTitle text="Risk Assessments" />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='fallRisk'
          label='Falls risk assessment'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='substanceUseRisk'
          label='Substance use risk assessment'
        />
        <Fluent.Text>
          <i>* Ensure to document in the "Histories" tab under "Social"</i>
        </Fluent.Text>
        
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='suicideRisk'
          label='Suicide risk assessment'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='violentBehaviourRisk'
          label='Violent behaviour risk assessment'
        />
</>)

const MseErSchema = {
  'suicidalIdeation':       { $ref: "#/definitions/ynu" },
  'safetyPlanAvailable':    { $ref: "#/definitions/ynu" },
  'suicideAttemptHistory':  { $ref: "#/definitions/ynu" },
  'suicideAttempt24hrs':    { $ref: "#/definitions/ynu" },
  'homicidalIdeation':      { $ref: "#/definitions/ynu" },
  'selfHarm':               { $ref: "#/definitions/codings" },
  'congruentInfo':          { $ref: "#/definitions/ynu" },
  'fallRisk':               { $ref: "#/definitions/ynu" },
  'substanceUseRisk':       { $ref: "#/definitions/ynu" },
  'suicideRisk':            { $ref: "#/definitions/ynu" },
  'violentBehaviourRisk':   { $ref: "#/definitions/ynu" },
}

const mseErPrompts = {
  'suicidalIdeation':       "Suicidal ideation",
  'safetyPlanAvailable':    "Safety plan available",
  'suicideAttemptHistory':  "Suicide attempts in the past",
  'suicideAttempt24hrs':    "Suicide attempts or significant intentional self-harm in 24 hours of admission",
  'homicidalIdeation':      "Homicidal ideations",
  'selfHarm':               "Self-Harm",
  'congruentInfo':          "Subjective and objective information congruent",
  'fallRisk':               "Falls risk assessment",
  'substanceUseRisk':       "Substance use risk assessment",
  'suicideRisk':            "Suicide risk assessment",
  'violentBehaviourRisk':   "Violent Behaviour risk assessment",
}
