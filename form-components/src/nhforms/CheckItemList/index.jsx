// CheckItemList — scored items, one check each: digits repeated forward and
// backward, sentences repeated, abstraction pairs, orientation questions.
//
// Answers: `${dataPath}.${item.key}` = true/false (MoCA:
// formAnswers.attention.attforward). Each item shows its `label` and, after
// the check, its `stimulus` (the digits read out).
//
// layout: "rows" (label left, check and stimulus right), "centered" (check
// then label, centred, one per line) or "inline" (check then label, across).
// `points` true shows the checked items out of the item count; a number sets
// the maximum. The items are staged as `{ items }` under `contentKey` for the
// report.
const CheckItemList = ({
  id,
  fieldId,
  label,
  title,
  instructions,
  subtitle,
  dataPath,
  items = [],
  layout = "rows",
  bold = false,
  points = true,
  completePath,
  contentKey,
}) => {
  const list = (Array.isArray(items) ? items : []).filter((item) => item && item.key)
  const defaults = Object.fromEntries(list.map((item) => [item.key, false]))
  const { answers, update, locked } = AssessmentKit.useAnswers({
    dataPath,
    defaults,
    completePath,
    contentKey,
    content: { items: list.map((item) => ({ key: item.key, label: item.label ?? "", stimulus: item.stimulus ?? "" })) },
  })
  const toggle = (key) => update((current) => {
    current[key] = !(current[key] === true)
  })
  const checked = (key) => answers?.[key] === true
  const count = list.filter((item) => checked(item.key)).length
  const max = typeof points === "number" ? points : list.length
  const header = title !== undefined ? title : label
  const check = (item) => (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      [<AssessmentKit.CheckButton checked={checked(item.key)} disabled={locked} onClick={() => toggle(item.key)} />]
    </span>
  )

  let body
  if (layout === "inline") {
    body = (
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-around", fontWeight: "bold", minHeight: "50px" }}>
        {list.map((item) => (
          <span key={item.key} style={{ display: "inline-flex", alignItems: "center" }}>{check(item)} {item.label}</span>
        ))}
      </div>
    )
  } else if (layout === "centered") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", fontWeight: "bold", flexGrow: 1 }}>
        {list.map((item) => (
          <span key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{check(item)}{` ${item.label ?? ""}`}</span>
        ))}
      </div>
    )
  } else {
    body = (
      <div style={{ display: "flex", flexDirection: "column", paddingLeft: "5px", fontWeight: bold ? "bold" : "normal", flexGrow: 1 }}>
        {list.map((item) => (
          <div key={item.key} style={{ flexGrow: 1, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "3px", minHeight: "40px" }}>
            <span>{item.label}</span>
            <span style={{ paddingRight: "5px", display: "inline-flex", alignItems: "center" }}>
              {check(item)}
              {item.stimulus ? <span style={{ letterSpacing: "5px", paddingLeft: "5px" }}>{item.stimulus}</span> : null}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div id={id || fieldId} data-assessment-item="check-item-list">
      <AssessmentKit.SectionRow
        title={header}
        instructions={instructions}
        headerExtra={subtitle ? <div style={{ textAlign: "right", paddingRight: "30px", fontWeight: "bold" }}>{subtitle}</div> : null}
        points={points === false ? null : `${count}/${max}`}
      >
        {body}
      </AssessmentKit.SectionRow>
    </div>
  )
}
