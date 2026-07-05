const { useEffect, useMemo, useRef, useState } = React
const { Stack, Text, DefaultButton, PrimaryButton, Dialog, DialogType } = Fluent

// Real MOIS registers unsaved-changes state with the host via
// MoisHooks.useConfirmUnload(enabled): in Electron the host intercepts window
// close and shows a native Leave/Cancel prompt; a beforeunload handler that
// calls preventDefault would block the close silently with no dialog instead.
// The beforeunload fallback below is only for hosts without useConfirmUnload
// (builder preview, plain browser), where preventDefault does show a prompt.
// Selected once at module scope so the hook identity is stable across renders.
const useHostConfirmUnload =
  typeof MoisHooks !== "undefined" && MoisHooks && typeof MoisHooks.useConfirmUnload === "function"
    ? MoisHooks.useConfirmUnload
    : (enabled) => {
        useEffect(() => {
          if (!enabled || typeof window === "undefined") return undefined
          const handler = (event) => {
            event.preventDefault()
            event.returnValue = ""
            return ""
          }
          window.addEventListener("beforeunload", handler)
          return () => window.removeEventListener("beforeunload", handler)
        }, [enabled])
      }

const normalizeGuardActions = (actions) => {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [
      { id: "save", label: "Save", primary: true },
      { id: "discard", label: "Discard" },
      { id: "cancel", label: "Cancel" },
    ]
  }
  return actions
    .filter((action) => action && typeof action === "object" && typeof action.id === "string")
    .map((action) => ({
      id: action.id,
      label: typeof action.label === "string" && action.label.trim() ? action.label.trim() : action.id,
      primary: action.primary === true,
    }))
}

const normalizeFooterActions = (actions, dialogLibraryId, showPrintButton) => {
  if (Array.isArray(actions) && actions.length > 0) {
    return actions
      .filter((action) => action && typeof action === "object" && typeof action.id === "string")
      .map((action) => ({
        id: action.id,
        label: typeof action.label === "string" && action.label.trim() ? action.label.trim() : action.id,
        primary: action.primary === true,
        disabledWhenSigned: action.disabledWhenSigned === true || action.id === "submit",
        hiddenWhenSigned: action.hiddenWhenSigned === true,
      }))
  }

  const footerActions = []
  if (showPrintButton) footerActions.push({ id: "print", label: "Print" })

  if (dialogLibraryId === "save_discard_cancel") {
    footerActions.push({ id: "sign", label: "Sign & Save", primary: true })
    footerActions.push({ id: "close", label: "Close" })
    return footerActions
  }

  footerActions.push({ id: "save", label: "Save Draft", disabledWhenSigned: true })
  footerActions.push({ id: "sign", label: "Sign & Save", primary: true })
  footerActions.push({ id: "close", label: "Close" })
  return footerActions
}

const collectComponentPayloads = (fd) => {
  const payloads = fd?.field?.data?.__componentPayloads
  const dcoGroups = payloads?.dcoUpdatesByComponent || {}
  const webformGroups = payloads?.webformUpdatesByComponent || {}
  const DCOUpdates = Object.values(dcoGroups).flatMap((entry) => Array.isArray(entry) ? entry : [])
  const panelUpdates = Object.values(webformGroups).flatMap((entry) => Array.isArray(entry?.panelUpdates) ? entry.panelUpdates : [])
  const narratives = Object.values(webformGroups).flatMap((entry) => Array.isArray(entry?.narratives) ? entry.narratives : [])
  const panels = panelUpdates.length ? panelUpdates : undefined
  const linkedPanels = panelUpdates.length ? panelUpdates : undefined
  const webformUpdate = narratives.length ? { narratives } : null

  return { DCOUpdates, webformUpdate, panels, linkedPanels, narratives: narratives.length ? narratives : undefined }
}

// __componentPayloads is runtime staging; never serialize it into formdata.
const stripComponentPayloads = (data) => {
  if (!data || typeof data !== "object") return data || {}
  const { __componentPayloads, ...rest } = data
  return rest
}

const normalizeGuardValue = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== "object") return value
  if (seen.has(value)) return "[Circular]"
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => normalizeGuardValue(item, seen))
  }

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (key === "__componentPayloads") return result
      const nextValue = normalizeGuardValue(value[key], seen)
      if (typeof nextValue !== "undefined") result[key] = nextValue
      return result
    }, {})
}

const serializeGuardValue = (value) => {
  try {
    return JSON.stringify(normalizeGuardValue(value))
  } catch {
    return String(value)
  }
}

const buildDefaultSavePayload = (fd, formDataOverride) => {
  const componentPayload = collectComponentPayloads(fd)
  return {
    formData: stripComponentPayloads(formDataOverride ?? fd?.field?.data),
    webformUpdate: componentPayload.webformUpdate,
    panels: componentPayload.panels,
    linkedPanels: componentPayload.linkedPanels,
    narratives: componentPayload.narratives,
    documentUpdate: null,
    DCOUpdates: componentPayload.DCOUpdates,
  }
}

const collectDomFieldValues = () => {
  if (typeof document === "undefined") return null
  const values = {}
  document.querySelectorAll("[data-field-id] input, [data-field-id] textarea").forEach((element) => {
    const host = element.closest("[data-field-id]")
    const fieldId = host?.getAttribute("data-field-id")
    if (!fieldId || element.disabled || element.readOnly) return
    const tagName = element.tagName
    const inputType = tagName === "INPUT" ? (element.getAttribute("type") || "text").toLowerCase() : ""
    if (tagName === "INPUT" && !["", "text", "date", "search", "email", "number", "tel", "url"].includes(inputType)) {
      return
    }
    values[fieldId] = element.value
  })
  return Object.keys(values).length > 0 ? values : null
}

const mergeFieldValuesIntoState = (fd, values) => {
  if (!values || !fd || typeof fd !== "object") return fd
  const field = fd.field && typeof fd.field === "object" ? fd.field : {}
  const fieldData = field.data && typeof field.data === "object" ? field.data : {}
  const formData = fd.formData && typeof fd.formData === "object" ? fd.formData : {}
  return {
    ...fd,
    field: {
      ...field,
      data: {
        ...fieldData,
        ...values,
      },
    },
    formData: {
      ...formData,
      ...values,
    },
  }
}

const UnsavedChangesGuard = ({
  watchedValue,
  dialogLibraryId = "save_sign_discard_cancel",
  promptTitle = "Save changes?",
  promptBody = "Unsaved changes were detected. Save before closing?",
  promptMessage,
  actions,
  footerActions,
  showFooterActions = true,
  footerBackground = "rgba(112, 170, 228, 0.4)",
  footerJustifyContent = "flex-start",
  closeButtonText = "Close",
  showCloseButton = true,
  showDirtyState = false,
  showPrintButton = false,
  onlyWhenChanged = true,
  interceptClose = true,
  interceptUnload = true,
  autoSaveOnUnload = false,
  closeAfterAction = false,
  skipWhenSigned = true,
  getSaveData,
  getSubmitData,
}) => {
  const sd = useSourceData()
  const [fd, setFormData] = useActiveData()
  // Lock-on-save authorship: at save/sign time, promote the current author's
  // pending claims to locked/signed via the shared __nhAuth engine (runs in real
  // MOIS). Replaces the preview-only prepareAuthorshipPersist path.
  const nhAuthPrepareSave = (state, action) =>
    (typeof window !== "undefined" && window.__nhAuth) ? window.__nhAuth.prepareSave(state, sd, action) : null
  const nhAuthCommitSave = (prepared) => {
    if (prepared && prepared.changed && typeof setFormData === "function") setFormData(prepared.nextState)
  }
  const trackedValue = typeof watchedValue === "undefined" ? fd?.field?.data : watchedValue
  const trackedSnapshot = serializeGuardValue(trackedValue)
  const baselineRef = useRef(trackedSnapshot)
  const warmupRef = useRef(3)
  const saveSettleRef = useRef(0)
  const [isDirty, setIsDirty] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const actionItems = useMemo(() => normalizeGuardActions(actions), [actions])
  const footerActionItems = useMemo(
    () => normalizeFooterActions(footerActions, dialogLibraryId, showPrintButton),
    [dialogLibraryId, footerActions, showPrintButton]
  )

  // Real MOIS exposes load/save lifecycle on sd.lifecycleState (formReady,
  // isQuerying, isLoading). While any of those say the host is still seeding
  // or persisting data, re-capture the baseline instead of marking dirty —
  // this absorbs useOnLoad/useOnRefresh writes and also re-arms the baseline
  // after a save through the standard SaveButton (save-form sets isLoading).
  // Hosts without those signals (builder preview mock) fall back to the
  // legacy warmup counter.
  const lifecycle = sd?.lifecycleState
  const hasLifecycleSignals =
    typeof lifecycle?.formReady === "boolean" || typeof lifecycle?.isQuerying === "boolean"
  const isSettling = hasLifecycleSignals
    ? lifecycle.isQuerying === true || lifecycle.isLoading === true || lifecycle.formReady === false
    : warmupRef.current > 0

  useEffect(() => {
    if (isSettling || saveSettleRef.current > 0) {
      if (!hasLifecycleSignals && warmupRef.current > 0) {
        warmupRef.current -= 1
      }
      if (saveSettleRef.current > 0) {
        saveSettleRef.current -= 1
      }
      baselineRef.current = trackedSnapshot
      setIsDirty(false)
      return
    }
    setIsDirty(trackedSnapshot !== baselineRef.current)
  }, [trackedSnapshot, isSettling, hasLifecycleSignals])

  const guardSkipsWhenSigned = skipWhenSigned && sd?.webform?.isDraft === "N"
  const confirmUnloadActive = Boolean(
    interceptUnload && !autoSaveOnUnload && !guardSkipsWhenSigned && (!onlyWhenChanged || isDirty)
  )
  useHostConfirmUnload(confirmUnloadActive)

  useEffect(() => {
    if (!interceptUnload || !autoSaveOnUnload) return undefined
    const handler = () => {
      if (skipWhenSigned && sd?.webform?.isDraft === "N") return
      if (onlyWhenChanged && !isDirty) return
      if (typeof saveDraft !== "function") return
      const prepared = nhAuthPrepareSave(fd, "save")
      const payload = typeof getSaveData === "function"
        ? getSaveData(prepared)
        : buildDefaultSavePayload(fd, prepared?.formData)
      // Best-effort only (legacy SaveOnClose semantics): the async save may
      // not complete if the host tears the window down immediately. Never
      // blocks the close.
      saveDraft(sd, fd, payload)
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [autoSaveOnUnload, fd, getSaveData, interceptUnload, isDirty, onlyWhenChanged, sd, skipWhenSigned])

  const markSaved = (nextValue) => {
    baselineRef.current = serializeGuardValue(typeof nextValue === "undefined" ? trackedValue : nextValue)
    saveSettleRef.current = 2
    warmupRef.current = 1
    setIsDirty(false)
  }

  const handleAction = async (actionId) => {
    const closeWindow = () => {
      if (!closeAfterAction || typeof window === "undefined") return
      if (Array.isArray(window.__moisPreviewDiagnostics)) return
      window.close()
    }

    if (actionId === "cancel") {
      setIsOpen(false)
      return
    }

    if (actionId === "close") {
      if (!interceptClose || (!onlyWhenChanged || !isDirty)) {
        if (typeof window !== "undefined") {
          if (Array.isArray(window.__moisPreviewDiagnostics)) {
            MoisFunction?.close?.()
          } else {
            window.close()
          }
        }
        return
      }
      setIsOpen(true)
      return
    }

    if (actionId === "discard") {
      markSaved()
      setIsOpen(false)
      closeWindow()
      return
    }

    if (actionId === "print") {
      // Real MOIS printing goes through the lifecycle pipeline so components
      // that key on lifecycleState.isPrinting (and print-to-PDF) behave; the
      // host watches isPrinting and runs window.print + afterprint itself.
      if (typeof sd?.lifecycleDispatch === "function") {
        sd.lifecycleDispatch({ type: "print-started", printOptions: {} })
      } else if (typeof window !== "undefined") {
        window.print()
      }
      setIsOpen(false)
      return
    }

    const domFieldValues = collectDomFieldValues()
    const persistFd = mergeFieldValuesIntoState(fd, domFieldValues)
    if (domFieldValues && typeof setFormData === "function") {
      setFormData((draft) => {
        draft.field = draft.field || {}
        draft.field.data = draft.field.data || {}
        draft.formData = draft.formData || {}
        Object.assign(draft.field.data, domFieldValues)
        Object.assign(draft.formData, domFieldValues)
      })
    }

    const persistAction = actionId === "sign" ? "sign" : actionId === "submit" ? "submit" : "save"
    const prepared = nhAuthPrepareSave(persistFd, persistAction)
    // Sign/submit should persist the full submit payload (mapped
    // observation updates, document comment) when the form provides it.
    const isSubmitAction = actionId === "sign" || actionId === "submit"
    const payload = isSubmitAction && typeof getSubmitData === "function"
      ? getSubmitData(prepared)
      : typeof getSaveData === "function"
        ? getSaveData(prepared)
        : buildDefaultSavePayload(persistFd, prepared?.formData)

    if (actionId === "sign" && typeof signSubmit === "function") {
      // Real MOIS signSubmit is (note, sd, fd, options)
      const success = await signSubmit("", sd, persistFd, payload)
      if (success !== false) nhAuthCommitSave(prepared)
      markSaved(prepared?.nextState?.field?.data ?? prepared?.formData ?? payload?.formData)
      setIsOpen(false)
      if (success !== false) closeWindow()
      return
    }

    if (isSubmitAction && typeof saveSubmit === "function") {
      // Real MOIS saveSubmit is (sd, fd, options); it has no note argument.
      const success = await saveSubmit(sd, persistFd, payload)
      if (success !== false) nhAuthCommitSave(prepared)
      markSaved(prepared?.nextState?.field?.data ?? prepared?.formData ?? payload?.formData)
      setIsOpen(false)
      if (success !== false) closeWindow()
      return
    }

    if (actionId === "submit") {
      setIsOpen(false)
      return
    }

    if (typeof saveDraft === "function") {
      const success = await saveDraft(sd, persistFd, payload)
      if (success !== false) nhAuthCommitSave(prepared)
      markSaved(prepared?.nextState?.field?.data ?? prepared?.formData ?? payload?.formData)
    }
    setIsOpen(false)
    closeWindow()
  }

  const primaryAction = actionItems.find((action) => action.primary) ?? actionItems[0]
  const secondaryActions = actionItems.filter((action) => action.id !== primaryAction?.id)
  const promptText = promptMessage || promptBody
  const isSigned = sd?.webform?.recordState === "SIGNED" || sd?.webform?.isDraft === "N"

  const renderFooterAction = (action) => {
    if (action.hiddenWhenSigned && isSigned) return null
    const ButtonComponent = action.primary ? PrimaryButton : DefaultButton
    const disabled = action.disabled === true || (action.disabledWhenSigned && isSigned) || sd?.lifecycleState?.isMutating === true
    return (
      <ButtonComponent
        key={action.id}
        text={action.label}
        disabled={disabled}
        onClick={() => handleAction(action.id)}
      />
    )
  }

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      {showDirtyState ? (
        <Text variant="small" styles={{ root: { color: isDirty ? "#a4262c" : "#605e5c" } }}>
          {isDirty ? "Unsaved changes detected" : "No unsaved changes"}
        </Text>
      ) : null}
      {showCloseButton && interceptClose && !showFooterActions ? (
        <DefaultButton
          text={closeButtonText}
          onClick={() => {
            if (!onlyWhenChanged || isDirty) {
              setIsOpen(true)
            }
          }}
        />
      ) : null}
      {showPrintButton && !showFooterActions ? (
        <DefaultButton text="Print" onClick={() => handleAction("print")} />
      ) : null}
      {showFooterActions ? (
        <div className="hideonprint">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: footerJustifyContent,
              gap: 8,
              flexWrap: "wrap",
              background: footerBackground,
              padding: "8px 10px",
            }}
          >
            {footerActionItems.map(renderFooterAction)}
            <SaveStatus noHide />
          </div>
        </div>
      ) : null}
      <Dialog
        hidden={!isOpen}
        onDismiss={() => setIsOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: promptTitle,
          subText: promptText,
        }}
      >
        <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
          {primaryAction ? (
            <PrimaryButton text={primaryAction.label} onClick={() => handleAction(primaryAction.id)} />
          ) : null}
          {secondaryActions.map((action) => (
            <DefaultButton key={action.id} text={action.label} onClick={() => handleAction(action.id)} />
          ))}
        </Stack>
      </Dialog>
    </Stack>
  )
}
