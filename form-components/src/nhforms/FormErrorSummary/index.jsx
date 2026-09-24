// FormErrorSummary — accessible validation summary rendered under the form
// title: role="alert", a heading, tabIndex=-1 and focused when it appears;
// each issue is a link that jumps to the issue's page and focuses the field
// (FormLogicKit.focusField). Reads uiState.__formErrors =
// { source: "submit" | "page", pageIndex?, inactivePages?, issues: FormValidationIssue[] },
// written by the emitted validateSubmitPayload (submit) and FormFlow (Next).
//
// Props:
//   validationConfigs  formValidationConfigs; when given, issues the person has
//                      since fixed drop out of the summary without a resubmit.
//   pageNames          page titles, to say where an issue on another page is.
//   title              heading text (default "There is a problem").
//   translate          the form's translateFormText; the heading, "Page n"
//                      and re-checked validation messages go through it.
//
// Accessibility: the summary is markup we own, so it carries full ARIA. The
// MOIS controls are not ours (their error text, label association and DOM ids
// are the engine's), so as progressive enhancement the summary sets
// aria-invalid="true" on each located input and points its aria-describedby
// at the summary entry for that field. Nothing is inserted into the control's
// DOM; everything added is removed again when the issue clears.
//
// FormLogicKit is referenced only inside function bodies (component files
// load in no guaranteed order).

const FormErrorSummary = (() => {
  const ENTRY_PREFIX = "wf-error-summary-"
  const MARK = "data-wf-error-summary-invalid"

  const safeId = (value) => ENTRY_PREFIX + String(value || "").replace(/[^A-Za-z0-9_-]/g, "_")

  const later = (callback, delay) => {
    if (typeof window !== "undefined" && typeof window.setTimeout === "function") window.setTimeout(callback, delay || 0)
    else callback()
  }

  // The page switch commits first; retry briefly until the field is mounted.
  const focusFieldSoon = (fieldId, label, attempt) => {
    later(() => {
      const focused = typeof FormLogicKit !== "undefined" && FormLogicKit.focusField(fieldId, label)
      if (!focused && (attempt || 0) < 5) focusFieldSoon(fieldId, label, (attempt || 0) + 1)
    }, attempt ? 40 : 0)
  }

  // The input MOIS rendered for a field (FormLogicKit.locateField: id /
  // [data-field-id] in preview; radio name or the control beside the field's
  // <label> in the real MOIS runtime, whose inputs carry generated ids).
  const locateInput = (fieldId, label) => {
    if (typeof FormLogicKit === "undefined" || typeof FormLogicKit.locateField !== "function") return null
    const found = FormLogicKit.locateField(fieldId, label)
    const control = found && found.control
    return control && control.matches && control.matches("input, textarea, select, [role=combobox]") ? control : null
  }

  const describe = (element, entryId) => {
    const current = (element.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)
    if (!current.includes(entryId)) element.setAttribute("aria-describedby", current.concat(entryId).join(" "))
    if (element.getAttribute("aria-invalid") !== "true") {
      element.setAttribute("aria-invalid", "true")
      element.setAttribute(MARK, entryId)
    } else if (!element.hasAttribute(MARK)) {
      element.setAttribute(MARK, "")
    }
  }

  const undescribe = (element, entryId) => {
    const remaining = (element.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== entryId)
    if (remaining.length) element.setAttribute("aria-describedby", remaining.join(" "))
    else element.removeAttribute("aria-describedby")
    // Only undo aria-invalid we set ourselves.
    if (element.getAttribute(MARK) === entryId) element.removeAttribute("aria-invalid")
    element.removeAttribute(MARK)
  }

  const issueText = (issue) => {
    const message = String((issue && issue.message) || "")
    const label = String((issue && issue.label) || "").trim()
    if (!label || issue.kind === "required" || message.indexOf(label) === 0) return message
    return label + ": " + message
  }

  // `translate` is the form's translateFormText (uiTranslations keyed by the
  // English source text for __formLocale); {name} placeholders filled after.
  const formatText = (translate, source, vars) => {
    let text = source === undefined || source === null ? "" : String(source)
    if (typeof translate === "function" && text) {
      const translated = translate(text)
      if (typeof translated === "string" && translated) text = translated
    }
    if (vars) Object.keys(vars).forEach((key) => { text = text.split("{" + key + "}").join(String(vars[key])) })
    return text
  }

  const FormErrorSummaryView = ({ validationConfigs, pageNames, title, translate }) => {
    const t = (source, vars) => formatText(translate, source, vars)
    const [fd, setFd] = useActiveData()
    const rootRef = React.useRef(null)
    const uiState = (fd && fd.uiState) || {}
    const errors = uiState.__formErrors || null
    const data = (fd && fd.field && fd.field.data) || {}
    const locale = (fd && fd.field && fd.field.status && fd.field.status.__formLocale) || ""
    // MOIS starts with no breadcrumbSelectedKey: page 0 until PageSelect /
    // FormFlow writes one (same `?? 0` as the native Page / PageStepButton).
    const storedPage = uiState.breadcrumbSelectedKey
    const currentPage = storedPage === undefined || storedPage === null || storedPage === "" ? 0 : Number(storedPage)

    const stored = errors && Array.isArray(errors.issues) ? errors.issues : []
    // Drop issues fixed since the check ran. Cross-field and other issues the
    // configs cannot re-check stay until the next submit / Next.
    let issues = stored
    if (Array.isArray(validationConfigs) && validationConfigs.length && typeof FormLogicKit !== "undefined" && stored.length) {
      const fresh = FormLogicKit.validate(validationConfigs, data, {
        pageIndex: errors.source === "page" && typeof errors.pageIndex === "number" ? errors.pageIndex : undefined,
        inactivePages: Array.isArray(errors.inactivePages) ? errors.inactivePages : undefined,
        locale,
        translate,
      })
      const known = new Set(validationConfigs.map((config) => config && config.fieldId))
      const failing = new Map()
      fresh.forEach((issue) => {
        const key = issue.fieldId + "|" + issue.kind
        if (!failing.has(key)) failing.set(key, issue)
      })
      issues = stored
        .filter((issue) => (
          issue.kind === "cross-field" || issue.fieldId === "_form" || !known.has(issue.fieldId) ||
          failing.has(issue.fieldId + "|" + issue.kind)
        ))
        // A still-failing issue shows its current message: "complete A, B and
        // C" becomes "complete C" as rows are finished.
        .map((issue) => {
          const current = failing.get(issue.fieldId + "|" + issue.kind)
          return current && current.message !== issue.message ? { ...issue, message: current.message } : issue
        })
    }

    // One entry per field (a multi-part date or a field with two problems is
    // still one link), first message wins.
    const entries = []
    const seen = new Set()
    issues.forEach((issue) => {
      if (!issue || seen.has(issue.fieldId)) return
      seen.add(issue.fieldId)
      entries.push(issue)
    })

    // Focus the summary when a submit / Next writes a new error set.
    React.useEffect(() => {
      if (!errors || !entries.length) return
      const node = rootRef.current
      if (node && typeof node.focus === "function") {
        try {
          if (typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "start" })
        } catch (error) {
          // Some hosts do not implement scrolling.
        }
        node.focus()
      }
    }, [errors])

    // Progressive ARIA enhancement on the MOIS inputs.
    const signature = entries.map((issue) => issue.fieldId).join("\u0000")
    React.useEffect(() => {
      const touched = []
      entries.forEach((issue) => {
        const element = locateInput(issue.fieldId, issue.label)
        if (!element) return
        const entryId = safeId(issue.fieldId)
        describe(element, entryId)
        touched.push([element, entryId])
      })
      return () => touched.forEach(([element, entryId]) => undescribe(element, entryId))
    }, [signature, currentPage])

    if (!entries.length) return null

    const names = Array.isArray(pageNames) ? pageNames : []
    const jump = (event, issue) => {
      if (event && typeof event.preventDefault === "function") event.preventDefault()
      const setter = fd && typeof fd.setFormData === "function" ? fd.setFormData : setFd
      if (typeof issue.pageIndex === "number" && issue.pageIndex !== currentPage && typeof setter === "function") {
        setter(produce((draft) => {
          if (!draft) return
          draft.uiState = draft.uiState || {}
          draft.uiState.breadcrumbSelectedKey = issue.pageIndex
        }))
      }
      focusFieldSoon(issue.fieldId, issue.label, 0)
    }

    const heading = t(title || "There is a problem")
    const headingId = ENTRY_PREFIX + "title"
    return (
      <div
        ref={rootRef}
        role="alert"
        aria-labelledby={headingId}
        tabIndex={-1}
        data-form-error-summary=""
        className="hideonprint"
        style={{ border: "3px solid rgb(164, 38, 44)", borderRadius: 2, padding: "12px 16px", margin: "8px 0 16px", background: "#fff", outlineOffset: 2 }}
      >
        <h2 id={headingId} style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: "rgb(50, 49, 48)" }}>{heading}</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {entries.map((issue) => {
            const other = typeof issue.pageIndex === "number" && issue.pageIndex !== currentPage && names.length > 1
            const where = other ? " (" + (names[issue.pageIndex] || t("Page {n}", { n: issue.pageIndex + 1 })) + ")" : ""
            return (
              <li key={issue.fieldId} id={safeId(issue.fieldId)} style={{ margin: "4px 0" }}>
                {issue.fieldId === "_form" ? (
                  <span style={{ color: "rgb(164, 38, 44)", fontWeight: 600 }}>{issue.message}</span>
                ) : (
                  <a
                    href={"#" + issue.fieldId}
                    onClick={(event) => jump(event, issue)}
                    style={{ color: "rgb(164, 38, 44)", fontWeight: 600, textDecoration: "underline" }}
                  >
                    {issueText(issue) + where}
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  FormErrorSummaryView.issueText = issueText
  return FormErrorSummaryView
})()
