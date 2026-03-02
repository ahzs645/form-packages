/**
 * MoisPatientReviewLink
 * Displays a hyperlink and confirmation checkbox for patient handouts/information sheets.
 */

const { Stack, Checkbox, Link, Text } = Fluent

const normalizeChecked = (value) => {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1'
  }
  return false
}

const normalizeFieldId = (fieldId, id) => {
  if (typeof fieldId === 'string' && fieldId.trim()) return fieldId.trim()
  if (typeof id === 'string' && id.trim()) return id.trim()
  return 'reviewedAndGivenToPatient'
}

const normalizeResourceIdPart = (value) => {
  if (typeof value !== 'string' || !value.trim()) return ''
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const buildResourceFieldId = (resource, index, fallbackBaseId) => {
  const fromProps = normalizeFieldId(resource?.fieldId, resource?.id)
  const hasExplicitId =
    (typeof resource?.fieldId === 'string' && resource.fieldId.trim()) ||
    (typeof resource?.id === 'string' && resource.id.trim())
  if (hasExplicitId) return fromProps

  const idPart =
    normalizeResourceIdPart(resource?.linkText) ||
    normalizeResourceIdPart(resource?.href) ||
    String(index + 1)
  return `${fallbackBaseId}_${idPart}`
}

const normalizeResourceItem = (resource, index, defaults) => {
  const item = resource && typeof resource === 'object' ? resource : {}
  return {
    fieldId: buildResourceFieldId(item, index, defaults.baseFieldId),
    href: typeof item.href === 'string' ? item.href : defaults.href,
    linkText:
      typeof item.linkText === 'string' && item.linkText.trim()
        ? item.linkText
        : defaults.linkText,
    linkAriaLabel:
      typeof item.linkAriaLabel === 'string' && item.linkAriaLabel.trim()
        ? item.linkAriaLabel
        : defaults.linkAriaLabel,
    label:
      typeof item.label === 'string' && item.label.trim()
        ? item.label
        : defaults.label,
    confirmEnabled:
      typeof item.confirmEnabled === 'boolean'
        ? item.confirmEnabled
        : defaults.confirmEnabled,
    showLink:
      typeof item.showLink === 'boolean'
        ? item.showLink
        : defaults.showLink,
    note:
      typeof item.note === 'string' && item.note.trim()
        ? item.note
        : undefined,
  }
}

const MoisPatientReviewLink = ({
  id,
  fieldId = 'reviewedAndGivenToPatient',
  section,
  href = '',
  linkText = 'Open patient handout',
  linkAriaLabel,
  resources = [],
  confirmEnabled = true,
  label = 'I confirm this was reviewed and given to the patient',
  required = false,
  disabled = false,
  openInNewTab = true,
  rel = 'noopener noreferrer',
  showLink = true,
  linkBeforeCheckbox = true,
  layoutStyle = 'stacked',
  showTableHeader = true,
  tableResourceHeader = 'Resource',
  tableConfirmHeader = 'Reviewed / given to patient',
  note,
  onChange,
  stackTokens = { childrenGap: 8 },
  linkStyles,
  checkboxProps = {},
}) => {
  const resolvedFieldId = normalizeFieldId(fieldId, id)
  section = MoisHooks.useSection(section)
  const [fd] = useActiveData()
  const active = section.activeSelector(fd) || {}

  const resourceItems = Array.isArray(resources) && resources.length > 0
    ? resources.map((resource, index) =>
      normalizeResourceItem(resource, index, {
        baseFieldId: resolvedFieldId,
        href,
        linkText,
        linkAriaLabel,
        label,
        confirmEnabled,
        showLink,
      })
    )
    : [{
      fieldId: resolvedFieldId,
      href,
      linkText,
      linkAriaLabel,
      label,
      confirmEnabled,
      showLink,
      note,
    }]
  const renderAsTable = layoutStyle === 'table'

  const handleCheckedChange = (targetFieldId, _event, isChecked) => {
    const nextValue = !!isChecked

    if (fd?.setFormData) {
      fd.setFormData((draft) => {
        const draftActive = section.activeSelector(draft)
        if (draftActive) {
          draftActive[targetFieldId] = nextValue
        }
      })
    }

    if (typeof onChange === 'function') {
      onChange(nextValue, targetFieldId)
    }
  }

  return (
    <div id={resolvedFieldId} data-field-id={resolvedFieldId}>
      {renderAsTable ? (
        <div style={{ border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            {showTableHeader ? (
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderBottom: '1px solid #d1d5db',
                      background: '#f3f4f6',
                      fontSize: 12,
                    }}
                  >
                    {tableResourceHeader}
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderBottom: '1px solid #d1d5db',
                      background: '#f3f4f6',
                      fontSize: 12,
                    }}
                  >
                    {tableConfirmHeader}
                  </th>
                </tr>
              </thead>
            ) : null}
            <tbody>
              {resourceItems.map((item, index) => {
                const checked = normalizeChecked(active[item.fieldId])
                const linkElement = item.showLink && item.href ? (
                  <Link
                    href={item.href}
                    target={openInNewTab ? '_blank' : undefined}
                    rel={openInNewTab ? rel : undefined}
                    aria-label={item.linkAriaLabel || item.linkText}
                    styles={linkStyles}
                  >
                    {item.linkText}
                  </Link>
                ) : (
                  <Text>{item.linkText}</Text>
                )

                return (
                  <tr key={`${item.fieldId}_${index}`} style={{ background: index % 2 ? '#f8fafc' : '#ffffff' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                      {linkElement}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                      {item.confirmEnabled ? (
                        <Checkbox
                          {...checkboxProps}
                          label={item.label}
                          required={required}
                          checked={checked}
                          disabled={disabled}
                          onChange={(event, isChecked) => handleCheckedChange(item.fieldId, event, isChecked)}
                        />
                      ) : null}
                      {item.note ? <Text variant='small'>{item.note}</Text> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Stack tokens={{ childrenGap: 10 }}>
          {resourceItems.map((item, index) => {
            const checked = normalizeChecked(active[item.fieldId])
            const linkElement = item.showLink && item.href ? (
              <Link
                href={item.href}
                target={openInNewTab ? '_blank' : undefined}
                rel={openInNewTab ? rel : undefined}
                aria-label={item.linkAriaLabel || item.linkText}
                styles={linkStyles}
              >
                {item.linkText}
              </Link>
            ) : null

            return (
              <Stack key={`${item.fieldId}_${index}`} tokens={stackTokens}>
                {linkBeforeCheckbox ? linkElement : null}
                {item.confirmEnabled ? (
                  <Checkbox
                    {...checkboxProps}
                    label={item.label}
                    required={required}
                    checked={checked}
                    disabled={disabled}
                    onChange={(event, isChecked) => handleCheckedChange(item.fieldId, event, isChecked)}
                  />
                ) : null}
                {linkBeforeCheckbox ? null : linkElement}
                {item.note ? <Text variant="small">{item.note}</Text> : null}
              </Stack>
            )
          })}
        </Stack>
      )}
    </div>
  )
}
