// FormLogicKit — shared runtime kernel for form-level logic: condition-group
// evaluation, builder visibility rules (also per table column and row),
// rule-aware field visibility, submit/page validation, value formats, and
// focusing a field from an error summary. Consumed by FormFlow,
// FormErrorSummary, EditableTable, RepeatForEachTable, SubformScoring,
// LayoutTable and inline code the MOIS exporter emits. Non-rendering helper
// module in the ObservationKit pattern: it exports a single namespace object
// so consumers keep one bare identifier in engine scope.
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

  // ---- Builder visibility rules (BuilderVisibilityRule) — begin ----
  // { type, controllerId, value, additionalConditions?, match?, hiddenAnswerPolicy? }
  // with type always/filled/not-filled/equals/not-equals/gt/gte/lt/lte. Each
  // condition becomes a leaf of the same group evaluator the compiled rules
  // use, converted exactly as visibilityToCondition in lib/logic/unified-rule.ts
  // (and synthesizeInlineVisibilityRules in the exporter): equals on a boolean
  // controller is boolean-yes/no, on a choice controller choice-selected.
  const BOOLEAN_YES_TEXT = ["1", "true", "yes", "y", "on", "checked"]
  const BOOLEAN_NO_TEXT = ["0", "false", "no", "n", "off", "unchecked"]

  // A stored yes/no answer as true/false, or null when it is not one. Every
  // value normalizeYesNo reads keeps its meaning; stored text is also read
  // case-insensitively ("true", "y", a checkbox's "Checked") because table
  // cells and older subform rows stored those.
  const toBooleanAnswer = (value) => {
    if (value === true || value === false) return value
    if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return toBooleanAnswer(value.code ?? value.display ?? value.value ?? value.text ?? value.label)
    }
    if (typeof value !== "string") return null
    const text = value.trim().toLowerCase()
    if (BOOLEAN_YES_TEXT.includes(text)) return true
    if (BOOLEAN_NO_TEXT.includes(text)) return false
    return null
  }

  const visibilityLeaf = (condition, kind) => {
    const controllerFieldId = condition.controllerId
    const type = condition.type
    const value = condition.value === undefined || condition.value === null ? "" : condition.value
    if (type === "not-filled") return { controllerFieldId, type: "empty" }
    if (type === "gt" || type === "gte" || type === "lt" || type === "lte") {
      return { controllerFieldId, type: "number-" + type, value }
    }
    if (type === "equals" || type === "not-equals") {
      const negative = type === "not-equals"
      if (kind === "boolean") {
        const isNo = BOOLEAN_NO_TEXT.includes(String(value).trim().toLowerCase())
        return { controllerFieldId, type: isNo !== negative ? "boolean-no" : "boolean-yes" }
      }
      if (kind === "choice") {
        return { controllerFieldId, type: negative ? "choice-not-selected" : "choice-selected", optionValues: value === "" ? [] : [String(value)] }
      }
      return { controllerFieldId, type, value }
    }
    return { controllerFieldId, type: "filled" }
  }

  /**
   * Whether a builder visibility rule shows its target. `getValue(controllerId)`
   * returns the raw stored answer (a values object also works).
   * options.controllerKind(controllerId) => "boolean" | "choice" | "number" |
   * "text" | undefined picks the boolean/choice comparisons. No rule, "always"
   * or no controller = shown; additional conditions combine by `match`
   * ("all" default | "any"); one without a controller is ignored.
   */
  const evaluateVisibilityRule = (rule, getValue, options = {}) => {
    if (!rule || typeof rule !== "object" || !rule.type || rule.type === "always" || !rule.controllerId) return true
    const get = toGetter(getValue)
    const kindOf = options && typeof options.controllerKind === "function" ? options.controllerKind : () => undefined
    const leaves = [rule, ...(Array.isArray(rule.additionalConditions) ? rule.additionalConditions : [])]
      .filter((condition) => condition && condition.controllerId && condition.type !== "always")
      .map((condition) => visibilityLeaf(condition, kindOf(condition.controllerId)))
    // Boolean controllers compare their answer as true/false.
    const read = (controllerId) => {
      const raw = get(controllerId)
      if (kindOf(controllerId) !== "boolean") return raw
      const answer = toBooleanAnswer(raw)
      return answer === null ? raw : answer
    }
    return evaluateEntries(leaves, rule.match, read)
  }
  // ---- Builder visibility rules — end ----

  // ---- Layout-table rows — begin ----
  // A row's `visibleWhen` ({ fieldId, operator?, value? }) read exactly as
  // LayoutTable's rowIsVisible reads it, through ValueKit: "truthy" (default)
  // is answered and not a no, "yes" is a yes, "equals" / "notEquals" match a
  // code or wording (a boolean value as yes/no). Parity: isLayoutRowVisible in
  // @webforms/form-model. Without ValueKit the row counts as shown.
  const layoutRowAnswerEquals = (value, expected) => {
    if (value === expected) return true
    if (typeof expected === "boolean") return ValueKit.readBoolean(value) === expected
    if (expected === null || expected === undefined) return false
    const wanted = String(expected)
    return ValueKit.readChoice(value).some((entry) => entry.code === wanted || entry.display === wanted)
  }
  const isLayoutRowVisible = (visibleWhen, getValue) => {
    const fieldId = visibleWhen && visibleWhen.fieldId
    if (!fieldId) return true
    if (typeof ValueKit === "undefined" || !ValueKit || typeof ValueKit.readBoolean !== "function") return true
    const value = toGetter(getValue)(fieldId)
    switch (visibleWhen.operator || "truthy") {
      case "yes":
        return ValueKit.readBoolean(value) === true
      case "equals":
        return layoutRowAnswerEquals(value, visibleWhen.value)
      case "notEquals":
        return !layoutRowAnswerEquals(value, visibleWhen.value)
      default:
        return ValueKit.readBoolean(value) !== false && ValueKit.readChoice(value).length > 0
    }
  }
  // ---- Layout-table rows — end ----

  /**
   * Whether one gate passes. A gate is a compiled condition group (a subgroup
   * gate: { conditions, match }) or a nested entry's own show condition read
   * the way its container reads it: { layoutRow: visibleWhen } (LayoutTable's
   * row rule) or { visibility: rule, controllerKinds } (a cell's or subform
   * field's show-when rule, evaluateVisibilityRule with the container's own
   * answer kinds). A controller outside the container has no kind, as on screen.
   */
  const gatePasses = (gate, getValue) => {
    if (!gate || typeof gate !== "object") return true
    const get = toGetter(getValue)
    if (gate.layoutRow) return isLayoutRowVisible(gate.layoutRow, get)
    if (gate.visibility) {
      const kinds = gate.controllerKinds || {}
      return evaluateVisibilityRule(gate.visibility, get, {
        controllerKind: (id) => (Object.prototype.hasOwnProperty.call(kinds, id) ? kinds[id] : undefined),
      })
    }
    return evaluateEntries(gate.conditions, gate.match, get)
  }

  /**
   * Whether a field is hidden by its own compiled behaviour config
   * (compileFieldBehavior + gates): explicitly hidden, a failed gate, no
   * matching show rule, or a matching hide rule.
   */
  const isFieldHidden = (config, getValue) => {
    if (!config) return false
    const get = toGetter(getValue)
    const matches = (group) => evaluateEntries(group?.conditions, group?.match, get)
    const rules = config.rules || []
    const showRules = rules.filter((rule) => rule.action === "show")
    return Boolean(
      config.hidden ||
      (config.gates || []).some((gate) => !gatePasses(gate, get)) ||
      (showRules.length > 0 && !showRules.some(matches)) ||
      rules.some((rule) => rule.action === "hide" && matches(rule))
    )
  }

  // ---- Hidden answers — begin ----
  // The one hidden-answer rule, shared by ConditionalField, FormFlow's
  // inactive pages and EditableTable's columns (parity: hiddenAnswerPolicyOf /
  // shouldClearHiddenAnswer / shouldDropHiddenAnswer in @webforms/form-model).
  // An answer on a field hidden by its show/hide logic is kept unless the
  // rule's hiddenAnswerPolicy is "clear". With "clear" it is removed when the
  // field BECOMES hidden while the form is filled, and left out of the saved
  // answers at save and submit (dropHiddenAnswers) while it is hidden. A form
  // that opens with the field hidden never clears it (a chart-filled
  // controller may resolve after mount). The static Hidden flag never clears.

  /** "clear" when any show/hide rule (or a rule without an action: a field rule, a page) asks to clear. */
  const hiddenAnswerPolicyOf = (rules) => {
    const list = Array.isArray(rules) ? rules : rules ? [rules] : []
    return list.some((rule) => (
      rule && rule.hiddenAnswerPolicy === "clear" &&
      (rule.action === undefined || rule.action === null || rule.action === "show" || rule.action === "hide")
    )) ? "clear" : "preserve"
  }

  /** Whether there is a stored answer to remove (null, undefined and "" are already empty). */
  const hasHiddenAnswer = (value) => value !== undefined && value !== null && value !== ""

  /**
   * Whether a stored answer is removed now: policy "clear", the field has just
   * become hidden by its rules (wasHidden false: shown before this change),
   * something stored. wasHidden undefined/null (just opened) never clears.
   */
  const shouldClearHiddenAnswer = (policy, hidden, value, wasHidden) => (
    policy === "clear" && hidden === true && wasHidden === false && hasHiddenAnswer(value)
  )

  /** Whether an answer is left out of the saved answers: policy "clear", hidden by its rules now, something stored. */
  const shouldDropHiddenAnswer = (policy, hidden, value) => (
    policy === "clear" && hidden === true && hasHiddenAnswer(value)
  )

  /**
   * Remove the stored answers of `fieldIds` from a data object (an Immer
   * draft of fd.field.data). Mutates; returns the ids it removed.
   */
  const clearHiddenAnswers = (data, fieldIds) => {
    if (!data || typeof data !== "object") return []
    return (Array.isArray(fieldIds) ? fieldIds : []).filter((id) => {
      if (!hasHiddenAnswer(data[id])) return false
      delete data[id]
      return true
    })
  }

  /** `data` with the value at a dotted path replaced, copying each level (never mutates). */
  const withValueAtPath = (data, path, value) => {
    const segments = String(path || "").split(".").map((part) => part.trim()).filter(Boolean)
    if (segments.length === 0) return data
    const write = (node, index) => {
      const copy = node && typeof node === "object" && !Array.isArray(node) ? { ...node } : {}
      copy[segments[index]] = index === segments.length - 1 ? value : write(copy[segments[index]], index + 1)
      return copy
    }
    return write(data, 0)
  }

  /**
   * The table half of the save and submit rule, for an entry with `table`
   * ({ rowsPath?, columns }, the columns as EditableTable and
   * RepeatForEachTable get them): in each saved row, the answers of columns
   * hidden in that row whose rule says "clear" are blanked, as editing the row
   * would (clearHiddenTableAnswers), so a row loaded with a hidden answer and
   * never edited no longer keeps it. Rows are copied, never changed in place;
   * returns `data` itself when nothing changes.
   */
  const dropHiddenTableAnswers = (data, entry) => {
    const table = entry.table
    const path = (table && table.rowsPath) || entry.fieldId
    const stored = tableCell(data, path)
    const rows = Array.isArray(stored) ? stored : stored && Array.isArray(stored.rows) ? stored.rows : null
    if (!rows || rows.length === 0) return data
    let changed = false
    const nextRows = rows.map((row) => {
      if (!row || typeof row !== "object") return row
      const before = JSON.stringify(row)
      const copy = clearHiddenTableAnswers(JSON.parse(before), table.columns, { formData: data })
      if (JSON.stringify(copy) === before) return row
      changed = true
      return copy
    })
    if (!changed) return data
    return withValueAtPath(data, path, Array.isArray(stored) ? nextRows : { ...stored, rows: nextRows })
  }

  /**
   * The answers to save without those of hidden "clear" fields (the save and
   * submit half of the rule). entries: [{ fieldId, rules, gates?, table? }]
   * where rules are the field's compiled show/hide rules ({ action,
   * conditions, match, hiddenAnswerPolicy? }); an answer is left out while
   * those rules hide the field and hiddenAnswerPolicyOf(rules) is "clear"
   * (entry.hiddenAnswerPolicy overrides). A table entry (`table`) also blanks,
   * row by row, the answers of its hidden "clear" columns
   * (dropHiddenTableAnswers). Repeats until settled, since a dropped answer
   * can hide another field. Never mutates: returns a copy when something is
   * dropped, otherwise `data` itself.
   */
  const dropHiddenAnswers = (data, entries) => {
    if (!data || typeof data !== "object") return data
    const list = (Array.isArray(entries) ? entries : []).filter((entry) => entry && entry.fieldId)
    let next = data
    for (let pass = 0; pass <= list.length; pass += 1) {
      let changed = false
      list.forEach((entry) => {
        const policy = entry.hiddenAnswerPolicy || hiddenAnswerPolicyOf(entry.rules)
        const hidden = isFieldHidden({ rules: entry.rules || [], gates: entry.gates || [] }, next)
        if (shouldDropHiddenAnswer(policy, hidden, next[entry.fieldId])) {
          if (next === data) next = { ...data }
          delete next[entry.fieldId]
          changed = true
          return
        }
        if (!entry.table) return
        const kept = dropHiddenTableAnswers(next, entry)
        if (kept === next) return
        next = kept
        changed = true
      })
      if (!changed) break
    }
    return next
  }
  // ---- Hidden answers — end ----

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
    // The answer types' own formats (matchesValueFormat in
    // @webforms/form-model validation.ts): only text and number answers are
    // checked, other shapes pass.
    email: {
      message: "Please enter a valid email address",
      test: (value) => { const text = formatText(value); return text === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) },
    },
    phone: {
      message: "Please enter a valid phone number",
      test: (value) => { const text = formatText(value); return text === null || /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(text) },
    },
    url: {
      message: "Please enter a valid web address",
      test: (value) => { const text = formatText(value); return text === null || /^(?:https?:\/\/)?[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/i.test(text) },
    },
  }

  // ---- Neutral answer checks — begin ----
  // config.checks is a field's NeutralFieldValidation (readFieldValidation in
  // @webforms/form-model validation.ts) compiled by the exporter
  // (compileFieldValidationChecks): { requiredMessage?, formats?, length?,
  // number?, date?, patterns?, list?, crossField? }. answerIssues is the twin
  // of validateAnswer there, held to the shared cases in validation.cases.ts:
  // same checks, same order (format, length, number, date, pattern, list,
  // cross-field), same default messages.
  const checkedText = (value) => {
    if (typeof value === "string") return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    return null
  }
  const readNumberAnswer = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value !== "string") return null
    const cleaned = value.trim().replace(/[$,\s]/g, "")
    if (!cleaned || !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(cleaned)) return null
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  const readDateAnswer = (value) => (
    typeof ValueKit !== "undefined" && ValueKit && typeof ValueKit.readDate === "function" ? ValueKit.readDate(value) : null
  )
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const addCalendar = (date, amount, unit) => {
    if (unit === "days" || unit === "weeks") {
      const result = new Date(date)
      result.setDate(result.getDate() + amount * (unit === "weeks" ? 7 : 1))
      return result
    }
    const months = unit === "years" ? amount * 12 : amount
    const target = date.getMonth() + months
    const year = date.getFullYear() + Math.floor(target / 12)
    const month = ((target % 12) + 12) % 12
    const lastDay = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(date.getDate(), lastDay))
  }
  const resolveDateBound = (bound, today) => {
    if (!bound) return null
    if (bound.kind === "date") {
      const date = readDateAnswer(bound.date)
      return date ? startOfDay(date) : null
    }
    const anchor = startOfDay(today)
    if (bound.direction === "exact" || !bound.value) return anchor
    return addCalendar(anchor, bound.direction === "before" ? -bound.value : bound.value, bound.unit || "days")
  }
  const isoDay = (date) => {
    const pad = (value) => String(value).padStart(2, "0")
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
  }
  const anchoredPattern = (pattern) => {
    try {
      return new RegExp("^(?:" + pattern + ")$")
    } catch (error) {
      return null
    }
  }
  const listMessage = (list) => {
    if (list.match === "email-address") return list.mode === "allow" ? "Please use an approved email address" : "This email address is not allowed"
    if (list.match === "email-domain") return list.mode === "allow" ? "Please use an approved email domain" : "This email domain is not allowed"
    return list.mode === "allow" ? "Choose one of the allowed answers" : "This answer is not allowed"
  }

  // Cross-field checks of `kinds` ("valid-when" / "invalid-when"). A
  // behavior validation ("valid-when") keeps the issue kind "rule" the error
  // summary re-checks live; a Logic-tab invalid rule is "cross-field".
  const crossFieldIssues = (checks, kinds, get, issue, locale) => (
    (Array.isArray(checks.crossField) ? checks.crossField : [])
      .filter((check) => check && kinds.includes(check.kind))
      .filter((check) => {
        const holds = evaluateEntries(check.condition && check.condition.conditions, check.condition && check.condition.match, get)
        return check.kind === "valid-when" ? !holds : holds
      })
      .map((check) => {
        const translated = locale && check.translations && typeof check.translations[locale] === "string" && check.translations[locale].trim()
          ? check.translations[locale].trim()
          : null
        return issue(check.kind === "valid-when" ? "rule" : "cross-field", translated || check.message)
      })
  )

  /** Problems with a non-empty answer, in validateAnswer's order. */
  const answerIssues = (checks, value, get, issue, context) => {
    const translate = context.translate
    const issues = []
    let formatFailed = false
    ;(Array.isArray(checks.formats) ? checks.formats : []).forEach((check) => {
      const format = check && formats[check.format]
      if (!format || format.test(value)) return
      formatFailed = true
      issues.push(issue("format", check.message || translate(format.message)))
    })
    const text = checkedText(value)
    const length = checks.length
    if (length && text !== null) {
      const messages = length.messages || {}
      if (typeof length.min === "number" && text.length < length.min) issues.push(issue("length", messages.min || translate("Enter at least " + length.min + " characters")))
      if (typeof length.max === "number" && text.length > length.max) issues.push(issue("length", messages.max || translate("Enter at most " + length.max + " characters")))
    }
    const limit = checks.number
    if (limit && (typeof value === "number" || typeof value === "string")) {
      const number = readNumberAnswer(value)
      const messages = limit.messages || {}
      if (number === null) {
        issues.push(issue("number", translate("Please enter a number")))
      } else {
        if (limit.year && !(Number.isInteger(number) && number >= 1900 && number <= 2099)) {
          issues.push(issue("number", translate("Please enter a 4-digit year")))
        } else if (limit.wholeNumber && !Number.isInteger(number)) {
          issues.push(issue("number", translate("Please enter a whole number")))
        }
        if (typeof limit.min === "number" && number < limit.min) issues.push(issue("number", messages.min || translate("Enter a number of at least " + limit.min)))
        if (typeof limit.max === "number" && number > limit.max) issues.push(issue("number", messages.max || translate("Enter a number of at most " + limit.max)))
      }
    }
    const dateLimit = checks.date
    if (dateLimit) {
      const date = readDateAnswer(value)
      if (!date) {
        issues.push(issue("date", translate("Please enter a valid date")))
      } else {
        const day = startOfDay(date).getTime()
        const today = context.today instanceof Date ? context.today : (readDateAnswer(context.today) || new Date())
        ;(dateLimit.earliest || []).forEach((bound) => {
          const resolved = resolveDateBound(bound, today)
          if (resolved && day < resolved.getTime()) issues.push(issue("date", translate("Enter a date on or after " + isoDay(resolved))))
        })
        ;(dateLimit.latest || []).forEach((bound) => {
          const resolved = resolveDateBound(bound, today)
          if (resolved && day > resolved.getTime()) issues.push(issue("date", translate("Enter a date on or before " + isoDay(resolved))))
        })
      }
    }
    if (text !== null) {
      ;(Array.isArray(checks.patterns) ? checks.patterns : []).forEach((check) => {
        const pattern = check && anchoredPattern(check.pattern)
        if (pattern && !pattern.test(text)) issues.push(issue("pattern", check.message || translate("Enter the answer in the expected format")))
      })
    }
    // An answer that is not an email at all only gets the format message.
    const list = checks.list
    if (list && Array.isArray(list.values) && text !== null && !formatFailed) {
      const normalized = text.toLowerCase()
      const candidate = list.match === "email-domain" ? normalized.split("@")[1] || "" : normalized
      const listed = list.values.includes(candidate)
      if (list.mode === "allow" ? !listed : listed) issues.push(issue("list", list.message || translate(listMessage(list))))
    }
    return issues.concat(crossFieldIssues(checks, ["valid-when", "invalid-when"], get, issue, context.locale))
  }
  // ---- Neutral answer checks — end ----

  // ---- Table row completion (repeat-for-each workstream) — begin ----
  // config.table = { requiredColumnIds (row data paths), requireAllComplete,
  // columns? }. Rows seeded from another table (_sourceKey) must be completed;
  // manual rows only once started; rows flagged _sourceRemoved never block; a
  // column hidden in a row (its visibility rule) is not required there. Cell answers
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
  const tableCell = (row, path) => String(path || "").split(".").filter(Boolean)
    .reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), row)
  const setTableCell = (row, path, value) => {
    const segments = String(path || "").split(".").map((part) => part.trim()).filter(Boolean)
    if (segments.length === 0) return
    let current = row
    for (let index = 0; index < segments.length - 1; index += 1) {
      const key = segments[index]
      if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) current[key] = {}
      current = current[key]
    }
    current[segments[segments.length - 1]] = value
  }

  // EditableTable columns: a column's row path is dataPath || id, and its
  // type decides how a visibility rule naming it compares answers.
  const tableColumnPath = (column) => (column && (column.dataPath || column.fieldName || column.id)) || ""
  const tableColumnKind = (column) => {
    const type = column && column.type
    if (!type) return undefined
    if (type === "checkbox" || type === "booleanYesNo" || type === "booleanSingle") return "boolean"
    if (type === "dropdown" || type === "choice") return "choice"
    if (type === "number") return "number"
    return "text"
  }

  /**
   * Whether a table column is shown in one row. Its visibility rule's
   * controllerId (and each additional condition's) names a sibling column by
   * row path (or id); anything else is read from the row, then from the form
   * answers. options: { columns (the table's columns), formData }.
   */
  const isTableColumnVisible = (column, row, options = {}) => {
    const rule = column && column.visibility
    if (!rule || typeof rule !== "object") return true
    const columns = Array.isArray(options.columns) ? options.columns : []
    const sibling = (id) => columns.find((entry) => entry && (tableColumnPath(entry) === id || entry.id === id))
    const getValue = (id) => {
      const controller = sibling(id)
      if (controller) return tableCell(row, tableColumnPath(controller))
      const inRow = tableCell(row, id)
      if (inRow !== undefined) return inRow
      return options.formData ? readValue(options.formData, id) : undefined
    }
    return evaluateVisibilityRule(rule, getValue, { controllerKind: (id) => tableColumnKind(sibling(id)) })
  }

  /**
   * Blank the answers of columns hidden in this row whose rule asks for it
   * (hiddenAnswerPolicy "clear"; "preserve"/"keep"/absent keep them), plus
   * their choiceBooleanTargets. Repeats until settled, since a cleared answer
   * can hide another column. Mutates and returns `row`.
   */
  const clearHiddenTableAnswers = (row, columns, options = {}) => {
    if (!row || typeof row !== "object") return row
    const list = (Array.isArray(columns) ? columns : []).filter(Boolean)
    const clearing = list.filter((column) => column.visibility && column.visibility.hiddenAnswerPolicy === "clear")
    for (let pass = 0; pass <= clearing.length; pass += 1) {
      let changed = false
      clearing.forEach((column) => {
        if (isTableColumnVisible(column, row, { columns: list, formData: options.formData })) return
        const blank = column.type === "checkbox" ? false : ""
        const path = tableColumnPath(column)
        if (tableCell(row, path) !== blank) {
          setTableCell(row, path, blank)
          changed = true
        }
        Object.values(column.choiceBooleanTargets || {}).forEach((targetPath) => {
          if (tableCell(row, targetPath) === false) return
          setTableCell(row, targetPath, false)
          changed = true
        })
      })
      if (!changed) break
    }
    return row
  }

  const tableRowIssues = (config, value, required, issue, translate, values) => {
    const rows = Array.isArray(value) ? value : Array.isArray(value?.rows) ? value.rows : []
    const started = (row) => !!row && typeof row === "object" &&
      Object.keys(row).some((key) => key.charAt(0) !== "_" && tableCellAnswered(row[key]))
    const counted = rows.filter((row) => row && !row._sourceRemoved && (row._sourceKey || started(row)))
    if (counted.length === 0) {
      return required ? [issue("required", translate(config.label + " is required"))] : []
    }
    const paths = config.table.requiredColumnIds || []
    if (!config.table.requireAllComplete || paths.length === 0) return []
    // config.table.columns (optional, EditableTable column shape) carries the
    // columns' visibility rules: a column hidden in a row is not required there.
    const tableColumns = Array.isArray(config.table.columns) ? config.table.columns.filter(Boolean) : []
    const shown = (row, path) => {
      const column = tableColumns.find((entry) => tableColumnPath(entry) === path || entry.id === path)
      return !column || isTableColumnVisible(column, row, { columns: tableColumns, formData: values })
    }
    // One issue per table (the error summary links once per field) naming
    // every incomplete row: "Adherence: complete Metformin, Atorvastatin and row 4".
    const names = counted
      .filter((row) => !paths.every((path) => !shown(row, path) || tableCellAnswered(tableCell(row, path))))
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
   * options: { pageIndex?, inactivePages?, locale?, uiTranslations?, translate?, today? }
   * `translate` (the form's translateFormText) wins over uiTranslations.
   * A config with `checks` (the neutral model) is checked like validateAnswer
   * in @webforms/form-model: an empty answer only meets the required check
   * and Logic-tab invalid rules; a non-empty one every value check. Without
   * `checks` the older keys (`validations`, `format`) apply.
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
      if (config.table) return tableRowIssues(config, value, required, issue, translate, values) // table rows (repeat-for-each)
      const checks = config.checks && typeof config.checks === "object" ? config.checks : null
      if (!hasMeaningfulValue(value)) {
        const missing = required
          ? [issue("required", translate(checks && checks.requiredMessage ? checks.requiredMessage : config.label + " is required"))]
          : []
        return checks ? missing.concat(crossFieldIssues(checks, ["invalid-when"], get, issue, locale)) : missing
      }
      let issues
      if (checks) {
        issues = answerIssues(checks, value, get, issue, { translate, locale, today: options.today })
      } else {
        issues = (config.validations || [])
          .filter((rule) => !matches(rule.validWhen))
          .map((rule) => issue("rule", rule.translations?.[locale] || rule.message))
        const format = config.format ? formats[config.format] : null
        if (format && typeof format.test === "function" && !format.test(value)) {
          issues.push(issue("format", config.formatMessage || translate(format.message || (config.label + " is not valid"))))
        }
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
    evaluateVisibilityRule,
    isLayoutRowVisible,
    gatePasses,
    hiddenAnswerPolicyOf,
    hasHiddenAnswer,
    shouldClearHiddenAnswer,
    shouldDropHiddenAnswer,
    clearHiddenAnswers,
    dropHiddenAnswers,
    tableColumnKind,
    isTableColumnVisible,
    clearHiddenTableAnswers,
    dropHiddenTableAnswers,
    isFieldHidden,
    resolveFieldCopies,
    validate,
    repeatItemCount,
    formats,
    locateField,
    focusField,
  }
})()
