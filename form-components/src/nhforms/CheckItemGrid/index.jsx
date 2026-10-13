// CheckItemGrid — a scored grid of items (columns) by trials or cue levels
// (rows), each cell a check: a word-list memory trial, a delayed recall by cue.
//
// Answers: `${dataPath}.${row.key}.${itemKeyPrefix}${n}` = true/false, n from 1
// (MoCA: formAnswers.memory["1stTrial"].mem1). With `exclusivePerItem`, a check
// clears the same item in the other rows (an item is recalled at one cue level).
//
// Points column: `points` is fixed text ("NO POINTS"), or { row, max } to show
// the checks in that row out of max. `weightedTotal` ({ label, max }) shows the
// rows' checks times each row's `weight` (the MoCA Memory Index Score).
// The items are staged as `{ items }` under `contentKey` for the report.
const CheckItemGrid = ({
  id,
  fieldId,
  label,
  title,
  instructions,
  dataPath,
  items = [],
  rows = [],
  itemKeyPrefix = "item",
  exclusivePerItem = false,
  cornerLabel = "",
  points,
  weightedTotal,
  completePath,
  contentKey,
}) => {
  const words = (Array.isArray(items) ? items : []).map((item) => (typeof item === "string" ? item : String(item?.label ?? item?.text ?? "")))
  const rowList = (Array.isArray(rows) ? rows : []).filter((row) => row && row.key)
  const itemKey = (index) => `${itemKeyPrefix}${index + 1}`
  const defaults = Object.fromEntries(rowList.map((row) => [row.key, Object.fromEntries(words.map((_, index) => [itemKey(index), false]))]))
  const { answers, update, locked } = AssessmentKit.useAnswers({
    dataPath,
    defaults,
    completePath,
    contentKey,
    content: { items: words },
  })

  const toggle = (rowKey, index) => update((current) => {
    const key = itemKey(index)
    const next = !(current?.[rowKey]?.[key] === true)
    if (exclusivePerItem) {
      rowList.forEach((row) => {
        if (AssessmentKit.isRecord(current[row.key])) current[row.key][key] = false
      })
    }
    current[rowKey][key] = next
  })

  const rowCount = (rowKey) => AssessmentKit.countTrue(answers?.[rowKey])
  const weighted = rowList.reduce((total, row) => total + rowCount(row.key) * (Number(row.weight) || 0), 0)
  const pointsText = typeof points === "string"
    ? points
    : points && points.row
      ? `${rowCount(points.row)}/${points.max ?? words.length}`
      : null
  const header = title !== undefined ? title : label
  const cell = { border: "1px solid black", textAlign: "center" }

  return (
    <div id={id || fieldId} data-assessment-item="check-item-grid">
      <AssessmentKit.SectionRow title={header} instructions={instructions} points={pointsText}>
        <table style={{ borderCollapse: "collapse", border: "1px solid black", width: "100%", height: "100%" }}>
          <tbody>
            <tr style={{ maxHeight: "48px" }}>
              <th style={{ ...cell, lineHeight: "46px", fontWeight: "normal", fontSize: "small" }}>{cornerLabel}</th>
              {words.map((word, index) => (
                <th key={`h-${index}`} style={{ ...cell, lineHeight: "46px" }}>{word}</th>
              ))}
              {weightedTotal ? <th style={{ ...cell, fontSize: "small", fontWeight: "normal", maxWidth: "70px" }}>{weightedTotal.header || ""}</th> : null}
            </tr>
            {rowList.map((row, rowIndex) => (
              <tr key={row.key}>
                <td style={{ ...cell, height: "50px", textAlign: "left", paddingLeft: "4px" }}>
                  {row.label}
                  {row.weightLabel ? <div style={{ fontSize: "small" }}>{row.weightLabel}</div> : null}
                </td>
                {words.map((word, index) => (
                  <td key={`${row.key}-${index}`} style={{ ...cell, height: "1px", paddingTop: "2px" }}>
                    <AssessmentKit.CheckButton fill checked={answers?.[row.key]?.[itemKey(index)] === true} disabled={locked} onClick={() => toggle(row.key, index)} />
                  </td>
                ))}
                {weightedTotal && rowIndex === 0 ? (
                  <td rowSpan={rowList.length} style={{ ...cell, fontWeight: "bold" }}>
                    {`${weightedTotal.label || "Total"} = ${weighted}/${weightedTotal.max ?? ""}`}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </AssessmentKit.SectionRow>
    </div>
  )
}
