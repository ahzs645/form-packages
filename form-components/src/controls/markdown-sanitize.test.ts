import { describe, it, expect } from "vitest";
import { sanitizeMoisMarkdown } from "./markdown-sanitize";

describe("sanitizeMoisMarkdown", () => {
  it("unwraps strikethrough to plain text", () => {
    expect(sanitizeMoisMarkdown("~~gone~~")).toBe("gone");
    expect(sanitizeMoisMarkdown("a ~~b~~ c")).toBe("a b c");
    expect(sanitizeMoisMarkdown("~~one~~ and ~~two~~")).toBe("one and two");
  });

  it("preserves bold, italic, headings and lists", () => {
    const md = "# Heading\n\n**bold** and *italic*\n\n- one\n- two";
    expect(sanitizeMoisMarkdown(md)).toBe(md);
  });

  it("preserves GFM tables", () => {
    const table = "| a | b |\n| - | - |\n| 1 | 2 |";
    expect(sanitizeMoisMarkdown(table)).toBe(table);
  });

  it("preserves links and inline code", () => {
    const md = "see [docs](https://example.com) and `code`";
    expect(sanitizeMoisMarkdown(md)).toBe(md);
  });

  it("leaves unpaired tildes untouched", () => {
    expect(sanitizeMoisMarkdown("a ~~ b")).toBe("a ~~ b");
    expect(sanitizeMoisMarkdown("approx ~5 items")).toBe("approx ~5 items");
  });

  it("does not cross line boundaries", () => {
    const md = "~~start\nend~~";
    expect(sanitizeMoisMarkdown(md)).toBe(md);
  });

  it("handles empty input", () => {
    expect(sanitizeMoisMarkdown("")).toBe("");
  });
});
