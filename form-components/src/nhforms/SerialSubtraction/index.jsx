// SerialSubtraction — serial subtraction (the MoCA's serial 7s): the subject
// subtracts `step` from `start` `count` times; each answer is scored against
// the previous answer (or the start), and the count of correct answers maps to
// points through `scoreBands`.
//
// Answers under dataPath (MoCA: formAnswers.attention):
//   [valuesKey].[valuePrefix]n   the answer given (number or null), n from 1
//   [correctKey].[correctPrefix]n true when that answer is right
//   [scoreKey]                    points, from the bands
// An answer is scored when it is entered (a later change to an earlier answer
// does not rescore the next one), as the MoCA source did.
// `{ start }` is staged under `contentKey` for the report.
const SerialSubtraction = ({
  id,
  fieldId,
  label,
  title,
  text = "Serial {step} subtraction starting at {start}",
  dataPath,
  start = 100,
  step = 7,
  count = 5,
  valuesKey = "values",
  valuePrefix = "value",
  correctKey = "correct",
  correctPrefix = "correct",
  scoreKey = "score",
  scoreBands = [{ min: 0, score: 0 }, { min: 1, score: 1 }, { min: 2, score: 2 }, { min: 4, score: 3 }],
  bandsText = "4 or 5 correct subtractions: 3 pts|2 or 3 correct: 2 pts|1 correct: 1 pts|0 correct: 0 pts",
  completePath,
  contentKey,
}) => {
  const startValue = Number(start)
  const stepValue = Number(step)
  const indexes = Array.from({ length: Math.max(1, Number(count) || 1) }, (_, index) => index + 1)
  const defaults = {
    [correctKey]: Object.fromEntries(indexes.map((n) => [`${correctPrefix}${n}`, false])),
    [valuesKey]: Object.fromEntries(indexes.map((n) => [`${valuePrefix}${n}`, null])),
    [scoreKey]: 0,
  }
  const { answers, update, locked } = AssessmentKit.useAnswers({ dataPath, defaults, completePath, contentKey, content: { start: startValue, step: stepValue } })
  const [open, setOpen] = React.useState(false)
  const values = answers?.[valuesKey] || {}
  const correct = answers?.[correctKey] || {}
  const valueAt = (n) => values[`${valuePrefix}${n}`] ?? null
  const correctAt = (n) => correct[`${correctPrefix}${n}`] === true
  const bandScore = (hits) => (Array.isArray(scoreBands) ? scoreBands : [])
    .filter((band) => hits >= Number(band.min))
    .reduce((score, band) => Number(band.score), 0)
  const hits = indexes.filter(correctAt).length
  const score = Number(answers?.[scoreKey] ?? bandScore(hits))

  const setValue = (n, raw) => update((current) => {
    const digits = String(raw ?? "").replace(/_/g, "").trim()
    const value = digits === "" ? null : Number(digits)
    current[valuesKey] = current[valuesKey] || {}
    current[correctKey] = current[correctKey] || {}
    current[valuesKey][`${valuePrefix}${n}`] = value
    current[correctKey][`${correctPrefix}${n}`] = n === 1
      ? value === startValue - stepValue
      : (current[valuesKey][`${valuePrefix}${n - 1}`] - stepValue) === value
    const total = indexes.filter((index) => current[correctKey][`${correctPrefix}${index}`] === true).length
    current[scoreKey] = bandScore(total)
  })

  const header = title !== undefined ? title : label
  const caption = String(text).replace("{step}", String(stepValue)).replace("{start}", String(startValue))
  const bands = String(bandsText || "").split("|").filter(Boolean)
  const maxScore = Math.max(0, ...(Array.isArray(scoreBands) ? scoreBands : []).map((band) => Number(band.score) || 0))

  return (
    <div id={id || fieldId} data-assessment-item="serial-subtraction">
      <AssessmentKit.SectionRow title={header} points={`${score}/${maxScore}`} border={{ borderLeft: "1px solid black", borderRight: "1px solid black" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", padding: "3px" }}>
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: "20px", flexWrap: "wrap" }}>
            <span>{caption} <Fluent.IconButton iconProps={{ iconName: "Edit" }} onClick={() => setOpen(true)} /></span>
            {indexes.map((n) => (
              <span key={n} style={{ display: "inline-flex", alignItems: "center" }}>
                [<AssessmentKit.CheckButton checked={correctAt(n)} readOnly />] {valueAt(n) ?? "__"}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-around", alignItems: "center", flexWrap: "wrap" }}>
            {bands.map((band) => {
              const [lead, pts] = band.split(":")
              return <span key={band}>{lead}{pts !== undefined ? <>: <strong>{pts.trim()}</strong></> : null}</span>
            })}
          </div>
        </div>
      </AssessmentKit.SectionRow>
      <SubForm hidden={!open} onCancel={() => setOpen(false)}>
        <div data-assessment-dialog="serial-subtraction" style={{ display: "flex", flexDirection: "column" }}>
          <div>Please enter in the values provided by the subject in order</div>
          {indexes.map((n) => {
            const value = valueAt(n)
            const previous = n === 1 ? startValue : valueAt(n - 1)
            return (
              <div key={n} style={{ display: "inline-flex", flexDirection: "row", alignItems: "center" }}>
                Answer {n}:{" "}
                <Fluent.MaskedTextField
                  readOnly={locked}
                  borderless
                  mask="999"
                  disabled={n > 1 && !valueAt(n - 1)}
                  value={value == null ? "" : String(value)}
                  styles={{ root: { width: "45px" } }}
                  onChange={(event, next) => setValue(n, next)}
                />{" "}
                <Fluent.FontIcon iconName={correctAt(n) ? "CheckMark" : value !== null ? "Cancel" : undefined} />
                &nbsp; {value ? `${correctAt(n) ? "C" : "Inc"}orrect (${previous} - ${stepValue} = ${previous - stepValue})` : null}
              </div>
            )
          })}
        </div>
        <Fluent.DefaultButton text="OK" onClick={() => setOpen(false)} />
      </SubForm>
    </div>
  )
}
