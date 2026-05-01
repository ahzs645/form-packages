const { useMemo, useState } = React

function ActionButtonGroup({
  id = "legacyButtonGroup",
  actions = [],
  justifyContent = "space-evenly",
  padding = 10,
  gap = 10,
  buttonMaxWidth = 280,
  dialogTitle = "Action payload",
  dialogMinWidth = 620,
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

  const formattedPayload = activeAction?.payload
    ? JSON.stringify(activeAction.payload, null, 2)
    : "No payload configured."

  const renderField = (field) => {
    const value = draftValues[field.id] ?? ""
    const commonStyle = {
      breakInside: "avoid",
      margin: "0px 10px",
      ...(field.gridArea ? { gridArea: field.gridArea } : {}),
      ...(field.maxWidth ? { maxWidth: field.maxWidth } : {}),
      ...(field.minWidth ? { minWidth: field.minWidth } : {}),
    }
    const inputStyle = {
      width: field.width || (field.type === "date" ? 160 : 320),
      maxWidth: field.maxWidth || (field.type === "date" ? 160 : 320),
    }

    let control = null
    if (field.type === "dropdown") {
      const options = Array.isArray(field.options)
        ? field.options.map((option) => ({
            key: option.key ?? option.value ?? option,
            text: option.text ?? option.label ?? option.value ?? option,
          }))
        : []
      control = (
        <Dropdown
          selectedKey={value}
          placeholder={field.placeholder || "Please select"}
          options={options}
          styles={{ root: inputStyle }}
          onChange={(_, option) => setValue(field.id, option?.key ?? "")}
        />
      )
    } else if (field.type === "combo") {
      const options = Array.isArray(field.options)
        ? field.options.map((option) => ({
            key: option.key ?? option.value ?? option,
            text: option.text ?? option.label ?? option.value ?? option,
          }))
        : []
      control = (
        <ComboBox
          id={field.id}
          selectedKey={value}
          text={value}
          placeholder={field.placeholder || "Please select an option"}
          options={options}
          styles={{ root: inputStyle }}
          allowFreeform
          autoComplete="on"
          onChange={(_, option, __, inputValue) => setValue(field.id, option?.key ?? inputValue ?? "")}
        />
      )
    } else {
      control = (
        <TextField
          value={value}
          multiline={field.type === "textarea"}
          rows={field.rows || (field.type === "textarea" ? 3 : undefined)}
          placeholder={field.placeholder || (field.type === "date" ? "YYYY.MM.DD" : undefined)}
          styles={{ root: inputStyle }}
          onChange={(_, nextValue) => setValue(field.id, nextValue || "")}
        />
      )
    }

    return (
      <div key={field.id} style={commonStyle}>
        <Label>{field.label}</Label>
        <div style={{ display: "flex", flexFlow: "column", minWidth: field.minWidth || 160, alignItems: "flex-start" }}>
          {control}
        </div>
        <div style={{ clear: "both" }} />
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

      <Dialog
        hidden={!activeAction}
        onDismiss={() => setActiveAction(null)}
        minWidth={dialogMinWidth}
        dialogContentProps={{
          type: DialogType.normal,
          title: activeAction?.dialogTitle || activeAction?.label || dialogTitle,
        }}
        modalProps={{ isBlocking: false }}
      >
        {hasFormFields ? (
          <div data-component="SubForm" style={{ minWidth: 500 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
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
        <DialogFooter>
          <PrimaryButton
            text={okText}
            onClick={() => {
              setActiveAction(null)
              setDraftValues({})
            }}
          />
          <DefaultButton
            text={cancelText}
            onClick={() => {
              setActiveAction(null)
              setDraftValues({})
            }}
          />
        </DialogFooter>
      </Dialog>
    </div>
  )
}
