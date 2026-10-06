// DialogKit — one row dialog and one confirmation, both drawn with the MOIS
// SubForm (blocking Dialog, the label as its title, other props to the
// Dialog), plus the width rule every NHForms dialog uses.
//
//   DialogKit.width(px, fallback?)  -> "min(<px>px, calc(100vw - 48px))"
//                                      (a RowDialog / ConfirmDialog is exactly
//                                      this wide: its min and max width)
//   DialogKit.maxWidth              -> "calc(100vw - 48px)" (viewers that may
//                                      grow with their content)
//   <DialogKit.RowDialog
//      hidden | open, title, width, onSave, onCancel, saveText, cancelText,
//      saveDisabled, extraActions=[{ text, onClick, disabled }], errorMessage,
//      readOnly, lockPolicy, dirty, confirmDiscard, discardTitle, discardText,
//      discardConfirmText, discardCancelText, moisModule>
//     ...questions...
//   </DialogKit.RowDialog>
//   <DialogKit.ConfirmDialog
//      hidden | open, title, message, confirmText, cancelText, onConfirm,
//      onCancel, confirmDisabled, busy, errorMessage, width,
//      extraActions=[{ text, onClick, disabled }], showCancel>
//     ...optional extra body (a reason field)...
//   </DialogKit.ConfirmDialog>
//
// Because the SubForm is blocking, a click outside never dismisses it. The
// close button and Escape call onCancel; a RowDialog with confirmDiscard asks
// before discarding a dirty draft. A read-only RowDialog disables its body and
// its save actions and holds no lock. The body renders in a fresh section
// (`section={{}}`: linear layout, no field placement), so the questions show
// even when the table sits in a placed Grid.
//
// Viewers (FlowSheet, HealthMaintenanceReview, HotspotMapField) keep their
// non-blocking dialogs and use DialogKit.width only. Consumers reference
// DialogKit only inside function bodies (component files load in no
// guaranteed order).

const DialogKit = (() => {
  const VIEWPORT_GUTTER_PX = 48
  const maxWidth = `calc(100vw - ${VIEWPORT_GUTTER_PX}px)`

  const width = (px, fallback = 640) => {
    const requested = Number(px)
    const value = Number.isFinite(requested) && requested > 0 ? requested : fallback
    return `min(${Math.round(value)}px, calc(100vw - ${VIEWPORT_GUTTER_PX}px))`
  }

  const errorStyle = { marginTop: 12, fontSize: 13, color: "#a4262c" }

  const ConfirmDialog = ({
    hidden = false,
    open,
    title,
    message,
    children,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    confirmDisabled = false,
    busy = false,
    errorMessage,
    width: widthPx = 440,
    extraActions = [],
    showCancel = true,
  }) => {
    const isHidden = open === undefined ? hidden : !open
    const cancel = () => {
      if (busy) return
      if (typeof onCancel === "function") onCancel()
    }
    const actions = Array.isArray(extraActions) ? extraActions.filter(Boolean) : []
    return (
      <SubForm
        hidden={isHidden}
        label={title}
        minWidth={width(widthPx, 440)}
        maxWidth={width(widthPx, 440)}
        onCancel={cancel}
        section={{}}
      >
        <div data-dialog-kit="confirm">
          {message ? (
            <Fluent.Text block styles={{ root: { marginBottom: 8, whiteSpace: "pre-wrap" } }}>{message}</Fluent.Text>
          ) : null}
          {children}
          {errorMessage ? (
            <div role="alert" data-dialog-kit-error="" style={errorStyle}>{errorMessage}</div>
          ) : null}
          <ButtonBar horizontalAlign="end" paddingBottom={0}>
            <Fluent.PrimaryButton
              text={confirmText}
              disabled={confirmDisabled || busy}
              onClick={() => {
                if (confirmDisabled || busy) return
                if (typeof onConfirm === "function") onConfirm()
              }}
            />
            {actions.map((action, index) => (
              <Fluent.DefaultButton
                key={action.key || action.text || index}
                text={action.text}
                disabled={busy || action.disabled === true}
                onClick={() => {
                  if (busy || action.disabled === true) return
                  if (typeof action.onClick === "function") action.onClick()
                }}
              />
            ))}
            {showCancel ? <Fluent.DefaultButton text={cancelText} disabled={busy} onClick={cancel} /> : null}
          </ButtonBar>
        </div>
      </SubForm>
    )
  }

  const RowDialog = ({
    hidden = false,
    open,
    title,
    width: widthPx = 640,
    children,
    onSave,
    onCancel,
    saveText = "Save",
    cancelText = "Cancel",
    saveDisabled = false,
    extraActions = [],
    errorMessage,
    readOnly = false,
    lockPolicy = null,
    dirty = false,
    confirmDiscard = false,
    discardTitle = "Discard changes?",
    discardText = "The changes in this dialog have not been saved.",
    discardConfirmText = "Discard",
    discardCancelText = "Keep editing",
    moisModule,
  }) => {
    const [confirmingDiscard, setConfirmingDiscard] = React.useState(false)
    const isHidden = open === undefined ? hidden : !open

    React.useEffect(() => {
      if (isHidden) setConfirmingDiscard(false)
    }, [isHidden])

    const requestCancel = () => {
      if (confirmDiscard && dirty && !readOnly) {
        setConfirmingDiscard(true)
        return
      }
      if (typeof onCancel === "function") onCancel()
    }

    const actions = Array.isArray(extraActions) ? extraActions.filter(Boolean) : []

    return (
      <>
        <SubForm
          hidden={isHidden}
          label={title}
          moisModule={moisModule}
          minWidth={width(widthPx, 640)}
          maxWidth={width(widthPx, 640)}
          lockPolicy={readOnly ? null : lockPolicy}
          onCancel={requestCancel}
          section={{}}
        >
          <div data-dialog-kit="row">
            {/* A disabled fieldset keeps every native control inside inert
                while read-only; the footer stays outside it. */}
            <fieldset
              disabled={readOnly}
              data-dialog-kit-readonly={readOnly ? "true" : undefined}
              style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
            >
              {children}
            </fieldset>
            {errorMessage ? (
              <div role="alert" data-dialog-kit-error="" style={errorStyle}>{errorMessage}</div>
            ) : null}
            {/* The real Fluent wrapping Stack uses negative half-gap margins.
                Contain those margins inside the dialog at narrow widths. */}
            <div style={{ paddingLeft: 8, paddingRight: 8 }}>
            <ButtonBar horizontalAlign="end" paddingBottom={0}>
              <Fluent.PrimaryButton
                text={saveText}
                disabled={readOnly || saveDisabled}
                onClick={() => {
                  if (readOnly || saveDisabled) return
                  if (typeof onSave === "function") onSave()
                }}
              />
              {actions.map((action, index) => (
                <Fluent.DefaultButton
                  key={action.key || action.text || index}
                  text={action.text}
                  disabled={readOnly || action.disabled === true}
                  onClick={() => {
                    if (readOnly || action.disabled === true) return
                    if (typeof action.onClick === "function") action.onClick()
                  }}
                />
              ))}
              <Fluent.DefaultButton text={cancelText} onClick={requestCancel} />
            </ButtonBar>
            </div>
          </div>
        </SubForm>
        <ConfirmDialog
          hidden={isHidden || !confirmingDiscard}
          title={discardTitle}
          message={discardText}
          confirmText={discardConfirmText}
          cancelText={discardCancelText}
          onConfirm={() => {
            setConfirmingDiscard(false)
            if (typeof onCancel === "function") onCancel()
          }}
          onCancel={() => setConfirmingDiscard(false)}
        />
      </>
    )
  }

  return {
    width,
    maxWidth,
    RowDialog,
    ConfirmDialog,
  }
})()
