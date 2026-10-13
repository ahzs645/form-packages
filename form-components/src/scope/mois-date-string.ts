/**
 * MOIS getDateString(date, separator = "."), as the engine defines it
 * (SMOIS main.a75cc6b1.chunk.js, module 27, export `o`): the LOCAL calendar
 * date, zero-padded, joined with the separator. A string is read as a
 * year-month-day date (".", "/" or "-" between the parts) on the local
 * calendar; any other value goes through `new Date`.
 *
 * The preview previously returned `toISOString()`'s UTC date and ignored the
 * separator, so a form saving `getDateString(now, "-")` in the evening got
 * tomorrow's date (found holding the rebuilt MoCA to the NH source's
 * reportedDate).
 */
export function moisGetDateString(date: unknown, separator = "."): string {
  if (!date) return "";
  let value: Date;
  if (typeof date === "string") {
    const parts = date.trim().replace(/[./]/g, "-").split("-");
    value = parts.length === 3 && parts.every((part) => /^\d+$/.test(part))
      ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      : new Date(date);
  } else if (date instanceof Date) {
    value = date;
  } else {
    value = new Date(date as number);
  }
  if (Number.isNaN(value.getTime())) return "";
  const month = value.getMonth() + 1;
  const day = value.getDate();
  return [value.getFullYear(), (month > 9 ? "" : "0") + month, (day > 9 ? "" : "0") + day].join(separator);
}
