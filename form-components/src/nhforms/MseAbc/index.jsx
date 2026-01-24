
const MseAbc = () => (<>

  <SimpleCodeChecklist
    fieldId='dress'
    label='Dress'
    selectionType="multiple"
    showOtherOption
    size="large"
    codeSystem="MSE-DRESS"
    optionList={[
      { key: "Cleanliness appropriate", text: "Cleanliness appropriate" },
      { key: "Neat", text: "Neat" },
      { key: "Garments appropriate", text: "Garments appropriate" },
      { key: "Condition of clothing - Good", text: "Condition of clothing - Good" },
      { key: "Condition of clothing - Poor", text: "Condition of clothing - Poor" },
    ]}
  />
  <SimpleCodeChecklist
    fieldId='grooming'
    label='Grooming'
    selectionType="multiple"
    showOtherOption
    size="large"
    codeSystem="MSE-GROOMING"
    optionList={[
      { key: "Clean", text: "Clean" },
      { key: "Neat", text: "Neat" },
      { key: "Dirty", text: "Dirty" },
      { key: "Overly meticulous", text: "Overly meticulous" },
      { key: "Disheveled", text: "Disheveled" },
      { key: "Unkempt", text: "Unkempt" },
      { key: "Hair styled", text: "Hair styled" },
      { key: "Unshaven", text: "Unshaven" },
      { key: "Make-up", text: "Make-up" },
      { key: "Malodorous", text: "Malodorous" },
    ]}
  />
  <SimpleCodeChecklist
    codeSystem="AIHS-YESNO"
    autoHotKey
    optionSize="small"
    fieldId="ableToFocus"
    label="Able to focus on questions"
  />
  <SimpleCodeChecklist
    fieldId='manners'
    label='Manners'
    selectionType="multiple"
    showOtherOption
    size="large"
    codeSystem="MSE-MANNERS"
    optionList={[
      { key: "Pleasant", text: "Pleasant" },
      { key: "Cooperative", text: "Cooperative" },
      { key: "Guarded", text: "Guarded" },
      { key: "Friendly", text: "Friendly" },
      { key: "Suspicious", text: "Suspicious" },
      { key: "Glib", text: "Glib" },
      { key: "Angry", text: "Angry" },
      { key: "Seductive", text: "Seductive" },
      { key: "Evasive", text: "Evasive" },
      { key: "Hostile", text: "Hostile" },
    ]}
  />
  <SimpleCodeChecklist
    fieldId='attentiveness'
    label='Attentiveness to Examiner'
    selectionType="multiple"
    showOtherOption
    size="large"
    codeSystem="MSE-ATTENTIVENESS"
    optionList={[
      { key: "Apathetic", text: "Apathetic" },
      { key: "Attentive", text: "Attentive" },
      { key: "Bored", text: "Bored" },
      { key: "Disinterested", text: "Disinterested" },
      { key: "Distractible", text: "Distractible" },
      { key: "Drowsy", text: "Drowsy" },
      { key: "Internally preoccupied", text: "Internally preoccupied" },
      { key: "Withdrawn", text: "Withdrawn" },
    ]}
  />
  <SimpleCodeChecklist
    fieldId='position'
    label='Position during assessment'
    selectionType="multiple"
    showOtherOption
    size="large"
    codeSystem="MSE-POSITION"
    optionList={[
      { key: "Appropriate to context", text: "Appropriate to context" },
      { key: "Lying", text: "Lying" },
      { key: "Sitting", text: "Sitting" },
      { key: "Standing", text: "Standing" },
      { key: "Kneeling", text: "Kneeling" },
      { key: "Restlessness", text: "Restlessness" },
      { key: "Tense", text: "Tense" },
      { key: "Bizarre/Unusual position", text: "Bizarre/Unusual position" },
      { key: "Constantly changing", text: "Constantly changing" },
    ]}
  />
  <SimpleCodeChecklist
    fieldId='cooperation'
    label='Cooperation'
    codeSystem="MSE-COOPERATION"
    optionList={[
      { key: "Cooperative", text: "Cooperative" },
      { key: "Uncooperative", text: "Uncooperative" },
      { key: "Friendly", text: "Friendly" },
      { key: "Hostile", text: "Hostile" },
      { key: "Defensive", text: "Defensive" },
      { key: "Antagonistic", text: "Antagonistic" },
      { key: "Sullen", text: "Sullen" },
      { key: "Withdrawn", text: "Withdrawn" },
      { key: "Seductive", text: "Seductive" },
      { key: "Evasive", text: "Evasive" },
    ]}
  />
  <SimpleCodeChecklist
    fieldId='eyeContact'
    label='Eye Contact'
    showOtherOption
    codeSystem="MSE-EYECONTACT"
    optionList={[
      { key: "Appropriate", text: "Appropriate" },
      { key: "Avoids eye contact", text: "Avoids eye contact" },
      { key: "Stares", text: "Stares" },
      { key: "Eyes closed", text: "Eyes closed" },
    ]}
  />
  <SimpleCodeChecklist
    fieldId='catatonia'
    label='Catatonia'
    showOtherOption
    size="large"
    codeSystem="MSE-CATATONIA"
    optionList={[
      { key: "None", text: "None" },
      { key: "Excitement", text: "Excitement" },
      { key: "Stupor", text: "Stupor" },
    ]}
  />
  <SimpleCodeChecklist
    fieldId='unusualMovements'
    label='Unusual movements'
    selectionType="multiple"
    showOtherOption
    size="large"
    codeSystem="MSE-UNUSUALMOVEMENTS"
    optionList={[
      { key: "None", text: "None" },
      { key: "Grimaces", text: "Grimaces" },
      { key: "Lip smacking", text: "Lip smacking" },
      { key: "Mannerisms", text: "Mannerisms" },
      { key: "Tics", text: "Tics" },
      { key: "Tongue thrust", text: "Tongue thrust" },
      { key: "Tremor", text: "Tremor" },
    ]}
  />
  <SimpleCodeChecklist
    fieldId='gait'
    label='Gait'
    selectionType="multiple"
    showOtherOption
    size="large"
    codeSystem="MSE-GAIT"
    optionList={[
      { key: "Normal", text: "Normal" },
      { key: "Broad-based", text: "Broad-based" },
      { key: "Hesitation", text: "Hesitation" },
      { key: "Limping", text: "Limping" },
      { key: "Shuffling", text: "Shuffling" },
      { key: "Stumbling", text: "Stumbling" },
    ]}
  />
  <SimpleCodeChecklist
    fieldId='posture'
    label='Posture'
    showOtherOption
    size="large"
    conditionalCodes={['Agitation']}
    codeSystem="MSE-POSTURE"
    optionList={[
      { key: "Comfortable", text: "Comfortable" },
      { key: "Agitation", text: "Psychomotor agitation" },
      { key: "Retardation", text: "Psychomotor retardation" },
      { key: "Rigid", text: "Rigid" },
      { key: "Slouched", text: "Slouched" },
      { key: "Slumped", text: "Slumped" },
      { key: "Threatening", text: "Threatening" },
    ]}
  >
    <SimpleCodeChecklist
      fieldId='agitation'
      label='Psychomotor agitation'
      selectionType="multiple"
      showOtherOption
      size="large"
      codeSystem="MSE-AGITATION"
      optionList={[
        { key: "Compulsive", text: "Compulsive" },
        { key: "Excessive", text: "Excessive movement" },
        { key: "Pacing", text: "Pacing" },
        { key: "Picking", text: "Picking at skin/clothing" },
        { key: "Rocking", text: "Rocking" },
        { key: "Unable to sit still", text: "Unable to sit still" },
        { key: "Wringing hands", text: "Wringing hands" },
      ]}
    />
  </SimpleCodeChecklist>

</>)

const MseAbcSchema = {
  dress:                    { $ref: "#/definitions/codings" },
  grooming:                 { $ref: "#/definitions/codings" },
  ableToFocus:              { $ref: "#/definitions/ynu" },
  manners:                  { $ref: "#/definitions/codings" },
  attentiveness:            { $ref: "#/definitions/codings" },
  position:                 { $ref: "#/definitions/codings" },
  cooperation:              { $ref: "#/definitions/coding" },
  eyeContact:               { $ref: "#/definitions/coding" },
  catatonia:                { $ref: "#/definitions/coding" },
  unusualMovements:         { $ref: "#/definitions/codings" },
  gait:                     { $ref: "#/definitions/codings" },
  posture:                  { $ref: "#/definitions/coding" },
  agitation:                { $ref: "#/definitions/codings" },
}

const mseAbcPrompts = {
  dress:                    "Dress",
  grooming:                 "Grooming",
  ableToFocus:              "Able to focus on questions",
  manners:                  "Manners",
  attentiveness:            "Attentiveness to Examiner",
  position:                 "Position during assessment",
  cooperation:              "Cooperation",
  eyeContact:               "Eye Contact",
  catatonia:                "Catatonia",
  unusualMovements:         "Unusual Movements",
  gait:                     "Gait",
  posture:                  "Posture",
  agitation:                "Psychomotor agitation",
}

