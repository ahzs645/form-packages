/**
 * AuthorshipField — a single clinical value that carries a per-author lock.
 *
 * Drop one of these in place of a standard field when a datum has clinical
 * ownership (a medication instruction, an allergy confirmation, a risk-score
 * interpretation, a consent acknowledgement). The field renders its OWN input,
 * which is the only way per-field locking can be enforced inside real MOIS —
 * native MOIS controls have no per-field read-only flag, so authored values
 * must live inside an authorship-aware component like this one.
 *
 * Authorship runtime: this component uses window.__nhAuth, the shared engine the
 * nhforms generator / Vite loader inlines into its source (see
 * _shared/authorship-runtime.js). Claims are stored in field.data.__authorship
 * and round-trip through save. The lock is advisory collaboration UX, not a
 * server-enforced security boundary.
 */
const { useMemo } = React
const { Stack, Label, Text, TextField, ChoiceGroup, Checkbox } = Fluent

const _nhAuth = () => (typeof window !== "undefined" && window.__nhAuth) || null

const _defaultPolicy = { enabled: true, granularity: "field", lockOn: "edit", editableWindowHours: 72 }

const _normalizeFieldOptions = (options) =>
  Array.isArray(options)
    ? options
        .map((option) => {
          if (typeof option === "string") {
            const trimmed = option.trim()
            return trimmed ? { key: trimmed, text: trimmed } : null
          }
          if (option && typeof option === "object") {
            const key = option.key ?? option.value ?? option.code ?? option.text
            const text = option.text ?? option.label ?? option.display ?? String(key ?? "")
            return key == null ? null : { key: String(key), text: String(text) }
          }
          return null
        })
        .filter(Boolean)
    : []

const AuthorshipField = ({
  fieldId,
  id,
  label = "",
  kind = "text",
  options = [],
  placeholder = "",
  rows = 3,
  booleanLabel,
  policy: policyProp,
  lockOn,
  editableWindowHours,
}) => {
  const [fd, setFormData] = useActiveData()
  const sd = useSourceData()
  const section = typeof useSection === "function" ? useSection() : null

  const componentId = id || fieldId || "AuthorshipField"
  const effectiveFieldId = fieldId || componentId
  const value = fd?.field?.data?.[effectiveFieldId]

  // Policy resolution order: explicit prop > section policy > sensible default,
  // with lockOn / editableWindowHours overrides for convenience.
  const policy = useMemo(() => {
    const base = policyProp || section?.authorshipPolicy || _defaultPolicy
    return {
      enabled: base.enabled !== false,
      granularity: "field",
      lockOn: lockOn || base.lockOn || "edit",
      editableWindowHours:
        typeof editableWindowHours === "number"
          ? editableWindowHours
          : typeof base.editableWindowHours === "number"
            ? base.editableWindowHours
            : 72,
    }
  }, [policyProp, section, lockOn, editableWindowHours])

  const nhAuth = _nhAuth()
  const query = { scope: "field", fieldId: effectiveFieldId, componentId }
  const actor = nhAuth ? nhAuth.actor(sd, fd) : {}
  const lockInfo = nhAuth && policy.enabled
    ? nhAuth.lockInfo(fd, sd, query, {
        ownerId: actor.ownerId,
        ownerName: actor.ownerName,
        now: sd?.previewOptions?.authorshipNow,
      })
    : { locked: false }
  const readOnly = !!lockInfo.locked

  const commitValue = (nextValue) => {
    setFormData(produce((draft) => {
      if (!draft.field) draft.field = { data: {}, status: {}, history: [] }
      if (!draft.field.data || typeof draft.field.data !== "object") draft.field.data = {}
      draft.field.data[effectiveFieldId] = nextValue
      // Lock-on-edit: claim/refresh this author's ownership in the same write,
      // so the read and write halves share one field.data.__authorship surface.
      if (nhAuth && policy.enabled) {
        nhAuth.claim(draft, sd, query, nextValue, policy, {
          now: sd?.previewOptions?.authorshipNow,
        })
      }
    }))
  }

  const renderInput = () => {
    if (kind === "boolean") {
      return (
        <Checkbox
          label={booleanLabel || label}
          checked={value === true}
          disabled={readOnly}
          onChange={readOnly ? undefined : (_event, checked) => commitValue(!!checked)}
        />
      )
    }

    if (kind === "choice") {
      const optionList = _normalizeFieldOptions(options)
      return (
        <ChoiceGroup
          label={label}
          options={optionList}
          selectedKey={value == null ? undefined : String(value)}
          disabled={readOnly}
          onChange={readOnly ? undefined : (_event, option) => commitValue(option?.key ?? "")}
        />
      )
    }

    if (kind === "numeric") {
      return (
        <TextField
          label={label}
          type="number"
          value={value == null ? "" : String(value)}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (_event, nextValue) => {
            if (nextValue == null || nextValue === "") return commitValue("")
            const numeric = Number(nextValue)
            commitValue(Number.isNaN(numeric) ? nextValue : numeric)
          }}
        />
      )
    }

    // text / textarea
    return (
      <TextField
        label={label}
        value={value ?? ""}
        placeholder={placeholder}
        multiline={kind === "textarea"}
        rows={kind === "textarea" ? rows : undefined}
        readOnly={readOnly}
        onChange={readOnly ? undefined : (_event, nextValue) => commitValue(nextValue ?? "")}
      />
    )
  }

  return (
    <Stack tokens={{ childrenGap: 4 }}>
      {renderInput()}
      {lockInfo.note ? (
        <Text variant="small" styles={{ root: { color: lockInfo.locked ? "#a4262c" : "#605e5c" } }}>
          {lockInfo.note}
        </Text>
      ) : null}
    </Stack>
  )
}
