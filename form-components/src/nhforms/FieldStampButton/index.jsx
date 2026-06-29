const { useMemo } = React
const { DefaultButton, PrimaryButton, Stack, Text } = Fluent

const normalizeStampTargets = (targets) => {
  if (!Array.isArray(targets)) return []
  return targets
    .map((target) => {
      if (!target || typeof target !== "object") return null
      const fieldId = String(target.fieldId || target.targetFieldId || "").trim()
      const sourcePath = String(target.sourcePath || "").trim()
      const value = target.value
      const fallback = target.fallback
      if (!fieldId || (!sourcePath && value === undefined)) return null
      return { fieldId, sourcePath, value, fallback }
    })
    .filter(Boolean)
}

const resolvePathValue = (root, path) => {
  if (!root || !path) return undefined
  return String(path)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((current, part) => {
      if (current == null) return undefined
      if (Array.isArray(current) && /^\d+$/.test(part)) return current[Number(part)]
      return typeof current === "object" ? current[part] : undefined
    }, root)
}

const resolveLiteralValue = (value, context) => {
  if (value === "$now") return new Date().toISOString()
  if (value === "$today") return new Date().toISOString().slice(0, 10)
  if (value === "$userInitials") return resolvePathValue(context, "userProfile.identity.initials")
  if (value === "$userFullName") return resolvePathValue(context, "userProfile.identity.fullName")
  if (value === "$userLoginName") return resolvePathValue(context, "userProfile.loginName")
  return value
}

const normalizeStampValue = (value) => {
  if (value == null) return ""
  if (typeof value === "object") {
    return String(value.display ?? value.text ?? value.name ?? value.value ?? value.code ?? "")
  }
  return String(value)
}

function FieldStampButton({
  id = "fieldStampButton",
  stampFieldId,
  label = "Sign",
  signedLabel = "Signed",
  clearLabel = "Clear",
  buttonType = "primary",
  targets = [],
  allowResign = true,
  showClear = false,
  showStatus = true,
  readOnly = false,
  disabled = false,
  statusTemplate = "{signedLabel} {signedAt}",
}) {
  const sd = useSourceData()
  const [fd, setFd] = useActiveData()
  const effectiveStampFieldId = stampFieldId || id
  const fieldData = fd?.field?.data || {}
  const stampRecord = fieldData?.[effectiveStampFieldId]
  const isSigned = !!(stampRecord && typeof stampRecord === "object" && stampRecord.signed)
  const normalizedTargets = useMemo(() => normalizeStampTargets(targets), [targets])
  const isDisabled = readOnly || disabled || (isSigned && !allowResign)

  const buildContext = (draftData) => ({
    sd,
    sourceData: sd,
    userProfile: sd?.userProfile,
    webform: sd?.webform,
    patient: sd?.patient,
    formParams: sd?.formParams,
    fd,
    field: draftData || fieldData,
    formData: fd?.formData || {},
  })

  const stamp = () => {
    if (isDisabled) return
    const signedAt = new Date().toISOString()
    setFd((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      if (!draft.formData || typeof draft.formData !== "object") draft.formData = {}

      const context = buildContext(draft.field.data)
      const written = {}
      normalizedTargets.forEach((target) => {
        const raw =
          target.sourcePath
            ? resolvePathValue(context, target.sourcePath)
            : resolveLiteralValue(target.value, context)
        const fallback = resolveLiteralValue(target.fallback, context)
        const value = normalizeStampValue(raw ?? fallback)
        draft.field.data[target.fieldId] = value
        draft.formData[target.fieldId] = value
        written[target.fieldId] = value
      })

      draft.field.data[effectiveStampFieldId] = {
        signed: true,
        signedAt,
        written,
      }
      draft.formData[effectiveStampFieldId] = draft.field.data[effectiveStampFieldId]
    })
  }

  const clearStamp = () => {
    if (readOnly || disabled) return
    setFd((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      if (!draft.formData || typeof draft.formData !== "object") draft.formData = {}
      normalizedTargets.forEach((target) => {
        delete draft.field.data[target.fieldId]
        delete draft.formData[target.fieldId]
      })
      delete draft.field.data[effectiveStampFieldId]
      delete draft.formData[effectiveStampFieldId]
    })
  }

  const ButtonComponent = buttonType === "default" ? DefaultButton : PrimaryButton
  const signedAtText = stampRecord?.signedAt ? String(stampRecord.signedAt).replace("T", " ").slice(0, 16) : ""
  const statusText = String(statusTemplate || "")
    .replace(/\{label\}/g, label)
    .replace(/\{signedLabel\}/g, signedLabel)
    .replace(/\{signedAt\}/g, signedAtText)
    .trim()

  return (
    <div data-field-id={effectiveStampFieldId} data-component="FieldStampButton" style={{ margin: "8px 10px" }}>
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }} wrap>
        <ButtonComponent
          text={isSigned ? signedLabel : label}
          disabled={isDisabled}
          onClick={stamp}
        />
        {showClear && isSigned ? (
          <DefaultButton
            text={clearLabel}
            disabled={readOnly || disabled}
            onClick={clearStamp}
          />
        ) : null}
        {showStatus && isSigned && statusText ? (
          <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
            {statusText}
          </Text>
        ) : null}
      </Stack>
    </div>
  )
}
