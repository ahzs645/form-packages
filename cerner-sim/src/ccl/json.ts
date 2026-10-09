/**
 * What CCL's record serialiser emits, so replies have the exact value
 * formats clients parse.
 *
 * - Dates: ISO 8601 with milliseconds and a numeric offset. An unset date is
 *   CCL's zero date, `0000-00-00T00:00:00.000+00:00` (documented in the vendor
 *   table component, which renders it blank).
 * - Strings are never null ("" when unset); numbers default to 0.
 * - CNVTRECTOJSON(rec, 4, 1) camel-cases field names (`name_full_formatted`
 *   → `nameFullFormatted`); the default form upper-cases them and wraps
 *   dates as `/Date(…)/`, which is what hand-written `_memory_reply_string`
 *   programs return.
 */

export const CCL_ZERO_DATE = "0000-00-00T00:00:00.000+00:00";

export function cclDate(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) return CCL_ZERO_DATE;
  return value.toISOString().replace("Z", "+00:00");
}

/** Clinical Office replies in the camel-case form. */
export function camelJson(value: unknown): string {
  return JSON.stringify(value, (_key, val) => (val instanceof Date ? cclDate(val) : val));
}

/** `cnvtrectojson(rec)` default form: `{"REC":{"FIELD":…}}`, upper-case keys, `/Date(…)/` dates. */
export function classicRecordJson(recordName: string, record: Record<string, unknown>): string {
  const upper = (value: unknown): unknown => {
    if (value instanceof Date) return `/Date(${cclDate(value)})/`;
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map(upper);
    if (typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, val]) => [key.toUpperCase(), upper(val)]));
    }
    return value;
  };
  return JSON.stringify({ [recordName.toUpperCase()]: upper(record) });
}

/** Cerner age text: "45 Years", "3 Months", "12 Days", "5 Hours". */
export function cernerAge(birth: Date | null, now: Date): string {
  if (!birth) return "";
  const ms = now.getTime() - birth.getTime();
  if (ms < 0) return "";
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return `${Math.max(0, Math.floor(ms / 3_600_000))} Hours`;
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  let months = now.getUTCMonth() - birth.getUTCMonth();
  if (now.getUTCDate() < birth.getUTCDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years >= 2) return `${years} Years`;
  const totalMonths = years * 12 + months;
  if (totalMonths >= 2) return `${totalMonths} Months`;
  if (days >= 14) return `${Math.floor(days / 7)} Weeks`;
  return `${days} Days`;
}

/** CCL's cnvtphone for North American numbers: (250) 555-0142. */
export function formatPhone(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (clean.length === 10) return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
  if (clean.length === 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return clean;
}

/** cnvtrawhex: two upper-case hex digits per byte. */
export function rawHex(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    /* Non-byte characters cannot ride the byte-wise wire; CCL would emit '?' */
    out += (code > 0xff ? 0x3f : code).toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}

/** cnvthexraw, tolerant of the unpadded hex some clients send (one digit for bytes < 0x10 is a client bug, decoded best-effort). */
export function hexRaw(value: string): string {
  const clean = value.trim();
  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    out += Number.isNaN(code) ? "?" : String.fromCharCode(code);
  }
  return out;
}

/** True when text looks like a hex-encoded blob rather than JSON. */
export function looksHex(value: string): boolean {
  const clean = value.trim();
  return clean.length > 0 && clean.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(clean);
}
