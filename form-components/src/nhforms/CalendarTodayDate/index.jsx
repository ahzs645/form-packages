/** Set an empty date to today when its calendar icon is opened. */
const CalendarTodayDate = ({ fieldId, ...dateSelectProps }) => {
  const section = useSection(dateSelectProps.section)
  const [fieldData, setFieldData] = useActiveData(section?.activeSelector)

  const onClickCapture = (event) => {
    if (!fieldId || dateSelectProps.readOnly || dateSelectProps.disabled) return
    const icon = event.target?.closest?.('[role="button"][aria-expanded]')
    if (!icon || fieldData?.[fieldId]) return
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    setFieldData({ [fieldId]: `${year}.${month}.${day}` })
  }

  return (
    <div onClickCapture={onClickCapture}>
      <DateSelect fieldId={fieldId} {...dateSelectProps} />
    </div>
  )
}
