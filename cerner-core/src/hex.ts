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

/**
 * JSON.stringify that escapes every character above U+007E as \uXXXX.
 *
 * Two constraints make this necessary: hex transport is byte-wise (multi-byte
 * characters would corrupt the pairing), and the client must strip raw
 * control characters from CCL replies before parsing — \uXXXX escapes are
 * plain ASCII and survive both.
 */
export function toAsciiJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new Error("toAsciiJson: value is not JSON-serializable");
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
