// Fluent is a NAMESPACE in the real engine's form scope — bare Fluent
// identifiers are a ReferenceError in production even though preview
// injects them. Destructure everything this component renders.
//
// Each action opens DialogKit's RowDialog (the MOIS SubForm: blocking,
// titled by the action, min(<dialogMinWidth>px, calc(100vw - 48px)) wide)
// showing the action's form fields — drawn by FieldKit with the MOIS
// control the exporter chooses (dropdown: SimpleCodeSelect, combo:
// FindCodeSelect with a typed answer allowed, date: DateSelect, textarea and
// text: TextArea) — or its configured payload.
//
// OK writes nothing. It closes the dialog and discards what was typed,
// exactly like Cancel: whether OK should save the values, and where, is not
// decided yet (Neutral form model, "Decisions needed"). OK_DISCARDS_VALUES
// makes that explicit; change it only together with that decision.
// FieldKit and DialogKit are referenced only inside function bodies.
const { DefaultButton } = Fluent
const { useMemo, useState } = React

const OK_DISCARDS_VALUES = true

function ActionButtonGroup({
  id = "legacyButtonGroup",
  actions = [],
  justifyContent = "space-evenly",
  padding = 10,
  gap = 10,
  buttonMaxWidth = 280,
  dialogTitle = "Action payload",
  dialogMinWidth = 760,
  okText = "Ok",
  cancelText = "Cancel",
}) {
  const [activeAction, setActiveAction] = useState(null)
  const [draftValues, setDraftValues] = useState({})
  const normalizedActions = useMemo(() => {
    if (!Array.isArray(actions)) return []
    return actions
      .map((action, index) => ({
        id: action?.id || `${id}_action_${index}`,
        label: action?.label || action?.text || `Action ${index + 1}`,
        dialogTitle: action?.dialogTitle || action?.modalTitle || dialogTitle,
        payload: action?.payload || action?.mutationPayload || action?.documentUpdate || null,
        fields: Array.isArray(action?.fields) ? action.fields : [],
        maxWidth: action?.maxWidth || buttonMaxWidth,
      }))
      .filter((action) => action.label)
  }, [actions, buttonMaxWidth, dialogTitle, id])

  const openAction = (action) => {
    const initialValues = {}
    action.fields.forEach((field) => {
      initialValues[field.id] = field.value ?? field.defaultValue ?? ""
    })
    setDraftValues(initialValues)
    setActiveAction(action)
  }

  const setValue = (fieldId, value) => {
    setDraftValues((current) => ({ ...current, [fieldId]: value }))
  }

  const closeAction = () => {
    setActiveAction(null)
    setDraftValues({})
  }

  // OK: see OK_DISCARDS_VALUES above.
  const confirmAction = () => {
    if (OK_DISCARDS_VALUES) closeAction()
  }

  const formattedPayload = activeAction?.payload
    ? JSON.stringify(activeAction.payload, null, 2)
    : "No payload configured."

  const renderField = (field) => {
    const commonStyle = {
      breakInside: "avoid",
      margin: "0px 10px",
      ...(field.gridArea ? { gridArea: field.gridArea } : {}),
      ...(field.maxWidth ? { maxWidth: field.maxWidth } : {}),
      ...(field.minWidth ? { minWidth: field.minWidth } : {}),
    }
    const descriptor = FieldKit.fromActionField(field)
    const width = field.width || (field.type === "date" ? 160 : undefined)
    return (
      <div key={field.id} data-action-field={field.id} style={commonStyle}>
        {FieldKit.renderControl(descriptor, {
          value: draftValues[field.id] ?? "",
          onChange: (stored) => setValue(field.id, stored),
          storage: FieldKit.storage.text(descriptor),
          label: field.label,
          labelPosition: "top",
          readOnly: false,
          placeholder: field.placeholder || undefined,
          size: width ? { width, maxWidth: field.maxWidth || width } : { minWidth: field.minWidth || 160, flex: "1 1 0px" },
        })}
      </div>
    )
  }

  const hasFormFields = Array.isArray(activeAction?.fields) && activeAction.fields.length > 0

  return (
    <div data-field-id={id} data-action-button-group>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent,
          gap,
          padding,
          flexWrap: "wrap",
        }}
      >
        {normalizedActions.map((action) => (
          <DefaultButton
            key={action.id}
            text={action.label}
            style={{ maxWidth: action.maxWidth }}
            onClick={() => openAction(action)}
          />
        ))}
      </div>

      <DialogKit.RowDialog
        hidden={!activeAction}
        title={activeAction?.dialogTitle || activeAction?.label || dialogTitle}
        width={dialogMinWidth}
        onSave={confirmAction}
        onCancel={closeAction}
        saveText={okText}
        cancelText={cancelText}
      >
        {hasFormFields ? (
          <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              {activeAction.fields.map(renderField)}
            </div>
          </div>
        ) : (
          <pre
            style={{
              maxHeight: 360,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              background: "#f3f2f1",
              border: "1px solid #edebe9",
              padding: 8,
              fontSize: 12,
            }}
          >
            {formattedPayload}
          </pre>
        )}
      </DialogKit.RowDialog>
    </div>
  )
}
