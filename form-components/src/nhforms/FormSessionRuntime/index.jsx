const { createContext, useCallback, useContext, useEffect, useMemo, useState } = React

const __getSessionContext = () => {
  const root = typeof globalThis !== "undefined"
    ? globalThis
    : (typeof window !== "undefined" ? window : {})
  if (!root.__MOIS_FORM_STATE_CONTEXT__) {
    root.__MOIS_FORM_STATE_CONTEXT__ = createContext(null)
  }
  return root.__MOIS_FORM_STATE_CONTEXT__
}

const FormSessionContext = __getSessionContext()

const __cloneSessionValue = (value, fallback) => {
  const target = value === undefined ? fallback : value
  return JSON.parse(JSON.stringify(target))
}

const cloneFormSessionState = (fd) => ({
  field: {
    data: __cloneSessionValue(fd?.field?.data, {}),
    status: __cloneSessionValue(fd?.field?.status, {}),
    history: __cloneSessionValue(Array.isArray(fd?.field?.history) ? fd.field.history : [], []),
  },
  uiState: {
    ...__cloneSessionValue(fd?.uiState || {}, {}),
    sections: __cloneSessionValue(fd?.uiState?.sections ?? {}, {}),
  },
  tempArea: __cloneSessionValue(fd?.tempArea || {}, {}),
})

const mergeFormSessionState = (draft, sessionState) => {
  if (!draft.field) {
    draft.field = { data: {}, status: {}, history: [] }
  }
  if (!draft.field.data) {
    draft.field.data = {}
  }
  if (!draft.field.status) {
    draft.field.status = {}
  }
  if (!Array.isArray(draft.field.history)) {
    draft.field.history = []
  }

  Object.entries(sessionState?.field?.data || {}).forEach(([fieldId, value]) => {
    draft.field.data[fieldId] = __cloneSessionValue(value, null)
  })

  Object.entries(sessionState?.field?.status || {}).forEach(([fieldId, value]) => {
    draft.field.status[fieldId] = __cloneSessionValue(value, null)
  })

  if (sessionState?.tempArea && typeof sessionState.tempArea === "object") {
    draft.tempArea = {
      ...(draft.tempArea || {}),
      ...__cloneSessionValue(sessionState.tempArea, {}),
    }
  }
}

const normalizeSessionState = (input) => ({
  field: {
    data: __cloneSessionValue(input?.field?.data || {}, {}),
    status: __cloneSessionValue(input?.field?.status || {}, {}),
    history: __cloneSessionValue(Array.isArray(input?.field?.history) ? input.field.history : [], []),
  },
  uiState: {
    ...__cloneSessionValue(input?.uiState || {}, {}),
    sections: __cloneSessionValue(input?.uiState?.sections ?? {}, {}),
  },
  tempArea: __cloneSessionValue(input?.tempArea || {}, {}),
})

const applySessionUpdate = (prevState, updater) => {
  if (typeof updater === "function") {
    try {
      return JSON.parse(JSON.stringify(produce(prevState, updater)))
    } catch (error) {
      return prevState
    }
  }
  if (updater && typeof updater === "object") {
    return JSON.parse(JSON.stringify({ ...prevState, ...updater }))
  }
  return prevState
}

const FormSessionProvider = ({
  children,
  initialFormData,
}) => {
  const [formData, setFormDataState] = useState(() => normalizeSessionState(initialFormData))

  useEffect(() => {
    setFormDataState(normalizeSessionState(initialFormData))
  }, [initialFormData])

  const setFormData = useCallback((updater) => {
    setFormDataState((prev) => applySessionUpdate(prev, updater))
  }, [])

  const contextValue = useMemo(() => ({
    formData,
    setFormData,
  }), [formData, setFormData])

  return (
    <FormSessionContext.Provider value={contextValue}>
      {children}
    </FormSessionContext.Provider>
  )
}

const useFormSessionData = (selector) => {
  const sessionContext = useContext(FormSessionContext)
  const [fallbackData, fallbackSetData] = useActiveData(selector)

  const normalizedSessionData = useMemo(() => {
    if (!sessionContext?.formData) return null

    const formData = sessionContext.formData
    const normalized = {
      ...formData,
      field: formData.field || { data: {}, status: {}, history: [] },
      uiState: {
        sections: {},
        ...(formData.uiState || {}),
        sections: formData.uiState?.sections || {},
      },
      tempArea: formData.tempArea || {},
    }

    return normalized
  }, [sessionContext])

  const sessionSetFormData = useCallback((updater) => {
    if (!sessionContext?.setFormData) return
    sessionContext.setFormData(updater)
  }, [sessionContext])

  const sessionDataWithSetter = useMemo(() => {
    if (!normalizedSessionData) return null
    return {
      ...normalizedSessionData,
      setFormData: sessionSetFormData,
    }
  }, [normalizedSessionData, sessionSetFormData])

  const selectedSessionData = useMemo(() => {
    if (!normalizedSessionData) return null
    return selector ? selector(normalizedSessionData) : sessionDataWithSetter
  }, [normalizedSessionData, selector, sessionDataWithSetter])

  const selectedSessionDataWithSetter = useMemo(() => {
    if (!selectedSessionData || !sessionSetFormData) return selectedSessionData
    if (selectedSessionData && typeof selectedSessionData === "object" && !Array.isArray(selectedSessionData)) {
      return {
        ...selectedSessionData,
        setFormData: sessionSetFormData,
      }
    }
    return selectedSessionData
  }, [selectedSessionData, sessionSetFormData])

  const sessionScopedSetter = useCallback((updates) => {
    if (!selector) {
      sessionSetFormData(updates)
      return
    }
    sessionSetFormData((draft) => {
      const target = selector(draft)
      if (!target || typeof target !== "object") return
      if (typeof updates === "function") {
        const result = updates(target)
        if (result && typeof result === "object") {
          Object.assign(target, result)
        }
        return
      }
      if (updates && typeof updates === "object") {
        Object.assign(target, updates)
      }
    })
  }, [selector, sessionSetFormData])

  if (!sessionContext) {
    return [fallbackData, fallbackSetData]
  }

  return [selectedSessionDataWithSetter, sessionScopedSetter]
}
