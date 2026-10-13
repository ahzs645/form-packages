// AssessmentScore — the scoring end of an assessment built from the
// AssessmentKit items: rolls the item answers up into section and form totals,
// shows the total row, locks the form once it is complete, and stages what
// the form writes to the chart on submit.
//
// scoreRules: evaluated in order, each writes `target` (a dot path into the
// answers) as the sum of its terms, read after the rules before it:
//   { path }                 true -> 1, false/null -> 0, a number as it is
//   { path, atLeast }        1 when the number is at least atLeast
//   { count, weight = 1 }    the true values in the record at count, x weight
//   { sumOf }                the numbers in the record at sumOf, added
// adjustments: [{ path, label }] — checks drawn in the total row (such as
//   "Add 1 point if <= 12 yr edu"); count them in a rule.
// total: { path, max, label }; extraTotals: [{ label, path, max, suffix }].
// completePath: answer set true as the form is submitted (a staged submit
//   patch); the items lock while it is true.
// observation: the form's calculated observation, staged for submit
//   (calculatedUpdate; component-submit-writes.ts):
//   { observationCode, valueType, value: { path, multiply, divide, round },
//     report: { format, rootPath, versionPath, content } }
//   reportedBy (the current user) and reportedDate (today) are added.
//   Report formats are named; "moca-blind" reproduces the NH MoCA Blind
//   source's report text exactly, reading the items' staged content (the
//   words, sentences, starting number) by the keys in report.content.
const AssessmentScore = ({
  id,
  fieldId,
  completePath,
  scoreRules = [],
  adjustments = [],
  total,
  extraTotals = [],
  notes = [],
  administeredByPath,
  footerText,
  lockedText = "**COMPLETED FORM - READ ONLY**",
  observation,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const data = (fd && fd.field && fd.field.data) || {}
  const locked = AssessmentKit.isLocked(sd, data, completePath)
  const componentId = fieldId || id || "AssessmentScore"
  const get = (path) => AssessmentKit.getAt(data, path)

  // --- Totals -------------------------------------------------------------
  const termValue = (root, term) => {
    if (!term || typeof term !== "object") return 0
    if (term.count) return AssessmentKit.countTrue(AssessmentKit.getAt(root, term.count)) * (term.weight === undefined ? 1 : Number(term.weight))
    if (term.sumOf) {
      const record = AssessmentKit.getAt(root, term.sumOf)
      return AssessmentKit.isRecord(record) ? Object.values(record).reduce((sum, value) => sum + (Number(value) || 0), 0) : 0
    }
    const value = AssessmentKit.getAt(root, term.path)
    if (term.atLeast !== undefined) return Number(value) >= Number(term.atLeast) ? 1 : 0
    if (value === true) return 1
    return Number(value) || 0
  }
  const evaluateRules = (root) => {
    const working = AssessmentKit.clone(root || {})
    const results = []
    ;(Array.isArray(scoreRules) ? scoreRules : []).forEach((rule) => {
      if (!rule || !rule.target) return
      const value = (Array.isArray(rule.terms) ? rule.terms : []).reduce((sum, term) => sum + termValue(working, term), 0)
      AssessmentKit.setAt(working, rule.target, value)
      results.push([rule.target, value])
    })
    return results
  }
  // The complete flag and each adjustment start false, as answers the form keeps.
  const startingAnswers = [completePath, ...(Array.isArray(adjustments) ? adjustments : []).map((adjustment) => adjustment?.path)]
    .filter(Boolean)
  const totals = evaluateRules(data)
  const stale = !locked && (
    totals.some(([path, value]) => get(path) !== value) ||
    startingAnswers.some((path) => get(path) === undefined)
  )
  const totalsJson = JSON.stringify(totals)
  React.useEffect(() => {
    if (!stale || typeof setFormData !== "function") return
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {} }
      if (!AssessmentKit.isRecord(draft.field.data)) draft.field.data = {}
      startingAnswers.forEach((path) => {
        if (AssessmentKit.getAt(draft.field.data, path) === undefined) AssessmentKit.setAt(draft.field.data, path, false)
      })
      evaluateRules(draft.field.data).forEach(([path, value]) => {
        if (AssessmentKit.getAt(draft.field.data, path) !== value) AssessmentKit.setAt(draft.field.data, path, value)
      })
    }))
  }, [stale, totalsJson])

  // --- Submit: the complete flag ------------------------------------------
  React.useEffect(() => {
    AssessmentKit.stagePayload(setFormData, "submitPatchesByComponent", componentId, completePath ? [{ path: completePath, value: true }] : null)
  }, [componentId, completePath])

  // --- Submit: the calculated observation ---------------------------------
  const content = (data.__componentPayloads && data.__componentPayloads.assessmentContent) || {}
  const calculated = (() => {
    if (!observation || !observation.observationCode) return null
    const spec = observation.value || {}
    let value = Number(get(spec.path)) || 0
    if (spec.multiply !== undefined) value *= Number(spec.multiply)
    if (spec.divide !== undefined) value /= Number(spec.divide)
    if (spec.round) value = Math.round(value)
    const update = {
      observationCode: String(observation.observationCode),
      value: String(value),
      reportedBy: sd?.userProfile?.identity?.fullName,
      reportedDate: AssessmentKit.todayString(),
      valueType: observation.valueType || "numeric",
    }
    const report = observation.report ? AssessmentScore.reports[observation.report.format]?.(data, content, observation.report) : undefined
    if (report !== undefined) update.report = report
    return update
  })()
  const calculatedJson = JSON.stringify(calculated)
  React.useEffect(() => {
    if (locked) return
    AssessmentKit.stagePayload(setFormData, "calculatedUpdatesByComponent", componentId, calculated)
  }, [componentId, calculatedJson, locked])

  // --- Total row ------------------------------------------------------------
  const toggleAdjustment = (path) => {
    if (locked || typeof setFormData !== "function") return
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {} }
      if (!AssessmentKit.isRecord(draft.field.data)) draft.field.data = {}
      AssessmentKit.setAt(draft.field.data, path, !(AssessmentKit.getAt(draft.field.data, path) === true))
    }))
  }
  const administeredBy = administeredByPath ? get(administeredByPath) ?? sd?.userProfile?.identity?.fullName ?? null : null
  const navy = AssessmentKit.styles.navy

  return (
    <div id={id || fieldId} data-assessment-item="assessment-score">
      {locked && lockedText ? <div style={{ margin: "4px 0" }}><i>{lockedText}</i></div> : null}
      <div style={{ display: "flex", flexDirection: "row", fontSize: "medium", minHeight: "90px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "3px", width: "75%" }}>
          {notes.length ? (
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", fontWeight: "bold", paddingRight: "20px", fontSize: "larger", color: navy }}>
              {notes.map((note) => <span key={note}>{note}</span>)}
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            {administeredByPath ? <span>Administered by: <span style={{ borderBottom: "1px solid black" }}>{administeredBy}</span></span> : <span />}
            {adjustments.map((adjustment) => (
              <span key={adjustment.path} style={{ display: "inline-flex", alignItems: "center" }}>
                {adjustment.label} [<AssessmentKit.CheckButton checked={get(adjustment.path) === true} disabled={locked} onClick={() => toggleAdjustment(adjustment.path)} />]
              </span>
            ))}
          </div>
        </div>
        {total ? (
          <>
            <div style={{ borderLeft: "1px solid black", borderBottom: "1px solid black", flexGrow: 1, marginLeft: "20px", display: "flex", alignItems: "center", paddingLeft: "20px" }}>
              <span>{total.label || "TOTAL"}</span>
            </div>
            <AssessmentKit.PointsCell style={{ borderRight: "1px solid black", borderBottom: "1px solid black" }}>
              {`${get(total.path) ?? 0}/${total.max ?? ""}`}
            </AssessmentKit.PointsCell>
          </>
        ) : null}
      </div>
      {extraTotals.map((extra) => (
        <div key={extra.path} style={{ width: "100%", textAlign: "right", fontWeight: "bold" }}>
          <span style={{ paddingRight: "8px" }}>{`${extra.label}: ${get(extra.path) ?? 0} /${extra.max ?? ""}`}{extra.suffix ? `    ${extra.suffix}` : ""}</span>
        </div>
      ))}
      {footerText ? <span>{footerText}</span> : null}
    </div>
  )
}

// Named report formats: (data, content, options) -> report text.
AssessmentScore.reports = {
  // The NH MoCA Blind form's getSaveData report, line for line (its wording
  // and spacing, typos included, are what the chart holds for every MoCA
  // charted so far). options.rootPath is the answer tree, options.versionPath
  // the version label, options.content the content keys of the memory grid,
  // serial subtraction, repeated sentences, fluency and abstraction items.
  "moca-blind": (data, content, options) => {
    const fa = AssessmentKit.getAt(data, options.rootPath || "formAnswers") || {}
    const keys = options.content || {}
    const formVer = AssessmentKit.getAt(data, options.versionPath || "formAnswers.formVersion") ?? null
    const words = content[keys.memory || "memory"]?.items || []
    const start = Number(content[keys.subtraction || "subtraction"]?.start)
    const sentences = content[keys.sentences || "sentences"]?.items || []
    const letter = content[keys.fluency || "fluency"]?.letter ?? ""
    const pairs = content[keys.abstraction || "abstraction"]?.items || []
    const cat = (n) => words[n - 1]
    const yn = (value) => (value ? "Y" : "N")
    const memory = fa.memory || {}
    const t1 = memory["1stTrial"] || {}
    const t2 = memory["2ndTrial"] || {}
    const attention = fa.attention || {}
    const sv = attention.subtractionvalues || {}
    const language = fa.language || {}
    const langword = language.langword || {}
    const entries = Array.isArray(langword.langwordentry) ? langword.langwordentry : []
    const recall = fa.delayedRecall || {}
    const x3 = recall.X3 || {}
    const x2 = recall.X2 || {}
    const x1 = recall.X1 || {}
    const orientation = fa.orientation || {}
    const totals = fa.sectionTotals || {}
    const letters = Array.isArray(attention.attAtapletters) ? attention.attAtapletters : []
    const later = (previous, current) =>
      current
        ? `${current} (${previous - current === 7 ? `Y (${previous}-7=${current})` : `N (Answer should be ${previous - 7} based on previous answer`})`
        : "No Answer provided"

    let report = "MoCA Blind report\n"
    report += `Version: ${formVer}\n`
    report += "================================================\n\n"
    report += "Memory (No Points)\n"
    report += "------------------\n"
    report += `1st Trial- ${cat(1)}:${yn(t1.mem1)}, ${cat(2)}:${yn(t1.mem2)}, ${cat(3)}:${yn(t1.mem3)}, ${cat(4)}:${yn(t1.mem4)}, ${cat(5)}:${yn(t1.mem5)}\n`
    report += `2nd Trial- ${cat(1)}:${yn(t2.mem1)}, ${cat(2)}:${yn(t2.mem2)}, ${cat(3)}:${yn(t2.mem3)}, ${cat(4)}:${yn(t2.mem4)}, ${cat(5)}:${yn(t2.mem5)}\n`
    report += "\n"
    report += `Attention (${totals.attentionScore}/5)\n`
    report += "------------------\n"
    report += `Digits repeated correctly in forward order: ${attention.attforward ? "Y (1 point)" : "N (0 points"}\n`
    report += `Digits repeated correctly in reverse order: ${attention.attreverse ? "Y (1 point)" : "N (0 points)"}\n`
    report += `Subject tap at each letter A errors: ${letters.filter((entry) => entry.required != entry.checked).length} (${attention.attAtap ? "1 point" : "0 points - 2 or more errors"})\n`
    report += `Seria 7 subtraction starting at ${start} answers (${attention.subtractionScore}/3 points):\n`
    report += `\t1st answer: ${sv.calcval1 ? `${sv.calcval1} (${start - sv.calcval1 === 7 ? `Y (${start}-7=${start - 7})` : "N "})` : "No Answer provided"}\n`
    report += `\t2nd answer: ${later(sv.calcval1, sv.calcval2)}\n`
    report += `\t3rd answer: ${later(sv.calcval2, sv.calcval3)}\n`
    report += `\t4th answer: ${later(sv.calcval3, sv.calcval4)}\n`
    report += `\t5th answer: ${later(sv.calcval4, sv.calcval5)}\n`
    report += "\n"
    report += `Language (${totals.languageScore}/3)\n`
    report += "------------------\n"
    report += `Phrase '${sentences[0]?.label}' repeated: ${language.langphrase1 ? "Y (1 point)" : "N (0 points)"}\n`
    report += `Phrase '${sentences[1]?.label}' repeated: ${language.langphrase2 ? "Y (1 point)" : "N (0 points)"}\n`
    report += `Subject answers for 'List words beginning with ${letter} in one minute'\n`
    const answered = entries.filter((entry) => Boolean(entry.text) && entry.text !== "")
    if (answered.length === 0) {
      report += "--No answers recorded using form tool. Score value entered manually--\n"
    } else {
      report += "\tAnswer\t\tValid?\n"
      report += "\t------\t\t------\n"
      answered.forEach((entry) => {
        report += `\t${entry.text}\t\t${entry.isValid ?? "N"}\n`
      })
    }
    report += `Number of valid answers: ${langword.langwordvalidcount ?? 0} (${langword.langwordvalidcount > 10 ? "1 point - 11 or more valid words" : "0 points - 10 or less valid words"})\n`
    report += "\n"
    report += `Abstraction (${totals.abstractionScore}/2)\n`
    report += "------------------\n"
    report += `${pairs[0]?.label}: ${fa.abstraction?.abs1 ? "Y (1 point)" : "N (0 points)"}\n`
    report += `${pairs[1]?.label}: ${fa.abstraction?.abs2 ? "Y (1 point)" : "N (0 points)"}\n`
    report += "\n"
    report += `Delayed Recall (${totals.delayedRecallScore}/5)\n`
    report += "------------------\n"
    report += "Uncalled Recall (each Y = +3 to Memory Index Score)\n"
    report += `\t${cat(1)}: ${yn(x3.dr1)}, ${cat(2)}: ${yn(x3.dr2)}, ${cat(3)}: ${yn(x3.dr3)}, ${cat(4)}: ${yn(x3.dr4)}, ${cat(5)}: ${yn(x3.dr5)}\n`
    report += "Category Cue (each Y = +2 to Memory Index Score)\n"
    report += `\t${cat(1)}: ${yn(x2.dr1)}, ${cat(2)}: ${yn(x2.dr2)}, ${cat(3)}: ${yn(x2.dr3)}, ${cat(4)}: ${yn(x2.dr4)}, ${cat(5)}: ${yn(x2.dr5)}\n`
    report += "Multiple Choice Cue (each Y = +1 to Memory Index Score)\n"
    report += `\t${cat(1)}: ${yn(x1.dr1)}, ${cat(2)}: ${yn(x1.dr2)}, ${cat(3)}: ${yn(x1.dr3)}, ${cat(4)}: ${yn(x1.dr4)}, ${cat(5)}: ${yn(x1.dr5)}\n`
    report += "\n"
    report += `Memory Index Score = ${fa.misTotal}/15\n`
    report += "\n"
    report += `Orientation (${totals.orientationScore}/6)\n`
    report += "------------------\n"
    report += `Date: ${yn(orientation.date)}, Month: ${yn(orientation.month)}, Year: ${yn(orientation.year)}, Day: ${yn(orientation.day)}, Place: ${yn(orientation.place)}, City: ${yn(orientation.city)}\n`
    report += "\n"
    report += `Client has 12yr or less education: ${fa.education?.under12yr ? "Y (1 point)" : "N"}\n`
    report += "\n\n"
    report += "------------------\n"
    report += `Total: ${fa.pointsTotal}/22.     Memory Index Score: ${fa.misTotal}/15\n`
    report += `Total (converted to score out of 30): ${Math.round((fa.pointsTotal / 22) * 30)}/30`
    return report
  },
}
