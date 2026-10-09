/**
 * Hex transcoding for the off-PowerChart transport path.
 *
 * When the entry script is reached over Discern Web Services (dev proxy or
 * contextRoot) the JSON blob rides in a form-encoded POST body, which mangles
 * raw JSON. The wire convention is byte-wise hex both directions (CCL's
 * cnvthexraw/cnvtrawhex), which only round-trips single-byte characters —
 * so payloads must be ASCII-safe first (see toAsciiJson).
 */

export function hexEncode(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0xff) {
      throw new Error(
        `hexEncode: non-byte character (U+${code.toString(16)}) at index ${i}; ` +
          "serialize payloads with toAsciiJson() before encoding",
      );
    }
    const hex = code.toString(16);
    out += hex.length === 1 ? "0" + hex : hex;
  }
  return out;
}

export function hexDecode(value: string): string {
  if (value.length % 2 !== 0) {
    throw new Error("hexDecode: input length is not a multiple of two");
  }
  let out = "";
  for (let i = 0; i < value.length; i += 2) {
    const code = parseInt(value.substring(i, i + 2), 16);
    if (isNaN(code)) {
      throw new Error(`hexDecode: invalid hex pair at index ${i}`);
    }
    out += String.fromCharCode(code);
  }
  return out;
}

const F8_SENTINEL = "{forcef8}";
const F8_KEY_PATTERN = /(Cd|Id|Float)$/;
const F8_LIST_KEY_PATTERN = /(Cd|Id|Float)s?$/;

export interface AsciiJsonOptions {
  /**
   * Emit whole-number values whose key ends in Cd/Id/Float as unquoted
   * floats ("personId":123 becomes "personId":123.0) so CCL's
   * CNVTJSONTOREC types them f8 instead of i4 — Millennium ids overflow i4.
   * Lists under such a key, singular or plural ("eventIds", "typeCds"), get
   * the same treatment element by element: a list item has no key of its
   * own for the rule to match.
   */
  forceF8Ids?: boolean;
  /**
   * Float every whole number inside any list, whatever its key. For lists
   * keyed by names the id rule cannot recognise (`"selected": [123456789012]`).
   * Opt-in: CCL then types every numeric list element f8, counts included.
   */
  forceF8Arrays?: boolean;
}

const isWholeNumber = (val: unknown): val is number =>
  typeof val === "number" && Number.isFinite(val) && val === Math.floor(val);

const asF8 = (val: number) => F8_SENTINEL + val + ".0" + F8_SENTINEL;

/**
 * JSON.stringify that escapes every character above U+007E as \uXXXX.
 *
 * Two constraints make this necessary: hex transport is byte-wise (multi-byte
 * characters would corrupt the pairing), and the client must strip raw
 * control characters from CCL replies before parsing — \uXXXX escapes are
 * plain ASCII and survive both.
 *
 * Whether CNVTJSONTOREC turns those escapes back into the original characters
 * has not been confirmed in a Millennium domain (see the cerner-ccl README
 * first-compile checklist); prior art folds typographic quotes to ASCII and
 * drops other non-ASCII text before writing to custom tables.
 */
export function toAsciiJson(value: unknown, options?: AsciiJsonOptions): string {
  const forceIds = options?.forceF8Ids === true;
  const forceArrays = options?.forceF8Arrays === true;
  const replacer =
    forceIds || forceArrays
      ? function (this: unknown, key: string, val: unknown) {
          if (forceArrays && Array.isArray(this) && isWholeNumber(val)) return asF8(val);
          if (!forceIds) return val;
          if (isWholeNumber(val) && F8_KEY_PATTERN.test(key)) return asF8(val);
          if (Array.isArray(val) && F8_LIST_KEY_PATTERN.test(key)) {
            return val.map((item) => (isWholeNumber(item) ? asF8(item) : item));
          }
          return val;
        }
      : undefined;
  let json = JSON.stringify(value, replacer as never);
  if (json === undefined) {
    throw new Error("toAsciiJson: value is not JSON-serializable");
  }
  if (forceIds || forceArrays) {
    json = json.replace(/"\{forcef8\}|\{forcef8\}"/g, "");
  }
  return json.replace(/[\u007f-\uffff]/g, (ch) => {
    const hex = ch.charCodeAt(0).toString(16);
    return "\\u" + "0000".substring(hex.length) + hex;
  });
}

/**
 * CCL replies are spliced together server-side and can contain raw newlines
 * or tabs between segments; they are never legitimate inside the JSON itself
 * (string values arrive with backslash escapes), so strip before parsing.
 */
export function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1f]/g, "");
}
