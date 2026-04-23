/**
 * SaveOnClose
 *
 * Change-aware draft save on browser close/unload.
 * By default it only saves when the watched form data changed after initial load.
 */

const { useEffect, useRef, useState } = React

const _normalizeSaveOnCloseOptions = (value) => {
  if (typeof value === "boolean") {
    return { disabled: value }
  }
  if (value && typeof value === "object") {
    return value
  }
  return {}
}

const _collectComponentPayloads = (fd) => {
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

const _buildDefaultSavePayload = (fd, formDataOverride) => {
  const componentPayload = _collectComponentPayloads(fd)
  return {
    formData: formDataOverride ?? fd?.field?.data,
    webformUpdate: componentPayload.webformUpdate,
    panels: componentPayload.panels,
    linkedPanels: componentPayload.linkedPanels,
    narratives: componentPayload.narratives,
    DCOUpdates: componentPayload.DCOUpdates,
  }
}

const _useChangeAwareDirtyState = ({
  watchedValue,
  disabled = false,
  delayCount = 3,
  onDirtyChange,
}) => {
  const baselineRef = useRef(watchedValue)
  const renderCountRef = useRef(delayCount)
  const dirtyRef = useRef(false)
  const [, forceRender] = useState(0)

  useEffect(() => {
    baselineRef.current = watchedValue
    renderCountRef.current = delayCount
    dirtyRef.current = false
    onDirtyChange?.(false)
  }, [delayCount])

  useEffect(() => {
    if (disabled) {
      dirtyRef.current = false
      onDirtyChange?.(false)
      return
    }

    if (renderCountRef.current > 0) {
      renderCountRef.current -= 1
      return
    }

    const isDirty = watchedValue !== baselineRef.current
    if (dirtyRef.current !== isDirty) {
      dirtyRef.current = isDirty
      onDirtyChange?.(isDirty)
      forceRender((value) => value + 1)
    }
  }, [watchedValue, disabled, onDirtyChange])

  const markSaved = (nextValue = watchedValue, nextDelayCount = delayCount) => {
    baselineRef.current = nextValue
    renderCountRef.current = nextDelayCount
    if (dirtyRef.current) {
      dirtyRef.current = false
      onDirtyChange?.(false)
      forceRender((value) => value + 1)
    }
  }

  return [dirtyRef.current, markSaved]
}

/**
 * SaveOnClose - Renders nothing but sets up change-aware auto-save on close.
 *
 * Props:
 * - getSaveData?: () => any
 * - disabled?: boolean
 * - watchedValue?: any
 * - onlyWhenChanged?: boolean
 * - delayCount?: number
 * - onDirtyChange?: (isDirty: boolean) => void
 */
const SaveOnClose = ({
  getSaveData,
  disabled = false,
  watchedValue,
  onlyWhenChanged = true,
  delayCount = 3,
  onDirtyChange,
}) => {
  const sd = useSourceData()
  const [fd] = useActiveData()
  const trackedValue = typeof watchedValue === "undefined" ? fd?.field?.data : watchedValue
  const [hasChanged] = _useChangeAwareDirtyState({
    watchedValue: trackedValue,
    disabled,
    delayCount,
    onDirtyChange,
  })

  useEffect(() => {
    if (disabled) return

    window.onbeforeunload = () => {
      if (sd?.webform?.isDraft === "N") return
      if (onlyWhenChanged && !hasChanged) return

      const prepared = typeof prepareAuthorshipPersist === "function"
        ? prepareAuthorshipPersist(sd, fd, "save")
        : null
      const saveData = getSaveData
        ? getSaveData()
        : _buildDefaultSavePayload(fd, prepared?.formData)

      saveDraft(sd, fd, saveData)
    }

    return () => {
      window.onbeforeunload = null
    }
  }, [sd, fd, getSaveData, disabled, onlyWhenChanged, hasChanged])

  return null
}

/**
 * useSaveOnClose - Hook version for more control.
 *
 * Legacy signature supported:
 * useSaveOnClose(getSaveData, disabledBoolean)
 *
 * Preferred signature:
 * useSaveOnClose(getSaveData, { disabled, watchedValue, onlyWhenChanged, delayCount, onDirtyChange })
 */
const useSaveOnClose = (getSaveData, options = {}) => {
  const normalizedOptions = _normalizeSaveOnCloseOptions(options)
  const sd = useSourceData()
  const [fd] = useActiveData()
  const trackedValue =
    typeof normalizedOptions.watchedValue === "undefined"
      ? fd?.field?.data
      : normalizedOptions.watchedValue
  const [hasChanged, markSaved] = _useChangeAwareDirtyState({
    watchedValue: trackedValue,
    disabled: normalizedOptions.disabled ?? false,
    delayCount: normalizedOptions.delayCount ?? 3,
    onDirtyChange: normalizedOptions.onDirtyChange,
  })

  useEffect(() => {
    if (normalizedOptions.disabled) return

    window.onbeforeunload = () => {
      if (sd?.webform?.isDraft === "N") return
      if ((normalizedOptions.onlyWhenChanged ?? true) && !hasChanged) return

      const prepared = typeof prepareAuthorshipPersist === "function"
        ? prepareAuthorshipPersist(sd, fd, "save")
        : null
      const saveData = getSaveData
        ? getSaveData()
        : _buildDefaultSavePayload(fd, prepared?.formData)

      saveDraft(sd, fd, saveData)
    }

    return () => {
      window.onbeforeunload = null
    }
  }, [sd, fd, getSaveData, normalizedOptions.disabled, normalizedOptions.onlyWhenChanged, hasChanged])

  return {
    hasChanged,
    markSaved,
  }
}
