/** Month/year presentation through DateSelect's supported Fluent overrides.
 * Saved answers retain the MOIS canonical date; document output is formatted
 * separately. Typed MM/YYYY values use the first day of the chosen month.
 */
const MonthYearDate = ({ datePickerProps = {}, placeholder, ...props }) => {
  const formatMonthYear = (date) => date && Number.isFinite(date.getTime())
    ? `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`
    : ""
  const parseMonthYear = (text) => {
    const match = /^(\d{1,2})\/(\d{4})$/.exec(String(text || "").trim())
    if (!match || +match[1] < 1 || +match[1] > 12) return null
    const date = new Date(0)
    date.setFullYear(+match[2], +match[1] - 1, 1)
    date.setHours(0, 0, 0, 0)
    return date
  }
  return (
    <DateSelect
      {...props}
      placeholder={placeholder || "MM/YYYY"}
      buttonControls={false}
      showAge={false}
      datePickerProps={{
        ...datePickerProps,
        formatDate: formatMonthYear,
        parseDateFromString: parseMonthYear,
        ...(datePickerProps.strings ? { strings: { ...datePickerProps.strings, invalidInputErrorMessage: "Enter a valid month and year in MM/YYYY format" } } : {}),
        calendarProps: {
          ...datePickerProps.calendarProps,
          isDayPickerVisible: false,
          isMonthPickerVisible: true,
          showMonthPickerAsOverlay: false,
          highlightSelectedMonth: true,
        },
      }}
    />
  )
}
