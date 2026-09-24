// FormLogicKit — shared runtime kernel for form-level logic: condition-group
// evaluation, rule-aware field visibility, submit/page validation, value
// formats, and focusing a field from an error summary. Consumed by FormFlow,
// FormErrorSummary, RepeatForEachTable and inline code the MOIS exporter
// emits. Non-rendering helper module in the ObservationKit pattern: it exports
// a single namespace object so consumers keep one bare identifier in engine
// scope.
//
// Consumers must reference FormLogicKit only inside function bodies —
// component files load in no guaranteed order, so a top-level read of another
// module's export can run before that module has been evaluated.
//
// Condition semantics are ported from ConditionalGroup (evaluateConditionEntry
// / validateFieldBehaviors) and must stay in parity with
// packages/form-model/src/conditions.ts.

const FormLogicKit = (() => {
  const toText = (value) => {
    if (value === null || value === undefined) return ""
    return String(value)
  }

  // Values may be plain scalars or {code, display} coded objects.
  const normalizeComparableValue = (value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value.code ?? value.display ?? value.value ?? value.text ?? ""
    }
    return value
  }

  // Whether one cell (or nested value) holds an answer: EditableTable's rules,
  // the same as tableCellAnswered below except NaN/Infinity (finite only).
  const isAnsweredCell = (value) => {
    if (value === null || value === undefined) return false
    if (typeof value === "string") return value.trim() !== ""
    if (typeof value === "boolean") return value
    if (typeof value === "number") return Number.isFinite(value)
    if (Array.isArray(value)) return value.some(isAnsweredCell)
    if (typeof value === "object") return Object.keys(value).length > 0
    return String(value).trim() !== ""
  }

  // Whether one entry of a collection answer (table row, multi-select item)
  // holds a real answer. On a row, "_"-prefixed keys are bookkeeping (_rowId,
  // _sourceKey, _complete, ...). Parity: isConditionEntryMeaningful in
  // @webforms/form-model.
  const isMeaningfulEntry = (value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value).some((key) => !key.startsWith("_") && isAnsweredCell(value[key]))
    }
    return isAnsweredCell(value)
  }

  // "is empty" for any answer; parity with isConditionValueEmpty in
  // @webforms/form-model. Collections (table rows as an array or
  // { rows: [...] }, multi-select items) are empty unless an entry holds a
  // real answer; scalars and coded objects use the comparable value.
  const isEmptyValue = (value) => {
    const entries = Array.isArray(value)
      ? value
      : value && typeof value === "object" && Array.isArray(value.rows) ? value.rows : undefined
    if (entries) return !entries.some(isMeaningfulEntry)
    const normalized = normalizeComparableValue(value)
    return normalized === undefined || normalized === null || String(normalized).trim() === ""
  }

  const hasMeaningfulValue = (value) => !isEmptyValue(value)

  // Direct key first, then a nested search (sections store answers in nested
  // objects on some legacy forms) — same lookup ConditionalGroup uses.
  const readValue = (data, fieldId) => {
    if (!data || !fieldId) return undefined
    if (Object.prototype.hasOwnProperty.call(data, fieldId)) return data[fieldId]
    if (typeof data !== "object") return undefined
    for (const value of Object.values(data)) {
      if (value && typeof value === "object") {
        const nested = readValue(value, fieldId)
        if (nested !== undefined) return nested
      }
    }
    return undefined
  }

  // Accept either a getter function or a values object.
  const toGetter = (getValue) => (
    typeof getValue === "function" ? getValue : (id) => readValue(getValue || {}, id)
  )

  const normalizeYesNo = (value) => {
    if (value && typeof value === "object") {
      return normalizeYesNo(value.code ?? value.display ?? value.value ?? value.text ?? value.label)
    }
    if (value === true || value === "yes" || value === "Y" || value === 1) return "yes"
    if (value === false || value === "no" || value === "N" || value === 0) return "no"
    return null
  }

  const checkYesNo = (value, expected) => {
    const normalized = normalizeYesNo(value)
    return normalized !== null && normalized === expected
  }

  const checkChoiceMatch = (fieldValue, optionValues, invert) => {
    if (fieldValue === null || fieldValue === undefined) return invert
    const flatten = (value) => {
      if (Array.isArray(value)) return value.flatMap(flatten)
      if (value && typeof value === "object") {
        return [value.code, value.display, value.value, value.text]
          .filter((entry) => entry !== null && entry !== undefined)
          .map((entry) => String(entry))
      }
      return [String(value)]
    }
    const options = (optionValues || []).map((entry) => String(entry))
    const values = flatten(fieldValue)
    const hasMatch = options.some((option) => values.includes(option))
    return invert ? !hasMatch : hasMatch
  }

  const checkComparisonMatch = (fieldValue, operator, expectedValue) => {
    const normalized = normalizeComparableValue(fieldValue)
    if (operator === "filled") return !isEmptyValue(fieldValue)
    if (operator === "empty") return !checkComparisonMatch(fieldValue, "filled", expectedValue)
    if (normalized === null || normalized === undefined || normalized === "") return false
    if (operator && operator.startsWith("number-")) {
      // Numbers when both sides are numeric, dates otherwise (cross-field date
      // order rules). Mirrors toOrderedPair in @webforms/form-model.
      let left = Number(normalized)
      const expected = normalizeComparableValue(expectedValue)
      if (expected == null || String(expected).trim() === "") return false
      let right = Number(expected)
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        left = Date.parse(String(normalized))
        right = Date.parse(String(expected))
      }
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false
      if (operator === "number-gt") return left > right
      if (operator === "number-gte") return left >= right
      if (operator === "number-lt") return left < right
      if (operator === "number-lte") return left <= right
      return left === right
    }
    const left = String(normalized)
    const right = String(normalizeComparableValue(expectedValue) ?? "")
    return operator === "not-equals" ? left !== right : left === right
  }

  // Leaf entries come in two shapes: the compiled flat contract
  // ({controllerFieldId, type, optionValues?, value?, compareFieldId?}) that the
  // exporter emits, or the builder shape ({controllerFieldId, condition: {...}}).
  const toFlatEntry = (entry) => (
    entry && entry.condition && typeof entry.condition === "object"
      ? { ...entry.condition, controllerFieldId: entry.controllerFieldId }
      : entry
  )

  const evaluateEntry = (rawEntry, get) => {
    if (rawEntry && Array.isArray(rawEntry.conditions)) {
      return evaluateEntries(rawEntry.conditions, rawEntry.match, get)
    }
    const entry = toFlatEntry(rawEntry)
    if (!entry || !entry.controllerFieldId || !entry.type) return false
    const fieldValue = get(entry.controllerFieldId)
    const type = entry.type
    if (type === "choice-selected") return checkChoiceMatch(fieldValue, entry.optionValues, false)
    if (type === "choice-not-selected") return checkChoiceMatch(fieldValue, entry.optionValues, true)
    if (type === "boolean-yes") return checkYesNo(fieldValue, "yes")
    if (type === "boolean-no") return checkYesNo(fieldValue, "no")
    // An unanswered compare field means no match, so a half-filled form
    // raises nothing.
    const compareFieldId = entry.compareFieldId || entry.valueFieldId
    if (compareFieldId) {
      const compareValue = get(compareFieldId)
      if (!checkComparisonMatch(compareValue, "filled", null)) return false
      return checkComparisonMatch(fieldValue, type, compareValue)
    }
    return checkComparisonMatch(fieldValue, type, entry.value)
  }

  // match "all" (default) or "any". Empty entries = no match.
  const evaluateEntries = (entries, match, get) => {
    if (!Array.isArray(entries) || entries.length === 0) return false
    return match === "any"
      ? entries.some((entry) => evaluateEntry(entry, get))
      : entries.every((entry) => evaluateEntry(entry, get))
  }

  /** Evaluate a (compiled or builder-shape) condition group. Missing/empty group = false. */
  const evaluateGroup = (group, getValue) => {
    if (!group || typeof group !== "object") return false
    return evaluateEntries(group.conditions, group.match, toGetter(getValue))
  }

  /**
   * Whether a field is hidden by its own compiled behaviour config
   * (compileFieldBehavior + gates): explicitly hidden, a failed subgroup gate,
   * no matching show rule, or a matching hide rule.
   */
  const isFieldHidden = (config, getValue) => {
    if (!config) return false
    const get = toGetter(getValue)
    const matches = (group) => evaluateEntries(group?.conditions, group?.match, get)
    const rules = config.rules || []
    const showRules = rules.filter((rule) => rule.action === "show")
    return Boolean(
      config.hidden ||
      (config.gates || []).some((gate) => !matches(gate)) ||
      (showRules.length > 0 && !showRules.some(matches)) ||
      rules.some((rule) => rule.action === "hide" && matches(rule))
    )
  }

  // Copy rules resolve together (targets may sit on unmounted pages); a copy
  // cycle is reported as a form-level problem. Port of ConditionalGroup's
  // resolveFieldCopies.
  const resolveFieldCopies = (configs, original) => {
    const next = JSON.parse(JSON.stringify(original || {}))
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    for (let pass = 0; pass < Math.min(configs.length + 2, 100); pass++) {
      const before = JSON.stringify(next)
      for (const config of configs) {
        const rules = config.rules || []
        const matches = (rule) => evaluateEntries(rule.conditions, rule.match, (id) => readValue(next, id))
        let protectedField = false
        rules.forEach((rule) => {
          if (matches(rule) && (rule.action === "set-readonly" || rule.action === "clear-readonly")) {
            protectedField = rule.action === "set-readonly"
          }
        })
        if (protectedField) continue
        const rule = [...rules].reverse().find((candidate) => candidate.action === "copy-value" && candidate.copyFromFieldId !== config.fieldId && matches(candidate))
        if (!rule) continue
        const source = readValue(next, rule.copyFromFieldId)
        const value = readValue(next, config.fieldId)
        if (source === undefined || same(source, value)) continue
        const state = next.__fieldCopyState?.[config.fieldId]
        const edited = state?.edited || (state && !same(value, state.value))
        const policy = rule.copyPolicy || "when-empty"
        const mayCopy = policy === "always" || (policy === "until-edited" ? !edited && (state || !hasMeaningfulValue(value)) : !hasMeaningfulValue(value))
        if (mayCopy) {
          next[config.fieldId] = JSON.parse(JSON.stringify(source))
          next.__fieldCopyState = { ...next.__fieldCopyState, [config.fieldId]: { value: source, edited: false } }
        } else if (policy === "until-edited" && edited && !state?.edited) {
          next.__fieldCopyState = { ...next.__fieldCopyState, [config.fieldId]: { ...state, edited: true } }
        }
      }
      if (before === JSON.stringify(next)) return { values: next, error: "" }
    }
    return { values: original, error: "Copy rules did not settle. Check the dependency map for a cycle." }
  }

  /**
   * Value formats keyed by BuilderValueFormat ("bc-phn", "ca-postal",
   * "money"): { test(value) => boolean, message }. An unknown format never
   * raises an issue. Must stay in parity with lib/validation/formats.ts (the
   * shared vectors in lib/__tests__/value-formats.test.ts run through both).
   */
  const formatText = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : null
    if (typeof value !== "string") return null
    return value.trim()
  }
  const PHN_WEIGHTS = [2, 4, 8, 5, 10, 9, 7, 3]
  const formats = {
    // BC PHN: 10 digits starting with 9; digits 2-9 times the weights, each
    // product mod 11, summed; check digit = 11 - (sum mod 11).
    "bc-phn": {
      message: "Enter a valid 10-digit BC Personal Health Number (it starts with 9)",
      test: (value) => {
        const text = formatText(value)
        if (text === null) return false
        const digits = text.replace(/[\s-]/g, "")
        if (!/^9\d{9}$/.test(digits)) return false
        let sum = 0
        for (let index = 0; index < PHN_WEIGHTS.length; index++) {
          sum += (Number(digits[index + 1]) * PHN_WEIGHTS[index]) % 11
        }
        return 11 - (sum % 11) === Number(digits[9])
      },
    },
    "ca-postal": {
      message: "Enter a valid Canadian postal code, like A1A 1A1",
      test: (value) => typeof value === "string" &&
        /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/.test(value.trim().toUpperCase()),
    },
    money: {
      message: "Enter an amount in dollars and cents, like 12.50",
      test: (value) => {
        if (typeof value === "number") {
          return Number.isFinite(value) && value >= 0 && Math.abs(Math.round(value * 100) - value * 100) < 1e-6
        }
        return typeof value === "string" && /^\$?\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(value.trim())
      },
    },
  }

  // ---- Table row completion (repeat-for-each workstream) — begin ----
  // config.table = { requiredColumnIds (row data paths), requireAllComplete }.
  // Rows seeded from another table (_sourceKey) must be completed; manual rows
  // only once started; rows flagged _sourceRemoved never block. Cell answers
  // use EditableTable's rules (an unchecked checkbox is not an answer), the
  // same as RepeatForEachTable's _complete flag.
  const tableCellAnswered = (value) => {
    if (value === undefined || value === null) return false
    if (typeof value === "string") return value.trim().length > 0
    if (typeof value === "boolean") return value
    if (typeof value === "number") return !Number.isNaN(value)
    if (Array.isArray(value)) return value.some(tableCellAnswered)
    if (typeof value === "object") return Object.keys(value).length > 0
    return true
  }
  const tableRowIssues = (config, value, required, issue, translate) => {
    const rows = Array.isArray(value) ? value : Array.isArray(value?.rows) ? value.rows : []
    const cell = (row, path) => String(path || "").split(".").filter(Boolean)
      .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), row)
    const started = (row) => !!row && typeof row === "object" &&
      Object.keys(row).some((key) => key.charAt(0) !== "_" && tableCellAnswered(row[key]))
    const counted = rows.filter((row) => row && !row._sourceRemoved && (row._sourceKey || started(row)))
    if (counted.length === 0) {
      return required ? [issue("required", translate(config.label + " is required"))] : []
    }
    const paths = config.table.requiredColumnIds || []
    if (!config.table.requireAllComplete || paths.length === 0) return []
    // One issue per table (the error summary links once per field) naming
    // every incomplete row: "Adherence: complete Metformin, Atorvastatin and row 4".
    const names = counted
      .filter((row) => !paths.every((path) => tableCellAnswered(cell(row, path))))
      .map((row) => (row._sourceLabel ? String(row._sourceLabel) : "row " + (rows.indexOf(row) + 1)))
    if (names.length === 0) return []
    const list = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]
    return [issue("row-incomplete", translate(config.label + ": complete " + list))]
  }

  // How many rows a repeat-for-each table WOULD have for the current answers,
  // counted from its SOURCE table (the follower may not be synced yet, e.g.
  // its page was never shown): source rows with any answered cell that pass
  // repeatFor.filter and have a non-empty key. Same rules as
  // RepeatForEachTable.helpers.syncRows; parity with countRepeatItems in
  // lib/page-flow. Used by FormFlow's page "skip when there are no items".
  const repeatKeyText = (value) => {
    if (value === undefined || value === null) return ""
    if (typeof value === "string") return value.trim()
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (Array.isArray(value)) return value.map(repeatKeyText).filter(Boolean).join(", ")
    if (typeof value === "object") return repeatKeyText(value.display ?? value.text ?? value.value ?? value.code ?? value.key ?? "")
    return String(value)
  }
  const repeatItemCount = (values, repeatFor) => {
    if (!repeatFor || !repeatFor.sourceFieldId) return 0
    const data = values || {}
    const raw = repeatFor.sourceRowsPath
      ? String(repeatFor.sourceRowsPath).split(".").filter(Boolean)
        .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), data)
      : readValue(data, repeatFor.sourceFieldId)
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw && raw.rows) ? raw.rows : []
    const cell = (row, path) => String(path || "").split(".").filter(Boolean)
      .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), row)
    const filter = repeatFor.filter
    const hasFilter = !!(filter && Array.isArray(filter.conditions) && filter.conditions.length > 0)
    return rows.filter((row, index) => {
      if (!row || typeof row !== "object") return false
      if (!Object.keys(row).some((key) => key.charAt(0) !== "_" && tableCellAnswered(row[key]))) return false
      if (hasFilter && !evaluateGroup(filter, (columnId) => cell(row, columnId))) return false
      const key = repeatFor.keyColumnId ? repeatKeyText(cell(row, repeatFor.keyColumnId)) : String(row._rowId || "row_" + index)
      return key !== ""
    }).length
  }
  // ---- Table row completion — end ----

  /**
   * Validate answers against compiled field configs
   * (CompiledFieldValidationConfig in lib/mois-export/types.ts).
   * options: { pageIndex?, inactivePages?, locale?, uiTranslations?, translate? }
   * `translate` (the form's translateFormText) wins over uiTranslations.
   * Returns FormValidationIssue[]: { fieldId, label, message, pageIndex?, kind }.
   */
  const validate = (configs, values, options = {}) => {
    const list = Array.isArray(configs) ? configs : []
    const locale = options.locale || ""
    const uiTranslations = options.uiTranslations || {}
    const translate = typeof options.translate === "function"
      ? (source) => options.translate(source) || source
      : (source) => uiTranslations[locale]?.[source] || source
    const inactivePages = new Set(Array.isArray(options.inactivePages) ? options.inactivePages : [])
    const scoped = list.filter((config) => {
      const pageIndex = typeof config.pageIndex === "number" ? config.pageIndex : 0
      if (inactivePages.has(pageIndex)) return false
      return typeof options.pageIndex === "number" ? pageIndex === options.pageIndex : true
    })
    const copyResult = resolveFieldCopies(list, values)
    if (copyResult.error) {
      return [{ fieldId: "_form", label: "", message: copyResult.error, kind: "rule" }]
    }
    const get = (id) => readValue(values, id)
    const matches = (group) => evaluateEntries(group?.conditions, group?.match, get)
    return scoped.flatMap((config) => {
      if (isFieldHidden(config, get)) return []
      const issue = (kind, message) => ({
        fieldId: config.fieldId,
        label: config.label,
        message,
        pageIndex: config.pageIndex,
        kind,
      })
      let required = config.required
      ;(config.rules || []).forEach((rule) => {
        if (matches(rule)) {
          if (rule.action === "set-required") required = config.requiredCapable !== false
          if (rule.action === "clear-required") required = false
        }
      })
      const value = get(config.fieldId)
      if (config.table) return tableRowIssues(config, value, required, issue, translate) // table rows (repeat-for-each)
      if (!hasMeaningfulValue(value)) {
        return required ? [issue("required", translate(config.label + " is required"))] : []
      }
      const issues = (config.validations || [])
        .filter((rule) => !matches(rule.validWhen))
        .map((rule) => issue("rule", rule.translations?.[locale] || rule.message))
      const format = config.format ? formats[config.format] : null
      if (format && typeof format.test === "function" && !format.test(value)) {
        issues.push(issue("format", config.formatMessage || translate(format.message || (config.label + " is not valid"))))
      }
      const selected = Array.isArray(value) ? value : [value]
      const optionBlocked = (config.optionRules || []).some((rule) =>
        selected.some((option) => String(normalizeComparableValue(option)) === rule.value) &&
        ((rule.showWhen && !matches(rule.showWhen)) || (rule.disableWhen && matches(rule.disableWhen)))
      )
      if (optionBlocked) issues.push(issue("option", translate(config.label + ": choose an available option")))
      return issues
    })
  }

  const FOCUSABLE = "input, textarea, select, button, [tabindex]"
  // Enabled controls only: a disabled/read-only display cell (e.g. a
  // repeat-for-each label column) cannot take focus.
  const CONTROL = "input:not([disabled]):not([type=hidden]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [role=combobox]:not([aria-disabled=true]), [tabindex]:not([tabindex=\"-1\"])"

  const escapeAttr = (value) => (
    typeof CSS !== "undefined" && CSS && typeof CSS.escape === "function"
      ? CSS.escape(toText(value))
      : toText(value).replace(/["\\]/g, "\\$&")
  )

  // A field label as rendered, without the required marker.
  const labelText = (element) => toText(element && element.textContent).replace(/\s*\*\s*$/, "").trim()

  /**
   * The element that stands for a field on screen: { control, wrapper }.
   * Preview controls carry id=fieldId / [data-field-id]; the real MOIS
   * runtime does not (its TextField inputs get generated ids such as
   * "TextField27", OptionChoice radios get name=fieldId, and a LayoutItem
   * renders <div><label>Label</label>...control...</div>). So after the id
   * lookups this falls back to radios by name, repeat-for-each tables by
   * their wrapper, and finally the control beside a <label> with the
   * field's label text. `label` is optional.
   */
  const locateField = (fieldId, label) => {
    if (typeof document === "undefined" || !fieldId) return null
    const byId = document.getElementById(toText(fieldId))
    if (byId && byId.matches && byId.matches(FOCUSABLE)) return { control: byId, wrapper: byId }
    const escaped = escapeAttr(fieldId)
    const wrapper = byId ||
      document.querySelector("[data-field-id=\"" + escaped + "\"]") ||
      document.querySelector("[data-repeat-for-table=\"" + escaped + "\"]")
    if (wrapper) {
      return { control: wrapper.querySelector ? wrapper.querySelector(CONTROL) : null, wrapper }
    }
    const radios = Array.from(document.querySelectorAll("input[name=\"" + escaped + "\"]:not([disabled])"))
    if (radios.length > 0) {
      const checked = radios.find((radio) => radio.checked)
      return { control: checked || radios[0], wrapper: radios[0].parentElement || radios[0] }
    }
    const wanted = toText(label).replace(/\s*\*\s*$/, "").trim()
    if (!wanted) return null
    const labels = Array.from(document.querySelectorAll("label")).filter((element) => labelText(element) === wanted)
    for (const element of labels) {
      const container = element.parentElement
      const control = container && container.querySelector ? container.querySelector(CONTROL) : null
      if (control) return { control, wrapper: container }
    }
    return null
  }

  /**
   * Move focus to a field (see locateField for how it is found), else just
   * scroll its wrapper into view. Returns true when something received focus
   * or was scrolled to.
   */
  const focusField = (fieldId, label) => {
    const found = locateField(fieldId, label)
    if (!found) return false
    const { control, wrapper } = found
    if (control && typeof control.focus === "function") {
      if (typeof control.scrollIntoView === "function") control.scrollIntoView({ block: "center" })
      control.focus()
      return true
    }
    if (wrapper && typeof wrapper.scrollIntoView === "function") {
      wrapper.scrollIntoView({ block: "center" })
      return true
    }
    return false
  }

  return {
    hasMeaningfulValue,
    isEmptyValue,
    readValue,
    evaluateGroup,
    isFieldHidden,
    resolveFieldCopies,
    validate,
    repeatItemCount,
    formats,
    locateField,
    focusField,
  }
})()
