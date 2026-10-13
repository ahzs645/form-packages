// AssessmentKit — the shared runtime of the assessment components
// (CheckItemGrid, CheckItemList, LetterTapping, SerialSubtraction,
// VerbalFluency, AssessmentScore): scored test items that keep their answers
// in one answer tree, as a cognitive screen such as the MoCA does.
//
// Every component writes under its own `dataPath` (a dot path into the form's
// answers, e.g. "formAnswers.memory"), so a form rebuilt from a source keeps
// the source's stored shape exactly. Each fills its defaults in on load (never
// over an answer already there), locks once the form is signed or submitted or
// its `completePath` answer is true, and stages the content it shows (its
// words, sentences, starting number) for AssessmentScore's report under
// `__componentPayloads.assessmentContent[contentKey]`, which is never saved.
//
//   AssessmentKit.getAt(root, path)
//   AssessmentKit.setAt(target, path, value)       — mutates (immer drafts)
//   AssessmentKit.useAnswers({ dataPath, defaults, completePath, contentKey, content })
//     -> { answers, update(recipe), locked, data, sd, fd, setFormData }
//   AssessmentKit.stagePayload(setFormData, group, componentId, payload)
//   AssessmentKit.CheckButton, SectionRow, PointsCell, styles
//
// Consumers reference AssessmentKit only inside function bodies (component
// files load in no guaranteed order). setFormData always receives a
// produce()-wrapped recipe: the real MOIS runtime hands back the raw state
// setter, so a bare mutator would replace the answers with undefined.

const AssessmentKit = (() => {
  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
  const stepsOf = (path) => String(path || "").split(".").map((step) => step.trim()).filter(Boolean)

  const getAt = (root, path) => {
    let current = root
    for (const step of stepsOf(path)) {
      if (current === null || current === undefined) return undefined
      current = current[step]
    }
    return current
  }

  // Writes value at path, creating the records on the way; mutates target.
  const setAt = (target, path, value) => {
    const steps = stepsOf(path)
    if (!steps.length || !isRecord(target)) return target
    let node = target
    steps.slice(0, -1).forEach((step) => {
      if (!isRecord(node[step])) node[step] = {}
      node = node[step]
    })
    node[steps[steps.length - 1]] = value
    return target
  }

  // Adds the keys defaults has and value lacks, recursively through records;
  // never replaces an answer (an array, or any value that is not a record, is
  // kept as it is). Mutates and returns value.
  const fillDefaults = (value, defaults) => {
    if (!isRecord(value) || !isRecord(defaults)) return value
    Object.keys(defaults).forEach((key) => {
      if (!(key in value)) value[key] = clone(defaults[key])
      else if (isRecord(value[key]) && isRecord(defaults[key])) fillDefaults(value[key], defaults[key])
    })
    return value
  }

  const withDefaults = (value, defaults) => {
    if (!isRecord(defaults)) return value === undefined ? clone(defaults) : value
    return fillDefaults(isRecord(value) ? clone(value) : {}, defaults)
  }

  const isLocked = (sd, data, completePath) =>
    sd?.webform?.recordState === "SIGNED" ||
    sd?.webform?.isDraft === "N" ||
    (completePath ? getAt(data, completePath) === true : false)

  const sameJson = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

  // Stages a payload in __componentPayloads[group][componentId] (removed when
  // null); writes only when it changed.
  const stagePayload = (setFormData, group, componentId, payload) => {
    if (typeof setFormData !== "function") return
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {} }
      if (!isRecord(draft.field.data)) draft.field.data = {}
      const container = isRecord(draft.field.data.__componentPayloads) ? draft.field.data.__componentPayloads : {}
      const entries = isRecord(container[group]) ? container[group] : {}
      if (sameJson(entries[componentId], payload)) return
      if (payload === null || payload === undefined) delete entries[componentId]
      else entries[componentId] = clone(payload)
      container[group] = entries
      draft.field.data.__componentPayloads = container
    }))
  }

  const useAnswers = ({ dataPath, defaults, completePath, contentKey, content }) => {
    const [fd, setFormData] = useActiveData()
    const sd = useSourceData()
    const data = (fd && fd.field && fd.field.data) || {}
    const stored = getAt(data, dataPath)
    const answers = withDefaults(stored, defaults)
    const locked = isLocked(sd, data, completePath)

    // Fill the defaults in once the answers exist, so the saved tree has every
    // key the source form saved; a locked (submitted or signed) form is left
    // as it was saved.
    const needsDefaults = !locked && isRecord(defaults) && !sameJson(stored, answers)
    React.useEffect(() => {
      if (!needsDefaults || typeof setFormData !== "function" || !dataPath) return
      setFormData(produce((draft) => {
        if (!draft.field) draft.field = { data: {}, status: {} }
        if (!isRecord(draft.field.data)) draft.field.data = {}
        const current = getAt(draft.field.data, dataPath)
        if (isRecord(current)) fillDefaults(current, defaults)
        else setAt(draft.field.data, dataPath, clone(defaults))
      }))
    }, [needsDefaults, dataPath])

    const contentJson = JSON.stringify(content ?? null)
    React.useEffect(() => {
      if (!contentKey) return
      stagePayload(setFormData, "assessmentContent", contentKey, content ?? null)
    }, [contentKey, contentJson])

    // recipe(answers) mutates the answers under dataPath (defaults filled in).
    const update = (recipe) => {
      if (locked || typeof setFormData !== "function" || !dataPath) return
      setFormData(produce((draft) => {
        if (!draft.field) draft.field = { data: {}, status: {} }
        if (!isRecord(draft.field.data)) draft.field.data = {}
        let current = getAt(draft.field.data, dataPath)
        if (isRecord(defaults)) {
          if (!isRecord(current)) {
            setAt(draft.field.data, dataPath, clone(defaults))
            current = getAt(draft.field.data, dataPath)
          } else {
            fillDefaults(current, defaults)
          }
          recipe(current)
        } else {
          const next = recipe(current)
          setAt(draft.field.data, dataPath, next)
        }
      }))
    }

    return { answers, update, locked, data, sd, fd, setFormData }
  }

  // The MoCA sheet's look: navy section header, bordered rows, a points column.
  const styles = {
    navy: "rgb(21,59,108)",
    header: {
      backgroundColor: "rgb(21,59,108)",
      color: "white",
      height: "50px",
      fontWeight: "bold",
      display: "flex",
      paddingLeft: "20px",
      fontSize: "large",
      alignContent: "center",
      lineHeight: "50px",
      textTransform: "uppercase",
    },
    lockedIcon: {
      rootDisabled: { backgroundColor: "inherit" },
      iconDisabled: { color: "rgb(0, 120, 212)" },
    },
    points: { width: "59px", display: "flex", alignItems: "center", borderLeft: "1px solid black" },
    pointsText: { fontWeight: "bold", flexGrow: "1", textAlign: "center" },
  }

  const CheckButton = ({ checked, onClick, disabled, fill = false, readOnly = false }) => (
    <Fluent.IconButton
      disabled={disabled || readOnly}
      styles={fill ? { root: { height: "100%", width: "100%" }, ...styles.lockedIcon } : styles.lockedIcon}
      iconProps={checked ? { iconName: "CheckMark" } : { iconName: "" }}
      onClick={readOnly ? undefined : onClick}
    />
  )

  const PointsCell = ({ children, style }) => (
    <div style={{ ...styles.points, ...(style || {}) }}>
      <div style={styles.pointsText}>{children}</div>
    </div>
  )

  // One sheet row: an optional navy header column (title + instructions), the
  // item's own content, and an optional points column.
  const SectionRow = ({ title, instructions, headerWidth = 250, points, border, children, headerExtra }) => (
    <div style={{ display: "flex", flexDirection: "row", fontSize: "medium", ...(border || { borderLeft: "1px solid black", borderRight: "1px solid black", borderTop: "1px solid black" }) }}>
      {title || instructions || headerExtra ? (
        <div style={{ width: `${headerWidth}px`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {title ? <div style={styles.header}><span>{title}</span></div> : null}
          {instructions ? <div style={{ fontSize: "medium", padding: "3px" }}>{instructions}</div> : null}
          {headerExtra || null}
        </div>
      ) : null}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>{children}</div>
      {points !== undefined && points !== null ? <PointsCell>{points}</PointsCell> : null}
    </div>
  )

  const countTrue = (value) => (isRecord(value) ? Object.values(value).filter((entry) => entry === true).length : 0)

  const todayString = (date = new Date()) => {
    const pad = (value) => String(value).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  return {
    isRecord,
    clone,
    getAt,
    setAt,
    fillDefaults,
    withDefaults,
    isLocked,
    sameJson,
    stagePayload,
    useAnswers,
    countTrue,
    todayString,
    styles,
    CheckButton,
    PointsCell,
    SectionRow,
  }
})()
