// FormFlow — conditional page flow for paginated forms: pages that are only
// active when a condition holds, branch-on-Next, validation before leaving a
// page, a review page and a post-submit confirmation.
//
// Emitted by the MOIS exporter (lib/mois-export/renderers/page-renderer.ts +
// flow-renderer.ts) in place of PageSelect / Page / PageStepButton when page
// flow is enabled:
//   <FormFlow config={formFlowConfig} pageNames={[...]} validationConfigs={formValidationConfigs} translate={translateFormText}>
//     <FormFlow.Nav />
//     <FormFlow.Page pageId={0}> ...sections... <FormFlow.Steps pageId={0} /> </FormFlow.Page>
//     ...
//     <FormFlow.Review />
//     <FormFlow.Finish> ...submit bar... </FormFlow.Finish>
//     <FormFlow.Confirmation />
//   </FormFlow>
// The root only provides context (no DOM of its own).
//
// Text: `translate` (optional) is the form's translateFormText. Every built-in
// string ("Next step", "Step {n} of {m}", "Not answered", …) and every
// authored one (review title/intro/edit link, confirmation title/intro/body)
// is looked up through it, so a design's uiTranslations can translate them
// per locale; untranslated text shows as written.
//
// Page state lives in activeData.uiState.breadcrumbSelectedKey (the key real
// SMOIS's PageSelect/Page use; the review page is key `config.reviewIndex`)
// plus uiState.__flow = { history: number[], visited: number[] } and, when
// Next is blocked, uiState.__formErrors = { source: "page", pageIndex, issues }.
//
// The navigation semantics are a port of lib/page-flow/index.ts
// (resolveActivePages / resolveNextPage / resolvePreviousPage) and are
// parity-tested against it. `config` is the normalized runtime config built by
// buildFormFlowRuntimeConfig (flow-renderer.ts): condition groups are compiled
// flat groups, targets are page indices, "review" or "end".
//
// Condition/validation logic comes from FormLogicKit, referenced only inside
// function bodies (component files load in no guaranteed order).
//
// Follow-up (repeat-for-each) tables: a page may be skipped while a follower
// table has no items (page.skipWhenNoItems = { tableId, repeatFor }, counted
// from the SOURCE rows by FormLogicKit.repeatItemCount), and every repeating
// table in config.repeatTables is synced (RepeatForEachTable.syncFormData,
// handed over by the form as config.repeatSync) before Next validation and on
// the review page, because an off-page table is not mounted and cannot sync
// itself.

const FormFlow = (() => {
  const FlowContext = React.createContext(null)
  // Set by the emitted validateSubmitPayload (FormFlow.noteSubmitAttempt) so
  // the confirmation only follows a submit made in this session, never a
  // reopened, already-submitted form.
  let submitAttemptedAt = 0

  // Built-in and authored text goes through the form's translateFormText
  // (the `translate` prop: uiTranslations keyed by the English source text
  // for fd.field.status.__formLocale); {name} placeholders are filled after.
  const formatText = (translate, source, vars) => {
    let text = source === undefined || source === null ? "" : String(source)
    if (typeof translate === "function" && text) {
      const translated = translate(text)
      if (typeof translated === "string" && translated) text = translated
    }
    if (vars) {
      Object.keys(vars).forEach((key) => {
        text = text.split("{" + key + "}").join(String(vars[key]))
      })
    }
    return text
  }

  const isUsableGroup = (group) => Boolean(group && Array.isArray(group.conditions) && group.conditions.length > 0)
  const evaluate = (group, values) => (
    typeof FormLogicKit !== "undefined" ? FormLogicKit.evaluateGroup(group, values || {}) : false
  )
  const pageCountOf = (config) => (config && Number.isInteger(config.pageCount) ? config.pageCount : ((config && config.pages) || []).length)

  // "Skip this page when there are no items": the follower's source rows
  // that would seed it (the follower itself may not be synced yet).
  const hasItems = (skip, values) => (
    !skip || !skip.repeatFor || typeof FormLogicKit === "undefined" ||
    typeof FormLogicKit.repeatItemCount !== "function" ||
    FormLogicKit.repeatItemCount(values || {}, skip.repeatFor) > 0
  )

  const resolveActivePages = (config, values) => {
    const count = pageCountOf(config)
    const pages = (config && config.pages) || []
    return Array.from({ length: count }, (_, index) => {
      const page = pages[index]
      if (index === 0 || !page) return true
      return (!isUsableGroup(page.activeWhen) || evaluate(page.activeWhen, values)) && hasItems(page.skipWhenNoItems, values)
    })
  }

  // RepeatForEachTable's sync statics: the form passes its own copy as
  // config.repeatSync (FormFlow does not list RepeatForEachTable as a
  // dependency, so a loader may give this module an incomplete copy).
  const repeatSyncer = (config) => {
    const candidate = (config && config.repeatSync) || (typeof RepeatForEachTable !== "undefined" ? RepeatForEachTable : null)
    return candidate && typeof candidate.syncFormData === "function" && typeof candidate.syncActiveData === "function" ? candidate : null
  }

  // The answers with every repeating table synced, or null when already current.
  const syncRepeatTables = (config, values) => {
    const tables = config && Array.isArray(config.repeatTables) ? config.repeatTables : null
    const syncer = repeatSyncer(config)
    if (!tables || tables.length === 0 || !syncer) return null
    return syncer.syncFormData(values || {}, tables)
  }

  const writeRepeatSync = (config, setter, synced) => {
    const syncer = repeatSyncer(config)
    if (syncer) syncer.syncActiveData({ setFormData: setter }, config.repeatTables, synced)
  }

  const inactivePages = (config, values) => resolveActivePages(config, values)
    .map((active, index) => (active ? -1 : index))
    .filter((index) => index >= 0)

  const nextActiveAfter = (config, active, index) => {
    for (let candidate = index + 1; candidate < pageCountOf(config); candidate++) {
      if (active[candidate]) return candidate
    }
    return config && config.review ? "review" : null
  }

  const resolveTarget = (config, active, target) => {
    if (target === "end" || target === null || target === undefined) return null
    if (target === "review") return config && config.review ? "review" : null
    if (active[target]) return target
    return nextActiveAfter(config, active, target)
  }

  /** Next step from `current` (page index or "review"): index, "review" or null (last step). */
  const resolveNextPage = (config, current, values) => {
    if (current === "review") return null
    const page = ((config && config.pages) || [])[current]
    if (current < 0 || current >= pageCountOf(config)) return null
    const active = resolveActivePages(config, values)
    const branches = (page && page.branches) || []
    const branch = branches.find((candidate) => isUsableGroup(candidate.when) && evaluate(candidate.when, values))
    if (branch) return resolveTarget(config, active, branch.goTo)
    if (page && page.defaultNext !== null && page.defaultNext !== undefined) return resolveTarget(config, active, page.defaultNext)
    return nextActiveAfter(config, active, current)
  }

  /** Back: most recent still-active page in history, else previous active page. */
  const resolvePreviousPage = (config, current, history, values) => {
    const active = resolveActivePages(config, values)
    const count = pageCountOf(config)
    const remaining = Array.isArray(history) ? history.slice() : []
    while (remaining.length > 0) {
      const candidate = remaining.pop()
      if (candidate !== current && Number.isInteger(candidate) && candidate >= 0 && candidate < count && active[candidate]) {
        return { page: candidate, history: remaining }
      }
    }
    const start = current === "review" ? count : current
    for (let candidate = start - 1; candidate >= 0; candidate--) {
      if (active[candidate]) return { page: candidate, history: [] }
    }
    return null
  }

  /**
   * The pages on the path the current answers take: page 0, then Next after
   * Next (same branch / defaultNext / order rules), stopping at the review
   * page or the end of the form. Recomputed from answers rather than read from
   * the visit history, so an answer edited via a review Edit link re-routes
   * it. A page is never listed twice (a backward branch ends the walk).
   */
  const resolvePagePath = (config, values) => {
    const path = []
    let step = pageCountOf(config) > 0 ? 0 : null
    while (typeof step === "number" && !path.includes(step)) {
      path.push(step)
      step = resolveNextPage(config, step, values)
    }
    return path
  }

  const toKey = (config, step) => (step === "review" ? config.reviewIndex : step)

  const normalizeKey = (key) => {
    if (typeof key === "number") return key
    if (typeof key === "string" && key.trim() !== "" && Number.isFinite(Number(key))) return Number(key)
    return null
  }

  // Current step for a uiState key: a page index, "review", or the nearest
  // earlier active page when the stored page is inactive / out of range.
  const resolveCurrent = (config, key, active) => {
    const count = pageCountOf(config)
    const normalized = normalizeKey(key)
    if (normalized === null) return 0
    if (config.review && normalized === config.reviewIndex) return "review"
    const start = Number.isInteger(normalized) && normalized >= 0 && normalized < count ? normalized : count - 1
    for (let candidate = start; candidate >= 0; candidate--) {
      if (active[candidate]) return candidate
    }
    return 0
  }

  const safeSetter = (fd, setFd) => (fd && typeof fd.setFormData === "function" ? fd.setFormData : setFd)

  const scrollToTop = () => {
    try {
      if (typeof window !== "undefined" && typeof window.scrollTo === "function") window.scrollTo(0, 0)
    } catch (error) {
      // Some hosts (and test DOMs) do not implement scrolling.
    }
  }

  const later = (callback, delay) => {
    if (typeof window !== "undefined" && typeof window.setTimeout === "function") window.setTimeout(callback, delay || 0)
    else callback()
  }

  // Page content mounts after the page switch commits; retry briefly. The
  // label lets FormLogicKit find real-MOIS controls, which carry no field id.
  const focusFieldSoon = (fieldId, label, attempt) => {
    later(() => {
      const focused = typeof FormLogicKit !== "undefined" && FormLogicKit.focusField(fieldId, label)
      if (!focused && (attempt || 0) < 5) focusFieldSoon(fieldId, label, (attempt || 0) + 1)
    }, 40)
  }

  const focusSelector = (selector) => {
    if (typeof document === "undefined") return false
    const element = document.querySelector(selector)
    if (!element || typeof element.focus !== "function") return false
    element.focus()
    return true
  }

  // Error summary first (FormErrorSummary marks itself data-form-error-summary);
  // else the first invalid field.
  const focusErrors = (issues) => {
    later(() => {
      if (focusSelector("[data-form-error-summary]")) return
      const first = (issues || []).find((issue) => issue && issue.fieldId && issue.fieldId !== "_form")
      if (first) focusFieldSoon(first.fieldId, first.label, 0)
    }, 0)
  }

  const recordStep = (draft, config, fromStep, toStep, historyOverride) => {
    draft.uiState = draft.uiState || {}
    const flow = draft.uiState.__flow || {}
    let history = Array.isArray(historyOverride) ? historyOverride.slice() : (Array.isArray(flow.history) ? flow.history.slice() : [])
    if (!historyOverride && typeof fromStep === "number" && fromStep !== toStep) history.push(fromStep)
    history = history.slice(-50)
    const visited = Array.isArray(flow.visited) ? flow.visited.slice() : [0]
    const key = toKey(config, toStep)
    if (!visited.includes(key)) visited.push(key)
    draft.uiState.__flow = { ...flow, history, visited }
    draft.uiState.breadcrumbSelectedKey = key
    if (draft.uiState.__formErrors && draft.uiState.__formErrors.source === "page") {
      delete draft.uiState.__formErrors
    }
  }

  const REVIEW_SKIP_KINDS = ["component", "layoutTable", "file", "signature", "section", "heading"]

  const normalizeYesNo = (value) => {
    if (value && typeof value === "object") return normalizeYesNo(value.code ?? value.display ?? value.value ?? value.text)
    if (value === true || value === "yes" || value === "Yes" || value === "Y" || value === 1 || value === "true") return "yes"
    if (value === false || value === "no" || value === "No" || value === "N" || value === 0 || value === "false") return "no"
    return null
  }

  const formatScalar = (field, value) => {
    if (value === null || value === undefined) return ""
    if (Array.isArray(value)) return value.map((entry) => formatScalar(field, entry)).filter(Boolean).join(", ")
    if (typeof value === "object") {
      const shown = value.display ?? value.text ?? value.label ?? value.value ?? value.code
      if (shown !== undefined && shown !== null) return formatScalar(field, shown)
      return Object.keys(value)
        .filter((key) => !key.startsWith("_"))
        .map((key) => key + ": " + formatScalar(null, value[key]))
        .join("; ")
    }
    const text = String(value)
    if (field && field.options && Object.prototype.hasOwnProperty.call(field.options, text)) return field.options[text]
    return text
  }

  const readCell = (row, path) => String(path || "").split(".").filter(Boolean)
    .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), row)

  // Table cell by column type: choices by option label, booleans by their
  // on/off label (an unchecked checkbox is not an answer, as in EditableTable).
  const formatCell = (column, value) => {
    if (column && column.type === "boolean") {
      const yesNo = normalizeYesNo(value)
      if (yesNo === "yes") return (column.booleanLabels && column.booleanLabels.on) || "Yes"
      if (yesNo === "no") return ""
    }
    return formatScalar(column && column.type === "choice" ? column : null, value)
  }

  /**
   * Human-readable answer for the review page ("" when unanswered). Tables
   * return [{ heading, text }] per row (an empty array when unanswered).
   */
  const formatValue = (field, value) => {
    const meaningful = (candidate) => (
      typeof FormLogicKit !== "undefined"
        ? FormLogicKit.hasMeaningfulValue(candidate)
        : candidate !== undefined && candidate !== null && String(candidate).trim() !== ""
    )
    // Table rows are plain objects keyed by column: a row counts when any
    // non-metadata cell is answered.
    const rowAnswered = (row) => Boolean(row && typeof row === "object" && !Array.isArray(row) &&
      Object.keys(row).some((key) => !key.startsWith("_") && meaningful(row[key])))
    const hasValue = field.kind === "table" && Array.isArray(value) ? value.some(rowAnswered) : meaningful(value)
    if (!hasValue) return ""
    if (field.kind === "boolean") {
      const yesNo = normalizeYesNo(value)
      if (yesNo === "yes") return (field.booleanLabels && field.booleanLabels.on) || "Yes"
      if (yesNo === "no") return (field.booleanLabels && field.booleanLabels.off) || "No"
    }
    if (field.kind === "table" && Array.isArray(value)) {
      // [{ heading, text }] per row: heading = the repeat-for-each row label
      // (RepeatForEachTable's _sourceLabel), text = "Column: answer; ...".
      const columns = Array.isArray(field.columns) ? field.columns : null
      const labelTarget = field.rowLabel && field.rowLabel.labelTargetColumnId
      return value
        .map((row) => {
          if (!row || typeof row !== "object") return { heading: "", text: formatScalar(null, row) }
          const label = field.rowLabel && typeof row._sourceLabel === "string" ? row._sourceLabel.trim() : ""
          const heading = label && row._sourceRemoved ? label + " (no longer listed)" : label
          const parts = columns
            ? columns
                .filter((column) => !(heading && labelTarget && column.id === labelTarget))
                .map((column) => {
                  const cell = formatCell(column, readCell(row, column.path || column.id))
                  return cell ? column.label + ": " + cell : ""
                })
            : Object.keys(row).filter((key) => !key.startsWith("_")).map((key) => formatScalar(null, row[key]))
          return { heading, text: parts.filter(Boolean).join("; ") }
        })
        .filter((row) => row.heading || row.text)
    }
    return formatScalar(field, value)
  }

  const FormFlowRoot = ({ config, pageNames, validationConfigs, translate, children }) => {
    const [fd, setFd] = useActiveData()
    const sd = useSourceData()
    const cfg = config || { pageCount: 0, pages: [], reviewIndex: 0 }
    const data = (fd && fd.field && fd.field.data) || {}
    const uiState = (fd && fd.uiState) || {}
    const flowState = uiState.__flow || {}
    const history = Array.isArray(flowState.history) ? flowState.history : []
    const visited = Array.isArray(flowState.visited) ? flowState.visited : [0]
    const active = resolveActivePages(cfg, data)
    const current = resolveCurrent(cfg, uiState.breadcrumbSelectedKey, active)
    const isPrinting = Boolean(sd && sd.lifecycleState && sd.lifecycleState.isPrinting)
    const locale = (fd && fd.field && fd.field.status && fd.field.status.__formLocale) || ""
    const setter = safeSetter(fd, setFd)
    // A signed record is never rewritten by navigation.
    const canSync = !isPrinting && !(sd && sd.webform && sd.webform.recordState === "SIGNED")

    const write = (recipe) => {
      if (typeof setter !== "function") return
      setter(produce((draft) => {
        if (!draft) return
        recipe(draft)
      }))
    }

    const validatePage = (pageIndex, values) => {
      const page = (cfg.pages || [])[pageIndex]
      const shouldValidate = page && typeof page.validateOnNext === "boolean" ? page.validateOnNext : cfg.validateOnNext !== false
      if (!shouldValidate || typeof FormLogicKit === "undefined") return []
      const answers = values || data
      return FormLogicKit.validate(validationConfigs || [], answers, {
        pageIndex,
        inactivePages: inactivePages(cfg, answers),
        locale,
        translate,
      })
    }

    // Bring off-page follow-up tables up to date (stored + returned), so the
    // checks that follow see current rows. Converges: once written, the next
    // sync finds nothing to change.
    const currentValues = () => {
      const synced = canSync ? syncRepeatTables(cfg, data) : null
      if (!synced) return data
      writeRepeatSync(cfg, setter, synced)
      return synced
    }

    const blockWithIssues = (pageIndex, issues) => {
      write((draft) => {
        draft.uiState = draft.uiState || {}
        draft.uiState.__formErrors = { source: "page", pageIndex, issues }
      })
      focusErrors(issues)
    }

    const afterMove = (focusFieldId, focusLabel) => {
      scrollToTop()
      if (focusFieldId) focusFieldSoon(focusFieldId, focusLabel, 0)
      else later(() => focusSelector("[data-form-flow-nav]"), 0)
    }

    const goTo = (step, options) => {
      const opts = options || {}
      write((draft) => recordStep(draft, cfg, current, step, opts.history))
      afterMove(opts.focusFieldId, opts.focusLabel)
    }

    const next = () => {
      if (current === "review") return
      const values = currentValues()
      const issues = validatePage(current, values)
      if (issues.length > 0) {
        blockWithIssues(current, issues)
        return
      }
      const target = resolveNextPage(cfg, current, values)
      if (target === null) return
      goTo(target)
    }

    const back = () => {
      const previous = resolvePreviousPage(cfg, current, history, data)
      if (!previous) return
      goTo(previous.page, { history: previous.history })
    }

    // Breadcrumb / review "Edit" / preview jump-to-field. In "visited" mode a
    // forward jump validates the page being left first.
    const jump = (step, options) => {
      const opts = options || {}
      if (step === current && !opts.focusFieldId) return
      const isForward = step === "review" || (typeof current === "number" && typeof step === "number" && step > current)
      if (opts.validate && isForward && typeof current === "number") {
        const issues = validatePage(current, currentValues())
        if (issues.length > 0) {
          blockWithIssues(current, issues)
          return
        }
      }
      if (step === current) {
        afterMove(opts.focusFieldId, opts.focusLabel)
        return
      }
      goTo(step, { focusFieldId: opts.focusFieldId, focusLabel: opts.focusLabel })
    }

    const jumpRef = React.useRef(jump)
    jumpRef.current = jump
    React.useEffect(() => {
      if (typeof window === "undefined" || typeof window.addEventListener !== "function") return undefined
      // Preview-only: MoisFormRenderer's jump-to-field. Never fired in SMOIS.
      const handler = (event) => {
        const pageIndex = Number(event && event.detail && event.detail.pageIndex)
        if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCountOf(cfg)) return
        jumpRef.current(pageIndex, {})
      }
      window.addEventListener("webforms:preview-select-page", handler)
      return () => window.removeEventListener("webforms:preview-select-page", handler)
    }, [])

    // hiddenAnswerPolicy "clear": drop answers of fields on inactive pages.
    // Converges: once cleared, nothing is left to clear.
    const clearIds = []
    ;(cfg.pages || []).forEach((page, index) => {
      if (!page || !page.clearWhenInactive || active[index]) return
      const modelPage = (cfg.model || []).find((entry) => entry.pageIndex === index)
      ;((modelPage && modelPage.fields) || []).forEach((field) => {
        if (data[field.id] !== undefined && data[field.id] !== null && data[field.id] !== "") clearIds.push(field.id)
      })
    })
    const clearKey = clearIds.join("\u0000")
    React.useEffect(() => {
      if (!clearKey) return
      const ids = clearKey.split("\u0000")
      write((draft) => {
        if (!draft.field || !draft.field.data) return
        ids.forEach((id) => {
          delete draft.field.data[id]
        })
      })
    }, [clearKey])

    // Confirmation: only after this session's submit turned the draft final.
    const isDraft = sd && sd.webform ? sd.webform.isDraft : undefined
    const previousDraftRef = React.useRef(isDraft)
    const [showConfirmation, setShowConfirmation] = React.useState(false)
    React.useEffect(() => {
      const previous = previousDraftRef.current
      previousDraftRef.current = isDraft
      if (!cfg.confirmation || isDraft !== "N" || previous === "N") return
      if (!submitAttemptedAt || Date.now() - submitAttemptedAt > 10 * 60 * 1000) return
      submitAttemptedAt = 0
      setShowConfirmation(true)
    }, [isDraft])

    // The review page lists current follow-up rows: render from synced
    // answers at once and store them (a row added to a source table after its
    // follower's page was left gets its follow-up row).
    const reviewSynced = React.useMemo(
      () => (current === "review" && canSync ? syncRepeatTables(cfg, data) : null),
      [current, canSync, data, cfg]
    )
    const syncBurstRef = React.useRef({ since: 0, count: 0 })
    React.useEffect(() => {
      if (!reviewSynced) return
      // Burst guard (as in RepeatForEachTable): stop writing if a sync ever
      // fails to settle instead of looping render -> write -> render.
      const burst = syncBurstRef.current
      const now = Date.now()
      if (now - burst.since > 1000) {
        burst.since = now
        burst.count = 0
      }
      burst.count += 1
      if (burst.count > 10) return
      writeRepeatSync(cfg, setter, reviewSynced)
    }, [reviewSynced])

    const pageErrors = (pageIndex) => {
      const errors = uiState.__formErrors
      if (!errors || errors.source !== "page" || errors.pageIndex !== pageIndex) return []
      return Array.isArray(errors.issues) ? errors.issues : []
    }

    const value = {
      config: cfg,
      pageNames: Array.isArray(pageNames) ? pageNames : [],
      data: reviewSynced || data,
      active,
      current,
      visited,
      isPrinting,
      showConfirmation,
      next,
      back,
      jump,
      nextFrom: (step) => resolveNextPage(cfg, step, data),
      previousFrom: (step) => resolvePreviousPage(cfg, step, history, data),
      pageErrors,
      dismissConfirmation: () => setShowConfirmation(false),
      t: (source, vars) => formatText(translate, source, vars),
    }
    return <FlowContext.Provider value={value}>{children ?? null}</FlowContext.Provider>
  }

  const useFlow = () => React.useContext(FlowContext)

  const stepLabel = (ctx, step) => (
    step === "review"
      ? ctx.t((ctx.config.review && ctx.config.review.title) || "Review")
      : ctx.pageNames[step] || ctx.t("Page {n}", { n: step + 1 })
  )

  const activeSteps = (ctx) => {
    const steps = []
    ctx.active.forEach((isActive, index) => {
      if (isActive) steps.push(index)
    })
    if (ctx.config.review) steps.push("review")
    return steps
  }

  // Breadcrumb in the SMOIS PageSelect look (CircleRing + large text, bold
  // current) listing only active pages, plus an optional "Step n of m".
  const Nav = () => {
    const ctx = useFlow()
    if (!ctx || ctx.showConfirmation || ctx.isPrinting) return null
    const steps = activeSteps(ctx)
    const position = steps.indexOf(ctx.current)
    const mode = ctx.config.breadcrumb || "all-active"
    const progress = ctx.config.showProgress && position >= 0
      ? <Fluent.Text variant="medium" styles={{ root: { color: "rgb(96, 94, 92)", display: "block", padding: "6px 0 0 2em" } }}>{ctx.t("Step {n} of {m}", { n: position + 1, m: steps.length })}</Fluent.Text>
      : null
    if (mode === "hidden") {
      return progress ? <div className="hideonprint" data-form-flow-nav="" tabIndex={-1} style={{ outline: "none" }}>{progress}</div> : null
    }
    return (
      <div className="hideonprint" data-form-flow-nav="" tabIndex={-1} style={{ outline: "none" }}>
        <div id="breadcrumb" role="navigation" aria-label={ctx.t("Pages")} style={{ background: "rgb(255, 255, 255)", borderBottom: "1px solid rgb(237, 235, 233)", paddingBottom: "10px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px" }}>
            {steps.map((step, index) => {
              const isCurrent = step === ctx.current
              const key = step === "review" ? ctx.config.reviewIndex : step
              const enabled = isCurrent || mode !== "visited" || ctx.visited.includes(key)
              const label = stepLabel(ctx, step)
              return (
                <React.Fragment key={String(key)}>
                  <Fluent.Link
                    disabled={!enabled}
                    aria-current={isCurrent ? "step" : undefined}
                    styles={{ root: { paddingLeft: "2em", paddingRight: "5px" } }}
                    onClick={() => enabled && ctx.jump(step, { validate: mode === "visited" })}
                  >
                    <Fluent.Icon iconName={isCurrent ? "CircleFill" : "CircleRing"} styles={{ root: { paddingRight: "5px" } }} />
                    <Fluent.Text variant="large">{isCurrent ? <b>{label}</b> : <span>{label}</span>}</Fluent.Text>
                  </Fluent.Link>
                  {index < steps.length - 1 ? <Fluent.Text aria-hidden="true" styles={{ root: { color: "rgb(96, 94, 92)" } }}>/</Fluent.Text> : null}
                </React.Fragment>
              )
            })}
          </div>
          {progress}
        </div>
      </div>
    )
  }

  // Page body, rendered iff the page is active and selected (or printing:
  // every active page prints, inactive pages never do). Same Linear wrapper
  // as the SMOIS Page component.
  const Page = ({ pageId, linearLayoutProps, children }) => {
    const ctx = useFlow()
    if (!ctx) return <Linear {...(linearLayoutProps || {})}>{children}</Linear>
    if (ctx.showConfirmation) return null
    if (!ctx.active[pageId]) return null
    if (!ctx.isPrinting && ctx.current !== pageId) return null
    return <Linear {...(linearLayoutProps || {})}>{children}</Linear>
  }

  // Back / Next for one page (+ extra buttons such as "print this page").
  const Steps = ({ pageId, children }) => {
    const ctx = useFlow()
    if (!ctx || ctx.showConfirmation || ctx.current !== pageId) return null
    const target = ctx.nextFrom(pageId)
    const canGoBack = ctx.previousFrom(pageId) !== null
    const errors = ctx.pageErrors(pageId)
    const extra = React.Children.toArray(children)
    if (!canGoBack && target === null && extra.length === 0 && errors.length === 0) return null
    return (
      <div className="hideonprint">
        {errors.length > 0 ? (
          <div role="status" data-form-flow-page-errors="" style={{ color: "rgb(164, 38, 44)", margin: "8px 0" }}>
            {errors.length === 1
              ? ctx.t("1 answer on this page needs attention before you continue.")
              : ctx.t("{n} answers on this page need attention before you continue.", { n: errors.length })}
          </div>
        ) : null}
        <ButtonBar>
          {canGoBack ? <Fluent.DefaultButton text={ctx.t("Previous step")} onClick={ctx.back} /> : null}
          {target !== null ? <Fluent.DefaultButton text={ctx.t(target === "review" ? "Review answers" : "Next step")} onClick={ctx.next} /> : null}
          {extra}
        </ButtonBar>
      </div>
    )
  }

  const Review = () => {
    const ctx = useFlow()
    const review = ctx && ctx.config.review
    if (!ctx || !review || ctx.showConfirmation || ctx.isPrinting || ctx.current !== "review") return null
    const get = (id) => (typeof FormLogicKit !== "undefined" ? FormLogicKit.readValue(ctx.data, id) : ctx.data[id])
    const editText = ctx.t(review.editLinkText || "Edit")
    // Only pages on the path the answers take (a page a branch skipped is
    // not "Not answered", it was never asked).
    const path = resolvePagePath(ctx.config, ctx.data)
    const sections = (ctx.config.model || [])
      .filter((page) => ctx.active[page.pageIndex] && path.includes(page.pageIndex))
      .map((page) => ({
        ...page,
        fields: (page.fields || []).filter((field) => (
          !REVIEW_SKIP_KINDS.includes(field.kind) &&
          !field.hidden &&
          !(field.visibility && typeof FormLogicKit !== "undefined" && FormLogicKit.isFieldHidden(field.visibility, get))
        )),
      }))
      .filter((page) => page.fields.length > 0)
    const canGoBack = ctx.previousFrom("review") !== null
    return (
      <Linear>
        <div data-form-flow-review="">
          <Fluent.Text as="h2" variant="xLarge" block styles={{ root: { fontWeight: 600, margin: "8px 0" } }}>{ctx.t(review.title || "Review your answers")}</Fluent.Text>
          {review.intro ? <Fluent.Text block styles={{ root: { marginBottom: "12px" } }}>{ctx.t(review.intro)}</Fluent.Text> : null}
          {sections.map((page) => {
            const pageTitle = ctx.pageNames[page.pageIndex] || (page.title ? ctx.t(page.title) : ctx.t("Page {n}", { n: page.pageIndex + 1 }))
            return (
              <section key={page.pageIndex} aria-label={pageTitle} style={{ borderTop: "1px solid rgb(237, 235, 233)", padding: "8px 0 12px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                  <Fluent.Text as="h3" variant="large" styles={{ root: { fontWeight: 600, margin: 0 } }}>{pageTitle}</Fluent.Text>
                  <Fluent.Link className="hideonprint" aria-label={editText + " " + pageTitle} onClick={() => ctx.jump(page.pageIndex, {})}>{editText}</Fluent.Link>
                </div>
                <dl style={{ margin: "8px 0 0", display: "grid", gridTemplateColumns: "minmax(140px, 1fr) 2fr auto", columnGap: "12px", rowGap: "6px" }}>
                  {page.fields.map((field) => {
                    const formatted = formatValue(field, get(field.id))
                    const empty = Array.isArray(formatted) ? formatted.length === 0 : !formatted
                    return (
                      <React.Fragment key={field.id}>
                        <dt style={{ fontWeight: 600 }}>{field.label || field.id}</dt>
                        <dd style={{ margin: 0, color: empty ? "rgb(96, 94, 92)" : undefined, whiteSpace: "pre-wrap" }}>
                          {empty
                            ? <i>{ctx.t("Not answered")}</i>
                            : Array.isArray(formatted)
                              ? <ul style={{ margin: 0, paddingLeft: "18px" }}>{formatted.map((row, index) => (
                                  <li key={index}>
                                    {row.heading ? <b data-form-flow-row-heading="" style={{ display: "block" }}>{row.heading}</b> : null}
                                    {row.text || (row.heading ? <i style={{ color: "rgb(96, 94, 92)" }}>{ctx.t("Not answered")}</i> : null)}
                                  </li>
                                ))}</ul>
                              : formatted}
                        </dd>
                        <dd style={{ margin: 0 }} className="hideonprint">
                          <Fluent.Link aria-label={editText + " " + (field.label || field.id)} onClick={() => ctx.jump(page.pageIndex, { focusFieldId: field.id, focusLabel: field.label })}>{editText}</Fluent.Link>
                        </dd>
                      </React.Fragment>
                    )
                  })}
                </dl>
              </section>
            )
          })}
          {canGoBack ? (
            <div className="hideonprint">
              <ButtonBar>
                <Fluent.DefaultButton text={ctx.t("Previous step")} onClick={ctx.back} />
              </ButtonBar>
            </div>
          ) : null}
        </div>
      </Linear>
    )
  }

  // Rendered on the last step only (no Next target): the review page, a page
  // a branch sends to the end, or the last active page. Holds the inline
  // Submit bar when Submit is configured for the last page.
  const Finish = ({ children }) => {
    const ctx = useFlow()
    if (!ctx) return <React.Fragment>{children ?? null}</React.Fragment>
    if (ctx.showConfirmation) return null
    if (ctx.nextFrom(ctx.current) !== null) return null
    return <React.Fragment>{children ?? null}</React.Fragment>
  }

  const Confirmation = () => {
    const ctx = useFlow()
    const ref = React.useRef(null)
    const visible = Boolean(ctx && ctx.showConfirmation && ctx.config.confirmation)
    React.useEffect(() => {
      if (visible && ref.current && typeof ref.current.focus === "function") ref.current.focus()
    }, [visible])
    if (!visible) return null
    const confirmation = ctx.config.confirmation
    const paragraphs = String(confirmation.body ? ctx.t(confirmation.body) : "").split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean)
    return (
      <Linear>
        <div ref={ref} tabIndex={-1} role="status" data-form-flow-confirmation="" style={{ outline: "none", padding: "8px 0" }}>
          <Fluent.MessageBar messageBarType={Fluent.MessageBarType && Fluent.MessageBarType.success}>
            <b>{ctx.t(confirmation.title || "Your form has been submitted")}</b>
          </Fluent.MessageBar>
          {confirmation.intro ? <Fluent.Text block styles={{ root: { margin: "12px 0 0" } }}>{ctx.t(confirmation.intro)}</Fluent.Text> : null}
          {paragraphs.map((text, index) => (
            <Fluent.Text key={index} block styles={{ root: { margin: "12px 0 0", whiteSpace: "pre-wrap" } }}>{text}</Fluent.Text>
          ))}
          <div className="hideonprint" style={{ marginTop: "12px" }}>
            <ButtonBar>
              <Fluent.DefaultButton text={ctx.t("View submitted form")} onClick={ctx.dismissConfirmation} />
            </ButtonBar>
          </div>
        </div>
      </Linear>
    )
  }

  /**
   * Submit guard helper (emitted validateSubmitPayload): send the user to the
   * review page instead of submitting. `fd` is the form's ActiveData.
   */
  const requestReview = (fd, config) => {
    if (!config || !config.review) return
    const setter = fd && typeof fd.setFormData === "function" ? fd.setFormData : null
    if (!setter) return
    const values = (fd.field && fd.field.data) || {}
    const from = resolveCurrent(config, fd.uiState && fd.uiState.breadcrumbSelectedKey, resolveActivePages(config, values))
    setter(produce((draft) => {
      if (!draft) return
      recordStep(draft, config, from, "review")
    }))
    scrollToTop()
  }

  const noteSubmitAttempt = () => {
    submitAttemptedAt = Date.now()
  }

  FormFlowRoot.Nav = Nav
  FormFlowRoot.Page = Page
  FormFlowRoot.Steps = Steps
  FormFlowRoot.Review = Review
  FormFlowRoot.Finish = Finish
  FormFlowRoot.Confirmation = Confirmation
  FormFlowRoot.resolveActivePages = resolveActivePages
  FormFlowRoot.inactivePages = inactivePages
  FormFlowRoot.resolveNextPage = resolveNextPage
  FormFlowRoot.resolvePreviousPage = resolvePreviousPage
  FormFlowRoot.resolvePagePath = resolvePagePath
  FormFlowRoot.syncRepeatTables = syncRepeatTables
  FormFlowRoot.formatValue = formatValue
  FormFlowRoot.requestReview = requestReview
  FormFlowRoot.formatText = formatText
  FormFlowRoot.noteSubmitAttempt = noteSubmitAttempt
  return FormFlowRoot
})()
