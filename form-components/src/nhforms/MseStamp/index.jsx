
const MseSpeech = () => (<>

        <SimpleCodeChecklist
          fieldId='speechRate'
          label='Rate'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-SPEECHRATE"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Hesitant", text: "Hesitant" },
            { key: "Long pauses before answering questions", text: "Long pauses before answering questions" },
            { key: "Pressured", text: "Pressured" },
            { key: "Rapid", text: "Rapid" },
            { key: "Slowed", text: "Slowed" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='speechRhythm'
          label='Rhythm'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-SPEECHRHYTHM"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Monotonous", text: "Monotonous" },
            { key: "Stuttering", text: "Stuttering" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='speechVolume'
          label='Volume'
          codeSystem="MSE-SPEECHVOLUME"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Loud", text: "Loud" },
            { key: "Soft", text: "Soft" },
            { key: "Whispered", text: "Whispered" },
          ]}
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='speechSpontaneity'
          label='Spontaneity'
        />
        <SimpleCodeChecklist
          fieldId='speechAmount'
          label='Amount'
          codeSystem="MSE-SPEECHAMOUNT"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Hyper-talkative", text: "Hyper-talkative" },
            { key: "Monosyllabic", text: "Monosyllabic" },
            { key: "Mute", text: "Mute" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='articulation'
          label='Articulation'
          codeSystem="MSE-ARTICULATION"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Clear", text: "Clear" },
            { key: "Mumbled", text: "Mumbled" },
            { key: "Slurred", text: "Slurred" },
          ]}
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='abilityToStop'
          label='Ability to stop when asked'
        />

</>)

const MseThought = () => (<>

        <SimpleCodeChecklist
          fieldId='delusions'
          label='Delusions'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-DELUSIONS"
          optionList={[
            { key: "None", text: "None" },
            { key: "Delusions of grandeur", text: "Delusions of grandeur" },
            { key: "Delusions of persecution", text: "Delusions of persecution" },
            { key: "Delusions of reference", text: "Delusions of reference" },
            { key: "Paranoia/suspiciousness", text: "Paranoia/suspiciousness" },
            { key: "Special abilities", text: "Special abilities" },
            { key: "Unusual thought content", text: "Unusual thought content" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='obsessions'
          label='Obsessions'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-OBSESSIONS"
          optionList={[
            { key: "None", text: "None" },
            { key: "Persistent", text: "Persistent" },
            { key: "Recurring thought", text: "Recurring thought" },
            { key: "Unwanted", text: "Unwanted" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='phobias'
          label='Phobias'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-PHOBIAS"
          optionList={[
            { key: "None", text: "None" },
            { key: "Fear of object/situation", text: "Fear of object/situation" },
            { key: "Persistent", text: "Persistent" },
            { key: "Strong", text: "Strong" },
          ]}
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='logic'
          label='Logic'
          codeSystem="MSE-LOGIC"
          optionList={[
            { key: "Y", text: "Logical" },
            { key: "N", text: "Illogical" },
            { key: "U", text: "Unknown" },
          ]}
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='coherence'
          label='Coherence'
          codeSystem="MSE-LOGIC"
          optionList={[
            { key: "Y", text: "Coherent" },
            { key: "N", text: "Incoherent" },
            { key: "U", text: "Unknown" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='thoughtStream'
          label='Stream'
          codeSystem="MSE-THOUGHTSTREAM"
          optionList={[
            { key: "Goal-directed", text: "Goal-directed" },
            { key: "Circumstantial", text: "Circumstantial" },
            { key: "Flight of ideas", text: "Flight of ideas" },
            { key: "Loose associations", text: "Loose associations" },
            { key: "Rambling", text: "Rambling" },
            { key: "Tangential", text: "Tangential" },
            { key: "World salad", text: "World salad" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='perseveration'
          label='Perseveration'
          codeSystem="MSE-PERSERVATION"
          optionList={[
            { key: "None observed", text: "None observed" },
            { key: "Pathological repetition of sentence", text: "Pathological repetition of sentence" },
            { key: "Pathological repetition of word", text: "Pathological repetition of word" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='depressiveCognition'
          label='Depressive cognition'
          size="large"
          selectionType="multiple"
          showOtherOption
          codeSystem="MSE-DEPRESSIVECOGNITION"
          optionList={[
            { key: "None", text: "None" },
            { key: "Guilt", text: "Guilt" },
            { key: "Hopelessness", text: "Hopelessness" },
            { key: "Worthlessness", text: "Worthlessness" },
          ]}
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='magicalIdeation'
          label='Magical ideation'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='unwelcomeThoughts'
          label='Intrusive/Unwelcome Thoughts'
        />
       <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='overvaluedIdeas'
          label='Overvalued ideas'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='blocking'
          label='Blocking'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='neologism'
          label='Neologism'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='ruminations'
          label='Ruminations'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='fixation'
          label='Fixation'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='thoughtBroadcasting'
          label='Thought broadcasting'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='thoughtInsertion'
          label='Thought insertion'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='ideasOfReference'
          label='Ideas of reference'
        />
</>)

const MseAffect = () => (<>

        <SimpleCodeChecklist
          fieldId='affect'
          label='Affect'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-AFFECT"
          optionList={[
            { key: "Agitated", text: "Agitated" },
            { key: "Alert", text: "Alert" },
            { key: "Angry", text: "Angry" },
            { key: "Animated", text: "Animated" },
            { key: "Anxious/anxiety", text: "Anxious/anxiety" },
            { key: "Apathetic", text: "Apathetic" },
            { key: "Appears depressed", text: "Appears depressed" },
            { key: "Avoidant", text: "Avoidant" },
            { key: "Bored", text: "Bored" },
            { key: "Bright", text: "Bright" },
            { key: "Calm", text: "Calm" },
            { key: "Depressed", text: "Depressed" },
            { key: "Elated", text: "Elated" },
            { key: "Euphoric", text: "Euphoric" },
            { key: "Euthymic", text: "Euthymic" },
            { key: "Excitable", text: "Excitable" },
            { key: "Excited", text: "Excited" },
            { key: "Expresses loneliness", text: "Expresses loneliness" },
            { key: "Fearful", text: "Fearful" },
            { key: "Flat", text: "Flat" },
            { key: "Frightened", text: "Frightened" },
            { key: "Guilty", text: "Guilty" },
            { key: "Happy", text: "Happy" },
            { key: "Hostile", text: "Hostile" },
            { key: "Hyperactive", text: "Hyperactive" },
            { key: "Inappropriate", text: "Inappropriate" },
            { key: "Irritable", text: "Irritable" },
            { key: "Labile", text: "Labile" },
            { key: "Needy", text: "Needy" },
            { key: "Nervous", text: "Nervous" },
            { key: "Neutral", text: "Neutral" },
            { key: "Pleasant", text: "Pleasant" },
            { key: "Relaxed", text: "Relaxed" },
            { key: "Restless", text: "Restless" },
            { key: "Sad", text: "Sad" },
            { key: "Sad/unhappy", text: "Sad/unhappy" },
            { key: "Shallow", text: "Shallow" },
            { key: "Stressed", text: "Stressed" },
            { key: "Tense", text: "Tense" },
            { key: "Worrying", text: "Worrying" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='appropriateness'
          label='Appropriateness'
          codeSystem="MSE-APPROPRIATENESS"
          optionList={[
            {
              key: "Appropriate to situation and mood",
              text: "Appropriate to situation and mood",
            },
            {
              key: "Inappropriate to situation and mood",
              text: "Inappropriate to situation and mood",
            },
            {
              key: "Congruent with thought content",
              text: "Congruent with thought content",
            },
            {
              key: "Incongruent with thought content",
              text: "Incongruent with thought content",
            },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='affectRange'
          label='Range'
          codeSystem="MSE-AFFECTRANGE"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Full", text: "Full" },
            { key: "Restricted", text: "Restricted" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='affectStability'
          label='Stability'
          codeSystem="MSE-AFFECTSTABILITY"
          optionList={[
            { key: "Even", text: "Even" },
            { key: "Fixed", text: "Fixed" },
            { key: "Labile", text: "Labile" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='affectIntensity'
          label='Intensity'
          codeSystem="MSE-AFFECTINTENSITY"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Blunted", text: "Blunted" },
            { key: "Exaggerated", text: "Exaggerated" },
            { key: "Flat", text: "Flat" },
          ]}
        />
        <SubTitle text="Mood" />
        <SimpleCodeChecklist
          fieldId='mood'
          label='Mood'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-MOOD"
          optionList={[
            { key: "Appropriate", text: "Appropriate" },
            { key: "Lack of control over emotions and mood", text: "Lack of control over emotions and mood" },
            { key: "Matches non-verbal", text: "Matches non-verbal" },
            { key: "Depressed", text: "Depressed" },
            { key: "Anxious", text: "Anxious" },
            { key: "Irritable", text: "Irritable" },
            { key: "Angry", text: "Angry" },
            { key: "Elated", text: "Elated" },
          ]}
        />
        <SimpleCodeChecklist
          fieldId='moodRating'
          label='Mood rated'
          size="max"
          optionSize="min"
          codeSystem="MSE-MOODRATING"
          optionList={[
            { code: "1", display: "1", hotKey: "1", order: 1 },
            { code: "2", display: "2", hotKey: "2", order: 2 },
            { code: "3", display: "3", hotKey: "3", order: 3 },
            { code: "4", display: "4", hotKey: "4", order: 4 },
            { code: "5", display: "5", hotKey: "5", order: 5 },
            { code: "6", display: "6", hotKey: "6", order: 6 },
            { code: "7", display: "7", hotKey: "7", order: 7 },
            { code: "8", display: "8", hotKey: "8", order: 8 },
            { code: "9", display: "9", hotKey: "9", order: 9 },
            { code: "10", display: "10", hotKey: "0", order: 10 },
          ]}
        />
</>)

const MsePerception = () => (<>
        <SimpleCodeChecklist
          fieldId='hallucinations'
          label='Hallucinations'
          selectionType="multiple"
          showOtherOption
          size="large"
          codeSystem="MSE-HALLUCINATIONS"
          optionList={[
            { key: "None", text: "None" },
            { key: "Auditory", text: "Auditory" },
            { key: "Gustatory (taste)", text: "Gustatory (taste)" },
            { key: "Olfactory (smelling)", text: "Olfactory (smelling)" },
            { key: "Tactile", text: "Tactile" },
            { key: "Visual", text: "Visual" },
          ]}
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='illusions'
          label='Illusions'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='depersonalization'
          label='Depersonalization'
        />
        <SimpleCodeChecklist
          codeSystem="AIHS-YESNOUNKNOWN"
          autoHotKey
          optionSize="small"
          fieldId='dejavu'
          label='Déjà vu/Jamais vu'
        />
</>)


const MseStamp = () => (<>

  <SubTitle text="Speech" />
  <MseSpeech />

  <SubTitle text="Thought Form, Content and Process" />
  <MseThought />

  <SubTitle text="Affect" />
  <MseAffect />

  <SubTitle text="Perception" />
  <MsePerception />

</>)

const MseStampSchema = {
  'speechRate':             { $ref: "#/definitions/codings" },
  'speechRhythm':           { $ref: "#/definitions/codings" },
  'speechVolume':           { $ref: "#/definitions/coding" },
  'speechSpontaneity':      { $ref: "#/definitions/ynu" },
  'speechAmount':           { $ref: "#/definitions/coding" },
  'articulation':           { $ref: "#/definitions/coding" },
  'abilityToStop':          { $ref: "#/definitions/ynu" },
  'delusions':              { $ref: "#/definitions/codings" },
  'obsessions':             { $ref: "#/definitions/codings" },
  'phobias':                { $ref: "#/definitions/codings" },
  'logic':                  { $ref: "#/definitions/coding" },
  'coherence':              { $ref: "#/definitions/coding" },
  'thoughtStream':          { $ref: "#/definitions/coding" },
  'perseveration':          { $ref: "#/definitions/coding" },
  'depressiveCognition':    { $ref: "#/definitions/codings" },
  'magicalIdeation':        { $ref: "#/definitions/ynu" },
  'unwelcomeThoughts':      { $ref: "#/definitions/ynu" },
  'overvaluedIdeas':        { $ref: "#/definitions/ynu" },
  'blocking':               { $ref: "#/definitions/ynu" },
  'neologism':              { $ref: "#/definitions/ynu" },
  'ruminations':            { $ref: "#/definitions/ynu" },
  'fixation':               { $ref: "#/definitions/ynu" },
  'thoughtBroadcasting':    { $ref: "#/definitions/ynu" },
  'thoughtInsertion':       { $ref: "#/definitions/ynu" },
  'ideasOfReference':       { $ref: "#/definitions/ynu" },
  'affect':                 { $ref: "#/definitions/codings" },
  'affectAppropriateness':  { $ref: "#/definitions/coding" },
  'affectRange':            { $ref: "#/definitions/coding" },
  'affectStability':        { $ref: "#/definitions/coding" },
  'affectIntensity':        { $ref: "#/definitions/coding" },
  'mood':                   { $ref: "#/definitions/codings" },
  'moodRated':              { $ref: "#/definitions/coding" },
  'hallucinations':         { $ref: "#/definitions/codings" },
  'illusions':              { $ref: "#/definitions/ynu" },
  'depersonalization':      { $ref: "#/definitions/ynu" },
  'dejavu':                 { $ref: "#/definitions/ynu" },
}

const mseStampSectionPrompts = {
  'Speech':                 "Speech",
  'Thought':                "Thought Form, Content and Process",
  'Affect':                 "Affect",
  'Mood':                   "Mood",
  'Perception':             "Perception",
}

const mseStampSpeechPrompts = {
  'speechRate':             "Rate",
  'speechRhythm':           "Rhythm",
  'speechVolume':           "Volume",
  'speechSpontaneity':      "Spontaneity",
  'speechAmount':           "Amount",
  'articulation':           "Articulation",
  'abilityToStop':          "Ability to stop",
}

const mseStampThoughtPrompts = {
  'delusions':              "Delusions",
  'obsessions':             "Obsessions",
  'phobias':                "Phobias",
  'logic':                  "Logic",
  'coherence':              "Coherence",
  'thoughtStream':          "Thought stream",
  'perseveration':          "Perseveration",
  'depressiveCognition':    "Depressive cognition",
  'magicalIdeation':        "Magical ideation",
  'unwelcomeThoughts':      "Unwelcome thoughts",
  'overvaluedIdeas':        "Overvalued ideas",
  'blocking':               "Blocking",
  'neologism':              "Neologism",
  'ruminations':            "Ruminations",
  'fixation':               "Fixation",
  'thoughtBroadcasting':    "Thought broadcasting",
  'thoughtInsertion':       "Thought insertion",
  'ideasOfReference':       "Ideas of reference",
}

const mseStampAffectPrompts = {
  'affect':                 "Affect",
  'affectAppropriateness':  "Appropriateness",
  'affectRange':            "Range",
  'affectStability':        "Stability",
  'affectIntensity':        "Intensity",
}

const mseStampMoodPrompts = {
  'mood':                   "Mood",
  'moodRated':              "Mood rated",
}

const mseStampPerceptionPrompts = {
  'hallucinations':         "Hallucinations",
  'illusions':              "Illusions",
  'depersonalization':      "Depersonalization",
  'dejavu':                 "Déjà vu/Jamais vu",
}
