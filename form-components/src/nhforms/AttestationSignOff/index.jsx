const { useEffect, useMemo } = React
const { Stack, TextField, Dropdown, Text, Separator } = Fluent

const normalizeInitialsName = (value) => String(value || "").replace(/\([^)]*\)/g, " ").trim()

const deriveInitials = (name) => {
  const cleaned = normalizeInitialsName(name)
  if (!cleaned) return ""
  const parts = cleaned
    .split(/[\s,.-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return parts.map((part) => part[0]).join("").slice(0, 4).toUpperCase()
}

const normalizeRoleOptions = (roles) => {
  const source = Array.isArray(roles) && roles.length > 0 ? roles : ["MD", "RM", "NP"]
  return source.map((role) => {
    if (role && typeof role === "object") {
      const key = String(role.key || role.value || role.text || role.label || "").trim()
      const text = String(role.text || role.label || role.value || role.key || key).trim()
      return { key, text }
    }
    const key = String(role || "").trim()
    return { key, text: key }
  }).filter((role) => role.key)
}

const normalizeTargets = (targets) => {
  if (!Array.isArray(targets)) return []
  return targets
    .map((target) => ({
      fieldId: String(target?.fieldId || "").trim(),
      rowKey: String(target?.rowKey || "").trim(),
      columnId: String(target?.columnId || target?.initialsColumnId || "initials").trim(),
    }))
    .filter((target) => target.fieldId && target.rowKey && target.columnId)
}

const getCurrentActorName = (sourceData, fieldData, fallback) => (
  fallback
  || fieldData?.createdBy
  || sourceData?.userProfile?.identity?.fullName
  || sourceData?.webform?.provider?.name
  || sourceData?.webform?.encounter?.attendingProvider?.display
  || ""
)

const AttestationSignOff = ({
  fieldId = "attestationSignOff",
  label = "Sign-Off",
  nameLabel = "Name",
  roleLabel = "Role",
  initialsLabel = "Initials",
  signatureLabel = "Signature",
  signedAtLabel = "Signed at",
  roles = ["MD", "RM", "NP"],
  initialsFieldIds = [],
  initialsTargets = [],
  defaultName,
  readOnly = false,
}) => {
  const [fieldData, setFieldData] = useActiveData(fd => fd.field.data)
  const sd = useSourceData()
  const value = fieldData?.[fieldId] && typeof fieldData[fieldId] === "object" ? fieldData[fieldId] : {}
  const signatureFieldId = `${fieldId}_signature`
  const signatureValue = fieldData?.[signatureFieldId]
  const roleOptions = useMemo(() => normalizeRoleOptions(roles), [roles])
  const nestedTargets = useMemo(() => normalizeTargets(initialsTargets), [initialsTargets])
  const name = value.name || getCurrentActorName(sd, fieldData, defaultName)
  const initials = value.initials || deriveInitials(name)
  const signedAt = value.signedAt || (signatureValue?.dataUrl ? new Date().toISOString() : "")

  useEffect(() => {
    if (!name && !initials && !signatureValue?.dataUrl) return
    setFieldData((draft) => {
      const current = draft[fieldId] && typeof draft[fieldId] === "object" ? draft[fieldId] : {}
      draft[fieldId] = {
        ...current,
        name,
        initials,
        signedAt,
        signatureFieldId,
        signatureCaptured: !!signatureValue?.dataUrl,
      }
    })
  }, [fieldId, initials, name, setFieldData, signatureFieldId, signatureValue?.dataUrl, signedAt])

  useEffect(() => {
    if (!initials) return
    const flatTargets = Array.isArray(initialsFieldIds) ? initialsFieldIds.map((id) => String(id || "").trim()).filter(Boolean) : []
    if (flatTargets.length === 0 && nestedTargets.length === 0) return
    setFieldData((draft) => {
      flatTargets.forEach((targetFieldId) => {
        draft[targetFieldId] = initials
      })
      nestedTargets.forEach((target) => {
        const table = draft[target.fieldId] && typeof draft[target.fieldId] === "object" ? draft[target.fieldId] : {}
        const row = table[target.rowKey] && typeof table[target.rowKey] === "object" ? table[target.rowKey] : {}
        draft[target.fieldId] = {
          ...table,
          [target.rowKey]: {
            ...row,
            [target.columnId]: initials,
          },
        }
      })
    })
  }, [initials, initialsFieldIds, nestedTargets, setFieldData])

  const updateValue = (patch) => {
    setFieldData((draft) => {
      const current = draft[fieldId] && typeof draft[fieldId] === "object" ? draft[fieldId] : {}
      const next = { ...current, ...patch }
      if (Object.prototype.hasOwnProperty.call(patch, "name")) {
        next.initials = deriveInitials(patch.name)
      }
      draft[fieldId] = next
    })
  }

  return (
    <Stack tokens={{ childrenGap: 8 }} style={{ marginBottom: 12 }}>
      <Text variant="mediumPlus">{label}</Text>
      <Stack horizontal wrap tokens={{ childrenGap: 12 }}>
        <TextField
          label={nameLabel}
          value={name}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (_event, nextValue) => updateValue({ name: nextValue || "" })}
          styles={{ root: { minWidth: 220, flex: "1 1 220px" } }}
        />
        <Dropdown
          label={roleLabel}
          selectedKey={value.role || undefined}
          options={roleOptions}
          disabled={readOnly}
          onChange={readOnly ? undefined : (_event, option) => updateValue({ role: option?.key || "" })}
          styles={{ root: { minWidth: 120 } }}
        />
        <TextField
          label={initialsLabel}
          value={initials}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (_event, nextValue) => updateValue({ initials: String(nextValue || "").toUpperCase() })}
          styles={{ root: { width: 110 } }}
        />
      </Stack>
      <SignaturePad fieldId={signatureFieldId} label={signatureLabel} readOnly={readOnly} height={96} />
      {signedAt ? (
        <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
          {signedAtLabel}: {signedAt}
        </Text>
      ) : null}
      <Separator />
    </Stack>
  )
}
