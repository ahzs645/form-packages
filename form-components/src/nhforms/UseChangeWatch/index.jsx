const _normalizeWatchOptions = (value) => {
  if (typeof value === "number") {
    return { delayCount: value }
  }
  if (value && typeof value === "object") {
    return value
  }
  return {}
}

const _defaultCompare = (nextValue, savedValue) => nextValue === savedValue

const useChangeWatch = (watchedValue, options = 3) => {
  const normalizedOptions = _normalizeWatchOptions(options)
  const delayCount = normalizedOptions.delayCount ?? 3
  const disabled = normalizedOptions.disabled ?? false
  const compare = normalizedOptions.compare || _defaultCompare
  const onDirtyChange = normalizedOptions.onDirtyChange
  const baselineRef = useRef(watchedValue)
  const renderCountRef = useRef(delayCount)
  const forcedDirtyRef = useRef(false)
  const dirtyRef = useRef(false)
  const [, forceRender] = useState(0)

  useEffect(() => {
    baselineRef.current = watchedValue
    renderCountRef.current = delayCount
    forcedDirtyRef.current = false
    dirtyRef.current = false
    onDirtyChange?.(false)
  }, [delayCount])

  useEffect(() => {
    if (disabled) {
      forcedDirtyRef.current = false
      if (dirtyRef.current) {
        dirtyRef.current = false
        onDirtyChange?.(false)
        forceRender((value) => value + 1)
      }
      return
    }

    if (renderCountRef.current > 0) {
      renderCountRef.current -= 1
      return
    }

    const isDirty = forcedDirtyRef.current || !compare(watchedValue, baselineRef.current)
    if (dirtyRef.current !== isDirty) {
      dirtyRef.current = isDirty
      onDirtyChange?.(isDirty)
      forceRender((value) => value + 1)
    }
  }, [watchedValue, disabled, compare, onDirtyChange])

  const setChanged = useCallback((isChanged = false, resetCount = delayCount) => {
    if (isChanged) {
      forcedDirtyRef.current = true
      if (!dirtyRef.current) {
        dirtyRef.current = true
        onDirtyChange?.(true)
        forceRender((value) => value + 1)
      }
      return
    }

    baselineRef.current = watchedValue
    renderCountRef.current = resetCount
    forcedDirtyRef.current = false
    if (dirtyRef.current) {
      dirtyRef.current = false
      onDirtyChange?.(false)
      forceRender((value) => value + 1)
    }
  }, [delayCount, watchedValue, onDirtyChange])

  return [dirtyRef.current, setChanged]
}
