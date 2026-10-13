// VerbalFluency — letter fluency: the subject names words beginning with
// `letter` in a minute. The examiner types each word and marks it valid (Y)
// or not (N); a word that does not start with the letter is marked N as it is
// typed. The valid count passes at `threshold` words. With no words typed the
// count can be entered by hand (scored on paper).
//
// Answers under dataPath (MoCA: formAnswers.language.langword):
//   [entriesKey] [{ text, isValid }] — isValid "Y", "N" or null; one empty
//                entry at the end to type into
//   [countKey]   the valid count (null until known)
// `{ letter }` is staged under `contentKey` for the report.
const VerbalFluency = ({
  id,
  fieldId,
  label,
  text = "Fluency: Name maximum number of words in one minute that begin with the letter {letter}.",
  dataPath,
  letter = "F",
  threshold = 11,
  entriesKey = "entries",
  countKey = "validCount",
  completePath,
  contentKey,
}) => {
  const targetLetter = String(letter || "").toUpperCase()
  const blank = () => ({ text: null, isValid: null })
  const { answers, update, locked } = AssessmentKit.useAnswers({
    dataPath,
    defaults: { [entriesKey]: [blank()], [countKey]: null },
    completePath,
    contentKey,
    content: { letter: targetLetter, threshold: Number(threshold) },
  })
  const [open, setOpen] = React.useState(false)
  const textRef = React.useRef(null)
  const entries = Array.isArray(answers?.[entriesKey]) && answers[entriesKey].length ? answers[entriesKey] : [blank()]
  const validCount = answers?.[countKey] ?? null
  const typed = entries.filter((entry) => Boolean(entry?.text) && entry.text !== "")
  const listed = typed.length > 0 && entries.length > 1
  const passes = Number(validCount) >= Number(threshold)

  React.useLayoutEffect(() => {
    if (open) textRef.current?.focus()
  })

  // Recount from the typed words, as the source did on every change.
  const recount = (current) => {
    const list = current[entriesKey]
    if (list.filter((entry) => Boolean(entry.text)).length > 0) {
      current[countKey] = list.filter((entry) => entry.isValid === "Y").length
    }
  }
  const withEntries = (recipe) => update((current) => {
    if (!Array.isArray(current[entriesKey]) || current[entriesKey].length === 0) current[entriesKey] = [blank()]
    recipe(current[entriesKey], current)
    recount(current)
  })
  const setText = (index, value) => withEntries((list) => {
    const entry = list[index]
    if (!entry) return
    entry.text = value
    if (!value || value.length === 0) {
      entry.isValid = null
      entry.text = null
    } else if (value.charAt(0).toUpperCase() !== targetLetter) {
      entry.isValid = "N"
    }
  })
  const setValidity = (index, key) => withEntries((list) => {
    if (list[index]) list[index].isValid = key
  })
  const addEntry = () => withEntries((list) => { list.push(blank()) })
  const removeEntry = (index) => withEntries((list) => {
    list.splice(index, 1)
    if (list.length === 0) list.push(blank())
  })
  const setManualCount = (raw) => update((current) => {
    const digits = Number(String(raw ?? "").replace(/_/g, ""))
    current[countKey] = digits > 0 ? digits : null
    if (Array.isArray(current[entriesKey])) recount(current)
  })

  const caption = String(text).replace("{letter}", targetLetter)
  return (
    <div id={id || fieldId} data-assessment-item="verbal-fluency">
      <AssessmentKit.SectionRow points={`${passes ? 1 : 0}/1`} border={{ borderLeft: "1px solid black", borderRight: "1px solid black" }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", flexGrow: 1, justifyContent: "space-between", padding: "3px", flexWrap: "wrap" }}>
          <div style={{ fontWeight: "bold", display: "inline-flex", flexDirection: "row", fontSize: "0.95em", alignItems: "center" }}>
            <span>{caption}</span>
            <Fluent.IconButton
              iconProps={{ iconName: "Edit" }}
              styles={{ root: { backgroundColor: listed ? "rgb(222 245 222)" : "inherit" }, icon: { color: listed ? "black" : "rgb(0, 120, 212)" } }}
              onClick={() => setOpen(true)}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            [<AssessmentKit.CheckButton checked={passes} readOnly />]&nbsp;
            <Fluent.MaskedTextField
              borderless
              mask="999"
              readOnly={locked || listed}
              value={validCount == null ? "" : String(validCount)}
              styles={{ root: { width: "45px" } }}
              onChange={(event, value) => setManualCount(value)}
            />
            {` (N ≥ ${threshold} words)`}
          </div>
        </div>
      </AssessmentKit.SectionRow>
      <SubForm hidden={!open} onCancel={() => setOpen(false)} minWidth="600px">
        <div data-assessment-dialog="verbal-fluency" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", fontWeight: "bold", paddingBottom: "5px" }}>
            <span>{`Words beginning with ${targetLetter}`}</span>
            <span style={{ width: "10%", display: "flex", justifyContent: "space-between" }}><span>Y</span><span>N</span></span>
          </div>
          {entries.map((entry, index) => {
            const last = index === entries.length - 1
            return (
              <div key={index} style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", paddingBottom: "5px" }}>
                <div style={{ flexGrow: 1, paddingRight: "20px", display: "inline-flex", alignItems: "center" }}>
                  {locked && last && index === 0 && !entry.text ? (
                    <span>No answers given or answers recorded and scored on paper</span>
                  ) : locked && last ? null : (
                    <>
                      {!locked && (!last || entry.text) ? <Fluent.IconButton iconProps={{ iconName: "Cancel" }} onClick={() => removeEntry(index)} /> : null}
                      <span style={{ paddingLeft: !last || entry.text ? "0px" : "32px" }}>{`${index + 1}. `}</span>
                      <Fluent.TextField
                        readOnly={locked}
                        value={entry.text ?? ""}
                        componentRef={last ? textRef : undefined}
                        placeholder={last ? "Enter word here" : undefined}
                        onChange={(event, value) => setText(index, value ?? "")}
                        onKeyDown={(event) => { if (last && event.key === "Enter" && event.target.value.length > 0) addEntry() }}
                        styles={{ root: { flexGrow: 1, paddingLeft: "10px" } }}
                      />
                    </>
                  )}
                </div>
                {entry.text?.length > 0 ? (
                  <Fluent.ChoiceGroup
                    disabled={locked}
                    options={[{ key: "Y" }, { key: "N" }]}
                    selectedKey={entry.isValid ?? null}
                    onChange={(event, option) => setValidity(index, option.key)}
                    styles={{ flexContainer: { display: "flex", flexDirection: "row", justifyContent: "space-between" }, root: { width: "10%" } }}
                  />
                ) : <div style={{ width: "10%" }} />}
              </div>
            )
          })}
          <Fluent.DefaultButton text="Ok" onClick={() => setOpen(false)} styles={{ root: { width: "65px" } }} />
        </div>
      </SubForm>
    </div>
  )
}
