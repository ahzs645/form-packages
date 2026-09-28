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

const STAMP_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const pad2 = (number) => (number < 10 ? "0" : "") + number

// Local wall-clock date/time (the signer's day, not UTC). Tokens match the
// document date formats: yyyy yy MMMM MMM MM M dd d HH H mm.
const formatStampDate = (date, format) =>
  String(format || "yyyy-MM-dd").replace(/yyyy|yy|MMMM|MMM|MM|M|dd|d|HH|H|mm/g, (token) => {
    switch (token) {
      case "yyyy": return String(date.getFullYear())
      case "yy": return pad2(date.getFullYear() % 100)
      case "MMMM": return STAMP_MONTHS[date.getMonth()]
      case "MMM": return STAMP_MONTHS[date.getMonth()].slice(0, 3)
      case "MM": return pad2(date.getMonth() + 1)
      case "M": return String(date.getMonth() + 1)
      case "dd": return pad2(date.getDate())
      case "d": return String(date.getDate())
      case "HH": return pad2(date.getHours())
      case "H": return String(date.getHours())
      default: return pad2(date.getMinutes())
    }
  })

const STAMP_USER_PATHS = {
  userInitials: "userProfile.identity.initials",
  userFullName: "userProfile.identity.fullName",
  userLoginName: "userProfile.loginName",
}

// A value with {tokens} is a template: "{today:dd/MMM/yyyy} {userInitials}"
// stamps "28/Sep/2026 DPU" into one field. {today} and {now} take a date
// format after the colon; the user tokens read the signed-in user's profile.
const resolveStampTemplate = (template, context) => {
  const now = new Date()
  return String(template)
    .replace(/\{(\w+)(?::([^}]*))?\}/g, (match, token, format) => {
      if (token === "today") return formatStampDate(now, format || "yyyy-MM-dd")
      if (token === "now" || token === "time") return formatStampDate(now, format || "HH:mm")
      if (STAMP_USER_PATHS[token]) {
        const value = resolvePathValue(context, STAMP_USER_PATHS[token])
        return value == null ? "" : String(value)
      }
      return match
    })
    .replace(/\s+/g, " ")
    .trim()
}

const resolveLiteralValue = (value, context) => {
  if (value === "$now") return new Date().toISOString()
  if (value === "$today") return formatStampDate(new Date(), "yyyy-MM-dd")
  if (value === "$userInitials") return resolvePathValue(context, "userProfile.identity.initials")
  if (value === "$userFullName") return resolvePathValue(context, "userProfile.identity.fullName")
  if (value === "$userLoginName") return resolvePathValue(context, "userProfile.loginName")
  if (typeof value === "string" && value.indexOf("{") !== -1) return resolveStampTemplate(value, context)
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
