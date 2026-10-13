// LetterTapping — the vigilance item: a row of letters read out, the subject
// taps at each target letter; the examiner marks the taps, then Complete
// scores it (no more than `maxErrors` errors passes) and the row locks.
//
// Answers under dataPath (MoCA: formAnswers.attention):
//   [lettersKey]  [{ letter, checked, required }] — required = letter is the target
//   [completeKey] true once Complete is pressed (cannot be undone)
//   [passedKey]   true when the errors (a tap off target, or a target missed)
//                 are at most maxErrors; computed while complete
// `completeOnSubmit` sets completeKey as the form is submitted, as the MoCA
// did in its getSaveData (a staged submit patch; component-submit-writes.ts).
const LetterTapping = ({
  id,
  fieldId,
  label,
  title,
  instructions = "Read list of letters. The subject must tap at each letter A. No points if ≥ 2 errors.",
  dataPath,
  letters = "",
  target = "A",
  maxErrors = 1,
  lettersKey = "letters",
  completeKey = "complete",
  passedKey = "passed",
  completeOnSubmit = false,
  points = 1,
  completePath,
  contentKey,
}) => {
  const sequence = String(letters || "").replace(/\s+/g, "").split("")
  const targetLetter = String(target || "").toUpperCase()
  const letterDefaults = sequence.map((letter) => ({ letter, checked: false, required: letter.toUpperCase() === targetLetter }))
  const { answers, update, locked, setFormData } = AssessmentKit.useAnswers({
    dataPath,
    defaults: { [passedKey]: false, [completeKey]: false, [lettersKey]: letterDefaults },
    completePath,
    contentKey,
    content: { letters: sequence.join(""), target: targetLetter },
  })
  const stored = Array.isArray(answers?.[lettersKey]) ? answers[lettersKey] : letterDefaults
  const complete = answers?.[completeKey] === true
  const passed = answers?.[passedKey] === true
  const componentId = fieldId || id || "LetterTapping"

  const passes = (list) => list.filter((entry) => entry.checked != entry.required).length <= Number(maxErrors)

  const toggle = (index) => {
    if (complete) return
    update((current) => {
      const list = Array.isArray(current[lettersKey]) ? current[lettersKey] : (current[lettersKey] = AssessmentKit.clone(letterDefaults))
      if (list[index]) list[index].checked = !list[index].checked
      if (current[completeKey] === true) current[passedKey] = passes(list)
    })
  }
  const finish = () => update((current) => {
    current[completeKey] = true
    const list = Array.isArray(current[lettersKey]) ? current[lettersKey] : []
    current[passedKey] = passes(list)
  })

  const patchJson = JSON.stringify(completeOnSubmit && dataPath ? [{ path: `${dataPath}.${completeKey}`, value: true }] : null)
  React.useEffect(() => {
    AssessmentKit.stagePayload(setFormData, "submitPatchesByComponent", componentId, JSON.parse(patchJson))
  }, [componentId, patchJson])

  const header = title !== undefined ? title : label
  return (
    <div id={id || fieldId} data-assessment-item="letter-tapping">
      <AssessmentKit.SectionRow title={header} points={points === false ? null : `${passed ? points : 0}/${points}`} border={{ border: "1px solid black" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", padding: "3px" }}>
          <span>
            {instructions}
            <br />
            <br />
            {complete
              ? <i>Results: Subject tapped at bordered letters. Errant or missed taps highlighted in red, proper in green</i>
              : <i>Click each letter subject taps at. Click complete when done <strong>(cannot be undone)</strong></i>}
          </span>
          <span style={{ textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            [<AssessmentKit.CheckButton checked={passed} readOnly />]
            <span style={{ paddingLeft: "10px", fontWeight: "bold", display: "inline-flex", flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
              <table style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    {stored.map((entry, index) => {
                      const feedback = complete && (entry.checked || entry.required)
                      const background = feedback ? (entry.checked != entry.required ? "lightpink" : "rgb(222 245 222)") : "inherit"
                      return (
                        <td key={`${entry.letter}-${index}`} style={{ borderCollapse: "collapse", border: entry.checked ? "1px solid black" : "none", padding: entry.checked ? "0px" : "1px" }}>
                          <Fluent.DefaultButton
                            text={entry.letter}
                            disabled={locked || complete}
                            onClick={() => toggle(index)}
                            styles={{
                              root: { border: "none", minWidth: 20, width: 20, height: 26, padding: 0, borderRadius: 0, backgroundColor: background, color: "#111827" },
                              rootDisabled: { border: "none", minWidth: 20, width: 20, height: 26, padding: 0, borderRadius: 0, backgroundColor: background, color: "#111827" },
                              label: { margin: 0 },
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
              {!complete && !locked ? <Fluent.DefaultButton text="Complete" onClick={finish} /> : null}
            </span>
          </span>
        </div>
      </AssessmentKit.SectionRow>
    </div>
  )
}
