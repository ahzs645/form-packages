// RepeatForEachTable — an EditableTable whose rows are seeded from another
// table field (tableConfig.repeatFor): one row per source row, filtered by a
// condition over the source row, keyed by a source column or the source
// _rowId, with orphaned rows removed or kept and flagged (_sourceRemoved) and
// a per-row completion flag (_complete).
//
// Emitted by the MOIS exporter (lib/mois-export/renderers/repeat-table-renderer.ts)
// in place of <EditableTable> for tables with repeatFor, row completion or
// delete confirmation. Every EditableTable prop passes through; the extra
// props are:
//   repeatFor = { sourceFieldId, keyColumnId?, labelColumnId?, labelTitle?,
//                 labelTargetColumnId?, filter?, orphanPolicy?, allowManualRows?,
//                 emptyMessage? (shown when no source row matches),
//                 presentation? ("grid" default | "cards": one card per item) }
//   rowCompletion = { enabled, requiredColumnIds?, requireAllComplete?, statusLabel? }
//   confirmDelete = true to ask before a row is deleted
//   translate = the form's translateFormText (uiTranslations for
//               fd.field.status.__formLocale); every built-in and authored
//               string shown here goes through it. _rowStatus stays English;
//               the grid shows the translated _rowStatusText.
//
// presentation "cards" renders each row as a card headed by its label (and a
// "No longer listed" flag for kept orphans), its questions stacked with the
// same MOIS controls and value shapes EditableTable's cells use, and a status
// line. The data (the rows array), sync, completion and validation are the
// same as the grid. Tables with a stamp column or per-row authorship locks
// keep the grid (those need EditableTable's own machinery).
//
// Row metadata (same underscore convention as EditableTable's _rowId, see
// TABLE_ROW_META in @webforms/form-model): _sourceKey, _sourceRemoved,
// _complete, plus the display-only _sourceLabel and _rowStatus.
//
// The label and status are shown through extra EditableTable columns, so
// EditableTable itself is unchanged: in inline mode they are always-calculated
// formula columns reading the row's own _sourceLabel / _rowStatus (rendered
// read-only); in modal mode they are template columns (display cells).
//
// Sync contract: rows are rewritten ONLY when a _rowId-insensitive content
// signature changes (EditableTable's React #185 lesson), the rewrite is a
// produce recipe computed from the draft (never a spread snapshot), and a
// burst guard stops writing if the sync ever fails to converge.
//
// EditableTable, FormLogicKit and FormulaKit are referenced only inside
// function bodies (component files load in no guaranteed order).

const RepeatForEachTable = (props) => {
  const {
    repeatFor,
    rowCompletion,
    confirmDelete,
    translate,
    ...tableProps
  } = props
  const [fd, setFd] = useActiveData()
  const section = typeof useSection === "function" ? useSection() : null
  const theme = typeof useTheme === "function" ? useTheme() : null
  const isDarkMode = !!(theme && theme.isInverted)
  const [notice, setNotice] = React.useState("")
  const [pendingDelete, setPendingDelete] = React.useState(null)
  const burstRef = React.useRef({ since: 0, count: 0, halted: false })
  const helpers = RepeatForEachTable.helpers
  const t = (source, vars) => helpers.formatText(translate, source, vars)

  const id = tableProps.id || "editableTable"
  const rowsPath = tableProps.rowsPath || id
  const countPath = tableProps.countPath
  const locked = !!(tableProps.readOnly || tableProps.disabled)
  const repeatConfig = repeatFor && repeatFor.sourceFieldId ? repeatFor : null
  const completion = rowCompletion && rowCompletion.enabled ? rowCompletion : null
  const isModalMode = tableProps.mode === "modal"
  const baseColumns = Array.isArray(tableProps.columns) ? tableProps.columns : []

  // translateFormText is a new function every render: key the grid's display
  // columns on the translated text, not on the function.
  const displayTextKey = [
    t((repeatConfig && repeatConfig.labelTitle) || "Item"),
    t((completion && completion.statusLabel) || "Status"),
    typeof translate === "function" ? "translated" : "",
  ].join("\u0000")
  const columns = React.useMemo(
    () => helpers.buildColumns(baseColumns, repeatConfig, completion, isModalMode, translate),
    [baseColumns, repeatConfig, completion, isModalMode, displayTextKey]
  )

  // "One card per item": same rows, one card each. Stamp columns and
  // per-row authorship locks need EditableTable's own machinery, so those
  // tables keep the grid.
  const authorshipPolicy = tableProps.authorshipPolicy || (section && section.authorshipPolicy) || null
  const authorshipActive = !!(typeof window !== "undefined" && window.__nhAuth && authorshipPolicy && authorshipPolicy.enabled)
  const showCards = !!(repeatConfig && repeatConfig.presentation === "cards") &&
    !helpers.cardsUnsupportedReason(baseColumns, authorshipActive)

  const fieldData = fd && fd.field && fd.field.data ? fd.field.data : {}
  const targetRows = helpers.normalizeRows(helpers.getPath(fieldData, rowsPath))
  const sourceRows = repeatConfig ? helpers.readSourceRows(fieldData, repeatConfig) : []
  // With the form's translateFormText the rows also carry _rowStatusText (the
  // translated status the grid shows); stored _rowStatus stays English.
  const syncOptions = { repeatFor: repeatConfig, rowCompletion: completion, columns: baseColumns, translate: typeof translate === "function" ? translate : null }

  const writer = (fd && typeof fd.setFormData === "function" ? fd.setFormData : null) || setFd

  // Mirrored per-row source fields (PDF row maps) follow the rows, the same
  // way EditableTable's own setRows keeps them in step.
  const writeRowsRecipe = (compute) => {
    if (typeof writer !== "function") return
    writer(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      const data = draft.field.data
      const current = helpers.normalizeRows(helpers.getPath(data, rowsPath))
      const currentPlain = current ? JSON.parse(JSON.stringify(current)) : null
      const next = compute(currentPlain, data)
      if (!Array.isArray(next)) return
      if (currentPlain && helpers.signature(currentPlain) === helpers.signature(next)) return
      helpers.setPath(data, rowsPath, next)
      if (countPath) helpers.setPath(data, countPath, next.length)
      helpers.mirrorRows(data, next, baseColumns, tableProps.sourceFieldIds, tableProps.sourceFieldIdsByRow)
    }))
  }

  const sourceSignature = repeatConfig ? helpers.signature(sourceRows) : ""
  const targetSignature = targetRows ? helpers.signature(targetRows) : "null"
  const configSignature = JSON.stringify([repeatConfig, completion])
  const needsSync = (() => {
    if (locked) return false
    if (!repeatConfig && !targetRows) return false
    if (!repeatConfig && !completion && !targetRows.some(helpers.hasRowMeta)) return false
    const next = helpers.syncRows(sourceRows, targetRows || [], syncOptions)
    return !targetRows || helpers.signature(next) !== targetSignature
  })()

  React.useEffect(() => {
    if (!needsSync) return
    const burst = burstRef.current
    const now = Date.now()
    if (now - burst.since > 1000) {
      burst.since = now
      burst.count = 0
    }
    burst.count += 1
    if (burst.count > 25) {
      if (!burst.halted) {
        burst.halted = true
        console.warn("RepeatForEachTable: row sync did not settle; stopped updating " + id)
      }
      return
    }
    writeRowsRecipe((current, data) => {
      const liveSource = repeatConfig ? helpers.readSourceRows(data, repeatConfig) : []
      return helpers.syncRows(JSON.parse(JSON.stringify(liveSource)), current || [], syncOptions)
    })
  }, [needsSync, sourceSignature, targetSignature, configSignature, locked])

  // EditableTable has already written the delete when this runs; put the row
  // back in the same batch when the deletion is not allowed or needs a yes.
  const handleRowsChange = (event) => {
    if (typeof tableProps.onRowsChange === "function") tableProps.onRowsChange(event)
    if (!event || event.reason !== "delete" || !event.row) return
    const row = event.row
    const sourceDriven = !!(row._sourceKey && !row._sourceRemoved && repeatConfig)
    if (!sourceDriven && !confirmDelete) return
    const previousRows = Array.isArray(event.previousRows) ? JSON.parse(JSON.stringify(event.previousRows)) : null
    if (!previousRows) return
    writeRowsRecipe(() => previousRows)
    if (sourceDriven) {
      setNotice(t("This row follows the table it repeats for; change that table to remove it."))
      return
    }
    setNotice("")
    setPendingDelete({ rowId: row._rowId, label: row._sourceLabel || "" })
  }

  const confirmPendingDelete = () => {
    const target = pendingDelete
    setPendingDelete(null)
    if (!target) return
    writeRowsRecipe((current) => (current || []).filter((row) => row && row._rowId !== target.rowId))
  }

  // Seeded tables wait for the first sync so EditableTable never seeds its own
  // blank rows underneath them.
  if (repeatConfig && !targetRows && !locked) {
    return <div data-repeat-for-table={id} />
  }

  const allowManualRows = !repeatConfig || repeatConfig.allowManualRows === true
  const orphanPolicy = repeatConfig ? repeatConfig.orphanPolicy || "remove-if-unanswered" : "remove"
  const allowDeleteRows = tableProps.allowDeleteRows !== false &&
    (allowManualRows || orphanPolicy !== "remove")
  const { Dialog, DialogType, DialogFooter, PrimaryButton, DefaultButton, Text, Label } = Fluent

  // Empty state: nothing in the source table matches, so there is nothing to
  // answer. The grid is dropped too unless people may add their own rows or
  // kept (orphaned) rows still show.
  const rows = targetRows || []
  const noItems = !!repeatConfig && !rows.some((row) => row && row._sourceKey && !row._sourceRemoved)
  const emptyText = noItems
    ? (typeof repeatConfig.emptyMessage === "string" && repeatConfig.emptyMessage.trim() && t(repeatConfig.emptyMessage.trim())) ||
      t("No matching {items} — nothing to answer here.", {
        items: repeatConfig.labelTitle ? t(String(repeatConfig.labelTitle).trim()).toLowerCase() : t("items"),
      })
    : ""
  const showGrid = !noItems || rows.length > 0 || allowManualRows

  // ---- Cards ----
  const mutedColor = isDarkMode ? "#c8c8c8" : "#605e5c"
  const textColor = isDarkMode ? "#f3f4f6" : "#323130"
  const maxRows = Number(tableProps.maxRows) > 0 ? Number(tableProps.maxRows) : Number.POSITIVE_INFINITY
  const canAddCard = !locked && allowManualRows && tableProps.allowAddRows !== false && rows.length < maxRows
  const questionColumns = showCards ? helpers.cardColumns(baseColumns, repeatConfig, isModalMode) : []

  const notifyRowsChange = (event) => {
    if (typeof tableProps.onRowsChange === "function") tableProps.onRowsChange(event)
  }

  const writeCardCell = (rowId, column, value) => {
    if (locked) return
    writeRowsRecipe((current) => helpers.writeCell(current || [], rowId, column, value, baseColumns))
    notifyRowsChange({ tableId: id, reason: "update", rowId, columnId: column.id })
  }

  const addCard = () => {
    if (!canAddCard) return
    writeRowsRecipe((current) => (current || []).concat([helpers.blankRow(baseColumns)]))
    notifyRowsChange({ tableId: id, reason: "add" })
  }

  const deleteCard = (row) => {
    if (locked || !row) return
    if (confirmDelete) {
      setNotice("")
      setPendingDelete({ rowId: row._rowId, label: row._sourceLabel || "" })
      return
    }
    writeRowsRecipe((current) => (current || []).filter((entry) => entry && entry._rowId !== row._rowId))
    notifyRowsChange({ tableId: id, reason: "delete", row })
  }

  const renderCardControl = (row, column) => {
    const path = helpers.columnPath(column)
    const value = helpers.getPath(row, path)
    const rowId = row._rowId
    if (locked || helpers.isComputedColumn(column)) {
      return (
        <Text styles={{ root: { color: textColor, whiteSpace: "pre-wrap" } }}>
          {helpers.formatCell(row, column) || " "}
        </Text>
      )
    }
    const onValue = (next) => writeCardCell(rowId, column, next)
    switch (column.type) {
      case "number": {
        const settings = helpers.numberSettings(column)
        const spinButtonProps = {}
        Object.keys(settings.spinButtonProps).forEach((key) => {
          if (settings.spinButtonProps[key] !== undefined && settings.spinButtonProps[key] !== null) spinButtonProps[key] = settings.spinButtonProps[key]
        })
        return (
          <Numeric
            inline={true}
            typeNumber={settings.typeNumber}
            buttonControls={settings.buttonControls}
            value={value === undefined || value === null ? "" : value.toString()}
            onChange={(valueOrEvent, nextValue) => onValue(helpers.coerceNumber(nextValue === undefined ? valueOrEvent : nextValue, column))}
            spinButtonProps={spinButtonProps}
            textFieldProps={settings.suffix ? { suffix: settings.suffix } : undefined}
            storeAsNumber={settings.storeAsNumber !== false}
          />
        )
      }
      case "date":
        if (column.withTime) {
          return (
            <DateTimeSelect
              inline={true}
              value={value || ""}
              onChange={(next) => onValue(next || "")}
              placeholder={column.placeholder || "Select date and time"}
            />
          )
        }
        return (
          <DateSelect
            dateFormat={column.dateConfig ? column.dateConfig.dateFormat : undefined}
            inline={true}
            value={value || ""}
            onChange={(next) => onValue(helpers.dateCellValue(next))}
            placeholder={column.placeholder || "Select date"}
          />
        )
      case "time":
        return (
          <TimeSelect
            inline={true}
            value={value || ""}
            onChange={(event, next) => onValue(next || "")}
            placeholder={column.placeholder || "HH:mm"}
          />
        )
      case "dropdown": {
        const options = helpers.choiceOptions(column.options)
        const multiple = column.choiceStyle === "multiselect" || column.choiceStyle === "checkbox"
        return (
          <SimpleCodeSelect
            inline={true}
            optionList={column.codeSystem ? undefined : options}
            codeSystem={column.codeSystem || undefined}
            selectionType={multiple ? "multiple" : "single"}
            value={helpers.choiceForControl(value, column, options)}
            onChange={(coding, codings) => onValue(helpers.choiceForStorage(coding, codings, column))}
            placeholder={column.placeholder || "Select..."}
            showOther={column.showOtherOption === true}
          />
        )
      }
      case "checkbox":
        return (
          <OptionChoice
            inline={true}
            displayStyle="checkmark"
            value={value}
            onChange={(event, checked) => onValue(!!checked)}
          />
        )
      case "text":
      default:
        return (
          <TextArea
            multiline={column.textareaConfig ? column.textareaConfig.multiline : undefined}
            textFieldProps={column.textareaConfig ? { rows: column.textareaConfig.rows, resizable: column.textareaConfig.resizable } : undefined}
            inline={true}
            value={value || ""}
            onChange={(event, next) => onValue(next || "")}
            placeholder={column.placeholder || ""}
          />
        )
    }
  }

  const renderCard = (row, index) => {
    const removed = !!row._sourceRemoved
    const manual = !row._sourceKey
    const heading = row._sourceLabel
      ? String(row._sourceLabel)
      : manual
        ? t("Added item {n}", { n: index + 1 })
        : t((repeatConfig && repeatConfig.labelTitle) || "Item") + " " + (index + 1)
    const status = typeof row._rowStatus === "string" && row._rowStatus ? row._rowStatus : ""
    const statusColor = status === helpers.STATUS_TEXT.complete
      ? (isDarkMode ? "#92c353" : "#107c10")
      : status === helpers.STATUS_TEXT.incomplete
        ? (isDarkMode ? "#fce100" : "#8a6a00")
        : mutedColor
    const canDelete = !locked && allowDeleteRows && (manual || removed)
    return (
      <div
        key={row._rowId || index}
        role="group"
        aria-label={heading}
        data-repeat-for-card={row._rowId || String(index)}
        data-repeat-for-orphan={removed ? "" : undefined}
        style={{
          border: "1px " + (removed ? "dashed " : "solid ") + (isDarkMode ? "#505050" : removed ? "#a19f9d" : "#e1dfdd"),
          borderRadius: 4,
          padding: "10px 14px 12px",
          marginBottom: 10,
          background: removed ? (isDarkMode ? "#262626" : "#faf9f8") : (isDarkMode ? "#1f1f1f" : "#ffffff"),
          breakInside: "avoid",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <Text variant="mediumPlus" styles={{ root: { fontWeight: 600, color: removed ? mutedColor : textColor } }}>
            {heading}
          </Text>
          {removed ? (
            <Text data-repeat-for-orphan-flag="" variant="small" styles={{ root: { padding: "1px 8px", borderRadius: 10, border: "1px solid " + (isDarkMode ? "#8a8886" : "#a19f9d"), color: mutedColor } }}>
              {t(helpers.STATUS_TEXT.removed)}
            </Text>
          ) : null}
          {canDelete ? (
            <span className="hideonprint" style={{ marginLeft: "auto" }}>
              <DefaultButton text={t("Remove")} onClick={() => deleteCard(row)} />
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {questionColumns.filter((column) => helpers.columnVisible(column, row)).map((column) => (
            <div key={column.id} data-repeat-for-question={column.id}>
              <Label required={column.required === true}>{column.title || column.label || column.id}</Label>
              <span className="showonprint" style={{ display: "none", whiteSpace: "pre-wrap" }}>
                {helpers.formatCell(row, column) || " "}
              </span>
              <div className="hideonprint">{renderCardControl(row, column)}</div>
            </div>
          ))}
        </div>
        {status && !removed ? (
          <Text data-repeat-for-card-status="" role="status" variant="small" styles={{ root: { display: "block", marginTop: 8, color: statusColor, fontWeight: 600 } }}>
            {t((completion && completion.statusLabel) || "Status") + ": " + t(status)}
          </Text>
        ) : null}
      </div>
    )
  }

  const renderCards = () => (
    <div data-repeat-for-cards="">
      {tableProps.label ? (
        <Label styles={{ root: { fontSize: "16px", fontWeight: 600, marginBottom: 8 } }}>{tableProps.label}</Label>
      ) : null}
      {rows.map((row, index) => (row && typeof row === "object" ? renderCard(row, index) : null))}
      {canAddCard ? (
        <div className="hideonprint">
          <DefaultButton text={t(tableProps.addButtonText || "+ Add Row")} onClick={addCard} />
        </div>
      ) : null}
    </div>
  )

  return (
    <div data-repeat-for-table={id} data-repeat-for-presentation={showCards ? "cards" : undefined}>
      {emptyText ? (
        <Text data-repeat-for-empty="" role="note" variant="small" styles={{ root: { display: "block", margin: "4px 0 6px", color: "#605e5c", fontStyle: "italic" } }}>
          {emptyText}
        </Text>
      ) : null}
      {showGrid && showCards ? renderCards() : null}
      {showGrid && !showCards ? (
        <EditableTable
          {...tableProps}
          columns={columns}
          addButtonText={tableProps.addButtonText ? t(tableProps.addButtonText) : undefined}
          allowAddRows={allowManualRows && tableProps.allowAddRows !== false}
          allowDeleteRows={allowDeleteRows}
          onRowsChange={handleRowsChange}
        />
      ) : null}
      {notice ? (
        <Text role="status" variant="small" styles={{ root: { display: "block", marginTop: 6, color: "#605e5c" } }}>
          {notice}
        </Text>
      ) : null}
      {pendingDelete ? (
        <Dialog
          hidden={false}
          onDismiss={() => setPendingDelete(null)}
          dialogContentProps={{
            type: DialogType.normal,
            title: t("Delete this row?"),
            subText: pendingDelete.label
              ? t("\"{label}\" and its answers will be removed.", { label: pendingDelete.label })
              : t("The row and its answers will be removed."),
          }}
          modalProps={{ isBlocking: true }}
        >
          <DialogFooter>
            <PrimaryButton text={t("Delete")} onClick={confirmPendingDelete} />
            <DefaultButton text={t("Cancel")} onClick={() => setPendingDelete(null)} />
          </DialogFooter>
        </Dialog>
      ) : null}
    </div>
  )
}

// Pure row logic, exposed for tests and for any consumer that needs the same
// semantics (row completion mirrors FormLogicKit.validate's table branch).
RepeatForEachTable.helpers = (() => {
  const LABEL_KEY = "_sourceLabel"
  const STATUS_KEY = "_rowStatus"
  // Display-only translation of _rowStatus, kept by the mounted table (which
  // has the form's translateFormText); the off-page sync leaves it alone.
  const STATUS_TEXT_KEY = "_rowStatusText"
  const LABEL_COLUMN_ID = "__repeatLabel"
  const STATUS_COLUMN_ID = "__repeatStatus"
  const STATUS_TEXT = { complete: "Complete", incomplete: "Incomplete", removed: "No longer listed" }

  const toSegments = (path) => String(path || "").split(".").map((part) => part.trim()).filter(Boolean)

  const getPath = (root, path) => {
    const segments = toSegments(path)
    if (segments.length === 0) return undefined
    let current = root
    for (const segment of segments) {
      if (!current || typeof current !== "object") return undefined
      current = current[segment]
    }
    return current
  }

  const setPath = (root, path, value) => {
    const segments = toSegments(path)
    if (segments.length === 0) return root
    let current = root
    for (let index = 0; index < segments.length - 1; index += 1) {
      const key = segments[index]
      if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) current[key] = {}
      current = current[key]
    }
    current[segments[segments.length - 1]] = value
    return root
  }

  const normalizeRows = (value) => {
    if (Array.isArray(value)) return value
    if (value && Array.isArray(value.rows)) return value.rows
    return null
  }

  // EditableTable's notion of an answer: an unchecked checkbox is not one.
  const isMeaningful = (value) => {
    if (value === undefined || value === null) return false
    if (typeof value === "string") return value.trim().length > 0
    if (typeof value === "boolean") return value
    if (typeof value === "number") return !Number.isNaN(value)
    if (Array.isArray(value)) return value.some(isMeaningful)
    if (typeof value === "object") return Object.keys(value).length > 0
    return true
  }

  const toText = (value) => {
    if (value === undefined || value === null) return ""
    if (typeof value === "string") return value.trim()
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ")
    if (typeof value === "object") return toText(value.display ?? value.text ?? value.value ?? value.code ?? value.key ?? "")
    return String(value)
  }

  const stableStringify = (value) => {
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]"
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => JSON.stringify(key) + ":" + stableStringify(value[key]))
        .join(",") + "}"
    }
    return JSON.stringify(value === undefined ? null : value)
  }

  // Row content with the volatile _rowId stripped.
  const signature = (rows) => stableStringify((rows || []).map((row) => {
    if (!row || typeof row !== "object") return row
    const { _rowId, ...rest } = row
    return rest
  }))

  const columnPath = (column) => (column && (column.dataPath || column.fieldName || column.id)) || ""
  const isComputedColumn = (column) => !!(column && column.computedValue && column.computedValue.mode)
  const isInjectedColumn = (column) => !!column && (column.id === LABEL_COLUMN_ID || column.id === STATUS_COLUMN_ID)

  const hasRowMeta = (row) => !!row && (row._complete !== undefined || row[STATUS_KEY] !== undefined)

  const defaultCellValue = (column) => {
    if (column.type === "checkbox") return column.prefill === true
    if (typeof column.prefill === "string" || typeof column.prefill === "number") return String(column.prefill)
    return ""
  }

  // Columns whose cells are the filler's answers (not the label copy, not
  // calculated). An untouched prefill is not an answer.
  const answerColumns = (columns, repeatFor) => (columns || []).filter((column) =>
    column && !isComputedColumn(column) && !isInjectedColumn(column) &&
    !(repeatFor && repeatFor.labelTargetColumnId && column.id === repeatFor.labelTargetColumnId)
  )

  const cellAnswered = (row, column) => {
    const value = getPath(row, columnPath(column))
    if (column.type !== "checkbox" && column.prefill !== undefined && column.prefill !== null && toText(value) === String(column.prefill)) return false
    return isMeaningful(value)
  }

  const rowAnswered = (row, columns, repeatFor) =>
    answerColumns(columns, repeatFor).some((column) => cellAnswered(row, column))

  const requiredColumns = (columns, repeatFor, rowCompletion) => {
    const ids = rowCompletion && Array.isArray(rowCompletion.requiredColumnIds) ? rowCompletion.requiredColumnIds : null
    const answers = answerColumns(columns, repeatFor)
    if (!ids || ids.length === 0) return answers
    return (columns || []).filter((column) => column && (ids.includes(column.id) || ids.includes(columnPath(column))))
  }

  const rowComplete = (row, columns, repeatFor, rowCompletion) =>
    requiredColumns(columns, repeatFor, rowCompletion).every((column) => cellAnswered(row, column))

  const sourceRowHasContent = (row) => !!row && typeof row === "object" &&
    Object.keys(row).some((key) => key.charAt(0) !== "_" && isMeaningful(row[key]))

  const readSourceRows = (data, repeatFor) => {
    if (!data || !repeatFor || !repeatFor.sourceFieldId) return []
    const direct = repeatFor.sourceRowsPath ? getPath(data, repeatFor.sourceRowsPath) : undefined
    const value = direct !== undefined
      ? direct
      : Object.prototype.hasOwnProperty.call(data, repeatFor.sourceFieldId)
        ? data[repeatFor.sourceFieldId]
        : FormLogicKit.readValue(data, repeatFor.sourceFieldId)
    return normalizeRows(value) || []
  }

  const filterPasses = (row, filter) => {
    if (!filter || !Array.isArray(filter.conditions) || filter.conditions.length === 0) return true
    return FormLogicKit.evaluateGroup(filter, (columnId) => getPath(row, columnId))
  }

  /**
   * The target rows for the current source rows. Pure and idempotent:
   * syncRows(source, syncRows(source, rows)) has the same signature.
   * options: { repeatFor, rowCompletion, translate? (sets _rowStatusText), columns (target, without the
   * injected label/status columns), makeRowId?, rowIds? (key -> _rowId for
   * new rows) }
   */
  const syncRows = (sourceRows, targetRows, options = {}) => {
    const repeatFor = options.repeatFor && options.repeatFor.sourceFieldId ? options.repeatFor : null
    const completion = options.rowCompletion && options.rowCompletion.enabled ? options.rowCompletion : null
    const columns = Array.isArray(options.columns) ? options.columns : []
    const translate = typeof options.translate === "function" ? options.translate : null
    let counter = 0
    const makeRowId = typeof options.makeRowId === "function"
      ? options.makeRowId
      : () => "row_" + Date.now() + "_" + (counter += 1) + "_" + Math.random().toString(36).slice(2, 7)
    const rows = (Array.isArray(targetRows) ? targetRows : []).filter((row) => row && typeof row === "object")
    const labelTarget = repeatFor && repeatFor.labelTargetColumnId
      ? columns.find((column) => column && column.id === repeatFor.labelTargetColumnId)
      : null

    const live = []
    if (repeatFor) {
      const seen = {}
      ;(Array.isArray(sourceRows) ? sourceRows : []).forEach((sourceRow, index) => {
        if (!sourceRowHasContent(sourceRow) || !filterPasses(sourceRow, repeatFor.filter)) return
        const baseKey = repeatFor.keyColumnId
          ? toText(getPath(sourceRow, repeatFor.keyColumnId))
          : String(sourceRow._rowId || "row_" + index)
        if (!baseKey) return
        seen[baseKey] = (seen[baseKey] || 0) + 1
        const key = seen[baseKey] > 1 ? baseKey + "#" + seen[baseKey] : baseKey
        const label = repeatFor.labelColumnId ? toText(getPath(sourceRow, repeatFor.labelColumnId)) : ""
        live.push({ key, label })
      })
    }
    const liveKeys = {}
    live.forEach((entry) => { liveKeys[entry.key] = true })

    const claimed = {}
    const byKey = {}
    rows.forEach((row) => {
      if (row._sourceKey && !byKey[row._sourceKey]) byKey[row._sourceKey] = row
    })

    const next = []
    live.forEach((entry) => {
      const existing = byKey[entry.key]
      let row
      if (existing) {
        row = { ...existing }
        claimed[entry.key] = existing
      } else {
        // rowIds (key -> _rowId) lets a second pass over the same answers
        // reuse the ids a first, pure pass chose (see syncTablesInPlace).
        const reused = options.rowIds && typeof options.rowIds[entry.key] === "string" ? options.rowIds[entry.key] : ""
        row = { _rowId: reused || makeRowId() }
        columns.forEach((column) => {
          if (!column || isInjectedColumn(column) || isComputedColumn(column)) return
          setPath(row, columnPath(column), defaultCellValue(column))
        })
      }
      row._sourceKey = entry.key
      delete row._sourceRemoved
      row[LABEL_KEY] = entry.label
      if (labelTarget) setPath(row, columnPath(labelTarget), entry.label)
      next.push(row)
    })

    const policy = repeatFor ? repeatFor.orphanPolicy || "remove-if-unanswered" : "remove"
    rows.forEach((row) => {
      if (!row._sourceKey || claimed[row._sourceKey] === row) return
      if (!repeatFor) {
        // Not a seeded table: nothing is an orphan; keep the row as it is.
        next.push({ ...row })
        return
      }
      if (liveKeys[row._sourceKey] && claimed[row._sourceKey]) {
        // A duplicate of a claimed key: keep only if it carries answers.
        if (!rowAnswered(row, columns, repeatFor)) return
      }
      if (policy === "remove") return
      if (policy === "remove-if-unanswered" && !rowAnswered(row, columns, repeatFor)) return
      next.push({ ...row, _sourceRemoved: true })
    })

    const allowManualRows = !repeatFor || repeatFor.allowManualRows === true
    const showStatus = statusColumnShown(repeatFor, completion)
    rows.forEach((row) => {
      if (row._sourceKey) return
      if (!allowManualRows && !rowAnswered(row, columns, repeatFor)) return
      next.push({ ...row })
    })

    next.forEach((row) => {
      const manual = !row._sourceKey
      let status = ""
      if (row._sourceRemoved) status = STATUS_TEXT.removed
      if (completion) {
        const complete = rowComplete(row, columns, repeatFor, completion)
        row._complete = complete
        if (!status && !(manual && !rowAnswered(row, columns, repeatFor))) {
          status = complete ? STATUS_TEXT.complete : STATUS_TEXT.incomplete
        }
      } else {
        delete row._complete
      }
      // While the status column is shown EditableTable fills an absent
      // _rowStatus with "", so keep the key present to avoid churn.
      if (showStatus) row[STATUS_KEY] = status
      else delete row[STATUS_KEY]
      if (!showStatus) delete row[STATUS_TEXT_KEY]
      else if (translate) row[STATUS_TEXT_KEY] = status ? formatText(translate, status) : ""
    })
    return next
  }

  const statusColumnShown = (repeatFor, rowCompletion) =>
    !!((rowCompletion && rowCompletion.enabled !== false) || (repeatFor && (repeatFor.orphanPolicy || "remove-if-unanswered") !== "remove"))

  // ---- Translation ----
  // `translate` is the form's translateFormText (uiTranslations keyed by the
  // English source text for fd.field.status.__formLocale), handed over as a
  // prop by the exporter. _rowStatus is always the English STATUS_TEXT value
  // (validation, the off-page sync and tests read it); the translation goes
  // in the display-only _rowStatusText, which only the mounted table (the one
  // with a translate function) writes and the off-page sync leaves alone, so
  // the two never fight. Placeholders ({name}) are filled after translation.
  const formatText = (translate, source, vars) => {
    let text = source === undefined || source === null ? "" : String(source)
    if (typeof translate === "function" && text) {
      const translated = translate(text)
      if (typeof translated === "string" && translated) text = translated
    }
    if (vars) {
      Object.keys(vars).forEach((key) => {
        text = text.split("{" + key + "}").join(vars[key] === undefined || vars[key] === null ? "" : String(vars[key]))
      })
    }
    return text
  }

  // Extra display columns: the row label first, the status last. Inline mode
  // uses always-calculated formula columns that read the row's own meta key
  // (read-only cells); modal mode uses template columns (display cells, and
  // a template column keeps the row visible in the summary table). With a
  // `translate` function the status column shows _rowStatusText (the
  // translated status the mounted table keeps) and the headings are
  // translated; without one the output is exactly as before.
  const buildColumns = (columns, repeatFor, rowCompletion, isModalMode, translate) => {
    const base = Array.isArray(columns) ? columns : []
    const showLabel = !!(repeatFor && repeatFor.labelColumnId && !repeatFor.labelTargetColumnId)
    const showStatus = statusColumnShown(repeatFor, rowCompletion)
    if (!showLabel && !showStatus) return base
    const displayColumn = (id, title, path) => (isModalMode
      ? { id, title, type: "text", dataPath: path, showInTable: true, showInModal: false, computedValue: { mode: "template", template: "{" + path + "}" } }
      : { id, title, type: "text", dataPath: path, showInTable: true, showInModal: false, computedValue: { mode: "formula", expression: "[" + path + "]", calculationPolicy: "always-calculated" } })
    const statusPath = typeof translate === "function" ? STATUS_TEXT_KEY : STATUS_KEY
    return [
      ...(showLabel ? [displayColumn(LABEL_COLUMN_ID, formatText(translate, repeatFor.labelTitle || "Item"), LABEL_KEY)] : []),
      ...base,
      ...(showStatus ? [displayColumn(STATUS_COLUMN_ID, formatText(translate, (rowCompletion && rowCompletion.statusLabel) || "Status"), statusPath)] : []),
    ]
  }

  // ---- "One card per item" presentation (repeatFor.presentation = "cards") ----
  // Same rows array as the grid; only the editing surface differs. Cards use
  // the MOIS scope controls EditableTable's cells use, with the same value
  // shapes (choice code / code[], number via storeAsNumber, date strings,
  // checkbox boolean), and recalculate template + formula columns on every
  // write exactly as EditableTable does (overridden formula cells are left).
  // Calculated cells are shown read-only.

  /** Why cards cannot be used for these columns (the grid is shown instead), or "". */
  const cardsUnsupportedReason = (columns, authorshipActive) => {
    if ((columns || []).some((column) => column && column.type === "stampButton")) return "stamp-column"
    if (authorshipActive) return "row-authorship"
    return ""
  }

  /** The columns a card asks, in order (not the label copy; modal tables: the modal's columns). */
  const cardColumns = (columns, repeatFor, isModalMode) => (columns || []).filter((column) =>
    column && !isInjectedColumn(column) &&
    !(repeatFor && repeatFor.labelTargetColumnId && column.id === repeatFor.labelTargetColumnId) &&
    !(isModalMode && column.showInModal === false)
  )

  // EditableTable's per-row column visibility rule.
  const columnVisible = (column, row) => {
    const rule = column && column.visibility
    if (!rule || typeof rule !== "object" || rule.type === "always" || !rule.controllerId) return true
    const value = getPath(row || {}, rule.controllerId)
    if (rule.type === "filled") return isMeaningful(value)
    if (rule.type === "equals") return String(value === undefined || value === null ? "" : value) === String(rule.value === undefined || rule.value === null ? "" : rule.value)
    if (rule.type === "gt" || rule.type === "lt") {
      const left = Number(value)
      const right = Number(rule.value === undefined || rule.value === null ? 0 : rule.value)
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false
      return rule.type === "gt" ? left > right : left < right
    }
    return true
  }

  const choiceOptions = (options) => (Array.isArray(options) ? options : [])
    .map((option, index) => {
      if (typeof option === "string") {
        const trimmed = option.trim()
        return trimmed ? { key: trimmed, text: trimmed } : null
      }
      if (option && typeof option === "object") {
        const candidate = option.text || option.display || option.label || option.code || option.key || option.value
        const text = typeof candidate === "string" ? candidate.trim() : ""
        if (!text) return null
        return { key: String(option.key || option.code || option.value || option.id || text || "option_" + (index + 1)), text }
      }
      return null
    })
    .filter(Boolean)

  const isMultipleChoice = (column) => column.choiceStyle === "multiselect" || column.choiceStyle === "checkbox"

  const choiceCoding = (value, options) => {
    if (value === undefined || value === null || value === "") return null
    if (typeof value === "object" && !Array.isArray(value)) {
      const code = value.code !== undefined ? value.code : value.value !== undefined ? value.value : value.key
      if (code === undefined || code === null || code === "") return null
      return { code: String(code), display: String(value.display || value.text || value.label || code) }
    }
    const code = String(value)
    const option = options.find((entry) => String(entry.key) === code)
    return { code, display: option ? option.text : code }
  }

  const choiceForControl = (value, column, options) => {
    if (isMultipleChoice(column)) {
      const values = Array.isArray(value) ? value : value ? [value] : []
      return values.map((entry) => choiceCoding(entry, options)).filter(Boolean)
    }
    return choiceCoding(value, options) || undefined
  }

  const choiceForStorage = (coding, codings, column) => (isMultipleChoice(column)
    ? (codings || []).map((entry) => entry && entry.code).filter(Boolean)
    : (coding && coding.code) || "")

  const numberSettings = (column) => {
    const config = column.numberConfig || {}
    const spin = config.spinButtonProps || {}
    const pick = (a, b) => (a !== undefined && a !== null ? a : b)
    return {
      typeNumber: config.typeNumber || column.typeNumber || "number",
      suffix: pick(config.suffix, column.suffix),
      buttonControls: pick(pick(config.buttonControls, column.buttonControls), false),
      storeAsNumber: pick(pick(config.storeAsNumber, column.storeAsNumber), true),
      spinButtonProps: { min: pick(spin.min, column.min), max: pick(spin.max, column.max), step: pick(spin.step, column.step) },
    }
  }

  // SMOIS DateSelect reports a Date, preview a string: store the local day.
  const dateCellValue = (value) => {
    if (value && typeof value.getFullYear === "function") {
      if (Number.isNaN(value.getTime())) return ""
      const pad2 = (part) => (part < 10 ? "0" : "") + part
      return value.getFullYear() + "-" + pad2(value.getMonth() + 1) + "-" + pad2(value.getDate())
    }
    return typeof value === "string" ? value : ""
  }

  const coerceNumber = (value, column) => {
    if (value === "" || value === undefined || value === null) return ""
    if (numberSettings(column).storeAsNumber === false) return value
    const numeric = Number(value)
    return Number.isNaN(numeric) ? "" : numeric
  }

  const templateValue = (row, column) => {
    const config = column && column.computedValue
    if (!config || config.mode !== "template" || typeof config.template !== "string") return ""
    const rendered = config.template.replace(/\{([^{}]+)\}/g, (_match, path) => toText(getPath(row, String(path || "").trim())))
    return config.emptyBehavior !== "blank"
      ? rendered.split(/\r?\n/).map((line) => line.replace(/\s+$/, "")).filter((line) => line.trim().length > 0).join("\n")
      : rendered
  }

  /** A cell as display text (EditableTable's _formatCellValue). */
  const formatCell = (row, column) => {
    if (column.computedValue && column.computedValue.mode === "template") {
      const computed = templateValue(row, column)
      if (isMeaningful(computed)) return computed
    }
    const value = getPath(row, columnPath(column))
    if (column.type === "dropdown" && !column.codeSystem && (typeof value === "string" || Array.isArray(value))) {
      const options = choiceOptions(column.options)
      const wording = (code) => {
        const option = options.find((entry) => String(entry.key) === String(code))
        return option ? option.text : code
      }
      return toText(Array.isArray(value) ? value.map(wording) : wording(value))
    }
    if (column.type === "checkbox") {
      if (value === undefined || value === null || value === "") return ""
      const labels = column.booleanLabels || {}
      return value ? labels.on || "Checked" : labels.off || "Unchecked"
    }
    return toText(value)
  }

  const isFormulaColumn = (column) =>
    !!(column && column.computedValue && column.computedValue.mode === "formula" && typeof column.computedValue.expression === "string")

  const formulaPolicy = (column) => {
    const policy = column.computedValue.calculationPolicy
    return policy === "always-calculated" || policy === "suggested-calculation" ? policy : "calculated-until-overridden"
  }

  const formulaValue = (row, column, columns) => {
    if (typeof FormulaKit === "undefined") return ""
    const config = column.computedValue
    const values = {}
    ;(columns || []).forEach((entry) => {
      const path = columnPath(entry)
      const value = getPath(row, path)
      values[entry.id] = value
      if (path !== entry.id) values[path] = value
    })
    if (config.incompleteBehavior !== "compute-anyway" && !FormulaKit.hasAllReferencedValues(config.expression, values)) return ""
    const precision = Number(config.precision)
    const result = FormulaKit.roundValue(FormulaKit.evaluate(config.expression, values, column.id), Number.isFinite(precision) ? precision : 2)
    if (result === null || result === undefined || result === "") return ""
    if (typeof result === "boolean") return result ? "true" : "false"
    return String(result)
  }

  /** Recalculate template + formula cells of one row in place (EditableTable's _applyComputedColumns). */
  const applyComputed = (row, columns) => {
    ;(columns || []).forEach((column) => {
      if (column && column.computedValue && column.computedValue.mode === "template") setPath(row, columnPath(column), templateValue(row, column))
    })
    ;(columns || []).forEach((column) => {
      if (!isFormulaColumn(column)) return
      const policy = formulaPolicy(column)
      if (policy !== "always-calculated" && row._formulaOverrides && row._formulaOverrides[column.id]) return
      if (policy === "suggested-calculation" && isMeaningful(getPath(row, columnPath(column)))) return
      setPath(row, columnPath(column), formulaValue(row, column, columns))
    })
    return row
  }

  /** The rows with one cell of one row (by _rowId) written and that row recalculated. */
  const writeCell = (rows, rowId, column, value, columns) => (rows || []).map((row) => {
    if (!row || row._rowId !== rowId) return row
    const next = JSON.parse(JSON.stringify(row))
    setPath(next, columnPath(column), value)
    return applyComputed(next, columns)
  })

  /** A blank manual row (EditableTable's empty row: default cell values). */
  const blankRow = (columns, makeRowId) => {
    const row = { _rowId: makeRowId ? makeRowId() : "row_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) }
    ;(columns || []).forEach((column) => {
      if (!column || isInjectedColumn(column) || isComputedColumn(column)) return
      setPath(row, columnPath(column), defaultCellValue(column))
    })
    return applyComputed(row, columns)
  }

  const mirrorValue = (value, column) => {
    if (column && column.type === "checkbox") return Boolean(value)
    if (value === undefined || value === null) return null
    if (typeof value === "string") {
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    return value
  }

  const mirrorRows = (data, rows, columns, sourceFieldIds, sourceFieldIdsByRow) => {
    const flat = sourceFieldIds || {}
    const byRow = sourceFieldIdsByRow || {}
    const ids = new Set()
    Object.values(flat).forEach((fieldId) => { if (fieldId) ids.add(fieldId) })
    Object.values(byRow).forEach((mapping) => Object.values(mapping || {}).forEach((fieldId) => { if (fieldId) ids.add(fieldId) }))
    if (ids.size === 0) return
    ids.forEach((fieldId) => { data[fieldId] = null })
    ;(rows || []).forEach((row, rowIndex) => {
      ;(columns || []).forEach((column) => {
        const fieldId = (byRow[rowIndex] && byRow[rowIndex][column.id]) || flat[column.id]
        if (!fieldId) return
        data[fieldId] = mirrorValue(getPath(row, columnPath(column)), column)
      })
    })
  }

  // ---- Off-page sync (every repeating table, mounted or not) ----
  // A table spec is what the exporter emits per repeating table
  // (buildRepeatTableSyncSpecs in lib/mois-export/renderers/repeat-table-renderer.ts):
  //   { id, rowsPath?, countPath?, repeatFor, rowCompletion?, columns,
  //     sourceFieldIds?, sourceFieldIdsByRow?, readOnly? }
  // FormFlow runs it before Next validation and on the review page, and the
  // generated validateSubmitPayload before submit validation, so a row added
  // to a source table after its follower's page was left still gets its
  // follow-up row (FormFlow.Page renders nothing off-page, so the mounted
  // component cannot). Same syncRows as the mounted component, so the two
  // agree and never fight; answers are kept by the orphan policy as usual.

  const rowIdsByKey = (rows) => {
    const ids = {}
    ;(rows || []).forEach((row) => {
      if (row && row._sourceKey && typeof row._rowId === "string" && !ids[row._sourceKey]) ids[row._sourceKey] = row._rowId
    })
    return ids
  }

  /** Sync one table inside `data` (a plain object or an immer draft). Returns true when it wrote. */
  const syncTableInPlace = (data, spec, rowIdsFrom) => {
    if (!data || typeof data !== "object" || !spec || spec.readOnly) return false
    const repeatFor = spec.repeatFor && spec.repeatFor.sourceFieldId ? spec.repeatFor : null
    if (!repeatFor) return false
    const rowsPath = spec.rowsPath || spec.id
    if (!rowsPath) return false
    const currentRaw = normalizeRows(getPath(data, rowsPath))
    const current = currentRaw ? JSON.parse(JSON.stringify(currentRaw)) : []
    const source = JSON.parse(JSON.stringify(readSourceRows(data, repeatFor)))
    const columns = Array.isArray(spec.columns) ? spec.columns : []
    const next = syncRows(source, current, {
      repeatFor,
      rowCompletion: spec.rowCompletion,
      columns,
      rowIds: rowIdsFrom ? rowIdsByKey(normalizeRows(getPath(rowIdsFrom, rowsPath))) : null,
    })
    // A never-shown table with nothing to seed stays absent (no churn).
    if (!currentRaw && next.length === 0) return false
    if (currentRaw && signature(current) === signature(next)) return false
    setPath(data, rowsPath, next)
    if (spec.countPath) setPath(data, spec.countPath, next.length)
    mirrorRows(data, next, columns, spec.sourceFieldIds, spec.sourceFieldIdsByRow)
    return true
  }

  /**
   * Sync every table spec inside `data`, repeating until nothing changes so a
   * follower of a follower settles (bounded; syncRows is idempotent, so a
   * second pass over unchanged sources writes nothing). Returns the ids of
   * the tables that changed. `rowIdsFrom` (optional) is an already-synced copy
   * of the same answers whose new-row ids should be reused.
   */
  const syncTablesInPlace = (data, tables, rowIdsFrom) => {
    const list = Array.isArray(tables) ? tables.filter(Boolean) : []
    const changed = []
    for (let pass = 0; pass <= list.length; pass += 1) {
      let wrote = false
      list.forEach((spec) => {
        if (syncTableInPlace(data, spec, rowIdsFrom)) {
          wrote = true
          if (!changed.includes(spec.id)) changed.push(spec.id)
        }
      })
      if (!wrote) break
    }
    return changed
  }

  return {
    LABEL_KEY,
    STATUS_KEY,
    STATUS_TEXT_KEY,
    STATUS_TEXT,
    syncTableInPlace,
    syncTablesInPlace,
    getPath,
    setPath,
    normalizeRows,
    isMeaningful,
    signature,
    hasRowMeta,
    rowAnswered,
    rowComplete,
    readSourceRows,
    syncRows,
    buildColumns,
    mirrorRows,
    formatText,
    cardsUnsupportedReason,
    cardColumns,
    columnVisible,
    choiceOptions,
    choiceForControl,
    choiceForStorage,
    numberSettings,
    coerceNumber,
    dateCellValue,
    formatCell,
    isComputedColumn,
    columnPath,
    applyComputed,
    writeCell,
    blankRow,
  }
})()

/**
 * The answers with every repeating table synced, or null when nothing would
 * change. Pure: `values` is never modified (the result is a deep copy).
 */
RepeatForEachTable.syncFormData = (values, tables) => {
  if (!Array.isArray(tables) || tables.length === 0 || !values || typeof values !== "object") return null
  const copy = JSON.parse(JSON.stringify(values))
  return RepeatForEachTable.helpers.syncTablesInPlace(copy, tables).length > 0 ? copy : null
}

/**
 * Write the sync into ActiveData (fd.setFormData, a produce recipe computed
 * from the draft). `synced` (optional, from syncFormData) supplies the ids of
 * new rows so the stored rows match what was just validated or submitted.
 */
RepeatForEachTable.syncActiveData = (fd, tables, synced) => {
  const setter = fd && typeof fd.setFormData === "function" ? fd.setFormData : null
  if (!setter || !Array.isArray(tables) || tables.length === 0) return
  setter(produce((draft) => {
    if (!draft || !draft.field || !draft.field.data || typeof draft.field.data !== "object") return
    RepeatForEachTable.helpers.syncTablesInPlace(draft.field.data, tables, synced || null)
  }))
}

/**
 * Emitted first in validateSubmitPayload: sync the payload's formData (so
 * submit validation and the saved record see current rows) and the live
 * ActiveData. Never blocks the submit by itself.
 */
RepeatForEachTable.syncSubmitPayload = (payload, fd, tables) => {
  if (!payload || !payload.formData) return
  const synced = RepeatForEachTable.syncFormData(payload.formData, tables)
  if (!synced) return
  payload.formData = synced
  RepeatForEachTable.syncActiveData(fd, tables, synced)
}
