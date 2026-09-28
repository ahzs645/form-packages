const { useState } = React

/**
 * AnswerChoiceField — a choice question drawn from Fluent parts inside the
 * MOIS LayoutItem, for what the faithful MOIS controls (SimpleCodeChecklist,
 * SimpleCodeSelect) cannot do:
 *
 * - answer conditions (option-rules.ts): an answer is offered only when its
 *   show-when holds and is greyed out while its disable-when holds; conditions
 *   read other answers and chart facts (FormLogicKit.withChartFacts);
 * - exclusive answers ("Unable to obtain", "None"): choosing one clears the
 *   others, and choosing another clears it;
 * - free text ("Other"), saved as MOIS saves it: a coding whose code is the text;
 * - presentations: checklist (checkboxes or radios), dropdown, and a
 *   searchable list (single or several answers).
 *
 * It saves exactly what SimpleCodeChecklist saves: one answer as
 * { code, display, system }, several as an array of those, nothing as null.
 * Bound to `fd.field.data[fieldId]`, or controlled through `value`/`onChange`
 * (FieldKit in subform entries, table rows and cards; LayoutTable cells).
 * A chosen answer that is no longer offered stays chosen and is flagged here
 * and at save, never cleared.
 */

const OTHER_KEY = "__answer_other__"

const text = (value) => (value === null || value === undefined ? "" : String(value))

// An answer in any list shape: a string, { code, display }, { key, text },
// or a builder option { label, value } (a text value first, as normalizeOption).
const readAnswer = (option, index, codeSystem) => {
  if (option === null || option === undefined) return null
  if (typeof option !== "object") {
    const value = text(option).trim()
    return value ? { code: value, display: value, system: codeSystem, exclusive: false, disabled: false } : null
  }
  const ordinal = typeof option.value === "number"
  const code = [ordinal ? undefined : option.value, option.code, option.key, option.id, ordinal ? option.value : undefined]
    .map(text).find((entry) => entry.trim() !== "")
  const display = [option.label, option.display, option.text].map(text).find((entry) => entry.trim() !== "")
  if (!code && !display) return null
  return {
    code: (code || display).trim(),
    display: (display || code).trim(),
    system: option.system || codeSystem,
    exclusive: option.exclusive === true,
    disabled: option.disabled === true,
    order: index,
  }
}

// The codes a stored answer holds: codings, subform selections, plain values.
const storedCodes = (stored) => {
  const list = Array.isArray(stored) ? stored : stored === null || stored === undefined || stored === "" ? [] : [stored]
  return list
    .map((entry) => (entry && typeof entry === "object" ? entry.code ?? entry.selectedKey ?? entry.key ?? entry.value ?? entry.display : entry))
    .map(text)
    .filter((entry) => entry.trim() !== "")
}

const AnswerChoiceField = ({
  id,
  fieldId,
  label,
  labelPosition = "top",
  required = false,
  readOnly = false,
  disabled = false,
  placeholder,
  presentation = "checklist",
  selectionType = "single",
  answers = [],
  optionRules,
  codeSystem,
  showOtherOption = false,
  otherLabel = "Other",
  layout = "vertical",
  value,
  onChange,
  getValue,
  note,
  size,
  section,
  moisModule,
  isComplete,
  hidden,
}) => {
  const controlled = typeof onChange === "function"
  const [fd, setFormData] = useActiveData()
  const sd = typeof useSourceData === "function" ? useSourceData() : null
  const effectiveId = fieldId || id || ""
  const stored = controlled ? value : effectiveId ? fd?.field?.data?.[effectiveId] : undefined
  const multiple = selectionType === "multiple"
  const inactive = Boolean(readOnly || disabled || isComplete)
  // Free text: what is being typed, and whether "Other" is ticked while empty.
  const [otherDraft, setOtherDraft] = useState(null)
  const [otherOpen, setOtherOpen] = useState(false)

  const all = (Array.isArray(answers) ? answers : []).map((option, index) => readAnswer(option, index, codeSystem)).filter(Boolean)
  const byCode = new Map(all.map((answer) => [answer.code, answer]))

  // Which answers are offered now: the rules read the form's answers (or the
  // container's, through `getValue`) and the chart.
  const kit = typeof FormLogicKit !== "undefined" && FormLogicKit ? FormLogicKit : null
  const lookup = kit
    ? kit.withChartFacts(typeof getValue === "function" ? getValue : (id) => kit.readValue(fd?.field?.data || {}, id), sd)
    : () => undefined
  const stateOf = (answer) => {
    if (answer.disabled) return "disabled"
    return kit && optionRules ? kit.optionState(answer.code, optionRules, lookup) : "available"
  }
  const states = new Map(all.map((answer) => [answer.code, stateOf(answer)]))
  const offered = all.filter((answer) => states.get(answer.code) !== "hidden")

  const selected = storedCodes(stored)
  const otherCode = selected.find((code) => !byCode.has(code))
  const otherText = otherDraft ?? (otherCode || "")
  const otherChosen = showOtherOption && (otherOpen || Boolean(otherCode))
  const unavailable = selected.filter((code) => byCode.has(code) && states.get(code) !== "available").map((code) => byCode.get(code).display)
  const isEmpty = selected.length === 0

  const codingOf = (code) => {
    const answer = byCode.get(code)
    return answer ? { code: answer.code, display: answer.display, system: answer.system } : { code, display: code, system: codeSystem }
  }
  const write = (codes) => {
    const unique = [...new Set(codes.filter((code) => code && code !== OTHER_KEY))]
    const next = multiple ? (unique.length ? unique.map(codingOf) : null) : unique.length ? codingOf(unique[0]) : null
    if (inactive) return
    if (controlled) {
      onChange(next)
      return
    }
    if (!effectiveId) return
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[effectiveId] = next
    }))
  }

  // Choosing an exclusive answer clears the others; choosing another clears it.
  const toggle = (code, checked) => {
    const answer = byCode.get(code)
    if (!checked) return write(selected.filter((entry) => entry !== code))
    if (answer?.exclusive) return write([code])
    return write([...selected.filter((entry) => !byCode.get(entry)?.exclusive), code])
  }
  const choose = (code) => write(code ? [code] : [])
  // Free text replaces any earlier free text; with several answers it joins
  // the listed ones (and clears an exclusive one), with one it is the answer.
  const commitOther = (raw) => {
    const typed = text(raw).trim()
    setOtherDraft(null)
    if (!typed) setOtherOpen(false)
    const listed = selected.filter((code) => byCode.has(code))
    if (!multiple) return write(typed ? [typed] : otherCode ? [] : listed)
    const kept = typed ? listed.filter((code) => !byCode.get(code)?.exclusive) : listed
    return write(typed ? [...kept, typed] : kept)
  }
  const openOther = () => {
    setOtherOpen(true)
    setOtherDraft(otherText)
    // One answer: choosing Other replaces the listed answer.
    if (!multiple && selected.some((code) => byCode.has(code))) write([])
  }

  const answerDisabled = (answer) => inactive || states.get(answer.code) === "disabled"
  const otherInput = otherChosen ? (
    <Fluent.TextField
      ariaLabel={`${label || effectiveId} ${otherLabel}`}
      value={otherText}
      placeholder={placeholder}
      disabled={inactive}
      onChange={(_event, next) => setOtherDraft(next ?? "")}
      onBlur={() => commitOther(otherText)}
      onKeyDown={(event) => { if (event.key === "Enter") commitOther(otherText) }}
      styles={{ root: { marginTop: 6, maxWidth: 320 } }}
    />
  ) : null

  const renderChecklist = () => {
    const wrap = { display: "flex", flexFlow: layout === "inline" ? "row wrap" : "column", alignItems: "flex-start", gap: layout === "inline" ? "4px 12px" : 6, marginTop: 4 }
    if (multiple) {
      return (
        <div style={wrap} role="group" aria-label={label || effectiveId}>
          {offered.map((answer) => (
            <Fluent.Checkbox
              key={answer.code}
              label={answer.display}
              checked={selected.includes(answer.code)}
              disabled={answerDisabled(answer)}
              onChange={(_event, checked) => toggle(answer.code, Boolean(checked))}
            />
          ))}
          {showOtherOption ? (
            <Fluent.Checkbox
              label={otherLabel}
              checked={otherChosen}
              disabled={inactive}
              onChange={(_event, checked) => (checked ? openOther() : commitOther(""))}
            />
          ) : null}
          {otherInput}
        </div>
      )
    }
    const options = [
      ...offered.map((answer) => ({ key: answer.code, text: answer.display, disabled: answerDisabled(answer) })),
      ...(showOtherOption ? [{ key: OTHER_KEY, text: otherLabel, disabled: inactive }] : []),
    ]
    return (
      <>
        <Fluent.ChoiceGroup
          ariaLabelledBy={undefined}
          selectedKey={otherChosen ? OTHER_KEY : selected[0] ?? null}
          options={options}
          disabled={inactive}
          onChange={(_event, option) => {
            if (option?.key === OTHER_KEY) return openOther()
            setOtherOpen(false)
            return choose(option?.key)
          }}
          styles={layout === "inline" ? { flexContainer: { display: "flex", flexWrap: "wrap", gap: "0 12px" } } : undefined}
        />
        {otherInput}
      </>
    )
  }

  const comboOptions = offered.map((answer) => ({ key: answer.code, text: answer.display, disabled: answerDisabled(answer) }))

  const renderDropdown = () => (
    <>
      <Fluent.Dropdown
        ariaLabel={label || effectiveId}
        placeholder={placeholder}
        multiSelect={multiple}
        disabled={inactive}
        options={[...comboOptions, ...(showOtherOption ? [{ key: OTHER_KEY, text: otherLabel }] : [])]}
        selectedKey={multiple ? undefined : otherChosen ? OTHER_KEY : selected[0] ?? null}
        selectedKeys={multiple ? [...selected.filter((code) => byCode.has(code)), ...(otherChosen ? [OTHER_KEY] : [])] : undefined}
        onChange={(_event, option) => {
          if (!option) return
          if (option.key === OTHER_KEY) return multiple && option.selected === false ? commitOther("") : openOther()
          if (!multiple) setOtherOpen(false)
          return multiple ? toggle(String(option.key), Boolean(option.selected)) : choose(String(option.key))
        }}
        styles={{ root: { maxWidth: 480 } }}
      />
      {otherInput}
    </>
  )

  const renderSearchable = () => (
    <Fluent.ComboBox
      ariaLabel={label || effectiveId}
      placeholder={placeholder}
      multiSelect={multiple}
      disabled={inactive}
      autoComplete="on"
      allowFreeform={showOtherOption}
      options={comboOptions}
      selectedKey={multiple ? selected.filter((code) => byCode.has(code)) : selected[0] ?? null}
      text={!multiple && otherCode ? otherCode : undefined}
      onChange={(_event, option, _index, typed) => {
        if (option) return multiple ? toggle(String(option.key), Boolean(option.selected)) : choose(String(option.key))
        if (showOtherOption && typed) return commitOther(typed)
        return undefined
      }}
      styles={{ root: { maxWidth: 480 } }}
    />
  )

  const control = presentation === "dropdown" ? renderDropdown() : presentation === "searchable" ? renderSearchable() : renderChecklist()
  const flag = unavailable.length ? (
    <div role="alert" style={{ color: "#a4262c", fontSize: 12, marginTop: 4 }}>
      {`${unavailable.join(", ")} ${unavailable.length > 1 ? "are" : "is"} not offered for this patient. Choose an available answer.`}
    </div>
  ) : null

  if (typeof LayoutItem === "undefined" || controlled) {
    const showLabel = label && labelPosition !== "none"
    return (
      <div data-answer-choice={effectiveId}>
        {showLabel ? <Fluent.Label required={required}>{label}</Fluent.Label> : null}
        {control}
        {flag}
      </div>
    )
  }
  return (
    <LayoutItem
      fieldId={effectiveId}
      id={id}
      label={label}
      labelPosition={labelPosition}
      required={required}
      readOnly={readOnly}
      disabled={disabled}
      isComplete={isComplete}
      isEmpty={isEmpty}
      hidden={hidden}
      note={note}
      size={size}
      section={section}
      moisModule={moisModule}
    >
      <div data-answer-choice={effectiveId}>
        {control}
        {flag}
      </div>
    </LayoutItem>
  )
}
