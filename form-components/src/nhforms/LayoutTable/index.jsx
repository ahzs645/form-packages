// Fluent is a NAMESPACE in the real engine's form scope — bare Fluent
// identifiers are a ReferenceError in production even though preview
// injects them. Destructure everything this component renders.
//
// ValueKit (options, yes/no and choice answers), FormulaKit (computed cells),
// FormLogicKit (cell visibility) and DefaultsKit (default answers seeded on
// first load) are referenced only inside function bodies: component files
// load in no guaranteed order.
const { Checkbox } = Fluent

// A cell's options as the { code, display } list SimpleCodeSelect draws, read
// by ValueKit.normalizeOption; an option's explicit `code` or `key` stays its
// code, because that is what the answer stores.
const normalizeLayoutTableOptionList = (optionList) => {
  if (!Array.isArray(optionList)) return []
  return optionList
    .map((option) => {
      const normalized = ValueKit.normalizeOption(option)
      const explicit = option && typeof option === "object" ? option.code ?? option.key : undefined
      const code = explicit !== undefined && explicit !== null && String(explicit) !== "" ? String(explicit) : normalized.code
      const display = normalized.display
      if (!code && !display) return null
      return {
        code: String(code || display),
        display: String(display || code),
        // An answer the cell's option rules disable (FormLogicKit.availableOptions).
        ...(option && typeof option === "object" && option.disabled === true ? { disabled: true } : {}),
      }
    })
    .filter(Boolean)
}

// Yes/no answers arrive as booleans (Checkbox), MOIS-YESNO codes, the Coding
// SimpleCodeSelect stores ({ code: "Y", display: "Yes" }) or legacy text;
// ValueKit.readBoolean reads them all (null: not a yes/no answer).
const isCheckedValue = (value) => ValueKit.readBoolean(value) === true

// A calendar date in the user's timezone (yyyy-MM-dd), matching the export
// pipeline's formatLocalDate — toISOString() is UTC, so late in the day it
// already reads as tomorrow west of UTC.
const formatLayoutTableLocalDate = (date) => {
  const pad = (part) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const getPathValue = (root, path) => {
  if (!root || !path) return undefined
  return String(path)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((current, part) => (current && typeof current === "object" ? current[part] : undefined), root)
}

const hasLayoutTableSourceValue = (value) => value !== undefined && value !== null && value !== ""

const layoutTableSourceText = (value, fallback = "") => {
  if (!hasLayoutTableSourceValue(value)) return fallback
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map((item) => layoutTableSourceText(item)).filter(Boolean).join(", ")
  return value.display || value.text || value.name || value.code || fallback
}

const formatLayoutTableSourceValue = (value, sourceFormat = "text", fallback = "", codeSystem = "") => {
  if (sourceFormat === "coding") {
    const raw = hasLayoutTableSourceValue(value) ? value : fallback
    if (!hasLayoutTableSourceValue(raw)) return { code: null, display: null, system: codeSystem }
    if (raw && typeof raw === "object") {
      const code = raw.code ?? raw.key ?? raw.value ?? raw.display ?? raw.text
      const display = raw.display ?? raw.text ?? raw.label ?? raw.code ?? raw.key ?? raw.value
      return {
        code: code == null ? null : String(code),
        display: display == null ? null : String(display),
        system: raw.system || codeSystem,
      }
    }
    const text = String(raw)
    return { code: text, display: text, system: codeSystem }
  }

  if (sourceFormat === "visitCode" && value && typeof value === "object") {
    const code = value.code || value.key || ""
    const display = value.display || value.text || ""
    if (code && display) return `${code} (${display})`
    return display || code || fallback
  }

  const raw = layoutTableSourceText(value, fallback)
  if (!raw) return ""
  if (sourceFormat === "date") {
    const match = raw.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/)
    return match ? `${match[1]}.${match[2]}.${match[3]}` : raw
  }
  if (sourceFormat === "dateTime") {
    const match = raw.match(/^(\d{4})[-.](\d{2})[-.](\d{2})(?:T|\s)?(\d{2})?:?(\d{2})?/)
    if (!match) return raw
    const date = `${match[1]}-${match[2]}-${match[3]}`
    return match[4] ? `${date} ${match[4]}:${match[5] || "00"}` : date
  }
  return raw
}

const getLayoutTableSourcePaths = (cell) => {
  const paths = Array.isArray(cell.sourcePaths) ? cell.sourcePaths : []
  return Array.from(new Set([cell.sourcePath, ...paths].filter((path) => typeof path === "string" && path.trim()).map((path) => path.trim())))
}

const resolveLayoutTableSourceValue = (cell, data, sourceData) => {
  const root = {
    fd: data?.__fd,
    field: data,
    formData: data?.__fd?.formData,
    sd: sourceData,
    sourceData,
    webform: sourceData?.webform,
    patient: sourceData?.patient,
    userProfile: sourceData?.userProfile,
    encounter: sourceData?.encounter,
  }
  const paths = getLayoutTableSourcePaths(cell)
  let sourceValue
  for (const path of paths) {
    const candidate = path === "system.currentDate" ? formatLayoutTableLocalDate(new Date()) : getPathValue(root, path)
    if (hasLayoutTableSourceValue(candidate)) {
      sourceValue = candidate
      break
    }
  }
  const fallback = cell.sourceFallback ?? cell.defaultValue ?? ""
  return formatLayoutTableSourceValue(sourceValue, cell.sourceFormat || "text", fallback, cell.codeSystem)
}

const sourceBindingIsInitial = (cell) => cell?.sourceMode === "initial"
const fieldHasSavedValue = (data, fieldId) =>
  Boolean(data && fieldId && Object.prototype.hasOwnProperty.call(data, fieldId))

// A default answer in the shape the cell's control saves: a Coding for a
// choice (matched by option code, then wording; dropped when it is not one of
// the options), a list of Codings for a multiple choice, a MOIS-YESNO Coding
// for yes/no, a boolean for a tick box, a number for a number cell and text
// otherwise. Undefined when nothing fits.
const layoutTableDefaultToStored = (cell, value) => {
  if (value === undefined || value === null) return undefined
  switch (cell.inputType) {
    case "booleanSingle": {
      const answer = ValueKit.readBoolean(value)
      return answer === null ? undefined : answer
    }
    case "booleanYesNo": {
      const answer = ValueKit.readBoolean(value)
      if (answer === null) return undefined
      return answer
        ? { code: "Y", display: "Yes", system: "MOIS-YESNO" }
        : { code: "N", display: "No", system: "MOIS-YESNO" }
    }
    case "number": {
      if (cell.numberConfig?.storeAsNumber === false) return typeof value === "string" || typeof value === "number" ? String(value) : undefined
      const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN
      return Number.isFinite(number) ? number : undefined
    }
    case "choice":
    case "choiceMulti": {
      const options = normalizeLayoutTableOptionList(cell.optionList ?? cell.options)
      const toCoding = (entry) => {
        const key = entry && typeof entry === "object" ? entry.code ?? entry.value : entry
        if (key === undefined || key === null || String(key).trim() === "") return null
        const text = String(key).trim()
        const lower = text.toLowerCase()
        const option = options.find((candidate) => candidate.code === text)
          || options.find((candidate) => candidate.code.toLowerCase() === lower)
          || options.find((candidate) => candidate.display.toLowerCase() === lower)
        // A code-list cell (no inline options) cannot be checked here.
        if (!option && options.length > 0) return null
        return { code: option ? option.code : text, display: option ? option.display : text, ...(cell.codeSystem ? { system: cell.codeSystem } : {}) }
      }
      const codings = (Array.isArray(value) ? value : [value]).map(toCoding).filter(Boolean)
      if (cell.inputType === "choiceMulti") return codings.length > 0 ? codings : undefined
      return codings[0] || undefined
    }
    default:
      return typeof value === "string" || typeof value === "number" ? String(value) : undefined
  }
}

// The answer cells (field cells and the fields of a field-list cell) that
// start with a default answer, read by DefaultsKit in every saved shape
// (defaultAnswer, prefill, dateConfig.prefillToday, a field cell's legacy
// defaultValue). Source-bound cells are filled from their source instead (the
// clock binding included). Empty without the kit.
const collectLayoutTableDefaultCells = (rows) => {
  if (typeof DefaultsKit === "undefined" || !DefaultsKit) return []
  const cells = []
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    ;(Array.isArray(row?.cells) ? row.cells : []).forEach((cell) => {
      if (!cell) return
      const fields = cell.kind === "field" ? [cell] : cell.kind === "fieldList" && Array.isArray(cell.fields) ? cell.fields : []
      fields.forEach((field) => {
        const fieldId = field?.fieldId || field?.id
        if (!fieldId || getLayoutTableSourcePaths(field).length > 0) return
        const answer = DefaultsKit.readDefaultAnswer(field, { shape: "layoutCell" })
        if (answer) cells.push({ fieldId, cell: field, answer })
      })
    })
  })
  return cells
}

// A default is seeded only into an answer the section has never saved (a new
// form), never over an answer, the same rule as an initial-mode source binding.
const resolveLayoutTableDefault = (entry, now) =>
  layoutTableDefaultToStored(entry.cell, DefaultsKit.resolveDefaultAnswer(entry.answer, {
    now,
    fieldType: DefaultsKit.temporalKindOf(entry.cell),
  }))

const getCellDisplayValue = (cell, data, sourceData) => {
  const sourcePaths = getLayoutTableSourcePaths(cell)
  const value = sourcePaths.length > 0
    ? resolveLayoutTableSourceValue(cell, data, sourceData)
    : cell.defaultValue ?? cell.text ?? ""
  if (value == null) return ""
  if (typeof value === "object") {
    return value.display ?? value.text ?? value.value ?? value.code ?? ""
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.split("T")[0]
  }
  return String(value)
}

const getNumericFieldValue = (data, fieldId) => {
  const raw = data?.[fieldId]
  if (raw == null || raw === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const getLayoutTableFieldRawValue = (cell, data) => {
  const fieldId = cell.fieldId || cell.id
  return data?.[fieldId] ?? cell.defaultValue ?? ""
}

const formatLayoutTableFieldDisplayValue = (cell, data) => {
  const value = getLayoutTableFieldRawValue(cell, data)
  if (value == null || value === "") return ""

  if (cell.inputType === "booleanSingle" || cell.inputType === "booleanYesNo") {
    const answer = ValueKit.readBoolean(value)
    if (answer === true) return "Yes"
    if (answer === false) return "No"
    // Another code on the yes/no list (e.g. unknown): show its own wording.
    const [entry] = ValueKit.readChoice(value)
    return entry ? String(entry.display ?? entry.code) : ""
  }

  // Codes (or codings) worded from the cell's options, several joined.
  const optionList = normalizeLayoutTableOptionList(cell.optionList ?? cell.options)
  return ValueKit.readChoice(value, optionList)
    .map((entry) => String(entry.display ?? entry.code))
    .filter(Boolean)
    .join(", ")
}

const renderLayoutTableReadOnlyField = (cell, data) => {
  const label = cell.labelPosition === "none" ? "" : cell.label || ""
  const displayValue = formatLayoutTableFieldDisplayValue(cell, data)

  return (
    <div
      data-field-id={cell.fieldId || cell.id}
      style={{
        minHeight: "20px",
        whiteSpace: cell.inputType === "textarea" ? "pre-wrap" : "normal",
        overflowWrap: "anywhere",
      }}
    >
      {label ? (
        <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: displayValue ? 2 : 0 }}>
          {label}
        </div>
      ) : null}
      <div>{displayValue}</div>
    </div>
  )
}

// One token pattern for both reading refs and rewriting them: a bracketed id
// ([field-1]) or a bare identifier. Rewriting in a single pass matters — a
// second pass over already-rewritten `__values["a"]` would rewrite the `a`
// inside the quotes again and break the expression.
const LAYOUT_TABLE_FORMULA_TOKEN = /\[([^\]]+)\]|\b[A-Za-z_][A-Za-z0-9_]*\b/g
const LAYOUT_TABLE_FORMULA_BUILTINS = ["sum", "Math", "min", "max"]

// Missing answers count as 0 throughout, like the sum(...) shorthand.
const layoutTableFormulaNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const LAYOUT_TABLE_FORMULA_FUNCTIONS = {
  sum: (...args) => args.flat().reduce((total, value) => total + layoutTableFormulaNumber(value), 0),
  min: (...args) => Math.min(...args.flat().map(layoutTableFormulaNumber)),
  max: (...args) => Math.max(...args.flat().map(layoutTableFormulaNumber)),
}

// Tokens after a "." are property names (Math.round), never field ids.
const isLayoutTableFormulaProperty = (formula, offset) => formula[offset - 1] === "."

// `sum(a, b, [c-d])` — a flat list of field ids, which may be unbracketed even
// when they contain hyphens. Anything else (nested expressions) returns null
// and goes through the general evaluator, where sum() is a function.
const parseLayoutTableSumIds = (formula) => {
  const sumMatch = String(formula || "").trim().match(/^sum\((.*)\)$/i)
  if (!sumMatch) return null
  const ids = sumMatch[1].split(",").map((part) => part.trim().replace(/^\[([^\]]+)\]$/, "$1").trim())
  return ids.length > 0 && ids.every((id) => /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)) ? ids : null
}

const extractLayoutTableFormulaRefs = (expression) => {
  const formula = String(expression || "")
  const sumIds = parseLayoutTableSumIds(formula)
  if (sumIds) return Array.from(new Set(sumIds))
  const refs = []
  for (const match of formula.matchAll(LAYOUT_TABLE_FORMULA_TOKEN)) {
    if (match[1] !== undefined) refs.push(match[1])
    else if (!LAYOUT_TABLE_FORMULA_BUILTINS.includes(match[0]) && !isLayoutTableFormulaProperty(formula, match.index)) refs.push(match[0])
  }
  return Array.from(new Set(refs.filter(Boolean)))
}

const isSafeLayoutTableFormula = (expression) => {
  const strippedExpression = String(expression || "").replace(/\[([^\]]+)\]/g, " ")
  return /^[\d\s+\-*/().,_A-Za-z]+$/.test(strippedExpression)
}

const evaluateLayoutTableFormula = (expression, data, currentFieldId) => {
  const formula = typeof expression === "string" ? expression.trim() : ""
  if (!formula) return null

  const sumIds = parseLayoutTableSumIds(formula)
  if (sumIds) {
    return sumIds.reduce((sum, fieldId) => sum + (fieldId === currentFieldId ? 0 : getNumericFieldValue(data, fieldId) ?? 0), 0)
  }

  if (!isSafeLayoutTableFormula(formula)) return null
  const refs = extractLayoutTableFormulaRefs(formula).filter((fieldId) => fieldId !== currentFieldId)
  const values = {}
  refs.forEach((fieldId) => {
    values[fieldId] = getNumericFieldValue(data, fieldId) ?? 0
  })

  const jsExpression = formula.replace(LAYOUT_TABLE_FORMULA_TOKEN, (token, bracketedId, offset) => {
    if (bracketedId !== undefined) return `__values[${JSON.stringify(bracketedId)}]`
    if (LAYOUT_TABLE_FORMULA_BUILTINS.includes(token) || isLayoutTableFormulaProperty(formula, offset)) return token
    // A self-reference stays a bare (undefined) identifier and fails below.
    return Object.prototype.hasOwnProperty.call(values, token) ? `__values[${JSON.stringify(token)}]` : token
  })

  try {
    const { sum, min, max } = LAYOUT_TABLE_FORMULA_FUNCTIONS
    const value = Function("__values", "sum", "min", "max", `"use strict"; return (${jsExpression});`)(values, sum, min, max)
    return Number.isFinite(value) ? value : null
  } catch (error) {
    return null
  }
}

const formatLayoutTableComputedValue = (value, precision, resultType) => {
  if (value == null || value === "") return ""
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ""
  if (Number.isFinite(precision) && precision >= 0) {
    const rounded = numeric.toFixed(Math.round(precision))
    return resultType === "text" ? rounded : String(Number(rounded))
  }
  return String(numeric)
}

// A computed cell's formula as a stored tree (neutral form model): the
// exported `formulaTree`, else its text parsed by FormulaKit in the LayoutTable
// dialect (cached per text), where a missing answer counts as 0 through
// coalesce(…, 0). Null when the kit predates trees or the text does not parse;
// the cell then uses evaluateLayoutTableFormula, as before.
const layoutTableFormulaTrees = new Map()
const layoutTableFormulaTree = (cell) => {
  if (typeof FormulaKit === "undefined" || !FormulaKit || typeof FormulaKit.evaluateTree !== "function") return null
  const stored = cell?.formulaTree
  if (stored && stored.v === 1 && stored.expr && typeof stored.expr === "object") return stored
  const text = typeof cell?.formula === "string" ? cell.formula : ""
  if (!text.trim() || typeof FormulaKit.parse !== "function") return null
  if (layoutTableFormulaTrees.has(text)) return layoutTableFormulaTrees.get(text)
  let tree = null
  try {
    const parsed = FormulaKit.parse(text, { dialect: "layoutTable" })
    if (parsed && parsed.v === 1 && parsed.expr) tree = parsed
    else if (parsed && parsed.formula && !(parsed.errors && parsed.errors.length)) tree = parsed.formula
  } catch (error) {
    tree = null
  }
  layoutTableFormulaTrees.set(text, tree)
  return tree
}

// The builder field type of each answer the table owns (see
// collectLayoutTableControllerKinds), so the formula kit reads yes/no answers
// as yes/no and dates as dates.
const LAYOUT_TABLE_FORMULA_FIELD_TYPES = {
  text: "text",
  textarea: "textarea",
  number: "number",
  date: "date",
  time: "time",
  choice: "choice",
  choiceMulti: "multiselect",
  booleanYesNo: "booleanYesNo",
  booleanSingle: "booleanSingle",
}
const collectLayoutTableFormulaFieldTypes = (rows) => {
  const types = {}
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    ;(Array.isArray(row?.cells) ? row.cells : []).forEach((cell) => {
      if (!cell) return
      if (cell.kind === "computed" && cell.fieldId) {
        types[cell.fieldId] = cell.resultType === "text" ? "text" : "number"
        return
      }
      const fields = cell.kind === "field" ? [cell] : cell.kind === "fieldList" && Array.isArray(cell.fields) ? cell.fields : []
      fields.forEach((field) => {
        const fieldId = field?.fieldId || field?.id
        if (fieldId) types[fieldId] = LAYOUT_TABLE_FORMULA_FIELD_TYPES[field.inputType] || "text"
      })
    })
  })
  return types
}

// `fieldTypes` (optional): the table's answer types, from
// collectLayoutTableFormulaFieldTypes.
const computeLayoutTableCellValue = (cell, data, fieldTypes) => {
  const sourceFieldIds = Array.isArray(cell.sourceFieldIds) && cell.sourceFieldIds.length > 0
    ? cell.sourceFieldIds
    : extractLayoutTableFormulaRefs(cell.formula).filter((fieldId) => fieldId !== cell.fieldId)
  if (cell.blankWhenEmpty === true && sourceFieldIds.every((fieldId) => getNumericFieldValue(data, fieldId) == null)) {
    return ""
  }
  const tree = layoutTableFormulaTree(cell)
  const evaluated = tree
    ? FormulaKit.evaluateTree(
      tree,
      // A cell never reads its own result.
      (fieldId) => (fieldId === cell.fieldId ? undefined : data?.[fieldId]),
      {
        // The dialect already reads a missing answer as 0.
        incomplete: "compute-anyway",
        fieldKind: (fieldId) => (fieldTypes ? fieldTypes[fieldId] : undefined),
      }
    )
    : evaluateLayoutTableFormula(cell.formula, data, cell.fieldId)
  const rawValue = evaluated ?? cell.defaultValue ?? ""
  return formatLayoutTableComputedValue(rawValue, cell.precision, cell.resultType)
}

// A cell as it offers its answers now: its option rules (lifted by
// lib/layout-table-answer-fields.ts) read the form's answers and chart facts.
const withAvailableCellOptions = (cell, data) => {
  const rules = cell?.optionRules
  if (!Array.isArray(rules) || rules.length === 0) return cell
  if (typeof FormLogicKit === "undefined" || !FormLogicKit || typeof FormLogicKit.availableOptions !== "function") return cell
  const key = Array.isArray(cell.optionList) ? "optionList" : "options"
  if (!Array.isArray(cell[key])) return cell
  const offered = FormLogicKit.availableOptions(cell[key], rules, (fieldId) => data?.[fieldId])
  return offered === cell[key] ? cell : { ...cell, [key]: offered }
}

const renderLayoutTableField = (sourceCell, readOnly, data, setFieldValue) => {
  const cell = withAvailableCellOptions(sourceCell, data)
  if (cell.hidden === true) return null
  const fieldId = cell.fieldId || cell.id
  const label = cell.label || ""
  const labelProp = label ? { label } : {}
  const effectiveReadOnly = readOnly || cell.readOnly === true || cell.disabled === true
  const sharedProps = {
    fieldId,
    labelPosition: cell.labelPosition || (label ? "top" : "none"),
    readOnly: effectiveReadOnly,
    required: cell.required === true,
    placeholder: cell.placeholder,
  }
  const optionList = normalizeLayoutTableOptionList(cell.optionList ?? cell.options)

  if (effectiveReadOnly) return renderLayoutTableReadOnlyField(cell, data)

  // A cell with answer conditions or exclusive answers: AnswerChoiceField
  // hides, greys out and clears answers, which SimpleCodeSelect cannot.
  const rawAnswers = Array.isArray(sourceCell.optionList) ? sourceCell.optionList : Array.isArray(sourceCell.options) ? sourceCell.options : []
  const needsAnswerChoice = (cell.inputType === "choice" || cell.inputType === "choiceMulti") && typeof AnswerChoiceField !== "undefined" &&
    ((Array.isArray(sourceCell.optionRules) && sourceCell.optionRules.length > 0) || rawAnswers.some((option) => option && typeof option === "object" && option.exclusive === true))
  if (needsAnswerChoice) {
    return (
      <AnswerChoiceField
        fieldId={fieldId}
        label={label}
        labelPosition={sharedProps.labelPosition}
        required={sharedProps.required}
        placeholder={cell.placeholder}
        presentation={cell.inputType === "choiceMulti" ? "checklist" : "dropdown"}
        selectionType={cell.inputType === "choiceMulti" ? "multiple" : "single"}
        answers={rawAnswers}
        optionRules={sourceCell.optionRules}
        codeSystem={cell.codeSystem}
        showOtherOption={cell.showOtherOption === true}
        value={data?.[fieldId] ?? null}
        getValue={(id) => data?.[id]}
        onChange={(next) => setFieldValue(fieldId, next)}
      />
    )
  }

  switch (cell.inputType) {
    case "booleanSingle":
      return (
        <Checkbox
          name={cell.name || fieldId}
          label={cell.labelPosition === "none" ? "" : label}
          ariaLabel={label || fieldId}
          checked={isCheckedValue(data?.[fieldId])}
          disabled={readOnly}
          onChange={(_, checked) => setFieldValue(fieldId, Boolean(checked))}
        />
      )
    case "number":
      return <Numeric {...sharedProps} {...labelProp} typeNumber={cell.numberConfig?.typeNumber} storeAsNumber={cell.numberConfig?.storeAsNumber} suffix={cell.numberConfig?.suffix} spinButtonProps={cell.numberConfig?.spinButtonProps || { min: cell.min, max: cell.max, step: cell.step }} />
    case "date":
      return <DateSelect {...sharedProps} {...labelProp} dateFormat={cell.dateConfig?.dateFormat} />
    case "time":
      return <TimeSelect {...sharedProps} {...labelProp} />
    case "booleanYesNo":
      return <SimpleCodeSelect {...sharedProps} {...labelProp} codeSystem="MOIS-YESNO" autoHotKey={cell.autoHotKey} />
    case "choice":
      return optionList.length > 0
        ? <SimpleCodeSelect {...sharedProps} {...labelProp} optionList={optionList} codeSystem={cell.codeSystem} autoHotKey={cell.autoHotKey} showOtherOption={cell.showOtherOption} />
        : <SimpleCodeSelect {...sharedProps} {...labelProp} codeSystem={cell.codeSystem} autoHotKey={cell.autoHotKey} showOtherOption={cell.showOtherOption} />
    case "choiceMulti": {
      const checklistOptions = optionList.map((option) => ({ key: option.code, text: option.display }))
      const multiline = cell.multiline !== false
      return checklistOptions.length > 0
        ? <SimpleCodeChecklist {...sharedProps} {...labelProp} selectionType="multiple" optionList={checklistOptions} codeSystem={cell.codeSystem} multiline={multiline} />
        : <SimpleCodeChecklist {...sharedProps} {...labelProp} selectionType="multiple" codeSystem={cell.codeSystem} multiline={multiline} />
    }
    case "textarea":
      return <TextArea {...sharedProps} {...labelProp} multiline textFieldProps={{ autoAdjustHeight: true, resizable: cell.textareaConfig?.resizable ?? false, rows: cell.textareaConfig?.rows }} />
    case "text":
    default:
      return <TextArea {...sharedProps} {...labelProp} />
  }
}

const renderLayoutTableFieldList = (cell, readOnly, data, setFieldValue, visibility) => {
  const fields = (Array.isArray(cell.fields) ? cell.fields : []).filter((field) => layoutTableCellIsVisible(field, visibility))
  if (fields.length === 0) return null

  return (
    <div style={{ display: "flex", flexFlow: "wrap", justifyContent: cell.justifyContent || "space-between", gap: cell.gap || undefined }}>
      {fields.map((field, index) => (
        <div key={field.id || field.fieldId || index}>
          {renderLayoutTableField({ ...field, id: field.id || field.fieldId }, readOnly, data, setFieldValue)}
        </div>
      ))}
    </div>
  )
}

const renderLayoutTableResources = (cell) => {
  const resources = Array.isArray(cell.resources) ? cell.resources.filter((resource) => resource?.url && resource?.label) : []
  if (resources.length === 0) return cell.text || ""

  const renderLink = (resource, index) => (
    <a key={`${resource.url}-${index}`} href={resource.url} target="_blank" rel="noreferrer">
      {resource.label}
    </a>
  )

  if (resources.length === 1 && cell.resourceListStyle !== "disc") {
    return <span>{renderLink(resources[0], 0)}</span>
  }

  return (
    <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: cell.resourceListStyle === "none" ? 0 : undefined, listStyleType: cell.resourceListStyle || "disc" }}>
      {resources.map((resource, index) => (
        <li key={`${resource.url}-${index}`}>{renderLink(resource, index)}</li>
      ))}
    </ul>
  )
}

const renderLayoutTableStampButton = (cell, readOnly) => {
  const id = cell.stampFieldId || cell.fieldId || cell.id
  const label = cell.label || cell.text || "Sign"
  const targets = Array.isArray(cell.targets) ? cell.targets : []

  return (
    <FieldStampButton
      id={id}
      stampFieldId={cell.stampFieldId}
      label={label}
      signedLabel={cell.signedLabel || "Signed"}
      clearLabel={cell.clearLabel || "Clear"}
      buttonType={cell.buttonType || "primary"}
      targets={targets}
      allowResign={cell.allowResign !== false}
      showClear={cell.showClear === true}
      showStatus={cell.showStatus !== false}
      statusTemplate={cell.statusTemplate || "{signedLabel} {signedAt}"}
      readOnly={readOnly}
    />
  )
}

// Hidden cells keep their <td> (so colSpan/rowSpan geometry holds) but render
// no content.
const renderLayoutTableCellContent = (cell, readOnly, data, sourceData, setFieldValue, visibility, formulaFieldTypes) => {
  if (cell.hidden === true) return null
  if (!layoutTableCellIsVisible(cell, visibility)) return null
  if (cell.kind === "field") return renderLayoutTableField(cell, readOnly, data, setFieldValue)
  if (cell.kind === "fieldList") return renderLayoutTableFieldList(cell, readOnly, data, setFieldValue, visibility)
  if (cell.kind === "resources") return renderLayoutTableResources(cell)
  if (cell.kind === "stampButton") return renderLayoutTableStampButton(cell, readOnly)
  if (cell.kind === "computed") return computeLayoutTableCellValue(cell, data, formulaFieldTypes)
  return getCellDisplayValue(cell, data, sourceData)
}

const cellStyle = (cell, config) => ({
  border: config.bordered === false ? undefined : `1px solid ${config.borderColor || "#000"}`,
  padding: `${Number(config.cellPadding ?? (config.compact ? 3 : 6)) || 0}px`,
  verticalAlign: cell.verticalAlign || "top",
  textAlign: cell.align || "left",
  width: cell.width || undefined,
  backgroundColor: cell.backgroundColor || undefined,
  fontWeight: cell.header ? 700 : undefined,
  pageBreakInside: config.pageBreakInsideAvoid === false ? undefined : "avoid",
  whiteSpace: cell.kind === "text" ? "pre-wrap" : undefined,
})

// A row's `visibleWhen` ({ fieldId, operator, value }), read by the one
// implementation, FormLogicKit.isLayoutRowVisible (parity:
// isLayoutRowVisible in @webforms/form-model), which the submit gate of the
// row's required cells also uses: "truthy" (default) is answered and not a
// no, "yes" is a yes, "equals" / "notEquals" match a code or wording (a
// boolean value as yes/no). Only the form's own answer is read (no nested
// lookup). A runtime without the kit shows the row.
const rowIsVisible = (row, data) => {
  const rule = row?.visibleWhen
  if (!rule?.fieldId) return true
  if (typeof FormLogicKit === "undefined" || !FormLogicKit || typeof FormLogicKit.isLayoutRowVisible !== "function") return true
  return FormLogicKit.isLayoutRowVisible(rule, (fieldId) => data?.[fieldId])
}

const LAYOUT_TABLE_CONTROLLER_KINDS = {
  booleanSingle: "boolean",
  booleanYesNo: "boolean",
  choice: "choice",
  choiceMulti: "choice",
  number: "number",
}

// Answer kinds of the fields this table owns, so a cell visibility rule
// compares its controller the way the builder does. Controllers outside the
// table are left to FormLogicKit's own inference.
const collectLayoutTableControllerKinds = (rows) => {
  const kinds = {}
  rows.forEach((row) => {
    ;(Array.isArray(row?.cells) ? row.cells : []).forEach((cell) => {
      if (!cell) return
      if (cell.kind === "computed" && cell.fieldId) {
        kinds[cell.fieldId] = cell.resultType === "text" ? "text" : "number"
        return
      }
      const fields = cell.kind === "field" ? [cell] : cell.kind === "fieldList" && Array.isArray(cell.fields) ? cell.fields : []
      fields.forEach((field) => {
        const fieldId = field?.fieldId || field?.id
        if (fieldId) kinds[fieldId] = LAYOUT_TABLE_CONTROLLER_KINDS[field.inputType] || "text"
      })
    })
  })
  return kinds
}

// A cell (or a field inside a fieldList cell) with a builder visibility rule
// shows only while the rule passes. Rules are evaluated by FormLogicKit; a
// runtime without the kit keeps every cell visible, as before.
const layoutTableCellIsVisible = (target, visibility) => {
  const rule = target?.visibility
  if (!rule || typeof rule !== "object" || !visibility) return true
  if (typeof FormLogicKit === "undefined" || typeof FormLogicKit.evaluateVisibilityRule !== "function") return true
  return FormLogicKit.evaluateVisibilityRule(rule, visibility.getValue, visibility.options) !== false
}

function LayoutTable({
  id,
  label,
  rows = [],
  bordered = true,
  compact = false,
  fullWidth = true,
  cellPadding,
  borderColor = "#000",
  pageBreakInsideAvoid = true,
  readOnly = false,
}) {
  const section = typeof useSection === "function" ? useSection() : null
  const [activeData = {}, setActiveData] = useActiveData(section?.activeSelector)
  const sd = useSourceData()
  const config = { bordered, compact, fullWidth, cellPadding, borderColor, pageBreakInsideAvoid }
  const tableRows = Array.isArray(rows) ? rows : []
  const sourceBoundCells = tableRows
    .flatMap((row) => Array.isArray(row.cells) ? row.cells : [])
    .filter((cell) => cell?.kind === "field" && cell.fieldId && getLayoutTableSourcePaths(cell).length > 0)
  const tableData = { ...(activeData || {}) }
  sourceBoundCells.forEach((cell) => {
    if (!sourceBindingIsInitial(cell) || !fieldHasSavedValue(activeData, cell.fieldId)) {
      tableData[cell.fieldId] = resolveLayoutTableSourceValue(cell, activeData, sd)
    }
  })
  // A locked (read-only) table shows what was saved; defaults never write into it.
  const defaultCells = readOnly ? [] : collectLayoutTableDefaultCells(tableRows)
  const renderNow = new Date()
  defaultCells.forEach((entry) => {
    if (fieldHasSavedValue(activeData, entry.fieldId)) return
    const value = resolveLayoutTableDefault(entry, renderNow)
    if (value !== undefined) tableData[entry.fieldId] = value
  })
  const visibleRows = tableRows.filter((row) => rowIsVisible(row, activeData))
  const controllerKinds = collectLayoutTableControllerKinds(tableRows)
  const formulaFieldTypes = collectLayoutTableFormulaFieldTypes(tableRows)
  const cellVisibility = {
    getValue: (controllerId) => tableData[controllerId],
    options: { controllerKind: (controllerId) => controllerKinds[controllerId] },
  }
  const setFieldValue = (fieldId, value) => {
    if (typeof setActiveData !== "function") return
    setActiveData((draft) => {
      if (!draft) return { [fieldId]: value }
      draft[fieldId] = value
    })
  }

  React.useEffect(() => {
    const computedCells = tableRows
      .flatMap((row) => Array.isArray(row.cells) ? row.cells : [])
      .filter((cell) => cell?.kind === "computed" && cell.fieldId)
    const boundCells = tableRows
      .flatMap((row) => Array.isArray(row.cells) ? row.cells : [])
      .filter((cell) => cell?.kind === "field" && cell.fieldId && getLayoutTableSourcePaths(cell).length > 0)
    const seededDefaults = readOnly ? [] : collectLayoutTableDefaultCells(tableRows)
    if ((computedCells.length === 0 && boundCells.length === 0 && seededDefaults.length === 0) || typeof setActiveData !== "function") return
    // Nothing to seed and nothing computed or bound: leave the section data alone.
    if (computedCells.length === 0 && boundCells.length === 0
      && seededDefaults.every((entry) => fieldHasSavedValue(activeData, entry.fieldId))) return
    const now = new Date()

    setActiveData((draft) => {
      if (!draft) {
        const nextData = {}
        seededDefaults.forEach((entry) => {
          const value = resolveLayoutTableDefault(entry, now)
          if (value !== undefined) nextData[entry.fieldId] = value
        })
        boundCells.forEach((cell) => {
          nextData[cell.fieldId] = resolveLayoutTableSourceValue(cell, {}, sd)
        })
        computedCells.forEach((cell) => {
          nextData[cell.fieldId] = computeLayoutTableCellValue(cell, nextData, formulaFieldTypes)
        })
        return nextData
      }
      seededDefaults.forEach((entry) => {
        if (fieldHasSavedValue(draft, entry.fieldId)) return
        const value = resolveLayoutTableDefault(entry, now)
        if (value !== undefined) draft[entry.fieldId] = value
      })
      boundCells.forEach((cell) => {
        if (sourceBindingIsInitial(cell) && fieldHasSavedValue(draft, cell.fieldId)) return
        const nextValue = resolveLayoutTableSourceValue(cell, draft, sd)
        if (draft[cell.fieldId] !== nextValue) draft[cell.fieldId] = nextValue
      })
      computedCells.forEach((cell) => {
        const nextValue = computeLayoutTableCellValue(cell, draft, formulaFieldTypes)
        if (draft[cell.fieldId] !== nextValue) draft[cell.fieldId] = nextValue
      })
    })
  }, [setActiveData, sd, tableRows, readOnly, JSON.stringify(activeData)])

  if (visibleRows.length === 0) return null

  return (
    <div id={id} data-layout-table style={{ width: fullWidth ? "100%" : undefined, pageBreakInside: pageBreakInsideAvoid ? "avoid" : undefined }}>
      {label ? <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div> : null}
      <table
        style={{
          width: fullWidth ? "100%" : undefined,
          borderCollapse: "collapse",
          pageBreakInside: pageBreakInsideAvoid ? "avoid" : undefined,
        }}
      >
        <tbody>
          {visibleRows.map((row, rowIndex) => (
            <tr key={row.id || rowIndex} style={{ pageBreakInside: pageBreakInsideAvoid ? "avoid" : undefined }}>
              {(Array.isArray(row.cells) ? row.cells : []).map((cell, cellIndex) => {
                const Tag = cell.header ? "th" : "td"
                return (
                  <Tag
                    key={cell.id || cellIndex}
                    colSpan={Math.max(1, Number(cell.colSpan) || 1)}
                    rowSpan={Math.max(1, Number(cell.rowSpan) || 1)}
                    style={cellStyle(cell, config)}
                  >
                    {renderLayoutTableCellContent(cell, readOnly, tableData, sd, setFieldValue, cellVisibility, formulaFieldTypes)}
                  </Tag>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
