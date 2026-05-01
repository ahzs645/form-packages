const MOCA_BLIND_VERSIONS = {
  "8.1": {
    words: ["FACE", "VELVET", "CHURCH", "DAISY", "RED"],
    forward: "2 1 8 5 4",
    reverse: "7 4 2",
    subtractFrom: 100,
    phrase1: "I only know that John is the one to help today.",
    phrase2: "The cat always hid under the couch when dogs were in the room.",
    targetLetter: "F",
    abstraction1: "train - bicycle",
    abstraction2: "watch - ruler",
  },
  "8.2": {
    words: ["HAND", "NYLON", "PARK", "CARROT", "YELLOW"],
    forward: "8 1 5 2 4",
    reverse: "2 4 7",
    subtractFrom: 70,
    phrase1: "The robber of the gray car was stopped by the police.",
    phrase2: "The student went back to school without his books and pencils.",
    targetLetter: "S",
    abstraction1: "bed - table",
    abstraction2: "letter - telephone",
  },
  "8.3": {
    words: ["LEG", "COTTON", "SCHOOL", "TOMATO", "WHITE"],
    forward: "2 4 8 1 5",
    reverse: "4 2 7",
    subtractFrom: 60,
    phrase1: "The child walked his dog in the park after midnight.",
    phrase2: "The artist finished his painting at the right moment for the exhibition.",
    targetLetter: "B",
    abstraction1: "hammer - screwdriver",
    abstraction2: "matches - lamp",
  },
}

const mocaNumber = (value, fallback = 0) => {
  const number = Number(value?.value ?? value)
  return Number.isFinite(number) ? number : fallback
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, mocaNumber(value, min)))

const MoCABlindAssessment = ({ id = "mocaBlindAssessment" }) => {
  const [fd, setFormData] = useActiveData()
  const data = fd?.field?.data || {}
  const version = data.formVersion?.code ?? data.formVersion?.key ?? data.formVersion?.text ?? data.formVersion ?? "8.1"
  const prompts = MOCA_BLIND_VERSIONS[version] || MOCA_BLIND_VERSIONS["8.1"]
  const values = {
    attentionScore: clamp(data.attentionScore, 0, 6),
    languageScore: clamp(data.languageScore, 0, 3),
    abstractionScore: clamp(data.abstractionScore, 0, 2),
    delayedRecallScore: clamp(data.delayedRecallScore, 0, 5),
    orientationScore: clamp(data.orientationScore, 0, 6),
    educationAdjustment: clamp(data.educationAdjustment, 0, 1),
    memoryIndex: clamp(data.memoryIndex, 0, 15),
  }
  const pointsTotal = values.attentionScore + values.languageScore + values.abstractionScore + values.delayedRecallScore + values.orientationScore + values.educationAdjustment
  const convertedTotal = Math.round((pointsTotal / 22) * 30)

  const setField = (fieldId, value) => {
    if (typeof setFormData !== "function") return
    setFormData((draft) => {
      draft.field = draft.field || { data: {}, status: {} }
      draft.field.data = {
        ...(draft.field.data || {}),
        [fieldId]: value,
        pointsTotal: fieldId === "pointsTotal" ? value : pointsTotal,
        convertedTotal,
      }
      draft.formData = {
        ...(draft.formData || {}),
        [fieldId]: value,
        pointsTotal: fieldId === "pointsTotal" ? value : pointsTotal,
        convertedTotal,
      }
    })
  }

  const scoreInput = (fieldId, label, max) => (
    <SpinButton
      label={label}
      value={String(values[fieldId])}
      min={0}
      max={max}
      step={1}
      onValidate={(value) => setField(fieldId, clamp(value, 0, max))}
      onIncrement={(value) => setField(fieldId, clamp(mocaNumber(value) + 1, 0, max))}
      onDecrement={(value) => setField(fieldId, clamp(mocaNumber(value) - 1, 0, max))}
      styles={{ root: { maxWidth: 320, margin: "8px 0" } }}
    />
  )

  return (
    <div id={id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SimpleCodeSelect
        fieldId="formVersion"
        id="formVersion"
        label="MoCA version"
        selectionType="single"
        optionList={[
          { key: "8.1", text: "8.1" },
          { key: "8.2", text: "8.2" },
          { key: "8.3", text: "8.3" },
        ]}
      />

      <div style={{ border: "1px solid #8a8886", padding: 10 }}>
        <h3 style={{ marginTop: 0 }}>Memory</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {prompts.words.map((word, index) => (
            <span key={word} style={{ border: "1px solid #605e5c", padding: "4px 8px", fontWeight: 600 }}>{index + 1}. {word}</span>
          ))}
        </div>
        <SimpleCodeChecklist
          fieldId="memoryWordsTrial1"
          id="memoryWordsTrial1"
          label="First trial words recalled"
          selectionType="multiple"
          optionList={prompts.words.map((word) => ({ key: word, text: word }))}
        />
        <SimpleCodeChecklist
          fieldId="memoryWordsTrial2"
          id="memoryWordsTrial2"
          label="Second trial words recalled"
          selectionType="multiple"
          optionList={prompts.words.map((word) => ({ key: word, text: word }))}
        />
      </div>

      <div style={{ border: "1px solid #8a8886", padding: 10 }}>
        <h3 style={{ marginTop: 0 }}>Attention</h3>
        <p>Forward digits: <b>{prompts.forward}</b></p>
        <p>Reverse digits: <b>{prompts.reverse}</b></p>
        <p>Serial 7 subtraction starting at <b>{prompts.subtractFrom}</b></p>
        <p>Tap for target letter: <b>{prompts.targetLetter}</b></p>
        {scoreInput("attentionScore", "Attention score", 6)}
      </div>

      <div style={{ border: "1px solid #8a8886", padding: 10 }}>
        <h3 style={{ marginTop: 0 }}>Language</h3>
        <p>{prompts.phrase1}</p>
        <p>{prompts.phrase2}</p>
        <TextArea fieldId="languageWords" id="languageWords" label={`Words beginning with ${prompts.targetLetter}`} multiline rows={3} />
        {scoreInput("languageScore", "Language score", 3)}
      </div>

      <div style={{ border: "1px solid #8a8886", padding: 10 }}>
        <h3 style={{ marginTop: 0 }}>Abstraction</h3>
        <p>{prompts.abstraction1}</p>
        <p>{prompts.abstraction2}</p>
        {scoreInput("abstractionScore", "Abstraction score", 2)}
      </div>

      <div style={{ border: "1px solid #8a8886", padding: 10 }}>
        <h3 style={{ marginTop: 0 }}>Delayed Recall and Orientation</h3>
        {scoreInput("delayedRecallScore", "Delayed recall score", 5)}
        {scoreInput("orientationScore", "Orientation score", 6)}
        {scoreInput("educationAdjustment", "Education adjustment", 1)}
        {scoreInput("memoryIndex", "Memory Index Score", 15)}
      </div>

      <div style={{ border: "2px solid #323130", padding: 10, fontWeight: 600 }}>
        <div>Total score out of 22: {pointsTotal}</div>
        <div>Converted score out of 30: {convertedTotal}</div>
      </div>
    </div>
  )
}
