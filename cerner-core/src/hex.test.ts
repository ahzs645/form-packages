import { describe, expect, it } from "vitest";

import { hexDecode, hexEncode, stripControlChars, toAsciiJson } from "./hex";

describe("hexEncode/hexDecode", () => {
  it("round-trips ASCII payloads", () => {
    const input = '{"payload":{"patientSource":[{"personId":0,"encntrId":0}]}}';
    expect(hexDecode(hexEncode(input))).toBe(input);
  });

  it("pads low char codes to two digits", () => {
    expect(hexEncode("\n")).toBe("0a");
    expect(hexDecode("0a")).toBe("\n");
  });

  it("round-trips latin-1 characters as single bytes", () => {
    expect(hexDecode(hexEncode("café"))).toBe("café");
  });

  it("rejects characters above one byte", () => {
    expect(() => hexEncode("em—dash")).toThrow(/toAsciiJson/);
  });

  it("rejects odd-length and invalid hex input", () => {
    expect(() => hexDecode("abc")).toThrow(/multiple of two/);
    expect(() => hexDecode("zz")).toThrow(/invalid hex pair/);
  });
});

describe("toAsciiJson", () => {
  it("escapes non-ASCII characters so the result is hex-safe", () => {
    const json = toAsciiJson({ name: "Renée Müller — été" });
    expect(json).toBe('{"name":"Ren\\u00e9e M\\u00fcller \\u2014 \\u00e9t\\u00e9"}');
    expect(() => hexEncode(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual({ name: "Renée Müller — été" });
  });

  it("keeps control characters as backslash escapes that survive stripping", () => {
    const json = toAsciiJson({ note: "line one\nline two\ttabbed" });
    expect(stripControlChars(json)).toBe(json);
    expect(JSON.parse(json)).toEqual({ note: "line one\nline two\ttabbed" });
  });

  it("throws on non-serializable values", () => {
    expect(() => toAsciiJson(undefined)).toThrow(/not JSON-serializable/);
  });
});

describe("stripControlChars", () => {
  it("removes raw control characters spliced into CCL replies", () => {
    expect(stripControlChars('{"a":\n\t"b"\r}')).toBe('{"a":"b"}');
  });
});
