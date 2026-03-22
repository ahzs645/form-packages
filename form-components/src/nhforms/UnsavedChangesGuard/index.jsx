const { useEffect, useMemo, useRef, useState } = React
const { Stack, Text, DefaultButton, PrimaryButton, Dialog, DialogType } = Fluent

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

const collectComponentPayloads = (fd) => {
  const payloads = fd?.field?.data?.__componentPayloads
  const dcoGroups = payloads?.dcoUpdatesByComponent || {}
  const webformGroups = payloads?.webformUpdatesByComponent || {}
  const DCOUpdates = Object.values(dcoGroups).flatMap((entry) => Array.isArray(entry) ? entry : [])
  const panelUpdates = Object.values(webformGroups).flatMap((entry) => Array.isArray(entry?.panelUpdates) ? entry.panelUpdates : [])
  const narratives = Object.values(webformGroups).flatMap((entry) => Array.isArray(entry?.narratives) ? entry.narratives : [])
  const webformUpdate = panelUpdates.length || narratives.length
    ? {
        ...(panelUpdates.length ? { panelUpdates } : {}),
        ...(narratives.length ? { narratives } : {}),
      }
    : null

  return { DCOUpdates, webformUpdate }
}

const buildDefaultSavePayload = (fd, formDataOverride) => {
  const componentPayload = collectComponentPayloads(fd)
  return {
    formData: formDataOverride ?? fd?.field?.data,
    webformUpdate: componentPayload.webformUpdate,
    documentUpdate: null,
    DCOUpdates: componentPayload.DCOUpdates,
  }
}

const UnsavedChangesGuard = ({
  watchedValue,
  promptTitle = "Save changes?",
  promptBody = "Unsaved changes were detected. Save before closing?",
  actions,
  closeButtonText = "Close",
  showCloseButton = true,
  showDirtyState = true,
  onlyWhenChanged = true,
  interceptClose = true,
  interceptUnload = true,
  getSaveData,
}) => {
  const sd = useSourceData()
  const [fd] = useActiveData()
  const trackedValue = typeof watchedValue === "undefined" ? fd?.field?.data : watchedValue
  const baselineRef = useRef(trackedValue)
  const warmupRef = useRef(3)
  const [isDirty, setIsDirty] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const actionItems = useMemo(() => normalizeGuardActions(actions), [actions])

  useEffect(() => {
    if (warmupRef.current > 0) {
      warmupRef.current -= 1
      baselineRef.current = trackedValue
      return
    }
    setIsDirty(trackedValue !== baselineRef.current)
  }, [trackedValue])

  useEffect(() => {
    if (!interceptUnload) return undefined
    const handler = (event) => {
      if (sd?.webform?.isDraft === "N") return undefined
      if (onlyWhenChanged && !isDirty) return undefined
      event.preventDefault()
      event.returnValue = ""
      return ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [interceptUnload, isDirty, onlyWhenChanged, sd])

  const markSaved = () => {
    baselineRef.current = trackedValue
    warmupRef.current = 1
    setIsDirty(false)
  }

  const handleAction = async (actionId) => {
    if (actionId === "cancel") {
      setIsOpen(false)
      return
    }

    if (actionId === "discard") {
      markSaved()
      setIsOpen(false)
      return
    }

    const persistAction = actionId === "sign" ? "sign" : "save"
    const prepared = typeof prepareAuthorshipPersist === "function"
      ? prepareAuthorshipPersist(sd, fd, persistAction)
      : null
    const payload = typeof getSaveData === "function"
      ? getSaveData()
      : buildDefaultSavePayload(fd, prepared?.formData)

    if (actionId === "sign" && typeof saveSubmit === "function") {
      const success = await saveSubmit(sd, fd, payload)
      if (success !== false && typeof commitPreparedAuthorshipPersist === "function") {
        commitPreparedAuthorshipPersist(fd, prepared)
      }
      markSaved()
      setIsOpen(false)
      return
    }

    if (typeof saveDraft === "function") {
      const success = await saveDraft(sd, fd, payload)
      if (success !== false && typeof commitPreparedAuthorshipPersist === "function") {
        commitPreparedAuthorshipPersist(fd, prepared)
      }
      markSaved()
    }
    setIsOpen(false)
  }

  const primaryAction = actionItems.find((action) => action.primary) ?? actionItems[0]
  const secondaryActions = actionItems.filter((action) => action.id !== primaryAction?.id)

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      {showDirtyState ? (
        <Text variant="small" styles={{ root: { color: isDirty ? "#a4262c" : "#605e5c" } }}>
          {isDirty ? "Unsaved changes detected" : "No unsaved changes"}
        </Text>
      ) : null}
      {showCloseButton && interceptClose ? (
        <DefaultButton
          text={closeButtonText}
          onClick={() => {
            if (!onlyWhenChanged || isDirty) {
              setIsOpen(true)
            }
          }}
        />
      ) : null}
      <Dialog
        hidden={!isOpen}
        onDismiss={() => setIsOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: promptTitle,
          subText: promptBody,
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
