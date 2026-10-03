// FieldKit — draws a builder-field-shaped question with the MOIS control the
// exporter chooses for it (lib/mois-export/renderers/field-renderer.ts
// renderField, fed by lib/builder-parsed-field.ts), always passing label,
// required and read-only. Used by the containers that draw their own
// questions: EditableTable, RepeatForEachTable, SubformScoring, PanelEntryGrid
// and ActionButtonGroup. A parity test holds controlFor to the exporter.
//
//   FieldKit.controlFor(descriptor)
//     -> { control, selectionType?, displayStyle?, multiline?, supported }
//   FieldKit.renderControl(descriptor, {
//     value, onChange,   // controlled mode: the container keeps the answer
//     fieldId,           // bound mode (no onChange): the control reads and
//                        // writes its section's store, as an exported field does
//     readOnly, disabled, inline, label, labelPosition, required, placeholder,
//     size, key,
//     storage,           // controlled mode: { toControl(stored), fromControl(value) }
//   })
//   FieldKit.storage.{cell,entry,coding,text}(descriptor, extra) — adapters that
//     keep each container's stored answer shapes (read with ValueKit)
//   FieldKit.fromTableColumn / fromSubformEntry / fromPanelRow / fromActionField
//     — builder-field-shaped descriptors for each container's own entries
//
// Controlled values reach storage in one canonical shape per control: text and
// number as text, a date "YYYY-MM-DD", a date-time "YYYY-MM-DDTHH:mm", a time
// "HH:mm", a single choice as a Coding (or null), a multiple choice as a
// Coding list, a yes/no as true / false / null, and a scale as ScaleField's
// answer object.
//
// Engine notes (SMOIS main.a75cc6b1.chunk.js): TextArea, Numeric, DateSelect,
// TimeSelect, SimpleCodeSelect and OptionChoice take `value`/`onChange`, and
// DateSelect calls onChange with a Date. SimpleCodeChecklist and
// DateTimeSelect read and write only their section's store, so in controlled
// mode they are bound to a one-field "value box" through `section`
// (activeSelector), which reports each write to onChange. A write through the
// box lands in the box only, in the engine and in the preview's section
// writer (mois-contract writeSectionActiveFieldValue) alike.
//
// Non-rendering consumers must reference FieldKit only inside function bodies
// (component files load in no guaranteed order); FieldKit itself reads the
// MOIS controls, ValueKit, ScaleField, FindCodeSelect, CompactBooleanField
// and YesNoButtons only while rendering.

const FieldKit = (() => {
  const MOIS_MEMORY_CODE_SYSTEM = /^[A-Za-z0-9 _:.()-]+$/
  const BOX_FIELD_ID = "__fieldKitValue"

  const toText = (value) => (value === null || value === undefined ? "" : String(value))
  const pad2 = (value) => String(value).padStart(2, "0")
  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)

  const validCodeSystem = (value) =>
    typeof value === "string" && value.trim() && MOIS_MEMORY_CODE_SYSTEM.test(value.trim()) ? value.trim() : undefined

  // -------------------------------------------------------------------------
  // Options
  // -------------------------------------------------------------------------

  // Each option's stored code and wording: an explicit key or id wins (the
  // code a cell or selection stores), else ValueKit's reading.
  const optionsOf = (descriptor) => {
    const raw = Array.isArray(descriptor?.options) ? descriptor.options : []
    const system = validCodeSystem(descriptor?.codeSystem)
    return raw
      .map((option, index) => {
        const normalized = ValueKit.normalizeOption(option)
        const explicitKey = isRecord(option) ? option.key ?? option.id : undefined
        const code = explicitKey !== undefined && explicitKey !== null && String(explicitKey).trim()
          ? String(explicitKey)
          : String(normalized.code).trim()
        const display = String(normalized.display).trim()
        if (!code && !display) return null
        return {
          code: code || display,
          display: display || code,
          system: (isRecord(option) && option.system) || normalized.system || system,
          order: index,
          ...(isRecord(option) && option.hotKey ? { hotKey: option.hotKey } : {}),
          // An answer its option rules disable (FormLogicKit.availableOptions).
          ...(isRecord(option) && option.disabled === true ? { disabled: true } : {}),
        }
      })
      .filter(Boolean)
  }

  // The builder turns a choice without options into two placeholder options
  // (builder-parsed-field); an explicit empty list has none.
  const hasOptions = (descriptor) =>
    descriptor?.options === undefined || descriptor?.options === null || optionsOf(descriptor).length > 0

  const codingsOf = (value, descriptor) =>
    ValueKit.readChoice(value, optionsOf(descriptor).map((option) => ({ code: option.code, display: option.display })))
      .map((entry) => {
        const coding = { code: entry.code, display: entry.display ?? entry.code }
        const system = entry.system ?? validCodeSystem(descriptor?.codeSystem)
        if (system) coding.system = system
        return coding
      })

  // -------------------------------------------------------------------------
  // Control choice (parity with the exporter)
  // -------------------------------------------------------------------------

  const TEXT_TYPES = ["text", "email", "phone", "url", "password", "barcode", "file"]
  const EXPORTER_ONLY = {
    computed: "ComputedField",
    signature: "SignaturePad",
    hyperlink: "GuidelineLink",
    richText: "Markdown",
    matrix: "matrix",
    table: "EditableTable",
    layoutTable: "LayoutTable",
    component: "component",
    heading: "Heading",
    section: "Section",
  }

  const measurementActive = (descriptor) => {
    const config = descriptor?.measurementConfig
    return Boolean(config && config.enabled !== false && toText(config.observationCode).trim())
  }

  const controlFor = (descriptor = {}) => {
    const type = descriptor.type || "text"
    if (EXPORTER_ONLY[type]) return { control: EXPORTER_ONLY[type], supported: false }

    if (type === "date" || type === "datetime") {
      if (type === "datetime" || descriptor.dateConfig?.withTime) return { control: "DateTimeSelect", supported: true }
      if (descriptor.dateConfig?.fillTodayOnCalendarOpen) return { control: "CalendarTodayDate", supported: false }
      return { control: "DateSelect", supported: true }
    }
    if (type === "time") return { control: "TimeSelect", supported: true }

    if ((type === "number" || TEXT_TYPES.includes(type)) && measurementActive(descriptor)) {
      return { control: "PastMeasurementField", supported: false }
    }
    if (type === "number" || type === "rating" || type === "slider") return { control: "Numeric", supported: true }
    if (type === "scale") {
      return descriptor.scaleConfig?.style === "numeric"
        ? { control: "Numeric", supported: true }
        : { control: "ScaleField", supported: true }
    }

    if (type === "booleanYesNo" || type === "booleanSingle") {
      return {
        control: "CompactBooleanField",
        displayStyle: descriptor.presentation === "checkbox" ? "checkbox" : "buttons",
        supported: true,
      }
    }

    if (type === "choice") {
      const style = descriptor.choiceStyle || "findCode"
      const findCode = style === "findCode"
      const searchableMultiple = style === "multiselect"
      const checklist = style === "checkbox" || style === "radio"
      const multiple = style === "multiselect" || style === "checkbox"
      const selectionType = multiple ? "multiple" : "single"
      // Answers the container greys out, exclusive answers, or answer
      // conditions: AnswerChoiceField draws what the MOIS controls cannot.
      const rawOptions = Array.isArray(descriptor.options) ? descriptor.options : []
      const needsAnswerChoice =
        (Array.isArray(descriptor.optionRules) && descriptor.optionRules.length > 0) ||
        rawOptions.some((option) => isRecord(option) && (option.disabled === true || option.exclusive === true))
      if (needsAnswerChoice && rawOptions.length > 0) {
        return {
          control: "AnswerChoiceField",
          selectionType,
          presentation: checklist ? "checklist" : findCode || searchableMultiple ? "searchable" : "dropdown",
          supported: true,
        }
      }
      if (validCodeSystem(descriptor.codeSystem) || hasOptions(descriptor)) {
        if (!validCodeSystem(descriptor.codeSystem) && checklist && descriptor.presentation === "buttons") {
          return { control: "CompactChoiceField", supported: false }
        }
        if (findCode || searchableMultiple) {
          return { control: "FindCodeSelect", selectionType: searchableMultiple ? "multiple" : "single", supported: true }
        }
        if (checklist) return { control: "SimpleCodeChecklist", selectionType, supported: true }
        return { control: "SimpleCodeSelect", selectionType, supported: true }
      }
      if (findCode) return { control: "FindCodeSelect", selectionType: "single", supported: true }
      if (checklist) return { control: "SimpleCodeChecklist", selectionType, supported: true }
      return { control: "SimpleCodeSelect", selectionType, supported: true }
    }

    if (type === "textarea") return { control: "TextArea", multiline: true, supported: true }
    return {
      control: "TextArea",
      multiline: descriptor.presentation === "longText",
      supported: true,
    }
  }

  // -------------------------------------------------------------------------
  // Canonical values
  // -------------------------------------------------------------------------

  const localDate = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  const localDateTime = (date) => `${localDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`

  // DateSelect reports a Date in the engine and "YYYY.MM.DD" in the preview.
  const toDateText = (value) => {
    if (value === null || value === undefined || value === "") return ""
    if (value instanceof Date || (value && typeof value.getFullYear === "function")) {
      return Number.isNaN(value.getTime()) ? "" : localDate(value)
    }
    const text = toText(value).trim()
    const dotted = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
    if (dotted) return `${dotted[1]}-${pad2(dotted[2])}-${pad2(dotted[3])}`
    const read = ValueKit.readDate(text)
    return read ? localDate(read) : text
  }

  // The engine stores getDateTimeString ("YYYY-MM-DDTHH:mm"); the preview an ISO instant.
  const toDateTimeText = (value) => {
    if (value === null || value === undefined || value === "") return ""
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.trim())) return value.trim()
    const read = ValueKit.readDateTime(value)
    return read ? localDateTime(read.date) : toText(value)
  }

  // Numeric/TextArea/TimeSelect report (event, value) in the engine and some
  // preview controls a bare value.
  const reportedValue = (first, second) => {
    if (second !== undefined) return second
    if (first && typeof first === "object" && first.target && "value" in first.target) return first.target.value
    return first
  }

  const emptyFor = (choice) => {
    switch (choice.control) {
      case "SimpleCodeSelect":
      case "SimpleCodeChecklist":
      case "FindCodeSelect":
      case "AnswerChoiceField":
        return choice.selectionType === "multiple" ? [] : null
      case "CompactBooleanField":
      case "ScaleField":
        return null
      default:
        return ""
    }
  }

  // -------------------------------------------------------------------------
  // Storage adapters: stored answer <-> canonical control value
  // -------------------------------------------------------------------------

  const codingForStorage = (coding) => (coding && coding.code !== undefined && coding.code !== null ? coding : null)

  // EditableTable / RepeatForEachTable cells: a choice stores its option code
  // (a list of codes when multiple), a yes/no a boolean, text as typed, a
  // number per the column (coerceNumber), dates as canonical text.
  const cellStorage = (descriptor, extra = {}) => {
    const choice = controlFor(descriptor)
    return {
      toControl(stored) {
        switch (choice.control) {
          case "SimpleCodeSelect":
          case "SimpleCodeChecklist":
          case "AnswerChoiceField":
          case "FindCodeSelect": {
            const codings = codingsOf(stored, descriptor)
            return choice.selectionType === "multiple" ? codings : codings[0] || null
          }
          case "CompactBooleanField":
            if (stored === undefined || stored === null || stored === "") return null
            return ValueKit.readBoolean(stored, descriptor.booleanLabels) === true
          case "DateSelect":
            return toDateText(stored)
          case "DateTimeSelect":
            return toDateTimeText(stored)
          case "ScaleField":
            return stored ?? null
          default:
            return stored === null || stored === undefined ? "" : toText(stored)
        }
      },
      fromControl(value) {
        switch (choice.control) {
          case "SimpleCodeSelect":
          case "SimpleCodeChecklist":
          case "FindCodeSelect":
          case "AnswerChoiceField":
            if (choice.selectionType === "multiple") {
              // Codes in option order (as cells always stored them), whatever
              // order the control reports them in.
              const order = optionsOf(descriptor).map((option) => option.code)
              const rank = (code) => (order.indexOf(code) < 0 ? order.length : order.indexOf(code))
              const codes = (Array.isArray(value) ? value : value ? [value] : [])
                .map((entry) => (entry?.code === undefined || entry?.code === null ? "" : String(entry.code)))
                .filter(Boolean)
              return Array.from(new Set(codes)).sort((left, right) => rank(left) - rank(right))
            }
            return (Array.isArray(value) ? value[0] : value)?.code || ""
          case "CompactBooleanField":
            return value === true
          case "Numeric":
            return typeof extra.coerceNumber === "function" ? extra.coerceNumber(value) : value
          default:
            return value ?? ""
        }
      },
    }
  }

  // SubformScoring entries: a choice or yes/no stores the selected option's
  // key (or { selectedKey, value, response, detailResponse } for structured
  // options, extra.serialize), a number a clamped number or null, text as typed.
  const entryStorage = (descriptor, extra = {}) => {
    const choice = controlFor(descriptor)
    const options = Array.isArray(extra.options) ? extra.options : []
    const serialize = typeof extra.serialize === "function" ? extra.serialize : (option) => option?.key ?? null
    const isSelected = typeof extra.isSelected === "function"
      ? extra.isSelected
      : (stored, option) => String(stored ?? "") === String(option?.key ?? "")
    return {
      toControl(stored) {
        switch (choice.control) {
          case "SimpleCodeSelect":
          case "SimpleCodeChecklist":
          case "AnswerChoiceField":
          case "FindCodeSelect": {
            if (options.length > 0) {
              const selected = options.filter((option) => isSelected(stored, option))
              const codings = selected.map((option) => ({ code: String(option.key), display: option.text, ...(option.system ? { system: option.system } : {}) }))
              return choice.selectionType === "multiple" ? codings : codings[0] || null
            }
            const codings = codingsOf(stored, descriptor)
            return choice.selectionType === "multiple" ? codings : codings[0] || (isRecord(stored) && stored.code !== undefined ? stored : null)
          }
          case "CompactBooleanField": {
            if (stored === undefined || stored === null || stored === "") return null
            if (extra.checkedOption && isSelected(stored, extra.checkedOption)) return true
            if (extra.uncheckedOption && isSelected(stored, extra.uncheckedOption)) return false
            return ValueKit.readBoolean(stored, descriptor.booleanLabels)
          }
          case "DateSelect":
            return toDateText(stored)
          case "DateTimeSelect":
            return toDateTimeText(stored)
          case "ScaleField":
            return stored ?? null
          case "Numeric":
            return stored === null || stored === undefined ? "" : toText(stored)
          default:
            return stored === null || stored === undefined ? "" : toText(stored)
        }
      },
      fromControl(value) {
        switch (choice.control) {
          case "SimpleCodeSelect":
          case "SimpleCodeChecklist":
          case "AnswerChoiceField":
          case "FindCodeSelect": {
            const first = Array.isArray(value) ? value[value.length - 1] : value
            if (!first || first.code === null || first.code === undefined || first.code === "") return null
            if (options.length > 0) {
              const option = options.find((candidate) => String(candidate.key) === String(first.code))
              return option ? serialize(option) : first.code
            }
            return codingForStorage(first)
          }
          case "CompactBooleanField":
            if (value === true) return extra.checkedOption ? serialize(extra.checkedOption) : true
            if (value === false) {
              if (extra.falseIsEmpty) return null
              return extra.uncheckedOption ? serialize(extra.uncheckedOption) : false
            }
            return null
          case "Numeric": {
            if (typeof extra.coerceNumber === "function") return extra.coerceNumber(value)
            const text = toText(value).trim()
            if (!text) return null
            const parsed = Number(text)
            return Number.isFinite(parsed) ? parsed : text
          }
          default:
            return value ?? ""
        }
      },
    }
  }

  // PanelEntryGrid rows: a choice stores a Coding, a number a Number (or ""), text as typed.
  const codingStorage = (descriptor, extra = {}) => {
    const choice = controlFor(descriptor)
    return {
      toControl(stored) {
        switch (choice.control) {
          case "SimpleCodeSelect":
          case "SimpleCodeChecklist":
          case "AnswerChoiceField":
          case "FindCodeSelect": {
            const codings = codingsOf(stored, descriptor)
            return choice.selectionType === "multiple" ? codings : codings[0] || null
          }
          case "ScaleField":
            return stored ?? null
          case "DateSelect":
            return toDateText(stored)
          case "DateTimeSelect":
            return toDateTimeText(stored)
          default:
            if (typeof extra.display === "function") return extra.display(stored)
            return stored === null || stored === undefined ? "" : toText(stored)
        }
      },
      fromControl(value) {
        switch (choice.control) {
          case "SimpleCodeSelect":
          case "SimpleCodeChecklist":
          case "AnswerChoiceField":
          case "FindCodeSelect": {
            if (choice.selectionType === "multiple") return (Array.isArray(value) ? value : []).map(codingForStorage).filter(Boolean)
            const coding = codingForStorage(Array.isArray(value) ? value[0] : value)
            if (!coding) return null
            const option = optionsOf(descriptor).find((candidate) => candidate.code === String(coding.code))
            return {
              code: String(coding.code),
              display: option?.display ?? coding.display ?? String(coding.code),
              system: descriptor.system ?? option?.system ?? coding.system,
            }
          }
          case "Numeric": {
            const text = toText(value).trim()
            if (!text) return ""
            const parsed = Number(text)
            return Number.isFinite(parsed) ? parsed : ""
          }
          default:
            return value ?? ""
        }
      },
    }
  }

  // ActionButtonGroup: a choice stores its option key, everything else text.
  const textStorage = (descriptor) => {
    const choice = controlFor(descriptor)
    return {
      toControl(stored) {
        switch (choice.control) {
          case "SimpleCodeSelect":
          case "SimpleCodeChecklist":
          case "AnswerChoiceField":
          case "FindCodeSelect": {
            const codings = codingsOf(stored, descriptor)
            if (codings.length === 0 && toText(stored).trim()) return { code: toText(stored), display: toText(stored) }
            return choice.selectionType === "multiple" ? codings : codings[0] || null
          }
          case "DateSelect":
            return toDateText(stored)
          default:
            return stored === null || stored === undefined ? "" : toText(stored)
        }
      },
      fromControl(value) {
        switch (choice.control) {
          case "SimpleCodeSelect":
          case "SimpleCodeChecklist":
          case "AnswerChoiceField":
          case "FindCodeSelect": {
            const first = Array.isArray(value) ? value[0] : value
            return first?.code ?? first?.display ?? ""
          }
          default:
            return value ?? ""
        }
      },
    }
  }

  const passThroughStorage = () => ({ toControl: (stored) => stored, fromControl: (value) => value })

  // -------------------------------------------------------------------------
  // Controlled value box for store-only controls
  // -------------------------------------------------------------------------

  // Each box has its own field id: the engine derives a checklist's radio
  // group name and element ids from it (name=<fieldId>, id=<fieldId>-<code>),
  // so a shared id would join every row's radios into one group.
  let boxCount = 0

  const BoxedControl = ({ Control, controlProps, value, onChange }) => {
    const boxIdRef = React.useRef(null)
    if (boxIdRef.current === null) {
      boxCount += 1
      boxIdRef.current = `${BOX_FIELD_ID}_${boxCount}`
    }
    const boxId = boxIdRef.current
    const valueRef = React.useRef(value)
    valueRef.current = value
    const onChangeRef = React.useRef(onChange)
    onChangeRef.current = onChange
    const pendingRef = React.useRef(null)

    const box = React.useMemo(() => {
      let cache = { source: undefined, proxy: undefined }
      const current = () => (pendingRef.current ? pendingRef.current.value : valueRef.current)
      const commit = (next) => {
        pendingRef.current = { value: next }
        Promise.resolve().then(() => {
          const queued = pendingRef.current
          pendingRef.current = null
          if (queued && typeof onChangeRef.current === "function") onChangeRef.current(queued.value)
        })
      }
      // The engine's multiple-select writers push into and filter the list
      // they read, so a list reads as a proxy that reports its own changes.
      const read = () => {
        const next = current()
        if (!Array.isArray(next)) return next
        if (cache.source !== next) {
          const copy = next.slice()
          cache = {
            source: next,
            proxy: new Proxy(copy, {
              set(target, property, item) {
                target[property] = item
                commit(target.slice())
                return true
              },
            }),
          }
        }
        return cache.proxy
      }
      return new Proxy({}, {
        get: (_target, property) => (property === boxId ? read() : undefined),
        set: (_target, property, next) => {
          if (property === boxId) commit(Array.isArray(next) ? next.slice() : next)
          return true
        },
        has: (_target, property) => property === boxId,
        ownKeys: () => [boxId],
        getOwnPropertyDescriptor: (_target, property) =>
          property === boxId ? { configurable: true, enumerable: true, writable: true, value: read() } : undefined,
      })
    }, [boxId])

    const section = React.useMemo(() => ({ activeSelector: () => box }), [box])

    // createElement, not <Control>: Control is a prop (the engine control
    // chosen by the caller), and the export's engine-scope check reads every
    // capitalised JSX tag as a bare identifier the engine must provide.
    return React.createElement(Control, { ...controlProps, fieldId: boxId, section })
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  const valueSignature = (value) => {
    try {
      return JSON.stringify(value === undefined ? null : value)
    } catch (_error) {
      return String(value)
    }
  }

  const selectOptionList = (descriptor) =>
    optionsOf(descriptor).map((option) => ({
      key: option.code,
      text: option.display,
      order: option.order,
      ...(option.hotKey ? { hotKey: option.hotKey } : {}),
      ...(option.disabled ? { disabled: true } : {}),
    }))

  const findCodeOptionList = (descriptor) =>
    optionsOf(descriptor).map((option) => ({
      code: option.code,
      display: option.display,
      system: option.system ?? validCodeSystem(descriptor.codeSystem) ?? "",
      order: option.order,
      ...(option.disabled ? { disabled: true } : {}),
    }))

  const numberProps = (descriptor) => {
    const type = descriptor.type
    const config = descriptor.numberConfig || {}
    const range = type === "slider"
      ? { min: descriptor.sliderConfig?.min ?? 0, max: descriptor.sliderConfig?.max ?? 100, step: descriptor.sliderConfig?.step ?? 1 }
      : type === "rating"
        ? { min: 1, max: descriptor.ratingConfig?.maxStars ?? 5, step: 1 }
        : null
    const spin = {}
    const source = range || config.spinButtonProps || {}
    ;["min", "max", "step"].forEach((key) => {
      if (source[key] !== undefined && source[key] !== null && source[key] !== "") spin[key] = source[key]
    })
    const decimal = range && !Object.values(range).every((value) => Number.isInteger(value))
    return {
      typeNumber: decimal ? "decimal" : config.typeNumber || "number",
      buttonControls: Boolean(config.buttonControls || range),
      spinButtonProps: Object.keys(spin).length > 0 ? spin : undefined,
      textFieldProps: config.suffix ? { suffix: config.suffix } : undefined,
    }
  }

  const scaleOptions = (descriptor) => {
    const config = descriptor.scaleConfig || {}
    if (Array.isArray(config.options) && config.options.length > 0) return config.options
    const min = Number.isFinite(Number(config.min)) ? Number(config.min) : 1
    const max = Number.isFinite(Number(config.max)) ? Number(config.max) : 5
    const step = Number(config.step) > 0 ? Number(config.step) : 1
    const options = []
    for (let value = min; value <= max; value += step) {
      options.push({
        value,
        label: String(value),
        description: value === min ? config.minLabel || "" : value === max ? config.maxLabel || "" : "",
      })
    }
    return options
  }

  const FieldKitControl = (props) => {
    const {
      descriptor = {},
      value,
      onChange,
      fieldId,
      readOnly = false,
      disabled,
      inline,
      labelPosition,
      placeholder,
      allowClear,
      size,
      section,
      storage,
    } = props
    const choice = controlFor(descriptor)
    const label = props.label !== undefined ? props.label : descriptor.label
    const required = props.required !== undefined ? props.required === true : descriptor.required === true
    const controlled = typeof onChange === "function"
    const adapter = storage || passThroughStorage()
    const signature = valueSignature(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const controlValue = React.useMemo(() => {
      if (!controlled) return undefined
      const converted = adapter.toControl(value)
      return converted === undefined ? emptyFor(choice) : converted
    }, [controlled, signature, choice.control, choice.selectionType])
    const emit = (canonical) => {
      if (!controlled || readOnly) return
      onChange(adapter.fromControl(canonical))
    }

    const common = {
      label,
      required,
      readOnly,
      ...(disabled !== undefined ? { disabled } : readOnly && controlled ? { disabled: true } : {}),
      ...(labelPosition ? { labelPosition } : {}),
      ...(inline !== undefined ? { inline } : {}),
      ...(size !== undefined ? { size } : {}),
      ...(section && !controlled ? { section } : {}),
    }
    const effectivePlaceholder = placeholder !== undefined ? placeholder : descriptor.placeholder
    const placeholderProp = effectivePlaceholder ? { placeholder: effectivePlaceholder } : {}
    const bound = !controlled && fieldId ? { fieldId } : {}
    const codeSystem = validCodeSystem(descriptor.codeSystem)

    switch (choice.control) {
      case "AnswerChoiceField": {
        const multiple = choice.selectionType === "multiple"
        const answerProps = {
          ...common,
          ...placeholderProp,
          allowClear: allowClear === true,
          presentation: choice.presentation,
          selectionType: choice.selectionType,
          answers: descriptor.options,
          ...(Array.isArray(descriptor.optionRules) && descriptor.optionRules.length ? { optionRules: descriptor.optionRules } : {}),
          ...(codeSystem ? { codeSystem } : {}),
          ...(descriptor.showOtherOption ? { showOtherOption: true } : {}),
          ...(descriptor.choiceAnswerLayout === "inline" ? { layout: "inline" } : {}),
        }
        if (!controlled) return <AnswerChoiceField {...answerProps} {...bound} />
        return (
          <AnswerChoiceField
            {...answerProps}
            value={controlValue ?? (multiple ? [] : null)}
            onChange={(next) => emit(next ?? (multiple ? [] : null))}
          />
        )
      }
      case "TextArea": {
        const multilineProps = choice.multiline
          ? {
              multiline: true,
              ...(descriptor.type === "textarea"
                ? { rows: descriptor.textareaConfig?.rows ?? 4 }
                : {}),
              ...(descriptor.textareaConfig?.resizable === false ? { textFieldProps: { resizable: false } } : {}),
            }
          : {}
        return (
          <TextArea
            {...common}
            {...bound}
            {...placeholderProp}
            {...multilineProps}
            {...(controlled
              ? { value: controlValue ?? "", onChange: (first, second) => emit(toText(reportedValue(first, second))) }
              : {})}
          />
        )
      }
      case "Numeric": {
        const numeric = numberProps(descriptor)
        return (
          <Numeric
            {...common}
            {...bound}
            {...placeholderProp}
            typeNumber={numeric.typeNumber}
            buttonControls={numeric.buttonControls}
            {...(numeric.spinButtonProps ? { spinButtonProps: numeric.spinButtonProps } : {})}
            {...(numeric.textFieldProps ? { textFieldProps: numeric.textFieldProps } : {})}
            {...(controlled
              ? {
                  value: controlValue === null || controlValue === undefined ? "" : toText(controlValue),
                  // Controlled numbers report text; the storage adapter coerces.
                  storeAsNumber: false,
                  onChange: (first, second) => emit(toText(reportedValue(first, second))),
                }
              : { storeAsNumber: descriptor.numberConfig?.storeAsNumber !== false })}
          />
        )
      }
      case "DateSelect":
        // SMOIS main.a75cc6b1.chunk.js DateSelect reparses defaultValue on
        // changes. Its value effect reads activeSelector[fieldId] when
        // value is truthy, clearing a controlled container cell that has
        // no standalone fieldId. Use the supported defaultValue channel;
        // the container still owns the answer through onChange.
        return (
          <DateSelect
            {...common}
            {...bound}
            {...placeholderProp}
            {...(descriptor.dateConfig?.dateFormat ? { dateFormat: descriptor.dateConfig.dateFormat } : {})}
            {...(controlled ? { defaultValue: controlValue || "", onChange: (next) => emit(toDateText(next)) } : {})}
          />
        )
      case "TimeSelect":
        return (
          <TimeSelect
            {...common}
            {...bound}
            {...placeholderProp}
            {...(controlled ? { value: controlValue || "", onChange: (first, second) => emit(toText(reportedValue(first, second))) } : {})}
          />
        )
      case "DateTimeSelect": {
        const dateTimeProps = {
          ...common,
          ...placeholderProp,
          ...(descriptor.dateConfig?.dateFormat ? { dateFormat: descriptor.dateConfig.dateFormat } : {}),
        }
        if (!controlled) return <DateTimeSelect {...dateTimeProps} {...bound} />
        return (
          <BoxedControl
            Control={DateTimeSelect}
            controlProps={dateTimeProps}
            value={controlValue || ""}
            onChange={(next) => emit(toDateTimeText(next))}
          />
        )
      }
      case "SimpleCodeSelect": {
        const optionProps = {
          selectionType: choice.selectionType,
          ...(codeSystem ? { codeSystem } : {}),
          ...(hasOptions(descriptor) && optionsOf(descriptor).length > 0 ? { optionList: selectOptionList(descriptor) } : {}),
          ...(descriptor.autoHotKey ? { autoHotKey: true } : {}),
          ...(descriptor.showOtherOption ? { showOtherOption: true } : {}),
        }
        const control = (
          <SimpleCodeSelect
            {...common}
            {...bound}
            {...placeholderProp}
            {...optionProps}
            {...(controlled
              ? {
                  value: controlValue ?? (choice.selectionType === "multiple" ? [] : undefined),
                  onChange: (coding, codings) => emit(choice.selectionType === "multiple" ? (codings || []) : coding || null),
                }
              : {})}
          />
        )
        // An optional table cell may be cleared even when its faithful MOIS
        // dropdown has no blank item. Compose an action around that control;
        // keep its implementation and the neutral option codes unchanged.
        const canClear = controlled && allowClear === true && !readOnly && !disabled
          && codingsOf(value, descriptor).some((entry) => Boolean(entry.code))
        if (!canClear) return control
        return <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>{control}</div>
          <Fluent.IconButton iconProps={{ iconName: "Cancel" }} title="Clear answer" ariaLabel="Clear answer"
            onClick={() => emit(choice.selectionType === "multiple" ? [] : null)}
            styles={{ root: { flex: "0 0 28px", width: 28 } }} />
        </div>

      }
      case "SimpleCodeChecklist": {
        const checklistProps = {
          ...common,
          selectionType: choice.selectionType,
          ...(codeSystem ? { codeSystem } : {}),
          ...(optionsOf(descriptor).length > 0 ? { optionList: selectOptionList(descriptor) } : {}),
          ...(descriptor.choiceAnswerLayout === "vertical" || descriptor.presentation === "vertical" ? { multiline: true } : {}),
          ...(descriptor.autoHotKey ? { autoHotKey: true } : {}),
          ...(descriptor.showOtherOption ? { showOtherOption: true } : {}),
        }
        if (!controlled) return <SimpleCodeChecklist {...checklistProps} {...bound} />
        return (
          <BoxedControl
            Control={SimpleCodeChecklist}
            controlProps={checklistProps}
            value={controlValue ?? (choice.selectionType === "multiple" ? [] : null)}
            onChange={(next) => emit(next)}
          />
        )
      }
      case "FindCodeSelect": {
        const optionList = optionsOf(descriptor).length > 0 ? findCodeOptionList(descriptor) : undefined
        return (
          <FindCodeSelect
            {...common}
            {...bound}
            {...placeholderProp}
            openOnFocus
            {...(codeSystem ? { codeSystem } : {})}
            {...(optionList ? { optionList } : {})}
            {...(choice.selectionType === "multiple" ? { selectionType: "multiple" } : {})}
            {...(descriptor.showOtherOption ? { showOtherOption: true } : {})}
            {...(controlled
              ? {
                  value: controlValue ?? (choice.selectionType === "multiple" ? [] : null),
                  onChange: (next) => emit(next ?? (choice.selectionType === "multiple" ? [] : null)),
                }
              : {})}
          />
        )
      }
      case "ScaleField":
        return (
          <ScaleField
            {...common}
            {...(controlled ? {} : bound)}
            options={scaleOptions(descriptor)}
            {...(labelPosition === "none" ? { hideLabel: true } : {})}
            {...(descriptor.scaleConfig?.disableHorizontalScroll ? { disableHorizontalScroll: true } : {})}
            showLegend={descriptor.scaleConfig?.showLegend === true}
            showInlineLabels={descriptor.scaleConfig?.showInlineLabels !== false}
            showTooltip={descriptor.scaleConfig?.showTooltip === true}
            {...(controlled ? { value: controlValue ?? null, onChange: (next) => emit(next ?? null) } : {})}
          />
        )
      case "CompactBooleanField": {
        const labels = { on: descriptor.booleanLabels?.on || "Yes", off: descriptor.booleanLabels?.off || "No" }
        if (!controlled) {
          return (
            <CompactBooleanField
              {...common}
              {...bound}
              booleanLabels={labels}
              {...(choice.displayStyle === "checkbox" ? { displayStyle: "checkbox" } : {})}
            />
          )
        }
        // CompactBooleanField reads field.data itself, so a controlled yes/no
        // draws its parts: the same Yes/No buttons, or its single checkbox.
        const inactive = Boolean(readOnly || disabled)
        const showLabel = label && labelPosition !== "none"
        if (choice.displayStyle === "checkbox") {
          return (
            <Fluent.Checkbox
              label={showLabel ? `${label}${required ? " *" : ""}` : undefined}
              ariaLabel={!showLabel && label ? String(label) : undefined}
              checked={controlValue === true}
              indeterminate={descriptor.allowNeutral === true && controlValue === null}
              disabled={inactive}
              onChange={(_event, checked) => emit(Boolean(checked))}
            />
          )
        }
        return (
          <div style={{ display: "flex", flexFlow: labelPosition === "top" ? "column" : "row wrap", alignItems: labelPosition === "top" ? "flex-start" : "center", gap: 4 }}>
            {showLabel ? (
              <Fluent.Label required={required} styles={{ root: { fontWeight: 600, marginRight: 10 } }}>{label}</Fluent.Label>
            ) : null}
            {/* YesNoButtons is an export of the bundled CompactBooleanField
                module (COMPONENT_MODULE_EXPORTS), declared at package scope,
                which the export's engine-scope check accepts. */}
            <YesNoButtons
              yesLabel={labels.on}
              noLabel={labels.off}
              value={controlValue === true ? "yes" : controlValue === false ? "no" : null}
              onChange={(next) => emit(next === "yes" ? true : next === "no" ? false : null)}
              disabled={inactive}
              allowDeselect={descriptor.booleanNeutralMode !== "none" && descriptor.booleanNeutralMode !== "initial"}
            />
          </div>
        )
      }
      default:
        return null
    }
  }

  const renderControl = (descriptor, options = {}) => {
    const { key, ...rest } = options
    return React.createElement(FieldKitControl, { key, descriptor, ...rest })
  }

  // -------------------------------------------------------------------------
  // Descriptor projections
  // -------------------------------------------------------------------------

  // An EditableTable / RepeatForEachTable runtime column (EDITABLE_TABLE_COLUMN_TYPES).
  const fromTableColumn = (column = {}) => {
    const base = {
      id: column.dataPath || column.id,
      label: column.title || column.label || column.id,
      required: column.required === true || column.requiredWhenVisible === true,
      placeholder: column.placeholder || undefined,
      helpText: column.helpText,
    }
    switch (column.type) {
      case "number":
        return {
          ...base,
          type: "number",
          numberConfig: {
            typeNumber: column.numberConfig?.typeNumber || column.typeNumber || "number",
            suffix: column.numberConfig?.suffix ?? column.suffix,
            buttonControls: column.numberConfig?.buttonControls ?? column.buttonControls ?? false,
            storeAsNumber: column.numberConfig?.storeAsNumber ?? column.storeAsNumber ?? true,
            spinButtonProps: {
              min: column.numberConfig?.spinButtonProps?.min ?? column.min,
              max: column.numberConfig?.spinButtonProps?.max ?? column.max,
              step: column.numberConfig?.spinButtonProps?.step ?? column.step,
            },
          },
        }
      case "date": {
        // The builder stores a date-time column's time as dateConfig.withTime
        // (older runtime columns carried withTime at the top).
        const withTime = column.withTime === true || column.dateConfig?.withTime === true
        return {
          ...base,
          type: withTime ? "datetime" : "date",
          dateConfig: { withTime, dateFormat: column.dateConfig?.dateFormat },
        }
      }
      case "time":
        return { ...base, type: "time" }
      case "dropdown":
      case "choice":
        return {
          ...base,
          type: "choice",
          // A column without a style is a dropdown (DEFAULT_CHOICE_STYLE.tableColumn).
          choiceStyle: column.choiceStyle || "dropdown",
          options: Array.isArray(column.options) ? column.options : [],
          codeSystem: column.codeSystem || undefined,
          showOtherOption: column.showOtherOption === true,
        }
      case "checkbox":
      case "booleanYesNo":
        return {
          ...base,
          type: "booleanSingle",
          presentation: "checkbox",
          booleanLabels: column.booleanLabels,
        }
      case "text":
      default:
        return column.textareaConfig?.multiline
          ? { ...base, type: "textarea", textareaConfig: { rows: column.textareaConfig.rows, resizable: column.textareaConfig.resizable } }
          : { ...base, type: "text" }
    }
  }

  // A SubformScoring data-entry field (SUBFORM_ENTRY_TYPES plus legacy spellings).
  const fromSubformEntry = (field = {}) => {
    const base = {
      id: field.id,
      label: field.label,
      required: field.required === true,
      placeholder: field.placeholder,
      helpText: field.helpText,
    }
    switch (field.type) {
      case "number":
        return {
          ...base,
          type: "number",
          numberConfig: {
            typeNumber: field.typeNumber || (Number.isInteger(Number(field.step ?? 1)) ? "number" : "decimal"),
            suffix: field.suffix,
            buttonControls: field.buttonControls === true,
            storeAsNumber: field.storeAsNumber !== false,
            spinButtonProps: { min: field.min, max: field.max, step: field.step },
          },
        }
      case "date":
        return { ...base, type: "date" }
      case "datetime":
        return { ...base, type: "datetime" }
      case "time":
        return { ...base, type: "time" }
      case "choice":
        return {
          ...base,
          type: "choice",
          // A subform entry holds one answer: radio, dropdown (the default,
          // DEFAULT_CHOICE_STYLE.subformEntry) or, from older configurations,
          // a searchable findCode; multiple styles draw their single twin.
          choiceStyle: field.choiceStyle === "radio" || field.choiceStyle === "checkbox"
            ? "radio"
            : field.choiceStyle === "findCode" || field.choiceStyle === "multiselect"
              ? "findCode"
              : "dropdown",
          options: Array.isArray(field.options) ? field.options : [],
          codeSystem: field.codeSystem,
          showOtherOption: Boolean(field.showOtherOption || field.show_other_option),
        }
      case "booleanYesNo": {
        const renderStyle = String(field.renderStyle || field.render_style || "").trim().toLowerCase()
        return {
          ...base,
          type: "booleanYesNo",
          presentation: renderStyle === "checkbox" || renderStyle === "checklist-row" ? "checkbox" : "buttons",
        }
      }
      case "scale":
        return {
          ...base,
          type: "scale",
          scaleConfig: {
            min: field.min,
            max: field.max,
            minLabel: field.minLabel,
            maxLabel: field.maxLabel,
            options: field.options,
            showLegend: field.showLegend === true,
            showInlineLabels: field.showInlineLabels !== false,
            showTooltip: field.showTooltip === true,
          },
        }
      case "textarea":
        return { ...base, type: "textarea", textareaConfig: { rows: field.rows || 4 } }
      case "heading":
        return { ...base, type: "heading" }
      default:
        return { ...base, type: "text" }
    }
  }

  // A PanelEntryGrid row (scale/coded, numeric/number, text, choice).
  const fromPanelRow = (row = {}, { scaleLike = false } = {}) => {
    const type = String(row.type ?? "text").toLowerCase()
    const base = { id: row.id, label: row.label, required: row.required === true }
    if (scaleLike) return { ...base, type: "scale", scaleConfig: { options: row.options } }
    if (type === "choice" || type === "coded") {
      return { ...base, type: "choice", choiceStyle: "dropdown", options: Array.isArray(row.options) ? row.options : [], system: row.system }
    }
    if (type === "numeric" || type === "number") {
      return {
        ...base,
        type: "number",
        numberConfig: { typeNumber: "decimal", spinButtonProps: { min: row.min, max: row.max, step: row.step } },
      }
    }
    return row.multiline === false ? { ...base, type: "text" } : { ...base, type: "textarea", textareaConfig: { rows: row.rows || 3 } }
  }

  // An ActionButtonGroup dialog field (dropdown, combo, date, textarea, text).
  const fromActionField = (field = {}) => {
    const base = { id: field.id, label: field.label, placeholder: field.placeholder, required: field.required === true }
    const options = Array.isArray(field.options)
      ? field.options.map((option) => (isRecord(option)
        ? { key: option.key ?? option.value, label: option.text ?? option.label ?? option.value }
        : { key: option, label: option }))
      : []
    switch (field.type) {
      case "dropdown":
        return { ...base, type: "choice", choiceStyle: "dropdown", options }
      case "combo":
        return { ...base, type: "choice", choiceStyle: "findCode", options, showOtherOption: true }
      case "date":
        return { ...base, type: "date" }
      case "textarea":
        return { ...base, type: "textarea", textareaConfig: { rows: field.rows || 3 } }
      default:
        return { ...base, type: "text" }
    }
  }

  return {
    BOX_FIELD_ID,
    controlFor,
    renderControl,
    optionsOf,
    codingsOf,
    toDateText,
    toDateTimeText,
    storage: {
      cell: cellStorage,
      entry: entryStorage,
      coding: codingStorage,
      text: textStorage,
    },
    fromTableColumn,
    fromSubformEntry,
    fromPanelRow,
    fromActionField,
  }
})()
