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

const MoisPatientReviewLink = ({
  fieldId = 'reviewedAndGivenToPatient',
  section,
  href = '',
  linkText = 'Open patient handout',
  linkAriaLabel,
  label = 'I confirm this was reviewed and given to the patient',
  required = false,
  disabled = false,
  openInNewTab = true,
  rel = 'noopener noreferrer',
  showLink = true,
  linkBeforeCheckbox = true,
  note,
  onChange,
  stackTokens = { childrenGap: 8 },
  linkStyles,
  checkboxProps = {},
}) => {
  section = MoisHooks.useSection(section)
  const [fd] = useActiveData()
  const active = section.activeSelector(fd) || {}
  const checked = normalizeChecked(active[fieldId])

  const handleCheckedChange = (_event, isChecked) => {
    const nextValue = !!isChecked

    if (fd?.setFormData) {
      fd.setFormData((draft) => {
        const draftActive = section.activeSelector(draft)
        if (draftActive) {
          draftActive[fieldId] = nextValue
        }
      })
    }

    if (typeof onChange === 'function') {
      onChange(nextValue)
    }
  }

  const linkElement = showLink && href ? (
    <Link
      href={href}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? rel : undefined}
      aria-label={linkAriaLabel || linkText}
      styles={linkStyles}
    >
      {linkText}
    </Link>
  ) : null

  return (
    <div id={fieldId} data-field-id={fieldId}>
      <Stack tokens={stackTokens}>
        {linkBeforeCheckbox ? linkElement : null}
        <Checkbox
          {...checkboxProps}
          label={label}
          required={required}
          checked={checked}
          disabled={disabled}
          onChange={handleCheckedChange}
        />
        {linkBeforeCheckbox ? null : linkElement}
        {note ? <Text variant="small">{note}</Text> : null}
      </Stack>
    </div>
  )
}
